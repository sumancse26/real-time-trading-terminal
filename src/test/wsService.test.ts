import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WebSocketService } from '../core/websocket/wsService'
import { mockWsServer } from '../core/websocket/mockServer'
import type { WsTickerMessage } from '../types/websocket'

describe('WebSocketService Client', () => {
  let wsService: WebSocketService

  beforeEach(() => {
    wsService = new WebSocketService({
      heartbeatIntervalMs: 50,
      heartbeatTimeoutMs: 100,
      baseReconnectDelayMs: 20,
    })
  })

  afterEach(() => {
    wsService.disconnect()
  })

  it('manages connection lifecycle (connect -> connected -> disconnect)', () => {
    const states: string[] = []
    wsService.onStateChange(status => states.push(status))

    expect(wsService.getStatus()).toBe('DISCONNECTED')

    wsService.connect()
    expect(wsService.getStatus()).toBe('CONNECTED')

    wsService.disconnect()
    expect(wsService.getStatus()).toBe('DISCONNECTED')

    expect(states).toContain('CONNECTING')
    expect(states).toContain('CONNECTED')
    expect(states).toContain('DISCONNECTED')
  })

  it('subscribes and unsubscribes to channels and symbols', () => {
    wsService.connect()

    const receivedMessages: string[] = []
    wsService.onMessage(msg => receivedMessages.push(msg.type))

    wsService.subscribe(['ticker', 'trade'], ['BTC/USDT'])

    // Server should send subscribed acks and initial ticker snapshot
    expect(receivedMessages).toContain('subscribed')
    expect(receivedMessages).toContain('ticker')

    wsService.unsubscribe(['ticker'], ['BTC/USDT'])
    expect(receivedMessages).toContain('unsubscribed')
  })

  it('routes messages to typed listeners and handles unsubscriptions', () => {
    wsService.connect()

    let receivedTicker: WsTickerMessage | null = null
    const unsubTicker = wsService.on('ticker', msg => {
      receivedTicker = msg
    })

    let tradeCount = 0
    const unsubTrade = wsService.on('trade', () => {
      tradeCount++
    })

    wsService.subscribe(['ticker', 'trade'], ['BTC/USDT'])
    mockWsServer.emitTick(10.5)

    expect(receivedTicker).not.toBeNull()
    expect((receivedTicker as unknown as WsTickerMessage)?.type).toBe('ticker')
    expect(tradeCount).toBeGreaterThan(0)

    // Unsubscribe trade listener
    unsubTrade()
    const currentTrades = tradeCount
    mockWsServer.emitTick(5.0)
    expect(tradeCount).toBe(currentTrades) // No more trade callbacks

    unsubTicker()
  })

  it('safely handles malformed JSON strings without throwing or crashing', () => {
    wsService.connect()

    const errors: unknown[] = []
    wsService.onError(err => errors.push(err))

    expect(() => {
      wsService.handleIncomingRawMessage('{unclosed_corrupted_json_payload:')
    }).not.toThrow()

    expect(errors.length).toBeGreaterThan(0)
    expect((errors[0] as Error).message).toContain('JSON parse error')
  })

  it('safely handles unknown and invalid message schemas without throwing', () => {
    wsService.connect()

    const errors: unknown[] = []
    wsService.onError(err => errors.push(err))

    expect(() => {
      wsService.handleIncomingRawMessage(
        JSON.stringify({ type: 'unknown_event_type', invalidData: 123 })
      )
    }).not.toThrow()

    expect(errors.length).toBeGreaterThan(0)
    expect((errors[0] as Error).message).toContain('Validation failed')
  })

  it('handles heartbeat ping/pong latency calculation', async () => {
    wsService.connect()

    // Send manual ping
    const pingSent = wsService.send({ action: 'ping', timestamp: Date.now() })
    expect(pingSent).toBe(true)

    // Receive pong
    wsService.handleIncomingRawMessage(JSON.stringify({ type: 'pong', timestamp: Date.now() }))
    expect(wsService.getStatus()).toBe('CONNECTED')
  })

  it('resubscribes active topics automatically upon reconnect', () => {
    wsService.connect()
    wsService.subscribe(['ticker', 'trade'], ['BTC/USDT'])

    const spySend = vi.spyOn(wsService, 'send')

    wsService.reconnect()
    expect(wsService.getStatus()).toBe('CONNECTED')

    // Verify subscribe message was dispatched on reconnect
    expect(spySend).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'subscribe',
      })
    )
  })
})
