# Pravda Headline Generator -- Reference

> Source: `src/game/PravdaSystem.ts` (1,458 lines)
>
> Procedural propaganda headline engine for SimSoviet 2000. Generates
> unlimited unique Pravda newspaper headlines from compositional grammars.
> All news is good news. Bad news is better news, presented correctly.

---

## Architecture Overview

The system is organized into five layers, evaluated top-to-bottom:

| Layer | Responsibility | Lines |
|-------|---------------|------:|
| 1. Word Pools | Interchangeable text fragments that plug into template slots | 70--477 |
| 2. Template Grammar | Generator functions that compose word-pool entries into headlines | 479--945 |
| 3. Contextual Generators | State-reactive generators that fire when game conditions match | 947--1117 |
| 4. Spin Doctor | Translates game-event resource effects into propaganda subtext | 1119--1244 |
| 5. PravdaSystem Class | Public API, anti-repetition tracking, front-page formatting | 1372--1458 |

**Key design principle:** External threats (NATO, CIA, capitalists) are NEVER real
gameplay events. They exist ONLY as Pravda propaganda. Real disruptions come from
internal failures, but Pravda never acknowledges those -- it reports external threats
and internal triumphs exclusively.

---

## Word Pools

21 array-style pools provide 279 base entries. Two object-style maps (SHORTAGE_EUPHEMISMS
and SPIN_PREFIXES) add 31 and 49 entries respectively, for 359 total pool entries.

### Array Pools (21 pools, 279 entries)

| Pool | Role | Count |
|------|------|------:|
| `HERO_SUBJECTS` | Positive subject nouns (workers, miners, builders) | 15 |
| `ENEMY_SUBJECTS` | External bogeymen (CIA, NATO, Wall Street) | 18 |
| `INSTITUTIONS` | Party organs (Politburo, Ministry of Truth) | 15 |
| `LEADER_TITLES` | Sycophantic titles for the leader | 12 |
| `TRIUMPH_VERBS` | Over-the-top achievement verbs | 15 |
| `THREAT_VERBS` | Verbs for foiling enemies | 12 |
| `POSITIVE_VERBS` | Celebration/endorsement verbs | 10 |
| `PRODUCTION_OBJECTS` | What was produced (quotas, targets, benchmarks) | 15 |
| `THREAT_OBJECTS` | What was foiled (plots, espionage rings) | 12 |
| `CULTURAL_OBJECTS` | Abstract ideological values | 10 |
| `QUALIFIERS` | How it was done (ahead of schedule, unanimously) | 20 |
| `WESTERN_NOUNS` | Capitalist failures (unemployment, inflation) | 15 |
| `WESTERN_COUNTRIES` | Named Western adversaries | 13 |
| `FAKE_DISCOVERIES` | Absurd scientific breakthroughs | 16 |
| `SOVIET_SPORTS` | Competitive events (includes potato peeling, queue standing) | 15 |
| `DESTRUCTION_SPINS` | Positive framing for building collapses | 8 |
| `LEADER_ACHIEVEMENTS` | Impossible personal feats of the leader | 14 |
| `LEADER_QUALITIES` | Superhuman attributes | 12 |
| `NATURE_CREDITS` | Natural phenomena credited to the Party | 8 |
| `GENERIC_REALITIES` | Sardonic "reality" footnotes | 14 |
| `THREAT_REALITIES` | Absurd truths behind alleged threats | 10 |

### Shortage Euphemisms (5 resource types, 31 entries)

| Resource | Entries | Example |
|----------|--------:|---------|
| `food` | 7 | `VOLUNTARY CALORIC CONSERVATION PROGRAM` |
| `money` | 6 | `RUBLE ACHIEVES MAXIMUM THEORETICAL VALUE` |
| `vodka` | 6 | `SOBRIETY INITIATIVE PROCEEDS AHEAD OF SCHEDULE` |
| `power` | 6 | `CANDLELIGHT APPRECIATION WEEK ENTERS MONTH FOUR` |
| `pop` | 6 | `POPULATION OPTIMIZED FOR MAXIMUM EFFICIENCY` |

