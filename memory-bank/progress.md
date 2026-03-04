# Progress

## CRITICAL REMINDER
**This is NOT a city builder.** The player is a predsedatel (chairman). The settlement grows organically. Player does NOT freely place buildings. See CLAUDE.md and docs/GAME_VISION.md.

## What's Complete (Implemented & Tested)

### Engine Architecture
- [x] SimulationEngine decomposed into 7 phase modules (thin orchestrator, ~890 lines)
- [x] TickContext shared type for all phases
- [x] Yuka agent architecture (8 subpackages, 123+ files, 28k+ lines)
- [x] Governor/crisis system (HistoricalGovernor + FreeformGovernor + ChaosEngine → PressureSystem + WorldAgent)
- [x] Pressure-valve crisis system (PressureSystem, ClimateEventSystem, BlackSwanSystem, ColdBranches)
- [x] Soviet Allocation Engine (organic growth, demand pipeline, site selection, HQ splitting)
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
- [x] 5,579+ tests across 229 suites
- [x] Documentation overhaul (41 docs with YAML frontmatter)
- [x] JSDoc completion (~273/283 source files)

## Recently Completed (feat/allocation-engine branch, PR #44)

### Pressure-Valve Crisis System + WorldAgent
- [x] PressureSystem with 6 domains (food, housing, power, loyalty, health, economy)
- [x] WorldAgent (core agent coordinating world-level state)
- [x] ClimateEventSystem (weather-driven crises)
- [x] BlackSwanSystem (rare catastrophic events)
- [x] ColdBranches (worldBranches.ts — alternate timeline forking)
- [x] PressureCrisisEngine + pressure accumulation pipeline

### Soviet Allocation Engine + Organic Growth
- [x] Organic settlement growth (demand pipeline → site selection → construction)
- [x] Buildings-as-UI (click buildings for contextual panels: FactoryContent, FarmContent)
- [x] HQ splitting (multi-function HQ → dedicated buildings as pop grows)
- [x] GrowthPacing, OrganicUnlocks, SiteSelectionRules
- [x] Government HQ with ReportsTab
- [x] Dynamic map expansion (grid expands via settlement tier upgrades)
- [x] Off-screen building tick for DB-only state updates
- [x] Freeform endless mode with unlimited map expansion
- [x] Global warming terrain effects for freeform centuries

## Version History

| Version | Date | Highlights |
|---------|------|-----------|
| v1.2.0 | 2026-03 | Engine decomposition, allocation engine, pressure-valve crisis system, organic growth |
| v1.1.3 | 2026-02 | Docs-vs-code alignment audit |
| v1.1.2 | 2026-02 | 3D rendering fix, political entity tap interaction |
| v1.1.0 | 2026-02 | R3F migration from BabylonJS |
| v1.0.0 | 2026-02 | Initial release — all core systems |
