# Politburo & Ministry System -- Reference

> Source: `src/game/PolitburoSystem.ts` (2,196 lines)
>
> Generates a full Politburo government around each General Secretary.
> Every minister has personality, loyalty, competence, ambition, and
> corruption stats that modify gameplay in their domain. Ministers
> conflict, conspire, get purged, and occasionally coup the General
> Secretary. All transitions of power are smooth. The Pravda says so.

---

## Architecture Overview

The system is organized into seven layers, defined top-to-bottom in the source:

| Layer | Responsibility | Lines |
|-------|---------------|------:|
| 1. Enums & Core Types | PersonalityType, Ministry, GeneralSecretary, Minister, Faction interfaces | 30--155 |
| 2. Ministry Modifiers | MinistryModifiers interface, DEFAULT_MODIFIERS baseline | 157--227 |
| 3. Personality x Ministry Matrix | 8x10 interaction table defining how each archetype runs each ministry | 229--881 |
| 4. Inter-Ministry Tension Rules | 12 pairwise conflict/alliance rules between specific personality combos | 883--1004 |
| 5. Ministry Event Templates | 29 event templates keyed to specific ministries, with personality gating | 1006--1336 |
| 6. Appointment & Succession Logic | 8 appointment strategies, coup/purge probability engines, cabinet staffing | 1338--1603 |
| 7. PolitburoSystem Class | Public API, tick loop, private simulation methods | 1626--2196 |

**Key design principle:** The Politburo runs on a parallel timescale to the
city-builder economy. Ministers apply passive modifiers every tick, but the
political machinery (coups, purges, tensions, events) evaluates on monthly,
quarterly, and annual boundaries. A single tick never causes more than one
succession event.

---

## Personality Archetypes

8 personality types govern both General Secretaries and Ministers. Each
fundamentally changes how a person wields power.

| Archetype | Code | Philosophy |
|-----------|------|------------|
| Zealot | `zealot` | Purity above all. Purges are policy. Quota targets are dreams made mandatory. |
| Idealist | `idealist` | Believes the revolution can still work. Naive but humane. Poets approve. |
| Reformer | `reformer` | Wants to fix the system from within. Private gardens allowed. Party suspicious. |
| Technocrat | `technocrat` | Optimal efficiency via mathematics. Workers are "human resources." Soulless but effective. |
| Apparatchik | `apparatchik` | The system is the goal. Nothing changes. Paperwork filed. Paperwork ignored. |
| Populist | `populist` | Promises everything. Delivers vodka. Citizens love them. Economy: unclear. |
| Militarist | `militarist` | Everything is a war footing. Children march in formation. Tanks in the flower beds. |
| Mystic | `mystic` | Consults horoscopes before purges. Crops planted by lunar cycle. Science optional. |

---

## The Ten Ministries

| Ministry | Enum | Display Name | Domain |
|----------|------|-------------|--------|
| KGB | `kgb` | KGB Chairman | Fear, purge frequency, surveillance, disappearances |
| Agriculture | `agriculture` | Minister of Agriculture | Food production, kolkhoz efficiency, private garden policy |
| Heavy Industry | `heavy_industry` | Minister of Heavy Industry | Factory output, pollution, building costs, industrial accidents |
| Culture | `culture` | Minister of Culture | Morale, art censorship, propaganda effectiveness |
| Defense | `defense` | Minister of Defense | Conscription, military spending, war readiness |
| MVD | `mvd` | Minister of Internal Affairs (MVD) | Crime rate, corruption, black market activity |
| Gosplan | `gosplan` | Chairman of Gosplan | Quota difficulty, resource allocation, 5-year plan targets |
| Health | `health` | Minister of Health | Population growth, vodka policy, hospital effectiveness |
| Education | `education` | Minister of Education | Tech research speed, literacy, ideological purity |
| Transport | `transport` | Minister of Transport | Supply chain delays, infrastructure decay |

---

## Ministry Modifiers

Every minister applies passive modifiers to the game state each tick. The
`MinistryModifiers` interface defines 21 numeric fields and 5 boolean policy
flags:

### Resource Multipliers (baseline 1.0)

