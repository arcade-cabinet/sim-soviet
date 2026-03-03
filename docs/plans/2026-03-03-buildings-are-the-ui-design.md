# Buildings Are the UI — SimSoviet UX Paradigm Shift

> **Date**: 2026-03-03
> **Status**: Approved
> **Scope**: Complete UX/UI overhaul, organic settlement growth, audio system, camera, notification system

## Vision

SimSoviet is **Cities: Skylines but Soviet**. The player is the chairman sent to establish a settlement. You **observe, direct, and intervene** — you don't lay bricks. The settlement grows organically driven by three forces: **General Winter** (survival), **Mother Russia** (state quotas), and **the Black Market** (human nature). You interact with the world by **clicking on buildings**, not HUD panels. Information is **spatial** (go to a building) not **temporal** (notifications screaming at you).

## Central Conceit

Remove all direct building placement. The player issues high-level directives and the Yuka agent system handles execution. Buildings ARE the UI — click a commune to see residents, click the Party HQ to manage policies. As the settlement grows and buildings gain dedicated functions, the UI naturally expands through the world, not through menu bloat.

## Design Pillars

### 1. Organic Settlement Growth Engine

**Replaces**: Direct building placement (BUILD toolbar, ZONING/INFRASTRUCTURE/STATE subtabs, GhostPreview)

**Growth Decision Pipeline (per tick):**
```
DemandCalculation → SiteSelection → ConstructionQueue → BuildAnimation
```

#### Demand Phase
Yuka agents calculate what's needed based on settlement state:
- Housing demand: population vs. housing capacity
- Food demand: food stores vs. consumption rate + winter buffer
- Fuel demand: approaching winter + heating requirements
- Industrial demand: state quotas + resource needs
- Infrastructure demand: water access, road connectivity

#### Site Selection — Era-Appropriate Rules

**Pre-Collectivization (1917-1928):**
- Families settle near water sources (river, wells)
- Forest-edge for timber/fuel access
- 10m minimum fire spacing between wooden structures (izbas)
- Cluster organically around first buildings
- Road/path forms naturally from foot traffic between buildings
- Linear village pattern along river/road emerges
- Church/meeting house as anchor distinguishing selo from derevnya

**Collectivization (1928-1941):**
- Spatial reorganization: private plot boundaries dissolve
- Central kolkhoz cluster emerges: admin building, club/dom kultura, school, medical post, MTS station
- Fields merge into large collective zones worked by brigades
- Private plots (0.25-0.5 ha) persist as small concession near homes
- Grain storage and threshing floor at central location

**Industrialization (1928-1941, overlapping):**
- New industrial buildings follow Miliutin's parallel strip model:
  - Rail line → Factory zone → Green buffer (500m ideal) → Residential zone
- Buffer violations cause smog/health/morale penalties
- Factory placement driven by resource proximity (ore, river for cooling)

**War/Reconstruction (1941-1955):**
- Emergency construction: barracks, field hospitals
- Gulag labor available for construction (dark but mechanically real)
- Factory evacuation buildings (if war event triggers)
- Rapid, ugly, functional — aesthetics don't matter

**Mikrorayon Era (1955+):**
- Self-contained districts: 8,000-12,000 residents per mikrorayon
- SNiP walking distance standards:
  - 300m max to grocery
  - 500m max to school, transport, public services
- Khrushchyovka blocks: standardized 5-story walkups, erected in ~12 days
- Infrastructure must precede housing (power, heating, water, sewage first)
- Chronic service lag: housing ready before shops/schools → morale hit

#### Construction Queue
- Buildings take real time to construct
- Workers assigned from collective (construction brigade)
- Materials consumed (timber, then brick/concrete in later eras)
- Construction scaffolding visible → gradual assembly → completion event

#### Map Expansion
- No fixed map sizes at game start (remove from NewGameSetup)
- Grid starts at whatever the initial settlement needs (~10x10)
- When growth would extend beyond edge, grid expands in chunks
- Performance managed via LOD, culling, and aggregate mode (existing)
- Settlement organically grows from selo to city without arbitrary constraints

