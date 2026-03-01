---
title: The Glasnost — UI Inversion Design
type: plan
status: implemented
plan_status: completed
date: 2026-02-27
last_verified: 2026-03-01
coverage: full
---

# "The Glasnost" — UI Inversion Design

> **Date**: 2026-02-27
> **Status**: Approved
> **Goal**: Surface the existing Soviet game systems as the primary player experience; remove the SimCity facade.

## Problem Statement

SimSoviet 1917 has TWO parallel realities:

1. **The SimCity facade** (player-facing): TopBar shows `₽money | food | vodka | ⚡power | 👥pop`. RadialBuildMenu displays ruble costs. `BuildingPlacement.ts` deducts rubles. The player experience is "buy buildings with money."

2. **The Soviet reality** (hidden): `EconomySystem` tracks trudodni, fondy, blat. `constructionSystem` uses labor + timber/steel/cement. `governor.ts` auto-assigns workers via 5-level priority stack. `CompulsoryDeliveries` extracts 40-70% of production. `PersonnelFile` tracks black marks → arrest. `PlanMandates` defines era-specific building mandates. All wired into `SimulationEngine.tick()`.

The Soviet systems work. The player just can't see them.

## Architecture

The data layer is ready. `GameSnapshot` already exposes: `trudodni`, `blat`, `timber`, `steel`, `cement`, `prefab`, `dvorCount`, `avgMorale`, `avgLoyalty`, `assignedWorkers`, `idleWorkers`, `blackMarks`, `commendations`, `threatLevel`, `settlementTier`, `currentEra`.

The `ConstructionCostSchema` defines `labor`, `timber`, `steel`, `cement`, `prefab`, `baseTicks`, `staffCap` — and comments explicitly state "Rubles are NOT used for construction."

`PlanMandates.ts` has era-specific mandate templates with fulfillment tracking. `MandateProgressPanel.tsx` displays them.

The fix is **UI-layer only** — remove the SimCity bridge, surface the Soviet data.

## What Changes

### 1. TopBar — Show Soviet Resources

**File**: `src/ui/TopBar.tsx`

**Before**: `₽1200 | 🌾450 | 🍶30 | ⚡80/120 | 👥127`

**After**:
```
☆ REVOLUTION │ 1922 Mar │ SELO │ ▶1× ⏸ ⏩
👥55 │ 🌾450 │ 🍶30 │ ⚡80 │ 🪵120 │ 🔩45 │ 📋●●○○○○○
```

- Replace `₽money` + `income` with `🪵timber` + `🔩steel`
- Add era name, settlement tier to header row
- Add personnel file indicator: filled circles = black marks (7 = arrest)
- Keep food, vodka, power, population
- Rubles accessible via tap → EconomyPanel (secondary)

### 2. RadialBuildMenu — Material Costs, Mandate Filtering

**File**: `src/ui/RadialBuildMenu.tsx`

- Replace `₽${cost}` labels with material cost summary: `🪵15 🔩10`
- Read `constructionCost` from building def instead of `presentation.cost`
- Filter available buildings by active plan mandates (only show mandated buildings + any unlocked freestyle buildings for the era)
- Check material affordability instead of ruble affordability
- Add mandate badge: "MANDATED (1/3)" on buildings Moscow requires

### 3. BuildingPlacement — Materials, Not Rubles

**File**: `src/bridge/BuildingPlacement.ts`

- `placeECSBuilding()`: Replace `res.resources.money < cost` → check `timber`, `steel`, `cement`, `prefab` against `def.stats.constructionCost`
- Remove `res.resources.money -= cost`
- Add material deduction: `res.resources.timber -= cc.timber`, etc.
- Record mandate fulfillment via `engine.recordBuildingForMandates(defId)` (already exists)
- Keep `upgradeECSBuilding()` as-is (upgrades cost rubles — they're a special case of blat/favors)

### 4. Bottom Panel — Worker Governor Status

**File**: New component `src/ui/WorkerStatusBar.tsx` (composed into existing layout)

- Default bottom bar shows worker distribution from governor
- Collective focus selector: `[🌾Food] [🏗Build] [⚙Prod] [⚖Balanced]`
- Calls `workerSystem.setCollectiveFocus()` (already wired in WorkerRosterPanel)
- Tap any category → opens WorkerRosterPanel filtered to that assignment type

### 5. Mandates Panel — Primary Building Interface

**File**: `src/ui/MandateProgressPanel.tsx` (already exists — promote to primary)

- Move from modal-on-button-press to persistent sidebar or tab
- Add "Place" button per mandate row that enters build mode filtered to that defId
- Show material requirements per mandate
- Show overall 5-year plan progress

### 6. Toolbar Replacement

**File**: `src/ui/Toolbar.tsx`

- Replace 4-tab building browser (ZONING/INFRASTRUCTURE/STATE/PURGE) with:
  1. **MANDATES** tab — mandated buildings with Place buttons
  2. **WORKERS** tab — governor status + focus selector
  3. **REPORTS** tab — personnel file, economy summary, deliveries
  4. **PURGE** tab — keep existing (bulldoze)

## What Does NOT Change

- `SimulationEngine.tick()` — already calls all Soviet systems in correct order
- `constructionSystem` — already uses labor + materials
- `governor.ts` — already implements 5-level priority stack
- `EconomySystem` — already tracks trudodni, fondy, blat, rations, heating, MTS
- `PolitburoSystem` — already runs coups, purges, factions, ministry modifiers
- `PravdaSystem` — already generates headlines
- `EventSystem` — already fires 30+ event types
- `PersonnelFile` — already tracks marks → arrest
- `CompulsoryDeliveries` — already extracts production
- `PlanMandates` — already defines per-era mandates
- All 22+ existing UI panels — continue as deep-dive modals

## Risk Assessment

- **Low risk**: All underlying systems are tested and wired
- **Main risk**: Building defs may not all have `constructionCost` defined (field is optional). Need to add defaults or require them.
- **UI risk**: Mobile layout may need adjustment for new TopBar fields
- **Playtest risk**: Material availability may make early game too hard — will need balancing of fondy delivery rates and starting resources

## Success Criteria

After this transformation, a new player should:
1. See timber, steel, and black marks on the TopBar (not rubles)
2. Build only what Moscow mandates, paying in materials
3. Set collective focus to manage worker priorities
4. Feel personnel file pressure (marks visible, arrest looming)
5. Never see a ruble price tag on a building
