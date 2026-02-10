---
title: UI/UX — Mobile-First Brutalist
status: Complete
implementation: src/components/ui/, src/components/screens/, app/App.tsx
tests: src/__tests__/ConcreteFrame.test.tsx, src/__tests__/NewGameFlow.test.tsx
last_verified: 2026-02-10
coverage: "Full — landing page, new game flow, HUD, drawer, radial build menu, worker panel, tutorial overlays"
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
| Tap worker | Select (shows assignment options) |
| Tap building | Show building info / assign selected workers |
| Drag on map | Pan camera |
| Pinch | Zoom (clamped to map bounds) |
| Double-tap building | Auto-assign nearest idle workers |
| Long-press worker | Worker details (name, morale, loyalty, skill) |
| Swipe up on bottom panel | Expand to full worker management view |

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

**No tutorial mode.** Era 1 (Revolution) IS the tutorial. You start with 12 peasants and nothing else. Comrade Krupnik (advisor) teaches through contextual dialog.

**Progressive Disclosure Schedule**:

| Tick Range | Mechanic Introduced | Krupnik Says |
|-----------|---------------------|-------------|
| 0-10 | Tap worker → tap ground (assignment) | "Comrade Predsedatel, your peasants await orders. Tap a worker, then tap the ground to assign." |
| 10-30 | Build first structure (kolkhoz HQ) | "The party expects you to establish order. Place the kolkhoz headquarters here." |
| 30-60 | Assign workers to farm | "Winter is coming. Assign workers to the fields before frost." |
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
