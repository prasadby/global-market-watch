# Security & Enterprise Code Review — v1.10.6

## Review basis

This review uses the OWASP Top 10:2025 and OWASP ASVS 5.0 as the security baseline, plus the current Next.js production/security guidance. It is a source review and static verification, not a penetration test or formal certification.

## Findings addressed

### Critical / High

- **Runtime defect:** `DetailModal` rendered `Logo` without importing it. The missing import is now explicit.
- **Dependency drift:** dependency ranges were changed to exact versions. The current baseline uses Next.js `16.2.12`, React `19.2.8`, React DOM `19.2.8`, and yahoo-finance2 `4.0.0`.
- **Missing lockfile:** the repository still needs a committed `package-lock.json`. CI now fails closed if it is absent and uses `npm ci` when present.
- **Security headers:** production CSP and HSTS were added, alongside the existing clickjacking, MIME, referrer, permissions and cross-origin controls.
- **Untrusted browser state:** localStorage hydration is now size-bounded and schema-sanitized before entering React state.
- **Backup validation:** imported portfolio/alert values are bounded and type-checked.
- **Client mutation validation:** invalid/negative alert prices and malformed holding updates are rejected.

## OWASP mapping

| OWASP 2025 area | Current control | Status |
|---|---|---|
| A01 Broken Access Control | No authenticated user/account boundary exists; public API is intentionally read-only | Acceptable for local-first design; authentication required for multi-user accounts |
| A02 Security Misconfiguration | Security headers, CSP, HSTS, poweredBy disabled | Addressed; verify headers after deployment |
| A03 Software Supply Chain Failures | Exact direct dependency versions + CI `npm audit` + lockfile gate | Lockfile still must be committed |
| A04 Cryptographic Failures | No secrets or credentials are stored server-side; localStorage explicitly treated as non-secret | Appropriate for current scope |
| A05 Injection | React escaping, no raw HTML, bounded API inputs, provider response normalization | Addressed in reviewed paths |
| A06 Insecure Design | Provider calls isolated behind API/service boundary; bounded caches and request limits | Good baseline; edge controls needed at scale |
| A07 Authentication Failures | No authentication implemented by design | Required before multi-user/private data |
| A08 Software/Data Integrity | Exact dependency versions, normalized provider contract, backup schema validation | Lockfile/CI required |
| A09 Logging/Alerting | Provider failures logged without stack traces; local alerts are product alerts, not security telemetry | Central security logging required for enterprise |
| A10 Exceptional Conditions | API errors are normalized; chart failures degrade gracefully; local storage failures fail closed | Addressed in reviewed paths |

## Remaining enterprise gaps

1. Commit `package-lock.json` and enforce `npm ci`.
2. Run `npm audit --audit-level=high` in CI and remediate transitive findings.
3. Run SAST/DAST and dependency scanning in CI.
4. Add authenticated user boundaries before storing any server-side user data.
5. Move rate limiting/caching to a trusted edge/shared service for multi-instance deployment.
6. Use a licensed market-data provider with redistribution rights before commercial/public financial use.
7. Add structured security logging and monitoring for a production service.
8. Consider nonce-based CSP if the application later handles sensitive authenticated data; the current production CSP uses `unsafe-inline` for Next.js runtime compatibility.

## Verification performed

- JavaScript/module syntax checks passed for non-JSX files.
- Local import resolution check passed.
- Security smoke tests passed.
- Extended persistence/input sanitization tests passed.
- No options/derivatives implementation references remain in source or documentation.
- Full `npm run build` and `npm audit` could not be executed in this environment because the npm registry was unreachable; CI is configured to perform both after the lockfile is committed.
