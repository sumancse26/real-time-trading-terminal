import type { WsClientMessage, WsServerMessage } from '@/types/websocket'
import type { MarketTicker, TradeTick } from '@/types/market'
import type { OrderBookSnapshot, PriceLevel } from '@/types/orderbook'

export interface MockWsServerConfig {
  heartbeatIntervalMs?: number
  priceTickIntervalMs?: number
  dropRate?: number // Probability of simulated connection drop
}

export type MessageHandler = (rawMessage: string) => void

/**
 * Mock WebSocket Server that simulates an exchange trading gateway over WebSocket.
 */
export class MockWsServer {
  private clients: Set<{ id: string; onMessage: MessageHandler; subscriptions: Set<string> }> =
    new Set()
  private tickTimer: number | null = null
  private isRunning = false
  private currentPrice = 64250.0
  private sequence = 100000

  constructor(private config: MockWsServerConfig = {}) {}

  public connect(clientHandler: MessageHandler): {
    id: string
    send: (msgString: string) => void
    disconnect: () => void
  } {
    const clientId = `client-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const clientRecord = {
      id: clientId,
      onMessage: clientHandler,
      subscriptions: new Set<string>(),
    }
    this.clients.add(clientRecord)

    if (!this.isRunning) {
      this.startEmitting();
    }

    return {
      id: clientId,
      send: (msgString: string) => this.handleClientMessage(clientId, msgString),
      disconnect: () => {
        this.clients.delete(clientRecord)
        if (this.clients.size === 0) {
          this.stopEmitting()
        }
      },
    }
  }

  private handleClientMessage(clientId: string, raw: string) {
    const client = Array.from(this.clients).find(c => c.id === clientId)
    if (!client) return

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      this.sendToClient(client, {
        type: 'error',
        code: 4000,
        message: 'Invalid JSON message received',
        timestamp: Date.now(),
      })
      return
    }

    const msg = parsed as WsClientMessage

    if (msg.action === 'ping') {
      this.sendToClient(client, {
        type: 'pong',
        timestamp: Date.now(),
      })
      return
    }

    if (msg.action === 'subscribe') {
      const channels = msg.channels || []
      const symbols = msg.symbols || ['BTC/USDT']

      for (const ch of channels) {
        for (const sym of symbols) {
          const topic = `${ch}:${sym}`
          client.subscriptions.add(topic)
          this.sendToClient(client, {
            type: 'subscribed',
            channel: ch,
            symbol: sym,
            timestamp: Date.now(),
          })

          // Send initial snapshot on subscription
          if (ch === 'ticker') {
            this.sendToClient(client, {
              type: 'ticker',
              symbol: sym,
              data: this.generateTicker(sym),
              timestamp: Date.now(),
            })
          } else if (ch === 'book_snapshot') {
            this.sendToClient(client, {
              type: 'book_snapshot',
              symbol: sym,
              data: this.generateOrderBookSnapshot(sym),
              timestamp: Date.now(),
            })
          }
        }
      }
      return
    }

    if (msg.action === 'unsubscribe') {
      const channels = msg.channels || []
      const symbols = msg.symbols || ['BTC/USDT']

      for (const ch of channels) {
        for (const sym of symbols) {
          const topic = `${ch}:${sym}`
          client.subscriptions.delete(topic)
          this.sendToClient(client, {
            type: 'unsubscribed',
            channel: ch,
            symbol: sym,
            timestamp: Date.now(),
          })
        }
      }
      return
    }
  }

  public broadcastRaw(rawString: string) {
    for (const client of this.clients) {
      client.onMessage(rawString)
    }
  }

  private sendToClient(
    client: { onMessage: MessageHandler },
    message: WsServerMessage
  ) {
    client.onMessage(JSON.stringify(message))
  }

  private startEmitting() {
    this.isRunning = true
    const interval = this.config.priceTickIntervalMs ?? 60

    this.tickTimer = window.setInterval(() => {
      this.emitTick()
    }, interval)
  }

  private stopEmitting() {
    if (this.tickTimer !== null) {
      clearInterval(this.tickTimer)
      this.tickTimer = null
    }
    this.isRunning = false
  }

  public emitTick(forcedPriceDelta?: number) {
    const delta = forcedPriceDelta !== undefined ? forcedPriceDelta : (Math.random() - 0.495) * 4.5
    this.currentPrice = Math.max(100, Number((this.currentPrice + delta).toFixed(2)))
    this.sequence++
    const now = Date.now()

    const tickerMsg: WsServerMessage = {
      type: 'ticker',
      symbol: 'BTC/USDT',
      data: this.generateTicker('BTC/USDT'),
      timestamp: now,
    }

    const tradeMsg: WsServerMessage = {
      type: 'trade',
      symbol: 'BTC/USDT',
      data: this.generateTrade('BTC/USDT'),
      timestamp: now,
    }

    const bookMsg: WsServerMessage = {
      type: 'book_snapshot',
      symbol: 'BTC/USDT',
      data: this.generateOrderBookSnapshot('BTC/USDT'),
      timestamp: now,
    }

    for (const client of this.clients) {
      if (client.subscriptions.has('ticker:BTC/USDT')) {
        this.sendToClient(client, tickerMsg)
      }
      if (client.subscriptions.has('trade:BTC/USDT')) {
        this.sendToClient(client, tradeMsg)
      }
      if (client.subscriptions.has('book_snapshot:BTC/USDT')) {
        this.sendToClient(client, bookMsg)
      }
    }
  }

  private generateTicker(symbol: string): MarketTicker {
    return {
      symbol,
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      lastPrice: this.currentPrice,
      priceChange24h: 1845.2,
      priceChangePercent24h: 2.95,
      high24h: 65120.0,
      low24h: 62410.0,
      volume24h: 42890.45,
      turnover24h: 2758410290,
    }
  }

  private generateTrade(symbol: string): TradeTick {
    return {
      id: `ws-tr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      symbol,
      price: this.currentPrice,
      size: Number((Math.random() * 1.5 + 0.05).toFixed(4)),
      side: Math.random() > 0.48 ? 'buy' : 'sell',
      timestamp: Date.now(),
    }
  }

  private generateOrderBookSnapshot(symbol: string): OrderBookSnapshot {
    const bids: PriceLevel[] = []
    const asks: PriceLevel[] = []
    let bidTotal = 0
    let askTotal = 0

    for (let i = 1; i <= 10; i++) {
      const bidSize = Number((Math.random() * 2.0 + 0.2).toFixed(3))
      bidTotal += bidSize
      bids.push({
        price: Number((this.currentPrice - i * 0.5).toFixed(2)),
        size: bidSize,
        total: Number(bidTotal.toFixed(3)),
        percentDepth: Math.min(100, (bidTotal / 25) * 100),
      })

      const askSize = Number((Math.random() * 2.0 + 0.2).toFixed(3))
      askTotal += askSize
      asks.push({
        price: Number((this.currentPrice + i * 0.5).toFixed(2)),
        size: askSize,
        total: Number(askTotal.toFixed(3)),
        percentDepth: Math.min(100, (askTotal / 25) * 100),
      })
    }

    return {
      symbol,
      sequence: this.sequence,
      timestamp: Date.now(),
      bids,
      asks,
      spread: Number(((asks[0]?.price ?? this.currentPrice) - (bids[0]?.price ?? this.currentPrice)).toFixed(2)),
      spreadPercentage: 0.0012,
    }
  }
}

export const mockWsServer = new MockWsServer()