---

## Generator Categories

48 generic generator functions are grouped into 6 weighted categories. The
composition engine rolls against these weights to select a category, then
picks a random generator within it.

| Category | Generators | Weight | Selection Probability |
|----------|----------:|-------:|----------------------:|
| External Threats | 10 | 2.5 | 25.0% |
| Internal Triumphs | 9 | 2.0 | 20.0% |
| Leadership Praise | 7 | 1.5 | 15.0% |
| Cultural Victories | 6 | 1.5 | 15.0% |
| Resource Spin | 7 | 1.0 | 10.0% |
| Weather/Filler | 9 | 1.5 | 15.0% |

### External Threats (10 generators, weight 2.5)

These headlines reference enemies that do not exist in the game. They are
pure propaganda filler and are also used as *distractions* when real bad
events occur internally.

| # | Pattern | Example Output |
|---|---------|---------------|
| 1 | ENEMY PLOT foiled by HERO | `CIA OPERATIVES ESPIONAGE RING FOILED BY HEROIC WORKERS` |
| 2 | WESTERN noun PROVES inferiority | `AMERICA UNEMPLOYMENT PROVES INFERIORITY OF CAPITALIST SYSTEM` |
| 3 | NUMBER spies arrested | `17 WESTERN SPIES ARRESTED IN HEROIC STING OPERATION` |
| 4 | COUNTRY COLLAPSES under FAILURE | `BRITAIN ON BRINK OF COLLAPSE DUE TO INFLATION` |
| 5 | IMPERIALIST plot to undermine NOUN | `IMPERIALIST PLOT TO UNDERMINE SOVIET STEEL OUTPUT TARGET THWARTED` |
| 6 | COUNTRY conducting THREAT near border | `NATO CAUGHT CONDUCTING SABOTAGE OPERATION NEAR BORDER` |
| 7 | Western radio jammed | `WASHINGTON RADIO PROPAGANDA JAMMED SUCCESSFULLY FOR 347TH DAY` |
| 8 | Enemy lure fails | `CAPITALIST SABOTEURS FAIL TO LURE LOYAL CITIZENS WITH PROMISES OF BLUE JEANS` |
| 9 | Diplomatic humiliation | `SOVIET DELEGATION HUMILIATES FRANCE AT UN SUMMIT` |
| 10 | Military superiority | `NEW SOVIET MISSILE RENDERS NATO DEFENSES OBSOLETE` |

### Internal Triumphs (9 generators, weight 2.0)

Production records, satisfaction surveys, and infrastructure claims that are
always mathematically impossible.

| # | Pattern | Example Output |
|---|---------|---------------|
| 1 | HEROES VERB OBJECT QUALIFIER | `DEDICATED COMRADES SURPASSED HARVEST BENCHMARK AHEAD OF SCHEDULE` |
| 2 | Factory output tonnage | `FACTORY OUTPUT REACHES 990,000 METRIC TONS IN RECORD TIME` |
| 3 | >100% satisfaction survey | `CITIZEN SATISFACTION SURVEY: 127% APPROVAL RATING` |
| 4 | Absurd record streak | `NEW RECORD: 347 CONSECUTIVE DAYS WITHOUT UNSANCTIONED OPINION` |
| 5 | Impossible infrastructure | `250 NEW HOSPITALS COMPLETED THIS MONTH` |
| 6 | All POP citizens celebrate | `ALL 42 CITIZENS CELEBRATED WORKERS SOLIDARITY` |
| 7 | Productivity multiplier | `WORKER PRODUCTIVITY UP 1700% SINCE LAST PURGE` |
| 8 | Five-year plan early finish | `FIVE-YEAR PLAN COMPLETED IN 3 YEARS 9 MONTHS` |
| 9 | Election results | `ELECTIONS HELD: APPROVED CANDIDATE WINS WITH 101% OF VOTE` |

