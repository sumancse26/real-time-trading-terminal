export type SimulationRatePreset = 20 | 100 | 500 | 1000

export interface PerformanceMetrics {
  fps: number
  wsLatencyMs: number
  throughputMsgPerSec: number
  droppedFrames: number
  memoryUsageMb: number
  eventQueueLagMs: number

  // Phase 6 High-Frequency Telemetry
  renderCommitRate: number // Actual React renders or UI frame flushes per second
  batchCompressionRatio: number // Ratio of incoming messages to UI renders (e.g. 1000 msgs / 60 flushes = 16.7x)
  avgRenderTimeMs: number // Render duration in milliseconds
  batchLatencyMs: number // Time buffered before dispatching to UI
  isBatchingEnabled: boolean // Whether RAF batching is enabled vs raw direct dispatch
  simulationRate: SimulationRatePreset // Current simulation rate (20, 100, 500, 1000 msgs/sec)
}

export interface BenchmarkResult {
  simulationRate: SimulationRatePreset
  durationMs: number
  unbatched: {
    totalMessages: number
    totalRenders: number
    avgFps: number
    avgQueueLagMs: number
    avgRenderTimeMs: number
    droppedFrames: number
  }
  batched: {
    totalMessages: number
    totalRenders: number
    avgFps: number
    avgQueueLagMs: number
    avgRenderTimeMs: number
    droppedFrames: number
    compressionRatio: number
  }
  improvementFactor: {
    renderReduction: number
    lagReduction: number
    fpsGain: number
  }
}
