# Dependency Security — v1.10.9

## Remediation

The audit reported high-severity vulnerabilities in transitive `postcss` and
`sharp` dependencies resolved through Next.js.

This release keeps the verified Next.js 16.2.12 release line and pins patched
transitive versions through npm `overrides`:

- `postcss` 8.5.25
- `sharp` 0.35.3

This avoids `npm audit fix --force` and avoids an unverified major/framework
upgrade.

## Required local verification

The repository intentionally does not ship a generated `package-lock.json`
from an environment without registry access. On the developer machine run:

```powershell
npm install
npm audit --audit-level=high
npm run security:smoke
npm run build
```

Commit the generated `package-lock.json` after the audit is clean.

For CI, use `npm ci` once the lockfile is committed.

## Why the versions are pinned

PostCSS 8.5.25 is newer than the vulnerable <=8.5.22 range reported by npm
audit. Sharp 0.35.3 is newer than the vulnerable <0.35.0 range reported by npm
audit.

Do not use `npm audit fix --force` for this repository without reviewing the
resulting framework/dependency changes.
