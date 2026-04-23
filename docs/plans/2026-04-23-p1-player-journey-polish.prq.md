---
title: P1 Player Journey Polish
created: 2026-04-23
version: 1.0
status: current
domain: release
timeframe: 2 weeks
batch_name: p1-player-journey-polish
---

# Feature: Fluent Player Journey + Content Backfill + Launch Readiness

**Goal:** Polish (take the game from playable to a complete, polished 1.0 across the full 1917–1991 arc)
**Area:** Full Stack (era events, ECS simulation, UI, docs, CI/CD, asset hygiene)
**Timeframe:** 2 weeks

## Priority: P1 — 1.0 polish

## Overview

All P0 playability blockers have merged (commits c6044ec–d21b53f, Apr 23 2026). The game boots, the HUD shows, saves work, fonts render, the tutorial fires. The experiential skeleton is now intact. What remains is the journey: a player who starts in October 1917 and is supposed to feel the weight of 74 years of Soviet history has only sparse narrative events in four of seven eras, an opening turn that floods them with 21 arrival toasts before they can read a single one, HQ tabs gated behind population thresholds that are unreachable in a historical campaign, and a codebase carrying 26 out-of-scope GLBs and dead script references that were not part of the 1.0 scope.

This batch addresses three themes in parallel: (1) **content backfill** — era event coverage and config correctness; (2) **player flow repair** — notification UX and HQ accessibility; and (3) **launch readiness** — scope debt cleanup, stray file hygiene, release pipeline documentation, and doc/design alignment. A fourth theme, **deprecation and test coverage**, runs as background cleanup throughout.

The 1.0 scope remains locked: single historical settlement, 1917–1991, predsedatel survival sim. No work in this batch touches space, future eras, multi-settlement, or alternate timelines.

## Tasks

### Theme A — Era Content Backfill (parallelize freely)

- [ ] **P1A-1** Backfill `collectivization` era events
  Collectivization (1922–1932, 10 years) has 0 dedicated events — all three existing events with `eraFilter: ['collectivization', ...]` are shared with industrialization. Add ≥6 dedicated events covering: forced farm liquidation, grain seizure famine, kulak deportation (distinct from `kulak_purge`), collectivization quota pressure, peasant resistance, and the Holodomor shadow.
  Files: `src/ai/agents/narrative/events/templates/era_specific.ts`

- [ ] **P1A-2** Backfill `reconstruction` era events
  Reconstruction (1945–1956, 11 years) has 2 events (`veteran_return`, `rubble_salvage`). Add ≥4 more: late-Stalinist purge wave (1952), Lysenkoist agricultural decree, post-war housing shortage decision, and a de-Stalinization signal event for 1953.
  Files: `src/ai/agents/narrative/events/templates/era_specific.ts`

- [ ] **P1A-3** Backfill `thaw_and_freeze` era events
  Thaw-and-freeze (1956–1982, 26 years) has 3 events — approximately 1 per 9 years. Add ≥7 more to reach ≥10 total, covering: Sputnik mania, Khrushchev's corn campaign, Cuban Missile Crisis tension, Prague Spring crackdown, Brezhnev doctrine consolidation, détente-era trade rumor, and the Afghan draft lottery.
  Files: `src/ai/agents/narrative/events/templates/era_specific.ts`

- [ ] **P1A-4** Audit and resolve `victoryCondition` fields on 5 eras
  Five eras (`collectivization`, `industrialization`, `great_patriotic`, `reconstruction`, `thaw_and_freeze`) carry `victoryCondition` objects in `src/config/eras.json`. The engine reads them via `buildCondition()` in `src/game/era/definitions.ts:110` but era progression is year-driven — these conditions appear unused at runtime. Either (a) wire them as advisory milestone completions shown in the report panel, or (b) delete the fields and document that era progression is time-gated. Whichever path is chosen, update `src/game/era/types.ts` to match and add a comment to `definitions.ts` explaining intent.
  Files: `src/config/eras.json`, `src/game/era/definitions.ts`, `src/game/era/types.ts`

