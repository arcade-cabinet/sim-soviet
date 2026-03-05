# Historical Divergence (1991) + Milestone Timeline Screen

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** At year 1991 in historical mode, pause with a modal offering "End Assignment" (show milestone timeline screen) or "Continue Into Alternate History" (switch to freeform governor seamlessly).

**Architecture:** A `historicalDivergenceFired` flag in `TickContext.state` triggers a one-shot `onHistoricalEraEnd` callback from `phaseChronology.ts` using the existing `endGame`-delegate pattern. The `USSRDissolutionModal` is a pure component. The `MilestoneTimelineScreen` reads `activatedMilestoneYears` (new field on `TimelineLayerState`) to render a chronological record of the playthrough.

**Tech Stack:** TypeScript 5.7, React Native, Jest (TDD), Playwright E2E. Run tests: `npx jest --no-coverage`. TypeScript check: `npx tsc --noEmit`. **Use pnpm, not npm.**

---

## Context — Key Files

| File | Role |
|------|------|
| `src/game/engine/types.ts` | `SimCallbacks` interface — add `onHistoricalEraEnd` |
| `src/game/engine/tickContext.ts` | `TickContext.state` — add `historicalDivergenceFired`; delegates — add `switchToFreeformMode` |
| `src/game/engine/phaseChronology.ts` | Detect year ≥ 1991 + historical mode + fire callback |
| `src/game/SimulationEngine.ts` | Provide `switchToFreeformMode` closure via `setGovernor` |
| `src/game/timeline/TimelineLayer.ts` | Add `activatedMilestoneYears: Map<string, number>` to state + serialization |
| `src/ui/USSRDissolutionModal.tsx` | New: two-button divergence modal |
| `src/ui/MilestoneTimelineScreen.tsx` | New: end-of-history scrollable record |
| `src/App.web.tsx` | Wire callbacks + render new components |
| `__tests__/playthrough/helpers.ts` | Add `onHistoricalEraEnd` to mock callbacks |
| `__tests__/game/HistoricalDivergence.test.ts` | New TDD test file |
| `e2e/yuka-playthrough.spec.ts` | Two new E2E test cases |

---

## Task 1: Add `activatedMilestoneYears` to TimelineLayerState

**Files:**
- Modify: `src/game/timeline/TimelineLayer.ts`
- Test: `__tests__/game/TimelineIntegration.test.ts` (add one test to existing file)

### Step 1: Write the failing test

Add this test to the `'Timeline registration'` describe block in `__tests__/game/TimelineIntegration.test.ts`:

```typescript
it('records activation year for milestones', () => {
  const { engine } = createPlaythroughEngine({
    meta: { date: { year: 1945, month: 10, tick: 0 } },
    resources: { food: 999999, vodka: 999999, money: 999999 },
  });
  buildBasicSettlement({ housing: 2, farms: 1, power: 1 });

  // Advance 3 years: 1945 → 1948 (cold_war_start activates at 1947)
  for (let y = 0; y < 3; y++) {
    getResources().food = 999999;
    advanceTicks(engine, TICKS_PER_YEAR);
  }

  const state = engine.serializeSubsystems();
  const worldTimeline = state.timelines?.find((t) => t.timelineId === 'world');
  expect(worldTimeline).toBeDefined();
  // activatedMilestoneYears must contain cold_war_start with year 1947 or 1948
  const years = worldTimeline!.activatedMilestoneYears;
  expect(years).toBeDefined();
  expect(typeof years!['cold_war_start']).toBe('number');
  expect(years!['cold_war_start']).toBeGreaterThanOrEqual(1947);
});
```

### Step 2: Run — verify it fails

```bash
npx jest --no-coverage --testPathPattern="TimelineIntegration" 2>&1 | tail -15
```

Expected: FAIL — `activatedMilestoneYears` undefined.

### Step 3: Implement

In `src/game/timeline/TimelineLayer.ts`:

**Add to `TimelineLayerState` interface** (after `unlockedCapabilities`):
```typescript
/** Year each milestone first activated (milestoneId → calendar year). */
activatedMilestoneYears: Map<string, number>;
```

**In `evaluateTimelineLayer`**, add after `const newUnlocks = new Set(state.unlockedCapabilities);`:
```typescript
const newActivatedYears = new Map(state.activatedMilestoneYears);
```

In the activation block (where `newActivated.add(milestone.id)` is called), add:
```typescript
newActivatedYears.set(milestone.id, ctx.year);
```

In the return statement, add:
```typescript
activatedMilestoneYears: newActivatedYears,
```

**In `createLayerState`**, add:
```typescript
activatedMilestoneYears: new Map(),
```

**Add to `TimelineLayerSaveData`** interface:
```typescript
activatedMilestoneYears: Array<[string, number]>;
```

**In `serializeLayerState`**, add:
```typescript
activatedMilestoneYears: [...state.activatedMilestoneYears.entries()],
```

**In `restoreLayerState`**, add:
```typescript
activatedMilestoneYears: new Map(data.activatedMilestoneYears ?? []),
```

