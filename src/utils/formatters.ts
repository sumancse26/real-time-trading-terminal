/**
 * Domain-specific formatting utilities for financial and trading metrics.
 */

/**
 * Formats a numeric price based on its magnitude.
 * Automatically handles crypto micro-prices (< 1) and standard prices.
 */
export function formatPrice(
  price: number | null | undefined,
  minDecimals?: number,
  maxDecimals?: number
): string {
  if (price === null || price === undefined || !Number.isFinite(price)) {
    return '--'
  }

  if (minDecimals !== undefined && maxDecimals !== undefined) {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: minDecimals,
      maximumFractionDigits: maxDecimals,
    })
  }

  if (price >= 1000) {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }
  if (price >= 1) {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })
  }
  if (price >= 0.0001) {
    return price.toFixed(4)
  }
  return price.toFixed(6)
}

/**
 * Formats a percentage change with optional sign (+) prefix.
 */
export function formatPercent(
  value: number | null | undefined,
  options: { includeSign?: boolean; decimals?: number } = {}
): string {
  const { includeSign = true, decimals = 2 } = options

  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '--%'
  }

  const sign = includeSign && value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

/**
 * Formats a volume or currency amount in compact notation (K, M, B, T).
 */
export function formatVolume(
  volume: number | null | undefined,
  prefix: string = '$'
): string {
  if (volume === null || volume === undefined || !Number.isFinite(volume)) {
    return `${prefix}0.00`
  }

  const abs = Math.abs(volume)
  const sign = volume < 0 ? '-' : ''

  if (abs >= 1e12) {
    return `${sign}${prefix}${(abs / 1e12).toFixed(2)}T`
  }
  if (abs >= 1e9) {
    return `${sign}${prefix}${(abs / 1e9).toFixed(2)}B`
  }
  if (abs >= 1e6) {
    return `${sign}${prefix}${(abs / 1e6).toFixed(2)}M`
  }
  if (abs >= 1e3) {
    return `${sign}${prefix}${(abs / 1e3).toFixed(2)}K`
  }

  return `${sign}${prefix}${abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/**
 * Formats order/position quantity with proper decimal precision.
 */
export function formatQuantity(
  qty: number | null | undefined,
  precision: number = 4
): string {
  if (qty === null || qty === undefined || !Number.isFinite(qty)) {
    return '--'
  }
  return qty.toFixed(precision)
}

/**
 * Formats a standard currency value with 2 decimal places.
 */
export function formatCurrency(
  value: number | null | undefined,
  currency: string = 'USDT'
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return `-- ${currency}`
  }
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`
}

/**
 * Formats unix timestamps into time, date, or full strings.
 */
export function formatTimestamp(
  timestamp: number | null | undefined,
  mode: 'time' | 'date' | 'full' = 'time'
): string {
  if (!timestamp || !Number.isFinite(timestamp)) {
    return '--:--:--'
  }

  const date = new Date(timestamp)
  if (isNaN(date.getTime())) {
    return '--:--:--'
  }

  switch (mode) {
    case 'time':
      return date.toLocaleTimeString('en-US', { hour12: false })
    case 'date':
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    case 'full':
      return `${date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })} ${date.toLocaleTimeString('en-US', { hour12: false })}`
  }
}

/**
 * Formats a raw byte count into human-readable data size (B, KB, MB, GB, TB).
 */
export function formatBytes(
  bytes: number | null | undefined,
  decimals: number = 2
): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes <= 0) {
    return '0 B'
  }

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)

  if (i === 0) {
    return `${Math.round(bytes)} B`
  }

  return `${(bytes / Math.pow(k, i)).toFixed(decimals)} ${sizes[i]}`
}

