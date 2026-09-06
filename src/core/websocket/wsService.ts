import { mockWsServer } from './mockServer'
import { parseWsServerMessage } from '@/types/validation'
import type {
  WsClientMessage,
  WsServerMessage,
  WsSubscribeAction,
  WsUnsubscribeAction,
  WsPingAction,
} from '@/types/websocket'
import type { ConnectionStatus } from '@/types/connection'
import { useConnectionStore } from '../store/useConnectionStore'

export interface WsServiceConfig {
  heartbeatIntervalMs?: number
  heartbeatTimeoutMs?: number
  maxReconnectAttempts?: number
  baseReconnectDelayMs?: number
  maxReconnectDelayMs?: number
}

type MessageListener = (msg: WsServerMessage) => void
type TypedMessageListener<T extends WsServerMessage['type']> = (
  msg: Extract<WsServerMessage, { type: T }>
) => void
type StateListener = (status: ConnectionStatus) => void
type ErrorListener = (error: unknown) => void

export class WebSocketService {
  private serverTransport: { send: (msg: string) => void; disconnect: () => void } | null = null
  private status: ConnectionStatus = 'DISCONNECTED'
  private config: Required<WsServiceConfig>

  // Subscriptions & Listeners
  private activeSubscriptions = new Set<string>()
  private messageListeners = new Set<MessageListener>()
  private typedListeners = new Map<string, Set<(msg: unknown) => void>>()
  private stateListeners = new Set<StateListener>()
  private errorListeners = new Set<ErrorListener>()

  // Heartbeat & Reconnect timers
  private heartbeatTimer: number | null = null
  private heartbeatTimeoutTimer: number | null = null
  private reconnectTimer: number | null = null
  private reconnectAttempts = 0
  private lastPingSentTimestamp = 0
  private isExplicitlyClosed = false

  constructor(config: WsServiceConfig = {}) {
    this.config = {
      heartbeatIntervalMs: config.heartbeatIntervalMs ?? 10_000,
      heartbeatTimeoutMs: config.heartbeatTimeoutMs ?? 5_000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 5,
      baseReconnectDelayMs: config.baseReconnectDelayMs ?? 1_000,
      maxReconnectDelayMs: config.maxReconnectDelayMs ?? 10_000,
    }
  }

  public getStatus(): ConnectionStatus {
    return this.status
  }

  public connect(): void {
    if (this.status === 'CONNECTED' || this.status === 'CONNECTING') return

    this.isExplicitlyClosed = false
    this.setStatus('CONNECTING')

    try {
      this.serverTransport = mockWsServer.connect((rawString: string) => {
        this.handleIncomingRawMessage(rawString)
      })

      this.setStatus('CONNECTED')
      this.reconnectAttempts = 0
      useConnectionStore.getState().resetReconnectAttempts()

      this.startHeartbeat()
      this.resubscribeActiveTopics()
    } catch (err) {
      this.setStatus('ERROR')
      this.notifyError(err)
      this.scheduleReconnect()
    }
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true
    this.stopHeartbeat()
    this.clearReconnectTimer()

    if (this.serverTransport) {
      this.serverTransport.disconnect()
      this.serverTransport = null
    }

    this.setStatus('DISCONNECTED')
  }

  public reconnect(): void {
    this.disconnect()
    this.connect()
  }

  public subscribe(channels: string[], symbols: string[] = ['BTC/USDT']): void {
    for (const ch of channels) {
      for (const sym of symbols) {
        this.activeSubscriptions.add(`${ch}:${sym}`)
        useConnectionStore.getState().addSubscription(`${ch}:${sym}`)
      }
    }

    if (this.status === 'CONNECTED') {
      const msg: WsSubscribeAction = {
        action: 'subscribe',
        channels,
        symbols,
      }
      this.send(msg)
    }
  }

  public unsubscribe(channels: string[], symbols: string[] = ['BTC/USDT']): void {
    for (const ch of channels) {
      for (const sym of symbols) {
        this.activeSubscriptions.delete(`${ch}:${sym}`)
        useConnectionStore.getState().removeSubscription(`${ch}:${sym}`)
      }
    }

    if (this.status === 'CONNECTED') {
      const msg: WsUnsubscribeAction = {
        action: 'unsubscribe',
        channels,
        symbols,
      }
      this.send(msg)
    }
  }

  public send(msg: WsClientMessage): boolean {
    if (this.status !== 'CONNECTED' || !this.serverTransport) {
      return false
    }

    try {
      this.serverTransport.send(JSON.stringify(msg))
      useConnectionStore.getState().recordMessageSent()
      return true
    } catch (err) {
      this.notifyError(err)
      return false
    }
  }