### Step 4: Run — verify passes

```bash
npx jest --no-coverage --testPathPattern="TimelineIntegration" 2>&1 | tail -10
```

Expected: all 10 tests pass.

### Step 5: Commit

```bash
git add src/game/timeline/TimelineLayer.ts __tests__/game/TimelineIntegration.test.ts
git commit -m "feat: track milestone activation years in TimelineLayerState

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Add `onHistoricalEraEnd` to SimCallbacks + TickContext delegates

**Files:**
- Modify: `src/game/engine/types.ts`
- Modify: `src/game/engine/tickContext.ts`

### Step 1: Add `onHistoricalEraEnd` to `SimCallbacks` in `types.ts`

After the `onNarrativeEvent` line:
```typescript
/**
 * Fired once when historical mode reaches the 1991 divergence year.
 * Call resolve(true) to continue in freeform mode, resolve(false) to end the game.
 * If not handled, auto-resolves as continue (freeform) after 60 ticks.
 */
onHistoricalEraEnd?: (resolve: (continueInFreeform: boolean) => void) => void;
```

### Step 2: Add `historicalDivergenceFired` to `TickContext.state`

In `tickContext.ts`, in the `state:` block, after `hqSplitState`:
```typescript
/** True once the 1991 historical-mode divergence callback has fired. Never resets. */
historicalDivergenceFired: boolean;
```

### Step 3: Add `switchToFreeformMode` delegate to `TickContext`

After `endGame: (victory: boolean, reason: string) => void;`:
```typescript
/** Switch the engine from historical to freeform governor (divergence continuation). */
switchToFreeformMode: () => void;
```

### Step 4: Wire the delegate in `SimulationEngine.ts`

Find where `endGame` is wired into the tick context (search for `endGame:` in `SimulationEngine.ts`). Add alongside it:
```typescript
switchToFreeformMode: () => this.setGovernor(new FreeformGovernor(1991)),
```

Also initialize the new state field — find where `hqSplitState` is initialized and add:
```typescript
historicalDivergenceFired: false,
```

### Step 5: TypeScript check — no new errors

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules\|\.d\.ts" | head -20
```

Expected: zero new errors (there are 27 pre-existing yuka errors — those are fine).

### Step 6: Commit

```bash
git add src/game/engine/types.ts src/game/engine/tickContext.ts src/game/SimulationEngine.ts
git commit -m "feat: add onHistoricalEraEnd callback + switchToFreeformMode delegate

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Fire the 1991 divergence in `phaseChronology.ts` (TDD)

**Files:**
- Create: `__tests__/game/HistoricalDivergence.test.ts`
- Modify: `src/game/engine/phaseChronology.ts`

### Step 1: Write the failing tests

Create `__tests__/game/HistoricalDivergence.test.ts`:

```typescript
/**
 * TDD: 1991 historical divergence — onHistoricalEraEnd fires once at year ≥ 1991
 * in historical mode, doesn't fire in freeform, resolve(true) switches governor,
 * resolve(false) ends the game.
 */

import { world } from '../../src/ecs/world';
import {
  advanceTicks,
  buildBasicSettlement,
  createPlaythroughEngine,
  getResources,
  TICKS_PER_YEAR,
} from '../playthrough/helpers';
import { FreeformGovernor } from '../../src/ai/agents/crisis/FreeformGovernor';

afterEach(() => {
  world.clear();
  jest.restoreAllMocks();
});

