import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { StressTestRunner, compareResults, type StressTestResult } from '@/core/performance/stressTest'
import { useMarketStore } from '@/core/store/useMarketStore'
import { TradingFeedSimulator } from '@/core/stream/mockFeed'
import { RafBatchDispatcher } from '@/core/stream/batchQueue'

describe('Phase 13 — Performance Engineering & Stress Testing', () => {
  describe('Zustand Price Deadband Optimization', () => {
    beforeEach(() => {
      useMarketStore.setState({
        entities: {
          'BTC/USDT': {
            symbol: 'BTC/USDT',
            baseAsset: 'BTC',
            quoteAsset: 'USDT',
            lastPrice: 64000.0,
            priceChange24h: 1200,
            priceChangePercent24h: 2.1,
            high24h: 65000,
            low24h: 63000,
            volume24h: 40000,
            turnover24h: 2500000000,
          },
        },
      })
    })

    it('skips Zustand state object mutation when price delta is below 0.001% deadband', () => {
      const stateBefore = useMarketStore.getState()
      const existingTicker = stateBefore.entities['BTC/USDT']!

      // Price delta of $0.10 on a $64,000 asset is 0.00015% (less than 0.001% / $0.64 deadband)
      const subDeadbandTicker = {
        ...existingTicker,
        lastPrice: 64000.1,
      }

      useMarketStore.getState().updateTicker(subDeadbandTicker)
      const stateAfter = useMarketStore.getState()

      // The state reference should be strictly identical because mutation was suppressed
      expect(stateAfter).toBe(stateBefore)
      expect(stateAfter.entities['BTC/USDT']?.lastPrice).toBe(64000.0)
    })

    it('applies state update when price delta exceeds 0.001% deadband', () => {
      const stateBefore = useMarketStore.getState()
      const existingTicker = stateBefore.entities['BTC/USDT']!

      // Price delta of $10.0 on a $64,000 asset is 0.015% (well above 0.001% deadband)
      const aboveDeadbandTicker = {
        ...existingTicker,
        lastPrice: 64010.0,
      }

      useMarketStore.getState().updateTicker(aboveDeadbandTicker)
      const stateAfter = useMarketStore.getState()

      expect(stateAfter).not.toBe(stateBefore)
      expect(stateAfter.entities['BTC/USDT']?.lastPrice).toBe(64010.0)
    })

    it('skips batchUpdatePrices when all updates are within deadband', () => {
      const stateBefore = useMarketStore.getState()

      useMarketStore.getState().batchUpdatePrices([
        { symbol: 'BTC/USDT', price: 64000.05 },
      ])

      const stateAfter = useMarketStore.getState()
      expect(stateAfter).toBe(stateBefore)
    })
  })

  describe('Adaptive Batching in RafBatchDispatcher', () => {
    it('supports enabling adaptive mode and toggling', () => {
      const dispatcher = new RafBatchDispatcher<number>()
      expect(dispatcher.getAdaptiveMode()).toBe(false)

      dispatcher.setAdaptiveMode(true)
      expect(dispatcher.getAdaptiveMode()).toBe(true)

      dispatcher.setAdaptiveMode(false)
      expect(dispatcher.getAdaptiveMode()).toBe(false)
    })
  })

  describe('Multi-Symbol Feed & Object Pooling', () => {
    it('distributes ticks across symbols when multi-symbol mode is enabled', () => {
      const sim = new TradingFeedSimulator('BTC/USDT')
      sim.setMultiSymbolEnabled(true)
      expect(sim.isMultiSymbolEnabled()).toBe(true)

      const emittedSymbols: string[] = []
      const unsub = sim.tickerDispatcher.subscribe((tickers) => {
        for (const t of tickers) {
          emittedSymbols.push(t.symbol)
        }
      })

      // Run multiple ticks
      for (let i = 0; i < 12; i++) {
        sim.tick()
      }

      sim.tickerDispatcher.flushNow()
      unsub()

      // Should have generated ticks for multiple symbols (BTC, ETH, SOL, etc.)
      const uniqueSymbols = Array.from(new Set(emittedSymbols))
      expect(uniqueSymbols.length).toBeGreaterThan(1)
      expect(uniqueSymbols).toContain('BTC/USDT')
      expect(uniqueSymbols).toContain('ETH/USDT')
    })

    it('generates consistent order book snapshots reusing pooled levels', () => {
      const sim = new TradingFeedSimulator('BTC/USDT')
      const book1 = sim.getCurrentOrderBookSnapshot()
      expect(book1).toBeDefined()
      expect(book1?.bids.length).toBe(15)
      expect(book1?.asks.length).toBe(15)
      expect(book1?.spread).toBeGreaterThan(0)
    })
  })

  describe('StressTestRunner & Metrics Comparison', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('executes a complete stress test cycle with progress events and summary', async () => {
      const runner = new StressTestRunner()
      expect(runner.getIsRunning()).toBe(false)

      const progressStatuses: string[] = []
      const runPromise = runner.run(
        { tickRate: 1000, durationMs: 2000, batchingEnabled: true },
        (status) => {
          progressStatuses.push(status)
        }
      )

      expect(runner.getIsRunning()).toBe(true)

      // Advance timers by 1s (sample 1)
      await vi.advanceTimersByTimeAsync(1000)
      // Advance timers by 1s (sample 2 - complete sample run)
      await vi.advanceTimersByTimeAsync(1000)
      // Advance timers by 500ms (cooldown period)
      await vi.advanceTimersByTimeAsync(600)

      const result = await runPromise
      expect(runner.getIsRunning()).toBe(false)
      expect(result).toBeDefined()
      expect(result.summary).toBeDefined()
      expect(result.samples.length).toBe(2)
      expect(progressStatuses).toContain('warmup')
      expect(progressStatuses).toContain('running')
      expect(progressStatuses).toContain('cooldown')
      expect(progressStatuses).toContain('complete')
    })

    it('computes before/after comparison factors accurately', () => {
      const beforeResult: StressTestResult = {
        config: { tickRate: 1000, durationMs: 2000, batchingEnabled: false },
        baseline: {
          timestamp: 0, fps: 60, throughputMsgPerSec: 20, renderCommitRate: 60,
          batchCompressionRatio: 1, avgRenderTimeMs: 1.2, batchLatencyMs: 0,
          eventQueueLagMs: 0.5, memoryUsageMb: 45, droppedFrames: 0,
        },
        peak: {
          timestamp: 1000, fps: 28, throughputMsgPerSec: 1000, renderCommitRate: 1000,
          batchCompressionRatio: 1, avgRenderTimeMs: 14.5, batchLatencyMs: 0,
          eventQueueLagMs: 85.0, memoryUsageMb: 52, droppedFrames: 42,
        },
        final: {
          timestamp: 2000, fps: 30, throughputMsgPerSec: 1000, renderCommitRate: 1000,
          batchCompressionRatio: 1, avgRenderTimeMs: 14.0, batchLatencyMs: 0,
          eventQueueLagMs: 80.0, memoryUsageMb: 54, droppedFrames: 48,
        },
        samples: [],
        summary: {
          avgFps: 30,
          minFps: 28,
          maxFps: 32,
          avgThroughput: 1000,
          avgRenderCommitRate: 1000,
          avgBatchCompression: 1,
          avgQueueLagMs: 80,
          peakQueueLagMs: 85,
          avgRenderTimeMs: 14.2,
          totalDroppedFrames: 48,
          memoryDeltaMb: 9,
          passed60FpsTarget: false,
          effectiveCompressionRatio: 1,
        },
      }

      const afterResult: StressTestResult = {
        config: { tickRate: 1000, durationMs: 2000, batchingEnabled: true },
        baseline: {
          timestamp: 0, fps: 60, throughputMsgPerSec: 20, renderCommitRate: 60,
          batchCompressionRatio: 1, avgRenderTimeMs: 1.2, batchLatencyMs: 0,
          eventQueueLagMs: 0.5, memoryUsageMb: 45, droppedFrames: 0,
        },
        peak: {
          timestamp: 1000, fps: 59, throughputMsgPerSec: 1000, renderCommitRate: 60,
          batchCompressionRatio: 16.6, avgRenderTimeMs: 2.1, batchLatencyMs: 16,
          eventQueueLagMs: 1.8, memoryUsageMb: 47, droppedFrames: 0,
        },
        final: {
          timestamp: 2000, fps: 60, throughputMsgPerSec: 1000, renderCommitRate: 60,
          batchCompressionRatio: 16.6, avgRenderTimeMs: 1.9, batchLatencyMs: 16,
          eventQueueLagMs: 1.5, memoryUsageMb: 47.5, droppedFrames: 0,
        },
        samples: [],
        summary: {
          avgFps: 60,
          minFps: 59,
          maxFps: 60,
          avgThroughput: 1000,
          avgRenderCommitRate: 60,
          avgBatchCompression: 16.6,
          avgQueueLagMs: 1.6,
          peakQueueLagMs: 1.8,
          avgRenderTimeMs: 2.0,
          totalDroppedFrames: 0,
          memoryDeltaMb: 2.5,
          passed60FpsTarget: true,
          effectiveCompressionRatio: 16.7,
        },
      }

      const comparison = compareResults(beforeResult, afterResult)
      expect(comparison.fpsImprovement).toBe(100) // 30 to 60 is +100%
      expect(comparison.lagReduction).toBe(98)     // 80ms to 1.6ms is 98% lower
      expect(comparison.renderReduction).toBe(16.7) // 1000 / 60
      expect(comparison.droppedFrameReduction).toBe(48)
    })
  })
})
