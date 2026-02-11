# Ralph Execution Plan: Full Production Gap Closure (v2)

> **PRD Reference**: `docs/plans/prd-full-production.md`
> **Design Docs**: 10 docs in `docs/design/` — all aligned with autonomous collective philosophy
> **Status**: Iterations 1-7 COMPLETE (previous sessions). Resuming from iteration 8.
> **Approach**: TDD — write tests first, then implement, then verify
> **Max Iterations**: 30

---

## Design Philosophy (Updated)

**Core principle**: The collective self-organizes. Workers are autonomous via a 5-level behavioral governor. The player manages priorities, politics, and overrides — NOT individual worker assignment. Focusing on individual workers is a fatal gameplay flaw.

**Starting population**: 10 dvory (~55 people), not 12 atomic citizens. Population tracked at household (dvor) level.

**Interaction model**: Universal Radial Context Menu — same SVG pie menu for empty tiles (BUILD), buildings (INSPECT), and housing (HOUSEHOLD). No tap-to-assign.

---

## COMPLETED (Iterations 1-7)

| Iter | Gap | What Was Built |
|------|-----|----------------|
| 1 | GAP-004 | TutorialSystem wired into SimulationEngine, Krupnik naming |
| 2 | GAP-005 | AchievementTracker wired, toast on unlock |
| 3 | GAP-006 | GameTally wired, game-over screen shows tally |
| 4 | GAP-002 | RadialBuildMenu filtered by era + settlement tier |
| 5 | GAP-003 (partial) | Starting citizens spawned — BUT as 12 atomic citizens, not 10 dvory/55 people. **Must be upgraded to dvor system.** |
| 6 | GAP-001 (part 1) | Construction phase schema (foundation→building→complete), integer tick counter |
| 7 | GAP-001 (part 2) | constructionSystem ticking, phase transitions, archetypes |

**Also completed** (gap closure session):
- Worker sprites (Canvas2D citizen layer with class-colored dots)
- Worker tap → WorkerInfoPanel with stat bars
- Settlement tier gating in EraSystem
- Political entity badge rendering (role-specific shapes, pulsing, labels)
- Audio era/season switching
- WorkerSystem wired into SimulationEngine
- Save/load serialization for all subsystems
- 1863 tests passing, typecheck clean, 0 lint errors

---

## REMAINING (Iterations 8-30)

### Iteration 8: Construction Phases — Material Costs + UI
**Gaps**: GAP-001 (remaining)
**Files to modify**:
- `src/ecs/systems/constructionSystem.ts` — deduct materials per tick
- `src/game/SimulationEngine.ts` — pass era construction time multiplier
- `src/rendering/Canvas2DRenderer.ts` — progress bar overlay on foundation buildings

**TDD Steps**:
1. Write test: construction tick deducts timber/steel/cement from resources
2. Write test: no materials → construction pauses (workers idle at site)
3. Write test: era construction time multiplier applied to baseTicks
4. Write test: Canvas2DRenderer draws progress bar for non-complete buildings
5. Implement: material deduction, era multiplier, progress bar rendering
6. Verify: `pnpm test`, `pnpm typecheck`

**Acceptance**: Construction consumes materials, respects era speed, shows visual progress.

---

### Iteration 9: Dvor (Household) System — ECS Schema
**Gap**: GAP-003 (upgrade from atomic citizens to dvor system)
**Files to modify**:
- `src/ecs/world.ts` — add DvorComponent, extend CitizenComponent with dvorId/gender/age/memberRole
- `src/ecs/factories.ts` — `createStartingSettlement()` spawns 10 dvory with named families
- `src/ai/names/` — leverage existing NameGenerator for family names

**TDD Steps**:
1. Write test: after engine init, world has 10 dvor entities (normal difficulty)
2. Write test: each dvor has head, spouse, and 2-4 members
3. Write test: total population ~55 across all dvory
4. Write test: difficulty scales dvor count (12/10/7)
5. Write test: members have gender, age, labor capacity
6. Write test: chairman entity created separately (not in a dvor)
7. Implement: DvorComponent, DvorMember types, createStartingSettlement()
8. Verify: `pnpm test`, `pnpm typecheck`

