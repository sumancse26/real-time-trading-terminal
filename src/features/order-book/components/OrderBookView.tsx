import React, { useEffect, useState } from 'react'
import type { OrderBookSnapshot } from '@/types/orderbook'
import { feedSimulator } from '@/core/stream/mockFeed'
import { Card } from '@/components/ui/Card'
import { NumberFlash } from '@/components/ui/NumberFlash'
import { Layers, ArrowDownUp } from 'lucide-react'

export const OrderBookView: React.FC = () => {
  const [snapshot, setSnapshot] = useState<OrderBookSnapshot | null>(null)
  const [precision, setPrecision] = useState<'0.1' | '0.5' | '1.0'>('0.5')

  useEffect(() => {
    const unsub = feedSimulator.onOrderBook(book => {
      setSnapshot(book)
    })
    return unsub
  }, [])

  if (!snapshot) {
    return (
      <Card title="ORDER BOOK L2" className="order-book-card">
        <div className="flex items-center justify-center h-64 text-neutral-500">
          Initializing L2 depth feed…
        </div>
      </Card>
    )
  }

  const midPrice = ((snapshot.bids[0]?.price ?? 0) + (snapshot.asks[0]?.price ?? 0)) / 2

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
        <select
          value={precision}
          onChange={e => setPrecision(e.target.value as '0.1' | '0.5' | '1.0')}
          className="precision-select"
          aria-label="Precision"
        >
          <option value="0.1">0.1</option>
          <option value="0.5">0.5</option>
          <option value="1.0">1.0</option>
        </select>
      }
      className="order-book-card"
    >
      <div className="order-book-container" data-testid="order-book-view">
        {/* Column headers */}
        <div className="book-table-header">
          <span className="col-price">PRICE (USDT)</span>
          <span className="col-size">SIZE (BTC)</span>
          <span className="col-total">TOTAL (BTC)</span>
        </div>

        {/* Asks (Sells) — highest ask at top, reversed */}
        <div className="book-section asks-section">
          {snapshot.asks
            .slice(0, 10)
            .reverse()
            .map((level, idx) => (
              <div key={`ask-${idx}-${level.price}`} className="book-row ask-row">
                <div
                  className="depth-visualizer ask-depth"
                  style={{ width: `${level.percentDepth}%` }}
                />
                <span className="col-price text-sell">
                  <NumberFlash value={level.price} format={v => v.toFixed(2)} />
                </span>
                <span className="col-size">{level.size.toFixed(3)}</span>
                <span className="col-total">{level.total.toFixed(3)}</span>
              </div>
            ))}
        </div>

        {/* Spread Indicator */}
        <div className="spread-indicator">
          <div className="spread-price-group">
            <span className="spread-mid-price text-buy">
              ${midPrice > 0 ? midPrice.toFixed(2) : '—'}
            </span>
            <ArrowDownUp size={12} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="spread-details">
            <span className="spread-label">Spread</span>
            <span className="spread-val">
              {snapshot.spread.toFixed(2)} ({snapshot.spreadPercentage.toFixed(3)}%)
            </span>
          </div>
        </div>

        {/* Bids (Buys) — highest bid at top */}
        <div className="book-section bids-section">
          {snapshot.bids.slice(0, 10).map((level, idx) => (
            <div key={`bid-${idx}-${level.price}`} className="book-row bid-row">
              <div
                className="depth-visualizer bid-depth"
                style={{ width: `${level.percentDepth}%` }}
              />
              <span className="col-price text-buy">
                <NumberFlash value={level.price} format={v => v.toFixed(2)} />
              </span>
              <span className="col-size">{level.size.toFixed(3)}</span>
              <span className="col-total">{level.total.toFixed(3)}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
