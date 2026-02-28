# Glasnost UI Inversion — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Surface existing Soviet game systems (materials, mandates, workers, personnel file) as the primary player experience; remove the SimCity ruble facade.

**Architecture:** UI-layer only transformation. The ECS data layer already exposes trudodni, blat, timber, steel, cement, prefab, mandates, and worker governor state through `GameSnapshot` and `useGameSnapshot()`. We replace 4 UI components (TopBar, RadialBuildMenu, BuildingPlacement, Toolbar) and create 1 new one (WorkerStatusBar). No engine/simulation changes.

**Tech Stack:** React Native 0.81, TypeScript 5.7, Reactylon (BabylonJS 8), react-native-svg, Miniplex ECS

---

## Critical Context

- **Two snapshot systems exist**: `src/hooks/useGameState.ts` (`GameSnapshot`) drives most UI via `useGameSnapshot()`. `src/stores/gameStore.ts` has a separate `GameSnapshot` with planned economy fields. The hooks snapshot is what App.web.tsx uses.
- **constructionSystem already deducts materials per-tick**. `BuildingPlacement.ts` should VALIDATE material affordability at placement time but NOT deduct upfront. Let `constructionSystem.ts` handle consumption.
- **constructionCost is optional** on building defs. `constructionSystem.ts` has `DEFAULT_MATERIAL_COST = { timber: 30, steel: 10, cement: 5, prefab: 0 }` as fallback. Reuse that pattern.
- **PlanMandates** already track per-era building requirements with fulfillment. `engine.recordBuildingForMandates(defId)` is already called in BuildingPlacement.
- **Governor** already has `CollectiveFocus` type and 5-level priority stack. `WorkerRosterPanel.tsx` already has a focus selector UI.

---

### Task 1: Add Soviet Resources to UI Snapshot

**Files:**
- Modify: `src/hooks/useGameState.ts:20-65` (GameSnapshot interface)
- Modify: `src/hooks/useGameState.ts:83-169` (createSnapshot function)

This task adds `timber`, `steel`, `cement`, `prefab`, `assignedWorkers`, `idleWorkers`, `dvorCount`, `avgMorale`, and `currentEra` to the snapshot that feeds all UI components.

**Step 1: Add fields to GameSnapshot interface**

In `src/hooks/useGameState.ts`, add to the `GameSnapshot` interface after `currentEra: string;` (line 64):

```typescript
  // Soviet economy (planned resources)
  timber: number;
  steel: number;
  cement: number;
  prefab: number;

  // Workforce
  assignedWorkers: number;
  idleWorkers: number;
  dvorCount: number;
  avgMorale: number;
  avgLoyalty: number;
```

**Step 2: Import citizens and dvory archetypes**

In `src/hooks/useGameState.ts`, update the import from `@/ecs/archetypes` (line 16) to also import `dvory`:

```typescript
import { getResourceEntity, getMetaEntity, citizens, operationalBuildings, dvory } from '@/ecs/archetypes';
```

**Step 3: Populate new fields in createSnapshot()**

In `src/hooks/useGameState.ts`, in the `createSnapshot()` function, before the `return` (around line 129), add computation:

```typescript
  // Workforce breakdown
  let assignedCount = 0;
  for (const c of citizens.entities) {
    if (c.citizen?.assignment) assignedCount++;
  }

  // Dvor loyalty average
  let loyaltySum = 0;
  for (const d of dvory.entities) {
    loyaltySum += d.dvor.loyaltyToCollective;
  }
  const avgLoyalty = dvory.entities.length > 0
    ? Math.round(loyaltySum / dvory.entities.length)
    : 0;

  // Morale average
  let moraleSum = 0;
  for (const c of citizens.entities) {
    moraleSum += c.citizen?.happiness ?? 0;
  }
  const avgMorale = pop > 0 ? Math.round(moraleSum / pop) : 0;
```

Then in the return object, add:

```typescript
    timber: Math.round(res?.resources.timber ?? 0),
    steel: Math.round(res?.resources.steel ?? 0),
    cement: Math.round(res?.resources.cement ?? 0),
    prefab: Math.round(res?.resources.prefab ?? 0),

    assignedWorkers: assignedCount,
    idleWorkers: pop - assignedCount,
    dvorCount: dvory.entities.length,
    avgMorale,
    avgLoyalty,
```

