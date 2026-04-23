# Design Doc Alignment — Phase 2

## Context

The game has ~95% design doc coverage across 9 documents, but several UI/UX specs from `docs/design/ui-ux.md` and `docs/design/economy.md` remain unimplemented. The previous session completed the tabbed dossier NewGameFlow and responsive radial menus. This plan continues closing the remaining gaps.

### Exploration Findings

| Gap | Status | Effort |
|-----|--------|--------|
| Blat KGB risk | Already implemented (both transaction + passive tick) | None |
| Cold storage building def | Code in `storageSystem.ts` ready, building def missing from JSON | Small |
| CitizenDossierModal wiring | Component exists (369 lines), not connected to tap interaction | Medium |
| BottomStrip building output | 3 context modes exist, missing production/power display | Small |
| Radial household outer ring | Shows demographic counts, no individual citizen wedges | Medium |

---

## Plan: 3 Targeted Fixes (skipping blat — already done)

### 1. Cold Storage Building Definition

**Problem:** `storageSystem.ts` has cold storage spoilage reduction logic (`hasColdStorage` flag), but no building definition exists in `buildingDefs.generated.json` to actually build one.

**Files:**
- `scripts/generate_building_defs.ts` — Add `cold_storage` entry to the generation script
- `src/data/buildingDefs.generated.json` — Regenerated output (via `pnpm pipeline:defs`)
- `src/data/buildingDefs.schema.ts` — May need schema update if new fields needed

**Spec (from `docs/design/economy.md`):**
- Name: "Cold Storage Facility"
- Role: `storage`
- Era: Thaw (khrushchev_thaw) or later
- Effect: Reduces food spoilage rate (already coded as `hasColdStorage` check)
- Stats: capacity 400, powerReq ~20W, jobs ~8, cost ~800
- Footprint: 2x2

**Approach:**
1. Read `generate_building_defs.ts` to understand the entry format
2. Add `cold_storage` definition matching existing storage building patterns
3. Run `pnpm pipeline:defs` to regenerate JSON
4. Verify `storageSystem.ts` already detects it (it checks for buildings with storage role that reduce spoilage)

### 2. Wire CitizenDossierModal to Tap Interactions

**Problem:** `CitizenDossierModal.tsx` exists with basic citizen data display, but there's no way to open it — no tap handler connects to it.

**Files:**
- `src/components/ui/RadialInspectMenu.tsx` — Add "Dossier" action to household building type
- `src/stores/gameStore.ts` — Add `openCitizenDossier(entityId)` action + state slice
- `src/components/ui/CitizenDossierModal.tsx` — May need to accept entityId prop and look up data
- `app/App.tsx` or `app/components/GameModals.tsx` — Render the modal when state is set

**Spec (from `docs/design/ui-ux.md`):**
- Citizen Dossier shows: name, age, gender, class, morale, loyalty, skill, health, vodka dependency
- Opens from: tapping a citizen on the map OR from the housing inspect menu
- Soviet bureaucratic styling (manila folder aesthetic)

**Approach:**
1. Add a `citizenDossier` state slice to `gameStore.ts` (`{ entityId: string } | null`)
2. Add `openCitizenDossier(entityId)` / `closeCitizenDossier()` actions
3. Add a "Dossier" action wedge to `RadialInspectMenu` for housing buildings — clicking it on a specific occupant opens the dossier
4. Render `CitizenDossierModal` in `GameModals.tsx` when the state is set
5. Enhance the modal with missing stats (trudodni, skill, health, vodka) if not already present

### 3. BottomStrip Building Output Display

**Problem:** When a production building is selected, the BottomStrip shows basic info but doesn't display production output or power generation stats.

**Files:**
- `src/components/ui/BottomStrip.tsx` — Add production/power output to building context mode
- `src/stores/gameStore.ts` — Check if building snapshot includes production data

**Spec (from `docs/design/ui-ux.md`):**
- Building context mode shows: name, health bar, worker count, production output, power status
- Production buildings: show resource output per tick
- Power buildings: show power generation

**Approach:**
1. Read `BottomStrip.tsx` to understand the building context mode structure
2. Add production output display (resource name + amount/tick) using `getBuildingDef()` stats
3. Add power output display for power buildings
4. Style to match existing BottomStrip typography (VT323 monospace, soviet gold accents)

---

## Implementation Order

1. **Cold storage building def** — smallest change, unblocks gameplay feature
2. **BottomStrip building output** — small UI enhancement, visible impact
3. **CitizenDossierModal wiring** — medium effort, connects existing component

## NOT in this phase (deferred)

- **Radial household outer ring with individual citizen wedges** — Complex SVG work for individual citizen selection in the outer ring. Better suited for a dedicated session.
- **Population browser** — Full-screen citizen list view. Large feature, not yet started.

---

## Verification

1. `pnpm pipeline:defs` — regenerates JSON with cold storage
2. `pnpm typecheck` — clean
3. `pnpm lint` — clean
4. `pnpm test` — all pass
5. Manual verification:
   - Build a cold storage facility in Khrushchev Thaw era
   - Select a production building → BottomStrip shows output stats
   - Inspect a housing building → "Dossier" action → opens CitizenDossierModal
6. Commit + PR