| Field | Description | Range |
|-------|-------------|-------|
| `foodProductionMult` | Scales food output from farms | 0.7 -- 1.4 |
| `vodkaProductionMult` | Scales vodka output | 0.8 -- 1.3 |
| `factoryOutputMult` | Scales factory production | 0.7 -- 1.6 |
| `buildingCostMult` | Scales construction costs | 0.6 -- 1.4 |
| `techResearchMult` | Scales research speed | 0.5 -- 1.6 |
| `quotaDifficultyMult` | Scales 5-year plan targets | 0.6 -- 2.0 |
| `populationGrowthMult` | Scales birth/immigration | 0.7 -- 1.3 |
| `supplyChainDelayMult` | Scales delivery times (higher = worse) | 0.5 -- 1.4 |
| `infrastructureDecayMult` | Scales building decay (higher = faster) | 0.7 -- 1.5 |
| `pollutionMult` | Scales pollution output | 0.5 -- 2.0 |
| `hospitalEffectiveness` | Scales hospital healing | 0.5 -- 1.5 |

### Flat Values

| Field | Description | Default | Range |
|-------|-------------|--------:|-------|
| `moraleModifier` | Per-tick happiness delta | 0 | -5 to +6 |
| `fearLevel` | Baseline citizen fear | 30 | 0 -- 100 |
| `surveillanceRate` | KGB events per year | 4 | 2 -- 20 |
| `conscriptionRate` | % of population drafted | 5 | 2 -- 20 |
| `crimeRate` | Baseline crime level | 30 | 0 -- 100 |
| `corruptionDrain` | Rubles lost per tick | 0 | 0 -- 25 |
| `accidentRate` | Chance per tick of industrial accident | 0.02 | 0.01 -- 0.08 |
| `literacyRate` | Baseline literacy | 70 | 55 -- 90 |
| `propagandaIntensity` | Propaganda effectiveness | 50 | 20 -- 95 |

### Policy Flags

| Field | Description | Default |
|-------|-------------|---------|
| `privateGardensAllowed` | Citizens can grow food privately | `false` |
| `vodkaRestricted` | Vodka consumption limited | `false` |
| `blackMarketTolerated` | Informal economy permitted | `false` |
| `artCensored` | Cultural output restricted | `false` |

---

## Personality x Ministry Interaction Matrix

The core design table. For each of the 80 (personality, ministry) pairs, a
`Partial<MinistryModifiers>` override defines how that personality archetype
runs that specific ministry.

Below is the complete 8x10 reference matrix. Each cell contains a short
theme label; full modifier values follow in the per-ministry sections.

```
              ZEALOT   IDEALIST  REFORMER  TECHNO.  APPAR.   POPULIST  MILIT.   MYSTIC
KGB          terror    gentle    open      efficient status_q populace  martial  occult
Agriculture  collectv  commune   private   science   decline  gardens   requistn rituals
Heavy Ind.   quotas!   green     modernize automate  paper    jobs      tanks    alchemy
Culture      censor    utopian   freedom   functnal  approved folk      patriotc mystic
Defense      purge     pacifist  reduce    precision maintain militia   expand   astral
MVD          police    justice   lenient   database  bribe    community martial  omens
Gosplan      maximum   fair      flexible  optimal   same_pln popular   war_econ divine
Health       purify    universal western   evidence  vodka_ok free_vdk  spartan  herbs
Education    indoctri  enlightn  liberal   STEM      rote     practical military esotric
Transport    forced    public    reform    rail      decay    bus       logistic ley
```

### Per-Ministry Highlights

**KGB** -- The ministry with the widest modifier spread. A Zealot KGB Chairman
pushes fear to 85, triples purge frequency, and runs 12 surveillance events
per year. A Reformer drops fear to 20 and nearly eliminates purges (0.2x),
but crime rises to 45 because people can now report it.

**Agriculture** -- Reformers unlock `privateGardensAllowed` and boost food
to 1.4x. Zealots force collectivization at 0.7x. Mystics plant by lunar
cycle at 0.75x.

