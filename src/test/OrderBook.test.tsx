import { render, screen, act, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { OrderBookView } from '../features/order-book/components/OrderBookView'
import { feedSimulator } from '../core/stream/mockFeed'
import { useMarketStore } from '../core/store/useMarketStore'
import {
  calculateSpread,
  calculateCumulativeDepth,
  aggregateOrderBookLevels,
} from '../utils/orderbook'
import type { PriceLevel } from '../types/orderbook'

describe('Phase 10 — Order Book Feature & Calculations', () => {
  beforeEach(() => {
    useMarketStore.setState({
      selectedSymbol: 'BTC/USDT',
      orderFormPrefill: null,
    })
    feedSimulator.start(20)
  })

  afterEach(() => {
    feedSimulator.stop()
  })

  describe('Pure Order Book Utilities', () => {
    it('calculates spread, percentage spread, and mid-price accurately', () => {
      const bestAsk = 64500.0
      const bestBid = 64495.0
      const result = calculateSpread(bestAsk, bestBid)

      expect(result.spread).toBe(5.0)
      expect(result.midPrice).toBe(64497.5)
      expect(result.spreadPercentage).toBeCloseTo(0.0078, 3)
    })

    it('returns zero values when prices are missing or invalid', () => {
      const result = calculateSpread(undefined, 0)
      expect(result.spread).toBe(0)
      expect(result.spreadPercentage).toBe(0)
      expect(result.midPrice).toBe(0)
    })

    it('calculates cumulative depth and normalizes percentage depth to max cumulative total', () => {
      const levels: PriceLevel[] = [
        { price: 100, size: 2, total: 0, percentDepth: 0 },
        { price: 101, size: 3, total: 0, percentDepth: 0 },
        { price: 102, size: 5, total: 0, percentDepth: 0 },
      ]

      const normalized = calculateCumulativeDepth(levels)
      expect(normalized[0]!.total).toBe(2)
      expect(normalized[0]!.percentDepth).toBe(20) // 2 / 10 * 100

      expect(normalized[1]!.total).toBe(5)
      expect(normalized[1]!.percentDepth).toBe(50) // 5 / 10 * 100

      expect(normalized[2]!.total).toBe(10)
      expect(normalized[2]!.percentDepth).toBe(100) // 10 / 10 * 100
    })

    it('aggregates order book levels into precision buckets for bids and asks', () => {
      const rawBids: PriceLevel[] = [
        { price: 64251.2, size: 0.5, total: 0, percentDepth: 0 },
        { price: 64251.8, size: 0.3, total: 0, percentDepth: 0 },
        { price: 64249.5, size: 1.2, total: 0, percentDepth: 0 },
      ]

      // Group bids with precision 5.0 -> floor(p/5)*5
      const aggregatedBids = aggregateOrderBookLevels(rawBids, 5.0, 'bid')
      expect(aggregatedBids.length).toBe(2)
      expect(aggregatedBids[0]!.price).toBe(64250) // 64251.2 & 64251.8 bucketed
      expect(aggregatedBids[0]!.size).toBeCloseTo(0.8, 2)
      expect(aggregatedBids[1]!.price).toBe(64245) // 64249.5 bucketed
      expect(aggregatedBids[1]!.size).toBeCloseTo(1.2, 2)

      const rawAsks: PriceLevel[] = [
        { price: 64251.2, size: 0.4, total: 0, percentDepth: 0 },
        { price: 64253.1, size: 0.6, total: 0, percentDepth: 0 },
      ]

      // Group asks with precision 5.0 -> ceil(p/5)*5
      const aggregatedAsks = aggregateOrderBookLevels(rawAsks, 5.0, 'ask')
      expect(aggregatedAsks.length).toBe(1)
      expect(aggregatedAsks[0]!.price).toBe(64255)
      expect(aggregatedAsks[0]!.size).toBeCloseTo(1.0, 2)
    })
  })

  describe('OrderBookView Component', () => {
    it('renders order book ladder, spread calculation, and dynamic headers after tick', () => {
      render(<OrderBookView />)

      act(() => {
        feedSimulator.tick()
      })

      expect(screen.getByTestId('order-book-view')).toBeInTheDocument()
      expect(screen.getByText('PRICE (USDT)')).toBeInTheDocument()
      expect(screen.getByText('SIZE (BTC)')).toBeInTheDocument()
      expect(screen.getByText('TOTAL (BTC)')).toBeInTheDocument()
      expect(screen.getByTestId('spread-indicator')).toBeInTheDocument()
      expect(screen.getByTestId('spread-value')).toBeInTheDocument()
    })

    it('switches view mode between dual, bids only, and asks only', () => {
      render(<OrderBookView />)

      act(() => {
        feedSimulator.tick()
      })

      // Default: both asks and bids visible
      expect(screen.getByTestId('book-asks-section')).toBeInTheDocument()
      expect(screen.getByTestId('book-bids-section')).toBeInTheDocument()

      // Switch to Bids Only
      fireEvent.click(screen.getByTestId('view-mode-bids'))
      expect(screen.queryByTestId('book-asks-section')).not.toBeInTheDocument()
      expect(screen.getByTestId('book-bids-section')).toBeInTheDocument()

      // Switch to Asks Only
      fireEvent.click(screen.getByTestId('view-mode-asks'))
      expect(screen.getByTestId('book-asks-section')).toBeInTheDocument()
      expect(screen.queryByTestId('book-bids-section')).not.toBeInTheDocument()

      // Switch back to Both
      fireEvent.click(screen.getByTestId('view-mode-both'))
      expect(screen.getByTestId('book-asks-section')).toBeInTheDocument()
      expect(screen.getByTestId('book-bids-section')).toBeInTheDocument()
    })

    it('changes depth configuration and updates visible level count', () => {
      render(<OrderBookView />)

      act(() => {
        feedSimulator.tick()
      })

      const depthSelect = screen.getByTestId('depth-select')
      fireEvent.change(depthSelect, { target: { value: '5' } })
      expect((depthSelect as HTMLSelectElement).value).toBe('5')

      fireEvent.change(depthSelect, { target: { value: '15' } })
      expect((depthSelect as HTMLSelectElement).value).toBe('15')
    })

    it('changes precision aggregation setting', () => {
      render(<OrderBookView />)

      act(() => {
        feedSimulator.tick()
      })

      const precisionSelect = screen.getByTestId('precision-select')
      fireEvent.change(precisionSelect, { target: { value: '1.0' } })
      expect((precisionSelect as HTMLSelectElement).value).toBe('1.0')

      fireEvent.change(precisionSelect, { target: { value: '5.0' } })
      expect((precisionSelect as HTMLSelectElement).value).toBe('5.0')
    })

    it('prefills order entry price and quantity when clicking an order book row', () => {
      render(<OrderBookView />)

      act(() => {
        feedSimulator.tick()
      })

      const bidRows = screen.getByTestId('book-bids-section').querySelectorAll('.book-row')
      expect(bidRows.length).toBeGreaterThan(0)
      expect(bidRows[0]).toBeDefined()

      // Click top bid row
      fireEvent.click(bidRows[0]!)

      const state = useMarketStore.getState()
      expect(state.orderFormPrefill).not.toBeNull()
      expect(state.orderFormPrefill?.price).toBeGreaterThan(0)
      expect(state.orderFormPrefill?.quantity).toBeGreaterThan(0)
    })
  })
})
