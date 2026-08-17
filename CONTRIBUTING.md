# Contributing

1. Keep provider/network calls behind `services/` and `app/api/`.
2. Validate untrusted data at every server boundary.
3. Treat localStorage and imported JSON as attacker-controlled input.
4. Do not store credentials, secrets, API keys or broker tokens in browser storage.
5. Do not introduce `dangerouslySetInnerHTML`, `eval`, `new Function`, dynamic script loading, or arbitrary URL proxying without a security review.
6. Keep direct dependency versions exact and commit `package-lock.json`.
7. Run the following before opening a pull request:

```bash
npm ci
npm audit --audit-level=high
npm run security:smoke
npm run build
```

8. Update security/architecture documentation when changing trust boundaries, persistence, authentication, provider integrations or deployment behavior.
