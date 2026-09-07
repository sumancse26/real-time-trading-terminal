import React, { useState } from 'react'
import { useSelectedTicker } from '@/core/store/useMarketStore'
import { useErrorLogStore } from '@/core/store/useErrorLogStore'
import { Badge } from '@/components/ui/Badge'
import { ConnectionStatusIndicator } from './ConnectionStatusIndicator'
import { formatPrice, formatPercent, formatVolume, formatQuantity } from '@/utils/formatters'
import { Activity, ShieldCheck, Zap, Bell, Volume2, Command, AlertTriangle, X } from 'lucide-react'

export interface TerminalHeaderProps {
  onOpenShortcuts?: () => void
}

export const TerminalHeader: React.FC<TerminalHeaderProps> = ({ onOpenShortcuts }) => {
  const ticker = useSelectedTicker()
  const errorLogs = useErrorLogStore((s) => s.logs)
  const unreadErrors = useErrorLogStore((s) => s.unreadCount)
  const clearLogs = useErrorLogStore((s) => s.clearLogs)
  const markAllRead = useErrorLogStore((s) => s.markAllRead)
  const [showErrorDrawer, setShowErrorDrawer] = useState(false)

  const isPositive = (ticker?.priceChangePercent24h ?? 0) >= 0

  const baseAsset = ticker?.baseAsset ?? 'BTC'
  const quoteAsset = ticker?.quoteAsset ?? 'USDT'
  const lastPrice = ticker?.lastPrice ?? 64250.0
  const priceChangePercent = ticker?.priceChangePercent24h ?? 2.95
  const high24h = ticker?.high24h ?? 65120.0
  const low24h = ticker?.low24h ?? 62410.0
  const volume24h = ticker?.volume24h ?? 42890.45
  const turnover24h = ticker?.turnover24h ?? 2758410290

  const toggleErrorDrawer = () => {
    if (!showErrorDrawer) {
      markAllRead()
    }
    setShowErrorDrawer(!showErrorDrawer)
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
          <ConnectionStatusIndicator />
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
          <button
            type="button"
            className={`icon-btn ${unreadErrors > 0 ? 'text-warning relative' : ''}`}
            onClick={toggleErrorDrawer}
            title={`System Logs (${errorLogs.length} events)`}
            aria-label="System Logs"
            data-testid="error-log-btn"
          >
            <Bell size={16} />
            {unreadErrors > 0 && (
              <span className="notification-dot" data-testid="error-unread-count">
                {unreadErrors}
              </span>
            )}
          </button>
          <button className="icon-btn" title="Audio Alerts" aria-label="Audio Alerts">
            <Volume2 size={16} />
          </button>
          <button
            className="icon-btn"
            onClick={onOpenShortcuts}
            title="Keyboard Shortcuts (Press ?)"
            aria-label="Keyboard Shortcuts"
            data-testid="open-shortcuts-btn"
          >
            <Command size={16} />
          </button>
          <div className="user-profile">
            <span className="user-avatar">TR</span>
            <span className="user-tier">PRO TIER</span>
          </div>
        </div>
      </div>

      {/* System Error & Resilience Event Drawer */}
      {showErrorDrawer && (
        <div className="system-log-drawer" data-testid="system-log-drawer">
          <div className="drawer-header">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-warning" />
              <span className="font-semibold text-sm">System Event & Resilience Log</span>
            </div>
            <div className="flex items-center gap-2">
              {errorLogs.length > 0 && (
                <button
                  type="button"
                  className="drawer-clear-btn"
                  onClick={clearLogs}
                  data-testid="clear-logs-btn"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setShowErrorDrawer(false)}
                aria-label="Close logs"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="drawer-content">
            {errorLogs.length === 0 ? (
              <div className="drawer-empty-state">
                <span className="text-neutral text-xs">No runtime errors or dropped packets recorded.</span>
              </div>
            ) : (
              <div className="log-list">
                {errorLogs.map((log) => (
                  <div key={log.id} className={`log-item log-${log.severity.toLowerCase()}`}>
                    <div className="log-meta">
                      <span className="log-source">[{log.source}]</span>
                      <span className="log-time">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="log-message">{log.message}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