#### Player Influence on Growth
High-level directives shift demand weights:
- "Prioritize housing" → housing demand multiplier increases
- "Expand farmland" → agricultural area grows faster
- "Increase fuel reserves" → logging/fuel buildings prioritized
- "Prepare for winter" → fuel + food stockpiling emphasized
- "Fulfill quota" → production buildings prioritized over comfort

### 2. Building-as-UI System

**Replaces**: TopBar overflow menu (21 panels), most HUD overlays

#### Click Interaction Flow
```
Click building → Camera smoothly zooms to street level →
Building Info Panel slides in (side panel, not modal)
```

#### Contextual Building Panels

| Building Type | Panel Shows |
|--------------|-------------|
| **Commune/Housing** | Residents (families, names, morale, health), capacity, condition, heating status |
| **Farm/Kolkhoz** | Crop type, yield, brigade assigned, livestock, private plots |
| **Factory** | Production output, workers, pollution, machinery condition |
| **Party HQ** | Directives, reports, economy, morale summary, loyalty, quotas |
| **Medical Post** | Disease status, patients, drug supplies |
| **Militia Station** | Dissidents, crime rate, patrols |
| **School** | Literacy rate, enrollment, teacher quality |
| **Grain Office** | Food stores, distribution, waste, delivery quotas |
| **Dom Kultura** | Morale events, cultural activities, propaganda effectiveness |

#### Progressive HQ Splitting

The Party HQ starts as the only management building. As population grows, functions split into dedicated buildings:

| Population | Building | Functions Contained |
|-----------|----------|-------------------|
| 0-50 | **Party Barracks** | Everything: reports, economy, morale, quotas, security, health |
| 50-150 | **Village Soviet** | Core management. Splits off: Grain Office (economy), Militia Post (security) |
| 150-400 | **Raion HQ** | Political management. Splits off: Hospital, School, Planning Office |
| 400+ | **City Soviet** | Full split: each function in its own dedicated building |

Each split is a building event: "The Party has approved construction of a dedicated Grain Office." The function **moves** from the HQ to the new building. Player discovers this by clicking the new building.

This naturally solves UI bloat — the 21-panel overflow menu becomes 0 panels because every function lives in a building you can walk to.

### 3. Quiet Authority — Notification Overhaul

**Replaces**: Constant toast notifications, advisor interruptions, periodic minigames, overflow menus

#### Three-Tier Information System

| Tier | How Player Learns | Examples | Frequency |
|------|------------------|---------|-----------|
| **Observe** (passive) | Watch the settlement. Visual/audio cues. | Smoke from chimneys. Workers chopping wood. Construction scaffolding. Empty market stalls. | Constant ambient |
| **Investigate** (click) | Click buildings to see details. | Check grain stores. Inspect housing. Review militia reports. | On player initiative |
| **Emergency** (interrupts) | Game pauses, camera pans to crisis. | Fire. Riot. Famine death spiral. KGB inspection arriving. War declaration. | Rare, meaningful |

#### What Gets Removed from HUD
- All 21 overflow menu panels → functions live in buildings
- DirectiveHUD → replaced by directive system in Party HQ
- QuotaHUD → shown in Party HQ or at annual report
- WorkerStatusBar → shown when clicking Party HQ or housing
- Advisor popup → Krupnik is at the Party HQ, doesn't interrupt gameplay
- Ticker (Pravda headlines) → newspaper at Party HQ / dom kultura
- LensSelector → simplified to 2-3 contextual lenses, not always visible

#### What Stays On Screen
- **Minimal TopBar**: Date, Season, Era name (small text), Speed controls
- **Three resource indicators**: Food, Timber, Population
- **Minimap** (toggleable, hidden by default on mobile)
- **Emergency alerts only** (rare, game-pausing)

