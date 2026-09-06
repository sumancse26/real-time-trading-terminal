import { describe, it, expect } from 'vitest'
import {
  formatPrice,
  formatPercent,
  formatVolume,
  formatQuantity,
  formatCurrency,
  formatTimestamp,
} from '../utils/formatters'

describe('Formatting Utilities', () => {
  describe('formatPrice', () => {
    it('formats large numbers (>= 1000) with 2 decimals and commas', () => {
      expect(formatPrice(64250.5)).toBe('64,250.50')
      expect(formatPrice(1000000)).toBe('1,000,000.00')
    })

    it('formats mid-range numbers (1 to 999.99)', () => {
      expect(formatPrice(168.42)).toBe('168.42')
      expect(formatPrice(1.245)).toBe('1.245')
    })

    it('formats crypto micro prices (< 1)', () => {
      expect(formatPrice(0.1684)).toBe('0.1684')
      expect(formatPrice(0.00004512)).toBe('0.000045')
    })

    it('handles explicit min/max decimals', () => {
      expect(formatPrice(64250.555, 3, 3)).toBe('64,250.555')
      expect(formatPrice(10, 2, 2)).toBe('10.00')
    })

    it('handles null, undefined, and non-finite numbers', () => {
      expect(formatPrice(null)).toBe('--')
      expect(formatPrice(undefined)).toBe('--')
      expect(formatPrice(NaN)).toBe('--')
      expect(formatPrice(Infinity)).toBe('--')
    })
  })

  describe('formatPercent', () => {
    it('formats positive percentages with + sign by default', () => {
      expect(formatPercent(2.954)).toBe('+2.95%')
      expect(formatPercent(0)).toBe('0.00%')
    })

    it('formats negative percentages', () => {
      expect(formatPercent(-1.25)).toBe('-1.25%')
    })

    it('respects options for sign and decimals', () => {
      expect(formatPercent(5.6789, { includeSign: false, decimals: 3 })).toBe('5.679%')
    })

    it('handles invalid numbers', () => {
      expect(formatPercent(null)).toBe('--%')
      expect(formatPercent(NaN)).toBe('--%')
    })
  })

  describe('formatVolume', () => {
    it('formats in compact notation (K, M, B, T)', () => {
      expect(formatVolume(2758410290)).toBe('$2.76B')
      expect(formatVolume(158700000)).toBe('$158.70M')
      expect(formatVolume(78500)).toBe('$78.50K')
      expect(formatVolume(500)).toBe('$500.00')
      expect(formatVolume(1.5e12)).toBe('$1.50T')
    })

    it('handles custom prefix and invalid values', () => {
      expect(formatVolume(1000000, '')).toBe('1.00M')
      expect(formatVolume(null)).toBe('$0.00')
      expect(formatVolume(NaN)).toBe('$0.00')
    })
  })

  describe('formatQuantity', () => {
    it('formats quantities with default 4 decimals', () => {
      expect(formatQuantity(0.5)).toBe('0.5000')
      expect(formatQuantity(1.23456, 2)).toBe('1.23')
      expect(formatQuantity(null)).toBe('--')
    })
  })

  describe('formatCurrency', () => {
    it('formats currency with symbol and code', () => {
      expect(formatCurrency(28450.8, 'USDT')).toBe('$28,450.80 USDT')
      expect(formatCurrency(null)).toBe('-- USDT')
    })
  })

  describe('formatTimestamp', () => {
    it('formats timestamps into time string', () => {
      const ts = 1717000000000
      expect(formatTimestamp(ts, 'time')).toMatch(/\d{2}:\d{2}:\d{2}/)
      expect(formatTimestamp(ts, 'date')).toMatch(/[A-Za-z]+ \d+/)
      expect(formatTimestamp(null)).toBe('--:--:--')
      expect(formatTimestamp(NaN)).toBe('--:--:--')
    })
  })
})
