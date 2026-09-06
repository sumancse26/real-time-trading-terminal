import type { Side, MarketTicker, TradeTick, BestBidOffer } from './market'
import type { PriceLevel, OrderBookSnapshot, OrderBookDelta, BookDeltaEntry } from './orderbook'
import type { Candle, KlineInterval } from './chart'
import type { OrderType, TimeInForce, OrderStatus, ActiveOrder, OrderFill } from './order'
import type { Position, PositionSide, MarginMode } from './position'
import type { AssetBalance, AccountSummary } from './account'
import type { SymbolInfo, InstrumentStatus, InstrumentType } from './symbol'
import type {
  WsServerMessage,
  WsTickerMessage,
  WsTradeMessage,
  WsBookSnapshotMessage,
  WsBookDeltaMessage,
  WsKlineMessage,
  WsExecutionReportMessage,
  WsOrderUpdateMessage,
  WsPositionUpdateMessage,
  WsAccountUpdateMessage,
  WsSubscribedMessage,
  WsUnsubscribedMessage,
  WsPongMessage,
  WsErrorMessage,
  WsClientMessage,
} from './websocket'

// Primitives and low-level guards
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function isPositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0
}

export function isNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0
}

export function isSide(value: unknown): value is Side {
  return value === 'buy' || value === 'sell'
}

export function isOrderType(value: unknown): value is OrderType {
  return (
    value === 'LIMIT' ||
    value === 'MARKET' ||
    value === 'STOP_LIMIT' ||
    value === 'STOP_MARKET' ||
    value === 'TRAILING_STOP'
  )
}

export function isTimeInForce(value: unknown): value is TimeInForce {
  return value === 'GTC' || value === 'IOC' || value === 'FOK' || value === 'POST_ONLY'
}

export function isOrderStatus(value: unknown): value is OrderStatus {
  return (
    value === 'NEW' ||
    value === 'PARTIALLY_FILLED' ||
    value === 'FILLED' ||
    value === 'CANCELLED' ||
    value === 'REJECTED' ||
    value === 'EXPIRED'
  )
}

export function isKlineInterval(value: unknown): value is KlineInterval {
  const intervals: KlineInterval[] = [
    '1s',
    '1m',
    '3m',
    '5m',
    '15m',
    '30m',
    '1h',
    '2h',
    '4h',
    '6h',
    '8h',
    '12h',
    '1d',
    '3d',
    '1w',
    '1M',
  ]
  return typeof value === 'string' && intervals.includes(value as KlineInterval)
}

export function isPositionSide(value: unknown): value is PositionSide {
  return value === 'LONG' || value === 'SHORT' || value === 'BOTH'
}

export function isMarginMode(value: unknown): value is MarginMode {
  return value === 'ISOLATED' || value === 'CROSS'
}

export function isInstrumentType(value: unknown): value is InstrumentType {
  return value === 'SPOT' || value === 'PERPETUAL' || value === 'FUTURES' || value === 'OPTION'
}

export function isInstrumentStatus(value: unknown): value is InstrumentStatus {
  return (
    value === 'TRADING' ||
    value === 'HALTED' ||
    value === 'BREAK' ||
    value === 'SETTLING' ||
    value === 'CLOSED'
  )
}

// Domain Model Type Guards

export function isMarketTicker(value: unknown): value is MarketTicker {
  if (!isObject(value)) return false
  return (
    isNonEmptyString(value.symbol) &&
    isNonEmptyString(value.baseAsset) &&
    isNonEmptyString(value.quoteAsset) &&
    isFiniteNumber(value.lastPrice) &&
    isFiniteNumber(value.priceChange24h) &&
    isFiniteNumber(value.priceChangePercent24h) &&
    isFiniteNumber(value.high24h) &&
    isFiniteNumber(value.low24h) &&
    isFiniteNumber(value.volume24h) &&
    isFiniteNumber(value.turnover24h)
  )
}

export function isTradeTick(value: unknown): value is TradeTick {
  if (!isObject(value)) return false
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.symbol) &&
    isFiniteNumber(value.price) &&
    isPositiveNumber(value.size) &&
    isSide(value.side) &&
    isFiniteNumber(value.timestamp)
  )
}

export function isBestBidOffer(value: unknown): value is BestBidOffer {
  if (!isObject(value)) return false
  return (
    isNonEmptyString(value.symbol) &&
    isFiniteNumber(value.bidPrice) &&
    isNonNegativeNumber(value.bidSize) &&
    isFiniteNumber(value.askPrice) &&
    isNonNegativeNumber(value.askSize) &&
    isFiniteNumber(value.timestamp)
  )
}

export function isPriceLevel(value: unknown): value is PriceLevel {
  if (!isObject(value)) return false
  return (
    isFiniteNumber(value.price) &&
    isNonNegativeNumber(value.size) &&
    isNonNegativeNumber(value.total) &&
    isNonNegativeNumber(value.percentDepth)
  )
}

export function isBookDeltaEntry(value: unknown): value is BookDeltaEntry {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    isFiniteNumber(value[0]) &&
    isNonNegativeNumber(value[1])
  )
}

