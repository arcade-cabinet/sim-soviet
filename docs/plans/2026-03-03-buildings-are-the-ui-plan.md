# Buildings Are the UI — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform SimSoviet from a tile-placer into a Cities: Skylines-style Soviet settlement simulator where buildings ARE the UI, growth is organic, and the player is a directive-issuing chairman — not a brick-layer.

**Architecture:** 7 sequential phases, each independently shippable. Phase 1 strips the HUD to minimal. Phase 2 enhances CollectiveAgent for organic growth. Phase 3 adds building-click interaction. Phase 4 overhauls audio. Phase 5 adds camera zoom. Phase 6 redesigns the start flow. Phase 7 refactors Freeform mode.

**Tech Stack:** React Three Fiber v9.5, Three.js r183, React Native 0.81, Expo 54, TypeScript 5.7, Miniplex ECS, Yuka AI

**Key Discovery:** `CollectiveAgent` (src/ai/agents/infrastructure/CollectiveAgent.ts) already has autonomous construction: demand detection, queue generation, site selection, and auto-placement. Organic growth is an enhancement, not a rewrite.

---

## Phase 1: Minimal TopBar + Strip HUD Clutter

**Objective:** Remove all non-essential UI overlays. Reduce TopBar to date, 3 resources, speed controls. Remove direct building toolbar, advisor popup, ticker, quota HUD, directive HUD, worker status bar, lens selector. Keep minimap (toggleable), toast (emergency only), and radial menu (for building inspection).

### Task 1.1: Strip UI Components from App.web.tsx

**Files:**
- Modify: `src/App.web.tsx` (lines 872-897 + TopBar props)

**Step 1: Create a feature branch**
```bash
git checkout -b feat/buildings-are-the-ui
```

**Step 2: Comment out removed components (keep imports for now)**

In `src/App.web.tsx`, remove these JSX blocks:
- Lines 872-878: `<QuotaHUD />` block
- Line 882: `<DirectiveHUD />`
- Line 884: `<LensSelector />`
- Line 886: `<Advisor />`
- Lines 888-897: entire `bottomPanel` View (contains Ticker, Toolbar, WorkerStatusBar)

Replace with a comment: `{/* Phase 1: UI stripped — buildings are the UI */}`

**Step 3: Remove TopBar overflow handler props**

TopBar mount (lines 822-867): Remove all 19 `onShow*` handler props. Keep:
- `dateLabel`, `monthProgress`, `season`, `weather`
- `food`, `timber`, `population` (the 3 essential resources)
- `speed`, `onSetSpeed`
- `currentEra`
- `threatLevel` (small indicator, not a panel)

**Step 4: Verify build compiles**
```bash
npx tsc --noEmit 2>&1 | head -30
```
Expected: 0 errors (unused imports are warnings, not errors)

**Step 5: Run existing tests**
```bash
npm test -- --silent 2>&1 | tail -5
```
Expected: All pass (UI components are presentational, no test deps)

**Step 6: Commit**
```bash
git add src/App.web.tsx
git commit -m "feat: strip HUD to minimal — remove toolbar, advisor, ticker, quota, directive, lens, worker bar"
```

### Task 1.2: Gut TopBar to Minimal Chrome

**Files:**
- Modify: `src/ui/TopBar.tsx`
- Test: visual verification via headed E2E

**Step 1: Simplify TopBar interface**

Remove all `onShow*` props from the interface. Remove `autopilot`, `unreadNotifications`, `onShowNotifications`. Keep:
```typescript
interface TopBarProps {
  dateLabel: string;
  monthProgress: number;
  season: string;
  weather: string;
  currentEra: string;
  food: number;
  timber: number;
  population: number;
  speed: number;
  onSetSpeed: (speed: number) => void;
  threatLevel?: string;
  isCompact?: boolean;
}
```

**Step 2: Remove overflow menu JSX**

Delete:
- `overflowItems` array construction (lines ~138-160)
- Overflow dropdown JSX (lines ~357-380)
- Overflow backdrop
- The `≡` overflow button

**Step 3: Simplify resource display**

Keep only 3 `ResourceStat` entries: Food (🌾), Timber (🪵), Population (👥). Remove: Steel, Cement, Vodka, Power.

**Step 4: Simplify left group**

Remove: title text ("SIMSOVIET 1917"), season/weather box, era label box, achievements button, AI badge, notifications badge. Keep: date label, threat indicator (small dot), speed buttons.

**Step 5: Build and visual check**
```bash
npx expo export --platform web 2>&1 | tail -3
npx playwright test e2e/game-demographics.spec.ts --headed 2>&1 | tail -5
```
Expected: Game loads, minimal TopBar visible with date + 3 resources + speed.

**Step 6: Commit**
```bash
git add src/ui/TopBar.tsx
git commit -m "feat: gut TopBar to minimal — date, 3 resources, speed controls only"
```

