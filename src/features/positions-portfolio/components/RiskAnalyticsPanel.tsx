import React, { useEffect } from 'react'
import {
  Activity,
  AlertTriangle,
  Cpu,
  Layers,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { useRiskAnalyticsWorker } from '@/hooks/useRiskAnalyticsWorker'
import { generate100kOrders } from '@/utils/orderGenerator'
import type { Position } from '@/types/position'

export interface RiskAnalyticsPanelProps {
  positions: Position[]
}

export const RiskAnalyticsPanel: React.FC<RiskAnalyticsPanelProps> = ({ positions }) => {
  const {
    result,
    isComputing,
    progress,
    phase,
    error,
    benchmarkComparison,
    runWorkerCalculation,
    runBenchmarkComparison,
  } = useRiskAnalyticsWorker()

  // Auto-run worker calculation on first render if no result
  useEffect(() => {
    const orders = generate100kOrders(100000)
    runWorkerCalculation({
      positions,
      orders,
      simulationPaths: 10000,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRunWorker = () => {
    const orders = generate100kOrders(100000)
    runWorkerCalculation({
      positions,
      orders,
      simulationPaths: 10000,
    })
  }

  const handleRunBenchmark = () => {
    const orders = generate100kOrders(100000)
    runBenchmarkComparison({
      positions,
      orders,
      simulationPaths: 10000,
    })
  }

  return (
    <div className="risk-analytics-panel" data-testid="risk-analytics-panel">
      {/* Control / Action Header */}
      <div className="risk-header">
        <div className="flex items-center gap-2">
          <Cpu size={16} className="text-cyan-accent" />
          <div>
            <h4 className="font-bold text-xs text-neutral-100 flex items-center gap-2">
              QUANTITATIVE RISK & 100K ORDER ANALYTICS ENGINE
              <span className="badge badge-primary">Typed Web Worker (Off-Thread)</span>
            </h4>
            <span className="text-xs text-neutral-400">
              Offloads 10,000-path Monte Carlo VaR simulation & 100,000 order calculations off the main thread.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary flex items-center gap-1.5"
            onClick={handleRunBenchmark}
            disabled={isComputing}
            data-testid="run-worker-benchmark-btn"
            title="Benchmark Main-Thread synchronous execution vs Web Worker off-thread execution"
          >
            <Zap size={13} className="text-warning" />
            <span>Benchmark vs Main Thread</span>
          </button>

          <button
            type="button"
            className="btn btn-primary flex items-center gap-1.5"
            onClick={handleRunWorker}
            disabled={isComputing}
            data-testid="run-worker-calc-btn"
          >
            <Sparkles size={13} />
            <span>{isComputing ? 'Computing in Worker…' : 'Re-run Risk Simulation'}</span>
          </button>
        </div>
      </div>

      {/* Progress / Status Bar */}
      {isComputing && (
        <div className="worker-progress-bar-container" data-testid="worker-progress">
          <div className="flex justify-between items-center text-xs font-mono mb-1">
            <span className="text-cyan-accent flex items-center gap-1.5">
              <Activity size={12} className="animate-spin" />
              {phase || 'Processing in Web Worker…'}
            </span>
            <span className="text-neutral-400">{Math.round(progress * 100)}%</span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="worker-error-banner">
          <AlertTriangle size={14} />
          <span>Worker Calculation Error: {error}</span>
        </div>
      )}

      {/* Benchmark Comparison Card */}
      {benchmarkComparison && (
        <div className="benchmark-compare-card" data-testid="benchmark-comparison-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase text-warning flex items-center gap-1">
              <Zap size={13} />
              PERFORMANCE BENCHMARK: MAIN THREAD vs TYPED WEB WORKER
            </span>
            <span className="text-xs font-mono text-cyan-accent font-bold">
              {benchmarkComparison.speedupFactor}x Faster Execution
            </span>
          </div>

          <div className="benchmark-grid">
            <div className="bench-col unoptimized">
              <span className="bench-col-title">MAIN THREAD (SYNCHRONOUS)</span>
              <span className="bench-col-time text-sell">{benchmarkComparison.mainThreadTimeMs} ms</span>
              <span className="bench-col-sub text-sell">
                🚨 UI Thread Blocked for {benchmarkComparison.mainThreadLagMs}ms (dropped frames, input lag)
              </span>
            </div>

            <div className="bench-col optimized">
              <span className="bench-col-title">TYPED WEB WORKER (OFF-THREAD)</span>
              <span className="bench-col-time text-buy">{benchmarkComparison.workerTimeMs} ms</span>
              <span className="bench-col-sub text-buy">
                ✨ 0ms Main Thread Freeze (60 FPS maintained, zero input lag)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Analytics & Risk Results */}
      {result && (
        <div className="risk-results-grid" data-testid="risk-results">
          {/* VaR (95%) Card */}
          <div className="risk-stat-card">
            <div className="flex justify-between items-center">
              <span className="stat-label">Value at Risk (95% 1-Day VaR)</span>
              <TrendingDown size={14} className="text-warning" />
            </div>
            <span className="stat-val text-warning font-mono">
              ${result.varResults[0]?.varAmount.toLocaleString()}
            </span>
            <span className="stat-desc">
              {result.varResults[0]?.varPercent}% of portfolio value ({result.monteCarloPaths.toLocaleString()} paths)
            </span>
          </div>

          {/* VaR (99%) Card */}
          <div className="risk-stat-card">
            <div className="flex justify-between items-center">
              <span className="stat-label">Value at Risk (99% Extreme VaR)</span>
              <TrendingDown size={14} className="text-sell" />
            </div>
            <span className="stat-val text-sell font-mono">
              ${result.varResults[1]?.varAmount.toLocaleString()}
            </span>
            <span className="stat-desc">
              Expected Shortfall (CVaR): ${result.varResults[1]?.expectedShortfall.toLocaleString()}
            </span>
          </div>

          {/* Sharpe & Sortino Ratios */}
          <div className="risk-stat-card">
            <div className="flex justify-between items-center">
              <span className="stat-label">Risk-Adjusted Ratios</span>
              <TrendingUp size={14} className="text-buy" />
            </div>
            <div className="flex items-center gap-3 font-mono font-bold">
              <span className="text-buy">Sharpe: {result.orderAnalytics.sharpeRatio}</span>
              <span className="text-cyan-accent">Sortino: {result.orderAnalytics.sortinoRatio}</span>
            </div>
            <span className="stat-desc">
              Max Drawdown Est: {result.orderAnalytics.maxDrawdownPercent}%
            </span>
          </div>

          {/* 100K Order Fill & Slippage */}
          <div className="risk-stat-card">
            <div className="flex justify-between items-center">
              <span className="stat-label">100K Execution Slippage</span>
              <Layers size={14} className="text-cyan-accent" />
            </div>
            <div className="flex items-center gap-2 font-mono text-xs">
              <span>p50: {result.orderAnalytics.slippageStats.p50SlippageBps} bps</span>
              <span>p95: {result.orderAnalytics.slippageStats.p95SlippageBps} bps</span>
              <span>p99: {result.orderAnalytics.slippageStats.p99SlippageBps} bps</span>
            </div>
            <span className="stat-desc">
              Analyzed {result.orderAnalytics.totalOrdersAnalyzed.toLocaleString()} orders (${(result.orderAnalytics.totalVolumeUsd / 1000000).toFixed(1)}M Vol)
            </span>
          </div>
        </div>
      )}

      {/* Monte Carlo Distribution Chart & VWAP Table */}
      {result && (
        <div className="risk-details-row">
          {/* Distribution Histogram */}
          <div className="distribution-card">
            <h5 className="font-bold text-xs text-neutral-300 mb-2 flex items-center justify-between">
              <span>Monte Carlo Simulated Return Distribution (10,000 Paths)</span>
              <span className="text-xs font-mono text-neutral-400">
                Calc Time: {result.computationDurationMs}ms ({result.isWorker ? 'Web Worker' : 'Main Thread'})
              </span>
            </h5>
            <div className="histogram-bars">
              {result.simulatedReturnsDistribution.map((count, idx) => {
                const maxCount = Math.max(...result.simulatedReturnsDistribution, 1)
                const heightPercent = Math.min(100, (count / maxCount) * 100)
                const isLoss = idx < result.simulatedReturnsDistribution.length / 2
                return (
                  <div
                    key={idx}
                    className="hist-bar-wrapper"
                    title={`Bucket ${idx}: ${count} paths`}
                  >
                    <div
                      className={`hist-bar ${isLoss ? 'loss' : 'gain'}`}
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between text-xs text-muted font-mono mt-1">
              <span>-15% Worst Tail</span>
              <span>0.0% Mean</span>
              <span>+15% Best Tail</span>
            </div>
          </div>

          {/* VWAP Summary Table */}
          <div className="vwap-summary-card">
            <h5 className="font-bold text-xs text-neutral-300 mb-2">
              100K Dataset VWAP per Symbol
            </h5>
            <div className="vwap-list">
              {Object.entries(result.orderAnalytics.vwapBySymbol).map(([sym, vwap]) => (
                <div key={sym} className="vwap-item">
                  <span className="font-bold text-neutral-200">{sym}</span>
                  <span className="font-mono text-cyan-accent">${vwap.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
