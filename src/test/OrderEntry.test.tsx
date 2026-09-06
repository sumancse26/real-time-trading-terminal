import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OrderEntryForm } from '../features/order-entry/components/OrderEntryForm'
import { mockApiClient } from '../core/api/client'

function renderWithQuery(ui: React.ReactElement) {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(<QueryClientProvider client={testQueryClient}>{ui}</QueryClientProvider>)
}

describe('OrderEntryForm Feature', () => {
  beforeEach(() => {
    mockApiClient.setConfig({ minLatencyMs: 0, maxLatencyMs: 0 })
  })

  it('allows entering orders and switches side between BUY and SELL', async () => {
    renderWithQuery(<OrderEntryForm />)

    const buyTab = screen.getByRole('button', { name: /^BUY \/ LONG$/i })
    const sellTab = screen.getByRole('button', { name: /^SELL \/ SHORT$/i })

    expect(buyTab).toHaveClass('active')

    fireEvent.click(sellTab)
    expect(sellTab).toHaveClass('active')

    const priceInput = screen.getByLabelText('Price')
    const sizeInput = screen.getByLabelText('Size')

    fireEvent.change(priceInput, { target: { value: '65000' } })
    fireEvent.change(sizeInput, { target: { value: '1.5' } })

    expect((priceInput as HTMLInputElement).value).toBe('65000')
    expect((sizeInput as HTMLInputElement).value).toBe('1.5')

    const submitBtn = screen.getByRole('button', { name: /SELL \/ SHORT BTC/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText(/Order submitted: SELL 1.5 BTC/i)).toBeInTheDocument()
    })
  })
})
