export type InstrumentType = 'SPOT' | 'PERPETUAL' | 'FUTURES' | 'OPTION'
export type InstrumentStatus = 'TRADING' | 'HALTED' | 'BREAK' | 'SETTLING' | 'CLOSED'

export interface PriceFilter {
  minPrice: number
  maxPrice: number
  tickSize: number
}

export interface LotSizeFilter {
  minQty: number
  maxQty: number
  stepSize: number
}

export interface NotionalFilter {
  minNotional: number
  maxNotional?: number
}

export interface SymbolInfo {
  symbol: string
  baseAsset: string
  quoteAsset: string
  status: InstrumentStatus
  type: InstrumentType
  priceFilter: PriceFilter
  lotSizeFilter: LotSizeFilter
  notionalFilter: NotionalFilter
  baseAssetPrecision: number
  quoteAssetPrecision: number
  contractMultiplier?: number
  maxLeverage?: number
  isMarginTradingAllowed?: boolean
}