### Leadership Praise (7 generators, weight 1.5)

Sycophantic headlines about the leader's superhuman feats.

| # | Pattern | Example Output |
|---|---------|---------------|
| 1 | Leader personal achievement | `COMRADE GENERAL SECRETARY BENCH-PRESSES 200 KILOGRAMS` |
| 2 | Nature credited to leader | `GOOD HARVEST ATTRIBUTED TO WISE AGRICULTURAL POLICY` |
| 3 | Leader work ethic | `THE BRILLIANT CHAIRMAN COMPLETES 19-HOUR WORKDAY, ASKS FOR MORE` |
| 4 | Leader solves everything | `OUR BELOVED LEADER'S BRILLIANT DECREE SOLVES HUNGER` |
| 5 | Medal ceremony | `THE WISE PREMIER AWARDED 7 MEDALS IN SINGLE CEREMONY` |
| 6 | Foreign envy | `FOREIGN LEADERS EXPRESS ENVY OF COMRADE FIRST SECRETARY'S INFINITE WISDOM` |
| 7 | Childhood legend | `NEWLY DISCOVERED DOCUMENTS REVEAL THE PEOPLES FATHER COULD READ AT AGE 2` |

### Cultural Victories (6 generators, weight 1.5)

Sports victories, scientific breakthroughs (fake), art, film, education, and
declarations of Western cultural inferiority.

| # | Pattern | Example Output |
|---|---------|---------------|
| 1 | Sports victory | `SOVIET POTATO PEELING TEAM WINS ALL MEDALS AT WORLD CHAMPIONSHIP` |
| 2 | Fake discovery | `ACADEMY OF SCIENCES ANNOUNCES VODKA-BASED ROCKET FUEL` |
| 3 | Art/performance event | `PEOPLES ORCHESTRA ACHIEVES RECORD ATTENDANCE` |
| 4 | Film wins all awards | `FILM "CONCRETE: A LOVE STORY" WINS ALL 9 AWARDS` |
| 5 | Literacy rate >100% | `LITERACY RATE REACHES 103% FOLLOWING NEW PROGRAM` |
| 6 | Western art declared dead | `WESTERN MUSIC DECLARED "DECADENT AND DYING" BY MINISTRY OF CULTURE` |

### Resource Spin (7 generators, weight 1.0)

Generators that directly read ECS resource values (via `GameView`) and spin them
into propaganda. These always interpolate live game data.

| # | Resource | Headline Source |
|---|----------|----------------|
| 1 | `food` | `SHORTAGE_EUPHEMISMS.food` |
| 2 | `money` | `SHORTAGE_EUPHEMISMS.money` |
| 3 | `vodka` | `SHORTAGE_EUPHEMISMS.vodka` |
| 4 | `power` | `SHORTAGE_EUPHEMISMS.power` |
| 5 | `pop` | `SHORTAGE_EUPHEMISMS.pop` |
| 6 | `buildings.length` | `URBAN DEVELOPMENT INDEX: N STRUCTURES AND GROWING` |
| 7 | `quota.*` | Five-year plan percentage with conditional over/under messaging |

### Weather/Filler (9 generators, weight 1.5)

Low-stakes absurdist filler: weather reports, corrections, classifieds,
horoscopes, year-in-review, and editorials.

| # | Pattern | Example Output |
|---|---------|---------------|
| 1 | Weather forecast | `WEATHER FORECAST: CONCRETE-COLORED WITH SCATTERED GREYNESS` |
| 2 | Winter arrives | `WINTER ARRIVES PER FIVE-YEAR WEATHER PLAN` |
| 3 | Spring predicted | `SPRING PREDICTED FOR EVENTUALLY` |
| 4 | Sun spotted | `SUN SPOTTED FOR 27 MINUTES. CITIZENS CELEBRATE` |
| 5 | Editorial | `EDITORIAL: EVERYTHING IS FINE (REPEAT UNTIL TRUE)` |
| 6 | Correction | `CORRECTION: THE "FOOD SHORTAGE" IS A "CALORIC OPPORTUNITY"` |
| 7 | Classified ad | `CLASSIFIED: FOR SALE: SLIGHTLY USED TRACTOR. CONDITION: THEORETICAL` |
| 8 | Horoscope | `DAILY HOROSCOPE: ALL SIGNS PREDICT CONCRETE` |
| 9 | Year-in-review | `2000 ON TRACK TO BE BEST YEAR IN SOVIET HISTORY` |

