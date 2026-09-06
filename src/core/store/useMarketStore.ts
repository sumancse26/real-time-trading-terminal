import { create } from 'zustand'
import type { MarketTicker } from '@/types/market'

export type WatchlistCategory = 'ALL' | 'PERP' | 'SPOT' | 'FAVORITES'
export type WatchlistSortField = 'symbol' | 'lastPrice' | 'priceChangePercent24h' | 'volume24h' | null
export type SortDirection = 'asc' | 'desc'

export interface MarketState {
  // Normalized ticker entities indexed by symbol string
  entities: Record<string, MarketTicker>
  symbols: string[]
  favorites: string[]
  selectedSymbol: string

  // Filter & sort state
  searchQuery: string
  category: WatchlistCategory
  sortField: WatchlistSortField
  sortDirection: SortDirection

  // Actions
  setSelectedSymbol: (symbol: string) => void
  setSearchQuery: (query: string) => void
  setCategory: (category: WatchlistCategory) => void
  setSort: (field: WatchlistSortField) => void
  toggleFavorite: (symbol: string) => void
  setTickers: (tickers: MarketTicker[]) => void
  updateTicker: (ticker: MarketTicker) => void
  updatePrice: (
    symbol: string,
    price: number,
    change24h?: number,
    changePercent24h?: number,
    high24h?: number,
    low24h?: number,
    volume24h?: number
  ) => void
  batchUpdatePrices: (
    updates: Array<{
      symbol: string
      price: number
      change24h?: number
      changePercent24h?: number
    }>
  ) => void
}

const INITIAL_TICKERS: MarketTicker[] = [
  {
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
  {
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
  {
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
  {
    symbol: 'BNB/USDT',
    baseAsset: 'BNB',
    quoteAsset: 'USDT',
    lastPrice: 608.3,
    priceChange24h: -12.1,
    priceChangePercent24h: -1.95,
    high24h: 625.0,
    low24h: 598.0,
    volume24h: 78500.0,
    turnover24h: 47750000,
  },
  {
    symbol: 'ARB/USDT',
    baseAsset: 'ARB',
    quoteAsset: 'USDT',
    lastPrice: 1.245,
    priceChange24h: 0.048,
    priceChangePercent24h: 4.01,
    high24h: 1.29,
    low24h: 1.18,
    volume24h: 14500000.0,
    turnover24h: 18050000,
  },
  {
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
]

const initialEntities: Record<string, MarketTicker> = {}
const initialSymbols: string[] = []

for (const ticker of INITIAL_TICKERS) {
  initialEntities[ticker.symbol] = ticker
  initialSymbols.push(ticker.symbol)
}

export const useMarketStore = create<MarketState>((set, get) => ({
  entities: initialEntities,
  symbols: initialSymbols,
  favorites: ['BTC/USDT', 'ETH/USDT'],
  selectedSymbol: 'BTC/USDT',

  searchQuery: '',
  category: 'ALL',
  sortField: null,
  sortDirection: 'desc',

  setSelectedSymbol: (symbol: string) => {
    if (get().selectedSymbol === symbol) return
    set({ selectedSymbol: symbol })
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query })
  },

  setCategory: (category: WatchlistCategory) => {
    set({ category })
  },

  setSort: (field: WatchlistSortField) => {
    set(state => {
      if (state.sortField === field) {
        if (state.sortDirection === 'desc') {
          return { sortDirection: 'asc' }
        }
        return { sortField: null, sortDirection: 'desc' }
      }
      return { sortField: field, sortDirection: 'desc' }
    })
  },

  toggleFavorite: (symbol: string) => {
    set(state => {
      const isFav = state.favorites.includes(symbol)
      return {
        favorites: isFav
          ? state.favorites.filter(s => s !== symbol)
          : [...state.favorites, symbol],
      }
    })
  },

  setTickers: (tickers: MarketTicker[]) => {
    set(state => {
      const entities = { ...state.entities }
      const symbols = [...state.symbols]

      for (const t of tickers) {
        entities[t.symbol] = t
        if (!symbols.includes(t.symbol)) {
          symbols.push(t.symbol)
        }
      }

      return { entities, symbols }
    })
  },

  updateTicker: (ticker: MarketTicker) => {
    set(state => {
      const existing = state.entities[ticker.symbol]
      if (
        existing &&
        existing.lastPrice === ticker.lastPrice &&
        existing.priceChangePercent24h === ticker.priceChangePercent24h &&
        existing.volume24h === ticker.volume24h
      ) {
        return state
      }

      return {
        entities: {
          ...state.entities,
          [ticker.symbol]: { ...existing, ...ticker },
        },
      }
    })
  },

  updatePrice: (
    symbol: string,
    price: number,
    change24h?: number,
    changePercent24h?: number,
    high24h?: number,
    low24h?: number,
    volume24h?: number
  ) => {
    set(state => {
      const current = state.entities[symbol]
      if (!current) return state

      const updated: MarketTicker = {
        ...current,
        lastPrice: price,
        priceChange24h: change24h !== undefined ? change24h : current.priceChange24h,
        priceChangePercent24h:
          changePercent24h !== undefined
            ? changePercent24h
            : current.priceChangePercent24h,
        high24h:
          high24h !== undefined
            ? high24h
            : Math.max(current.high24h, price),
        low24h:
          low24h !== undefined
            ? low24h
            : Math.min(current.low24h, price),
        volume24h:
          volume24h !== undefined ? volume24h : current.volume24h,
      }

      return {
        entities: {
          ...state.entities,
          [symbol]: updated,
        },
      }
    })
  },

  batchUpdatePrices: (updates: Array<{ symbol: string; price: number; change24h?: number; changePercent24h?: number }>) => {
    set(state => {
      const nextEntities = { ...state.entities }
      let hasChanges = false

      for (const u of updates) {
        const current = nextEntities[u.symbol]
        if (current) {
          hasChanges = true
          nextEntities[u.symbol] = {
            ...current,
            lastPrice: u.price,
            priceChange24h: u.change24h !== undefined ? u.change24h : current.priceChange24h,
            priceChangePercent24h:
              u.changePercent24h !== undefined
                ? u.changePercent24h
                : current.priceChangePercent24h,
          }
        }
      }

      return hasChanges ? { entities: nextEntities } : state
    })
  },
}))

// Atomic Stable Selectors for Render-Aware Fine-Grained Subscriptions

export const useSelectedSymbol = (): string =>
  useMarketStore(state => state.selectedSymbol)

export const useSelectedTicker = (): MarketTicker | undefined =>
  useMarketStore(state => state.entities[state.selectedSymbol])

export const useTicker = (symbol: string): MarketTicker | undefined =>
  useMarketStore(state => state.entities[symbol])

export const useIsFavorite = (symbol: string): boolean =>
  useMarketStore(state => state.favorites.includes(symbol))

export const useWatchlistSymbols = (): string[] =>
  useMarketStore(state => state.symbols)

export const useWatchlistSearchQuery = (): string =>
  useMarketStore(state => state.searchQuery)

export const useWatchlistCategoryState = (): WatchlistCategory =>
  useMarketStore(state => state.category)

export const useWatchlistSortField = (): WatchlistSortField =>
  useMarketStore(state => state.sortField)

export const useWatchlistSortDirection = (): SortDirection =>
  useMarketStore(state => state.sortDirection)