**Heavy Industry** -- Militarists achieve 1.6x factory output but at 1.8x
pollution and 0.06 accident rate. Idealists are the cleanest at 0.5x
pollution but produce only 0.8x output.

**Culture** -- Reformers grant +6 morale (the highest single modifier in
the matrix) and drop propaganda to 20. Zealots censor all art, push
propaganda to 95, and inflict -4 morale.

**Gosplan** -- Zealots set quotas at 2.0x difficulty. Populists drop quotas
to 0.6x and give +4 morale. Nobody notices the economy stagnating.

**Health** -- Reformers restrict vodka but achieve 1.5x hospital effectiveness
and 1.3x population growth. Mystics rely on crystal healing at 0.5x
hospital effectiveness.

**Education** -- Technocrats max out tech research at 1.6x with 85% literacy.
Mystics bottom out at 0.5x tech with 55% literacy and a curriculum that
includes "dialectical mysticism."

---

## Modifier Calculation Pipeline

When modifiers are recalculated (on construction, after purges, after
succession, and annually), the system:

1. Starts from `DEFAULT_MODIFIERS` (the "empty chair" baseline).
2. Iterates each ministry's current minister.
3. Looks up the `PERSONALITY_MINISTRY_MATRIX[ministry][personality]` overrides.
4. Applies **competence scaling**: each override's deviation from baseline is
   scaled by `0.5 + (competence / 200)`.
   - At competence 0: modifier effect is halved.
   - At competence 100: modifier applies at full strength.
5. For multiplier fields (ending in `Mult` or `hospitalEffectiveness`), the
   scaled deviation is added to the running total.
6. For flat values, the system blends toward the override proportional to
   competence scale.
7. Boolean flags are applied directly (no scaling).

```
finalMod = DEFAULT + SUM( (override - baseline) * (0.5 + competence/200) )
```

This means a highly competent Zealot KGB Chairman is more terrifying than
an incompetent one, but even an incompetent one is still half-terrifying.

---

## Minister Stats

Each minister has 4 core stats (0--100) plus tracking fields:

| Stat | Description | Effect |
|------|-------------|--------|
| `loyalty` | Loyalty to current General Secretary | Below 20 = danger zone. Affects coup/purge probability. |
| `competence` | How well they do their job | Scales modifier effectiveness via competence pipeline. |
| `ambition` | Desire to rise higher | High ambition + low loyalty = coup risk. Grows with tenure. |
| `corruption` | Resource siphoning rate | Drains rubles each month. Grows slowly over time. |

### Stat Ranges by Personality

Stats are generated from personality-specific ranges:

| Personality | Loyalty | Competence | Ambition | Corruption |
|-------------|--------:|-----------:|---------:|-----------:|
| Zealot | 70--95 | 20--60 | 50--90 | 10--30 |
| Idealist | 50--80 | 40--70 | 20--50 | 5--20 |
| Reformer | 30--60 | 50--80 | 40--70 | 10--25 |
| Technocrat | 40--70 | 70--95 | 30--60 | 10--30 |
| Apparatchik | 50--80 | 20--50 | 20--50 | 30--70 |
| Populist | 40--70 | 30--60 | 50--80 | 20--50 |
| Militarist | 60--90 | 40--70 | 60--90 | 15--40 |
| Mystic | 30--60 | 10--40 | 30--70 | 20--50 |

### Monthly Stat Drift

Each month, minister stats evolve:

- **Loyalty** drifts toward compatibility. Compatible ministers gain 0--3;
  incompatible ministers lose 0--3.
- **Ambition** grows by 0--2 per month after 3 years of tenure.
- **Corruption** grows by 0--1 per month (always).
- **Purge risk** accumulates +1 to +5 if loyalty < 40 or ambition > 70;
  decays by 2 otherwise.

---

## Personality Compatibility

The General Secretary's personality determines which minister types they
trust. Compatible pairs cause loyalty drift upward; incompatible pairs
drift downward.

| GS Personality | Compatible Minister Types |
|----------------|--------------------------|
| Zealot | Zealot, Militarist |
| Idealist | Idealist, Reformer, Populist |
| Reformer | Reformer, Technocrat, Idealist |
| Technocrat | Technocrat, Reformer |
| Apparatchik | Apparatchik, Technocrat |
| Populist | Populist, Idealist, Reformer |
| Militarist | Militarist, Zealot |
| Mystic | Mystic, Idealist |

