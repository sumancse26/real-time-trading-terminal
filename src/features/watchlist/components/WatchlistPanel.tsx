import React, { useEffect, useCallback, useMemo } from 'react'
import { feedSimulator } from '@/core/stream/mockFeed'
import { Card } from '@/components/ui/Card'
import {
  useMarketStore,
  useSelectedSymbol,
  useWatchlistSymbols,
  useWatchlistSearchQuery,
  useWatchlistCategoryState,
  useWatchlistSortField,
  useWatchlistSortDirection,
  type WatchlistCategory,
} from '@/core/store/useMarketStore'
import { WatchlistItem } from './WatchlistItem'
import { Search, Star, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

export const WatchlistPanel: React.FC = () => {
  const selectedSymbol = useSelectedSymbol()
  const allSymbols = useWatchlistSymbols()
  const entities = useMarketStore(state => state.entities)
  const favorites = useMarketStore(state => state.favorites)
  const query = useWatchlistSearchQuery()
  const category = useWatchlistCategoryState()
  const sortField = useWatchlistSortField()
  const sortDir = useWatchlistSortDirection()

  const setSelectedSymbol = useMarketStore(state => state.setSelectedSymbol)
  const setSearchQuery = useMarketStore(state => state.setSearchQuery)
  const setCategory = useMarketStore(state => state.setCategory)
  const setSort = useMarketStore(state => state.setSort)
  const batchUpdatePrices = useMarketStore(state => state.batchUpdatePrices)

  // Simulate correlated live market price ticks for all watchlist symbols
  const handleTickerUpdate = useCallback(
    (newBtcPrice: number) => {
      const allEntities = useMarketStore.getState().entities
      const updates: Array<{ symbol: string; price: number; change24h?: number; changePercent24h?: number }> = []

      for (const [sym, ticker] of Object.entries(allEntities)) {
        if (sym === 'BTC/USDT') {
          const diff = newBtcPrice - 64250.0
          const pct = (diff / 64250.0) * 100
          updates.push({
            symbol: sym,
            price: newBtcPrice,
            change24h: 1845.2 + diff * 0.1,
            changePercent24h: 2.95 + pct * 0.05,
          })
        } else {
          // Minor noise simulation for other symbols
          const noise = (Math.random() - 0.495) * 0.001 * ticker.lastPrice
          const nextPrice = Math.max(0.0001, Number((ticker.lastPrice + noise).toFixed(ticker.lastPrice > 10 ? 2 : 4)))
          updates.push({
            symbol: sym,
            price: nextPrice,
          })
        }
      }

      batchUpdatePrices(updates)
    },
    [batchUpdatePrices]
  )

  useEffect(() => {
    const unsub = feedSimulator.onTicker(ticker => {
      handleTickerUpdate(ticker.lastPrice)
    })
    return unsub
  }, [handleTickerUpdate])

  // Filtered and sorted symbols computed via useMemo
  const filteredSymbols = useMemo(() => {
    const q = query.trim().toLowerCase()

    let result = allSymbols.filter(sym => {
      const ticker = entities[sym]
      if (!ticker) return false

      if (category === 'FAVORITES' && !favorites.includes(sym)) {
        return false
      }

      if (q && !sym.toLowerCase().includes(q) && !ticker.baseAsset.toLowerCase().includes(q)) {
        return false
      }

      return true
    })

    if (sortField) {
      result = [...result].sort((a, b) => {
        const itemA = entities[a]
        const itemB = entities[b]
        if (!itemA || !itemB) return 0

        let valA: number | string = 0
        let valB: number | string = 0

        switch (sortField) {
          case 'symbol':
            valA = itemA.symbol
            valB = itemB.symbol
            return sortDir === 'asc'
              ? (valA as string).localeCompare(valB as string)
              : (valB as string).localeCompare(valA as string)
          case 'lastPrice':
            valA = itemA.lastPrice
            valB = itemB.lastPrice
            break
          case 'priceChangePercent24h':
            valA = itemA.priceChangePercent24h
            valB = itemB.priceChangePercent24h
            break
          case 'volume24h':
            valA = itemA.volume24h
            valB = itemB.volume24h
            break
        }

        return sortDir === 'asc'
          ? (valA as number) - (valB as number)
          : (valB as number) - (valA as number)
      })
    }

    return result
  }, [allSymbols, entities, favorites, query, category, sortField, sortDir])

  const categories: WatchlistCategory[] = ['ALL', 'FAVORITES', 'PERP']

  const renderSortIcon = (targetField: 'symbol' | 'lastPrice' | 'priceChangePercent24h') => {
    if (sortField !== targetField) {
      return <ArrowUpDown size={10} style={{ opacity: 0.4, marginLeft: 2 }} />
    }
    return sortDir === 'asc' ? (
      <ArrowUp size={10} className="text-cyan-accent" style={{ marginLeft: 2 }} />
    ) : (
      <ArrowDown size={10} className="text-cyan-accent" style={{ marginLeft: 2 }} />
    )
  }

  return (
    <Card
      title={
        <div className="flex items-center justify-between w-full" style={{ width: '100%' }}>
          <div className="flex items-center gap-1.5 font-bold">
            <Star size={13} className="text-cyan-accent" />
            <span>WATCHLIST</span>
            <span
              style={{
                fontSize: '0.65rem',
                padding: '1px 5px',
                borderRadius: '3px',
                background: 'var(--surface-3)',
                color: 'var(--text-muted)',
              }}
            >
              {allSymbols.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                style={{
                  fontSize: '0.65rem',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  border: 'none',
                  background: category === cat ? 'var(--cyan-glow)' : 'transparent',
                  color: category === cat ? 'var(--cyan-accent)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontWeight: category === cat ? 600 : 400,
                }}
              >
                {cat}
              </button>
            ))}
          </div>
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
            placeholder="Search symbols…"
            value={query}
            onChange={e => setSearchQuery(e.target.value)}
            aria-label="Search symbols"
          />
        </div>

        {/* Column Headers with Sortable Triggers */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 10px',
            fontSize: '0.65rem',
            color: 'var(--text-muted)',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--surface-1)',
            userSelect: 'none',
          }}
        >
          <div
            onClick={() => setSort('symbol')}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            PAIR {renderSortIcon('symbol')}
          </div>
          <div
            onClick={() => setSort('lastPrice')}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            PRICE {renderSortIcon('lastPrice')}
          </div>
          <div
            onClick={() => setSort('priceChangePercent24h')}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            24H % {renderSortIcon('priceChangePercent24h')}
          </div>
        </div>

        {/* Watchlist Rows */}
        <div className="watchlist-rows-container" style={{ overflowY: 'auto', flex: 1 }}>
          {filteredSymbols.length === 0 ? (
            <div
              style={{
                padding: '24px 12px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.75rem',
              }}
            >
              No symbols matching &quot;{query}&quot;
            </div>
          ) : (
            filteredSymbols.map((sym, idx) => (
              <React.Fragment key={sym}>
                <WatchlistItem
                  symbol={sym}
                  isActive={sym === selectedSymbol}
                  onSelect={setSelectedSymbol}
                />
                {idx < filteredSymbols.length - 1 && <hr className="watchlist-divider" />}
              </React.Fragment>
            ))
          )}
        </div>
      </div>
    </Card>
  )
}
