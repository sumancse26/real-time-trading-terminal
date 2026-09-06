import { mockApiClient } from './client'
import type { MarketTicker, TradeTick } from '@/types/market'
import type { OrderBookSnapshot } from '@/types/orderbook'
import type { Candle, KlineInterval, ChartTimeframe } from '@/types/chart'
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
    intervalOrTimeframe: KlineInterval | ChartTimeframe = '1D',
    limit = 35,
    signal?: AbortSignal
  ): Promise<Candle[]> =>
    mockApiClient.getKlines(symbol, intervalOrTimeframe, limit, signal),

  getSymbols: (signal?: AbortSignal): Promise<SymbolInfo[]> =>
    mockApiClient.getSymbols(signal),
}
