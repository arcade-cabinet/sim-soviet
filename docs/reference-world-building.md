# World-Building Content -- Reference

Source: `src/content/WorldBuilding.ts`

This document covers the world-building content module for SimSoviet 2000 -- the
narrative, flavor, and satirical text layer that gives the game its voice. Every
string a player reads outside of the core UI (radio chatter, loading screens,
building tooltips, achievements, city names) originates from this file.

**Core creative principle:** External threats are propaganda. The real disruptions
come from within. The state is eternal. There is no win state. There is only the
state.

---

## Table of Contents

1. [Module Overview](#module-overview)
2. [The Eternal Soviet Timeline](#the-eternal-soviet-timeline)
3. [City Naming System](#city-naming-system)
4. [Radio Announcements](#radio-announcements)
5. [Building Flavor Text](#building-flavor-text)
6. [Loading Screen Quotes](#loading-screen-quotes)
7. [Achievement System](#achievement-system)
8. [API Reference](#api-reference)

---

## Module Overview

The module exports:

| Export | Kind | Description |
|---|---|---|
| `ETERNAL_TIMELINE` | `TimelineEvent[]` | 36 alternate-history events (1922--2100) |
| `LEADER_PREFIXES` | `readonly string[]` | 20 leader name prefixes for city generation |
| `IDEOLOGICAL_PREFIXES` | `readonly string[]` | 20 ideological/descriptive prefixes |
| `CITY_SUFFIXES` | `readonly string[]` | 15 geographic suffixes (`-grad`, `-sk`, etc.) |
| `CITY_MODIFIERS` | `readonly string[]` | 11 bureaucratic modifiers |
| `RADIO_ANNOUNCEMENTS` | `RadioAnnouncement[]` | 36 ambient broadcast snippets in 8 categories |
| `BUILDING_FLAVOR` | `Record<string, BuildingFlavorText>` | Flavor text for 17 building types |
| `LOADING_QUOTES` | `string[]` | 42 fake proverbs and wisdom lines |
| `ACHIEVEMENTS` | `Achievement[]` | 31 satirical milestones |
| `generateCityName()` | function | Produces a random city name |
| `renameCityForLeaderChange()` | function | Handles leader-change renaming events |
| `getRandomAnnouncement()` | function | Returns a random radio announcement |
| `getRandomLoadingQuote()` | function | Returns a random loading screen quote |
| `getTimelineEvent()` | function | Looks up a timeline event by year |
| `getBuildingFlavor()` | function | Returns flavor text for a building type |
| `getLockedAchievement()` | function | Returns a random locked, visible achievement |

---

## The Eternal Soviet Timeline

An alternate history spanning 1922 to 2100+. Each `TimelineEvent` has:

- `year` -- the year the event fires
- `headline` -- terse official headline
- `description` -- propaganda-tone narration
- `classified` (optional) -- the hidden truth behind the event

The timeline reinterprets real history through the lens of a USSR that never
fell, then projects into the future.

### Representative Events

| Year | Headline | Highlight |
|------|----------|-----------|
| 1957 | SPUTNIK LAUNCHES | *"The Americans hear it beeping and experience what scientists describe as 'orbital anxiety.'"* Classified: the beeping was an engineer's forgotten timer. |
| 1986 | CHERNOBYL ENERGY INNOVATION | *"Local flora and fauna report 'enhanced vitality.'"* Classified: the deer have extra legs; scientists call this "evolutionary enthusiasm." |
| 1991 | NOTHING HAPPENED | *"Reports of instability are Western fabrication."* Classified: commitment letters arrived pre-dated; one was written on a napkin. |
| 2000 | Y2K: SOVIET COMPUTERS UNAFFECTED | *"Soviet computers were already not functioning, so no change was detected."* Classified: the one working computer in Moscow displayed 1974. It has always displayed 1974. |
| 2075 | IMMORTALITY ACHIEVED (BUREAUCRATICALLY) | Citizens cannot die until their death certificate is processed. Processing time: 400 years. |

---

## City Naming System

Soviet cities were constantly renamed after leaders, then un-named when leaders
fell from favor. The module reproduces this churn.

### Name Components

**Leader prefixes** (20 entries): `Lenin`, `Stalin`, `Khrushchev`, `Brezhnev`,
`Trotsky`, `Dzerzhinsky`, etc.

**Ideological prefixes** (20 entries): `Soviet`, `Komsomol`, `Krasnyi` (Red),
`Pravda` (Truth), `Iskra` (Spark), `Zvezdny` (Star), etc.

**Suffixes** (15 entries): `-grad`, `-sk`, `-opol`, `-burg`, `-abad`,
`-ingrad`, `-omorsk`, etc.

**Modifiers** (11 entries): empty string, `-on-Tundra`, `-on-Steppe`,
`-Below-Permafrost`, `Secret`, `Formerly-Other-Name`, etc.

### Generation Logic

`generateCityName(includeModifier?)` picks a leader prefix (60% chance) or an
ideological prefix (40%), appends a random suffix, and optionally appends a
modifier (30% chance when enabled). Example outputs: `Leningrad`,
`Komsomolsk`, `Brezhnevburg Secret`.

### Renaming Rules

When leadership changes, cities named after the disgraced leader are renamed.
The documented rules:

1. City named after the disgraced leader MUST be renamed immediately.
2. New name uses the current leader's prefix with a randomly chosen suffix.
3. All signs are changed. Citizens pretend it was always this name.
4. Maps reprinted; old maps confiscated.
5. Anyone who uses the old name receives "gentle correction."
6. Renaming costs money and temporarily reduces morale.
7. After 3+ renamings, citizens privately call it "the city."

`renameCityForLeaderChange()` returns a `CityRenaming` object with the old
name, new name, a randomly selected reason, a propaganda announcement, and a
cost (50--149 rubles).

**Sample reason:**
> *"The letters in 'Stalingrad' were found to be arranged in a counter-revolutionary sequence."*

**Sample announcement:**
> *"ATTENTION: Stalingrad no longer exists. Brezhnevsk has always been here. Adjust your maps. Adjust your memories. Carry on."*

---

## Radio Announcements

Ambient broadcast snippets that play during gameplay. Each announcement has a
`text` and a `category`.

### Categories (8)

| Category | Count | Tone |
|---|---|---|
| `morning` | 5 | Wake-up calls, daily emotion assignments, ration notices |
| `shift_change` | 4 | Labor rotation, fatigue denial |
| `weather` | 5 | Perpetual grey, committee-approved forecasts |
| `breaking` | 4 | Non-news, suspicious competence, queue overflow |
| `propaganda` | 5 | State supremacy, emotional compliance |
| `music_intro` | 4 | Anthem loops, approved sounds, enforced consistency |
| `public_service` | 5 | Surveillance normalization, fire drills, neighborly reporting |
| `evening` | 4 | Curfew warnings, approved leisure, sign-off static |

### Highlights

- **Morning:** *"Good morning. Your daily productivity target has been increased by 15%. Your daily caloric intake has been decreased by 15%. These are unrelated."*
- **Weather:** *"Today: grey. Tonight: darker grey. Tomorrow: the same grey, but from a different angle. Extended forecast: grey."*
- **Breaking:** *"Breaking: a building has been completed on schedule. Engineers are being investigated for suspicious competence."*
- **Public Service:** *"Citizens are reminded: the walls have ears. The floors have eyes. The ceiling has opinions. Behave accordingly."*
- **Evening:** *"This is the final broadcast of the day. The static you hear between stations is not loneliness. It is the sound of the State thinking."*

---

## Building Flavor Text

Each of the 17 building types has four flavor strings:

| Phase | When shown |
|---|---|
| `placement` | Building placed on the grid |
| `inspection` | Player inspects the building |
| `decay` | Durability drops low |
| `destruction` | Building bulldozed / purged |

### Building Type Keys

`power`, `housing`, `farm`, `distillery`, `gulag`, `road`, `school`,
`hospital`, `barracks`, `radio_station`, `ministry`, `lenin_statue`,
`cultural_palace`, `factory`, `railway_station`, `bunker`

(16 keys are defined in code; the system supports arbitrary string keys via the
`Record<string, BuildingFlavorText>` type.)

### Highlights

**Vodka Plant (distillery)** -- Placement:
> *"A Vodka Plant opens, answering the question no one asked but everyone was thinking. Production begins immediately. Quality control consists of a single worker who tastes the output and gives a thumbs up. He has not put his thumb down in 14 years."*

**Gulag** -- Inspection:
> *"Capacity: 200. Current occupancy: 347. Inmate satisfaction: not applicable (satisfaction is a privilege, not a right). Rehabilitation rate: 100%. Recidivism rate: also 100%. These numbers are not contradictory. They are dialectical."*

**Road** -- Decay:
> *"The potholes have merged into a single, continuous pothole. Technically, the road is now a canal. Boats have been requisitioned."*

**Ministry Building** -- Destruction:
> *"4,000 tons of paperwork released into the atmosphere. Citizens downwind report paper cuts from breathing. The forms, freed from their cabinets, scatter across the city like bureaucratic confetti."*

**Lenin Statue** -- Decay:
> *"The Lenin Statue is developing a lean. It now points slightly downward, which citizens interpret as Lenin looking at the people he served. Engineers interpret it as a foundation problem. Both interpretations are, technically, correct."*

---

## Loading Screen Quotes

42 fake proverbs and satirical wisdom lines organized into thematic clusters:

| Theme | Count | Flavor |
|---|---|---|
| Work and Labor | 7 | Dignity of starvation, bread-line steel |
| The State and Party | 8 | The Plan watches, committees form sub-committees |
| Truth and Information | 6 | Pravda puns, editable history, detained information |
| Happiness and Morale | 5 | Warm potato, investigated smiling |
| Wisdom and Proverbs | 8 | Subverted folk sayings, turnip lemonade |
| Existential | 6 | Scheduled suffering, being a good number |

### Highlights

- *"In Soviet Union, the future is certain. It is the past that keeps changing."*
- *"There is no truth. There is only Pravda."*
- *"Happiness is a warm potato. Sadness is: no potato."*
- *"Give a man a fish and he eats for a day. Teach a man to fish and he will be reassigned to the fishing collective."*
- *"We pretend to work, they pretend to pay us. Nobody is pretending. This is real. All of it."*

---

## Achievement System

31 satirical milestones. Each `Achievement` has:

- `id` -- programmatic key
- `name` -- displayed title (often a mock medal or bureaucratic designation)
- `description` -- what the player did
- `subtext` -- the grimmer truth behind the achievement
- `hidden` -- whether the achievement is invisible until unlocked

### Hidden Achievements (5)

| ID | Name | Trigger |
|---|---|---|
| `zero_pop` | Urban Planning Complete | Reach 0 population |
| `year_2100` | The Eternal State | Reach the year 2100 |
| `no_buildings_high_pop` | Nomadic Socialism | 50+ population, 0 buildings |
| `play_five_hours` | There Is No Escape | Play for five continuous hours |
| `only_gulags` | Archipelago | Build a city with only Gulags |

### Visible Achievement Highlights

| ID | Name | Description | Subtext |
|---|---|---|---|
| `collapse_no_witness` | Nothing To See Here | Have a building collapse with 0 witnesses | *"If a building falls and no one is around, did the State fail? No. The State never fails."* |
| `propaganda_win` | Ministry of Truth Employee of the Month | Pravda reports 10 positive headlines while all indicators are negative | *"The news has never been better. Reality has never been worse. These are different departments."* |
| `vodka_economy` | Liquid Currency | Have more vodka than rubles | *"In practice, the vodka IS the currency. The ruble is just a receipt."* |
| `reelected` | Unanimous Approval | Win re-election with 100%+ of the vote | *"The people have spoken. The people were given one option. The people are wise."* |
| `perfect_quota` | Exactly As Planned | Complete a quota at exactly 100% | *"Not 99%. Not 101%. Exactly 100%. The Plan is perfect. You are perfect. Do not get used to this."* |

---

## API Reference

### `getRandomAnnouncement(category?: RadioCategory): RadioAnnouncement`

Returns a random radio announcement. If `category` is provided, filters to that
category first; falls back to the full list if the category has no entries.

```ts
const morning = getRandomAnnouncement('morning');
// { text: "Good morning, workers. Today's mandatory emotion is: grateful.", category: 'morning' }

const any = getRandomAnnouncement();
// Random from all 36 announcements
```

### `getRandomLoadingQuote(): string`

Returns a random loading screen quote from the pool of 42 entries.

```ts
const quote = getRandomLoadingQuote();
// "There is no truth. There is only Pravda."
```

### `getTimelineEvent(year: number): TimelineEvent | null`

Looks up a timeline event by exact year. Returns `null` if no event is defined
for that year.

```ts
const event = getTimelineEvent(1991);
// { year: 1991, headline: 'NOTHING HAPPENED', description: '...', classified: '...' }

const missing = getTimelineEvent(1990);
// null
```

### `getBuildingFlavor(type: string): BuildingFlavorText | null`

Returns the four-phase flavor text for a building type key. Returns `null` for
unrecognized keys.

```ts
const flavor = getBuildingFlavor('gulag');
// { placement: '...', inspection: '...', decay: '...', destruction: '...' }

const unknown = getBuildingFlavor('casino');
// null
```

### `getLockedAchievement(unlockedIds: Set<string>): Achievement | null`

Returns a random achievement that is (a) not in the provided set of unlocked IDs
and (b) not hidden. Returns `null` when all visible achievements are unlocked.

```ts
const next = getLockedAchievement(new Set(['first_building', 'late_quota']));
// A random visible achievement other than 'first_building' or 'late_quota'
```

### `generateCityName(includeModifier?: boolean): string`

Produces a random city name. With `includeModifier = true`, there is a 30%
chance a bureaucratic modifier is appended.

```ts
generateCityName();        // "Leningrad"
generateCityName(true);    // "Komsomolsk -on-Tundra"
```

### `renameCityForLeaderChange(currentName: string, disgraced: string, newLeader: string): CityRenaming`

Generates a full renaming event when leadership changes. Returns:

```ts
interface CityRenaming {
  oldName: string;        // The current name being replaced
  newName: string;        // New leader prefix + random suffix
  reason: string;         // Satirical justification
  announcement: string;   // Propaganda broadcast text
  cost: number;           // 50-149 rubles
}
```

```ts
const rename = renameCityForLeaderChange('Stalingrad', 'Stalin', 'Khrushchev');
// {
//   oldName: 'Stalingrad',
//   newName: 'Khrushchevsk',
//   reason: 'The letters in "Stalingrad" were found to be arranged in a counter-revolutionary sequence.',
//   announcement: 'ATTENTION: Stalingrad no longer exists. Khrushchevsk has always been here...',
//   cost: 87
// }
```
