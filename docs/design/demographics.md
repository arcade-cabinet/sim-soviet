---
title: Demographics & Household System
status: implemented
coverage: 90%
last_updated: 2026-03-01
depends_on: [workers.md, economy.md, eras.md, overview.md, political.md]
implementation:
  - src/ecs/systems/demographicSystem.ts
  - src/ecs/factories/demographics.ts
  - src/game/workers/WorkerSystem.ts
  - src/game/PrivatePlotSystem.ts
  - src/game/LoyaltySystem.ts
  - src/game/TrudodniSystem.ts
tests:
  - __tests__/game/demographicSystem.test.ts
  - __tests__/game/DvorSystem.test.ts
  - __tests__/game/conscriptionMaleFirst.test.ts
  - __tests__/game/EconomicSystems.test.ts
  - __tests__/playthrough/08-save-load-continuity.test.ts
notes: |
  Implemented: dvory, births, deaths, aging, gender retirement (55F/60M),
  era birth rates, pregnancy tracking, working mothers penalty, household
  formation, male-only conscription (18-51), private plots, dvor loyalty,
  trudodni categories, save/load persistence.
  Remaining: disease events, workplace accidents, per-building trudodni
  assignment, chairman election gender probability.
---

# Demographics & Household System

> *"The Soviet state did not see people. It saw households, labor units, and statistics."*

## Overview

Population is not a number. It is a collection of **households (dvory)** containing men, women, children, and elderly — each with different labor capacity, needs, and administrative significance. The game tracks population at the **dvor (household)** level, with individual family members as sub-entities.

This document specifies the demographic model that replaces the simplistic "12 peasants" starting condition with a historically grounded household system.

---

## 1. The Dvor (Household) — Core Administrative Unit

### Historical Basis

The **dvor** (двор, pl. dvory) was the fundamental administrative unit of Russian rural life from tsarist times through the Soviet period. The Soviet state tracked, taxed, and governed through dvory, not individuals. Kolkhoz membership was by household, not by person. Land allotments, labor obligations, private plot rights, and ration entitlements were all calculated per dvor.

### Game Implementation

Each **Dvor** is an ECS entity containing:

```
DvorComponent {
  id: string;                        // Unique household ID
  members: DvorMember[];             // Family members
  headOfHousehold: string;           // Member ID of head
  privateplotSize: number;           // 0.25-0.5 hectares (era-dependent)
  privateLivestock: {                // Private plot animals
    cow: number;                     // Max 1 (Model Charter, 1935)
    pig: number;                     // Max 1-2
    sheep: number;                   // Max 0-10 (regional variation)
    poultry: number;                 // Max 0-20
  };
  joinedTick: number;                // When this dvor joined the collective
  loyaltyToCollective: number;       // 0-100, affects compliance
}
```

Each **DvorMember** tracks:

```
DvorMember {
  id: string;
  name: string;                      // Generated via NameGenerator
  gender: 'male' | 'female';
  age: number;                       // In years (advances per game-year)
  role: MemberRole;                  // See roles below
  laborCapacity: number;             // 0.0-1.0 (age/health dependent)
  trudodniEarned: number;            // Accumulated this year
  health: number;                    // 0-100
  pregnant?: number;                 // Ticks remaining (women only)
}
```

### Member Roles

| Role | Description | Labor Capacity | Notes |
|------|-------------|----------------|-------|
| `head` | Head of household (typically eldest working male) | 1.0 | Administrative representative |
| `spouse` | Spouse of head | 0.8-1.0 | Historical: women did 80%+ of kolkhoz field labor |
| `worker` | Working-age adult (16-60M, 16-55F) | 0.5-1.0 | Based on age curve |
| `elder` | Over working age (60+M, 55+F) | 0.2-0.4 | Light duties, childcare |
| `adolescent` | Age 12-16 | 0.3-0.5 | Light field work, herding |
| `child` | Age 0-12 | 0.0 | Non-productive, consumes food |
| `infant` | Age 0-1 | 0.0 | High mortality risk |

### Labor Capacity by Age (Approximate Curve)

```
Age  0-11: 0.0  (child — non-productive)
Age 12-15: 0.3  (adolescent — light work)
Age 16-20: 0.7  (young adult — learning)
Age 21-45: 1.0  (prime working age)
Age 46-55: 0.8  (declining)
Age 56-65: 0.5  (elder work — women retire 55, men 60 officially)
Age 66+:   0.2  (minimal — garden/childcare only)
```

---