- [ ] **P1A-5** Document or fix `great_patriotic` empty `unlockedBuildings`
  `great_patriotic` has `"unlockedBuildings": []` in `src/config/eras.json:177`. Verify in the build system whether this is intentional (wartime freeze — no new building types, survival pivot) or a data gap. If intentional, add a comment in eras.json. If a gap, identify which building IDs were meant to unlock (e.g., field-hospital, guard-post variants) and add them. Either way, add a one-line entry to `docs/ARCHITECTURE.md` explaining the wartime era construction policy.
  Files: `src/config/eras.json`, `docs/ARCHITECTURE.md`

### Theme B — Player Flow (partially sequential — see Execution Order)

- [ ] **P1B-1** Batch and rate-limit arrival toasts
  By December 1917 the player receives 21 stacked `ARRIVAL: The [surname] family (N souls) has arrived` toasts from `src/game/SimulationEngine.ts:709`. Coalesce arrivals within the same simulation tick into a single toast (e.g. "12 families have arrived — 47 new souls"). Additionally, slow the turn-1 arrival burst so that ≤3 families arrive per in-game month during the first year of a new game. Cap pending toast queue at 5 visible items; older items auto-dismiss.
  Files: `src/game/SimulationEngine.ts`, `src/game/arrivalSequence.ts`, `src/ui/Toast.tsx`

- [ ] **P1B-2** Rescale HQ tab population gates
  `GovernmentHQ.tsx:60-72` gates KGB and Military behind `posyolok` (population ≥200) and Law Enforcement behind `gorod` (≥50,000). In a historical campaign starting at 5 people in 1917, `posyolok` is reachable but `gorod` at 50k+ is not achievable within the 1917–1991 arc. Rescale: `posyolok` threshold for KGB/Military stays (already reachable), but `gorod` for Law Enforcement should be lowered to `pgt` tier (≥2,000) or simply unlocked at a specific era (e.g., `reconstruction`). Update the tier-map comment at line 78–80 and the `TIER_ORDER` constant to match.
  Files: `src/ui/GovernmentHQ.tsx`

- [ ] **P1B-3** Update `docs/design/ui-ux.md` to match shipped UI
  `docs/design/ui-ux.md:42-80` describes a Bottom Panel with `[Auto]`, `[Select Workers]`, `[Auto-Comply]`, and an `[+Assign Worker] [Auto-fill]` row that do not exist in the shipped UI (these components were deliberately cut). The doc also references a worker-select mode that is unimplemented. Either (a) implement the bottom panel worker summary bar as described (simple two-row read-only — no worker assignment verbs, just idle/farm/factory/building/military counts), or (b) update the doc to match what actually ships. Whichever is chosen, update `last_verified` frontmatter to `2026-04-23`.
  Files: `docs/design/ui-ux.md` (and optionally `src/ui/` if implementing)

### Theme C — Scope Debt Cleanup (all parallel)

- [ ] **P1C-1** Delete 26 out-of-scope GLBs from `assets/models/soviet/`
  The following files are from removed future/space scope and must be deleted:
  `alien-fauna-flying.glb`, `alien-fauna-scout.glb`, `alien-fauna-spider.glb`, `alien-fauna-tentacle.glb`, `alien-threat-soldier.glb`, `colony-antenna.glb`, `colony-command.glb`, `colony-dome.glb`, `colony-factory.glb`, `colony-fusion.glb`, `colony-habitat-a.glb`, `colony-habitat-b.glb`, `colony-habitat-c.glb`, `colony-hydroponics.glb`, `colony-megafactory.glb`, `colony-reactor.glb`, `colony-rover.glb`, `colony-solar.glb`, `colony-synthplant.glb`, `colony-workshop.glb`, `comms-array.glb`, `launch-pad.glb`, `space-module.glb`, `spacestation-01.glb`, `spacestation-02.glb`, `spacestation-03.glb`, `spacestation-04.glb`, `spacestation-06.glb`.
  Also remove the 28 `"era": "the_eternal"` entries from `assets/models/soviet/manifest.json` (lines 346–627). Verify `pnpm run build` and `pnpm run test:node` still pass after deletion.
  Files: `assets/models/soviet/*.glb` (28 files), `assets/models/soviet/manifest.json`

