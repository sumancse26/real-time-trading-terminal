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
  messagesReceived: number
  messagesSent: number
  bytesReceived: number
  lastHeartbeat: number
  connectedSince: number | null
}
