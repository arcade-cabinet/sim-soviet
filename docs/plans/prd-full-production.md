# PRD: SimSoviet 1917 — Full Production Gap Closure

> **Date**: 2026-02-10
> **Status**: Draft
> **Scope**: Every gap between the 9 GDD design docs and current implementation
> **Methodology**: TDD — every feature gets Vitest unit tests + Playwright E2E validation

---

## 1. Executive Summary

SimSoviet 1917 has ~48 systems implemented and passing 1863+ unit tests. However, a thorough playtest + code audit against all 10 design documents (including the new `demographics.md`) reveals **critical integration gaps** that break the core gameplay loop. Buildings appear instantly without cost, all buildings are available in Era 1, the tutorial system exists but is never called, terrain features only render on the border ring, and **population is modeled as atomic citizens rather than the historically accurate dvor (household) system** that underpins every aspect of Soviet kolkhoz administration.

This PRD catalogs **every** gap — from game-breaking core loop failures to minor UI polish — organized by priority and dependency order. Nothing is omitted.

> **Update 2026-02-10**: Construction phases (GAP-001) partially implemented (iterations 6-7). New `demographics.md` design document added. GAP-003 expanded from "12 starting citizens" to full dvor/household demographic system with gender, age, family structure, and era-driven dynamics.

---

## 2. Audit Methodology

**Sources audited:**
1. `docs/design/overview.md` — Game identity, settlement tiers, core loop
2. `docs/design/eras.md` — 8 eras, transitions, building unlocks
3. `docs/design/map-terrain.md` — Terrain generation, rivers, seasonal rendering
4. `docs/design/economy.md` — 5 currencies, construction system, production chains
5. `docs/design/workers.md` — Worker lifecycle, stats, assignment, housing
6. `docs/design/political.md` — Personnel file, black marks, apparatus arms
7. `docs/design/minigames.md` — 8 minigames, trigger system, auto-resolve
8. `docs/design/scoring.md` — Score sources, difficulties, medals
9. `docs/design/ui-ux.md` — All UI components, layout, interactions
10. `docs/design/demographics.md` — **NEW** Dvor (household) system, family structure, gender roles, birth/death, trudodni categories

**Code audited:**
- SimulationEngine.ts (22 ticked systems, 14 callbacks)
- All 16 active UI components + 5 orphaned
- All rendering systems (Canvas2DRenderer, GroundTileRenderer, FeatureTileRenderer)
- ECS factories, archetypes, all system files
- All subsystem packages (economy/, era/, workers/, political/, minigames/, events/, pravda/, politburo/)

---

## 3. Gap Inventory

### 3.1 CRITICAL — Core Loop Broken

These gaps mean the game fundamentally doesn't play as designed.

#### GAP-001: Construction Phases ~~Missing~~ PARTIALLY COMPLETE
**GDD says** (economy.md §Construction): Buildings are NOT purchased. They are mandated by the 5-Year Plan, placed by the player, then built over time requiring labor + materials (timber, steel, cement, prefab) + ticks. Construction flow: Plan mandates → Player places foundation → Workers assigned + materials consumed over `baseTicks × constructionTimeMult` → Building complete.

**DONE** (iterations 6-7):
- ✅ `ConstructionPhase` type ('foundation' | 'building' | 'complete') added to `BuildingComponent`
- ✅ `constructionProgress`, `constructionTicks` fields on `BuildingComponent`
- ✅ `placeNewBuilding()` factory starts buildings at 'foundation' phase
- ✅ `constructionSystem.ts` ticks progress using integer counter (avoids float accumulation)
- ✅ Phase transitions at 50% (foundation→building) and 100% (building→complete)
- ✅ `operationalBuildings` / `underConstruction` archetypes
- ✅ `producers` and `housing` archetypes only match operational buildings
- ✅ `CanvasGestureManager` uses `placeNewBuilding()` not `createBuilding()`
- ✅ Wired into SimulationEngine tick order (after power, before production)
- ✅ 32 tests covering phases, transitions, multiple buildings

**REMAINING**:
- Material deduction from resources per construction tick (timber, steel, cement)
- `EraSystem.getConstructionTimeMult()` consumed by constructionSystem
- Worker assignment affecting construction speed
- UI: construction progress bar rendered on building sprite
- UI: construction phase indicator (scaffolding overlay)

