/**
 * Phase 15 — Global Keyboard Shortcuts & Focus Manager
 */

export type KeyboardAction =
  | 'BUY'
  | 'SELL'
  | 'FOCUS_SEARCH'
  | 'ESCAPE'
  | 'SUBMIT'
  | 'ORDER_TYPE_LIMIT'
  | 'ORDER_TYPE_MARKET'
  | 'TIMEFRAME_1D'
  | 'TIMEFRAME_1W'
  | 'TIMEFRAME_1M'
  | 'TIMEFRAME_3M'
  | 'TIMEFRAME_1Y'
  | 'TOGGLE_SHORTCUTS_HELP'

export type KeyboardActionListener = (action: KeyboardAction, event: KeyboardEvent) => void

/**
 * Checks whether the active element is an interactive text input
 * where single-key shortcuts MUST be disabled to avoid intercepting user typing.
 */
export function isTextInputActive(): boolean {
  if (typeof document === 'undefined') return false
  const active = document.activeElement
  if (!active) return false

  const tagName = active.tagName.toLowerCase()
  if (tagName === 'input') {
    const inputType = (active as HTMLInputElement).type?.toLowerCase()
    // Range/checkbox/radio/button/submit don't accept freeform text, but text/number/search/email/password do
    return !['checkbox', 'radio', 'range', 'button', 'submit', 'reset'].includes(inputType)
  }
  if (tagName === 'textarea' || tagName === 'select') {
    return true
  }
  if ((active as HTMLElement).isContentEditable) {
    return true
  }

  return false
}

export class KeyboardManager {
  private listeners = new Set<KeyboardActionListener>()
  private isListening = false

  public subscribe(listener: KeyboardActionListener): () => void {
    this.listeners.add(listener)
    if (!this.isListening && typeof window !== 'undefined') {
      this.attach()
    }
    return () => {
      this.listeners.delete(listener)
      if (this.listeners.size === 0) {
        this.detach()
      }
    }
  }

  public handleKeyDown = (e: KeyboardEvent) => {
    const inInput = isTextInputActive()
    const key = e.key
    const isCtrlOrMeta = e.ctrlKey || e.metaKey

    // ─── 1. Always-Available Global Control Keys (Works even inside inputs) ───
    if (key === 'Escape') {
      this.dispatch('ESCAPE', e)
      return
    }

    if (key === 'Enter') {
      // Enter without Shift
      if (!e.shiftKey) {
        this.dispatch('SUBMIT', e)
      }
      return
    }

    // ─── 2. Input-Protected Single-Key Hotkeys ────────────────────────────────
    // If the user is actively typing in an input field, DO NOT intercept normal letters/numbers!
    if (inInput) {
      return
    }

    // Single-key hotkeys (case-insensitive)
    switch (key.toLowerCase()) {
      case 'b':
        e.preventDefault()
        this.dispatch('BUY', e)
        break

      case 's':
        e.preventDefault()
        this.dispatch('SELL', e)
        break

      case '/':
        e.preventDefault()
        this.dispatch('FOCUS_SEARCH', e)
        break

      case '?':
        e.preventDefault()
        this.dispatch('TOGGLE_SHORTCUTS_HELP', e)
        break

      case 'm':
        if (!isCtrlOrMeta) {
          e.preventDefault()
          this.dispatch('ORDER_TYPE_MARKET', e)
        }
        break

      case 'l':
        if (!isCtrlOrMeta) {
          e.preventDefault()
          this.dispatch('ORDER_TYPE_LIMIT', e)
        }
        break

      case '1':
        this.dispatch('TIMEFRAME_1D', e)
        break
      case '2':
        this.dispatch('TIMEFRAME_1W', e)
        break
      case '3':
        this.dispatch('TIMEFRAME_1M', e)
        break
      case '4':
        this.dispatch('TIMEFRAME_3M', e)
        break
      case '5':
        this.dispatch('TIMEFRAME_1Y', e)
        break
    }
  }

  private dispatch(action: KeyboardAction, event: KeyboardEvent) {
    for (const listener of this.listeners) {
      listener(action, event)
    }
  }

  public attach() {
    if (typeof window !== 'undefined' && !this.isListening) {
      window.addEventListener('keydown', this.handleKeyDown, { passive: false })
      this.isListening = true
    }
  }

  public detach() {
    if (typeof window !== 'undefined' && this.isListening) {
      window.removeEventListener('keydown', this.handleKeyDown)
      this.isListening = false
    }
  }
}

export const keyboardManager = new KeyboardManager()
