import React, { useState } from 'react'
import type { Position, ActiveOrder } from '@/types/order'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Wallet, Briefcase, ListFilter } from 'lucide-react'

const INITIAL_POSITIONS: Position[] = [
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

const INITIAL_ORDERS: ActiveOrder[] = [
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

export const PositionsView: React.FC = () => {
  const [tab, setTab] = useState<'positions' | 'orders'>('positions')
  const [positions] = useState<Position[]>(INITIAL_POSITIONS)
  const [orders] = useState<ActiveOrder[]>(INITIAL_ORDERS)

  return (
    <Card
      title={
        <div className="portfolio-tabs">
          <button
            type="button"
            className={`portfolio-tab-btn ${tab === 'positions' ? 'active' : ''}`}
            onClick={() => setTab('positions')}
          >
            <Briefcase size={13} className="mr-1 inline" />
            POSITIONS ({positions.length})
          </button>
          <button
            type="button"
            className={`portfolio-tab-btn ${tab === 'orders' ? 'active' : ''}`}
            onClick={() => setTab('orders')}
          >
            <ListFilter size={13} className="mr-1 inline" />
            OPEN ORDERS ({orders.length})
          </button>
        </div>
      }
      headerAction={
        <div className="portfolio-quick-balance">
          <Wallet size={13} className="text-cyan-accent inline mr-1" />
          <span className="balance-label">MARGIN BALANCE:</span>
          <span className="balance-val">$28,450.80 USDT</span>
        </div>
      }
      className="positions-card"
    >
      <div className="positions-container" data-testid="positions-view">
        {tab === 'positions' ? (
          <div className="table-responsive">
            <table className="terminal-table">
              <thead>
                <tr>
                  <th>CONTRACT</th>
                  <th>SIZE</th>
                  <th>ENTRY PRICE</th>
                  <th>MARK PRICE</th>
                  <th>LIQ. PRICE</th>
                  <th>MARGIN</th>
                  <th>UNREALIZED PnL (ROE %)</th>
                  <th className="text-right">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {positions.map(pos => {
                  const isLong = pos.side === 'LONG'
                  const isProfitable = pos.unrealizedPnl >= 0

                  return (
                    <tr key={pos.id} className="position-row">
                      <td>
                        <div className="flex items-center gap-1.5 font-bold">
                          <span>{pos.symbol}</span>
                          <Badge variant={isLong ? 'buy' : 'sell'}>
                            {pos.side} {pos.leverage}x
                          </Badge>
                        </div>
                      </td>
                      <td className="font-mono">{pos.size}</td>
                      <td className="font-mono">${pos.entryPrice.toFixed(2)}</td>
                      <td className="font-mono">${pos.markPrice.toFixed(2)}</td>
                      <td className="font-mono text-warning">${pos.liquidationPrice.toFixed(2)}</td>
                      <td className="font-mono">${pos.margin.toFixed(2)}</td>
                      <td>
                        <div
                          className={`font-mono font-bold ${isProfitable ? 'text-buy' : 'text-sell'}`}
                        >
                          {isProfitable ? '+' : ''}${pos.unrealizedPnl.toFixed(2)} (
                          {isProfitable ? '+' : ''}
                          {pos.unrealizedPnlPercent.toFixed(2)}%)
                        </div>
                      </td>
                      <td className="text-right">
                        <Button variant="secondary" size="sm" className="btn-close-pos">
                          Market Close
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="terminal-table">
              <thead>
                <tr>
                  <th>TIME</th>
                  <th>CONTRACT</th>
                  <th>TYPE</th>
                  <th>SIDE</th>
                  <th>PRICE</th>
                  <th>AMOUNT</th>
                  <th>FILLED</th>
                  <th>STATUS</th>
                  <th className="text-right">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(ord => (
                  <tr key={ord.id}>
                    <td className="font-mono text-neutral-400">
                      {new Date(ord.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="font-bold">{ord.symbol}</td>
                    <td>{ord.type}</td>
                    <td>
                      <Badge variant={ord.side === 'buy' ? 'buy' : 'sell'}>
                        {ord.side.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="font-mono">${ord.price.toFixed(2)}</td>
                    <td className="font-mono">{ord.quantity}</td>
                    <td className="font-mono">{ord.filledQuantity}</td>
                    <td>
                      <Badge variant="neutral">{ord.status}</Badge>
                    </td>
                    <td className="text-right">
                      <Button variant="ghost" size="sm">
                        Cancel
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  )
}
