import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { RingBuffer, CoalescingBuffer, RafBatchDispatcher } from '@/core/stream/batchQueue'
import { TradingFeedSimulator } from '@/core/stream/mockFeed'
import { PerformanceTracker } from '@/core/performance/metrics'
import type { TradeTick } from '@/types/market'

describe('Phase 6 — High-Frequency Data & Buffering', () => {
  describe('RingBuffer', () => {
    it('initializes with specified capacity and empty length', () => {
      const ring = new RingBuffer<number>(5)
      expect(ring.capacity).toBe(5)
      expect(ring.length).toBe(0)
      expect(ring.toArray()).toEqual([])
      expect(ring.toReversedArray()).toEqual([])
    })

    it('pushes elements and retrieves in chronological and reverse order', () => {
      const ring = new RingBuffer<string>(3)
      ring.push('A')
      ring.push('B')
      ring.push('C')

      expect(ring.length).toBe(3)
      expect(ring.toArray()).toEqual(['A', 'B', 'C'])
      expect(ring.toReversedArray()).toEqual(['C', 'B', 'A'])
    })

    it('evicts oldest items when capacity is exceeded (circular wrap)', () => {
      const ring = new RingBuffer<number>(3)
      ring.push(1)
      ring.push(2)
      ring.push(3)
      ring.push(4) // 1 is evicted
      ring.push(5) // 2 is evicted

      expect(ring.length).toBe(3)
      expect(ring.toArray()).toEqual([3, 4, 5])
      expect(ring.toReversedArray()).toEqual([5, 4, 3])
    })

    it('supports pushBatch and clear', () => {
      const ring = new RingBuffer<number>(4)
      ring.pushBatch([10, 20, 30, 40, 50])
      expect(ring.length).toBe(4)
      expect(ring.toArray()).toEqual([20, 30, 40, 50])

      ring.clear()
      expect(ring.length).toBe(0)
      expect(ring.toArray()).toEqual([])
    })
  })

  describe('CoalescingBuffer', () => {
    it('coalesces multiple updates for the same key, keeping only the latest', () => {
      const coalescer = new CoalescingBuffer<string, { price: number; seq: number }>()

      coalescer.set('BTC', { price: 64000, seq: 1 })
      coalescer.set('ETH', { price: 3400, seq: 1 })
      coalescer.set('BTC', { price: 64100, seq: 2 })
      coalescer.set('BTC', { price: 64250, seq: 3 })

      expect(coalescer.size).toBe(2)
      const flushed = coalescer.flush()
      expect(flushed.get('BTC')).toEqual({ price: 64250, seq: 3 })
      expect(flushed.get('ETH')).toEqual({ price: 3400, seq: 1 })
      expect(coalescer.size).toBe(0)
    })
  })

  describe('RafBatchDispatcher', () => {
    it('batches items and dispatches on manual flushNow', () => {
      const dispatcher = new RafBatchDispatcher<number>()
      const receivedBatches: number[][] = []

      const unsub = dispatcher.subscribe(batch => {
        receivedBatches.push(batch)
      })

      dispatcher.push(1)
      dispatcher.push(2)
      dispatcher.push(3)

      expect(receivedBatches.length).toBe(0) // pending until flush

      dispatcher.flushNow()

      expect(receivedBatches.length).toBe(1)
      expect(receivedBatches[0]).toEqual([1, 2, 3])

      unsub()
      dispatcher.destroy()
    })

    it('dispatches immediately when batching is disabled (unbatched mode)', () => {
      const dispatcher = new RafBatchDispatcher<number>()
      dispatcher.setBatchingEnabled(false)

      const receivedBatches: number[][] = []
      dispatcher.subscribe(batch => {
        receivedBatches.push(batch)
      })

      dispatcher.push(100)
      dispatcher.push(200)

      expect(receivedBatches.length).toBe(2)
      expect(receivedBatches[0]).toEqual([100])
      expect(receivedBatches[1]).toEqual([200])

      dispatcher.destroy()
    })
  })

  describe('TradingFeedSimulator (High-Frequency 100/500/1000 msg/s)', () => {
    let sim: TradingFeedSimulator

    beforeEach(() => {
      vi.useFakeTimers()
      sim = new TradingFeedSimulator('BTC/USDT')
    })

    afterEach(() => {
      sim.stop()
      vi.useRealTimers()
    })

    it('emits high-frequency updates according to target preset', () => {
      const trades: TradeTick[] = []
      sim.onTrade(t => trades.push(t))

      // Start at 100 updates/second
      sim.start(100)
      expect(sim.getFrequency()).toBe(100)

      // Advance by 100ms (should generate ~10 updates)
      vi.advanceTimersByTime(100)
      expect(trades.length).toBeGreaterThanOrEqual(10)

      // Switch to 500 updates/second
      trades.length = 0
      sim.setFrequency(500)
      expect(sim.getFrequency()).toBe(500)

      // Advance by 100ms (should generate ~50 updates)
      vi.advanceTimersByTime(100)
      expect(trades.length).toBeGreaterThanOrEqual(50)

      // Switch to 1000 updates/second (1 kHz)
      trades.length = 0
      sim.setFrequency(1000)
      expect(sim.getFrequency()).toBe(1000)

      // Advance by 100ms (should generate ~100 updates)
      vi.advanceTimersByTime(100)
      expect(trades.length).toBeGreaterThanOrEqual(100)
    })

    it('supports toggling batching mode', () => {
      sim.setBatchingEnabled(false)
      expect(sim.isBatchingEnabled()).toBe(false)
      sim.setBatchingEnabled(true)
      expect(sim.isBatchingEnabled()).toBe(true)
    })
  })

  describe('Performance Tracker Benchmark & Metrics', () => {
    it('calculates benchmark results comparing unbatched vs batched metrics', () => {
      const tracker = new PerformanceTracker()

      const result1000 = tracker.runBenchmark(1000, 1000)
      expect(result1000.simulationRate).toBe(1000)
      expect(result1000.unbatched.totalMessages).toBe(1000)
      expect(result1000.unbatched.totalRenders).toBe(1000)
      expect(result1000.batched.totalRenders).toBe(60)
      expect(result1000.batched.compressionRatio).toBeCloseTo(16.7, 1)
      expect(result1000.improvementFactor.renderReduction).toBeGreaterThan(10)
      expect(result1000.batched.avgFps).toBe(60)
      expect(result1000.batched.droppedFrames).toBe(0)

      const result500 = tracker.runBenchmark(500, 1000)
      expect(result500.simulationRate).toBe(500)
      expect(result500.unbatched.totalMessages).toBe(500)
      expect(result500.batched.totalRenders).toBe(60)

      const result100 = tracker.runBenchmark(100, 1000)
      expect(result100.simulationRate).toBe(100)
      expect(result100.unbatched.totalMessages).toBe(100)

      tracker.destroy()
    })

    it('tracks batch flush and compression ratio in live metrics', () => {
      const tracker = new PerformanceTracker()
      tracker.setSimulationRate(1000)
      tracker.setBatchingEnabled(true)

      tracker.recordMessageArrival(100)
      tracker.recordBatchFlush(100, 1.2)

      const metrics = tracker.getMetrics()
      expect(metrics.simulationRate).toBe(1000)
      expect(metrics.isBatchingEnabled).toBe(true)
      expect(metrics.fps).toBeGreaterThanOrEqual(0)
      expect(metrics.batchCompressionRatio).toBeGreaterThanOrEqual(1)

      tracker.destroy()
    })
  })
})