**Tests remaining**:
- Unit: material deduction per construction tick
- Unit: era construction time multiplier applied
- E2E: place building, see progress bar, wait for completion

#### GAP-002: Era-Gated Building Menu
**GDD says** (eras.md §Building Unlocks): Era 1 (Revolution) has ONLY: Kolkhoz HQ, wooden barracks, watchtower, well, granary. Each subsequent era unlocks additional buildings. Settlement tier further gates availability.

**Current state**: `RadialBuildMenu.tsx:278-287` calls `getBuildingsByRole(role)` which returns ALL buildings regardless of era. `EraSystem.getAvailableBuildings(tier?)` exists and works correctly but is never called by the UI.

**What to build**:
- Wire `RadialBuildMenu` to filter building list through `EraSystem.getAvailableBuildings(currentTier)`
- Show locked buildings grayed out with era/tier unlock requirement tooltip
- `getBuildingsByRole()` should accept an era filter parameter or the menu should post-filter

**Tests**:
- Unit: `getAvailableBuildings()` returns only era-appropriate buildings (already tested)
- E2E: start new game in Era 1, verify only 5 buildings visible in build menu

#### GAP-003: Starting Population → Dvor (Household) System
**GDD says** (demographics.md §Starting Settlement, overview.md §Settlement Tiers): Game begins with ~10 dvory (~55 people) as a newly formed artel. Population is tracked at the **dvor (household)** level, not as atomic citizens. Each dvor contains family members: head, spouse, children, elders — each with gender, age, labor capacity, and role. A political officer (chairman/predsedatel) is assigned by the raion. Workers self-organize autonomously via the behavioral governor priority stack (overview.md § Autonomous Collective System) — the player manages priorities and politics, not individual assignments.

**Current state**: `SimulationEngine` starts with 0 population. `CitizenComponent` tracks only class/happiness/hunger — no gender, age, family, or household affiliation. Population is a raw number, not a collection of households.

**What to build**:
- **DvorComponent**: New ECS component — household ID, members array, head of household, private plot size, private livestock, loyalty
- **DvorMember**: Sub-entity — ID, name, gender, age, role (head/spouse/worker/elder/adolescent/child/infant), labor capacity, trudodni earned, health, pregnancy status
- **Extend CitizenComponent**: Add `dvorId`, `gender`, `age`, `memberRole` fields
- **Starting composition** (difficulty-scaled):
  - Worker (easy): 12 dvory, ~65 people + sympathetic chairman
  - Comrade (normal): 10 dvory, ~55 people + neutral chairman
  - Tovarish (hard): 7 dvory, ~40 people + hostile chairman
- **Demographic tick system**: Births (15% base/year per eligible woman), deaths (age curve + starvation + disease), aging (children → adolescent → worker → elder), household formation (unrelated adults may form new dvor)
- **Gender-aware labor**: Women assigned to lower trudodni categories by default; military conscription targets men only; working mothers -30% labor capacity unless elder available
- **Era-driven gender dynamics**: Era 3 (Great Patriotic) conscription strips nearly all male workers — gameplay forces reliance on female labor
- **Population display**: "10 Dvory (55 people: 28 workers, 6 adolescents, 12 children, 9 elders)"
- **Dvor info panel**: Tap household in housing building's radial menu → see all members, private plot, trudodni earned

**Tests**:
- Unit: after engine init, world has 10 dvor entities with ~55 total members
- Unit: difficulty multiplier applied to starting dvor count
- Unit: birth mechanics produce infant in mother's dvor
- Unit: aging transitions child → adolescent → worker → elder at correct ages
- Unit: conscription event removes male workers only
- Unit: labor capacity follows age/gender curves
- E2E: new game shows household-based population display in HUD

#### GAP-004: TutorialSystem Not Wired
**GDD says** (ui-ux.md §Tutorial, overview.md §First Game): Era 1 IS the tutorial. Comrade Krupnik guides progressive disclosure: place Kolkhoz HQ → assign workers → first harvest → survive first winter → meet first quota. 14 milestones defined.

**Current state**: `TutorialSystem.ts` exists with 14 milestones, Krupnik personality, and full test coverage. **ZERO imports** in SimulationEngine, GameWorld, or any UI component. The Advisor component shows "Comrade Vanya" not "Comrade Krupnik".

