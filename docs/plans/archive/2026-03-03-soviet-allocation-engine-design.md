# Soviet Allocation Engine — Design Document

> **For Claude:** This design supersedes portions of `2026-03-03-buildings-are-the-ui-design.md` and extends the building-as-container architecture into a fully emergent, agent-driven simulation engine. REQUIRED SUB-SKILL: Use `superpowers:writing-plans` to create the implementation plan.

**Goal:** Replace the current tick-by-tick entity-scanning simulation with a DB-backed, agent-driven allocation engine where buildings are computational units, dvory are motivated agents, and every tick is a pure function of current state — scaling to 10,000+ years without performance degradation.

**Architecture:** DB is the world. Viewport is a window. Buildings scale by orders of magnitude. Agents with correct motivations produce emergent behavior. No system reads history. The player is a Soviet chairman who sets policies and sweats.

**Predecessor docs:** `buildings-are-the-ui-design.md` (Phase 2-3 absorbed here), `autonomous-collective-plan.md` (CollectiveAgent extended), `yuka-chairman-brain-design.md` (agent motivations extended).

---

## 1. World Architecture — DB-Backed Dynamic Map

### The DB Is the World

The game world is stored in expo-sqlite (Drizzle ORM). The R3F viewport renders only what the camera sees. Everything else exists as DB rows.

**Tables (extending existing schema):**

| Table | Purpose |
|-------|---------|
| `terrain_tiles` | Per-tile state: type, fertility, contamination, moisture, forest_age, erosion_level, elevation, has_road, has_pipe |
| `buildings` | Per-building state: defId, gridX, gridY, tier, workerCount, residentCount, avgMorale, avgSkill, avgLoyalty, netOutput, constructionPhase |
| `displaced_dvory` | Entity-mode dvory seeking shelter: dvorId, members[], position, currentGoal, urgency |
| `terrain_history` | Write-only log of terrain changes for player's map view (deforestation dates, crater locations, flood events) |
| `settlement_state` | Single-row current state: population, totalBuildings, era, year, month, landGrantRadius, trendDeltas |

**Viewport rendering:**
- Camera position → spatial query: `SELECT * FROM buildings WHERE gridX BETWEEN ? AND ? AND gridY BETWEEN ? AND ?`
- Matching buildings loaded into ECS for R3F rendering
- Camera moves → old entities unload, new ones load
- Off-screen buildings still tick via DB (state updates, no rendering)

### Land Grants

Territory is a reward/punishment mechanic controlled by the state.

| Settlement Tier | Land Radius | Trigger |
|----------------|-------------|---------|
| selo (starting) | ~15 tiles from HQ | Initial allotment |
| posyolok | ~30 tiles | 50+ population, 1 industry |
| pgt | ~60 tiles | 150+ pop, 50% non-agricultural, education + medical |
| gorod | ~120 tiles | 400+ pop, 85% non-agricultural, 5+ building roles |
| (Freeform) | Expanding | Continued growth + quota fulfillment → further grants |

Land grants create natural tension cycles:
- **Cramped phase:** Every tile matters. Government expansion displaces people immediately.
- **Relief phase:** New land arrives. Room to spread. But now you must FILL it or look wasteful to the Party.
- **Overextension phase:** Huge territory but infrastructure costs (heating, power, roads) scale with distance.
- **Consolidation phase:** Mega-buildings pull everything back inward. The edges become wasteland.

Both Historical and Freeform modes use land grants. Historical has a fixed end (1991). Freeform is endless — each grant comes with higher expectations.

---

## 2. Building Lifecycle — Emergent from Agent Motivations

### No Scripted Triggers

Buildings evolve because agents pursue their motivations. The government expands because that's what governments do. Housing gets pushed outward because government buildings are protected. Mega-structures form because agents prefer proximity for efficiency.

### Starting State

One multi-function settlement HQ. Does everything — housing, food storage, governance, militia post. A shitty wooden building that IS the settlement.

As population grows, the government agents decide they need dedicated buildings. They place them centrally. Whatever was there gets demolished (unless protected). This is not a "decomposition trigger" — it's Soviet power dynamics playing out.

### Protected Covenants (in the "Classless" System)