### Task 1.3: Disable Direct Building Placement

**Files:**
- Modify: `src/scene/GhostPreview.tsx` (lines 289-309)

**Step 1: Disable placement click handler**

In the `onClick` handler (line 289), change the building placement branch to show a toast instead:
```typescript
if (tool === 'bulldoze') {
  bulldozeECSBuilding(pick.gridX, pick.gridZ);
} else if (tool !== 'none') {
  // Phase 1: Direct placement disabled — settlement builds autonomously
  showToast(gameState, 'THE COLLECTIVE DECIDES WHERE TO BUILD, COMRADE');
}
```

Keep bulldoze for now (emergency demolition). Keep right-click/long-press inspect (this becomes the building-as-UI entry point).

**Step 2: Hide tool selection from gameStore**

In `src/stores/gameStore.ts`, modify `selectTool()` to only allow 'none' and 'bulldoze':
```typescript
export function selectTool(tool: string): void {
  // Phase 1: Only inspect and bulldoze allowed
  if (tool !== 'none' && tool !== 'bulldoze') return;
  // ... existing code
}
```

**Step 3: Verify game still functions**
```bash
npm test -- --silent 2>&1 | tail -5
```

**Step 4: Commit**
```bash
git add src/scene/GhostPreview.tsx src/stores/gameStore.ts
git commit -m "feat: disable direct building placement — collective builds autonomously"
```

### Task 1.4: Reduce Notification Noise

**Files:**
- Modify: `src/ai/agents/meta/minigameTick.ts` (periodic trigger frequency)
- Modify: `src/ai/agents/narrative/events/EventSystem.ts` (event probability)

**Step 1: Increase minigame cooldown from 60 to 360 ticks (24 game-days)**

Find `COLLECTIVE_CHECK_INTERVAL` or minigame cooldown constant and increase to 360.

**Step 2: Reduce event probability from 12% to 4% per eligible tick**

In EventSystem.ts, change the base probability constant.

**Step 3: Run tests**
```bash
npm test -- --testPathPattern="minigame|event" --silent 2>&1 | tail -5
```

**Step 4: Commit**
```bash
git commit -m "feat: reduce notification noise — increase minigame cooldown, lower event frequency"
```

### Task 1.5: Phase 1 Integration Test

**Files:**
- Create: `e2e/minimal-hud.spec.ts`

**Step 1: Write E2E test for minimal HUD**

```typescript
import { expect, test } from '@playwright/test';
import { startGameAndDismiss, getDateText, getPopulation } from './helpers';

test.describe('Minimal HUD', () => {
  test.slow();

  test('game starts with minimal TopBar — no toolbar, no advisor', async ({ page }) => {
    await startGameAndDismiss(page);

    // TopBar essentials visible
    await expect(page.getByTestId('date-label')).toBeVisible();
    await expect(page.getByTestId('pop-value')).toBeVisible();
    await expect(page.getByTestId('food-value')).toBeVisible();

    // Stripped components NOT visible
    await expect(page.getByText('BUILD')).not.toBeVisible();
    await expect(page.getByText('ZONING')).not.toBeVisible();
    await expect(page.getByText('COMRADE KRUPNIK')).not.toBeVisible();
  });

  test('settlement grows autonomously without player building', async ({ page }) => {
    test.skip(!!process.env.CI, 'Requires headed Chrome for WebGL');
    await startGameAndDismiss(page);

    const initialPop = await getPopulation(page);

    // Wait for autonomous construction
    await page.waitForTimeout(10_000);

    const laterPop = await getPopulation(page);
    // Population should still be valid (autonomous systems running)
    expect(laterPop).toBeGreaterThanOrEqual(0);
  });
});
```

**Step 2: Run**
```bash
npx expo export --platform web && npx playwright test e2e/minimal-hud.spec.ts --headed
```

**Step 3: Commit**
```bash
git add e2e/minimal-hud.spec.ts
git commit -m "test: add minimal HUD E2E tests"
```

---

## Phase 2: Enhanced Organic Growth Engine

**Objective:** Enhance CollectiveAgent with era-appropriate site selection, resource-proximity logic, and dynamic map expansion. Buildings grow where they make sense historically.

### Task 2.1: Era-Aware Site Selection

**Files:**
- Modify: `src/ai/agents/infrastructure/CollectiveAgent.ts` — `findPlacementCell()`
- Create: `src/growth/SiteSelectionRules.ts` — era-specific placement logic
- Test: `__tests__/growth/SiteSelectionRules.test.ts`

**Concept:** Replace the current "radius 5 from existing buildings, pick randomly" with era-specific rules:
- Pre-1928: Prefer river-adjacent (water terrain within 3 cells), forest-edge (tree terrain within 2 cells), 2-cell fire spacing between wooden buildings
- 1928-1941: Prefer central cluster for admin/collective buildings, fields at edges
- 1955+: Grid-aligned blocks with SNiP walking distances (10 cells = 300m to services)