**Acceptance**: New game starts with historically accurate household structure.

---

### Iteration 10: Dvor System — Demographic Tick
**Gap**: GAP-003 (continued)
**Files to modify**:
- New `src/ecs/systems/demographicSystem.ts` — births, deaths, aging, household formation
- `src/game/SimulationEngine.ts` — add demographic tick

**TDD Steps**:
1. Write test: eligible woman has 15% base birth chance per year
2. Write test: newborn added to mother's dvor as infant
3. Write test: aging transitions child→adolescent→worker→elder at correct ages
4. Write test: death curve (old age, starvation, disease)
5. Write test: household formation (unrelated adults form new dvor)
6. Write test: conscription targets male workers only
7. Implement: demographicSystem, integrate into SimulationEngine tick
8. Verify: `pnpm test`, `pnpm typecheck`

**Acceptance**: Population changes through births, deaths, aging. Households form and dissolve.

---

### Iteration 11: Behavioral Governor — Autonomous Worker AI
**Gaps**: Design philosophy (overview.md § Autonomous Collective System)
**Files to modify**:
- `src/game/workers/WorkerSystem.ts` — add behavioral governor priority evaluation
- `src/ecs/systems/populationSystem.ts` — workers self-assign based on priorities

**TDD Steps**:
1. Write test: idle worker with low food self-assigns to food production
2. Write test: idle worker with active construction mandate self-assigns to construction
3. Write test: worker evaluates priorities in correct order (survive→state→trudodni→improve→private)
4. Write test: player priority override changes worker behavior
5. Write test: force-assigned worker stays at forced task until released
6. Implement: behavioral governor evaluation in WorkerSystem tick
7. Verify: `pnpm test`, `pnpm typecheck`

**Acceptance**: Workers autonomously choose tasks. Player can override priorities.

---

### Iteration 12: Interior Terrain Rendering + Mountain Blocking
**Gaps**: GAP-007
**Files to modify**:
- `src/components/GameWorld.tsx` — feed MapSystem terrain to FeatureTileRenderer
- `src/game/GameGrid.ts` — terrain passability check
- `src/input/CanvasGestureManager.ts` — reject placement on impassable terrain

**TDD Steps**:
1. Write test: MapSystem forest cells generate forest TerrainFeatures
2. Write test: mountain cells block building placement
3. Write test: river cells block building placement
4. Write test: combined features = border + interior
5. Implement: feature merging, passability check, UI red highlight
6. Verify: `pnpm test`, `pnpm typecheck`

**Acceptance**: Forests/mountains visible inside map. Mountains block placement.

---

### Iteration 13: Auto Dirt Paths (Emergent Roads)
**Gap**: GAP-008
**Files to modify**:
- New `src/game/map/PathSystem.ts` — compute paths between buildings
- `src/components/GameWorld.tsx` — trigger recalculation on building placement

**TDD Steps**:
1. Write test: two buildings produce path cells between them
2. Write test: path avoids impassable terrain
3. Write test: removing building recalculates paths
4. Write test: path cells have type 'road' in MapSystem
5. Write test: high-traffic paths upgrade appearance by era
6. Implement: BFS/A* pathfinding, integrate with GroundTileRenderer
7. Verify: `pnpm test`, `pnpm typecheck`

**Acceptance**: Dirt paths appear automatically between buildings. Emergent, not drawn.

---

### Iteration 14: Seasonal Ground + 5-Year Plan Mandates
**Gaps**: GAP-009, GAP-011
**Files to modify**:
- `src/rendering/GroundTileRenderer.ts` — verify season propagation
- `src/game/SimulationEngine.ts` — mandate generation per era
- `src/components/ui/FiveYearPlanModal.tsx` — display mandates

**TDD Steps**:
1. Write test: setSeason triggers ground tile cache rebuild
2. Write test: season propagated from ChronologySystem → renderer
3. Write test: plan includes mandatedBuildings array by era
4. Write test: placing mandated building increments fulfillment
5. Implement: verify season chain, add mandate generation + tracking
6. Verify: `pnpm test`, `pnpm typecheck`

