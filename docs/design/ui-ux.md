---
title: UI/UX — Mobile-First Brutalist
status: Partial
implementation: src/components/ui/, src/components/screens/, app/App.tsx
tests: src/__tests__/ConcreteFrame.test.tsx, src/__tests__/NewGameFlow.test.tsx
last_verified: 2026-02-10
coverage: "Landing page, new game flow, HUD, drawer, radial build menu — MISSING: universal context menu, building interiors, citizen dossier, population registry"
depends_on: [demographics.md, workers.md, political.md, economy.md]
---

# UI/UX — Mobile-First Brutalist

## Design Language

- **Brutalist Soviet aesthetic**: Raw concrete textures, industrial fonts, propaganda red accents
- **Functional, not decorative**: Every pixel serves gameplay
- **Thin chrome**: Maximize game viewport on phone screens
- **No floating menus**: Everything docked to edges or contextual overlays
- **CRT scanline overlay**: Existing effect, kept subtle

---

## Key Panels

### Top Bar (Always Visible)
```
┌─────────────────────────────────────────┐
│ ☆ ERA: Industrialization  │ 1937 Feb    │
│ 👥127  🌾450  🍶30  ⚡80  Blat:34      │
└─────────────────────────────────────────┘
```
- Era name + year/month
- Worker count, food, vodka, power, blat level
- Tap any resource → expanded detail overlay
- Black mark indicator (subtle — file icon with number)

### Bottom Panel (Context-Sensitive)

**Default** — Worker summary:
```
┌─────────────────────────────────────────┐
│ Idle: 12 │ Farm: 45 │ Factory: 30       │
│ Building: 8 │ Military: 15 │ [Auto] ▶   │
└─────────────────────────────────────────┘
```

**Workers selected**:
```
┌─────────────────────────────────────────┐
│ 3 workers selected                      │
│ [Farm] [Factory] [Build] [Power] [Idle] │
└─────────────────────────────────────────┘
```

**Building tapped**:
```
┌─────────────────────────────────────────┐
│ COLLECTIVE FARM HQ                      │
│ Workers: 12/20  │  Output: 45 food/tick │
│ [+Worker] [-Worker] [Details]           │
└─────────────────────────────────────────┘
```

### Event Modal
```
┌─────────────────────────────────────────┐
│         DECREE FROM MOSCOW              │
│                                         │
│  "The Party requires 40% of workers    │
│   for military service immediately."    │
│                                         │
│  Deadline: 30 ticks                     │
│                                         │
│  [Select Workers]     [Auto-Comply]     │
└─────────────────────────────────────────┘
```

### Pravda Ticker
Scrolling satirical headlines above the bottom panel.

---

## Gesture Controls

| Gesture | Action |
|---------|--------|
| Tap empty tile | Radial BUILD menu (category ring → building ring → place) |
| Tap building | Radial INSPECT menu (Info / Workers / Production / Occupants / Demolish) |
| Tap housing | Radial HOUSEHOLD menu (Men / Women / Children / Elders → individuals → dossier) |
| Tap worker dot | Citizen Dossier modal (personnel file, household, stats, commissar notes) |
| Drag on map | Pan camera |
| Pinch | Zoom (clamped to map bounds) |
| Long-press building | Quick info tooltip (production rate, worker count, efficiency) |
| Swipe up on bottom panel | Expand Pravda ticker to full headlines view |

---

## Unsolved UI Questions

These need design before implementation:

### Pause / Speed Controls — DESIGNED

**Location**: Right side of top bar, minimal footprint.

```
┌───────────────────────────────────────────┐
│ ☆ ERA  │ 1937 Feb  │  ▶ 1× │ ⏸ │ ⏩ 3× │
└───────────────────────────────────────────┘
```

- **Tap ▶/⏸**: Toggle pause/play
- **Tap speed indicator**: Cycle through 1× → 2× → 3× → 1×
- **Auto-pause triggers**: Critical events (KGB, conscription, 5-year plan) auto-pause the sim
- **Visual cue**: When paused, subtle pulsing border on the game viewport. Speed indicator text changes color (white=1×, yellow=2×, red=3×)
- **No slow motion**: Minimum speed is 1×. Pause is binary (on/off)

### Notification System — DESIGNED

Three tiers of notification, escalating by urgency. All work within the existing brutalist UI frame.

