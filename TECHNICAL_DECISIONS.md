# Phase 1 — Technical Decisions

## TD-001 — CSS Grid Layout Strategy

**Decision**: Use CSS Grid with named placement classes (`watchlist-grid-cell`, `chart-grid-cell`, etc.) on wrapper `<div>` elements rather than applying grid classes directly to feature components.

**Rationale**:
- Feature components should be layout-agnostic — they don't know or care where they appear in the page grid.
- Named wrapper divs decouple the grid topology from the component implementation, making it trivial to rearrange the layout without touching any feature code.
- `grid-row: 1 / 3` span on Watchlist/OrderBook/OrderEntry is expressed once in CSS, not duplicated.

**Alternative considered**: Passing a `gridCell` prop into `Card` to stamp grid placement inline. Rejected — mixing layout concerns into presentational components.

---

## TD-002 — `overflow: hidden` on `body` + `html`

**Decision**: `html, body { overflow: hidden }` with `height: 100%`; all scrolling happens inside individual panel bodies.

**Rationale**:
- Prevents the page-level scrollbar from appearing when content overflows the viewport.
- Keeps the terminal frame (header + telemetry bar + grid) always visible without scrolling.
- Each panel's `.panel-body` uses `min-height: 0` (required for flex children) so their own `overflow-y: auto` scrollbars function correctly.

**Trade-off**: Deep-linking / anchoring is not possible for individual rows (acceptable at Phase 1).

---

## TD-003 — `NumberFlash` animation approach (ref + CSS class toggle)

**Decision**: `NumberFlash` detects direction change by comparing incoming `value` to `prevRef.current` (a `useRef`, not state). It sets a CSS class (`flash-buy-anim` / `flash-sell-anim`) then clears it 450ms later via `setTimeout`.

**Rationale**:
- Using a `ref` avoids an extra render cycle just to record the previous value.
- CSS-driven flash animations are GPU-composited (opacity/background transitions), keeping the main thread free.
- The class is removed after the animation duration so the same class can be re-applied on the very next tick without needing a `key` reset hack.

**Alternative considered**: CSS `animation` with `key={value}` to force remount. Rejected — causes full DOM removal/insertion on every tick, harmful to performance at 60Hz feeds.

---

## TD-004 — `feedSimulator.start(60)` — single global instance

**Decision**: `feedSimulator` is a module-level singleton started once in `App.tsx`'s `useEffect`, not per-component.

**Rationale**:
- All feature components subscribe via `feedSimulator.onTrade()`, `onOrderBook()`, `onTicker()` — they are pure event listeners.
- A single `setInterval` at 60ms drives every panel synchronously, guaranteeing consistent price state across the board.
- The simulator checks `isRunning` before starting, making it safe to call `start()` multiple times (idempotent).

---

## TD-005 — Watchlist correlated noise model

**Decision**: BTC/USDT tracks the live ticker price exactly. Other symbols (ETH, SOL, etc.) apply `±0.05% random noise` per tick from the BTC ticker callback.

**Rationale**:
- Avoids a second simulator for each instrument; reuses the existing BTC event.
- Gives visual activity across all rows without over-engineering a multi-instrument feed for Phase 1.
- The noise magnitude (0.001 * price) is small enough not to cause unrealistic price drift over a short session.

**Future**: Phase 2 should introduce a `MultiAssetFeedSimulator` with per-instrument price models and proper correlation coefficients.

---

## TD-006 — Responsive breakpoints: 1080px & 768px

**Decision**: Two breakpoints — `≤1080px` collapses to a 2-column layout; `≤768px` goes single-column.

**Rationale**:
- At 1080px the 4-column grid becomes unreadably narrow per column.
- 1080px is a common laptop screen width (13" / 14" at non-100%-DPI).
- Hiding `market-stats-strip` at ≤1080px and `status-indicators` at ≤768px avoids header overflow.

---

## TD-007 — Barrel export `src/components/ui/index.ts`

**Decision**: Added `index.ts` barrel exporting all UI primitives from `@/components/ui`.

**Rationale**:
- Allows `import { Badge, Button, Card, Spinner, Tooltip, NumberFlash } from '@/components/ui'` instead of six individual path imports.
- Single point of change when a component is renamed or moved.
- ESLint rule `@typescript-eslint/consistent-type-imports` is satisfied because the barrel re-exports types with `export type`.

---

## TD-008 — `min-height: 0` on flex grid children

**Decision**: Every `.{name}-grid-cell` has `min-height: 0` set explicitly.

**Rationale**:
- CSS Flexbox/Grid children have an implicit `min-height: auto` which prevents them from shrinking below their content size.
- Without `min-height: 0` the grid rows would overflow the viewport height and the terminal-level scrollbar would appear — defeating TD-002.
- This is a well-known "flex gotcha" documented in the CSS spec; explicitly setting it prevents future confusion.

---

# Phase 2 — Technical Decisions

## TD-009 — Discriminated Unions for WebSocket Protocols

