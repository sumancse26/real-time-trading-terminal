/// <reference lib="webworker" />
import { calculateRiskAnalytics } from '@/core/analytics/riskCalculator'
import type { WorkerRequest, WorkerResponse } from '@/types/worker'

/**
 * Phase 14 — Risk Analytics Web Worker
 *
 * Runs heavy calculations (10,000 Monte Carlo paths + 100,000 order analytics)
 * entirely off the main thread.
 */

let isCancelled = false

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const request = e.data

  if (request.type === 'CANCEL') {
    isCancelled = true
    return
  }

  if (request.type === 'CALCULATE_RISK_ANALYTICS') {
    isCancelled = false
    const { id, payload } = request

    try {
      // Progress reporting
      const onProgress = (progress: number, phase: string) => {
        if (isCancelled) return
        const progressMsg: WorkerResponse = {
          id,
          type: 'PROGRESS',
          progress,
          phase,
        }
        self.postMessage(progressMsg)
      }

      const result = calculateRiskAnalytics(payload, true, onProgress)

      if (isCancelled) return

      const response: WorkerResponse = {
        id,
        type: 'SUCCESS',
        result,
      }
      self.postMessage(response)
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown calculation error in Web Worker'
      const response: WorkerResponse = {
        id,
        type: 'ERROR',
        error: errorMsg,
      }
      self.postMessage(response)
    }
  }
}
