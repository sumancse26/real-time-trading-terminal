import type { MarketTicker, TradeTick } from './market'
import type { OrderBookSnapshot, OrderBookDelta } from './orderbook'
import type { Candle, KlineInterval } from './chart'
import type { ActiveOrder, OrderFill, CreateOrderRequest, CancelOrderRequest } from './order'
import type { Position } from './position'
import type { AccountSummary } from './account'

// Incoming WebSocket Server Messages (Discriminated Union on 'type')
export interface WsTickerMessage {
  type: 'ticker'
  symbol: string
  data: MarketTicker
  timestamp: number
}

export interface WsTradeMessage {
  type: 'trade'
  symbol: string
  data: TradeTick
  timestamp: number
}

export interface WsBookSnapshotMessage {
  type: 'book_snapshot'
  symbol: string
  data: OrderBookSnapshot
  timestamp: number
}

export interface WsBookDeltaMessage {
  type: 'book_delta'
  symbol: string
  data: OrderBookDelta
  timestamp: number
}

export interface WsKlineMessage {
  type: 'kline'
  symbol: string
  interval: KlineInterval
  data: Candle
  timestamp: number
}

export interface WsExecutionReportMessage {
  type: 'execution_report'
  data: OrderFill
  timestamp: number
}

export interface WsOrderUpdateMessage {
  type: 'order_update'
  data: ActiveOrder
  timestamp: number
}

export interface WsPositionUpdateMessage {
  type: 'position_update'
  data: Position
  timestamp: number
}

export interface WsAccountUpdateMessage {
  type: 'account_update'
  data: AccountSummary
  timestamp: number
}

export interface WsSubscribedMessage {
  type: 'subscribed'
  channel: string
  symbol?: string
  timestamp: number
}

export interface WsUnsubscribedMessage {
  type: 'unsubscribed'
  channel: string
  symbol?: string
  timestamp: number
}

export interface WsPongMessage {
  type: 'pong'
  timestamp: number
}

export interface WsErrorMessage {
  type: 'error'
  code: number
  message: string
  timestamp: number
  details?: unknown
}

export type WsServerMessage =
  | WsTickerMessage
  | WsTradeMessage
  | WsBookSnapshotMessage
  | WsBookDeltaMessage
  | WsKlineMessage
  | WsExecutionReportMessage
  | WsOrderUpdateMessage
  | WsPositionUpdateMessage
  | WsAccountUpdateMessage
  | WsSubscribedMessage
  | WsUnsubscribedMessage
  | WsPongMessage
  | WsErrorMessage

// Outgoing WebSocket Client Messages (Discriminated Union on 'action')
export interface WsSubscribeAction {
  action: 'subscribe'
  channels: string[]
  symbols?: string[]
}

export interface WsUnsubscribeAction {
  action: 'unsubscribe'
  channels: string[]
  symbols?: string[]
}

export interface WsPingAction {
  action: 'ping'
  timestamp: number
}

export interface WsAuthAction {
  action: 'auth'
  token: string
}

export interface WsCreateOrderAction {
  action: 'create_order'
  payload: CreateOrderRequest
}

export interface WsCancelOrderAction {
  action: 'cancel_order'
  payload: CancelOrderRequest
}

export type WsClientMessage =
  | WsSubscribeAction
  | WsUnsubscribeAction
  | WsPingAction
  | WsAuthAction
  | WsCreateOrderAction
  | WsCancelOrderAction