## 2. Starting Settlement Composition

### Historical Basis — 1920s Farming Commune

In the early Soviet period (1917-1929, before mass collectivization), farming collectives formed voluntarily from 5-30 households. The typical early commune or artel consisted of:

- **5-15 households** in the smallest collectives
- **Average dvor size**: 4-6 members (2 adults, 2-4 children/dependents)
- **A chairman (predsedatel)** — elected from among members
- **No political officer initially** — Party cells required minimum 3 Party members, and in 1929 only ~2% of kolkhozy had a party cell
- **No OGPU/NKVD/KGB presence** in small settlements — these operated from the nearest raion (district) center

### Game Starting Composition (Era 1: Revolution, 1922)

The player's settlement begins as a newly formed **artel** (артель) — the intermediate form between commune and kolkhoz. Starting composition:

**10 Households (Dvory), ~55 people total:**

| Dvor | Head | Composition | Total |
|------|------|-------------|-------|
| Dvor 1 | Pyotr Kuznetsov, 35 | Wife Olga (32), Son Kolya (14), Daughter Masha (10), Son Sasha (6) | 5 |
| Dvor 2 | Ivan Volkov, 42 | Wife Yelena (38), Mother Marfa (63), Son Dmitri (17), Daughter Dasha (15) | 5 |
| Dvor 3 | Maria Petrova, 28 | Widow (Civil War). Son Nikolai (8), Daughter Tanya (4), Brother Alexei (22) | 4 |
| Dvor 4 | Stepan Sorokin, 50 | Wife Nadezhda (45), Son Andrei (20), Daughter-in-law Vera (19), Grandson (infant) | 5 |
| Dvor 5 | Grigory Fedorov, 38 | Wife Lyudmila (34), Son Pavel (12), Daughter Katya (9), Son Vasya (3) | 5 |
| Dvor 6 | Timofey Zakharov, 55 | Wife Praskovya (52), Daughter Anna (16), Son Semyon (14) | 4 |
| Dvor 7 | Yefim Morozov, 30 | Wife Tatiana (26), Son Ilya (4), Daughter Sonya (1) | 4 |
| Dvor 8 | Prokhor Lebedev, 44 | Wife Darya (40), Son Fyodor (18), Son Grigory (15), Daughter Zina (11) | 5 |
| Dvor 9 | Akulina Sidorova, 60 | Widow. Son Mikhail (25), Daughter-in-law Polina (22), Grandchild (2) | 4 |
| Dvor 10 | Nikita Belov, 33 | Wife Galina (28), Son Petya (7), Daughter Lida (5), infant (0) | 5 |

**Plus 1 assigned official (Dvor 11):**

| Role | Details |
|------|---------|
| **Chairman (predsedatel)** | Comrade Orlov, 34. Appointed by raion committee. Party member. Unmarried. Acts as administrative head and de facto political minder. |

**Total: ~56 people (11 dvory including chairman)**

### Key Starting Demographics

- **Working-age adults** (16-60M, 16-55F): ~25
- **Adolescents** (12-16, can do light work): ~6
- **Children** (0-12, non-productive): ~18
- **Elderly** (55+F, 60+M): ~4
- **Infants** (0-1, high mortality risk): ~3
- **Effective labor units**: ~22-24 (considering age/gender labor capacity curves)

### Why This Composition

1. **Historically accurate**: Early voluntary collectives were 10-20 households. Research: average rural family 5.6 people, voluntary collectives 8-20 households. 10 dvory with ~55 people is the lower-middle range.
2. **Autonomous workers make this manageable**: The collective self-organizes (see overview.md §Autonomous Collective System). The player doesn't micromanage 55 people — they set priorities and navigate politics. Focusing on one individual would be a fatal gameplay flaw — the game is about the collective, not individuals.
3. **The state sees statistics, not people**: Stakhanovites set bad examples for everyone. You'll leverage the black market, bribery, and outright BS with resource quotas more than you'll ever have an effective population. The demographic system models the *aggregate* — births, deaths, labor capacity — while the player's real gameplay is political survival.
4. **Family creates moral weight at scale**: With 55 people across 10 families, conscription means choosing whose father doesn't come home. These aren't abstract numbers — they're the Kuznetsovs, the Volkovs, the Petrovs.
5. **Gender reality**: 3 of 10 households are effectively female-headed (Dvor 3: war widow, Dvor 9: elderly widow, Dvor 6: husband nearing elder age). Women do the majority of field labor.
6. **The chairman**: Not a friendly guide. A Party appointee who reports to the raion. His loyalty is to the Party, not to you.

