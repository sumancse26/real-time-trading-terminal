import React, { useEffect, useRef } from 'react'
import { Command, X, ArrowUpRight, ArrowDownRight, Search, Zap, CornerDownLeft } from 'lucide-react'
import { useFocusTrap } from '@/hooks/useFocusTrap'

export interface KeyboardShortcutsModalProps {
  isOpen: boolean
  onClose: () => void
}

interface ShortcutItem {
  key: string
  description: string
  category: 'Trading' | 'Navigation' | 'General'
  icon?: React.ReactNode
}

const SHORTCUTS: ShortcutItem[] = [
  { key: 'B', description: 'Switch Order Entry to BUY / LONG side', category: 'Trading', icon: <ArrowUpRight size={13} className="text-buy" /> },
  { key: 'S', description: 'Switch Order Entry to SELL / SHORT side', category: 'Trading', icon: <ArrowDownRight size={13} className="text-sell" /> },
  { key: 'M', description: 'Set order type to MARKET execution', category: 'Trading' },
  { key: 'L', description: 'Set order type to LIMIT order', category: 'Trading' },
  { key: 'Enter', description: 'Submit active order form (when valid)', category: 'Trading', icon: <CornerDownLeft size={13} /> },
  { key: '/', description: 'Focus Watchlist symbol search', category: 'Navigation', icon: <Search size={13} /> },
  { key: '1 – 5', description: 'Switch chart timeframe (1D / 1W / 1M / 3M / 1Y)', category: 'Navigation' },
  { key: 'Esc', description: 'Close open modals / blur focused inputs', category: 'General' },
  { key: '?', description: 'Toggle this Keyboard Shortcuts reference HUD', category: 'General', icon: <Zap size={13} className="text-warning" /> },
]

const MODAL_DESC_ID = 'shortcuts-modal-desc'
const MODAL_TITLE_ID = 'shortcuts-modal-title'

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)

  // Focus trap: cycle Tab/Shift+Tab within the dialog, restore focus on close
  useFocusTrap(containerRef, isOpen, '[data-autofocus]')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const categories = ['Trading', 'Navigation', 'General'] as const

  return (
    <div
      className="benchmark-modal-backdrop"
      onClick={onClose}
      data-testid="shortcuts-modal-backdrop"
      aria-hidden="false"
    >
      <div
        ref={containerRef}
        className="benchmark-modal-content shortcuts-modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={MODAL_TITLE_ID}
        aria-describedby={MODAL_DESC_ID}
        data-testid="shortcuts-modal"
      >
        <div className="benchmark-modal-header">
          <div className="flex items-center gap-2">
            <Command size={16} className="text-cyan-accent" />
            <h2 id={MODAL_TITLE_ID} className="font-bold text-sm text-neutral-100">
              KEYBOARD SHORTCUTS &amp; PRO-TRADING HOTKEYS
            </h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close Keyboard Shortcuts"
            data-testid="close-shortcuts-modal"
            data-autofocus
          >
            <X size={16} />
          </button>
        </div>

        <div className="shortcuts-modal-body">
          <p id={MODAL_DESC_ID} className="text-xs text-neutral-400 mb-3">
            Institutional fast-keys enabled. Single-letter hotkeys are automatically protected while typing in text inputs.
          </p>

          <div className="shortcuts-grid" role="list" aria-label="Keyboard shortcut categories">
            {categories.map((cat) => (
              <div key={cat} className="shortcut-category-card" role="listitem">
                <h3 className="shortcut-category-title">{cat.toUpperCase()}</h3>
                <dl className="shortcut-list">
                  {SHORTCUTS.filter((s) => s.category === cat).map((s) => (
                    <div key={s.key} className="shortcut-row">
                      <div className="flex items-center gap-2">
                        {s.icon && <span aria-hidden="true">{s.icon}</span>}
                        <dd className="shortcut-desc">{s.description}</dd>
                      </div>
                      <dt>
                        <kbd className="kbd-badge font-mono font-bold" aria-label={`Key: ${s.key}`}>{s.key}</kbd>
                      </dt>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>

          <div className="shortcuts-footer text-xs text-neutral-400 mt-4 flex items-center justify-between border-t border-border-subtle pt-3">
            <span>Press <kbd className="kbd-badge" aria-label="Escape key">Esc</kbd> to close at any time</span>
            <span className="text-cyan-accent font-mono font-bold">Trading Terminal v0.1.0</span>
          </div>
        </div>
      </div>
    </div>
  )
}
