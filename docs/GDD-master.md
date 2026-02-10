---
title: Master Game Design Document
date: 2026-02-09
status: Active
category: design
---

# SimSoviet 2000 — Master Game Design Document

## Alternate History. The Soviet State Endures.

---

## 1. Game Identity

**Genre**: Worker-management survival sim with isometric city-building
**Setting**: Alternate history — the Soviet Union never collapses. The state endures from 1917 through the present and beyond.
**Platform**: Mobile-first (phone), browser, PWA
**Tone**: Dark satirical comedy. *Krokodil* magazine meets Papers, Please meets Banished.

**The Pitch**: You manage a collective of Soviet citizens — peasants who become proletarians, workers who become numbers. You don't fight enemies. You survive the system. The political apparatus is the weather: politruks check your loyalty, the KGB disappears your best workers, and the military drafts them regardless of impact. Your job is to keep everyone alive, meet impossible quotas, and avoid attracting attention.

**What This Is NOT**:
- Not a power fantasy — you have no upward mobility
- Not a free-market sim — the planned economy dictates what you build
- Not a war game — the military is a drain, not a tool
- Not a game where the USSR falls — alternate history, the state endures forever

---

## 2. Core Fantasy — You Are the Predsedatel

The player is the **predsedatel** (председатель) — the chairman of the collective. In the early eras, you're the predsedatel kolkhoza (collective farm chairman). As the collective industrializes, you become the direktor of the enterprise. You take orders from the central authority — the raikom (district committee) — and ensure your labor pool works effectively for the good of the state.

You are not a hero. You are not a rebel. You are a middle manager in the most bureaucratic system ever devised. Your name is on a file in Moscow. That file accumulates black marks. Too many marks and you attract investigation. Investigation leads to a labor camp. The game ends.

**The Sweet Spot**: The ideal state is comfortable mediocrity. Excel too much and you get harder targets. Fail too badly and you get a mark on your file. The entire game is about navigating this impossible middle while your file slowly fills with notations.

### Your File (Личное Дело)

Your personnel file is the game's central tension mechanic:

- **Black marks** accumulate from: worker disloyalty, quota failures, suspicious activity, denunciations
- **Commendations** can offset marks: exceeding quotas (risky — raises future targets), political loyalty displays
- **Attention threshold**: At 3 marks, increased politruk presence. At 5, KGB investigation. At 7, you are arrested.
- **Marks decay slowly** — one mark fades every 2 in-game years if no new ones added
- **Era transitions reset marks to 2** — fresh start, but not clean. The file follows you.

Workers being disrupted (arrested for disloyalty, etc.) earns you a mark — but doesn't end the game. You can always get more workers. The danger is the *pattern* of disruptions that draws attention to *you*.

---

## 3. Core Loop

```
┌─────────────────────────────────────────────────┐
│                                                 │
│   ASSIGN WORKERS ──→ PRODUCE RESOURCES          │
│        ↑                    │                   │
│        │                    ↓                   │
│   SURVIVE THREATS ←── MEET QUOTAS               │
│        │                    │                   │
│        │                    ↓                   │
│        └───── POLICY CHANGES (from above) ──────┘
│                                                 │
└─────────────────────────────────────────────────┘
```

### Moment-to-Moment Gameplay

1. **Tap a worker (or group)** → worker/group highlights
2. **Tap a building or zone** → workers assigned to that task
3. **Watch production tick** → resources accumulate toward quota
4. **Respond to events** → political officers arrive, military drafts workers, KGB takes someone
5. **Manage the impossible** → too few workers for too many demands, constantly triaging

### The Player Does NOT:
- Choose which buildings to unlock (policy from above dictates this)
- Fight anyone directly
- Have free-market trading
- Control the political officers, KGB, or military — only endure them

---

## 4. Era-Based Campaigns

Each era is a self-contained campaign with distinct mechanics, buildings, threats, and victory conditions. Completing one unlocks the next. Save files are per-era.

### Era Overview

