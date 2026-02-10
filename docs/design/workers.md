---
title: Workers — The Central Resource
status: Complete
implementation: src/game/workers/WorkerSystem.ts
tests: src/__tests__/WorkerSystem.test.ts, src/__tests__/WorkerPopulation.test.ts
last_verified: 2026-02-10
coverage: "Full — 6 AI classes, morale/loyalty/skill, vodka dependency, assignment, sprites, tap interaction"
---

# Workers — The Central Resource

Workers are the game. Not buildings, not resources — *people*.

---

## Worker Roles & Colors

| Role | Color | Function | Controllable? |
|------|-------|----------|---------------|
| **Peasant / Proletarian** | Brown | Farming, construction, factory work | YES — player assigns |
| **Politruk / Zampolit** | Red | Ideology sessions, loyalty checks | NO — assigned from above |
| **KGB / FSB Agent** | Black | Surveillance, disappearances | NO — arrives on its own |
| **Military** | Green | Garrison, conscription, riot control | NO — drafted from your workers |

Brown workers are YOUR resource. The other three are the apparatus — they consume your food and housing but serve the state, not you.

---

## Worker Lifecycle

1. **Spawn**: Workers arrive based on population growth, housing capacity, and era events
2. **Assignment**: Player taps worker → taps building/zone. Workers walk to assignment (visible on map)
3. **Production**: Workers at assigned tasks generate trudodni and output each tick
4. **Threats**: Politruks flag disloyal workers. KGB takes flagged workers. Military drafts arbitrary percentages.
5. **Death/Removal**: Starvation, old age, purge, conscription, gulag, workplace "accident"

### Population Dynamics: Drain-and-Replace

Historically, Soviet collective farms were **population sinks**. Workers were constantly being drained away by the state through conscription, organized recruitment (orgnabor), purges, and youth flight. From 1932 to 1974, kolkhozniks didn't even have internal passports — they were effectively serfs bound to the land. The player's job isn't to grow the population — it's to **stop the bleeding**.

#### The Six Drains (Population Loss)

Each tick, the collective loses workers through overlapping drains. Some are constant background pressure, others are event-driven spikes.

| Drain | Type | Rate | Player Mitigation |
|-------|------|------|-------------------|
| **Natural attrition** | Constant | ~1 worker per 60 ticks (old age, illness, accidents) | Hospital buildings reduce rate. Good food/housing slows aging. |
| **Orgnabor** (organized recruitment) | Event | 2-8 workers per event. State enterprise "borrows" workers for industrial projects. | Negotiate with raikom to reduce quota. Hide skilled workers (risk: black mark). Offer low-skill workers first. |
| **Military conscription** | Event | 10-40% of male workers during wartime, 5-10% peacetime. | Claim essential workers are "irreplaceable specialists" (costs blat). Over-comply to bank goodwill. |
| **Purges & KGB** | Event | 1-5 workers per investigation. Targeted at flagged/disloyal workers. | Keep loyalty high. Don't let politruks find problems. Sacrifice one to save many (moral cost). |
| **Youth flight** | Constant | ~1 young worker per 120 ticks leaves for vocational school / city life. | School building provides local education (reduces flight). High morale reduces desire to leave. |
| **Illegal migration** | Morale-driven | Workers with morale < 20 have a chance to flee each tick. Rate: `fleeChance = (20 - morale) * 0.5%` per tick. | Keep morale above 20. Vodka helps. Personal garden plots help. KGB presence deters (but lowers morale). |

#### The Four Inflows (Population Gain)

New workers arrive through limited channels. None are fully under player control.

