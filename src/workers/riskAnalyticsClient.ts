import type {
  RiskAnalyticsInput,
  RiskAnalyticsResult,
  WorkerRequest,
  WorkerResponse,
} from '@/types/worker'
import { calculateRiskAnalytics } from '@/core/analytics/riskCalculator'

export type ProgressCallback = (progress: number, phase: string) => void

export interface WorkerClientOptions {
  timeoutMs?: number
  enableFallback?: boolean
}

/**
 * Phase 14 — RiskAnalyticsWorkerClient
 * Typed RPC client managing Web Worker lifecycle, timeout handling, error propagation,
 * cancellation, and main-thread fallback.
 */
export class RiskAnalyticsWorkerClient {
  private worker: Worker | null = null
  private activeJobs = new Map<
    string,
    {
      resolve: (result: RiskAnalyticsResult) => void
      reject: (err: Error) => void
      onProgress?: ProgressCallback
      timer: ReturnType<typeof setTimeout>
    }
  >()
  private isTerminated = false

  constructor(private options: WorkerClientOptions = {}) {
    this.options.timeoutMs = options.timeoutMs ?? 20000
    this.options.enableFallback = options.enableFallback ?? true
  }

  /**
   * Lazy-initializes the Web Worker
   */
  private initWorker(): Worker | null {
    if (this.worker) return this.worker
    if (this.isTerminated) return null

    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(
          new URL('./riskAnalytics.worker.ts', import.meta.url),
          { type: 'module' }
        )

        this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
          this.handleMessage(e.data)
        }

        this.worker.onerror = (err: ErrorEvent) => {
          this.handleError(new Error(err.message || 'Worker runtime error'))
        }

        return this.worker
      } catch (err) {
        console.warn('Web Worker initialization failed, falling back to main thread:', err)
        this.worker = null
        return null
      }
    }
    return null
  }

  private handleMessage(msg: WorkerResponse) {
    const job = this.activeJobs.get(msg.id)
    if (!job) return

    if (msg.type === 'PROGRESS') {
      job.onProgress?.(msg.progress, msg.phase)
      return
    }

    if (msg.type === 'SUCCESS') {
      clearTimeout(job.timer)
      this.activeJobs.delete(msg.id)
      job.resolve(msg.result)
      return
    }

    if (msg.type === 'ERROR') {
      clearTimeout(job.timer)
      this.activeJobs.delete(msg.id)
      job.reject(new Error(msg.error))
    }
  }

  private handleError(err: Error) {
    for (const [id, job] of this.activeJobs.entries()) {
      clearTimeout(job.timer)
      job.reject(err)
      this.activeJobs.delete(id)
    }
  }

  /**
   * Offloads calculation to Web Worker (or executes on main thread if fallback is active).
   */
  public calculateRisk(
    input: RiskAnalyticsInput,
    onProgress?: ProgressCallback
  ): Promise<RiskAnalyticsResult> {
    if (this.isTerminated) {
      return Promise.reject(new Error('Worker client has been terminated'))
    }

    const worker = this.initWorker()

    // Main-thread fallback if worker unavailable
    if (!worker) {
      if (this.options.enableFallback) {
        return new Promise((resolve) => {
          // Wrap in setTimeout to let UI paint before heavy calculation
          setTimeout(() => {
            const result = calculateRiskAnalytics(input, false, onProgress)
            resolve(result)
          }, 0)
        })
      }
      return Promise.reject(new Error('Web Workers not supported in this environment'))
    }

    const id = `risk-req-${Date.now()}-${Math.floor(Math.random() * 10000)}`

    return new Promise<RiskAnalyticsResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.activeJobs.has(id)) {
          this.activeJobs.delete(id)
          this.cancelJob(id)
          reject(new Error(`Risk calculation timed out after ${this.options.timeoutMs}ms`))
        }
      }, this.options.timeoutMs)

      this.activeJobs.set(id, { resolve, reject, onProgress, timer })

      const req: WorkerRequest = {
        id,
        type: 'CALCULATE_RISK_ANALYTICS',
        payload: input,
      }

      worker.postMessage(req)
    })
  }

  /**
   * Run the calculation explicitly on the main thread for performance benchmarking
   */
  public calculateOnMainThread(
    input: RiskAnalyticsInput,
    onProgress?: ProgressCallback
  ): Promise<RiskAnalyticsResult> {
    return new Promise((resolve) => {
      const result = calculateRiskAnalytics(input, false, onProgress)
      resolve(result)
    })
  }

  /**
   * Cancel an active calculation
   */
  public cancelJob(id: string): void {
    const job = this.activeJobs.get(id)
    if (job) {
      clearTimeout(job.timer)
      this.activeJobs.delete(id)
    }
    if (this.worker) {
      this.worker.postMessage({ id, type: 'CANCEL' })
    }
  }

  /**
   * Terminate the Web Worker instance and clean up all listeners and timers
   */
  public terminate(): void {
    this.isTerminated = true
    for (const [, job] of this.activeJobs.entries()) {
      clearTimeout(job.timer)
      job.reject(new Error('Worker terminated'))
    }
    this.activeJobs.clear()

    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
  }
}

/** Default singleton client */
export const riskWorkerClient = new RiskAnalyticsWorkerClient()
