# SimSoviet 1917 — Game Vision

> *Alternate History. The Soviet State Endures.*

---

## The Pitch

You are the **predsedatel** — the chairman of a Soviet collective. You take orders from Moscow, ensure your workers meet impossible quotas, and try not to end up in Siberia. The political apparatus is the weather: politruks check your loyalty, the KGB disappears your best workers, and the military drafts them regardless. Your job is to keep everyone alive, meet production targets, and above all — avoid attracting attention.

**Genre**: Worker-management survival sim with 3D city-building
**Setting**: Alternate history — the Soviet Union never collapses, from 1917 through eternity
**Tone**: Dark satirical comedy. *Krokodil* magazine meets Papers, Please meets Banished
**Engine**: BabylonJS 8 via Reactylon (React Native + 3D), mobile-first

**What This Is NOT**:
- Not a power fantasy — you have no upward mobility
- Not a free-market sim — the planned economy dictates everything
- Not a war game — the military is a drain, not a tool
- Not a game where the USSR falls — the state endures forever

---

## Core Fantasy

You are not a hero. You are a middle manager in the most bureaucratic system ever devised. Your name is on a file in Moscow. That file accumulates **black marks**. Too many marks → investigation → labor camp → game over.

**The Sweet Spot**: Comfortable mediocrity. Excel too much → harder targets. Fail too badly → marks on your file. The entire game is navigating this impossible middle.

---

## Core Loop

```
STATE DEMANDS ──→ COLLECTIVE SELF-ORGANIZES
     ↑                    │
     │                    ↓
SURVIVE APPARATUS ←── YOU NAVIGATE THE MIDDLE
     │                    │
     │                    ↓
     └──── INTERVENE ONLY WHEN YOU MUST
```

1. **Watch the settlement breathe** — workers auto-assign to jobs, production ticks
2. **Respond to state demands** — Moscow mandates buildings and quotas. You choose WHERE.
3. **Navigate political survival** — commissar visits, KGB questions, military conscripts
4. **Make survival decisions** — who to sacrifice, how much corruption to allow, when to lie
5. **Override when desperate** — force-assign workers at political cost

### What the player DOES:
- Choose WHERE to place mandated buildings (the only spatial control)
- Set collective priorities when demands conflict
- Navigate political conversations with commissars, KGB, military
- Make moral choices — who to sacrifice, how much to lie
- Override the collective in emergencies (costs political capital)
- Falsify reports (pripiski) — risk vs. reward

### What the player does NOT:
- Individually assign workers (the collective self-organizes)
- Choose which buildings to unlock (policy from above dictates this)
- Draw roads (paths form from worker movement)
- Fight anyone directly
- Control the political apparatus — only endure it

---

## The Personnel File (Личное Дело)

The central tension mechanic. Your file replaces health bars and population thresholds as the fail-state meter.

| Effective Marks | State |
|---|---|
| 0–2 | **Safe** — unremarkable. This is the goal. |
| 3 | **Watched** — increased politruk presence |
| 4 | **Warned** — Moscow is noticing you |
| 5 | **Investigated** — KGB arrives, workers taken randomly |
| 6 | **Under Review** — automatic inspection triggered |
| 7+ | **Arrested** — game over (or rehabilitation, per consequence setting) |

**Black marks** from: quota failures, worker disloyalty, corruption caught, lying to KGB, black market, pripiski exposed
**Commendations** offset marks: quota exceeded, Stakhanovite, inspections passed
**Decay**: marks fade over time if no new ones added (rate depends on difficulty)
**Era transitions**: marks reset to 2 — the file follows you, but you get a fresh-ish start

---

## Eight Eras

Each era is a campaign with distinct mechanics, buildings, threats, and victory conditions. The collective is continuous — same map, same workers, same buildings.

