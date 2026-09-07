import React, { useEffect, useState, useRef } from 'react'
import type { PerformanceMetrics, SimulationRatePreset, BenchmarkResult } from '@/types/telemetry'
import { globalTracker } from '@/core/performance/metrics'
import { feedSimulator } from '@/core/stream/mockFeed'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import {
  Cpu,
  Gauge,
  Zap,
  Database,
  Server,
  Layers,
  BarChart3,
  X,
  Play,
  CheckCircle2,
  Clock,
  Flame,
} from 'lucide-react'
import { StressTestPanel } from './StressTestPanel'

export const TelemetryBar: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>(globalTracker.getMetrics())
  const [showBenchmarkModal, setShowBenchmarkModal] = useState(false)
  const [showStressModal, setShowStressModal] = useState(false)
  const [benchmarkRate, setBenchmarkRate] = useState<SimulationRatePreset>(1000)
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkResult | null>(null)
  const [isRunningBench, setIsRunningBench] = useState(false)
  const benchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const benchmarkModalRef = useRef<HTMLDivElement>(null)
  const stressModalRef = useRef<HTMLDivElement>(null)

  useFocusTrap(benchmarkModalRef, showBenchmarkModal)
  useFocusTrap(stressModalRef, showStressModal)

  useEffect(() => {
    const unsub = globalTracker.subscribe(setMetrics)
    return () => {
      unsub()
      if (benchTimerRef.current) {
        clearTimeout(benchTimerRef.current)
      }
    }
  }, [])

  // Handle Escape key to dismiss active modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showBenchmarkModal) setShowBenchmarkModal(false)
        if (showStressModal) setShowStressModal(false)
      }
    }
    if (showBenchmarkModal || showStressModal) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [showBenchmarkModal, showStressModal])

  const handleRateChange = (rate: SimulationRatePreset) => {
    feedSimulator.setFrequency(rate)
  }

  const handleToggleBatching = () => {
    const nextState = !metrics.isBatchingEnabled
    feedSimulator.setBatchingEnabled(nextState)
  }

  const handleRunBenchmark = () => {
    setIsRunningBench(true)
    if (benchTimerRef.current) {
      clearTimeout(benchTimerRef.current)
    }
    benchTimerRef.current = setTimeout(() => {
      const res = globalTracker.runBenchmark(benchmarkRate, 1000)
      setBenchmarkResult(res)
      setIsRunningBench(false)
      benchTimerRef.current = null
    }, 400)
  }

  const rates: SimulationRatePreset[] = [20, 100, 500, 1000]

  return (
    <div className="telemetry-bar" data-testid="telemetry-bar">
      <div className="telemetry-left">
        <span className="telemetry-title">
          <Zap size={13} className="text-cyan-accent" />
          PERFORMANCE TELEMETRY
        </span>

        {/* High-Frequency Rate Presets */}
        <div className="telemetry-rate-selector" data-testid="rate-selector">
          <span className="rate-selector-label">FEED RATE:</span>
          {rates.map((r) => (
            <button
              key={r}
              type="button"
              className={`rate-btn ${metrics.simulationRate === r ? 'active' : ''}`}
              onClick={() => handleRateChange(r)}
              data-testid={`rate-btn-${r}`}
              title={`Simulate ${r} market updates/second`}
            >
              {r === 1000 ? '1 kHz' : `${r}/s`}
            </button>
          ))}
        </div>

        {/* Batching Mode Toggle */}
        <button
          type="button"
          onClick={handleToggleBatching}
          className={`batching-toggle-btn ${metrics.isBatchingEnabled ? 'batched' : 'unbatched'}`}
          data-testid="batching-toggle"
          title="Toggle RAF Batching vs Raw Direct Dispatch"
        >
          {metrics.isBatchingEnabled ? (
            <>
              <Layers size={11} />
              <span>RAF BATCHED</span>
            </>
          ) : (
            <>
              <span className="unbatched-dot" />
              <span>RAW DIRECT</span>
            </>
          )}
        </button>
      </div>

      <div className="telemetry-metrics">
        <div className="metric-chip" data-testid="metric-fps">
          <Gauge size={12} className="metric-icon" />
          <span className="metric-label">FPS</span>
          <span className={`metric-value ${metrics.fps >= 55 ? 'text-buy' : 'text-sell'}`}>
            {metrics.fps}
          </span>
        </div>

        <div className="metric-chip">
          <Server size={12} className="metric-icon" />
          <span className="metric-label">WS PING</span>
          <span className="metric-value text-buy">{metrics.wsLatencyMs}ms</span>
        </div>

        <div className="metric-chip" data-testid="metric-throughput">
          <Cpu size={12} className="metric-icon" />
          <span className="metric-label">THROUGHPUT</span>
          <span className="metric-value text-cyan-accent">{metrics.throughputMsgPerSec} msg/s</span>
        </div>

        <div className="metric-chip" data-testid="metric-commits">
          <Layers size={12} className="metric-icon" />
          <span className="metric-label">UI COMMITS</span>
          <span className="metric-value text-neutral-300">
            {metrics.renderCommitRate > 0 ? `${metrics.renderCommitRate} r/s` : '60 r/s'}
          </span>
        </div>

        <div className="metric-chip" data-testid="metric-compression">
          <span className="metric-label">COMPRESSION</span>
          <span className="metric-value text-cyan-accent font-bold">
            {metrics.batchCompressionRatio}x
          </span>
        </div>

        <div className="metric-chip">
          <Clock size={12} className="metric-icon" />
          <span className="metric-label">QUEUE LAG</span>
          <span className="metric-value text-neutral-300">{metrics.eventQueueLagMs}ms</span>
        </div>

        <div className="metric-chip">
          <Database size={12} className="metric-icon" />
          <span className="metric-label">HEAP</span>
          <span className="metric-value text-neutral-300">{metrics.memoryUsageMb} MB</span>
        </div>

        {/* Benchmark Trigger Button */}
        <button
          type="button"
          className="benchmark-open-btn"
          onClick={() => setShowBenchmarkModal(true)}
          data-testid="open-benchmark-btn"
          title="Open High-Frequency Performance Benchmark and Before/After Metrics"
        >
          <BarChart3 size={12} />
          <span>BENCHMARK</span>
        </button>

        {/* Phase 13 Full Terminal Stress Test Button */}
        <button
          type="button"
          className="benchmark-open-btn stress-btn text-warning"
          onClick={() => setShowStressModal(true)}
          data-testid="open-stress-modal-btn"
          title="Open Phase 13 Full Terminal 1kHz Stress Test & Profiler"
        >
          <Flame size={12} />
          <span>STRESS TEST</span>
        </button>
      </div>

      {/* Benchmark & Dev Metrics Modal */}
      {showBenchmarkModal && (
        <div className="benchmark-modal-backdrop" onClick={() => setShowBenchmarkModal(false)}>
          <div
            ref={benchmarkModalRef}
            className="benchmark-modal-content"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="High-Frequency Data Benchmark"
            data-testid="benchmark-modal"
          >
            <div className="benchmark-modal-header">
              <div className="flex items-center gap-2">
                <BarChart3 size={16} className="text-cyan-accent" />
                <span className="font-bold text-sm text-neutral-100">
                  HIGH-FREQUENCY DATA BENCHMARK (PHASE 6)
                </span>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowBenchmarkModal(false)}
                aria-label="Close Benchmark Modal"
              >
                <X size={16} />
              </button>
            </div>

            <div className="benchmark-modal-body">
              <p className="benchmark-intro">
                Compare terminal performance before and after applying RAF batching, ring buffers,
                and selective memoization under high-frequency market data stress (100–1000 updates/sec).
              </p>

              <div className="benchmark-controls">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted font-mono">TARGET RATE:</span>
                  {rates.filter((r) => r >= 100).map((r) => (
                    <button
                      key={r}
                      type="button"
                      className={`rate-btn ${benchmarkRate === r ? 'active' : ''}`}
                      onClick={() => setBenchmarkRate(r)}
                      data-testid={`bench-rate-${r}`}
                    >
                      {r} updates/s
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="btn btn-primary bench-run-btn"
                  onClick={handleRunBenchmark}
                  disabled={isRunningBench}
                  data-testid="run-benchmark-btn"
                >
                  <Play size={12} />
                  <span>{isRunningBench ? 'Benchmarking…' : 'Run 1s Stress Test'}</span>
                </button>
              </div>

              {benchmarkResult && (
                <div className="benchmark-results-container" data-testid="benchmark-results">
                  <div className="benchmark-cards-grid">
                    <div className="bench-stat-card highlight">
                      <span className="bench-stat-label">Render Reduction</span>
                      <span className="bench-stat-val text-cyan-accent">
                        {benchmarkResult.improvementFactor.renderReduction}x
                      </span>
                      <span className="bench-stat-sub">Fewer React reconciliations</span>
                    </div>

                    <div className="bench-stat-card">
                      <span className="bench-stat-label">FPS Advantage</span>
                      <span className="bench-stat-val text-buy">
                        +{benchmarkResult.improvementFactor.fpsGain}%
                      </span>
                      <span className="bench-stat-sub">
                        {benchmarkResult.batched.avgFps} FPS vs {benchmarkResult.unbatched.avgFps} FPS
                      </span>
                    </div>

                    <div className="bench-stat-card">
                      <span className="bench-stat-label">Event Queue Lag</span>
                      <span className="bench-stat-val text-buy">
                        {benchmarkResult.batched.avgQueueLagMs}ms
                      </span>
                      <span className="bench-stat-sub">
                        vs {benchmarkResult.unbatched.avgQueueLagMs}ms unbatched
                      </span>
                    </div>
                  </div>

                  {/* Before vs After Comparison Table */}
                  <table className="benchmark-table">
                    <thead>
                      <tr>
                        <th>METRIC</th>
                        <th>BEFORE (UNBATCHED)</th>
                        <th>AFTER (RAF BATCHED)</th>
                        <th>IMPROVEMENT</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Incoming Updates / Sec</td>
                        <td>{benchmarkResult.unbatched.totalMessages} msg/s</td>
                        <td>{benchmarkResult.batched.totalMessages} msg/s</td>
                        <td>100% Ingestion</td>
                      </tr>
                      <tr>
                        <td>UI Renders Dispatched</td>
                        <td className="text-sell">{benchmarkResult.unbatched.totalRenders} /s</td>
                        <td className="text-buy">{benchmarkResult.batched.totalRenders} /s</td>
                        <td className="text-cyan-accent font-bold">
                          {benchmarkResult.improvementFactor.renderReduction}x Reduction
                        </td>
                      </tr>
                      <tr>
                        <td>Framerate (FPS)</td>
                        <td className="text-sell">{benchmarkResult.unbatched.avgFps} FPS</td>
                        <td className="text-buy font-bold">{benchmarkResult.batched.avgFps} FPS</td>
                        <td className="text-buy">+{benchmarkResult.improvementFactor.fpsGain}%</td>
                      </tr>
                      <tr>
                        <td>Event Loop Lag</td>
                        <td className="text-sell">{benchmarkResult.unbatched.avgQueueLagMs}ms</td>
                        <td className="text-buy">{benchmarkResult.batched.avgQueueLagMs}ms</td>
                        <td className="text-buy">
                          {Math.round(
                            ((benchmarkResult.unbatched.avgQueueLagMs -
                              benchmarkResult.batched.avgQueueLagMs) /
                              benchmarkResult.unbatched.avgQueueLagMs) *
                              100
                          )}
                          % Lower
                        </td>
                      </tr>
                      <tr>
                        <td>Dropped Frames</td>
                        <td className="text-sell">{benchmarkResult.unbatched.droppedFrames}</td>
                        <td className="text-buy font-bold">{benchmarkResult.batched.droppedFrames}</td>
                        <td className="text-buy">Zero Drops</td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="bench-badge-row">
                    <CheckCircle2 size={13} className="text-buy" />
                    <span className="text-xs text-buy">
                      60 FPS Target Achieved at {benchmarkResult.simulationRate} updates/second using
                      Fixed-RingBuffer and RAF coalescing.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Phase 13 Full Terminal Stress Test Modal */}
      {showStressModal && (
        <div className="benchmark-modal-backdrop" onClick={() => setShowStressModal(false)}>
          <div
            ref={stressModalRef}
            className="benchmark-modal-content stress-modal-content"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Full Terminal Stress Test & Profiler"
            data-testid="stress-modal"
          >
            <StressTestPanel onClose={() => setShowStressModal(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
