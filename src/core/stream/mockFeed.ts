import type { MarketTicker, TradeTick } from '@/types/market'
import type { OrderBookSnapshot, PriceLevel } from '@/types/orderbook'
import type { SimulationRatePreset } from '@/types/telemetry'
import { globalTracker } from '../performance/metrics'
import { RafBatchDispatcher } from './batchQueue'

/**
 * Phase 13 — Multi-Symbol Configuration
 * All watchlist symbols with their base prices for realistic tick distribution.
 */
const MULTI_SYMBOL_CONFIG: Array<{ symbol: string; baseAsset: string; quoteAsset: string; basePrice: number }> = [
  { symbol: 'BTC/USDT', baseAsset: 'BTC', quoteAsset: 'USDT', basePrice: 64250.0 },
  { symbol: 'ETH/USDT', baseAsset: 'ETH', quoteAsset: 'USDT', basePrice: 3445.0 },
  { symbol: 'SOL/USDT', baseAsset: 'SOL', quoteAsset: 'USDT', basePrice: 168.42 },
  { symbol: 'BNB/USDT', baseAsset: 'BNB', quoteAsset: 'USDT', basePrice: 608.3 },
  { symbol: 'ARB/USDT', baseAsset: 'ARB', quoteAsset: 'USDT', basePrice: 1.245 },
  { symbol: 'DOGE/USDT', baseAsset: 'DOGE', quoteAsset: 'USDT', basePrice: 0.1684 },
]

/**
 * Phase 13 — PriceLevel Object Pool
 * Pre-allocated PriceLevel arrays to avoid GC pressure from creating
 * 30 new PriceLevel objects per tick at 1,000 ticks/sec = 30,000 allocs/sec.
 */
const POOL_SIZE = 15
const askPool: PriceLevel[] = Array.from({ length: POOL_SIZE }, () => ({
  price: 0, size: 0, total: 0, percentDepth: 0,
}))
const bidPool: PriceLevel[] = Array.from({ length: POOL_SIZE }, () => ({
  price: 0, size: 0, total: 0, percentDepth: 0,
}))

export class TradingFeedSimulator {
  private currentPrices: Map<string, number> = new Map()
  private intervalId: number | null = null
  private tradeListeners = new Set<(trade: TradeTick) => void>()
  private orderBookListeners = new Set<(book: OrderBookSnapshot) => void>()
  private tickerListeners = new Set<(ticker: MarketTicker) => void>()
  private isRunning = false
  private sequence = 100000
  private currentRate: SimulationRatePreset = 20
  private lastOrderBookSnapshot: OrderBookSnapshot | null = null
  private lastTicker: MarketTicker | null = null
  /** Phase 13: Multi-symbol tick distribution enabled flag */
  private multiSymbolEnabled = false
  /** Phase 13: Round-robin index for distributing ticks across symbols */
  private symbolRotation = 0

  // Batched dispatchers for high-frequency mode
  public readonly tradeDispatcher = new RafBatchDispatcher<TradeTick>()
  public readonly orderBookDispatcher = new RafBatchDispatcher<OrderBookSnapshot>()
  public readonly tickerDispatcher = new RafBatchDispatcher<MarketTicker>()

  constructor(private symbol = 'BTC/USDT') {
    // Initialize prices for all symbols
    for (const cfg of MULTI_SYMBOL_CONFIG) {
      this.currentPrices.set(cfg.symbol, cfg.basePrice)
    }
    this.lastOrderBookSnapshot = this.generateOrderBookSnapshot(this.getCurrentPrice())
    this.lastTicker = this.generateTicker(this.symbol, this.getCurrentPrice())
  }

  public getCurrentOrderBookSnapshot(): OrderBookSnapshot | null {
    return this.lastOrderBookSnapshot
  }

  public getCurrentTicker(): MarketTicker | null {
    return this.lastTicker
  }

  public getCurrentPrice(): number {
    return this.currentPrices.get(this.symbol) ?? 64250.0
  }

  /** Phase 13: Enable/disable multi-symbol tick distribution */
  public setMultiSymbolEnabled(enabled: boolean): void {
    this.multiSymbolEnabled = enabled
  }

  public isMultiSymbolEnabled(): boolean {
    return this.multiSymbolEnabled
  }

  public start(frequencyPreset: SimulationRatePreset = 20) {
    if (this.isRunning) {
      this.stop()
    }
    this.isRunning = true
    this.currentRate = frequencyPreset
    globalTracker.setSimulationRate(frequencyPreset)

    const intervalMs = frequencyPreset >= 100 ? 10 : 50
    const ticksPerInterval =
      frequencyPreset === 1000
        ? 10
        : frequencyPreset === 500
          ? 5
          : frequencyPreset === 100
            ? 1
            : 1

    this.intervalId = window.setInterval(() => {
      for (let i = 0; i < ticksPerInterval; i++) {
        this.tick()
      }
    }, intervalMs)
  }

