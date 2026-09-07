import { QueryClient } from '@tanstack/react-query'
import { isApiError } from '../api/errors'

export const queryRetryDelay = (attemptIndex: number): number => {
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s (capped at 16s)
  return Math.min(1000 * 2 ** attemptIndex, 16000)
}

export const shouldRetryQuery = (failureCount: number, error: unknown): boolean => {
  if (failureCount >= 5) return false

  if (isApiError(error)) {
    // 429 Rate limits ARE retryable
    if (error.statusCode === 429) return true

    // Do not retry client 4xx errors (validation, auth, not found, aborts)
    if (error.statusCode >= 400 && error.statusCode < 500) {
      return false
    }
    if (
      error.code === 'REQUEST_ABORTED' ||
      error.code === 'VALIDATION_ERROR' ||
      error.code === 'ORDER_REJECTED' ||
      error.code === 'POSITION_NOT_FOUND'
    ) {
      return false
    }
  }
  return true
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: shouldRetryQuery,
      retryDelay: queryRetryDelay,
    },
    mutations: {
      retry: false,
    },
  },
})