---

## Contextual Generators

13 state-reactive generators fire when specific game-state thresholds are met.
When at least one condition is true, there is a **40% chance** the engine selects
from the contextual pool instead of the generic pool. Within the contextual pool,
selection is weighted.

| # | Condition | Weight | Example Headline |
|---|-----------|-------:|-----------------|
| 1 | `pop < 20 && pop > 0` | 2.0 | `INTIMATE COMMUNITY OF 12 PROVES SUPERIORITY OF SMALL-SCALE SOCIALISM` |
| 2 | `food < 10` | 3.0 | `CITIZENS ACHIEVE NEW FASTING RECORD: DAY 17` |
| 3 | `money < 50` | 2.0 | `POST-MONETARY ECONOMY ACHIEVED: TREASURY AT LEAN 23 RUBLES` |
| 4 | `buildings.length > 15` | 1.0 | `URBAN SKYLINE FEATURES 18 MAGNIFICENT STRUCTURES` |
| 5 | `buildings.length === 0` | 3.0 | `MINIMALIST URBAN DESIGN WINS INTERNATIONAL ACCLAIM` |
| 6 | `pop === 0` | 5.0 | `CITY ACHIEVES PERFECT CRIME RATE: 0 CRIMES, 0 CITIZENS` |
| 7 | `vodka > 100` | 1.5 | `VODKA RESERVES AT 142 UNITS: MORALE INFRASTRUCTURE SECURE` |
| 8 | `power === 0` with non-road buildings | 2.5 | `NATIONWIDE LIGHTS-OUT EVENT CELEBRATES EARTH HOUR (EXTENDED INDEFINITELY)` |
| 9 | gulag count >= 2 | 2.0 | `3 ATTITUDE ADJUSTMENT FACILITIES OPERATING AT FULL CAPACITY` |
| 10 | `pop > 200` | 1.0 | `POPULATION BOOM: 247 CITIZENS PROVE SOCIALIST PARADISE IS MAGNETS FOR MASSES` |
| 11 | `date.year > 1990` | 1.5 | `YEAR 1993: RUMORS OF REFORM DISMISSED AS WESTERN PROPAGANDA` |
| 12 | quota deadline within 1 year, behind target | 3.0 | `FIVE-YEAR PLAN 43% COMPLETE WITH MOMENTS TO SPARE` |
| 13 | (population zero -- highest weight in system) | 5.0 | `CITY ACHIEVES PERFECT CRIME RATE: 0 CRIMES, 0 CITIZENS` |

Note: conditions 6 and 13 overlap (both are `pop === 0`). Condition 6 appears
once in the array with weight 5.0, the highest individual weight in the system.

---

## Event-Reactive System

When a `GameEvent` fires, `generateEventReactiveHeadline()` selects a response
strategy based on the event's severity, type, and category:

```
Event arrives
  |
  +-- severity === 'catastrophic'?
  |     YES --> ALWAYS generate external threat distraction
  |             subtext: "ALERT: {COUNTRY} threatens peace. All domestic matters: handled."
  |             reality: "Meanwhile: {event.description}"
  |
  +-- type === 'bad'?
  |     35% chance --> external threat distraction
  |                    appends "(Unrelated: minor {category} adjustment in progress.)"
  |     65% chance --> fall through to default
  |
  +-- category === 'disaster'?
  |     30% chance --> DESTRUCTION_SPINS headline
  |                    "{INSTITUTION} confirms: this was always the plan."
  |     70% chance --> fall through to default
  |
  +-- type === 'good'?
  |     YES --> amplify: "{INSTITUTION} CONFIRMS: {event.pravdaHeadline}"
  |             credit leader, add qualifier
  |
  +-- default (neutral / unmatched)
        Use event's built-in pravdaHeadline
        Generate spin subtext via spinEventEffects()
```

