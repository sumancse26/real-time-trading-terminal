import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TradesStreamView } from '@/features/trades-stream/components/TradesStreamView'
import { OrderEntryForm } from '@/features/order-entry/components/OrderEntryForm'
import { useMarketStore } from '@/core/store/useMarketStore'
import { calculateRiskAnalytics } from '@/core/analytics/riskCalculator'

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  )
}

describe('Phase 19 — Senior Code Review & Refactoring Tests', () => {
  beforeEach(() => {
    useMarketStore.setState({
      selectedSymbol: 'BTC/USDT',
    })
  })

  it('TradesStreamView dynamically reflects selected symbol assets in table headers', () => {
    const { rerender } = renderWithClient(<TradesStreamView />)

    expect(screen.getByText(/PRICE \(USDT\)/i)).toBeInTheDocument()
    expect(screen.getByText(/SIZE \(BTC\)/i)).toBeInTheDocument()

    act(() => {
      useMarketStore.getState().setSelectedSymbol('ETH/USDT')
    })

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <TradesStreamView />
      </QueryClientProvider>
    )

    expect(screen.getByText(/SIZE \(ETH\)/i)).toBeInTheDocument()

    act(() => {
      useMarketStore.getState().setSelectedSymbol('SOL/USDT')
    })

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <TradesStreamView />
      </QueryClientProvider>
    )

    expect(screen.getByText(/SIZE \(SOL\)/i)).toBeInTheDocument()
  })

  it('OrderEntryForm updates price when switching active symbol', () => {
    renderWithClient(<OrderEntryForm />)

    const priceInput = screen.getByLabelText(/limit price/i) as HTMLInputElement
    expect(Number(priceInput.value)).toBeGreaterThan(10000) // BTC price

    act(() => {
      useMarketStore.getState().setSelectedSymbol('SOL/USDT')
    })

    // SOL price is around ~168.42
    expect(Number(priceInput.value)).toBeLessThan(1000)
  })

  it('calculateRiskAnalytics handles edge-case simulationPaths safely without NaN or division by zero', () => {
    const result = calculateRiskAnalytics({
      positions: [],
      orders: [],
      simulationPaths: 0, // Edge case test
    })

    expect(result.computationDurationMs).toBeGreaterThanOrEqual(0)
    expect(Number.isFinite(result.orderAnalytics.sharpeRatio)).toBe(true)
    expect(Number.isFinite(result.orderAnalytics.sortinoRatio)).toBe(true)
    expect(result.varResults.length).toBeGreaterThan(0)
    expect(Number.isFinite(result.varResults[0]?.varAmount)).toBe(true)
  })
})