- [ ] **P1C-2** Remove dead shader declarations from `assets/polyhaven-requirements.json`
  Lines 644–687 declare shader requirements for three files that do not exist:
  `src/scene/shaders/DysonSphereBackdrop.tsx`, `src/scene/shaders/MarsAtmosphere.tsx`, `src/scene/shaders/ONeillInterior.tsx`.
  Remove these three declaration blocks. Also remove `scripts/enrich-narratives.ts:36-48` TIMELINE_FILES entries for the 10 missing space/lunar/mars timeline files (`spaceTimeline.json`, `lunarTimeline.json`, `marsTimeline.json`, and any others in that array) — or delete the entire script if it has no remaining 1.0 purpose. Verify `pnpm run build` still passes.
  Files: `assets/polyhaven-requirements.json`, `scripts/enrich-narratives.ts`

- [ ] **P1C-3** Clean up stray PNG screenshots from repo root
  The repo root contains 65 `.png` files (development screenshots). Move files that document bugs already fixed to `docs/archive/screenshots/` or delete them outright. Any screenshot that captures a still-open issue should be moved to `docs/screenshots/` with a descriptive name. Add `*.png` to `.gitignore` at the repo root (scoped, not global) to prevent future accumulation. Confirm git history is not rewritten — use `git rm` normally.
  Files: repo root `*.png`, `.gitignore`

### Theme D — Launch Readiness (partially sequential — see Execution Order)

- [ ] **P1D-1** Store-facing screenshots and app metadata
  Produce 5 canonical store screenshots at 1080×1920 (portrait, phone) and 2048×2732 (tablet) covering: (1) 1917 revolution era opening, (2) active quota + directive HUD, (3) Government HQ open, (4) stagnation era decay event, (5) USSR dissolution modal. Capture via `pnpm web` + Playwright screenshot. Write store metadata (title, short description ≤80 chars, long description ≤4000 chars, content rating justification) to `docs/store-metadata.md`. Screenshots go to `docs/screenshots/store/`.
  Files: `docs/screenshots/store/` (new directory), `docs/store-metadata.md` (new file)

- [ ] **P1D-2** Document Android signed release path
  Document the steps to produce a signed release APK in `docs/DEPLOYMENT.md`. Include: required secrets (`ANDROID_KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`), where to generate the keystore, the Gradle signing config block, and the `.github/workflows/release.yml` job additions needed. Do not add the secrets themselves — document where they are stored (GitHub repo secrets). The CD workflow already uploads a debug APK; this task covers the release signing path only.
  Files: `docs/DEPLOYMENT.md`, `.github/workflows/release.yml` (annotations only, no secrets committed)

- [ ] **P1D-3** Document iOS signed release path
  Document the steps to produce a signed iOS build for App Store submission in `docs/DEPLOYMENT.md`. Include: Apple Developer account prerequisites, `EXPO_APPLE_ID`, `EXPO_TEAM_ID`, `APPLE_APP_SPECIFIC_PASSWORD` secrets, the EAS build configuration additions, and the release.yml job additions. The existing simulator build in CD is sufficient for CI; this covers the distribution path.
  Files: `docs/DEPLOYMENT.md`, `eas.json` (if it exists)

- [ ] **P1D-4** Dry-run full release flow with a test tag
  After P1C-1 through P1C-3 merge (clean build confirmed), push a tag `v1.0.0-rc.1` from a release branch, observe the release-please + CD chain, and capture any failures. Document findings in `docs/RELEASE.md` under a "Release Rehearsal" section. Fix any workflow issues found. Goal: `v1.0.0` tag should produce a Pages deploy, a debug Android APK artifact, and a GitHub Release entry without manual intervention.
  Files: `.github/workflows/release.yml`, `.github/workflows/cd.yml`, `docs/RELEASE.md`

### Theme F — Verification-report gaps (found during end-to-end smoke, 2026-04-23)

