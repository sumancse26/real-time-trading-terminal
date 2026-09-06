import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { orderApi } from '@/core/api/orderApi'
import { queryKeys } from './useMarketQueries'
import type { ActiveOrder, CreateOrderRequest, CancelOrderRequest } from '@/types/order'

export function useOpenOrdersQuery(symbol?: string) {
  return useQuery({
    queryKey: queryKeys.orders.open(symbol),
    queryFn: ({ signal }) => orderApi.getOpenOrders(symbol, signal),
  })
}

export function useOrderHistoryQuery(symbol?: string) {
  return useQuery({
    queryKey: queryKeys.orders.history ? queryKeys.orders.history(symbol) : ['orders', 'history', symbol],
    queryFn: ({ signal }) => orderApi.getOrderHistory(symbol, signal),
  })
}

export interface CreateOrderMutationContext {
  previousOpenOrders: ActiveOrder[]
  previousSymbolOrders?: ActiveOrder[]
  tempId: string
  symbol: string
}

export function useCreateOrderMutation() {
  const queryClient = useQueryClient()

  return useMutation<ActiveOrder, Error, CreateOrderRequest, CreateOrderMutationContext>({
    mutationFn: (req: CreateOrderRequest) => orderApi.createOrder(req),

    // Optimistic Update Phase
    onMutate: async (newOrderReq: CreateOrderRequest) => {
      // 1. Cancel in-flight queries
      await queryClient.cancelQueries({ queryKey: queryKeys.orders.all })

      // 2. Snapshot current state for rollback
      const previousOpenOrders =
        queryClient.getQueryData<ActiveOrder[]>(queryKeys.orders.open()) || []
      const previousSymbolOrders = newOrderReq.symbol
        ? queryClient.getQueryData<ActiveOrder[]>(queryKeys.orders.open(newOrderReq.symbol)) || []
        : []

      // 3. Optimistically create temporary order with PENDING lifecycle status
      const tempId = `temp-ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`
      const optimisticOrder: ActiveOrder = {
        id: tempId,
        symbol: newOrderReq.symbol,
        side: newOrderReq.side,
        type: newOrderReq.type,
        price: newOrderReq.price ?? 64250.0,
        quantity: newOrderReq.quantity,
        filledQuantity: 0,
        status: 'PENDING',
        timestamp: Date.now(),
        clientOrderId: newOrderReq.clientOrderId,
        timeInForce: newOrderReq.timeInForce ?? 'GTC',
      }

      // 4. Update the queries optimistically
      queryClient.setQueryData<ActiveOrder[]>(queryKeys.orders.open(), (old = []) => [
        optimisticOrder,
        ...old,
      ])

      if (newOrderReq.symbol) {
        queryClient.setQueryData<ActiveOrder[]>(
          queryKeys.orders.open(newOrderReq.symbol),
          (old = []) => [optimisticOrder, ...old]
        )
      }

      return {
        previousOpenOrders,
        previousSymbolOrders,
        tempId,
        symbol: newOrderReq.symbol,
      }
    },

    // Rollback to snapshot on error / rejection
    onError: (_err, _newOrder, context) => {
      if (context) {
        queryClient.setQueryData(queryKeys.orders.open(), context.previousOpenOrders)
        if (context.symbol && context.previousSymbolOrders) {
          queryClient.setQueryData(
            queryKeys.orders.open(context.symbol),
            context.previousSymbolOrders
          )
        }
      }
    },

    // Reconcile optimistic order with confirmed server order
    onSuccess: (confirmedOrder, _variables, context) => {
      if (context?.tempId) {
        queryClient.setQueryData<ActiveOrder[]>(queryKeys.orders.open(), (old = []) =>
          old.map(ord => (ord.id === context.tempId ? confirmedOrder : ord))
        )
        if (context.symbol) {
          queryClient.setQueryData<ActiveOrder[]>(
            queryKeys.orders.open(context.symbol),
            (old = []) => old.map(ord => (ord.id === context.tempId ? confirmedOrder : ord))
          )
        }
      }
    },

    // Always invalidate queries on completion to ensure full synchronization
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.account.all })
    },
  })
}

export interface CancelOrderMutationContext {
  previousOpenOrders: ActiveOrder[]
  previousSymbolOrders?: ActiveOrder[]
  symbol?: string
}

export function useCancelOrderMutation() {
  const queryClient = useQueryClient()

  return useMutation<{ success: boolean; orderId: string }, Error, CancelOrderRequest, CancelOrderMutationContext>({
    mutationFn: (req: CancelOrderRequest) => orderApi.cancelOrder(req),

    onMutate: async (cancelReq: CancelOrderRequest) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.orders.all })

      const previousOpenOrders =
        queryClient.getQueryData<ActiveOrder[]>(queryKeys.orders.open()) || []
      const previousSymbolOrders = cancelReq.symbol
        ? queryClient.getQueryData<ActiveOrder[]>(queryKeys.orders.open(cancelReq.symbol)) || []
        : []

      // Optimistically remove cancelled order from open orders
      queryClient.setQueryData<ActiveOrder[]>(queryKeys.orders.open(), (old = []) =>
        old.filter(ord => ord.id !== cancelReq.orderId)
      )

      if (cancelReq.symbol) {
        queryClient.setQueryData<ActiveOrder[]>(
          queryKeys.orders.open(cancelReq.symbol),
          (old = []) => old.filter(ord => ord.id !== cancelReq.orderId)
        )
      }

      return {
        previousOpenOrders,
        previousSymbolOrders,
        symbol: cancelReq.symbol,
      }
    },

    onError: (_err, _req, context) => {
      if (context) {
        queryClient.setQueryData(queryKeys.orders.open(), context.previousOpenOrders)
        if (context.symbol && context.previousSymbolOrders) {
          queryClient.setQueryData(
            queryKeys.orders.open(context.symbol),
            context.previousSymbolOrders
          )
        }
      }
    },

    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
    },
  })
}

export function useCancelAllOrdersMutation() {
  const queryClient = useQueryClient()

  return useMutation<{ success: boolean; cancelledCount: number }, Error, string | undefined, { previousOpenOrders: ActiveOrder[] }>({
    mutationFn: (symbol?: string) => orderApi.cancelAllOrders(symbol),
    onMutate: async (symbol?: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.orders.all })
      const previousOpenOrders =
        queryClient.getQueryData<ActiveOrder[]>(queryKeys.orders.open()) || []

      queryClient.setQueryData<ActiveOrder[]>(queryKeys.orders.open(), (old = []) =>
        symbol ? old.filter(ord => ord.symbol !== symbol) : []
      )

      return { previousOpenOrders }
    },
    onError: (_err, _symbol, context) => {
      if (context) {
        queryClient.setQueryData(queryKeys.orders.open(), context.previousOpenOrders)
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
    },
  })
}