describe('Historical 1991 divergence', () => {
  it('fires onHistoricalEraEnd exactly once when historical mode reaches year 1991', () => {
    const { engine, callbacks } = createPlaythroughEngine({
      meta: { date: { year: 1989, month: 1, tick: 0 } },
      resources: { food: 999999, vodka: 999999, money: 999999 },
    });

    let fireCount = 0;
    (callbacks.onHistoricalEraEnd as jest.Mock).mockImplementation((resolve) => {
      fireCount++;
      resolve(true); // continue — don't block the engine
    });

    buildBasicSettlement({ housing: 2, farms: 1, power: 1 });

    // Advance 5 years: 1989 → 1994 (crosses 1991)
    for (let y = 0; y < 5; y++) {
      getResources().food = 999999;
      advanceTicks(engine, TICKS_PER_YEAR);
    }

    expect(fireCount).toBe(1);
  });

  it('does NOT fire onHistoricalEraEnd in freeform mode', () => {
    const { engine, callbacks } = createPlaythroughEngine({
      meta: { date: { year: 1989, month: 1, tick: 0 } },
      resources: { food: 999999, vodka: 999999, money: 999999 },
      // No governor override — freeform uses FreeformGovernor
    });
    // Override to freeform governor directly
    const { FreeformGovernor } = jest.requireActual('../../src/ai/agents/crisis/FreeformGovernor') as typeof import('../../src/ai/agents/crisis/FreeformGovernor');
    engine.setGovernor(new FreeformGovernor());

    buildBasicSettlement({ housing: 2, farms: 1, power: 1 });

    for (let y = 0; y < 5; y++) {
      getResources().food = 999999;
      advanceTicks(engine, TICKS_PER_YEAR);
    }

    expect(callbacks.onHistoricalEraEnd).not.toHaveBeenCalled();
  });

  it('resolve(true) switches engine to freeform mode', () => {
    const { engine, callbacks } = createPlaythroughEngine({
      meta: { date: { year: 1990, month: 1, tick: 0 } },
      resources: { food: 999999, vodka: 999999, money: 999999 },
    });

    (callbacks.onHistoricalEraEnd as jest.Mock).mockImplementation((resolve) => {
      resolve(true);
    });

    buildBasicSettlement({ housing: 2, farms: 1, power: 1 });

    for (let y = 0; y < 3; y++) {
      getResources().food = 999999;
      advanceTicks(engine, TICKS_PER_YEAR);
    }

    // After resolve(true), governor should be FreeformGovernor
    const gov = engine.getGovernor();
    expect(gov).toBeInstanceOf(FreeformGovernor);
  });

  it('resolve(false) triggers game over with reason ussr_dissolved', () => {
    const { engine, callbacks } = createPlaythroughEngine({
      meta: { date: { year: 1990, month: 1, tick: 0 } },
      resources: { food: 999999, vodka: 999999, money: 999999 },
    });

    (callbacks.onHistoricalEraEnd as jest.Mock).mockImplementation((resolve) => {
      resolve(false);
    });
    callbacks.onAnnualReport = undefined as never;

    buildBasicSettlement({ housing: 2, farms: 1, power: 1 });

    for (let y = 0; y < 3; y++) {
      getResources().food = 999999;
      advanceTicks(engine, TICKS_PER_YEAR);
    }

    expect(callbacks.onGameOver).toHaveBeenCalledWith(
      false,
      expect.stringContaining('ussr_dissolved'),
    );
  });

  it('auto-resolves as continue (freeform) if onHistoricalEraEnd not handled', () => {
    const { engine, callbacks } = createPlaythroughEngine({
      meta: { date: { year: 1990, month: 1, tick: 0 } },
      resources: { food: 999999, vodka: 999999, money: 999999 },
    });

    // Do NOT mock onHistoricalEraEnd — leave it as undefined
    callbacks.onHistoricalEraEnd = undefined as never;
    callbacks.onAnnualReport = undefined as never;

    buildBasicSettlement({ housing: 2, farms: 1, power: 1 });

    for (let y = 0; y < 3; y++) {
      getResources().food = 999999;
      advanceTicks(engine, TICKS_PER_YEAR);
    }

    // Engine should have switched to freeform (not game over)
    expect(callbacks.onGameOver).not.toHaveBeenCalled();
    expect(engine.getGovernor()).toBeInstanceOf(FreeformGovernor);
  });
});
```

### Step 2: Run — verify all 5 tests fail

```bash
npx jest --no-coverage --testPathPattern="HistoricalDivergence" 2>&1 | tail -15
```

Expected: 5 FAIL.

### Step 3: Add `onHistoricalEraEnd` to `createMockCallbacks` in helpers

In `__tests__/playthrough/helpers.ts`, add to the return object:
```typescript
onHistoricalEraEnd: jest.fn().mockImplementation((resolve: (c: boolean) => void) => resolve(true)),
```

This auto-resolves as "continue" so ALL existing long-running tests that cross 1991 don't hang waiting for a modal.

### Step 4: Implement in `phaseChronology.ts`

Find the `runChronologyPhase` function. After the era transition block (around where `onEraChanged` is called), add the 1991 divergence check. The exact location: near the end of the yearly logic block (where `ctx.tickResult.yearBoundary` is true):

```typescript
// ── 1991 Historical Divergence ──────────────────────────────────────────
if (
  ctx.state.gameMode === 'historical' &&
  !ctx.state.historicalDivergenceFired &&
  date.year >= 1991
) {
  ctx.state.historicalDivergenceFired = true;

  const resolve = (continueInFreeform: boolean) => {
    if (continueInFreeform) {
      ctx.switchToFreeformMode();
    } else {
      ctx.endGame(false, 'ussr_dissolved');
    }
  };

  if (ctx.callbacks.onHistoricalEraEnd) {
    ctx.callbacks.onHistoricalEraEnd(resolve);
  } else {
    // No UI handler — auto-continue into freeform
    ctx.switchToFreeformMode();
  }
}
```

**Important:** This block must run regardless of `yearBoundary` — the flag check means it runs once ever, but we need it to fire on the FIRST tick of year 1991 (which is a year boundary). Place it inside the `if (ctx.tickResult.yearBoundary)` block so it fires cleanly on year rollover.

### Step 5: Run — verify all 5 tests pass

```bash
npx jest --no-coverage --testPathPattern="HistoricalDivergence" 2>&1 | tail -15
```

Expected: 5 PASS.

### Step 6: Run full suite — no regressions

```bash
npx jest --no-coverage 2>&1 | tail -8
```

Expected: same pass count as before (≥ 6,059).

### Step 7: Commit

```bash
git add __tests__/game/HistoricalDivergence.test.ts __tests__/playthrough/helpers.ts src/game/engine/phaseChronology.ts
git commit -m "feat: fire onHistoricalEraEnd at year 1991 in historical mode (TDD)

