# End-to-end regression tests

These Playwright tests are part of the production build contract.

`npm run build` executes:

1. `next build`
2. `playwright test`

The suite protects key production behavior, including the permanent removal of the
legacy Market Cockpit/Dashboard UI and setting, and verifies that the core
Configuration areas remain available.

Run the suite directly with:

```bash
npm run test:e2e
```

Install Chromium once with:

```bash
npx playwright install chromium
```

Generated Playwright reports and test results are intentionally ignored by Git.