**What to build**:
- Import TutorialSystem into SimulationEngine, tick it each cycle
- TutorialSystem.checkMilestones() → fires advisor callbacks via SimCallbacks.onAdvisor
- Rename Advisor display from "Comrade Vanya" to "Comrade Krupnik"
- Progressive UI disclosure: RadialBuildMenu starts showing only HQ, reveals categories as milestones hit
- Tutorial milestones gate building categories (not just era gating)

**Tests**:
- Unit: TutorialSystem fires correct milestone after placing first building
- Unit: advisor callback received with Krupnik dialogue
- E2E: new game shows Krupnik greeting, then guides through first placement

#### GAP-005: AchievementTracker Not Wired
**GDD says** (scoring.md §Achievements): 28+ achievements tracked throughout gameplay. Some displayed in medals at era end.

**Current state**: `AchievementTracker.ts` exists with 28+ achievements and tests. Only imported in its own test and `GameTally.test.ts`. Never ticked by SimulationEngine.

**What to build**:
- Import AchievementTracker into SimulationEngine
- Call `tracker.check(gameView)` each tick (or at strategic intervals)
- Wire achievement unlock to toast notifications
- Show achievements in GameOverModal and end-of-era summary

**Tests**:
- Unit: achievement unlocks after condition met
- Unit: toast callback fired on unlock
- E2E: accomplish something achievement-worthy, see toast

#### GAP-006: GameTally Not Wired
**GDD says** (scoring.md §End Game): Civilization-style end-game summary with score breakdown, medals, achievements, graphs.

**Current state**: `GameTally.ts` exists with tests. Only imported in its own test. GameOverModal exists but doesn't show tally data.

**What to build**:
- Import GameTally into SimulationEngine
- Call `tally.recordTick(gameView)` each tick to accumulate stats
- On game over: generate final tally, pass to GameOverModal
- GameOverModal renders score breakdown, medals, achievements, and graphs

**Tests**:
- Unit: tally accumulates stats correctly over N ticks
- E2E: trigger game over, see tally screen with score

---

### 3.2 HIGH — Gameplay Systems Missing or Broken

#### GAP-007: Interior Terrain Not Rendered
**GDD says** (map-terrain.md §Terrain Distribution): Mountains 10-15% of map, forests 15-20%, marshland 5-10%. These cover the ENTIRE map interior, not just borders.

**Current state**: `MapSystem` generates rivers/forests/mountains across the entire grid. `TerrainGenerator` generates border-only decorations. GameWorld uses BOTH. But MapSystem's interior terrain types are only rendered as flat base tiles (grass/dirt/stone/water via GroundTileRenderer). No 3D feature sprites appear for interior forests/mountains/marshland.

**What to build**:
- Connect MapSystem terrain data to FeatureTileRenderer
- For each MapSystem cell with type 'forest', 'mountain', 'marsh' — generate corresponding TerrainFeature entries
- Feed these features into FeatureTileRenderer.setFeatures() alongside TerrainGenerator's border features
- Mountains should block building placement (impassable)
- Forests clearable for timber (new interaction)

**Tests**:
- Unit: MapSystem with forest cells generates forest TerrainFeatures
- Unit: mountain cells block building placement
- E2E: new game shows forests and mountains INSIDE the map, not just at borders

#### GAP-008: Auto Dirt Paths
**GDD says** (map-terrain.md §Roads): Dirt paths automatically appear between buildings. No explicit road building in early eras. Later eras upgrade to paved roads.

**Current state**: Path sprites exist in sprite folders. MapSystem has 'road' terrain type. No system generates paths between buildings.

**What to build**:
- New `PathSystem` or extension to MapSystem
- After building placement: compute shortest paths between buildings using adjacent cells
- Set those cells to 'road' type in MapSystem
- GroundTileRenderer already maps 'road' → 'dirt' sprite — this should Just Work
- Recalculate paths when buildings added/removed

**Tests**:
- Unit: placing two buildings generates road cells between them
- Unit: removing a building recalculates paths
- E2E: place two buildings, see dirt path connecting them

#### GAP-009: Seasonal Ground Appearance
**GDD says** (map-terrain.md §Seasonal Rendering): Winter = snow-covered ground. Rasputitsa (spring/fall) = muddy ground. Summer = green grass. The base ground tiles should change with season.

