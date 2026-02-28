# Procedural Name Generator -- Reference

> Source: `src/ai/NameGenerator.ts`
>
> Generates unlimited unique Soviet leader identities for SimSoviet 1917's
> Politburo, KGB, ministries, and local government organs.

---

## Russian Naming System

Every Russian has three name components:

| Component      | Russian term | Description                                |
|----------------|--------------|--------------------------------------------|
| Given name     | *imia*       | Personal first name (e.g. Ivan, Svetlana)  |
| Patronymic     | *otchestvo*  | Derived from the father's given name       |
| Surname        | *familiia*   | Family name, often gender-inflected        |

Formal address uses all three in **surname-first** order:

```
Ivanov Ivan Ivanovich          (Russian / formal order)
Ivan Ivanovich Ivanov          (Western order)
I.I. Ivanov                    (Short form)
```

---

## Data Pool Sizes

| Pool                       | Count |
|----------------------------|------:|
| Male given names           |    81 |
| Female given names         |    40 |
| Patronymic father names    |    82 |
| Irregular patronymic forms |    25 |
| Surname entries            |   173 |
| -- with gender forms       |   130 |
| -- gender-invariant        |    43 |
| Title categories           |     6 |
| Titles (total)             |    85 |
| -- party                   |    14 |
| -- state                   |    14 |
| -- security                |    12 |
| -- military                |    10 |
| -- ministry                |    23 |
| -- local                   |    12 |
| Epithets                   |    80 |
| City names                 |    40 |

---

## Patronymic Generation Rules

Patronymics are generated from a father's given name using two mechanisms
evaluated in order.

### 1. Irregular lookup (25 entries)

A hard-coded map of father names to pre-formed male and female patronymics.
These override the algorithmic rules whenever a match is found.

Examples:

| Father name | Male patronymic  | Female patronymic |
|-------------|------------------|-------------------|
| Ilya        | Ilyich           | Ilyinichna        |
| Lev         | Lvovich          | Lvovna            |
| Pavel       | Pavlovich        | Pavlovna          |
| Yakov       | Yakovlevich      | Yakovlevna        |
| Sergei      | Sergeevich       | Sergeevna         |
| Vasili      | Vasilievich      | Vasilievna        |

### 2. Algorithmic fallback

If the father's name is not in the irregular map, suffixes are selected by
inspecting the name's ending characters:

| Ending pattern                | Male suffix | Female suffix | Example                       |
|-------------------------------|-------------|---------------|-------------------------------|
| `-ii` or `-iy`               | `-ievich`   | `-ievna`      | Lavrentii -> Lavrentievich    |
| `-i` (single)                | `-ievich`   | `-ievna`      | Anatoli -> Anatolievich       |
| `-a`                         | `-ovich`    | `-ovna`       | Mykola -> Mykolovich          |
| `-ei`                        | `-eevich`   | `-eevna`      | (fallback if not irregular)   |
| consonant (default)          | `-ovich`    | `-ovna`       | Ivan -> Ivanovich / Ivanovna  |

The suffix is appended after stripping the matched ending characters from the
father's name to form the stem.

---

## Gender-Aware Surname Handling

Surnames are stored as `{ male, female }` pairs. At generation time, the
correct form is selected based on the leader's gender.

### Standard Russian surnames

Most Russian surnames ending in `-ov`, `-ev`, `-in`, `-yn`, `-ski`, or `-ny`
have a distinct female form created by appending `-a` (or `-aya` for
adjective-form surnames):

| Male form      | Female form       |
|----------------|-------------------|
| Ivanov         | Ivanova           |
| Medvedev       | Medvedeva         |
| Nikitin        | Nikitina          |
| Dzerzhinski    | Dzerzhinskaya     |
| Podgorny       | Podgornaya        |

### Invariant surnames (female = null)

Several ethnic surname families do not change by gender. When `female` is
`null` in the data, the male form is used for both genders.

| Origin         | Pattern                  | Example           |
|----------------|--------------------------|-------------------|
| Georgian       | `-shvili`, `-dze`, `-ia`, `-eli`, `-ani` | Dzhugashvili, Shevardnadze, Beria, Tsereteli, Kipiani |
| Ukrainian      | `-enko`, `-chuk`, `-ko`  | Kravchenko, Polishchuk, Boyko |
| Armenian       | `-yan`                   | Petrosyan, Grigoryan, Sargsyan |
| Belarusian     | `-evich`                 | Lukashevich       |
| Baltic         | various                  | Voss, Pelsche, Snieckus |
| Russian (rare) | `-ovich`, `-yan`         | Kaganovich, Mikoyan |

The `getSurname(index, gender)` helper encapsulates this logic:

```ts
function getSurname(index: number, gender: 'male' | 'female'): string {
  const entry = SURNAMES_RAW[index % SURNAMES_RAW.length];
  if (gender === 'female') {
    return entry.female ?? entry.male;  // fallback to male form
  }
  return entry.male;
}
```

---

## Title Categories

Titles contain a `{CITY}` placeholder that is replaced at generation time with
the generator's current city name (drawn from the 40-entry `CITY_NAMES` pool
or set explicitly).

### party (14 titles)

Central Committee roles, Politburo membership, oblast and city party
secretaries, agitation and propaganda departments.

### state (14 titles)

Supreme Soviet, Council of Ministers, Gosplan, Gossnab, Gosstandart, state
committees, Procurator General, Supreme Court.

### security (12 titles)

KGB chairman and directorates (foreign intelligence, counterintelligence,
ideological counterintelligence, surveillance, protection of leaders), MVD,
GULAG, regional KGB.

### military (10 titles)