export function isOrderBookSnapshot(value: unknown): value is OrderBookSnapshot {
  if (!isObject(value)) return false
  return (
    isNonEmptyString(value.symbol) &&
    isFiniteNumber(value.sequence) &&
    isFiniteNumber(value.timestamp) &&
    Array.isArray(value.bids) &&
    value.bids.every(isPriceLevel) &&
    Array.isArray(value.asks) &&
    value.asks.every(isPriceLevel) &&
    isFiniteNumber(value.spread) &&
    isFiniteNumber(value.spreadPercentage)
  )
}

export function isOrderBookDelta(value: unknown): value is OrderBookDelta {
  if (!isObject(value)) return false
  return (
    isNonEmptyString(value.symbol) &&
    isFiniteNumber(value.sequence) &&
    isFiniteNumber(value.prevSequence) &&
    isFiniteNumber(value.timestamp) &&
    Array.isArray(value.bids) &&
    value.bids.every(isBookDeltaEntry) &&
    Array.isArray(value.asks) &&
    value.asks.every(isBookDeltaEntry)
  )
}

export function isCandle(value: unknown): value is Candle {
  if (!isObject(value)) return false
  return (
    isFiniteNumber(value.time) &&
    isFiniteNumber(value.open) &&
    isFiniteNumber(value.high) &&
    isFiniteNumber(value.low) &&
    isFiniteNumber(value.close) &&
    isFiniteNumber(value.volume)
  )
}

export function isActiveOrder(value: unknown): value is ActiveOrder {
  if (!isObject(value)) return false
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.symbol) &&
    isSide(value.side) &&
    isOrderType(value.type) &&
    isFiniteNumber(value.price) &&
    isPositiveNumber(value.quantity) &&
    isNonNegativeNumber(value.filledQuantity) &&
    isOrderStatus(value.status) &&
    isFiniteNumber(value.timestamp)
  )
}

export function isOrderFill(value: unknown): value is OrderFill {
  if (!isObject(value)) return false
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.orderId) &&
    isNonEmptyString(value.symbol) &&
    isSide(value.side) &&
    isFiniteNumber(value.price) &&
    isPositiveNumber(value.quantity) &&
    isFiniteNumber(value.fee) &&
    isNonEmptyString(value.feeAsset) &&
    isFiniteNumber(value.timestamp)
  )
}

export function isPosition(value: unknown): value is Position {
  if (!isObject(value)) return false
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.symbol) &&
    (value.side === 'LONG' || value.side === 'SHORT') &&
    isFiniteNumber(value.size) &&
    isFiniteNumber(value.entryPrice) &&
    isFiniteNumber(value.markPrice) &&
    isFiniteNumber(value.liquidationPrice) &&
    isFiniteNumber(value.unrealizedPnl) &&
    isFiniteNumber(value.unrealizedPnlPercent) &&
    isFiniteNumber(value.margin) &&
    isPositiveNumber(value.leverage)
  )
}

export function isAssetBalance(value: unknown): value is AssetBalance {
  if (!isObject(value)) return false
  return (
    isNonEmptyString(value.asset) &&
    isFiniteNumber(value.free) &&
    isFiniteNumber(value.locked) &&
    isFiniteNumber(value.total)
  )
}

export function isAccountSummary(value: unknown): value is AccountSummary {
  if (!isObject(value)) return false
  return (
    isNonEmptyString(value.accountId) &&
    (value.accountType === 'SPOT' ||
      value.accountType === 'MARGIN' ||
      value.accountType === 'FUTURES') &&
    isFiniteNumber(value.totalEquity) &&
    isFiniteNumber(value.availableMargin) &&
    isFiniteNumber(value.initialMargin) &&
    isFiniteNumber(value.maintenanceMargin) &&
    isFiniteNumber(value.unrealizedPnl) &&
    isFiniteNumber(value.marginRatio) &&
    Array.isArray(value.balances) &&
    value.balances.every(isAssetBalance) &&
    typeof value.canTrade === 'boolean' &&
    typeof value.canWithdraw === 'boolean' &&
    isFiniteNumber(value.updateTime)
  )
}

export function isSymbolInfo(value: unknown): value is SymbolInfo {
  if (!isObject(value)) return false
  const pFilter = value.priceFilter
  const lFilter = value.lotSizeFilter
  const nFilter = value.notionalFilter

  return (
    isNonEmptyString(value.symbol) &&
    isNonEmptyString(value.baseAsset) &&
    isNonEmptyString(value.quoteAsset) &&
    isInstrumentStatus(value.status) &&
    isInstrumentType(value.type) &&
    isObject(pFilter) &&
    isFiniteNumber(pFilter.minPrice) &&
    isFiniteNumber(pFilter.maxPrice) &&
    isPositiveNumber(pFilter.tickSize) &&
    isObject(lFilter) &&
    isFiniteNumber(lFilter.minQty) &&
    isFiniteNumber(lFilter.maxQty) &&
    isPositiveNumber(lFilter.stepSize) &&
    isObject(nFilter) &&
    isFiniteNumber(nFilter.minNotional) &&
    isFiniteNumber(value.baseAssetPrecision) &&
    isFiniteNumber(value.quoteAssetPrecision)
  )
}