| # | Era | Years | Starting Condition | Core Mechanic | Victory Condition |
|---|-----|-------|--------------------|---------------|-------------------|
| 1 | **Revolution** | 1917–1922 | Kolkhoz, 12 peasants | Land redistribution, survival basics | Survive Civil War chaos, establish the collective |
| 2 | **Collectivization** | 1922–1932 | Small collective | Forced grain quotas, kulak purges | Meet first Five-Year Plan without total famine |
| 3 | **Industrialization** | 1932–1941 | Growing town | Factory conversion, gulag labor | Transform agrarian collective into industrial center |
| 4 | **Great Patriotic War** | 1941–1945 | Industrial town | Conscription, factory conversion, rationing | Survive with >50% population, keep production going |
| 5 | **Reconstruction** | 1945–1956 | War-damaged city | Rubble salvage, rebuilding, veteran integration | Rebuild infrastructure, handle returning soldiers |
| 6 | **Thaw & Freeze** | 1956–1982 | Rebuilt city | Cultural freedom vs. crackdown oscillation | Navigate policy whiplash without collapse |
| 7 | **Stagnation** | 1982–2000 | Aging city | The Queue, bureaucratic decay, vodka economy | Keep the city functioning despite total systemic rot |
| 8 | **The Eternal** | 2000–??? | Bizarre city | Bureaucratic Singularity, absurdist events | Reach Bureaucratic Singularity at 5000 paperwork |

### Era Doctrine Integration

Each era maps to one or more Doctrines from the Era Doctrine System (see `design-era-doctrines.md`). Leaders can adopt doctrines independently of calendar year — a Zealot in 2030 can still force Industrialization. But each era has a *default* doctrine that shapes the campaign.

| Era | Default Doctrine | Can Also Trigger |
|-----|-----------------|------------------|
| Revolution | Revolutionary | — |
| Collectivization | Revolutionary → Industrialization | — |
| Industrialization | Industrialization | Wartime (if war events fire) |
| Great Patriotic War | Wartime | — |
| Reconstruction | Reconstruction | Thaw |
| Thaw & Freeze | Thaw ↔ Freeze | Stagnation (if leader is passive) |
| Stagnation | Stagnation | Freeze (reactionary leader) |
| The Eternal | Eternal | Revolutionary (system reboot, 70%) |

---

## 4B. Difficulty & Permadeath

### New Game Flow

The New Game screen presents two selection grids:

```
┌─────────────────────────────────────────────┐
│           NEW GAME — YEAR 1917              │
│                                             │
│   DIFFICULTY                                │
│   ┌───────────┬───────────┬───────────┐     │
│   │  WORKER   │  COMRADE  │  TOVARISH │     │
│   │  (Easy)   │ (Normal)  │  (Hard)   │     │
│   └───────────┴───────────┴───────────┘     │
│                                             │
│   CONSEQUENCES                              │
│   ┌───────────┬───────────┬───────────┐     │
│   │ FORGIVING │    ☠️     │  HARSH    │     │
│   │           │ PERMADEATH│           │     │
│   └───────────┴───────────┴───────────┘     │
│                                             │
│   MAP SIZE                                  │
│   ┌───────┬───────┬───────┐                 │
│   │ Small │  Med  │ Large │                 │
│   └───────┴───────┴───────┘                 │
│                                             │
│   SEED: [autumn-tractor-287]  [🎲]          │
│                                             │
│              [ BEGIN ]                       │
└─────────────────────────────────────────────┘
```

### Difficulty Levels

Difficulty affects conditions, multipliers, and political pressure:

| Setting | Quotas | Black Mark Decay | Politruk Ratio | KGB Aggression | Starting Resources |
|---------|--------|------------------|----------------|----------------|-------------------|
| **Worker** (Easy) | 0.6× target | 1 mark / 1 year | 1 per 40 workers | Low (targets flagged only) | 2× normal |
| **Comrade** (Normal) | 1.0× target | 1 mark / 2 years | 1 per 20 workers | Medium (occasional random) | 1× normal |
| **Tovarish** (Hard) | 1.5× target | 1 mark / 4 years | 1 per 8 workers | High (frequent, targets skilled) | 0.5× normal |

Additional hard mode modifiers:
- **Worker**: Winter is shorter, food production +20%, conscription rates halved
- **Comrade**: Standard conditions as designed
- **Tovarish**: Longer winters, random equipment failures, quota escalation +50% on success, informant events more frequent

### Consequence Levels (What Happens When You're Arrested)

Without permadeath, getting arrested (7 black marks) doesn't end the game — you're sent to a labor camp and eventually "rehabilitated." A replacement chairman runs the collective while you're gone. How much survives depends on the consequence setting:

#### Forgiving — "Replaced by an Idiot"

Your replacement is an incompetent party loyalist who got the job through connections:
- You return after **1 in-game year** (skip forward)
- Buildings: **90% intact** (10% decayed from neglect)
- Workers: **80% remain** (some drifted away, none purged)
- Resources: **50% of stockpiles** (the replacement spent freely)
- Black marks: **Reset to 1** (fresh-ish start)
- Score penalty: **-100 points**

*"Chairman [Name] has returned from an educational holiday in Siberia. The collective has survived. Barely."*

#### Harsh — "The Village Is Evacuated"

Your arrest triggers a full investigation. The collective is deemed "ideologically compromised." Workers are redistributed to other collectives. Infrastructure is partially dismantled:
- You return after **3 in-game years** (skip forward)
- Buildings: **40% intact** (rest condemned or repurposed)
- Workers: **25% remain** (the rest were redistributed across the oblast)
- Resources: **10% of stockpiles** (confiscated as "state property")
- Black marks: **Reset to 2** (the file never forgets)
- Score penalty: **-300 points**
- Some buildings **permanently downgraded** (factory → warehouse, school → storage)

*"Chairman [Name] has been rehabilitated and reassigned. The collective requires... reconstruction."*

#### Permadeath — "The File Is Closed"

Arrest is final. Your file is stamped "ВРАГ НАРОДА" (Enemy of the People). No return.
- Game over screen shows your full annotated personnel file
- Final score tallied with all penalties
- Must restart current era from the beginning (or start entirely over)
- Score multiplier: **×1.5** for all points earned (risk/reward for playing permadeath)

*"Chairman [Name] has been reassigned to a facility in Norilsk. No further correspondence is expected."*

### Difficulty × Consequence Matrix

Players choose difficulty and consequence independently. This creates 7 valid combinations (permadeath has no "levels"):

| | Forgiving | Permadeath | Harsh |
|---|---|---|---|
| **Worker** | Tourist mode — learn the systems, minimal punishment | Challenge run — easy conditions but one strike | — |
| **Comrade** | Standard experience — mistakes are recoverable | Intended experience — careful play required | Punishing — every arrest costs dearly |
| **Tovarish** | Hard conditions, soft landings | Masochist mode — everything is against you | Maximum suffering — the true Soviet experience |

### Score Multipliers by Setting

| Setting | Score Multiplier |
|---------|-----------------|
| Worker + Forgiving | ×0.5 |
| Worker + Permadeath | ×1.0 |
| Comrade + Forgiving | ×0.8 |
| Comrade + Permadeath | ×1.5 |
| Comrade + Harsh | ×1.2 |
| Tovarish + Forgiving | ×1.0 |
| Tovarish + Permadeath | ×2.0 |
| Tovarish + Harsh | ×1.8 |

---

## 5. Workers — The Central Resource

Workers are the game. Not buildings, not resources — *people*.

### Worker Roles & Colors

| Role | Color | Function | Controllable? |
|------|-------|----------|---------------|
| **Peasant / Proletarian** | Brown | Farming, construction, factory work | YES — player assigns |
| **Politruk / Zampolit** | Red | Ideology sessions, loyalty checks | NO — assigned from above |
| **KGB / FSB Agent** | Black | Surveillance, disappearances | NO — arrives on its own |
| **Military** | Green | Garrison, conscription, riot control | NO — drafted from your workers |

### Worker Lifecycle

1. **Spawn**: Workers arrive based on population growth, housing capacity, and era events
2. **Assignment**: Player taps worker → taps building/zone. Workers walk to assignment (visible on map)
3. **Production**: Workers at assigned tasks produce resources each tick
4. **Threats**: Politruks flag disloyal workers. KGB takes flagged workers. Military drafts arbitrary percentages
5. **Death/Removal**: Starvation, old age, purge, conscription, gulag, "accident"

### Procedural Worker Generation

Each worker is a tiny procedurally-generated sprite:
- **Body**: 8×12 pixel figure (or similar small iso sprite)
- **Outfit color**: Based on role (brown/red/black/green)
- **Variation**: 3-4 body types × 4 hat styles × role color = visual variety
- **Animation**: Idle, walking (4-direction), working (task-specific)
- **Name**: Generated from existing NameGenerator (1.1M+ male, 567K female combinations)

