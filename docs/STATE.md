---
title: State
updated: 2026-04-23
status: current
domain: context
---

# SimSoviet 1917 - Current State

This document answers three questions: what ships today, what changed recently,
and what still remains. The remaining-work tracker lives in
[PRODUCTION.md](./PRODUCTION.md).

## Where We Are

- `main` already contains the historical-scope reduction and the follow-up CD
  fix.
- The live static build is [arcade-cabinet.github.io/sim-soviet](https://arcade-cabinet.github.io/sim-soviet/).
- The shipped 1.0 shape is a **1917-1991 historical campaign** with optional
  same-settlement continuation after the dissolution summary.
- The repo now uses the same high-level workflow chain as `mean-streets`:
  `automerge.yml` -> `ci.yml` -> `release.yml` -> `cd.yml`.

## Recent Merges

### `fc75bc5` - Reduce 1.0 to historical Soviet campaign

- Removed future-facing runtime scope from the playable path.
- Locked new games to the historical campaign.
- Stopped historical era progression at 1991.
- Made campaign completion persistent so the dissolution modal does not refire.
- Kept post-1991 play as grounded local continuation of the same settlement.

### `e3660af` - Fix Android debug CD autolinking

- Restored the `cd.yml` Android debug artifact lane.
- Cleaned up stale dependencies and test/docs drift surfaced during review.
- Reconfirmed the release and CD chain on `main`.

## What Ships Today

### Product Surface

- Single historical campaign start.
- Seven historical eras covering 1917 through 1991.
- Organic same-settlement simulation with food, industry, power, transport,
  politics, KGB, demographics, weather, disasters, and narrative pressure.
- Score/summary at the 1991 dissolution endpoint.
- Grounded same-settlement continuation after campaign completion.

### Delivery Surface

- Web export deployed to GitHub Pages.
- Android debug artifact published from `cd.yml`.
- Release tags handled by `release.yml`.

### Quality Surface

- Node test lane for core simulation.
- Vitest browser lane using headed local Chrome through Playwright.
- Smoke export lane that captures screenshots and `diagnostics.json`.
- CI artifact upload for browser diagnostics and smoke diagnostics.

## What Is Explicitly Out Of Scope

- Kardashev or deep-future progression.
- Space, Mars, Dyson, O'Neill, or celestial rendering/gameplay.
- Multi-settlement relocation or global expansion.
- Post-scarcity pressure domains.
- Alternate-history sandbox branches as part of the 1.0 product.

## What Comes Next

The remaining work is intentionally centralized in [PRODUCTION.md](./PRODUCTION.md):

- design and UX polish;
- clearer tutorials and player guidance;
- historical content completion and tuning;
- launch-readiness passes for store assets and release process;
- additional verification depth where the current game is still rough.
