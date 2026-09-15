# Validation scripts

Run the baseline integrity check with:

```bash
npm run validate
```

The validator checks that the production game file remains substantial and contains the core gameplay systems, then compiles each inline JavaScript block with Node's VM parser to catch syntax errors before deployment.

This is intentionally a structural safety gate. Browser interaction tests will be added next for start, pause, restart, settings, missions, upgrades, persistence, and offline fallback behavior.