// WebSocket Message Type Guards

export function isWsTickerMessage(value: unknown): value is WsTickerMessage {
  if (!isObject(value) || value.type !== 'ticker') return false
  return isNonEmptyString(value.symbol) && isMarketTicker(value.data) && isFiniteNumber(value.timestamp)
}

export function isWsTradeMessage(value: unknown): value is WsTradeMessage {
  if (!isObject(value) || value.type !== 'trade') return false
  return isNonEmptyString(value.symbol) && isTradeTick(value.data) && isFiniteNumber(value.timestamp)
}

export function isWsBookSnapshotMessage(value: unknown): value is WsBookSnapshotMessage {
  if (!isObject(value) || value.type !== 'book_snapshot') return false
  return isNonEmptyString(value.symbol) && isOrderBookSnapshot(value.data) && isFiniteNumber(value.timestamp)
}

export function isWsBookDeltaMessage(value: unknown): value is WsBookDeltaMessage {
  if (!isObject(value) || value.type !== 'book_delta') return false
  return isNonEmptyString(value.symbol) && isOrderBookDelta(value.data) && isFiniteNumber(value.timestamp)
}

export function isWsKlineMessage(value: unknown): value is WsKlineMessage {
  if (!isObject(value) || value.type !== 'kline') return false
  return (
    isNonEmptyString(value.symbol) &&
    isKlineInterval(value.interval) &&
    isCandle(value.data) &&
    isFiniteNumber(value.timestamp)
  )
}

export function isWsExecutionReportMessage(value: unknown): value is WsExecutionReportMessage {
  if (!isObject(value) || value.type !== 'execution_report') return false
  return isOrderFill(value.data) && isFiniteNumber(value.timestamp)
}

export function isWsOrderUpdateMessage(value: unknown): value is WsOrderUpdateMessage {
  if (!isObject(value) || value.type !== 'order_update') return false
  return isActiveOrder(value.data) && isFiniteNumber(value.timestamp)
}

export function isWsPositionUpdateMessage(value: unknown): value is WsPositionUpdateMessage {
  if (!isObject(value) || value.type !== 'position_update') return false
  return isPosition(value.data) && isFiniteNumber(value.timestamp)
}

export function isWsAccountUpdateMessage(value: unknown): value is WsAccountUpdateMessage {
  if (!isObject(value) || value.type !== 'account_update') return false
  return isAccountSummary(value.data) && isFiniteNumber(value.timestamp)
}

export function isWsSubscribedMessage(value: unknown): value is WsSubscribedMessage {
  if (!isObject(value) || value.type !== 'subscribed') return false
  return isNonEmptyString(value.channel) && isFiniteNumber(value.timestamp)
}

export function isWsUnsubscribedMessage(value: unknown): value is WsUnsubscribedMessage {
  if (!isObject(value) || value.type !== 'unsubscribed') return false
  return isNonEmptyString(value.channel) && isFiniteNumber(value.timestamp)
}

export function isWsPongMessage(value: unknown): value is WsPongMessage {
  if (!isObject(value) || value.type !== 'pong') return false
  return isFiniteNumber(value.timestamp)
}

export function isWsErrorMessage(value: unknown): value is WsErrorMessage {
  if (!isObject(value) || value.type !== 'error') return false
  return (
    isFiniteNumber(value.code) &&
    typeof value.message === 'string' &&
    isFiniteNumber(value.timestamp)
  )
}

export function isWsServerMessage(value: unknown): value is WsServerMessage {
  return (
    isWsTickerMessage(value) ||
    isWsTradeMessage(value) ||
    isWsBookSnapshotMessage(value) ||
    isWsBookDeltaMessage(value) ||
    isWsKlineMessage(value) ||
    isWsExecutionReportMessage(value) ||
    isWsOrderUpdateMessage(value) ||
    isWsPositionUpdateMessage(value) ||
    isWsAccountUpdateMessage(value) ||
    isWsSubscribedMessage(value) ||
    isWsUnsubscribedMessage(value) ||
    isWsPongMessage(value) ||
    isWsErrorMessage(value)
  )
}

export function isWsClientMessage(value: unknown): value is WsClientMessage {
  if (!isObject(value) || typeof value.action !== 'string') return false
  switch (value.action) {
    case 'subscribe':
    case 'unsubscribe':
      return Array.isArray(value.channels) && value.channels.every(isNonEmptyString)
    case 'ping':
      return isFiniteNumber(value.timestamp)
    case 'auth':
      return isNonEmptyString(value.token)
    case 'create_order':
      return isObject(value.payload) && isNonEmptyString(value.payload.symbol)
    case 'cancel_order':
      return (
        isObject(value.payload) &&
        isNonEmptyString(value.payload.orderId) &&
        isNonEmptyString(value.payload.symbol)
      )
    default:
      return false
  }
}
