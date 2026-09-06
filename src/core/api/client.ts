import {
  ApiError,
  NetworkError,
  RateLimitError,
  ValidationError,
  RequestAbortedError,
} from './errors'
import type { MarketTicker, TradeTick } from '@/types/market'
import type { OrderBookSnapshot, PriceLevel } from '@/types/orderbook'
import type { Candle, KlineInterval, ChartTimeframe } from '@/types/chart'
import type { ActiveOrder, CreateOrderRequest, CancelOrderRequest } from '@/types/order'
import type { Position } from '@/types/position'
import type { AccountSummary } from '@/types/account'
import type { SymbolInfo } from '@/types/symbol'

export interface MockClientConfig {
  minLatencyMs?: number
  maxLatencyMs?: number
  failureRate?: number // 0.0 to 1.0
  simulatedErrorType?: 'network' | 'rateLimit' | 'server' | 'validation' | null
}

export class MockHttpClient {
  private minLatency: number
  private maxLatency: number
  private failureRate: number
  private simulatedErrorType: 'network' | 'rateLimit' | 'server' | 'validation' | null
  private latestRequestSequences: Map<string, number> = new Map()
  private requestCounter = 0

  // In-memory mock store
  private orders: ActiveOrder[] = [
    {
      id: 'ord-101',
      symbol: 'BTC/USDT',
      side: 'buy',
      type: 'LIMIT',
      price: 63500.0,
      quantity: 0.5,
      filledQuantity: 0.0,
      status: 'NEW',
      timestamp: 1717000000000,
    },
    {
      id: 'ord-102',
      symbol: 'BTC/USDT',
      side: 'sell',
      type: 'STOP_LIMIT',
      price: 65800.0,
      quantity: 0.75,
      filledQuantity: 0.0,
      status: 'NEW',
      timestamp: 1717000050000,
    },
  ]

  private orderHistory: ActiveOrder[] = [
    {
      id: 'ord-hist-99',
      symbol: 'BTC/USDT',
      side: 'buy',
      type: 'LIMIT',
      price: 63100.0,
      quantity: 1.0,
      filledQuantity: 1.0,
      status: 'FILLED',
      timestamp: 1716900000000,
    },
    {
      id: 'ord-hist-98',
      symbol: 'ETH/USDT',
      side: 'sell',
      type: 'MARKET',
      price: 3510.0,
      quantity: 4.0,
      filledQuantity: 4.0,
      status: 'FILLED',
      timestamp: 1716890000000,
    },
    {
      id: 'ord-hist-97',
      symbol: 'SOL/USDT',
      side: 'buy',
      type: 'LIMIT',
      price: 155.0,
      quantity: 20.0,
      filledQuantity: 0.0,
      status: 'CANCELLED',
      timestamp: 1716880000000,
    },
  ]

  private recentOrderSignatures = new Map<string, number>()

  private positions: Position[] = [
    {
      id: 'pos-1',
      symbol: 'BTC/USDT',
      side: 'LONG',
      size: 0.75,
      entryPrice: 63820.0,
      markPrice: 64250.0,
      liquidationPrice: 60950.0,
      unrealizedPnl: 322.5,
      unrealizedPnlPercent: 13.48,
      margin: 2393.25,
      leverage: 20,
    },
    {
      id: 'pos-2',
      symbol: 'ETH/USDT',
      side: 'SHORT',
      size: 8.5,
      entryPrice: 3490.0,
      markPrice: 3445.0,
      liquidationPrice: 3680.0,
      unrealizedPnl: 382.5,
      unrealizedPnlPercent: 12.89,
      margin: 2966.5,
      leverage: 10,
    },
  ]

  constructor(config: MockClientConfig = {}) {
    this.minLatency = config.minLatencyMs ?? 40
    this.maxLatency = config.maxLatencyMs ?? 120
    this.failureRate = config.failureRate ?? 0
    this.simulatedErrorType = config.simulatedErrorType ?? null
  }

  public setConfig(config: Partial<MockClientConfig>) {
    if (config.minLatencyMs !== undefined) this.minLatency = config.minLatencyMs
    if (config.maxLatencyMs !== undefined) this.maxLatency = config.maxLatencyMs
    if (config.failureRate !== undefined) this.failureRate = config.failureRate
    if (config.simulatedErrorType !== undefined) this.simulatedErrorType = config.simulatedErrorType
  }

