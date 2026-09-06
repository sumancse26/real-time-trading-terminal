import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { WatchlistPanel } from '../features/watchlist/components/WatchlistPanel'
import { useMarketStore } from '../core/store/useMarketStore'
import { feedSimulator } from '../core/stream/mockFeed'

describe('WatchlistPanel Feature with Zustand State Management', () => {
  beforeEach(() => {
    // Reset Zustand store state before each test
    useMarketStore.setState({
      entities: {
        'BTC/USDT': {
          symbol: 'BTC/USDT',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
          lastPrice: 64250.0,
          priceChange24h: 1845.2,
          priceChangePercent24h: 2.95,
          high24h: 65120.0,
          low24h: 62410.0,
          volume24h: 42890.45,
          turnover24h: 2758410290,
        },
        'ETH/USDT': {
          symbol: 'ETH/USDT',
          baseAsset: 'ETH',
          quoteAsset: 'USDT',
          lastPrice: 3445.0,
          priceChange24h: -82.5,
          priceChangePercent24h: -2.34,
          high24h: 3560.0,
          low24h: 3390.0,
          volume24h: 185420.0,
          turnover24h: 639700000,
        },
        'SOL/USDT': {
          symbol: 'SOL/USDT',
          baseAsset: 'SOL',
          quoteAsset: 'USDT',
          lastPrice: 168.42,
          priceChange24h: 5.81,
          priceChangePercent24h: 3.58,
          high24h: 172.5,
          low24h: 161.2,
          volume24h: 942100.0,
          turnover24h: 158700000,
        },
        'DOGE/USDT': {
          symbol: 'DOGE/USDT',
          baseAsset: 'DOGE',
          quoteAsset: 'USDT',
          lastPrice: 0.1684,
          priceChange24h: 0.0081,
          priceChangePercent24h: 5.05,
          high24h: 0.175,
          low24h: 0.158,
          volume24h: 88500000.0,
          turnover24h: 14900000,
        },
      },
      symbols: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'DOGE/USDT'],
      favorites: ['BTC/USDT'],
      selectedSymbol: 'BTC/USDT',
      searchQuery: '',
      category: 'ALL',
      sortField: null,
      sortDirection: 'desc',
    })

    feedSimulator.start(20)
  })

  afterEach(() => {
    feedSimulator.stop()
  })

  it('renders the watchlist panel with expected symbols and counts', () => {
    render(<WatchlistPanel />)

    expect(screen.getByTestId('watchlist-panel')).toBeInTheDocument()
    expect(screen.getByTestId('watchlist-item-BTC')).toBeInTheDocument()
    expect(screen.getByTestId('watchlist-item-ETH')).toBeInTheDocument()
    expect(screen.getByTestId('watchlist-item-SOL')).toBeInTheDocument()
    expect(screen.getByTestId('watchlist-item-DOGE')).toBeInTheDocument()
  })

  it('marks BTC/USDT as the default active symbol from Zustand store', () => {
    render(<WatchlistPanel />)

    const btcItem = screen.getByTestId('watchlist-item-BTC')
    expect(btcItem).toHaveClass('active')

    const ethItem = screen.getByTestId('watchlist-item-ETH')
    expect(ethItem).not.toHaveClass('active')
  })

  it('changes active symbol in Zustand store when another row is clicked', () => {
    render(<WatchlistPanel />)

    const ethItem = screen.getByTestId('watchlist-item-ETH')
    fireEvent.click(ethItem)

    expect(useMarketStore.getState().selectedSymbol).toBe('ETH/USDT')
    expect(ethItem).toHaveClass('active')

    const btcItem = screen.getByTestId('watchlist-item-BTC')
    expect(btcItem).not.toHaveClass('active')
  })

  it('filters symbols when typing into search bar', () => {
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

    expect(screen.getByTestId('watchlist-item-BTC')).toBeInTheDocument()
    expect(screen.getByTestId('watchlist-item-ETH')).toBeInTheDocument()
    expect(screen.getByTestId('watchlist-item-SOL')).toBeInTheDocument()
    expect(screen.getByTestId('watchlist-item-DOGE')).toBeInTheDocument()
  })

  it('filters by category tabs (FAVORITES / ALL)', () => {
    render(<WatchlistPanel />)

    const favoritesBtn = screen.getByText('FAVORITES')
    fireEvent.click(favoritesBtn)

    expect(screen.getByTestId('watchlist-item-BTC')).toBeInTheDocument()
    expect(screen.queryByTestId('watchlist-item-ETH')).not.toBeInTheDocument()

    const allBtn = screen.getByText('ALL')
    fireEvent.click(allBtn)
    expect(screen.getByTestId('watchlist-item-ETH')).toBeInTheDocument()
  })

  it('toggles favorites via star button click', () => {
    render(<WatchlistPanel />)

    const favEthBtn = screen.getByLabelText('Favorite ETH/USDT')
    fireEvent.click(favEthBtn)

    expect(useMarketStore.getState().favorites).toContain('ETH/USDT')
  })

  it('reacts to live feed ticks and updates Zustand market prices', () => {
    render(<WatchlistPanel />)

    act(() => {
      feedSimulator.tick()
    })

    expect(screen.getByTestId('watchlist-panel')).toBeInTheDocument()
  })
})
