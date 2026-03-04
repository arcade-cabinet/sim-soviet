---
title: Minigames — Building, Event & Periodic Triggered
type: design
status: implemented
implementation:
  - src/ai/agents/meta/minigames/MinigameRouter.ts
  - src/ai/agents/meta/minigames/MinigameTypes.ts
  - src/ai/agents/meta/minigames/definitions/
  - src/ai/agents/meta/minigames/BuildingMinigameMap.ts
  - src/ui/MinigameOverlay.tsx
  - src/ui/minigames/HuntMinigame.tsx
  - src/ui/minigames/FactoryEmergencyMinigame.tsx
  - src/ui/minigames/InspectionMinigame.tsx
tests:
  - __tests__/game/MinigameRouter.test.ts
last_verified: 2026-03-04
coverage: full
---

# Minigames — Building, Event & Periodic Triggered

Minigames present the player with impossible choices. Each offers 2-3 options, all with tradeoffs. Ignoring a minigame always produces a worse outcome than engaging. Only one minigame can be active at a time.

---

## Architecture

### MinigameRouter

`MinigameRouter` (`src/ai/agents/meta/minigames/MinigameRouter.ts`) manages the lifecycle:
- **Trigger checking** — Scans all 17 definitions against current context (building tap, event, or periodic timer)
- **Start** — Creates an `ActiveMinigame` instance from a `MinigameDefinition`
- **Resolution** — Player picks a choice (RNG roll against `successChance`), or time expires (auto-resolve)
- **Cooldowns** — Each minigame has a cooldown period after resolution (default from `config/meta.json`)
- **Save/load** — Full serialization of active minigame, cooldowns via `MinigameRouterSaveData`

### Two Presentation Formats

**Text-choice minigames** (14 of 17): Presented via GameModals. Scenario description text + 2-3 clickable choices. Each choice has a `successChance` (0-1), with distinct `onSuccess` and `onFailure` outcomes. The RNG roll determines which outcome fires.

**Interactive minigames** (3 of 17): Presented via `MinigameOverlay` (`src/ui/MinigameOverlay.tsx`). Full-screen modal with real-time gameplay rendered in React Native. The `interactiveType` field on the definition selects the component:
- `'hunt'` → `HuntMinigame` — Moving target aiming game (30s, 5 shots, need 3 hits)
- `'factory_emergency'` → `FactoryEmergencyMinigame` — Pressure gauge timing game (3 rounds, tap in green zone 70-90%)
- `'inspection'` → `InspectionMinigame` — Papers Please-style dossier review (15s, find the discrepancy in 5 fields)

Interactive minigames still have text-choice fallback definitions (the `choices` array) but render the interactive component when `interactiveType` is set.

### BuildingMinigameMap

`BuildingMinigameMap.ts` maps concrete building defIds to abstract trigger conditions. Multiple buildings can map to the same minigame (e.g. `factory-office`, `bread-factory`, `warehouse` all map to `'factory_tap'` which triggers Production Quotas). Terrain features like `'forest'`, `'mountain'`, `'market'` match directly without mapping.

---

## Trigger Types

| Trigger Type | Mechanism | Examples |
|-------------|-----------|---------|
| `building_tap` | Player taps a building/terrain tile | Forest → The Hunt, Market → Black Market, Factory → Production Quotas |
| `event` | Fired by agent systems (crisis, political) | `factory_collapse` → Factory Emergency, `kgb_inspection` → Interrogation |
| `periodic` | Timer-based, checked each tick | Queue (every 360 ticks, pop >= threshold), Inspection (every 720 ticks) |

### Rules
- **Exclusivity**: Only one minigame active at a time
- **Cooldowns**: After resolution, a minigame cannot re-trigger for a configurable number of ticks
- **Auto-resolve**: Each minigame has a `tickLimit`; if the player doesn't engage, it auto-resolves with a worse outcome
- **Optional**: Minigames are never mandatory — auto-resolve fires if ignored (always a worse deal)

---

## All 17 Minigames

### Original 8 (from GDD)

#### The Queue
**Trigger**: Periodic (every 360 ticks when population >= threshold).
**Format**: Text-choice.
**Scenario**: 400 citizens, 200 loaves. The math is cruel.
**Choices**: Fair Distribution (90% success, modest food cost) | Priority for Workers (70%, less food but risk elderly death) | Sell Surplus on Black Market (40%, money + blat but KGB risk).
**Auto-resolve**: Food wasted, one citizen crushed in stampede.

#### Ideology Session
**Trigger**: Event (`party_official_visit`).
**Format**: Text-choice.
**Scenario**: The politruk has arrived with questions. The correct answers are the ones he already knows.
**Choices**: Enthusiastic Participation (95%, commendation but production stops) | Go Through the Motions (80%, nothing happens) | Question the Doctrine (20%, hero or counter-revolutionary).
**Auto-resolve**: Black mark for skipping.