| # | Era | Years | Core Mechanic | Victory |
|---|-----|-------|---------------|---------|
| 1 | **Revolution** | 1917–22 | Land redistribution, survival basics | Establish the collective |
| 2 | **Collectivization** | 1922–32 | Forced grain quotas, kulak purges | Meet first Five-Year Plan |
| 3 | **Industrialization** | 1932–41 | Factory conversion, gulag labor | Transform to industrial center |
| 4 | **Great Patriotic War** | 1941–45 | Conscription, rationing, factory conversion | Survive with >50% population |
| 5 | **Reconstruction** | 1945–56 | Rubble salvage, veteran integration | Rebuild infrastructure |
| 6 | **Thaw & Freeze** | 1956–82 | Policy oscillation | Navigate 3 doctrine switches |
| 7 | **Stagnation** | 1982–2000 | The Queue, decay, vodka economy | Keep city functional 18 years |
| 8 | **The Eternal** | 2000–??? | Bureaucratic Singularity | Reach 5000 paperwork |

### What carries over between eras:
- Map, buildings, workers (with their stats), score (cumulative)
- Blat reduced 30% (contacts reshuffled)

### What changes:
- Doctrine, available buildings, quota structure, political apparatus posture
- Black marks reset to 2

---

## Settlement Evolution

Based on the real Soviet settlement classification system. Upgrades happen automatically when thresholds are met.

| Tier | Russian | Threshold | What Changes |
|------|---------|-----------|-------------|
| **Selo** (village) | село | Starting state | No bureaucracy. Just you and your peasants. |
| **Posyolok** (settlement) | рабочий посёлок | 50+ workers, ≥1 factory | First politruk arrives. Industrial quotas begin. |
| **PGT** (urban settlement) | ПГТ | 150+ workers, ≥50% non-agricultural | KGB station. Full quota system. |
| **Gorod** (city) | город | 400+ workers, ≥85% non-agricultural | Full city soviet. Enormous quotas. |

Upgrades unlock new buildings, new political pressure, and new problems. Downgrades are humiliating but reduce scrutiny — a player might deliberately shrink to escape bureaucratic overhead.

---

## The Planned Economy

Resources flow through the **plan**, not the market. Five primary currencies — none of them rubles:

| Currency | What It Is |
|----------|-----------|
| **Trudodni** (labor days) | Workers generate output proportional to skill × task difficulty |
| **Fondy** (material allocations) | State allocates construction materials — may arrive late, short, or wrong |
| **Compulsory deliveries** | State takes 40–70% of output FIRST. You manage the remainder. |
| **The Remainder** | What's left after the state, seed fund, and emergency reserve. This feeds your workers. |
| **Blat** (connections) | Informal favors. Expedite deliveries, lower quotas, protect workers. Risky — KGB watches. |

### The Five-Year Plan

Moscow sends production quotas AND construction mandates every 5 years. You don't choose what to build — you choose where. Meeting quotas exactly is the goal. Exceeding them is a trap (next quota rises 20-40%).

### Pripiski (Report Falsification)

The player's weapon. Annual reports to Moscow can be honest, inflated, or deflated:
- **Honest**: take whatever marks come
- **Padded** (pripiski): avoid failure marks, but risk KGB exposure (+3 marks if caught)
- **Deflated**: hide surplus for reserves, but risk "hoarding" charges

The lie snowballs — inflate once and you need to inflate more next year.

---

## The Political Apparatus

Three forces you cannot control, only endure:

### Politruks (Red) — The Eyes
Political officers hold ideology sessions, check loyalty, report findings upward. You can't stop them — only manage which workers attend (send your least productive). Vodka before a session boosts loyalty scores.

### KGB (Black) — The Fist
Acts on politruk reports and its own suspicion. Workers **disappear** — no trial, no announcement. During paranoia spikes, targets your best workers. The Informant Network (Freeze doctrine) creates paranoia spirals where workers false-report each other.

### Military (Green) — The Drain
Conscription demands pull workers regardless of impact. You choose who to send — agonizing choices. Non-compliance means the military takes workers randomly (always your best).

---

## Workers — The Central Resource

Workers are the game. Not buildings, not resources — *people*.

