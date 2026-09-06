import { describe, it, expect } from 'vitest'
import {
  isObject,
  isNonEmptyString,
  isFiniteNumber,
  isPositiveNumber,
  isNonNegativeNumber,
  isSide,
  isOrderType,
  isOrderStatus,
  isTimeInForce,
  isKlineInterval,
  isPositionSide,
  isMarginMode,
  isMarketTicker,
  isTradeTick,
  isBestBidOffer,
  isPriceLevel,
  isBookDeltaEntry,
  isOrderBookSnapshot,
  isOrderBookDelta,
  isCandle,
  isActiveOrder,
  isOrderFill,
  isPosition,
  isAssetBalance,
  isAccountSummary,
  isSymbolInfo,
  isWsServerMessage,
  isWsClientMessage,
  isWsTickerMessage,
  isWsTradeMessage,
  isWsBookSnapshotMessage,
  isWsBookDeltaMessage,
  isWsKlineMessage,
  isWsExecutionReportMessage,
  isWsOrderUpdateMessage,
  isWsPositionUpdateMessage,
  isWsAccountUpdateMessage,
  isWsPongMessage,
  isWsErrorMessage,
} from '../types/guards'

describe('Domain Type Guards — Primitives & Enums', () => {
  it('correctly checks isObject', () => {
    expect(isObject({})).toBe(true)
    expect(isObject({ a: 1 })).toBe(true)
    expect(isObject([])).toBe(false)
    expect(isObject(null)).toBe(false)
    expect(isObject(undefined)).toBe(false)
    expect(isObject('string')).toBe(false)
    expect(isObject(123)).toBe(false)
  })

  it('correctly checks isNonEmptyString', () => {
    expect(isNonEmptyString('BTC/USDT')).toBe(true)
    expect(isNonEmptyString(' ')).toBe(false)
    expect(isNonEmptyString('')).toBe(false)
    expect(isNonEmptyString(null)).toBe(false)
    expect(isNonEmptyString(123)).toBe(false)
  })

  it('correctly checks finite and positive numbers, rejecting NaN/Infinity', () => {
    expect(isFiniteNumber(123.45)).toBe(true)
    expect(isFiniteNumber(0)).toBe(true)
    expect(isFiniteNumber(-50)).toBe(true)
    expect(isFiniteNumber(NaN)).toBe(false)
    expect(isFiniteNumber(Infinity)).toBe(false)
    expect(isFiniteNumber(-Infinity)).toBe(false)
    expect(isFiniteNumber('100')).toBe(false)

    expect(isPositiveNumber(10)).toBe(true)
    expect(isPositiveNumber(0)).toBe(false)
    expect(isPositiveNumber(-1)).toBe(false)

    expect(isNonNegativeNumber(0)).toBe(true)
    expect(isNonNegativeNumber(10)).toBe(true)
    expect(isNonNegativeNumber(-1)).toBe(false)
  })

  it('validates domain enums', () => {
    expect(isSide('buy')).toBe(true)
    expect(isSide('sell')).toBe(true)
    expect(isSide('BUY')).toBe(false)
    expect(isSide('hold')).toBe(false)

    expect(isOrderType('LIMIT')).toBe(true)
    expect(isOrderType('MARKET')).toBe(true)
    expect(isOrderType('STOP_LIMIT')).toBe(true)
    expect(isOrderType('INVALID')).toBe(false)

    expect(isOrderStatus('NEW')).toBe(true)
    expect(isOrderStatus('FILLED')).toBe(true)
    expect(isOrderStatus('PARTIALLY_FILLED')).toBe(true)
    expect(isOrderStatus('PENDING')).toBe(false)

    expect(isTimeInForce('GTC')).toBe(true)
    expect(isTimeInForce('IOC')).toBe(true)
    expect(isTimeInForce('FOK')).toBe(true)
    expect(isTimeInForce('DAY')).toBe(false)

    expect(isKlineInterval('1m')).toBe(true)
    expect(isKlineInterval('1h')).toBe(true)
    expect(isKlineInterval('1d')).toBe(true)
    expect(isKlineInterval('2m')).toBe(false)

    expect(isPositionSide('LONG')).toBe(true)
    expect(isPositionSide('SHORT')).toBe(true)
    expect(isPositionSide('BOTH')).toBe(true)
    expect(isPositionSide('NEUTRAL')).toBe(false)

    expect(isMarginMode('ISOLATED')).toBe(true)
    expect(isMarginMode('CROSS')).toBe(true)
    expect(isMarginMode('PORTFOLIO')).toBe(false)
  })
})