#### The Inspection
**Trigger**: Periodic (every 720 ticks).
**Format**: Interactive (`InspectionMinigame`).
**Gameplay**: Worker dossier with 5 fields displayed. One field has a discrepancy (age vs party membership, class vs assignment, etc.). Player taps the suspicious field within 15 seconds. 5 randomized dossier templates.
**Interactive outcome**: Correct field → commendation. Wrong field or time expires → black mark, spy escapes.
**Text-choice fallback**: Show Honestly (50%) | Potemkin Village (60%, costs money) | Bribe Inspector (75%, costs money + vodka, gains blat).
**Auto-resolve**: Inspector fills his very large notebook. Black mark + money loss.

#### Conscription Selection
**Trigger**: Event (`conscription_wave`).
**Format**: Text-choice.
**Scenario**: The army needs bodies. Your settlement has bodies.
**Choices**: Send Volunteers (70%, lose 3 pop) | Send the Troublemakers (80%, lose 2 pop but nephew risk) | Resist the Order (15%, miracle waiver or extra conscription + 2 marks).
**Auto-resolve**: Random citizens taken, families separated, black mark.

#### Black Market
**Trigger**: Building tap (market tile).
**Format**: Text-choice.
**Scenario**: A man in a long coat has goods. You have needs. The State has opinions.
**Choices**: Trade Cautiously (85%, small food gain + blat) | Trade Aggressively (40%, big haul but KGB raid risk) | Report the Market (100%, commendation but lose blat forever).
**Auto-resolve**: The man left. Opportunity vanished.

#### Factory Emergency
**Trigger**: Event (`factory_collapse`).
**Format**: Interactive (`FactoryEmergencyMinigame`).
**Gameplay**: Pressure gauge bar fills continuously, cycling 0-100%. Player taps when the needle is in the green zone (70-90%). 3 rounds, need 2/3 correct. Gauge resets each round.
**Interactive outcome**: 2+ correct → factory saved. Fewer → equipment damaged, worker injured, black mark.
**Text-choice fallback**: Rush Repair (70%, costs money) | Evacuate Workers (95%, safe but production lost) | Keep Working (30%, hero or explosion).
**Auto-resolve**: Boiler explodes, workers injured, black mark.

#### The Hunt
**Trigger**: Building tap (forest tile).
**Format**: Interactive (`HuntMinigame`).
**Gameplay**: Deer emoji moves in sine-wave pattern across a 300x200 play area. Player taps to shoot — hit if tap is within 50px of target. 5 shots total, need 3 hits, 30-second time limit.
**Interactive outcome**: 3+ hits → food bonus (15 + hits*5). Fewer → ammunition wasted, money loss.
**Text-choice fallback**: Send Small Party (80%, modest food) | Send Large Party (55%, feast or bear attack) | Poach State Forests (45%, big haul or forest rangers + mark).
**Auto-resolve**: Nobody hunted. Turnip soup again.

#### Interrogation
**Trigger**: Event (`kgb_inspection`).
**Format**: Text-choice.
**Scenario**: The KGB agent smiles warmly. This is not reassuring.
**Choices**: Cooperate Fully (100%, a worker is arrested but you get a commendation) | Deflect Blame (45%, clean escape or 2 marks) | Refuse to Answer (100%, 1 mark but workers are grateful).
**Auto-resolve**: Silence taken as guilt. Worker taken + mark.

### 9 Additional Minigames

#### Mining Expedition
**Trigger**: Building tap (mountain tile).
**Format**: Text-choice (with dynamic auto-resolve via `MiningExpedition.ts` RNG).
**Scenario**: The mountain holds iron and grudges.
**Choices**: Surface Mining (85%, modest money) | Dig Deep Shaft (50%, rich ore or cave-in death) | Use Dynamite (40%, rich deposit + blat or explosion + marks).
**Auto-resolve**: Dynamic RNG resolution (not static like others).

#### Production Quotas
**Trigger**: Building tap (factory-office, bread-factory, warehouse).
**Format**: Text-choice.
**Scenario**: Moscow demands numbers. The machines demand maintenance. The workers demand lunch.
**Choices**: Double Shift (60%, food + money + commendation or worker collapse) | Maintain Equipment (85%, safe but costs money) | Falsify Output Numbers (45%, money + blat or auditor catches you, 2 marks).
**Auto-resolve**: Production fell. Moscow noticed.

#### Harvest Campaign
**Trigger**: Building tap (collective-farm-hq).
**Format**: Text-choice.
**Scenario**: The wheat is ripe. The tractors are mostly functional.
**Choices**: Mobilize Everyone (70%, record harvest + commendation or thresher injury) | Standard Harvest (85%, adequate or rain rot) | Divert Grain to Distillery (50%, vodka + money or food loss + mark).
**Auto-resolve**: Grain rotted. Crows ate well.