Auto-resolves as freeform-continue if no handler registered.
Existing playthrough tests auto-resolve via mock.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: `USSRDissolutionModal.tsx` — pure component (TDD)

**Files:**
- Create: `src/ui/USSRDissolutionModal.tsx`

This is a pure component. No logic — all state lives in App.web.tsx.

### Step 1: Implement

```typescript
/**
 * USSRDissolutionModal — shown when historical mode reaches year 1991.
 *
 * Offers two paths:
 *   - End Assignment: triggers game-over → MilestoneTimelineScreen
 *   - Continue: switches to freeform governor (alternate history)
 *
 * Pure component. All decisions flow through onResolve.
 */

import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, monoFont } from './styles';

export interface USSRDissolutionModalProps {
  visible: boolean;
  onResolve: (continueInFreeform: boolean) => void;
}

export const USSRDissolutionModal: React.FC<USSRDissolutionModalProps> = ({
  visible,
  onResolve,
}) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={styles.backdrop}>
      <View style={styles.document}>
        <View style={styles.headerRow}>
          <Text style={styles.divisionLabel}>CENTRAL COMMITTEE — EYES ONLY</Text>
          <View style={styles.stamp}>
            <Text style={styles.stampText}>1991</Text>
          </View>
        </View>

        <Text style={styles.title}>THE UNION HAS DISSOLVED</Text>
        <Text style={styles.headline}>
          На 74-м году Советской власти Союз Советских Социалистических Республик прекратил своё
          существование.
        </Text>
        <View style={styles.divider} />

        <Text style={styles.body}>
          The August coup has failed. The Baltic states have declared independence. Yeltsin stands
          on a tank. Gorbachev resigns on Christmas Day.
          {'\n\n'}
          Seventy-four years of your assignment — from the revolution to this moment — are on the
          record. The file can be closed here.
          {'\n\n'}
          Or: history can diverge. In your settlement, in your alternate timeline, the Union
          survives. What comes next is unwritten.
        </Text>

        <View style={styles.divider} />

        <TouchableOpacity
          style={[styles.btn, styles.btnFreeform]}
          onPress={() => onResolve(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.btnLabel}>CONTINUE INTO ALTERNATE HISTORY</Text>
          <Text style={styles.btnSub}>The Union survives. Your assignment continues.</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnEnd]}
          onPress={() => onResolve(false)}
          activeOpacity={0.8}
        >
          <Text style={styles.btnLabel}>END ASSIGNMENT</Text>
          <Text style={styles.btnSub}>Close the file. See your historical record.</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  document: {
    width: '90%',
    maxWidth: 620,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: Colors.sovietRed,
    padding: 24,
    shadowColor: Colors.sovietRed,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  divisionLabel: {
    fontFamily: monoFont,
    fontSize: 9,
    color: Colors.textSecondary,
    letterSpacing: 2,
  },
  stamp: {
    borderWidth: 2,
    borderColor: Colors.sovietRed,
    paddingHorizontal: 10,
    paddingVertical: 4,
    transform: [{ rotate: '-3deg' }],
  },
  stampText: {
    fontFamily: monoFont,
    fontSize: 18,
    color: Colors.sovietRed,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  title: {
    fontFamily: monoFont,
    fontSize: 18,
    color: Colors.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 8,
  },
  headline: {
    fontFamily: monoFont,
    fontSize: 10,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 10,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.panelShadow,
    marginVertical: 12,
  },
  body: {
    fontFamily: monoFont,
    fontSize: 12,
    color: Colors.textPrimary,
    lineHeight: 20,
    marginBottom: 4,
  },
  btn: {
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
  },
  btnFreeform: {
    borderColor: Colors.termGreen,
    backgroundColor: 'rgba(0,230,118,0.05)',
  },
  btnEnd: {
    borderColor: Colors.textMuted,
    backgroundColor: 'transparent',
  },
  btnLabel: {
    fontFamily: monoFont,
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  btnSub: {
    fontFamily: monoFont,
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 3,
  },
});
```

### Step 2: TypeScript check — no errors in this file

```bash
npx tsc --noEmit 2>&1 | grep "USSRDissolutionModal" | head -5
```

Expected: no output (no errors for this file).

### Step 3: Commit

```bash
git add src/ui/USSRDissolutionModal.tsx
git commit -m "feat: add USSRDissolutionModal pure component

KGB dossier aesthetic. Two paths: continue freeform or end assignment.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: `MilestoneTimelineScreen.tsx` + data helper (TDD)

**Files:**
- Create: `src/ui/MilestoneTimelineScreen.tsx`
- Create: `src/ui/milestoneSummary.ts` (pure data helper — testable)
- Create: `__tests__/ui/MilestoneSummary.test.ts`

### Step 1: Write the failing test

Create `__tests__/ui/MilestoneSummary.test.ts`:

```typescript
import { buildMilestoneSummary } from '../../src/ui/milestoneSummary';
import type { TimelineLayerSaveData } from '../../src/game/timeline/TimelineLayer';
import type { RegisteredTimeline } from '../../src/game/engine/tickContext';

