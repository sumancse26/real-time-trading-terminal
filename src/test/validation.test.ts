import { describe, it, expect } from 'vitest'
import { validateExternal, parseJsonSafe, parseWsServerMessage } from '../types/validation'
import { isMarketTicker } from '../types/guards'

describe('Runtime Validation & Safe Parsers', () => {
  it('validateExternal returns success for valid payload', () => {
    const validData: unknown = {
      symbol: 'ETH/USDT',
      baseAsset: 'ETH',
      quoteAsset: 'USDT',
      lastPrice: 3450.0,
      priceChange24h: -50.0,
      priceChangePercent24h: -1.43,
      high24h: 3550.0,
      low24h: 3400.0,
      volume24h: 45000.0,
      turnover24h: 155250000.0,
    }

    const result = validateExternal(validData, isMarketTicker, 'MarketTicker')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.symbol).toBe('ETH/USDT')
      expect(result.data.lastPrice).toBe(3450.0)
    }
  })

  it('validateExternal returns error for null, undefined, or invalid shape', () => {
    const nullRes = validateExternal(null, isMarketTicker, 'MarketTicker')
    expect(nullRes.success).toBe(false)
    if (!nullRes.success) {
      expect(nullRes.error).toContain('null')
    }

    const invalidRes = validateExternal({ symbol: 'ETH/USDT' }, isMarketTicker, 'MarketTicker')
    expect(invalidRes.success).toBe(false)
    if (!invalidRes.success) {
      expect(invalidRes.error).toContain('MarketTicker')
      expect(invalidRes.details).toBeDefined()
    }
  })

  it('parseJsonSafe handles valid and malformed JSON strings safely without throwing', () => {
    const validJson = parseJsonSafe('{"symbol":"SOL/USDT","price":145.2}')
    expect(validJson.success).toBe(true)
    if (validJson.success) {
      expect((validJson.data as { symbol: string }).symbol).toBe('SOL/USDT')
    }

    const malformedJson = parseJsonSafe('{"unclosed_json": ')
    expect(malformedJson.success).toBe(false)
    if (!malformedJson.success) {
      expect(malformedJson.error).toContain('JSON parse error')
    }
  })

  it('parseWsServerMessage safely parses and validates incoming JSON string and objects', () => {
    const rawWsString = JSON.stringify({
      type: 'trade',
      symbol: 'BTC/USDT',
      data: {
        id: 't-99',
        symbol: 'BTC/USDT',
        price: 64200,
        size: 0.5,
        side: 'sell',
        timestamp: 1717000000000,
      },
      timestamp: 1717000000000,
    })

    const parsed = parseWsServerMessage(rawWsString)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.type).toBe('trade')
      if (parsed.data.type === 'trade') {
        expect(parsed.data.data.side).toBe('sell')
      }
    }

    const invalidWsString = JSON.stringify({
      type: 'trade',
      symbol: 'BTC/USDT',
      data: { invalid_trade: true },
      timestamp: 1717000000000,
    })

    const invalidParsed = parseWsServerMessage(invalidWsString)
    expect(invalidParsed.success).toBe(false)

    const badJson = parseWsServerMessage('{bad-json}')
    expect(badJson.success).toBe(false)
  })
})
