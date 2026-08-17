# Global Market Watch — NASDAQ, NYSE, NSE, BSE & more

A lightweight, shareable stock-monitoring dashboard built with Next.js. It requires **no database, no login and no user account**.

## Features

- Automatic quote refresh every 15 seconds to 5 minutes.
- NASDAQ / NYSE / NSE / BSE symbols. etc.
- Current price and absolute/percentage change from previous close.
- US pre-market, regular-market and after-hours prices when supplied by the provider.
- Market-session badge.
- Intraday mini-sparklines.
- Click a stock for a larger chart with **1D / 5D / 1M / 6M / 1Y** ranges.
- Symbol/company-name search with autocomplete.
- Watchlist organization and grouping at stock-exchange level.
- Sorting by custom order, symbol, change % or price.
- Drag-and-drop watchlist ordering.
- Multiple price-crossing alerts.
- Alert banners when a threshold is crossed.
- LocalStorage persistence for each user's watchlist and alerts.
- Server-side API routes; the browser does not call Yahoo Finance directly.
- Short in-memory server cache.
- Responsive desktop/mobile layout.

## Architecture

```text
Browser
   |
   +--> /api/quotes   --> yahoo-finance2 --> Yahoo Finance
   |
   +--> /api/history  --> yahoo-finance2 --> Yahoo Finance
   |
   +--> /api/search   --> yahoo-finance2 --> Yahoo Finance
```

There is intentionally **no database**. Each visitor stores their own watchlist and alerts in their browser, so different friends can use the same deployed URL independently.

### Alert limitation

Alerts are evaluated by the open browser every 30 seconds. They are not server-side notifications. Closing the page stops alert evaluation.

## Data provider

The application uses `yahoo-finance2` on the server. It is an unofficial Yahoo Finance interface; Yahoo does not provide an official developer API for this use case. Treat this application as a personal market monitor, not a trading system.

The provider is isolated behind API routes so it can later be replaced with a licensed market-data provider without redesigning the frontend.

## Local development

Requirements:

- Node.js 22+
- npm

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Production test:

```bash
npm run build
npm start
```

## GitHub

```bash
git init
git add .
git commit -m "Initial market watch dashboard"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/market-watch.git
git push -u origin main
```

## Vercel

1. Push the project to GitHub.
2. Import the repository into Vercel.
3. Vercel detects Next.js automatically.
4. Deploy.

No database or environment variables are required by the default project.

## Symbols

Examples:

```text
NVDA
AAPL
MSFT
M&M
M&M.NS
RELIANCE.NS
TCS.NS
INFY.NS
RELIANCE.BO
```

For NSE symbols containing punctuation, the app accepts the familiar exchange symbol directly. For example, entering `M&M` is automatically resolved to Yahoo Finance's `M&M.NS` ticker. Yahoo Finance sources also identify Mahindra & Mahindra's NSE ticker as `M&M.NS`.

The search box can also find symbols by company name.

## Scaling considerations

This project is designed for personal sharing rather than high-volume public traffic.

The server uses an in-memory cache, so each serverless instance can have its own cache. If usage grows, the next upgrade should be a licensed market-data provider plus centralized caching.

## License

For personal use. Add a license before redistributing.

### Company logos

Stock cards display the company's logo when the quote provider exposes a website domain. If a logo cannot be loaded, the UI automatically falls back to a two-letter company/symbol monogram, so a broken logo never leaves an empty image.

### Local persistence

The watchlist, custom order and alerts are stored in the browser using localStorage. A startup hydration guard prevents the initial defaults from overwriting saved settings. The Configure panel also provides JSON Export/Import so a user can back up or move their settings to another browser/device.

### Auto refresh

Users can choose 15s, 30s, 45s, 60s, 90s or 120s refresh intervals. The selected interval is persisted locally per browser. Price alerts are evaluated on each refresh.

### Card-level alerts

Each stock card now has a quick alert control, allowing an above/below price threshold to be created without opening Configure.

### Extended-hours display

Pre-market and after-hours panels are rendered only when the provider returns a valid price for that session. They are omitted entirely when unavailable.

### Portfolio, workspace and trailing alerts

- Local workspace name, e.g. "Prasad's Portfolio".
- Optional portfolio panel with US and India holdings separated and valued in USD/INR.
- Shares and buy price are stored locally; live market value and unrealized P/L are calculated from quotes.
- Trailing percentage alerts track the highest/lowest observed price after the alert is armed.
- Portfolio and workspace settings are included in JSON backup/export.

## Engineering & security posture (v1.10.6)

The application has been hardened for controlled public sharing while preserving its no-database/local-first design.

### API hardening

- Server-side symbol validation before upstream calls.
- Bounded input sizes and market-data input validation.
- Fixed-window request limiting per process for quotes, charts, search.
- Bounded TTL/LRU-style provider caches to prevent unbounded key growth.
- Normalized API response contracts so upstream provider fields are not passed through wholesale.
- Provider exceptions are logged server-side without exposing raw library/provider messages to clients.
- `Cache-Control: no-store` is used for browser API responses.

### Browser/data hardening

- Imported JSON backups are treated as untrusted input and validated/size-limited before state mutation.
- No `dangerouslySetInnerHTML`, `eval`, dynamic code execution or cookie-based portfolio storage.
- React's normal escaping is used for user-controlled workspace/watchlist labels.
- Portfolio data remains local to the browser; do not store credentials or API keys in it.

### HTTP security headers

The Next.js configuration adds clickjacking, MIME-sniffing, referrer, permissions and cross-origin isolation headers. See `SECURITY.md` for the threat model and the remaining hardening required before a regulated/enterprise deployment.

### Developer verification

Run:

```bash
npm run security:smoke
npm run build
```

`security:smoke` validates symbol input handling and bounded-cache behavior without requiring external services.

Commit `package-lock.json` after running `npm install` locally. CI/production should use `npm ci` so dependency resolution is deterministic.

### Important security boundary

This project is **not** a brokerage, trading execution or custody system. It does not authenticate users, execute trades, store server-side portfolios or protect secrets. It is intended for personal monitoring and controlled sharing.

## v1.9 architecture

The application was refactored from a monolithic `app/page.js` into:

- `app/components/` — reusable UI components
- `hooks/` — stateful React behavior
- `services/` — market-data transport abstraction
- `lib/` — shared constants, formatting and validation
- `docs/` — architecture and development guidance

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md), and [`docs/REFACTORING.md`](docs/REFACTORING.md).

### Engineering verification

```bash
npm run security:smoke
npm run build
```

The security smoke test validates the server-side symbol normalization and bounded cache behavior. Run the production build locally before deployment because the build requires the project's npm dependencies.


## Automated build quality gate

The production build intentionally runs the Playwright end-to-end regression suite after `next build`:

```bash
npm run build
```

is equivalent to:

```bash
next build
playwright test
```

The E2E suite protects key production behavior, including a regression guard that fails if the removed
**Market Cockpit / Market Dashboard** UI or configuration is reintroduced.

Run the suite directly with:

```bash
npm run test:e2e
```

Install the Playwright Chromium browser once with:

```bash
npx playwright install chromium
```

Playwright reports and test results are generated locally/CI and are intentionally excluded from Git.
