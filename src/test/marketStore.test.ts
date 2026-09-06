import { describe, it, expect, beforeEach } from 'vitest'
import { useMarketStore } from '../core/store/useMarketStore'
import type { MarketTicker } from '../types/market'

describe('Zustand Market & Watchlist Store', () => {
  beforeEach(() => {
    // Reset store state
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
      },
      symbols: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
      favorites: ['BTC/USDT'],
      selectedSymbol: 'BTC/USDT',
      searchQuery: '',
      category: 'ALL',
      sortField: null,
      sortDirection: 'desc',
    })
  })

  it('normalizes entities and symbols', () => {
    const state = useMarketStore.getState()
    expect(state.symbols).toEqual(['BTC/USDT', 'ETH/USDT', 'SOL/USDT'])
    expect(state.entities['BTC/USDT']?.lastPrice).toBe(64250.0)
  })

  it('sets selected symbol', () => {
    useMarketStore.getState().setSelectedSymbol('ETH/USDT')
    expect(useMarketStore.getState().selectedSymbol).toBe('ETH/USDT')
  })

  it('toggles favorites', () => {
    useMarketStore.getState().toggleFavorite('ETH/USDT')
    expect(useMarketStore.getState().favorites).toContain('ETH/USDT')

    useMarketStore.getState().toggleFavorite('ETH/USDT')
    expect(useMarketStore.getState().favorites).not.toContain('ETH/USDT')
  })

  it('updates single ticker and calculates proper metrics', () => {
    const updatedTicker: MarketTicker = {
      symbol: 'BTC/USDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      lastPrice: 65000.0,
      priceChange24h: 2000.0,
      priceChangePercent24h: 3.17,
      high24h: 66000.0,
      low24h: 62410.0,
      volume24h: 45000.0,
      turnover24h: 2900000000,
    }

    useMarketStore.getState().updateTicker(updatedTicker)
    expect(useMarketStore.getState().entities['BTC/USDT']?.lastPrice).toBe(65000.0)
  })

  it('updates price via updatePrice action', () => {
    useMarketStore.getState().updatePrice('SOL/USDT', 175.5, 12.0, 7.3)
    const sol = useMarketStore.getState().entities['SOL/USDT']
    expect(sol?.lastPrice).toBe(175.5)
    expect(sol?.priceChange24h).toBe(12.0)
    expect(sol?.priceChangePercent24h).toBe(7.3)
    expect(sol?.high24h).toBe(175.5) // Auto updated high
  })

  it('batch updates multiple prices simultaneously', () => {
    useMarketStore.getState().batchUpdatePrices([
      { symbol: 'BTC/USDT', price: 64500.0 },
      { symbol: 'ETH/USDT', price: 3500.0 },
    ])

    expect(useMarketStore.getState().entities['BTC/USDT']?.lastPrice).toBe(64500.0)
    expect(useMarketStore.getState().entities['ETH/USDT']?.lastPrice).toBe(3500.0)
  })

  it('handles search query, categories, and sort state updates', () => {
    useMarketStore.getState().setSearchQuery('eth')
    expect(useMarketStore.getState().searchQuery).toBe('eth')

    useMarketStore.getState().setCategory('FAVORITES')
    expect(useMarketStore.getState().category).toBe('FAVORITES')

    useMarketStore.getState().setSort('lastPrice')
    expect(useMarketStore.getState().sortField).toBe('lastPrice')
    expect(useMarketStore.getState().sortDirection).toBe('desc')

    useMarketStore.getState().setSort('lastPrice')
    expect(useMarketStore.getState().sortDirection).toBe('asc')

    useMarketStore.getState().setSort('lastPrice')
    expect(useMarketStore.getState().sortField).toBeNull()
  })
})