**Current state**: GroundTileRenderer has `setSeason()` and loads from `sprites/soviet/tiles/{season}/` folders. Three folders exist: winter/, summer/, mud/. The system WORKS but the season must be propagated correctly. Currently the grass tiles in Era 1 look like modern pavement regardless of season.

**What to build**:
- Verify season propagation from ChronologySystem → GroundTileRenderer.setSeason()
- Ensure the sprite files in winter/summer/mud/ folders look era-appropriate (not modern pavement)
- Era 1 winter: frozen tundra. Era 1 summer: rough grassland. NOT paved surfaces.
- May need new sprite variants or sprite tinting per era

**Tests**:
- Unit: setSeason('winter') loads winter sprite set
- E2E: advance through seasons, verify ground texture changes visually

#### GAP-010: Universal Radial Context Menu + Building Interiors
**GDD says** (ui-ux.md §Universal Radial Context Menu): The radial pie menu is the primary interaction for ALL game entities. Same visual language (inner ring → outer ring), different content based on context. Buildings are not faceless props — every building tells a story.

**Current state**: `RadialBuildMenu` only handles empty tile → build category → building selection. `BuildingInspector` is a bare-bones card (name, position, powered, cost). `WorkerInfoPanel` shows one worker at a time with assign/dismiss. These three components are separate, inconsistent, and disconnected.

**What to build**:
- **Refactor `RadialBuildMenu` → `RadialContextMenu`**: Same SVG component, data-driven by tap context (empty tile vs existing building vs housing)
- **Building inspect mode**: Tap building → radial shows action categories (Info, Workers, Production, Occupants, Demolish) as inner ring wedges, with sub-actions/details in outer ring
- **Housing inspect mode**: Inner ring shows demographic categories (Men, Women, Children, Elders) with counts. Outer ring shows individual occupants. Tap person → Citizen Dossier.
- **Citizen Dossier modal**: Full-screen, pauses game. Shows: name, age, gender, role, dvor affiliation, household members, assignment, trudodni, morale/loyalty/skill/health, political record (black marks, commissar notes, KGB file, draft status). Actions: Reassign, View Family.
- **Worker assignment from building**: Building's "Workers" ring shows assigned workers + "+Assign Worker" wedge. Eliminates separate assignment mode.
- **Replace `BuildingInspector`**: Info moves into radial's "Info" wedge
- **Replace `WorkerInfoPanel`**: Worker info moves into Citizen Dossier modal
- **Commissar/KGB comments**: Procedurally generated from dialogue pools based on citizen stats

**Tests**:
- Unit: radial context detection (empty tile → build mode, building → inspect mode, housing → household mode)
- Unit: building action categories vary by building type
- Unit: citizen dossier data assembled correctly from ECS + subsystems
- Unit: worker assignment via building radial updates entity components
- E2E: tap building → see action categories → drill into workers → see assigned workers
- E2E: tap housing → see demographic breakdown → tap individual → dossier modal pauses game

#### GAP-010b: Population Registry (Hamburger Menu)
**GDD says** (ui-ux.md §Population Browser): Full-screen population list accessible from DrawerPanel. Filterable by gender/age, sortable, searchable. Bulk actions for assignment.

**Current state**: No population browser exists. No way to see all citizens at once, filter, search, or bulk-assign.

**What to build**:
- **PopulationRegistry component**: Full-screen overlay from DrawerPanel, pauses game
- **Filter tabs**: All, Men, Women, Children, Elders (with counts)
- **Sort**: By name, age, dvor, assignment, morale, trudodni
- **Search**: Filter by name substring
- **Individual rows**: Name, age, gender, class color, assignment, morale bar. Tap → Citizen Dossier.
- **Bulk actions**: "Assign All Idle → [Building]", "Auto-assign" (uses WorkerSystem AI)
- **Statistics header**: Total pop, dvory count, workers, idle, average morale

**Tests**:
- Unit: filter tabs produce correct subsets
- Unit: sort orders work correctly
- Unit: bulk assign updates all idle worker entities
- E2E: open registry, filter by women, sort by age, tap individual → dossier

#### GAP-011: 5-Year Plan Construction Mandates
**GDD says** (economy.md §Five-Year Plan): The 5-Year Plan doesn't just set quotas — it MANDATES which buildings to construct. Player can place mandated buildings (free from plan) but must also meet quota targets. The plan arrives at start of each 5-year cycle.

**Current state**: `FiveYearPlanModal` exists and shows quota targets. No construction mandate system. Buildings are placed freely by player choice.

