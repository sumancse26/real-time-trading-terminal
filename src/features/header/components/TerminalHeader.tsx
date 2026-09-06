import React, { useEffect, useState } from 'react'
import type { MarketTicker } from '@/types/market'
import { feedSimulator } from '@/core/stream/mockFeed'
import { Badge } from '@/components/ui/Badge'
import { Activity, ShieldCheck, Zap, Bell, Volume2, Wifi } from 'lucide-react'

export const TerminalHeader: React.FC = () => {
  const [ticker, setTicker] = useState<MarketTicker>({
    symbol: 'BTC/USDT',
    baseAsset: 'BTC',
    quoteAsset: 'USDT',
    lastPrice: 64250.0,
    priceChange24h: 1845.2,
    priceChangePercent24h: 2.95,
    high24h: 65120.0,
    low24h: 62410.0,
    volume24h: 42890.45,
    turnover24h: 2758410290,
  })

  useEffect(() => {
    const unsub = feedSimulator.onTicker(newTicker => {
      setTicker(newTicker)
    })
    return unsub
  }, [])

  const isPositive = ticker.priceChangePercent24h >= 0

  return (
    <header className="terminal-header" data-testid="terminal-header">
      <div className="header-left">
        <div className="brand-badge">
          <Zap className="brand-icon" size={18} />
          <span className="brand-name">NEXUS</span>
          <span className="brand-tag">TERMINAL</span>
        </div>

        <div className="ticker-selector">
          <div className="symbol-pair">
            <span className="symbol-base">{ticker.baseAsset}</span>
            <span className="symbol-quote">/{ticker.quoteAsset}</span>
            <span className="symbol-badge">PERP</span>
          </div>
          <div className="price-container">
            <span className={`main-price ${isPositive ? 'text-buy' : 'text-sell'}`}>
              ${ticker.lastPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <span
              className={`price-change ${isPositive ? 'bg-buy-subtle text-buy' : 'bg-sell-subtle text-sell'}`}
            >
              {isPositive ? '+' : ''}
              {ticker.priceChangePercent24h.toFixed(2)}%
            </span>
          </div>
        </div>

        <div className="market-stats-strip">
          <div className="stat-item">
            <span className="stat-label">24h High</span>
            <span className="stat-value">
              ${ticker.high24h.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">24h Low</span>
            <span className="stat-value">
              ${ticker.low24h.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">24h Vol (BTC)</span>
            <span className="stat-value">
              {ticker.volume24h.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">24h Turnover</span>
            <span className="stat-value">${(ticker.turnover24h / 1e6).toFixed(2)}M</span>
          </div>
        </div>
      </div>

      <div className="header-right">
        <div className="status-indicators">
          <Badge variant="cyan" className="connection-badge">
            <Wifi size={12} className="inline mr-1" />
            WS LIVE (12ms)
          </Badge>
          <Badge variant="neutral" className="engine-badge">
            <Activity size={12} className="inline mr-1" />
            L2 ORDERBOOK
          </Badge>
          <Badge variant="buy" className="security-badge">
            <ShieldCheck size={12} className="inline mr-1" />
            MATCH ENGINE OK
          </Badge>
        </div>

        <div className="header-actions">
          <button className="icon-btn" title="Audio Alerts" aria-label="Audio Alerts">
            <Volume2 size={16} />
          </button>
          <button className="icon-btn" title="Notifications" aria-label="Notifications">
            <Bell size={16} />
          </button>
          <div className="user-profile">
            <span className="user-avatar">TR</span>
            <span className="user-tier">PRO TIER</span>
          </div>
        </div>
      </div>
    </header>
  )
}
