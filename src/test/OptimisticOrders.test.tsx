import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PositionsView } from '../features/positions-portfolio/components/PositionsView'
import { mockApiClient } from '../core/api/client'
import { useMarketStore } from '../core/store/useMarketStore'
import { useCreateOrderMutation, useCancelOrderMutation } from '../core/query/hooks/useOrderQueries'
import { queryKeys } from '../core/query/hooks/useMarketQueries'
import type { ActiveOrder, CreateOrderRequest, CancelOrderRequest } from '../types/order'

function renderWithClient(ui: React.ReactElement, client?: QueryClient) {
  const testQueryClient =
    client ||
    new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    })

  return {
    ...render(<QueryClientProvider client={testQueryClient}>{ui}</QueryClientProvider>),
    queryClient: testQueryClient,
  }
}

describe('Phase 9 — Orders & Optimistic UI Lifecycle', () => {
  beforeEach(() => {
    mockApiClient.setConfig({
      minLatencyMs: 0,
      maxLatencyMs: 0,
      failureRate: 0,
      simulatedErrorType: null,
    })
    useMarketStore.setState({
      selectedSymbol: 'BTC/USDT',
    })
  })

  it('optimistically inserts a PENDING order into the query cache upon mutation trigger', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

    // Seed initial cache
    queryClient.setQueryData<ActiveOrder[]>(queryKeys.orders.open('BTC/USDT'), [])
    queryClient.setQueryData<ActiveOrder[]>(queryKeys.orders.open(), [])

    // Add latency to verify optimistic in-flight state
    mockApiClient.setConfig({ minLatencyMs: 100, maxLatencyMs: 100, failureRate: 0 })

    let mutateFn: (req: CreateOrderRequest) => Promise<ActiveOrder> = async () => ({} as ActiveOrder)

    function TestComponent() {
      const mutation = useCreateOrderMutation()
      mutateFn = mutation.mutateAsync
      return <div>Mutator</div>
    }

    renderWithClient(<TestComponent />, queryClient)

    // Trigger mutation
    const mutatePromise = mutateFn({
      symbol: 'BTC/USDT',
      side: 'buy',
      type: 'LIMIT',
      price: 64500,
      quantity: 0.1,
    })

    // Wait for optimistic state to be committed in cache before network completes
    await waitFor(() => {
      const optimisticCache = queryClient.getQueryData<ActiveOrder[]>(queryKeys.orders.open('BTC/USDT'))
      expect(optimisticCache).toBeDefined()
      expect(optimisticCache?.length).toBe(1)
      expect(optimisticCache?.[0]?.status).toBe('PENDING')
      expect(optimisticCache?.[0]?.id.startsWith('temp-ord-')).toBe(true)
    })

    // Await server resolution
    const created = await mutatePromise
    expect(created.status).toBe('NEW')

    // Verify cache reconciled with server order id
    await waitFor(() => {
      const finalCache = queryClient.getQueryData<ActiveOrder[]>(queryKeys.orders.open('BTC/USDT'))
      expect(finalCache?.some((o) => o.id === created.id && o.status === 'NEW')).toBe(true)
    })
  })

  it('rolls back cache to previous snapshot if order creation fails or is rejected', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

    const initialOrder: ActiveOrder = {
      id: 'existing-ord-1',
      symbol: 'BTC/USDT',
      side: 'buy',
      type: 'LIMIT',
      price: 60000,
      quantity: 1,
      filledQuantity: 0,
      status: 'NEW',
      timestamp: Date.now(),
    }

    queryClient.setQueryData<ActiveOrder[]>(queryKeys.orders.open('BTC/USDT'), [initialOrder])
    queryClient.setQueryData<ActiveOrder[]>(queryKeys.orders.open(), [initialOrder])

    // Set client to fail
    mockApiClient.setConfig({
      minLatencyMs: 0,
      maxLatencyMs: 0,
      failureRate: 1,
      simulatedErrorType: 'server',
    })

    let mutateFn: (req: CreateOrderRequest) => Promise<ActiveOrder> = async () => ({} as ActiveOrder)

    function TestComponent() {
      const mutation = useCreateOrderMutation()
      mutateFn = mutation.mutateAsync
      return <div>Mutator</div>
    }

    renderWithClient(<TestComponent />, queryClient)

    await expect(
      mutateFn({
        symbol: 'BTC/USDT',
        side: 'sell',
        type: 'LIMIT',
        price: 65000,
        quantity: 0.5,
      })
    ).rejects.toThrow()

    // Verify rollback: optimistic order was removed, original order remains intact
    const restoredCache = queryClient.getQueryData<ActiveOrder[]>(queryKeys.orders.open('BTC/USDT'))
    expect(restoredCache).toEqual([initialOrder])
  })

  it('prevents duplicate rapid order submission with signature debouncing', async () => {
    mockApiClient.setConfig({ minLatencyMs: 0, maxLatencyMs: 0, failureRate: 0 })

    const orderRequest: CreateOrderRequest = {
      symbol: 'BTC/USDT',
      side: 'buy',
      type: 'LIMIT',
      price: 64123.45,
      quantity: 0.25,
    }

    // First submission succeeds
    const firstOrder = await mockApiClient.createOrder(orderRequest)
    expect(firstOrder.id).toBeDefined()

    // Immediate second identical submission within 500ms idempotency window should be rejected
    await expect(mockApiClient.createOrder(orderRequest)).rejects.toThrow(/Duplicate order/i)
  })

  it('optimistically removes cancelled order and rolls back if cancellation fails', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

    // Create an order first
    mockApiClient.setConfig({ minLatencyMs: 0, maxLatencyMs: 0, failureRate: 0 })
    const created = await mockApiClient.createOrder({
      symbol: 'BTC/USDT',
      side: 'buy',
      type: 'LIMIT',
      price: 62000,
      quantity: 0.5,
    })

    queryClient.setQueryData<ActiveOrder[]>(queryKeys.orders.open('BTC/USDT'), [created])
    queryClient.setQueryData<ActiveOrder[]>(queryKeys.orders.open(), [created])

    // Configure failure for cancellation
    mockApiClient.setConfig({
      minLatencyMs: 0,
      maxLatencyMs: 0,
      failureRate: 1,
      simulatedErrorType: 'server',
    })

    let cancelFn: (req: CancelOrderRequest) => Promise<{ success: boolean; orderId: string }> = async () => ({
      success: false,
      orderId: '',
    })

    function CancelComponent() {
      const mutation = useCancelOrderMutation()
      cancelFn = mutation.mutateAsync
      return <div>CancelMutator</div>
    }

    renderWithClient(<CancelComponent />, queryClient)

    await expect(cancelFn({ orderId: created.id, symbol: 'BTC/USDT' })).rejects.toThrow()

    // Verify cache rolled back and still contains the order
    const rolledBackCache = queryClient.getQueryData<ActiveOrder[]>(queryKeys.orders.open('BTC/USDT'))
    expect(rolledBackCache?.some((o) => o.id === created.id)).toBe(true)
  })

  it('displays order history tab with badge indicators for order lifecycle states', async () => {
    mockApiClient.setConfig({ minLatencyMs: 0, maxLatencyMs: 0, failureRate: 0 })

    // Place and cancel an order to have both open and history items
    const order = await mockApiClient.createOrder({
      symbol: 'BTC/USDT',
      side: 'buy',
      type: 'LIMIT',
      price: 63000,
      quantity: 0.1,
    })
    await mockApiClient.cancelOrder({ orderId: order.id, symbol: 'BTC/USDT' })

    renderWithClient(<PositionsView />)

    // Switch to Order History tab
    const historyTab = screen.getByTestId('tab-history')
    fireEvent.click(historyTab)

    await waitFor(() => {
      expect(screen.getByTestId('order-history-table')).toBeInTheDocument()
      expect(screen.getAllByText('CANCELLED').length).toBeGreaterThan(0)
    })
  })
})