Minister of Defense, General Staff, branch commanders (ground forces, air
force, navy, strategic rockets), military district commanders, Marshal of the
Soviet Union, GRU.

### ministry (23 titles)

Individual ministries covering agriculture, heavy/light/food industry, culture,
education, health, foreign affairs, finance, communications, transport,
coal, petroleum, metallurgy, chemicals, machine building, electronics,
aviation, nuclear weapons (Medium Machine Building), fish industry,
procurement, and land reclamation.

### local (12 titles)

City Soviet chairman, oblast executive committee, Komsomol, collective farm
director, factory directors, cultural palace, chief architect, trade union
council, bread factory, housing committee, vodka distillery, and chief
sanitary inspector.

---

## Epithet System

Each generated leader receives a satirical epithet (nickname). The 80 epithets
are organized into thematic groups:

| Group                    | Count | Examples                                             |
|--------------------------|------:|------------------------------------------------------|
| Historical references    |     9 | The Corn Enthusiast, The Man of Steel, The Iron Felix |
| Personality / appearance |    14 | The Invisible, The Eyebrow, The Nodder, The Fist     |
| Bureaucratic / political |    15 | The Rubber Stamp, The Five-Year Planner, The Dialectician |
| Competence (satirical)   |    12 | The Adequate, The Punctual, The Mostly Harmless      |
| Ideological              |     8 | The True Believer, The Revisionist Hunter             |
| Food / resource themed   |     8 | The Potato Counter, The Vodka Commissar, The Beet Baron |
| Infrastructure themed    |     6 | The Concrete Poet, The Pipeline Dreamer, The Electrifier |
| Paranoia / KGB themed    |     8 | The All-Seeing, The Night Visitor, The Unperson Maker |

---

## API Reference

### Constructor

```ts
const gen = new NameGenerator();            // random city
const gen = new NameGenerator('Leningrad'); // explicit city
```

The city name is used to fill `{CITY}` placeholders in titles.

### generate(options?)

Generate a single unique leader identity.

```ts
gen.generate(): GeneratedLeader
gen.generate({ gender: 'male' }): GeneratedLeader
gen.generate({ titleCategory: 'security' }): GeneratedLeader
gen.generate({ gender: 'female', titleCategory: 'party', epithet: 'The Iron Felix' }): GeneratedLeader
```

**Options:**

| Parameter       | Type                                                        | Default              |
|-----------------|-------------------------------------------------------------|----------------------|
| `gender`        | `'male' \| 'female'`                                       | 85% male / 15% female |
| `titleCategory` | `'party' \| 'state' \| 'security' \| 'military' \| 'ministry' \| 'local'` | random from all |
| `epithet`       | `string`                                                    | random from pool     |

Internally retries up to 100 times to avoid producing a duplicate
(given name + patronymic + surname) within the same session.

**Example:**

```ts
const leader = gen.generate({ titleCategory: 'military' });
console.log(leader.introduction);
// "Commander-in-Chief of the Navy Volkov, "The Concrete Poet""
```

### generateBatch(count, options?)

Generate multiple unique leaders with the same constraints.

```ts
const squad = gen.generateBatch(5, { titleCategory: 'security' });
// -> GeneratedLeader[5], all with security titles
```

### generatePolitburo()

Generate one leader per title category (6 leaders total), keyed by category
name.

```ts
const politburo = gen.generatePolitburo();
// {
//   party:    GeneratedLeader,
//   state:    GeneratedLeader,
//   security: GeneratedLeader,
//   military: GeneratedLeader,
//   ministry: GeneratedLeader,
//   local:    GeneratedLeader,
// }
```

### generateCabinet()

Generate one leader for every ministry title (23 leaders). Each leader
receives a distinct ministry position rather than a random ministry-category
title.

```ts
const cabinet = gen.generateCabinet();
// -> GeneratedLeader[23], one per ministry
```

### reset()

Clear the duplicate-tracking set. Useful between game sessions.

```ts
gen.reset();
```

### generatedCount (getter)

Return the number of unique names produced so far.

```ts
console.log(gen.generatedCount); // 29
```

### setCityName(name)

Update the city used in `{CITY}` title placeholders.

```ts
gen.setCityName('Stalingrad');
```

### Default singleton

A pre-instantiated generator is exported for convenience:

```ts
import { nameGenerator } from './ai/NameGenerator';
const leader = nameGenerator.generate();
```

---

## GeneratedLeader Output Shape

```ts
interface GeneratedLeader {
  givenName:    string;   // "Ivan"
  patronymic:   string;   // "Petrovich"
  surname:      string;   // "Volkov"
  gender:       'male' | 'female';
  formalName:   string;   // "Volkov Ivan Petrovich"   (Russian order)
  westernName:  string;   // "Ivan Petrovich Volkov"   (Western order)
  shortName:    string;   // "I.P. Volkov"             (Initials)
  title:        string;   // "Minister of Heavy Industry"
  epithet:      string;   // "The Concrete Poet"
  introduction: string;   // "Minister of Heavy Industry Volkov, "The Concrete Poet""
}
```

---

## Combinatorial Capacity

| Dimension            |     Pool |
|----------------------|---------:|
| Male given names     |       81 |
| Female given names   |       40 |
| Father names (pat.)  |       82 |
| Surnames             |      173 |
| **Male name combos** | **1,149,066** |
| **Female name combos** | **567,440** |
| **Total name combos** | **1,716,506** |

Multiplying by titles and epithets:

| With titles (x85)        | 145,903,010     |
|--------------------------|----------------:|
| **With epithets (x80)**  | **11,672,240,800** |

Over **11.6 billion** unique leader identities are possible, making
collision within a single game session effectively impossible.