| Inflow | Type | Rate | Notes |
|--------|------|------|-------|
| **Natural births** | Constant | ~1 worker per 90 ticks, IF `housingUsed < housingCap` AND `food > 2 × population`. | New workers start at age 0 → become productive at age 16 (≈192 ticks). Abstract: they just "appear" as working-age after the delay. Fertility modifier by era (Revolution: 1.5×, Stagnation: 0.6×). |
| **Moscow assignments** | Event | 3-12 workers per decree. State sends workers where it wants them. | You get what you get. May include informants (hidden KGB), troublemakers (low loyalty), or genuinely skilled workers. Can't refuse. |
| **Forced resettlement** | Event | 5-30 workers per event. Kulak families, ethnic deportees, political undesirables dumped on your collective. | Arrive hostile (morale 10-30, loyalty 5-20), often with families (non-productive children). Must be housed and fed. Integration takes time. Risk of unrest. |
| **Kolkhoz amalgamation** | Era event | Entire small kolkhoz merged into yours (20-60 workers + their buildings). | Happens 1-2 times in Eras 4-6. Sudden population spike with infrastructure. Their buildings may be decrepit. Workers come with existing loyalties and grudges. |

#### Net Population Pressure by Era

| Era | Net Pressure | Why |
|-----|-------------|-----|
| Revolution (1917-22) | **Volatile** | Peasants join freely, but bandit raids / Civil War chaos kills many |
| Collectivization (1922-32) | **Net loss** | Kulak deportations, famine deaths, orgnabor begins |
| Industrialization (1932-41) | **Heavy drain** | Orgnabor at peak, youth flight, Great Terror purges |
| Great Patriotic War (1941-45) | **Catastrophic loss** | 30-40% conscripted, bombardment casualties, famine |
| Reconstruction (1945-56) | **Recovery** | Veterans return, Moscow assignments increase, reduced drains |
| Thaw & Freeze (1956-82) | **Fragile balance** | Passport reform (1974) means workers CAN leave legally now |
| Stagnation (1982-2000) | **Slow decline** | Youth won't stay, aging population, vodka-related deaths |
| The Eternal (2000-???) | **Bureaucratic** | Workers assigned by algorithm. Population is a number on a form. |

#### Difficulty Modifiers

| Difficulty | Birth rate | Drain intensity | Flight threshold |
|------------|-----------|----------------|-----------------|
| Worker (easy) | 1.5× | 0.6× | Morale < 10 |
| Comrade (normal) | 1.0× | 1.0× | Morale < 20 |
| Tovarish (hard) | 0.7× | 1.4× | Morale < 30 |

#### Player Retention Tools

The player's primary population strategy is **retention** — keeping the workers they have:

- **Morale management**: Well-fed, housed, vodka-supplied workers don't flee
- **Blat spending**: Use connections to reduce orgnabor/conscription quotas
- **Strategic sacrifice**: Offer low-skill workers to drains, protect your best
- **Hide workers**: Underreport population to reduce conscription quotas (risk: black mark if caught)
- **Essential worker claims**: Designate specialists as "irreplaceable" (costs blat per worker per era)
- **Housing quality**: Better housing = workers less likely to want to leave
- **Personal plots**: When doctrine allows, garden plots dramatically reduce flight

---

## Worker Stats

Each worker has stats that affect gameplay. Some are visible (via long-press), some are hidden.

| Stat | Range | Visible? | Effect |
|------|-------|----------|--------|
| **Morale** | 0-100 | Yes | Production speed, defection chance, riot threshold |
| **Loyalty** | 0-100 | Hidden | Politruk flagging threshold, KGB targeting |
| **Skill** | 0-100 | Yes | Trudodni per tick, construction speed, task quality |
| **Health** | 0-100 | Yes | Work capacity, starvation resistance, aging |
| **Vodka Dependency** | 0-100 | Hidden | After enough vodka rations, workers need it. Cut vodka → morale crash |

### Morale Drivers

| Factor | Morale Effect |
|--------|---------------|
| Well-fed | +2/tick (up to 80) |
| Hungry | -5/tick |
| Starving | -15/tick |
| Vodka ration available | +3/tick |
| Vodka ration cut (dependent workers) | -10/tick |
| Housing | +1/tick if housed, -5/tick if homeless |
| Overwork (>16 hours assignment) | -3/tick |
| Coworker disappeared (KGB) | -8 (one-time, decays) |
| Stakhanovite nearby | -2/tick (resentment) |
| Personal plot allowed | +5/tick |

### Loyalty Drivers