  /**
   * Simulates network latency with cancellation support and race condition protection.
   */
  private async simulateNetwork(
    endpointKey?: string,
    signal?: AbortSignal
  ): Promise<number> {
    if (signal?.aborted) {
      throw new RequestAbortedError()
    }

    const currentSequence = ++this.requestCounter
    if (endpointKey) {
      this.latestRequestSequences.set(endpointKey, currentSequence)
    }

    const latency =
      this.minLatency + Math.floor(Math.random() * (this.maxLatency - this.minLatency + 1))

    if (latency > 0) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          if (signal?.aborted) {
            reject(new RequestAbortedError())
          } else {
            resolve()
          }
        }, latency)

        signal?.addEventListener('abort', () => {
          clearTimeout(timer)
          reject(new RequestAbortedError())
        })
      })
    }

    // Check for simulated failure
    if (this.simulatedErrorType) {
      switch (this.simulatedErrorType) {
        case 'network':
          throw new NetworkError()
        case 'rateLimit':
          throw new RateLimitError()
        case 'validation':
          throw new ValidationError('Simulated validation failure')
        case 'server':
          throw new ApiError('Internal match engine error', 500, 'MATCH_ENGINE_ERROR')
      }
    }

    if (this.failureRate > 0 && Math.random() < this.failureRate) {
      throw new ApiError('Transient gateway timeout', 504, 'GATEWAY_TIMEOUT')
    }

    // Stale-response race condition check
    if (endpointKey) {
      const latest = this.latestRequestSequences.get(endpointKey)
      if (latest && latest > currentSequence) {
        throw new RequestAbortedError('Response discarded due to newer request')
      }
    }

    return currentSequence
  }

  // --- Market Data Endpoints ---

  public async getTickers(signal?: AbortSignal): Promise<MarketTicker[]> {
    await this.simulateNetwork('getTickers', signal)
    return [
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
  }

  public async getOrderBook(
    symbol = 'BTC/USDT',
    limit = 15,
    signal?: AbortSignal
  ): Promise<OrderBookSnapshot> {
    await this.simulateNetwork(`getOrderBook-${symbol}`, signal)
    const midPrice = symbol.startsWith('BTC') ? 64250.0 : symbol.startsWith('ETH') ? 3445.0 : 168.42

    const bids: PriceLevel[] = []
    const asks: PriceLevel[] = []
    let bidTotal = 0
    let askTotal = 0

    for (let i = 1; i <= limit; i++) {
      const bidSize = Number((Math.random() * 2.0 + 0.1).toFixed(3))
      bidTotal += bidSize
      bids.push({
        price: Number((midPrice - i * (midPrice > 1000 ? 0.5 : 0.05)).toFixed(2)),
        size: bidSize,
        total: Number(bidTotal.toFixed(3)),
        percentDepth: Math.min(100, (bidTotal / 30) * 100),
      })

      const askSize = Number((Math.random() * 2.0 + 0.1).toFixed(3))
      askTotal += askSize
      asks.push({
        price: Number((midPrice + i * (midPrice > 1000 ? 0.5 : 0.05)).toFixed(2)),
        size: askSize,
        total: Number(askTotal.toFixed(3)),
        percentDepth: Math.min(100, (askTotal / 30) * 100),
      })
    }

    return {
      symbol,
      sequence: Date.now(),
      timestamp: Date.now(),
      bids,
      asks,
      spread: Number(((asks[0]?.price ?? midPrice) - (bids[0]?.price ?? midPrice)).toFixed(2)),
      spreadPercentage: 0.0015,
    }
  }

  public async getRecentTrades(
    symbol = 'BTC/USDT',
    limit = 20,
    signal?: AbortSignal
  ): Promise<TradeTick[]> {
    await this.simulateNetwork(`getTrades-${symbol}`, signal)
    const basePrice = symbol.startsWith('BTC') ? 64250.0 : symbol.startsWith('ETH') ? 3445.0 : 168.42
    const now = Date.now()

    return Array.from({ length: limit }).map((_, idx) => ({
      id: `tr-${now}-${idx}`,
      symbol,
      price: Number((basePrice + (Math.random() - 0.5) * 5).toFixed(2)),
      size: Number((Math.random() * 1.5 + 0.05).toFixed(4)),
      side: Math.random() > 0.5 ? 'buy' : 'sell',
      timestamp: now - idx * 1200,
    }))
  }

  public async getKlines(
    symbol = 'BTC/USDT',
    intervalOrTimeframe: KlineInterval | ChartTimeframe = '1D',
    limit = 35,
    signal?: AbortSignal
  ): Promise<Candle[]> {
    await this.simulateNetwork(`getKlines-${symbol}-${intervalOrTimeframe}`, signal)

    const basePriceMap: Record<string, number> = {
      'BTC/USDT': 64250.0,
      'ETH/USDT': 3445.0,
      'SOL/USDT': 168.42,
      'BNB/USDT': 608.3,
      'ARB/USDT': 1.245,
      'DOGE/USDT': 0.1684,
    }
    const basePrice = basePriceMap[symbol] ?? 64250.0
    const precision = basePrice < 2 ? 4 : 2
    const volatility = basePrice * 0.008

    const intervalMsMap: Record<string, number> = {
      '1D': 15 * 60 * 1000,
      '1W': 60 * 60 * 1000,
      '1M': 4 * 60 * 60 * 1000,
      '3M': 24 * 60 * 60 * 1000,
      '1Y': 7 * 24 * 60 * 60 * 1000,
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
    }
    const intervalMs = intervalMsMap[intervalOrTimeframe] ?? (15 * 60 * 1000)
    const now = Date.now()

    let runningPrice = basePrice * (1 - (limit * 0.003))
    const candles: Candle[] = []

    for (let idx = 0; idx < limit; idx++) {
      const time = now - (limit - 1 - idx) * intervalMs
      const wave = Math.sin((idx / limit) * Math.PI * 3) * volatility * 1.5
      const trend = ((idx / limit) - 0.5) * volatility * 2
      const delta = (Math.random() - 0.48) * volatility * 1.2 + (wave * 0.2) + (trend * 0.1)

      const open = Number(runningPrice.toFixed(precision))
      const close = Number(Math.max(0.0001, runningPrice + delta).toFixed(precision))
      const high = Number((Math.max(open, close) + Math.random() * volatility * 0.6).toFixed(precision))
      const low = Number((Math.min(open, close) - Math.random() * volatility * 0.6).toFixed(precision))
      const volume = Number((Math.random() * (basePrice > 1000 ? 50 : 5000) + 10).toFixed(2))

      candles.push({
        time,
        open,
        high,
        low,
        close,
        volume,
        isClosed: idx < limit - 1,
      })

      runningPrice = close
    }

    return candles
  }

  public async getSymbols(signal?: AbortSignal): Promise<SymbolInfo[]> {
    await this.simulateNetwork('getSymbols', signal)
    return [
      {
        symbol: 'BTC/USDT',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        status: 'TRADING',
        type: 'PERPETUAL',
        priceFilter: { minPrice: 0.1, maxPrice: 1000000, tickSize: 0.1 },
        lotSizeFilter: { minQty: 0.001, maxQty: 1000, stepSize: 0.001 },
        notionalFilter: { minNotional: 5.0 },
        baseAssetPrecision: 3,
        quoteAssetPrecision: 2,
        maxLeverage: 100,
      },
      {
        symbol: 'ETH/USDT',
        baseAsset: 'ETH',
        quoteAsset: 'USDT',
        status: 'TRADING',
        type: 'PERPETUAL',
        priceFilter: { minPrice: 0.01, maxPrice: 100000, tickSize: 0.01 },
        lotSizeFilter: { minQty: 0.01, maxQty: 5000, stepSize: 0.01 },
        notionalFilter: { minNotional: 5.0 },
        baseAssetPrecision: 2,
        quoteAssetPrecision: 2,
        maxLeverage: 75,
      },
    ]
  }

  // --- Order Endpoints ---

  public async getOpenOrders(
    symbol?: string,
    signal?: AbortSignal
  ): Promise<ActiveOrder[]> {
    await this.simulateNetwork('getOpenOrders', signal)
    if (symbol) {
      return this.orders.filter(o => o.symbol === symbol)
    }
    return [...this.orders]
  }

  public async getOrderHistory(
    symbol?: string,
    signal?: AbortSignal
  ): Promise<ActiveOrder[]> {
    await this.simulateNetwork('getOrderHistory', signal)
    if (symbol) {
      return this.orderHistory.filter(o => o.symbol === symbol)
    }
    return [...this.orderHistory]
  }

  public async createOrder(
    req: CreateOrderRequest,
    signal?: AbortSignal
  ): Promise<ActiveOrder> {
    if (!req.symbol || !req.side || !req.type || req.quantity <= 0) {
      throw new ValidationError('Invalid order parameters: symbol, side, type and quantity are required')
    }

    if (req.type === 'LIMIT' && (!req.price || req.price <= 0)) {
      throw new ValidationError('Price is required for LIMIT orders')
    }

    // Duplicate Order Submission Guard (Idempotency check within 500ms or identical clientOrderId)
    const orderSignature = req.clientOrderId
      ? `client-${req.clientOrderId}`
      : `${req.symbol}:${req.side}:${req.type}:${req.price}:${req.quantity}`
    const lastSubmission = this.recentOrderSignatures.get(orderSignature)
    const now = Date.now()

    if (lastSubmission && now - lastSubmission < 500) {
      throw new ValidationError('Duplicate order rejected: an identical order is currently processing')
    }
    this.recentOrderSignatures.set(orderSignature, now)

    await this.simulateNetwork('createOrder', signal)

    const newOrder: ActiveOrder = {
      id: `ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      symbol: req.symbol,
      side: req.side,
      type: req.type,
      price: req.price ?? 64250.0,
      quantity: req.quantity,
      filledQuantity: 0,
      status: 'NEW',
      timestamp: Date.now(),
      clientOrderId: req.clientOrderId,
      timeInForce: req.timeInForce ?? 'GTC',
    }

    this.orders.unshift(newOrder)
    return newOrder
  }

  public async cancelOrder(
    req: CancelOrderRequest,
    signal?: AbortSignal
  ): Promise<{ success: boolean; orderId: string }> {
    if (!req.orderId) {
      throw new ValidationError('orderId is required to cancel an order')
    }

    await this.simulateNetwork('cancelOrder', signal)

    const idx = this.orders.findIndex(o => o.id === req.orderId)
    if (idx !== -1) {
      const [cancelled] = this.orders.splice(idx, 1)
      if (cancelled) {
        this.orderHistory.unshift({
          ...cancelled,
          status: 'CANCELLED',
        })
      }
    }

    return { success: true, orderId: req.orderId }
  }

  public async cancelAllOrders(
    symbol?: string,
    signal?: AbortSignal
  ): Promise<{ success: boolean; cancelledCount: number }> {
    await this.simulateNetwork('cancelAllOrders', signal)

    let count = 0
    if (symbol) {
      const initialLen = this.orders.length
      this.orders = this.orders.filter(o => o.symbol !== symbol)
      count = initialLen - this.orders.length
    } else {
      count = this.orders.length
      this.orders = []
    }

    return { success: true, cancelledCount: count }
  }

  // --- Positions Endpoints ---

  public async getPositions(signal?: AbortSignal): Promise<Position[]> {
    await this.simulateNetwork('getPositions', signal)
    return [...this.positions]
  }

  public async closePosition(
    positionId: string,
    signal?: AbortSignal
  ): Promise<{ success: boolean; positionId: string }> {
    if (!positionId) {
      throw new ValidationError('positionId is required')
    }

    await this.simulateNetwork('closePosition', signal)
    this.positions = this.positions.filter(p => p.id !== positionId)

    return { success: true, positionId }
  }

  public async adjustLeverage(
    positionId: string,
    leverage: number,
    signal?: AbortSignal
  ): Promise<Position> {
    if (leverage < 1 || leverage > 125) {
      throw new ValidationError('Leverage must be between 1x and 125x')
    }

    await this.simulateNetwork('adjustLeverage', signal)

    const pos = this.positions.find(p => p.id === positionId)
    if (!pos) {
      throw new ApiError('Position not found', 404, 'POSITION_NOT_FOUND')
    }

    pos.leverage = leverage
    pos.margin = Number(((pos.size * pos.entryPrice) / leverage).toFixed(2))
    return { ...pos }
  }

  // --- Account Endpoints ---

  public async getAccountSummary(signal?: AbortSignal): Promise<AccountSummary> {
    await this.simulateNetwork('getAccountSummary', signal)
    return {
      accountId: 'acc-nexus-pro-01',
      accountType: 'MARGIN',
      totalEquity: 28450.8,
      availableMargin: 23091.05,
      initialMargin: 5359.75,
      maintenanceMargin: 2679.88,
      unrealizedPnl: 705.0,
      marginRatio: 11.6,
      balances: [
        { asset: 'USDT', free: 23091.05, locked: 5359.75, total: 28450.8 },
        { asset: 'BTC', free: 0.25, locked: 0.75, total: 1.0 },
        { asset: 'ETH', free: 2.0, locked: 8.5, total: 10.5 },
      ],
      canTrade: true,
      canWithdraw: true,
      updateTime: Date.now(),
    }
  }
}

export const mockApiClient = new MockHttpClient()
