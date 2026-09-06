import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { WatchlistPanel } from '../features/watchlist/components/WatchlistPanel'
import { feedSimulator } from '../core/stream/mockFeed'

describe('WatchlistPanel Feature', () => {
  beforeEach(() => {
    feedSimulator.start(50)
  })

  afterEach(() => {
    feedSimulator.stop()
  })

  it('renders the watchlist panel with expected symbols', () => {
    render(<WatchlistPanel />)

    expect(screen.getByTestId('watchlist-panel')).toBeInTheDocument()
    expect(screen.getByTestId('watchlist-item-BTC')).toBeInTheDocument()
    expect(screen.getByTestId('watchlist-item-ETH')).toBeInTheDocument()
    expect(screen.getByTestId('watchlist-item-SOL')).toBeInTheDocument()
  })

  it('marks BTC/USDT as the default active symbol', () => {
    render(<WatchlistPanel />)

    const btcItem = screen.getByTestId('watchlist-item-BTC')
    expect(btcItem).toHaveClass('active')

    const ethItem = screen.getByTestId('watchlist-item-ETH')
    expect(ethItem).not.toHaveClass('active')
  })

  it('changes active symbol when another row is clicked', () => {
    render(<WatchlistPanel />)

    const ethItem = screen.getByTestId('watchlist-item-ETH')
    fireEvent.click(ethItem)
    expect(ethItem).toHaveClass('active')

    const btcItem = screen.getByTestId('watchlist-item-BTC')
    expect(btcItem).not.toHaveClass('active')
  })

  it('filters symbols when searching', () => {
    render(<WatchlistPanel />)

    const searchInput = screen.getByLabelText('Search symbols')
    fireEvent.change(searchInput, { target: { value: 'sol' } })

    expect(screen.getByTestId('watchlist-item-SOL')).toBeInTheDocument()
    expect(screen.queryByTestId('watchlist-item-BTC')).not.toBeInTheDocument()
  })

  it('shows all symbols when search is cleared', () => {
    render(<WatchlistPanel />)

    const searchInput = screen.getByLabelText('Search symbols')
    fireEvent.change(searchInput, { target: { value: 'btc' } })
    fireEvent.change(searchInput, { target: { value: '' } })

    // All 6 symbols should be back
    expect(screen.getByTestId('watchlist-item-BTC')).toBeInTheDocument()
    expect(screen.getByTestId('watchlist-item-ETH')).toBeInTheDocument()
    expect(screen.getByTestId('watchlist-item-DOGE')).toBeInTheDocument()
  })
})
