# Market Watch Architecture

## Purpose

Market Watch is a local-first market monitoring application for US and Indian equities.

The application is intentionally designed without a portfolio database or authentication system. User-specific state remains in the browser.

## Layering

```text
app/page.js
    |
    +-- hooks/
    |     +-- usePersistentSettings.js
    |     +-- useMarketData.js
    |     +-- useStockSearch.js
    |     +-- usePortfolioAnalytics.js
    |
    +-- components/
    |     +-- dashboard/presentation components
    |     +-- portfolio components
      |     +-- configuration components
    |
    +-- services/
    |     +-- marketService.js
    |
    +-- lib/
          +-- constants.js
          +-- utils.js
```

### Page / orchestration

`app/page.js` owns:
- application composition
- transient UI state
- watchlist mutation commands
- alert creation/removal
- drag/drop ordering
- wiring between hooks and components

It should not contain:
- provider-specific HTTP calls
- localStorage serialization
- portfolio calculations
- reusable presentation markup

### Hooks

Hooks own stateful behavior.

- `usePersistentSettings`: loads and persists local browser state.
- `useMarketData`: polling, quote/history retrieval and alert evaluation.
- `useStockSearch`: debounced symbol search.
- `usePortfolioAnalytics`: derives portfolio valuation grouped by stock exchange.

### Services

`services/marketService.js` is the browser-facing market-data abstraction. UI code calls service functions rather than constructing API URLs.

This gives the project a provider boundary: a future licensed market-data provider can replace the API implementation without rewriting components.

### Components

Components are presentation-oriented and receive data/callbacks through props. They should avoid owning application-wide state.

## Data flow

```text
Yahoo Finance / provider
          |
       Next API
          |
  validation + rate limit
          |
  normalized response
          |
 marketService.js
          |
 useMarketData
          |
 React state
          |
 presentation components
```

## Persistence

The browser stores:
- watchlists
- stock ordering
- alerts
- portfolio holdings
- workspace configuration

No server-side portfolio state exists.

## Security boundaries

The browser is untrusted. Server routes validate and constrain provider inputs.

Imported backup files are also untrusted input and are size/shape constrained before state mutation.

Do not add secrets, API keys or broker credentials to localStorage.

## Future scale path

If this becomes a multi-user or enterprise product:

1. Put WAF/rate limiting at the edge.
2. Add authentication and authorization.
3. Move user preferences to a server-side store.
4. Introduce a licensed market-data provider.
5. Add centralized observability and audit logging.
6. Separate market-data ingestion from web request handling.
