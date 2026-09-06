import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { OrderBookView } from '../features/order-book/components/OrderBookView'
import { feedSimulator } from '../core/stream/mockFeed'

describe('OrderBookView Feature', () => {
  beforeEach(() => {
    feedSimulator.start(20)
  })

  afterEach(() => {
    feedSimulator.stop()
  })

  it('renders order book ladder and spread calculation after ticks', () => {
    render(<OrderBookView />)

    // Trigger deterministic tick
    act(() => {
      feedSimulator.tick()
    })

    expect(screen.getByTestId('order-book-view')).toBeInTheDocument()
    expect(screen.getByText('PRICE (USDT)')).toBeInTheDocument()
    expect(screen.getByText('SIZE (BTC)')).toBeInTheDocument()
    expect(screen.getByText('TOTAL (BTC)')).toBeInTheDocument()
    expect(screen.getByText('Spread')).toBeInTheDocument()
  })
})