**Acceptance**: Ground changes per season. 5-Year Plan shows building mandates.

---

### Iteration 15: Universal Radial Context Menu — Refactor
**Gap**: GAP-010 (part 1)
**Files to modify**:
- Rename `src/components/ui/RadialBuildMenu.tsx` → `src/components/ui/RadialContextMenu.tsx`
- `src/input/CanvasGestureManager.ts` — context detection (empty tile / building / housing)

**TDD Steps**:
1. Write test: tap empty tile → opens BUILD mode radial
2. Write test: tap existing building → opens INSPECT mode radial
3. Write test: tap housing building → opens HOUSEHOLD mode radial
4. Write test: radial data driven by context type
5. Implement: refactor RadialBuildMenu to accept context param, detect tap target
6. Verify: `pnpm test`, `pnpm typecheck`

**Acceptance**: Same radial menu, different content based on what's tapped.

---

### Iteration 16: Building Inspect Mode + Citizen Dossier
**Gap**: GAP-010 (part 2), GAP-012
**Files to modify**:
- `src/components/ui/RadialContextMenu.tsx` — INSPECT mode wedges
- New `src/components/ui/CitizenDossier.tsx` — full-screen personnel file
- Replace/remove `BuildingInspector.tsx` and `WorkerInfoPanel.tsx`

**TDD Steps**:
1. Write test: building inspect shows Info/Workers/Production/Demolish wedges
2. Write test: workers wedge shows assigned workers list
3. Write test: citizen dossier renders full stats from ECS + subsystems
4. Write test: commissar comments generated from dialogue pools
5. Write test: dossier pauses game when open
6. Implement: inspect mode, dossier modal, dialogue-driven comments
7. Verify: `pnpm test`, `pnpm typecheck`

**Acceptance**: Tap building → see everything about it. Tap person → full dossier.

---

### Iteration 17: Population Registry
**Gap**: GAP-010b
**Files to modify**:
- New `src/components/ui/PopulationRegistry.tsx` — full-screen from DrawerPanel
- `src/components/ui/DrawerPanel.tsx` — add "Population Registry" button

**TDD Steps**:
1. Write test: registry lists all citizens with name/age/gender/class/assignment
2. Write test: filter tabs (All/Men/Women/Children/Elders) produce correct subsets
3. Write test: sort by name/age/dvor/assignment/morale works
4. Write test: search by name filters correctly
5. Write test: tap row opens CitizenDossier
6. Implement: PopulationRegistry component, wire to DrawerPanel
7. Verify: `pnpm test`, `pnpm typecheck`

**Acceptance**: Full population browser accessible from hamburger menu.

---

### Iteration 18: Wire PravdaTicker + Notification History
**Gaps**: GAP-021, GAP-015
**Files to modify**:
- `app/App.tsx` — wire PravdaTicker into layout
- `src/prototypes/SovietToastStack.tsx` — persist dismissed toasts
- New notification history panel

**TDD Steps**:
1. Write test: PravdaTicker renders headlines from PravdaSystem
2. Write test: dismissed toast persisted to history (max 100)
3. Write test: history panel renders with timestamps and category filter
4. Implement: wire PravdaTicker, toast history, history panel
5. Remove dead imports (IntroModal, TopBar, Toolbar)
6. Verify: `pnpm test`, `pnpm typecheck`

**Acceptance**: Pravda scrolls, toast history accessible.

---

### Iteration 19: Weather Gameplay Effects
**Gap**: GAP-026
**Files to modify**:
- `src/game/SimulationEngine.ts` — weather modifiers on production/construction
- `src/ecs/systems/productionSystem.ts` — accept weather modifier

**TDD Steps**:
1. Write test: blizzard → -40% outdoor production, +25% heating
2. Write test: drought → -60% farm output
3. Write test: rasputitsa → +50% construction time, -20% movement
4. Implement: weather modifier injection into affected systems
5. Verify: `pnpm test`, `pnpm typecheck`

**Acceptance**: Weather affects gameplay, not just visuals.

---