**Decision**: Structure all incoming server messages (`WsServerMessage`) with a `'type'` discriminator (`'ticker'`, `'trade'`, `'book_snapshot'`, `'book_delta'`, `'kline'`, `'execution_report'`, `'order_update'`, `'position_update'`, `'account_update'`, `'subscribed'`, `'unsubscribed'`, `'pong'`, `'error'`) and outgoing client commands (`WsClientMessage`) with an `'action'` discriminator (`'subscribe'`, `'unsubscribe'`, `'ping'`, `'auth'`, `'create_order'`, `'cancel_order'`).

**Rationale**:
- Discriminated unions allow TypeScript's flow analysis to narrow message payloads with 100% type safety and exhaustive switch pattern matching.
- Explicit `type` discriminator cleanly separates event streams from RPC action requests.
- Makes mocking, protocol versioning, and packet validation predictable.

---

## TD-010 — Runtime Validation of `unknown` External Data

**Decision**: All incoming wire payloads are typed as `unknown` and passed through pure type guard functions (`isMarketTicker`, `isTradeTick`, `isOrderBookSnapshot`, `isWsServerMessage`) or the `validateExternal<T>()` / `parseWsServerMessage()` safe wrappers before reaching state stores or UI components.

**Rationale**:
- External data (WebSocket feeds, REST APIs, WebWorker messages) cannot be trusted at compile time.
- Runtime guards check strict object structures, non-empty strings, and finite numeric values (`Number.isFinite`), preventing `NaN` / `Infinity` corruption from reaching the UI or math engines.
- Lightweight pure functions introduce zero external dependency overhead compared to heavy runtime schema libraries while offering fast JIT evaluation at 60Hz feed rates.

---

## TD-011 — Order Book Incremental Delta Representation

**Decision**: Order book updates support both full L2 `OrderBookSnapshot` and incremental `OrderBookDelta` with tuple entries `[price, size]`, sequence numbers (`sequence`, `prevSequence`), and deletion semantics (size = 0 represents level removal).

**Rationale**:
- Transferring full depth snapshots at 60Hz wastes bandwidth and CPU deserialization time.
- Compact `[price, size]` tuples minimize JSON payload size.
- `prevSequence` tracking enables gap detection and automatic snapshot resynchronization if a delta packet is dropped.

---

## TD-012 — Modular Domain Types with Master Barrel Export

**Decision**: Domain types are organized into modular single-responsibility files (`market.ts`, `symbol.ts`, `chart.ts`, `order.ts`, `position.ts`, `orderbook.ts`, `account.ts`, `connection.ts`, `websocket.ts`, `guards.ts`, `validation.ts`) and re-exported via `src/types/index.ts`.

**Rationale**:
- Preserves backward compatibility with existing Phase 1 component imports while creating a clean, scalable domain architecture.
- Prevents circular dependency cycles between order, position, and market models.
- Allows fine-grained imports for bundle tree-shaking as well as convenient barrel imports.

---

# Phase 3 — Technical Decisions

## TD-013 — Normalized Market State in Zustand

**Decision**: Store all market tickers in a normalized dictionary (`entities: Record<string, MarketTicker>`) with a separate ordered symbol key array (`symbols: string[]`).

**Rationale**:
- Enables `O(1)` ticker lookup and pinpoint in-place updates when high-frequency WebSocket ticks arrive.
- Prevents full array rebuilds and full list re-renders on every individual price tick.
- Symbol ordering is preserved in `symbols` for deterministic list rendering, independent of hash map key iteration order.

---

## TD-014 — Render-Aware Fine-Grained Subscriptions & React 19 Snapshot Safety

**Decision**: UI components access Zustand state through discrete primitive selectors (`useSelectedSymbol()`, `useTicker(symbol)`) or compute derived arrays using `useMemo` over stable state slices, rather than creating inline object/array selectors inside `useMarketStore(state => [...])`. Individual watchlist items are wrapped in `React.memo` (`WatchlistItem`).

**Rationale**:
- React 19's `useSyncExternalStore` strictly checks snapshot referential equality and flags infinite re-render loops if a selector returns new object/array references on each call.
- Fine-grained per-symbol subscriptions ensure that ticking a single instrument (e.g. BTC/USDT) only re-renders the BTC row and the active header ticker, while the other 5+ watchlist rows remain untouched by React's reconciliation engine.

---

## TD-015 — Synchronized Terminal State via Selected Symbol Store

**Decision**: Centralize `selectedSymbol` inside `useMarketStore` so that user interactions in the Watchlist automatically synchronize the Terminal Header, Order Entry, Order Book, Chart, and Portfolio panels.

**Rationale**:
- Eliminates prop drilling through `App.tsx` and complex event bus coordination.
- Allows any component in the application to read the active instrument or change it seamlessly.

---

## TD-016 — Centralized Financial Formatting Utilities

**Decision**: Move all price, volume, percentage, quantity, and timestamp formatting into `@/utils/formatters.ts` with explicit boundary handling for micro-prices (`< 1`), finite number checking (`Number.isFinite`), and locale formatting.

