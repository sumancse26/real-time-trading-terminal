import { create } from 'zustand'
import type { ConnectionStatus, ConnectionMetrics } from '@/types/connection'

export interface ConnectionState extends ConnectionMetrics {
  activeSubscriptions: string[]
  lastError: string | null
  setStatus: (status: ConnectionStatus) => void
  setLatency: (latencyMs: number) => void
  setReconnectCountdown: (seconds: number | null) => void
  setMaxReconnectAttempts: (max: number) => void
  incrementMalformedMessages: () => void
  setNetworkOnline: (isOnline: boolean) => void
  setLastError: (error: string | null) => void
  recordMessageReceived: (byteLength?: number) => void
  recordMessageSent: () => void
  recordReconnectAttempt: () => void
  resetReconnectAttempts: () => void
  setLastHeartbeat: (timestamp: number) => void
  setSubscriptions: (subs: string[]) => void
  addSubscription: (sub: string) => void
  removeSubscription: (sub: string) => void
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  status: 'DISCONNECTED',
  latencyMs: 12,
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  reconnectCountdown: null,
  messagesReceived: 0,
  messagesSent: 0,
  bytesReceived: 0,
  malformedMessagesCount: 0,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  lastHeartbeat: Date.now(),
  connectedSince: null,
  activeSubscriptions: [],
  lastError: null,

  setStatus: (status: ConnectionStatus) => {
    const current = get().status
    if (current === status) return

    set({
      status,
      connectedSince: status === 'CONNECTED' ? Date.now() : status === 'DISCONNECTED' ? null : get().connectedSince,
      reconnectCountdown: status === 'CONNECTED' || status === 'DISCONNECTED' ? null : get().reconnectCountdown,
    })
  },

  setLatency: (latencyMs: number) => {
    set({ latencyMs })
  },

  setReconnectCountdown: (reconnectCountdown: number | null) => {
    set({ reconnectCountdown })
  },

  setMaxReconnectAttempts: (maxReconnectAttempts: number) => {
    set({ maxReconnectAttempts })
  },

  incrementMalformedMessages: () => {
    set(state => ({
      malformedMessagesCount: state.malformedMessagesCount + 1,
    }))
  },

  setNetworkOnline: (isOnline: boolean) => {
    set({ isOnline })
  },

  setLastError: (lastError: string | null) => {
    set({ lastError })
  },

  recordMessageReceived: (byteLength = 128) => {
    set(state => ({
      messagesReceived: state.messagesReceived + 1,
      bytesReceived: state.bytesReceived + byteLength,
    }))
  },

  recordMessageSent: () => {
    set(state => ({
      messagesSent: state.messagesSent + 1,
    }))
  },

  recordReconnectAttempt: () => {
    set(state => ({
      reconnectAttempts: state.reconnectAttempts + 1,
    }))
  },

  resetReconnectAttempts: () => {
    set({ reconnectAttempts: 0, reconnectCountdown: null })
  },

  setLastHeartbeat: (timestamp: number) => {
    set({ lastHeartbeat: timestamp })
  },

  setSubscriptions: (activeSubscriptions: string[]) => {
    set({ activeSubscriptions })
  },

  addSubscription: (sub: string) => {
    set(state => ({
      activeSubscriptions: state.activeSubscriptions.includes(sub)
        ? state.activeSubscriptions
        : [...state.activeSubscriptions, sub],
    }))
  },

  removeSubscription: (sub: string) => {
    set(state => ({
      activeSubscriptions: state.activeSubscriptions.filter(s => s !== sub),
    }))
  },
}))

export const useConnectionStatus = (): ConnectionStatus =>
  useConnectionStore(state => state.status)

export const useConnectionLatency = (): number =>
  useConnectionStore(state => state.latencyMs)

export const useReconnectCountdown = (): number | null =>
  useConnectionStore(state => state.reconnectCountdown)

export const useMalformedMessagesCount = (): number =>
  useConnectionStore(state => state.malformedMessagesCount)