- [ ] **P1F-1** HUD typography: adopt IBM Plex Mono throughout game UI
  `src/ui/designTokens.ts` defines a `BrandFonts` token with Oswald + IBM Plex Mono, but only `MainMenu.tsx` consumes it (11 references). The rest of the in-game UI (HUD, HQ tabs, reports, modals) uses `fontFamily: 'monospace'` — the system fallback — in 589 references across `src/ui/`. Create a `monoFont` token in `designTokens.ts` that resolves to `'IBMPlexMono'` (the loaded family) with a system monospace fallback, and replace raw `'monospace'` string literals across `src/ui/*.tsx` with the token. Verify with Playwright that computed `font-family` on a HUD panel includes `IBMPlexMono`.
  Files: `src/ui/designTokens.ts`, `src/ui/*.tsx` (many)

- [ ] **P1F-2** Resolve directive/tutorial first-instruction conflict
  On a fresh New Game, the tutorial fires `KRUPNIK: Build a farm — your people will need food before they need anything else` while `DirectiveHUD` shows `ACTIVE DIRECTIVE — Housing: Build 4 Residential buildings`. Two contradictory first instructions. Reconcile: (a) change directive sequence so the first directive matches the tutorial's first milestone (farm), OR (b) change the tutorial first-milestone to echo the active directive, OR (c) delay the directive system from firing until after the first tutorial milestone completes. Pick the option that best preserves both systems' intent and document the choice in `docs/design/ui-ux.md`.
  Files: `src/game/directives.ts` (or equivalent), `src/ai/agents/meta/TutorialSystem.ts`

- [ ] **P1F-3** IntroModal copy: explain organic settlement growth
  After IntroModal dismissal, the player sees empty terrain with no buildings. The `CollectiveAgent` will spawn buildings organically as the caravan arrives, but the IntroModal says nothing about this. A city-builder-minded player will stare at empty land looking for a build button. Add one sentence to the IntroModal body: e.g., "Your collective will build itself as families arrive — your job is to steer, not to place stones." Match the existing dark-absurdist voice.
  Files: `src/ui/IntroModal.tsx`

- [ ] **P1F-4** Missing classified-archive era intros
  `USSRDissolutionModal` and similar era-transition modals render a `timelineEvent && <ClassifiedArchive>...` block. Three eras have no matching entry in `HISTORICAL_TIMELINE`: `revolution` (1917), `industrialization` (1932), `thaw_and_freeze` (1956). The modal silently suppresses the archive section for these eras, producing a blander transition. Add three entries to the timeline — authentic declassified-document tone, 2-3 sentences each, matching the voice of existing entries.
  Files: `src/config/historicalTimeline.ts` (or `src/game/era/historicalTimeline.ts` — locate the array)

- [ ] **P1F-5** Explain Great Patriotic War construction freeze in-game
  GPW era has `unlockedBuildings: []` (intentional — wartime economy, no new building types). But there is no in-game UI feedback that building is suspended; the player may notice the collective has stopped expanding and assume a bug. Add a subtle HUD badge or era-modal callout: e.g. `BUILDING PROGRAMME SUSPENDED — TOTAL WAR ECONOMY` in the HQ Gosplan tab during `great_patriotic`. Ensure the badge is only visible during this era and that `pnpm run test:node` passes a test for it being shown/hidden based on era.
  Files: `src/ui/GovernmentHQ.tsx` or `src/ui/gosplan/GosplanTab.tsx`

- [ ] **P1F-6** Dev-mode SQLite silent failure: surface a clear developer message
  In dev (`pnpm web`), Service Worker registration is skipped (production-only guard), so `SharedArrayBuffer` is unavailable → `initDatabase()` fails silently → autosave errors every 60s in console. Non-blocking for players (prod works fine) but a dev trap. Add a one-time dev-mode warning toast/console.warn on app startup: "SQLite not available in dev — saves will not persist. Run a production build to test save/load. See docs/DEPLOYMENT.md." Gate strictly on `process.env.NODE_ENV !== 'production'`.
  Files: `src/App.web.tsx`, `src/persistence/` (wherever `initDatabase` lives)

