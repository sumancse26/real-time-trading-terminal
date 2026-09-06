import type { Side } from './market'

export type { Side } from './market'
export type { Position, PositionSide, MarginMode } from './position'

export type OrderType = 'LIMIT' | 'MARKET' | 'STOP_LIMIT' | 'STOP_MARKET' | 'TRAILING_STOP'
export type TimeInForce = 'GTC' | 'IOC' | 'FOK' | 'POST_ONLY'
export type OrderStatus = 'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED' | 'REJECTED' | 'EXPIRED'

export interface ActiveOrder {
  id: string
  symbol: string
  side: Side
  type: OrderType
  price: number
  quantity: number
  filledQuantity: number
  status: OrderStatus
  timestamp: number
  clientOrderId?: string
  stopPrice?: number
  timeInForce?: TimeInForce
  avgPrice?: number
  fee?: number
  feeAsset?: string
}

export interface OrderFill {
  id: string
  orderId: string
  symbol: string
  side: Side
  price: number
  quantity: number
  fee: number
  feeAsset: string
  timestamp: number
}

export interface CreateOrderRequest {
  symbol: string
  side: Side
  type: OrderType
  quantity: number
  price?: number
  stopPrice?: number
  timeInForce?: TimeInForce
  clientOrderId?: string
  postOnly?: boolean
  reduceOnly?: boolean
}

export interface CancelOrderRequest {
  orderId: string
  symbol: string
  clientOrderId?: string
}
