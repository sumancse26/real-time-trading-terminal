import { describe, it, expect, beforeEach } from 'vitest'
import { MockHttpClient } from '../core/api/client'
import {
  NetworkError,
  RateLimitError,
  ValidationError,
  ApiError,
  RequestAbortedError,
} from '../core/api/errors'

describe('MockHttpClient REST API Engine', () => {
  let client: MockHttpClient

  beforeEach(() => {
    client = new MockHttpClient({ minLatencyMs: 0, maxLatencyMs: 0 })
  })

  describe('Market Data Endpoints', () => {
    it('fetches market tickers', async () => {
      const tickers = await client.getTickers()
      expect(Array.isArray(tickers)).toBe(true)
      expect(tickers.length).toBeGreaterThan(0)
      expect(tickers.find(t => t.symbol === 'BTC/USDT')).toBeDefined()
    })

    it('fetches order book with custom limit', async () => {
      const book = await client.getOrderBook('BTC/USDT', 10)
      expect(book.symbol).toBe('BTC/USDT')
      expect(book.bids.length).toBe(10)
      expect(book.asks.length).toBe(10)
      expect(book.spread).toBeGreaterThanOrEqual(0)
    })

    it('fetches recent trades and klines', async () => {
      const trades = await client.getRecentTrades('ETH/USDT', 5)
      expect(trades.length).toBe(5)
      expect(trades[0]?.symbol).toBe('ETH/USDT')

      const klines = await client.getKlines('BTC/USDT', '5m', 15)
      expect(klines.length).toBe(15)
      expect(klines[0]?.open).toBeGreaterThan(0)
    })
  })

  describe('Order & Position Lifecycle', () => {
    it('creates and retrieves new orders', async () => {
      const newOrder = await client.createOrder({
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'LIMIT',
        price: 64100.0,
        quantity: 1.25,
      })

      expect(newOrder.id).toBeDefined()
      expect(newOrder.status).toBe('NEW')
      expect(newOrder.quantity).toBe(1.25)

      const openOrders = await client.getOpenOrders('BTC/USDT')
      expect(openOrders.some(o => o.id === newOrder.id)).toBe(true)
    })

    it('validates order input parameters', async () => {
      await expect(
        client.createOrder({
          symbol: '',
          side: 'buy',
          type: 'LIMIT',
          quantity: 0,
        })
      ).rejects.toThrow(ValidationError)
    })

    it('cancels specific order and cancels all orders', async () => {
      const order = await client.createOrder({
        symbol: 'SOL/USDT',
        side: 'sell',
        type: 'LIMIT',
        price: 180.0,
        quantity: 10,
      })

      const cancelRes = await client.cancelOrder({ orderId: order.id, symbol: 'SOL/USDT' })
      expect(cancelRes.success).toBe(true)

      const cancelAllRes = await client.cancelAllOrders()
      expect(cancelAllRes.success).toBe(true)
      const remaining = await client.getOpenOrders()
      expect(remaining.length).toBe(0)
    })

    it('fetches, adjusts leverage, and closes positions', async () => {
      const positions = await client.getPositions()
      expect(positions.length).toBeGreaterThan(0)
      const targetPos = positions[0]!

      const adjusted = await client.adjustLeverage(targetPos.id, 50)
      expect(adjusted.leverage).toBe(50)

      const closeRes = await client.closePosition(targetPos.id)
      expect(closeRes.success).toBe(true)

      const afterClose = await client.getPositions()
      expect(afterClose.some(p => p.id === targetPos.id)).toBe(false)
    })
  })

  describe('Simulated Latency, Errors & Request Aborts', () => {
    it('simulates network error', async () => {
      client.setConfig({ simulatedErrorType: 'network' })
      await expect(client.getTickers()).rejects.toThrow(NetworkError)
    })

    it('simulates rate limit 429 error', async () => {
      client.setConfig({ simulatedErrorType: 'rateLimit' })
      await expect(client.getTickers()).rejects.toThrow(RateLimitError)
    })

    it('simulates 500 server error', async () => {
      client.setConfig({ simulatedErrorType: 'server' })
      await expect(client.getTickers()).rejects.toThrow(ApiError)
    })

    it('handles request cancellation via AbortSignal', async () => {
      client.setConfig({ minLatencyMs: 50, maxLatencyMs: 100 })
      const controller = new AbortController()

      const requestPromise = client.getOrderBook('BTC/USDT', 15, controller.signal)
      controller.abort()

      await expect(requestPromise).rejects.toThrow(RequestAbortedError)
    })
  })
})