The collective **self-organizes** around a 5-level behavioral priority stack:
1. **Don't die** — forage, gather fuel, find shelter
2. **Meet state demands** — mandated construction, quota shortfalls
3. **Fulfill trudodni minimum** — self-assign to job slots
4. **Improve the collective** — repair buildings, train skills
5. **Private life** — personal gardens, rest, vodka

The player adjusts priorities, not individual assignments. "All hands to the harvest" bumps food to Priority 1. "Allow black market this month" enables a hidden economy boost at KGB risk.

### Population is a drain-and-replace system:
- **6 drains**: natural attrition, orgnabor, conscription, purges, youth flight, illegal migration
- **4 inflows**: births (slow), Moscow assignments, forced resettlement, kolkhoz amalgamation
- Your job isn't to grow population — it's to **stop the bleeding**

### Hidden worker stats:
- **Morale**: food, vodka, housing, overwork. Low morale → slow production, defection
- **Loyalty**: ideology sessions. Low loyalty → flagged for KGB
- **Skill**: workers improve over time. Losing skilled workers hurts
- **Vodka dependency**: cut vodka after they're hooked → morale crash

---

## Minigames

Eight building/tile-triggered interactive sequences that break up the management loop. Each pauses the simulation and presents choices with real consequences:

| Minigame | Trigger | Core Tension |
|----------|---------|-------------|
| **The Queue** | Building with backlog | Maintain order without force (force → KGB) |
| **Ideology Session** | Party HQ + politruk | Coach workers on "correct" answers |
| **The Inspection** | Inspector arrives | Papers, Please-style — present or falsify reports |
| **Conscription** | Barracks + order | Choose workers to send, real-time production impact |
| **Black Market** | Hidden market tile | Trade at risk — KGB meter fills as you trade |
| **Factory Emergency** | Factory breakdown | Timing-based repair before pressure gauge hits red |
| **The Hunt** | Forest/mountain tile | Oregon Trail-style desperate subsistence hunting |
| **Interrogation** | KGB HQ + investigation | Deflect, implicate someone, or get caught lying |

Each choice shows its success probability and risk tier. Ignoring a minigame auto-resolves with a worse outcome.

---

## Scoring

**Civilization-style** cumulative scoring across all 8 eras:

| Source | Points |
|--------|--------|
| Workers alive at era end | +2 each |
| Quotas met | +50 each |
| Buildings standing | +5 each |
| Commendations | +30 each |
| Black marks | -40 each |
| Workers lost to KGB | -10 each |
| Clean era (no investigation) | +100 bonus |

**Era multiplier**: Later eras worth more (Era 1: x1.0, Era 8: x3.0)

### Difficulty × Consequence

| Difficulty | Effect |
|-----------|--------|
| **Worker** (Easy) | 0.6x quotas, fast mark decay, fewer politruks |
| **Comrade** (Normal) | Standard conditions |
| **Tovarish** (Hard) | 1.5x quotas, slow mark decay, frequent KGB |

| Consequence | At 7+ Marks |
|------------|-------------|
| **Forgiving** | Return after 1 year, 90% buildings survive |
| **Permadeath** | Game over. Restart era. x1.5 score multiplier. |
| **Harsh** | Return after 3 years, 40% buildings, 25% workers |

Score multiplier ranges from x0.5 (Worker+Forgiving) to x2.0 (Tovarish+Permadeath).

### End of Game

Survive all 8 eras → **"Medal of the Order of the Soviet Union, Third Class"** — a bored bureaucrat hands you a small pin. Continue playing in The Eternal era for no further points. The bureaucracy singularity looms. There is no liberation. There is no collapse. The state endures.

---

## Design Principles

1. **The system is the enemy** — No external foes, only bureaucratic apparatus
2. **Comfortable mediocrity** — Optimal strategy is being unremarkable
3. **Top-down pressure** — The player never chooses *what* to build, only *where*
4. **Workers, not buildings** — People are the central resource
5. **Historical authenticity** — Research how the real Soviet system worked, then gamify it
6. **Satirical tone** — All text maintains dark comedy
7. **Autonomous collective** — Workers self-organize; the player sets priorities and intervenes in crisis