### Event Category Mapping

The `categoryFromEvent()` function maps `EventCategory` to `HeadlineCategory`:

| EventCategory | HeadlineCategory | Rationale |
|---------------|-----------------|-----------|
| `disaster` | `triumph` | Disasters are reframed as triumphs |
| `political` | `editorial` | Political events become editorials |
| `economic` | `production` | Economic events map to production reports |
| `cultural` | `culture` | Direct mapping |
| `absurdist` | random: `editorial` / `weather` / `culture` | Shuffled for variety |
| (default) | `editorial` | Catch-all |

---

## Spin Doctor

The spin doctor translates raw resource changes from game events into
propaganda subtext. It uses the `SPIN_PREFIXES` map (10 keys, 49 entries total).

### Resource-to-Propaganda Mapping

| Resource Key | Direction | Entries | Example Prefix |
|-------------|-----------|--------:|---------------|
| `money_loss` | negative | 5 | `VOLUNTARY FISCAL CONTRIBUTION:` |
| `money_gain` | positive | 5 | `MONEY SPONTANEOUSLY APPEARS (AS MARX PREDICTED):` |
| `food_loss` | negative | 6 | `CITIZENS EMBRACE INTERMITTENT FASTING:` |
| `food_gain` | positive | 5 | `TURNIPS GROW OUT OF SHEER PATRIOTISM:` |
| `pop_loss` | negative | 5 | `CITIZENS VOLUNTEER FOR REMOTE ASSIGNMENT:` |
| `pop_gain` | positive | 5 | `SOCIALIST PARADISE ATTRACTS NEW RESIDENTS:` |
| `vodka_loss` | negative | 5 | `MORALE FLUID CONSUMED IN SERVICE OF THE PEOPLE:` |
| `vodka_gain` | positive | 5 | `LIQUID ENTHUSIASM STOCKPILE GROWS:` |
| `power_loss` | negative | 5 | `WORKERS EMBRACE DARKNESS (FIGURATIVELY AND LITERALLY):` |
| `power_gain` | positive | 3 | `WATTS FLOW LIKE VODKA AT A PARTY CONGRESS:` |

The `spinEventEffects()` function iterates over all resource fields in a
`GameEvent.effects` object, generates a spin prefix for each non-zero change,
and joins them with ` | `. If no resource changes occurred, it returns one of
4 fallback messages such as `"No material changes. The State remains perfect."`.

---

## GeneratedHeadline Interface

Every headline produced by the system is a triple of public text, propaganda
subtext, and hidden reality:

```typescript
interface GeneratedHeadline {
  headline: string;   // The Pravda front-page headline (ALL CAPS)
  subtext: string;    // Supporting propaganda text
  reality: string;    // The grim truth (shown on hover / debug only)
  category: HeadlineCategory;
}
```

The exported `PravdaHeadline` type extends this with a `timestamp`:

```typescript
export interface PravdaHeadline {
  headline: string;
  subtext: string;
  reality: string;
  category: 'triumph' | 'production' | 'culture' | 'weather'
          | 'editorial' | 'threat' | 'leader' | 'spin';
  timestamp: number;
}
```

There are 8 headline categories:

| Category | Source |
|----------|--------|
| `triumph` | Internal triumphs, reframed disasters |
| `production` | Factory output, quotas, building counts |
| `culture` | Sports, science, art, education |
| `weather` | Weather forecasts, seasonal filler |
| `editorial` | Editorials, corrections, classifieds, horoscopes |
| `threat` | External threats (never real) |
| `leader` | Leadership praise |
| `spin` | Direct resource-shortage euphemisms |

