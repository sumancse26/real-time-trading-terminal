import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TradingChartPlaceholder } from '../features/chart/components/TradingChartPlaceholder'
import { useMarketStore } from '../core/store/useMarketStore'
import { mockApiClient } from '../core/api/client'

function renderWithClient(ui: React.ReactElement, client?: QueryClient) {
  const queryClient =
    client ??
    new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

  return {
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
    queryClient,
  }
}

describe('Phase 7 — Trading Chart Feature', () => {
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

  afterEach(() => {
    mockApiClient.setConfig({
      minLatencyMs: 0,
      maxLatencyMs: 0,
      failureRate: 0,
      simulatedErrorType: null,
    })
  })

  it('renders chart title, timeframe controls, indicator toggles, and OHLC HUD', async () => {
    renderWithClient(<TradingChartPlaceholder />)

    expect(screen.getByTestId('trading-chart')).toBeInTheDocument()
    expect(screen.getByText('BTC/USDT PERPETUAL')).toBeInTheDocument()
    expect(screen.getByTestId('chart-timeframe-group')).toBeInTheDocument()
    expect(screen.getByTestId('timeframe-1D')).toBeInTheDocument()
    expect(screen.getByTestId('timeframe-1W')).toBeInTheDocument()
    expect(screen.getByTestId('timeframe-1M')).toBeInTheDocument()
    expect(screen.getByTestId('timeframe-3M')).toBeInTheDocument()
    expect(screen.getByTestId('timeframe-1Y')).toBeInTheDocument()

    // Wait for candles to load
    await waitFor(() => {
      expect(screen.getByTestId('chart-svg')).toBeInTheDocument()
    })

    expect(screen.getByTestId('chart-hud')).toBeInTheDocument()
    expect(screen.getByTestId('live-price-tag')).toBeInTheDocument()
    expect(screen.getByTestId('volume-subchart')).toBeInTheDocument()
  })

  it('switches timeframe when clicking 1D / 1W / 1M / 3M / 1Y buttons', async () => {
    renderWithClient(<TradingChartPlaceholder />)

    const btn1W = screen.getByTestId('timeframe-1W')
    fireEvent.click(btn1W)
    expect(btn1W).toHaveClass('active')

    await waitFor(() => {
      expect(screen.getByTestId('chart-svg')).toBeInTheDocument()
    })

    const btn1M = screen.getByTestId('timeframe-1M')
    fireEvent.click(btn1M)
    expect(btn1M).toHaveClass('active')

    const btn1Y = screen.getByTestId('timeframe-1Y')
    fireEvent.click(btn1Y)
    expect(btn1Y).toHaveClass('active')
  })

  it('integrates live ticker price updates into the active candle', async () => {
    renderWithClient(<TradingChartPlaceholder />)

    await waitFor(() => {
      expect(screen.getByTestId('chart-svg')).toBeInTheDocument()
    })

    // Update store with new live ticker price
    act(() => {
      useMarketStore.getState().updatePrice('BTC/USDT', 67890.5)
    })

    await waitFor(() => {
      expect(screen.getByTestId('live-price-tag')).toHaveTextContent('$67,890.50')
    })
  })

  it('toggles indicators on and off', async () => {
    renderWithClient(<TradingChartPlaceholder />)

    await waitFor(() => {
      expect(screen.getByTestId('chart-svg')).toBeInTheDocument()
    })

    const volBtn = screen.getByTestId('indicator-VOL')
    expect(volBtn).toHaveClass('active')

    // Toggle off
    fireEvent.click(volBtn)
    expect(volBtn).not.toHaveClass('active')
    expect(screen.queryByTestId('volume-subchart')).not.toBeInTheDocument()

    // Toggle back on
    fireEvent.click(volBtn)
    expect(volBtn).toHaveClass('active')
    expect(screen.getByTestId('volume-subchart')).toBeInTheDocument()
  })

  it('displays error state with retry button when query fails', async () => {
    mockApiClient.setConfig({
      failureRate: 1.0,
      simulatedErrorType: 'network',
    })

    renderWithClient(<TradingChartPlaceholder />)

    await waitFor(() => {
      expect(screen.getByTestId('chart-error')).toBeInTheDocument()
    })

    expect(screen.getByText('Failed to load chart candles')).toBeInTheDocument()
    expect(screen.getByTestId('chart-retry-btn')).toBeInTheDocument()

    // Fix error condition and click retry
    mockApiClient.setConfig({
      failureRate: 0,
      simulatedErrorType: null,
    })

    fireEvent.click(screen.getByTestId('chart-retry-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('chart-svg')).toBeInTheDocument()
    })
  })
})
