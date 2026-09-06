import { mockApiClient } from './client'
import type { MarketTicker, TradeTick } from '@/types/market'
import type { OrderBookSnapshot } from '@/types/orderbook'
import type { Candle, KlineInterval } from '@/types/chart'
import type { SymbolInfo } from '@/types/symbol'

export const marketApi = {
  getTickers: (signal?: AbortSignal): Promise<MarketTicker[]> =>
    mockApiClient.getTickers(signal),

  getOrderBook: (
    symbol = 'BTC/USDT',
    limit = 15,
    signal?: AbortSignal
  ): Promise<OrderBookSnapshot> =>
    mockApiClient.getOrderBook(symbol, limit, signal),

  getRecentTrades: (
    symbol = 'BTC/USDT',
    limit = 20,
    signal?: AbortSignal
  ): Promise<TradeTick[]> =>
    mockApiClient.getRecentTrades(symbol, limit, signal),

  getKlines: (
    symbol = 'BTC/USDT',
    interval: KlineInterval = '1m',
    limit = 30,
    signal?: AbortSignal
  ): Promise<Candle[]> =>
    mockApiClient.getKlines(symbol, interval, limit, signal),

  getSymbols: (signal?: AbortSignal): Promise<SymbolInfo[]> =>
    mockApiClient.getSymbols(signal),
}
