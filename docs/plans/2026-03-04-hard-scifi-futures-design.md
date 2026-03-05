---
type: design
status: draft
---

# Hard Science Fiction Futures for SimSoviet 1917
## "What if Soviet, but the physics are real?"

### Design Philosophy

Every system in this document is grounded in published engineering data, peer-reviewed
research, or NASA/ESA technical reports. Where numbers are given, they come from real
experiments (BIOS-3, Biosphere 2, ISS ECLSS) or real proposals (Project Daedalus,
Breakthrough Starshot, O'Neill 1975 study). No handwaving. No warp drives. No magic
materials. If a physics grad reads this and winces, we failed.

The Soviet lens is not cosmetic. Central planning, quota systems, political purges,
and bureaucratic inertia are STRUCTURAL constraints on every technological transition.
The question is never "can humanity do this?" but "can THIS bureaucracy do this without
killing everyone?"

---

## Table of Contents

1. [Near-Future (2025-2100): Ecological Collapse](#1-near-future-2025-2100-ecological-collapse)
2. [Medium-Future (2100-2500): Enclosed Cities](#2-medium-future-2100-2500-enclosed-cities)
3. [Space Colonization (2100-5000): Soviet Space](#3-space-colonization-2100-5000-soviet-space)
4. [Deep Future (5000-100000): Generation Ships and Beyond](#4-deep-future-5000-100000-generation-ships-and-beyond)
5. [The Soviet Lens](#5-the-soviet-lens)
6. [Resource Systems for the Game](#6-resource-systems-for-the-game)
7. [Sources](#7-sources)

---

## 1. Near-Future (2025-2100): Ecological Collapse

### 1.1 Permafrost Thaw

**The real timeline for Russia:**

Russia's permafrost underlies ~65% of its territory. It is warming at 2.5x the global
average rate, with temperatures increasing 0.05-0.07 C/year since the mid-1970s. The
permafrost table has already lowered up to 8 meters in the discontinuous zone.

**Projected contraction of near-surface permafrost area in Russia:**
- By 2030: -11%
- By 2050: -18%
- By 2080: -23%
- Continuous permafrost zone specifically: -18% (2030), -29% (2050), -41% (2080)

**Infrastructure damage (real numbers):**
- 40% of infrastructure facilities and buildings ALREADY damaged (Russian Environment
  Minister Alexander Kozlov, current assessment)
- USD $250 billion worth of physical infrastructure at risk (Russian Academy of Sciences)
- 60% of buildings and structures in northern Russia affected by permafrost degradation
  (Bank of Russia study)
- Housing stock losses alone: USD $20.7 billion by mid-century under high-emissions
- Total infrastructure damage potential: exceeds USD $100 billion
- 45% of hydrocarbon extraction fields in the Russian Arctic are in thaw-risk regions

**Game implementation:**
- Starts ~2030 in freeform mode
- Infrastructure decay rate increases 2-5x for all northern settlements
- Pipeline ruptures trigger oil spill crisis events (modeled on the 2020 Norilsk diesel
  spill: 6.5 million gallons, 147.8 billion ruble damage)
- Building foundations crack: random building downgrades unless "deep pile" construction
  (costs 3x materials, requires steel + cement)
- Roads become impassable during thaw season (spring/summer): transport efficiency drops 40-60%

### 1.2 Arctic Methane Release

**The science (as of 2025):**

The "clathrate gun hypothesis" — catastrophic methane release from Arctic seafloor —
has been downgraded by the IPCC Sixth Assessment Report (2021), which removed methane
hydrates from its list of potential tipping points. The current scientific consensus:

- Catastrophic release is "very unlikely" in the next few centuries
- Seafloor warming takes centuries of constant ocean temperature rise to destabilize
  hydrates significantly
- Methane seeps have been detected along continental shelves near Siberia, Alaska, and
  Norway, but these are slow processes
- The real threat is PERMAFROST methane (land-based), not seafloor clathrates

**Game implementation:**
- NOT a sudden catastrophe. Instead: slow, grinding atmospheric degradation
- Methane contributes to accelerating warming feedback loop (+0.1 C/decade additional
  warming starting ~2060)
- Occasional methane blowout craters in permafrost zones (real phenomenon in Siberian
  tundra) — destroys 1-3 buildings per event
- Contributes to the long-term atmospheric toxicity timeline (see Section 1.6)

### 1.3 Ozone Layer

**Recovery timeline (WMO 2025 Bulletin):**
- Global recovery to 1980 levels: by ~2040
- Arctic recovery: by ~2045
- Antarctic recovery: by ~2066

**Complications:**
- Despite Montreal Protocol success, surface UV radiation has been RISING 0.5-1.4%/year
  in the Northern Hemisphere since 2010-2020
- Interactions between ozone depletion and climate change modify UV exposure for plants
  and animals, affecting agricultural sustainability
- UV-B radiation combined with temperature and moisture changes affects crop quality
  and pathogen defense

**Game implementation:**
- Ozone is NOT the primary ecological threat for the near-future era
- Instead, UV effects compound with agricultural zone shifts (below)
- If the freeform timeline diverges with continued CFC production (Soviet industry
  never cleaned up), ozone depletion becomes a major late-game driver
- In freeform mode: UV index tracked as environmental modifier affecting crop yield
  (-5% to -20%) and worker health (disease rate +10-30%)

### 1.4 Russian Agricultural Zone Shifts

**Real projections (peer-reviewed research):**

- Agricultural zone leading edges shift northward 400-600 km by 2099 in NW Russia
- In eastern Siberia: northward shift of nearly 1,200 km by 2099
- Currently 32% of the boreal region is crop-feasible; by 2099, roughly 76%
- BUT: northern topsoil is thinner, more acidic, less productive than southern chernozem
- Southern productive regions (current wheat belt) face extreme heat event increases
- Forest-steppe zone is drying out; 70% of steppe zones becoming unviable in some regions
- Net effect: wheat production shifts north but total yield may DECREASE

**The critical nuance for the game:**
The "Russia benefits from climate change" narrative is a TRAP. New northern land is
inferior to lost southern land. Thin, acidic soil over former permafrost cannot replace
the black earth (chernozem) of Ukraine and southern Russia. The wheat belt doesn't just
move — it degrades.

**Game implementation:**
- Terrain tiles have `soilQuality` attribute (0.0-1.0)
- Southern tiles: soilQuality degrades 0.5%/year starting ~2050
- Northern tiles: soilQuality starts at 0.2-0.4 (vs. 0.7-0.9 for southern chernozem)
- Agricultural yield formula: `baseYield * soilQuality * weatherModifier * uvModifier`
- Net food production peaks ~2040-2060, then DECLINES despite expanded farmable area
- This creates the pressure that eventually drives enclosed farming (domes, vertical farms)

### 1.5 Water Crisis (The Aral Sea Precedent)

**What actually happened:**
- Aral Sea: formerly 68,000 km^2, third-largest lake on Earth
- Soviet irrigation projects (1960s) diverted Amu Darya and Syr Darya rivers for cotton
- Lake shrank by over 90%
- Groundwater contamination: total dissolved salts 0.4-6.0 g/L in Karakalpakstan
- Health effects: respiratory disease, cancer clusters, infant mortality
- 2025 restoration attempts: 1 billion cubic meters directed to Northern Aral in 3 months

**The systemic lesson:**
Soviet central planning optimized for PRODUCTION QUOTAS, not ecological sustainability.
Cotton quotas destroyed the Aral Sea. This is not a bug — it is the defining feature
of the system the player navigates.

**Game implementation:**
- Water table is a per-settlement attribute, depleting with irrigation
- Heavy irrigation (meeting agricultural quotas) drains water table at measurable rate
- Water table depletion: -0.1 units/year per irrigated farm tile
- When water table drops below threshold: crop yields collapse, health events trigger
- Restoration is SLOW and EXPENSIVE (decades, massive labor allocation)
- This creates a tragic choice: meet Moscow's crop quotas OR preserve water supply

### 1.6 Industrial Pollution (Norilsk Model)

**Real data from Norilsk, Russia:**
- World's largest heavy metals smelting complex
- 1,787,000 tons of pollutants emitted annually into the atmosphere
- 10.5% of ALL atmospheric emissions from stationary sources in Russia — from ONE city
- 1.9 million tons/year from Norilsk Nickel alone
- 37% of emissions from the 30 most hazardous Arctic industries
- 57x more pollution than ALL of Arctic Canada combined
- Elevated copper and nickel in soil up to 60 km radius
- Children near copper plant: 2x respiratory disease rate
- 2020 diesel spill: 6.5 million gallons, largest Arctic oil spill in history

**Chelyabinsk (the other model):**
- Chelyabinsk-40/65 (Mayak nuclear facility): 1957 Kyshtym disaster
- Third-worst nuclear accident in history
- Lake Karachay: most polluted spot on Earth (standing near it for 1 hour = lethal dose)

**Game implementation:**
- Industrial buildings generate `pollution` attribute per tick
- Pollution accumulates on terrain tiles, spreads via wind direction
- Health effects scale with pollution level:
  - 0-20: No effect
  - 20-40: +10% disease rate
  - 40-60: +25% disease rate, -10% crop yield in adjacent tiles
  - 60-80: +50% disease rate, -25% crop yield, worker lifespan -5 years
  - 80-100: Uninhabitable without enclosed habitat
- Pollution cleanup: extremely expensive (hundreds of billions of rubles equivalent)
- Nuclear accidents: rare but catastrophic (see Kyshtym, Chernobyl models in crisis system)
- Pollution is the PRIMARY driver for dome construction on Earth

### 1.7 Near-Future Summary Timeline

| Year | Event | Game Effect |
|------|-------|-------------|
| 2025-2030 | Permafrost thaw accelerates | Infrastructure decay +50% in Arctic zones |
| 2030-2040 | Agricultural peak | Southern chernozem still productive, food surplus possible |
| 2040-2060 | Agricultural zone shift | Southern yields declining, northern expansion insufficient |
| 2050+ | Water table stress | Central Asian settlements face water crisis |
| 2060-2080 | Atmospheric methane feedback | +0.1 C/decade acceleration |
| 2080-2100 | Industrial pollution cumulative | Major cities require air filtration |
| 2100 | Ozone + UV compound effects | Outdoor farming yields -20%, dome farming +50% efficiency |

---

## 2. Medium-Future (2100-2500): Enclosed Cities

### 2.1 The Case for Arcologies

When outdoor air becomes unhealthy (pollution + UV + methane feedback), the engineering
response is enclosure. This is not speculative — the USSR actually built the first
sealed ecosystem experiments.

### 2.2 BIOS-3: The Soviet Precedent

**Real experimental data from Krasnoyarsk, Russia (1965-1984):**

BIOS-3 was a 315 m^3 underground steel structure at the Institute of Biophysics in
Krasnoyarsk. It is the direct ancestor of ALL closed ecosystem research.

**Specifications:**
- Volume: 315 m^3 (11,100 ft^3)
- Crew: up to 3 persons
- 4 compartments: 1 crew area (3 cabins, galley, lavatory, control room) + 3 phytotrons
- Lighting: 20 kW xenon lamps per compartment (simulating sunlight), water-cooled
- 10 crewed closure experiments, longest: 180 days (1972-1973)

**Recycling results (ACTUAL MEASURED DATA):**
- Oxygen: ~100% regeneration of atmospheric gases
  - Chlorella algae in 80 m^3 cultivator: 60-70% of O2 via CO2 fixation
  - Higher plants (wheat, vegetables): additional ~25% of O2
  - Catalytic decomposition (nickel-chromium catalyst, 600 C): remainder
- Water: 85-95% recovery (condensation, filtration, multi-stage processing)
- Food: 50-55% closure (crew grew about half their food, including bread from wheat)
- Per-person Chlorella requirement: 8 m^2 of exposed algae surface

**Critical finding:** To balance O2/CO2 for ONE human requires 8 square meters of
Chlorella culture. This is the fundamental scaling constant for enclosed habitats.

### 2.3 Biosphere 2: Lessons in Failure

**What went wrong (quantified):**
- O2 started at 20.9%, fell steadily, reached 14.5% after 16 months
- Cause: soil microbes metabolized organic matter, consuming O2 and producing CO2
- CO2 was then absorbed by CONCRETE WALLS (calcium hydroxide + CO2 = calcium carbonate)
- Result: oxygen was being sequestered in the building materials themselves
- Annual atmospheric leak rate: <10% (~300 ppm/day) — actually quite good engineering
- Used two "lung" expansion chambers to manage pressure differentials

**Key lesson for game design:**
Small closed systems have ACCELERATED cycling times. Ecological buffers are proportionally
smaller. The danger of toxic element buildup or essential element sequestration is FAR
greater than in natural biospheres. Mistakes compound faster.

**Game implementation:**
- Dome/arcology atmosphere has a `stability` rating (0-100)
- Small enclosures (<1000 residents): stability degrades 2x faster
- Concrete construction (Soviet standard!) absorbs CO2 — must be accounted for
- Atmosphere management is an active ongoing cost, not a one-time build

### 2.4 Engineering Constraints for Enclosed Habitats

**Per-person life support requirements (NASA ECLSS data + BIOS-3):**

| Resource | Per Person Per Day | Source |
|----------|-------------------|--------|
| Oxygen consumed | 0.84 kg | NASA ECLSS standard (82 kg reference astronaut) |
| CO2 produced | 1.04 kg | NASA metabolic measurement |
| Water consumed (drinking + food prep) | 3.54 kg | NASA space station standard |
| Water consumed (total incl. hygiene) | 4.4 L | ISS operational standard |
| Food (dry mass) | 0.80 kg | NASA packaged food standard |
| Food (with packaging) | 2.39 kg | ISS delivery standard |
| Calories required | 2,500-3,000 kcal | NASA active astronaut standard |
| Total metabolic input | ~5.0 kg | O2 + food + water combined |

**Air recycling:**
- CO2 scrubbing: must remove 1.04 kg CO2/person/day
- ISS current O2 recovery from CO2: ~50% (Sabatier reactor)
- Future target: 75% O2 recovery
- Biological scrubbing (BIOS-3 model): 8 m^2 Chlorella + ~15 m^2 wheat/vegetables per person
- Total biological scrubbing area: ~23 m^2 per person for full atmospheric closure

**Water recycling:**
- ISS Water Recovery System: 93.5% recovery rate (with Brine Processor Assembly, 2021+)
- Target for long-duration: 98% recovery
- Urine Processor Assembly: recovers 70-75% of water from urine
- Water Processor Assembly: produces up to 136 L/day from sweat, breath, and urine
- Recycled water quality exceeds many Earth-based drinking water standards

**Food production in enclosed systems:**
- Vertical farming wheat yield: 19.5 kg/m^2/year (theoretical maximum)
- Vertical farming energy: 850-2,000 kWh/m^2/year depending on crop and system
- Aquaponics yield: up to 10x conventional per m^2 (leafy greens)
- BUT: high-calorie crops (wheat, rice) require more light, longer cycles
- Per-person food production area (full caloric self-sufficiency):
  - Tropical/optimal conditions: ~140 m^2 (1,500 ft^2)
  - Northern/suboptimal conditions: ~335 m^2 (3,600 ft^2)
  - With aquaponics integration: ~93-140 m^2
- BIOS-3 achieved 50-55% food closure in 315 m^3 for 3 people

### 2.5 Arcology Specifications (Soleri-derived)

**Paolo Soleri's Arcosanti (the real prototype):**
- Planned: 5,000 people on 15 acres (60,700 m^2)
- Population density: 10x New York City
- Full-scale vision: 70,000 people, self-sustaining

**Engineering requirements for a self-contained arcology:**
- Power: at 9.5 kW average per person (US standard, reducible to ~3-5 kW with Soviet
  austerity), a 50,000-person arcology needs 150-475 MW continuous power
- Air: 42,000 kg O2/day (50,000 * 0.84 kg), requiring ~1,150,000 m^2 of biological
  scrubbing area (~400,000 m^2 Chlorella + ~750,000 m^2 plant cultivation)
- Water: 175,000-220,000 L/day input (at 98% recycling, only 3,500-4,400 L/day makeup)
- Food: 7,000,000-16,750,000 m^2 cultivation area (700-1,675 hectares)
  - This is the binding constraint. Food production requires MORE area than housing.
  - Vertical farming (multi-story) reduces footprint by stack factor (4-8 stories)
  - Effective footprint: 87,500-418,750 m^2 (with 8-story vertical farms)
- Structural: must support its own weight, resist seismic loads, contain atmosphere
  at 1 atm differential (if sealed), manage waste heat

**The critical insight: an arcology is mostly FARM, not city.**
At least 40-60% of enclosed volume must be dedicated to food production. The residential
and industrial space is the minority. Soviet citizens would live in communal apartments
(kommunalki) within a structure that is fundamentally an enormous greenhouse.

### 2.6 "Soviet Arcology" — What It Would Look Like

Drawing from actual Soviet architectural traditions:

**Structural:**
- Brutalist concrete megastructure (Soviet standard construction material)
- Prefabricated panel assembly (khrushchyovka-derived mass production techniques)
- BUT: Biosphere 2 proved concrete absorbs CO2 — must be sealed/coated
- Sealed with ceramic or polymer interior coating over concrete shell
- Modular expansion by bolting additional prefab sections

**Social layout (based on real Soviet communal housing):**
- 70% of floor area: agricultural (vertical farms, algae tanks, aquaponics)
- 15% of floor area: residential (kommunalka-style communal apartments, 6 m^2/person)
- 10% of floor area: industrial/workshop
- 5% of floor area: administrative (Party HQ, planning bureau, storage)

**Soviet-specific constraints:**
- No private bathrooms until arcology reaches "luxury" tier
- Communal kitchens processing centrally-grown food
- Mandatory exercise to maintain bone density in enclosed low-activity environment
- Political meeting halls take precedence over recreational space
- Agricultural output subject to compulsory delivery quotas — even in a sealed city

### 2.7 Population Limits by Structure Type

Based on real engineering calculations:

| Structure | Volume | Population | Self-Sufficiency | Power |
|-----------|--------|-----------|-----------------|-------|
| Greenhouse dome | 5,000 m^3 | 0 (farm only) | N/A | 50 kW |
| Small habitat | 10,000 m^3 | 50-100 | 30-40% food | 500 kW |
| BIOS-3 class | 315 m^3 | 3 | 55% food, 100% air | 80 kW |
| Medium arcology | 500,000 m^3 | 2,000-5,000 | 70-80% food | 15-50 MW |
| Large arcology | 5,000,000 m^3 | 20,000-50,000 | 85-95% food | 100-500 MW |
| Mega-arcology | 50,000,000 m^3 | 200,000-500,000 | 95-99% food | 1-5 GW |
| City-dome | 500,000,000 m^3 | 1,000,000-5,000,000 | 99%+ | 10-50 GW |

Each tier up represents roughly 10x volume and 10x population. The game's arcology
merging system maps directly to these tiers.

---

## 3. Space Colonization (2100-5000): Soviet Space

### 3.1 The Lunar Base

**Engineering requirements (from current research):**

**Radiation shielding:**
- Minimum regolith cover: 70 cm (basic protection)
- Recommended: 1.5-2.0 m of regolith (equivalent to terrestrial X-ray worker doses)
- Iron/titanium-rich lunar regolith can be sintered into radiation barriers
- Background radiation on unshielded lunar surface: ~380 mSv/year (vs. 3-6.2 mSv on Earth)
- NASA career limit: 600 mSv total — unshielded lunar surface exhausts this in ~1.5 years

**Water ice mining:**
- Permanently shadowed regions (PSRs) at lunar poles preserve water ice at temperatures
  as low as 40 K (-233 C)
- LCROSS mission (2009): detected ice making up 5.6% of ejected material from Cabeus crater
- Water ice can be several meters thick in some craters
- Extraction requires Radioisotope Power Systems (no sunlight in PSRs)
- Water provides: drinking, agriculture, electrolysis for O2 + H2 (propellant)

**Power:**
- Solar: continuous sunlight at some polar peaks ("peaks of eternal light")
- Nuclear: required for PSR operations and nightside activity (14-day lunar night)
- A 25 kW nuclear reactor provides baseline power for a 6-person station
- Scaling: ~2-4 kW per person for basic operations, ~10 kW for industrial operations

**Soviet lunar base concept:**
- Underground construction (regolith shielding is literally free — just dig in)
- Algae tanks (BIOS-3 heritage) for O2 production: 8 m^2 Chlorella per person
- Water mining teams operating in perpetual darkness with nuclear-powered equipment
- All lunar resources subject to Moscow's allocation quotas
- The trudodni system maps naturally to lunar labor categories:
  mining, construction, agriculture, maintenance, science, administration, political

### 3.2 Mars (Zubrin's Mars Direct, Updated)

**Resource requirements (actual numbers):**

**Propellant production (ISRU):**
- Mars Direct plan: 6 tons of hydrogen from Earth + Mars atmospheric CO2
- Produces 24 tons of methane (CH4) + 84 tons of oxygen (O2) for return trip
- ISRU processing unit: 0.5 tons mass
- Power requirement: 3.5-ton nuclear reactor
- Production rate: 48 kg CH4 + 96 kg O2 per day
- Production time: ~500 days (covers the 18-month wait for transfer window)

**Power for Mars settlement:**
- Refueling a Starship-class vehicle: 600 metric tons of propellant in 1.5 years
- Requires 600 kW continuous power
- Solar array for this: 60,000 m^2, weighing 240 metric tons
- Nuclear is more practical: less mass, works during dust storms (which block solar
  for weeks)

**Radiation on Mars:**
- Surface dose: 200-250 mSv/year (with thin atmosphere providing partial shielding)
- Optimal spacecraft shielding: ~30 g/cm^2 (roughly 30 cm of water or equivalent)
- Regolith/ice block construction for permanent habitat
- Storm shelters with additional 10 cm water-equivalent for solar particle events

**Agriculture on Mars:**
- Mars soil (regolith) contains perchlorates — toxic, must be washed before use
- Atmospheric CO2 (95%) is available for plant growth but requires pressurized greenhouses
- Light at Mars orbit: 43% of Earth intensity — supplemental lighting needed
- Temperature: average -60 C, greenhouses must be heated
- Net energy cost for Mars farming: ~3-5x Earth enclosed farming

**Soviet Mars:**
- The kolkhoz (collective farm) model maps to Mars: communal labor, shared output,
  mandatory deliveries to the settlement administration
- Five-year plan for Mars terraforming: quotas for atmospheric processing, water
  extraction, regolith processing
- Political officer (politruk) on every Mars crew — ideology sessions in habitat module
- KGB problem: in a Mars habitat, there is literally nowhere to flee. Dissent containment
  is "easier" but social pressure is maximum.

### 3.3 O'Neill Cylinders

**Actual engineering specifications (O'Neill 1975 study + NSS):**

**Dimensions:**
- Each cylinder: 6.4-8.0 km diameter, 32 km long
- Two counter-rotating cylinders (cancels gyroscopic effects, maintains solar orientation)
- Six longitudinal stripes: 3 habitable land surfaces, 3 transparent windows
- Total land area per pair: ~1,300 km^2 (~500 mi^2)

**Rotation:**
- 28 rotations per hour (2.8 degrees/second)
- Produces 1g artificial gravity at the inner surface
- Atmosphere: 50% of Earth sea-level pressure (saves wall material)
- Composition: 40% O2, 60% N2 (higher O2 fraction compensates for lower pressure)

**Population:**
- Design capacity: up to 10 million people per cylinder pair
- At Soviet communal density (6 m^2/person residential): even higher
- Practical limit with agriculture: 1-5 million (food production is the binding constraint)

**Construction materials:**
- Primarily lunar or asteroid-derived metals and regolith
- Steel hull, aluminum framing, glass/transparent sections
- Mass: millions of tons (requires asteroid mining infrastructure to be established first)
- Cannot be launched from Earth — must be built in space from space-sourced materials

**Soviet O'Neill cylinder:**
- The ultimate kommunalka: millions of people in a single structure with no outside
- Party committee governs the entire cylinder
- Agricultural strips run the full 32 km length — the largest collective farm ever built
- Rotation maintenance becomes a critical infrastructure concern:
  if rotation stops, gravity stops, everyone floats, crops die
- "Rotation Maintenance Quota" — the most terrifying five-year plan target imaginable

### 3.4 Titan: The Fuel Reserve

**Actual chemistry and resources:**

- Surface temperature: -179 C (94 K)
- Atmosphere: 98.4% nitrogen, 1.4% methane — denser than Earth's (1.5x surface pressure)
- Titan has MORE liquid hydrocarbons than all known oil and gas reserves on Earth
- Several dozen individual lakes each contain more hydrocarbon than Earth's total oil reserves
- Dark dunes contain organics several hundred times larger than Earth's coal reserves
- Methane exists as liquid on the surface (rain, rivers, lakes, seas)

**Chemistry:**
- Methane (CH4) is rocket propellant when burned with oxygen
- Problem: Titan has no free oxygen — must be imported or extracted from water ice
- Water ice exists as bedrock (Titan's crust is water ice, not rock)
- Cryovolcanism may bring subsurface water to the surface
- Potential: electrolyze water ice for O2, combine with surface CH4 for propellant

**Extraction feasibility:**
- Methane is literally lying on the surface as liquid — no drilling required
- Pumping liquid methane in -179 C conditions is an engineering challenge but not
  a physics impossibility
- Energy for electrolysis and propellant processing: nuclear (solar is weak at Saturn orbit,
  only 1% of Earth intensity)
- Delta-v to reach Titan from Earth: ~16 km/s (comparable to Mars but longer transit time)

**Soviet Titan:**
- The ultimate extraction colony: endless fuel, harsh conditions, total dependence on
  supply ships for oxygen
- Workers operate in extreme cold wearing powered suits
- Methane ocean shipping: Soviet tanker fleet on an alien sea
- Quota: cubic meters of processed methane per five-year plan
- The irony: Soviet bureaucracy destroyed the Aral Sea for cotton production quotas.
  On Titan, the resource is genuinely inexhaustible.

### 3.5 Asteroid Mining

**Resource availability (actual data):**
- S-type asteroids: nickel, gold, platinum, iron
- C-type asteroids: water-bearing minerals, carbon compounds
- M-type asteroids: primarily metallic (iron-nickel)
- 16 Psyche: estimated to contain $10,000 quadrillion in metals (more than entire Earth economy)
- Water availability: C-type NEAs have water-bearing minerals, increasing fraction in smaller asteroids
- Asteroid Bennu: identified as promising first water mining target

**Delta-v requirements:**
- Fewer than 1% of known NEOs have "ultra-low" delta-v (<4.5 km/s)
- ~10% of NEAs are more accessible than the Moon
- ~50% of those 10% are likely to be potential orebodies
- Falcon Heavy-class launch increases accessible NEAs from 3% to ~45%

**Game implementation:**
- Asteroid mining settlements are the resource engine for O'Neill cylinder construction
- Each asteroid has a finite resource deposit (depletes over decades/centuries)
- Transport delta-v determines delivery cost (fuel expenditure)
- Soviet asteroid mining: each asteroid is assigned a production quota
- Worker rotation: 6-month shifts (radiation exposure limits)

### 3.6 Space Elevator

**Current materials science status:**

**Requirements:**
- Tether length: ~100,000 km (to geostationary orbit and counterweight beyond)
- Required tensile strength: far exceeds steel (5 GPa)
- Carbon nanotubes: theoretical strength 150 GPa, density 1,300 kg/m^3
- BUT: current CNT manufacturing produces only millimeter-to-meter lengths
- Current commercial CNT tensile strength: only a few GPa (far below theoretical)

**Most promising material (2025): graphene super-laminate (GSL)**
- Three materials strong enough: carbon nanotubes, hexagonal boron nitride, single-crystal graphene
- Polycrystalline graphene can already be produced at 1 km length, 2 m/minute
- ISEC (International Space Elevator Consortium) identifies GSL as the target material
- NOT yet produced at tether quality

**Game timeline:**
- Available as a prestige project in the 2200-2500 range (freeform)
- Requires materials science tech level > 0.9
- Construction: decades-long megaproject
- Reduces orbital launch cost by 10-100x once operational
- Massively accelerates O'Neill cylinder and orbital habitat construction

### 3.7 Soviet Space Economy

The planned economy actually has ADVANTAGES in space:

**Advantages of central planning for space colonization:**
- Resource allocation without market pricing (critical when everything is scarce)
- Forced savings rate for capital-intensive projects (no consumer economy to compete)
- Directed labor allocation (no one "chooses" to be a methane miner on Titan)
- Long-term planning horizon (5-year plans extend naturally to 50-year space projects)
- The Soviet Union already ran the largest planned space program in history

**Disadvantages:**
- Innovation suppression (no entrepreneurial incentive for efficiency improvements)
- Information problems (planners can't know local conditions on Mars from Moscow)
- Corruption (pripiski on oxygen production reports = people die)
- Political purges remove competent engineers (Korolev was imprisoned in a gulag)
- Quota ratcheting: exceed your Mars output target → next target is 20% higher → equipment wears out → collapse

---

## 4. Deep Future (5000-100000): Generation Ships and Beyond

### 4.1 Interstellar Travel at Realistic Speeds

**No FTL. No wormholes. Just physics.**

**Speed benchmarks:**
- Current fastest human artifact: Voyager 1 at 17 km/s (0.006% of light speed)
- Parker Solar Probe (perihelion): 192 km/s (0.064% c)
- Project Daedalus design: 36,000 km/s (12% c) — fusion-powered, unmanned flyby
- Breakthrough Starshot: 0.2c (20% c) — but only for gram-scale probes
- Practical crewed vessels (fusion drive): 5-15% c
- Nuclear pulse (Project Orion): 3-5% c

**Travel times to Alpha Centauri (4.37 light-years):**

| Speed | Travel Time | Propulsion |
|-------|------------|------------|
| 0.006% c (Voyager) | ~73,000 years | Chemical |
| 1% c | 437 years | Advanced fusion |
| 5% c | 87 years | Optimistic fusion |
| 10% c | 44 years | Daedalus-class |
| 12% c | 36 years | Daedalus (actual design) |
| 20% c | 22 years | Laser sail (probe only) |

For crewed missions, 5-10% c is the realistic range. That means Alpha Centauri in
44-87 years — achievable within a human lifetime, but marginal. Beyond Alpha Centauri,
to more interesting targets (10-50 light-years), travel times extend to centuries or millennia.

### 4.2 Project Daedalus (The Only Detailed Study)

**Specifications (British Interplanetary Society, 1973-1978):**
- Mission: flyby of Barnard's Star (5.9 light-years)
- Total vehicle mass: 54,000 tons
- Propulsion: inertial confinement fusion (deuterium/helium-3 pellets)
- Cruise velocity: 36,000 km/s (12% c)
- Trip time: ~50 years
- Unmanned probe (no deceleration — flyby only)
- He-3 fuel: mined from Jupiter's atmosphere (requiring orbital infrastructure around Jupiter)

**Key constraint: fuel mass.**
Daedalus was 54,000 tons, mostly fuel. A crewed vessel that can DECELERATE at the
destination would need roughly 4x the fuel (or a braking mechanism). This drives the
vehicle mass to hundreds of thousands of tons — requiring solar system-scale
industrial capacity to build.

### 4.3 Generation Ship Design

**Minimum viable population (peer-reviewed research):**

There is significant variation in estimates depending on assumptions:

| Study | Minimum Pop. | Conditions | Journey Length |
|-------|-------------|-----------|---------------|
| Moore (2002) | 150-300 | Strict kin-avoidance rules | 2,000 years |
| Smith (2014) | 10,000-40,000 | No social engineering | Multi-generational |
| Project Hyperion (2013) | 14,000-44,000 | Properly screened, age/sex structured | Indefinite |
| Marin & Beluffi (2018) | 98 | Adaptive social engineering, annual breeding evaluation | 6,300 years |
| Conservative recommendation | 40,000 | 23,400 effective reproductive individuals | Indefinite |

**The genetics problem:**
- Small populations suffer founder effect (reduced genetic diversity)
- Inbreeding depression (cf. Amish, Ashkenazi Jewish genetic disease clusters)
- Space radiation increases mutation rate ~10x compared to Earth
- Cultural evolution rate: ~5x faster in isolated populations
- Frozen embryo banks can supplement genetic diversity but require functional biotechnology

**Social structure for multi-generational voyages:**
- Moore concluded the necessary social structure resembles "clans or extended tribes
  of hunter-gatherers" with strong kin-avoidance rules
- Rigid social hierarchy may be necessary for resource allocation (convenient for Soviets)
- BUT: political purges in an enclosed population are existentially dangerous
  (can't afford to lose 2% of breeding population to the Gulag)

### 4.4 The Soviet Generation Ship

**The most Soviet thing imaginable:**

A sealed vessel carrying 40,000 people on a 500-year journey to another star system,
governed by the Communist Party of the Soviet Union (Interstellar Branch).

**Structure (based on O'Neill cylinder, but as a ship):**
- Rotating habitat section: 2-3 km diameter, 5-10 km long
- Non-rotating engine section: fusion drive array
- Total mass: 500,000-2,000,000 tons
- Internal layout: identical to Soviet arcology (70% farm, 15% residential, etc.)

**Political structure:**
- Politburo of the Interstellar Soviet: 10-person ruling committee
- Five-year plans continue in deep space
- Quotas for: food production, air quality maintenance, population targets, hull maintenance
- KGB Interstellar Division: monitoring loyalty over centuries
- The Party Secretary is technically subordinate to Moscow — but light-speed delay makes
  this farcical. A message to Earth takes 4.37 years one way.
- DOCTRINAL DRIFT: over centuries, the ship's Communist Party will inevitably diverge
  from Earth's. Splinter factions develop. What constitutes "correct" Marxism-Leninism
  after 300 years of isolation?

**The game's most unique mechanic:**
Generation ships create a CLOSED POLITICAL SYSTEM where the player cannot escape, cannot
be rescued, and cannot be replaced. The party committee IS the government, and the player
must navigate succession crises, ideological schisms, and resource allocation for centuries.
This is the ultimate expression of the game's core fantasy: bureaucratic survival in a
system that cannot be escaped.

### 4.5 Destination: Alpha Centauri / Proxima b

**What we actually know (as of 2025):**

- Distance: 4.2 light-years (Proxima Centauri specifically)
- Proxima Centauri b: estimated mass 1.055 +/- 0.055 Earth masses
- Radius: poorly constrained (0.94-1.4 Earth radii)
- Orbital period: 11.2 Earth days
- Semi-major axis: 0.04848 AU (very close to its star)
- Receives 30x more extreme-UV and 250x more X-rays than Earth
- Likely tidally locked (one face always toward star)
- UNKNOWN: whether it has an atmosphere, magnetic field, or surface water

**Habitability assessment:**
- Computer models show liquid water is possible under wide range of conditions
- Tidal locking creates extreme climate zones (permanent day/night sides)
- Habitable zone may be the terminator ring (boundary between day and night)
- Stellar flares from Proxima Centauri are frequent and intense
- Surface UV survival experiments suggest some Earth organisms COULD survive the flares

**For the game:**
Proxima b is the first destination, but it is NOT a paradise. It is a tidally locked
world orbiting a flare star, where the habitable zone is a narrow ring, and radiation
shielding is mandatory. Colonists live in domed settlements — essentially the same
arcology technology used on Earth and Mars, just in a more hostile environment.

### 4.6 Dyson Swarm (Not Sphere)

**The engineering reality:**

A solid Dyson sphere is physically impossible — the compressive forces would crush it.
Freeman Dyson himself proposed a SWARM: a loose collection of independent satellites
orbiting the star.

**Specifications (from published research):**
- Sun's total power output: 3.85 x 10^26 watts
- Practical energy capture at 2.13 AU: ~4% of stellar output = 15.6 yottawatts
- That is 850 BILLION times current human civilization's power consumption
- Construction: satellites built on Mars or asteroids, launched by electromagnetic accelerator
- Material: primarily silicon solar cells
- A Mars-based construction program could match Earth's 2019 power consumption (18.35 TW)
  within 50 years of starting
- Total swarm: over 5.5 billion satellites
- Material requirement: 1.3 x 10^23 kg of silicon (roughly equivalent to dismantling a
  small moon)
- Heat management is a critical problem: no atmospheric cooling in space

**WARNING (2025 research finding):**
A Dyson swarm of solar panels would actually make Earth UNINHABITABLE by altering the
thermal balance of the inner solar system. The swarm must be designed to re-radiate
absorbed energy in specific directions.

**Soviet Dyson swarm:**
- The ultimate five-year plan: each satellite is a production unit with a quota
- Construction quotas measured in satellites-per-year
- Swarm management bureaucracy: the Glavnoe Upravlenie Solnechnoi Energii
  (Main Directorate of Solar Energy)
- Satellite maintenance trudodni: workers in EVA suits repairing solar panels
  on an interplanetary scale
- Political problem: who controls the energy? The settlement that built the satellite?
  Or Moscow (which is now on a distant, possibly uninhabitable Earth)?

### 4.7 What Happens to Earth in 100,000 Years

**Geological/astronomical facts:**

- Ice ages: natural cycle every ~100,000 years. Next one WOULD occur in ~10,000 years
  but anthropogenic CO2 has likely prevented it. Over 100,000 years, at least one
  glacial period is expected (unless greenhouse gas levels remain elevated)
- Continental drift: minimal over 100,000 years (continents move ~2-5 cm/year,
  so ~2-5 km total displacement — negligible)
- Magnetic field reversal: average interval ~500,000 years. No reversal expected within
  100,000 years based on average, but the pattern is random. During reversals,
  magnetic field weakens, increasing surface radiation exposure
- Solar luminosity: increasing ~1% per 100 million years — negligible over 100,000 years
- Erosion: significant weathering of mountains, coastline changes
- Volcanic eruptions: statistically certain (several Pinatubo-scale events, possibly
  one supervolcano event)

**For the game:**
Over 100,000 years, the main Earth threats are:
1. Ice age cycles (if CO2 drops) — glaciation buries northern settlements
2. Supervolcano risk (Yellowstone, Campi Flegrei equivalents) — global cooling events
3. Cumulative industrial pollution (if not managed)
4. Asteroid impact probability increases with time
5. Societal entropy — can ANY bureaucracy maintain coherence for 100,000 years?

---

## 5. The Soviet Lens

### 5.1 Near-Future (2025-2100): Ecological Collapse Under Central Planning

**Five-Year Plan for Permafrost:**
Moscow mandates infrastructure reinforcement quotas. The player must allocate workers to
deep-pile foundation installation across all northern buildings. But the quota competes
with food production quotas. And the labor is dangerous (thawing ground + heavy
construction = workplace accidents).

The Aral Sea precedent is the game's DNA: Moscow's quotas destroyed an ecosystem.
Now Moscow's quotas will either save or destroy the Arctic infrastructure. The player
navigates the impossible middle.

**KGB and Ecological Reporting:**
Environmental monitoring data is classified. The player receives reports from local
scientists, but reporting the true severity to Moscow means admitting Soviet industry
caused the problem. Honest reporting = black marks for "anti-Soviet propaganda."
Dishonest reporting = inadequate response. The information problem of central planning
becomes lethal.

**Water Rationing:**
When the water table drops, the local Party committee implements rationing. But rationing
creates a black market. And the black market in water is FAR more lucrative (and dangerous)
than the black market in vodka. KGB surveillance intensifies. Trudodni for water
distribution become the most valuable labor category.

### 5.2 Medium-Future (2100-2500): Arcology Bureaucracy

**Five-Year Plan for Enclosed Cities:**
Each arcology is a construction project of unprecedented scale. Moscow mandates arcology
construction with specific capacity targets. The player must:
1. Allocate workers to construction (years of labor)
2. Allocate workers to agriculture within the new arcology
3. Maintain outdoor production during the transition
4. Meet BOTH old outdoor quotas AND new arcology construction quotas simultaneously

**Oxygen Quotas:**
In an enclosed habitat, oxygen production IS life. The Chlorella tanks and plant
cultivation areas have production quotas measured in kilograms of O2 per day. Falling
below quota means people suffocate. The most bureaucratically absurd quotas imaginable
are also the most existentially critical.

| O2 Production Target | Status |
|---------------------|--------|
| Met within 5% | Normal operations |
| Met within 10% | Warning — increased ventilation cycling |
| Met within 20% | Alert — non-essential areas sealed, rationing |
| Below 80% | Emergency — political meeting postponed (unprecedented!) |
| Below 60% | Critical — triage: seal off residential sections, prioritize agricultural |

**KGB in Enclosed Habitats:**
In an arcology, there is nowhere to run. Every corridor has a surveillance checkpoint.
Every communication is routed through central systems. The KGB's dream and the dissident's
nightmare. But also: the KGB itself is trapped. Political purges that remove workers
from an enclosed ecosystem are DIRECTLY harmful — you can't afford to lose the Chlorella
tank operator.

This creates a unique tension: the KGB must RESTRAIN its own purges to avoid killing
the habitat. The bureaucracy's self-destructive instincts are checked by physics.

**Black Market in an Arcology:**
Water rations become currency. Oxygen access becomes leverage. Agricultural workers can
skim food before it reaches the distribution system. The planned economy's inefficiencies
in an enclosed system create life-or-death inequalities.

### 5.3 Space Colonization (2100-5000): Kolkhoz on Mars

**Collective Farming in Space:**
The kolkhoz model translates directly to Mars: a group of workers assigned to a communal
farm, with mandatory deliveries to the settlement administration, seed fund retention,
and a remainder for personal consumption. The difference: the "field" is a pressurized
greenhouse, and crop failure means starvation within weeks, not seasons.

**Trudodni in Zero Gravity:**
The seven trudodni categories expand for space:

| Category | Earth | Space |
|----------|-------|-------|
| Agricultural | Field/farm work | Greenhouse/algae tank |
| Industrial | Factory shifts | ISRU processing, manufacturing |
| Construction | Building erection | Hull construction, regolith processing |
| Administrative | Office/planning | Same, but via radio delay |
| Cultural | Ideology sessions | Same (mandatory in all contexts) |
| Maintenance | Infrastructure repair | Life support system maintenance |
| Emergency | Crisis response | Hull breach repair, radiation shelter |
| NEW: EVA | N/A | Extravehicular activity (space walks) |
| NEW: Transit | N/A | Inter-habitat transfer labor |

**The Party Committee on Mars:**
Light-speed delay to Earth: 3-22 minutes (depending on orbital position). Moscow's
orders arrive with a delay, but they still arrive. The Mars Party Committee must interpret
directives that may be outdated by the time they arrive. This creates a natural
autonomy gradient: the farther from Earth, the more the local Party must improvise.

But also: the farther from Moscow, the more the local Party Secretary becomes a
de facto dictator. The game's political system becomes increasingly local and increasingly
dangerous as settlements spread across the solar system.

### 5.4 Deep Future (5000-100000): The Interstellar Bureaucracy

**Political Purges in Generation Ships:**
The existential nightmare. A generation ship with 40,000 people cannot afford to lose
population to purges. But the Party apparatus demands loyalty enforcement. The resolution:

- "Rehabilitation" in a generation ship means reassignment to agricultural labor (the Gulag
  IS the greenhouse)
- Execution (rasstrelyat) must be essentially banned — the gene pool cannot absorb losses
- Political deviance is managed through mandatory ideology sessions, not removal
- BUT: if ideological control weakens, the ship's political structure may fracture —
  compartment-by-compartment factionalism

**Doctrinal Drift:**
Over 500 years of isolation, the ship's Marxism-Leninism WILL diverge from Earth's.
The game tracks `doctrinalDrift` (0.0-1.0) that increases with distance and time.
At high drift:
- Earth transmissions are received but considered "revisionist"
- The ship develops its own "true" communism
- Internal schisms between "originalists" (Earth doctrine) and "progressives" (ship doctrine)
- Civil conflict in an enclosed vessel is existentially dangerous

**Five-Year Plans in Deep Space:**
The plan continues. It MUST continue. Without the plan, there is no resource allocation
framework. But the plan's targets must be set locally (light-years from Moscow).
The Ship Soviet becomes a self-governing entity that uses Soviet forms and language
but is functionally independent. The bureaucracy transcends its origin.

**The 100,000-Year Question:**
Can any political system maintain coherence for 100,000 years? The answer is almost
certainly no. The game's deep future should feature:
- Periodic "refounding" events where the political system collapses and re-establishes
- Language drift (Russian evolves beyond recognition after 10,000+ years)
- Technological regression and recovery cycles
- Religious/quasi-religious veneration of Lenin, Marx as mythological figures
- The Party as a priesthood maintaining ancient rituals whose original meaning is lost

---

## 6. Resource Systems for the Game

### 6.1 Resource Matrix by Era

Each resource below includes: when it starts mattering, per-capita rates, production
methods, and depletion mechanics. All numbers are derived from the engineering data above.

---

### 6.2 FOOD

**When it starts mattering:** Tick 1 (always critical)

**Per-capita rate:** 0.80 kg dry mass/person/day = 2,500 kcal/person/day

**Production methods by era:**

| Era | Method | Yield | Notes |
|-----|--------|-------|-------|
| 1917-1960 | Open-field agriculture | soilQuality * 4,000 kcal/m^2/year | Dependent on weather, soil |
| 1960-2100 | Mechanized agriculture | soilQuality * 6,000 kcal/m^2/year | +50% from mechanization |
| 2050-2200 | Greenhouse farming | 8,000 kcal/m^2/year (vertical) | Weather-independent |
| 2100+ | Vertical farms (enclosed) | 12,000-20,000 kcal/m^2/year (stacked) | Requires power |
| 2200+ | Aquaponics + algae | 15,000-25,000 kcal/m^2/year | Protein from fish + algae |
| Space | Hydroponic + algae | 10,000-15,000 kcal/m^2/year | BIOS-3 heritage |

**Area per person:**
- Open-field: 500-1,000 m^2 per person
- Greenhouse: 200-400 m^2 per person
- Vertical farm (8-story): 25-50 m^2 footprint per person
- Space hydroponics: 30-50 m^2 per person (with supplemental algae protein)

**Depletion mechanics:**
- Soil quality degrades with continuous farming without rotation: -1%/year
- Fertilizer (requires industrial chemistry) can offset degradation
- Climate change degrades southern soils faster: -2%/year post-2050
- Enclosed systems have no soil depletion but require power and nutrient cycling

---

### 6.3 WATER

**When it starts mattering:** Always tracked, but criticality varies

**Per-capita rate:**
- Drinking + food prep: 3.5 L/person/day (minimum)
- Total with hygiene: 4.4 L/person/day (ISS standard)
- Agricultural irrigation: 50-200 L/person/day (depending on crop and climate)
- Industrial: 10-50 L/person/day

**Production methods:**

| Context | Method | Recovery Rate |
|---------|--------|--------------|
| Earth (river access) | Infinite supply (not tracked) | N/A |
| Earth (arid/depleted) | Groundwater pumping | Depletion rate -0.1 units/year per farm |
| Enclosed habitat | Multi-stage recycling | 85-95% (BIOS-3 level) |
| ISS-class ECLSS | Advanced recycling | 93.5% |
| Future target | Brine + vapor processing | 98% |
| Lunar | Ice mining from PSR craters | Limited by mining rate + energy |
| Mars | Subsurface ice extraction | Limited by energy + processing |

**Depletion mechanics:**
- Water table: each settlement has a `waterTable` (0-100)
- Irrigation depletes: -0.1/year per irrigated tile
- Industrial use depletes: -0.05/year per factory
- Recovery: natural recharge +0.02/year (if rainfall exists)
- At waterTable < 20: crop yields halve, health events trigger
- At waterTable < 5: settlement becomes non-viable without water import

---

### 6.4 OXYGEN

**When it starts mattering:** First dome construction OR first off-Earth settlement

**Per-capita rate:** 0.84 kg/person/day (NASA standard)

**Production methods:**

| Method | Rate | Requirements |
|--------|------|-------------|
| Chlorella algae tanks | 0.1 kg O2/m^2/day | 8 m^2 per person, light, CO2, water |
| Higher plants (wheat etc.) | 0.04 kg O2/m^2/day | 15 m^2 per person, light, soil/hydroponic |
| Electrolysis (water splitting) | 0.84 kg O2 from 0.95 kg H2O/person/day | Electrical power |
| ISS OGS (Oxygen Generation System) | Electrolysis-based | 6 kW per crew of 6 |
| Sabatier reactor (CO2 + H2 -> CH4 + H2O) | Recovers 50% O2 from CO2 | Requires H2 input |

**Depletion mechanics:**
- Dome atmosphere has O2 percentage (target: 20.9%)
- O2 < 19%: headaches, reduced worker productivity
- O2 < 17%: impaired judgment, accidents increase 3x
- O2 < 14.5%: Biosphere 2 danger zone — cognitive impairment, system failure imminent
- O2 < 12%: unconsciousness within minutes, death within hours
- Leakage: enclosed habitats lose 5-10% atmosphere per year (must be replenished)
- Concrete absorption: CO2 reacts with concrete walls (Biosphere 2 lesson)
  Must be accounted for in Soviet-standard construction

---

### 6.5 POWER (ENERGY)

**When it starts mattering:** Always tracked (already in game as `power`)

**Per-capita rate (by development level):**
- Soviet village (1917): 0.1 kW/person (manual labor, wood burning)
- Soviet industrial (1940): 1-2 kW/person (electrification)
- Soviet modern (1970): 3-5 kW/person (heavy industry)
- Enclosed habitat: 5-10 kW/person (life support + lighting + agriculture)
- Space habitat: 10-15 kW/person (everything artificial)
- US modern equivalent: 9.5 kW/person (for reference)

**Production methods:**

| Era | Method | Output | Fuel/Resource |
|-----|--------|--------|--------------|
| 1917-1930 | Wood burning | 0.5 kW per stove | Timber (renewable if managed) |
| 1930-1950 | Coal power | 50-200 MW per plant | Coal (depletable) |
| 1950-2000 | Nuclear fission | 500-1000 MW per reactor | Uranium (depletable) |
| 2000-2100 | Nuclear + solar | Variable | Uranium + sunlight |
| 2100+ | Fusion (deuterium) | 500-2000 MW per reactor | Water (effectively infinite) |
| Space | Nuclear fission | 25-100 MW per reactor | Uranium/thorium |
| Deep space | Fusion | 500+ MW | Deuterium (from water) |
| Dyson era | Solar collection | Yottawatts total | Sunlight (star-dependent) |

**Depletion mechanics:**
- Fossil fuels (coal, oil, gas): finite deposits per settlement region
- Uranium: finite deposits globally, but sufficient for thousands of years
- Fusion fuel (deuterium from seawater): effectively inexhaustible
- Solar: infinite but intermittent (weather, dust storms on Mars, orbital position)
- The transition from fission to fusion is a critical bottleneck: fusion is hard,
  and Soviet bureaucracy may delay it through institutional inertia

---

### 6.6 CONSTRUCTION MATERIALS

**When it starts mattering:** Always (already partially tracked: timber, steel, cement, prefab)

**Extended materials by era:**

| Material | Available | Source | Per-Building Unit |
|----------|-----------|--------|------------------|
| Timber | 1917+ | Forests (renewable) | 10-50 units |
| Brick | 1917+ | Clay deposits (local) | 20-100 units |
| Steel | 1930+ | Iron ore + coal (depletable) | 50-200 units |
| Cement/Concrete | 1930+ | Limestone (abundant) | 30-150 units |
| Prefab panels | 1960+ | Factory production | 40-120 units |
| Aluminum | 2000+ | Bauxite ore (depletable) | 20-80 units |
| Carbon fiber | 2100+ | Industrial synthesis | 10-40 units |
| Regolith composite | Lunar/Mars | Local regolith (infinite) | 50-200 units |
| Asteroid metal | 2200+ | Asteroid mining | 100-500 units |
| Graphene laminate | 2300+ | Industrial synthesis | 5-20 units |

**Depletion mechanics:**
- Timber: sustainable if replanting outpaces harvesting (1 tree = 30 years to mature)
- Iron/steel: global reserves last thousands of years at current extraction rates
- Concrete: limestone is essentially inexhaustible on Earth
- Off-Earth: ALL materials must be locally sourced or shipped at enormous cost
- Asteroid-derived materials: per-asteroid deposits deplete in decades

---

### 6.7 RADIATION SHIELDING

**When it starts mattering:** First off-Earth settlement, or ~2100 on Earth if ozone fails

**Per-capita rate:** Not per-capita but per-habitat

**Exposure limits:**
- Earth background: 3-6.2 mSv/year (safe)
- NASA career limit: 600 mSv total
- Daily limit in free space: 1.3 mSv (NASA)
- Mars surface: 200-250 mSv/year (shielded habitat needed)
- Lunar surface: ~380 mSv/year (underground or regolith-covered)
- Deep space (unshielded): ~600-1000 mSv/year (lethal within 1-2 years)

**Shielding requirements:**
- Minimum effective: 20 g/cm^2 (against solar particle events)
- Recommended: 30 g/cm^2 (4-year mission tolerance)
- Lunar: 1.5-2.0 m regolith cover
- Mars: regolith/ice block walls, 1-2 m thick
- Space habitat: water walls, polyethylene, or metal hull (O'Neill cylinder wall provides
  significant shielding through mass)
- Storm shelter: additional 10 cm water-equivalent for solar storms

**Game implementation:**
- Each off-Earth building has a `shielding` attribute (g/cm^2)
- Workers in under-shielded buildings accumulate radiation exposure
- Cumulative exposure tracked per-worker (affects health, lifespan, cancer risk)
- Construction of shielding is a labor/material cost that competes with other priorities
- Quota for shielding construction: Moscow mandates minimum standards (but materials
  may be diverted to meet other quotas)

---

### 6.8 HYDROGEN

**When it starts mattering:** Industrialization era (existing), critical for space era

**Per-capita rate:** Industrial resource, not per-capita

**Production methods:**
- Electrolysis of water: 1 kg H2 from 9 kg H2O (requires 39.4 kWh electrical energy)
- Steam methane reforming: 1 kg H2 from 3.4 kg CH4 + 18.4 kWh
- Solar thermochemical: experimental, very high temperature

**Uses:**
- Rocket propellant (with O2)
- Fuel cells (power generation, especially mobile)
- Sabatier reaction (CO2 → CH4 for propellant on Mars)
- Industrial feedstock (ammonia for fertilizer)

**Depletion:** Water is the feedstock; hydrogen is manufactured, not mined.

---

### 6.9 RARE EARTH ELEMENTS

**When it starts mattering:** Thaw era (existing in design), critical for space technology

**Per-capita rate:** Industrial resource

**Production:** Mining from specific geological deposits (not uniformly distributed)

**Key uses in the game:**
- Electronics manufacturing (computers, control systems)
- Nuclear fuel processing
- Advanced materials (superconductors, magnets for fusion reactors)
- Satellite/communication systems

**Depletion:** Finite geological deposits. Off-Earth: asteroid mining provides access
to deposits orders of magnitude larger than Earth's.

---

### 6.10 HEAT (Thermal Management)

**When it starts mattering:** Always (already partially modeled as heating system)

**Evolution:**

| Era | Challenge | System |
|-----|-----------|--------|
| 1917-1950 | Keeping warm | Pechka (wood stove), then district heating |
| 1950-2100 | Keeping warm efficiently | Central heating (often failing, Soviet standard) |
| 2100+ (domes) | Removing waste heat | Enclosed habitats trap heat from lights + bodies |
| Space | Both heating AND cooling | Vacuum insulates; radiators needed for waste heat |
| Interstellar | Critical thermal management | Heat is the primary constraint on population density |

**The thermal paradox:**
In space, getting RID of heat is harder than staying warm. There is no atmosphere to
convect heat away. All excess energy must be radiated. This limits population density
in space habitats. A 10-million-person O'Neill cylinder produces tens of gigawatts of
waste heat from metabolism alone (each person emits ~100 W continuously).

**Game implementation:**
- Enclosed habitats have `thermalBalance` (-100 to +100)
- Negative: too cold (heating required)
- Positive: too hot (cooling required)
- Space habitats: radiator panels are a construction requirement
- Radiator area scales with population and power consumption
- Failure of thermal management: equally dangerous as O2 failure

---

### 6.11 NITROGEN

**When it starts mattering:** Off-Earth settlements

**Why it matters:**
Nitrogen makes up 78% of Earth's atmosphere and 60% of O'Neill cylinder atmosphere.
It is not reactive but is essential for:
- Atmospheric buffer (prevents pure-O2 fire risk)
- Fertilizer (ammonia synthesis)
- Life chemistry (amino acids, DNA)

**The hidden crisis:**
On Earth, nitrogen is essentially infinite. On the Moon, Mars, and asteroids, it is
RARE. Titan is the exception (98.4% N2 atmosphere). Nitrogen scarcity may be the
binding constraint for solar system colonization — driving the need for Titan settlements
to supply N2 to the inner system.

**Per-habitat rate:** ~2 kg N2/person/day leakage replacement (at 10%/year leak rate
for a habitat at 0.5 atm)

---

### 6.12 RESOURCE TRACKING SUMMARY

| Resource | 1917 | 2100 | 2500 | Space | Interstellar |
|----------|------|------|------|-------|-------------|
| Food | TRACKED | TRACKED | TRACKED | TRACKED | TRACKED |
| Water | ambient | TRACKED | TRACKED | TRACKED | TRACKED |
| Oxygen | ambient | dome-only | TRACKED | TRACKED | TRACKED |
| Power | TRACKED | TRACKED | TRACKED | TRACKED | TRACKED |
| Timber | TRACKED | minor | irrelevant | N/A | N/A |
| Steel | TRACKED | TRACKED | TRACKED | TRACKED | TRACKED |
| Cement | TRACKED | TRACKED | minor | local substitute | local substitute |
| Hydrogen | minor | TRACKED | TRACKED | TRACKED | TRACKED |
| Rare Earths | N/A | TRACKED | TRACKED | TRACKED | TRACKED |
| Uranium | N/A | TRACKED | TRACKED | TRACKED | N/A (fusion era) |
| Nitrogen | ambient | ambient | dome-only | TRACKED | TRACKED |
| Heat balance | cold problem | both | hot problem | critical | critical |
| Radiation | ambient | ambient | ambient | TRACKED | TRACKED |
| Soil quality | TRACKED | declining | irrelevant (hydro) | N/A | N/A |
| Water table | ambient | TRACKED | depleted | N/A | N/A |
| Pollution | accumulating | TRACKED | declining (enclosed) | N/A | N/A |

"ambient" = present but not tracked (infinite supply in current context)
"TRACKED" = actively managed resource with production/consumption/depletion
"N/A" = not applicable in this context

---

## 7. Sources

### Permafrost and Russian Infrastructure
- [ClimateChangePost: Russia Permafrost](https://www.climatechangepost.com/countries/russia/permafrost/)
- [Nature Communications: Degrading permafrost puts Arctic infrastructure at risk by mid-century](https://www.nature.com/articles/s41467-018-07557-4)
- [Polar Journal: Russia's Arctic infrastructure is becoming increasingly vulnerable](https://polarjournal.net/russias-arctic-infrastructure-is-under-threat/)
- [IRReview: Melting Permafrost Threatening Russia's Energy Industry](https://www.irreview.org/articles/2025/3/29/melting-permafrost-in-siberia-is-threatening-russias-energy-industry)

### Arctic Methane
- [Wikipedia: Clathrate gun hypothesis](https://en.wikipedia.org/wiki/Clathrate_gun_hypothesis)
- [ScienceDaily: Methane hydrate is not a smoking gun in the Arctic Ocean](https://www.sciencedaily.com/releases/2017/08/170822100400.htm)

### Agricultural Zone Shifts
- [Nature Scientific Reports: Northward shift of the agricultural climate zone under 21st-century global climate change](https://www.nature.com/articles/s41598-018-26321-8)
- [CSIS: Climate Change Will Reshape Russia](https://www.csis.org/analysis/climate-change-will-reshape-russia)
- [Resilience.org: Fantasy Acres: Will Climate Change Actually Create More Northern Farmland?](https://www.resilience.org/stories/2023-03-20/fantasy-acres-will-climate-change-actually-create-more-northern-farmland/)

### Aral Sea / Water Crisis
- [Columbia University: The Aral Sea Crisis](https://www.columbia.edu/~tmt2120/environmental%20impacts.htm)
- [Earth.Org: What Happened to the Aral Sea](https://earth.org/the-aral-sea-catastrophe-understanding-one-of-the-worst-ecological-calamities-of-the-last-century/)
- [NASA: World of Change: Shrinking Aral Sea](https://science.nasa.gov/earth/earth-observatory/world-of-change/aral-sea/)

### Industrial Pollution (Norilsk)
- [NBC News: How Norilsk became one of the most polluted places on Earth](https://www.nbcnews.com/news/world/norilsk-russian-arctic-became-one-polluted-places-earth-rcna6481)
- [Bellona: Industrial pollution in the Russian Arctic](https://bellona.org/news/industrial-pollution/2023-11-industrial-pollution-in-the-russian-arctic-is-an-environmental-nightmare-a-list-of-the-dirtiest-companies)
- [TIME: The World's Most Polluted Places](https://content.time.com/time/specials/2007/article/0,28804,1661031_1661028_1661022,00.html)

### Ozone Layer
- [WMO: Ozone and UV Bulletin](https://wmo.int/publication-series/wmo-ozone-and-uv-bulletin-no-3-september-2025)
- [UNEP: Ozone layer recovery on track](https://www.unep.org/news-and-stories/press-release/ozone-layer-recovery-track-helping-avoid-global-warming-05degc)

### BIOS-3
- [Wikipedia: BIOS-3](https://en.wikipedia.org/wiki/BIOS-3)
- [PubMed: Bios-3: Siberian experiments in bioregenerative life support](https://pubmed.ncbi.nlm.nih.gov/11540303/)
- [NASA NTRS: Bios-3 project](https://ntrs.nasa.gov/citations/20040089444)

### Biosphere 2
- [Wikipedia: Biosphere 2](https://en.wikipedia.org/wiki/Biosphere_2)
- [Space: Science & Technology: Biosphere 2's Lessons](https://spj.science.org/doi/10.34133/2021/8067539)
- [RyeStrategy: Biosphere 2: Why Did it Fail?](https://www.ryestrategy.com/blog/biosphere-2-learning-from-failure)

### ISS Life Support / ECLSS
- [Wikipedia: ISS ECLSS](https://en.wikipedia.org/wiki/ISS_ECLSS)
- [NASA: Water Recovery Milestone on ISS](https://www.nasa.gov/missions/station/iss-research/nasa-achieves-water-recovery-milestone-on-international-space-station/)
- [NASA ECLSS Fact Sheet](https://www.nasa.gov/wp-content/uploads/2020/10/g-281237_eclss_0.pdf)
- [FIU News: Water recycling on ISS](https://news.fiu.edu/2025/water-recycling-is-paramount-for-space-stations-and-long-duration-missions-an-environmental-engineer-explains-how-the-iss-does-it)

### O'Neill Cylinder
- [Wikipedia: O'Neill cylinder](https://en.wikipedia.org/wiki/O'Neill_cylinder)
- [NSS: O'Neill Cylinder Space Settlement](https://nss.org/o-neill-cylinder-space-settlement/)

### Mars Colonization / ISRU
- [NASA NTRS: Sustaining Human Presence on Mars Using ISRU](https://ntrs.nasa.gov/api/citations/20160006324/downloads/20160006324.pdf)
- [Geoffrey Landis: Making Rocket Propellant on Mars](http://www.geoffreylandis.com/propellant.html)
- [Marspedia: Carbon Dioxide Scrubbers](http://marspedia.org/Carbon_Dioxide_Scrubbers)

### Titan
- [NASA: Titan Facts](https://science.nasa.gov/saturn/moons/titan/facts/)
- [ESA: Titan's surface organics surpass oil reserves on Earth](https://www.esa.int/Science_Exploration/Space_Science/Cassini-Huygens/Titan_s_surface_organics_surpass_oil_reserves_on_Earth)
- [Wikipedia: Colonization of Titan](https://en.wikipedia.org/wiki/Colonization_of_Titan)

### Asteroid Mining
- [Wikipedia: Asteroid mining](https://en.wikipedia.org/wiki/Asteroid_mining)
- [NSS: Technical and Economic Feasibility of Mining NEAs](https://nss.org/the-technical-and-economic-feasibility-of-mining-the-near-earth-asteroids-2/)

### Space Elevator
- [ISEC: Tether Materials](https://www.isec.org/space-elevator-tether-materials)
- [ScienceDirect: Space elevator tether materials overview](https://www.sciencedirect.com/science/article/abs/pii/S0094576523001704)

### Interstellar Travel / Generation Ships
- [Wikipedia: Project Daedalus](https://en.wikipedia.org/wiki/Project_Daedalus)
- [Wikipedia: Generation ship](https://en.wikipedia.org/wiki/Generation_ship)
- [ScienceDirect: Genetically viable population for interstellar voyaging](https://www.sciencedirect.com/science/article/abs/pii/S0094576513004669)
- [Wikipedia: Breakthrough Starshot](https://en.wikipedia.org/wiki/Breakthrough_Starshot)
- [Centauri Dreams: Generation Ships and their Consequences](https://www.centauri-dreams.org/2025/08/15/generation-ships-and-their-consequences/)

### Proxima Centauri b
- [Wikipedia: Proxima Centauri b](https://en.wikipedia.org/wiki/Proxima_Centauri_b)
- [PMC: The Habitability of Proxima Centauri b](https://pmc.ncbi.nlm.nih.gov/articles/PMC5820795/)

### Dyson Swarm
- [Wikipedia: Dyson sphere](https://en.wikipedia.org/wiki/Dyson_sphere)
- [arXiv: Viability of a Dyson Swarm](https://arxiv.org/abs/2109.11443)
- [Phys.org: Dyson swarm would make Earth uninhabitable](https://phys.org/news/2025-03-dyson-swarm-solar-panels-earth.html)

### Earth's Deep Future
- [Space.com: Next ice age in 10,000 years unless climate change prevents it](https://www.space.com/the-universe/earth/the-next-ice-age-is-coming-in-10-000-years-unless-climate-change-prevents-it)
- [Wikipedia: Geomagnetic reversal](https://en.wikipedia.org/wiki/Geomagnetic_reversal)

### Life Support Numbers
- [NASA NTRS: Developing a Daily Metabolic Rate Profile](https://ntrs.nasa.gov/api/citations/20190027563/downloads/20190027563.pdf)
- [Nature: Body size implications for resource utilization in space](https://www.nature.com/articles/s41598-020-70054-6)
- [NASA: Radiation Protection Technical Brief](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-020-radiation-protection.pdf)
- [NSS: Orbital Space Settlement Radiation Shielding](https://nss.org/wp-content/uploads/2018/01/NSS-JOURNAL-Orbital-Space-Settlement-Radiation-Shielding.pdf)

### Vertical Farming
- [Oxford Academic: Vertical farming limitations by back-of-envelope calculations](https://academic.oup.com/plphys/article/198/3/kiaf056/8104144)
- [Agritecture: Do Vertical Farms Have the Energy?](https://www.agritecture.com/blog/2022/6/10/vertical-farms-have-the-vision-but-do-they-have-the-energy)

### Energy Consumption
- [Our World in Data: Energy use per person](https://ourworldindata.org/grapher/per-capita-energy-use)
- [AEI: Each American has 600 human energy servants](https://www.aei.org/carpe-diem/each-american-has-the-energy-equivalent-of-nearly-600-full-time-human-energy-servants-2/)