describe('buildMilestoneSummary', () => {
  const mockLayers: TimelineLayerSaveData[] = [
    {
      timelineId: 'world',
      activatedMilestones: ['cold_war_start', 'oil_shock'],
      activatedMilestoneYears: [['cold_war_start', 1947], ['oil_shock', 1973]],
      trackers: [],
      unlockedCapabilities: [],
    },
    {
      timelineId: 'space',
      activatedMilestones: ['sputnik'],
      activatedMilestoneYears: [['sputnik', 1957]],
      trackers: [],
      unlockedCapabilities: [],
    },
  ];

  const mockTimelines: RegisteredTimeline[] = [
    {
      id: 'world',
      milestones: [
        {
          id: 'cold_war_start', name: 'Cold War Begins', timelineId: 'world',
          order: 10, conditions: { and: [] }, sustainedTicks: 1,
          effects: { narrative: { pravdaHeadline: 'COLD WAR BEGINS', toast: '' } },
          oneShot: true,
        },
        {
          id: 'oil_shock', name: 'Oil Shock', timelineId: 'world',
          order: 20, conditions: { and: [] }, sustainedTicks: 1,
          effects: { narrative: { pravdaHeadline: 'OIL CRISIS', toast: '' } },
          oneShot: true,
        },
      ],
      state: {} as never,
    },
    {
      id: 'space',
      milestones: [
        {
          id: 'sputnik', name: 'Sputnik Launch', timelineId: 'space',
          order: 10, conditions: { and: [] }, sustainedTicks: 1,
          effects: { narrative: { pravdaHeadline: 'SPUTNIK ORBITS EARTH', toast: '' } },
          oneShot: true,
        },
      ],
      state: {} as never,
    },
  ];

  it('returns entries sorted by year', () => {
    const entries = buildMilestoneSummary(mockLayers, mockTimelines);
    const years = entries.map((e) => e.year);
    expect(years).toEqual([1947, 1957, 1973]);
  });

  it('includes timelineId, milestoneId, name, and headline', () => {
    const entries = buildMilestoneSummary(mockLayers, mockTimelines);
    const sputnik = entries.find((e) => e.milestoneId === 'sputnik');
    expect(sputnik).toEqual({
      year: 1957,
      timelineId: 'space',
      milestoneId: 'sputnik',
      name: 'Sputnik Launch',
      headline: 'SPUTNIK ORBITS EARTH',
    });
  });

  it('skips milestones with no activation year recorded', () => {
    const layers: TimelineLayerSaveData[] = [{
      timelineId: 'world',
      activatedMilestones: ['orphan'],
      activatedMilestoneYears: [], // no year recorded
      trackers: [],
      unlockedCapabilities: [],
    }];
    const entries = buildMilestoneSummary(layers, mockTimelines);
    expect(entries.find((e) => e.milestoneId === 'orphan')).toBeUndefined();
  });
});
```

### Step 2: Run — verify fails

```bash
npx jest --no-coverage --testPathPattern="MilestoneSummary" 2>&1 | tail -10
```

Expected: FAIL — module not found.

### Step 3: Implement `src/ui/milestoneSummary.ts`

```typescript
/**
 * @module ui/milestoneSummary
 *
 * Pure function: converts serialized timeline state → sorted summary entries
 * for display in MilestoneTimelineScreen.
 */

import type { TimelineLayerSaveData } from '../game/timeline/TimelineLayer';
import type { RegisteredTimeline } from '../game/engine/tickContext';

export interface MilestoneSummaryEntry {
  year: number;
  timelineId: string;
  milestoneId: string;
  name: string;
  headline: string;
}

/**
 * Build a chronologically sorted list of all activated milestones.
 * Skips milestones that have no recorded activation year.
 */
export function buildMilestoneSummary(
  layers: TimelineLayerSaveData[],
  registeredTimelines: RegisteredTimeline[],
): MilestoneSummaryEntry[] {
  const entries: MilestoneSummaryEntry[] = [];

  for (const layer of layers) {
    const yearMap = new Map(layer.activatedMilestoneYears);
    const timeline = registeredTimelines.find((t) => t.id === layer.timelineId);

    for (const milestoneId of layer.activatedMilestones) {
      const year = yearMap.get(milestoneId);
      if (year === undefined) continue;

      const def = timeline?.milestones.find((m) => m.id === milestoneId);
      entries.push({
        year,
        timelineId: layer.timelineId,
        milestoneId,
        name: def?.name ?? milestoneId,
        headline: def?.effects.narrative?.pravdaHeadline ?? '',
      });
    }
  }

  return entries.sort((a, b) => a.year - b.year);
}
```

### Step 4: Run — verify passes

```bash
npx jest --no-coverage --testPathPattern="MilestoneSummary" 2>&1 | tail -10
```

Expected: 3 PASS.

### Step 5: Implement `src/ui/MilestoneTimelineScreen.tsx`

```typescript
/**
 * MilestoneTimelineScreen — End-of-history display.
 *
 * Shows a chronological record of every milestone activated during the
 * playthrough. Shown when the player ends their assignment at the 1991
 * divergence point (not for gameplay-triggered game-overs).
 *
 * Pure component — all data passed as props.
 */

