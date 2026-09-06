export interface PriceLevel {
  price: number
  size: number
  total: number
  percentDepth: number
  ordersCount?: number
}

export interface OrderBookSnapshot {
  symbol: string
  sequence: number
  timestamp: number
  bids: PriceLevel[]
  asks: PriceLevel[]
  spread: number
  spreadPercentage: number
  checksum?: number
}

export type BookDeltaEntry = [price: number, size: number]

export interface OrderBookDelta {
  symbol: string
  sequence: number
  prevSequence: number
  timestamp: number
  bids: BookDeltaEntry[]
  asks: BookDeltaEntry[]
  isSnapshot?: boolean
}
