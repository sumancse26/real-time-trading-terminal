import type { PerformanceMetrics, SimulationRatePreset } from '@/types/telemetry'
import { globalTracker } from './metrics'
import { feedSimulator } from '../stream/mockFeed'

/**
 * Phase 13 — Stress Test Configuration
 */
export interface StressTestConfig {
  /** Target tick rate in messages/second */
  tickRate: SimulationRatePreset
  /** Duration of the stress test in milliseconds */
  durationMs: number
  /** Whether to enable RAF batching during the test */
  batchingEnabled: boolean
}

/**
 * Snapshot of performance metrics at a point in time
 */
export interface MetricsSnapshot {
  timestamp: number
  fps: number
  throughputMsgPerSec: number
  renderCommitRate: number
  batchCompressionRatio: number
  avgRenderTimeMs: number
  batchLatencyMs: number
  eventQueueLagMs: number
  memoryUsageMb: number
  droppedFrames: number
}

/**
 * Complete stress test result
 */
export interface StressTestResult {
  config: StressTestConfig
  baseline: MetricsSnapshot
  peak: MetricsSnapshot
  final: MetricsSnapshot
  /** All metric snapshots sampled during the test (1 per second) */
  samples: MetricsSnapshot[]
  /** Computed summary */
  summary: StressTestSummary
}

export interface StressTestSummary {
  avgFps: number
  minFps: number
  maxFps: number
  avgThroughput: number
  avgRenderCommitRate: number
  avgBatchCompression: number
  avgQueueLagMs: number
  peakQueueLagMs: number
  avgRenderTimeMs: number
  totalDroppedFrames: number
  memoryDeltaMb: number
  /** Whether the test maintained ≥55 FPS throughout */
  passed60FpsTarget: boolean
  /** Effective compression ratio (msgs ingested / UI renders) */
  effectiveCompressionRatio: number
}

/**
 * Captures a MetricsSnapshot from the globalTracker
 */
function captureSnapshot(): MetricsSnapshot {
  const m: PerformanceMetrics = globalTracker.getMetrics()
  return {
    timestamp: Date.now(),
    fps: m.fps,
    throughputMsgPerSec: m.throughputMsgPerSec,
    renderCommitRate: m.renderCommitRate,
    batchCompressionRatio: m.batchCompressionRatio,
    avgRenderTimeMs: m.avgRenderTimeMs,
    batchLatencyMs: m.batchLatencyMs,
    eventQueueLagMs: m.eventQueueLagMs,
    memoryUsageMb: m.memoryUsageMb,
    droppedFrames: m.droppedFrames,
  }
}

/**
 * Computes summary statistics from collected samples
 */
function computeSummary(
  _config: StressTestConfig,
  baseline: MetricsSnapshot,
  samples: MetricsSnapshot[]
): StressTestSummary {
  if (samples.length === 0) {
    return {
      avgFps: 0,
      minFps: 0,
      maxFps: 0,
      avgThroughput: 0,
      avgRenderCommitRate: 0,
      avgBatchCompression: 0,
      avgQueueLagMs: 0,
      peakQueueLagMs: 0,
      avgRenderTimeMs: 0,
      totalDroppedFrames: 0,
      memoryDeltaMb: 0,
      passed60FpsTarget: false,
      effectiveCompressionRatio: 1,
    }
  }

  const n = samples.length
  let totalFps = 0
  let minFps = Infinity
  let maxFps = -Infinity
  let totalThroughput = 0
  let totalCommits = 0
  let totalCompression = 0
  let totalLag = 0
  let peakLag = 0
  let totalRenderTime = 0
  let totalDropped = 0

  for (const s of samples) {
    totalFps += s.fps
    if (s.fps < minFps) minFps = s.fps
    if (s.fps > maxFps) maxFps = s.fps
    totalThroughput += s.throughputMsgPerSec
    totalCommits += s.renderCommitRate
    totalCompression += s.batchCompressionRatio
    totalLag += s.eventQueueLagMs
    if (s.eventQueueLagMs > peakLag) peakLag = s.eventQueueLagMs
    totalRenderTime += s.avgRenderTimeMs
    totalDropped += s.droppedFrames
  }

  const avgFps = Math.round(totalFps / n)
  const avgThroughput = Math.round(totalThroughput / n)
  const avgCommits = Math.round(totalCommits / n)
  const avgCompression = Math.round((totalCompression / n) * 10) / 10
  const avgLag = Math.round((totalLag / n) * 100) / 100
  const avgRenderTime = Math.round((totalRenderTime / n) * 100) / 100
  const lastSample = samples[samples.length - 1]!
  const memoryDelta = Math.round((lastSample.memoryUsageMb - baseline.memoryUsageMb) * 10) / 10

  const effectiveCompression = avgCommits > 0
    ? Math.round((avgThroughput / avgCommits) * 10) / 10
    : avgCompression

  return {
    avgFps,
    minFps: minFps === Infinity ? 0 : minFps,
    maxFps: maxFps === -Infinity ? 0 : maxFps,
    avgThroughput,
    avgRenderCommitRate: avgCommits,
    avgBatchCompression: avgCompression,
    avgQueueLagMs: avgLag,
    peakQueueLagMs: Math.round(peakLag * 100) / 100,
    avgRenderTimeMs: avgRenderTime,
    totalDroppedFrames: totalDropped,
    memoryDeltaMb: memoryDelta,
    passed60FpsTarget: minFps >= 55,
    effectiveCompressionRatio: effectiveCompression,
  }
}

