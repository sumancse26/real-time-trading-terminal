import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TelemetryBar } from '../features/analytics-metrics/components/TelemetryBar'
import { feedSimulator } from '../core/stream/mockFeed'
import { globalTracker } from '../core/performance/metrics'

describe('TelemetryBar & Phase 6 High-Frequency Controls', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders performance metrics and rate selector buttons', () => {
    render(<TelemetryBar />)

    expect(screen.getByTestId('telemetry-bar')).toBeInTheDocument()
    expect(screen.getByTestId('rate-selector')).toBeInTheDocument()
    expect(screen.getByTestId('rate-btn-20')).toBeInTheDocument()
    expect(screen.getByTestId('rate-btn-100')).toBeInTheDocument()
    expect(screen.getByTestId('rate-btn-500')).toBeInTheDocument()
    expect(screen.getByTestId('rate-btn-1000')).toBeInTheDocument()
    expect(screen.getByTestId('batching-toggle')).toBeInTheDocument()
    expect(screen.getByTestId('open-benchmark-btn')).toBeInTheDocument()
  })

  it('switches feed frequency on rate button click', () => {
    render(<TelemetryBar />)

    const btn1000 = screen.getByTestId('rate-btn-1000')
    fireEvent.click(btn1000)

    expect(feedSimulator.getFrequency()).toBe(1000)
    expect(globalTracker.getMetrics().simulationRate).toBe(1000)

    const btn100 = screen.getByTestId('rate-btn-100')
    fireEvent.click(btn100)

    expect(feedSimulator.getFrequency()).toBe(100)
  })

  it('toggles batching mode between batched and unbatched', () => {
    render(<TelemetryBar />)

    const toggle = screen.getByTestId('batching-toggle')
    expect(screen.getByText('RAF BATCHED')).toBeInTheDocument()

    fireEvent.click(toggle)
    expect(feedSimulator.isBatchingEnabled()).toBe(false)
    expect(screen.getByText('RAW DIRECT')).toBeInTheDocument()

    fireEvent.click(toggle)
    expect(feedSimulator.isBatchingEnabled()).toBe(true)
    expect(screen.getByText('RAF BATCHED')).toBeInTheDocument()
  })

  it('opens benchmark modal, selects rate, runs 1s benchmark, and displays before/after results', () => {
    render(<TelemetryBar />)

    const openBtn = screen.getByTestId('open-benchmark-btn')
    fireEvent.click(openBtn)

    expect(screen.getByTestId('benchmark-modal')).toBeInTheDocument()
    expect(screen.getByText('HIGH-FREQUENCY DATA BENCHMARK (PHASE 6)')).toBeInTheDocument()

    const runBtn = screen.getByTestId('run-benchmark-btn')
    fireEvent.click(runBtn)

    // Advance timer to trigger benchmark completion
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(screen.getByTestId('benchmark-results')).toBeInTheDocument()
    expect(screen.getByText('Render Reduction')).toBeInTheDocument()
    expect(screen.getByText('FPS Advantage')).toBeInTheDocument()
    expect(screen.getByText('BEFORE (UNBATCHED)')).toBeInTheDocument()
    expect(screen.getByText('AFTER (RAF BATCHED)')).toBeInTheDocument()
  })
})
