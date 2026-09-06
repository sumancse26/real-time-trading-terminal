import { mockApiClient } from './client'
import type { AccountSummary } from '@/types/account'

export const accountApi = {
  getAccountSummary: (signal?: AbortSignal): Promise<AccountSummary> =>
    mockApiClient.getAccountSummary(signal),
}
