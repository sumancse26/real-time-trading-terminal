import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { WebSocketService } from '@/core/websocket/wsService'
import { useConnectionStore } from '@/core/store/useConnectionStore'
import { useErrorLogStore } from '@/core/store/useErrorLogStore'
import { shouldRetryQuery, queryRetryDelay } from '@/core/query/queryClient'
import {
  ApiError,
  NetworkError,
  RateLimitError,
  ValidationError,
  RequestAbortedError,
  TimeoutError,
  OrderRejectionError,
} from '@/core/api/errors'
import { MockHttpClient } from '@/core/api/client'
import { GlobalErrorBoundary, WidgetErrorBoundary } from '@/components/ui/ErrorBoundary'

// Component that intentionally throws for testing ErrorBoundaries
const CrashingComponent: React.FC<{ shouldCrash?: boolean; message?: string }> = ({
  shouldCrash = true,
  message = 'Simulated fatal crash in component',
}) => {
  if (shouldCrash) {
    throw new Error(message)
  }
  return <div data-testid="healthy-component">All systems operational</div>
}

describe('Phase 16 — Resilience & Error Handling Test Suite', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useConnectionStore.setState({
      status: 'DISCONNECTED',
      latencyMs: 12,
      reconnectAttempts: 0,
      maxReconnectAttempts: 5,
      reconnectCountdown: null,
      messagesReceived: 0,
      messagesSent: 0,
      bytesReceived: 0,
      malformedMessagesCount: 0,
      isOnline: true,
      activeSubscriptions: [],
      lastError: null,
    })
    useErrorLogStore.setState({ logs: [], unreadCount: 0 })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('WebSocket Exponential Backoff & Max Retries (1s, 2s, 4s, 8s, 16s)', () => {
    it('calculates the exact exponential backoff schedule: 1s, 2s, 4s, 8s, 16s', () => {
      const ws = new WebSocketService({
        maxReconnectAttempts: 5,
      })

      expect(ws.getBackoffDelay(1)).toBe(1000)
      expect(ws.getBackoffDelay(2)).toBe(2000)
      expect(ws.getBackoffDelay(3)).toBe(4000)
      expect(ws.getBackoffDelay(4)).toBe(8000)
      expect(ws.getBackoffDelay(5)).toBe(16000)
      expect(ws.getBackoffDelay(6)).toBe(16000) // capped at max
    })

    it('manages reconnect attempts and countdown timers during disconnect', () => {
      const ws = new WebSocketService({
        maxReconnectAttempts: 5,
      })

      // Simulate a disconnect event
      ws.simulateDisconnect()

      expect(useConnectionStore.getState().status).toBe('RECONNECTING')
      expect(useConnectionStore.getState().reconnectAttempts).toBe(1)
      expect(useConnectionStore.getState().reconnectCountdown).toBe(1) // 1s countdown for attempt 1

      // Advance timer by 1 second to trigger reconnection
      vi.advanceTimersByTime(1000)
      expect(useConnectionStore.getState().status).toBe('CONNECTED')
      expect(useConnectionStore.getState().reconnectAttempts).toBe(0)
      expect(useConnectionStore.getState().reconnectCountdown).toBeNull()

      ws.disconnect()
    })

    it('immediately attempts reconnection when reconnectNow() is triggered', () => {
      const ws = new WebSocketService({
        maxReconnectAttempts: 5,
      })

      ws.simulateDisconnect()
      expect(useConnectionStore.getState().status).toBe('RECONNECTING')

      // Call reconnectNow() without waiting for timer
      ws.reconnectNow()

      expect(useConnectionStore.getState().status).toBe('CONNECTED')
      expect(useConnectionStore.getState().reconnectAttempts).toBe(0)
      expect(useConnectionStore.getState().reconnectCountdown).toBeNull()

      ws.disconnect()
    })

    it('stops attempting reconnection and enters ERROR state once max retries is exceeded', () => {
      const ws = new WebSocketService({
        maxReconnectAttempts: 2,
        backoffSchedule: [100, 200],
      })

      // Simulate a scenario where connect() consistently fails
      vi.spyOn(ws, 'connect').mockImplementation(() => {
        useConnectionStore.getState().setStatus('ERROR')
        ws.simulateDisconnect()
      })

      ws.simulateDisconnect() // Attempt 1 (reconnectAttempts = 1)
      vi.advanceTimersByTime(100) // Trigger connect -> triggers Attempt 2 (reconnectAttempts = 2)

      expect(useConnectionStore.getState().reconnectAttempts).toBe(2)

      vi.advanceTimersByTime(200) // Exceeds maxReconnectAttempts (2)
      expect(useConnectionStore.getState().status).toBe('ERROR')

      vi.restoreAllMocks()
      ws.disconnect()
    })
  })

  describe('Malformed Data & Corrupted Packet Resilience', () => {
    it('safely handles malformed and invalid JSON WebSocket messages without throwing', () => {
      const ws = new WebSocketService()
      const initialMalformedCount = useConnectionStore.getState().malformedMessagesCount

      // Corrupted JSON string
      expect(() => {
        ws.handleIncomingRawMessage('{ invalid json string: true,')
      }).not.toThrow()

      expect(useConnectionStore.getState().malformedMessagesCount).toBe(initialMalformedCount + 1)
      expect(useErrorLogStore.getState().logs.length).toBeGreaterThan(0)
      expect(useErrorLogStore.getState().logs[0]?.severity).toBe('WARN')

      // Invalid schema / unrecognized structure
      expect(() => {
        ws.handleIncomingRawMessage(JSON.stringify({ type: 'unknown_alien_type', data: 123 }))
      }).not.toThrow()

      expect(useConnectionStore.getState().malformedMessagesCount).toBe(initialMalformedCount + 2)
      ws.disconnect()
    })

    it('safely catches listener errors in message dispatch without breaking transport', () => {
      const ws = new WebSocketService()
      const faultyListener = vi.fn().mockImplementation(() => {
        throw new Error('Listener threw fatal error')
      })

      ws.onMessage(faultyListener)

      expect(() => {
        ws.handleIncomingRawMessage(
          JSON.stringify({
            type: 'ticker',
            symbol: 'BTC/USDT',
            timestamp: Date.now(),
            data: {
              symbol: 'BTC/USDT',
              lastPrice: 64000,
              priceChange24h: 100,
              priceChangePercent24h: 1.5,
              high24h: 65000,
              low24h: 63000,
              volume24h: 1000,
              turnover24h: 64000000,
              baseAsset: 'BTC',
              quoteAsset: 'USDT',
            },
          })
        )
      }).not.toThrow()

      expect(faultyListener).toHaveBeenCalled()
      expect(useErrorLogStore.getState().logs.some(l => l.source === 'WebSocket')).toBe(true)
      ws.disconnect()
    })
  })

  describe('TanStack Query & API Retry Policies', () => {
    it('applies exponential backoff 1s, 2s, 4s, 8s, 16s for query retries', () => {
      expect(queryRetryDelay(0)).toBe(1000)
      expect(queryRetryDelay(1)).toBe(2000)
      expect(queryRetryDelay(2)).toBe(4000)
      expect(queryRetryDelay(3)).toBe(8000)
      expect(queryRetryDelay(4)).toBe(16000)
      expect(queryRetryDelay(5)).toBe(16000) // capped
    })

    it('correctly decides retry eligibility based on HTTP error status and failure count', () => {
      // Retries network, 500 server, 504 timeouts, 429 rate limit
      expect(shouldRetryQuery(0, new NetworkError())).toBe(true)
      expect(shouldRetryQuery(2, new ApiError('Internal match engine error', 500))).toBe(true)
      expect(shouldRetryQuery(1, new TimeoutError())).toBe(true)
      expect(shouldRetryQuery(3, new RateLimitError())).toBe(true)

      // Stops after 5 attempts
      expect(shouldRetryQuery(5, new NetworkError())).toBe(false)

      // Does not retry client validation (400) or aborted requests
      expect(shouldRetryQuery(0, new ValidationError('Bad request parameters'))).toBe(false)
      expect(shouldRetryQuery(0, new RequestAbortedError())).toBe(false)
      expect(shouldRetryQuery(0, new OrderRejectionError('Position limit exceeded'))).toBe(false)
    })
  })

  describe('API Timeouts & Stale Request Protection', () => {
    it('throws TimeoutError when request times out', async () => {
      const client = new MockHttpClient({
        minLatencyMs: 5,
        maxLatencyMs: 10,
        simulatedErrorType: 'timeout',
      })

      await expect(client.getTickers()).rejects.toThrow(TimeoutError)
    })

    it('throws OrderRejectionError when simulated order rejection is triggered', async () => {
      const client = new MockHttpClient({
        minLatencyMs: 5,
        maxLatencyMs: 10,
        simulatedErrorType: 'orderRejection',
      })

      await expect(
        client.createOrder({
          symbol: 'BTC/USDT',
          side: 'buy',
          type: 'LIMIT',
          price: 64000,
          quantity: 1,
        })
      ).rejects.toThrow(OrderRejectionError)
    })
  })

  describe('Error Boundaries: Global & Widget Isolation', () => {
    it('WidgetErrorBoundary catches widget render failures and displays isolated retry card', () => {
      // Suppress console.error in test output for clean reporting
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { rerender } = render(
        <WidgetErrorBoundary widgetName="Order Book">
          <CrashingComponent shouldCrash={true} message="OrderBook L2 memory corrupt" />
        </WidgetErrorBoundary>
      )

      expect(screen.getByTestId('widget-error-order-book')).toBeInTheDocument()
      expect(screen.getByText('Order Book Subsystem Failed')).toBeInTheDocument()
      expect(screen.getByText('OrderBook L2 memory corrupt')).toBeInTheDocument()
      expect(screen.getByTestId('widget-retry-btn')).toBeInTheDocument()

      // Click Retry after fixing component state
      rerender(
        <WidgetErrorBoundary widgetName="Order Book">
          <CrashingComponent shouldCrash={false} />
        </WidgetErrorBoundary>
      )

      fireEvent.click(screen.getByTestId('widget-retry-btn'))
      expect(screen.getByTestId('healthy-component')).toBeInTheDocument()

      spy.mockRestore()
    })

    it('GlobalErrorBoundary catches unhandled fatal errors and shows Terminal Kernel Panic', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { rerender } = render(
        <GlobalErrorBoundary>
          <CrashingComponent shouldCrash={true} message="Critical VM out of memory" />
        </GlobalErrorBoundary>
      )

      expect(screen.getByTestId('global-error-screen')).toBeInTheDocument()
      expect(screen.getByText('TERMINAL KERNEL PANIC')).toBeInTheDocument()
      expect(screen.getByText('Critical VM out of memory')).toBeInTheDocument()
      expect(screen.getByTestId('reload-terminal-btn')).toBeInTheDocument()
      expect(screen.getByTestId('copy-diagnostics-btn')).toBeInTheDocument()

      // Reload terminal button resets state
      rerender(
        <GlobalErrorBoundary>
          <CrashingComponent shouldCrash={false} />
        </GlobalErrorBoundary>
      )

      fireEvent.click(screen.getByTestId('reload-terminal-btn'))
      expect(screen.getByTestId('healthy-component')).toBeInTheDocument()

      spy.mockRestore()
    })
  })
})
