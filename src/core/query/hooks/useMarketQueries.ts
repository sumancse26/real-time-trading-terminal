import { useQuery } from '@tanstack/react-query'
import { marketApi } from '@/core/api/marketApi'
import type { KlineInterval } from '@/types/chart'

export const queryKeys = {
  market: {
    all: ['market'] as const,
    tickers: () => [...queryKeys.market.all, 'tickers'] as const,
    ticker: (symbol: string) => [...queryKeys.market.all, 'ticker', symbol] as const,
    orderBook: (symbol: string, limit?: number) =>
      [...queryKeys.market.all, 'orderBook', symbol, limit] as const,
    trades: (symbol: string, limit?: number) =>
      [...queryKeys.market.all, 'trades', symbol, limit] as const,
    klines: (symbol: string, interval: KlineInterval, limit?: number) =>
      [...queryKeys.market.all, 'klines', symbol, interval, limit] as const,
    symbols: () => [...queryKeys.market.all, 'symbols'] as const,
  },
  orders: {
    all: ['orders'] as const,
    open: (symbol?: string) => [...queryKeys.orders.all, 'open', symbol] as const,
  },
  positions: {
    all: ['positions'] as const,
    list: () => [...queryKeys.positions.all, 'list'] as const,
  },
  account: {
    all: ['account'] as const,
    summary: () => [...queryKeys.account.all, 'summary'] as const,
  },
}

export function useTickersQuery() {
  return useQuery({
    queryKey: queryKeys.market.tickers(),
    queryFn: ({ signal }) => marketApi.getTickers(signal),
  })
}

export function useOrderBookQuery(symbol: string, limit = 15) {
  return useQuery({
    queryKey: queryKeys.market.orderBook(symbol, limit),
    queryFn: ({ signal }) => marketApi.getOrderBook(symbol, limit, signal),
    enabled: Boolean(symbol),
  })
}

export function useRecentTradesQuery(symbol: string, limit = 20) {
  return useQuery({
    queryKey: queryKeys.market.trades(symbol, limit),
    queryFn: ({ signal }) => marketApi.getRecentTrades(symbol, limit, signal),
    enabled: Boolean(symbol),
  })
}

export function useKlinesQuery(symbol: string, interval: KlineInterval = '1m', limit = 30) {
  return useQuery({
    queryKey: queryKeys.market.klines(symbol, interval, limit),
    queryFn: ({ signal }) => marketApi.getKlines(symbol, interval, limit, signal),
    enabled: Boolean(symbol),
  })
}

export function useSymbolsQuery() {
  return useQuery({
    queryKey: queryKeys.market.symbols(),
    queryFn: ({ signal }) => marketApi.getSymbols(signal),
  })
}