| Class | Protection | Behavior |
|-------|-----------|----------|
| **Government** | Never demolished. Never displaced. | Expands toward center. Displaces anything expendable. |
| **Military** | Never demolished. Priority housing. | Claims best defensive positions. |
| **Power/Water** | Never demolished (critical infrastructure). | Placed by engineering logic, not politics. |
| **Industry** | Demolishable but costly (lost production). | Collective resists demolishing productive buildings. |
| **Housing** | Fully expendable. | First to go when government needs space. People suffer for the Party. |
| **Farms** | Fully expendable. | Relocated to outskirts. Food disruption during transition. |

When a protected-class building needs space:
1. Select optimal location (government → center, military → perimeter, power → near demand)
2. Identify buildings at that location
3. If expendable → demolish. Residents ejected to entity mode (displaced dvory).
4. If protected → find next-best location
5. Displaced dvory seek new shelter. Collective detects housing shortage → builds new housing (on the outskirts, where land is available, eventually)

### Mega-Scaling

Buildings scale by orders of magnitude. Same 50 GLB models, brutalist-scaled.

**Three factors combine:**

1. **Era unlocks ability:**

| Era | Max Building Tier | Scale Factor |
|-----|------------------|--------------|
| Revolution | Base | ×1 |
| Collectivization | Tier 1 | ×10 |
| Industrialization | Tier 2 | ×100 |
| Great Patriotic | Tier 2 | ×100 (no construction focus) |
| Reconstruction | Tier 3 | ×1,000 |
| Thaw/Freeze | Tier 3 | ×1,000 |
| Stagnation | Tier 4 | ×10,000 |
| Eternal/Freeform | Tier 5+ | ×100,000+ |

2. **Population pressure triggers need:** When demand exceeds current capacity, the collective scales UP instead of building more small structures (if the era allows it).

3. **Player policy sets priority:** Gosplan sliders determine which sector scales first. "Consolidate housing" vs "expand farmland" vs "fulfill quota."

**Scaling mechanics:**
- Scaling up requires demolishing adjacent smaller buildings to make room
- Construction takes proportionally longer (mega-block = months, not weeks)
- Displaced dvory from demolished buildings become homeless during construction
- The scaled building absorbs the capacity of all buildings it replaced

### Organic Consolidation (Late Game / Freeform)

At extreme scale, agents prefer proximity for efficiency:
- Power distribution is cheaper over short distances
- Food logistics work better with clustered consumers
- Administrative control is easier when everything is close
- These preferences naturally merge adjacent single-purpose mega-buildings into multi-function mega-structures

