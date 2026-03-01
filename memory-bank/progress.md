# Progress

## What's Complete

### Core Game Systems
- [x] SimulationEngine with full tick orchestration
- [x] 16 building types × 3 levels with placement/bulldoze
- [x] Resource tracking (food, vodka, power, water, money, population)
- [x] 5-year plan quotas with annual reviews
- [x] 8 era campaigns with transitions and doctrine integration
- [x] Personnel file (black marks, commendations, threat levels)
- [x] Settlement tiers (selo → posyolok → PGT → gorod)
- [x] 31 achievements with tracking
- [x] 9 text-choice minigames
- [x] Scoring system with 3×3 difficulty/consequence matrix
- [x] Tutorial system (12 sequential directives)

### Demographics & Workers
- [x] Dvor (household) system with family structures
- [x] Birth/death/aging lifecycle
- [x] Gender-differentiated retirement (55F/60M)
- [x] Male-first conscription (18-51)
- [x] Era birth rate multipliers
- [x] Private plot food production
- [x] Loyalty/sabotage system
- [x] Trudodni (7-category labor accounting)
- [x] Worker AI (6 behavior classes)
- [x] Autonomous collective self-organization

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
- [x] CI (typecheck + tests on PR)
- [x] CD (Release Please → GitHub Pages + Android APK)
- [x] 2,609+ tests across 96 suites

### Health & Safety
- [x] Disease events (DiseaseSystem with seasonal epidemics)
- [x] Workplace accidents (WorkerSystem accident mechanics)

### Documentation & Tooling
- [x] Documentation overhaul (41 docs with YAML frontmatter)
- [x] JSDoc completion (~273/283 source files)
- [x] AGENTS.md index hierarchy (8 files)
- [x] Memory bank (Cline-style, 7 files)
- [x] .claude agent/command architecture (6 agents, 5 commands)
- [x] TypeDoc generation pipeline (`npm run docs:api`)

## What's In Progress

- [ ] Game completion sprint (consequence modes, era doctrines, minigames, renderers)
- [ ] E2E Playwright test expansion (6 spec files)
- [ ] Dynamic grid size system
- [ ] Consequence mode rehabilitation flow
- [ ] Interactive minigame UI framework

## What's Planned

- [ ] Per-building trudodni assignment
- [ ] Leader archetype behavioral modifiers (11 types designed)
- [ ] Era doctrine full mechanics (thaw/freeze, stagnation rot, eternal bureaucracy)
- [ ] Power transition mechanics full implementation
- [ ] Native minimap
- [ ] WebXR entry point UI
- [ ] iOS build pipeline + E2E CI

## Version History

| Version | Date | Highlights |
|---------|------|-----------|
| v1.2.0 | 2026-03 | Demographics overhaul, docs overhaul, game completion sprint (pending release) |
| v1.1.3 | 2026-02 | Docs-vs-code alignment audit (83 findings) |
| v1.1.2 | 2026-02 | 3D rendering fix, political entity tap interaction |
| v1.1.0 | 2026-02 | R3F migration from BabylonJS |
| v1.0.0 | 2026-02 | Initial release — all core systems |
