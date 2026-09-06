import { describe, it, expect } from 'vitest'
import { PerformanceTracker } from '../core/performance/metrics'

describe('PerformanceTracker Core Engine', () => {
  it('tracks message arrivals and calculates metrics correctly', () => {
    const tracker = new PerformanceTracker()
    tracker.recordMessageArrival(50)
    tracker.recordLatency(15)

    const metrics = tracker.getMetrics()
    expect(metrics.wsLatencyMs).toBe(15)
    expect(typeof metrics.fps).toBe('number')
    expect(typeof metrics.memoryUsageMb).toBe('number')

    tracker.destroy()
  })
})
