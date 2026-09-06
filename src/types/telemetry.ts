export interface PerformanceMetrics {
  fps: number
  wsLatencyMs: number
  throughputMsgPerSec: number
  droppedFrames: number
  memoryUsageMb: number
  eventQueueLagMs: number
}
