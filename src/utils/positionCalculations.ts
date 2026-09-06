import type { Position } from '@/types/position'

export interface PositionMetrics {
  marketValue: number
  unrealizedPnl: number
  unrealizedPnlPercent: number
  margin: number
  liquidationPrice: number
}

/**
 * Maintenance Margin Rate for isolated leverage positions (0.5%)
 */
export const DEFAULT_MAINTENANCE_MARGIN_RATE = 0.005

/**
 * Calculates core financial derivatives for a position:
 * - Market Value (Notional): size * markPrice
 * - Required Margin: (size * entryPrice) / leverage
 * - Unrealized PnL:
 *     LONG: (markPrice - entryPrice) * size
 *     SHORT: (entryPrice - markPrice) * size
 * - PnL % (ROE): (unrealizedPnl / margin) * 100%
 * - Liquidation Price (isolated):
 *     LONG: entryPrice * (1 - 1 / leverage + mmr)
 *     SHORT: entryPrice * (1 + 1 / leverage - mmr)
 */
export function calculatePositionMetrics(
  side: 'LONG' | 'SHORT',
  size: number,
  entryPrice: number,
  markPrice: number,
  leverage: number,
  mmr: number = DEFAULT_MAINTENANCE_MARGIN_RATE
): PositionMetrics {
  const safeSize = Math.max(0, isFinite(size) ? size : 0)
  const safeEntryPrice = Math.max(0, isFinite(entryPrice) ? entryPrice : 0)
  const safeMarkPrice = Math.max(0, isFinite(markPrice) ? markPrice : safeEntryPrice)
  const safeLeverage = Math.max(1, isFinite(leverage) ? leverage : 1)

  const marketValue = Number((safeSize * safeMarkPrice).toFixed(2))
  const margin = Number(((safeSize * safeEntryPrice) / safeLeverage).toFixed(2))

  let unrealizedPnl = 0
  if (side === 'LONG') {
    unrealizedPnl = (safeMarkPrice - safeEntryPrice) * safeSize
  } else {
    unrealizedPnl = (safeEntryPrice - safeMarkPrice) * safeSize
  }
  unrealizedPnl = Number(unrealizedPnl.toFixed(2))

  let unrealizedPnlPercent = 0
  if (margin > 0) {
    unrealizedPnlPercent = Number(((unrealizedPnl / margin) * 100).toFixed(2))
  }

  let liquidationPrice = 0
  if (safeEntryPrice > 0 && safeLeverage > 0) {
    if (side === 'LONG') {
      liquidationPrice = Math.max(0, safeEntryPrice * (1 - 1 / safeLeverage + mmr))
    } else {
      liquidationPrice = safeEntryPrice * (1 + 1 / safeLeverage - mmr)
    }
  }
  liquidationPrice = Number(liquidationPrice.toFixed(2))

  return {
    marketValue,
    unrealizedPnl,
    unrealizedPnlPercent,
    margin,
    liquidationPrice,
  }
}

/**
 * Updates a position with a new market/mark price.
 * Recalculates unrealized PnL, ROE %, and market value while preserving entryPrice and size.
 */
export function updatePositionWithMarkPrice(position: Position, markPrice: number): Position {
  if (!isFinite(markPrice) || markPrice <= 0) {
    return position
  }

  const metrics = calculatePositionMetrics(
    position.side,
    position.size,
    position.entryPrice,
    markPrice,
    position.leverage,
    position.maintenanceMargin ?? DEFAULT_MAINTENANCE_MARGIN_RATE
  )

  return {
    ...position,
    avgPrice: position.entryPrice,
    markPrice,
    marketValue: metrics.marketValue,
    unrealizedPnl: metrics.unrealizedPnl,
    unrealizedPnlPercent: metrics.unrealizedPnlPercent,
    margin: metrics.margin,
    liquidationPrice: metrics.liquidationPrice,
    updatedAt: Date.now(),
  }
}

/**
 * Selectively updates only positions whose symbols match incoming price ticks.
 * Unaffected positions maintain referential equality (===) to avoid React re-renders.
 */
export function updatePositionsFromMarketTicks(
  positions: Position[],
  tickerPrices: Record<string, number>
): { updatedPositions: Position[]; hasChanges: boolean } {
  let hasChanges = false

  const updatedPositions = positions.map((pos) => {
    const freshPrice = tickerPrices[pos.symbol]
    if (freshPrice !== undefined && freshPrice > 0 && freshPrice !== pos.markPrice) {
      hasChanges = true
      return updatePositionWithMarkPrice(pos, freshPrice)
    }
    return pos
  })

  return {
    updatedPositions: hasChanges ? updatedPositions : positions,
    hasChanges,
  }
}

/**
 * Calculates updated position and realized PnL when a trade execution or fill occurs.
 * Supports:
 * - Opening new position
 * - Increasing existing position (weighted average entry price)
 * - Reducing position (realizes PnL on closed portion, keeps entry price)
 * - Closing position entirely (returns null)
 * - Flipping position from LONG to SHORT or vice versa (realizes PnL and opens opposite side)
 */