### Theme E — Deprecation + Test Coverage (background, parallelize)

- [ ] **P1E-1** Fix runtime deprecation warnings
  Address the four classes of console warnings visible on `pnpm web`:
  (a) `shadow*` style props (`shadowColor`, `shadowOffset`, `shadowRadius`, `shadowOpacity`) — replace with `boxShadow` in web-safe StyleSheet blocks; files in `src/ui/` that use them include `USSRDissolutionModal.tsx`, `Ticker.tsx`, `NewGameSetup.tsx`, `LoadingScreen.tsx`, `SovietModal.tsx`, and others.
  (b) `textShadow*` style props — same approach.
  (c) `THREE.Clock` → `THREE.Timer` migration (Three.js r183+).
  (d) `useNativeDriver` on web — gate the prop with a `Platform.OS === 'ios' || Platform.OS === 'android'` check.
  All fixes must pass `pnpm run typecheck && pnpm run lint && pnpm run test:node`.
  Files: Multiple `src/ui/*.tsx`, `src/scene/*.tsx` (identified by running `pnpm web` and reviewing console)

- [ ] **P1E-2** Extend browser campaign smoke coverage
  The existing `pnpm run test:browser` suite covers basic load. Add Playwright tests that advance the historical campaign through at least 3 era transitions (revolution → collectivization → industrialization) and assert: (a) era label updates in TopBar, (b) at least one era-specific event modal fires, (c) quota HUD reflects updated delivery rates, (d) no JS errors in console during era transition. Tests go in `src/__tests__/e2e/` or the existing e2e directory.
  Files: `src/__tests__/e2e/` or equivalent, `playwright.config.ts` if config changes needed

## Dependencies

- P1A-1, P1A-2, P1A-3 are fully independent — all write to `era_specific.ts` in different sections; assign to three parallel workers.
- P1A-4 and P1A-5 are independent of A-1/A-2/A-3 but should be reviewed together since both touch `eras.json`.
- P1B-1 (toast batching) is independent of P1B-2 (HQ gates) and P1B-3 (doc update).
- P1B-3 decision (implement vs. document) must be made before work starts; if implementing, it depends on P0 HUD work being stable (already merged).
- P1C-1 must complete before P1D-4 (dry-run), to ensure a clean build under the test tag.
- P1C-2 must complete before P1D-4 for the same reason.
- P1C-3 is independent.
- P1D-1 (screenshots) depends on P1B-1 (toast flood fixed) — the opening screenshot must not show 21 stacked toasts.
- P1D-2 and P1D-3 are independent of each other.
- P1D-4 (dry-run) depends on P1C-1, P1C-2, and both P1D-2/P1D-3 docs being in place.
- P1E-1 and P1E-2 are independent of all other themes.
- No verification report found at `docs/plans/2026-04-23-p1-verification-report.md` — findings from in-browser smoke testing are TBD; flag for follow-up if the sibling verification agent produces a report, and fold additional tasks into a P1.1 patch PRD as needed.

## Acceptance Criteria

### P1A-1 — Collectivization events
- `ERA_SPECIFIC_EVENTS` contains ≥6 events with `eraFilter` including `'collectivization'` only (not shared with industrialization).
- Each event has `id`, `title`, `description`, `pravdaHeadline`, `category`, `severity`, `effects`, and `eraFilter`.
- All events pass `pnpm run typecheck` and `pnpm run test:node` without error.
- At least one event has a `condition` guard (e.g., fires only when food < threshold).

### P1A-2 — Reconstruction events
- ≥4 additional events with `eraFilter: ['reconstruction']` only.
- At least one event targets year ≥1952 via a `condition: (gs) => gs.date.year >= 1952` guard (late-Stalin wave).
- `pnpm run typecheck` and `pnpm run test:node` pass.

### P1A-3 — Thaw-and-freeze events
- Total events with `eraFilter: ['thaw_and_freeze']` reaches ≥10.
- Events span the full 1956–1982 range via `condition` year guards where needed.
- `pnpm run typecheck` and `pnpm run test:node` pass.