### Difficulty Scaling

| Difficulty | Starting Dvory | Approx. People | Working Adults | Starting Chairman |
|------------|---------------|-----------------|----------------|-------------------|
| Worker (easy) | 12 dvory | ~65 people | ~30 | Sympathetic — shares blat |
| Comrade (normal) | 10 dvory | ~55 people | ~25 | Neutral — follows orders |
| Tovarish (hard) | 7 dvory | ~40 people | ~18 | Hostile — seeks infractions |

---

## 3. Political Officers & State Presence

### Historical Progression

| Era | State Presence | Trigger |
|-----|---------------|---------|
| 1 Revolution (1917-1929) | Chairman only. No party cell (too few members). | Start |
| 2 First Plans (1929-1941) | Chairman + Party cell (min 3 Party members). Politruk assigned. MTS political department monitors. | Pop > 30 OR forced collectivization event |
| 3 Great Patriotic (1941-1945) | Military recruitment officer added. Politruk mandatory. | Wartime |
| 4 Reconstruction (1945-1953) | NKVD/MGB presence increases. Politruk + party secretary. | Pop > 50 |
| 5 Thaw (1953-1964) | Oversight loosens slightly. Politruk remains but less power. | Era transition |
| 6 Stagnation (1964-1985) | Full bureaucratic apparatus. Party secretary, trade union, Komsomol. | Pop > 100 |
| 7 Perestroika (1985-1991) | Officials become less effective. Corruption increases. | Era transition |
| 8 Eternal Soviet (2000+) | Satirical maximum bureaucracy. | Fantasy |

### Party Cell Formation

A **primary party organization (PPO)** requires minimum 3 Party members. In the early game, the chairman may be the only Party member. As the settlement grows, Party members arrive via:

1. **Moscow assignments**: State sends 2-3 Party cadres when settlement reaches posyolok tier
2. **Komsomol graduation**: Young workers may join the Party
3. **Random events**: "A Party organizer has arrived from the raion center"

Once 3+ Party members exist, a **party cell** forms and a **politruk** is assigned. This is a PERMANENT change — you cannot get rid of them.

---

## 4. Population Dynamics

### Birth Mechanics

- **Fertility**: Women aged 16-45, only if part of a dvor
- **Probability per year**: Base 15% per eligible woman (historically ~40 births per 1000 population in 1920s Russia)
- **Modifiers**: Housing quality (+/-), food availability (+/-), morale (+/-), era (Revolution 1.5x, Stagnation 0.6x)
- **Pregnancy duration**: 3 in-game months (90 ticks)
- **Result**: New infant member added to mother's dvor
- **Infant mortality**: 15% in first year (historically ~25% in 1920s rural Russia, reduced for gameplay)

### Death Mechanics

- **Natural death**: Age-based probability curve. Increases sharply after 55.
- **Starvation**: Food=0 for 10+ ticks → weakest member dies
- **Disease**: Random events, worse in winter, worse with overcrowding
- **Workplace accidents**: Production buildings have small accident risk
- **Political**: KGB investigations, purges, military conscription (see political.md)

### Age Progression

- Children age each game-year (360 ticks)
- At 12: become adolescent (light labor)
- At 16: become full worker (assigned to labor)
- At 55 (women) / 60 (men): transition to elder role
- Elders contribute reduced labor but help with childcare (reduces penalty on working mothers)

### Household Formation

- When 2 unrelated working-age adults of opposite gender exist without a household, they may form a new dvor (event: "A new family has formed in the settlement")
- This creates a new administrative unit with its own private plot rights
- Settlement tier may limit new dvor formation (housing required)

---

## 5. Trudodni by Demographic Category

### Historical Basis

The trudodni system (1930-1966) valued different types of work on a 7-9 category scale. Work norms ranged from 0.5 trudodni for the lightest tasks to 2.5-4.5 for the most skilled.

### Game Categories

| Category | Trudodni/Day | Examples | Who Can Do It |
|----------|-------------|----------|---------------|
| 1 (lightest) | 0.5 | Night watch, simple sorting, sweeping | Elders, adolescents |
| 2 | 0.75 | Poultry care, garden weeding, water carrying | Women, adolescents |
| 3 (standard) | 1.0 | Field work, sowing, harvesting by hand | Any adult worker |
| 4 | 1.25 | Milking, livestock care, construction labor | Trained workers |
| 5 | 1.5 | Plowing with horse, threshing, carpentry | Skilled workers |
| 6 | 2.0 | Blacksmithing, equipment repair, accounting | Specialists |
| 7 (skilled) | 2.5 | Tractor operation, veterinary work, machinery | Engineers, specialists |

