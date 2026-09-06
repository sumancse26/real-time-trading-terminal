import React, { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { CandlestickChart, BarChart2, TrendingUp, Maximize2 } from 'lucide-react'

const CANDLES = [
  { x: 20,  o: 230, c: 215, h: 245, l: 205, up: true  },
  { x: 58,  o: 215, c: 228, h: 235, l: 210, up: false },
  { x: 96,  o: 228, c: 195, h: 232, l: 190, up: true  },
  { x: 134, o: 195, c: 210, h: 218, l: 188, up: false },
  { x: 172, o: 210, c: 175, h: 215, l: 170, up: true  },
  { x: 210, o: 175, c: 160, h: 180, l: 155, up: true  },
  { x: 248, o: 160, c: 182, h: 188, l: 150, up: false },
  { x: 286, o: 182, c: 145, h: 185, l: 140, up: true  },
  { x: 324, o: 145, c: 130, h: 150, l: 125, up: true  },
  { x: 362, o: 130, c: 144, h: 148, l: 122, up: false },
  { x: 400, o: 144, c: 110, h: 148, l: 105, up: true  },
  { x: 438, o: 110, c: 122, h: 126, l: 100, up: false },
  { x: 476, o: 122, c: 95,  h: 126, l: 90,  up: true  },
  { x: 514, o: 95,  c: 80,  h: 100, l: 75,  up: true  },
  { x: 552, o: 80,  c: 94,  h: 97,  l: 75,  up: false },
  { x: 590, o: 94,  c: 68,  h: 96,  l: 65,  up: true  },
  { x: 628, o: 68,  c: 58,  h: 72,  l: 52,  up: true  },
  { x: 666, o: 58,  c: 62,  h: 68,  l: 52,  up: false },
  { x: 704, o: 62,  c: 50,  h: 65,  l: 44,  up: true  },
  { x: 742, o: 50,  c: 42,  h: 53,  l: 38,  up: true  },
]

const VOLUME_BARS = [18, 32, 22, 41, 28, 37, 19, 45, 33, 27, 52, 38, 29, 44, 35, 48, 22, 31, 55, 40]

export const TradingChartPlaceholder: React.FC = () => {
  const [timeframe, setTimeframe] = useState<string>('15m')
  const [activeIndicators, setActiveIndicators] = useState<string[]>(['EMA (20, 50)', 'VOL'])

  const toggleIndicator = (ind: string) => {
    setActiveIndicators(prev =>
      prev.includes(ind) ? prev.filter(i => i !== ind) : [...prev, ind],
    )
  }

  return (
    <Card
      title={
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 font-bold">
            <CandlestickChart size={14} className="text-cyan-accent" />
            <span>BTC/USDT PERPETUAL</span>
          </div>

          <div className="timeframe-group">
            {['1m', '5m', '15m', '1h', '4h', '1D'].map(tf => (
              <button
                key={tf}
                type="button"
                className={`tf-btn ${timeframe === tf ? 'active' : ''}`}
                onClick={() => setTimeframe(tf)}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      }
      headerAction={
        <div className="flex items-center gap-2">
          {['EMA (20, 50)', 'RSI', 'MACD', 'VOL'].map(ind => (
            <button
              key={ind}
              type="button"
              className={`indicator-toggle-btn ${activeIndicators.includes(ind) ? 'active' : ''}`}
              onClick={() => toggleIndicator(ind)}
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
        <div className="chart-hud">
          <div className="hud-metric">
            <span className="hud-label">O:</span>
            <span className="text-buy">63,890.00</span>
          </div>
          <div className="hud-metric">
            <span className="hud-label">H:</span>
            <span className="text-buy">64,480.00</span>
          </div>
          <div className="hud-metric">
            <span className="hud-label">L:</span>
            <span className="text-sell">63,750.00</span>
          </div>
          <div className="hud-metric">
            <span className="hud-label">C:</span>
            <span className="text-buy">64,250.00</span>
          </div>
          <div className="hud-metric">
            <span className="hud-label">Change:</span>
            <span className="text-buy">+0.56%</span>
          </div>
        </div>

        {/* Main chart canvas */}
        <div className="chart-canvas-area">
          <svg className="chart-svg" viewBox="0 0 800 260" preserveAspectRatio="none">
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00f3ff" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#00f3ff" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="emaGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#9b59ff" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#00f3ff" stopOpacity="0.6" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            {[52, 104, 156, 208].map(y => (
              <line key={y} x1="0" y1={y} x2="800" y2={y} stroke="#1a2540" strokeDasharray="3 4" />
            ))}
            {[200, 400, 600].map(x => (
              <line key={x} x1={x} y1="0" x2={x} y2="260" stroke="#1a2540" strokeDasharray="3 4" />
            ))}

            {/* EMA ribbon (decorative) */}
            <path
              d="M 0 210 Q 100 195, 200 205 T 400 175 T 600 135 T 800 105"
              fill="none"
              stroke="url(#emaGradient)"
              strokeWidth="1.5"
              strokeDasharray="5 3"
              opacity="0.7"
            />

            {/* Price area fill */}
            <path
              d="M 0 215 Q 120 195, 200 210 T 400 170 T 600 125 T 800 95 L 800 260 L 0 260 Z"
              fill="url(#chartGradient)"
            />
            {/* Price line */}
            <path
              d="M 0 215 Q 120 195, 200 210 T 400 170 T 600 125 T 800 95"
              fill="none"
              stroke="#00f3ff"
              strokeWidth="1.5"
            />

            {/* Candlesticks */}
            {CANDLES.map((candle, i) => {
              const color = candle.up ? '#00e599' : '#ff3b69'
              const top = Math.min(candle.o, candle.c)
              const height = Math.max(3, Math.abs(candle.o - candle.c))
              return (
                <g key={i}>
                  <line
                    x1={candle.x + 9} y1={candle.h}
                    x2={candle.x + 9} y2={candle.l}
                    stroke={color} strokeWidth="1.5"
                  />
                  <rect x={candle.x} y={top} width="18" height={height} fill={color} rx="1" opacity="0.9" />
                </g>
              )
            })}
          </svg>

          {/* Current price overlay */}
          <div className="current-price-line">
            <span className="live-price-tag">$64,250.00</span>
          </div>
        </div>

        {/* Volume sub-chart — fixed height so it renders */}
        <div className="volume-subchart">
          <BarChart2 size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <svg width="100%" height="36" style={{ flex: 1 }}>
            {VOLUME_BARS.map((h, i) => {
              const barH = Math.round((h / 60) * 34)
              const x = i * (100 / VOLUME_BARS.length) + '%'
              const fill = i % 3 === 0 ? '#ff3b69' : '#00e599'
              return (
                <rect
                  key={i}
                  x={x}
                  y={36 - barH}
                  width="3.5%"
                  height={barH}
                  fill={fill}
                  opacity="0.55"
                  rx="1"
                />
              )
            })}
          </svg>
          <TrendingUp size={12} className="text-buy" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', flexShrink: 0 }}>
            Vol: 2.45K
          </span>
        </div>
      </div>
    </Card>
  )
}
