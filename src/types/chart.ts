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

export type ChartTimeframe = '1D' | '1W' | '1M' | '3M' | '1Y'

export type ChartType = 'candlestick' | 'hollow_candle' | 'bar' | 'line' | 'area' | 'heikin_ashi'

export interface Candle {
  time: number // unix timestamp in ms
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

export interface TimeframeConfig {
  timeframe: ChartTimeframe
  label: string
  interval: KlineInterval
  candleCount: number
  intervalMs: number
}

export const TIMEFRAME_CONFIGS: Record<ChartTimeframe, TimeframeConfig> = {
  '1D': {
    timeframe: '1D',
    label: '1 Day',
    interval: '15m',
    candleCount: 40,
    intervalMs: 15 * 60 * 1000,
  },
  '1W': {
    timeframe: '1W',
    label: '1 Week',
    interval: '1h',
    candleCount: 40,
    intervalMs: 60 * 60 * 1000,
  },
  '1M': {
    timeframe: '1M',
    label: '1 Month',
    interval: '4h',
    candleCount: 40,
    intervalMs: 4 * 60 * 60 * 1000,
  },
  '3M': {
    timeframe: '3M',
    label: '3 Months',
    interval: '1d',
    candleCount: 40,
    intervalMs: 24 * 60 * 60 * 1000,
  },
  '1Y': {
    timeframe: '1Y',
    label: '1 Year',
    interval: '1w',
    candleCount: 40,
    intervalMs: 7 * 24 * 60 * 60 * 1000,
  },
}