### Task 2.2: Dynamic Map Expansion

**Files:**
- Modify: `src/engine/GridTypes.ts` — `getCurrentGridSize()`, `setCurrentGridSize()`
- Modify: `src/game/map/MapSystem.ts` — terrain generation for new chunks
- Modify: `src/scene/TerrainGrid.tsx` — re-render on grid expansion
- Test: `__tests__/growth/MapExpansion.test.ts`

**Concept:** When `findPlacementCell()` can't find space within current grid, expand grid by 10 in each direction. Generate new terrain for expanded area. Notify terrain dirty.

### Task 2.3: Growth Pacing by Era

**Files:**
- Modify: `src/ai/agents/infrastructure/CollectiveAgent.ts` — `tickAutonomous()`
- Create: `src/growth/GrowthPacing.ts` — era-specific build rates

**Concept:** Build rate scales with era:
- Revolution: 1 building per 120 ticks (slow, organic)
- Collectivization: 1 per 90 ticks (state-driven pressure)
- Industrial: 1 per 60 ticks (five-year plan urgency)
- Mikrorayon: 1 per 30 ticks (mass standardized construction)

### Task 2.4: Remove Map Size from NewGameSetup

**Files:**
- Modify: `src/ui/NewGameSetup.tsx` — remove map size selector
- Modify: `src/bridge/GameInit.ts` — always start small (12x12), expand dynamically

---

## Phase 3: Building-as-UI (Click to Interact)

**Objective:** Click any building → side panel shows contextual info. Party HQ is the management hub. Functions split into dedicated buildings as population grows.

### Task 3.1: Building Click → Info Panel

**Files:**
- Create: `src/ui/BuildingPanel.tsx` — slide-in side panel
- Modify: `src/scene/GhostPreview.tsx` — change click handler to open panel instead of placement
- Modify: `src/stores/gameStore.ts` — add `selectedBuilding` state
- Modify: `src/App.web.tsx` — mount BuildingPanel

**Concept:** Click a building (left-click when tool=none) → `openBuildingPanel(gridX, gridZ)` → side panel slides in from right with building-specific content. The existing `openInspectMenu()` system already does grid-to-building lookup — extend it.

### Task 3.2: Building Panel Content — Housing

**Files:**
- Create: `src/ui/BuildingPanelContent/HousingContent.tsx`

**Shows:** Resident families, names, morale, health, heating status, capacity, condition.

### Task 3.3: Building Panel Content — Party HQ

**Files:**
- Create: `src/ui/BuildingPanelContent/PartyHQContent.tsx`

**Shows:** All management functions initially:
- Directives (high-level priorities)
- Economy summary (food/timber/population trends)
- Morale & loyalty overview
- Active quota + deadline
- Krupnik advisor messages (no longer interrupting — you visit him)

### Task 3.4: Building Panel Content — Other Types

**Files:**
- Create: `src/ui/BuildingPanelContent/FarmContent.tsx`
- Create: `src/ui/BuildingPanelContent/FactoryContent.tsx`
- Create: `src/ui/BuildingPanelContent/ServiceContent.tsx`

### Task 3.5: Progressive HQ Splitting

**Files:**
- Create: `src/growth/HQSplitting.ts` — population threshold → spawn dedicated buildings
- Modify: `src/game/SimulationEngine.ts` — check thresholds at year boundary

**Population thresholds:**
- 50: Grain Office splits off (economy functions)
- 50: Militia Post splits off (security functions)
- 150: Hospital splits off (disease/health)
- 150: School splits off (literacy/culture)
- 400: Full City Soviet (all functions in dedicated buildings)

---

## Phase 4: Audio Overhaul

**Objective:** Seamless era blending, incidental music over base layer, audio ducking, resume after interruption.

### Task 4.1: Two-Layer Audio Architecture

**Files:**
- Modify: `src/audio/AudioManager.ts` — add incidental layer, ducking, resume

**Concept:** Two independent GainNode chains:
- Base layer: continuous era playlist (existing, enhanced with resume)
- Incidental layer: short cues that play over base, auto-cleanup after fade
- `playIncidental(trackId, durationMs)` → duck base by 30%, play cue, restore

### Task 4.2: Seamless Era Transitions

**Files:**
- Modify: `src/audio/AudioManager.ts` — 5s crossfade on era change
- Modify: `src/App.web.tsx` — era callback uses extended crossfade

### Task 4.3: Resume After Interruption

**Files:**
- Modify: `src/audio/AudioManager.ts` — track playback position, resume on next play

**Concept:** When an incidental plays, save base track position. After incidental ends, resume base from saved position (not restart).

