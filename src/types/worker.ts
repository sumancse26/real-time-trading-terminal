import type { ActiveOrder } from './order'
import type { Position } from './position'

/**
 * Phase 14 — Risk Analytics & Monte Carlo Simulation Input
 */
export interface RiskAnalyticsInput {
  positions: Position[]
  orders: ActiveOrder[]
  /** Number of Monte Carlo simulation paths (default: 10,000) */
  simulationPaths?: number
  /** Time horizon in days for VaR calculation (default: 1) */
  timeHorizonDays?: number
  /** Confidence levels for VaR, e.g. [0.95, 0.99] */
  confidenceLevels?: number[]
}

/**
 * Monte Carlo VaR and Expected Shortfall results
 */
export interface ValueAtRiskResult {
  confidence: number
  varAmount: number
  varPercent: number
  expectedShortfall: number
}

/**
 * 100K Order Quantitative Analytics Result
 */
export interface OrderAnalyticsSummary {
  totalOrdersAnalyzed: number
  totalVolumeUsd: number
  vwapBySymbol: Record<string, number>
  fillRatePercentage: number
  slippageStats: {
    avgSlippageBps: number
    p50SlippageBps: number
    p95SlippageBps: number
    p99SlippageBps: number
  }
  sideBreakdown: {
    buyCount: number
    sellCount: number
    buyVolumeUsd: number
    sellVolumeUsd: number
  }
  statusBreakdown: Record<string, number>
  sharpeRatio: number
  sortinoRatio: number
  maxDrawdownPercent: number
}

/**
 * Complete Risk and Analytics Output
 */
export interface RiskAnalyticsResult {
  computationDurationMs: number
  isWorker: boolean
  totalPortfolioValue: number
  monteCarloPaths: number
  varResults: ValueAtRiskResult[]
  orderAnalytics: OrderAnalyticsSummary
  simulatedReturnsDistribution: number[] // histogram buckets
}

/**
 * Protocol Request Message
 */
export type WorkerRequest =
  | {
      id: string
      type: 'CALCULATE_RISK_ANALYTICS'
      payload: RiskAnalyticsInput
    }
  | {
      id: string
      type: 'CANCEL'
    }

/**
 * Protocol Response Message
 */
export type WorkerResponse =
  | {
      id: string
      type: 'SUCCESS'
      result: RiskAnalyticsResult
    }
  | {
      id: string
      type: 'PROGRESS'
      progress: number // 0 to 1
      phase: string
    }
  | {
      id: string
      type: 'ERROR'
      error: string
    }
