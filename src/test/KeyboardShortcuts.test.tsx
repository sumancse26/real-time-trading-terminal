import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppContent } from '@/App'
import { isTextInputActive } from '@/core/keyboard/keyboardManager'
import { useMarketStore } from '@/core/store/useMarketStore'
import { mockApiClient } from '@/core/api/client'

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

describe('Phase 15 — Keyboard Shortcuts & UX', () => {
  beforeEach(() => {
    mockApiClient.setConfig({
      minLatencyMs: 0,
      maxLatencyMs: 0,
      failureRate: 0,
      simulatedErrorType: null,
    })
    useMarketStore.setState({
      selectedSymbol: 'BTC/USDT',
    })
  })

  describe('Input Protection Guard', () => {
    it('correctly identifies active text inputs and textareas', () => {
      const input = document.createElement('input')
      input.type = 'text'
      document.body.appendChild(input)
      input.focus()

      expect(isTextInputActive()).toBe(true)

      const numberInput = document.createElement('input')
      numberInput.type = 'number'
      document.body.appendChild(numberInput)
      numberInput.focus()
      expect(isTextInputActive()).toBe(true)

      const textarea = document.createElement('textarea')
      document.body.appendChild(textarea)
      textarea.focus()
      expect(isTextInputActive()).toBe(true)

      const button = document.createElement('button')
      document.body.appendChild(button)
      button.focus()
      expect(isTextInputActive()).toBe(false)

      document.body.removeChild(input)
      document.body.removeChild(numberInput)
      document.body.removeChild(textarea)
      document.body.removeChild(button)
    })
  })

  describe('Terminal Hotkeys & Interactions', () => {
    it('switches side to BUY on "B" and SELL on "S" when outside text inputs', async () => {
      renderApp()

      // Initial state is BUY
      const buyBtn = screen.getByTestId('side-buy-btn')
      const sellBtn = screen.getByTestId('side-sell-btn')

      // Press 'S' to switch to SELL
      fireEvent.keyDown(window, { key: 's', code: 'KeyS' })
      expect(sellBtn).toHaveClass('active')

      // Press 'B' to switch to BUY
      fireEvent.keyDown(window, { key: 'b', code: 'KeyB' })
      expect(buyBtn).toHaveClass('active')
    })

    it('does NOT trigger side switch when typing inside an input field', async () => {
      renderApp()

      const buyBtn = screen.getByTestId('side-buy-btn')
      const sellBtn = screen.getByTestId('side-sell-btn')

      // Focus the Watchlist search input
      const searchInput = screen.getByTestId('watchlist-search-input')
      searchInput.focus()
      expect(document.activeElement).toBe(searchInput)

      // Type 's' inside the search input
      fireEvent.keyDown(searchInput, { key: 's', code: 'KeyS' })

      // Side should STILL be 'buy', NOT changed to 'sell'
      expect(buyBtn).toHaveClass('active')
      expect(sellBtn).not.toHaveClass('active')
    })

    it('focuses Watchlist search input on "/" key', async () => {
      renderApp()

      const searchInput = screen.getByTestId('watchlist-search-input')
      expect(document.activeElement).not.toBe(searchInput)

      // Press '/'
      fireEvent.keyDown(window, { key: '/', code: 'Slash' })

      // Search input should now be focused
      expect(document.activeElement).toBe(searchInput)
    })

    it('toggles Keyboard Shortcuts Reference modal on "?" and closes on "Esc"', async () => {
      renderApp()

      expect(screen.queryByTestId('shortcuts-modal')).not.toBeInTheDocument()

      // Press '?' to open modal
      fireEvent.keyDown(window, { key: '?', code: 'Slash', shiftKey: true })
      expect(screen.getByTestId('shortcuts-modal')).toBeInTheDocument()
      expect(screen.getByText('KEYBOARD SHORTCUTS & PRO-TRADING HOTKEYS')).toBeInTheDocument()

      // Press 'Escape' to close modal
      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' })
      expect(screen.queryByTestId('shortcuts-modal')).not.toBeInTheDocument()
    })

    it('opens modal via Header command button', async () => {
      renderApp()

      const openBtn = screen.getByTestId('open-shortcuts-btn')
      fireEvent.click(openBtn)

      expect(screen.getByTestId('shortcuts-modal')).toBeInTheDocument()

      const closeBtn = screen.getByTestId('close-shortcuts-modal')
      fireEvent.click(closeBtn)

      expect(screen.queryByTestId('shortcuts-modal')).not.toBeInTheDocument()
    })

    it('switches timeframe on number keys 1, 2, 3, 4, 5', async () => {
      renderApp()

      const tf1D = screen.getByTestId('timeframe-1D')
      const tf1W = screen.getByTestId('timeframe-1W')
      const tf1M = screen.getByTestId('timeframe-1M')

      expect(tf1D).toHaveClass('active')

      // Press '2' for 1W
      fireEvent.keyDown(window, { key: '2', code: 'Digit2' })
      expect(tf1W).toHaveClass('active')

      // Press '3' for 1M
      fireEvent.keyDown(window, { key: '3', code: 'Digit3' })
      expect(tf1M).toHaveClass('active')
    })
  })
})