**What to build**:
- Extend 5-Year Plan data structure with `mandatedBuildings: { defId: string, count: number }[]`
- EraSystem or new PlanSystem generates mandates based on era + difficulty
- FiveYearPlanModal shows both quotas AND construction mandates
- Track mandate fulfillment (buildings placed vs. mandated)
- Mandate completion affects scoring and political standing

**Tests**:
- Unit: plan generation includes building mandates for the era
- Unit: mandate tracking increments when matching building placed
- E2E: see construction mandates in 5-Year Plan modal

#### GAP-012: Building Inspector Completeness
**GDD says** (ui-ux.md §Building Inspector): Shows building name, production rate, worker count, storage levels, efficiency %, assigned workers list, upgrade options.

**Current state**: `BuildingInspector` exists but is missing: assigned workers list, production rate per tick, efficiency percentage, upgrade options.

**What to build**:
- Show list of assigned workers (name, class, morale indicator)
- Show production rate (output/tick) and efficiency (% of max)
- Show construction progress if building is under construction
- Show storage utilization if building has storage
- Upgrade button (era-gated)

**Tests**:
- Unit: inspector data includes worker list and production stats
- E2E: tap building, see all inspector fields populated

---

### 3.3 MEDIUM — Missing Subsystem Features

#### GAP-013: Pripiski (Report Falsification) in Annual Report
**GDD says** (political.md §Pripiski): Annual report allows player to report honestly, inflate, or deflate numbers. Inflating increases quota next year + risk of inspection. Deflating lowers quota but wastes real surplus.

**Current state**: `AnnualReportModal` exists with pripiski choice (honest/inflate/deflate). The choice is sent to `PersonnelFile` via callback. But the downstream effects (quota adjustment, inspection risk) need verification.

**What to build** (verify and wire):
- Inflated report → next quota +20%, inspection probability +15%
- Deflated report → next quota -10%, surplus wasted
- Honest report → neutral
- PersonnelFile records pripiski history
- KGB inspection event checks pripiski history

**Tests**:
- Unit: inflated pripiski increases next quota target
- Unit: pripiski history stored in PersonnelFile
- E2E: choose pripiski in annual report, see quota change next year

#### GAP-014: Settlement Tier Visual Progression
**GDD says** (overview.md §Visual Progression): Selo = wooden structures, dirt paths. Posyolok = mix of wood and basic concrete. PGT = concrete standardized buildings. Gorod = prefab panel construction.

**Current state**: `SettlementSystem` exists and tracks tiers. `SettlementUpgradeModal` fires on tier-up. But building sprites don't change per tier — all buildings use the same sprite regardless of settlement level.

**What to build**:
- Building sprite variants per settlement tier (or era, since they correlate)
- Sprite manifest supports `{defId}_{tier}.png` naming
- Canvas2DRenderer selects sprite variant based on current tier
- Tier-up triggers visual refresh of all existing buildings

**Tests**:
- Unit: sprite selection includes tier suffix
- E2E: upgrade settlement tier, see building sprites change

#### GAP-015: Notification History Log
**GDD says** (ui-ux.md §Notifications): Toast notifications should have a scrollable history log accessible from the HUD.

**Current state**: `SovietToastStack` shows toasts that auto-dismiss. No history. Once dismissed, information is lost.

**What to build**:
- Persist dismissed toasts to a notification log array (max 50-100)
- Add "History" button to HUD or DrawerPanel
- Notification log panel with scrollable list, timestamps, categories
- Filter by category (event, tutorial, achievement, system)

**Tests**:
- Unit: dismissed toast added to history
- E2E: dismiss several toasts, open history, see all of them

#### GAP-016: Minimap
**GDD says** (ui-ux.md §Minimap): Small overview map in corner showing building positions, terrain, and camera viewport rectangle.

**Current state**: Referenced in design docs but no implementation exists. Placeholder may exist in code.

**What to build**:
- New `Minimap` React component overlaid on canvas corner
- Renders scaled-down version of terrain + building positions
- Shows camera viewport as a rectangle
- Click/drag on minimap to pan camera

**Tests**:
- Unit: minimap renders building positions at correct scaled coordinates
- E2E: minimap visible, click on it moves camera

