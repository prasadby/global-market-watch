# Security Review & Threat Model

## Scope

Market Watch is a local-first personal market-monitoring application. It has no authentication, no database, no brokerage connectivity, and no server-side portfolio storage.

The primary security boundary is the public Next.js API layer between the browser and the upstream market-data provider.

## Controls implemented

### Input validation

- Symbols are restricted to a bounded ticker grammar before reaching `yahoo-finance2`.
- Option expiration parameters are validated as bounded epoch timestamps.
- Search input is length-limited.
- API batch sizes are bounded.
- Imported local JSON is treated as untrusted input and validated before state mutation.

### Abuse resistance

- API routes have fixed-window process-local rate limits.
- Provider caches are bounded TTL/LRU-style caches rather than unbounded Maps.
- Quote, history requests have explicit maximum result/input sizes.

These are best-effort controls because the application intentionally has no shared state. For a high-traffic deployment, move rate limiting and caching to the CDN/edge or a shared service.

### Response hardening

The application disables the Next.js powered-by header and adds:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`
- `Cross-Origin-Opener-Policy`
- `Cross-Origin-Resource-Policy`

A strict CSP should be introduced before treating the application as an enterprise production application. The current UI uses third-party favicon requests and Next.js development/runtime behavior that should be accounted for when adopting a nonce/hash-based CSP.

### Error handling

Provider/library exceptions are logged server-side with limited diagnostic fields. Provider stack traces and raw exception messages are not returned to the browser.

### Browser storage

`localStorage` is intentionally used because the product is local-first. It is **not a secure secret store**. Users must not put passwords, API keys, brokerage credentials, or other secrets into the application's stored data.

## Threat model

| Threat | Mitigation | Residual risk |
|---|---|---|
| Malformed symbol reaching provider | Server-side validation | Provider-specific semantics remain outside our control |
| Provider amplification / refresh abuse | Rate limiting + bounded cache | Limits are per process, not globally shared |
| Memory exhaustion from cache keys | Bounded caches + pruning | Multiple serverless instances can each allocate cache memory |
| Malicious backup JSON | Size and schema validation | Users should only import trusted backups |
| UI XSS | React escaping; no raw HTML rendering | Third-party browser extensions remain outside application control |
| Clickjacking | `X-Frame-Options: DENY` | None for modern browsers where header is honored |
| Referrer leakage | Strict referrer policy | Browser/platform behavior varies |
| Sensitive financial data exposure | No server-side portfolio storage | Browser localStorage is readable by scripts/extensions on the same origin |
| Upstream provider outage | Graceful 502/empty-chart handling | Market data can still be stale/unavailable |

## Enterprise hardening still required for a regulated/public deployment

If the application evolves beyond personal use, add:

1. Authentication and authorization.
2. A licensed market-data provider with contractual SLA/redistribution rights.
3. Centralized rate limiting and caching.
4. CSP with nonces/hashes and a documented third-party asset allowlist.
5. Dependency pinning and automated vulnerability scanning.
6. SAST/DAST, dependency review and secret scanning in CI.
7. Structured audit logging with privacy controls.
8. Automated tests for API validation and alert calculations.
9. Monitoring/alerting for provider errors, latency and quota consumption.
10. A formal privacy policy and data-retention policy before collecting any user account data.

## Security posture

The application is appropriate for **personal use and controlled sharing** after a successful production build and dependency audit. It is not independently certified against OWASP ASVS or any corporate SDLC control framework. Enterprise deployment additionally requires the controls listed above and a committed dependency lockfile. It should not be represented as an enterprise financial-trading platform or as a secure brokerage system without implementing the controls above.
