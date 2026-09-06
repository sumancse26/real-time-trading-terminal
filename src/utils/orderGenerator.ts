import type { ActiveOrder, OrderStatus, OrderType, Side } from '@/types/order'

const SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'ARB/USDT', 'DOGE/USDT']
const SIDES: Side[] = ['buy', 'sell']
const TYPES: OrderType[] = ['LIMIT', 'MARKET', 'STOP_LIMIT']
const STATUSES: OrderStatus[] = [
  'FILLED',
  'CANCELLED',
  'NEW',
  'REJECTED',
  'PARTIALLY_FILLED',
  'EXPIRED',
]

const BASE_PRICES: Record<string, number> = {
  'BTC/USDT': 64250,
  'ETH/USDT': 3445,
  'SOL/USDT': 168.5,
  'BNB/USDT': 608.0,
  'ARB/USDT': 1.15,
  'DOGE/USDT': 0.145,
}

/**
 * Fast deterministic pseudo-random number generator (Mulberry32)
 * Ensures reproducible 100,000 orders across test and production runs without memory spikes.
 */
function createPrng(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let cachedOrders100k: ActiveOrder[] | null = null

/**
 * Generates 100,000 realistic orders with deterministic pseudo-random values.
 * Uses cached instance after initial generation for instantaneous subsequent access.
 */
export function generate100kOrders(count: number = 100000): ActiveOrder[] {
  if (count === 100000 && cachedOrders100k && cachedOrders100k.length === 100000) {
    return cachedOrders100k
  }

  const prng = createPrng(42)
  const orders = new Array<ActiveOrder>(count)
  const now = Date.now()
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000

  for (let i = 0; i < count; i++) {
    const symbolIdx = Math.floor(prng() * SYMBOLS.length)
    const symbol = SYMBOLS[symbolIdx] ?? 'BTC/USDT'
    const basePrice = BASE_PRICES[symbol] ?? 100
    const priceVariance = (prng() - 0.5) * 0.1 * basePrice
    const price = Number((basePrice + priceVariance).toFixed(basePrice > 10 ? 2 : 4))

    const side = SIDES[Math.floor(prng() * SIDES.length)] ?? 'buy'
    const type = TYPES[Math.floor(prng() * TYPES.length)] ?? 'LIMIT'
    const status = STATUSES[Math.floor(prng() * STATUSES.length)] ?? 'FILLED'

    const quantity = Number((prng() * 5 + 0.01).toFixed(basePrice > 100 ? 3 : 1))
    let filledQuantity = 0
    if (status === 'FILLED') {
      filledQuantity = quantity
    } else if (status === 'PARTIALLY_FILLED') {
      filledQuantity = Number((quantity * (prng() * 0.7 + 0.1)).toFixed(3))
    }

    const timestamp = now - Math.floor(prng() * thirtyDaysMs)

    orders[i] = {
      id: `ord-100k-${(i + 1).toString().padStart(6, '0')}`,
      clientOrderId: `cl-ord-${(i + 1).toString().padStart(6, '0')}`,
      symbol,
      side,
      type,
      price,
      quantity,
      filledQuantity,
      status,
      timestamp,
      timeInForce: 'GTC',
    }
  }

  if (count === 100000) {
    cachedOrders100k = orders
  }

  return orders
}
