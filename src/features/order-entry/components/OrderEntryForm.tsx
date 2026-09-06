import React, { useState } from 'react'
import type { OrderType, Side } from '@/types/order'
import { useCreateOrderMutation } from '@/core/query'
import { useSelectedSymbol, useSelectedTicker } from '@/core/store/useMarketStore'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatPrice } from '@/utils/formatters'
import { SlidersHorizontal, ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface OrderEntryFormInnerProps {
  selectedSymbol: string
}

const OrderEntryFormInner: React.FC<OrderEntryFormInnerProps> = ({ selectedSymbol }) => {
  const selectedTicker = useSelectedTicker()

  const initialPrice = selectedTicker
    ? selectedTicker.lastPrice.toFixed(selectedTicker.lastPrice > 10 ? 2 : 4)
    : '64250.00'

  const [orderType, setOrderType] = useState<OrderType>('LIMIT')
  const [side, setSide] = useState<Side>('buy')
  const [price, setPrice] = useState<string>(initialPrice)
  const [amount, setAmount] = useState<string>('0.25')
  const [leverage, setLeverage] = useState<number>(20)
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; isError?: boolean } | null>(null)

  const createOrderMutation = useCreateOrderMutation()

  const numPrice = parseFloat(price) || 0
  const numAmount = parseFloat(amount) || 0
  const orderValue = numPrice * numAmount
  const requiredMargin = leverage > 0 ? orderValue / leverage : orderValue

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (numAmount <= 0) {
      setFeedbackMsg({ text: 'Please enter a valid quantity', isError: true })
      return
    }

    if (orderType === 'LIMIT' && numPrice <= 0) {
      setFeedbackMsg({ text: 'Please enter a valid price', isError: true })
      return
    }

    createOrderMutation.mutate(
      {
        symbol: selectedSymbol,
        side,
        type: orderType,
        price: orderType === 'MARKET' ? selectedTicker?.lastPrice ?? numPrice : numPrice,
        quantity: numAmount,
      },
      {
        onSuccess: order => {
          setFeedbackMsg({
            text: `Order submitted: ${order.side.toUpperCase()} ${order.quantity} ${baseAsset(selectedSymbol)} @ $${formatPrice(order.price)}`,
            isError: false,
          })
          setTimeout(() => setFeedbackMsg(null), 3500)
        },
        onError: err => {
          setFeedbackMsg({
            text: `Failed to place order: ${(err as Error).message}`,
            isError: true,
          })
        },
      }
    )
  }

  return (
    <form onSubmit={handleSubmit} className="order-entry-form" data-testid="order-entry-form">
      {/* Buy / Sell Switch */}
      <div className="side-toggle-group">
        <button
          type="button"
          className={`side-btn buy-tab ${side === 'buy' ? 'active' : ''}`}
          onClick={() => setSide('buy')}
        >
          <ArrowUpRight size={14} />
          BUY / LONG
        </button>
        <button
          type="button"
          className={`side-btn sell-tab ${side === 'sell' ? 'active' : ''}`}
          onClick={() => setSide('sell')}
        >
          <ArrowDownRight size={14} />
          SELL / SHORT
        </button>
      </div>

      {/* Order Type Tabs */}
      <div className="type-tabs">
        {(['LIMIT', 'MARKET', 'STOP_LIMIT'] as OrderType[]).map(t => (
          <button
            key={t}
            type="button"
            className={`type-tab ${orderType === t ? 'active' : ''}`}
            onClick={() => setOrderType(t)}
          >
            {t.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Price Input */}
      {orderType !== 'MARKET' && (
        <div className="input-group">
          <label className="input-label" htmlFor="order-price">
            Price
          </label>
          <div className="input-field-wrapper">
            <input
              id="order-price"
              type="number"
              step="0.1"
              value={price}
              onChange={e => setPrice(e.target.value)}
              className="trade-input"
              placeholder="0.00"
              required
            />
            <span className="input-suffix">USDT</span>
          </div>
        </div>
      )}

      {/* Quantity Input */}
      <div className="input-group">
        <label className="input-label" htmlFor="order-amount">
          Size
        </label>
        <div className="input-field-wrapper">
          <input
            id="order-amount"
            type="number"
            step="0.001"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="trade-input"
            placeholder="0.00"
            required
          />
          <span className="input-suffix">{baseAsset(selectedSymbol)}</span>
        </div>
      </div>

      {/* Percentage Quick-Fill Buttons */}
      <div className="percentage-row">
        {[25, 50, 75, 100].map(pct => (
          <button
            key={pct}
            type="button"
            className="pct-btn"
            onClick={() => setAmount(((1.2 * pct) / 100).toFixed(3))}
          >
            {pct}%
          </button>
        ))}
      </div>

      {/* Leverage Slider */}
      <div className="leverage-control">
        <div className="flex justify-between text-xs text-neutral-400 mb-1">
          <span>Leverage</span>
          <span className="font-mono text-cyan-accent">{leverage}x</span>
        </div>
        <input
          type="range"
          min="1"
          max="100"
          value={leverage}
          onChange={e => setLeverage(Number(e.target.value))}
          className="leverage-slider"
          aria-label="Leverage Slider"
        />
      </div>

      {/* Order Cost Estimates */}
      <div className="order-summary-box">
        <div className="summary-row">
          <span className="summary-label">Order Value</span>
          <span className="summary-val font-mono">${orderValue.toFixed(2)}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Required Margin</span>
          <span className="summary-val font-mono">${requiredMargin.toFixed(2)}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Est. Fee (0.02%)</span>
          <span className="summary-val font-mono">${(orderValue * 0.0002).toFixed(2)}</span>
        </div>
      </div>

      {/* Submit Execution Button */}
      <Button
        type="submit"
        variant={side === 'buy' ? 'buy' : 'sell'}
        size="lg"
        className="w-full mt-2"
        isLoading={createOrderMutation.isPending}
      >
        {side === 'buy' ? 'BUY / LONG' : 'SELL / SHORT'} {baseAsset(selectedSymbol)}
      </Button>

      {feedbackMsg && (
        <div
          className={feedbackMsg.isError ? 'order-error-banner' : 'order-success-banner'}
          style={{
            padding: '6px 10px',
            marginTop: '8px',
            borderRadius: '4px',
            fontSize: '0.75rem',
            textAlign: 'center',
            background: feedbackMsg.isError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            color: feedbackMsg.isError ? 'var(--sell)' : 'var(--buy)',
            border: `1px solid ${feedbackMsg.isError ? 'var(--sell)' : 'var(--buy)'}`,
          }}
        >
          {feedbackMsg.text}
        </div>
      )}
    </form>
  )
}

export const OrderEntryForm: React.FC = () => {
  const selectedSymbol = useSelectedSymbol()

  return (
    <Card
      title={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={14} className="text-cyan-accent" />
            <span>ORDER ENTRY</span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-cyan-accent font-mono border border-neutral-700">
            20x CROSS
          </span>
        </div>
      }
      className="order-entry-card"
    >
      <OrderEntryFormInner key={selectedSymbol} selectedSymbol={selectedSymbol} />
    </Card>
  )
}

function baseAsset(symbol: string): string {
  return symbol.split('/')[0] || symbol
}
