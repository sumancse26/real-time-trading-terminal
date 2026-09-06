import { useState, useEffect, useRef } from 'react'
import type { TradeTick, MarketTicker } from '@/types/market'
import type { OrderBookSnapshot } from '@/types/orderbook'
import { feedSimulator } from './mockFeed'
import { RingBuffer } from './batchQueue'
import { globalTracker } from '../performance/metrics'

/**
 * High-performance hook for streaming trades.
 * Uses a fixed-capacity RingBuffer and RAF-aligned batch dispatcher to avoid GC pressure and 1000/s React re-renders.
 */
export function useBatchedTrades(capacity = 25): TradeTick[] {
  const [trades, setTrades] = useState<TradeTick[]>([])
  const ringBufferRef = useRef<RingBuffer<TradeTick>>(new RingBuffer<TradeTick>(capacity))

  useEffect(() => {
    const ring = ringBufferRef.current
    const unsub = feedSimulator.tradeDispatcher.subscribe((newTrades: TradeTick[]) => {
      const renderStart = performance.now()
      ring.pushBatch(newTrades)
      setTrades(ring.toReversedArray())
      globalTracker.recordRenderCommit(performance.now() - renderStart)
    })

    return unsub
  }, [])

  return trades
}

/**
 * High-performance hook for OrderBook depth stream.
 * Coalesces intermediate updates within an animation frame, dispatching only the latest L2 snapshot.
 */
export function useBatchedOrderBook(): OrderBookSnapshot | null {
  const [snapshot, setSnapshot] = useState<OrderBookSnapshot | null>(() =>
    feedSimulator.getCurrentOrderBookSnapshot()
  )

  useEffect(() => {
    const unsub = feedSimulator.orderBookDispatcher.subscribe((snapshots: OrderBookSnapshot[]) => {
      if (snapshots.length === 0) return
      const renderStart = performance.now()
      // Coalesce: pick only the newest snapshot from this batch
      const latest = snapshots[snapshots.length - 1]
      if (latest) {
        setSnapshot(latest)
      }
      globalTracker.recordRenderCommit(performance.now() - renderStart)
    })

    return unsub
  }, [])

  return snapshot
}

/**
 * High-performance hook for Ticker updates.
 */
export function useBatchedTicker(): MarketTicker | null {
  const [ticker, setTicker] = useState<MarketTicker | null>(() =>
    feedSimulator.getCurrentTicker()
  )

  useEffect(() => {
    const unsub = feedSimulator.tickerDispatcher.subscribe((tickers: MarketTicker[]) => {
      if (tickers.length === 0) return
      const renderStart = performance.now()
      const latest = tickers[tickers.length - 1]
      if (latest) {
        setTicker(latest)
      }
      globalTracker.recordRenderCommit(performance.now() - renderStart)
    })

    return unsub
  }, [])

  return ticker
}
