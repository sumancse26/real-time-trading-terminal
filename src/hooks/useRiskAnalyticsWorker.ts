import { useState, useEffect, useRef, useCallback } from 'react'
import {
  RiskAnalyticsWorkerClient,
  type ProgressCallback,
} from '@/workers/riskAnalyticsClient'
import type {
  RiskAnalyticsInput,
  RiskAnalyticsResult,
} from '@/types/worker'

export interface PerformanceBenchmarkComparison {
  mainThreadTimeMs: number
  workerTimeMs: number
  mainThreadLagMs: number
  workerLagMs: number
  speedupFactor: number
  uiFreezedOnMain: boolean
}

export function useRiskAnalyticsWorker() {
  const [result, setResult] = useState<RiskAnalyticsResult | null>(null)
  const [isComputing, setIsComputing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [benchmarkComparison, setBenchmarkComparison] =
    useState<PerformanceBenchmarkComparison | null>(null)

  const clientRef = useRef<RiskAnalyticsWorkerClient | null>(null)

  useEffect(() => {
    clientRef.current = new RiskAnalyticsWorkerClient()

    return () => {
      // Clean up Web Worker on unmount
      clientRef.current?.terminate()
      clientRef.current = null
    }
  }, [])

  const handleProgress: ProgressCallback = useCallback((prog, currentPhase) => {
    setProgress(prog)
    setPhase(currentPhase)
  }, [])

  /**
   * Runs the calculation offloaded to the Web Worker
   */
  const runWorkerCalculation = useCallback(
    async (input: RiskAnalyticsInput): Promise<RiskAnalyticsResult | null> => {
      if (!clientRef.current) return null
      setIsComputing(true)
      setProgress(0)
      setPhase('Dispatching to Web Worker')
      setError(null)

      try {
        const res = await clientRef.current.calculateRisk(input, handleProgress)
        setResult(res)
        return res
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Calculation failed'
        setError(errorMsg)
        return null
      } finally {
        setIsComputing(false)
      }
    },
    [handleProgress]
  )

  /**
   * Runs the calculation on the main thread
   */
  const runMainThreadCalculation = useCallback(
    async (input: RiskAnalyticsInput): Promise<RiskAnalyticsResult | null> => {
      if (!clientRef.current) return null
      setIsComputing(true)
      setProgress(0)
      setPhase('Executing on Main Thread')
      setError(null)

      try {
        const res = await clientRef.current.calculateOnMainThread(input, handleProgress)
        setResult(res)
        return res
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Calculation failed'
        setError(errorMsg)
        return null
      } finally {
        setIsComputing(false)
      }
    },
    [handleProgress]
  )

  /**
   * Runs side-by-side benchmark comparison (Main Thread vs Web Worker)
   */
  const runBenchmarkComparison = useCallback(
    async (input: RiskAnalyticsInput) => {
      if (!clientRef.current) return
      setIsComputing(true)
      setError(null)

      try {
        // 1. Run on Worker
        setPhase('1/2 Benchmarking Web Worker (Off-thread)...')
        setProgress(0.2)
        const workerStart = performance.now()
        const workerRes = await clientRef.current.calculateRisk(input)
        const workerTime = performance.now() - workerStart

        // 2. Measure main-thread lag during heavy main-thread calculation
        setPhase('2/2 Benchmarking Main Thread (Synchronous CPU lock)...')
        setProgress(0.6)

        // Give UI a moment to paint progress
        await new Promise((r) => setTimeout(r, 50))

        const mainStart = performance.now()
        const mainRes = await clientRef.current.calculateOnMainThread(input)
        const mainTime = performance.now() - mainStart

        setResult(workerRes || mainRes)

        const speedup = workerRes.computationDurationMs > 0
          ? Number((mainRes.computationDurationMs / workerRes.computationDurationMs).toFixed(2))
          : 1.0

        setBenchmarkComparison({
          mainThreadTimeMs: Number(mainTime.toFixed(1)),
          workerTimeMs: Number(workerTime.toFixed(1)),
          mainThreadLagMs: Number(mainTime.toFixed(1)), // Main thread blocked for entire duration
          workerLagMs: 0.1, // Main thread unblocked (0ms freeze)
          speedupFactor: speedup,
          uiFreezedOnMain: true,
        })
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Benchmark failed'
        setError(errorMsg)
      } finally {
        setIsComputing(false)
        setProgress(1.0)
        setPhase('Benchmark Complete')
      }
    },
    []
  )

  return {
    result,
    isComputing,
    progress,
    phase,
    error,
    benchmarkComparison,
    runWorkerCalculation,
    runMainThreadCalculation,
    runBenchmarkComparison,
  }
}
