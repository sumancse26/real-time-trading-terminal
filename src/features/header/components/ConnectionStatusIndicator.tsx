import React, { useState, useRef, useEffect } from 'react'
import {
  useConnectionStatus,
  useConnectionLatency,
  useReconnectCountdown,
  useMalformedMessagesCount,
  useConnectionStore,
} from '@/core/store/useConnectionStore'
import { wsService } from '@/core/websocket/wsService'
import { Badge } from '@/components/ui/Badge'
import { formatBytes } from '@/utils/formatters'
import {
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  Radio,
  Sliders,
  X,
  Zap,
} from 'lucide-react'

export const ConnectionStatusIndicator: React.FC = () => {
  const status = useConnectionStatus()
  const latency = useConnectionLatency()
  const countdown = useReconnectCountdown()
  const malformedCount = useMalformedMessagesCount()
  const reconnectAttempts = useConnectionStore((s) => s.reconnectAttempts)
  const maxReconnectAttempts = useConnectionStore((s) => s.maxReconnectAttempts)
  const messagesReceived = useConnectionStore((s) => s.messagesReceived)
  const messagesSent = useConnectionStore((s) => s.messagesSent)
  const bytesReceived = useConnectionStore((s) => s.bytesReceived)
  const isOnline = useConnectionStore((s) => s.isOnline)
  const activeSubscriptions = useConnectionStore((s) => s.activeSubscriptions)

  const [isOpen, setIsOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleManualReconnect = (e: React.MouseEvent) => {
    e.stopPropagation()
    wsService.reconnectNow()
  }

  const renderBadge = () => {
    if (!isOnline) {
      return (
        <Badge variant="sell" className="connection-badge connection-badge-offline" data-testid="ws-offline-badge">
          <WifiOff size={12} className="inline mr-1" />
          OFFLINE
        </Badge>
      )
    }

    switch (status) {
      case 'CONNECTED':
        return (
          <Badge variant="cyan" className="connection-badge connection-badge-live" data-testid="ws-connected-badge">
            <span className="live-dot" />
            <Wifi size={12} className="inline mr-1" />
            WS LIVE ({latency}ms)
          </Badge>
        )

      case 'RECONNECTING':
        return (
          <div className="reconnecting-badge-wrapper" data-testid="ws-reconnecting-badge">
            <Badge variant="warning" className="connection-badge">
              <RefreshCw size={12} className="inline mr-1 animate-spin" />
              RETRY IN {countdown ?? 0}s ({reconnectAttempts}/{maxReconnectAttempts})
            </Badge>
            <button
              type="button"
              className="quick-reconnect-btn"
              onClick={handleManualReconnect}
              title="Immediate Reconnect"
              data-testid="reconnect-now-btn"
            >
              Retry Now
            </button>
          </div>
        )

      case 'CONNECTING':
        return (
          <Badge variant="neutral" className="connection-badge" data-testid="ws-connecting-badge">
            <RefreshCw size={12} className="inline mr-1 animate-spin" />
            CONNECTING…
          </Badge>
        )

      case 'DEGRADED':
        return (
          <Badge variant="warning" className="connection-badge" data-testid="ws-degraded-badge">
            <AlertTriangle size={12} className="inline mr-1" />
            WS DEGRADED ({latency}ms)
          </Badge>
        )

      case 'ERROR':
      case 'DISCONNECTED':
      default:
        return (
          <div className="reconnecting-badge-wrapper" data-testid="ws-disconnected-badge">
            <Badge variant="sell" className="connection-badge">
              <WifiOff size={12} className="inline mr-1" />
              WS DISCONNECTED
            </Badge>
            <button
              type="button"
              className="quick-reconnect-btn"
              onClick={handleManualReconnect}
              title="Connect to WebSocket"
              data-testid="connect-now-btn"
            >
              Connect
            </button>
          </div>
        )
    }
  }

  return (
    <div className="connection-indicator-container" ref={popoverRef}>
      <div
        role="button"
        tabIndex={0}
        className="connection-trigger-btn"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setIsOpen(!isOpen)
          }
        }}
        title="Network & Connection Diagnostics (Click for Details)"
        data-testid="connection-trigger-btn"
      >
        {renderBadge()}
      </div>

      {isOpen && (
        <div className="connection-popover" data-testid="connection-popover">
          <div className="popover-header">
            <div className="popover-title">
              <Radio size={14} className="text-cyan inline mr-1.5" />
              <span>WebSocket & Network Diagnostics</span>
            </div>
            <button
              type="button"
              className="popover-close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Close popover"
            >
              <X size={14} />
            </button>
          </div>

          <div className="popover-grid">
            <div className="popover-stat">
              <span className="stat-label">Connection Status</span>
              <span className={`stat-value font-mono ${status === 'CONNECTED' ? 'text-buy' : 'text-sell'}`}>
                {status}
              </span>
            </div>
            <div className="popover-stat">
              <span className="stat-label">RTT Latency</span>
              <span className="stat-value font-mono text-cyan">{latency} ms</span>
            </div>
            <div className="popover-stat">
              <span className="stat-label">Messages (In / Out)</span>
              <span className="stat-value font-mono">
                {messagesReceived.toLocaleString()} / {messagesSent.toLocaleString()}
              </span>
            </div>
            <div className="popover-stat">
              <span className="stat-label">Data Transferred</span>
              <span className="stat-value font-mono">{formatBytes(bytesReceived)}</span>
            </div>
            <div className="popover-stat">
              <span className="stat-label">Malformed Messages</span>
              <span className={`stat-value font-mono ${malformedCount > 0 ? 'text-warning' : 'text-neutral'}`}>
                {malformedCount}
              </span>
            </div>
            <div className="popover-stat">
              <span className="stat-label">Reconnect Policy</span>
              <span className="stat-value font-mono text-xs">
                1s &rarr; 2s &rarr; 4s &rarr; 8s &rarr; 16s (Max {maxReconnectAttempts})
              </span>
            </div>
          </div>

          <div className="popover-subscriptions">
            <span className="sub-header">Active Topics ({activeSubscriptions.length})</span>
            <div className="sub-tags">
              {activeSubscriptions.length > 0 ? (
                activeSubscriptions.map((sub) => (
                  <span key={sub} className="sub-tag">
                    {sub}
                  </span>
                ))
              ) : (
                <span className="text-xs text-neutral">No active subscriptions</span>
              )}
            </div>
          </div>

          <div className="popover-actions-section">
            <span className="section-title">
              <Sliders size={12} className="inline mr-1" />
              Resilience & Chaos Simulation
            </span>
            <div className="sim-buttons">
              <button
                type="button"
                className="sim-btn"
                onClick={() => wsService.reconnectNow()}
                data-testid="sim-reconnect-btn"
              >
                <Zap size={12} className="inline mr-1 text-cyan" />
                Reconnect Now
              </button>
              <button
                type="button"
                className="sim-btn"
                onClick={() => wsService.simulateDisconnect()}
                data-testid="sim-disconnect-btn"
              >
                <WifiOff size={12} className="inline mr-1 text-sell" />
                Drop Connection
              </button>
              <button
                type="button"
                className="sim-btn"
                onClick={() => wsService.simulateMalformedMessage()}
                data-testid="sim-malformed-btn"
              >
                <AlertTriangle size={12} className="inline mr-1 text-warning" />
                Inject Corrupted Packet
              </button>
              <button
                type="button"
                className="sim-btn"
                onClick={() => wsService.simulateLatencySpike(520)}
                data-testid="sim-latency-btn"
              >
                <Radio size={12} className="inline mr-1 text-warning" />
                Simulate Latency Spike
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