export function recalculatePositionOnFill(
  existing: Position | undefined,
  symbol: string,
  fillSide: 'buy' | 'sell',
  fillQuantity: number,
  fillPrice: number,
  leverage: number = 20
): { updatedPosition: Position | null; realizedPnl: number } {
  if (fillQuantity <= 0 || fillPrice <= 0) {
    return { updatedPosition: existing || null, realizedPnl: 0 }
  }

  const orderSide: 'LONG' | 'SHORT' = fillSide === 'buy' ? 'LONG' : 'SHORT'

  // Case 1: No existing position -> Open brand new position
  if (!existing || existing.size <= 0) {
    const metrics = calculatePositionMetrics(orderSide, fillQuantity, fillPrice, fillPrice, leverage)
    const newPosition: Position = {
      id: `pos-${symbol.replace('/', '-').toLowerCase()}-${Date.now()}`,
      symbol,
      side: orderSide,
      size: fillQuantity,
      entryPrice: fillPrice,
      avgPrice: fillPrice,
      markPrice: fillPrice,
      marketValue: metrics.marketValue,
      unrealizedPnl: 0,
      unrealizedPnlPercent: 0,
      margin: metrics.margin,
      leverage,
      liquidationPrice: metrics.liquidationPrice,
      realizedPnl: 0,
      updatedAt: Date.now(),
    }
    return { updatedPosition: newPosition, realizedPnl: 0 }
  }

  // Case 2: Same direction -> Increase existing position with weighted average entry price
  if (existing.side === orderSide) {
    const totalSize = existing.size + fillQuantity
    const weightedAvgPrice = Number(
      ((existing.size * existing.entryPrice + fillQuantity * fillPrice) / totalSize).toFixed(2)
    )

    const metrics = calculatePositionMetrics(
      existing.side,
      totalSize,
      weightedAvgPrice,
      fillPrice,
      existing.leverage
    )

    const updated: Position = {
      ...existing,
      size: Number(totalSize.toFixed(4)),
      entryPrice: weightedAvgPrice,
      avgPrice: weightedAvgPrice,
      markPrice: fillPrice,
      marketValue: metrics.marketValue,
      unrealizedPnl: metrics.unrealizedPnl,
      unrealizedPnlPercent: metrics.unrealizedPnlPercent,
      margin: metrics.margin,
      liquidationPrice: metrics.liquidationPrice,
      updatedAt: Date.now(),
    }
    return { updatedPosition: updated, realizedPnl: 0 }
  }

  // Case 3: Opposite direction -> Reducing, closing, or flipping position
  const isClosingPortion = fillQuantity <= existing.size

  if (isClosingPortion) {
    const closedSize = fillQuantity
    const remainingSize = Number((existing.size - closedSize).toFixed(4))

    // Realized PnL on closed quantity
    let realizedPnl = 0
    if (existing.side === 'LONG') {
      realizedPnl = (fillPrice - existing.entryPrice) * closedSize
    } else {
      realizedPnl = (existing.entryPrice - fillPrice) * closedSize
    }
    realizedPnl = Number(realizedPnl.toFixed(2))

    if (remainingSize <= 0.00001) {
      // Fully closed
      return { updatedPosition: null, realizedPnl }
    }

    // Partially closed, entryPrice remains unchanged
    const metrics = calculatePositionMetrics(
      existing.side,
      remainingSize,
      existing.entryPrice,
      fillPrice,
      existing.leverage
    )

    const updated: Position = {
      ...existing,
      size: remainingSize,
      avgPrice: existing.entryPrice,
      markPrice: fillPrice,
      marketValue: metrics.marketValue,
      unrealizedPnl: metrics.unrealizedPnl,
      unrealizedPnlPercent: metrics.unrealizedPnlPercent,
      margin: metrics.margin,
      liquidationPrice: metrics.liquidationPrice,
      realizedPnl: Number(((existing.realizedPnl ?? 0) + realizedPnl).toFixed(2)),
      updatedAt: Date.now(),
    }
    return { updatedPosition: updated, realizedPnl }
  }

  // Case 4: Flipping position (fillQuantity > existing.size)
  // First realize PnL for the full existing size
  let realizedPnl = 0
  if (existing.side === 'LONG') {
    realizedPnl = (fillPrice - existing.entryPrice) * existing.size
  } else {
    realizedPnl = (existing.entryPrice - fillPrice) * existing.size
  }
  realizedPnl = Number(realizedPnl.toFixed(2))

  // Remaining quantity opens opposite side
  const flipSize = Number((fillQuantity - existing.size).toFixed(4))
  const newSide: 'LONG' | 'SHORT' = orderSide
  const metrics = calculatePositionMetrics(newSide, flipSize, fillPrice, fillPrice, existing.leverage)

  const flipped: Position = {
    id: `pos-${symbol.replace('/', '-').toLowerCase()}-${Date.now()}`,
    symbol,
    side: newSide,
    size: flipSize,
    entryPrice: fillPrice,
    avgPrice: fillPrice,
    markPrice: fillPrice,
    marketValue: metrics.marketValue,
    unrealizedPnl: 0,
    unrealizedPnlPercent: 0,
    margin: metrics.margin,
    leverage: existing.leverage,
    liquidationPrice: metrics.liquidationPrice,
    realizedPnl: Number(((existing.realizedPnl ?? 0) + realizedPnl).toFixed(2)),
    updatedAt: Date.now(),
  }

  return { updatedPosition: flipped, realizedPnl }
}