  public stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isRunning = false
  }

  public setFrequency(rate: SimulationRatePreset) {
    this.currentRate = rate
    globalTracker.setSimulationRate(rate)
    if (this.isRunning) {
      this.start(rate)
    }
  }

  public getFrequency(): SimulationRatePreset {
    return this.currentRate
  }

  public setBatchingEnabled(enabled: boolean) {
    this.tradeDispatcher.setBatchingEnabled(enabled)
    this.orderBookDispatcher.setBatchingEnabled(enabled)
    this.tickerDispatcher.setBatchingEnabled(enabled)
    globalTracker.setBatchingEnabled(enabled)
  }

  public isBatchingEnabled(): boolean {
    return this.tradeDispatcher.getBatchingEnabled()
  }

  public flushBatches() {
    this.tradeDispatcher.flushNow()
    this.orderBookDispatcher.flushNow()
    this.tickerDispatcher.flushNow()
  }

  public tick() {
    // Phase 13: Determine which symbol to tick
    const activeSymbol = this.multiSymbolEnabled
      ? MULTI_SYMBOL_CONFIG[this.symbolRotation % MULTI_SYMBOL_CONFIG.length]!
      : MULTI_SYMBOL_CONFIG[0]!
    this.symbolRotation++

    const currentPrice = this.currentPrices.get(activeSymbol.symbol) ?? activeSymbol.basePrice
    const volatility = activeSymbol.basePrice * 0.00007 // Proportional volatility
    const priceDelta = (Math.random() - 0.495) * volatility * 2
    const newPrice = Math.max(activeSymbol.basePrice * 0.5, Number((currentPrice + priceDelta).toFixed(activeSymbol.basePrice < 1 ? 6 : 2)))
    this.currentPrices.set(activeSymbol.symbol, newPrice)

    const side = Math.random() > 0.48 ? 'buy' : 'sell'
    const size = Number((Math.random() * 1.8 + 0.05).toFixed(4))

    this.sequence++
    globalTracker.recordMessageArrival(1)

    // Generate Trade
    const trade: TradeTick = {
      id: `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      symbol: activeSymbol.symbol,
      price: newPrice,
      size,
      side,
      timestamp: Date.now(),
    }

    // Direct listener dispatch
    for (const listener of this.tradeListeners) {
      listener(trade)
    }
    this.tradeDispatcher.push(trade)

    // Generate Order Book Snapshot (only for primary symbol to cap cost)
    if (activeSymbol.symbol === this.symbol) {
      const snapshot = this.generateOrderBookSnapshot(newPrice)
      this.lastOrderBookSnapshot = snapshot

      for (const listener of this.orderBookListeners) {
        listener(snapshot)
      }
      this.orderBookDispatcher.push(snapshot)
    }

    // Emit Ticker update for the active symbol
    const ticker = this.generateTicker(activeSymbol.symbol, newPrice)
    if (activeSymbol.symbol === this.symbol) {
      this.lastTicker = ticker
    }

    for (const listener of this.tickerListeners) {
      listener(ticker)
    }
    this.tickerDispatcher.push(ticker)
  }

  private generateOrderBookSnapshot(price: number): OrderBookSnapshot {
    // Phase 13: Reuse pooled PriceLevel objects to avoid GC pressure
    let askRunningTotal = 0
    let bidRunningTotal = 0

    for (let i = 0; i < POOL_SIZE; i++) {
      const askPrice = Number((price + (i + 1) * 0.5).toFixed(2))
      const askSize = Number((Math.random() * 2.5 + 0.2).toFixed(3))
      askRunningTotal += askSize
      const ask = askPool[i]!
      ask.price = askPrice
      ask.size = askSize
      ask.total = Number(askRunningTotal.toFixed(3))
      ask.percentDepth = Math.min(100, (askRunningTotal / 30) * 100)

      const bidPrice = Number((price - (i + 1) * 0.5).toFixed(2))
      const bidSize = Number((Math.random() * 2.5 + 0.2).toFixed(3))
      bidRunningTotal += bidSize
      const bid = bidPool[i]!
      bid.price = bidPrice
      bid.size = bidSize
      bid.total = Number(bidRunningTotal.toFixed(3))
      bid.percentDepth = Math.min(100, (bidRunningTotal / 30) * 100)
    }

    // Snapshot must own its arrays (consumers may hold references)
    const asks: PriceLevel[] = askPool.map(l => ({ ...l }))
    const bids: PriceLevel[] = bidPool.map(l => ({ ...l }))

    const firstAsk = asks[0]?.price ?? price + 0.5
    const firstBid = bids[0]?.price ?? price - 0.5
    const spread = Number((firstAsk - firstBid).toFixed(2))
    const spreadPercentage = Number(((spread / price) * 100).toFixed(4))

    return {
      symbol: this.symbol,
      sequence: this.sequence,
      timestamp: Date.now(),
      bids,
      asks,
      spread,
      spreadPercentage,
    }
  }

  private generateTicker(tickerSymbol: string, price: number): MarketTicker {
    const cfg = MULTI_SYMBOL_CONFIG.find(c => c.symbol === tickerSymbol) ?? MULTI_SYMBOL_CONFIG[0]!
    return {
      symbol: tickerSymbol,
      baseAsset: cfg.baseAsset,
      quoteAsset: cfg.quoteAsset,
      lastPrice: price,
      priceChange24h: 1845.2,
      priceChangePercent24h: 2.95,
      high24h: cfg.basePrice * 1.014,
      low24h: cfg.basePrice * 0.971,
      volume24h: 42890.45,
      turnover24h: 2758410290,
    }
  }

  public onTrade(cb: (trade: TradeTick) => void) {
    this.tradeListeners.add(cb)
    return () => {
      this.tradeListeners.delete(cb)
    }
  }

  public onOrderBook(cb: (book: OrderBookSnapshot) => void) {
    this.orderBookListeners.add(cb)
    return () => {
      this.orderBookListeners.delete(cb)
    }
  }

  public onTicker(cb: (ticker: MarketTicker) => void) {
    this.tickerListeners.add(cb)
    return () => {
      this.tickerListeners.delete(cb)
    }
  }
}

export const feedSimulator = new TradingFeedSimulator()
