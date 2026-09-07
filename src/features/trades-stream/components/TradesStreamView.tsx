import React, { memo } from 'react'
import type { TradeTick } from '@/types/market'
import { useBatchedTrades } from '@/core/stream/useBatchedStream'
import { useSelectedSymbol } from '@/core/store/useMarketStore'
import { Card } from '@/components/ui/Card'
import { NumberFlash } from '@/components/ui/NumberFlash'
import { Activity } from 'lucide-react'

export interface TradeRowItemProps {
  trade: TradeTick
}

/**
 * Justified Memoization:
 * Individual trade row component wrapped in React.memo.
 * Prevents re-rendering 24 historical trade rows when a new trade is pushed to the head of the buffer.
 */
export const TradeRowItem: React.FC<TradeRowItemProps> = memo(({ trade }) => {
  const isBuy = trade.side === 'buy'
  const timeStr = new Date(trade.timestamp).toTimeString().split(' ')[0]
  const msStr = String(trade.timestamp % 1000).padStart(3, '0')

  return (
    <div className="trade-row">
      <span className={`col-trade-price ${isBuy ? 'text-buy' : 'text-sell'}`}>
        <NumberFlash value={trade.price} format={(v) => v.toFixed(2)} />
      </span>
      <span className="col-trade-size">{trade.size.toFixed(4)}</span>
      <span className="col-trade-time">
        {timeStr}
        <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>.{msStr}</span>
      </span>
    </div>
  )
})

TradeRowItem.displayName = 'TradeRowItem'

export const TradesStreamView: React.FC = () => {
  const trades = useBatchedTrades(25)
  const selectedSymbol = useSelectedSymbol()

  const baseAsset = selectedSymbol.split('/')[0] || 'BTC'
  const quoteAsset = selectedSymbol.split('/')[1] || 'USDT'

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
          <span className="col-trade-price">PRICE ({quoteAsset})</span>
          <span className="col-trade-size">SIZE ({baseAsset})</span>
          <span className="col-trade-time">TIME</span>
        </div>

        <div className="trades-table-body">
          {trades.map((trade) => (
            <TradeRowItem key={trade.id} trade={trade} />
          ))}
        </div>
      </div>
    </Card>
  )
}
