import { useQuery } from '@tanstack/react-query'
import { accountApi } from '@/core/api/accountApi'
import { queryKeys } from './useMarketQueries'

export function useAccountSummaryQuery() {
  return useQuery({
    queryKey: queryKeys.account.summary(),
    queryFn: ({ signal }) => accountApi.getAccountSummary(signal),
  })
}
