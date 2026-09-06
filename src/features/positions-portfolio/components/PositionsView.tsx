import React, { useState } from 'react'
import {
  usePositionsQuery,
  useOpenOrdersQuery,
  useClosePositionMutation,
  useCancelOrderMutation,
} from '@/core/query'
import { useOrderHistoryQuery } from '@/core/query/hooks/useOrderQueries'
import { useAccountSummaryQuery } from '@/core/query/hooks/useAccountQueries'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import {
  formatPrice,
  formatPercent,
  formatQuantity,
  formatCurrency,
  formatTimestamp,
} from '@/utils/formatters'
import type { OrderStatus } from '@/types/order'
import {
  Wallet,
  Briefcase,
  ListFilter,
  History,
  RotateCcw,
  AlertCircle,
  Clock,
} from 'lucide-react'

export const PositionsView: React.FC = () => {
  const [tab, setTab] = useState<'positions' | 'orders' | 'history'>('positions')

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
        <div className="portfolio-tabs" data-testid="portfolio-tabs">
          <button
            type="button"
            className={`portfolio-tab-btn ${tab === 'positions' ? 'active' : ''}`}
            onClick={() => setTab('positions')}
            data-testid="tab-positions"
          >
            <Briefcase size={13} className="mr-1 inline" />
            POSITIONS ({positions.length})
          </button>
          <button
            type="button"
            className={`portfolio-tab-btn ${tab === 'orders' ? 'active' : ''}`}
            onClick={() => setTab('orders')}
            data-testid="tab-orders"
          >
            <ListFilter size={13} className="mr-1 inline" />
            OPEN ORDERS ({orders.length})
          </button>
          <button
            type="button"
            className={`portfolio-tab-btn ${tab === 'history' ? 'active' : ''}`}
            onClick={() => setTab('history')}
            data-testid="tab-history"
          >
            <History size={13} className="mr-1 inline" />
            ORDER HISTORY ({orderHistory.length})
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
          <div className="table-responsive">
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
                    const isClosing =
                      closePositionMutation.isPending &&
                      closePositionMutation.variables === pos.id

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
                        <td className="font-mono">{formatQuantity(pos.size, 2)}</td>
                        <td className="font-mono">${formatPrice(pos.entryPrice)}</td>
                        <td className="font-mono">${formatPrice(pos.markPrice)}</td>
                        <td className="font-mono text-warning">${formatPrice(pos.liquidationPrice)}</td>
                        <td className="font-mono">${formatPrice(pos.margin)}</td>
                        <td>
                          <div
                            className={`font-mono font-bold ${isProfitable ? 'text-buy' : 'text-sell'}`}
                          >
                            {isProfitable ? '+' : ''}${formatPrice(pos.unrealizedPnl)} (
                            {formatPercent(pos.unrealizedPnlPercent, {
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
                            onClick={() => closePositionMutation.mutate(pos.id)}
                          >
                            Market Close
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

        {tab === 'orders' && (
          <div className="table-responsive">
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
          <div className="table-responsive">
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
      </div>
    </Card>
  )
}

export default PositionsView
