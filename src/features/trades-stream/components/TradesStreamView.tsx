import React, { useEffect, useState } from 'react'
import type { TradeTick } from '@/types/market'
import { feedSimulator } from '@/core/stream/mockFeed'
import { Card } from '@/components/ui/Card'
import { NumberFlash } from '@/components/ui/NumberFlash'
import { Activity } from 'lucide-react'

export const TradesStreamView: React.FC = () => {
  const [trades, setTrades] = useState<TradeTick[]>([])

  useEffect(() => {
    const unsub = feedSimulator.onTrade(newTrade => {
      setTrades(prev => [newTrade, ...prev.slice(0, 24)])
    })
    return unsub
  }, [])

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-cyan-accent" />
          <span>MARKET TRADES</span>
          <span className="live-dot" />
        </div>
      }
      className="trades-stream-card"
    >
      <div className="trades-table-container" data-testid="trades-stream-view">
        <div className="trades-table-header">
          <span className="col-trade-price">PRICE (USDT)</span>
          <span className="col-trade-size">SIZE (BTC)</span>
          <span className="col-trade-time">TIME</span>
        </div>

        <div className="trades-table-body">
          {trades.map(trade => {
            const isBuy = trade.side === 'buy'
            const timeStr = new Date(trade.timestamp).toTimeString().split(' ')[0]
            const msStr = String(trade.timestamp % 1000).padStart(3, '0')

            return (
              <div key={trade.id} className="trade-row">
                <span className={`col-trade-price ${isBuy ? 'text-buy' : 'text-sell'}`}>
                  <NumberFlash value={trade.price} format={v => v.toFixed(2)} />
                </span>
                <span className="col-trade-size">{trade.size.toFixed(4)}</span>
                <span className="col-trade-time">
                  {timeStr}
                  <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>.{msStr}</span>
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