### Minimum Annual Trudodni Requirements

| Era | Required Min. Trudodni/Year | Penalty for Shortfall |
|-----|---------------------------|----------------------|
| Revolution (pre-1930) | No formal system — communal labor | Social pressure only |
| First Plans (1930-1941) | 60-100 (regional variation) | Loss of private plot |
| Great Patriotic (1942-1945) | 100-150 (wartime increase) | Criminal prosecution |
| Reconstruction-Stagnation | 100-120 | Reduced ration tier |
| Perestroika+ | System dissolving | Nominal enforcement |

---

## 6. Gender in the Collective

### Historical Reality

Soviet propaganda proclaimed gender equality, but the reality in kolkhozes was deeply gendered:

- **Women performed 60-80% of manual field labor** (especially after male losses in Civil War and WWII)
- **Women were rarely elected chairman** (< 2% of kolkhoz chairs were women)
- **Women received fewer trudodni** because they were assigned to lighter-valued work categories
- **Childcare was women's responsibility** — no formal childcare in early kolkhozes
- **Military conscription**: Men only (10-40% during wartime)
- **The "double burden"**: Women worked in fields AND managed household/children
- **Domestic work NOT counted as trudodni** — cooking, cleaning, childcare earned zero credit

### Era-by-Era Gender Role Progression

| Era | Period | Male % of Rural Pop | Women's Agricultural Role | Leadership Access | Key Driver |
|-----|--------|---------------------|--------------------------|-------------------|------------|
| 1 Revolution | 1917-1929 | ~40-45% (post-Civil War losses) | Traditional: field labor, livestock, garden plots. Excluded from *skhod* (village assembly). | Near-zero. Chairman always male. Women not counted as household heads. | Civil War killed ~10M men; women filled gaps by necessity, not policy |
| 2 First Plans | 1929-1941 | ~35-40% (urban migration of young men) | Rapid feminization of agriculture. Women became 60%+ of kolkhoz field labor. ~10% of tractor drivers by 1933. Assigned to lower-valued trudodni categories (weeding, milking, poultry). | Rare. A few women brigadiers. <2% of chairmen. Pasha Angelina (1938) became propaganda icon for women tractor drivers. | Collectivization + industrialization pulled men to cities. Women's trudodni minimums were lower (250 vs 300). |
| 3 Great Patriotic | 1941-1945 | **7% by 1944** | Near-total feminization. Women harnessed themselves to plows in groups of 6. Operated remaining tractors. Performed ALL agricultural work — plowing, sowing, threshing, carting. | Significant increase. Women became brigadiers, team leaders, some chairmen. Still <5% of chairmen nationally. | 27M Soviet deaths (mostly male). Conscription stripped villages of nearly all men 18-55. |
| 4 Reconstruction | 1945-1953 | ~15-20% (slow male return, many disabled) | Women remained dominant agricultural force. Demobilized men often disabled or sent to industrial jobs. Women still 70%+ of kolkhoz labor. | Slowly reverts. Returning men resume leadership. Women pushed back to lower-valued work categories. | Stalinist restoration of "traditional" gender roles despite demographic reality. Women expected to maintain "double burden." |
| 5 Thaw | 1953-1964 | ~25-30% | Women ~55-60% of agricultural workforce. Mechanization begins to reduce some manual labor. In 1959, half of all working women were still in agriculture. | Slightly improving. Khrushchev era rhetoric about women's rights. Some kolkhozes elect women to boards. | Post-Stalin liberalization. Internal passport reform (1953) lets some rural women migrate to cities for first time. |
| 6 Stagnation | 1964-1985 | ~30-35% | Women still ~50% of agricultural labor. By 1975, under 1/3 of women worked in agriculture (urbanization). Mechanization reduced demand for manual field labor. | Formal equality, practical inequality. Women 49% of total Soviet workforce by 1970s but concentrated in lower-paid sectors. | Urban migration accelerates. Young women leave villages for education/factory work. Rural demographics aging. |
| 7 Perestroika | 1985-1991 | ~30-35% | Declining agricultural workforce overall. Women increasingly in service/industrial sectors. Rural agriculture aging and depopulating. | Some glasnost-era discussion of gender inequality. No structural change. | Economic crisis. Agricultural sector in decline. |
| 8 Eternal Soviet | 2000+ | Fantasy | Satirical: bureaucratic gender quotas exist on paper, reality unchanged. | Fantasy: mandatory "gender equality reports" that no one reads. | Dark humor: the paperwork says equality, the kolkhoz says otherwise. |