### P1A-4 — victoryCondition audit
- Every `victoryCondition` field is either (a) wired to a visible milestone in the report panel and tested, or (b) removed from `eras.json` and `types.ts` updated to remove the optional field.
- `src/game/era/definitions.ts` has a comment explaining whether `victoryCondition` is live or vestigial.
- `pnpm run typecheck`, `pnpm run lint`, and `pnpm run test:node` pass.

### P1A-5 — great_patriotic unlockedBuildings
- `eras.json` either has `"unlockedBuildings": []` with an inline comment `// intentional: wartime freeze — no new building types` or has the correct building IDs populated.
- `docs/ARCHITECTURE.md` contains a sentence explaining the wartime construction policy.
- No building unlock regression in adjacent eras (confirmed by running `pnpm run test:node`).

### P1B-1 — Arrival toast batching
- Starting a new game and advancing past December 1917 shows ≤3 arrival-related toasts in the visible toast stack at any one time.
- Coalesced toast format: `"N families arrived — X new souls"` when multiple families arrive in the same tick.
- Toast queue caps at 5 visible items; items auto-dismiss after 4 seconds.
- `pnpm run test:node` passes; no regression in arrival population accounting (worker counts correct after batched arrivals).

### P1B-2 — HQ tab rescaling
- Law Enforcement tab is accessible at `pgt` tier (≥2,000 population) or a specific era, not at `gorod` (50,000).
- All tabs accessible in a historical campaign that reaches at least 2,000 population before 1991.
- Comment at `GovernmentHQ.tsx:78-80` updated to match new thresholds.
- `pnpm run typecheck` and `pnpm run test:node` pass.

### P1B-3 — ui-ux.md alignment
- `docs/design/ui-ux.md` frontmatter has `last_verified: 2026-04-23`.
- Either (a) the Bottom Panel described in lines 42–80 is implemented and visible in `pnpm web`, or (b) the doc reflects the actual shipped UI (no reference to removed `[Auto]`, `[Select Workers]`, `[Auto-Comply]` buttons).
- No new stubs introduced — if (a), the panel must be fully functional, not a placeholder.

### P1C-1 — Out-of-scope GLBs removed
- `git ls-files assets/models/soviet/` lists no `alien-*`, `colony-*`, `spacestation-*`, `comms-array.glb`, `launch-pad.glb`, or `space-module.glb` files.
- `assets/models/soviet/manifest.json` contains no entry with `"era": "the_eternal"`.
- `pnpm run build` and `pnpm run test:node` pass.
- Build artifact size decreases (captured in PR description).

### P1C-2 — Dead script/shader references removed
- `assets/polyhaven-requirements.json` contains no references to `DysonSphereBackdrop.tsx`, `MarsAtmosphere.tsx`, or `ONeillInterior.tsx`.
- `scripts/enrich-narratives.ts` either no longer references `spaceTimeline.json`, `lunarTimeline.json`, `marsTimeline.json` (and any other missing timelines), or the script is deleted entirely.
- `pnpm run build` passes.

### P1C-3 — Stray PNG cleanup
- `git ls-files "*.png"` in repo root returns 0 results (or only intentional tracked PNGs — none expected in root).
- `.gitignore` at repo root has an entry preventing future accumulation (e.g., `/*.png`).
- Any screenshots documenting open issues are preserved in `docs/screenshots/` with descriptive names.

### P1D-1 — Store screenshots and metadata
- `docs/screenshots/store/` contains 5 PNG files at correct dimensions.
- `docs/store-metadata.md` exists with title, short description (≤80 chars), long description (≤4000 chars), and content rating notes.
- Screenshots show correct era labels, no debug panels, no error overlays, and no stacked arrival toast flood.

### P1D-2 — Android signed release docs
- `docs/DEPLOYMENT.md` has an "Android Signed Release" section documenting the 4 required secrets, keystore generation steps, and Gradle signing block.
- `.github/workflows/release.yml` has inline comments indicating where signing step will slot in (no actual secrets committed).

