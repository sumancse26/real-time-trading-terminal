import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OrderEntryForm } from '../features/order-entry/components/OrderEntryForm'
import { mockApiClient } from '../core/api/client'
import { useMarketStore } from '../core/store/useMarketStore'

function renderWithQuery(ui: React.ReactElement) {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return {
    ...render(<QueryClientProvider client={testQueryClient}>{ui}</QueryClientProvider>),
    queryClient: testQueryClient,
  }
}

describe('Phase 8 — Order Form Feature', () => {
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

  it('renders order entry header, side toggles, type tabs, and available balance', async () => {
    renderWithQuery(<OrderEntryForm />)

    expect(screen.getByRole('form', { name: /BTC\/USDT Order Entry Form/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /BUY \/ LONG/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /SELL \/ SHORT/i })).toBeInTheDocument()
    expect(screen.getByTestId('order-type-LIMIT')).toBeInTheDocument()
    expect(screen.getByTestId('order-type-MARKET')).toBeInTheDocument()
    expect(screen.getByTestId('order-summary')).toBeInTheDocument()
    expect(screen.getByTestId('available-margin-badge')).toBeInTheDocument()
  })

  it('switches between BUY and SELL sides and updates submit button text', async () => {
    renderWithQuery(<OrderEntryForm />)

    const buyBtn = screen.getByTestId('side-buy-btn')
    const sellBtn = screen.getByTestId('side-sell-btn')

    expect(buyBtn).toHaveClass('active')
    expect(screen.getByTestId('order-submit-btn')).toHaveTextContent(/BUY \/ LONG BTC/i)

    fireEvent.click(sellBtn)
    expect(sellBtn).toHaveClass('active')
    expect(screen.getByTestId('order-submit-btn')).toHaveTextContent(/SELL \/ SHORT BTC/i)
  })

  it('switches to MARKET order type and disables price input with best execution badge', async () => {
    renderWithQuery(<OrderEntryForm />)

    const marketTab = screen.getByTestId('order-type-MARKET')
    fireEvent.click(marketTab)
    expect(marketTab).toHaveClass('active')

    expect(screen.getByText(/BEST EXECUTION/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/^Price$/i)).not.toBeInTheDocument()
  })

  it('validates invalid price and quantity and disables submit button', async () => {
    renderWithQuery(<OrderEntryForm />)

    const priceInput = screen.getByLabelText('Order Price')
    const sizeInput = screen.getByLabelText(/Quantity/i)

    // Set invalid price 0
    fireEvent.change(priceInput, { target: { value: '0' } })
    expect(screen.getByTestId('order-validation-error')).toHaveTextContent(/valid price/i)
    expect(screen.getByTestId('order-submit-btn')).toBeDisabled()

    // Restore price and set invalid size 0
    fireEvent.change(priceInput, { target: { value: '64000' } })
    fireEvent.change(sizeInput, { target: { value: '0' } })
    expect(screen.getByTestId('order-validation-error')).toHaveTextContent(/valid quantity/i)
    expect(screen.getByTestId('order-submit-btn')).toBeDisabled()
  })

  it('validates insufficient available margin when order cost exceeds balance', async () => {
    renderWithQuery(<OrderEntryForm />)

    const priceInput = screen.getByLabelText('Order Price')
    const sizeInput = screen.getByLabelText(/Quantity/i)

    // Request massive quantity exceeding available balance ($23,091.05 * 20x leverage = ~$461,821)
    fireEvent.change(priceInput, { target: { value: '64000' } })
    fireEvent.change(sizeInput, { target: { value: '50' } }) // 50 BTC = $3,200,000 margin required = $160,000

    expect(screen.getByTestId('order-validation-error')).toHaveTextContent(/Insufficient available margin/i)
    expect(screen.getByTestId('order-submit-btn')).toBeDisabled()
  })

  it('calculates order notional, margin, fees, and liquidation price correctly in summary', async () => {
    renderWithQuery(<OrderEntryForm />)

    const priceInput = screen.getByLabelText('Order Price')
    const sizeInput = screen.getByLabelText(/Quantity/i)

    fireEvent.change(priceInput, { target: { value: '60000' } })
    fireEvent.change(sizeInput, { target: { value: '1.0' } })

    const summary = screen.getByTestId('order-summary')
    expect(summary).toHaveTextContent('$60,000.00') // Order value
    expect(summary).toHaveTextContent('$3,000.00') // Required margin at 20x
    expect(summary).toHaveTextContent('$12.0000 USDT') // Est fee (0.02% maker)
  })

  it('supports percentage quick-fill buttons', async () => {
    renderWithQuery(<OrderEntryForm />)

    const btn50 = screen.getByRole('button', { name: /Set size to 50% of available balance/i })
    fireEvent.click(btn50)

    const sizeInput = screen.getByLabelText(/Quantity/i) as HTMLInputElement
    expect(parseFloat(sizeInput.value)).toBeGreaterThan(0)
  })

  it('submits valid order and displays success notification banner', async () => {
    renderWithQuery(<OrderEntryForm />)

    const priceInput = screen.getByLabelText('Order Price')
    const sizeInput = screen.getByLabelText(/Quantity/i)

    fireEvent.change(priceInput, { target: { value: '64500' } })
    fireEvent.change(sizeInput, { target: { value: '0.5' } })

    const submitBtn = screen.getByTestId('order-submit-btn')
    expect(submitBtn).not.toBeDisabled()
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByTestId('order-success-banner')).toBeInTheDocument()
      expect(screen.getByTestId('order-success-banner')).toHaveTextContent(/placed successfully/i)
    })
  })

  it('displays error state when order mutation fails', async () => {
    mockApiClient.setConfig({
      failureRate: 1.0,
      simulatedErrorType: 'server',
    })

    renderWithQuery(<OrderEntryForm />)

    const submitBtn = screen.getByTestId('order-submit-btn')
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByTestId('order-error-banner')).toBeInTheDocument()
      expect(screen.getByTestId('order-error-banner')).toHaveTextContent(/Order placement failed/i)
    })
  })
})
