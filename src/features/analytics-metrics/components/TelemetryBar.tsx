import React, { useEffect, useState } from 'react'
import type { PerformanceMetrics } from '@/types/telemetry'
import { globalTracker } from '@/core/performance/metrics'
import { Cpu, Gauge, Zap, Database, Server } from 'lucide-react'

export const TelemetryBar: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>(globalTracker.getMetrics())

  useEffect(() => {
    const unsub = globalTracker.subscribe(setMetrics)
    return unsub
  }, [])

  return (
    <div className="telemetry-bar" data-testid="telemetry-bar">
      <div className="telemetry-left">
        <span className="telemetry-title">
          <Zap size={13} className="text-cyan-accent" />
          PERFORMANCE TELEMETRY
        </span>
      </div>

      <div className="telemetry-metrics">
        <div className="metric-chip">
          <Gauge size={12} className="metric-icon" />
          <span className="metric-label">FPS</span>
          <span className={`metric-value ${metrics.fps >= 55 ? 'text-buy' : 'text-sell'}`}>
            {metrics.fps}
          </span>
        </div>

        <div className="metric-chip">
          <Server size={12} className="metric-icon" />
          <span className="metric-label">WS LATENCY</span>
          <span className="metric-value text-buy">{metrics.wsLatencyMs}ms</span>
        </div>

        <div className="metric-chip">
          <Cpu size={12} className="metric-icon" />
          <span className="metric-label">THROUGHPUT</span>
          <span className="metric-value text-cyan-accent">{metrics.throughputMsgPerSec} msg/s</span>
        </div>

        <div className="metric-chip">
          <Database size={12} className="metric-icon" />
          <span className="metric-label">HEAP MEMORY</span>
          <span className="metric-value text-neutral-300">{metrics.memoryUsageMb} MB</span>
        </div>

        <div className="metric-chip">
          <span className="metric-label">QUEUE LAG</span>
          <span className="metric-value text-neutral-300">{metrics.eventQueueLagMs}ms</span>
        </div>
      </div>
    </div>
  )
}