### Worker Assignment (Mobile Controls)

**Tap-to-Assign flow**:
1. Tap a worker or drag-select a group → selection highlight appears
2. Available assignment zones glow (buildings needing workers, construction sites, farm plots)
3. Tap a glowing zone → workers path-find and walk there
4. Long-press a zone → shows worker count, production rate, quota contribution

**Quick-assign shortcuts**:
- Double-tap a building → auto-assign nearest idle workers
- Swipe worker toward building → quick drag-assign
- Tap "Auto-assign" button → AI distributes workers by priority (quota first)

### Worker Morale & Loyalty

Each worker has hidden stats:
- **Morale**: Affected by food, vodka, housing, overwork. Low morale → slower production, chance of defection
- **Loyalty**: Affected by ideology sessions (politruk visits). Low loyalty → flagged for KGB
- **Skill**: Workers get better at tasks over time. Losing skilled workers hurts
- **Vodka Dependency**: After enough vodka rations, workers need it. Cut vodka → morale crash

---

## 6. The Political Apparatus — What You're Surviving

The three forces you cannot control, only endure.

### 6.1 Politruks (Red) — The Eyes

**Function**: Political officers assigned to your collective from above.

- Hold ideology sessions (takes workers off production for N ticks)
- Conduct loyalty checks on random workers
- Report findings upward — bad reports attract KGB attention
- More politruks arrive if the regime feels you're "ideologically weak"

**Player Interaction**:
- You can't stop ideology sessions, but you can choose which workers attend (assign your least productive)
- Workers who skip sessions get flagged faster
- Politruks consume food and housing but produce nothing

**Scaling**: 1 politruk per ~20 workers in calm times. During Freeze doctrine, 1 per 8. During Thaw, 1 per 50.

### 6.2 KGB / FSB (Black) — The Fist

**Function**: Security apparatus that acts on politruk reports and its own suspicion.

- Arrives when loyalty reports are bad, or randomly during high-paranoia eras
- **Disappears** workers — they're simply gone. No trial, no announcement
- Targets workers flagged by politruks, but also randomly selects "suspects"
- During Zealot leadership, KGB activity doubles
- During Thaw, KGB activity is minimal (but never zero)

**Player Interaction**:
- You see a KGB agent arrive (black outfit) and know someone will disappear
- You can try to "sacrifice" low-value workers by ensuring they're the ones with low loyalty scores
- KGB agents occasionally take your BEST workers (skill-based targeting during paranoia spikes)
- After a disappearance, remaining workers' morale drops. Fear rises.

**The Informant Network** (Freeze doctrine mechanic):
- KGB asks you to designate informants in each building
- Informants report on coworkers, increasing loyalty scores but creating a paranoia spiral
- At >60% coverage, workers start false-reporting each other to protect themselves

### 6.3 Military (Green) — The Drain

**Function**: Conscription demands that pull workers regardless of collective impact.

- Moscow issues conscription orders: "Send N workers for military service"
- N is a percentage of your population, set by doctrine (8–40%)
- You choose WHICH workers to send (strategy: send your worst? Or sacrifice production?)
- During Wartime doctrine: 40% conscription, factory conversion to military production
- Conscripted workers don't come back (except during Reconstruction era — veteran integration)
- Military can be called in for riot suppression if morale drops too low