  /**
   * Safely parses raw incoming messages, validating against domain schemas.
   * Gracefully ignores corrupted JSON or unknown types without throwing.
   */
  public handleIncomingRawMessage(raw: unknown): void {
    useConnectionStore.getState().recordMessageReceived(typeof raw === 'string' ? raw.length : 128)

    const parseResult = parseWsServerMessage(raw)
    if (!parseResult.success) {
      // Safely ignore malformed or unknown packets and notify error listeners
      this.notifyError(new Error(parseResult.error))
      return
    }

    const message = parseResult.data

    // Handle Heartbeat Pong
    if (message.type === 'pong') {
      this.handlePong()
      return
    }

    // Broadcast to global message listeners
    for (const listener of this.messageListeners) {
      try {
        listener(message)
      } catch (err) {
        this.notifyError(err)
      }
    }

    // Broadcast to typed listeners
    const listeners = this.typedListeners.get(message.type)
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(message)
        } catch (err) {
          this.notifyError(err)
        }
      }
    }
  }

  // --- Listener Subscriptions ---

  public onMessage(handler: MessageListener): () => void {
    this.messageListeners.add(handler)
    return () => {
      this.messageListeners.delete(handler)
    }
  }

  public on<T extends WsServerMessage['type']>(
    type: T,
    handler: TypedMessageListener<T>
  ): () => void {
    if (!this.typedListeners.has(type)) {
      this.typedListeners.set(type, new Set())
    }
    const set = this.typedListeners.get(type)!
    const genericHandler = handler as (msg: unknown) => void
    set.add(genericHandler)

    return () => {
      set.delete(genericHandler)
      if (set.size === 0) {
        this.typedListeners.delete(type)
      }
    }
  }

  public onStateChange(handler: StateListener): () => void {
    this.stateListeners.add(handler)
    return () => {
      this.stateListeners.delete(handler)
    }
  }

  public onError(handler: ErrorListener): () => void {
    this.errorListeners.add(handler)
    return () => {
      this.errorListeners.delete(handler)
    }
  }

  // --- Private Helpers ---

  private setStatus(newStatus: ConnectionStatus): void {
    if (this.status === newStatus) return
    this.status = newStatus
    useConnectionStore.getState().setStatus(newStatus)

    for (const listener of this.stateListeners) {
      listener(newStatus)
    }
  }

  private notifyError(err: unknown): void {
    for (const listener of this.errorListeners) {
      listener(err)
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()

    this.heartbeatTimer = window.setInterval(() => {
      if (this.status !== 'CONNECTED') return

      this.lastPingSentTimestamp = Date.now()
      const pingMsg: WsPingAction = {
        action: 'ping',
        timestamp: this.lastPingSentTimestamp,
      }
      this.send(pingMsg)

      // Start ping timeout
      this.heartbeatTimeoutTimer = window.setTimeout(() => {
        // Connection dead - trigger reconnect
        this.setStatus('DEGRADED')
        this.scheduleReconnect()
      }, this.config.heartbeatTimeoutMs)
    }, this.config.heartbeatIntervalMs)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    if (this.heartbeatTimeoutTimer !== null) {
      clearTimeout(this.heartbeatTimeoutTimer)
      this.heartbeatTimeoutTimer = null
    }
  }

  private handlePong(): void {
    if (this.heartbeatTimeoutTimer !== null) {
      clearTimeout(this.heartbeatTimeoutTimer)
      this.heartbeatTimeoutTimer = null
    }

    if (this.lastPingSentTimestamp > 0) {
      const rtt = Math.max(1, Date.now() - this.lastPingSentTimestamp)
      useConnectionStore.getState().setLatency(rtt)
      useConnectionStore.getState().setLastHeartbeat(Date.now())
    }
  }

  private resubscribeActiveTopics(): void {
    if (this.activeSubscriptions.size === 0) return

    const channelMap = new Map<string, string[]>()
    for (const sub of this.activeSubscriptions) {
      const [channel, symbol] = sub.split(':')
      if (channel && symbol) {
        if (!channelMap.has(channel)) channelMap.set(channel, [])
        channelMap.get(channel)!.push(symbol)
      }
    }

    for (const [channel, symbols] of channelMap.entries()) {
      this.send({
        action: 'subscribe',
        channels: [channel],
        symbols,
      })
    }
  }

  private scheduleReconnect(): void {
    if (this.isExplicitlyClosed) return
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.setStatus('ERROR')
      return
    }

    this.setStatus('RECONNECTING')
    this.reconnectAttempts++
    useConnectionStore.getState().recordReconnectAttempt()

    const delay = Math.min(
      this.config.baseReconnectDelayMs * 2 ** (this.reconnectAttempts - 1),
      this.config.maxReconnectDelayMs
    )

    this.clearReconnectTimer()
    this.reconnectTimer = window.setTimeout(() => {
      this.connect()
    }, delay)
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }
}

export const wsService = new WebSocketService()
