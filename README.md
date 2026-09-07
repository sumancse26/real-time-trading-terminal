# Trading Terminal

Trading Terminal is a browser-based cryptocurrency derivatives trading workspace built with React, TypeScript, Vite, Zustand, and TanStack Query. It presents a realistic exchange-terminal workflow using an in-memory HTTP API, a simulated WebSocket server, and a high-frequency market-feed simulator.

This document describes the business logic implemented in the project. It is an implementation reference, not only a setup guide.

## Product purpose

The terminal provides one workspace for:

- monitoring a multi-symbol watchlist;
- viewing live trades and a level-2 order book;
- prefilling orders from market depth;
- placing simulated limit, market, and stop-limit orders;
- reviewing positions, open orders, order history, and a generated 100,000-order archive;
- calculating live position risk and portfolio analytics;
- observing connection, rendering, batching, and throughput telemetry.

Default symbols are `BTC/USDT`, `ETH/USDT`, `SOL/USDT`, `BNB/USDT`, `ARB/USDT`, and `DOGE/USDT`. The selected symbol is `BTC/USDT` at startup.

## Scope and business assumptions

This is a self-contained trading-terminal simulation. There is no real exchange connection, authentication system, database, wallet, settlement engine, or persistent backend. Refreshing the page resets the in-memory API state.

The mock exchange exercises UI and domain workflows but does not implement a complete matching engine. Creating an order returns a `NEW` order; the feed does not automatically fill it. Position changes therefore occur through mock position endpoints and pure calculation utilities rather than a complete order-to-execution settlement pipeline.

The order ticket uses cross-margin language, while shared position formulas use an isolated-style liquidation approximation. These are demo conventions, not a complete production margin model.

## Workspace and user workflow

The application is composed as follows:

1. `TerminalHeader` displays identity, connection state, and shortcut access.
2. `TelemetryBar` displays FPS, throughput, WebSocket latency, queue lag, render commits, batching, and simulation rate.
3. `WatchlistPanel` selects the active symbol and filters/sorts markets.
4. `TradingChartPlaceholder` represents the chart area and chart-data workflow.
5. `TradesStreamView` displays the most recent 25 streamed trades.
6. `OrderBookView` displays aggregated asks/bids, spread, and mid-price.
7. `OrderEntryForm` validates and submits an order.
8. `PositionsView` switches between positions, orders, history, archive, and risk analytics.
9. Widget error boundaries isolate failures; the outer boundary protects the complete application.

On mount, `AppContent` starts the feed simulator at 20 ticks/second. On unmount it stops it.

## Domain model

### Market data

`MarketTicker` contains symbol identity, last price, 24-hour absolute and percentage changes, high/low, volume, and turnover. A `TradeTick` contains id, symbol, price, size, side, and timestamp. An order-book snapshot contains sequence, timestamp, bid levels, ask levels, absolute spread, and percentage spread.

Each `PriceLevel` contains price, size, cumulative total, normalized percentage depth, and optional order count.

### Orders

Domain order types are `LIMIT`, `MARKET`, `STOP_LIMIT`, `STOP_MARKET`, and `TRAILING_STOP`; the visible ticket exposes the first three. Time-in-force values are `GTC`, `IOC`, `FOK`, and `POST_ONLY), with `GTC` as the mock default.

Statuses include `PENDING` (optimistic client state), `NEW`, `PARTIALLY_FILLED`, `FILLED`, `CANCELLED`, `REJECTED`, and `EXPIRED`.

### Positions and account

A position is `LONG` or `SHORT) and stores size, entry/average price, mark price, market value, unrealized/realized PnL, leverage, margin, liquidation price, and update time.

The account summary stores equity, available margin, initial/maintenance margin, unrealized PnL, margin ratio, balances, and trading/withdrawal permissions. The seeded account is a margin account with both permissions enabled.

## Market-data logic

### Initial state and watchlist