**Rationale**:
- Avoids duplicated `toFixed()` / `toLocaleString()` logic across individual feature panels.
- Protects against `NaN`, `null`, or `undefined` runtime formatting crashes when malformed data is encountered.

---

# Phase 4 — Technical Decisions

## TD-017 — Mock HTTP Client with Configurable Latency Jitter & Failure Injection

**Decision**: Implemented `MockHttpClient` in `src/core/api/client.ts` with configurable latency ranges (`minLatencyMs` to `maxLatencyMs`), failure rates (`failureRate`), and error type injection (`network`, `rateLimit`, `validation`, `server`).

**Rationale**:
- Enables realistic testing of async UI states (spinners, skeletons, toast notifications) during development.
- Validates that UI gracefully surfaces 429 rate limits, 500 internal errors, and network disconnects with retry capabilities.
- Zero-latency configuration (`minLatencyMs: 0, maxLatencyMs: 0`) provides instant deterministic execution in Vitest test runs.

---

## TD-018 — Native Request Cancellation via `AbortSignal` & Stale-Response Race Condition Protection

**Decision**: All API methods accept an optional `AbortSignal` and track request sequences (`latestRequestSequences: Map<string, number>`). If an aborted signal is detected or a newer request for the same resource completes earlier, earlier in-flight responses are immediately cancelled with `RequestAbortedError`.

**Rationale**:
- When rapidly switching between symbols (e.g. BTC -> ETH -> SOL), stale responses from earlier slow requests could otherwise overwrite newer active symbol state.
- TanStack Query automatically supplies the query's `signal` to `queryFn`, seamlessly aborting abandoned network requests on unmount or key change.

---

## TD-019 — Error Classification & Retry Policy Strategy

**Decision**: Custom error hierarchy (`ApiError`, `NetworkError`, `RateLimitError`, `ValidationError`, `RequestAbortedError`) combined with an error-aware retry predicate in `QueryClient`.

**Rationale**:
- 4xx client errors (e.g., `ValidationError`) and user-aborted requests (`RequestAbortedError`) must NEVER be retried automatically, preventing spam loops and stale state mutations.
- 5xx server errors and transient network drops retry up to 3 times using exponential backoff (`500ms * 2^attempt`).
- Mutations (like placing orders) are configured with `retry: false` to protect against duplicate order submissions.

---

## TD-020 — Optimistic Mutations and Selective Cache Invalidation

**Decision**: Order creation and position closure mutations immediately update the cache (`queryClient.setQueriesData`) and invalidate relevant query families (`orders.all`, `positions.all`, `account.all`).

**Rationale**:
- Provides instant UI responsiveness when placing orders or clicking Market Close.
- Invalidating parent query keys ensures subsequent background reconciliation guarantees eventual consistency with backend state.

---

# Phase 5 — Technical Decisions

## TD-021 — WebSocket Connection State Machine & Auto-Resubscription

**Decision**: The `WebSocketService` in `src/core/websocket/wsService.ts` maintains connection states (`DISCONNECTED`, `CONNECTING`, `CONNECTED`, `RECONNECTING`, `DEGRADED`, `ERROR`) and an `activeSubscriptions` set. On reconnection, it automatically aggregates all active channel:symbol pairs and resubscribes with the server.

**Rationale**:
- Transparent connection recovery ensures UI widgets (order book, trades, charts) automatically regain live feeds without requiring manual component unmount/remount cycles.
- Centralizing subscription state inside the service decouples transport reconnection from UI component render trees.

---

## TD-022 — Safe Validation & Fault-Tolerant Unknown Wire Ingestion

**Decision**: All incoming WebSocket payloads are treated as `unknown` and parsed through `parseWsServerMessage()`. Corrupted JSON or unexpected payloads notify error listeners and update telemetry without throwing unhandled exceptions or disconnecting the client.

**Rationale**:
- Exchange WebSocket feeds frequently inject undocumented fields or occasional corrupted byte fragments.
- Isolating parsing errors preserves continuous uptime and prevents terminal crashes under hostile network conditions.

---

## TD-023 — Bi-directional Heartbeat Liveness & Round-Trip Latency Tracking

**Decision**: `WebSocketService` initiates periodic ping actions and calculates round-trip time (RTT) upon pong arrival, updating the global `useConnectionStore` and resetting a dead-connection watchdog timer.

**Rationale**:
- TCP half-open connections (silent socket deadlocks) are detected within `heartbeatTimeoutMs`, immediately triggering `DEGRADED` status and auto-reconnection.
- Real-time latency (ms) is broadcast directly to the Header status indicators for user visibility.

---

## TD-024 — Typed Multi-Channel Event Dispatcher

**Decision**: Support both catch-all `onMessage(handler)` and type-narrowed `on<T>('ticker' | 'trade' | 'book_snapshot', handler)` event listeners returning idempotent unsubscribe callbacks.

**Rationale**:
- Eliminates repeated manual discriminated union type checking in downstream subscriber components.
- Cleanup callbacks prevent listener memory leaks when React components mount and unmount.




