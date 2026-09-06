import type { PriceLevel } from '@/types/orderbook'

/**
 * Calculates absolute spread, percentage spread, and mid-market price
 * between the top of the book best ask and best bid.
 */
export function calculateSpread(
  bestAsk?: number,
  bestBid?: number
): { spread: number; spreadPercentage: number; midPrice: number } {
  if (bestAsk === undefined || bestBid === undefined || bestAsk <= 0 || bestBid <= 0) {
    return { spread: 0, spreadPercentage: 0, midPrice: 0 }
  }

  const spread = Math.max(0, Number((bestAsk - bestBid).toFixed(2)))
  const spreadPercentage = Number(((spread / bestAsk) * 100).toFixed(4))
  const midPrice = Number(((bestAsk + bestBid) / 2).toFixed(2))

  return {
    spread,
    spreadPercentage,
    midPrice,
  }
}

/**
 * Recalculates running cumulative totals and percentage depth
 * normalized to the highest cumulative total in the level list.
 */
export function calculateCumulativeDepth(levels: PriceLevel[]): PriceLevel[] {
  if (levels.length === 0) return []

  let runningTotal = 0
  const withTotals = levels.map((lvl) => {
    runningTotal += lvl.size
    return {
      ...lvl,
      total: Number(runningTotal.toFixed(4)),
    }
  })

  const maxTotal = runningTotal > 0 ? runningTotal : 1

  return withTotals.map((lvl) => ({
    ...lvl,
    percentDepth: Math.min(100, Number(((lvl.total / maxTotal) * 100).toFixed(2))),
  }))
}

/**
 * Aggregates price levels by price buckets based on tick precision.
 * For bids: rounds down to floor(price / precision) * precision
 * For asks: rounds up to ceil(price / precision) * precision
 */
export function aggregateOrderBookLevels(
  levels: PriceLevel[],
  precision: number,
  side: 'ask' | 'bid'
): PriceLevel[] {
  if (precision <= 0 || levels.length === 0) {
    return calculateCumulativeDepth(levels)
  }

  const bucketMap = new Map<number, { price: number; size: number; ordersCount: number }>()

  for (const lvl of levels) {
    let bucketPrice: number
    if (side === 'bid') {
      bucketPrice = Number((Math.floor(lvl.price / precision) * precision).toFixed(4))
    } else {
      bucketPrice = Number((Math.ceil(lvl.price / precision) * precision).toFixed(4))
    }

    const existing = bucketMap.get(bucketPrice)
    if (existing) {
      existing.size += lvl.size
      existing.ordersCount += lvl.ordersCount ?? 1
    } else {
      bucketMap.set(bucketPrice, {
        price: bucketPrice,
        size: lvl.size,
        ordersCount: lvl.ordersCount ?? 1,
      })
    }
  }

  const aggregated = Array.from(bucketMap.values()).map((entry) => ({
    price: entry.price,
    size: Number(entry.size.toFixed(4)),
    total: 0,
    percentDepth: 0,
    ordersCount: entry.ordersCount,
  }))

  // Sort asks ascending (lowest ask first), bids descending (highest bid first)
  if (side === 'ask') {
    aggregated.sort((a, b) => a.price - b.price)
  } else {
    aggregated.sort((a, b) => b.price - a.price)
  }

  return calculateCumulativeDepth(aggregated)
}