describe('Domain Type Guards — Market Data & Orders', () => {
  it('validates MarketTicker', () => {
    const validTicker = {
      symbol: 'BTC/USDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      lastPrice: 64250.5,
      priceChange24h: 1250.0,
      priceChangePercent24h: 1.98,
      high24h: 65100.0,
      low24h: 62900.0,
      volume24h: 18450.2,
      turnover24h: 1185420000.0,
    }
    expect(isMarketTicker(validTicker)).toBe(true)
    expect(isMarketTicker({ ...validTicker, lastPrice: NaN })).toBe(false)
    expect(isMarketTicker({ ...validTicker, symbol: '' })).toBe(false)
    expect(isMarketTicker(null)).toBe(false)
  })

  it('validates TradeTick', () => {
    const validTrade = {
      id: 'trade-001',
      symbol: 'BTC/USDT',
      price: 64250.0,
      size: 0.125,
      side: 'buy',
      timestamp: 1717000000000,
    }
    expect(isTradeTick(validTrade)).toBe(true)
    expect(isTradeTick({ ...validTrade, size: 0 })).toBe(false)
    expect(isTradeTick({ ...validTrade, side: 'other' })).toBe(false)
    expect(isTradeTick(undefined)).toBe(false)
  })

  it('validates BestBidOffer', () => {
    const validBbo = {
      symbol: 'BTC/USDT',
      bidPrice: 64249.5,
      bidSize: 1.5,
      askPrice: 64250.0,
      askSize: 2.1,
      timestamp: 1717000000000,
    }
    expect(isBestBidOffer(validBbo)).toBe(true)
    expect(isBestBidOffer({ ...validBbo, bidPrice: '64249.5' })).toBe(false)
  })

  it('validates OrderBookSnapshot and OrderBookDelta', () => {
    const validLevel = { price: 64200, size: 1.5, total: 1.5, percentDepth: 25.0 }
    expect(isPriceLevel(validLevel)).toBe(true)
    expect(isPriceLevel({ price: 64200, size: -1, total: 1.5, percentDepth: 25.0 })).toBe(false)

    const validSnapshot = {
      symbol: 'BTC/USDT',
      sequence: 10502,
      timestamp: 1717000000000,
      bids: [validLevel],
      asks: [validLevel],
      spread: 0.5,
      spreadPercentage: 0.0008,
    }
    expect(isOrderBookSnapshot(validSnapshot)).toBe(true)
    expect(isOrderBookSnapshot({ ...validSnapshot, bids: [{ invalid: true }] })).toBe(false)

    expect(isBookDeltaEntry([64250.0, 1.25])).toBe(true)
    expect(isBookDeltaEntry([64250.0, -1])).toBe(false)
    expect(isBookDeltaEntry([64250.0])).toBe(false)

    const validDelta = {
      symbol: 'BTC/USDT',
      sequence: 10503,
      prevSequence: 10502,
      timestamp: 1717000000050,
      bids: [[64250.0, 2.0]],
      asks: [[64255.0, 0.0]],
    }
    expect(isOrderBookDelta(validDelta)).toBe(true)
  })

  it('validates Candle', () => {
    const validCandle = {
      time: 1717000000000,
      open: 64000,
      high: 64500,
      low: 63900,
      close: 64250,
      volume: 450.2,
    }
    expect(isCandle(validCandle)).toBe(true)
    expect(isCandle({ ...validCandle, close: NaN })).toBe(false)
  })

  it('validates ActiveOrder, OrderFill and Position', () => {
    const validOrder = {
      id: 'ord-101',
      symbol: 'BTC/USDT',
      side: 'buy',
      type: 'LIMIT',
      price: 63500.0,
      quantity: 0.5,
      filledQuantity: 0.0,
      status: 'NEW',
      timestamp: 1717000000000,
    }
    expect(isActiveOrder(validOrder)).toBe(true)
    expect(isActiveOrder({ ...validOrder, quantity: -1 })).toBe(false)

    const validFill = {
      id: 'fill-1',
      orderId: 'ord-101',
      symbol: 'BTC/USDT',
      side: 'buy',
      price: 63500.0,
      quantity: 0.5,
      fee: 0.000375,
      feeAsset: 'BTC',
      timestamp: 1717000005000,
    }
    expect(isOrderFill(validFill)).toBe(true)

    const validPosition = {
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
    }
    expect(isPosition(validPosition)).toBe(true)
    expect(isPosition({ ...validPosition, leverage: -5 })).toBe(false)
  })

  it('validates AssetBalance and AccountSummary', () => {
    const validBalance = { asset: 'USDT', free: 25000, locked: 3450.8, total: 28450.8 }
    expect(isAssetBalance(validBalance)).toBe(true)

    const validAccount = {
      accountId: 'acc-main',
      accountType: 'MARGIN',
      totalEquity: 28450.8,
      availableMargin: 25000.0,
      initialMargin: 3450.8,
      maintenanceMargin: 1725.4,
      unrealizedPnl: 705.0,
      marginRatio: 12.13,
      balances: [validBalance],
      canTrade: true,
      canWithdraw: true,
      updateTime: 1717000000000,
    }
    expect(isAccountSummary(validAccount)).toBe(true)
    expect(isAccountSummary({ ...validAccount, balances: ['invalid'] })).toBe(false)
  })

  it('validates SymbolInfo with filters', () => {
    const validSymbolInfo = {
      symbol: 'BTC/USDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      status: 'TRADING',
      type: 'PERPETUAL',
      priceFilter: { minPrice: 0.1, maxPrice: 1000000, tickSize: 0.1 },
      lotSizeFilter: { minQty: 0.001, maxQty: 1000, stepSize: 0.001 },
      notionalFilter: { minNotional: 5.0 },
      baseAssetPrecision: 3,
      quoteAssetPrecision: 2,
    }
    expect(isSymbolInfo(validSymbolInfo)).toBe(true)
    expect(isSymbolInfo({ ...validSymbolInfo, priceFilter: null })).toBe(false)
  })
})

