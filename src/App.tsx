import React, { useEffect, useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/core/query/queryClient'
import { TerminalHeader } from '@/features/header/components/TerminalHeader'
import { TelemetryBar } from '@/features/analytics-metrics/components/TelemetryBar'
import { WatchlistPanel } from '@/features/watchlist/components/WatchlistPanel'
import { OrderBookView } from '@/features/order-book/components/OrderBookView'
import { TradingChartPlaceholder } from '@/features/chart/components/TradingChartPlaceholder'
import { TradesStreamView } from '@/features/trades-stream/components/TradesStreamView'
import { OrderEntryForm } from '@/features/order-entry/components/OrderEntryForm'
import { PositionsView } from '@/features/positions-portfolio/components/PositionsView'
import { KeyboardShortcutsModal } from '@/components/ui/KeyboardShortcutsModal'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { feedSimulator } from '@/core/stream/mockFeed'

export const AppContent: React.FC = () => {
  const [showShortcutsModal, setShowShortcutsModal] = useState(false)

  useKeyboardShortcuts({
    TOGGLE_SHORTCUTS_HELP: () => setShowShortcutsModal((prev) => !prev),
    ESCAPE: () => setShowShortcutsModal(false),
  })

  useEffect(() => {
    feedSimulator.start(20)
    return () => {
      feedSimulator.stop()
    }
  }, [])

  return (
    <div className="app-container" data-testid="app-container">
      <TerminalHeader onOpenShortcuts={() => setShowShortcutsModal(true)} />
      <TelemetryBar />

      <main className="terminal-layout">
        {/* Col 1 — Watchlist, spans rows 1+2 */}
        <div className="watchlist-grid-cell">
          <WatchlistPanel />
        </div>

        {/* Col 2 row 1 — Chart */}
        <div className="chart-grid-cell">
          <TradingChartPlaceholder />
        </div>

        {/* Col 2 row 2 — Trades Stream */}
        <div className="trades-grid-cell">
          <TradesStreamView />
        </div>

        {/* Col 3 — Order Book, spans rows 1+2 */}
        <div className="orderbook-grid-cell">
          <OrderBookView />
        </div>

        {/* Col 4 — Order Entry, spans rows 1+2 */}
        <div className="orderentry-grid-cell">
          <OrderEntryForm />
        </div>

        {/* Full-width row 3 — Positions / Orders */}
        <div className="positions-grid-cell">
          <PositionsView />
        </div>
      </main>

      {/* Keyboard Shortcuts Reference Modal */}
      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />
    </div>
  )
}

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  )
}

export default App
