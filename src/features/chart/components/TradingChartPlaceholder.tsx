import React, { useState, useMemo, memo } from 'react'
import type { Candle, ChartTimeframe } from '@/types/chart'
import { useSelectedSymbol, useTicker } from '@/core/store/useMarketStore'
import { useChartCandlesQuery } from '@/core/query/hooks/useMarketQueries'
import { Card } from '@/components/ui/Card'
import { formatPrice, formatPercent } from '@/utils/formatters'
import {
  CandlestickChart,
  BarChart2,
  TrendingUp,
  Maximize2,
  AlertTriangle,
  RefreshCw,
  Clock,
} from 'lucide-react'

const TIMEFRAMES: ChartTimeframe[] = ['1D', '1W', '1M', '3M', '1Y']
const INDICATORS = ['EMA (20, 50)', 'VOL', 'RSI', 'MACD']

const CHART_WIDTH = 800
const CHART_HEIGHT = 220
const VOL_HEIGHT = 44

interface HistoricalLayerProps {
  candles: Candle[]
  minPrice: number
  maxPrice: number
  showEma: boolean
  baseAsset: string
}

/**
 * Historical Layer (React.memo):
 * Renders static historical candles, gridlines, axes, and EMA curve.
 * Avoids rebuilding or re-reconciling when live price ticks arrive.
 */
