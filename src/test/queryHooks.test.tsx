import React from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  usePositionsQuery,
  useOpenOrdersQuery,
  useClosePositionMutation,
  useCancelOrderMutation,
  useCreateOrderMutation,
} from '../core/query'
import { mockApiClient } from '../core/api/client'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  })
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { queryClient, Wrapper }
}

describe('TanStack Query Hooks Integration', () => {
  beforeEach(() => {
    mockApiClient.setConfig({ minLatencyMs: 0, maxLatencyMs: 0 })
  })

  it('fetches positions and handles position closure mutation with cache invalidation', async () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(
      () => ({
        positions: usePositionsQuery(),
        closePosition: useClosePositionMutation(),
      }),
      { wrapper: Wrapper }
    )

    await waitFor(() => expect(result.current.positions.isSuccess).toBe(true))
    expect(result.current.positions.data?.length).toBeGreaterThan(0)
    const targetPos = result.current.positions.data![0]!

    await act(async () => {
      await result.current.closePosition.mutateAsync(targetPos.id)
    })

    await waitFor(() => {
      expect(result.current.positions.data?.some(p => p.id === targetPos.id)).toBe(false)
    })
  })

  it('fetches open orders and handles create & cancel mutations', async () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(
      () => ({
        orders: useOpenOrdersQuery(),
        createOrder: useCreateOrderMutation(),
        cancelOrder: useCancelOrderMutation(),
      }),
      { wrapper: Wrapper }
    )

    await waitFor(() => expect(result.current.orders.isSuccess).toBe(true))

    let createdOrderId = ''
    await act(async () => {
      const order = await result.current.createOrder.mutateAsync({
        symbol: 'SOL/USDT',
        side: 'buy',
        type: 'LIMIT',
        price: 170.0,
        quantity: 5,
      })
      createdOrderId = order.id
    })

    await waitFor(() => {
      expect(result.current.orders.data?.some(o => o.id === createdOrderId)).toBe(true)
    })

    await act(async () => {
      await result.current.cancelOrder.mutateAsync({
        orderId: createdOrderId,
        symbol: 'SOL/USDT',
      })
    })

    await waitFor(() => {
      expect(result.current.orders.data?.some(o => o.id === createdOrderId)).toBe(false)
    })
  })
})
