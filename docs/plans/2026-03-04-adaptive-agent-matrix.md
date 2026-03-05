---
type: design
status: draft
---

# Adaptive Agent Matrix: Mechanics Reused Across Worlds

## "Same equations, different constants. Same bureaucracy, different atmospheres."

### Core Insight

Every agent system in SimSoviet already operates on parameterized inputs:
modifiers, multipliers, thresholds, probability tables, seasonal profiles.
The same agents work across all worlds by swapping the **parameter set** --
and in some cases, **reversing the polarity** of what counts as beneficial
vs. destructive.

This document maps every major agent system to every world, identifying:
- Which parameters change
- Which polarities reverse
- Which mechanics gain entirely new meaning
- Where Greg Bear's *Eon* trilogy provides narrative branching

---

## Table of Contents

1. [The Polarity Reversal Concept](#1-the-polarity-reversal-concept)
2. [TerrainProfile Interface](#2-terrainprofile-interface)
3. [Climate / Weather Agent](#3-climate--weather-agent)
4. [Food Agent](#4-food-agent)
5. [Power Agent](#5-power-agent)
6. [Demographics Agent](#6-demographics-agent)
7. [Disasters / Black Swan System](#7-disasters--black-swan-system)
8. [Construction Agent](#8-construction-agent)
9. [Transport System](#9-transport-system)
10. [Decay Agent](#10-decay-agent)
11. [Political Agent](#11-political-agent)
12. [Asteroid Diversion Mechanic](#12-asteroid-diversion-mechanic)
13. [Demographic Evolution Across Gravities](#13-demographic-evolution-across-gravities)
14. [Greg Bear's Eon Trilogy as Branching Source](#14-greg-bears-eon-trilogy-as-branching-source)
15. [Implementation: How TerrainProfile.climatePolarity Works](#15-implementation-how-terrainprofileclimatepolarity-works)
16. [Per-World Summary Matrix](#16-per-world-summary-matrix)

---

## 1. The Polarity Reversal Concept

On Earth, warming is catastrophic. On Mars, warming is survival.

The existing `ClimateEventSystem` evaluates `climateTrend` (-1 to +1) against
event trigger ranges. The system already supports this -- events gate on
`climateTrendRange: { min, max }`. The reversal is:

| Event Type         | Earth Polarity     | Mars Polarity        |
|--------------------|--------------------|----------------------|
| Global warming     | BAD (food, health) | GOOD (terraforming)  |
| Ice age / cooling  | BAD (food, infra)  | BAD (undoes progress)|
| Meteor strike      | DESTRUCTIVE        | CONSTRUCTIVE (ice)   |
| Volcanic eruption  | DESTRUCTIVE        | CONSTRUCTIVE (gas)   |
| Radiation spike    | BAD                | NEUTRAL (no atmo)    |
| Ozone depletion    | BAD (health)       | N/A (no ozone)       |
| Dust storm         | N/A                | BAD (solar panels)   |
| Permafrost thaw    | BAD (infra damage) | GOOD (water access)  |

This is achieved by a single `climatePolarity: 1 | -1` field on the world's
`TerrainProfile`. When polarity is `-1`, warming *reduces* pressure instead
of increasing it. The pressure system doesn't care about interpretation --
it just sees numbers.

---

## 2. TerrainProfile Interface

Each world defines a `TerrainProfile` that parameterizes all agent systems.
This is the single source of truth for world-specific behavior.

```typescript
interface TerrainProfile {
  worldId: string;         // 'earth' | 'moon' | 'mars' | 'venus' | ...

  // ── Climate ──
  climatePolarity: 1 | -1;          // 1 = warming is bad, -1 = warming is good
  baseSurfaceTemp: number;           // Kelvin (Earth: 288, Mars: 210, Venus: 737)
  hasAtmosphere: boolean;            // false for Moon, Belt
  atmosphereDensity: number;         // 0-1 (Earth: 1.0, Mars: 0.006, Venus: 92)
  weatherEnabled: boolean;           // false for Moon, Belt, GenShip
  seasonCount: number;               // Earth: 7, Mars: 4, Moon: 0
  seasonProfiles: SeasonProfile[];   // world-specific season definitions

  // ── Gravity ──
  surfaceGravity: number;            // g (Earth: 1.0, Moon: 0.166, Mars: 0.38)
  gravityBirthPenalty: number;       // 0-1: fertility reduction at low g
  gravityReturnThreshold: number;    // min g to survive return to 1g (0.5 = never)

  // ── Food ──
  soilFarming: boolean;              // true for Earth, false for Moon/Belt
  hydroponicsRequired: boolean;      // true for Moon, Mars (early), Belt
  greenhouseRequired: boolean;       // true for Venus, Titan
  foodProductionBase: number;        // multiplier on FoodAgent output
  privatePlotsAllowed: boolean;      // true only for Earth, Mars (late)

  // ── Power ──
  solarEfficiency: number;           // 0-1 (Earth: 1.0, Mars: 0.43, Jupiter: 0.037)
  windAvailable: boolean;            // requires atmosphere
  nuclearFuelAvailable: boolean;     // uranium deposits on-world
  geothermalAvailable: boolean;      // volcanic activity (Earth, Venus, Titan?)
  fusionRequired: boolean;           // true for outer solar system
  defaultPowerSources: string[];     // starting power building types

  // ── Resources ──
  trackedResources: string[];        // ['food','power'] + world-specific
  oxygenTracked: boolean;            // true off-Earth, true on Earth post-2200
  waterTracked: boolean;             // true off-Earth, true on Earth post-3000
  hydrogenTracked: boolean;          // true for fuel-dependent worlds
  regolithAvailable: boolean;        // Moon, Mars, Belt
  iceAvailable: boolean;             // Mars poles, Ganymede, Ceres, Titan

  // ── Construction ──
  outdoorConstruction: boolean;      // false for airless/toxic worlds
  domeRequired: boolean;             // true off-Earth (except late Mars)
  constructionTimeMult: number;      // multiplier (higher = slower)
  materialSources: string[];         // 'timber' | 'regolith' | 'ice' | 'steel'

  // ── Transport ──
  roadTypes: string[];               // Earth: dirt/gravel/paved; Moon: tracks
  rasputitsaExists: boolean;         // true only for Earth, Mars
  baseTransportScore: number;        // starting infrastructure level

  // ── Disasters ──
  meteorPolarity: 1 | -1;           // 1 = destructive, -1 = constructive
  tectonicActivity: number;          // 0-1 (earthquake frequency)
  radiationLevel: number;            // base radiation (0 = shielded, 1 = lethal)
  dustStormFrequency: number;        // Mars-specific
  volcanoFrequency: number;          // Venus, early Earth, Titan?

  // ── Demographics ──
  maxNaturalLifespan: number;        // modified by radiation, gravity
  fertilityModifier: number;         // multiplier on birth rate
  mortalityModifier: number;         // multiplier on death rate
}
```

---

## 3. Climate / Weather Agent

**Current system**: `WeatherAgent` rolls weather per season using `SEASON_WEATHER`
probability tables. `ClimateEventSystem` evaluates climate events gated on season,
weather type, and climate trend. `EcologicalCollapseSystem` applies long-term
degradation.

### Earth (current)

- 7 seasons (Winter, Rasputitsa Spring/Autumn, Short Summer, Golden Week, Stifling Heat, Early Frost)
- 9 weather types with seasonal probability weights
- Climate trend range: -1 (ice age) to +1 (global warming)
- Warming is BAD: increases food pressure, infrastructure damage, health effects
- Ecological collapse timeline: permafrost thaw (2050) through magnetic field weakening (100,000+)

### Moon

- **No atmosphere** -- no weather system runs
- `weatherEnabled: false`, `seasonCount: 0`
- Temperature: 127C day / -173C night (14-day cycle)
- Day/night cycle replaces seasons: "lunar day" and "lunar night" are the only
  two states, each lasting ~14 Earth days
- Solar flare events replace weather-driven climate events
- No ecological collapse (nothing to collapse)
- Radiation is the constant threat -- solar particle events and galactic cosmic rays

### Mars

- **climatePolarity: -1** (warming is GOOD)
- 4 seasons (Mars year = 687 Earth days): Northern Spring, Northern Summer,
  Northern Autumn, Northern Winter
- Weather: dust storms (global/regional), dust devils, clear, thin overcast
- **RED phase** (early colony): warming is impossible, survival is the challenge.
  Dust storms block solar panels. No outdoor farming.
- **GREEN phase** (terraforming begins): warming becomes the goal. Greenhouse gas
  factories add to atmosphere. Pressure events from *insufficient* warming.
- **BLUE phase** (oceans form): weather system transitions toward Earth-like.
  Rain appears. Seasons gain complexity. Eventually 7-season Earth model applies.
- Dust storm = power crisis (solar panels covered). Frequency: `dustStormFrequency: 0.7`
- Permafrost thaw = GOOD on Mars (water access). Polarity reversed.

### Venus

- **Hostile atmosphere**: 92 bar, 462C surface, sulfuric acid clouds
- Cloud colony (50-65km altitude): temperature ~0-50C, pressure ~0.4-1.0 bar
- Weather: acid rain storms, wind shear, lightning storms, calm periods
- Climate trend: cooling is GOOD (making surface habitable), warming is BAD
  (already too hot). `climatePolarity: 1` but inverted meaning -- the goal is
  atmospheric processing to *reduce* temperature.
- Unique weather types: ACID_RAIN, WIND_SHEAR, LIGHTNING_STORM, CALM, SUPERROTATION
- No ground seasons -- cloud altitude determines "season" (altitude drift up/down)

### Jupiter/Ganymede

- Ganymede surface: -163C, 0.146g, thin O2 exosphere
- No meaningful weather on Ganymede -- all indoor/dome
- `weatherEnabled: false`
- Jupiter's radiation belt is the "weather" -- constant bombardment
- Radiation storms replace weather events: intensity varies with orbital position
- Eclipse by Jupiter affects solar power (but solar is nearly useless at 5.2 AU anyway)
- Tidal heating provides limited geothermal energy

### Belt/Ceres

- Ceres: -106C surface, 0.029g, no atmosphere
- `weatherEnabled: false`
- No climate, no weather, no seasons
- "Environment" is entirely artificial: hab module integrity, spin gravity,
  life support cycling rates
- Environmental threats: micrometeorite impacts, solar flare warnings (still
  relevant at 2.77 AU)

### Titan

- -179C surface, 1.45 bar atmosphere (thicker than Earth!), 0.138g
- **Weather exists**: methane rain, methane lakes, hydrocarbon haze
- Unique seasons (Saturn year = 29.5 Earth years): each Titan season lasts ~7.4 years
- Weather types: METHANE_RAIN, HYDROCARBON_HAZE, CLEAR, NITROGEN_FOG, METHANE_STORM
- Climate polarity: warming is cautiously GOOD (more liquid methane for chemistry),
  but too much warming evaporates the methane lakes
- `climatePolarity: -1` with upper bound -- non-linear

### Generation Ship

- **Fully artificial environment**
- `weatherEnabled: false`, `seasonCount: 0`
- Life support system health replaces weather
- "Climate" = ECLSS (Environmental Control and Life Support System) status
- Events: CO2 scrubber failure, water recycler malfunction, atmospheric leak,
  radiation storm (interstellar medium)
- No ecological collapse timeline -- the ship IS the ecology

### Exoplanet (Variable)

- All parameters procedurally generated from star type, orbital distance, mass
- Could be Earth-like, Mars-like, Venus-like, or entirely alien
- Weather system parameterized from `TerrainProfile` at colony creation
- Potential unique weather: alien atmospheric chemistry, tidal locking effects,
  binary star illumination cycles

---

## 4. Food Agent

**Current system**: `FoodAgent` manages production (farms + private plots),
consumption, and starvation. Four-tier food state machine:
Surplus -> Stable -> Rationing -> Starvation. 90-tick grace period before deaths.

### Earth (current)

- Soil farming from collective farms
- Private plots with era-specific multipliers
- Livestock (cow, pig, sheep, poultry) food bonuses
- Season/weather modifiers on farm output
- Overstaffing diminishing returns
- Grain-to-vodka conversion consumes food

### Moon

- `soilFarming: false`, `hydroponicsRequired: true`
- No private plots (no outdoor space)
- Food sources: hydroponic bays (high power, high yield per area)
- Water must be electrolyzed from regolith ice -- food production
  depends on water supply chain
- `foodProductionBase: 0.3` (expensive, efficient, fragile)
- No livestock (mass constraints). Eventually: insect protein farms
- Starvation grace period reduced (no foraging fallback)

### Mars

- **RED**: Greenhouse hydroponics only. `foodProductionBase: 0.2`
- **GREEN**: Soil farming begins as atmosphere thickens. Private plots
  become possible. `foodProductionBase: 0.4 -> 0.8` over centuries
- **BLUE**: Full Earth-like farming. `foodProductionBase: 0.9`
- Mars soil (regolith) requires processing: perchlorate removal, organic
  matter addition. Farm buildings have a "soil preparation" prerequisite phase.
- Dust storm modifier on greenhouse farming: -30% during global storms
- No livestock until GREEN phase (pressurized barns required)

### Venus

- Cloud colony farming: aeroponics in pressurized pods
- `foodProductionBase: 0.15` (extremely constrained by volume)
- Sulfuric acid contamination risk on food supply
- No soil, no private plots, no livestock
- Food is the perpetual bottleneck -- Venus colonies are always on
  the edge of rationing

### Jupiter/Ganymede

- Deep underground greenhouses (radiation shielded)
- `foodProductionBase: 0.25`
- Ice mining provides water for hydroponics
- Tidal heating powers grow lights (no solar at 5.2 AU)
- Long supply chain from Earth initially, must achieve food independence
- Fish farming possible (Ganymede has abundant water ice)

### Belt/Ceres

- Spin-gravity hydroponics in O'Neill-style cylinders
- `foodProductionBase: 0.3`
- Water from Ceres ice (Ceres is 25% water ice by mass)
- Trade network with other Belt settlements for food variety
- Fungal protein cultures as staple (low light, low space)

### Titan

- `greenhouseRequired: true` (methane atmosphere, -179C)
- Methane lakes as chemical feedstock for synthetic food
- `foodProductionBase: 0.1` (hardest food production in solar system)
- Unique: methane-based chemistry opens non-photosynthetic food paths
- Hydrocarbon processing converts methane to complex organics
- Eventually: genetically engineered organisms that metabolize Titan chemistry

### Generation Ship

- Closed-loop ecology: everything recycled
- `foodProductionBase: 0.5` (optimized but fragile)
- Food diversity decreases over generations (genetic bottleneck in crops)
- Calorie rationing is permanent -- never a surplus state
- Social conflict driven by food allocation fairness
- "Farm decks" are the most politically important buildings

### Exoplanet

- Depends on atmosphere, soil chemistry, star spectrum
- Could range from `foodProductionBase: 0.0` (fully hostile, hydroponics only)
  to `1.2` (alien soil is more fertile than Earth)
- Alien biology interaction: contamination risk vs. edible native organisms
- Discovery mechanic: survey teams determine what's possible

---

## 5. Power Agent

**Current system**: `PowerAgent` distributes power by priority
(farm -> housing -> industry). Shortage triggers unpowered buildings.

### Earth (current)

- Coal plants (early), hydroelectric, nuclear (post-1954)
- Solar weak in Siberian winter but available
- `solarEfficiency: 1.0`
- Priority: farm (food critical) -> housing -> industry

### Moon

- Solar arrays (lunar day only, 14 days on / 14 days off)
- `solarEfficiency: 1.37` (no atmosphere, closer to Sun)
- **Critical problem**: 14-day lunar night requires massive battery banks
  or nuclear backup. Power storage becomes a tracked resource.
- Nuclear (RTGs initially, fission reactors later)
- No wind, no hydro, no geothermal
- Power priority shifts: life support -> food -> housing -> industry

### Mars

- Solar: `solarEfficiency: 0.43` (1.52 AU distance + dust)
- Dust storm modifier: solar drops to near zero during global storms
- Wind turbines possible (thin atmosphere, but high wind speeds)
- Nuclear: uranium available in Martian regolith
- Geothermal: limited volcanic activity
- **RED phase**: nuclear primary, solar supplement
- **GREEN phase**: wind becomes viable as atmosphere thickens
- **BLUE phase**: hydroelectric appears (flowing water!)

### Venus

- No surface solar (clouds block >99%)
- Cloud-top solar: `solarEfficiency: 0.9` at 65km altitude (closer to Sun)
- Wind power: superrotation winds at cloud level (~100 m/s)
- No nuclear fuel readily available (must import)
- `fusionRequired: false` (solar + wind sufficient)

### Jupiter/Ganymede

- Solar practically useless: `solarEfficiency: 0.037`
- Nuclear is the ONLY viable power source initially
- `fusionRequired: true` (for colony scaling)
- Tidal heating geothermal: Ganymede has some tidal flexing from Jupiter
- Jupiter's magnetosphere: potential for electromagnetic power harvesting
  (theoretical, late-game tech)
- Power priority: radiation shielding -> life support -> food -> everything else

### Belt/Ceres

- Solar marginal: `solarEfficiency: 0.13` (2.77 AU)
- Nuclear primary
- Fusion required for industrial scale
- Concentrated solar reflectors (large mirror arrays) boost effective efficiency
- Power traded between Belt settlements via laser power transmission

### Titan

- Solar useless: `solarEfficiency: 0.011` + thick haze
- Wind available (dense atmosphere)
- **Unique**: methane combustion with imported oxygen (chemical power)
- Nuclear primary, wind supplement
- Fusion is the long-term solution
- Hydrocarbon fuel cells (Titan has unlimited hydrocarbon fuel, but needs
  oxidizer imported or manufactured)

### Generation Ship

- Nuclear fusion ONLY (no external energy sources in interstellar space)
- `fusionRequired: true`, all other sources: `false`
- Power is the existential resource -- fusion reactor failure = extinction
- Backup: antimatter catalyzed fission (experimental, late-game tech)
- Power budget is zero-sum: every watt allocated to one system reduces another
- Political conflicts center on power allocation

### Exoplanet

- Solar efficiency depends on star luminosity and distance
- All other sources depend on planetary survey results
- Initial colony: nuclear from ship's reactor
- Transition to local sources as terrain is explored

---

## 6. Demographics Agent

**Current system**: `DemographicAgent` handles aging, births, deaths,
household formation. Dual mode: entity (< 200) and aggregate (>= 200).
Age-bracket mortality, era-specific birth rates, starvation modifier,
gender-specific retirement ages.

### Earth (current)

- `surfaceGravity: 1.0`, `fertilityModifier: 1.0`, `mortalityModifier: 1.0`
- Full dvor (household) system with Russian naming
- Conscription: male-first, ages 18-51
- Working mother penalty (30% labor reduction with young children)
- Private plots contribute food based on household labor

### Moon

- `surfaceGravity: 0.166g`
- `gravityBirthPenalty: 0.3` (70% reduction in natural fertility)
- Children born on Moon can NEVER return to Earth (bone density)
- `gravityReturnThreshold: 0.5` -- anyone born below 0.5g cannot survive 1g
- Aging: reduced bone/muscle density accelerates elder mortality
- `mortalityModifier: 1.3` (radiation exposure, low gravity health effects)
- Household formation: smaller families (resource constraints)
- Naming: Russian names persist (Soviet bureaucracy endures)
- Retirement age reduced: 50F/55M (health degradation)

### Mars

- `surfaceGravity: 0.38g`
- `gravityBirthPenalty: 0.15` (85% of Earth fertility)
- Mars-born can visit Moon/Belt but NOT Earth
- `gravityReturnThreshold: 0.5` (Mars-born are at the threshold)
- **RED**: small population, high mortality, every death is felt
- **GREEN**: improving conditions, birth rate recovery
- **BLUE**: approaching Earth-normal demographics
- Radiation exposure (no magnetosphere): cancer rates 2x Earth baseline
- `mortalityModifier: 1.15` (RED) -> `1.05` (GREEN) -> `1.0` (BLUE)

### Venus

- Cloud colony: artificial gravity via rotation (can be set to 1.0g)
- `surfaceGravity: 0.9g` (surface, but colonies float)
- `fertilityModifier: 0.9` (stress, confined spaces)
- `mortalityModifier: 1.1` (acid exposure risk, structural failure)
- Small population ceiling per cloud city -- must build new platforms
- Naming: Russian names, but cloud city naming conventions for locations

### Jupiter/Ganymede

- `surfaceGravity: 0.146g`
- `gravityBirthPenalty: 0.35` (65% reduction -- near-critical)
- Ganymede-born can NEVER return to Earth (0.146g is far below 0.5g threshold)
- Ganymede-born can visit Titan (0.138g) and Belt (centrifugal, adjustable)
- `mortalityModifier: 1.4` (radiation, low gravity, isolation)
- Psychological stress: Jupiter looming in the sky, radiation anxiety
- Generation 2+: genetic divergence begins. These are no longer "Earth humans"
  in any medical sense. Different bone structure, different cardiovascular system.
- IVF and artificial womb technology becomes necessary (natural conception unreliable)

### Belt/Ceres

- `surfaceGravity: 0.029g` (Ceres surface) but hab modules spin for artificial g
- Spin gravity tunable: 0.3g to 1.0g depending on hab design
- `gravityBirthPenalty: 0.05` (if spinning at 0.5g+)
- `mortalityModifier: 1.05` (well-shielded, controlled environment)
- "Belter" identity emerges by generation 3 -- taller, thinner, adapted to
  variable gravity. Cultural divergence from Earth Russians.
- High mobility: Belters move between settlements frequently
- Household formation patterns differ: "contract marriages" for resource pooling

### Titan

- `surfaceGravity: 0.138g`
- `gravityBirthPenalty: 0.35` (similar to Ganymede)
- Titan-born and Ganymede-born are the most gravity-isolated humans
- `mortalityModifier: 1.3` (extreme cold, hydrocarbon exposure)
- Dense atmosphere provides SOME radiation shielding (unlike Moon/Belt)
- Unique: methane exposure causes novel health conditions not seen elsewhere
- Generation 2+: adapting to methane-rich closed ecology

### Generation Ship

- Artificial gravity via rotation: tunable, but degrading over centuries
- `surfaceGravity: 0.7 -> 0.5` (centrifuge bearings wear over millennia)
- `gravityBirthPenalty: 0.1` (initially healthy, degrades with ship)
- `mortalityModifier: 1.0 -> 1.2` (accumulating radiation over centuries)
- **Critical**: genetic bottleneck. Starting population must be > 500 for
  viable gene pool. Below 160, inbreeding depression becomes lethal by gen 5.
- Minimum viable population: 500 (10,000 preferred for long-term genetic health)
- IVF with frozen embryo bank extends genetic diversity
- Ship-born have NO concept of planetary life. "Down" is centrifugal, not gravitational.

### Exoplanet

- All parameters from planet survey
- First generation: adapted to ship gravity, must readapt to planet
- If planet gravity > 0.7g and Earth-born colonists: mostly normal
- If planet gravity < 0.3g: same issues as Moon/Ganymede
- Potential for alien biology interaction: new diseases, new food allergies,
  unknown immunological responses

---

## 7. Disasters / Black Swan System

**Current system**: Three-tier crisis architecture:
- Tier 1: `PressureCrisisEngine` (sustained pressure -> crisis)
- Tier 2: `ClimateEventSystem` (seasonal/weather pattern-driven)
- Tier 3: `BlackSwanSystem` (pure low-probability, no gates)

Plus `ChaosEngine` with 4 archetypes (war, famine, disaster, political)
and self-referencing feedback cascades.

### Earth (current)

- Meteor: destructive, random position, creates crater + resource deposit
- Earthquake: magnitude-scaled infrastructure damage
- Solar storm: production halt
- Nuclear accident: disease + infrastructure (post-1954)
- Supervolcanic ash: food + disease + production halt
- War, famine, disaster, political crisis archetypes

### Moon

- Meteor: MORE frequent (no atmosphere to burn up small ones), LESS
  survivable (no atmosphere, direct impact on hab). Higher probability,
  higher lethality, but hits outside habs are just regolith redistribution.
- Moonquakes: rare but real (Apollo seismometers detected them). Low magnitude
  but structures not designed for seismic loads.
- Solar flare: CRITICAL (no magnetic field, no atmosphere). Radiation storm
  kills anyone outside shelter. 15-minute warning from Earth monitoring.
- No nuclear accident archetype (reactors are better shielded in vacuum)
- Political: isolation stress -> mutiny -> independence movement
- No war archetype (who attacks the Moon? ... unless Earth factions do)

### Mars

- Meteor: **POLARITY REVERSED** during GREEN/BLUE phase:
  - RED: destructive (same as Earth)
  - GREEN: large ice-rich meteors diverted to poles for terraforming
  - The same `rollMeteorStrike()` function, but `convertCraterToMine()` returns
    water/ice deposits instead of iron/coal/uranium
- Dust storm: Mars-specific Tier 2 event. Global dust storms can last months,
  blocking all solar power. This is the Mars-equivalent of winter.
- Marsquakes: detected by InSight (magnitude 4.7 max observed). Structural damage.
- No nuclear accident (different reactor designs on Mars)
- War: inter-colony conflict if multiple settlements exist
- Political: Mars independence movement (real-world analog: colonial independence)

### Venus

- Acid rain corrosion: Tier 2 event, degrades cloud city structures
- Lightning strike: direct hit on cloud platform (Venus has frequent lightning)
- Wind shear: structural stress from superrotation wind changes
- Platform detachment: Tier 3 black swan -- section of cloud city breaks away
  and descends into the crushing lower atmosphere
- No meteor (atmosphere burns everything)
- Political: cloud city factionalism (each platform develops its own culture)

### Jupiter/Ganymede

- Radiation storm: Jovian radiation belt intensity varies with Ganymede's orbital
  position. Some positions are 100x more intense than others.
- Impact: Ganymede has a cratered surface -- meteors hit regularly but colony is
  underground. Surface infrastructure vulnerable.
- Tidal event: Ganymede's ice shell can shift during tidal flexing,
  causing localized "ice quakes" that damage underground structures
- Political: communication delay with Earth (35-52 minutes one way) means
  de facto independence. Moscow's orders arrive too late to matter.

### Belt/Ceres

- Micrometeorite swarm: constant low-level threat, hab hull punctures
- Spin instability: O'Neill cylinder bearing failure causes gravity fluctuation
- Collision: another asteroid on intercept course (Tier 3, extremely rare)
- Political: Belter independence is INEVITABLE. Soviet control cannot extend
  to autonomous space habitats with 20+ minute communication delay.
- Mining accident: unique disaster type -- tunnel collapse, explosive
  decompression, volatile outgassing

### Titan

- Methane flood: Titan's methane cycle includes flash floods of liquid methane
  (-179C liquid flowing at high velocity). Destructive to surface infrastructure.
- Cryovolcanism: ice volcanoes erupt water-ammonia mixtures. Both destructive
  (if near colony) and constructive (new water source).
- Hydrocarbon explosion: static electricity + methane atmosphere = fire risk
  (paradoxically, Titan's lack of oxygen means this only happens in pressurized
  human-atmosphere zones)
- Communication delay: 1.2-1.5 hours to Earth. Full independence.

### Generation Ship

- **No external disasters** -- all disasters are INTERNAL
- Hull breach: micrometeorite or structural fatigue. Instant depressurization
  of a section. Tier 3 severity.
- Fusion reactor instability: power fluctuation or total failure. Existential.
- ECLSS cascade failure: CO2 scrubber -> O2 depletion -> crop death -> famine
- Societal collapse: generations of isolation -> cultural drift -> civil war
- **The ship has no escape**. Every disaster must be survived IN PLACE.

### Exoplanet

- Unknown alien hazards: toxic spores, electromagnetic anomalies, seismic
  activity patterns unlike any known world
- All disaster types must be DISCOVERED by the colony through experience
- First few disasters are always Tier 3 black swans (no data to predict from)

---

## 8. Construction Agent

**Current system**: `ConstructionAgent` wraps `constructionSystem()` with
era/weather/transport multipliers on build time.

### Earth (current)

- Outdoor construction, timber/brick/concrete materials
- `constructionTimeMult: 1.0`
- Season affects build speed (rasputitsa mud penalty mitigated by roads)
- Buildings: 55 GLB model types in manifest

### Moon

- `outdoorConstruction: false` (EVA construction in vacuum)
- `domeRequired: true`
- `constructionTimeMult: 3.0` (EVA operations are slow)
- Materials: regolith sintering (3D-printed structures from lunar soil),
  imported steel for pressure vessels
- `materialSources: ['regolith', 'steel']`
- No rasputitsa, no weather penalty
- Construction limited by EVA suit availability and crew fatigue

### Mars

- **RED**: `outdoorConstruction: false`, `constructionTimeMult: 2.5`
- **GREEN**: `outdoorConstruction: true` (with pressure suit), `constructionTimeMult: 1.5`
- **BLUE**: `outdoorConstruction: true`, `constructionTimeMult: 1.0`
- Materials: regolith -> brick (RED), concrete from Martian minerals (GREEN),
  timber from bioengineered trees (BLUE)
- Dust storm halts all outdoor construction
- Underground excavation: unique construction type (radiation shielding, thermal mass)

### Venus

- `outdoorConstruction: false` (sulfuric acid atmosphere)
- `constructionTimeMult: 4.0` (everything must be built inside pressurized volumes)
- Materials: atmospheric processing extracts carbon, sulfur. Steel must be imported.
- Construction is expansion of existing platforms, not new ground placement
- "Building placement" = extending a cloud platform, not choosing a grid cell

### Jupiter/Ganymede

- `outdoorConstruction: false` (radiation)
- `constructionTimeMult: 3.5`
- Materials: Ganymede ice (structural material when temperature-stable),
  imported metals, regolith
- Underground construction preferred (radiation shielding)
- Ice mining tunnels double as hab expansion corridors

### Belt/Ceres

- `outdoorConstruction: false` (vacuum, microgravity)
- `constructionTimeMult: 2.0` (experienced in space construction by this era)
- Materials: asteroid metals (iron, nickel, platinum group)
- Spin habitat construction: cylindrical geometry, not grid-based
- Unique: buildings curve along the interior surface of the cylinder

### Titan

- `outdoorConstruction: true` (dense atmosphere provides pressure, but -179C)
- `constructionTimeMult: 2.5` (cold makes everything harder)
- Materials: water ice (structural), hydrocarbon polymers, imported metals
- Methane rain does not halt construction (workers are in sealed suits)
- Unique: cryogenic materials science -- structures made of water ice are
  as strong as concrete at Titan temperatures

### Generation Ship

- `outdoorConstruction: false` (ship interior only)
- `constructionTimeMult: 1.5` (practiced, but space-constrained)
- Materials: recycled from decommissioned sections, 3D printed from stores
- Construction is REMODELING, not new building. Total ship volume is fixed.
- "New buildings" = repurposing existing compartments

### Exoplanet

- All parameters from planet survey
- First buildings use ship materials (landing party carries prefab modules)
- Transition to local materials as geology is mapped

---

## 9. Transport System

**Current system**: `TransportSystem` computes road quality from transport
buildings, settlement tier, and era. Road condition degrades seasonally.
Rasputitsa mitigation from road quality.

### Earth (current)

- Road types: dirt -> gravel -> paved -> highway
- Rasputitsa (mud season) penalties mitigated by road quality
- Timber maintenance for road condition
- `rasputitsaExists: true`

### Moon

- `roadTypes: ['regolith_track', 'paved_path', 'rail']`
- `rasputitsaExists: false`
- No weather degradation (no atmosphere)
- Micrometeorite impacts damage surface tracks
- Rail transport dominant (no friction losses in vacuum)
- `baseTransportScore: 5` (minimal initial infrastructure)

### Mars

- **RED**: `roadTypes: ['regolith_track', 'pressurized_tunnel']`
- **GREEN**: `roadTypes: ['dirt', 'gravel', 'paved']`
- **BLUE**: `roadTypes: ['dirt', 'gravel', 'paved', 'highway']`
- `rasputitsaExists: true` (Mars has seasonal CO2 sublimation that softens ground)
- Dust accumulation replaces mud as road degradation mechanism
- Pressurized tunnel network: expensive but weatherproof

### Venus

- No roads -- cloud platforms have internal corridors
- Transport between platforms: cable cars, dirigibles, rocket ferries
- `roadTypes: ['corridor', 'cable_car', 'dirigible_route']`
- Wind affects inter-platform transport (superrotation shifts)

### Jupiter/Ganymede

- Underground tunnel network
- `roadTypes: ['tunnel', 'rail', 'pressurized_tube']`
- No surface transport (radiation)
- Transport efficiency depends on tunnel network extent

### Belt/Ceres

- Spin habitat internal transport: tram system along cylinder axis
- Inter-habitat transport: shuttle, mass driver, tether
- `roadTypes: ['tram', 'elevator', 'shuttle_dock']`
- Coriolis effects on transport in spinning habitats

### Titan

- Surface vehicles possible (dense atmosphere, low gravity)
- `roadTypes: ['methane_channel', 'ice_road', 'paved']`
- Methane lakes as waterways (boat transport!)
- `rasputitsaExists: false` (no mud, but methane rain can flood paths)
- Unique: hovercraft-style vehicles work well in thick atmosphere + low gravity

### Generation Ship

- Fixed corridor network (part of ship structure)
- `roadTypes: ['corridor', 'elevator', 'tram']`
- Transport system never degrades (ship infrastructure is maintained)
- `baseTransportScore: 20` (built-in)

---

## 10. Decay Agent

**Current system**: `DecayAgent` wraps `decaySystem()` with a decay multiplier.
Buildings lose condition over time; unmaintained buildings eventually collapse.

### Earth (current)

- Weather accelerates decay (blizzard, mud storm)
- Era affects decay rate (Soviet construction quality varies by era)
- Timber/materials needed for repair

### Moon / Belt / GenShip

- No weather decay -- only mechanical wear and micrometeorite damage
- Decay rate much lower for sealed habitats
- BUT: catastrophic failure mode. Instead of gradual decay, modules
  fail suddenly (seal rupture, pressure loss)
- `decayMultiplier: 0.3` (slow) but with Tier 3 sudden-failure events

### Mars

- Dust abrasion: constant low-level decay from windblown particles
- UV degradation of exposed materials (no ozone)
- `decayMultiplier: 0.8` (RED) -> `0.5` (GREEN, thicker atmosphere protects)

### Venus

- Acid corrosion: constant decay from sulfuric acid exposure
- `decayMultiplier: 2.0` (highest in the system -- Venus eats everything)
- Maintenance is a constant battle -- the primary resource drain

### Titan

- Cryogenic thermal cycling: materials expand/contract as temperature varies
- Hydrocarbon deposition: surfaces coat with organic tars over time
- `decayMultiplier: 0.7`

---

## 11. Political Agent

**Current system**: `PoliticalAgent` manages KGB, quotas, loyalty, scoring,
compulsory deliveries, political entities. The bureaucratic apparatus.

### All Worlds: The Soviet System Endures

The political system is the one constant across ALL worlds. Moscow's reach
may weaken with distance, but the APPARATUS replicates itself everywhere.
This is the game's core thematic statement.

- **Earth**: Full Soviet political system (current implementation)
- **Moon**: Moscow's control is direct (3-second communication delay).
  KGB presence strong. Quotas enforced. The Moon is a prestige project --
  political pressure is HIGHER than Earth.
- **Mars**: 4-22 minute communication delay. Moscow sends directives but
  cannot micromanage. Local party committee gains autonomy. KGB agent
  is on-site but increasingly "goes native."
- **Venus**: Cloud cities develop independent political culture. Moscow's
  decrees arrive but are "interpreted creatively."
- **Jupiter/Ganymede**: 35-52 minute delay. De facto self-governance.
  Political system still uses Soviet terminology but power structures
  diverge. "Moscow" becomes a mythologized concept.
- **Belt**: Full independence. Soviet system persists as cultural heritage
  but functions as a Belter republic. Quotas are self-imposed for resource
  sharing between habitats.
- **Titan**: Independent. Soviet naming conventions, Russian language, but
  the political system has evolved beyond recognition. "The Presidium
  of the Titan Soviet" governs.
- **Generation Ship**: The most purely Soviet environment. Total central
  planning is NECESSARY (fixed resources, fixed population). The ship
  captain IS the predsedatel. Quotas are existential math, not political theater.
- **Exoplanet**: The colonists bring whatever political system the ship had.
  Over generations, it mutates based on planetary conditions.

### Communication Delay Effects on Political Pressure

| World      | One-Way Delay  | Moscow Control Level | KGB Effectiveness |
|------------|----------------|----------------------|-------------------|
| Moon       | 1.3 seconds    | FULL                 | 100%              |
| Mars       | 4-22 minutes   | PARTIAL              | 70%               |
| Venus      | 2-14 minutes   | PARTIAL              | 75%               |
| Ganymede   | 35-52 minutes  | NOMINAL              | 40%               |
| Belt       | 15-25 minutes  | NOMINAL              | 30%               |
| Titan      | 71-87 minutes  | NONE (ceremonial)    | 10%               |
| Gen Ship   | N/A            | SELF-GOVERNING       | 100% (internal)   |
| Exoplanet  | Years          | NONE                 | 0%                |

---

## 12. Asteroid Diversion Mechanic

The `meteorStrike.ts` system already produces `MeteorEvent` with coordinates,
magnitude, and resource deposits. The adaptation for terraforming:

### Earth: Destructive

Current behavior: `rollMeteorStrike()` -> `applyMeteorImpact()` -> crater +
resource deposit. Damage radius destroys tiles. `convertCraterToMine()` creates
an open-pit mine.

### Mars (GREEN/BLUE phase): Constructive

When `TerrainProfile.meteorPolarity === -1`:

1. `rollMeteorStrike()` runs identically (same probability, same RNG)
2. Detection phase: if tech level includes `asteroid_tracking`, the player
   gets advance warning and can choose to DIVERT the asteroid
3. Diversion target: Mars poles (water ice deposition for terraforming)
4. `applyMeteorImpact()` modified: instead of `resourceDeposit: 'iron'|'coal'|'uranium'`,
   returns `resourceDeposit: 'water_ice'|'co2_ice'|'nitrogen_ice'`
5. `convertCraterToMine()` returns `{ buildingType: 'ice_extraction_plant' }`
   instead of `open_pit_mine`
6. Impact adds atmospheric mass: CO2 and water vapor increase, accelerating
   the GREEN -> BLUE transition

**Diversion costs:**
- Fuel (nuclear thermal rocket burns to redirect trajectory)
- Political capital (if diversion fails, crater destroys colony infrastructure)
- Risk: imprecise diversion could hit a settlement instead of the poles

**Narrative weight:**
The same event that terrorizes Earth colonists is CELEBRATED on Mars.
Pravda headline: "HEROIC METEOR SUCCESSFULLY REDIRECTED TO NORTHERN POLAR CAP!
ESTIMATED 50,000 TONNES OF WATER ICE DELIVERED! GLORY TO SOVIET ENGINEERING!"

---

## 13. Demographic Evolution Across Gravities

This is the deepest long-term consequence of multi-world colonization.
Born in different gravities, humans diverge physiologically within 3-5
generations.

### The Gravity Caste System

```
gravity      | birth world    | can visit              | cannot visit
-------------|----------------|------------------------|-----------------
1.0g         | Earth          | everywhere (with help) | —
0.9g         | Venus (cloud)  | Mars, Moon, Belt, Titan| —
0.38g        | Mars           | Moon, Belt, Titan      | Earth (marginal)
0.166g       | Moon           | Belt, Titan, Ganymede  | Earth, Mars
0.146g       | Ganymede       | Belt, Titan, Moon      | Earth, Mars
0.138g       | Titan          | Belt, Ganymede, Moon   | Earth, Mars
0.029-1.0g   | Belt (spin)    | depends on spin g      | depends on spin g
0.5-0.7g     | Gen Ship       | most worlds            | Earth (if < 0.7g)
variable     | Exoplanet      | depends on planet g    | depends
```

### Physiological Divergence by Generation

**Generation 1** (Earth-born immigrants): Bone density loss, muscle atrophy.
Reversible with exercise and medication. Can return to Earth with rehabilitation.

**Generation 2** (colony-born, Earth-raised parents): Reduced baseline bone
density. Taller, thinner. Can visit lower-g worlds but Earth return requires
months of preparation and may cause permanent injury.

**Generation 3+** (colony-born, colony-raised parents): Physiologically adapted
to birth gravity. Cardiovascular system, skeletal structure, inner ear all
optimized for low-g. Earth return is medically impossible for < 0.3g births.

**Gameplay impact:**
- Worker transfer between worlds is gravity-gated
- Conscription from low-g worlds is impossible for Earth military
- Medical facilities on each world must be gravity-appropriate
- The "Soviet citizen" becomes a biological category, not just political
- Diplomatic crises when Moscow demands conscription from Ganymede
  ("You want us to send our children to die in gravity that will crush them?")

---

## 14. Greg Bear's Eon Trilogy as Branching Source

The *Eon* trilogy (*Eon*, *Eternity*, *Legacy*) provides a rich branching
source for cold branches in the timeline system.

### Key Concepts from Eon

1. **The Stone (Thistledown)**: An asteroid hollowed out as a generation ship.
   In the novel, discovered by humans -- in SimSoviet, the Soviets build it.
   This IS the generation ship timeline.

2. **The Way**: An infinitely long corridor opened inside the Stone, leading
   to parallel universes and future timelines. In SimSoviet terms: a
   cold branch representing "what if the Soviets discovered multiverse access?"

3. **USSR vs USA for the Stone**: In *Eon*, the US and USSR compete for
   control of the asteroid. In SimSoviet, the USSR has it exclusively.
   Cold branch: "What if America contested ownership?" -> proxy war in orbit.

4. **The Jarts**: Alien species encountered through the Way. In SimSoviet:
   cold branch for first contact. Alien contact is NOT guaranteed -- it's
   a low-probability Tier 3 event in the generation ship or exoplanet timelines.

5. **Nuclear exchange (background of Eon)**: The novel's backstory includes
   a US-Soviet nuclear war. In SimSoviet: cold branch `nuclear_exchange` is
   already in the ChaosEngine crisis archetypes.

### Implementation as Cold Branches

```json
{
  "id": "stone_discovery",
  "name": "Discovery of the Stone",
  "conditions": { "and": [
    { "year": { "min": 2020 } },
    { "milestone": { "timelineId": "space", "milestoneId": "asteroid_mining" } },
    { "techLevel": { "min": 7 } }
  ]},
  "probability": 0.001,
  "effects": {
    "unlocks": ["the_way_research", "stone_colonization"],
    "narrative": {
      "pravdaHeadline": "ANOMALOUS ASTEROID DETECTED: HOLLOW INTERIOR CONFIRMED",
      "description": "Soviet astronomers have detected an asteroid with impossible internal geometry..."
    }
  }
}
```

### Eon-Inspired Branching Points

| Branch ID              | Trigger                         | Effect                            |
|------------------------|---------------------------------|-----------------------------------|
| `stone_discovery`      | Asteroid mining + tech 7        | Unlocks The Way research          |
| `way_opening`          | Stone colonization + tech 9     | Multiverse access (infinite expansion) |
| `jart_contact`         | Way exploration + deep future   | First alien contact               |
| `stone_competition`    | Stone discovery + US exists     | Proxy war in orbit                |
| `nuclear_exchange`     | Political crisis + war archetype| Earth devastation, accelerates space |
| `stone_exodus`         | Earth ecological collapse       | Mass evacuation into the Stone    |

### Other Hard SF Branching Sources

- **Dune** (Herbert): Desert world terraforming parallels Mars GREEN phase.
  Water discipline, stillsuits, sandworm analogs as engineered organisms.
  Cold branch: "What if Mars develops a water-hoarding theocracy?"

- **Firefly/Serenity** (Whedon): Belt independence movement. "Can't stop
  the signal" -- communication networks enable revolution against central
  authority. Cold branch: "What if the Belt declares independence and
  Moscow retaliates?"

- **The Expanse** (Corey): Belter physiology, protomolecule as alien tech.
  Cold branch: "What if alien nanotechnology is discovered on an asteroid?"

---

## 15. Implementation: How TerrainProfile.climatePolarity Works

### Integration with Existing Systems

The `climatePolarity` field modifies how pressure readings from climate
events translate into gameplay effects. The pressure system itself is
polarity-agnostic -- it just accumulates numbers.

```typescript
// In ClimateEventSystem.evaluate():
function applyPolarityToImpact(
  impact: CrisisImpact,
  profile: TerrainProfile,
): CrisisImpact {
  if (profile.climatePolarity === 1) return impact; // Earth default

  // Reversed polarity: warming effects become beneficial
  const reversed = { ...impact };

  if (reversed.economy?.productionMult) {
    // Warming boosts production on Mars (more liquid water, less heating cost)
    reversed.economy.productionMult = 2.0 - reversed.economy.productionMult;
  }

  if (reversed.social?.growthMult) {
    // Warming reduces mortality on Mars (warmer = more habitable)
    reversed.social.growthMult = 2.0 - reversed.social.growthMult;
  }

  // Food production STILL suffers from extreme events (dust storms)
  // but benefits from moderate warming (longer growing conditions)
  if (reversed.economy?.foodDelta && reversed.economy.foodDelta < 0) {
    reversed.economy.foodDelta *= -0.5; // partial benefit
  }

  return reversed;
}
```

### Pressure Domain Interpretation

The same pressure domains work everywhere, but their MEANING shifts:

| Domain           | Earth Interpretation    | Mars Interpretation         |
|------------------|------------------------|-----------------------------|
| `food`           | Starvation risk        | Greenhouse failure          |
| `infrastructure` | Building collapse      | Hab breach                  |
| `health`         | Disease outbreak       | Radiation exposure          |
| `morale`         | Worker unhappiness     | Isolation psychosis         |
| `demographic`    | Population decline     | Genetic bottleneck          |
| `political`      | KGB attention          | Independence movement       |

### Agent Configuration at World Creation

When a per-world timeline activates (e.g., `mars_colony` milestone triggers
the mars timeline), the following initialization occurs:

1. Load `TerrainProfile` from world config JSON
2. Configure each agent with world-specific parameters:
   - `FoodAgent.setProfile(profile)` -- adjusts production base, enables/disables
     soil farming, sets starvation grace period
   - `PowerAgent.setProfile(profile)` -- adjusts solar efficiency, enables/disables
     power source types, sets priority order
   - `WeatherAgent.setProfile(profile)` -- loads world-specific season/weather tables
   - `DemographicAgent.setProfile(profile)` -- adjusts gravity penalties, mortality
     modifiers, retirement ages
   - `ClimateEventSystem.setProfile(profile)` -- applies polarity reversal
   - `BlackSwanSystem.setProfile(profile)` -- adjusts meteor polarity, event catalog
   - `ConstructionAgent.setProfile(profile)` -- adjusts time multiplier, material list
   - `TransportSystem.setProfile(profile)` -- loads road types, disables rasputitsa
   - `DecayAgent.setProfile(profile)` -- adjusts decay multiplier
3. Each agent's `setProfile()` method stores the profile and adjusts internal
   constants accordingly. No agent logic changes -- only parameter values.

### Save/Load

`TerrainProfile` is serialized per-world in the save file. On load, agents
are re-configured with the stored profile. This means saves are forward-compatible:
new worlds added in patches will just have new profiles.

---

## 16. Per-World Summary Matrix

| System        | Earth       | Moon        | Mars (RED)  | Mars (GREEN) | Mars (BLUE) | Venus       | Ganymede    | Belt/Ceres  | Titan       | Gen Ship    |
|---------------|-------------|-------------|-------------|--------------|-------------|-------------|-------------|-------------|-------------|-------------|
| Climate Pol.  | +1 (warm=bad)| N/A        | -1          | -1           | -1 -> +1    | +1          | N/A         | N/A         | -1 (mild)   | N/A         |
| Weather       | 7 seasons   | Day/Night   | 4 seasons   | 4+ seasons   | 7 seasons   | Acid/Wind   | Radiation   | None        | CH4 weather | ECLSS       |
| Food Base     | 1.0         | 0.3         | 0.2         | 0.6          | 0.9         | 0.15        | 0.25        | 0.3         | 0.1         | 0.5         |
| Food Source   | Soil+Plots  | Hydro       | Greenhouse  | Soil begins  | Full soil   | Aero        | Deep hydro  | Spin hydro  | Chem synth  | Closed loop |
| Solar Eff.    | 1.0         | 1.37        | 0.43        | 0.43         | 0.43        | 0.9 (cloud) | 0.037       | 0.13        | 0.011       | 0.0         |
| Power Primary | Coal/Hydro  | Nuclear     | Nuclear     | Nuclear+Wind | Solar+Hydro | Solar+Wind  | Nuclear     | Nuclear     | Nuclear     | Fusion      |
| Gravity (g)   | 1.0         | 0.166       | 0.38        | 0.38         | 0.38        | 0.9 (spin)  | 0.146       | 0.029-1.0   | 0.138       | 0.5-0.7     |
| Fert. Mod.    | 1.0         | 0.3         | 0.85        | 0.85         | 0.85        | 0.9         | 0.65        | 0.95 (spin) | 0.65        | 0.9         |
| Mort. Mod.    | 1.0         | 1.3         | 1.15        | 1.05         | 1.0         | 1.1         | 1.4         | 1.05        | 1.3         | 1.0-1.2     |
| Outdoor Build | Yes         | No          | No          | Suit         | Yes         | No          | No          | No          | Yes (suit)  | No          |
| Build Mult.   | 1.0         | 3.0         | 2.5         | 1.5          | 1.0         | 4.0         | 3.5         | 2.0         | 2.5         | 1.5         |
| Decay Mult.   | 1.0         | 0.3         | 0.8         | 0.5          | 0.5         | 2.0         | 0.3         | 0.3         | 0.7         | 0.3         |
| Meteor Pol.   | Destructive | Destructive | Destructive | Constructive | Constructive| N/A (atmo)  | Destructive | Destructive | Destructive | N/A         |
| Moscow Ctrl   | Full        | Full        | Partial     | Partial      | Nominal     | Partial     | Nominal     | Nominal     | None        | Self        |
| Road Types    | Dirt-Hwy    | Track/Rail  | Track/Tunnel| Dirt-Paved   | Dirt-Hwy    | Corridor    | Tunnel/Rail | Tram/Elev   | Ice Road    | Corridor    |

---

## Design Constraints

1. **No new agent classes**. Every world reuses the same ~30 agent files.
   World-specific behavior comes from `TerrainProfile` parameters only.

2. **No agent interface changes**. `setProfile(profile: TerrainProfile)` is the
   only new method added to each agent. All existing APIs remain unchanged.

3. **JSON-driven world configs**. `TerrainProfile` for each world lives in
   `src/config/<world>TerrainProfile.json`. Moddable without code changes.

4. **Backward compatible**. Earth's `TerrainProfile` has all current defaults.
   Existing saves implicitly use Earth profile. No migration needed.

5. **Incremental delivery**. Each world can be shipped independently. The
   matrix above is the target; each column is a separate work item.
