import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PositionsView } from '../features/positions-portfolio/components/PositionsView'
import { mockApiClient } from '../core/api/client'
import { useMarketStore } from '../core/store/useMarketStore'
import {
  calculatePositionMetrics,
  updatePositionWithMarkPrice,
  updatePositionsFromMarketTicks,
  recalculatePositionOnFill,
} from '../utils/positionCalculations'
import type { Position } from '../types/position'

function renderWithClient(ui: React.ReactElement, client?: QueryClient) {
  const testQueryClient =
    client ||
    new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    })

  return {
    ...render(<QueryClientProvider client={testQueryClient}>{ui}</QueryClientProvider>),
    queryClient: testQueryClient,
  }
}

describe('Phase 11 — Positions & P&L Calculation Engine', () => {
  beforeEach(() => {
    mockApiClient.setConfig({
      minLatencyMs: 0,
      maxLatencyMs: 0,
      failureRate: 0,
      simulatedErrorType: null,
    })
    useMarketStore.setState({
      selectedSymbol: 'BTC/USDT',
    })
  })

  describe('Financial Formulas (PnL, ROE %, Market Value, Liquidation)', () => {
    it('calculates LONG position PnL, ROE%, and market value accurately', () => {
      // 1 BTC Long entered at 60,000, current mark price 66,000, leverage 10x
      const metrics = calculatePositionMetrics('LONG', 1.0, 60000.0, 66000.0, 10)

      expect(metrics.marketValue).toBe(66000.0)
      expect(metrics.margin).toBe(6000.0) // 60,000 / 10
      expect(metrics.unrealizedPnl).toBe(6000.0) // (66,000 - 60,000) * 1.0
      expect(metrics.unrealizedPnlPercent).toBe(100.0) // (6000 / 6000) * 100%
      // Liq price: 60000 * (1 - 1/10 + 0.005) = 60000 * 0.905 = 54300
      expect(metrics.liquidationPrice).toBe(54300.0)
    })

    it('calculates SHORT position PnL, ROE%, and market value accurately', () => {
      // 10 ETH Short entered at 3,500, current mark price 3,150, leverage 20x
      const metrics = calculatePositionMetrics('SHORT', 10.0, 3500.0, 3150.0, 20)

      expect(metrics.marketValue).toBe(31500.0)
      expect(metrics.margin).toBe(1750.0) // (10 * 3500) / 20
      expect(metrics.unrealizedPnl).toBe(3500.0) // (3500 - 3150) * 10
      expect(metrics.unrealizedPnlPercent).toBe(200.0) // (3500 / 1750) * 100%
      // Liq price: 3500 * (1 + 1/20 - 0.005) = 3500 * 1.045 = 3657.5
      expect(metrics.liquidationPrice).toBe(3657.5)
    })

    it('handles negative PnL when position moves against market', () => {
      // Long entered at 100, drops to 80
      const longLoss = calculatePositionMetrics('LONG', 2.0, 100.0, 80.0, 5)
      expect(longLoss.unrealizedPnl).toBe(-40.0)
      expect(longLoss.unrealizedPnlPercent).toBe(-100.0)

      // Short entered at 100, rises to 120
      const shortLoss = calculatePositionMetrics('SHORT', 2.0, 100.0, 120.0, 5)
      expect(shortLoss.unrealizedPnl).toBe(-40.0)
      expect(shortLoss.unrealizedPnlPercent).toBe(-100.0)
    })

    it('safely handles edge cases: zero size, zero margin, extreme values', () => {
      const zeroSize = calculatePositionMetrics('LONG', 0, 50000, 55000, 10)
      expect(zeroSize.unrealizedPnl).toBe(0)
      expect(zeroSize.unrealizedPnlPercent).toBe(0)
      expect(zeroSize.marketValue).toBe(0)

      const zeroPrice = calculatePositionMetrics('LONG', 1, 0, 0, 10)
      expect(zeroPrice.margin).toBe(0)
      expect(zeroPrice.unrealizedPnlPercent).toBe(0)

      const negativePrice = updatePositionWithMarkPrice(
        {
          id: 'pos-1',
          symbol: 'BTC/USDT',
          side: 'LONG',
          size: 1,
          entryPrice: 60000,
          markPrice: 60000,
          liquidationPrice: 54000,
          unrealizedPnl: 0,
          unrealizedPnlPercent: 0,
          margin: 6000,
          leverage: 10,
        },
        -100
      )
      // Should ignore non-positive price and return original
      expect(negativePrice.markPrice).toBe(60000)
    })
  })

  describe('Selective Market Data Updates', () => {
    it('updates only positions whose symbols have incoming price ticks', () => {
      const btcPos: Position = {
        id: 'pos-btc',
        symbol: 'BTC/USDT',
        side: 'LONG',
        size: 1,
        entryPrice: 60000,
        markPrice: 60000,
        liquidationPrice: 54000,
        unrealizedPnl: 0,
        unrealizedPnlPercent: 0,
        margin: 6000,
        leverage: 10,
      }

      const ethPos: Position = {
        id: 'pos-eth',
        symbol: 'ETH/USDT',
        side: 'SHORT',
        size: 5,
        entryPrice: 3500,
        markPrice: 3500,
        liquidationPrice: 3675,
        unrealizedPnl: 0,
        unrealizedPnlPercent: 0,
        margin: 875,
        leverage: 20,
      }

      const positions = [btcPos, ethPos]

      // Market tick arrives ONLY for BTC/USDT
      const { updatedPositions, hasChanges } = updatePositionsFromMarketTicks(positions, {
        'BTC/USDT': 63000,
      })

      expect(hasChanges).toBe(true)
      expect(updatedPositions[0]!.markPrice).toBe(63000)
      expect(updatedPositions[0]!.unrealizedPnl).toBe(3000)

      // ETH position was unaffected and remains referentially identical
      expect(updatedPositions[1]!).toBe(ethPos)
    })
  })

  describe('Position Lifecycle on Trade Fills', () => {
    it('opens a new position when none exists', () => {
      const result = recalculatePositionOnFill(undefined, 'BTC/USDT', 'buy', 0.5, 64000, 10)
      expect(result.updatedPosition).not.toBeNull()
      expect(result.updatedPosition?.side).toBe('LONG')
      expect(result.updatedPosition?.size).toBe(0.5)
      expect(result.updatedPosition?.entryPrice).toBe(64000)
      expect(result.realizedPnl).toBe(0)
    })

    it('calculates weighted average entry price when increasing an existing position', () => {
      const existing: Position = {
        id: 'pos-1',
        symbol: 'BTC/USDT',
        side: 'LONG',
        size: 1.0,
        entryPrice: 60000.0,
        markPrice: 60000.0,
        liquidationPrice: 54000.0,
        unrealizedPnl: 0,
        unrealizedPnlPercent: 0,
        margin: 6000.0,
        leverage: 10,
      }

      // Add 1.0 BTC at 66,000 -> New average price should be (60,000 + 66,000) / 2 = 63,000
      const result = recalculatePositionOnFill(existing, 'BTC/USDT', 'buy', 1.0, 66000.0, 10)
      expect(result.updatedPosition?.size).toBe(2.0)
      expect(result.updatedPosition?.entryPrice).toBe(63000.0)
      expect(result.realizedPnl).toBe(0)
    })

    it('realizes PnL when partially closing an existing position', () => {
      const existing: Position = {
        id: 'pos-1',
        symbol: 'BTC/USDT',
        side: 'LONG',
        size: 2.0,
        entryPrice: 60000.0,
        markPrice: 65000.0,
        liquidationPrice: 54000.0,
        unrealizedPnl: 10000.0,
        unrealizedPnlPercent: 83.33,
        margin: 12000.0,
        leverage: 10,
      }

      // Sell 1.0 BTC at 65,000 -> Realize PnL = (65,000 - 60,000) * 1.0 = +$5,000
      const result = recalculatePositionOnFill(existing, 'BTC/USDT', 'sell', 1.0, 65000.0, 10)
      expect(result.updatedPosition?.size).toBe(1.0)
      expect(result.updatedPosition?.entryPrice).toBe(60000.0) // entry price intact
      expect(result.realizedPnl).toBe(5000.0)
    })

    it('fully closes position when fill size equals position size', () => {
      const existing: Position = {
        id: 'pos-1',
        symbol: 'BTC/USDT',
        side: 'LONG',
        size: 1.0,
        entryPrice: 60000.0,
        markPrice: 62000.0,
        liquidationPrice: 54000.0,
        unrealizedPnl: 2000.0,
        unrealizedPnlPercent: 33.33,
        margin: 6000.0,
        leverage: 10,
      }

      const result = recalculatePositionOnFill(existing, 'BTC/USDT', 'sell', 1.0, 62000.0, 10)
      expect(result.updatedPosition).toBeNull()
      expect(result.realizedPnl).toBe(2000.0)
    })

    it('flips position from LONG to SHORT when fill size exceeds position size', () => {
      const existing: Position = {
        id: 'pos-1',
        symbol: 'BTC/USDT',
        side: 'LONG',
        size: 1.0,
        entryPrice: 60000.0,
        markPrice: 65000.0,
        liquidationPrice: 54000.0,
        unrealizedPnl: 5000.0,
        unrealizedPnlPercent: 83.33,
        margin: 6000.0,
        leverage: 10,
      }

      // Sell 3.0 BTC at 65,000 -> Realize $5,000 on 1 BTC Long, open 2 BTC Short at 65,000
      const result = recalculatePositionOnFill(existing, 'BTC/USDT', 'sell', 3.0, 65000.0, 10)
      expect(result.realizedPnl).toBe(5000.0)
      expect(result.updatedPosition?.side).toBe('SHORT')
      expect(result.updatedPosition?.size).toBe(2.0)
      expect(result.updatedPosition?.entryPrice).toBe(65000.0)
    })
  })

  describe('PositionsView Live Subscription & Actions', () => {
    it('renders positions table with contract, size, entry, mark price, and value', async () => {
      renderWithClient(<PositionsView />)

      await waitFor(() => {
        expect(screen.getByTestId('positions-table')).toBeInTheDocument()
        expect(screen.getByText('BTC/USDT')).toBeInTheDocument()
        expect(screen.getByText('ETH/USDT')).toBeInTheDocument()
      })
    })

    it('selectively updates position mark price when store ticker emits price update', async () => {
      renderWithClient(<PositionsView />)

      await waitFor(() => {
        expect(screen.getByTestId('pos-row-BTC/USDT')).toBeInTheDocument()
      })

      // Emit new price for BTC/USDT in market store
      act(() => {
        useMarketStore.getState().updatePrice('BTC/USDT', 68000.0)
      })

      await waitFor(() => {
        const btcRow = screen.getByTestId('pos-row-BTC/USDT')
        expect(btcRow).toHaveTextContent('$68,000.00')
      })
    })

    it('closes a position when Market Close button is clicked', async () => {
      renderWithClient(<PositionsView />)

      await waitFor(() => {
        expect(screen.getByTestId('pos-row-BTC/USDT')).toBeInTheDocument()
      })

      const btcRow = screen.getByTestId('pos-row-BTC/USDT')
      const closeBtn = btcRow.querySelector('.btn-close-pos')
      expect(closeBtn).toBeDefined()

      fireEvent.click(closeBtn!)

      await waitFor(() => {
        expect(screen.queryByTestId('pos-row-BTC/USDT')).not.toBeInTheDocument()
      })
    })
  })
})