#### GAP-017: Heating System Gameplay
**GDD says** (economy.md §Heating): Pechka (timber) in early eras → district heating (coal/power) in later eras. Buildings without heating in winter: worker morale -30%, production -50%, health decline. Heating fuel consumed per tick in winter.

**Current state**: `EconomySystem.ts` has heating logic (L346-425) that calculates heating costs and effects. Needs verification that it's actually consuming fuel and applying morale/production penalties.

**What to build** (verify and complete):
- Winter tick: each building checks for heating fuel availability
- No fuel → morale penalty, production penalty, health decline
- Fuel type depends on era (timber early, coal/power later)
- UI indicator on buildings showing heating status

**Tests**:
- Unit: winter tick without fuel applies penalties
- Unit: heating fuel consumed per building per winter tick
- E2E: enter winter without fuel, see production drop

#### GAP-018: Currency Reform Events
**GDD says** (economy.md §Currency Reforms): Systematic currency reforms at era boundaries. 10:1 denomination wipes savings. Player can hide rubles in blat network (risky).

**Current state**: EconomySystem has currency reform logic (L427-448). EventSystem may have currency reform events. Needs verification of the full flow.

**What to build** (verify and complete):
- Era transition triggers currency reform check
- Reform announcement → player choice: accept loss or attempt blat-based savings
- Blat risk: success preserves some wealth, failure = black mark + full loss
- Toast/advisor notification explaining what happened

**Tests**:
- Unit: currency reform reduces money by 90%
- Unit: blat saving attempt with success/failure outcomes
- E2E: era transition with currency reform, see money change

#### GAP-019: Orgnabor (Worker Borrowing)
**GDD says** (workers.md §Drains): State temporarily borrows workers for N ticks. Workers removed from buildings, returned after period. Refusal = black mark.

**Current state**: WorkerSystem exists with drain/replace mechanics. Orgnabor mentioned in design docs but implementation status unclear.

**What to build**:
- Orgnabor event: state demands N workers for M ticks
- Player can comply (lose workers temporarily) or refuse (black mark)
- Borrowed workers removed from assignments, returned after M ticks
- Event notification with choice UI

**Tests**:
- Unit: orgnabor removes N workers, returns them after M ticks
- Unit: refusal adds black mark
- E2E: orgnabor event fires, choose comply, workers return later

#### GAP-020: Conscription (Military Drain)
**GDD says** (workers.md §Drains, political.md §Military): Military drafts workers permanently. Especially during Great Patriotic era. Military buildings act as constant worker drain.

**Current state**: PoliticalEntitySystem has military entities. Conscription events may exist. Needs verification.

**What to build** (verify and complete):
- Conscription event: military demands N workers permanently
- During Great Patriotic era: higher frequency, larger drafts
- Military buildings on map consume workers over time
- Player choice: comply or resist (severe consequences)

**Tests**:
- Unit: conscription removes workers permanently
- Unit: Great Patriotic era has increased conscription frequency
- E2E: conscription event, lose workers

---

### 3.4 LOWER — Polish & Completeness

#### GAP-021: Orphaned UI Components
**Current state**: 5 components imported but never rendered or unreachable:
- `IntroModal` — replaced by `AssignmentLetter` but still imported
- `TopBar` — orphaned, replaced by `SovietHUD`
- `Toolbar` — orphaned, replaced by `BottomStrip`
- `PravdaTicker` — exists but not in App.tsx render tree
- `QuotaHUD` — exists but not in App.tsx render tree

**What to build**:
- Remove dead imports and components
- Wire PravdaTicker into main layout (it should show Pravda headlines)
- Wire QuotaHUD or merge its data into SovietHUD

**Tests**:
- Build succeeds with no dead code warnings
- E2E: PravdaTicker visible and showing headlines

#### GAP-022: Save/Load UI Completeness
**GDD says** (ui-ux.md §Save/Load): Save game to file, load from file, continue latest autosave.

**Current state**: SaveSystem exists with serialization for all subsystems. DrawerPanel has save/load UI. LandingPage has Continue button. sql.js WASM backend pending.

**What to build** (verify and complete):
- "Save Game" in DrawerPanel → downloads .json save file
- "Load Game" → file picker → imports save → restores full state
- "Continue" on LandingPage → loads latest autosave from localStorage/IndexedDB
- Autosave triggers every N ticks

**Tests**:
- Unit: serialize → deserialize roundtrip preserves all subsystem state
- E2E: save game, reload page, load file, verify state restored

