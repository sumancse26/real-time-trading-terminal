import type { PerformanceMetrics } from '@/types/telemetry'

export class PerformanceTracker {
  private frameCount = 0
  private lastFpsTime = performance.now()
  private currentFps = 60
  private msgCount = 0
  private lastMsgTime = performance.now()
  private currentThroughput = 0
  private rafId: number | null = null
  private listeners = new Set<(metrics: PerformanceMetrics) => void>()
  private latency = 12
  private lastQueueLag = 0.8

  constructor() {
    this.startLoop()
  }

  private startLoop = () => {
    let lastTime = performance.now()

    const loop = (now: number) => {
      this.frameCount++
      const delta = now - lastTime
      lastTime = now

      // Measure event queue lag
      const expectedDelta = 1000 / 60
      this.lastQueueLag = Math.max(0, delta - expectedDelta)

      if (now - this.lastFpsTime >= 1000) {
        this.currentFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime))
        this.frameCount = 0
        this.lastFpsTime = now

        // Calculate throughput
        const msgElapsed = (now - this.lastMsgTime) / 1000
        this.currentThroughput = Math.round(this.msgCount / (msgElapsed || 1))
        this.msgCount = 0
        this.lastMsgTime = now

        this.notify()
      }

      this.rafId = requestAnimationFrame(loop)
    }

    this.rafId = requestAnimationFrame(loop)
  }

  public recordMessageArrival(batchSize = 1) {
    this.msgCount += batchSize
  }

  public recordLatency(pingMs: number) {
    this.latency = pingMs
  }

  public subscribe(callback: (metrics: PerformanceMetrics) => void): () => void {
    this.listeners.add(callback)
    callback(this.getMetrics())
    return () => {
      this.listeners.delete(callback)
    }
  }

  public getMetrics(): PerformanceMetrics {
    const memory =
      typeof performance !== 'undefined' && 'memory' in performance
        ? (performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize /
          (1024 * 1024)
        : 42.5

    return {
      fps: this.currentFps,
      wsLatencyMs: this.latency,
      throughputMsgPerSec: this.currentThroughput,
      droppedFrames: Math.max(0, 60 - this.currentFps),
      memoryUsageMb: Math.round(memory * 10) / 10,
      eventQueueLagMs: Math.round(this.lastQueueLag * 100) / 100,
    }
  }

  private notify() {
    const metrics = this.getMetrics()
    for (const listener of this.listeners) {
      listener(metrics)
    }
  }

  public destroy() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
    }
    this.listeners.clear()
  }
}

export const globalTracker = new PerformanceTracker()
