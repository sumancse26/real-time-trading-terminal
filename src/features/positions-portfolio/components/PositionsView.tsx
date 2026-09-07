import React, { useState, useMemo, memo } from 'react'
import {
  usePositionsQuery,
  useOpenOrdersQuery,
  useClosePositionMutation,
  useCancelOrderMutation,
} from '@/core/query'
import { useOrderHistoryQuery } from '@/core/query/hooks/useOrderQueries'
import { useAccountSummaryQuery } from '@/core/query/hooks/useAccountQueries'
import { useTicker } from '@/core/store/useMarketStore'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { NumberFlash } from '@/components/ui/NumberFlash'
import { calculatePositionMetrics } from '@/utils/positionCalculations'
import {
  formatPrice,
  formatPercent,
  formatQuantity,
  formatCurrency,
  formatTimestamp,
} from '@/utils/formatters'
import type { OrderStatus } from '@/types/order'
import type { Position } from '@/types/position'
import { VirtualizedOrderArchive } from './VirtualizedOrderArchive'
import {
  Wallet,
  Briefcase,
  ListFilter,
  History,
  RotateCcw,
  AlertCircle,
  Clock,
  Database,
  Cpu,
} from 'lucide-react'
import { RiskAnalyticsPanel } from './RiskAnalyticsPanel'

export interface PositionRowProps {
  position: Position
  isClosing: boolean
  onClose: (positionId: string) => void
}

/**
 * Selective Subscription & Memoization:
 * PositionRow subscribes only to the ticker of its specific position.symbol.
 * Unaffected positions across different symbols do not re-render when prices change.
 */
export const PositionRow: React.FC<PositionRowProps> = memo(({ position, isClosing, onClose }) => {
  const liveTicker = useTicker(position.symbol)
  const currentPrice = liveTicker?.lastPrice ?? position.markPrice

  const metrics = useMemo(() => {
    return calculatePositionMetrics(
      position.side,
      position.size,
      position.entryPrice,
      currentPrice,
      position.leverage,
      position.maintenanceMargin
    )
  }, [
    position.side,
    position.size,
    position.entryPrice,
    currentPrice,
    position.leverage,
    position.maintenanceMargin,
  ])

  const isLong = position.side === 'LONG'
  const isProfitable = metrics.unrealizedPnl >= 0

  return (
    <tr key={position.id} className="position-row" data-testid={`pos-row-${position.symbol}`}>
      <td>
        <div className="flex items-center gap-1.5 font-bold">
          <span>{position.symbol}</span>
          <Badge variant={isLong ? 'buy' : 'sell'}>
            {position.side} {position.leverage}x
          </Badge>
        </div>
      </td>
      <td className="font-mono">{formatQuantity(position.size, 2)}</td>
      <td className="font-mono">${formatPrice(position.entryPrice)}</td>
      <td className="font-mono">
        <NumberFlash value={currentPrice} format={(v) => `$${formatPrice(v)}`} />
      </td>
      <td className="font-mono">${formatPrice(metrics.marketValue)}</td>
      <td className="font-mono text-warning">${formatPrice(metrics.liquidationPrice)}</td>
      <td className="font-mono">${formatPrice(metrics.margin)}</td>
      <td>
        <div className={`font-mono font-bold ${isProfitable ? 'text-buy' : 'text-sell'}`}>
          {isProfitable ? '+' : ''}${formatPrice(metrics.unrealizedPnl)} (
          {formatPercent(metrics.unrealizedPnlPercent, {
            includeSign: true,
            decimals: 2,
          })}
          )
        </div>
      </td>
      <td className="text-right">
        <Button
          variant="secondary"
          size="sm"
          className="btn-close-pos"
          isLoading={isClosing}
          onClick={() => onClose(position.id)}
        >
          Market Close
        </Button>
      </td>
    </tr>
  )
})

PositionRow.displayName = 'PositionRow'