**Step 4: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors (existing tsconfig error about module/moduleResolution is pre-existing and doesn't block builds)

**Step 5: Verify in browser**

Run: `expo start --web` (if not already running)
Open http://localhost:8081 — game should load unchanged (no visible difference yet).

**Step 6: Commit**

```bash
git add src/hooks/useGameState.ts
git commit -m "feat(glasnost): add Soviet economy fields to UI GameSnapshot

Adds timber, steel, cement, prefab, workforce stats, and dvory
data to the useGameState snapshot so UI components can display
planned economy resources instead of rubles."
```

---

### Task 2: TopBar — Soviet Resource Display

**Files:**
- Modify: `src/ui/TopBar.tsx:10-52` (TopBarProps)
- Modify: `src/ui/TopBar.tsx:97-253` (TopBar component)
- Modify: `src/App.web.tsx:673-692` (TopBar props wiring)

Replace WATER and FUNDS ₽ displays with TIMBER and STEEL. Add era name to header. Keep food, vodka, power, population.

**Step 1: Update TopBarProps interface**

In `src/ui/TopBar.tsx`, modify the `TopBarProps` interface:

- Remove: `waterUsed`, `waterGen`, `money`, `income`
- Add: `timber`, `steel`, `cement`, `currentEra`

```typescript
export interface TopBarProps {
  season: string;
  weather: string;
  timber: number;       // was waterUsed/waterGen
  steel: number;        // was money/income
  cement: number;
  currentEra: string;
  powerUsed: number;
  powerGen: number;
  food: number;
  vodka: number;
  population: number;
  dateLabel: string;
  monthProgress: number;
  speed: number;
  onSetSpeed: (speed: number) => void;
  threatLevel?: string;
  blackMarks?: number;
  commendations?: number;
  settlementTier?: string;
  // ... keep all onShow* callbacks unchanged
```

**Step 2: Update destructured props**

In the component function (line 54-96), replace the destructured `waterUsed`, `waterGen`, `money`, `income` with `timber`, `steel`, `cement`, `currentEra`:

```typescript
export const TopBar: React.FC<TopBarProps> = ({
  season,
  weather,
  timber,
  steel,
  cement,
  currentEra,
  powerUsed,
  powerGen,
  food,
  // ... rest unchanged
```

**Step 3: Add era label to left group**

In the left group section (around line 99-110), after the title, add an era label before the season box:

```typescript
        <View style={styles.eraBox}>
          <Text style={[styles.seasonText, { color: Colors.sovietGold }]}>
            {ERA_LABELS[currentEra] ?? currentEra.toUpperCase()}
          </Text>
        </View>
```

Add the era labels constant near the top of the file (after imports):

```typescript
const ERA_LABELS: Record<string, string> = {
  war_communism: 'WAR COMMUNISM',
  first_plans: 'FIRST 5-YEAR PLAN',
  great_patriotic: 'GREAT PATRIOTIC WAR',
  reconstruction: 'RECONSTRUCTION',
  thaw: 'THE THAW',
  stagnation: 'ERA OF STAGNATION',
  perestroika: 'PERESTROIKA',
  eternal_soviet: 'ETERNAL SOVIET',
};
```

**Step 4: Replace resource stats in right group**

In the right group (lines 225-233), replace WATER and FUNDS with TIMBER, STEEL, CEMENT:

```typescript
        <ResourceStat label="TIMBER" emoji={'\u{1FAB5}'} value={String(timber)} color="#a1887f" />
        <ResourceStat label="STEEL" emoji={'\u{1F529}'} value={String(steel)} color="#90a4ae" />
        <ResourceStat label="CEMENT" value={String(cement)} color="#bdbdbd" />
        <ResourceStat label="POWER" emoji={'\u26A1'} value={`${powerUsed}/${powerGen}`} color={Colors.sovietGold} />
        <ResourceStat label="FOOD" emoji={'\u{1F954}'} value={String(food)} color="#fdba74" />
        <ResourceStat label="VODKA" emoji={'\u{1F37E}'} value={String(vodka)} color={Colors.termBlue} />
        <ResourceStat label="POP" value={String(population)} color={Colors.white} borderRight />
```

**Step 5: Add eraBox style**

In the StyleSheet (line 340+), add:

```typescript
  eraBox: {
    borderLeftWidth: 1,
    borderLeftColor: '#555',
    paddingLeft: 12,
    paddingRight: 4,
  },
```

**Step 6: Remove income style**

Delete the `income` style (lines 432-437) as it's no longer used.

**Step 7: Update App.web.tsx TopBar props**

In `src/App.web.tsx` at the `<TopBar` JSX (line 673), replace the old props:

```tsx
            <TopBar
              season={snap.seasonLabel}
              weather={snap.weatherLabel}
              timber={snap.timber}
              steel={snap.steel}
              cement={snap.cement}
              currentEra={snap.currentEra}
              powerUsed={snap.powerUsed}
              powerGen={snap.powerGen}
              food={snap.food}
              vodka={snap.vodka}
              population={snap.pop}
              dateLabel={snap.dateLabel}
              monthProgress={snap.monthProgress}
              speed={snap.speed}
              onSetSpeed={handleSetSpeed}
              // ... rest of callbacks unchanged
```

Remove the old `waterUsed`, `waterGen`, `money`, `income` props.

**Step 8: Update App.tsx too (if it exists with TopBar)**

Check `src/App.tsx` for a similar TopBar usage and apply the same prop changes (remove water/money/income, add timber/steel/cement/currentEra).

**Step 9: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: Clean (or pre-existing module error only)

**Step 10: Verify visually**

Open http://localhost:8081 — TopBar should now show:
- Era name (WAR COMMUNISM) in gold text
- TIMBER, STEEL, CEMENT values instead of WATER and FUNDS ₽
- No ruble sign or income indicator anywhere

**Step 11: Commit**

```bash
git add src/ui/TopBar.tsx src/App.web.tsx src/App.tsx
git commit -m "feat(glasnost): TopBar shows timber/steel/cement instead of rubles

Replaces FUNDS ₽ and WATER displays with TIMBER, STEEL, CEMENT.
Adds era label (WAR COMMUNISM, etc.) to the header left group.
Rubles are no longer visible on the primary resource bar."
```

---

### Task 3: BuildingPlacement — Materials Not Rubles

**Files:**
- Modify: `src/bridge/BuildingPlacement.ts:137-222` (placeECSBuilding)
- Reference: `src/ecs/systems/constructionSystem.ts:37-42` (DEFAULT_MATERIAL_COST)

Replace the ruble affordability check with material affordability. Do NOT deduct materials upfront — `constructionSystem` already deducts per-tick during construction.

**Step 1: Import DEFAULT_MATERIAL_COST**

At the top of `src/bridge/BuildingPlacement.ts`, add:

```typescript
import { DEFAULT_MATERIAL_COST } from '@/ecs/systems/constructionSystem';
```

**Step 2: Create material affordability helper**

Add above `placeECSBuilding()`:

```typescript
/**
 * Check if the player has enough materials to start construction.
 * Uses building's constructionCost or fallback defaults.
 * Note: materials are NOT deducted here — constructionSystem
 * handles per-tick deduction during the build process.
 */
function canAffordMaterials(
  resources: { timber: number; steel: number; cement: number; prefab: number },
  defId: string
): boolean {
  const def = getBuildingDef(defId);
  const cc = def?.stats.constructionCost;
  const timber = cc?.timber ?? DEFAULT_MATERIAL_COST.timber;
  const steel = cc?.steel ?? DEFAULT_MATERIAL_COST.steel;
  const cement = cc?.cement ?? DEFAULT_MATERIAL_COST.cement;
  const prefab = cc?.prefab ?? 0;
  return (
    resources.timber >= timber &&
    resources.steel >= steel &&
    resources.cement >= cement &&
    resources.prefab >= prefab
  );
}
```

**Step 3: Replace ruble check with material check in placeECSBuilding()**

In `placeECSBuilding()`, replace lines 175-187:

**Before:**
```typescript
  const def = getBuildingDef(defId);
  const cost = def?.presentation.cost ?? BUILDING_TYPES[toolKey]?.cost ?? 0;

  // FIX-02: Reject placement if cost resolves to zero or negative — indicates missing def data
  if (cost <= 0) {
    console.error(`[BuildingPlacement] Cost resolved to ${cost} for defId "${defId}" (tool "${toolKey}") — rejecting placement`);
    return false;
  }

  if (res.resources.money < cost) return false;

  // Deduct cost from ECS resources
  res.resources.money -= cost;
```

**After:**
```typescript
  // Validate material affordability (constructionSystem deducts per-tick)
  if (!canAffordMaterials(res.resources, defId)) return false;
```

**Step 4: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Clean

**Step 5: Verify in browser**

Open the game, try to place a building:
- Should fail if you lack timber/steel/cement
- Should succeed if you have enough materials
- Rubles should NOT be deducted

**Step 6: Commit**

```bash
git add src/bridge/BuildingPlacement.ts
git commit -m "feat(glasnost): BuildingPlacement checks materials instead of rubles

Replaces ruble affordability check with material validation
(timber, steel, cement, prefab). Materials are NOT deducted
upfront — constructionSystem handles per-tick deduction during
the build process. Authentic Soviet behavior: construction
pauses when fondy shipments are late."
```

---

### Task 4: RadialBuildMenu — Material Costs & Mandate Badges

**Files:**
- Modify: `src/ui/RadialBuildMenu.tsx:170-250` (BuildingWedge)
- Modify: `src/ui/RadialBuildMenu.tsx:252-454` (RadialBuildMenu main)

Replace `₽${cost}` labels with material cost summary. Replace `money >= cost` check with material affordability. Add mandate badge.

**Step 1: Import constructionSystem defaults and mandate helpers**

At the top of `src/ui/RadialBuildMenu.tsx`, add:

```typescript
import { DEFAULT_MATERIAL_COST } from '../ecs/systems/constructionSystem';
import type { ConstructionCost } from '../data/buildingDefs.schema';
```

**Step 2: Add material affordability helper**

Below the imports, add:

```typescript
/** Check if the player can afford the material cost for a building. */
function canAffordBuilding(
  snap: { timber: number; steel: number; cement: number; prefab: number },
  def: BuildingDef
): boolean {
  const cc = def.stats.constructionCost;
  return (
    snap.timber >= (cc?.timber ?? DEFAULT_MATERIAL_COST.timber) &&
    snap.steel >= (cc?.steel ?? DEFAULT_MATERIAL_COST.steel) &&
    snap.cement >= (cc?.cement ?? DEFAULT_MATERIAL_COST.cement) &&
    snap.prefab >= (cc?.prefab ?? 0)
  );
}

/** Format material cost as a compact string for the wedge label. */
function formatMaterialCost(def: BuildingDef): string {
  const cc = def.stats.constructionCost;
  const t = cc?.timber ?? DEFAULT_MATERIAL_COST.timber;
  const s = cc?.steel ?? DEFAULT_MATERIAL_COST.steel;
  const parts: string[] = [];
  if (t > 0) parts.push(`\u{1FAB5}${t}`);
  if (s > 0) parts.push(`\u{1F529}${s}`);
  return parts.join(' ') || 'FREE';
}
```

**Step 3: Update BuildingWedge props — replace money with snap resources**

In the `BuildingWedgeProps` interface (line 171), replace `money: number` with resource fields:

```typescript
interface BuildingWedgeProps {
  id: string;
  def: BuildingDef;
  index: number;
  buildingAngle: number;
  gap: number;
  availableSpace: number;
  snap: { timber: number; steel: number; cement: number; prefab: number };
  onSelect: (defId: string) => void;
}
```

**Step 4: Update BuildingWedge component**

Replace the `canAfford` and cost display logic in `BuildingWedge`:

```typescript
const BuildingWedge: React.FC<BuildingWedgeProps> = ({
  id,
  def,
  index,
  buildingAngle,
  gap,
  availableSpace,
  snap,
  onSelect,
}) => {
  // ... geometry code unchanged (startA, endA, midA, labelPos) ...

  const fits = def.footprint.tilesX <= availableSpace && def.footprint.tilesY <= availableSpace;
  const canAfford = canAffordBuilding(snap, def);
  const canBuild = fits && canAfford;
  // ... rest unchanged except the cost label ...
```

Replace the cost SvgText (line 246):

```typescript
      <SvgText
        x={labelPos.x}
        y={labelPos.y + 17}
        textAnchor="middle"
        alignmentBaseline="central"
        fontSize={7}
        fill={canBuild ? Colors.sovietGold : '#555'}
        fontFamily={monoFont}
        fontWeight="bold"
      >
        {fits ? formatMaterialCost(def) : "WON'T FIT"}
      </SvgText>
```

**Step 5: Update BuildingWedge call site**

In the main RadialBuildMenu component, where `<BuildingWedge>` is rendered (line 419-430), replace `money={snap.money}` with:

```tsx
                  <BuildingWedge
                    key={id}
                    id={id}
                    def={def}
                    index={i}
                    buildingAngle={buildingAngle}
                    gap={gap}
                    availableSpace={availableSpace}
                    snap={{ timber: snap.timber, steel: snap.steel, cement: snap.cement, prefab: snap.prefab }}
                    onSelect={handleSelect}
                  />
```

**Step 6: Update sort order — sort by timber cost instead of ruble cost**

Replace the building sort (lines 342-346):

```typescript
  buildingIds.sort((a, b) => {
    const defA = BUILDING_DEFS[a];
    const defB = BUILDING_DEFS[b];
    const tA = defA?.stats.constructionCost?.timber ?? DEFAULT_MATERIAL_COST.timber;
    const tB = defB?.stats.constructionCost?.timber ?? DEFAULT_MATERIAL_COST.timber;
    return tA - tB;
  });
```

**Step 7: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 8: Verify visually**

Open game, tap empty tile to open radial menu:
- Building wedges should show material costs (e.g., "🪵30 🔩10") not ruble prices
- Buildings should be greyed out if insufficient materials
- Selection should still trigger placement

**Step 9: Commit**

```bash
git add src/ui/RadialBuildMenu.tsx
git commit -m "feat(glasnost): RadialBuildMenu shows material costs not rubles

Replaces ₽ cost labels with timber/steel material icons.
Affordability now checks timber/steel/cement/prefab instead
of ruble balance. Buildings sorted by timber cost."
```

---

### Task 5: WorkerStatusBar — Bottom Panel

**Files:**
- Create: `src/ui/WorkerStatusBar.tsx`
- Modify: `src/App.web.tsx` (add WorkerStatusBar to overlay layout)

A compact bottom bar showing worker distribution and collective focus selector, extracted from the existing WorkerRosterPanel focus UI.

**Step 1: Create WorkerStatusBar component**

Create `src/ui/WorkerStatusBar.tsx`:

```typescript
/**
 * WorkerStatusBar — Compact bottom bar showing worker distribution
 * and collective focus selector.
 *
 * Tapping a category opens the full WorkerRosterPanel filtered to
 * that assignment type.
 */

import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, SharedStyles, monoFont } from './styles';
import { useGameSnapshot } from '../hooks/useGameState';
import { getEngine } from '../bridge/GameInit';
import type { CollectiveFocus } from '../game/workers/governor';

const FOCUS_OPTIONS: { key: CollectiveFocus; label: string; icon: string }[] = [
  { key: 'food', label: 'FOOD', icon: '\u{1F33E}' },
  { key: 'construction', label: 'BUILD', icon: '\u{1F3D7}' },
  { key: 'production', label: 'PROD', icon: '\u{1F3ED}' },
  { key: 'balanced', label: 'BAL', icon: '\u2696' },
];

export interface WorkerStatusBarProps {
  onShowWorkers?: () => void;
}

export const WorkerStatusBar: React.FC<WorkerStatusBarProps> = ({ onShowWorkers }) => {
  const snap = useGameSnapshot();
  const engine = getEngine();
  const workerSystem = engine?.getWorkerSystem() ?? null;
  const currentFocus = workerSystem?.getCollectiveFocus() ?? 'balanced';

  const handleFocusChange = useCallback((focus: CollectiveFocus) => {
    workerSystem?.setCollectiveFocus(focus);
  }, [workerSystem]);

  return (
    <View style={[SharedStyles.panel, styles.container]}>
      {/* Worker count */}
      <TouchableOpacity
        style={styles.workerInfo}
        onPress={onShowWorkers}
        activeOpacity={0.7}
      >
        <Text style={styles.label}>WORKERS</Text>
        <Text style={styles.value}>
          <Text style={{ color: Colors.termGreen }}>{snap.assignedWorkers}</Text>
          <Text style={{ color: '#666' }}>/</Text>
          <Text style={{ color: Colors.white }}>{snap.pop}</Text>
        </Text>
        <Text style={styles.sublabel}>
          {snap.idleWorkers} idle
        </Text>
      </TouchableOpacity>

      {/* Morale */}
      <View style={styles.statBox}>
        <Text style={styles.label}>MORALE</Text>
        <Text style={[styles.value, { color: snap.avgMorale > 60 ? Colors.termGreen : snap.avgMorale > 30 ? Colors.sovietGold : Colors.sovietRed }]}>
          {snap.avgMorale}%
        </Text>
      </View>

      {/* Separator */}
      <View style={styles.divider} />

      {/* Collective Focus selector */}
      <View style={styles.focusRow}>
        <Text style={styles.focusLabel}>FOCUS</Text>
        {FOCUS_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[
              styles.focusBtn,
              currentFocus === opt.key && styles.focusBtnActive,
            ]}
            onPress={() => handleFocusChange(opt.key)}
            activeOpacity={0.7}
          >
            <Text style={styles.focusIcon}>{opt.icon}</Text>
            <Text style={[
              styles.focusText,
              currentFocus === opt.key && { color: Colors.white },
            ]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 12,
  },
  workerInfo: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  statBox: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  label: {
    fontSize: 8,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#9e9e9e',
    letterSpacing: 2,
  },
  value: {
    fontSize: 16,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.white,
  },
  sublabel: {
    fontSize: 8,
    fontFamily: monoFont,
    color: '#666',
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: '#555',
  },
  focusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  focusLabel: {
    fontSize: 8,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#9e9e9e',
    letterSpacing: 2,
    marginRight: 4,
  },
  focusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#444',
    backgroundColor: '#1a1a1a',
    gap: 4,
  },
  focusBtnActive: {
    borderColor: Colors.sovietRed,
    backgroundColor: '#3a1a1a',
  },
  focusIcon: {
    fontSize: 14,
  },
  focusText: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#888',
    letterSpacing: 1,
  },
});
```

**Step 2: Wire into App.web.tsx**

In `src/App.web.tsx`:

1. Import at the top:
```typescript
import { WorkerStatusBar } from './ui/WorkerStatusBar';
```

2. In the UI overlay (after the existing Toolbar area), add the WorkerStatusBar. Look for where `</View>` closes the bottom toolbar section and add right before the closing overlay `</View>`:

```tsx
            <WorkerStatusBar onShowWorkers={handleShowWorkers} />
```

Position it at the bottom of the overlay using absolute positioning — add a wrapper:

```tsx
            <View style={styles.bottomBar} pointerEvents="box-none">
              <WorkerStatusBar onShowWorkers={handleShowWorkers} />
            </View>
```

And add to the styles:
```typescript
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
```

**Step 3: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 4: Verify visually**

Open game — bottom bar should show:
- WORKERS assigned/total with idle count
- MORALE percentage colored by health
- Focus selector buttons: FOOD, BUILD, PROD, BAL
- Active focus highlighted with red border

**Step 5: Commit**

```bash
git add src/ui/WorkerStatusBar.tsx src/App.web.tsx
git commit -m "feat(glasnost): add WorkerStatusBar with focus selector

New bottom panel showing worker distribution (assigned/total/idle),
collective morale, and focus selector (FOOD/BUILD/PROD/BAL).
Tapping WORKERS opens the full roster panel."
```

---

### Task 6: Toolbar — Replace Building Browser with Soviet Tabs

**Files:**
- Modify: `src/ui/Toolbar.tsx` (complete rewrite)
- Modify: `src/App.web.tsx` (update Toolbar props and wiring)

Replace the BUILDING_TYPES-based scrollable toolbar with a 4-tab system: MANDATES, WORKERS, REPORTS, PURGE.

**Step 1: Rewrite Toolbar component**

Replace the entire content of `src/ui/Toolbar.tsx`:

```typescript
/**
 * Toolbar — 4-tab navigation: MANDATES / WORKERS / REPORTS / PURGE.
 * Replaces the old building-type browser.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, SharedStyles, monoFont } from './styles';

export type SovietTab = 'mandates' | 'workers' | 'reports' | 'purge';

interface TabDef {
  key: SovietTab;
  label: string;
  icon: string;
}

const TABS: TabDef[] = [
  { key: 'mandates', label: 'MANDATES', icon: '\u{1F4CB}' },
  { key: 'workers', label: 'WORKERS', icon: '\u2692' },
  { key: 'reports', label: 'REPORTS', icon: '\u{1F4CA}' },
  { key: 'purge', label: 'PURGE', icon: '\u{1F480}' },
];

export interface ToolbarProps {
  activeTab: SovietTab;
  onTabChange: (tab: SovietTab) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ activeTab, onTabChange }) => {
  return (
    <View style={[SharedStyles.panel, styles.container]}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onTabChange(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 50,
    alignItems: 'stretch',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#333',
  },
  tabActive: {
    backgroundColor: '#3a1a1a',
    borderBottomWidth: 2,
    borderBottomColor: Colors.sovietRed,
  },
  tabIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#888',
    letterSpacing: 2,
  },
  tabLabelActive: {
    color: Colors.white,
  },
});
```

**Step 2: Update Toolbar usage in App.web.tsx**

In `src/App.web.tsx`:

1. Import the new type:
```typescript
import type { SovietTab } from './ui/Toolbar';
```

2. Add state for the active Soviet tab (near other state declarations):
```typescript
const [sovietTab, setSovietTab] = useState<SovietTab>('mandates');
```

3. Add tab change handler:
```typescript
const handleSovietTab = useCallback((tab: SovietTab) => {
  setSovietTab(tab);
  // Open corresponding panel
  switch (tab) {
    case 'mandates':
      handleShowMandates();
      break;
    case 'workers':
      handleShowWorkers();
      break;
    case 'reports':
      handleShowEconomy();
      break;
    case 'purge':
      // Keep existing bulldoze behavior
      selectTool('bulldoze');
      break;
  }
}, []);
```

4. Replace the old `<TabBar>` + `<Toolbar>` section with:
```tsx
            <Toolbar activeTab={sovietTab} onTabChange={handleSovietTab} />
```

**Step 3: Remove old TabBar import if it's now unused**

Check if `TabBar` is still used elsewhere. If only used with the old Toolbar, remove the import.

**Step 4: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 5: Verify visually**

Open game — bottom toolbar should show 4 tabs:
- MANDATES (clipboard icon) — opens mandate panel
- WORKERS (hammer icon) — opens worker roster
- REPORTS (chart icon) — opens economy panel
- PURGE (skull icon) — enters bulldoze mode

**Step 6: Commit**

```bash
git add src/ui/Toolbar.tsx src/App.web.tsx
git commit -m "feat(glasnost): replace building browser with Soviet tab bar

New 4-tab toolbar: MANDATES / WORKERS / REPORTS / PURGE.
Replaces the old building-type scrollable browser. Each tab
opens the corresponding deep-dive panel. PURGE enters bulldoze."
```

---

### Task 7: Cleanup & Final Verification

**Files:**
- Modify: `src/ui/TopBar.tsx` (remove unused imports if any)
- Verify: `src/bridge/BuildingPlacement.ts` (ensure no ruble references remain)
- Verify: All files compile

**Step 1: Search for remaining ruble references in UI**

Run: `grep -rn '₽\|ruble\|FUNDS' src/ui/ src/bridge/BuildingPlacement.ts`

Fix any remaining ruble references.

**Step 2: Verify the old TabBar.tsx isn't broken**

If `TabBar.tsx` is still imported elsewhere, make sure it still works. If it's fully replaced by the new Toolbar, leave it (don't delete files not mentioned in the plan).