**Tier 1: Ambient (low priority)**
- **Pravda Ticker**: Scrolling satirical headlines — doubles as ambient notification ("PRODUCTION AT FACTORY #3 EXCEEDS EXPECTATIONS")
- **Building badges**: Small icons on buildings visible at all zoom levels. Red ! = needs attention. Yellow ⚡ = no power. Green ✓ = operating normally.
- **Worker dots**: Workers near starvation/low morale change color to red (visible even at medium zoom)

**Tier 2: Alert (medium priority)**
- **Edge indicators**: Small directional arrows at screen edge pointing toward off-screen events. Color-coded: red = danger (fire, KGB), yellow = attention (orgnabor, politruk), green = opportunity (Moscow assignment)
- **Toast notifications**: Brief text pop-up in top-right corner, auto-dismiss after 3 seconds. Tap to pan camera to event location. Stack up to 3 toasts.
- **Sound cues**: Distinctive audio per event type:
  - Marching boots = military/conscription
  - Siren = KGB arrival
  - Factory whistle = production milestone
  - Church bell (later: loudspeaker) = new 5-year plan
  - Thunder = weather event

**Tier 3: Critical (high priority)**
- **Event modal**: Full-screen modal for critical decisions (KGB investigation, conscription order, 5-year plan). Game auto-pauses.
- **Advisor Krupnik**: Comrade Krupnik appears in corner with urgent advice. Tap to hear full dialog.
- **Screen flash**: Brief red border flash for catastrophic events (building collapse, mass starvation). Subtle, not jarring.

**Notification Log**:
- Swipe down from top bar → scrollable log of last 50 notifications with timestamps
- Tapping a log entry pans camera to that location (if spatial)
- Log entries color-coded by type (political=red, economic=yellow, social=blue, military=green)

### Tutorial / Onboarding — DESIGNED

**No tutorial mode.** Era 1 (Revolution) IS the tutorial. You start with ~55 people in 10 dvory and nothing else. Comrade Krupnik (advisor) teaches through contextual dialog.

**Progressive Disclosure Schedule**:

| Tick Range | Mechanic Introduced | Krupnik Says |
|-----------|---------------------|-------------|
| 0-10 | Watch collective self-organize (workers auto-assign to survival tasks) | "Comrade Predsedatel, your collective is already at work. They know what needs doing. Your job is to watch — and to worry." |
| 10-30 | Build first structure (kolkhoz HQ) — tap empty tile | "The party expects you to establish order. Tap the ground and place the kolkhoz headquarters." |
| 30-60 | Workers auto-assign to farm; adjust priorities if needed | "The collective tends the fields. If you want more hands there, change the priority. But they'll figure it out." |
| 60-120 | First harvest, storage | "Good harvest, Comrade! But food rots without storage. Build a root cellar." |
| 120-180 | Winter survival, heating (pechka) | "The cold will kill before hunger. Cut timber. Feed the stove." |
| 180-360 | First quota arrives | "Moscow has expectations. This is your quota. Meet it... or explain why you didn't." |
| Year 2 | First politruk arrives | "A political officer has been assigned. He is... helpful. Do not make him unhappy." |
| Year 3 | Black marks explained | "Your file in Moscow, Comrade. It grows. Each mark is a step toward... inconvenience." |
| Year 4+ | Full mechanics unlocked | Krupnik commentary becomes ambient/reactive |

**Key principles**:
- Never show more than 2 UI elements at once in the first 5 minutes
- No text walls — 1-2 sentences per Krupnik dialog
- Player can always dismiss tutorial prompts (but the mechanic still works)
- Krupnik's tone shifts: helpful in Era 1, sardonic by Era 3, darkly fatalistic by Era 7
- New mechanics in later eras get brief "era intro" dialog (e.g., entering Industrialization: "Comrade, Moscow requires factories now. Steel will arrive. Workers will be... reassigned.")

