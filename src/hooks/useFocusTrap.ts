import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  'details > summary',
].join(', ')

/**
 * useFocusTrap
 *
 * Traps keyboard Tab / Shift+Tab focus within a container element.
 * Restores focus to the triggering element on unmount/deactivation.
 *
 * @param containerRef - ref to the container element to trap focus within
 * @param isActive     - whether the trap is currently active
 * @param initialFocusSelector - optional CSS selector for the element to focus on activation
 */
export function useFocusTrap<T extends HTMLElement = HTMLElement>(
  containerRef: React.RefObject<T | null | undefined> | { current: T | null | undefined },
  isActive: boolean,
  initialFocusSelector?: string
): void {
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isActive) return

    // Save the currently focused element so we can restore it on unmount
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      previousFocusRef.current = document.activeElement
    }

    const container = containerRef.current
    if (!container) return

    // Move initial focus to the specified element or the first focusable element
    const setInitialFocus = () => {
      const currentContainer = containerRef.current
      if (!currentContainer) return

      if (initialFocusSelector) {
        const target = currentContainer.querySelector<HTMLElement>(initialFocusSelector)
        if (target && typeof target.focus === 'function') {
          target.focus()
          return
        }
      }

      const focusable = Array.from(
        currentContainer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
      ).filter((el) => !el.closest('[hidden]') && el.getAttribute('aria-hidden') !== 'true')

      if (focusable.length > 0 && typeof focusable[0]?.focus === 'function') {
        focusable[0]?.focus()
      }
    }

    // Attempt focus immediately and also in next frame
    setInitialFocus()
    const rafId = typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame(setInitialFocus) : null

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      const currentContainer = containerRef.current
      if (!currentContainer) return

      const focusable = Array.from(
        currentContainer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
      ).filter((el) => !el.closest('[hidden]') && el.getAttribute('aria-hidden') !== 'true')

      if (focusable.length === 0) {
        e.preventDefault()
        return
      }

      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      const activeEl = document.activeElement

      const isInsideFocusable = currentContainer.contains(activeEl) && activeEl !== currentContainer

      if (!isInsideFocusable) {
        e.preventDefault()
        if (e.shiftKey) {
          last.focus()
        } else {
          first.focus()
        }
        return
      }

      if (e.shiftKey) {
        // Shift+Tab: wrap from first → last
        if (activeEl === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        // Tab: wrap from last → first
        if (activeEl === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      if (rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(rafId)
      }
      document.removeEventListener('keydown', handleKeyDown)

      // Restore focus to the previously focused element
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        try {
          previousFocusRef.current.focus()
        } catch {
          // Element may have been unmounted
        }
      }
    }
  }, [isActive, containerRef, initialFocusSelector])
}