Zustand initializes six ticker entities and a symbol array. Favorites initially contain BTC/USDT and ETH/USDT. The store is normalized as `entities[symbol]`, allowing individual rows to subscribe to one ticker.

The watchlist supports:

- search by symbol or base asset;
- `ALL`, `FAVORITES`, and `PERP` controls (the current implementation applies favorites filtering; all mock pairs are perpetual-style);
- sorting by symbol, last price, 24-hour percentage change, or volume;
- sort cycling: descending, ascending, then cleared;
- favorite toggling;
- active-symbol selection.

Selecting a symbol synchronizes the order ticket price and the labels used by the book and trade stream.

### Feed simulation

`TradingFeedSimulator` keeps one price per configured symbol. Each tick:

1. chooses the primary symbol or rotates round-robin through all symbols when multi-symbol mode is enabled;
2. applies a small random proportional price move;
3. creates a random-size buy/sell trade;
4. emits a primary-symbol order-book snapshot;
5. emits a ticker update;
6. records message arrival for telemetry.

The default 20-rate mode runs one tick every 50 ms. Higher presets use one tick every 10 ms (100), five ticks every 10 ms (500), or ten ticks every 10 ms (1,000). Order-book level objects are pooled during generation and copied into snapshots.

Ticker state updates use a 0.001% relative price deadband. If price movement is below that threshold and percentage change and volume are unchanged, the store skips the state transition to avoid no-op renders.

### Trade stream and batching

Trades use a fixed-capacity ring buffer (default 25). Once full, the oldest trade is removed. The UI displays newest first.

`RafBatchDispatcher` groups updates until the next animation frame, with a timer fallback. Trades retain all items in a batch; order-book and ticker hooks keep only the newest item because those streams represent current state. Adaptive batching may wait two frames under heavy load.

### Order book

Levels are aggregated into price buckets:

```
bids: floor(price / precision) * precision
asks: ceil(price / precision) * precision
```

Bucket sizes and order counts are summed, asks are sorted ascending, bids descending, and cumulative totals/percentage depth are recalculated. The UI offers precision 0.1, 0.5, 1.0, 5.0, or 10.0 and displays 5, 10, 15, or 20 levels.

```
spread = max(0, bestAsk - bestBid)
spreadPercentage = spread / bestAsk * 100
midPrice = (bestAsk + bestBid) / 2
```

Missing or non-positive prices produce zero spread and mid-price. Clicking a book row sends its price and size through the market store. The ticket consumes the timestamped prefill, switches to LIMIT, and fills price and quantity.

## Order-entry rules

The ticket starts at LIMIT, BUY, the selected ticker price, quantity 0.25, and leverage 20x. The UI leverage slider permits 1x–100x. Market orders use live price for estimation and disable manual price input.

### Financial estimates

```
orderValue = effectivePrice * quantity
feeRate = 0.0004 for MARKET, otherwise 0.0002
estimatedFee = orderValue * feeRate
initialMargin = orderValue / leverage
totalOutlay = initialMargin + estimatedFee
```

With maintenance-margin rate 0.5%:

```
long liquidation  = max(0, price * (1 - 1/leverage + 0.005))
short liquidation =       price * (1 + 1/leverage - 0.005)
```

Available margin comes from the account query, with a 23,091.05 fallback while loading.

### Validation

Submission requires a positive price for non-market orders, positive finite quantity, notional of at least $5.00, and total outlay no greater than available margin. The button is disabled while invalid or pending. Errors are shown inline and order failures are written to the error log with inputs attached.

Quick-fill buttons use:

```
maxAffordableNotional = availableMargin * leverage * percentage
quantity = maxAffordableNotional / effectivePrice
```

The buttons use 25%, 50%, 75%, and 100%.

### Submission lifecycle

`useCreateOrderMutation`:

1. cancels in-flight order queries;
2. snapshots all-symbol and symbol-specific open orders;
3. inserts a temporary PENDING order;
4. calls the API;
5. replaces the temporary order with the confirmed order;
6. restores snapshots on failure;
7. invalidates order and account queries in all cases.