The Freeform long game (year 1000+): roads disappear. A tight grid of multi-function mega-structures surrounds the central government complex. Nuclear plant in the heart (efficient power distribution — and if it blows, that's a statistic). Pure Soviet brutalist efficiency taken to its logical extreme.

---

## 3. Dvory Motivation — Maslow's Hierarchy, Soviet Edition

### Every Dvor Is a Motivated Agent

No assignment systems. Pure survival logic drives behavior.

**Priority hierarchy:**

| Priority | Need | Behavior |
|----------|------|----------|
| 1 (highest) | **SHELTER** | Seek any building with housing capacity. Pathfind to nearest. If none: build makeshift shelter (temporary, low quality, angers Party). |
| 2 | **FOOD** | Seek food source. Work a farm, forage, private plot. Accept rations from housing building distribution. |
| 3 | **SERVE THE PARTY** | Report to assigned labor. Fulfill trudodni quota. Be a good Soviet citizen. |

Once housed, a dvor is absorbed into the building's aggregate statistics. It disappears from the entity list. Its labor contributes to the building's production function.

### Visibility by Scale

- **Entity mode (small scale):** Individual figures visible on the map. You see Ivan wandering after his building was demolished. Soviet guilt.
- **Aggregate mode (mega scale):** "12,847 displaced — estimated resettlement: 8 months" in a report at the Government HQ. People as numbers.
- Transition is per-dvor STATUS (housed vs unhoused), not a global population threshold.

### Displacement Cascade

1. Government demolishes housing for new ministry building
2. 500 dvory ejected to entity mode (visible wanderers at small scale, statistic at large)
3. They pathfind toward nearest housing with capacity
4. If capacity full → overflow to next nearest, or build makeshift camps
5. Collective detects housing shortage → queues new housing construction (outskirts)
6. 8 months later: housing completes → dvory flood in → absorbed to aggregate
7. During those 8 months: visible suffering, morale crash, production decline, KGB takes note

### Protected Classes (Nomenclatura)

Government officials, military officers, KGB agents are NEVER truly unhoused. When their building is demolished, they immediately claim priority space in the next-best building — displacing whoever was already there. The nomenclatura always lands on their feet. Everyone else scrambles.

---

## 4. Terrain as Living System

The landscape changes over time. Decisions from year 50 manifest as terrain consequences in year 200.

### Active Terrain Processes

| Process | Cause | Effect | Timeline |
|---------|-------|--------|----------|
| **Deforestation** | Timber harvesting by workers | Soil erosion, reduced fertility, dust bowl risk | Years to decades |
| **Reforestation** | Player policy or natural regrowth | Reverses erosion. Takes decades. | 20-50 years |
| **Marsh drainage** | Agricultural expansion | Short-term food boost. Long-term: water table drop, ecosystem collapse | 10-30 years |
| **Mining scars** | Open-pit mining (including meteor craters) | Permanent terrain damage. Possible contamination. | Permanent |
| **Construction rubble** | Demolished buildings | Bare ground. Slow natural recovery. | 5-10 years |
| **Contamination** | Industrial pollution, nuclear events | Poison zone. Disease, crop failure, birth defects. | Decades to centuries |
| **Global warming** (Freeform) | Accumulated industrial output over centuries | Permafrost thaw (foundation damage), rising water levels (flooding), biome shift (tundra→taiga→steppe) | Centuries |
| **Flooding** | Rising waters, dam failure, spring melt | Destroys low-elevation buildings. Permanent if water level change is structural. | Seasonal or permanent |

### Meteor Strikes → Open-Pit Mines

Meteor strikes are random terrain events:
1. **Impact:** Destroys buildings in radius, creates crater, casualties
2. **Aftermath:** Crater remains as permanent terrain feature
3. **Opportunity:** The Party declares "geological surveys indicate valuable mineral deposits"
4. **Open-Pit Mine:** Crater converted to mine building. Produces minerals, steel, rare resources.
5. **Hazards:** Cave-ins, pollution, worker deaths. Classic Soviet industrial hazard.
6. **Replaces:** The old "Cosmic Tap" sci-fi building. Same mechanic (requires crater), zero sci-fi, 100% Soviet.

### Per-Tile DB State

```
terrain_tiles: {
  x, y,
  type: 'forest' | 'steppe' | 'marsh' | 'tundra' | 'water' | 'mountain' | 'urban' | 'rubble' | 'crater' | 'contaminated',
  fertility: 0-100,
  contamination: 0-100,
  moisture: 0-100,
  forest_age: 0-N (years since last planting/regrowth),
  erosion_level: 0-100,
  elevation: number,
  has_road: boolean,
  has_pipe: boolean,
  modified_year: number (last significant change)
}
```

Terrain ticks yearly (not per-tick). Only tiles with active processes (erosion > 0, contamination > 0, forest growing, flooding) need computation. Dormant tiles skip.

---

## 5. Prestige Projects — Soviet Ego at Scale

### The Politburo Demands Greatness

Prestige projects are NOT player-initiated. The Politburo demands them. The player decides priority and resource allocation. Success brings glory. Failure brings the gulag.

### Historical Prestige Projects (Era-Locked)

| Era | Project | Cost | Risk | Reward |
|-----|---------|------|------|--------|
| Revolution | White Sea Canal | Massive labor, thousands die | Worker death toll, morale collapse | Marginal transport benefit, Party approval |
| Collectivization | Model Kolkhoz | Food + labor diversion | Famine if crops fail | Propaganda victory, foreign visitors |
| Industrialization | Magnitogorsk-scale steel city | Everything — years of investment | Total commitment, no fallback | Industrial capacity leap |
| Reconstruction | Nuclear Program | Secret resource drain | Catastrophic if mismanaged | Geopolitical transformation, power source |
| Thaw | Space Race (Sputnik, Gagarin) | Massive technical + resource investment | Public embarrassment if failure | Global prestige, morale surge |
| Stagnation | BAM Railway / Buran Shuttle | Ruinous expense | Diminishing returns, brain drain | Bureaucratic inertia justification |
| Eternal | Palace of the Soviets | Unlimited ego | Never completed in real history | Will YOU complete it? |

### Freeform Prestige Escalation

The ChaosEngine generates increasingly ambitious prestige demands as centuries pass. The scale matches the settlement's growth:
- Year 200: Orbital station
- Year 500: Moon colony
- Year 1000: Planetary-scale engineering
- Year 5000+: Projects that dwarf anything historical — generated from archetype templates, not hardcoded

### Mechanics

- Prestige projects consume a % of total settlement output for their duration (years to decades)
- Workers diverted from housing/food/industry → shortages during construction
- Success probability influenced by: worker skill, resource quality, morale, sabotage risk, crisis interference
- Success: commendations, morale surge, possible land grant, Politburo favor
- Failure: black marks, massive resource waste, possible regime change
- On the map: prestige projects are HUGE — visually dominant landmarks. Half-built projects scar the landscape if abandoned.

---

## 6. Agent-Driven Policy System (Government HQ)

### The Government HQ Is the Player's Primary Interface

Each agency has its own tab with its natural interaction pattern. The form fits the function.

| Agency | UI Pattern | Player Controls | Player Can't Control |
|--------|-----------|----------------|---------------------|
| **Gosplan (Economy)** | Allocation sliders | % split: housing, food, industry, defense, prestige | Which specific buildings get built |
| **Central Committee** | Directive decrees | Issue orders with lock-in period. Reversal costs black marks. | How the collective executes them |
| **Supply/Logistics** | Resource routing | Where surplus flows: stockpile / distribute / export to Party | Daily distribution to individuals |
| **KGB** | Reports (read-only) | Nothing — they report TO you | Their investigations, methods, targets |
| **Military** | Posture setting | Peacetime / Defensive / Mobilized (each diverts different worker %) | Specific deployments or operations |
| **Politburo** | Demands + prestige | Accept or defer demands (deferring costs reputation) | What they demand or when |

### The Anxiety Loop

This is the core gameplay experience:

1. KGB report arrives: "Food shortages in eastern district. Unrest growing."
2. Check Gosplan: sliders show 20% food, 40% industry (fulfilling the Five-Year Plan)
3. **Decision point:** Shift to 40% food (but miss quota) or hold course (risk famine)?
4. Issue decree: "Redirect resources to agricultural production"
5. Decree locks in for 6 months. Reversal costs 2 black marks.
6. Watch food production slowly climb... industrial output drops... quota deadline approaches...
7. KGB update: "Worker morale declining in factory district due to reassignment"
8. Politburo message: "Comrade, the Five-Year Plan expects steel output. Explain."
9. **Every decision creates two new problems.** That's Soviet governance.

### Agency Motivations (Yuka Agents)

Each agency is a Yuka agent with its own motivation function. The player sets parameters. The agents execute according to their nature.

- **Gosplan:** Motivated by balanced production. Follows slider allocations but interprets them through bureaucratic inertia (changes take time to propagate).
- **Central Committee:** Motivated by ideological consistency. Decrees that contradict current era doctrine get pushback.
- **KGB:** Motivated by control and surveillance. Reports are biased toward threats (they WANT you to be afraid). May exaggerate dissent to justify their budget.
- **Military:** Motivated by readiness. Always pushes for higher mobilization. Peacetime feels threatening to them.
- **Politburo:** Motivated by prestige and legacy. Demands grandiose projects. Out of touch with ground reality.

The player navigates between these competing motivations. No agency is fully trustworthy. No report is fully objective. Welcome to the Soviet Union.

---

## 7. Tick Architecture — Pure Function of Current State

### The Core Principle

```
Each tick: nextState = f(currentState, modifiers)
```

Nothing reads history. Nothing grows with time. Every input is fixed-size.

### Per-Building Tick

```typescript
function tickBuilding(building: BuildingState, ctx: TickContext): BuildingState {
  const food = baselineRation(ctx.totalFood, ctx.totalPopulation)
    + spikeFactor(building.loyalty, building.proximity, building.skill, ctx.kgbFavor);
  const output = building.baseRate
    * effectiveWorkers(building.workerCount, building.avgSkill)
    * moraleFactor(building.avgMorale)
    * weatherFactor(ctx.weather, ctx.season)
    * crisisModifier(ctx.activeCrisisState)
    * terrainFactor(building.tileFertility);
  return { ...building, foodReceived: food, netOutput: output, /* ... */ };
}
```

O(1) per building. No entity scanning. No history lookup.

### Per-Tile Terrain Tick (Yearly)

```typescript
function tickTerrain(tile: TerrainState, ctx: YearlyContext): TerrainState {
  const erosion = tile.erosion + (tile.deforested ? ctx.rainfall * 0.1 : 0);
  const fertility = Math.max(0, tile.fertility - erosion * 0.01 - tile.contamination * 0.05);
  const forestAge = tile.hasForest ? tile.forestAge + 1 : 0;
  const waterLevel = tile.waterLevel + ctx.globalWarmingRate * tile.lowElevationFactor;
  return { ...tile, erosion, fertility, forestAge, waterLevel };
}
```

Only active tiles (erosion > 0, contamination > 0, forest growing, flooding). Dormant tiles skip.

### Crisis State Machines (Not Timers)

Crises are in STATES, not counting ticks:

```typescript
type CrisisPhase = 'dormant' | 'building' | 'peak' | 'waning';

function transitionCrisis(crisis: CrisisState, ctx: SettlementSummary): CrisisPhase {
  switch (crisis.phase) {
    case 'dormant':
      return shouldActivate(crisis, ctx) ? 'building' : 'dormant';
    case 'building':
      return ctx.conditionsMet(crisis.peakConditions) ? 'peak' : 'building';
    case 'peak':
      return ctx.conditionsRelieved(crisis.reliefConditions) ? 'waning' : 'peak';
    case 'waning':
      return ctx.conditionsNormal(crisis.normalConditions) ? 'dormant' : 'waning';
  }
}
```

Transitions on CONDITIONS, not tick counts. A famine peaks when food drops below threshold, wanes when food recovers. Not "after 12 ticks."

### Agent Evaluation — Fixed-Size Inputs

Every agent reads a fixed-size settlement summary:

```typescript
interface SettlementSummary {
  year: number;
  month: number;
  population: number;
  buildingCount: number;
  totalFood: number;
  totalPower: number;
  totalMorale: number; // average across buildings
  activeCrisisCount: number;
  activeCrisisTypes: Set<string>;
  trendDeltas: {
    food: number;     // +/- change from last tick
    population: number;
    morale: number;
    power: number;
  };
  yearsSinceLastWar: number;
  yearsSinceLastFamine: number;
  yearsSinceLastDisaster: number;
}
```

Same size at year 50 or year 50,000. No `getAllEvents()`. No timeline scanning. No growing arrays.

### Timeline Is Write-Only

Events get logged to the DB for the player's history UI. NO simulation system ever reads the timeline. It's a journal, not an input.

```sql
INSERT INTO timeline_events (year, month, event_type, description, building_id)
VALUES (?, ?, ?, ?, ?);
-- Never: SELECT * FROM timeline_events (in simulation code)
```

---

## 8. Resource Distribution — Two-Layer Model

### Layer 1: Uniform Baseline (The Soviet Promise)

Every housed citizen gets minimum rations: food, water, heating. Distributed equally across all housing buildings based on resident count.

```
baselinePerCapita = totalSupply / totalPopulation
each housing building receives: baselinePerCapita * building.residentCount
```

If `totalSupply < totalDemand`: everyone gets less. Rationing. The bread line. Everyone waits. Everyone gets the same inadequate amount.

### Layer 2: Spiky Secondary (The Soviet Reality)

Factors boost individual building allocations above baseline:

| Factor | Mechanism | Historical Basis |
|--------|-----------|-----------------|
| **Loyalty** | High-loyalty buildings get surplus first | Reward the faithful, punish the disloyal |
| **Proximity to government** | Buildings near center get better distribution | Nomenclatura privilege, Moscow vs provinces |
| **Worker skill** | Critical-skill buildings get priority rations | Keep the engineers fed, the scientists working |
| **KGB favor** | Good surveillance reports → bonus allocation | Informants eat better |
| **Black market** | Buildings near trade routes skim extra | Corruption is a feature, not a bug |

```
building.totalAllocation = baseline + spikeFactor(loyalty, proximity, skill, kgbFavor, blackMarket)
```

The player controls Layer 1 through Gosplan sliders. Layer 2 emerges from agent motivations. The player can't directly control who gets the surplus. Visible inequality in a "classless" system.

---

## 9. Performance Model — Scales to 10,000+ Years

### Entity Counts by Timescale

| Timescale | Buildings | Active terrain | Entity dvory | Tick cost |
|-----------|-----------|---------------|--------------|-----------|
| Year 1 | 1 (HQ) | ~100 tiles | ~50 wanderers | Trivial |
| Year 50 | ~30 | ~500 | ~20 displaced | Trivial |
| Year 200 | ~80 mega | ~2,000 | ~50 displaced | Light |
| Year 1,000 | ~50 mega-mega | ~5,000 | ~100 displaced | Moderate |
| Year 10,000 | ~30 mega-structures | ~20,000 | ~50 displaced | Moderate |

### Why It Scales

- **Building count stays bounded:** Mega-scaling replaces many small buildings with few large ones
- **Entity dvory are always small:** Only the currently displaced need individual tracking
- **Terrain is O(active tiles):** Dormant tiles (no erosion, no contamination, no growth) skip entirely
- **No history accumulation:** No system reads past events. No arrays grow with time.
- **DB handles persistence:** Memory only holds viewport entities + active displaced dvory
- **Per-tick cost is constant** for a given settlement size, regardless of elapsed years

### Freeform at 10,000 Years

The simulation runs at the same speed whether it's year 50 or year 10,000. The ChaosEngine reads the same fixed-size `SettlementSummary`. Buildings compute the same O(1) output function. The only thing that grows is the map (via land grants) — and that growth is bounded by what the player earns.

---

## Appendix: What This Replaces

| Current System | Replaced By |
|---------------|-------------|
| 30×30 fixed grid (`GameGrid`) | Dynamic DB-backed map with land grants |
| Entity mode (pop < 200) / Aggregate mode (pop >= 200) | Per-dvor status: housed (aggregate) vs displaced (entity) |
| `Math.random()` mocking in tests | Seeded `GameRng` with fixed seed phrases |
| `CollectiveAgent` demand detection + auto-build | Same agent, driven by policy sliders + protected class rules |
| `operationalBuildings` archetype scan every tick | Per-building DB tick, O(1) per building |
| `timeline.getAllEvents()` in ChaosEngine | Fixed-size `SettlementSummary` counters |
| Crisis tick counters (buildupTicks, aftermathTicks) | State machine transitions on conditions |
| BUILD toolbar + direct placement | Removed. Player sets policies at Government HQ. |
| Cosmic Tap (sci-fi) | Open-Pit Mine (meteor crater → mining) |
| `DIFFICULTY_PRESETS` (worker/comrade/tovarish) | Dynamic modifiers from Governor + crisis state machines |

---

## Appendix: Soviet Historical Accuracy Notes

The design is grounded in real Soviet governance patterns:

- **Protected classes:** The nomenclatura system (Party elite housing, special stores, priority services) existed throughout Soviet history despite official classlessness.
- **Central placement:** Soviet city planning placed government/Party buildings centrally (see: any Soviet-era city center). Housing was pushed to periphery mikrorayons.
- **Land allocation:** The Soviet state owned all land. Settlements received territorial allocations from higher authorities. Expansion required justification.
- **Prestige projects:** The Soviet system was driven by prestige (Space Race, BAM, White Sea Canal). Projects were demanded from above, executed regardless of human cost.
- **Two-layer distribution:** Official equal rations (Layer 1) coexisted with informal privilege networks (Layer 2). Everyone knew. Nobody could say it officially.
- **Environmental destruction:** Aral Sea, Chernobyl, nuclear testing in Kazakhstan, industrial pollution — the Soviet system treated the environment as expendable input.
- **Deforestation cycles:** Rapid deforestation for industrialization followed by soil erosion was a real pattern across Soviet agricultural regions.
