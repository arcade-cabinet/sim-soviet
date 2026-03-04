# Progress

## CRITICAL REMINDER
**This is NOT a city builder.** The player is a predsedatel (chairman). The settlement grows organically. Player does NOT freely place buildings. See CLAUDE.md and docs/GAME_VISION.md.

## What's Complete (Implemented & Tested)

### Engine Architecture
- [x] SimulationEngine decomposed into 7 phase modules (thin orchestrator, ~890 lines)
- [x] TickContext shared type for all phases
- [x] Yuka agent architecture (8 subpackages, 123+ files, 28k+ lines)
- [x] Governor/crisis system (HistoricalGovernor + FreeformGovernor + ChaosEngine)
- [x] Building-as-Container (dual population modes: entity < 200, aggregate >= 200)
- [x] Seeded GameRng mandatory (80+ Math.random replaced)
- [x] SettlementSummary type + settlement_state DB schema
- [x] Per-building tick, per-tile terrain tick pure functions
- [x] Condition-based crisis state machine
- [x] Protected building classes (government/military never demolished)

### Game Systems
- [x] Resource tracking (food, vodka, power, water, money, population)
- [x] 5-year plan quotas with annual reviews
- [x] 8 era campaigns with transitions and doctrine integration
- [x] Personnel file (black marks, commendations, threat levels)
- [x] Settlement tiers (selo → posyolok → PGT → gorod)
- [x] 31 achievements with tracking
- [x] 9 text-choice minigames
- [x] Scoring system with consequence multipliers (rehabilitated/gulag/rasstrelyat)
- [x] Classic mode REMOVED — only historical and freeform
- [x] Soviet consequence nomenclature (rehabilitated/gulag/rasstrelyat)

### Demographics & Workers
- [x] Dvor (household) system with family structures
- [x] Birth/death/aging lifecycle
- [x] Gender-differentiated retirement (55F/60M)
- [x] Male-first conscription (18-51)
- [x] Private plot food production
- [x] Loyalty/sabotage system
- [x] Trudodni (7-category labor accounting)
- [x] Worker AI (6 behavior classes)
- [x] Statistical demographics (Poisson-sampled)
- [x] Entity GC sweeps (orphan citizens, empty dvory)

### Political Systems
- [x] Politburo with 10 ministries
- [x] Politruks, KGB, military entities
- [x] Political entity roster with tap interaction
- [x] Succession/coup mechanics

### Rendering & UI
- [x] R3F 3D rendering (55 GLB models, terrain, weather FX, lighting)
- [x] 22+ UI overlay components (Soviet aesthetic)
- [x] Audio system (52 tracks, mood playlists)
- [x] Save/load (full serialization to IndexedDB)
- [x] WebXR support (AR tabletop, VR walkthrough)

### Infrastructure
- [x] CI (lint + typecheck + tests on PR)
- [x] CD (Release Please → GitHub Pages + Android APK)
- [x] 4,400+ tests across 170 suites
- [x] Documentation overhaul (41 docs with YAML frontmatter)
- [x] JSDoc completion (~273/283 source files)

## NOT YET DONE (Planned — Implement These Next)

These are documented in detail in `docs/plans/`:

### Phase 1: Remove Build Menu + Strip HUD (buildings-are-the-ui-plan Phase 1)
- [ ] Remove BUILD toolbar, ZONING/INFRASTRUCTURE/STATE subtabs, GhostPreview
- [ ] Strip TopBar to minimal: date, 3 resources, speed controls
- [ ] Remove advisor popup, ticker, quota HUD, directive HUD, worker status, lens selector
- [ ] Keep minimap (toggleable), toast (emergency only)

### Phase 2: Organic Settlement Growth Engine
- [ ] Demand calculation (housing, food, fuel, industrial, infrastructure needs)
- [ ] Era-appropriate site selection (pre-collectivization, collectivization, mikrorayon)
- [ ] Construction queue (materials consumed, worker brigades, real build time)
- [ ] Player influence via directives (shift demand weights, not direct placement)

### Phase 3: Buildings-as-UI System
- [ ] Click building → camera zooms → contextual side panel
- [ ] Building type panels (commune, farm, factory, Party HQ, medical, militia, school)
- [ ] Progressive HQ splitting (multi-function HQ → dedicated buildings as pop grows)

### Phase 4: Soviet Allocation Engine
- [ ] DB-backed tick pipeline (buildings tick via SQL, not ECS scan)
- [ ] Dvory motivation system (survival → duty → personal needs)
- [ ] Land grants (territory expands with settlement tier)
- [ ] Terrain prestige and contamination
- [ ] Policy UI via Government HQ building

### Phase 5: Dynamic Map Expansion
- [ ] Grid starts small (~20x20 at selo)
- [ ] Expands when settlement tier upgrades (posyolok → 30x30, pgt → 40x40, gorod → 50x50)
- [ ] GameGrid.expandGrid() + MapSystem.expandTerrain()
- [ ] Scene components update on resize (TerrainGrid, LensSystem, CameraController)

## Version History

| Version | Date | Highlights |
|---------|------|-----------|
| v1.2.0 | 2026-03 | Engine decomposition, classic mode removed, Soviet consequence names (pending) |
| v1.1.3 | 2026-02 | Docs-vs-code alignment audit |
| v1.1.2 | 2026-02 | 3D rendering fix, political entity tap interaction |
| v1.1.0 | 2026-02 | R3F migration from BabylonJS |
| v1.0.0 | 2026-02 | Initial release — all core systems |
