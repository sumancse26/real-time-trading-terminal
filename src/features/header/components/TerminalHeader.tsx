import React from 'react'
import { useSelectedTicker } from '@/core/store/useMarketStore'
import { useConnectionStatus, useConnectionLatency } from '@/core/store/useConnectionStore'
import { Badge } from '@/components/ui/Badge'
import { formatPrice, formatPercent, formatVolume, formatQuantity } from '@/utils/formatters'
import { Activity, ShieldCheck, Zap, Bell, Volume2, Wifi, WifiOff } from 'lucide-react'

export const TerminalHeader: React.FC = () => {
  const ticker = useSelectedTicker()
  const connectionStatus = useConnectionStatus()
  const latency = useConnectionLatency()

  const isPositive = (ticker?.priceChangePercent24h ?? 0) >= 0

  const baseAsset = ticker?.baseAsset ?? 'BTC'
  const quoteAsset = ticker?.quoteAsset ?? 'USDT'
  const lastPrice = ticker?.lastPrice ?? 64250.0
  const priceChangePercent = ticker?.priceChangePercent24h ?? 2.95
  const high24h = ticker?.high24h ?? 65120.0
  const low24h = ticker?.low24h ?? 62410.0
  const volume24h = ticker?.volume24h ?? 42890.45
  const turnover24h = ticker?.turnover24h ?? 2758410290

  const renderConnectionBadge = () => {
    switch (connectionStatus) {
      case 'CONNECTED':
        return (
          <Badge variant="cyan" className="connection-badge">
            <Wifi size={12} className="inline mr-1" />
            WS LIVE ({latency}ms)
          </Badge>
        )
      case 'RECONNECTING':
        return (
          <Badge variant="warning" className="connection-badge">
            <Wifi size={12} className="inline mr-1" />
            RECONNECTING…
          </Badge>
        )
      case 'CONNECTING':
        return (
          <Badge variant="neutral" className="connection-badge">
            <Wifi size={12} className="inline mr-1" />
            CONNECTING…
          </Badge>
        )
      case 'DEGRADED':
        return (
          <Badge variant="warning" className="connection-badge">
            <Wifi size={12} className="inline mr-1" />
            WS DEGRADED
          </Badge>
        )
      case 'ERROR':
      case 'DISCONNECTED':
      default:
        return (
          <Badge variant="sell" className="connection-badge">
            <WifiOff size={12} className="inline mr-1" />
            WS OFFLINE
          </Badge>
        )
    }
  }

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
            <span className="symbol-base">{baseAsset}</span>
            <span className="symbol-quote">/{quoteAsset}</span>
            <span className="symbol-badge">PERP</span>
          </div>
          <div className="price-container">
            <span className={`main-price ${isPositive ? 'text-buy' : 'text-sell'}`}>
              ${formatPrice(lastPrice)}
            </span>
            <span
              className={`price-change ${isPositive ? 'bg-buy-subtle text-buy' : 'bg-sell-subtle text-sell'}`}
            >
              {formatPercent(priceChangePercent, { includeSign: true, decimals: 2 })}
            </span>
          </div>
        </div>

        <div className="market-stats-strip">
          <div className="stat-item">
            <span className="stat-label">24h High</span>
            <span className="stat-value">${formatPrice(high24h)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">24h Low</span>
            <span className="stat-value">${formatPrice(low24h)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">24h Vol ({baseAsset})</span>
            <span className="stat-value">{formatQuantity(volume24h, 2)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">24h Turnover</span>
            <span className="stat-value">{formatVolume(turnover24h)}</span>
          </div>
        </div>
      </div>

      <div className="header-right">
        <div className="status-indicators">
          {renderConnectionBadge()}
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