### Iteration 20: Pripiski + Heating + Currency Reform Verification
**Gaps**: GAP-013, GAP-017, GAP-018
**Files to verify/fix**:
- `src/game/SimulationEngine.ts` — pripiski → quota adjustment
- `src/game/economy/EconomySystem.ts` — heating fuel, currency reform
- `src/game/PersonnelFile.ts` — pripiski history

**TDD Steps**:
1. Write test: inflated pripiski → next quota +20%, inspection +15%
2. Write test: winter tick consumes heating fuel; no fuel → penalties
3. Write test: currency reform → 90% money reduction at era transition
4. Verify/fix existing implementations
5. Verify: `pnpm test`, `pnpm typecheck`

**Acceptance**: Economy subsystems have real gameplay impact.

---

### Iteration 21: Orgnabor + Conscription + Political Entity Interaction
**Gaps**: GAP-019, GAP-020, GAP-025
**Files to verify/fix**:
- `src/game/workers/WorkerSystem.ts` — drain mechanics
- `src/game/political/PoliticalEntitySystem.ts` — entity interaction

**TDD Steps**:
1. Write test: orgnabor removes N workers for M ticks, returns them
2. Write test: conscription removes workers permanently; men only
3. Write test: tap political entity → dialogue from correct NPC pool
4. Write test: interaction choices (bribe/comply/resist) have consequences
5. Verify/fix, implement tap handler for political entities
6. Verify: `pnpm test`, `pnpm typecheck`

**Acceptance**: Worker drains functional. Political entities interactive.

---

### Iteration 22: Event Era Filtering + Difficulty Wiring
**Gaps**: GAP-027, GAP-023
**Files to verify**:
- `src/game/events/` — era conditions on all templates
- `src/game/SimulationEngine.ts` — all 10 difficulty multipliers

**TDD Steps**:
1. Write test: era-specific events don't fire outside their era
2. Write test: each difficulty multiplier affects correct system
3. Write test: consequence level affects post-arrest behavior
4. Audit and fix gaps
5. Verify: `pnpm test`, `pnpm typecheck`

**Acceptance**: Events respect era. Difficulty settings all have impact.

---

### Iteration 23: Minigame Triggers + Map Size Verification
**Gaps**: GAP-024, GAP-028
**Files to verify**:
- `src/game/minigames/MinigameRouter.ts` — all 8 trigger conditions
- `src/components/GameWorld.tsx` — map size from NewGameFlow

**TDD Steps**:
1. Write test: each minigame triggers correctly
2. Write test: auto-resolve produces worse outcome
3. Write test: MapSystem accepts 20/30/50 sizes
4. Write test: camera bounds adjust to map size
5. Verify/fix implementations
6. Verify: `pnpm test`, `pnpm typecheck`

**Acceptance**: All minigames triggerable. All map sizes work.

---

### Iteration 24: Save/Load Completeness
**Gap**: GAP-022
**Files to verify/fix**:
- `src/game/SaveSystem.ts` — serialize dvor system + new components
- `src/components/ui/DrawerPanel.tsx` — save/load flow
- Autosave integration

**TDD Steps**:
1. Write test: dvor data roundtrips through serialize→deserialize
2. Write test: demographic state preserved in save
3. Write test: autosave triggers every N ticks
4. Write test: save download → file upload → state restored
5. Verify/fix
6. Verify: `pnpm test`, `pnpm typecheck`

**Acceptance**: Full game state including dvor system persists through save/load.

---

### Iteration 25: Minimap
**Gap**: GAP-016
**Files to create/modify**:
- New `src/components/ui/Minimap.tsx`
- `src/components/GameWorld.tsx` — integrate minimap

**TDD Steps**:
1. Write test: minimap renders building positions at scaled coordinates
2. Write test: minimap shows camera viewport rectangle
3. Write test: click minimap pans camera
4. Implement: Minimap React component over canvas
5. Verify: `pnpm test`, `pnpm typecheck`

**Acceptance**: Minimap shows overview with clickable navigation.

---

### Iteration 26: Settlement Tier Visual Progression
**Gap**: GAP-014
**Files to modify**:
- `src/rendering/Canvas2DRenderer.ts` — sprite variant by tier/era
- Sprite manifest: `{defId}_{tier}.png` naming convention

