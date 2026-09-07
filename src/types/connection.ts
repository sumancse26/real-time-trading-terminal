export type ConnectionStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'DEGRADED'
  | 'ERROR'

export interface ConnectionMetrics {
  status: ConnectionStatus
  latencyMs: number
  reconnectAttempts: number
  maxReconnectAttempts: number
  reconnectCountdown: number | null
  messagesReceived: number
  messagesSent: number
  bytesReceived: number
  malformedMessagesCount: number
  isOnline: boolean
  lastHeartbeat: number
  connectedSince: number | null
}