const HistoricalLayer: React.FC<HistoricalLayerProps> = memo(
  ({ candles, minPrice, maxPrice, showEma }) => {
    const priceRange = maxPrice - minPrice || 1
    const candleWidth = Math.max(4, Math.min(16, (CHART_WIDTH - 40) / candles.length - 4))
    const stepX = (CHART_WIDTH - 40) / Math.max(1, candles.length)

    // Calculate EMA curve points
    const emaPath = useMemo(() => {
      if (!showEma || candles.length < 2) return ''
      const k = 2 / (20 + 1)
      let ema = candles[0]?.close ?? 0
      const points: string[] = []

      candles.forEach((c, i) => {
        ema = c.close * k + ema * (1 - k)
        const x = 20 + i * stepX + candleWidth / 2
        const y = CHART_HEIGHT - ((ema - minPrice) / priceRange) * (CHART_HEIGHT - 30) - 15
        points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`)
      })

      return points.join(' ')
    }, [candles, showEma, minPrice, priceRange, stepX, candleWidth])

    // Price grid levels
    const gridLevels = useMemo(() => {
      const count = 4
      return Array.from({ length: count + 1 }).map((_, i) => {
        const p = minPrice + (priceRange * i) / count
        const y = CHART_HEIGHT - (i / count) * (CHART_HEIGHT - 30) - 15
        return { price: p, y }
      })
    }, [minPrice, priceRange])

    return (
      <g className="historical-layer">
        {/* Grid lines */}
        {gridLevels.map((lvl, idx) => (
          <g key={`grid-${idx}`}>
            <line
              x1="0"
              y1={lvl.y}
              x2={CHART_WIDTH}
              y2={lvl.y}
              stroke="#151d30"
              strokeDasharray="3 4"
            />
            <text
              x={CHART_WIDTH - 5}
              y={lvl.y - 3}
              textAnchor="end"
              fill="#52617a"
              fontSize="9"
              fontFamily="JetBrains Mono, monospace"
            >
              ${formatPrice(lvl.price)}
            </text>
          </g>
        ))}

        {/* Vertical time grid */}
        {[0.2, 0.4, 0.6, 0.8].map((pct, i) => (
          <line
            key={`vgrid-${i}`}
            x1={pct * CHART_WIDTH}
            y1="0"
            x2={pct * CHART_WIDTH}
            y2={CHART_HEIGHT}
            stroke="#151d30"
            strokeDasharray="3 4"
          />
        ))}

        {/* EMA Line */}
        {showEma && emaPath && (
          <path
            d={emaPath}
            fill="none"
            stroke="url(#emaGradient)"
            strokeWidth="1.75"
            strokeLinecap="round"
            opacity="0.8"
          />
        )}

        {/* Historical Candlesticks (all except active last candle) */}
        {candles.slice(0, -1).map((c, i) => {
          const isUp = c.close >= c.open
          const color = isUp ? '#00e599' : '#ff3b69'
          const x = 20 + i * stepX
          const openY = CHART_HEIGHT - ((c.open - minPrice) / priceRange) * (CHART_HEIGHT - 30) - 15
          const closeY = CHART_HEIGHT - ((c.close - minPrice) / priceRange) * (CHART_HEIGHT - 30) - 15
          const highY = CHART_HEIGHT - ((c.high - minPrice) / priceRange) * (CHART_HEIGHT - 30) - 15
          const lowY = CHART_HEIGHT - ((c.low - minPrice) / priceRange) * (CHART_HEIGHT - 30) - 15

          const topY = Math.min(openY, closeY)
          const barHeight = Math.max(2, Math.abs(openY - closeY))

          return (
            <g key={`candle-${c.time}-${i}`} className="candle-group">
              {/* Wick */}
              <line
                x1={x + candleWidth / 2}
                y1={highY}
                x2={x + candleWidth / 2}
                y2={lowY}
                stroke={color}
                strokeWidth="1.25"
              />
              {/* Body */}
              <rect
                x={x}
                y={topY}
                width={candleWidth}
                height={barHeight}
                fill={color}
                rx="1"
                opacity={isUp ? 0.9 : 0.85}
              />
            </g>
          )
        })}
      </g>
    )
  }
)

HistoricalLayer.displayName = 'HistoricalLayer'

export const TradingChartPlaceholder: React.FC = () => {
  const selectedSymbol = useSelectedSymbol()
  const liveTicker = useTicker(selectedSymbol)
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('1D')
  const [activeIndicators, setActiveIndicators] = useState<string[]>(['EMA (20, 50)', 'VOL'])
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [crosshair, setCrosshair] = useState<{ x: number; y: number } | null>(null)

  const {
    data: rawCandles,
    isLoading,
    isError,
    error,
    refetch,
  } = useChartCandlesQuery(selectedSymbol, timeframe, 35)

  const baseAsset = selectedSymbol.split('/')[0] ?? 'BTC'
  const quoteAsset = selectedSymbol.split('/')[1] ?? 'USDT'

  const livePrice = liveTicker?.lastPrice

  // Integrate live ticker price seamlessly into the active candle
  const candles = useMemo(() => {
    if (!rawCandles || rawCandles.length === 0) return []
    const copy = [...rawCandles]
    const lastIdx = copy.length - 1
    const last = copy[lastIdx]

    if (last && livePrice !== undefined) {
      copy[lastIdx] = {
        ...last,
        close: livePrice,
        high: Math.max(last.high, livePrice),
        low: Math.min(last.low, livePrice),
      }
    }

    return copy
  }, [rawCandles, livePrice])

  // Price bounds
  const { minPrice, maxPrice } = useMemo(() => {
    if (candles.length === 0) return { minPrice: 63000, maxPrice: 65000 }
    let min = Infinity
    let max = -Infinity

    for (const c of candles) {
      if (c.low < min) min = c.low
      if (c.high > max) max = c.high
    }

    const padding = (max - min) * 0.08 || 50
    return {
      minPrice: Math.max(0.0001, min - padding),
      maxPrice: max + padding,
    }
  }, [candles])

  const priceRange = maxPrice - minPrice || 1
  const candleWidth = Math.max(4, Math.min(16, (CHART_WIDTH - 40) / Math.max(1, candles.length) - 4))
  const stepX = (CHART_WIDTH - 40) / Math.max(1, candles.length)

  const activeCandle = candles[candles.length - 1]
  const displayCandle = hoveredIndex !== null && candles[hoveredIndex] ? candles[hoveredIndex] : activeCandle
  const currentPrice = liveTicker?.lastPrice ?? activeCandle?.close ?? 64250.0

  const toggleIndicator = (ind: string) => {
    setActiveIndicators(prev =>
      prev.includes(ind) ? prev.filter(i => i !== ind) : [...prev, ind]
    )
  }

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * CHART_WIDTH
    const y = ((e.clientY - rect.top) / rect.height) * CHART_HEIGHT

    setCrosshair({ x, y })
    const idx = Math.floor((x - 20) / stepX)
    if (idx >= 0 && idx < candles.length) {
      setHoveredIndex(idx)
    } else {
      setHoveredIndex(null)
    }
  }

  const handleMouseLeave = () => {
    setCrosshair(null)
    setHoveredIndex(null)
  }

  // Active candle coordinate
  const activeCandleIdx = candles.length - 1
  const activeX = 20 + activeCandleIdx * stepX
  const activePriceY =
    CHART_HEIGHT - ((currentPrice - minPrice) / priceRange) * (CHART_HEIGHT - 30) - 15

  const isPositive = displayCandle ? displayCandle.close >= displayCandle.open : true
  const changePercent = displayCandle
    ? ((displayCandle.close - displayCandle.open) / displayCandle.open) * 100
    : 0

  return (
    <Card
      title={
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold">
            <CandlestickChart size={14} className="text-cyan-accent" />
            <span>
              {baseAsset}/{quoteAsset} PERPETUAL
            </span>
          </div>

          <div className="timeframe-group" data-testid="chart-timeframe-group">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf}
                type="button"
                className={`tf-btn ${timeframe === tf ? 'active' : ''}`}
                onClick={() => setTimeframe(tf)}
                data-testid={`timeframe-${tf}`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      }
      headerAction={
        <div className="flex items-center gap-2">
          {INDICATORS.map(ind => (
            <button
              key={ind}
              type="button"
              className={`indicator-toggle-btn ${activeIndicators.includes(ind) ? 'active' : ''}`}
              onClick={() => toggleIndicator(ind)}
              data-testid={`indicator-${ind}`}
            >
              {ind}
            </button>
          ))}
          <button className="icon-btn" title="Full Screen" aria-label="Full Screen">
            <Maximize2 size={13} />
          </button>
        </div>
      }
      className="chart-card"
    >
      <div className="chart-container" data-testid="trading-chart">
        {/* OHLC HUD */}
        <div className="chart-hud" data-testid="chart-hud">
          <div className="hud-metric">
            <span className="hud-label">O:</span>
            <span className={isPositive ? 'text-buy' : 'text-sell'}>
              {displayCandle ? formatPrice(displayCandle.open) : '—'}
            </span>
          </div>
          <div className="hud-metric">
            <span className="hud-label">H:</span>
            <span className="text-buy">
              {displayCandle ? formatPrice(displayCandle.high) : '—'}
            </span>
          </div>
          <div className="hud-metric">
            <span className="hud-label">L:</span>
            <span className="text-sell">
              {displayCandle ? formatPrice(displayCandle.low) : '—'}
            </span>
          </div>
          <div className="hud-metric">
            <span className="hud-label">C:</span>
            <span className={isPositive ? 'text-buy' : 'text-sell'}>
              {displayCandle ? formatPrice(displayCandle.close) : '—'}
            </span>
          </div>
          <div className="hud-metric">
            <span className="hud-label">Change:</span>
            <span className={isPositive ? 'text-buy' : 'text-sell'}>
              {formatPercent(changePercent, { includeSign: true, decimals: 2 })}
            </span>
          </div>
          {displayCandle && (
            <div className="hud-metric">
              <span className="hud-label">Vol:</span>
              <span className="text-neutral-300">{displayCandle.volume.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="chart-loading-overlay" data-testid="chart-loading">
            <div className="chart-shimmer-grid">
              <RefreshCw className="animate-spin text-cyan-accent mb-2" size={24} />
              <span className="text-xs text-muted font-mono">
                Loading {timeframe} historical chart for {selectedSymbol}…
              </span>
            </div>
          </div>
        )}

        {/* Error State */}
        {isError && !isLoading && (
          <div className="chart-error-overlay" data-testid="chart-error">
            <AlertTriangle size={24} className="text-sell mb-2" />
            <span className="text-xs text-sell font-bold mb-1">
              Failed to load chart candles
            </span>
            <span className="text-xs text-muted mb-3 font-mono">
              {(error as Error)?.message || 'Network error occurred while fetching OHLCV data'}
            </span>
            <button
              type="button"
              className="btn btn-primary text-xs flex items-center gap-1.5"
              onClick={() => refetch()}
              data-testid="chart-retry-btn"
            >
              <RefreshCw size={12} />
              <span>Retry Loading Chart</span>
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !isError && candles.length === 0 && (
          <div className="chart-empty-overlay" data-testid="chart-empty">
            <Clock size={24} className="text-muted mb-2" />
            <span className="text-xs text-muted">
              No candlestick data available for {selectedSymbol} ({timeframe})
            </span>
          </div>
        )}

        {/* Main chart canvas (Decoupled 2-Layer SVG) */}
        {!isLoading && !isError && candles.length > 0 && (
          <div className="chart-canvas-area">
            <svg
              className="chart-svg"
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              preserveAspectRatio="none"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              data-testid="chart-svg"
            >
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00f3ff" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#00f3ff" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="emaGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#9b59ff" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#00f3ff" stopOpacity="0.7" />
                </linearGradient>
              </defs>

              {/* Layer 1: Static Historical Candles & Grid (Memoized) */}
              <HistoricalLayer
                candles={candles}
                minPrice={minPrice}
                maxPrice={maxPrice}
                showEma={activeIndicators.includes('EMA (20, 50)')}
                baseAsset={baseAsset}
              />

              {/* Layer 2: Dynamic Live Active Candle (Rightmost bar) */}
              {activeCandle && (
                <g className="live-active-candle-group">
                  {(() => {
                    const isUp = activeCandle.close >= activeCandle.open
                    const color = isUp ? '#00e599' : '#ff3b69'
                    const openY =
                      CHART_HEIGHT -
                      ((activeCandle.open - minPrice) / priceRange) * (CHART_HEIGHT - 30) -
                      15
                    const closeY =
                      CHART_HEIGHT -
                      ((activeCandle.close - minPrice) / priceRange) * (CHART_HEIGHT - 30) -
                      15
                    const highY =
                      CHART_HEIGHT -
                      ((activeCandle.high - minPrice) / priceRange) * (CHART_HEIGHT - 30) -
                      15
                    const lowY =
                      CHART_HEIGHT -
                      ((activeCandle.low - minPrice) / priceRange) * (CHART_HEIGHT - 30) -
                      15

                    const topY = Math.min(openY, closeY)
                    const barHeight = Math.max(2, Math.abs(openY - closeY))

                    return (
                      <>
                        {/* Wick */}
                        <line
                          x1={activeX + candleWidth / 2}
                          y1={highY}
                          x2={activeX + candleWidth / 2}
                          y2={lowY}
                          stroke={color}
                          strokeWidth="1.5"
                        />
                        {/* Body with active pulse glow */}
                        <rect
                          x={activeX}
                          y={topY}
                          width={candleWidth}
                          height={barHeight}
                          fill={color}
                          rx="1"
                          style={{
                            filter: `drop-shadow(0 0 4px ${isUp ? 'rgba(0, 229, 153, 0.6)' : 'rgba(255, 59, 105, 0.6)'})`,
                          }}
                        />
                      </>
                    )
                  })()}
                </g>
              )}

              {/* Crosshair Overlay */}
              {crosshair && (
                <g className="crosshair-group">
                  <line
                    x1="0"
                    y1={crosshair.y}
                    x2={CHART_WIDTH}
                    y2={crosshair.y}
                    stroke="rgba(0, 243, 255, 0.4)"
                    strokeDasharray="2 2"
                  />
                  <line
                    x1={crosshair.x}
                    y1="0"
                    x2={crosshair.x}
                    y2={CHART_HEIGHT}
                    stroke="rgba(0, 243, 255, 0.4)"
                    strokeDasharray="2 2"
                  />
                </g>
              )}
            </svg>

            {/* Dynamic Live Price Line & Tag Overlay */}
            <div
              className="current-price-line"
              style={{
                top: `${Math.max(4, Math.min(CHART_HEIGHT - 10, activePriceY))}px`,
              }}
            >
              <span
                className={`live-price-tag ${
                  activeCandle && activeCandle.close >= activeCandle.open ? 'bg-buy' : 'bg-sell'
                }`}
                data-testid="live-price-tag"
              >
                ${formatPrice(currentPrice)}
              </span>
            </div>
          </div>
        )}

        {/* Volume Subchart */}
        {activeIndicators.includes('VOL') && candles.length > 0 && (
          <div className="volume-subchart" data-testid="volume-subchart">
            <BarChart2 size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <svg width="100%" height={VOL_HEIGHT} style={{ flex: 1 }}>
              {candles.map((c, i) => {
                const maxVol = Math.max(...candles.map(item => item.volume), 100)
                const barH = Math.round((c.volume / maxVol) * (VOL_HEIGHT - 6))
                const x = (i / candles.length) * 100 + '%'
                const isUp = c.close >= c.open
                const fill = isUp ? '#00e599' : '#ff3b69'

                return (
                  <rect
                    key={`vol-${c.time}-${i}`}
                    x={x}
                    y={VOL_HEIGHT - barH}
                    width={`${Math.max(1, (100 / candles.length) * 0.7)}%`}
                    height={barH}
                    fill={fill}
                    opacity={i === candles.length - 1 ? 0.9 : 0.55}
                    rx="1"
                  />
                )
              })}
            </svg>
            <TrendingUp size={12} className="text-buy" style={{ flexShrink: 0 }} />
            <span
              style={{
                fontSize: '0.6875rem',
                color: 'var(--text-muted)',
                flexShrink: 0,
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              Vol: {activeCandle ? activeCandle.volume.toFixed(1) : '—'}
            </span>
          </div>
        )}
      </div>
    </Card>
  )
}

export default TradingChartPlaceholder