#### GAP-023: Difficulty & Consequence Levels
**GDD says** (scoring.md §Difficulty): 3 difficulty levels (Forgiving/Normal/Harsh) × 3 consequence levels (Lenient/Permadeath/Brutal). Affect starting resources, quota targets, event frequency, worker attrition.

**Current state**: `difficulty.ts` has starting resource calculator with 3 levels. NewGameFlow has difficulty selection. Consequence levels exist in types but may not be fully wired.

**What to build** (verify and complete):
- All 10 difficulty multipliers applied: quotas, resources, birth rate, decay, politruks, events, worker attrition, construction time, blat gain, stakhanovite chance
- Consequence levels: what happens after arrest (game over / continue with penalty / new assignment)
- Difficulty shown in save file and end-game tally

**Tests**:
- Unit: each difficulty multiplier affects the correct system
- E2E: start game on hard, verify fewer starting resources

#### GAP-024: Minigame Trigger Routing
**GDD says** (minigames.md §Triggers): 8 minigames triggered by tapping specific buildings or during specific events. Auto-resolve if player ignores.

**Current state**: `MinigameRouter` exists and is ticked by SimulationEngine. 8 minigames defined. Auto-resolve exists. `onMinigame` callback fires.

**What to build** (verify and complete):
- Verify each of 8 minigames has correct trigger conditions
- Building tap → check if minigame should fire
- Event-triggered minigames route correctly
- Auto-resolve timer (30 seconds) with worse outcome
- Minigame result affects gameplay (resources, morale, black marks)

**Tests**:
- Unit: each minigame triggers under correct conditions
- Unit: auto-resolve produces worse outcome than playing
- E2E: trigger a minigame, complete it, see result

#### GAP-025: Political Entity Interaction
**GDD says** (political.md §Apparatus Arms): Politruks (red), KGB (black), military (green) are visible entities on map. Tapping them shows dialogue and interaction options.

**Current state**: PoliticalEntitySystem creates entities. Canvas2DRenderer draws badges (12px shapes). Tap interaction status unclear.

**What to build** (verify and complete):
- Tap political entity badge → show entity info panel with dialogue
- Dialogue from appropriate NPC pool (politruk/KGB/military)
- Interaction options: bribe (blat), comply, resist
- Consequences of interaction choice

**Tests**:
- Unit: tapping political entity returns correct entity data
- E2E: tap political entity, see dialogue panel

#### GAP-026: Weather Effects on Gameplay
**GDD says** (map-terrain.md §Weather): Beyond seasonal rendering — weather events affect gameplay. Blizzards reduce worker output. Droughts reduce farm yields. Rasputitsa slows construction.

**Current state**: ParticleSystem2D renders snow/rain. SeasonChanged/WeatherChanged callbacks exist. Gameplay effects unclear.

**What to build** (verify and complete):
- Weather modifiers applied to production, construction, morale
- Blizzard: -40% outdoor production, +25% heating cost
- Drought: -60% farm output
- Rasputitsa: +50% construction time, -20% worker movement

**Tests**:
- Unit: blizzard weather applies production penalty
- Unit: drought reduces farm output
- E2E: weather event fires, see production changes

#### GAP-027: Event System Era Filtering
**GDD says** (eras.md §Era-Specific Events): Each era has era-specific events that only fire during that era. Cultural Revolution only in Thaw. Great Purge only in First Plans.

**Current state**: EventSystem has conditions including era checks via `createGameView()`. Needs verification that era filtering is comprehensive.

**What to build** (verify):
- Each event template has `eraFilter` or condition checking current era
- Era-specific events only fire during appropriate era
- Transition events fire at era boundaries

**Tests**:
- Unit: era-specific event doesn't fire outside its era
- Unit: transition event fires at boundary

#### GAP-028: Map Size Configuration
**GDD says** (map-terrain.md §Map Sizes): Three map sizes: Small (20×20), Medium (30×30), Large (50×50). Selected in NewGameFlow.

**Current state**: NewGameFlow has map size selection. MapSystem accepts size parameter. GRID_SIZE config exists.

**What to build** (verify and complete):
- NewGameFlow map size choice → passed to MapSystem initialization
- Camera bounds adjust to map size
- Terrain generation scales with map size
- Performance acceptable at 50×50