### P1D-3 — iOS signed release docs
- `docs/DEPLOYMENT.md` has an "iOS App Store Release" section covering Apple Developer prerequisites, the 3 required secrets, and EAS configuration.
- No Apple credentials committed to the repo.

### P1D-4 — Release dry-run
- A `v1.0.0-rc.1` tag triggers the release.yml → cd.yml chain without manual intervention.
- GitHub Releases page shows the tag with at least a debug APK attached and a Pages deploy link.
- `docs/RELEASE.md` contains a "Release Rehearsal" section documenting any issues found and their fixes.
- All workflow failures found during the dry-run are fixed before this task is marked complete.

### P1F-1 — IBM Plex Mono adoption
- A single `monoFont` token lives in `designTokens.ts` resolving to `'IBMPlexMono, monospace'`.
- Grep for raw `'monospace'` string literals in `src/ui/` returns zero (allow some in `src/scene/` for R3F Text if needed, but UI layer must use the token).
- Playwright smoke asserts computed HUD `font-family` contains `IBMPlexMono`.
- `typecheck`, `lint`, `test:node`, `build` all pass.

### P1F-2 — Directive/tutorial reconciliation
- On a fresh New Game, the first visible directive and first tutorial milestone point to the same action (both say "farm" OR both say "housing" OR the directive is delayed until after the first milestone completes).
- Choice is documented in `docs/design/ui-ux.md` under a new "First-minute guidance" section.
- `pnpm run test:node` passes; an integration test asserts non-contradiction.

### P1F-3 — Organic settlement copy
- `IntroModal.tsx` body contains at least one sentence explaining that the collective builds itself via caravan arrivals.
- The sentence matches the existing tone (no earnest onboarding language).
- Visual check via Playwright screenshot.

### P1F-4 — Classified archive entries
- `HISTORICAL_TIMELINE` array contains entries for `revolution`, `industrialization`, and `thaw_and_freeze` era transitions.
- Each entry is 2-3 sentences, declassified-archive tone, with an authentic-looking source tag.
- The era-transition modal now shows a classified archive section for all 7 eras.

### P1F-5 — GPW construction freeze indicator
- During `great_patriotic` era, the Gosplan tab (or equivalent HQ surface) displays a `BUILDING PROGRAMME SUSPENDED — TOTAL WAR ECONOMY` badge.
- Badge is hidden outside GPW era.
- A `__tests__/ui/` test asserts show/hide based on era state.

### P1F-6 — Dev-mode SQLite warning
- On `pnpm web` startup (dev only), a console.warn and optional dev-toast fires once: "SQLite not available in dev — saves will not persist."
- In production build, no such warning appears.
- Autosave error spam every 60s in dev console is suppressed or consolidated into a single startup message.

### P1E-1 — Deprecation warnings
- `pnpm web` console shows zero `shadowColor`/`textShadow*`/`THREE.Clock`/`useNativeDriver` deprecation warnings.
- `pnpm run typecheck` and `pnpm run lint` pass with no new errors introduced.
- No visual regression: UI panels retain the same appearance (shadow effects may differ on web vs native but must still be visible).

### P1E-2 — Browser campaign smoke coverage
- Playwright test suite includes ≥1 test that advances through 3 era transitions without JS errors.
- Test asserts era label change, at least one event modal, and correct quota values.
- `pnpm run test:browser` or `pnpm run test:e2e` passes in CI.

## Technical Notes

- **Package manager:** `pnpm@10.33.0` (NOT npm — `package.json` pins it)
- **Dev command:** `pnpm web` → `http://localhost:8081`
- **Verification commands (all must pass before any task is marked complete):**
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm run test:node`
  - `pnpm run build`
- **Browser verification:** Playwright MCP or Chrome DevTools MCP for screenshots and console capture
- **Style:** TypeScript strict, React Native `StyleSheet.create`, monospace Soviet terminal aesthetic (red, gold, terminal green, dark panels)
- **Commits:** One branch + PR per task. Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`). Squash-merge.
- **Era event style:** Match the existing dark-absurdist voice in `era_specific.ts` — third-person omniscient, flat affect, bureaucratic understatement. Never earnest.
- **Out of scope (do NOT touch in this batch):** Space/Mars/future eras, multi-settlement, Kardashev progression, Dyson/O'Neill/Mars rendering, Advisor component (deliberately removed in P0), Toolbar, LensSelector, WorkerStatusBar.

