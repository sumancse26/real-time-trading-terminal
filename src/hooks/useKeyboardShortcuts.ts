import { useEffect, useRef } from 'react'
import {
  keyboardManager,
  type KeyboardAction,
  type KeyboardActionListener,
} from '@/core/keyboard/keyboardManager'

export type ActionHandlerMap = Partial<
  Record<KeyboardAction, (event: KeyboardEvent) => void>
>

/**
 * Hook to register keyboard action handlers with automatic cleanup.
 *
 * Example:
 * useKeyboardShortcuts({
 *   BUY: () => setSide('buy'),
 *   SELL: () => setSide('sell'),
 *   ESCAPE: () => closeModal(),
 * })
 */
export function useKeyboardShortcuts(handlers: ActionHandlerMap) {
  const handlersRef = useRef<ActionHandlerMap>(handlers)

  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  useEffect(() => {
    const listener: KeyboardActionListener = (action, event) => {
      const handler = handlersRef.current[action]
      if (handler) {
        handler(event)
      }
    }

    const unsub = keyboardManager.subscribe(listener)
    return unsub
  }, [])
}