| Factor | Loyalty Effect |
|--------|----------------|
| Ideology session attended | +5-15 (depending on answers) |
| Ideology session skipped | -10/tick |
| Well-fed and housed | +1/tick |
| Starving | -5/tick |
| Friend disappeared (KGB) | -15 (one-time) |
| Informant in building | +3 but -5 to all others |
| Doctrine: Thaw | +2/tick (relaxation) |
| Doctrine: Freeze | -3/tick (paranoia) |

### Skill Progression

- Workers gain skill slowly by performing tasks (+0.1-0.5 per tick at task)
- Skill is task-specific: a skilled farmer moved to a factory starts at low industrial skill
- Skill cap increases with era (Revolution: max 50, Industrialization: max 80, Thaw: max 100)
- Losing high-skill workers (KGB, conscription) is devastating — replacements start at skill 10

---

## Worker Assignment — Mobile Controls

### Tap-to-Assign Flow

1. **Tap a worker** or **drag-select a group** → selection highlight appears
2. **Available assignment zones glow** — buildings needing workers, construction sites, farm plots
3. **Tap a glowing zone** → workers path-find and walk there
4. **Long-press a zone** → shows worker count, production rate, trudodni contribution

### Quick-Assign Shortcuts

- **Double-tap a building** → auto-assign nearest idle workers to fill it
- **Swipe worker toward building** → quick drag-assign
- **Tap "Auto-assign" button** → AI distributes workers by priority (quota first, then food, then power)

### Scaling at Population Growth

At 12 workers (Era 1), individual tap-to-assign is intimate and meaningful. At 200+ workers (Era 5+), it's impossible. The system scales:

| Population | Interface |
|------------|-----------|
| **1-30** | Individual workers visible and tappable. Each is a character. |
| **30-100** | Workers cluster near buildings. Tap building → "+/- workers" slider. Individual tap still works. |
| **100-300** | Workers become dots at medium zoom. Buildings show worker count badges. Tap building for management. |
| **300+** | Strategic view. Buildings show occupancy bars. Bottom panel has allocation sliders per sector. Individual workers only visible at close zoom. |

### Auto-Assign Priority

The "Auto" button distributes idle workers using this priority:
1. Construction mandates (if behind schedule)
2. Food production (prevent starvation)
3. Power production (keep factories running)
4. Industrial output (meet quotas)
5. Services (hospital, school — morale/skill)
6. Remaining idle (held in reserve)

---

## Procedural Worker Generation

Each worker is a tiny procedurally-generated sprite.

### Visual Design

- **Body**: 8×12 pixel isometric figure
- **Outfit color**: Based on role (brown/red/black/green)
- **Variation**: 3-4 body types × 4 hat/head styles × role color = 48+ visual variations
- **Animation states**: Idle, walking (4 directions), working (task-specific), eating, sleeping
- **Era clothing**: Brown peasant clothes (Revolution) → worker overalls (Industrialization) → Soviet casual (Thaw) → shabby coats (Stagnation)

### Name Generation

Uses existing NameGenerator system (1.1M+ male, 567K female combinations). Each worker has:
- First name (имя)
- Patronymic (отчество)
- Surname (фамилия)

Worker names appear on long-press detail view and in event notifications ("Ivan Petrovich Sidorov has been taken for questioning").

---

## Housing

Workers need housing. Without it, morale drops and growth stops.

### Housing Mechanics

- **Housing capacity**: Sum of all housing buildings' `housingCap` values
- **Occupancy**: Workers auto-assign to nearest available housing (not player-managed)
- **Homeless workers**: If `population > housingCap`, excess workers are "homeless" → -5 morale/tick
- **Era 1 exception**: First 12 peasants have improvised shelter (no housing penalty for first 2 in-game years)
- **Housing quality**: Workers' Houses (30 cap) < Tenement Block (50) < High-Rise (80) < Megablock (120). Higher quality = +1 morale bonus.

### Housing as Control

- **Personal plots**: Some housing allows garden plots (era/doctrine dependent). Gardens provide small food supplement outside the collective system.
- **Communal housing**: During certain doctrines (Industrialization, Freeze), private housing is banned — workers live in communal buildings with lower morale but higher politruk access.
