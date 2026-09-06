import React, { useState, useMemo, memo } from 'react'
import type { PriceLevel } from '@/types/orderbook'
import { useBatchedOrderBook } from '@/core/stream/useBatchedStream'
import { useSelectedSymbol, useSetOrderFormPrefill } from '@/core/store/useMarketStore'
import { Card } from '@/components/ui/Card'
import { NumberFlash } from '@/components/ui/NumberFlash'
import { aggregateOrderBookLevels, calculateSpread } from '@/utils/orderbook'
import { Layers, ArrowDownUp, Rows3, ArrowUp, ArrowDown } from 'lucide-react'

export type OrderBookViewMode = 'both' | 'asks' | 'bids'
export type OrderBookDepth = 5 | 10 | 15 | 20
export type OrderBookPrecision = '0.1' | '0.5' | '1.0' | '5.0' | '10.0'

export interface OrderBookRowProps {
  level: PriceLevel
  side: 'ask' | 'bid'
  onSelect?: (level: PriceLevel) => void
}

/**
 * Justified Memoization:
 * OrderBook price level row wrapped in React.memo.
 * Prevents re-rendering rows whose price and depth quantity haven't changed across frame snapshots.
 */
export const OrderBookRow: React.FC<OrderBookRowProps> = memo(({ level, side, onSelect }) => {
  const isAsk = side === 'ask'

  return (
    <div
      className={`book-row ${isAsk ? 'ask-row' : 'bid-row'}`}
      onClick={() => onSelect?.(level)}
      title={`Click to prefill ${isAsk ? 'BUY' : 'SELL'} at $${level.price.toFixed(2)}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect?.(level)
        }
      }}
      data-testid={`book-row-${side}-${level.price}`}
    >
      <div
        className={`depth-visualizer ${isAsk ? 'ask-depth' : 'bid-depth'}`}
        style={{ width: `${Math.min(100, level.percentDepth)}%` }}
      />
      <span className={`col-price ${isAsk ? 'text-sell' : 'text-buy'}`}>
        <NumberFlash value={level.price} format={(v) => v.toFixed(2)} />
      </span>
      <span className="col-size">{level.size.toFixed(3)}</span>
      <span className="col-total">{level.total.toFixed(3)}</span>
    </div>
  )
})

OrderBookRow.displayName = 'OrderBookRow'

export const OrderBookView: React.FC = () => {
  const snapshot = useBatchedOrderBook()
  const selectedSymbol = useSelectedSymbol()
  const setOrderFormPrefill = useSetOrderFormPrefill()

  const [precision, setPrecision] = useState<OrderBookPrecision>('0.5')
  const [depth, setDepth] = useState<OrderBookDepth>(10)
  const [viewMode, setViewMode] = useState<OrderBookViewMode>('both')

  const baseAsset = selectedSymbol.split('/')[0] || 'BTC'
  const quoteAsset = selectedSymbol.split('/')[1] || 'USDT'

  // Aggregation & Slicing Memoization
  const processedBook = useMemo(() => {
    if (!snapshot) return null

    const precVal = parseFloat(precision) || 0.5

    // Aggregate asks and bids
    const rawAsks = aggregateOrderBookLevels(snapshot.asks, precVal, 'ask')
    const rawBids = aggregateOrderBookLevels(snapshot.bids, precVal, 'bid')

    const bestAskPrice = rawAsks[0]?.price ?? snapshot.asks[0]?.price
    const bestBidPrice = rawBids[0]?.price ?? snapshot.bids[0]?.price

    const spreadData = calculateSpread(bestAskPrice, bestBidPrice)

    // Slice based on viewMode and depth
    const asksToDisplay =
      viewMode === 'bids'
        ? []
        : viewMode === 'both'
        ? rawAsks.slice(0, depth).reverse() // In dual view, highest ask at top down to lowest ask right above spread
        : rawAsks.slice(0, depth * 2)

    const bidsToDisplay =
      viewMode === 'asks'
        ? []
        : viewMode === 'both'
        ? rawBids.slice(0, depth) // In dual view, highest bid right below spread down to lowest
        : rawBids.slice(0, depth * 2)

    return {
      asks: asksToDisplay,
      bids: bidsToDisplay,
      bestAskPrice,
      bestBidPrice,
      ...spreadData,
    }
  }, [snapshot, precision, depth, viewMode])

  const handleRowClick = (level: PriceLevel) => {
    setOrderFormPrefill({
      price: level.price,
      quantity: level.size,
    })
  }

  if (!snapshot || !processedBook) {
    return (
      <Card title="ORDER BOOK L2" className="order-book-card">
        <div className="flex items-center justify-center h-64 text-neutral-500">
          Initializing L2 depth feed…
        </div>
      </Card>
    )
  }

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-cyan-accent" />
          <span>ORDER BOOK</span>
          <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
            #{snapshot.sequence}
          </span>
        </div>
      }
      headerAction={
        <div className="flex items-center gap-2" data-testid="order-book-controls">
          {/* View Mode Selector */}
          <div className="book-view-mode-group" role="group" aria-label="Book View Mode">
            <button
              type="button"
              className={`book-mode-btn ${viewMode === 'both' ? 'active' : ''}`}
              onClick={() => setViewMode('both')}
              title="Default (Both Bids & Asks)"
              aria-label="Both Bids and Asks"
              data-testid="view-mode-both"
            >
              <Rows3 size={12} />
            </button>
            <button
              type="button"
              className={`book-mode-btn ${viewMode === 'bids' ? 'active text-buy' : ''}`}
              onClick={() => setViewMode('bids')}
              title="Bids (Buy Ladder Only)"
              aria-label="Bids Only"
              data-testid="view-mode-bids"
            >
              <ArrowUp size={12} />
            </button>
            <button
              type="button"
              className={`book-mode-btn ${viewMode === 'asks' ? 'active text-sell' : ''}`}
              onClick={() => setViewMode('asks')}
              title="Asks (Sell Ladder Only)"
              aria-label="Asks Only"
              data-testid="view-mode-asks"
            >
              <ArrowDown size={12} />
            </button>
          </div>

          {/* Depth Selector */}
          <select
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value) as OrderBookDepth)}
            className="precision-select"
            aria-label="Depth Levels"
            data-testid="depth-select"
          >
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="15">15</option>
            <option value="20">20</option>
          </select>

          {/* Precision / Grouping Selector */}
          <select
            value={precision}
            onChange={(e) => setPrecision(e.target.value as OrderBookPrecision)}
            className="precision-select"
            aria-label="Precision"
            data-testid="precision-select"
          >
            <option value="0.1">0.1</option>
            <option value="0.5">0.5</option>
            <option value="1.0">1.0</option>
            <option value="5.0">5.0</option>
            <option value="10.0">10.0</option>
          </select>
        </div>
      }
      className="order-book-card"
    >
      <div className="order-book-container" data-testid="order-book-view">
        {/* Dynamic Column Headers */}
        <div className="book-table-header">
          <span className="col-price">PRICE ({quoteAsset})</span>
          <span className="col-size">SIZE ({baseAsset})</span>
          <span className="col-total">TOTAL ({baseAsset})</span>
        </div>

        {/* Asks (Sells) */}
        {viewMode !== 'bids' && (
          <div className="book-section asks-section" data-testid="book-asks-section">
            {processedBook.asks.map((level) => (
              <OrderBookRow
                key={`ask-${level.price}`}
                level={level}
                side="ask"
                onSelect={handleRowClick}
              />
            ))}
          </div>
        )}

        {/* Spread & Mid-Price Indicator */}
        <div className="spread-indicator" data-testid="spread-indicator">
          <div className="spread-price-group">
            <span className="spread-mid-price text-buy">
              ${processedBook.midPrice > 0 ? processedBook.midPrice.toFixed(2) : '—'}
            </span>
            <ArrowDownUp size={12} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="spread-details">
            <span className="spread-label">Spread</span>
            <span className="spread-val" data-testid="spread-value">
              {processedBook.spread.toFixed(2)} ({processedBook.spreadPercentage.toFixed(3)}%)
            </span>
          </div>
        </div>

        {/* Bids (Buys) */}
        {viewMode !== 'asks' && (
          <div className="book-section bids-section" data-testid="book-bids-section">
            {processedBook.bids.map((level, idx) => (
              <OrderBookRow
                key={`bid-${idx}-${level.price}`}
                level={level}
                side="bid"
                onSelect={handleRowClick}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
