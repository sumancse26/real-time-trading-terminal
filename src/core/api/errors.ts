export class ApiError extends Error {
  public readonly statusCode: number
  public readonly code: string
  public readonly details?: unknown

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
    Object.setPrototypeOf(this, ApiError.prototype)
  }
}

export class NetworkError extends ApiError {
  constructor(message = 'Network connectivity error. Please check your connection.') {
    super(message, 0, 'NETWORK_ERROR')
    this.name = 'NetworkError'
    Object.setPrototypeOf(this, NetworkError.prototype)
  }
}

export class RateLimitError extends ApiError {
  public readonly retryAfterMs: number

  constructor(message = 'Rate limit exceeded. Too many requests.', retryAfterMs = 1000) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', { retryAfterMs })
    this.name = 'RateLimitError'
    this.retryAfterMs = retryAfterMs
    Object.setPrototypeOf(this, RateLimitError.prototype)
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details)
    this.name = 'ValidationError'
    Object.setPrototypeOf(this, ValidationError.prototype)
  }
}

export class RequestAbortedError extends ApiError {
  constructor(message = 'The request was cancelled by the client.') {
    super(message, 499, 'REQUEST_ABORTED')
    this.name = 'RequestAbortedError'
    Object.setPrototypeOf(this, RequestAbortedError.prototype)
  }
}

export class TimeoutError extends ApiError {
  public readonly timeoutMs: number

  constructor(message = 'The request timed out before receiving a response.', timeoutMs = 8000) {
    super(message, 504, 'REQUEST_TIMEOUT', { timeoutMs })
    this.name = 'TimeoutError'
    this.timeoutMs = timeoutMs
    Object.setPrototypeOf(this, TimeoutError.prototype)
  }
}

export class OrderRejectionError extends ApiError {
  public readonly reason: string

  constructor(
    message: string,
    reason = 'ORDER_REJECTED',
    statusCode = 422,
    details?: unknown
  ) {
    super(message, statusCode, reason, details)
    this.name = 'OrderRejectionError'
    this.reason = reason
    Object.setPrototypeOf(this, OrderRejectionError.prototype)
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