---

## Inter-Ministry Tension System

12 rules define pairwise tension between ministries when specific personality
combinations are present. Tension accumulates quarterly and triggers events
when thresholds are crossed.

### Conflict Rules (positive tension)

| Ministry A | Personality A | Ministry B | Personality B | Tension/yr | Description |
|------------|--------------|------------|---------------|----------:|----|
| KGB | Zealot | Agriculture | Reformer | +30 | KGB demands arrest of farmers with private gardens. Agriculture refuses. |
| KGB | Zealot | Culture | Reformer | +40 | KGB bans jazz. Culture Minister caught playing saxophone at midnight. |
| Heavy Industry | Militarist | Agriculture | Idealist | +25 | Industry requisitions farmland for tank factory. Agriculture weeps into turnip field. |
| Defense | Militarist | Health | Reformer | +20 | Defense wants hospital beds for soldiers. Health wants them for civilians. |
| Gosplan | Zealot | Transport | Apparatchik | +15 | Gosplan demands impossible delivery schedules. Transport loses the memo. |
| MVD | Reformer | KGB | Zealot | +35 | MVD tries to release political prisoners. KGB adds MVD Minister to watch list. |
| Education | Technocrat | Culture | Mystic | +20 | Education removes astrology from curriculum. Culture demands its return as "cultural heritage." |
| Health | Reformer | Agriculture | Populist | +15 | Health bans vodka. Agriculture's vodka-producing kolkhozes revolt. |

### Alliance Rules (negative tension = cooperation)

| Ministry A | Personality A | Ministry B | Personality B | Tension/yr | Description |
|------------|--------------|------------|---------------|----------:|----|
| KGB | Zealot | Defense | Militarist | -20 | KGB and Defense form iron alliance. Citizens have never been more terrified or "safe." |
| Agriculture | Reformer | Gosplan | Reformer | -25 | Reformers unite. Economy briefly improves. Everyone suspicious. |
| Education | Technocrat | Heavy Industry | Technocrat | -15 | Technocrats collaborate. Factories improve. Workers feel like test subjects. |
| Culture | Mystic | Health | Mystic | -10 | Crystal healing centers open. Citizens die peacefully, surrounded by quartz. |

### Threshold Mechanics

- Tension accumulates in quarterly increments (annual delta / 4).
- **Conflict threshold (> 50):** Generates an `INTER-MINISTRY CONFLICT` event,
  drains 20 rubles, reduces both ministers' loyalty by 5, then subtracts 30
  from the tension pool.
- **Alliance threshold (< -30):** Generates an `INTER-MINISTRY COOPERATION` event,
  grants 10 rubles, then adds 15 to the tension pool (toward zero).

---

## Ministry Events

29 event templates are keyed to specific ministries. Each month has a 15%
chance of firing one ministry event. Events are filtered by personality
gates and game-state conditions, then selected via weighted random.

### Event Counts by Ministry

| Ministry | Events | Highlights |
|----------|-------:|------------|
| KGB | 4 | Surveillance reports, spy discoveries, loyalty tests, purge waves |
| Agriculture | 4 | Harvest reports, weather catastrophes, collectivization drives, private garden booms |
| Culture | 3 | Art bans, mandatory celebrations, approved music list updates |
| Defense | 3 | Border incidents, military exercises, conscription drives |
| Health | 2 | Vodka policy updates, mysterious epidemics |
| Gosplan | 2 | Quota revisions, resource reallocations |
| Education | 2 | Literacy campaigns, textbook revisions |
| MVD | 2 | Black market raids, corruption scandals |
| Transport | 2 | Supply chain disruptions, infrastructure collapses |
| **Total** | **24** | Plus 5 personality-gated variants |

### Event Template Interface

