import { mockApiClient } from './client'
import type { ActiveOrder, CreateOrderRequest, CancelOrderRequest } from '@/types/order'

export const orderApi = {
  getOpenOrders: (symbol?: string, signal?: AbortSignal): Promise<ActiveOrder[]> =>
    mockApiClient.getOpenOrders(symbol, signal),

  createOrder: (req: CreateOrderRequest, signal?: AbortSignal): Promise<ActiveOrder> =>
    mockApiClient.createOrder(req, signal),

  cancelOrder: (
    req: CancelOrderRequest,
    signal?: AbortSignal
  ): Promise<{ success: boolean; orderId: string }> =>
    mockApiClient.cancelOrder(req, signal),

  cancelAllOrders: (
    symbol?: string,
    signal?: AbortSignal
  ): Promise<{ success: boolean; cancelledCount: number }> =>
    mockApiClient.cancelAllOrders(symbol, signal),

  getOrderHistory: (symbol?: string, signal?: AbortSignal): Promise<ActiveOrder[]> =>
    mockApiClient.getOrderHistory(symbol, signal),
}