The mock API rejects missing core fields, non-positive quantity, and missing/non-positive LIMIT price. It rejects duplicate submissions within 500 ms using client order id or a signature of symbol, side, type, price, and quantity.

## Orders, positions, and portfolio

Individual cancellation optimistically removes an order from open-order caches. The mock API moves it to history as CANCELLED. Cancel-all supports one symbol or every symbol. Failed mutations restore their snapshots.

Seeded mock state contains two open BTC orders, three historical orders, and:

- BTC/USDT long: size 0.75, entry 63,820, mark 64,250, leverage 20x;
- ETH/USDT short: size 8.5, entry 3,490, mark 3,445, leverage 10x.

Portfolio tabs are Positions, Open Orders, History, 100K Archive, and Risk. Closing a position removes it from the mock store. Leverage adjustment accepts 1x–125x at the API boundary and recalculates margin and liquidation price.

### Position formulas

For size S, entry E, mark M, leverage L, and maintenance rate r=0.005:

```
marketValue = S * M
margin = (S * E) / L

LONG  unrealizedPnl = (M - E) * S
SHORT unrealizedPnl = (E - M) * S

ROE = unrealizedPnl / margin * 100

LONG  liquidation = max(0, E * (1 - 1/L + r))
SHORT liquidation =       E * (1 + 1/L - r)
```

Inputs are sanitized to finite non-negative values, leverage is clamped to at least 1x, and monetary values are rounded to two decimals.

Mark-price updates preserve entry and size while recalculating market value, unrealized PnL, ROE, margin, liquidation price, and timestamp. Only affected symbols are replaced, preserving unaffected row references.

### Fill-to-position transitions

`recalculatePositionOnFill` handles:

1. no existing position: open in fill direction;
2. same direction: increase size using weighted-average entry;
3. opposite direction with fill size no greater than existing: reduce/close and realize PnL;
4. larger opposite fill: realize old-position PnL and open the excess quantity in the new direction.

```
closing LONG  = (fillPrice - entryPrice) * closedSize
closing SHORT = (entryPrice - fillPrice) * closedSize
```

Full close returns `updatedPosition: null` and realized PnL separately.

## 100,000-order archive

`generate100kOrders(100000)` uses a seeded Mulberry32 generator with seed 42 and caches the 100,000-item result. Orders span the six symbols, random sides/types/statuses, prices near base prices, quantities, fills, GTC time-in-force, and timestamps within 30 days.

The archive supports debounced search, symbol/side/status filters, sortable columns, jump actions, and virtualized rows. Filtering/sorting may inspect the full dataset, but only visible rows are mounted in the DOM.

## Risk and execution analytics

The Risk tab automatically analyzes current positions plus 100,000 generated orders using 10,000 simulation paths. It can rerun in a typed Web Worker or benchmark worker execution against synchronous main-thread execution.

### Order analytics

The engine calculates total orders and notional, buy/sell counts and volume, status counts, fill rate, per-symbol VWAP, synthetic slippage p50/p95/p99, Sharpe, Sortino, and estimated maximum drawdown.

Fill rate is filled or partially-filled order count divided by all orders. Filled quantity is preferred for filled/partial notional; otherwise requested quantity is used. Synthetic slippage is:

```
slippageBps = (sin(index * 0.05) + 1.2) * 4.5
```

Only every tenth value is retained for percentile calculations.

### Monte Carlo VaR

Portfolio value is the sum of position market values. With no positions, a $100,000 baseline is used. The default model uses roughly 3.5% daily volatility, 8% annual drift, and a geometric-Brownian-style return:

```
dt = horizonDays / 365
return = drift - 0.5 * volatility^2 * dt
       + volatility * sqrt(dt) * normalRandom()
```

For confidence c, returns are sorted and the lower-tail index is `floor((1-c) * pathCount)`:

```
VaR amount = max(0, -tailReturn * portfolioValue)
VaR percent = max(0, -tailReturn * 100)
CVaR = average loss through the VaR index
```

The result includes 95% and 99% VaR, expected shortfall, a 30-bucket -15% to +15% distribution, VWAP, and calculation duration. The worker reports progress for order analysis and simulation phases and returns typed success/error messages.

## API and query behavior

The API is split into market, order, position, and account modules. The mock client simulates 40–120 ms latency, abort signals, request sequencing, configurable failure rates, and network/rate-limit/server/validation/timeout/order-rejection errors.

TanStack Query uses domain-specific keys. Queries default to 10 seconds stale time, five minutes garbage collection, no focus refetch, and up to five retries with exponential delays of 1, 2, 4, 8, and 16 seconds. Rate limits and transient/server errors retry; validation, abort, order rejection, and other client errors do not. Mutations never retry automatically.

## WebSocket and connection behavior

`WebSocketService` wraps the mock server and validates every incoming payload before dispatch. Supported messages include ticker, trade, book snapshot/delta, kline, execution report, order update, position update, account update, subscription acknowledgements, pong, and error.

Invalid JSON or invalid structures increment malformed-message telemetry, create a warning log entry, and notify error listeners without crashing the app.

Connection states are DISCONNECTED, CONNECTING, CONNECTED, RECONNECTING, DEGRADED, and ERROR. A ping is sent every 10 seconds; a missing pong after 5 seconds marks the connection degraded. Reconnect uses 1/2/4/8/16-second backoff and stops after five attempts. Active subscriptions are retained and restored after reconnect. Browser online/offline events update state and can trigger immediate reconnect.

The connection store tracks status, latency, attempts, countdown, sent/received messages, bytes, heartbeat, subscriptions, and latest error. The error log retains the newest 100 entries and unread count.

## Performance and accessibility rules

High-frequency rendering is controlled with RAF batching, adaptive batching, ring buffers, coalescing latest-state updates, pooled order-book objects, ticker deadbands, memoized rows, and order virtualization.

`PerformanceTracker` reports FPS, dropped frames, throughput, latency, event-queue lag, render commits, batch compression, render time, batch latency, memory estimate, batching state, and simulation rate. These are diagnostics and do not affect trading decisions.

The UI includes a skip link, semantic table/tab/radio roles, labels, keyboard-focusable order-book rows, live status/error messages, and a keyboard-shortcuts modal. The ticket supports buy, sell, limit, market, submit, escape/blur, and watchlist-search shortcuts.

## Source map

- `src/core/api/`: mock exchange operations and errors;
- `src/core/query/`: cache keys, queries, mutations, retry policy;
- `src/core/store/`: market, connection, and error state;
- `src/core/stream/`: feed, buffers, and batching;
- `src/core/websocket/`: validation, heartbeat, and reconnect;
- `src/core/analytics/` and `src/workers/`: risk calculations;
- `src/utils/positionCalculations.ts`: PnL, margin, liquidation, fill transitions;
- `src/utils/orderbook.ts`: aggregation, depth, and spread;
- `src/utils/orderGenerator.ts`: deterministic archive;
- `src/features/`: user-facing widgets.

## Development

```bash
npm install
npm run dev
```

```bash
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
```

Tests cover store behavior, validation/type guards, formatting, order book, order entry, optimistic orders, positions/PnL, WebSocket resilience, batching, virtualization, accessibility, and worker analytics.

## Production gaps

Before connecting a real exchange, replace the mock boundaries with authenticated APIs, durable persistence, exchange precision/filter enforcement, a real matching and execution lifecycle, fill/fee reconciliation, balance reservation, cross/isolated margin accounting, liquidation/risk limits, clock synchronization, idempotency keys, audit logging, authorization, coordinated rate limits, real chart rendering, and server-authoritative WebSocket recovery.