export const PositionsView: React.FC = () => {
  const [tab, setTab] = useState<'positions' | 'orders' | 'history' | 'archive' | 'risk'>('positions')

  const {
    data: positions = [],
    isLoading: isPositionsLoading,
    isError: isPositionsError,
    error: positionsError,
    refetch: refetchPositions,
  } = usePositionsQuery()

  const {
    data: orders = [],
    isLoading: isOrdersLoading,
    isError: isOrdersError,
    error: ordersError,
    refetch: refetchOrders,
  } = useOpenOrdersQuery()

  const {
    data: orderHistory = [],
    isLoading: isHistoryLoading,
    isError: isHistoryError,
    error: historyError,
    refetch: refetchHistory,
  } = useOrderHistoryQuery()

  const { data: account } = useAccountSummaryQuery()

  const closePositionMutation = useClosePositionMutation()
  const cancelOrderMutation = useCancelOrderMutation()

  const marginBalance = account?.totalEquity ?? 28450.8

  const renderStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING':
        return (
          <Badge variant="warning" className="animate-pulse">
            <Clock size={10} className="inline mr-1" />
            PENDING
          </Badge>
        )
      case 'NEW':
        return <Badge variant="cyan">NEW</Badge>
      case 'FILLED':
        return <Badge variant="buy">FILLED</Badge>
      case 'PARTIALLY_FILLED':
        return <Badge variant="warning">PART. FILLED</Badge>
      case 'CANCELLED':
        return <Badge variant="neutral">CANCELLED</Badge>
      case 'REJECTED':
      case 'EXPIRED':
        return <Badge variant="sell">{status}</Badge>
      default:
        return <Badge variant="neutral">{status}</Badge>
    }
  }

  return (
    <Card
      title={
        <div
          className="portfolio-tabs"
          data-testid="portfolio-tabs"
          role="tablist"
          aria-label="Portfolio Sections"
        >
          <button
            id="tab-positions"
            type="button"
            className={`portfolio-tab-btn ${tab === 'positions' ? 'active' : ''}`}
            onClick={() => setTab('positions')}
            role="tab"
            aria-selected={tab === 'positions'}
            aria-controls="panel-positions"
            data-testid="tab-positions"
          >
            <Briefcase size={13} className="mr-1 inline" aria-hidden="true" />
            POSITIONS ({positions.length})
          </button>
          <button
            id="tab-orders"
            type="button"
            className={`portfolio-tab-btn ${tab === 'orders' ? 'active' : ''}`}
            onClick={() => setTab('orders')}
            role="tab"
            aria-selected={tab === 'orders'}
            aria-controls="panel-orders"
            data-testid="tab-orders"
          >
            <ListFilter size={13} className="mr-1 inline" aria-hidden="true" />
            OPEN ORDERS ({orders.length})
          </button>
          <button
            id="tab-history"
            type="button"
            className={`portfolio-tab-btn ${tab === 'history' ? 'active' : ''}`}
            onClick={() => setTab('history')}
            role="tab"
            aria-selected={tab === 'history'}
            aria-controls="panel-history"
            data-testid="tab-history"
          >
            <History size={13} className="mr-1 inline" aria-hidden="true" />
            ORDER HISTORY ({orderHistory.length})
          </button>
          <button
            id="tab-archive"
            type="button"
            className={`portfolio-tab-btn ${tab === 'archive' ? 'active text-cyan-accent' : ''}`}
            onClick={() => setTab('archive')}
            role="tab"
            aria-selected={tab === 'archive'}
            aria-controls="panel-archive"
            data-testid="tab-archive"
          >
            <Database size={13} className="mr-1 inline text-cyan-accent" aria-hidden="true" />
            100K ARCHIVE (100,000)
          </button>
          <button
            id="tab-risk"
            type="button"
            className={`portfolio-tab-btn ${tab === 'risk' ? 'active text-warning' : ''}`}
            onClick={() => setTab('risk')}
            role="tab"
            aria-selected={tab === 'risk'}
            aria-controls="panel-risk"
            data-testid="tab-risk"
          >
            <Cpu size={13} className="mr-1 inline text-warning" aria-hidden="true" />
            RISK &amp; ANALYTICS (WEB WORKER)
          </button>
        </div>
      }
      headerAction={
        <div className="portfolio-quick-balance">
          <Wallet size={13} className="text-cyan-accent inline mr-1" />
          <span className="balance-label">MARGIN BALANCE:</span>
          <span className="balance-val font-mono">{formatCurrency(marginBalance, 'USDT')}</span>
        </div>
      }
      className="positions-card"
    >
      <div className="positions-container" data-testid="positions-view">
        {tab === 'positions' && (
          <div
            id="panel-positions"
            role="tabpanel"
            aria-labelledby="tab-positions"
            className="positions-table-wrapper"
          >
            {isPositionsLoading ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '32px',
                  gap: '8px',
                }}
              >
                <Spinner size="sm" />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Loading positions…
                </span>
              </div>
            ) : isPositionsError ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--sell)' }}>
                <AlertCircle size={16} className="inline mr-1" />
                <span>
                  Failed to load positions: {(positionsError as Error)?.message || 'Unknown error'}
                </span>
                <Button variant="ghost" size="sm" onClick={() => refetchPositions()} className="ml-2">
                  <RotateCcw size={12} className="mr-1 inline" /> Retry
                </Button>
              </div>
            ) : positions.length === 0 ? (
              <div
                style={{
                  padding: '32px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                }}
              >
                No active positions. Open a position via Order Entry.
              </div>
            ) : (
              <table className="terminal-table" data-testid="positions-table">
                <caption className="visually-hidden">Active Trading Positions</caption>
                <thead>
                  <tr>
                    <th scope="col">CONTRACT</th>
                    <th scope="col">SIZE</th>
                    <th scope="col">ENTRY PRICE</th>
                    <th scope="col">MARK PRICE</th>
                    <th scope="col">VALUE</th>
                    <th scope="col">LIQ. PRICE</th>
                    <th scope="col">MARGIN</th>
                    <th scope="col">UNREALIZED PnL (ROE %)</th>
                    <th scope="col" className="text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos) => {
                    const isClosing =
                      closePositionMutation.isPending &&
                      closePositionMutation.variables === pos.id

                    return (
                      <PositionRow
                        key={pos.id}
                        position={pos}
                        isClosing={isClosing}
                        onClose={(id) => closePositionMutation.mutate(id)}
                      />
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'orders' && (
          <div
            id="panel-orders"
            role="tabpanel"
            aria-labelledby="tab-orders"
            className="orders-table-wrapper"
          >
            {isOrdersLoading ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '32px',
                  gap: '8px',
                }}
              >
                <Spinner size="sm" />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Loading open orders…
                </span>
              </div>
            ) : isOrdersError ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--sell)' }}>
                <AlertCircle size={16} className="inline mr-1" />
                <span>
                  Failed to load open orders: {(ordersError as Error)?.message || 'Unknown error'}
                </span>
                <Button variant="ghost" size="sm" onClick={() => refetchOrders()} className="ml-2">
                  <RotateCcw size={12} className="mr-1 inline" /> Retry
                </Button>
              </div>
            ) : orders.length === 0 ? (
              <div
                style={{
                  padding: '32px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                }}
              >
                No open orders.
              </div>
            ) : (
              <table className="terminal-table" data-testid="open-orders-table">
                <caption className="visually-hidden">Open Orders</caption>
                <thead>
                  <tr>
                    <th scope="col">TIME</th>
                    <th scope="col">CONTRACT</th>
                    <th scope="col">TYPE</th>
                    <th scope="col">SIDE</th>
                    <th scope="col">PRICE</th>
                    <th scope="col">AMOUNT</th>
                    <th scope="col">FILLED</th>
                    <th scope="col">STATUS</th>
                    <th scope="col" className="text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(ord => {
                    const isCancelling =
                      cancelOrderMutation.isPending &&
                      cancelOrderMutation.variables?.orderId === ord.id

                    return (
                      <tr key={ord.id} data-testid={`order-row-${ord.id}`}>
                        <td className="font-mono text-neutral-400">
                          {formatTimestamp(ord.timestamp, 'time')}
                        </td>
                        <td className="font-bold">{ord.symbol}</td>
                        <td>{ord.type}</td>
                        <td>
                          <Badge variant={ord.side === 'buy' ? 'buy' : 'sell'}>
                            {ord.side.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="font-mono">${formatPrice(ord.price)}</td>
                        <td className="font-mono">{formatQuantity(ord.quantity, 2)}</td>
                        <td className="font-mono">{formatQuantity(ord.filledQuantity, 2)}</td>
                        <td>{renderStatusBadge(ord.status)}</td>
                        <td className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            isLoading={isCancelling}
                            disabled={ord.status === 'PENDING'}
                            onClick={() =>
                              cancelOrderMutation.mutate({
                                orderId: ord.id,
                                symbol: ord.symbol,
                              })
                            }
                            data-testid={`cancel-order-${ord.id}`}
                          >
                            Cancel
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'history' && (
          <div
            id="panel-history"
            role="tabpanel"
            aria-labelledby="tab-history"
            className="history-table-wrapper"
          >
            {isHistoryLoading ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '32px',
                  gap: '8px',
                }}
              >
                <Spinner size="sm" />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Loading order history…
                </span>
              </div>
            ) : isHistoryError ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--sell)' }}>
                <AlertCircle size={16} className="inline mr-1" />
                <span>
                  Failed to load history: {(historyError as Error)?.message || 'Unknown error'}
                </span>
                <Button variant="ghost" size="sm" onClick={() => refetchHistory()} className="ml-2">
                  <RotateCcw size={12} className="mr-1 inline" /> Retry
                </Button>
              </div>
            ) : orderHistory.length === 0 ? (
              <div
                style={{
                  padding: '32px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                }}
              >
                No order history recorded.
              </div>
            ) : (
              <table className="terminal-table" data-testid="order-history-table">
                <caption className="visually-hidden">Order History</caption>
                <thead>
                  <tr>
                    <th scope="col">TIME</th>
                    <th scope="col">CONTRACT</th>
                    <th scope="col">TYPE</th>
                    <th scope="col">SIDE</th>
                    <th scope="col">PRICE</th>
                    <th scope="col">AMOUNT</th>
                    <th scope="col">FILLED</th>
                    <th scope="col">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {orderHistory.map(ord => (
                    <tr key={ord.id} data-testid={`history-row-${ord.id}`}>
                      <td className="font-mono text-neutral-400">
                        {formatTimestamp(ord.timestamp, 'time')}
                      </td>
                      <td className="font-bold">{ord.symbol}</td>
                      <td>{ord.type}</td>
                      <td>
                        <Badge variant={ord.side === 'buy' ? 'buy' : 'sell'}>
                          {ord.side.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="font-mono">${formatPrice(ord.price)}</td>
                      <td className="font-mono">{formatQuantity(ord.quantity, 2)}</td>
                      <td className="font-mono">{formatQuantity(ord.filledQuantity, 2)}</td>
                      <td>{renderStatusBadge(ord.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'archive' && (
          <div id="panel-archive" role="tabpanel" aria-labelledby="tab-archive">
            <VirtualizedOrderArchive />
          </div>
        )}
        {tab === 'risk' && (
          <div id="panel-risk" role="tabpanel" aria-labelledby="tab-risk">
            <RiskAnalyticsPanel positions={positions} />
          </div>
        )}
      </div>
    </Card>
  )
}

export default PositionsView
