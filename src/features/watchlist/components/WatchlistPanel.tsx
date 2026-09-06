import React, { useEffect, useState, useCallback } from 'react'
import { feedSimulator } from '@/core/stream/mockFeed'
import { Card } from '@/components/ui/Card'
import { NumberFlash } from '@/components/ui/NumberFlash'
import { Search, Star } from 'lucide-react'

interface WatchlistEntry {
  symbol: string
  base: string
  quote: string
  price: number
  change24h: number
  changePercent24h: number
  market: string
}

const INITIAL_ENTRIES: WatchlistEntry[] = [
  { symbol: 'BTC/USDT', base: 'BTC', quote: 'USDT', price: 64250.0,  change24h: 1845.2,  changePercent24h: 2.95,  market: 'PERP' },
  { symbol: 'ETH/USDT', base: 'ETH', quote: 'USDT', price: 3445.0,   change24h: -82.5,   changePercent24h: -2.34, market: 'PERP' },
  { symbol: 'SOL/USDT', base: 'SOL', quote: 'USDT', price: 168.42,   change24h: 5.81,    changePercent24h: 3.58,  market: 'PERP' },
  { symbol: 'BNB/USDT', base: 'BNB', quote: 'USDT', price: 608.30,   change24h: -12.1,   changePercent24h: -1.95, market: 'PERP' },
  { symbol: 'ARB/USDT', base: 'ARB', quote: 'USDT', price: 1.245,    change24h: 0.048,   changePercent24h: 4.01,  market: 'PERP' },
  { symbol: 'DOGE/USDT', base: 'DOGE', quote: 'USDT', price: 0.1684, change24h: 0.0081,  changePercent24h: 5.05,  market: 'PERP' },
]

function formatPrice(_symbol: string, price: number): string {
  if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (price >= 1)    return price.toFixed(3)
  return price.toFixed(4)
}

export const WatchlistPanel: React.FC = () => {
  const [entries, setEntries] = useState<WatchlistEntry[]>(INITIAL_ENTRIES)
  const [activeSymbol, setActiveSymbol] = useState<string>('BTC/USDT')
  const [query, setQuery] = useState<string>('')

  // Simulate live price ticks for BTC/USDT and add slight noise to others
  const tickPrices = useCallback((newBtcPrice: number) => {
    setEntries(prev =>
      prev.map(entry => {
        if (entry.symbol === 'BTC/USDT') {
          const diff = newBtcPrice - 64250.0
          const pct = (diff / 64250.0) * 100
          return { ...entry, price: newBtcPrice, change24h: 1845.2 + diff * 0.1, changePercent24h: 2.95 + pct * 0.05 }
        }
        // Other instruments get minor correlated noise
        const noise = (Math.random() - 0.5) * 0.001 * entry.price
        return { ...entry, price: Math.max(0.0001, entry.price + noise) }
      }),
    )
  }, [])

  useEffect(() => {
    const unsub = feedSimulator.onTicker(ticker => {
      tickPrices(ticker.lastPrice)
    })
    return unsub
  }, [tickPrices])

  const filtered = query
    ? entries.filter(e => e.symbol.toLowerCase().includes(query.toLowerCase()))
    : entries

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <Star size={13} className="text-cyan-accent" />
          <span>WATCHLIST</span>
        </div>
      }
      className="watchlist-card"
    >
      <div className="watchlist-container" data-testid="watchlist-panel">
        {/* Search */}
        <div className="watchlist-search">
          <Search size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            className="watchlist-search-input"
            placeholder="Search…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search symbols"
          />
        </div>

        {/* Entries */}
        {filtered.map((entry, idx) => {
          const isPositive = entry.changePercent24h >= 0
          const isActive = entry.symbol === activeSymbol

          return (
            <React.Fragment key={entry.symbol}>
              <div
                className={`watchlist-item ${isActive ? 'active' : ''}`}
                onClick={() => setActiveSymbol(entry.symbol)}
                role="button"
                tabIndex={0}
                aria-pressed={isActive}
                onKeyDown={e => e.key === 'Enter' && setActiveSymbol(entry.symbol)}
                data-testid={`watchlist-item-${entry.base}`}
              >
                <span className="watchlist-symbol">{entry.base}<span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/{entry.quote}</span></span>
                <span className={`watchlist-price ${isPositive ? 'text-buy' : 'text-sell'}`}>
                  <NumberFlash value={entry.price} format={v => formatPrice(entry.symbol, v)} />
                </span>
                <span className="watchlist-market">{entry.market}</span>
                <span className={`watchlist-change ${isPositive ? 'text-buy' : 'text-sell'}`}>
                  {isPositive ? '+' : ''}{entry.changePercent24h.toFixed(2)}%
                </span>
              </div>
              {idx < filtered.length - 1 && <hr className="watchlist-divider" />}
            </React.Fragment>
          )
        })}
      </div>
    </Card>
  )
}