```typescript
interface MinistryEventTemplate {
  id: string;
  ministry: Ministry;
  title: string;
  description: string | ((minister: Minister, gs: GameState) => string);
  pravdaHeadline: string;
  severity: EventSeverity;            // 'trivial' | 'minor' | 'major' | 'catastrophic'
  category: EventCategory;            // 'political' | 'economic' | 'disaster' | 'cultural'
  effects: ResourceDelta | ((minister: Minister, gs: GameState) => ResourceDelta);
  requiredPersonality?: PersonalityType;
  condition?: (minister: Minister, gs: GameState) => boolean;
  weight?: number;                    // default 1.0
}
```

Events with dynamic descriptions interpolate minister stats and game state
at generation time. A Zealot KGB Chairman's loyalty test is very different
from a Reformer's -- "Several citizens fail. They will be re-educated" vs.
"Tests graded on a curve. Everyone passes."

### Event Selection Pipeline

```
Monthly tick (dateTick === 0)
  |
  +-- Roll 15% chance
  |     MISS --> no event this month
  |
  +-- Filter MINISTRY_EVENTS:
  |     - minister exists for template's ministry
  |     - requiredPersonality matches (if set)
  |     - condition() passes (if set)
  |
  +-- Weighted random selection from eligible pool
  |     weight defaults to 1.0; rare events like
  |     infrastructure_collapse use 0.4
  |
  +-- Resolve dynamic description and effects
  |
  +-- Compute net impact to determine event type
  |     netImpact > 5  --> 'good'
  |     netImpact < -5 --> 'bad'
  |     otherwise      --> 'neutral'
  |
  +-- Emit GameEvent via onEvent callback
```

---

## Coup Probability Engine

Any minister can attempt a coup. Probability is calculated annually.

### Formula

```
coupChance = (ambition * (100 - loyalty)) / 10000
           + (0.15 if KGB Chairman)
           + (0.05 * (factionSize - 1))
           - (GS.paranoia / 200)
```

### Base Rate Reference (before adjustments)

| | Low Loyalty (0--30) | Mid Loyalty (31--60) | High Loyalty (61--100) |
|---|---:|---:|---:|
| **Low Ambition (0--30)** | 0.21 | 0.12 | 0.00 |
| **Mid Ambition (31--60)** | 0.42 | 0.24 | 0.06 |
| **High Ambition (61--100)** | 0.70 | 0.40 | 0.10 |

### Adjustment Factors

| Factor | Value | Notes |
|--------|------:|-------|
| KGB Chairman bonus | +0.15 | "They know where the files are." |
| Faction member bonus | +0.05 each | Per additional faction member beyond the first |
| GS paranoia penalty | -(paranoia/200) | High paranoia = harder to coup (max -0.50) |

### Coup Execution

When a coup succeeds:

1. The old General Secretary is marked dead (`causeOfDeath: 'coup'`).
2. A `PALACE COUP` event fires (severity: catastrophic, -100 rubles, -5 population).
3. The couper becomes the new General Secretary with elevated paranoia (50--90).
4. `staffNewCabinet()` reshuffles the Politburo per the new leader's appointment strategy.
5. Modifiers are recalculated.
6. Only one coup can succeed per year.

---

## Purge Probability Engine

The General Secretary periodically purges disloyal or incompetent ministers.
Purge checks run quarterly.

### Formula

```
purgeChance = (GS.paranoia / 100) * (1 - minister.loyalty / 100)
            + (0.1 if competence < 30)
            + (corruption / 200)
            - (0.2 if KGB Chairman)
```

### Base Rate Reference (before adjustments)

| | Low Loyalty (0--30) | Mid Loyalty (31--60) | High Loyalty (61--100) |
|---|---:|---:|---:|
| **Low Paranoia (0--30)** | 0.21 | 0.12 | 0.00 |
| **Mid Paranoia (31--60)** | 0.42 | 0.24 | 0.06 |
| **High Paranoia (61--100)** | 0.70 | 0.40 | 0.10 |

### Adjustment Factors

| Factor | Value | Notes |
|--------|------:|-------|
| Low competence bonus | +0.10 | If competence < 30: "incompetent enough to notice" |
| Corruption risk | +(corruption/200) | Max +0.50 at corruption 100 |
| KGB protection | -0.20 | "They know too much" |

### Purge Execution