export type StressTestStatus = 'idle' | 'warmup' | 'running' | 'cooldown' | 'complete'

export type StressTestProgressCallback = (
  status: StressTestStatus,
  progress: number,
  currentSample?: MetricsSnapshot
) => void

/**
 * StressTestRunner — drives the full trading terminal under extreme load
 * and captures performance metrics before/during/after.
 *
 * Architecture:
 * 1. Capture baseline metrics at current feed rate
 * 2. Ramp up to target tick rate
 * 3. Sample metrics once per second for the test duration
 * 4. Restore original feed rate
 * 5. Return comprehensive results
 */
export class StressTestRunner {
  private isRunning = false

  public getIsRunning(): boolean {
    return this.isRunning
  }

  /**
   * Run a complete stress test cycle.
   * This is an async operation — it resolves when the full test + cooldown completes.
   */
  public run(
    config: StressTestConfig,
    onProgress?: StressTestProgressCallback
  ): Promise<StressTestResult> {
    if (this.isRunning) {
      return Promise.reject(new Error('Stress test already running'))
    }
    this.isRunning = true

    return new Promise<StressTestResult>((resolve) => {
      const originalRate = feedSimulator.getFrequency()
      const originalBatching = feedSimulator.isBatchingEnabled()
      const samples: MetricsSnapshot[] = []

      // Phase 1: Capture baseline (current state)
      onProgress?.('warmup', 0)
      const baseline = captureSnapshot()

      // Phase 2: Apply test configuration
      feedSimulator.setBatchingEnabled(config.batchingEnabled)
      feedSimulator.setFrequency(config.tickRate)

      onProgress?.('running', 0)

      // Phase 3: Sample metrics every 1 second
      const totalSamples = Math.max(1, Math.floor(config.durationMs / 1000))
      let sampleIndex = 0
      let peak = baseline

      const sampleTimer = window.setInterval(() => {
        sampleIndex++
        const snapshot = captureSnapshot()
        samples.push(snapshot)

        // Track peak load snapshot (worst FPS)
        if (snapshot.fps < peak.fps || peak === baseline) {
          peak = snapshot
        }

        const progress = Math.min(1, sampleIndex / totalSamples)
        onProgress?.('running', progress, snapshot)

        if (sampleIndex >= totalSamples) {
          clearInterval(sampleTimer)

          // Phase 4: Cooldown — restore original settings
          onProgress?.('cooldown', 1)
          feedSimulator.setFrequency(originalRate)
          feedSimulator.setBatchingEnabled(originalBatching)

          // Allow one more second for metrics to stabilize
          window.setTimeout(() => {
            const final = captureSnapshot()
            const summary = computeSummary(config, baseline, samples)

            this.isRunning = false
            onProgress?.('complete', 1)

            resolve({
              config,
              baseline,
              peak,
              final,
              samples,
              summary,
            })
          }, 500)
        }
      }, 1000)
    })
  }
}

/**
 * Compare two stress test results (before optimization vs after)
 */
export interface StressTestComparison {
  fpsImprovement: number        // percentage
  lagReduction: number           // percentage
  renderReduction: number        // factor
  memoryDelta: number            // MB
  droppedFrameReduction: number  // absolute count
}

export function compareResults(
  before: StressTestResult,
  after: StressTestResult
): StressTestComparison {
  const bs = before.summary
  const as_ = after.summary

  return {
    fpsImprovement: bs.avgFps > 0
      ? Math.round(((as_.avgFps - bs.avgFps) / bs.avgFps) * 100)
      : 0,
    lagReduction: bs.avgQueueLagMs > 0
      ? Math.round(((bs.avgQueueLagMs - as_.avgQueueLagMs) / bs.avgQueueLagMs) * 100)
      : 0,
    renderReduction: as_.avgRenderCommitRate > 0
      ? Math.round((bs.avgRenderCommitRate / as_.avgRenderCommitRate) * 10) / 10
      : 1,
    memoryDelta: Math.round((as_.memoryDeltaMb - bs.memoryDeltaMb) * 10) / 10,
    droppedFrameReduction: bs.totalDroppedFrames - as_.totalDroppedFrames,
  }
}

/** Singleton runner */
export const stressTestRunner = new StressTestRunner()
