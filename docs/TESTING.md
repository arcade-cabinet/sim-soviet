---
title: Testing
updated: 2026-04-23
status: current
domain: quality
---

# Testing

This document owns the test matrix and the diagnostic expectations for browser
and E2E verification.

## Core Commands

```bash
pnpm run typecheck
pnpm run lint
pnpm run test:node
pnpm run test:browser
pnpm run build
pnpm run smoke:web
pnpm run test:e2e
```

## Test Lanes

### Typecheck

`pnpm run typecheck`

TypeScript compile validation across the game codebase.

### Lint

`pnpm run lint`

Biome static checks and formatting guardrails.

### Node Simulation Tests

`pnpm run test:node`

Runs the Jest suite in-band for core engine, era progression, save logic, and
other non-browser gameplay logic.

### Vitest Browser Tests

`pnpm run test:browser`

This uses `@vitest/browser-playwright` with:

- `headless: false`
- Playwright provider
- `channel: 'chrome'`
- screenshot output in `e2e/artifacts/vitest-browser/screenshots`
- traces in `e2e/artifacts/vitest-browser/traces`

The browser suite is the canonical way to test interactive web flows in a real
headed local Chrome session.

### Export Smoke

`pnpm run smoke:web`

Builds the web export, serves it, drives a Playwright smoke flow, and writes
artifacts into `e2e/artifacts/app-smoke/`, including:

- menu, intro, and playing screenshots;
- `diagnostics.json`;
- console/page/network failure capture via the smoke assertions.

### Playwright E2E

`pnpm run test:e2e`

Runs Playwright against a headed Chrome session. The config explicitly keeps
`headless: false` and `channel: 'chrome'` because the rendering path should be
validated through the same GPU-backed browser stack used locally.

## Diagnostic Policy

Browser and E2E verification should leave behind evidence, not just pass/fail
booleans.

- Vitest browser failures retain traces.
- Smoke runs emit screenshots and `diagnostics.json`.
- CI uploads browser diagnostics and smoke diagnostics as artifacts.
- When extending long-form campaign tests, prefer explicit state dumps and
  screenshot checkpoints at meaningful milestones such as year rollover, era
  transition, and campaign completion.

## Current Gaps

- The automated path is strongest around historical start and smoke continuation
  and weaker on long-form era-by-era progression.
- Visual baselines are still ad hoc rather than review-locked snapshots.
- Late-era and post-1991 behavior need more deliberate automated coverage.
