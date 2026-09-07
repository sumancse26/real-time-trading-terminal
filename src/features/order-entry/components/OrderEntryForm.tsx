import React, { useState, useEffect, useId } from 'react'
import type { OrderType, Side } from '@/types/order'
import { useCreateOrderMutation } from '@/core/query'
import { useAccountSummaryQuery } from '@/core/query/hooks/useAccountQueries'
import { useSelectedSymbol, useSelectedTicker, useMarketStore } from '@/core/store/useMarketStore'
import { useErrorLogStore } from '@/core/store/useErrorLogStore'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatPrice } from '@/utils/formatters'
import {
  SlidersHorizontal,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  AlertCircle,
  CheckCircle2,
  Zap,
  CornerDownLeft,
} from 'lucide-react'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

interface OrderEntryFormInnerProps {
  selectedSymbol: string
}

const OrderEntryFormInner: React.FC<OrderEntryFormInnerProps> = ({ selectedSymbol }) => {
  const selectedTicker = useSelectedTicker()
  const { data: accountSummary } = useAccountSummaryQuery()

  const livePrice = selectedTicker?.lastPrice ?? 64250.0
  const initialPriceStr = livePrice.toFixed(livePrice > 10 ? 2 : 4)

  const [orderType, setOrderType] = useState<OrderType>('LIMIT')
  const [side, setSide] = useState<Side>('buy')
  const [price, setPrice] = useState<string>(initialPriceStr)
  const [amount, setAmount] = useState<string>('0.25')
  const [leverage, setLeverage] = useState<number>(20)
  const [feedbackMsg, setFeedbackMsg] = useState<{
    text: string
    isError?: boolean
    orderId?: string
  } | null>(null)
  const [flashSide, setFlashSide] = useState<'buy' | 'sell' | null>(null)

  const triggerSideFlash = (newSide: Side) => {
    setSide(newSide)
    setFlashSide(newSide)
    setTimeout(() => setFlashSide(null), 300)
  }

  // Reset / sync price when active selectedSymbol changes
  useEffect(() => {
    if (selectedTicker?.lastPrice) {
      setPrice(selectedTicker.lastPrice.toFixed(selectedTicker.lastPrice > 10 ? 2 : 4))
    }
  }, [selectedSymbol, selectedTicker?.lastPrice])

  // Sync prefilled price and quantity from Order Book click via store subscription
  useEffect(() => {
    let lastTs = 0
    const unsub = useMarketStore.subscribe((state) => {
      const prefill = state.orderFormPrefill
      if (prefill && prefill.timestamp && prefill.timestamp !== lastTs) {
        lastTs = prefill.timestamp
        if (prefill.price !== undefined) {
          setPrice(prefill.price.toFixed(prefill.price > 10 ? 2 : 4))
          setOrderType('LIMIT')
        }
        if (prefill.quantity !== undefined && prefill.quantity > 0) {
          setAmount(prefill.quantity.toFixed(3))
        }
      }
    })
    return unsub
  }, [])

  const priceInputId = useId()
  const amountInputId = useId()
  const leverageInputId = useId()

  const createOrderMutation = useCreateOrderMutation()

  const baseSymbol = selectedSymbol.split('/')[0] || 'BTC'
  const quoteSymbol = selectedSymbol.split('/')[1] || 'USDT'

  const numPrice = orderType === 'MARKET' ? livePrice : parseFloat(price) || 0
  const numAmount = parseFloat(amount) || 0

  // Financial Calculations
  const orderValue = numPrice * numAmount
  const feeRate = orderType === 'MARKET' ? 0.0004 : 0.0002 // 0.04% Taker vs 0.02% Maker
  const estFee = orderValue * feeRate
  const requiredMargin = leverage > 0 ? orderValue / leverage : orderValue
  const availableMargin = accountSummary?.availableMargin ?? 23091.05
  const totalOutlay = requiredMargin + estFee

  // Estimated Liquidation Price Calculation (Maintenance Margin Rate = 0.5%)
  const mmr = 0.005
  const estLiqPrice =
    numPrice > 0 && leverage > 0
      ? side === 'buy'
        ? Math.max(0, numPrice * (1 - 1 / leverage + mmr))
        : numPrice * (1 + 1 / leverage - mmr)
      : 0

  // Validation Rules
  const isPriceValid = orderType === 'MARKET' || (numPrice > 0 && Number.isFinite(numPrice))
  const isAmountValid = numAmount > 0 && Number.isFinite(numAmount)
  const isMinNotionalValid = orderValue >= 5.0 || numAmount === 0
  const hasSufficientBalance = totalOutlay <= availableMargin

  let validationError: string | null = null
  if (!isPriceValid) {
    validationError = 'Please enter a valid price (> 0)'
  } else if (!isAmountValid && amount !== '') {
    validationError = 'Please enter a valid quantity (> 0)'
  } else if (!isMinNotionalValid && numAmount > 0) {
    validationError = 'Order value must be at least $5.00'
  } else if (!hasSufficientBalance) {
    validationError = `Insufficient available margin (Need $${formatPrice(totalOutlay)}, Have $${formatPrice(availableMargin)})`
  }

  const isFormValid =
    isPriceValid && isAmountValid && isMinNotionalValid && hasSufficientBalance && numAmount > 0

  // Quick-fill percentage calculation
  const handleQuickFill = (pct: number) => {
    if (numPrice <= 0) return
    const maxAffordableNotional = availableMargin * leverage * (pct / 100)
    const maxQty = maxAffordableNotional / numPrice
    const precision = numPrice > 100 ? 3 : 4
    setAmount(Math.max(0.001, Number(maxQty.toFixed(precision))).toString())
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!isFormValid) {
      setFeedbackMsg({
        text: validationError || 'Please complete all required fields correctly',
        isError: true,
      })
      return
    }

    createOrderMutation.mutate(
      {
        symbol: selectedSymbol,
        side,
        type: orderType,
        price: numPrice,
        quantity: numAmount,
      },
      {
        onSuccess: order => {
          setFeedbackMsg({
            text: `Order #${order.id} placed successfully: ${order.side.toUpperCase()} ${order.quantity} ${baseSymbol} @ $${formatPrice(order.price)}`,
            isError: false,
            orderId: order.id,
          })
          setTimeout(() => setFeedbackMsg(null), 5000)
        },
        onError: err => {
          const errorMessage = (err as Error).message || 'Order rejected by exchange'
          useErrorLogStore.getState().logError(
            'OrderEntry',
            `Order placement failed: ${errorMessage}`,
            { symbol: selectedSymbol, side, type: orderType, price: numPrice, quantity: numAmount },
            'ERROR'
          )
          setFeedbackMsg({
            text: `Order placement failed: ${errorMessage}`,
            isError: true,
          })
        },
      }
    )
  }

  // Register Keyboard Shortcuts for Order Entry
  useKeyboardShortcuts({
    BUY: () => triggerSideFlash('buy'),
    SELL: () => triggerSideFlash('sell'),
    ORDER_TYPE_LIMIT: () => setOrderType('LIMIT'),
    ORDER_TYPE_MARKET: () => setOrderType('MARKET'),
    SUBMIT: (e) => {
      // If user presses Enter and the form is valid, submit
      if (isFormValid && !createOrderMutation.isPending) {
        e.preventDefault()
        handleSubmit(e as unknown as React.FormEvent)
      }
    },
    ESCAPE: () => {
      // Blur any focused input in the active document
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
    },
  })

  return (
    <form
      onSubmit={handleSubmit}
      className="order-entry-form"
      data-testid="order-entry-form"
      role="form"
      aria-label={`${selectedSymbol} Order Entry Form`}
    >
      {/* Buy / Sell Toggle Switch */}
      <div className="side-toggle-group" role="radiogroup" aria-label="Order Side">
        <button
          type="button"
          className={`side-btn buy-tab ${side === 'buy' ? 'active' : ''} ${flashSide === 'buy' ? 'hotkey-flash-buy' : ''}`}
          onClick={() => triggerSideFlash('buy')}
          role="radio"
          aria-checked={side === 'buy'}
          aria-label="BUY / LONG"
          data-testid="side-buy-btn"
        >
          <ArrowUpRight size={14} />
          <span>BUY / LONG</span>
          <kbd className="kbd-badge buy-kbd font-mono" title="Shortcut: Press B">B</kbd>
        </button>
        <button
          type="button"
          className={`side-btn sell-tab ${side === 'sell' ? 'active' : ''} ${flashSide === 'sell' ? 'hotkey-flash-sell' : ''}`}
          onClick={() => triggerSideFlash('sell')}
          role="radio"
          aria-checked={side === 'sell'}
          aria-label="SELL / SHORT"
          data-testid="side-sell-btn"
        >
          <ArrowDownRight size={14} />
          <span>SELL / SHORT</span>
          <kbd className="kbd-badge sell-kbd font-mono" title="Shortcut: Press S">S</kbd>
        </button>
      </div>

      {/* Order Type Tabs */}
      <div className="type-tabs" role="tablist" aria-label="Order Type">
        {(['LIMIT', 'MARKET', 'STOP_LIMIT'] as OrderType[]).map(t => (
          <button
            key={t}
            type="button"
            className={`type-tab ${orderType === t ? 'active' : ''}`}
            onClick={() => setOrderType(t)}
            role="tab"
            aria-selected={orderType === t}
            data-testid={`order-type-${t}`}
          >
            {t.replace('_', ' ')}
            {t === 'LIMIT' && <kbd className="kbd-badge ml-1 font-mono text-[9px]">L</kbd>}
            {t === 'MARKET' && <kbd className="kbd-badge ml-1 font-mono text-[9px]">M</kbd>}
          </button>
        ))}
      </div>

      {/* Price Input (Disabled for MARKET) */}
      <div className="input-group">
        <div className="flex justify-between items-center">
          <label className="input-label" htmlFor={priceInputId}>
            Order Price
          </label>
          {orderType === 'LIMIT' && (
            <button
              type="button"
              className="text-[10px] text-cyan-accent hover:underline cursor-pointer bg-transparent border-none p-0"
              onClick={() => setPrice(livePrice.toFixed(livePrice > 10 ? 2 : 4))}
            >
              Use Market Price
            </button>
          )}
        </div>

        {orderType === 'MARKET' ? (
          <div className="input-field-wrapper bg-neutral-900 border-neutral-700 opacity-90 cursor-not-allowed">
            <div className="flex items-center justify-between w-full py-2">
              <span className="text-xs text-neutral-300 font-mono flex items-center gap-1.5">
                <Zap size={12} className="text-cyan-accent" />
                Market Price (~${formatPrice(livePrice)})
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-accent font-bold">
                BEST EXECUTION
              </span>
            </div>
          </div>
        ) : (
          <div
            className={`input-field-wrapper ${!isPriceValid && price !== '' ? 'border-red-500' : ''}`}
          >
            <input
              id={priceInputId}
              type="number"
              step="any"
              value={price}
              onChange={e => setPrice(e.target.value)}
              className="trade-input"
              placeholder="0.00"
              aria-label="Price"
              aria-invalid={!isPriceValid}
              disabled={createOrderMutation.isPending}
              required
            />
            <span className="input-suffix">{quoteSymbol}</span>
          </div>
        )}
      </div>

      {/* Quantity / Size Input */}
      <div className="input-group">
        <div className="flex justify-between items-center">
          <label className="input-label" htmlFor={amountInputId}>
            Quantity ({baseSymbol})
          </label>
          <span className="text-[10px] text-neutral-400 font-mono">
            Min: 0.001 {baseSymbol}
          </span>
        </div>
        <div
          className={`input-field-wrapper ${
            (!isAmountValid && amount !== '') || !hasSufficientBalance ? 'border-red-500' : ''
          }`}
        >
          <input
            id={amountInputId}
            type="number"
            step="any"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="trade-input"
            placeholder="0.00"
            aria-label="Size"
            aria-invalid={!isAmountValid || !hasSufficientBalance}
            disabled={createOrderMutation.isPending}
            required
          />
          <span className="input-suffix">{baseSymbol}</span>
        </div>
      </div>

      {/* Percentage Quick-Fill Buttons */}
      <div className="percentage-row" aria-label="Quick Size Percentages">
        {[25, 50, 75, 100].map(pct => (
          <button
            key={pct}
            type="button"
            className="pct-btn"
            onClick={() => handleQuickFill(pct)}
            disabled={createOrderMutation.isPending}
            aria-label={`Set size to ${pct}% of available balance`}
          >
            {pct}%
          </button>
        ))}
      </div>

      {/* Leverage Slider & Controls */}
      <div className="leverage-control">
        <div className="flex justify-between items-center text-xs text-neutral-400 mb-1">
          <label htmlFor={leverageInputId} className="cursor-pointer">
            Leverage
          </label>
          <span className="font-mono text-cyan-accent font-bold">{leverage}x CROSS</span>
        </div>
        <input
          id={leverageInputId}
          type="range"
          min="1"
          max="100"
          value={leverage}
          onChange={e => setLeverage(Number(e.target.value))}
          className="leverage-slider"
          aria-label="Leverage Slider"
          disabled={createOrderMutation.isPending}
        />
      </div>

      {/* Financial Breakdown & Cost Estimation Table */}
      <div className="order-summary-box" data-testid="order-summary">
        <div className="summary-row">
          <span className="summary-label">Order Value (Notional)</span>
          <span className="summary-val font-mono">${formatPrice(orderValue)}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Initial Margin ({leverage}x)</span>
          <span className="summary-val font-mono text-neutral-200">
            ${formatPrice(requiredMargin)}
          </span>
        </div>
        <div className="summary-row">
          <span className="summary-label">
            Est. Fee ({orderType === 'MARKET' ? '0.04% Taker' : '0.02% Maker'})
          </span>
          <span className="summary-val font-mono text-neutral-400">
            ${estFee.toFixed(4)} {quoteSymbol}
          </span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Est. Liquidation Price</span>
          <span
            className={`summary-val font-mono ${
              side === 'buy' ? 'text-amber-400' : 'text-purple-400'
            }`}
          >
            {estLiqPrice > 0 ? `$${formatPrice(estLiqPrice)}` : '—'}
          </span>
        </div>
        <div className="summary-row" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 4 }}>
          <span className="summary-label font-bold text-neutral-300">Total Outlay Required</span>
          <span className="summary-val font-mono font-bold text-cyan-accent">
            ${formatPrice(totalOutlay)}
          </span>
        </div>
      </div>

      {/* Validation Error Alert */}
      {validationError && (
        <div
          className="flex items-center gap-1.5 p-2 rounded bg-red-950/40 border border-red-800 text-red-400 text-xs"
          role="alert"
          data-testid="order-validation-error"
        >
          <AlertCircle size={14} className="flex-shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Success Notification Banner */}
      {feedbackMsg && !feedbackMsg.isError && (
        <div
          className="flex items-center gap-1.5 p-2 rounded bg-emerald-950/40 border border-emerald-600 text-emerald-400 text-xs"
          role="status"
          data-testid="order-success-banner"
        >
          <CheckCircle2 size={14} className="flex-shrink-0" />
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Error Notification Banner */}
      {feedbackMsg && feedbackMsg.isError && (
        <div
          className="flex items-center gap-1.5 p-2 rounded bg-red-950/40 border border-red-600 text-red-400 text-xs"
          role="alert"
          data-testid="order-error-banner"
        >
          <AlertCircle size={14} className="flex-shrink-0" />
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Execution Submit Button */}
      <Button
        type="submit"
        variant={side === 'buy' ? 'buy' : 'sell'}
        size="lg"
        className="w-full font-bold flex items-center justify-center gap-2"
        disabled={!isFormValid || createOrderMutation.isPending}
        isLoading={createOrderMutation.isPending}
        data-testid="order-submit-btn"
      >
        <span>
          {createOrderMutation.isPending
            ? 'Placing Order…'
            : `${side === 'buy' ? 'BUY / LONG' : 'SELL / SHORT'} ${baseSymbol}`}
        </span>
        <kbd className="kbd-badge text-[9px] font-mono opacity-80" title="Shortcut: Press Enter to submit">
          <CornerDownLeft size={10} className="inline mr-0.5" />
          Enter
        </kbd>
      </Button>
    </form>
  )
}

export const OrderEntryForm: React.FC = () => {
  const selectedSymbol = useSelectedSymbol()
  const { data: accountSummary } = useAccountSummaryQuery()
  const availableMargin = accountSummary?.availableMargin ?? 23091.05

  return (
    <Card
      title={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 font-bold">
            <SlidersHorizontal size={14} className="text-cyan-accent" />
            <span>ORDER ENTRY</span>
          </div>
          <div
            className="flex items-center gap-1 text-[11px] text-neutral-400 font-mono bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800"
            title="Available Account Margin"
            data-testid="available-margin-badge"
          >
            <Wallet size={11} className="text-cyan-accent" />
            <span>${formatPrice(availableMargin)}</span>
          </div>
        </div>
      }
      className="order-entry-card"
    >
      <OrderEntryFormInner key={selectedSymbol} selectedSymbol={selectedSymbol} />
    </Card>
  )
}

export default OrderEntryForm
