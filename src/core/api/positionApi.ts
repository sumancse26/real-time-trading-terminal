import { mockApiClient } from './client'
import type { Position } from '@/types/position'

export const positionApi = {
  getPositions: (signal?: AbortSignal): Promise<Position[]> =>
    mockApiClient.getPositions(signal),

  createPosition: (
    req: {
      symbol: string
      side: 'LONG' | 'SHORT'
      size: number
      entryPrice: number
      leverage?: number
    },
    signal?: AbortSignal
  ): Promise<Position> => mockApiClient.createPosition(req, signal),

  closePosition: (
    positionId: string,
    signal?: AbortSignal
  ): Promise<{ success: boolean; positionId: string }> =>
    mockApiClient.closePosition(positionId, signal),

  adjustLeverage: (
    positionId: string,
    leverage: number,
    signal?: AbortSignal
  ): Promise<Position> =>
    mockApiClient.adjustLeverage(positionId, leverage, signal),
}