## Execution Order

**Wave 1 — all parallel, no dependencies:**
- P1A-1 (collectivization events)
- P1A-2 (reconstruction events)
- P1A-3 (thaw events)
- P1A-4 (victoryCondition audit)
- P1A-5 (great_patriotic buildings)
- P1B-1 (toast batching)
- P1B-2 (HQ gate rescaling)
- P1C-2 (dead script/shader refs)
- P1C-3 (PNG cleanup)
- P1E-1 (deprecation warnings)
- P1E-2 (browser smoke coverage)
- P1F-1 (IBM Plex Mono adoption)
- P1F-2 (directive/tutorial reconciliation)
- P1F-3 (intro modal copy)
- P1F-4 (classified archive entries)
- P1F-5 (GPW freeze indicator)
- P1F-6 (dev-mode SQLite warning)

**Wave 2 — depends on Wave 1 items:**
- P1B-3 (ui-ux.md alignment) — after P1B-1 is merged so the doc reflects stable toast behavior
- P1C-1 (out-of-scope GLBs) — can run in Wave 1 but coordinate with P1D-4 which needs it merged first
- P1D-1 (store screenshots) — after P1B-1 merged (toast flood must be gone before screenshots)
- P1D-2 (Android docs) — independent, can run in Wave 1 or 2
- P1D-3 (iOS docs) — independent, can run in Wave 1 or 2

**Wave 3 — gate on Wave 2:**
- P1D-4 (dry-run release) — after P1C-1, P1C-2, P1D-2, P1D-3 all merged and build confirmed clean

## Risks

- **Era event voice regression:** Adding 17+ new events risks tonal drift from the established dark-absurdist register. Reviewer should read all new events against the existing P0 set before merging; add a voice-check step to the PR template.
- **victoryCondition wiring (P1A-4):** If "wire as milestone" is chosen, the report panel must surface it — this may be more UI work than expected. The "delete the field" option is lower risk if scope is tight.
- **Toast batching edge cases (P1B-1):** The arrival sequence uses individual family callbacks in `SimulationEngine.ts:709`; batching requires accumulating within a tick boundary. If the simulation tick loop is not cleanly bounded, coalescing may miss cross-tick bursts. Investigate `arrivalSequence.ts` call frequency before implementing.
- **GLB deletion build side effects (P1C-1):** If any scene loader references the deleted GLBs by path string (not through the manifest), deletion will cause a runtime 404 rather than a build error. Run a grep for each filename before deleting and chase any references.
- **iOS release path complexity (P1D-3):** EAS build for App Store requires a paid Apple Developer account. The task is documentation only — do not block on having the account active; document the steps as if it exists and note the prerequisite.
- **Dry-run tag pollution (P1D-4):** `v1.0.0-rc.1` tags will appear in release history. Use a pre-release flag in the GitHub Release and delete the RC tag after the rehearsal is confirmed, or use a separate `release-test` branch to avoid polluting the main release series.
- **Verification report gap:** No `docs/plans/2026-04-23-p1-verification-report.md` found — if a sibling web-verification agent produces findings after this PRD is written, additional player-journey issues may need a P1.1 patch PRD. Budget time in week 2 for triage.

## Stop-on-failure Policy

`stop_on_failure: false` — tasks are grouped by theme; a failure in Theme A does not block Theme C or D. Within Theme D, P1D-4 must stop if P1C-1 or P1C-2 have not merged cleanly.

## Config

```yaml
batch_name: p1-player-journey-polish
stop_on_failure: false
auto_commit: true
branch_strategy: one-per-task
pr_strategy: open-on-complete
verification:
  - pnpm run typecheck
  - pnpm run lint
  - pnpm run test:node
  - pnpm run build
```
