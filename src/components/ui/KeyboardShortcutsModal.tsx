import React, { useEffect } from 'react'
import { Command, X, ArrowUpRight, ArrowDownRight, Search, Zap, CornerDownLeft } from 'lucide-react'

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

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
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
    >
      <div
        className="benchmark-modal-content shortcuts-modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-modal-title"
        data-testid="shortcuts-modal"
      >
        <div className="benchmark-modal-header">
          <div className="flex items-center gap-2">
            <Command size={16} className="text-cyan-accent" />
            <h3 id="shortcuts-modal-title" className="font-bold text-sm text-neutral-100">
              KEYBOARD SHORTCUTS & PRO-TRADING HOTKEYS
            </h3>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close Shortcuts Modal"
            data-testid="close-shortcuts-modal"
          >
            <X size={16} />
          </button>
        </div>

        <div className="shortcuts-modal-body">
          <p className="text-xs text-neutral-400 mb-3">
            Institutional fast-keys enabled. Single-letter hotkeys are automatically protected while typing in text inputs.
          </p>

          <div className="shortcuts-grid">
            {categories.map((cat) => (
              <div key={cat} className="shortcut-category-card">
                <h4 className="shortcut-category-title">{cat.toUpperCase()}</h4>
                <div className="shortcut-list">
                  {SHORTCUTS.filter((s) => s.category === cat).map((s) => (
                    <div key={s.key} className="shortcut-row">
                      <div className="flex items-center gap-2">
                        {s.icon}
                        <span className="shortcut-desc">{s.description}</span>
                      </div>
                      <kbd className="kbd-badge font-mono font-bold">{s.key}</kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="shortcuts-footer text-xs text-neutral-400 mt-4 flex items-center justify-between border-t border-border-subtle pt-3">
            <span>Press <kbd className="kbd-badge">Esc</kbd> to close at any time</span>
            <span className="text-cyan-accent font-mono font-bold">Trading Terminal v0.1.0</span>
          </div>
        </div>
      </div>
    </div>
  )
}