**Tests**:
- Unit: MapSystem initializes with correct size
- E2E: start game with each size, verify map dimensions

---

## 4. Non-Gaps (Already Working)

For completeness, these systems are CONFIRMED working and need no changes:

| System | Status | Evidence |
|--------|--------|----------|
| ECS (Miniplex 2) | Complete | Archetypes, reindexing, all component types |
| Canvas 2D Rendering | Complete | 7 layers, DPR-aware, sprites, citizens, badges |
| Camera2D | Complete | Pan, zoom, edge clamp, scroll-zoom |
| CanvasGestureManager | Complete | Tap/pan/pinch state machine |
| SpriteLoader | Complete | Manifest-based, 31 building PNGs |
| ParticleSystem2D | Complete | Snow/rain in screen-space |
| Power System | Complete | Grid-based power distribution |
| Production System | Complete | Resource production per building |
| Consumption System | Complete | Resource consumption per population |
| Population System | Complete | Growth, decline, birth/death |
| Decay System | Complete | Building deterioration over time |
| Quota System | Complete | 5-year plan quota tracking |
| Storage System | Complete | Overflow spoilage + baseline spoilage |
| CompulsoryDeliveries | Complete | State takes cut of production |
| EconomySystem | Complete | Trudodni, fondy, blat, rations, MTS, stakhanovites, heating, currency |
| EraSystem | Complete | 8 eras, transitions, modifiers, building gates |
| WorkerSystem | Complete | 6 AI classes, morale/loyalty/skill, vodka |
| PoliticalEntitySystem | Complete | Politruks, KGB, military entities |
| EventSystem | Complete | Weighted-random events with conditions |
| PravdaSystem | Complete | Satirical headlines from events |
| PolitburoSystem | Complete | Political pressure mechanics |
| PersonnelFile | Complete | Black marks, rank, reputation |
| SettlementSystem | Complete | 4 tiers, upgrade conditions |
| MinigameRouter | Complete | 8 minigames, auto-resolve |
| ScoringSystem | Complete | 3 difficulties × 3 consequences, 12 medals |
| NPC Dialogue Pools | Complete | 7 pools, context-sensitive |
| ChronologySystem | Complete | Year/month/season/day progression |
| SaveSystem serialization | Complete | All subsystems serialize/deserialize |
| SeedSystem | Complete | Deterministic RNG |
| MapSystem | Complete | Rivers, terrain generation |
| LandingPage | Complete | New Game / Continue / Settings |
| NewGameFlow | Complete | Difficulty, map size, era selection |
| AssignmentLetter | Complete | Dynamic name + backstory |
| SovietHUD | Complete | Population, resources, year, era |
| BottomStrip | Complete | Pause, speed, build button |
| DrawerPanel | Complete | Settings, save/load UI |
| FiveYearPlanModal | Complete | Quota display |
| AnnualReportModal | Complete | Pripiski choices |
| SettlementUpgradeModal | Complete | Tier-up notification |
| GameOverModal | Complete | End-game screen (needs tally data) |
| Advisor | Complete | Pixel art face, auto-dismiss (needs rename) |
| SovietToastStack | Complete | Toast notifications |

---

## 5. Priority Matrix

| Priority | Count | Impact |
|----------|-------|--------|
| P0 — Core loop broken | 7 gaps (001-006, 010) | Game unplayable as designed. Universal radial menu is the primary interaction pattern. |
| P1 — Major gameplay missing | 7 gaps (007-009, 010b, 011-012) | Features exist but not connected. Population registry needed for management. |
| P2 — Subsystem incomplete | 8 gaps (013-020) | Polish and completeness |
| P3 — Minor | 8 gaps (021-028) | Verification and cleanup |

---

## 6. Success Criteria

1. **All existing 1863+ tests pass** — zero regressions
2. **New unit tests** for every gap (target: +250 tests)
3. **Playwright E2E tests** validating the full game flow: Landing → New Game → Era 1 tutorial → 10 dvory with ~55 named family members → autonomous worker self-assignment → produce → meet quota → births/deaths/aging → era transition → conscription strips male workers → era end tally
4. **`pnpm typecheck`** clean
5. **`pnpm build`** succeeds
6. **Browser playtest**: the game plays as the GDD describes from minute 1
7. **Demographics verified**: Population display shows dvory, member breakdown, gender/age stats; births and deaths occur; household formation creates new dvory