#### Minigame Frequency
- **Remove periodic triggers** (no more every-60-tick minigames)
- Events that warrant player choice are rare and meaningful
- Minigames only fire from specific narrative events, not on a timer
- Auto-resolve timeout extended or removed (player addresses when they visit the building)

#### Return-to-Game Flooding
- When player returns after absence: **no notification backlog**
- Time passes, things happened, results are visible in the world
- Player clicks Party HQ to see summary of what happened while away
- No queue of 15 toasts stacking up

### 4. Camera System

**Default zoom**: Mid-level — see ~10x10 grid area, individual buildings visible, workers moving between them. Player can follow workers as they form the settlement.

**Click-to-zoom**: Click any building → camera smoothly dollies forward and down to street level, looking up at the building. Between tenements, you look up at grey concrete, laundry on lines, workers on muddy paths.

**Strategic view**: Still available — zoom all the way out to see the full settlement. But not the default.

**Camera transitions**:
- Click building → 1.5s smooth dolly to street level
- Escape/click away → 1s smooth return to previous camera position
- Emergency → camera auto-pans to crisis location over 2s

### 5. Audio System Overhaul

**Replaces**: Hard-switch on era/season change, events restarting songs

#### Two-Layer Audio Architecture

**Base Layer** (continuous):
- Era-appropriate ambient playlist (shuffled, weighted by season + time of day)
- Crossfade between tracks: 3-5 seconds
- Era transitions: 5-second blend from old era mood to new
- Silence is valid — winter wind ambient alone is enough sometimes
- Resume previous track after any interruption

**Incidental Layer** (over base):
- Short musical cues for events (quota met, fire start, construction complete)
- Plays OVER the base layer, doesn't replace it
- Duck base audio by 30% during incidental, restore after fade
- Stinger system: 2-5 second cues that auto-cleanup
- Emergency events get longer, more dramatic incidental cues

**Audio Ducking**:
- When building panel opens → subtle 20% base duck
- When emergency fires → 40% duck + incidental alarm
- When annual report modal → 30% duck

**Menu/Pause**:
- Main menu: dedicated menu theme (Soviet anthem, quiet)
- Game pause: current track continues at 70% volume
- Background ambient (wind, birds, distant sounds) never stops

### 6. Game Start Flow — "Don't Die"

**Replaces**: Empty grid + tutorial directives + "build a farm" instructions

#### New Start Sequence

1. **Camera**: Starts at mid-zoom looking at empty landscape near a river
2. **Arrival**: 10-11 families (dvory) arrive as visible wagon/cart caravan
3. **Settling**: Families autonomously:
   - Find the river (water)
   - Begin felling trees for shelter (forest edge)
   - Set up temporary shelters/tents
   - Build first izba near water
4. **Player's first interaction**: Party Barracks auto-constructed. Click it → see your settlement's current state (families, food stores, immediate needs)
5. **First winter approaching**: The game's first real pressure. Do you have enough fuel? Enough shelter?
6. **No flood of HUD elements**: Just the minimal TopBar (date, food, timber, population, speed)

#### Tutorial as Organic Discovery
- Year 1: "Don't die." Learn by watching. Click buildings to learn.
- Building the Party Barracks introduces the directive system
- First dedicated building (Grain Office) introduces the concept of building-as-UI
- Each new building type introduces its mechanic naturally

#### Starting Morale
- Initial citizen morale: 70/100 (hopeful — these are revolutionaries starting a new life)
- Initial loyalty: 60/100 (committed to the collective, not yet disillusioned)
- Morale decays from: cold, hunger, overwork, lack of vodka, disease
- Morale improves from: adequate shelter, food, vodka rations, cultural events

### 7. Freeform Mode Changes

**Remove**: Divergence year picker from NewGameSetup

**Historical mode**:
- Strict timeline — events follow real dates
- Unlocks tied to years (collectivization in 1928, war in 1941, etc.)
- Player's role evolves: settlement founder → kolkhoz chairman → city manager

**Freeform mode**:
- Same starting point (1917)
- Events are probability-driven, not date-driven
- War WILL happen (human nature), just not necessarily in 1941
- Growth milestones trigger era-like unlocks organically
- Divergences accumulate naturally — no explicit divergence point
- The timeline is yours