---

## Anti-Repetition Mechanism

The `PravdaSystem` class tracks the last 6 headline categories in a
ring buffer (`recentCategories`, max size `maxCategoryMemory = 6`).

When generating an ambient headline:

1. A candidate headline is generated via `generateHeadline()`.
2. If the candidate's category matches both of the last 2 entries in
   `recentCategories`, it is rejected and regenerated.
3. Up to 5 attempts are made before accepting whatever was generated.

```typescript
do {
  generated = generateHeadline(this.gameState);
  attempts++;
} while (
  attempts < 5 &&
  this.recentCategories.length >= 2 &&
  this.recentCategories.slice(-2).every(c => c === generated.category)
);
```

This ensures players do not see three consecutive headlines from the same
category (e.g., three threat headlines in a row), while still allowing
natural clustering.

Additionally, ambient headlines enforce a **45-second cooldown**
(`headlineCooldown = 45000`) between emissions.

---

## Public API

The `PravdaSystem` class is the sole public interface. It receives a
`GameView` (read-only ECS snapshot) each tick and is called by
`SimulationEngine` and `EventSystem`.

### Constructor

```typescript
constructor(rng?: GameRng)
```

### `headlineFromEvent(event: GameEvent): PravdaHeadline`

Generate a headline in response to a game event. May reframe the event entirely
(e.g., a catastrophe becomes an external-threat distraction). Records the
headline in history and returns it immediately.

### `generateAmbientHeadline(): PravdaHeadline | null`

Generate a random headline not tied to a specific event. Returns `null` if
the 45-second cooldown has not elapsed. Applies anti-repetition logic before
recording and returning the headline.

### `getRecentHeadlines(count?: number): PravdaHeadline[]`

Return the last `count` headlines from history (default 10). Used for the
scrolling news ticker UI.

### `formatFrontPage(): string`

Return a formatted multi-line string for the newspaper front page. Shows the
3 most recent headlines prefixed with a star character, with a `PRAVDA | {year}`
masthead. Returns `"PRAVDA: NO NEWS IS GOOD NEWS. ALL NEWS IS GOOD NEWS."` if
there is no headline history.

```
PRAVDA | 1985
★ HEROIC WORKERS EXCEEDED PRODUCTION QUOTA AHEAD OF SCHEDULE
★ CIA OPERATIVES ESPIONAGE RING FOILED BY VIGILANT CITIZENS
★ COMRADE GENERAL SECRETARY BENCH-PRESSES 200 KILOGRAMS
```

---

## Helper Functions

| Function | Description |
|----------|-------------|
| `pick(arr)` | Uniform random selection from a readonly array |
| `randInt(min, max)` | Inclusive random integer in `[min, max]` |
| `coinFlip(p)` | Returns `true` with probability `p` (default 0.5) |
| `fakePercent()` | Absurdly precise fake percentage like `"347.02"` (range 100.00--999.99) |
| `bigNumber()` | Impossibly large production number, locale-formatted |
| `spinKey(key)` | Look up a random spin prefix from `SPIN_PREFIXES[key]` |
| `spinEventEffects(event)` | Convert all resource changes on an event into propaganda subtext |
| `categoryFromEvent(cat)` | Map `EventCategory` to `HeadlineCategory` |

---

## Combinatorial Capacity

The system's unique headline count is driven by combinatorial explosion
across word pools. A single generator like pattern #1 of External Threats
composes 4 independent pools:

```
ENEMY_SUBJECTS (18) x THREAT_OBJECTS (12) x THREAT_VERBS (12) x HERO_SUBJECTS (15)
= 38,880 unique headlines from one generator alone
```

Across all 61 generators (48 generic + 13 contextual), many of which compose
3--6 pools plus runtime-generated numbers (`randInt`, `fakePercent`,
`bigNumber`), the system produces well over **145,000 unique headline
combinations** before accounting for numeric variation, which pushes the
practical count into the millions.
