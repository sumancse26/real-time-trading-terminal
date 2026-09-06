import { QueryClient } from '@tanstack/react-query'
import { isApiError } from '../api/errors'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (failureCount >= 3) return false

        if (isApiError(error)) {
          // Do not retry client 4xx validation errors or explicit aborts
          if (error.statusCode >= 400 && error.statusCode < 500) {
            return false
          }
          if (error.code === 'REQUEST_ABORTED' || error.code === 'VALIDATION_ERROR') {
            return false
          }
        }
        return true
      },
      retryDelay: attemptIndex => Math.min(500 * 2 ** attemptIndex, 5000),
    },
    mutations: {
      retry: false,
    },
  },
})