### Settings Menu
- Volume controls (music, SFX, ambient)
- Language (future)
- Accessibility: color-blind mode for worker role colors
- Save/load UI
- Difficulty display (can't change mid-game)

### Save / Load
- Autosave every N ticks
- Manual save: 3 slots per campaign
- Era checkpoints saved automatically
- Save format: JSON or sql.js database (Phase 5 of overhaul plan)

---

## Universal Radial Context Menu

The radial pie menu is **the** primary interaction pattern for all game entities. Same visual language (inner ring → outer ring), different content based on what was tapped. Game **pauses** when any modal-depth interaction opens.

### Context: Empty Tile (BUILD mode — existing)

```
┌─────────────────────────────────────┐
│         EMPTY TILE TAPPED           │
│                                     │
│  Inner Ring: BUILD categories       │
│    Housing │ Industry │ Utility     │
│    Services │ Govt │ Military       │
│                                     │
│  Outer Ring: Buildings in category  │
│    (era + tier gated, shows cost)   │
│                                     │
│  Select → Place foundation          │
└─────────────────────────────────────┘
```

### Context: Existing Building (INSPECT mode — NEW)

When tapping an occupied tile, the radial menu opens with **action categories** instead of build categories.

**Inner ring — Action categories** (varies by building type):

| Building Type | Available Actions |
|---------------|-------------------|
| **All buildings** | Info, Workers, Demolish |
| **Production** (farm, factory, distillery) | + Production |
| **Housing** (apartments, barracks, communal) | + Occupants |
| **Storage** (granary, warehouse) | + Inventory |
| **Government** (party HQ, ministry) | + Records |
| **Military** (barracks, draft office) | + Draft Board |
| **Under construction** | + Construction (progress, materials) |

**Outer ring — Detail/sub-actions** per selected category:

```
┌─────────────────────────────────────┐
│       COLLECTIVE FARM TAPPED        │
│                                     │
│  Inner Ring: [Info] [Workers]       │
│              [Production] [Demolish]│
│                                     │
│  User taps "Workers" →              │
│  Outer Ring:                        │
│    [Ivan P. ★★☆] [Olga K. ★☆☆]    │
│    [+Assign Worker] [Auto-fill]     │
│                                     │
│  Tap worker wedge → Citizen Dossier │
│  Tap +Assign → enters assign mode   │
└─────────────────────────────────────┘
```

### Context: Housing Building (HOUSEHOLD mode — NEW)

Housing buildings show **demographic breakdown** as the primary interaction, since their function is about *who lives there*.

```
┌─────────────────────────────────────┐
│     COMMUNAL APARTMENTS TAPPED      │
│                                     │
│  Inner Ring: demographic categories │
│    [Men (4)] [Women (6)]            │
│    [Children (8)] [Elders (2)]      │
│                                     │
│  User taps "Women" →                │
│  Outer Ring: individual women       │
│    [Olga K., 32] [Maria S., 28]    │
│    [Daria P., 45] [Vera T., 19]    │
│    [Anya M., 38] [Nina R., 52]    │
│                                     │
│  Tap name → Citizen Dossier modal   │
└─────────────────────────────────────┘
```

For **single-occupant buildings** (worker barracks for unmarried individuals, guard posts), skip the demographic ring — go directly to the occupant list.

For **communal housing with 20+ families**, the demographic ring shows totals and the outer ring pages (swipe or "▸ More" wedge).

### How This Replaces the Old System

| Old Pattern | New Pattern |
|-------------|-------------|
| Tap empty tile → RadialBuildMenu | Same (inner=categories, outer=buildings) |
| Tap building → floating BuildingInspector card | Tap building → radial with action categories |
| Tap worker dot → WorkerInfoPanel | Worker accessed through building's "Workers" or "Occupants" ring |
| Separate "Assignment Mode" tap-to-assign flow | "Assign Worker" wedge in building's Workers ring |
| No way to see all building occupants | Housing → demographic ring → individual list |
| No building interior concept | Each building type has meaningful interior data |

The key insight: **buildings are not faceless props. Every building tells a story.** The radial menu forces each building to declare what it *does* and who is *inside*.

---

## Building Interior Data

Each building type exposes meaningful information through the radial inspect mode. This is NOT decorative — it's the control panel for managing that building.

### Production Buildings (Farm, Factory, Distillery)

| Radial Action | What It Shows |
|---------------|---------------|
| **Info** | Name, defId, era built, durability, powered status, efficiency % |
| **Workers** | Assigned workers (wedges with names + skill stars). +Assign / Auto-fill wedges. Tap worker → dossier. |
| **Production** | Current output/tick, input requirements, storage levels, seasonal modifier, stakhanovite status |
| **Demolish** | Confirmation prompt. Frees workers. Recovers partial materials. |

### Housing Buildings

| Radial Action | What It Shows |
|---------------|---------------|
| **Men** | List of male occupants with ages. Tap → dossier. |
| **Women** | List of female occupants with ages. Tap → dossier. |
| **Children** | List of children with ages. Shows when each becomes working-age. |
| **Elders** | List of elders. Shows labor capacity, childcare status. |
| **Info** | Occupancy rate, heating status, private plot status (if applicable), durability. |

### Government Buildings (Party HQ, Ministry)

| Radial Action | What It Shows |
|---------------|---------------|
| **Info** | Building function, era built, political influence radius |
| **Workers** | Assigned officials/bureaucrats |
| **Records** | Settlement's political standing, recent decrees, pripiski history |

### Military Buildings

| Radial Action | What It Shows |
|---------------|---------------|
| **Info** | Building stats |
| **Draft Board** | Current conscription status, pending drafts, exempt workers list |
| **Workers** | Assigned military personnel |

### Under-Construction Buildings

| Radial Action | What It Shows |
|---------------|---------------|
| **Construction** | Progress bar (foundation/building/complete), materials consumed vs. required, estimated ticks to completion |
| **Workers** | Construction workers assigned. +Assign more to speed up. |
| **Info** | What the building will become when complete. |

---

## Citizen Dossier Modal

Tapping an individual citizen (from any radial outer ring) opens a **full-screen modal** that **pauses the game**. This is the personnel file for that person — everything the state knows about them.

```
┌─────────────────────────────────────────────────┐
│            PERSONNEL FILE: OLGA KUZNETSOVA      │
│                                                 │
│  ┌──────┐  Age: 32        Gender: Female        │
│  │ 👩‍🌾  │  Role: Worker    Class: Farmer         │
│  │      │  Dvor: Kuznetsov Household (#2)       │
│  └──────┘  Labor Capacity: 0.7 (infant penalty) │
│                                                 │
│  ─── HOUSEHOLD ──────────────────────────────── │
│  Head: Pyotr Kuznetsov (husband, 35, farmer)    │
│  Children:                                      │
│    • Nikolai (8, child — non-productive)        │
│    • Anna (3, child — non-productive)           │
│    • [INFANT] Unnamed (0 — high mortality risk) │
│  Elder: Baba Marfa (mother-in-law, 63, light    │
│         duties — provides childcare)            │
│                                                 │
│  ─── LABOR ──────────────────────────────────── │
│  Assignment: Collective Farm (field work)       │
│  Trudodni this year: 187 / 250 minimum          │
│  Trudodni category: 3 (standard field work)     │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 74%       │
│                                                 │
│  ─── STATS ──────────────────────────────────── │
│  Morale:  ██████████░░░░░░ 62%                  │
│  Loyalty: ████████████░░░░ 78%                  │
│  Skill:   ████████░░░░░░░░ 45%                  │
│  Health:  ██████████████░░ 88%                  │
│  Vodka:   ░░░░░░░░░░░░░░░░ 0% (no dependency)  │
│                                                 │
│  ─── POLITICAL RECORD ───────────────────────── │
│  Black marks: 0                                 │
│  Commissar notes: "Reliable. Quiet. Keeps       │
│    to herself. Fulfills quota."                 │
│  KGB file: [NO FILE]                            │
│  Draft status: EXEMPT (female)                  │
│                                                 │
│  ─── ACTIONS ────────────────────────────────── │
│  [REASSIGN]  [VIEW FAMILY]  [DISMISS]           │
└─────────────────────────────────────────────────┘
```

### What Each Section Shows

| Section | Content | Source System |
|---------|---------|--------------|
| **Header** | Name, age, gender, role, class, dvor, labor capacity | DvorComponent + CitizenComponent |
| **Household** | All family members in same dvor. Tap any → their dossier. | DvorComponent.members |
| **Labor** | Assignment, trudodni earned vs minimum, category | EconomySystem trudodni tracking |
| **Stats** | Morale, loyalty, skill, health, vodka | WorkerSystem hidden stats |
| **Political Record** | Black marks, commissar notes (generated), KGB file status, draft status | PersonnelFile + PoliticalEntitySystem |
| **Actions** | Reassign to different building, view full family tree, close panel | Player interaction |

### Commissar/KGB Comments

These are **procedurally generated** from the dialogue pools, not stored verbatim. When the dossier opens:

```typescript
// Generate commissar comment from citizen stats + context
const comment = selectDialogue('politruk', {
  targetMorale: citizen.morale,
  targetLoyalty: citizen.loyalty,
  hasBlackMarks: citizen.blackMarks > 0,
  era: currentEra,
});
```

Examples:
- High loyalty, no marks: *"Reliable. Quiet. Keeps to herself. Fulfills quota."*
- Low morale, 1 mark: *"Subject displays insufficient enthusiasm. Previous incident noted. Recommend closer observation."*
- Under KGB investigation: *"FILE RESTRICTED — SEE DISTRICT OFFICE"*
- Stakhanovite: *"Model worker. Exceeds norms consistently. Recommended for commendation."*

---

## Population Browser (Hamburger Menu)

Accessible from `DrawerPanel` → "POPULATION REGISTRY" button. Full-screen overlay with the game paused.

```
┌─────────────────────────────────────────────────┐
│              POPULATION REGISTRY                │
│  Selo "Krasnaya Zarya" — 10 Dvory, 55 Citizens  │
│                                                  │
│  [ALL (55)] [MEN (14)] [WOMEN (15)] [CHILDREN(17)]│
│  [ELDERS (9)]                                    │
│                                                 │
│  Sort: [Name ▼] [Age] [Dvor] [Assignment]       │
│        [Morale] [Trudodni]                      │
│  Search: [________________]                     │
│                                                 │
│  ─── WORKERS ────────────────────────────────── │
│  🟤 Pyotr Kuznetsov    35  M  Farm      ██ 72% │
│  🟢 Ivan Volkov        42  M  Farm      ██ 65% │
│  🟤 Olga Kuznetsova    32  F  Farm      ██ 62% │
│  🟤 Yelena Volkova     38  F  Farm      ██ 58% │
│  🟤 Dmitri Volkov      17  M  Idle      ██ 70% │
│  🟤 Masha Petrova      28  F  HQ        ██ 55% │
│  🟤 Alexei Petrov      22  M  Build     ██ 67% │
│  🔴 Comrade Orlov      34  M  HQ (Chair)██ 80% │
│                                                 │
│  ─── ADOLESCENTS ────────────────────────────── │
│  🔵 Kolya Kuznetsov    14  M  Herding   ██ 75% │
│  🔵 Dasha Volkova      15  F  Poultry   ██ 68% │
│                                                 │
│  ─── CHILDREN ───────────────────────────────── │
│  ⚪ Nikolai K.      8  │ ⚪ Sasha V.     6     │
│  ⚪ Anna K.         3  │ ⚪ Baby K.      0     │
│  ⚪ Tanya P.        4                          │
│                                                 │
│  ─── ELDERS ─────────────────────────────────── │
│  🟡 Baba Marfa V.   63  F  Childcare   ██ 40% │
│                                                 │
│  ─── BULK ACTIONS ───────────────────────────── │
│  [ASSIGN ALL IDLE → FARM]  [AUTO-ASSIGN]        │
│  [EXPORT REGISTRY]                              │
└─────────────────────────────────────────────────┘
```

### Features

| Feature | Description |
|---------|-------------|
| **Filter tabs** | All, Men, Women, Children, Elders. Counts shown per tab. |
| **Sort** | By name, age, dvor, assignment, morale, trudodni. Toggle ascending/descending. |
| **Search** | Filter by name substring. Instant. |
| **Tap row** | Opens Citizen Dossier for that person. |
| **Bulk actions** | "Assign All Idle" sends unassigned workers to selected building type. "Auto-assign" uses WorkerSystem AI. |
| **Statistics header** | Total pop, dvory count, worker count, idle count, average morale, trudodni progress. |
| **Color coding** | Class color dots match worker dot colors on map. Morale bar color: green > yellow > red. |

### Why This Matters

Without a population browser, the player has no way to:
- Find a specific worker by name
- See who is idle vs assigned
- Identify low-morale workers before they defect
- Manage conscription decisions (who to sacrifice)
- Understand dvor composition across the settlement
- Take bulk actions on groups

---

## Interaction Flow Summary

```
TAP EMPTY TILE
  └→ Radial: Build categories → Buildings → Place

TAP EXISTING BUILDING
  └→ Radial: Action categories → Sub-actions
     ├→ Workers ring → Tap worker → Citizen Dossier (pause)
     ├→ Occupants ring (housing) → Demographics → Individual → Dossier
     ├→ Production ring → Output/input stats
     ├→ Info ring → Building stats
     └→ Demolish → Confirm

TAP HAMBURGER → POPULATION REGISTRY
  └→ Full-screen list → Filter/Sort → Tap row → Citizen Dossier

CITIZEN DOSSIER (always pauses)
  ├→ Personal stats + household
  ├→ Labor + trudodni
  ├→ Political record + commissar notes
  └→ Actions: Reassign, View Family, Dismiss
```

This means:
1. **RadialBuildMenu becomes RadialContextMenu** — same SVG component, data-driven by context
2. **BuildingInspector card is replaced** — info moves into the radial's "Info" action
3. **WorkerInfoPanel becomes Citizen Dossier modal** — deeper, pauses game
4. **Assignment mode eliminated** — workers assigned from building's "Workers" ring
5. **New PopulationRegistry component** — full-screen list from DrawerPanel
