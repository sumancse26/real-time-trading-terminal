export type PositionSide = 'LONG' | 'SHORT' | 'BOTH'
export type MarginMode = 'ISOLATED' | 'CROSS'

export interface Position {
  id: string
  symbol: string
  side: 'LONG' | 'SHORT'
  size: number
  entryPrice: number
  avgPrice?: number
  markPrice: number
  marketValue?: number
  liquidationPrice: number
  unrealizedPnl: number
  unrealizedPnlPercent: number
  margin: number
  leverage: number
  realizedPnl?: number
  marginMode?: MarginMode
  maintenanceMargin?: number
  stopLossPrice?: number
  takeProfitPrice?: number
  updatedAt?: number
}

export interface PositionRiskSummary {
  totalMargin: number
  totalUnrealizedPnl: number
  marginLevel: number
  marginCallWarning: boolean
}
