import { globalTracker } from '../performance/metrics'

/**
 * Fixed-capacity circular ring buffer.
 * Provides O(1) push and avoids dynamic array allocations / garbage collection churn.
 */
export class RingBuffer<T> {
  private buffer: Array<T | undefined>
  private head = 0
  private tail = 0
  private size = 0

  constructor(public readonly capacity: number) {
    if (capacity <= 0) throw new Error('Capacity must be greater than 0')
    this.buffer = new Array(capacity)
  }

  public push(item: T): void {
    this.buffer[this.tail] = item
    this.tail = (this.tail + 1) % this.capacity
    if (this.size < this.capacity) {
      this.size++
    } else {
      this.head = (this.head + 1) % this.capacity
    }
  }

  public pushBatch(items: T[]): void {
    for (let i = 0; i < items.length; i++) {
      this.push(items[i]!)
    }
  }

  /**
   * Returns items in chronological order (oldest to newest)
   */
  public toArray(): T[] {
    const result: T[] = []
    for (let i = 0; i < this.size; i++) {
      const idx = (this.head + i) % this.capacity
      result.push(this.buffer[idx] as T)
    }
    return result
  }

  /**
   * Returns items in reverse chronological order (newest to oldest)
   */
  public toReversedArray(): T[] {
    const result: T[] = []
    for (let i = this.size - 1; i >= 0; i--) {
      const idx = (this.head + i) % this.capacity
      result.push(this.buffer[idx] as T)
    }
    return result
  }

  public get length(): number {
    return this.size
  }

  public clear(): void {
    this.head = 0
    this.tail = 0
    this.size = 0
    this.buffer = new Array(this.capacity)
  }
}

/**
 * Coalescing Map Buffer:
 * Stores only the latest state per unique key between batch flush cycles.
 * Ideal for L2 OrderBook snapshots, ticker prices, and depth deltas.
 */
export class CoalescingBuffer<K, V> {
  private map = new Map<K, V>()

  public set(key: K, value: V): void {
    this.map.set(key, value)
  }

  public flush(): Map<K, V> {
    const copy = new Map(this.map)
    this.map.clear()
    return copy
  }

  public get size(): number {
    return this.map.size
  }

  public clear(): void {
    this.map.clear()
  }
}

/**
 * RequestAnimationFrame-aligned batch dispatcher.
 * Collects incoming items and flushes them to subscribers on the next animation frame,
 * capping UI render dispatch rate to 60Hz (~16.6ms) regardless of input frequency (100–1000 msg/s).
 */
export class RafBatchDispatcher<T> {
  private pendingQueue: T[] = []
  private rafId: number | null = null
  private timerId: ReturnType<typeof setTimeout> | null = null
  private subscribers = new Set<(items: T[]) => void>()
  private batchStartTime = 0
  private isBatchingEnabled = true
  /** Phase 13: Adaptive mode doubles the flush window under high load */
  private isAdaptiveMode = false
  private adaptiveFrameCount = 0

  constructor(private fallbackIntervalMs = 16) {}

  public setBatchingEnabled(enabled: boolean): void {
    this.isBatchingEnabled = enabled
    if (!enabled && this.pendingQueue.length > 0) {
      this.flushNow()
    }
  }

  public getBatchingEnabled(): boolean {
    return this.isBatchingEnabled
  }

  /**
   * Phase 13: Adaptive batch mode.
   * When enabled, flushes are delayed by 2 RAF frames (~33ms) instead of 1 (~16ms)
   * to further compress renders under high load (>500 msg/s).
   */
  public setAdaptiveMode(enabled: boolean): void {
    this.isAdaptiveMode = enabled
    this.adaptiveFrameCount = 0
  }

  public getAdaptiveMode(): boolean {
    return this.isAdaptiveMode
  }

  public push(item: T): void {
    if (!this.isBatchingEnabled) {
      // Direct raw dispatch (Unbatched mode for performance comparison)
      globalTracker.recordBatchFlush(1, 0)
      for (const sub of this.subscribers) {
        sub([item])
      }
      return
    }

    if (this.pendingQueue.length === 0) {
      this.batchStartTime = performance.now()
      this.scheduleFlush()
    }
    this.pendingQueue.push(item)
  }

  public pushBatch(items: T[]): void {
    if (items.length === 0) return

    if (!this.isBatchingEnabled) {
      globalTracker.recordBatchFlush(items.length, 0)
      for (const sub of this.subscribers) {
        sub(items)
      }
      return
    }

    if (this.pendingQueue.length === 0) {
      this.batchStartTime = performance.now()
      this.scheduleFlush()
    }
    for (let i = 0; i < items.length; i++) {
      this.pendingQueue.push(items[i]!)
    }
  }

  public subscribe(callback: (items: T[]) => void): () => void {
    this.subscribers.add(callback)
    return () => {
      this.subscribers.delete(callback)
    }
  }

  private scheduleFlush(): void {
    if (typeof requestAnimationFrame !== 'undefined') {
      if (this.rafId === null) {
        if (this.isAdaptiveMode) {
          // Phase 13: Adaptive mode — wait 2 RAF frames before flushing
          this.adaptiveFrameCount = 0
          const adaptiveLoop = () => {
            this.adaptiveFrameCount++
            if (this.adaptiveFrameCount >= 2) {
              this.rafId = null
              this.flushNow()
            } else {
              this.rafId = requestAnimationFrame(adaptiveLoop)
            }
          }
          this.rafId = requestAnimationFrame(adaptiveLoop)
        } else {
          this.rafId = requestAnimationFrame(() => {
            this.rafId = null
            this.flushNow()
          })
        }
      }
    } else {
      if (this.timerId === null) {
        const interval = this.isAdaptiveMode ? this.fallbackIntervalMs * 2 : this.fallbackIntervalMs
        this.timerId = setTimeout(() => {
          this.timerId = null
          this.flushNow()
        }, interval)
      }
    }
  }

  public flushNow(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    if (this.timerId !== null) {
      clearTimeout(this.timerId)
      this.timerId = null
    }

    if (this.pendingQueue.length === 0) return

    const items = this.pendingQueue
    this.pendingQueue = []
    const latency = this.batchStartTime > 0 ? performance.now() - this.batchStartTime : 0
    this.batchStartTime = 0

    globalTracker.recordBatchFlush(items.length, latency)

    for (const sub of this.subscribers) {
      sub(items)
    }
  }

  public destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    if (this.timerId !== null) {
      clearTimeout(this.timerId)
      this.timerId = null
    }
    this.pendingQueue = []
    this.subscribers.clear()
  }
}