**Player Interaction**:
- Conscription orders arrive as events with a deadline (N ticks to comply)
- You select which workers to send — agonizing choices
- Non-compliance → military arrives and takes workers randomly (worse outcome)
- Workers near military buildings have a small chance of "volunteering" (they don't really volunteer)

---

## 7. Buildings & Unlock Progression

Buildings are NOT freely chosen. They unlock through top-down policy decisions, era progression, and doctrine mechanics.

### Unlock Triggers

| Trigger Type | Example |
|-------------|---------|
| **Era start** | Revolution era unlocks: kolkhoz, wooden barracks, watch tower |
| **Doctrine adoption** | Industrialization doctrine unlocks: factory, power plant, rail depot |
| **Policy decree** | "Modernization Decree" unlocks: concrete apartments, hospital |
| **Leader whim** | Zealot leader mandates: monument, propaganda ministry |
| **Quota completion** | Meeting grain quota unlocks: granary expansion, mill |
| **Population threshold** | 100+ workers unlocks: clinic. 500+ unlocks: hospital |

### Building Categories (31 existing, mapped to eras)

| Era | Available Buildings |
|-----|-------------------|
| Revolution (1917) | Kolkhoz HQ, wooden barracks, watchtower, well, granary |
| Collectivization | Collective farm, tractor station, village school, party HQ |
| Industrialization | Factory, power station, rail depot, concrete apartments, gulag |
| Wartime | Bunker, anti-air, field hospital, munitions factory |
| Reconstruction | Construction yard, memorial, rebuilt housing, cultural center |
| Thaw/Freeze | University, cinema, KGB station, radio tower, private gardens |
| Stagnation | Queue management office, vodka distillery, bureaucratic center |
| Eternal | Monument to Bureaucracy, Archive of Everything, The Queue (building) |

### Building Workers

Buildings require workers to function:
- **Kolkhoz**: 5–20 farm workers → food production
- **Factory**: 10–50 workers → industrial output
- **Power plant**: 5–15 workers → power generation
- Each building has a min/max worker count. Below min → no output. Above max → diminishing returns.
- Workers in buildings are visible as tiny figures entering/exiting

---

## 8. Map & Camera System

### Map Generation

At New Game, the player selects:
- **Map size**: Small (20×20), Medium (30×30), Large (50×50)
- **Terrain seed**: Auto-generated or manually entered (existing seed system)

Procedural generation places:
- **Mountains**: Impassable terrain clusters (3-8 tiles), scattered arbitrarily
- **Rivers**: 1-2 rivers crossing the map, bridges buildable
- **Forests**: Dense clusters, clearable for timber (early resource)
- **Marshland**: Difficult terrain, slower construction
- **Flat land**: Buildable tiles (majority of map)

Terrain is **NOT** border-only. Mountains, rivers, and forests appear throughout the map, creating natural chokepoints and strategic decisions about where to build.

### Camera & Framing

```
┌──────────────────────────────────────────┐
│████████████ TOP BAR (resources) █████████│
│▓▓│                                  │▓▓│
│▓▓│                                  │▓▓│
│▓▓│       GAME MAP VIEWPORT         │▓▓│
│▓▓│                                  │▓▓│  Concrete frame
│▓▓│    (drag to pan, pinch zoom)     │▓▓│  masks edges
│▓▓│                                  │▓▓│
│▓▓│                                  │▓▓│
│▓▓├──────────────────────────────────┤▓▓│
│▓▓│     WORKER CONTROLS / STATUS     │▓▓│
│████████████████████████████████████████│
└──────────────────────────────────────────┘
```

**Concrete Frame Rules**:
- Left/right borders: thin (8-12px) brutalist concrete texture
- Top: thicker, holds resource bar / era info
- Bottom: worker assignment panel
- **The frame is part of the UI chrome, not the game world**

**Edge Masking**:
- The game map is always larger than the viewport
- Zoom-out is clamped so the viewport never exceeds map bounds
- At maximum zoom-out, the concrete frame meets the map edge — no floating plane visible
- Pan is clamped to map bounds (can't scroll past edges)
- Terrain at map edges: mountains / dense forest (natural-looking boundary)

**Zoom Levels**:
- **Close**: Individual workers visible, building details, task assignments
- **Medium**: Building clusters, worker flow patterns, resource production
- **Far**: Full district view, strategic overview (max zoom-out, edges masked)

---

## 9. UI/UX — Mobile-First Brutalist

### Design Language

- **Brutalist Soviet aesthetic**: Raw concrete textures, industrial fonts, propaganda red accents
- **Functional, not decorative**: Every pixel serves gameplay
- **Thin chrome**: Maximize game viewport on phone screens
- **No floating menus**: Everything docked to edges or appears as contextual overlays
- **CRT scanline overlay**: Existing effect, kept as subtle texture

### Key UI Panels

#### Top Bar (Always Visible)
```
┌─────────────────────────────────────────┐
│ ☆ ERA: Industrialization  │ 1937 Feb    │
│ 👥 127  🌾 450  🍶 30  ⚡ 80  ₽ 2400  │
└─────────────────────────────────────────┘
```
- Era name + current year/month
- Worker count, food, vodka, power, rubles — icon + number
- Tap any resource → expanded detail overlay

#### Bottom Panel (Context-Sensitive)

**Default state** — Worker summary:
```
┌─────────────────────────────────────────┐
│ Idle: 12  │ Farm: 45 │ Factory: 30      │
│ Building: 8 │ Military: 15 │ [Auto] ▶  │
└─────────────────────────────────────────┘
```

**When workers selected** — Assignment options:
```
┌─────────────────────────────────────────┐
│ 3 workers selected                      │
│ [Farm] [Factory] [Build] [Power] [Idle] │
└─────────────────────────────────────────┘
```

**When building tapped** — Building info:
```
┌─────────────────────────────────────────┐
│ COLLECTIVE FARM HQ                      │
│ Workers: 12/20  │  Output: 45 food/tick │
│ [+Worker] [−Worker] [Details]           │
└─────────────────────────────────────────┘
```

#### Event Overlay (Modal, dismissible)
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

#### Pravda Ticker (Scrolling, bottom edge)
Existing system — satirical headlines scroll across the bottom. Moved above the bottom panel.

### Gesture Controls

| Gesture | Action |
|---------|--------|
| **Tap worker** | Select worker (shows assignment options) |
| **Tap building** | Show building info / assign selected workers |
| **Drag on map** | Pan camera |
| **Pinch** | Zoom in/out (clamped to map bounds) |
| **Double-tap building** | Auto-assign nearest idle workers |
| **Long-press worker** | Show worker details (name, morale, loyalty, skill) |
| **Swipe up on bottom panel** | Expand to full worker management view |

---

## 10. Resources & Economy

### Primary Resources

| Resource | Source | Consumed By | Era Availability |
|----------|--------|-------------|-----------------|
| **Food** | Farms, gardens | All workers (base need) | All eras |
| **Vodka** | Distillery | Workers (morale), corruption bribes | Collectivization+ |
| **Power** | Power plants | Factories, apartments, services | Industrialization+ |
| **Rubles** | Taxation, quota bonuses | Construction, bribes | All eras |
| **Timber** | Forest clearing | Early construction | Revolution, Collectivization |
| **Steel** | Factories | Advanced construction | Industrialization+ |
| **Paperwork** | Bureaucratic buildings | Nothing (it accumulates) | Stagnation+ |

### Production Chains

```text
Farms ──→ Food ──→ Feed Workers ──→ More Production
  │                                       │
  └──→ Grain ──→ Distillery ──→ Vodka ──→ Worker Morale
                                          │
Power Plant ──→ Power ──→ Factory ──→ Steel ──→ Construction
                              │
                              └──→ Industrial Output ──→ Quota
```

### Quota System

- Moscow sets quotas per 5-year plan
- Quotas are per-resource: food, industrial output, military conscripts
- Meeting quotas: survival. New buildings unlocked. No reward otherwise.
- Failing quotas: escalating consequences
  - 1st failure: stern warning, increased politruk presence
  - 2nd failure: KGB investigation, workers disappear
  - 3rd failure: your administrator is replaced (game over for this era)
- Exceeding quotas: Moscow raises the next quota. This is punishment, not reward.

---

## 11. Survival & Victory

### What You're Surviving

You survive the **three arms of the apparatus** (politruks, KGB, military) while keeping your collective alive. There is no external enemy. The system is the enemy.

### Per-Era Victory Conditions

| Era | Victory | Failure |
|-----|---------|---------|
| Revolution | Establish collective, survive 5 years with >5 workers | All workers die or desert |
| Collectivization | Meet first Five-Year Plan quotas | 3 consecutive quota failures |
| Industrialization | Build 3+ factories, electrify the town | Population drops below 50% of peak |
| Great Patriotic War | Survive with >50% population | Population drops below 20 |
| Reconstruction | Rebuild to pre-war building count | Fail reconstruction quotas |
| Thaw & Freeze | Navigate 3 doctrine switches without collapse | Morale-based revolt |
| Stagnation | Keep city functional for 18 years despite systemic rot | Everything breaks simultaneously |
| The Eternal | Reach Bureaucratic Singularity (5000 paperwork) | Bureaucracy collapses into chaos |

### Scoring — Civilization Style

Like Civilization, the game accumulates a running score across all eras:

**Score Sources**:
- Workers alive at era end (+2 per worker)
- Quotas met (+50 per quota)
- Quotas exceeded (+25, but next quota is harder)
- Buildings standing (+5 per building)
- Commendations earned (+30 each)
- Black marks on file (-40 each)
- Workers lost to KGB/purge (-10 each)
- Workers conscripted (-5 each)
- Era completed without investigation (+100 bonus)

**Score Multiplier**: Each era applies a difficulty multiplier (Era 1: ×1.0, Era 8: ×3.0). Later eras are worth more.

**End of Game**: If you survive all 8 eras without being thrown in a labor camp, you receive your final score and the **"Medal of the Order of the Soviet Union, Third Class"** — the most underwhelming possible recognition for decades of sacrifice. A ceremony screen shows a bored bureaucrat handing you a small pin.

**One More Turn**: After the medal ceremony, you can choose to continue playing in The Eternal era for no further points — just like Civilization's post-victory freeplay. The absurdist events escalate. The bureaucracy singularity looms. There is no liberation. There is no collapse. The state endures.

### Game Over

Game over is not "your city collapsed." Game over is **you personally being arrested**:
- Your file accumulates 7+ black marks → KGB investigation → arrest
- A special game-over screen: your personnel file displayed, every mark annotated
- "Chairman [Name] was reassigned to a facility in Siberia. A replacement has been appointed."
- Score is tallied with a penalty. You can restart the current era or start over.

---

## 12. Minigames

Minigames are **building-triggered and tile-triggered**. Tap certain buildings or terrain features → a minigame modal spawns. They're brief (30-90 second) interactive sequences that break up the management loop and provide alternate ways to gain/lose resources.

### Trigger System

Minigames spawn from **tapping specific buildings or tiles**:
- Tap the **KGB Station** → Interrogation minigame
- Tap the **Black Market** (hidden building, appears in shadows) → Trading minigame
- Tap a **Forest tile** → Hunting/foraging minigame
- Tap a **Mountain tile** → Mining expedition minigame
- Tap the **Factory** during breakdown event → Repair minigame
- Tap the **Party HQ** during ideology event → Ideology Session minigame
- Tap the **Queue** (visible line of workers at any building) → Queue Management minigame
- Tap the **Barracks** during conscription → Conscription Selection minigame

### 12.1 The Queue

**Trigger**: Tap a building with a visible queue (appears when resource distribution is backlogged).
**Gameplay**: Citizens lined up. You manage the queue by shuffling people, distributing rations, dealing with line-cutters. Politruk watches — maintain order without using force (using force attracts KGB).
**Reward/Penalty**: Efficient queue → morale boost. Fights break out → morale crash, KGB arrives, +1 black mark.

### 12.2 Ideology Session

**Trigger**: Tap Party HQ when politruk event is active.
**Gameplay**: Multiple-choice "exam" on Soviet ideology. Workers' answers affect their loyalty scores. You coach workers on "correct" answers before the session. Questions get harder in later eras.
**Reward/Penalty**: All pass → politruk leaves satisfied, loyalty scores rise. Failures → workers flagged, +1 black mark if too many fail.

### 12.3 The Inspection

**Trigger**: Moscow sends inspector — tap the inspector character when they arrive.
**Gameplay**: Papers, Please-style document review. Present reports, falsify numbers (risk), show model buildings. Inspector asks questions — your answers matter.
**Reward/Penalty**: Pass → quota deadline extended. Fail → immediate mark on file.

### 12.4 Conscription Selection

**Trigger**: Tap the barracks when a conscription order is active.
**Gameplay**: You see your workers lined up with their stats (skill, morale, production value). Select N workers to send. Each selection shows real-time impact on production. Timer ticking — delay = non-compliance.
**Reward/Penalty**: Strategic picks preserve production. Non-compliance → military arrives and takes workers randomly (always your best).

### 12.5 The Black Market

**Trigger**: Tap a shadowy alley tile or hidden market building (appears in later eras).
**Gameplay**: Risky trading interface. Barter goods at black market rates. A KGB-risk meter fills as you trade — stop before it maxes out or get caught. Prices fluctuate. Some deals are traps.
**Reward/Penalty**: Successful trade → desperately needed resources. Caught → severe penalty (workers taken, rubles confiscated, +2 black marks).

### 12.6 Factory Floor Emergency

**Trigger**: Tap a factory during a breakdown event (smoke/sparks visible).
**Gameplay**: Timing-based repair minigame. Match the right tool to the right pipe/gear. Fix the machine before the pressure gauge hits red.
**Reward/Penalty**: Fixed → production continues, small commendation. Failed → building damaged, workers injured, production halted.

### 12.7 The Hunt (Forest/Mountain Tiles)

**Trigger**: Tap a forest or mountain tile. Available when workers are assigned to foraging/hunting.
**Gameplay**: **Oregon Trail-style hunting** but bleaker. Side-scrolling scene: birch forest or snowy mountain. You have a single-shot rifle. Animals are scarce — maybe one rabbit, a crow, a thin deer. You get 3-5 shots. Ammunition is precious. The scene is grey, cold, Soviet.
- Forest variant: Rabbits, birds, mushroom gathering (tap to collect)
- Mountain variant: Goats, wolves (wolves can injure your hunter), mineral deposits (tap to mine)
- Winter variant: Almost nothing alive. Your hunter slowly freezes. Get what you can and leave.
**Reward/Penalty**: Successful hunt → small food bonus. Hunter injured → worker out of commission. Stay too long → frostbite (permanent worker stat reduction).
**Tone**: Not fun hunting — desperate subsistence. The rifle is old. The animals are thin. The forest is grey. There are no power-ups. This is survival, not sport.

### 12.8 Interrogation

**Trigger**: Tap KGB headquarters when an investigation event is active.
**Gameplay**: You are questioned. Multiple-choice dialog. The KGB officer asks about discrepancies in reports, suspicious worker behavior, your knowledge of black market activity. Your answers affect your file.
- Deflect successfully → investigation closed, no marks
- Implicate a worker → worker disappears, but your file stays clean (moral cost)
- Get caught lying → +2 black marks, increased KGB presence
**Tone**: Tense, quiet, claustrophobic. A desk. A lamp. A man in black asking questions you don't want to answer.

---

## 13. Technical Architecture Notes

### What Changes From Current Codebase

| System | Current | New |
|--------|---------|-----|
| **Core loop** | Building placement sim | Worker assignment sim |
| **Central resource** | Buildings | Workers (entities with role, morale, loyalty, skill) |
| **Input** | Tap toolbar → drag building | Tap worker → tap target |
| **Map** | 30×30 flat grid, edges visible | Variable-size seeded terrain, edges masked |
| **Camera** | Unlimited pan/zoom | Clamped to map bounds, concrete frame |
| **Buildings** | All 31 available immediately | Unlock via era/doctrine/policy |
| **UI** | React overlay toolbar | Mobile-first brutalist panels |
| **Progression** | Single continuous game | Era-based campaigns |
| **Political system** | PolitburoSystem runs passively | Active threats (politruks, KGB, military) |
| **ECS** | Exists but doesn't drive sim | Should become the primary authority |

### What Stays

- Canvas 2D renderer (add worker sprites, terrain types)
- Sprite pipeline (add worker sprite baking)
- ChronologySystem (drives era progression)
- PolitburoSystem (expanded to drive politruk/KGB/military)
- PravdaSystem (headlines reflect era and events)
- EventSystem (expanded with era-specific events)
- SeededRNG (deterministic terrain, worker generation)
- Dialog Bible / Advisor system (era-aware dialog)

### Implementation Priority

```text
Phase A: Map & Camera overhaul (concrete frame, zoom clamping, procedural terrain)
Phase B: Worker system (entities, roles, assignment, pathfinding, sprites)
Phase C: UI/UX redesign (mobile-first panels, tap-to-assign controls)
Phase D: Era campaign structure (progression, unlock triggers, victory/failure)
Phase E: Political apparatus (active politruks, KGB, military as game entities)
Phase F: Minigames (event-triggered interactive sequences)
Phase G: Polish (balance, playtesting, sound, juice)
```

---

## 14. Reference Documents

- `design-era-doctrines.md` — 8 doctrine definitions with modifiers, policies, signature mechanics
- `design-leader-archetypes.md` — 6 leader archetypes with behavioral loops and power transitions
- `design-leadership-architecture.md` — ECS components, modifier pipeline, TypeScript interfaces
- `design-power-transitions.md` — Succession mechanics, coup/purge/death systems
- `design-dialog-bible.md` — Advisor dialog, event text, era-specific writing
- `reference-politburo-system.md` — Existing PolitburoSystem documentation
- `reference-pravda-system.md` — Headline generation system
- `reference-world-building.md` — Timeline events, radio, loading quotes, achievements
