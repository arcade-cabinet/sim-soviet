---
title: Production Checklist
updated: 2026-04-23
status: current
domain: release
---

# Production Checklist

This document owns the remaining work. If something is still required before a
polished public 1.0, it should be listed here and not implied elsewhere.

## Release Targets

| Target | Requirement |
| --- | --- |
| Web | GitHub Pages build remains the primary public playtest surface |
| Android | Debug artifact from CD, then signed release path |
| iOS | Simulator build from release workflow, then signed device/store path |
| Save continuity | Campaign completion, post-1991 continuation, and restore flow remain stable |
| Presentation | Production language, consistent typography, design tokens, and polished landing/game shell |
| QA | Historical campaign smoke coverage plus browser diagnostics and screenshots |

## Shipped And Verified

- Historical-only campaign scope is on `main`.
- GitHub Pages deployment is live.
- CI, release, and CD workflows are green in the current chain.
- Browser and smoke diagnostics are captured as artifacts.
- Root guidance docs now describe the same product.

## Remaining Work

### P0 - Product Clarity And Playability

- [ ] Tighten onboarding so the first minutes explain the player's actual verbs
      without falling back to city-builder assumptions.
- [ ] Audit all visible UI copy for prototype, demo, placeholder, or developer
      phrasing.
- [ ] Finish a full historical-campaign playthrough pass that records rough
      edges by era, not just smoke outcomes.
- [ ] Confirm the post-1991 continuation remains worth playing for a sustained
      local-management session.

### P0 - Design And UX Polish

- [ ] Run a complete visual review of landing page, menu, HUD, reports,
      building panels, and dissolution summary on desktop and mobile widths.
- [ ] Normalize typography, spacing, and token usage across the UI so the
      production design system is real rather than aspirational.
- [ ] Replace any remaining placeholder art, low-information panels, or dead-end
      UI states in the main playable path.

### P0 - Historical Content And Simulation Tuning

- [ ] Audit each historical era for distinct pressure, event cadence, and
      narrative identity.
- [ ] Review quota pressure, shortages, demographics, political punishment, and
      failure states for exploitability and boredom.
- [ ] Validate that crisis and scoring systems reward survival under pressure
      rather than passive idling.

### P0 - Launch Readiness

- [ ] Produce final store-facing screenshots and descriptive metadata.
- [ ] Add signed Android release steps and document required secrets.
- [ ] Add the signed iOS release path and document required secrets.
- [ ] Walk the release flow from branch -> PR -> merge -> release -> CD with a
      fresh tag after the next gameplay-facing batch.

### P1 - Verification Depth

- [ ] Expand browser and E2E coverage beyond the current historical smoke path
      into longer-form campaign progression scenarios.
- [ ] Capture a deliberate visual baseline set for key screens and compare it
      during polish work.
- [ ] Add more targeted diagnostics for year rollover, campaign completion, save
      restore, and late-era decline.

## Explicit Non-Work

Do not spend 1.0 time on:

- future eras;
- space systems;
- new settlements;
- world-map/global expansion;
- post-scarcity abstractions;
- reintroducing removed product modes.
