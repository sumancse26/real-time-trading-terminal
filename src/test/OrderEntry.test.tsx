import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { OrderEntryForm } from '../features/order-entry/components/OrderEntryForm'

describe('OrderEntryForm Feature', () => {
  it('allows entering orders and switches side between BUY and SELL', async () => {
    render(<OrderEntryForm />)

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

    await act(async () => {
      await new Promise(res => setTimeout(res, 250))
    })

    expect(screen.getByText(/Order placed: SELL 1.5 BTC @ \$65000/i)).toBeInTheDocument()
  })
})
