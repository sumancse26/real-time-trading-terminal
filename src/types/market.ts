export type Side = 'buy' | 'sell'

export interface MarketTicker {
  symbol: string
  baseAsset: string
  quoteAsset: string
  lastPrice: number
  priceChange24h: number
  priceChangePercent24h: number
  high24h: number
  low24h: number
  volume24h: number
  turnover24h: number
  vwap24h?: number
  openPrice24h?: number
  tradesCount24h?: number
  timestamp?: number
}

export interface TradeTick {
  id: string
  symbol: string
  price: number
  size: number
  side: Side
  timestamp: number
  tradeId?: string
  isBuyerMaker?: boolean
}

export interface BestBidOffer {
  symbol: string
  bidPrice: number
  bidSize: number
  askPrice: number
  askSize: number
  timestamp: number
}

export interface MarketSummary {
  symbol: string
  ticker: MarketTicker
  bbo: BestBidOffer
  timestamp: number
}
