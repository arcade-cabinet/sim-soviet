# Economy — The Planned Economy System

## Historical Foundation

The Soviet economy did NOT work like a market economy with prices and purchases. The game's economic system is modeled on how the real planned economy functioned, adapted for gameplay.

**Key sources**:
- [Soviet Monetary System - Encyclopedia.com](https://www.encyclopedia.com/history/encyclopedias-almanacs-transcripts-and-maps/monetary-system-soviet)
- [Wages and Prices in the Soviet Union - Marxists.org](https://www.marxists.org/history/etol/newspape/ni/vol03/no03/wollenberg.htm)
- [Rationing in the Soviet Union - Wikipedia](https://en.wikipedia.org/wiki/Rationing_in_the_Soviet_Union)
- [Russia's Economy of Favours: Blat - Ledeneva](https://books.google.com/books/about/Russia_s_Economy_of_Favours.html?id=ENMhO5aCkLAC)
- [Kolkhoz - Britannica](https://www.britannica.com/topic/kolkhoz)

---

## The Dual Economy

The Soviet system had two completely separate circuits of money:

### Enterprise Circuit (Your Collective)

Rubles were accounting fiction at the enterprise level. You couldn't "spend" enterprise rubles freely. Every transfer required a corresponding plan assignment from Gosplan. Your collective's "budget" was a ledger entry at Gosbank tracking what the plan allocated to you.

**In the game**: The predsedatel does NOT have a ruble balance for building or purchasing. Everything flows through the plan.

### Consumer Circuit (Your Workers)

Workers earned cash rubles, but money alone couldn't buy goods. Shortages meant even with rubles in hand, shelves were empty. Workers relied on three parallel systems:

1. **State store** — fixed prices, empty shelves, long queues
2. **Kolkhoz market** — personal plot surplus sold at real supply/demand prices
3. **Blat** — favors, connections, bribery

**In the game**: Worker morale is affected by whether consumer goods are available, NOT by how many rubles they earn.

---

## Primary Currencies

The game has 5 primary currencies. None of them are rubles.

### 1. Labor (Trudodni — Трудодни)

The fundamental unit of the Soviet collective farm economy. Trudodni ("labor days") measured work contribution — not in hours, but in quality-weighted units. A skilled worker doing complex tasks earned more trudodni per day than an unskilled worker doing simple tasks.

**In the game**:
- Every worker generates trudodni each tick based on their task and skill level
- Total collective trudodni determines total output
- Workers are paid from the **remainder** after the state takes its cut (see Remainder Principle below)
- Workers assigned to construction generate trudodni but produce no exportable output — this is the opportunity cost of building

**Historical detail**: In 1946, 30% of kolkhozes paid no cash at all for labor, and 73.2% paid 500 grams of grain or less per trudoden worked.

### 2. Material Allocations (Fondy — Фонды)

The state allocates physical materials — timber, steel, cement, bricks — through allocation quotas called fondy. A kolkhoz chairman received a **naryad** (allocation order) specifying what materials they could obtain and from which supplier.

**In the game**:
- The 5-year plan allocates fondy for construction materials
- Fondy arrive in deliveries — may be on time, late, short, or wrong materials
- If fondy are insufficient, use **blat** to obtain more (risky)
- Fondy are era-appropriate:
  - Revolution/Collectivization: timber, clay, thatch
  - Industrialization: steel, cement, glass
  - Wartime: scrap metal, salvage, improvised materials
  - Stagnation: technically everything is available, practically nothing arrives

**Delivery reliability** scales with difficulty and era:
- Worker (easy): 90% on time, full quantity
- Comrade (normal): 60% on time, 70-100% quantity
- Tovarish (hard): 30% on time, 40-80% quantity

### 3. Compulsory Deliveries (Obyazatelnye Postavki — Обязательные поставки)

The state takes its cut FIRST. Before your workers eat, before you stockpile, before anything — the state extracts compulsory deliveries of grain, food, and industrial output at fixed (low) prices.

**In the game**:
- Each tick, a percentage of output is automatically deducted as state deliveries
- The percentage is set by the current doctrine and leader:
  - Revolutionary: 40% of food output
  - Industrialization: 50% of food, 60% of industrial output
  - Wartime: 70% of everything
  - Thaw: 30% of food, 40% of industrial
  - Stagnation: 45% of food, 50% of industrial (plus "administrative losses" — corruption)
- What remains AFTER compulsory deliveries is what feeds your workers and fills your stockpiles

### 4. The Remainder (Ostatok — Остаток)

**The Remainder Principle**: Workers are paid from whatever is left after:
1. Compulsory state deliveries (largest cut)
2. Seed/material fund for next season (you must reserve some grain for planting)
3. Insurance fund (small reserve for emergencies)
4. Social fund (maintenance of buildings, communal services)

Only THEN do workers receive their share, proportional to their trudodni.

**In the game**:
- After compulsory deliveries, the player allocates the remainder across:
  - **Seed fund**: reserve for next season's planting (skip this → next season's harvest is halved)
  - **Emergency reserve**: buffer against bad harvests, disasters (skip this → no safety net)
  - **Worker rations**: what workers actually eat/drink
- If the remainder is too small, workers starve → morale crash → disloyalty → black marks
- If you shortchange the seed fund to feed workers now, next season collapses
- This is the core economic tension: the state takes 50%, and you manage the other 50% across competing needs

### 5. Blat (Блат) — Connections

The informal economy of favors, connections, and influence. Historically, every kolkhoz chairman survived through blat — trading favors with other chairmen, bribing district officials, bartering surplus produce for materials.

**In the game**:
- **Blat is a numeric resource** (0-100), representing your network of connections
- Blat accumulates slowly through: successful quota fulfillment, politruk relationships, event choices
- Blat is spent on:
  - Expediting material deliveries (fondy arrive faster/fuller)
  - Getting favorable quota assignments (lower targets)
  - Protecting workers from KGB attention (deflecting investigations)
  - Obtaining consumer goods for worker morale
  - Trading surplus between collectives (informal barter)
- Blat is RISKY — spending it attracts attention. Each use has a small chance of being noticed by the KGB (+1 black mark)
- High blat + low profile = the ideal state. High blat + high visibility = corruption investigation

---

## Secondary Currencies

### Rubles (₽)

Rubles exist but are secondary. They matter in these specific contexts:

1. **Worker consumer economy**: Workers with access to consumer goods (state stores, kolkhoz market) have higher morale. Rubles measure whether goods are affordable.
2. **Black market**: The black market minigame trades in rubles. High risk, high reward.
3. **Bribes**: Some blat transactions cost rubles (bribing an inspector, paying off a politruk).
4. **Kolkhoz market**: If workers have personal plots, they sell surplus at market prices. This tiny income stream affects morale.

**Rubles are NOT used for**: Construction, material procurement, hiring workers, or any enterprise-level transaction.

### Ration Cards (Kartochki — Карточки)

Era-specific mechanic. Ration cards were used historically in 1929-1935 and 1941-1947 (and again 1983+).

**When active**:
- Food and consumer goods are distributed via tiered ration system
- The predsedatel assigns ration tiers to workers:
  - **Category 1 (manual workers)**: highest rations — 800g bread/day, meat weekly
  - **Category 2 (white-collar/technical)**: medium — 600g bread/day
  - **Category 3 (dependents)**: low — 400g bread/day
  - **Category 4 (children)**: minimal — 300g bread/day
- Ration allocation is a PLAYER CHOICE with consequences:
  - Giving productive workers higher rations = efficient but "bourgeois" (attracts politruk attention)
  - Equal rations for all = ideologically correct but wastes food on low-output workers
  - Cutting rations to meet delivery quotas = workers starve, morale crashes

**When NOT active** (Thaw, early Stagnation):
- Food is distributed more freely, consumer goods appear in stores
- Workers can supplement through personal plots and kolkhoz market
- Morale is generally higher, but so are expectations

---

## Stakhanovites (Стахановцы)

Named after Alexei Stakhanov, a coal miner who allegedly mined 102 tonnes of coal in a single shift in 1935 — 14 times his quota. Workers who dramatically exceeded their quotas were celebrated as Stakhanovites.

### The Double-Edged Sword

- **The state loved them**: propaganda heroes, medals, better rations, apartments
- **Their coworkers hated them**: because when one person exceeded quota, Moscow raised the quota for EVERYONE
- **Many were frauds**: records achieved by having other workers secretly help, or managers falsifying numbers
- **Some were murdered** by resentful coworkers

### In the Game

**Trigger**: Random event — a worker with high skill rolls a Stakhanovite event. Or: the player deliberately pushes a worker beyond normal output (risky).

**Immediate effects**:
- Production spike from that worker (+200-300% output for several ticks)
- Pravda headline: "HERO OF SOCIALIST LABOR SETS NEW RECORD"
- +1 commendation on your file
- Worker receives "Hero of Labor" status (better rations, higher morale)

**Delayed consequences**:
- Moscow raises your quota by 15-25% for the next plan period
- Other workers' morale drops (-10 to -20) — resentment
- Increased politruk attention (they investigate whether the record was real)
- Small chance (5-10%) the Stakhanovite is "exposed" as a fraud → black mark on YOUR file for falsifying reports
- Small chance (2-5%) the Stakhanovite suffers a workplace "accident" (coworker sabotage)

**Player choice**: When a Stakhanovite event triggers, you choose:
1. **Celebrate it** — full propaganda value, quota increase, commendation
2. **Quietly suppress it** — no quota increase, no commendation, but the politruk might notice you buried good news (+1 mark risk)
3. **Fabricate more** — multiple workers "become" Stakhanovites. Maximum propaganda, maximum quota increase, maximum risk of exposure

---

## The 5-Year Plan (Pyatiletka — Пятилетка)

The 5-year plan is the game's primary pressure mechanism. It arrives from Moscow and contains BOTH production quotas AND construction mandates.

### Plan Structure

```
┌─────────────────────────────────────────────┐
│         FIVE-YEAR PLAN: 1932–1937           │
│              SECOND PYATILETKA              │
├─────────────────────────────────────────────┤
│                                             │
│  PRODUCTION QUOTAS:                         │
│    Grain:    5,000 tonnes                   │
│    Industrial output: 2,000 units           │
│    Vodka:   500 litres (if distillery)      │
│                                             │
│  CONSTRUCTION MANDATES:                     │
│    Build: 2 Factories                       │
│    Build: 1 Power Station                   │
│    Build: 50 housing units                  │
│                                             │
│  MATERIAL ALLOCATIONS (fondy):              │
│    Timber: 200 tonnes                       │
│    Steel:  150 tonnes                       │
│    Cement: 100 tonnes                       │
│                                             │
│  CONSCRIPTION OBLIGATION:                   │
│    Provide: 15% of workforce for military   │
│                                             │
│  COMPULSORY DELIVERY RATE:                  │
│    Food: 50% of output                      │
│    Industrial: 60% of output                │
│                                             │
│  LABOR: your problem.                       │
│                                             │
└─────────────────────────────────────────────┘
```

### Plan Flow

1. **Plan arrives** — modal screen shows the full plan at era start or every 5 in-game years
2. **Player reviews** — sees quotas, mandates, allocations, obligations
3. **Player chooses WHERE** to place mandated buildings (only the location is your decision)
4. **Player assigns workers** to construction, farming, industry, etc.
5. **Progress tracked** — quota HUD shows real-time progress vs targets
6. **Annual review** — each year within the plan, a report card shows progress
7. **Plan completion** — met all targets? New plan arrives. Failed? Consequences (see below)

### Quota Failure Consequences

Quota failure adds black marks. It does NOT directly end the game — the mark system is the ONLY game-over path.

| Failure | Consequence |
|---------|-------------|
| **Missed by <10%** | Stern warning, +0 marks. Politruk lectures you. |
| **Missed by 10-30%** | +1 black mark. Increased politruk presence next plan. |
| **Missed by 30-60%** | +2 black marks. KGB investigation. Workers may be taken. |
| **Missed by >60%** | +3 black marks. Immediate KGB presence. Leadership questions your competence. |
| **Construction mandate not met** | +1 mark per unbuilt building. Moscow is displeased. |
| **Conscription not met** | +2 marks. Military arrives and takes workers by force (your best ones). |

### Exceeding Quotas

Exceeding quotas is a TRAP:
- +1 commendation on your file (good)
- Next plan's quota is raised by 20-40% (bad)
- If you exceed by >50%, Stakhanovite attention (very bad for long-term quotas)
- The ideal is to meet quotas exactly or barely exceed them

---

## Construction System

Buildings are NOT purchased with rubles. They are mandated by the plan and built with labor and materials.

### Construction Flow

1. **Plan mandates building** → building type is unlocked
2. **Player taps empty tile** → placement preview (if mandated building available)
3. **Player confirms location** → construction site appears (foundation outline)
4. **Player assigns workers** to construction site
5. **Workers + materials + time** → building gradually constructed
6. **Completion** → building becomes operational, needs workers to staff it

### Construction Costs

| Component | Source | What Happens If Short |
|-----------|--------|----------------------|
| **Workers** | Player assigns from labor pool | Construction paused. Other work continues. |
| **Materials (fondy)** | Allocated by the plan, delivered by state | Construction paused. Can use blat to expedite. |
| **Time** | Workers × ticks at the site | Longer with fewer workers. Weather affects speed. |

**No rubles involved.** The state provides materials. You provide labor. The cost is opportunity: workers building aren't farming.

### Construction Modifiers

| Factor | Effect |
|--------|--------|
| **Season** | Winter: 1.5× time. Rasputitsa (mud): 1.8× time. Summer: 0.8× time. |
| **Worker skill** | Skilled construction workers: -20% time. Unskilled: +30% time. |
| **Material quality** | Full fondy: normal time. Partial fondy: 1.5× time (improvising). |
| **Doctrine** | Industrialization: -20% time (priority). Stagnation: +50% time (nothing works). |

---

## Production Formulas

How output is generated from workers, buildings, and conditions. The formulas below are designed for a game running at **3 ticks per in-game day** (1080 ticks/year, per ChronologySystem).

**Historical basis**: Soviet farm jobs were divided into 7-9 difficulty categories. Category 1 (simple tasks) earned 0.5 trudodni per day. Category 9 (heavy machinery) earned 4.5 trudodni per day. Average worker logged 295-342 trudodni per year. Factory workers had piece-rate norms — base wage for 100% of quota, progressive bonuses above.

Sources: [Trudoden - Wikipedia](https://en.wikipedia.org/wiki/Trudoden), [Workday - Encyclopedia of Ukraine](https://www.encyclopediaofukraine.com/display.asp?linkpath=pages%5CW%5CO%5CWorkday.htm), [Stakhanovite movement - Wikipedia](https://en.wikipedia.org/wiki/Stakhanovite_movement), [Soviet Wages System - Marxists.org](https://www.marxists.org/archive/petroff/1938/soviet-wages.htm)

### Core Formula: Output Per Tick

```
output = baseRate × workerCount × avgSkillMult × seasonMod × doctrineMod × buildingCondition
```

| Variable | Description | Range |
|----------|-------------|-------|
| `baseRate` | Building's per-worker output rate (from buildingDefs) | 0.5-5.0 |
| `workerCount` | Workers assigned to this building | 0 to staffCap |
| `avgSkillMult` | Average skill of assigned workers, mapped to [0.5, 1.5] | `0.5 + (avgSkill / 100)` |
| `seasonMod` | Seasonal modifier (farms: 0.0 in winter, 1.5 in summer; factories: 1.0 always) | 0.0-1.5 |
| `doctrineMod` | Doctrine production modifier (Industrialization: 1.2× industry; Wartime: 0.8× civilian) | 0.5-1.5 |
| `buildingCondition` | Building health as modifier (100% health → 1.0, 50% → 0.5, <20% → building offline) | 0.0-1.0 |

### Diminishing Returns on Overstaffing

Buildings have a `staffCap` (optimal number of workers). You CAN assign more workers, but returns diminish sharply:

```
effectiveWorkers = min(workerCount, staffCap) + max(0, workerCount - staffCap) × 0.25
```

Workers beyond staffCap contribute only 25% effectiveness — they get in each other's way. This reflects the real Soviet problem of throwing bodies at production targets instead of improving efficiency.

### Task Categories (Trudoden Multipliers)

Mapping historical job categories to game building roles:

| Category | Trudodni/Tick | Building Roles | Examples |
|----------|--------------|---------------|----------|
| 1 (Simple labor) | 0.5 | maintenance, cleanup | Street sweeping, guard duty |
| 2 (Basic agriculture) | 0.7 | agriculture (manual) | Hand sowing, weeding, milking |
| 3 (Skilled agriculture) | 1.0 | agriculture (equipment) | Tractor operation, threshing |
| 4 (Light industry) | 1.0 | industry (light) | Textile, food processing |
| 5 (Construction) | 1.2 | construction | Carpentry, masonry, foundation |
| 6 (Heavy industry) | 1.5 | industry (heavy) | Steel work, machinery, power plant |
| 7 (Specialist) | 2.0 | medical, education, admin | Doctor, teacher, engineer |
| 8 (Heavy machinery) | 3.0 | power, mining | TEC operation, heavy equipment |
| 9 (Stakhanovite) | 4.5 | any (temporary) | Active Stakhanovite event bonus |

Workers accumulate trudodni from their task category. At year's end, the remainder is divided proportionally by accumulated trudodni — this determines each worker's "payment" (morale boost from feeling adequately compensated).

### Agricultural Production (Seasonal)

Farms follow a strict seasonal cycle. Output is NOT constant:

```
Season:         Winter    Rasputitsa   Spring     Summer    Early Frost
Months:          11-3        4          5-6        7-9        10
Farm modifier:   0.0        0.3        0.8        1.5        0.5
```

- **Winter (months 11-3)**: Zero farm output. Living off stored food.
- **Rasputitsa (month 4)**: Mud season. Plowing begins, minimal output.
- **Spring (months 5-6)**: Planting season. Some early crops.
- **Summer (months 7-9)**: Peak harvest. All food for the year is effectively produced here.
- **Early frost (month 10)**: Late harvest, root vegetables, preservation work.

This means ~80% of annual food production happens in 5 months. The player MUST stockpile enough food during summer to survive 6 months of low/zero production.

### Industrial Production (Continuous)

Factories produce year-round with minor seasonal effects:

```
Season:         Winter    Summer    Other
Factory modifier: 0.9      1.0       1.0
Winter penalty: heating load reduces available power
```

- Factories need power to operate. Winter heating demand competes with factory power.
- If power < demand, factories operate at reduced capacity or shut down.

### Power Production

Power plants (TEC) have fixed output based on fuel and staffing:

```
powerOutput = basePower × (fuelAvailable / fuelRequired) × staffingRatio × buildingCondition
staffingRatio = min(1.0, workerCount / staffCap)
```

- If fuel runs low, power output drops proportionally
- Power demand = sum of all powered buildings' `powerCost` + winter heating load
- Power deficit → buildings shut down in priority order (housing heat last)

### Vodka Production

Vodka requires grain input (diverts food supply):

```
vodkaOutput = baseRate × workerCount × skillMult × (grainInput / grainRequired)
grainInput: 2 units of grain → 1 unit of vodka
```

- **The vodka tension**: Every unit of vodka costs 2 units of food. Feed your workers, or keep them drunk?
- Vodka is a compulsory delivery item AND a morale tool AND a trade commodity
- In Stagnation era, vodka becomes the de facto currency

### The Quota Tracking Formula

Total output per resource type is tracked against 5-year plan quotas:

```
annualOutput[resource] = sum of all buildings producing that resource, per tick, × ticks per year
quotaProgress = totalOutput / quotaTarget × 100%
```

The player sees this as a progress bar in the Quota HUD. Annual reviews compare progress vs. the linear expectation (year 2 of a 5-year plan → should be at 40%).

---

## Resource Flow Diagram

```
                    THE STATE
                       │
            ┌──────────┴──────────┐
            │                     │
     Compulsory              Material
     Deliveries              Allocations
     (state takes)           (fondy arrive)
            │                     │
            ▼                     ▼
┌───────────────────────────────────────┐
│          YOUR COLLECTIVE              │
│                                       │
│  Workers ──→ Trudodni ──→ Output      │
│     │                       │         │
│     │              ┌────────┴────┐    │
│     │              │             │    │
│     │         State Cut    Remainder  │
│     │         (40-70%)     (30-60%)   │
│     │              │             │    │
│     │              ▼        ┌────┴──┐ │
│     │          Compulsory   │       │ │
│     │          Deliveries   │  Seed │ │
│     │                       │  Fund │ │
│     │                       │       │ │
│     │                       │ Emerg │ │
│     │                       │ Reserve│ │
│     │                       │       │ │
│     │                       │Worker │ │
│     │                       │Rations│ │
│     │                       └───────┘ │
│     │                                 │
│     └──→ Construction (opportunity    │
│          cost: no output while        │
│          building)                    │
│                                       │
│  Blat ←──→ Other Collectives          │
│  (informal barter, favors, risk)      │
│                                       │
└───────────────────────────────────────┘
            │
            ▼
      Black Market
      (rubles, KGB risk)
```

---

## Construction Materials by Era

The materials available for construction evolve through the eras, reflecting the actual history of Soviet building technology. Early eras are timber and manual labor. Mid-game introduces industrial materials. Late game is prefabricated concrete panels.

**Sources**: [Housing construction in the Soviet Union](https://en.wikipedia.org/wiki/Housing_construction_in_the_Soviet_Union), [Khrushchevka](https://en.wikipedia.org/wiki/Khrushchevka), [Panel buildings in Russia](https://en.wikipedia.org/wiki/Panel_buildings_in_Russia)

### Material Types

| Material | First Available | Source | Used For |
|----------|----------------|--------|----------|
| **Timber** (лес) | Era 1 | Forest tiles (clearable) | Early buildings, pechka fuel, construction scaffolding |
| **Clay/brick** (кирпич) | Era 1 | Flat land (unlimited but slow) | Walls, pechka stoves, foundations |
| **Stone** (камень) | Era 1 | Mountain tiles (limited) | Foundations, roads, heavy structures |
| **Steel** (сталь) | Era 3 | Fondy allocation (state-supplied) | Factories, power plants, rail, reinforcement |
| **Cement** (цемент) | Era 3 | Fondy allocation | Concrete buildings, foundations, roads |
| **Prefab panels** (ЖБИ) | Era 6 | Fondy allocation (requires factory) | Khrushchyovka housing, rapid construction |
| **Glass** (стекло) | Era 5 | Fondy allocation | Windows, greenhouses, administrative buildings |
| **Salvage** (утиль) | Era 5 | Demolished/damaged buildings | Reconstruction-era recycling |

### Era Material Availability

| Era | Local Materials | State-Supplied (Fondy) | Special |
|-----|----------------|----------------------|---------|
| Revolution | Timber, clay, stone | None — no plan yet | Improvised materials, log construction |
| Collectivization | Timber, clay, stone | Small fondy (unreliable) | MTS provides some equipment |
| Industrialization | Timber, clay, stone | Steel, cement (regular) | First concrete buildings possible |
| Wartime | Timber (scarce) | Steel repurposed for military | Salvage from bombardment damage |
| Reconstruction | Timber, salvage | Steel, cement, glass (limited) | Rubble harvesting from ruins |
| Thaw | Timber | Steel, cement, prefab panels, glass | Khrushchyovka mass housing possible |
| Stagnation | Timber (forests depleted) | Prefab panels (delayed), cement (short) | Materials exist but never arrive on time |
| Eternal | Theoretical timber | Paper-based materials | Materials are filed, not delivered |

### Construction Method Progression

| Era | Method | Speed | Quality |
|-----|--------|-------|---------|
| Revolution-Collectivization | **Manual labor** (hand tools, shovels, axes) | Very slow (×2.0 time) | Low durability, high maintenance |
| Industrialization-Wartime | **Mechanized** (cranes, mixers, MTS equipment) | Normal (×1.0 time) | Standard durability |
| Reconstruction-Thaw | **Industrial** (prefab panels, standardized components) | Fast (×0.6 time for panel buildings) | Standardized, moderate durability |
| Stagnation-Eternal | **Decaying industrial** (equipment breaks, panels crack) | Slow again (×1.5 time) | Low quality — "built in '78, falling apart by '85" |

### Material Tension Design

Each era has a distinct material tension:

- **Revolution**: Timber is everything. Cut trees for buildings AND fuel? Forests don't grow back fast.
- **Collectivization**: State begins demanding output, but provides nothing. Build with what you have.
- **Industrialization**: Steel and cement arrive — but never enough. Fondy allocations cover 60-80% of what you need. Improvise the rest (blat) or build slowly.
- **Wartime**: All steel goes to military production. Build with timber and salvage.
- **Reconstruction**: Rubble everywhere. Salvage is free but low-quality. Real materials start flowing again.
- **Thaw**: Prefab panels arrive! Housing construction is suddenly fast and cheap. Golden age of building. But panels crack in 20 years.
- **Stagnation**: Fondy deliveries are delayed 50% of the time. Materials "allocated" on paper never arrive. The factory that makes panels hasn't had maintenance in years.

---

## MTS — Machine-Tractor Stations (Era-Specific)

Until 1958, heavy equipment was STATE-OWNED and loaned to kolkhozes through Machine-Tractor Stations (MTS). The kolkhoz paid for equipment use in kind — with grain, not rubles.

**In the game** (Revolution through Reconstruction eras):
- You don't own tractors or heavy equipment
- MTS sends equipment when your plan requires it
- Payment: additional compulsory grain delivery (on top of normal deliveries)
- Late MTS arrival = delayed planting = reduced harvest
- After 1958 (Thaw era): kolkhozes buy their own equipment. New tension: maintenance costs.

---

## Heating — Era-Progressive System

Heating progresses through three historical phases. Each creates a different gameplay tension.

**Sources**: [The Russian Stove - Russia Beyond](https://www.rbth.com/lifestyle/332747-russian-stove-pech), [District Heating - Wikipedia](https://en.wikipedia.org/wiki/District_heating), [Pechka - Russiapedia](https://russiapedia.rt.com/of-russian-origin/pechka/index.html)

### Phase 1: The Pechka (Revolution → Collectivization)

Every building needs a **pechka** (русская печь) — a massive brick stove. The pechka burns **timber** from forests.

- Each residential/work building requires timber per tick in winter months (Nov-Mar)
- **Timber consumption**: 1 unit/tick per small building, 3/tick per large building
- **No timber = unheated building**: Workers can't work there. Health drops -5/tick. Prolonged: death.
- **Tension**: Timber is also the primary construction material in early eras. Burn it for warmth OR build with it. Not enough for both.
- **Forest management**: Forests are a depletable resource. Cut too many trees → no fuel AND no building material. But forests regrow slowly (1 tile every 50 ticks if adjacent to existing forest).

**Gameplay feel**: Desperate winter preparation. Harvest timber in summer. Stockpile for 5 months of cold. If you over-built in summer, you freeze in winter.

### Phase 2: District Heating (Industrialization → Reconstruction)

Power plants (TEC/ТЭЦ) provide both electricity AND heat via piped hot water.

- Power plant output is split: **electrical power** + **heating capacity**
- Winter increases total power demand by 40-60% (heating load)
- Buildings within heating range of a power plant are heated automatically
- Buildings outside range still need pechka (timber)
- **Tension**: Your single coal plant may produce enough power for factories OR enough heat for housing, but not both. Build a second plant (need fondy + workers) or choose who freezes.

**Gameplay feel**: Industrial-era resource management. Power becomes the bottleneck in winter. Strategic placement of power plants matters.

### Phase 3: Crumbling Infrastructure (Stagnation → Eternal)

District heating infrastructure decays. Pipes leak. Boilers fail.

- Heating systems lose 2-5% efficiency per year (Stagnation doctrine: 2× decay)
- Random failures: "Heating pipe burst in sector 3" → building unheated for N ticks
- Repair requires workers + materials (both scarce in Stagnation)
- Some buildings revert to pechka (timber) as backup
- **Tension**: The infrastructure that kept everyone warm is crumbling. No fondy for repairs. Workers assigned to repair aren't producing. And it's getting colder.

**Gameplay feel**: Managing decay. Triage. Which buildings get repaired first? The factory or the apartment block?

### Heating Summary by Era

| Era | Primary Heating | Fuel Source | Winter Power Demand |
|-----|----------------|-------------|-------------------|
| Revolution | Pechka | Timber (forests) | N/A (no power grid) |
| Collectivization | Pechka | Timber | N/A |
| Industrialization | District heating (TEC) | Coal (power plant) | +50% |
| Wartime | Mixed (TEC + pechka) | Coal + timber | +60% (military priority) |
| Reconstruction | Rebuilding TEC | Coal | +40% |
| Thaw | District heating | Coal/gas | +40% |
| Stagnation | Decaying TEC | Coal (late deliveries) | +50% (+random failures) |
| Eternal | Probabilistic | Who knows | Random |

---

## Storage & Spoilage

Resources don't stockpile infinitely. Storage buildings have capacity limits. Food beyond capacity spoils.

**Historical basis**: "Harvests were lost to poor storage and transportation" was a chronic Soviet problem. Grain spoiled at elevators due to moisture. Infrastructure was so bad that Georgian farmers could profitably fly 3,000 miles to Moscow carrying suitcases of fruit. ([Source](https://factsanddetails.com/russia/Economics_Business_Agriculture/sub9_7e/entry-5179.html))

### Storage Buildings

| Building | Resource | Capacity | Era Available |
|----------|----------|----------|--------------|
| **Root cellar** | Food | 200 | Revolution |
| **Granary** | Grain/food | 500 | Collectivization |
| **Warehouse** | Materials, general | 300 | Industrialization |
| **Grain elevator** | Grain/food | 2000 | Industrialization |
| **Cold storage** | Perishables | 400 (reduced spoilage) | Thaw |
| **Fuel depot** | Timber, coal | 500 | All eras |

### Spoilage Rules

- **Base spoilage**: Food beyond storage capacity decays at 5% per tick
- **Stored food**: Decays at 0.5% per tick (granary) or 0.1% per tick (grain elevator)
- **Seasonal modifier**: Summer spoilage ×2.0, winter spoilage ×0.3 (natural refrigeration)
- **Timber**: Does not spoil but can be consumed by fire events
- **Steel/cement**: Does not spoil
- **Vodka**: Never spoils (historically accurate — vodka was practically currency)

### Storage Tension

- Early game: tiny root cellar, big harvests in summer → food rots if you don't build storage
- Mid game: grain elevators hold a lot but need power to operate (ventilation, moisture control)
- Late game: storage infrastructure decays. "The grain elevator hasn't been maintained in 3 years."

### Winter Preparation Cycle

```
Summer (Month 5-8):
  ├── Harvest food → store in granary/elevator
  ├── Cut timber → store in fuel depot
  ├── Build/repair storage buildings
  └── Stockpile for 5 months of winter

Winter (Month 11-3):
  ├── No food production (farm modifier: 0.0)
  ├── Consume stored food (-X per tick per worker)
  ├── Consume stored fuel for heating (-X per tick per building)
  ├── Construction: 1.5x time, limited to non-frozen terrain
  └── If supplies run out → starvation, freezing, morale collapse
```

This creates a natural annual gameplay rhythm: **frantic summer preparation → tense winter survival**.

---

## Food Distribution — The Communal Pot

Soviet workers ate communally. **Stolovayas** (столовая — canteens) at factories and kolkhozes served standardized meals from central food stocks. The state took "full responsibility for providing daytime meals." On a kolkhoz, the collective grew food, the state took its cut, and what remained was shared.

**Source**: [Soviet Canteens - Russia Beyond](https://www.rbth.com/russian-kitchen/329657-public-catering-soviet-canteens)

### Mechanic

- Each tick: `food_consumed = workers_count × 1.0`
- Food deducted from central storage automatically (communal eating)
- No distribution routes or delivery mechanics needed
- Building a stolovaya (canteen) reduces waste (see efficiency table)

### Distribution Efficiency by Era

| Era | Method | Efficiency | Notes |
|-----|--------|------------|-------|
| Revolution | Communal pot | 100% consumed | Simple sharing |
| Collectivization | Kolkhoz canteen | 95% | Slightly organized |
| Industrialization | Stolovaya building | 90-95% | Building reduces waste |
| Wartime | Ration cards | 85% | Tiered, some waste |
| Stagnation | The Queue | 75% | 25% lost to corruption/inefficiency |
| Eternal | Probabilistic | 50-100% | Random each tick |

### Starvation

- **No food**: -15 morale/tick, -5 health/tick
- **10 ticks of zero food**: Workers begin dying (1 per 5 ticks)
- **Partial food** (less than needed): Distributed proportionally. All workers get less. Ration cards (when active) allow tiered distribution — some eat more, others eat less.

---

## Economy by Era

| Era | Primary Output | State Cut | Key Tension |
|-----|---------------|-----------|-------------|
| Revolution | Grain | 40% | Feeding your own people vs. feeding the revolution |
| Collectivization | Grain, livestock | 55% | Forced collectivization quotas destroy farming capacity |
| Industrialization | Grain + industrial | 50/60% | Workers pulled from farms to factories, famine risk |
| Wartime | Everything | 70% | Total war economy, nothing left for workers |
| Reconstruction | Rebuilding | 35% | Low quotas but no infrastructure, starting from rubble |
| Thaw | Diversified | 30% | Best economic period, but expectations rise |
| Stagnation | Vodka + paperwork | 45% (+corruption) | Corruption eats the remainder, queues for everything |
| Eternal | Probabilistic | 40% | Food production is random, reported as stable |
