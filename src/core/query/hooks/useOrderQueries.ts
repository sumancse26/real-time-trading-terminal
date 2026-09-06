import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { orderApi } from '@/core/api/orderApi'
import { queryKeys } from './useMarketQueries'
import type { CreateOrderRequest, CancelOrderRequest } from '@/types/order'

export function useOpenOrdersQuery(symbol?: string) {
  return useQuery({
    queryKey: queryKeys.orders.open(symbol),
    queryFn: ({ signal }) => orderApi.getOpenOrders(symbol, signal),
  })
}

export function useCreateOrderMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (req: CreateOrderRequest) => orderApi.createOrder(req),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.account.all })
    },
  })
}

export function useCancelOrderMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (req: CancelOrderRequest) => orderApi.cancelOrder(req),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
    },
  })
}

export function useCancelAllOrdersMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (symbol?: string) => orderApi.cancelAllOrders(symbol),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
    },
  })
}