### 8. HUD Layout — What Remains

```
┌─────────────────────────────────────────────────────────┐
│ OCT 1917  ❄ WINTER   REVOLUTION   ▶ ▶▶ ▶▶▶            │  ← Minimal TopBar
│ 🌾 487  🪵 203  👥 58                                    │  ← Three resources only
├─────────────────────────────────────────────────────────┤
│                                                         │
│                                                         │
│              [3D WORLD — BUILDINGS ARE THE UI]           │
│                                                         │
│         Click any building to interact with it          │
│                                                         │
│                                                         │
│  ┌──────┐                                               │
│  │mini  │                                    [LENS]     │  ← Minimap + simple lens toggle
│  │map   │                                               │
│  └──────┘                                               │
└─────────────────────────────────────────────────────────┘
```

No toolbar. No overflow menu. No directive HUD. No quota HUD. No worker status bar. No advisor popup. No ticker.

Everything is in the world.

---

## Implementation Impact

### Files to Remove/Gut
- `src/ui/Toolbar.tsx` → remove or repurpose as simple directive bar
- `src/ui/DirectiveHUD.tsx` → remove (directives in Party HQ)
- `src/ui/QuotaHUD.tsx` → remove (quotas in Party HQ)
- `src/ui/WorkerStatusBar.tsx` → remove (worker info in buildings)
- `src/ui/Advisor.tsx` → remove popup, Krupnik lives at Party HQ
- `src/ui/Ticker.tsx` → remove (Pravda at dom kultura / Party HQ)
- `src/ui/LensSelector.tsx` → simplify to 2-3 toggles
- `src/ui/TopBar.tsx` → gut to minimal (date, 3 resources, speed)
- 21 overflow panel components → refactored as building panel content

### Files to Create
- `src/growth/SettlementGrowthEngine.ts` — organic placement AI
- `src/growth/SiteSelection.ts` — era-specific placement rules
- `src/growth/DemandCalculation.ts` — what needs building
- `src/growth/ConstructionQueue.ts` — build time + materials
- `src/ui/BuildingPanel.tsx` — click-on-building side panel
- `src/ui/BuildingPanelContent/*.tsx` — per-building-type content
- `src/ui/MinimalTopBar.tsx` — simplified top bar
- `src/scene/StreetLevelCamera.tsx` — click-to-zoom system
- `src/audio/AudioLayerSystem.ts` — two-layer audio with ducking

### Files to Modify
- `src/App.web.tsx` — remove most UI component mounts, add BuildingPanel
- `src/scene/CameraController.tsx` — add mid-zoom default + click-to-zoom
- `src/audio/AudioManager.ts` — add layering, ducking, seamless transitions
- `src/audio/AudioManifest.ts` — add incidental cue definitions
- `src/bridge/GameInit.ts` — new start flow (arrival caravan, organic settling)
- `src/game/SimulationEngine.ts` — integrate growth engine, reduce event frequency
- `src/stores/gameStore.ts` — building click state, active panel, directive system
- `src/scene/BuildingRenderer.tsx` — click handling for building selection
- `src/ui/NewGameSetup.tsx` — remove map size selector, remove divergence year

## Migration Strategy

This is a paradigm shift. Recommended approach:
1. **Phase 1**: Minimal TopBar + Building click-to-inspect (keep old toolbar as fallback)
2. **Phase 2**: Organic growth engine (disable direct placement, enable AI building)
3. **Phase 3**: Building-as-UI (Party HQ splitting, remove overflow panels)
4. **Phase 4**: Audio overhaul (layering, ducking, seamless transitions)
5. **Phase 5**: Camera (mid-zoom default, street-level click)
6. **Phase 6**: Start flow (arrival caravan, organic settling, morale tuning)
7. **Phase 7**: Freeform mode (remove divergence picker, probability-driven events)

Each phase is independently shippable and testable.
