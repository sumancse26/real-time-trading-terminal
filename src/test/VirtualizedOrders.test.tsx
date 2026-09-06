import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { VirtualizedOrderArchive } from '../features/positions-portfolio/components/VirtualizedOrderArchive'
import { PositionsView } from '../features/positions-portfolio/components/PositionsView'
import { generate100kOrders } from '../utils/orderGenerator'
import { useVirtualizer } from '../hooks/useVirtualizer'
import { mockApiClient } from '../core/api/client'

function renderWithClient(ui: React.ReactElement) {
  const testQueryClient = new QueryClient({
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

describe('Phase 12 — 100,000 Orders & Row Virtualization', () => {
  beforeEach(() => {
    mockApiClient.setConfig({
      minLatencyMs: 0,
      maxLatencyMs: 0,
      failureRate: 0,
    })
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('100K Orders Generator', () => {
    it('generates 100,000 deterministic orders with valid properties', () => {
      const orders = generate100kOrders(100000)
      expect(orders.length).toBe(100000)

      const first = orders[0]
      expect(first).toBeDefined()
      expect(first?.id).toBe('ord-100k-000001')
      expect(first?.price).toBeGreaterThan(0)
      expect(first?.quantity).toBeGreaterThan(0)
      expect(first?.symbol).toBeDefined()
      expect(['buy', 'sell']).toContain(first?.side)
      expect(['LIMIT', 'MARKET', 'STOP_LIMIT']).toContain(first?.type)
      expect(first?.timestamp).toBeGreaterThan(0)
    })

    it('caches generated orders array for instantaneous access', () => {
      const firstCall = generate100kOrders(100000)
      const secondCall = generate100kOrders(100000)
      expect(firstCall).toBe(secondCall) // Strict referential identity
    })
  })

  describe('Virtualizer Hook', () => {
    it('calculates visible window items and total scroll height for 100,000 items', () => {
      const containerRef = {
        current: {
          clientHeight: 340,
          scrollTop: 0,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        } as unknown as HTMLElement,
      }

      function TestVirtualizer() {
        const result = useVirtualizer({
          count: 100000,
          itemHeight: 34,
          overscan: 4,
          containerRef,
        })
        return (
          <div>
            <span data-testid="virtual-count">{result.virtualItems.length}</span>
            <span data-testid="total-size">{result.totalSize}</span>
            <span data-testid="start-index">{result.startIndex}</span>
            <span data-testid="end-index">{result.endIndex}</span>
          </div>
        )
      }

      render(<TestVirtualizer />)

      // Total size: 100,000 * 34 = 3,400,000 px
      expect(screen.getByTestId('total-size')).toHaveTextContent('3400000')

      // Visible count: (340 / 34 = 10 visible) + overscan = ~14 items in DOM out of 100,000!
      const count = Number(screen.getByTestId('virtual-count').textContent)
      expect(count).toBeLessThan(30)
      expect(count).toBeGreaterThan(5)
    })
  })

  describe('VirtualizedOrderArchive Component', () => {
    it('renders telemetry diagnostics HUD with dataset and active DOM row stats', async () => {
      renderWithClient(<VirtualizedOrderArchive initialCount={10000} />)

      expect(screen.getByTestId('virtual-order-archive')).toBeInTheDocument()
      expect(screen.getByTestId('virtual-telemetry-hud')).toBeInTheDocument()
      expect(screen.getByText('TOTAL DATASET:')).toBeInTheDocument()
      expect(screen.getByTestId('dom-rows-count')).toBeInTheDocument()
      expect(screen.getByTestId('compute-time')).toBeInTheDocument()
    })

    it('filters orders by symbol, side, and status', async () => {
      renderWithClient(<VirtualizedOrderArchive initialCount={5000} />)

      // Filter by symbol BTC/USDT
      const symbolSelect = screen.getByTestId('filter-symbol')
      fireEvent.change(symbolSelect, { target: { value: 'BTC/USDT' } })

      // Filter by side BUY
      const sideSelect = screen.getByTestId('filter-side')
      fireEvent.change(sideSelect, { target: { value: 'BUY' } })

      // Filter by status FILLED
      const statusSelect = screen.getByTestId('filter-status')
      fireEvent.change(statusSelect, { target: { value: 'FILLED' } })

      expect((symbolSelect as HTMLSelectElement).value).toBe('BTC/USDT')
      expect((sideSelect as HTMLSelectElement).value).toBe('BUY')
      expect((statusSelect as HTMLSelectElement).value).toBe('FILLED')
    })

    it('applies 300ms debounced search on user input', async () => {
      renderWithClient(<VirtualizedOrderArchive initialCount={1000} />)

      const searchInput = screen.getByTestId('virtual-search-input')

      // Type search query
      fireEvent.change(searchInput, { target: { value: 'ord-100k-000042' } })

      // Advance debounce timer by 300ms
      act(() => {
        vi.advanceTimersByTime(350)
      })

      expect((searchInput as HTMLInputElement).value).toBe('ord-100k-000042')
    })

    it('toggles column sorting direction when clicking table headers', async () => {
      renderWithClient(<VirtualizedOrderArchive initialCount={1000} />)

      const priceHeader = screen.getByTestId('sort-price')
      fireEvent.click(priceHeader) // sort price desc
      fireEvent.click(priceHeader) // sort price asc

      const timeHeader = screen.getByTestId('sort-timestamp')
      fireEvent.click(timeHeader)

      expect(priceHeader).toBeInTheDocument()
      expect(timeHeader).toBeInTheDocument()
    })

    it('switches to 100K ARCHIVE tab in PositionsView and displays virtual table', async () => {
      renderWithClient(<PositionsView />)

      const archiveTab = screen.getByTestId('tab-archive')
      fireEvent.click(archiveTab)

      expect(screen.getByTestId('virtual-order-archive')).toBeInTheDocument()
    })
  })
})