### The "Double Burden" Across All Eras

Throughout the Soviet period, women bore the **двойная нагрузка** (double burden):
1. **Formal labor**: field work, factory work, or office work (counted as trudodni)
2. **Domestic labor**: cooking, cleaning, childcare, water carrying, private plot tending (NOT counted)

Studies showed Soviet women spent **3× more time on housework than men** in every era. This means a female worker with labor capacity 1.0 in the game actually represents someone doing 1.5-2× the total work of a male counterpart — her trudodni just don't reflect it.

### Trudodni Gender Disparity

| Gender | Typical Assignments | Trudodni Category | Annual Minimum |
|--------|--------------------|--------------------|----------------|
| Men | Plowing, carting, machinery, carpentry, smithing | Categories 5-7 (1.5-2.5/day) | 300-370 |
| Women | Weeding, milking, poultry, sowing, harvesting roots | Categories 1-4 (0.5-1.25/day) | 200-300 |
| Women with small children | Same as women, reduced hours | Categories 1-3 (0.5-1.0/day) | 200 |
| Adolescent boys (12-16) | Herding, water carrying, messenger | Categories 1-2 (0.5-0.75/day) | 50-60 |

### Game Implementation

- Gender affects available labor assignments (historical accuracy, not fairness)
- Military conscription targets male workers only
- Working mothers with infants/toddlers have reduced labor capacity (-30%) unless elder available for childcare
- Women can be elected chairman (rare event, probability increases with era: 0% Era 1-2, 2% Era 3-4, 5% Era 5+)
- Propaganda events may grant "equality bonuses" that don't match reality (dark humor)
- **Era 3 (Great Patriotic)**: massive conscription event strips nearly all male workers; gameplay forces player to rely entirely on female labor — this is the historical reality, not a game mechanic
- Women assigned to lower trudodni categories by default; player can override (costs political standing in early eras)
- Domestic labor invisible in UI but affects food consumption, child mortality, dvor stability

---

## 7. Three Types of Collective (Era 1 Choice)

### Historical Distinction

The player starts an artel by default, but could potentially choose:

| Type | Property Shared | Private Retained | Compensation | Game Impact |
|------|----------------|-----------------|--------------|-------------|
| **Commune** (коммуна) | Everything — land, tools, livestock, housing | Nothing | Equal distribution | Highest morale risk, highest efficiency if stable |
| **Artel** (артель) | Land, major tools, draft animals | House, garden plot, 1 cow, small livestock, poultry | By trudodni | Default. Balanced. Historical norm after 1930. |
| **TOZ** (ТОЗ) | Only land (for joint cultivation) | Everything else | By land contribution | Least disruption, lowest collective efficiency |

The **artel** became the legally mandated form in 1930 (Model Charter). The game starts as an artel. The commune and TOZ may appear as event choices or era-specific options.

---

## 8. Integration with Existing Systems

### ECS Changes Required

1. **New component**: `DvorComponent` on entity type
2. **Modify `CitizenComponent`**: Add `dvorId`, `gender`, `age`, `memberRole`
3. **New archetype**: `dvory` = `world.with('dvor')`
4. **Population system**: Rewrite to operate on dvory, not raw citizen count
5. **Housing**: Tracked per dvor (1 dwelling = 1 dvor capacity)
6. **Ration system**: Distribute per dvor, with category per member role

### SimulationEngine Tick Changes

- `populationSystem` → operates on dvory: births, deaths, aging, household formation
- `consumptionSystem` → per-dvor food distribution
- `productionSystem` → labor from working-age members only
- New: `demographicEventSystem` → births, deaths, marriages, conscription

### UI Changes

- Population display: "10 Dvory (55 people: 28 workers, 6 adolescents, 12 children, 9 elders)"
- Building inspector: show assigned workers by name, with dvor affiliation
- Dvor info panel: tap household → see all members, private plot, trudodni earned

---

## 9. Research Sources

