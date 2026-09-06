import { describe, it, expect } from 'vitest'
import { calculateRiskAnalytics } from '@/core/analytics/riskCalculator'
import { RiskAnalyticsWorkerClient } from '@/workers/riskAnalyticsClient'
import { generate100kOrders } from '@/utils/orderGenerator'
import type { Position } from '@/types/position'

describe('Phase 14 — Typed Web Worker Risk & Analytics Engine', () => {
  const mockPositions: Position[] = [
    {
      id: 'pos-1',
      symbol: 'BTC/USDT',
      side: 'LONG',
      size: 1.5,
      entryPrice: 62000,
      markPrice: 64250,
      leverage: 10,
      margin: 9637.5,
      liquidationPrice: 56000,
      unrealizedPnl: 3375,
      unrealizedPnlPercent: 35.02,
      marketValue: 96375,
      maintenanceMargin: 0.005,
    },
    {
      id: 'pos-2',
      symbol: 'ETH/USDT',
      side: 'SHORT',
      size: 10.0,
      entryPrice: 3500,
      markPrice: 3445,
      leverage: 5,
      margin: 6890,
      liquidationPrice: 4100,
      unrealizedPnl: 550,
      unrealizedPnlPercent: 7.98,
      marketValue: 34450,
      maintenanceMargin: 0.01,
    },
  ]

  describe('CPU Calculation Engine (Monte Carlo VaR & 100K Order Analytics)', () => {
    it('accurately computes 10,000-path Monte Carlo VaR & Expected Shortfall', () => {
      const orders = generate100kOrders(1000)
      const result = calculateRiskAnalytics({
        positions: mockPositions,
        orders,
        simulationPaths: 10000,
        confidenceLevels: [0.95, 0.99],
      })

      expect(result).toBeDefined()
      expect(result.monteCarloPaths).toBe(10000)
      expect(result.varResults.length).toBe(2)

      const var95 = result.varResults.find((r) => r.confidence === 0.95)!
      const var99 = result.varResults.find((r) => r.confidence === 0.99)!

      expect(var95).toBeDefined()
      expect(var99).toBeDefined()
      // 99% VaR must represent a higher dollar loss threshold than 95% VaR
      expect(var99.varAmount).toBeGreaterThanOrEqual(var95.varAmount)
      expect(var99.expectedShortfall).toBeGreaterThanOrEqual(var99.varAmount)
      expect(result.simulatedReturnsDistribution.length).toBe(30)
    })

    it('processes order analytics with VWAP, slippage, and Sharpe ratios', () => {
      const orders = generate100kOrders(5000)
      const result = calculateRiskAnalytics({
        positions: mockPositions,
        orders,
        simulationPaths: 1000,
      })

      const oa = result.orderAnalytics
      expect(oa.totalOrdersAnalyzed).toBe(5000)
      expect(oa.totalVolumeUsd).toBeGreaterThan(0)
      expect(oa.fillRatePercentage).toBeGreaterThan(0)
      expect(oa.sharpeRatio).toBeGreaterThan(0)
      expect(oa.sortinoRatio).toBeGreaterThan(0)
      expect(oa.vwapBySymbol['BTC/USDT']).toBeGreaterThan(50000)
      expect(oa.slippageStats.p99SlippageBps).toBeGreaterThanOrEqual(oa.slippageStats.p50SlippageBps)
    })

    it('emits progress updates through onProgress callback', () => {
      const progressSteps: number[] = []
      const orders = generate100kOrders(100)

      calculateRiskAnalytics(
        { positions: mockPositions, orders, simulationPaths: 500 },
        false,
        (p) => progressSteps.push(p)
      )

      expect(progressSteps.length).toBeGreaterThanOrEqual(2)
      expect(progressSteps[progressSteps.length - 1]).toBe(1.0)
    })
  })

  describe('RiskAnalyticsWorkerClient Lifecycle & Fallback', () => {
    it('executes synchronously on main thread fallback when Worker is mocked/unavailable', async () => {
      const client = new RiskAnalyticsWorkerClient({ enableFallback: true })
      const orders = generate100kOrders(200)

      const result = await client.calculateRisk({
        positions: mockPositions,
        orders,
        simulationPaths: 500,
      })

      expect(result).toBeDefined()
      expect(result.orderAnalytics.totalOrdersAnalyzed).toBe(200)
      expect(result.varResults.length).toBe(2)
    })

    it('supports direct calculateOnMainThread execution', async () => {
      const client = new RiskAnalyticsWorkerClient()
      const orders = generate100kOrders(100)

      const result = await client.calculateOnMainThread({
        positions: mockPositions,
        orders,
        simulationPaths: 200,
      })

      expect(result).toBeDefined()
      expect(result.isWorker).toBe(false)
      expect(result.monteCarloPaths).toBe(200)
    })

    it('handles termination and cancels active operations cleanly', async () => {
      const client = new RiskAnalyticsWorkerClient()
      client.terminate()

      const orders = generate100kOrders(10)
      await expect(client.calculateRisk({ positions: [], orders })).rejects.toThrow(
        'Worker client has been terminated'
      )
    })
  })
})