#### Quality Control
**Trigger**: Building tap (vodka-distillery).
**Format**: Text-choice.
**Scenario**: The latest batch smells like victory. Or possibly turpentine.
**Choices**: Enforce Strict Standards (80%, premium vodka + commendation or waste) | Look the Other Way (60%, ship everything or hospitalization + mark) | Sample Extensively (40%, testing complete + blat or three hours lost).
**Auto-resolve**: Uninsected batch shipped. Complaints arrived first.

#### Prisoner Reform
**Trigger**: Building tap (gulag-admin).
**Format**: Text-choice.
**Scenario**: The prisoners request better conditions. Through labor, salvation.
**Choices**: Increase Rations (75%, productivity boost or wasted food) | Harsh Discipline (65%, output up or deaths + mark) | Propose Amnesty (35%, workers gained + commendation or escapee + mark).
**Auto-resolve**: Prisoner died. No report filed.

#### Paperwork Avalanche
**Trigger**: Building tap (ministry-office, government-hq, kgb-office).
**Format**: Text-choice.
**Scenario**: Form 27-B/6 requires Form 14-A/3 which requires Form 27-B/6.
**Choices**: Process Everything (70%, money + commendation or wrong filing order) | Rubber Stamp Everything (50%, fast + blat or fictional district transfer, 2 marks) | Lose the Papers (40%, problems vanish + blat or backup copies survived + mark).
**Auto-resolve**: Deadlines missed. Moscow telegram. Not congratulatory.

#### Grid Management
**Trigger**: Building tap (power-station, cooling-tower).
**Format**: Text-choice.
**Scenario**: The power grid is operating at 147% of rated capacity.
**Choices**: Rolling Blackouts (80%, managed equality or triple district outage) | Push Through at Full Power (40%, held + commendation or transformer explosion + death + mark) | Borrow from Neighboring Grid (60%, favor owed + blat or neighbor lied too).
**Auto-resolve**: Citywide blackout. 6 hours. Total darkness.

#### Ideological Education
**Trigger**: Building tap (school, cultural-palace, workers-club).
**Format**: Text-choice.
**Scenario**: The curriculum must be updated. The children are asking questions.
**Choices**: Strict Party Curriculum (85%, commendation or students learn nothing) | Add Practical Skills (60%, productive graduates or insufficient ideology mark) | Encourage Free Thinking (20%, dignitary impressed or counter-revolutionary question, 2 marks).
**Auto-resolve**: School taught nothing. Students learned anyway. Authorities terrified.

#### Military Inspection
**Trigger**: Building tap (barracks, guard-post).
**Format**: Text-choice.
**Scenario**: The garrison commander conducts a readiness inspection.
**Choices**: Full Parade Formation (75%, commendation or soldier faints + mark) | Demonstrate Combat Readiness (50%, all targets destroyed or friendly fire) | Bribe the Commander (65%, glowing report + blat or bribe reported, 2 marks).
**Auto-resolve**: Dust on rifles. Despair in barracks.

---

## Outcome System

Every choice produces a `MinigameOutcome` with optional fields:
- `resources` — Deltas to `money`, `food`, `vodka`, `population`
- `blackMarks` — Added to the chairman's personnel file
- `commendations` — Added to the chairman's personnel file
- `blat` — Favor network gained or lost
- `announcement` — Toast text shown to the player
- `severity` — UI coloring: `'warning'` | `'critical'` | `'evacuation'`

Interactive minigames map their real-time results (success boolean + numeric score) to outcomes via `resolveInteractiveOutcome()` in `MinigameOverlay.tsx`.

---

## Building → Minigame Mapping

`BuildingMinigameMap.ts` maps building defIds to trigger conditions:

| Building defIds | Trigger Condition | Minigame |
|----------------|-------------------|----------|
| `factory-office`, `bread-factory`, `warehouse` | `factory_tap` | Production Quotas |
| `collective-farm-hq` | `farm_tap` | Harvest Campaign |
| `vodka-distillery` | `distillery_tap` | Quality Control |
| `gulag-admin` | `gulag_tap` | Prisoner Reform |
| `ministry-office`, `government-hq`, `kgb-office` | `ministry_tap` | Paperwork Avalanche |
| `power-station`, `cooling-tower` | `power_tap` | Grid Management |
| `school`, `cultural-palace`, `workers-club` | `school_tap` | Ideological Education |
| `barracks`, `guard-post` | `barracks_tap` | Military Inspection |
| `forest` (terrain) | `forest` | The Hunt |
| `mountain` (terrain) | `mountain` | Mining Expedition |
| `market` (terrain) | `market` | Black Market |
