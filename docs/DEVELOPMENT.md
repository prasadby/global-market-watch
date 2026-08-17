# Development Guide

## Prerequisites

- Node.js version specified by `package.json`
- npm
- VS Code or another JavaScript IDE

## Local setup

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verification

```powershell
npm run security:smoke
npm run build
```

Run both before pushing changes.

## Coding conventions

- Keep components focused on presentation.
- Put reusable stateful behavior in hooks.
- Put provider/network operations in services.
- Keep provider-specific details out of UI components.
- Validate untrusted data at the server boundary.
- Do not log user portfolio contents.
- Do not add secrets to source code or browser storage.
- Prefer explicit names over clever abstractions.
- Keep comments focused on security, business invariants, or non-obvious behavior.

## Adding a market-data provider

Do not call the provider directly from React components.

Add or modify the server API route, normalize the provider response, and expose the stable contract through `services/marketService.js`.

## Pull request checklist

- [ ] `npm run security:smoke`
- [ ] `npm run build`
- [ ] No secrets committed
- [ ] New external inputs are validated
- [ ] No raw HTML injection
- [ ] Local persistence remains bounded
- [ ] Documentation updated when architecture changes
