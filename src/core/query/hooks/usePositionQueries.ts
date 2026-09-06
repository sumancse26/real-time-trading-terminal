import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { positionApi } from '@/core/api/positionApi'
import { queryKeys } from './useMarketQueries'

export function usePositionsQuery() {
  return useQuery({
    queryKey: queryKeys.positions.list(),
    queryFn: ({ signal }) => positionApi.getPositions(signal),
  })
}

export function useClosePositionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (positionId: string) => positionApi.closePosition(positionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.positions.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.account.all })
    },
  })
}

export function useAdjustLeverageMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ positionId, leverage }: { positionId: string; leverage: number }) =>
      positionApi.adjustLeverage(positionId, leverage),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.positions.all })
    },
  })
}