---

## Aspirational Systems (Not Yet Implemented)

These systems are fully designed in the `docs/design/` subdirectory but not yet built:

| System | Design Doc | Description |
|--------|-----------|-------------|
| **Dual economy** | `economy.md` | Trudodni, fondy, compulsory deliveries, remainder principle, blat |
| **Worker AI** | `workers.md` | 5-level behavioral governor, autonomous self-organization, morale/loyalty/skill |
| **Dvor (household)** | `demographics.md` | Family structures, gendered labor, birth/death, private plots |
| **Full political apparatus** | `political.md` | Procedural politruks, KGB with informant networks, military conscription |
| **Era-gated buildings** | `eras.md` | Unlock progression tied to era, doctrine, and leader decisions |
| **Construction phases** | `economy.md` | Material gathering → foundation → construction → completion |
| **Reporting & pripiski** | `political.md` | Annual report falsification with compounding risk |
| **Leadership system** | `design-leadership-architecture.md` | Procedural leaders with 11 archetypes, 8 doctrines, succession mechanics |
| **Politburo simulation** | `reference-politburo-system.md` | 10 ministries, 80-cell interaction matrix, coups, purges |
| **Interactive minigames** | `minigames.md` | Timing, dialog, and management mini-sequences (currently text-choice only) |
| **Heating system** | `economy.md` | Pechka → district heating → crumbling infrastructure |
| **Storage & spoilage** | `economy.md` | Capacity limits, seasonal spoilage, winter preparation cycle |

### Currently Implemented

| System | Status |
|--------|--------|
| 3D rendering (BabylonJS 8) | Working — 55 GLB models, terrain, weather FX, lighting |
| Building placement | Working — 16 building types, 3 levels |
| Resource tracking | Working — food, vodka, power, water, money, population |
| Five-year plan quotas | Working — targets, annual reviews, pripiski |
| Era progression | Working — 8 eras with transitions and timeline events |
| Personnel file | Working — black marks, commendations, threat levels, decay |
| Settlement tiers | Working — selo → posyolok → PGT → gorod with upgrade events |
| Achievements | Working — 31 achievements with tracking |
| Minigames | Working — 9 text-choice events with success probabilities |
| Difficulty/consequence | Working — 3×3 matrix with score multipliers |
| Scoring & game tally | Working — medals, statistics, final score |
| Audio | Working — 52 Soviet-era tracks, mood playlists |
| Tutorial (directives) | Working — 12 sequential objectives |
| Save/load | Working — full serialization |
| All UI panels | Working — 22 overlay components |

---

## Reference Documents

### Core Design (in `docs/design/`)
- `overview.md` — Game identity, core loop, settlement evolution
- `economy.md` — Planned economy, production formulas, heating, storage
- `workers.md` — Worker system, population dynamics, morale
- `demographics.md` — Household (dvor) system (draft)
- `political.md` — Political apparatus, personnel file, pripiski
- `eras.md` — 8 era campaigns, transitions, doctrine integration
- `minigames.md` — 8 triggered minigames
- `scoring.md` — Scoring, difficulty, consequence system
- `ui-ux.md` — Mobile-first brutalist UI design
- `map-terrain.md` — Procedural terrain, camera system

### Architecture & Reference (in `docs/`)
- `GDD-master.md` — Complete master game design document
- `design-ecs-architecture.md` — Miniplex 2.0 ECS specification
- `design-leadership-architecture.md` — Political ECS components
- `design-era-doctrines.md` — 8 composable policy modifier sets
- `design-power-transitions.md` — Leadership succession mechanics
- `design-leader-archetypes.md` — 11 procedural leader personality types
- `design-dialog-bible.md` — Complete in-game voice guide
- `reference-politburo-system.md` — Ministry simulation (10 ministries, 29 events)
- `reference-pravda-system.md` — Procedural headline generator (145K+ combinations)
- `reference-name-generator.md` — Russian name generator (1.1M+ combinations)
- `reference-world-building.md` — Timeline, achievements, flavor text