**Step 3: Full TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -40`
Expected: Only the pre-existing module/moduleResolution warning

**Step 4: Full visual playtest**

Open http://localhost:8081 and verify all 5 success criteria:
1. TopBar shows timber, steel, cement (not rubles)
2. RadialBuildMenu shows material costs (not ₽ prices)
3. Building placement checks materials (not ruble balance)
4. Bottom bar shows worker focus selector
5. Tab bar shows MANDATES / WORKERS / REPORTS / PURGE

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat(glasnost): cleanup — remove remaining ruble references

Final polish pass: removes any leftover ₽ symbols, dead code,
and unused imports from the UI inversion transformation."
```

---

## Summary of Changes

| File | Change | Lines |
|------|--------|-------|
| `src/hooks/useGameState.ts` | Add timber/steel/cement/workforce to snapshot | ~30 |
| `src/ui/TopBar.tsx` | Replace FUNDS/WATER with TIMBER/STEEL/CEMENT, add era label | ~40 |
| `src/bridge/BuildingPlacement.ts` | Replace ruble check with material check | ~25 |
| `src/ui/RadialBuildMenu.tsx` | Material costs, material affordability | ~40 |
| `src/ui/WorkerStatusBar.tsx` | **NEW** — worker count + focus selector | ~150 |
| `src/ui/Toolbar.tsx` | Rewrite: MANDATES/WORKERS/REPORTS/PURGE tabs | ~80 |
| `src/App.web.tsx` | Wire new props and components | ~30 |

**Total**: ~395 lines changed/added across 7 files. Zero engine changes.
