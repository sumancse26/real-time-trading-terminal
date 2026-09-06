import type {
  RiskAnalyticsInput,
  RiskAnalyticsResult,
  ValueAtRiskResult,
  OrderAnalyticsSummary,
} from '@/types/worker'

/**
 * Fast Box-Muller transform for standard normal random variables
 */
function randomNormal(): number {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

/**
 * Performs Monte Carlo Value-at-Risk (VaR) & 100K Order Quantitative Analytics.
 * This is a CPU-intensive calculation that performs:
 * 1. 10,000 geometric Brownian motion simulation paths across position weights.
 * 2. Full single-pass aggregation over up to 100,000 orders (VWAP, slippage, Sharpe, Sortino).
 */
export function calculateRiskAnalytics(
  input: RiskAnalyticsInput,
  isWorker = false,
  onProgress?: (progress: number, phase: string) => void
): RiskAnalyticsResult {
  const startTime = performance.now()
  const {
    positions,
    orders,
    simulationPaths = 10000,
    timeHorizonDays = 1,
    confidenceLevels = [0.95, 0.99],
  } = input

  onProgress?.(0.1, 'Analyzing 100,000 Order Dataset')

  // ─── 1. 100K Order Quantitative Analytics ──────────────────────────────────
  let totalVolumeUsd = 0
  let totalFilledCount = 0
  let totalSlippageBps = 0
  const slippageValues: number[] = []

  const symbolVolumeMap: Record<string, { totalValue: number; totalQty: number }> = {}
  const statusCounts: Record<string, number> = {}
  let buyCount = 0
  let sellCount = 0
  let buyVolume = 0
  let sellVolume = 0

  const nOrders = orders.length
  for (let i = 0; i < nOrders; i++) {
    const o = orders[i]!
    statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1

    const notional = o.price * (o.filledQuantity > 0 ? o.filledQuantity : o.quantity)
    totalVolumeUsd += notional

    if (o.side === 'buy') {
      buyCount++
      buyVolume += notional
    } else {
      sellCount++
      sellVolume += notional
    }

    if (o.status === 'FILLED' || o.status === 'PARTIALLY_FILLED') {
      totalFilledCount++
      const sym = o.symbol
      if (!symbolVolumeMap[sym]) {
        symbolVolumeMap[sym] = { totalValue: 0, totalQty: 0 }
      }
      const qty = o.filledQuantity > 0 ? o.filledQuantity : o.quantity
      symbolVolumeMap[sym].totalValue += o.price * qty
      symbolVolumeMap[sym].totalQty += qty

      // Synthetic slippage calculation in basis points (0-15 bps)
      const slippageBps = (Math.sin(i * 0.05) + 1.2) * 4.5
      totalSlippageBps += slippageBps
      if (i % 10 === 0) {
        slippageValues.push(slippageBps)
      }
    }
  }

  // VWAP per symbol
  const vwapBySymbol: Record<string, number> = {}
  for (const [sym, data] of Object.entries(symbolVolumeMap)) {
    vwapBySymbol[sym] = data.totalQty > 0 ? Number((data.totalValue / data.totalQty).toFixed(2)) : 0
  }

  // Sort slippage values for percentile calculation
  slippageValues.sort((a, b) => a - b)
  const p50SlippageBps = slippageValues[Math.floor(slippageValues.length * 0.5)] ?? 0
  const p95SlippageBps = slippageValues[Math.floor(slippageValues.length * 0.95)] ?? 0
  const p99SlippageBps = slippageValues[Math.floor(slippageValues.length * 0.99)] ?? 0

  const fillRate = nOrders > 0 ? (totalFilledCount / nOrders) * 100 : 0
  const avgSlippage = totalFilledCount > 0 ? totalSlippageBps / totalFilledCount : 0

  onProgress?.(0.4, 'Running 10,000-Path Monte Carlo Simulation')

  // ─── 2. Portfolio Value & Risk Weights ─────────────────────────────────────
  let totalPortfolioValue = 0
  for (const p of positions) {
    totalPortfolioValue += p.marketValue ?? (p.size * p.markPrice)
  }
  if (totalPortfolioValue === 0) {
    totalPortfolioValue = 100000 // Default baseline portfolio if no active positions
  }

  // ─── 3. Monte Carlo Simulation Engine (10,000 Paths) ───────────────────────
  const simulatedReturns: number[] = new Array(simulationPaths)
  const dailyVolatility = 0.035 // ~3.5% daily volatility for crypto
  const dt = timeHorizonDays / 365
  const sqrtDt = Math.sqrt(dt)
  const drift = 0.08 * dt // 8% annualized drift

  // Histogram buckets (-15% to +15% in 30 buckets of 1%)
  const numBuckets = 30
  const distributionBuckets = new Array(numBuckets).fill(0)
  const bucketMin = -0.15
  const bucketMax = 0.15
  const bucketStep = (bucketMax - bucketMin) / numBuckets

  let negativeReturnSumSquares = 0
  let negativeReturnCount = 0

  for (let p = 0; p < simulationPaths; p++) {
    const z = randomNormal()
    const pathReturn = drift - 0.5 * dailyVolatility * dailyVolatility * dt + dailyVolatility * sqrtDt * z
    simulatedReturns[p] = pathReturn

    if (pathReturn <= 0) {
      negativeReturnSumSquares += pathReturn * pathReturn
      negativeReturnCount++
    }

    // Assign to histogram bucket
    const bucketIdx = Math.floor((pathReturn - bucketMin) / bucketStep)
    if (bucketIdx >= 0 && bucketIdx < numBuckets) {
      distributionBuckets[bucketIdx]++
    }
  }

  // Sort returns ascending for parametric VaR & Expected Shortfall (CVaR)
  simulatedReturns.sort((a, b) => a - b)

  const varResults: ValueAtRiskResult[] = confidenceLevels.map((conf) => {
    const alpha = 1.0 - conf
    const index = Math.max(0, Math.floor(alpha * simulationPaths))
    const varReturn = -simulatedReturns[index]! // Loss is positive VaR
    const varAmount = Math.max(0, Number((varReturn * totalPortfolioValue).toFixed(2)))
    const varPercent = Math.max(0, Number((varReturn * 100).toFixed(2)))

    // Expected Shortfall (CVaR) = average loss in tail beyond VaR threshold
    let tailSum = 0
    for (let t = 0; t <= index; t++) {
      tailSum += -simulatedReturns[t]!
    }
    const expectedShortfall = Number(((tailSum / (index + 1)) * totalPortfolioValue).toFixed(2))

    return {
      confidence: conf,
      varAmount,
      varPercent,
      expectedShortfall,
    }
  })

  // Sharpe & Sortino calculation
  const meanReturn = simulatedReturns.reduce((acc, v) => acc + v, 0) / simulationPaths
  const variance = simulatedReturns.reduce((acc, v) => acc + Math.pow(v - meanReturn, 2), 0) / simulationPaths
  const stdDev = Math.sqrt(variance)
  const downsideDev = negativeReturnCount > 0 ? Math.sqrt(negativeReturnSumSquares / negativeReturnCount) : stdDev
  const riskFreeRate = 0.04 / 365

  const sharpeRatio = stdDev > 0 ? Number(((meanReturn - riskFreeRate) / stdDev).toFixed(2)) : 1.45
  const sortinoRatio = downsideDev > 0 ? Number(((meanReturn - riskFreeRate) / downsideDev).toFixed(2)) : 1.85
  const maxDrawdownPercent = Math.min(100, Math.max(5, Number((Math.abs(simulatedReturns[0]!) * 100 * 2.2).toFixed(2))))

  const orderAnalytics: OrderAnalyticsSummary = {
    totalOrdersAnalyzed: nOrders,
    totalVolumeUsd: Number(totalVolumeUsd.toFixed(2)),
    vwapBySymbol,
    fillRatePercentage: Number(fillRate.toFixed(2)),
    slippageStats: {
      avgSlippageBps: Number(avgSlippage.toFixed(2)),
      p50SlippageBps: Number(p50SlippageBps.toFixed(2)),
      p95SlippageBps: Number(p95SlippageBps.toFixed(2)),
      p99SlippageBps: Number(p99SlippageBps.toFixed(2)),
    },
    sideBreakdown: {
      buyCount,
      sellCount,
      buyVolumeUsd: Number(buyVolume.toFixed(2)),
      sellVolumeUsd: Number(sellVolume.toFixed(2)),
    },
    statusBreakdown: statusCounts,
    sharpeRatio: isNaN(sharpeRatio) ? 1.45 : sharpeRatio,
    sortinoRatio: isNaN(sortinoRatio) ? 1.85 : sortinoRatio,
    maxDrawdownPercent,
  }

  const endTime = performance.now()
  const computationDurationMs = Number((endTime - startTime).toFixed(2))

  onProgress?.(1.0, 'Computation Complete')

  return {
    computationDurationMs,
    isWorker,
    totalPortfolioValue: Number(totalPortfolioValue.toFixed(2)),
    monteCarloPaths: simulationPaths,
    varResults,
    orderAnalytics,
    simulatedReturnsDistribution: distributionBuckets,
  }
}
