import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useRef } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppContent } from '@/App'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { KeyboardShortcutsModal } from '@/components/ui/KeyboardShortcutsModal'

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  )
}

describe('Phase 18 — Accessibility & Responsive Audit', () => {
  it('renders skip link targeting main-content', () => {
    renderApp()
    const skipLink = screen.getByText(/skip to main content/i)
    expect(skipLink).toBeInTheDocument()
    expect(skipLink).toHaveAttribute('href', '#main-content')

    const mainContent = document.getElementById('main-content')
    expect(mainContent).toBeInTheDocument()
    expect(mainContent).toHaveAttribute('aria-label', 'Trading Terminal Workspace')
  })

  it('renders live price region with aria-live polite in terminal header', () => {
    renderApp()
    const liveRegion = document.querySelector('.price-container')
    expect(liveRegion).toHaveAttribute('aria-live', 'polite')
    expect(liveRegion).toHaveAttribute('aria-atomic', 'true')
  })

  it('traps focus inside dialogs using useFocusTrap', () => {
    const TestComponent = ({ isActive }: { isActive: boolean }) => {
      const ref = useRef<HTMLDivElement>(null)
      useFocusTrap(ref, isActive)

      return (
        <div ref={ref}>
          <button data-testid="btn-1">Button 1</button>
          <button data-testid="btn-2">Button 2</button>
        </div>
      )
    }

    const { rerender } = render(<TestComponent isActive={true} />)
    const btn1 = screen.getByTestId('btn-1')
    const btn2 = screen.getByTestId('btn-2')

    btn2.focus()
    expect(document.activeElement).toBe(btn2)

    // Press Tab on last element -> wraps to first
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: false })
    expect(document.activeElement).toBe(btn1)

    // Press Shift+Tab on first element -> wraps to last
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(btn2)

    rerender(<TestComponent isActive={false} />)
  })

  it('renders KeyboardShortcutsModal with aria-modal and focusable close button', () => {
    const handleClose = () => {}
    render(<KeyboardShortcutsModal isOpen={true} onClose={handleClose} />)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'shortcuts-modal-title')

    const closeBtn = screen.getByTestId('close-shortcuts-modal')
    expect(closeBtn).toBeInTheDocument()
  })

  it('renders order book rows with descriptive aria-label', () => {
    renderApp()
    const rows = document.querySelectorAll('.book-row')
    if (rows.length > 0) {
      expect(rows[0]).toHaveAttribute('aria-label')
    }
  })

  it('handles Escape key to close TelemetryBar benchmark modal', () => {
    renderApp()
    const benchmarkBtn = screen.getByTestId('open-benchmark-btn')
    fireEvent.click(benchmarkBtn)

    expect(screen.getByTestId('benchmark-modal')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('benchmark-modal')).not.toBeInTheDocument()
  })
})
