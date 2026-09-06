import type { MarketTicker, TradeTick } from '@/types/market'
import type { OrderBookSnapshot, PriceLevel } from '@/types/orderbook'
import type { SimulationRatePreset } from '@/types/telemetry'
import { globalTracker } from '../performance/metrics'
import { RafBatchDispatcher } from './batchQueue'

export class TradingFeedSimulator {
  private currentPrice = 64250.0
  private intervalId: number | null = null
  private tradeListeners = new Set<(trade: TradeTick) => void>()
  private orderBookListeners = new Set<(book: OrderBookSnapshot) => void>()
  private tickerListeners = new Set<(ticker: MarketTicker) => void>()
  private isRunning = false
  private sequence = 100000
  private currentRate: SimulationRatePreset = 20
  private lastOrderBookSnapshot: OrderBookSnapshot | null = null
  private lastTicker: MarketTicker | null = null

  // Batched dispatchers for high-frequency mode
  public readonly tradeDispatcher = new RafBatchDispatcher<TradeTick>()
  public readonly orderBookDispatcher = new RafBatchDispatcher<OrderBookSnapshot>()
  public readonly tickerDispatcher = new RafBatchDispatcher<MarketTicker>()

  constructor(private symbol = 'BTC/USDT') {
    this.lastOrderBookSnapshot = this.generateOrderBookSnapshot()
    this.lastTicker = this.generateTicker()
  }

  public getCurrentOrderBookSnapshot(): OrderBookSnapshot | null {
    return this.lastOrderBookSnapshot
  }

  public getCurrentTicker(): MarketTicker | null {
    return this.lastTicker
  }

  public getCurrentPrice(): number {
    return this.currentPrice
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
    const priceDelta = (Math.random() - 0.495) * 4.5
    this.currentPrice = Math.max(1000, Number((this.currentPrice + priceDelta).toFixed(2)))
    const side = Math.random() > 0.48 ? 'buy' : 'sell'
    const size = Number((Math.random() * 1.8 + 0.05).toFixed(4))

    this.sequence++
    globalTracker.recordMessageArrival(1)

    // Generate Trade
    const trade: TradeTick = {
      id: `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      symbol: this.symbol,
      price: this.currentPrice,
      size,
      side,
      timestamp: Date.now(),
    }

    // Direct listener dispatch
    for (const listener of this.tradeListeners) {
      listener(trade)
    }
    this.tradeDispatcher.push(trade)

    // Generate Order Book Snapshot
    const snapshot = this.generateOrderBookSnapshot()
    this.lastOrderBookSnapshot = snapshot

    for (const listener of this.orderBookListeners) {
      listener(snapshot)
    }
    this.orderBookDispatcher.push(snapshot)

    // Emit Ticker update
    const ticker = this.generateTicker()
    this.lastTicker = ticker

    for (const listener of this.tickerListeners) {
      listener(ticker)
    }
    this.tickerDispatcher.push(ticker)
  }

  private generateOrderBookSnapshot(): OrderBookSnapshot {
    const asks: PriceLevel[] = []
    const bids: PriceLevel[] = []

    let askRunningTotal = 0
    let bidRunningTotal = 0

    for (let i = 1; i <= 15; i++) {
      const askPrice = Number((this.currentPrice + i * 0.5).toFixed(2))
      const askSize = Number((Math.random() * 2.5 + 0.2).toFixed(3))
      askRunningTotal += askSize
      asks.push({
        price: askPrice,
        size: askSize,
        total: Number(askRunningTotal.toFixed(3)),
        percentDepth: Math.min(100, (askRunningTotal / 30) * 100),
      })

      const bidPrice = Number((this.currentPrice - i * 0.5).toFixed(2))
      const bidSize = Number((Math.random() * 2.5 + 0.2).toFixed(3))
      bidRunningTotal += bidSize
      bids.push({
        price: bidPrice,
        size: bidSize,
        total: Number(bidRunningTotal.toFixed(3)),
        percentDepth: Math.min(100, (bidRunningTotal / 30) * 100),
      })
    }

    const firstAsk = asks[0]?.price ?? this.currentPrice + 0.5
    const firstBid = bids[0]?.price ?? this.currentPrice - 0.5
    const spread = Number((firstAsk - firstBid).toFixed(2))
    const spreadPercentage = Number(((spread / this.currentPrice) * 100).toFixed(4))

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

  private generateTicker(): MarketTicker {
    return {
      symbol: this.symbol,
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      lastPrice: this.currentPrice,
      priceChange24h: 1845.2,
      priceChangePercent24h: 2.95,
      high24h: 65120.0,
      low24h: 62410.0,
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