When a minister is purged:

1. Minister is archived in `purgeHistory` with year and reason.
2. A `MINISTERIAL PURGE` event fires. The minister "has been reassigned to counting trees in Siberia."
3. A replacement is generated using the GS's preferred personality types.
4. The replacement receives a +20 loyalty bonus (grateful for the appointment).
5. The GS's paranoia increases by 3--8 points. Purging is habit-forming.
6. Modifiers are recalculated.

---

## Appointment Strategies

When a new General Secretary takes power, their personality determines
how they staff the Politburo.

| GS Personality | Retention | Preferred Types | Loyalty Threshold | Merit-Based | Purges KGB |
|----------------|----------:|-----------------|------------------:|:-----------:|:----------:|
| Zealot | 0% | Zealot, Militarist | 90 | No | Yes |
| Idealist | 40% | Idealist, Reformer, Technocrat | 30 | No | No |
| Reformer | 60% | Reformer, Technocrat, Idealist | 20 | Yes | No |
| Technocrat | 50% | Technocrat, Reformer | 10 | Yes | No |
| Apparatchik | 80% | Apparatchik, Technocrat | 10 | No | No |
| Populist | 40% | Populist, Idealist, Reformer | 30 | No | No |
| Militarist | 30% | Militarist, Zealot | 60 | No | Yes |
| Mystic | 50% | Mystic, Idealist | 20 | No | No |

### Cabinet Staffing Logic

For each ministry during a transition:

1. **KGB special case:** If `purgesKGB` is false and the old KGB Chairman
   exists, they survive (but loyalty drops 10, ambition rises 10 -- "they
   know too much").
2. **Retention roll:** If `random() < retentionRate`, check further.
3. **Merit filter:** If `meritBased` and competence < 40, replace.
4. **Loyalty filter:** If loyalty < `loyaltyThreshold`, replace.
5. **Otherwise:** Minister survives with loyalty adjusted by -10 to +10.
6. **New appointments** receive the GS's preferred personality type and a
   +15 loyalty bonus.

---

## Faction System

Ministers of the same personality type form factions when 2 or more share
an archetype. Factions are reformed annually and after cabinet changes.

```typescript
interface Faction {
  id: string;
  name: string;                    // e.g. "Reformer Bloc"
  alignment: PersonalityType;
  memberIds: string[];
  influence: number;               // sum of members' (competence + ambition)
  supportsCurrent: boolean;        // personality-compatible with GS
}
```

Factions affect coup probability: each faction member beyond the first
adds +0.05 to the coup chance of every member. A 4-member Militarist Bloc
adds +0.15 to each member's base coup chance.

---

## General Secretary Lifecycle

### Generation

```typescript
function generateGeneralSecretary(year: number, personality?: PersonalityType): GeneralSecretary
```

| Field | Generation Rule |
|-------|----------------|
| `personality` | Explicit or uniform random from 8 types |
| `paranoia` | Zealot: 60--90, Militarist: 50--80, Apparatchik: 30--60, Reformer: 20--40, others: 20--60 |
| `health` | 60--95 |
| `age` | 55--75 |

### Aging & Death

Evaluated annually:

- **Health decay:** `floor((age - 50) / 5) + floor(paranoia / 30)` points
  per year, with random range 1 to `healthDecay + 1`.
- **Death at health 0:** Triggers natural succession.
- **Sudden death:** If age > 70, additional `(age - 70) / 100` chance per year.

### Succession

```
Leader health reaches 0  -- or --  Sudden death roll succeeds
  |
  +-- Mark old leader as dead, archive in leaderHistory
  |
  +-- Generate new General Secretary (random personality)
  |
  +-- Emit LEADERSHIP TRANSITION event (severity: catastrophic, -50 rubles)
  |
  +-- Staff new cabinet via appointment strategy
  |
  +-- Recalculate all modifiers
```

---

## Corruption Drain

Monthly, each minister siphons `floor(corruption / 10)` rubles from the
treasury. The `corruptionDrain` modifier field from the active modifiers
is added on top. With 10 ministers at average corruption 50, the state
loses ~50 rubles per month to graft alone.

---

## Tick Schedule

The `tick()` method is called every simulation tick by `SimulationEngine`.
Political events evaluate on time boundaries:

| Cadence | Checks | Trigger Condition |
|---------|--------|-------------------|
| Monthly (every month) | `updateMinisterStats()`, `checkMinistryEvents()`, `applyCorruptionDrain()` | `dateTick === 0` |
| Quarterly (months 1, 4, 7, 10) | `checkTensions()`, `checkPurges()` | `dateTick === 0 && month in {1,4,7,10}` |
| Annually (January) | `ageLeader()`, `checkCoups()`, `checkLeaderDeath()`, `incrementTenure()`, `formFactions()`, `recalculateModifiers()` | `dateTick === 0 && month === 1` |

---

## Public API

The `PolitburoSystem` class is the sole public interface. It is instantiated
with a `GameState` reference and an event callback, and ticked by
`SimulationEngine`.

### Constructor

```typescript
constructor(gameState: GameState, onEvent: (event: GameEvent) => void)
```

On construction:
1. Generates a random General Secretary.
2. Generates 10 ministers (one per ministry, random personalities).
3. Calculates initial modifiers.
4. Forms initial factions.

### `tick(): void`

Advances the political simulation by one tick. Evaluates monthly, quarterly,
and annual checks as described in the Tick Schedule above.

### `getState(): Readonly<PolitburoState>`

Returns the full Politburo state (read-only). The state includes:

```typescript
interface PolitburoState {
  generalSecretary: GeneralSecretary;
  ministers: Map<Ministry, Minister>;
  factions: Faction[];
  tensions: Map<string, number>;      // accumulated inter-ministry tension
  activeModifiers: MinistryModifiers;  // combined modifiers from all ministers
  leaderHistory: GeneralSecretary[];   // past leaders
  purgeHistory: Array<{ minister: Minister; year: number; reason: string }>;
}
```

### `getModifiers(): Readonly<MinistryModifiers>`

Returns the currently active combined modifiers. Used by `SimulationEngine`
and ECS systems to scale resource production, decay rates, event weights,
and policy flags.

### `getMinister(ministry: Ministry): Minister | undefined`

Look up the current minister for a specific ministry.

### `getGeneralSecretary(): GeneralSecretary`

Returns the current General Secretary.

### `forceSuccession(cause): void`

Force a leadership change from external code (testing or event triggers).
Accepts a cause string: `'natural'`, `'coup'`, `'purged_by_successor'`,
or `'assassination'`.

---

## Exported Functions

Two standalone functions are exported for external probability display:

### `calculateCoupChance(minister, gs, factionSize): number`

Returns the annual coup probability for a minister (0.0 -- 1.0).

### `calculatePurgeChance(minister, gs): number`

Returns the annual purge probability for a minister (0.0 -- 1.0).

### `generateMinister(ministry, personality?): Minister`

Generates a new minister for the given ministry with personality-appropriate
stat ranges.

### `generateGeneralSecretary(year, personality?): GeneralSecretary`

Generates a new General Secretary for the given year.

---

## Helper Functions

| Function | Description |
|----------|-------------|
| `pick(arr)` | Uniform random selection from an array |
| `randInt(min, max)` | Inclusive random integer in `[min, max]` |
| `generateName()` | Random first + last name from 27 x 34 name pools |
| `generateId()` | Timestamp + random string unique identifier |
| `randomPersonality()` | Uniform random from 8 PersonalityType values |
| `clamp(value, min, max)` | Numeric clamping utility |

---

## Combinatorial Capacity

| Dimension | Pool |
|-----------|-----:|
| First names | 27 |
| Last names | 34 |
| Personality types | 8 |
| Ministries | 10 |
| **Unique minister identities** (name x personality) | **7,344** |
| **Unique Politburo configurations** (10 ministers) | **8^10 = 1,073,741,824** |

Each Politburo configuration produces a distinct modifier set, tension
landscape, and political narrative. Combined with the coup, purge, and
succession engines, the system generates effectively unlimited unique
political histories across game sessions.

> *"All leadership transitions are smooth. Any appearance of chaos is
> Western propaganda."*