import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { MilestoneSummaryEntry } from './milestoneSummary';
import { Colors, monoFont } from './styles';

export interface MilestoneTimelineScreenProps {
  visible: boolean;
  entries: MilestoneSummaryEntry[];
  finalYear: number;
  onDismiss: () => void;
}

export const MilestoneTimelineScreen: React.FC<MilestoneTimelineScreenProps> = ({
  visible,
  entries,
  finalYear,
  onDismiss,
}) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={styles.backdrop}>
      <View style={styles.document}>
        <View style={styles.headerRow}>
          <Text style={styles.divisionLabel}>АРХИВ / HISTORICAL RECORD</Text>
          <Text style={styles.yearRange}>1917 — {finalYear}</Text>
        </View>

        <Text style={styles.title}>YOUR ASSIGNMENT IS CLOSED</Text>
        <Text style={styles.subtitle}>
          {entries.length} milestones recorded across {new Set(entries.map((e) => e.timelineId)).size} domains.
        </Text>
        <View style={styles.divider} />

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {entries.map((entry) => (
            <View key={`${entry.timelineId}-${entry.milestoneId}`} style={styles.entry}>
              <Text style={styles.entryYear}>{entry.year}</Text>
              <View style={styles.entryContent}>
                <Text style={styles.entryHeadline}>{entry.headline}</Text>
                <Text style={styles.entryMeta}>
                  {entry.name} — {entry.timelineId.toUpperCase()}
                </Text>
              </View>
            </View>
          ))}

          <View style={styles.closing}>
            <Text style={styles.closingText}>
              The records are filed.{'\n'}
              The Soviet Union is dissolved.{'\n'}
              Your file is closed.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.divider} />
        <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss} activeOpacity={0.8}>
          <Text style={styles.dismissLabel}>CLOSE FILE</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  document: {
    width: '92%',
    maxWidth: 680,
    maxHeight: '90%',
    backgroundColor: '#080808',
    borderWidth: 1,
    borderColor: Colors.textMuted,
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  divisionLabel: {
    fontFamily: monoFont,
    fontSize: 9,
    color: Colors.textSecondary,
    letterSpacing: 2,
  },
  yearRange: {
    fontFamily: monoFont,
    fontSize: 9,
    color: Colors.textMuted,
  },
  title: {
    fontFamily: monoFont,
    fontSize: 16,
    color: Colors.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: monoFont,
    fontSize: 10,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.panelShadow,
    marginVertical: 10,
  },
  scroll: {
    maxHeight: 480,
  },
  entry: {
    flexDirection: 'row',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  entryYear: {
    fontFamily: monoFont,
    fontSize: 13,
    color: Colors.sovietGold,
    fontWeight: 'bold',
    width: 48,
    marginTop: 1,
  },
  entryContent: {
    flex: 1,
  },
  entryHeadline: {
    fontFamily: monoFont,
    fontSize: 11,
    color: Colors.textPrimary,
    lineHeight: 16,
    marginBottom: 2,
  },
  entryMeta: {
    fontFamily: monoFont,
    fontSize: 9,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  closing: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  closingText: {
    fontFamily: monoFont,
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  dismissBtn: {
    borderWidth: 1,
    borderColor: Colors.textMuted,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  dismissLabel: {
    fontFamily: monoFont,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 2,
  },
});
```

### Step 6: TypeScript check

```bash
npx tsc --noEmit 2>&1 | grep -E "milestoneSummary|MilestoneTimeline" | head -10
```

Expected: no output.

### Step 7: Commit

```bash
git add src/ui/milestoneSummary.ts src/ui/MilestoneTimelineScreen.tsx __tests__/ui/MilestoneSummary.test.ts
git commit -m "feat: add MilestoneTimelineScreen + buildMilestoneSummary helper (TDD)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Wire into `App.web.tsx`

**Files:**
- Modify: `src/App.web.tsx`

### Step 1: Add state and imports

In `App.web.tsx`, add imports:
```typescript
import { USSRDissolutionModal } from './ui/USSRDissolutionModal';
import { MilestoneTimelineScreen } from './ui/MilestoneTimelineScreen';
import { buildMilestoneSummary, type MilestoneSummaryEntry } from './ui/milestoneSummary';
import { FreeformGovernor } from './ai/agents/crisis/FreeformGovernor';
```

Add state (near other modal state like `activeNarrativeEvent`):
```typescript
const [showDissolutionModal, setShowDissolutionModal] = useState(false);
const resolveDissolutionRef = useRef<((continueInFreeform: boolean) => void) | null>(null);

const [showMilestoneScreen, setShowMilestoneScreen] = useState(false);
const [milestoneEntries, setMilestoneEntries] = useState<MilestoneSummaryEntry[]>([]);
const [milestoneScreenYear, setMilestoneScreenYear] = useState(1991);
```

### Step 2: Wire `onHistoricalEraEnd` in engine init callbacks

In the engine init section (where `onNarrativeEvent` is wired), add:
```typescript
onHistoricalEraEnd: (resolve) => {
  resolveDissolutionRef.current = resolve;
  setShowDissolutionModal(true);
},
```

### Step 3: Add dissolution resolution handler

```typescript
const handleDissolutionResolve = useCallback((continueInFreeform: boolean) => {
  setShowDissolutionModal(false);
  resolveDissolutionRef.current?.(continueInFreeform);

  if (!continueInFreeform) {
    // Build milestone timeline for end screen
    const engine = getEngine();
    if (engine) {
      const subsystems = engine.serializeSubsystems();
      const registeredTimelines = engine.getRegisteredTimelines();
      const entries = buildMilestoneSummary(subsystems.timelines ?? [], registeredTimelines);
      const year = engine.getChronology().getDate().year;
      setMilestoneEntries(entries);
      setMilestoneScreenYear(year);
      setShowMilestoneScreen(true);
    }
  }
}, []);
```

### Step 4: Render the modals

In the JSX return, alongside the NarrativeEventOverlay:
```tsx
<USSRDissolutionModal
  visible={showDissolutionModal}
  onResolve={handleDissolutionResolve}
/>
<MilestoneTimelineScreen
  visible={showMilestoneScreen}
  entries={milestoneEntries}
  finalYear={milestoneScreenYear}
  onDismiss={() => setShowMilestoneScreen(false)}
/>
```

### Step 5: Add `getRegisteredTimelines()` to `SimulationEngine` if missing

```typescript
// Check if it already exists:
grep -n "getRegisteredTimelines" src/game/SimulationEngine.ts
```

If missing, add a public method:
```typescript
public getRegisteredTimelines(): RegisteredTimeline[] {
  return this.tickCtx.state.registeredTimelines;
}
```

### Step 6: TypeScript check

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules\|\.d\.ts" | grep "App.web\|USSRDissolution\|MilestoneTimeline" | head -10
```

Expected: no output.

### Step 7: Commit

```bash
git add src/App.web.tsx src/game/SimulationEngine.ts
git commit -m "feat: wire 1991 dissolution modal and milestone timeline screen into App

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Full suite verification

### Step 1: Run full Jest suite

```bash
npx jest --no-coverage 2>&1 | tail -10
```

Expected: ≥ 6,059 passing, 0 failing. Count the new tests added: +1 (TimelineIntegration) +5 (HistoricalDivergence) +3 (MilestoneSummary) = 9 new tests.

### Step 2: TypeScript check

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules\|\.d\.ts\|TS2822\|TS4114\|override\|\.name" | head -20
```

Expected: same 27 pre-existing yuka errors, nothing new.

### Step 3: Commit if clean

No new commit needed if all steps were committed individually.

---

## Task 8: E2E Tests — Historical to 1993 + Freeform Narrative Coherence

**Files:**
- Modify: `e2e/yuka-playthrough.spec.ts`

### Step 1: Add engine timeline diagnostics to `extractFullDiagnostics`

In the `extractFullDiagnostics` function, in the `try` block that accesses `engine`, add:
```typescript
// Timeline milestones
try {
  const subsystems = engine.serializeSubsystems?.();
  if (subsystems?.timelines) {
    result.activatedWorldMilestones = subsystems.timelines
      .find((t: any) => t.timelineId === 'world')?.activatedMilestones ?? [];
    result.activatedSpaceMilestones = subsystems.timelines
      .find((t: any) => t.timelineId === 'space')?.activatedMilestones ?? [];
    result.totalMilestonesActivated = subsystems.timelines
      .reduce((sum: number, t: any) => sum + (t.activatedMilestones?.length ?? 0), 0);
  }
} catch { /* */ }
```

Add to the `EngineDiagnostics` interface:
```typescript
activatedWorldMilestones: string[];
activatedSpaceMilestones: string[];
totalMilestonesActivated: number;
```

And to the default result object:
```typescript
activatedWorldMilestones: [],
activatedSpaceMilestones: [],
totalMilestonesActivated: 0,
```

### Step 2: Add `dismissDissolutionModal` helper to `runPlaythrough`

In the main `while` loop of `runPlaythrough`, after `dismissAnyModal`, add:
```typescript
// Dismiss dissolution modal (auto-continue into freeform)
const dissolutionModal = page.locator('text=CONTINUE INTO ALTERNATE HISTORY');
if (await dissolutionModal.isVisible().catch(() => false)) {
  await dissolutionModal.click();
  await page.waitForTimeout(500);
}
```

### Step 3: Add new describe blocks

```typescript
test.describe('Historical Mode — 1991 divergence', () => {
  test.beforeAll(() => {
    mkdirSync(`${SCREENSHOT_DIR}/historical-1991`, { recursive: true });
  });

  test('historical — survives to 1993 and divergence modal appears', async ({ page }) => {
    const result = await runPlaythrough(
      page, 'historical', 'rehabilitated', 76,
      `${SCREENSHOT_DIR}/historical-1991`,
    );

    console.log('\n  === Historical 1991 Divergence Results ===');
    console.log(`  Survived: ${result.survived}`);
    console.log(`  Final year: ${result.finalYear}`);
    const finalDiag = result.captures[result.captures.length - 1]?.diagnostics;
    if (finalDiag) {
      console.log(`  World milestones: ${finalDiag.activatedWorldMilestones?.join(', ')}`);
      console.log(`  Total milestones: ${finalDiag.totalMilestonesActivated}`);
    }

    // Should survive past 1991 (modal dismissed, continued in freeform)
    expect(result.finalYear).toBeGreaterThanOrEqual(1991);
    expect(result.survived).toBe(true);

    // World milestones should include cold_war_start and ussr_survives_1991
    const worldMilestones = finalDiag?.activatedWorldMilestones ?? [];
    expect(worldMilestones).toContain('cold_war_start');
    // After continuing, ussr_survives_1991 should activate
    expect(worldMilestones).toContain('ussr_survives_1991');
  });
});

test.describe('Freeform Mode — 100-year narrative coherence', () => {
  test.beforeAll(() => {
    mkdirSync(`${SCREENSHOT_DIR}/freeform-100yr`, { recursive: true });
  });

  test('freeform — 100-year run forms coherent narrative (≥5 distinct milestones)', async ({ page }) => {
    const result = await runPlaythrough(
      page, 'freeform', 'rehabilitated', 100,
      `${SCREENSHOT_DIR}/freeform-100yr`,
    );

    console.log('\n  === Freeform 100-Year Narrative Coherence ===');
    console.log(`  Survived: ${result.survived}`);
    console.log(`  Final year: ${result.finalYear}`);
    const finalDiag = result.captures[result.captures.length - 1]?.diagnostics;
    if (finalDiag) {
      console.log(`  World milestones: ${finalDiag.activatedWorldMilestones?.join(', ')}`);
      console.log(`  Space milestones: ${finalDiag.activatedSpaceMilestones?.join(', ')}`);
      console.log(`  Total milestones: ${finalDiag.totalMilestonesActivated}`);
    }

    // Should survive at least 60 years
    expect(result.finalYear).toBeGreaterThanOrEqual(START_YEAR + 60);

    // Narrative coherence: at least 5 distinct milestones across timelines
    expect((finalDiag?.totalMilestonesActivated ?? 0)).toBeGreaterThanOrEqual(5);

    // World timeline should have fired at least cold_war_start
    expect(finalDiag?.activatedWorldMilestones ?? []).toContain('cold_war_start');
  });
});
```

### Step 4: Start dev server and run E2E

```bash
# Terminal 1: start dev server
npx expo start --web --port 3000 &

# Wait for server
sleep 15

# Terminal 2: run E2E
npx playwright test e2e/yuka-playthrough.spec.ts --headed 2>&1 | tail -30
```

Expected: all existing tests pass + 2 new tests pass.

### Step 5: Commit

```bash
git add e2e/yuka-playthrough.spec.ts
git commit -m "test(e2e): add historical-1991 divergence + freeform 100yr coherence E2E tests

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 9: Final branch completion

### Step 1: Full suite one last time

```bash
npx jest --no-coverage 2>&1 | tail -8
npx tsc --noEmit 2>&1 | grep -v "node_modules\|\.d\.ts\|TS2822\|TS4114\|override\|\.name" | wc -l
```

Expected: all tests pass, 0 new TypeScript errors.

### Step 2: Use finishing-a-development-branch skill

```
Invoke: superpowers:finishing-a-development-branch
```

---

## Summary — New Files + Test Count

| File | Type | New tests |
|------|------|-----------|
| `__tests__/game/HistoricalDivergence.test.ts` | TDD | +5 |
| `__tests__/game/TimelineIntegration.test.ts` | Extended | +1 |
| `__tests__/ui/MilestoneSummary.test.ts` | TDD | +3 |
| `e2e/yuka-playthrough.spec.ts` | Extended | +2 E2E |
| `src/game/timeline/TimelineLayer.ts` | Modified | — |
| `src/game/engine/types.ts` | Modified | — |
| `src/game/engine/tickContext.ts` | Modified | — |
| `src/game/engine/phaseChronology.ts` | Modified | — |
| `src/game/SimulationEngine.ts` | Modified | — |
| `src/ui/USSRDissolutionModal.tsx` | New | — |
| `src/ui/MilestoneTimelineScreen.tsx` | New | — |
| `src/ui/milestoneSummary.ts` | New | — |
| `src/App.web.tsx` | Modified | — |

**Total new Jest tests: +9. Total E2E: +2.**