**TDD Steps**:
1. Write test: sprite selection includes tier suffix when variant exists
2. Write test: tier-up triggers visual refresh
3. Implement: variant sprite selection, fallback to base sprite
4. Verify: `pnpm test`, `pnpm typecheck`

**Acceptance**: Buildings look different at higher settlement tiers.

---

### Iteration 27: HUD Population Display + Dvor Integration
**Gap**: GAP-003 (UI)
**Files to modify**:
- `src/components/ui/SovietHUD.tsx` — show "10 Dvory (55 people: 28 workers, ...)"
- `src/stores/gameStore.ts` — expose dvor summary data

**TDD Steps**:
1. Write test: HUD shows dvor count and member breakdown
2. Write test: breakdown updates when population changes
3. Implement: dvor summary in snapshot, HUD display
4. Verify: `pnpm test`, `pnpm typecheck`

**Acceptance**: HUD shows household-based population display.

---

### Iteration 28: Playwright E2E — Full Game Flow
**Files to create**:
- `e2e/full-game-flow.spec.ts`

**E2E Test Sequence**:
1. Landing page → New Game → difficulty/map/era selection
2. Assignment letter with generated name
3. Game starts with ~55 people in 10 dvory visible
4. Krupnik tutorial fires first message
5. Build menu shows only Era 1 buildings
6. Place Kolkhoz HQ → see foundation, not instant
7. Workers autonomously self-assign to construction
8. Construction progresses, materials consumed
9. Building completes → workers redistribute
10. Dirt paths appear between buildings
11. Seasons change ground tiles
12. Pravda ticker shows headlines
13. Tap building → radial inspect menu
14. Tap housing → household breakdown
15. Annual report → pripiski choice
16. Save game → download → reload → load → state preserved

**Acceptance**: Full E2E flow passes.

---

### Iteration 29: Dead Code Cleanup + Final Polish
**Tasks**:
1. Remove orphaned components (IntroModal, TopBar, Toolbar)
2. Remove unused imports across all files
3. `pnpm lint:fix` — zero errors
4. Consolidate BuildingInspector/WorkerInfoPanel into RadialContextMenu+CitizenDossier
5. Verify all design doc references are consistent

---

### Iteration 30: Final Build Verification
**Tasks**:
1. `pnpm typecheck` — clean
2. `pnpm test` — all pass (target: 2100+)
3. `pnpm build` — production build succeeds
4. `pnpm lint` — zero errors
5. Visual playtest in browser
6. Update agentic-memory-bank with final state

---

## Completion Promise

The Ralph loop is complete when ALL of the following are TRUE:
1. All 28 PRD gaps addressed (implemented or verified working)
2. `pnpm typecheck` passes with zero errors
3. `pnpm test` passes with zero failures (2100+ tests)
4. `pnpm build` produces successful production build
5. Core loop works: start game → 10 dvory/55 people → autonomous self-assignment → era-gated build menu → construction phases with materials → production → quota → births/deaths/aging → era transition
6. Universal radial context menu works for empty tiles, buildings, and housing
7. Population registry accessible from DrawerPanel

---

## Dependency Graph (Iterations 8-30)

```
Iter 8 (Construction Materials) ──────────────────────┐
Iter 9 (Dvor Schema) ──┬── Iter 10 (Demographic Tick) │
                        ├── Iter 27 (HUD Display)      │
                        └── Iter 24 (Save/Load)        │
Iter 11 (Behavioral Governor) ─────────────────────────┤
Iter 12 (Interior Terrain) ──┬── Iter 13 (Dirt Paths)  ├── Iter 28 (E2E)
                              └── Iter 14 (Seasons)     │
Iter 15 (Radial Refactor) ──┬── Iter 16 (Inspect Mode) │
                              └── Iter 17 (Pop Registry)│
Iter 18-23 (Subsystem verification — independent) ─────┘
Iter 29 (Cleanup) ──── Iter 30 (Final Build)
```

Critical paths:
- Iters 9→10→27 (dvor system pipeline)
- Iters 15→16→17 (radial menu pipeline)
- Iters 12→13 (terrain pipeline)
- All else is independent