describe('Domain Type Guards — WebSocket Discriminated Unions', () => {
  it('narrows incoming WebSocket messages correctly', () => {
    const tickerMsg = {
      type: 'ticker',
      symbol: 'BTC/USDT',
      data: {
        symbol: 'BTC/USDT',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        lastPrice: 64250.0,
        priceChange24h: 500,
        priceChangePercent24h: 0.8,
        high24h: 65000,
        low24h: 63000,
        volume24h: 1200,
        turnover24h: 77000000,
      },
      timestamp: 1717000000000,
    }
    expect(isWsTickerMessage(tickerMsg)).toBe(true)
    expect(isWsServerMessage(tickerMsg)).toBe(true)

    const tradeMsg = {
      type: 'trade',
      symbol: 'BTC/USDT',
      data: {
        id: 't-1',
        symbol: 'BTC/USDT',
        price: 64250,
        size: 0.5,
        side: 'buy',
        timestamp: 1717000000000,
      },
      timestamp: 1717000000000,
    }
    expect(isWsTradeMessage(tradeMsg)).toBe(true)
    expect(isWsServerMessage(tradeMsg)).toBe(true)

    const bookSnapMsg = {
      type: 'book_snapshot',
      symbol: 'BTC/USDT',
      data: {
        symbol: 'BTC/USDT',
        sequence: 100,
        timestamp: 1717000000000,
        bids: [{ price: 64000, size: 1, total: 1, percentDepth: 50 }],
        asks: [{ price: 64001, size: 1, total: 1, percentDepth: 50 }],
        spread: 1,
        spreadPercentage: 0.001,
      },
      timestamp: 1717000000000,
    }
    expect(isWsBookSnapshotMessage(bookSnapMsg)).toBe(true)
    expect(isWsServerMessage(bookSnapMsg)).toBe(true)

    const bookDeltaMsg = {
      type: 'book_delta',
      symbol: 'BTC/USDT',
      data: {
        symbol: 'BTC/USDT',
        sequence: 101,
        prevSequence: 100,
        timestamp: 1717000000000,
        bids: [[64000, 2]],
        asks: [[64001, 1.5]],
      },
      timestamp: 1717000000000,
    }
    expect(isWsBookDeltaMessage(bookDeltaMsg)).toBe(true)
    expect(isWsServerMessage(bookDeltaMsg)).toBe(true)

    const klineMsg = {
      type: 'kline',
      symbol: 'BTC/USDT',
      interval: '1m',
      data: {
        time: 1717000000000,
        open: 64000,
        high: 64100,
        low: 63950,
        close: 64050,
        volume: 120,
      },
      timestamp: 1717000000000,
    }
    expect(isWsKlineMessage(klineMsg)).toBe(true)
    expect(isWsServerMessage(klineMsg)).toBe(true)

    const execReportMsg = {
      type: 'execution_report',
      data: {
        id: 'f-1',
        orderId: 'ord-1',
        symbol: 'BTC/USDT',
        side: 'buy',
        price: 64000,
        quantity: 0.5,
        fee: 0.0001,
        feeAsset: 'BTC',
        timestamp: 1717000000000,
      },
      timestamp: 1717000000000,
    }
    expect(isWsExecutionReportMessage(execReportMsg)).toBe(true)
    expect(isWsServerMessage(execReportMsg)).toBe(true)

    const orderUpdateMsg = {
      type: 'order_update',
      data: {
        id: 'ord-1',
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'LIMIT',
        price: 64000,
        quantity: 1,
        filledQuantity: 0.5,
        status: 'PARTIALLY_FILLED',
        timestamp: 1717000000000,
      },
      timestamp: 1717000000000,
    }
    expect(isWsOrderUpdateMessage(orderUpdateMsg)).toBe(true)
    expect(isWsServerMessage(orderUpdateMsg)).toBe(true)

    const posUpdateMsg = {
      type: 'position_update',
      data: {
        id: 'pos-1',
        symbol: 'BTC/USDT',
        side: 'LONG',
        size: 0.5,
        entryPrice: 64000,
        markPrice: 64100,
        liquidationPrice: 60000,
        unrealizedPnl: 50,
        unrealizedPnlPercent: 1.5,
        margin: 1600,
        leverage: 20,
      },
      timestamp: 1717000000000,
    }
    expect(isWsPositionUpdateMessage(posUpdateMsg)).toBe(true)
    expect(isWsServerMessage(posUpdateMsg)).toBe(true)

    const accUpdateMsg = {
      type: 'account_update',
      data: {
        accountId: 'acc-1',
        accountType: 'SPOT',
        totalEquity: 50000,
        availableMargin: 50000,
        initialMargin: 0,
        maintenanceMargin: 0,
        unrealizedPnl: 0,
        marginRatio: 0,
        balances: [{ asset: 'USDT', free: 50000, locked: 0, total: 50000 }],
        canTrade: true,
        canWithdraw: true,
        updateTime: 1717000000000,
      },
      timestamp: 1717000000000,
    }
    expect(isWsAccountUpdateMessage(accUpdateMsg)).toBe(true)
    expect(isWsServerMessage(accUpdateMsg)).toBe(true)

    const pongMsg = { type: 'pong', timestamp: 1717000000000 }
    expect(isWsPongMessage(pongMsg)).toBe(true)
    expect(isWsServerMessage(pongMsg)).toBe(true)

    const errorMsg = { type: 'error', code: 4001, message: 'Invalid payload', timestamp: 1717000000000 }
    expect(isWsErrorMessage(errorMsg)).toBe(true)
    expect(isWsServerMessage(errorMsg)).toBe(true)

    expect(isWsServerMessage({ type: 'unknown_type' })).toBe(false)
  })

  it('validates client outgoing messages', () => {
    expect(isWsClientMessage({ action: 'subscribe', channels: ['ticker', 'depth'] })).toBe(true)
    expect(isWsClientMessage({ action: 'ping', timestamp: 1717000000000 })).toBe(true)
    expect(isWsClientMessage({ action: 'auth', token: 'jwt-xyz' })).toBe(true)
    expect(isWsClientMessage({ action: 'create_order', payload: { symbol: 'BTC/USDT' } })).toBe(true)
    expect(isWsClientMessage({ action: 'unknown_action' })).toBe(false)
  })
})