### Demographics & Household System
- [Kolkhoz — Wikipedia](https://en.wikipedia.org/wiki/Kolkhoz)
- [Kolkhoz — Grokipedia](https://grokipedia.com/page/Kolkhoz)
- [Kolkhoz — Britannica](https://www.britannica.com/topic/kolkhoz)
- [Collective farm — Encyclopedia of Ukraine](https://www.encyclopediaofukraine.com/display.asp?linkpath=pages%5CC%5CO%5CCollectivefarm.htm)
- [Collectivization in the Soviet Union — Wikipedia](https://en.wikipedia.org/wiki/Collectivization_in_the_Soviet_Union)
- [Demographics of the Soviet Union — Wikipedia](https://en.wikipedia.org/wiki/Demographics_of_the_Soviet_Union)
- [1926 Soviet Census — Wikipedia](https://en.wikipedia.org/wiki/1926_Soviet_census)
- [Obshchina — Wikipedia](https://en.wikipedia.org/wiki/Obshchina)
- [Izba — Wikipedia](https://en.wikipedia.org/wiki/Izba)

### Trudodni & Labor System
- [Trudoden — Wikipedia](https://en.wikipedia.org/wiki/Trudoden)
- [Workday — Encyclopedia of Ukraine](https://www.encyclopediaofukraine.com/display.asp?linkpath=pages%5CW%5CO%5CWorkday.htm)
- [Tony Cliff — Russia: A Marxist Analysis (Ch. 11)](https://www.marxists.org/archive/cliff/works/1964/russia/ch11-s2.htm)
- [The Child Under Soviet Law — UChicago Law Review](https://chicagounbound.uchicago.edu/cgi/viewcontent.cgi?article=1567&context=uclrev)

### Political Structure
- [Kolkhoz Statute (1935) — Seventeen Moments in Soviet History](https://soviethistory.msu.edu/1936-2/second-kolkhoz-charter/second-kolkhoz-charter-texts/kolkhoz-statute/)
- [Primary Party Organization — Encyclopedia.com](https://www.encyclopedia.com/history/encyclopedias-almanacs-transcripts-and-maps/primary-party-organization)
- [The Rural Communist Party Cell 1929-32 — SpringerLink](https://link.springer.com/chapter/10.1007/978-1-349-19111-6_6)
- [Joint State Political Directorate (OGPU) — Wikipedia](https://en.wikipedia.org/wiki/Joint_State_Political_Directorate)
- [Organization of the CPSU — Wikipedia](https://en.wikipedia.org/wiki/Organization_of_the_Communist_Party_of_the_Soviet_Union)

### Gender Roles & Women's Labor
- [Women, Work and Domestic Labour in the Soviet Union — Sheffield Gender History Journal](https://sheffieldgenderhistory.hcommons.org/?p=83)
- [Women's Work and Emancipation in the Soviet Union, 1941-50 — SpringerLink](https://link.springer.com/chapter/10.1057/9780230523425_12)
- [Collective Farm Women of Tataria — Seventeen Moments in Soviet History](https://soviethistory.msu.edu/1936-2/creation-of-the-ethnic-republics/creation-of-the-ethnic-republics-texts/collective-farm-women-of-tataria/)
- [Praskovya (Pasha) Angelina — Wikipedia](https://en.wikipedia.org/wiki/Pasha_Angelina)
- [Women in the Work Force — Seventeen Moments in Soviet History](https://soviethistory.msu.edu/1980-2/moscow-doesnt-believe-in-tears/moscow-doesnt-believe-in-tears-texts/women-in-the-work-force/)
- [M. Pichugina — Women in the U.S.S.R](https://www.marxists.org/subject/women/authors/pichugina/women.html)
- [Women in Russia — Wikipedia](https://en.wikipedia.org/wiki/Women_in_Russia)

### Vital Statistics
- [Russia's Demographic Crisis — RAND](https://www.rand.org/pubs/conf_proceedings/CF124.html)
- [Infant Mortality in the Soviet Union — PubMed](https://pubmed.ncbi.nlm.nih.gov/3130941/)

### Agricultural Structure
- [Artel — Wikipedia](https://en.wikipedia.org/wiki/Artel)
- [Brigade (Soviet collective farm) — Wikipedia](https://en.wikipedia.org/wiki/Brigade_(Soviet_collective_farm))
- [Zveno — Wikipedia](https://en.wikipedia.org/wiki/Zveno_(Soviet_collective_farming))
- [Machine-Tractor Station — Britannica](https://www.britannica.com/topic/machine-tractor-station)
- [Household Plot — Wikipedia](https://en.wikipedia.org/wiki/Household_plot)
- [The Structure of the Kolkhoz — SpringerLink](https://link.springer.com/chapter/10.1007/978-1-349-10255-6_4)
