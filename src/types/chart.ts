export type KlineInterval =
  | '1s'
  | '1m'
  | '3m'
  | '5m'
  | '15m'
  | '30m'
  | '1h'
  | '2h'
  | '4h'
  | '6h'
  | '8h'
  | '12h'
  | '1d'
  | '3d'
  | '1w'
  | '1M'

export type ChartType = 'candlestick' | 'hollow_candle' | 'bar' | 'line' | 'area' | 'heikin_ashi'

export interface Candle {
  time: number // unix timestamp in ms or seconds
  open: number
  high: number
  low: number
  close: number
  volume: number
  quoteVolume?: number
  tradesCount?: number
  isClosed?: boolean
}

export interface IndicatorConfig {
  id: string
  name: 'EMA' | 'SMA' | 'RSI' | 'MACD' | 'BOLLINGER' | 'VWAP'
  visible: boolean
  period?: number
  color?: string
  params?: Record<string, number | string | boolean>
}

export interface ChartViewport {
  fromTime: number
  toTime: number
  minPrice: number
  maxPrice: number
}