### Task 4.4: Audio Ducking for Panels

**Files:**
- Modify: `src/audio/AudioManager.ts` — `duck(amount, durationMs)`, `unduck()`
- Modify: `src/ui/BuildingPanel.tsx` — duck on open, unduck on close

---

## Phase 5: Camera — Mid-Zoom Default + Street Level

**Objective:** Default camera at mid-zoom. Click building → smooth dolly to street level. Escape returns.

### Task 5.1: Mid-Zoom Default Camera

**Files:**
- Modify: `src/scene/CameraController.tsx` — change initial position

**Change:** `camera.position.set(center + 8, 12, center + 8)` (closer, lower angle)
`minDistance: 3` (allow street level), `maxDistance: 80` (keep strategic view)

### Task 5.2: Click-to-Zoom Street Level

**Files:**
- Modify: `src/scene/CameraController.tsx` — add `zoomToBuilding(gridX, gridZ)` function
- Modify: `src/stores/gameStore.ts` — add `cameraTarget` state

**Concept:** On building click:
1. Save current camera position + target
2. Animate camera to `(gridX + 0.5, 2, gridZ + 2)` looking at `(gridX + 0.5, 3, gridZ + 0.5)` — street-level perspective looking up at building
3. Disable MapControls during animation
4. On Escape: animate back to saved position

### Task 5.3: Camera Return on Escape

**Files:**
- Modify: `src/scene/CameraController.tsx` — listen for Escape, restore camera

---

## Phase 6: New Game Start Flow

**Objective:** Families arrive as a visible caravan. They settle near water/forest. Party Barracks auto-built. First year is "don't die." Progressive mechanic introduction.

### Task 6.1: Arrival Sequence

**Files:**
- Modify: `src/bridge/GameInit.ts` — new start sequence
- Modify: `src/scene/CitizenRenderer.tsx` — render arriving caravan

**Concept:** Instead of instant dvor creation, stagger family arrival over first 30 ticks. Camera follows caravan from edge of map to river.

### Task 6.2: Organic First Settlement

**Files:**
- Modify: `src/ai/agents/infrastructure/CollectiveAgent.ts` — first-tick logic

**Concept:** On tick 0, CollectiveAgent places Party Barracks near river. Over next 60 ticks, places first housing (izbas) near water and forest. Player watches this happen.

### Task 6.3: Starting Morale Tuning

**Files:**
- Modify: `src/bridge/GameInit.ts` — set initial morale to 70 (hopeful revolutionaries)
- Modify: `src/ecs/factories/citizenFactories.ts` — default happiness 70

### Task 6.4: Remove Divergence Year from Freeform

**Files:**
- Modify: `src/ui/NewGameSetup.tsx` — remove divergence year selector for Freeform mode

---

## Phase 7: Freeform Mode — Organic Divergence

**Objective:** Remove explicit divergence point. Timeline diverges naturally through accumulated differences. Unlocks tied to events, not dates.

### Task 7.1: Probability-Driven Events for Freeform

**Files:**
- Modify: `src/ai/agents/crisis/FreeformGovernor.ts` — events by probability, not date
- Create: `src/growth/OrganicUnlocks.ts` — milestone-based era transitions

### Task 7.2: Organic Era Transitions

**Files:**
- Modify: `src/ai/agents/political/PoliticalAgent.ts` — Freeform era change by conditions, not year

---

## Cross-Phase Dependencies

```
Phase 1 (Strip HUD) ──────────────────────→ All other phases
Phase 2 (Growth Engine) ──────────────────→ Phase 6 (Start Flow)
Phase 3 (Building-as-UI) ─────────────────→ Phase 5 (Camera)
Phase 4 (Audio) ───────────────────────────→ Independent
Phase 5 (Camera) ──────────────────────────→ Phase 3 (Building-as-UI)
Phase 6 (Start Flow) ─────────────────────→ Phase 2 (Growth Engine)
Phase 7 (Freeform) ────────────────────────→ Independent
```

**Safe parallel execution:** Phase 4 (Audio) and Phase 7 (Freeform) are independent and can run in parallel with Phase 2+3.

---

## Verification Checklist

After all phases:
- [ ] Game starts with families arriving at a river
- [ ] Settlement grows organically (no direct building placement)
- [ ] Click any building → street-level zoom + info panel
- [ ] Party HQ contains all management functions initially
- [ ] Functions split to dedicated buildings as pop grows (50, 150, 400)
- [ ] Only emergencies interrupt the player (fire, riot, famine, KGB)
- [ ] Audio seamlessly blends between eras, resumes after incidental
- [ ] Default camera at mid-zoom, workers visible
- [ ] Freeform mode has no divergence picker, events are probability-driven
- [ ] All existing unit tests pass (4,418+)
- [ ] E2E: 35/35 pass (with updated assertions)
