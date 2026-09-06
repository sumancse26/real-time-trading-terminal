import type { WsServerMessage } from './websocket'
import { isWsServerMessage } from './guards'

export type ValidationSuccess<T> = {
  readonly success: true
  readonly data: T
}

export type ValidationFailure = {
  readonly success: false
  readonly error: string
  readonly details?: unknown
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure

/**
 * Validates unknown external data against a TypeScript type guard.
 * Returns a typed success result or detailed error failure.
 */
export function validateExternal<T>(
  value: unknown,
  guard: (val: unknown) => val is T,
  schemaName: string
): ValidationResult<T> {
  if (value === null || value === undefined) {
    return {
      success: false,
      error: `Validation failed: expected ${schemaName}, received ${String(value)}`,
    }
  }

  if (guard(value)) {
    return {
      success: true,
      data: value,
    }
  }

  return {
    success: false,
    error: `Validation failed: payload does not conform to ${schemaName} schema`,
    details: value,
  }
}

/**
 * Safely parses a JSON string into unknown data without throwing exceptions.
 */
export function parseJsonSafe(raw: string): ValidationResult<unknown> {
  try {
    const data: unknown = JSON.parse(raw)
    return { success: true, data }
  } catch (err) {
    return {
      success: false,
      error: `JSON parse error: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

/**
 * Safely parses raw incoming WebSocket payload (string or object) into a validated WsServerMessage.
 */
export function parseWsServerMessage(raw: unknown): ValidationResult<WsServerMessage> {
  let parsed: unknown = raw

  if (typeof raw === 'string') {
    const jsonResult = parseJsonSafe(raw)
    if (!jsonResult.success) {
      return jsonResult
    }
    parsed = jsonResult.data
  }

  return validateExternal(parsed, isWsServerMessage, 'WsServerMessage')
}
