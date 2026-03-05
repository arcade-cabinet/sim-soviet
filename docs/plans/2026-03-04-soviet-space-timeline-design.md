---
type: design
status: draft
---

# Soviet Space Timeline: From Sputnik to the Stars

## "The cosmos is ours. File the paperwork."

### Design Philosophy

This document defines a **parallel progression track** — the Space Timeline — that runs
alongside SimSoviet 1917's historical/freeform timeline. It represents Soviet space
exploration from Sputnik (1957) through interstellar colonization (100,000+ years). Every
milestone is grounded in real physics, real Soviet history, and real engineering constraints.

The Space Timeline is NOT a tech tree the player researches. It is an **autonomous system**
driven by population pressure, ecological collapse, resource depletion, and bureaucratic
momentum. If you survive long enough and the prerequisites exist, space happens. The player's
role is to navigate the bureaucratic consequences: who gets sent to the Moon colony? How do
you falsify the helium-3 mining quotas? What happens when the Mars commissar outranks you?

**Three axioms:**
1. Hard science only. Every delta-v number, transit time, and life support figure comes from
   real data. No warp drives. No artificial gravity plates. No faster-than-light anything.
2. Soviet through and through. Five-Year Plans in space. KGB on the Moon. Quota systems for
   asteroid mining. The filing system for interplanetary cargo weighs more than the cargo.
3. Dual-use timeline. Works for BOTH historical mode (real Soviet dates) AND freeform mode
   (milestone-triggered by pressure conditions and tech prerequisites).

---

## Table of Contents

1. [Historical Foundation](#1-historical-foundation)
2. [Alt-History Divergence](#2-alt-history-divergence)
3. [Space Timeline Milestones](#3-space-timeline-milestones)
4. [Tech Tree](#4-tech-tree)
5. [Settlement Types](#5-settlement-types)
6. [The Soviet Aesthetic](#6-the-soviet-aesthetic)
7. [Game Mechanics](#7-game-mechanics)
8. [Cold Branch Integration](#8-cold-branch-integration)
9. [Sources](#9-sources)

---

## 1. Historical Foundation

### 1.1 The Real Soviet Space Program — Complete Timeline

The Soviet space program was arguably the most successful government program in human history
during its peak years (1957-1971). Understanding what actually happened — and what was
planned but never realized — is essential for building the alt-history divergence.

#### Firsts (all Soviet)

| Date | Achievement | Details |
|------|-------------|---------|
| 1957-10-04 | First artificial satellite | **Sputnik 1**, 83.6 kg, orbited for 3 months |
| 1957-11-03 | First animal in orbit | **Laika** aboard Sputnik 2 (did not survive reentry) |
| 1959-01-02 | First object to escape Earth's gravity | **Luna 1**, flyby of the Moon |
| 1959-09-14 | First impact on another celestial body | **Luna 2** impacts the Moon |
| 1959-10-07 | First photos of the far side of the Moon | **Luna 3** |
| 1961-04-12 | **First human in space** | **Yuri Gagarin**, Vostok 1, 108-minute orbital flight |
| 1963-06-16 | First woman in space | **Valentina Tereshkova**, Vostok 6, 70.8 hours |
| 1964-10-12 | First multi-person spacecraft | **Voskhod 1**, 3-person crew |
| 1965-03-18 | **First spacewalk (EVA)** | **Alexei Leonov**, Voskhod 2, 12 min 9 sec |
| 1966-03-01 | First probe to enter another planet's atmosphere | **Venera 3** (crashed on Venus) |
| 1970-12-15 | First soft landing on another planet | **Venera 7** on Venus surface |
| 1970-11-17 | First robotic rover on another world | **Lunokhod 1**, 10.5 km traversed |
| 1971-04-19 | **First space station** | **Salyut 1**, crew of 3, 175 days in orbit |
| 1975-10-20 | First images from another planet's surface | **Venera 9** from Venus |
| 1981-10-30 | First sounds recorded on another planet | **Venera 13** on Venus surface |
| 1986-02-20 | First modular space station | **Mir**, operational until 2001 |
| 1988-11-15 | First fully automated spaceplane flight | **Buran** shuttle, autonomous landing |

#### Venera Program — The Forgotten Triumph

The Venera program (1961-1983) represents perhaps the most audacious and underappreciated
achievement in space exploration history. The Soviets sent 28 spacecraft to Venus, landing
8 successfully on the surface — a world with 92 atm of pressure and 464 C surface
temperature.

Key Venera achievements:
- **Venera 7** (1970): First successful soft landing on another planet. Transmitted data for
  23 minutes from the surface at 475 C and 90 atm.
- **Venera 9** (1975): First photograph from the surface of another planet. Showed a field
  of sharp-edged rocks, roughly 30-40 cm across, under an orange sky.
- **Venera 13** (1982): Transmitted the first color photographs from Venus and the first
  audio recording of sounds on another planet — the Venusian wind. Survived 127 minutes.
- **Venera 15/16** (1983): First synthetic aperture radar mapping of Venus from orbit.

For the game, the Venera program is critical: the Soviets have MORE experience with extreme
environment surface operations than anyone. This expertise is the foundation for later
off-world habitat construction.

#### Lunokhod Rovers

The Soviets deployed the first robotic rovers to another world:
- **Lunokhod 1** (1970): 10.54 km traversed, 20,000 TV images, 200 panoramas, 500+ soil
  tests. Operated 11 months.
- **Lunokhod 2** (1973): 37 km traversed (a record not broken until Opportunity in 2014),
  86 panoramic images, 80,000+ TV pictures.

Specifications: ~840 kg, 170 cm long, 160 cm wide, 8 independently driven wheels. Two
speeds: 1 km/h and 2 km/h. Powered by solar panels with polonium-210 radioisotope heater.

#### Space Stations — The Soviet Specialty

Where the Americans excelled at one-shot missions (Apollo), the Soviets mastered long-duration
habitation:

| Station | Years | Max Crew | Longest Stay | Key Innovation |
|---------|-------|----------|--------------|----------------|
| Salyut 1 | 1971 | 3 | 24 days | First space station |
| Salyut 3 (Almaz) | 1974 | 3 | 15 days | Military recon, 23mm cannon |
| Salyut 4 | 1975 | 3 | 63 days | Scientific research |
| Salyut 5 (Almaz) | 1976 | 3 | 49 days | Military photo-recon |
| Salyut 6 | 1977-82 | 6 | 185 days | Two docking ports, refueling |
| Salyut 7 | 1982-86 | 6 | 237 days | Modular expansion |
| Mir | 1986-2001 | 6 | 437 days (Polyakov) | Fully modular, 7 modules |

Mir was a 129,700 kg complex, 19m x 31m x 27.5m, with 350 m^3 pressurized volume. It was
occupied for 12.5 of its 15-year lifespan. The longest single spaceflight record was set on
Mir by Valeri Polyakov: 437 days and 18 hours (1994-1995).

#### Almaz — The Armed Space Station

The Almaz program (1964-1978) was the only known armed crewed military spacecraft ever flown.
Three stations were launched (disguised as civilian Salyut stations):
- Equipped with a modified **23mm Rikhter rapid-fire cannon** from the Tupolev Tu-22 bomber
  tail gun, theoretical rate of fire 1,800-2,600 rounds/minute.
- Salyut 3 reportedly test-fired the cannon in orbit (unmanned, 1975).
- 4.15m maximum diameter, ~20 tonnes, 47.5 m^3 habitable volume.

For the game: the Soviet military space program is NOT cosmetic. The Almaz lineage directly
leads to armed orbital platforms, military lunar bases, and eventually Mars garrison stations.

#### N1 Rocket — The Moon That Wasn't

The N1 was the Soviet answer to Saturn V:
- 105 m tall, 2,750 tonnes at liftoff
- 30 NK-15 engines on the first stage (most engines ever clustered)
- Designed to place 95 tonnes in LEO
- ALL FOUR test launches failed (1969-1972):
  - 1969-02-21: Engine fire at T+66 seconds
  - 1969-07-03: Engine ingestion of debris at T+0.5 seconds — crashed on launch pad in
    one of the largest non-nuclear explosions in history (equivalent to 7 kilotons of TNT)
  - 1971-06-27: Roll control failure at T+51 seconds
  - 1972-11-23: Reached 40 km altitude before first-stage failure

The fundamental problem: no full-scale static test firing was ever conducted. The 30-engine
cluster had interaction dynamics that could not be predicted without testing, but no test
stand at Baikonur could handle the thrust.

Program suspended 1974, cancelled 1976. Two unused flight-ready N1s were scrapped. Their
engine fairings were repurposed as sheds and garages at Baikonur.

#### Energia — The Almost-Successor

Energia (1987) was the Soviet super-heavy lift vehicle that succeeded where N1 failed:
- 58.8 m tall, 2,400 tonnes at liftoff
- 4 x RD-170 strap-on boosters (kerosene/LOX) + 4 x RD-0120 core engines (LH2/LOX)
- **100-105 tonnes to LEO** at 200 km / 51 degrees inclination
- First flight: 1987-05-15 (Polyus payload failed to orbit due to software error)
- Second flight: 1988-11-15 (Buran shuttle, successful)
- Only two flights before program cancelled post-Soviet collapse

Energia is critical for the alt-history: if the USSR survives, Energia continues. It was
already flight-proven and more capable than any Western launcher of its era.

#### Soviet Nuclear Space Technology

The USSR was the world leader in space nuclear technology:

**TOPAZ Reactor:**
- Thermionic conversion nuclear reactor for space power
- 5 kWe electrical output (TOPAZ-I) — most powerful known nuclear system in space
- Liquid-metal cooled, highly enriched uranium fuel
- Flown on Kosmos 1818 and 1867 (1987)

**RD-0410 Nuclear Thermal Engine:**
- Developed 1965-1985 by Chemical Automatics Design Bureau (Voronezh)
- Ground-tested at Semipalatinsk in 1985
- **Specific impulse: 910 seconds** (superior to American NERVA program's best results)
- Hydrogen propellant, uranium carbide/tungsten carbide fuel
- Compact design: zirconium hydride moderator with thermal insulation
- Planned for the Kurchatov Mars 1994 crewed mission proposal
- Development halted with the Soviet collapse

For the game: the USSR had a **working nuclear thermal engine** with better Isp than NERVA.
If the collapse never happens, NTP-powered Mars missions become feasible in the 1990s.

### 1.2 Programs That Were Planned But Never Realized

#### TMK — Heavy Interplanetary Spacecraft (1960)

The TMK (Tyazhelyy Mezhplanetnyy Korabl) was a proposed crewed Mars flyby mission:
- 3 cosmonauts, 3-year mission
- Launch date: June 8, 1971; return: July 10, 1974
- Free-return trajectory using Mars gravity assist
- Remote-controlled surface probes deployed during flyby
- Required assembly in Earth orbit using N1 launches
- Cancelled when N1 failed

#### TMK-E — The Nuclear Mars Train (1966)

A more ambitious variant proposed nuclear electric propulsion:
- 630-day total mission duration
- Nuclear electric engines (ion drives powered by onboard reactor)
- Surface expedition with a nuclear-powered "Mars Train" — five landers delivering
  a mobile surface laboratory on wheels
- One-year surface stay

#### MEK — Mars Expeditionary Complex (1969)

- 3-6 crew members
- 630-day total mission duration
- Multiple N1 launches for orbital assembly
- Surface landing capability (unlike TMK flyby)
- Also cancelled with N1 failure

#### Zvezda (DLB) Lunar Base (1962-1974)

The Zvezda ("Star") project was a Soviet plan for a permanent crewed lunar base:
- Ordered by Korolev to Vladimir Barmin's SpetsMash bureau
- Crew of 9-12 cosmonauts
- **Nine modules:** command post, laboratory, warehouse, workshop, medical center with
  gymnasium, galley with canteen, and three living compartments
- Energy: atomic batteries and nuclear reactor
- Modules potentially mounted on wheel chassis, dockable to form a "movable train"
- Habitation modules covered with regolith for radiation shielding
- Lunokhod rovers for site preparation before crew arrival
- Cancelled with N1 failure (no delivery vehicle)
- Detractors nicknamed it "Barminograd"

For the game: Zvezda is the direct ancestor of the Soviet lunar settlement. When the N1
equivalent succeeds in the alt-history, Barminograd finally gets built.

### 1.3 Tsiolkovsky and Russian Cosmism

The philosophical foundation of Soviet space exploration predates the Soviet Union itself.
Konstantin Tsiolkovsky (1857-1935) was not just a rocket scientist — he was a visionary
who saw space colonization as humanity's cosmic destiny.

**Key contributions:**
- Published the rocket equation in 1903 ("Exploration of the Universe with Reaction Machines")
- Proposed multi-stage rockets, space stations, airlocks, and orbital manufacturing
- Envisioned space elevators (1895), solar energy in space, and asteroid habitats
- 1926: Published "Plan of Space Exploration" — a 16-step roadmap from rocketry to
  interstellar colonization and the transformation of the solar system

**Russian Cosmism:**
Tsiolkovsky was a disciple of philosopher Nikolai Fyodorov and a practitioner of "Russian
Cosmism" — a philosophical movement holding that:
- Humanity's purpose is to spread consciousness throughout the cosmos
- Space colonization leads to the perfection of the human species
- Every atom is a living, sentient entity (panpsychism)
- Death itself will eventually be conquered through cosmic mastery

The Soviet state suppressed the mystical elements of cosmism but embraced its practical
implications: the cosmos is humanity's destiny, and the socialist state will lead the way.

For the game: Cosmism is the IDEOLOGICAL ENGINE of the space timeline. It is not optional
philosophy — it is state doctrine. Pravda headlines quote Tsiolkovsky. Schoolchildren memorize
his 16-step plan. KGB agents enforce enthusiasm for the space program. Dissent against
space expansion is ideologically equivalent to dissent against the Revolution itself.

### 1.4 BIOS-3 — The Soviet Closed Ecosystem

BIOS-3 (1972, Institute of Biophysics, Krasnoyarsk) was the world's first successful closed
ecological life support system — a direct precursor to space habitat design.

**Specifications:**
- 315 m^3 underground steel structure
- Capacity: up to 3 persons
- 4 compartments: crew quarters (3 single cabins, galley, lavatory, control room),
  1 algal cultivator, 2 phytotrons (wheat/vegetables)
- Plants provided ~25% of air filtration
- Lighting: 20 kW xenon lamps per compartment (simulating sunlight)
- 10 crewed closure experiments conducted
- Longest experiment: **180 days with 3-person crew** (1972-1973)

BIOS-3 directly informed Biosphere 2 (1991). A delegation from Biosphere 2 visited BIOS-3
in 1989 and acknowledged its foundational importance.

For the game: BIOS-3 is the tech prerequisite for ALL closed-environment habitats. The
Krasnoyarsk data drives the life support numbers for lunar bases, Mars habitats, and orbital
stations. Without this research, dome construction is impossible.

---

## 2. Alt-History Divergence

### 2.1 The Divergence Point: 1991 Never Happens

In SimSoviet 1917, the Soviet Union never collapses. The consequences for the space program
are profound and specific:

**What continues uninterrupted:**
- Energia production line (not scrapped)
- RD-0410 nuclear thermal engine development (not halted)
- Buran shuttle program (not cancelled after one flight)
- Mir station operations (not deorbited in 2001)
- TOPAZ reactor program (not sold off to Americans)
- Baikonur Cosmodrome (not leased to Kazakhstan)

**What gets a second chance:**
- N1 successors (Energia-derived super-heavy variants)
- Zvezda lunar base (delivery vehicle now exists)
- TMK/MEK Mars expeditions (NTP engine ready by 1990s)
- BIOS-3 follow-on experiments (closed ecosystem for space)
- Almaz military space station lineage (orbital weapons platforms)

### 2.2 The Soviet Space Advantage

The USSR had structural advantages for space colonization that capitalism lacks:

1. **Central planning**: Can allocate 5-10% of GDP to space without shareholder revolt
2. **Forced labor**: Can send workers to lunar mines involuntarily (gulag tradition)
3. **Ideology**: Cosmism provides genuine mass enthusiasm for space expansion
4. **Long-term thinking**: Five-Year Plans can span decades without electoral disruption
5. **Risk tolerance**: Higher acceptable casualty rates than Western programs
6. **Existing expertise**: More person-hours in orbit than any other nation (Mir legacy)
7. **Nuclear capability**: RD-0410 NTP engine, TOPAZ reactors, nuclear icebreaker fleet

But also structural disadvantages:

1. **Bureaucratic inertia**: Every decision requires 17 approval signatures
2. **Information suppression**: Failure data hidden, lessons not learned
3. **Corruption**: Materials diverted, quality control compromised
4. **Political interference**: Programs cancelled for political, not technical, reasons
5. **Brain drain prevention via coercion**: Scientists cannot leave, but also cannot freely
   collaborate internationally
6. **Quota perversion**: Space quotas create perverse incentives (faking telemetry data,
   launching half-ready systems to meet Five-Year Plan deadlines)

### 2.3 Alt-History Space Milestones

| Real History Date | What Happened | Alt-History Date | What Happens Instead |
|-------------------|--------------|------------------|---------------------|
| 1969 (N1 explodes) | Lunar program cancelled | 1972 | N1M (modified) succeeds after Glushko takes over |
| 1969 (Apollo 11) | US lands on Moon first | 1974 | First Soviet crew lands on Moon (2 years late) |
| 1974-76 (N1 cancelled) | Program killed | 1976 | Energia predecessor tested, validated |
| 1976 (Zvezda cancelled) | Lunar base abandoned | 1980 | Zvezda Module 1 delivered to lunar surface |
| 1985 (RD-0410 tested) | Program stalls | 1988 | RD-0410 flight-qualified for Mars mission |
| 1987 (Energia flies) | Only 2 flights ever | 1987-2010 | 50+ Energia launches, lunar cargo delivery |
| 1988 (Buran flies) | Only 1 flight ever | 1990-2030 | Buran fleet of 5 shuttles operational |
| 1991 (USSR collapses) | Space program gutted | 1991 | 8th Five-Year Space Plan approved |
| Never happened | Mars mission | 1995 | TMK-E flyby (NTP powered, 3 crew, 630 days) |
| Never happened | Mars landing | 2003 | MEK-1 landing (6 crew, 18-month surface stay) |
| Never happened | Permanent Mars base | 2015 | Mars Base Gagarin (12 crew, ISRU operational) |
| Never happened | Asteroid mining | 2040 | First automated asteroid capture and processing |

---

## 3. Space Timeline Milestones

### 3.1 Complete Milestone Progression

The following table covers the full progression from Sputnik (1957) through deep future
(100,000+ years). For historical mode, the "Year" column gives the target date. For freeform
mode, milestones trigger based on prerequisite completion and pressure conditions.

#### Era 1: The Space Race (1957-1975)

| ID | Year | Milestone | Prerequisites | Creates Settlement? |
|----|------|-----------|--------------|-------------------|
| sputnik | 1957 | Sputnik launch | None | No |
| vostok | 1961 | First human in orbit | sputnik | No |
| voskhod_eva | 1965 | First spacewalk | vostok | No |
| venera_landing | 1970 | First planetary surface landing | vostok | No |
| lunokhod | 1970 | Robotic lunar rover | venera_landing | No |
| salyut | 1971 | First space station | voskhod_eva | No |
| lunar_landing | 1974* | First crewed lunar landing | salyut, N1M success | No |

*Alt-history date. Real history: never achieved by USSR.

#### Era 2: Permanent Presence (1975-2000)

| ID | Year | Milestone | Prerequisites | Creates Settlement? |
|----|------|-----------|--------------|-------------------|
| zvezda_base | 1980 | Zvezda Lunar Base (9-12 crew) | lunar_landing | **Yes (Moon)** |
| mir_station | 1986 | Mir space station | salyut | No |
| energia_operational | 1987 | Energia super-heavy launcher | N1M program | No |
| buran_fleet | 1990 | Buran shuttle fleet (5 vehicles) | energia_operational | No |
| ntp_qualified | 1988 | Nuclear thermal propulsion flight-ready | RD-0410 ground tests | No |
| mars_flyby | 1995 | TMK-E Mars flyby (3 crew) | ntp_qualified, mir_station | No |
| bios_orbital | 1997 | Orbital closed ecosystem (BIOS-4) | mir_station, BIOS-3 data | No |

#### Era 3: Interplanetary (2000-2100)

| ID | Year | Milestone | Prerequisites | Creates Settlement? |
|----|------|-----------|--------------|-------------------|
| mars_landing | 2003 | MEK-1 Mars landing (6 crew) | mars_flyby, ntp_qualified | No |
| mars_base | 2015 | Mars Base Gagarin (12 crew) | mars_landing, bios_orbital | **Yes (Mars)** |
| lunar_mining | 2020 | Helium-3 mining operations | zvezda_base, fusion_research | No |
| orbital_factory | 2025 | First orbital manufacturing | buran_fleet, energia_operational | No |
| asteroid_survey | 2030 | Near-Earth asteroid survey fleet | orbital_factory | No |
| space_elevator_study | 2035 | Space elevator feasibility program | orbital_factory | No |
| mars_expansion | 2040 | Mars Base Gagarin expansion (50 crew) | mars_base, lunar_mining | No |
| asteroid_capture | 2045 | First asteroid capture/processing | asteroid_survey | No |
| phobos_station | 2050 | Phobos orbital station | mars_expansion | **Yes (Phobos)** |
| venus_aerostat | 2060 | Venus atmospheric research station | venera_legacy, bios_orbital | No |
| fusion_reactor | 2070 | First fusion power plant (terrestrial) | lunar_mining (He-3) | No |
| orbital_habitat_1 | 2080 | First O'Neill-type habitat (1,000 pop) | orbital_factory, fusion_reactor | **Yes (LEO)** |
| mars_city | 2090 | Mars city (500+ permanent residents) | mars_expansion, fusion_reactor | No |
| ceres_station | 2100 | Ceres mining outpost | asteroid_capture, ntp_qualified | **Yes (Ceres)** |

#### Era 4: Solar System (2100-2500)

| ID | Year | Milestone | Prerequisites | Creates Settlement? |
|----|------|-----------|--------------|-------------------|
| space_elevator | 2120 | Operational space elevator | space_elevator_study, materials_science | No |
| venus_cloud_city | 2150 | Venus cloud colony (50 km altitude) | venus_aerostat, bios_orbital | **Yes (Venus)** |
| jupiter_relay | 2160 | Jupiter system relay station | ceres_station, ntp_qualified | No |
| europa_probe | 2170 | Europa subsurface ocean probe | jupiter_relay | No |
| titan_outpost | 2200 | Titan hydrocarbon colony | jupiter_relay, mars_city | **Yes (Titan)** |
| stanford_torus | 2250 | Stanford Torus habitat (10,000 pop) | orbital_habitat_1, space_elevator | **Yes (L5)** |
| mars_terraform_begin | 2300 | Mars terraforming program initiated | mars_city, fusion_reactor | No |
| mercury_solar | 2350 | Mercury solar collection array | space_elevator, orbital_factory | No |
| oneill_cylinder | 2400 | O'Neill Cylinder (100,000+ pop) | stanford_torus, asteroid_capture | **Yes (L4)** |
| outer_system_net | 2500 | Saturn/Uranus/Neptune relay network | titan_outpost, ntp_qualified | No |

#### Era 5: Stellar Civilization (2500-10000)

| ID | Year | Milestone | Prerequisites | Creates Settlement? |
|----|------|-----------|--------------|-------------------|
| dyson_start | 3000 | Dyson swarm construction begins | mercury_solar, oneill_cylinder | No |
| antimatter_prod | 3500 | Antimatter production facility | dyson_start, particle_physics | No |
| mars_breathable | 4000 | Mars atmosphere breathable outdoors | mars_terraform_begin + 1700 yrs | No |
| interstellar_probe | 4500 | First interstellar probe (1% c) | antimatter_prod | No |
| dyson_10pct | 5000 | Dyson swarm at 10% stellar coverage | dyson_start | No |
| generation_ship_design | 6000 | Generation ship design approved | interstellar_probe, oneill_cylinder | No |
| generation_ship_launch | 8000 | First generation ship launched | generation_ship_design, dyson_10pct | **Yes (interstellar)** |
| oort_stations | 10000 | Oort Cloud relay stations | generation_ship_launch | **Yes (Oort)** |

#### Era 6: Galactic (10000-100000+)

| ID | Year | Milestone | Prerequisites | Creates Settlement? |
|----|------|-----------|--------------|-------------------|
| proxima_arrival | 12000 | Generation ship arrives at Proxima | generation_ship_launch + 4000 yrs | **Yes (exoplanet)** |
| stellar_engine | 15000 | Shkadov thruster construction | dyson_10pct, antimatter_prod | No |
| dyson_complete | 20000 | Dyson swarm at 90%+ coverage | dyson_start | No |
| matrioshka_begin | 25000 | Matrioshka brain construction starts | dyson_complete | No |
| second_wave | 30000 | Second generation ship wave (5 ships) | proxima_arrival, generation_ship_design | **Yes (multiple)** |
| local_group | 50000 | Local stellar neighborhood colonized | second_wave | No |
| galactic_network | 100000 | Interstellar communication network | local_group | No |

### 3.2 Milestone Detail Cards

#### Zvezda Lunar Base (1980)

**Based on:** Real Zvezda DLB program (1962-1974, designed by Barmin's SpetsMash bureau)

**Physical specifications:**
- 9 modules: command post, laboratory, warehouse, workshop, medical center w/ gym,
  galley w/ canteen, 3 living compartments
- Crew: 9-12 cosmonauts on rotating 6-month tours
- Power: TOPAZ-derived nuclear reactor (50 kWe)
- Shielding: 2-3m regolith cover over habitation modules
- Mobility: modules on wheel chassis, dockable as "movable train"
- Life support: BIOS-3-derived closed loop (85% recycling efficiency)

**Lunar environment:**
- Gravity: 0.166 g (1.62 m/s^2)
- Atmosphere: none (fully pressurized habitat)
- Temperature: -173 C (night) to +127 C (day), 14-day cycles
- Radiation: ~380 mSv/year without shielding (Earth average: 2.4 mSv/year)
- Regolith shielding reduces to ~60 mSv/year (acceptable for 2-year tours)

**Delta-v budget (Earth surface to lunar surface):**
- LEO insertion: ~9.4 km/s
- Trans-lunar injection: ~3.1 km/s
- Lunar orbit insertion: ~0.9 km/s
- Lunar descent: ~1.7 km/s
- **Total: ~15.1 km/s** (one-way, no aerobraking)

**Game settlement profile:**
```
terrain:
  gravity: 0.166
  atmosphere: none
  water: ice_deposits
  farming: hydroponics
  construction: pressurized_domes
  baseSurvivalCost: very_high
```

#### Mars Base Gagarin (2015)

**Based on:** TMK/MEK proposals + Zubrin's Mars Direct + BIOS-3 life support

**Physical specifications:**
- Initial: 4 habitat modules (Mars Direct style, 8m diameter tuna cans)
- Expanded (2040): 12 modules, underground tunnels, greenhouse domes
- Crew: 12 initial, 50 by 2040, 500+ by 2090
- Power: Nuclear reactor (RD-0410 derivative) + solar array backup
- ISRU: Sabatier reactor producing methane/LOX from atmospheric CO2 + subsurface ice
- Life support: BIOS-4 closed loop (90% recycling, greenhouse supplementation)

**Mars environment:**
- Gravity: 0.379 g (3.72 m/s^2)
- Atmosphere: 0.6% Earth pressure, 95% CO2
- Temperature: -60 C average (-125 C to +20 C)
- Radiation: 240-300 mSv/year on surface (40-50x Earth average)
- Shielding: 2-3m regolith cover or lava tube habitation
- Water: Subsurface ice confirmed (Phoenix lander, 2008)

**Transit:**
- Hohmann transfer: ~9 months each way
- NTP (nuclear thermal): ~4 months each way
- Launch window: every 26 months (synodic period)
- Delta-v (LEO to Mars surface): ~5.7 km/s (with aerobraking)
- Delta-v (Mars surface to LEO): ~5.6 km/s (ISRU propellant)

**Game settlement profile:**
```
terrain:
  gravity: 0.379
  atmosphere: thin_co2
  water: subsurface
  farming: greenhouse
  construction: pressurized_domes
  baseSurvivalCost: high
```

#### Venus Cloud Colony (2150)

**Based on:** Real Venus atmospheric data + NASA HAVOC concept + Venera program heritage

Venus is a terrible place to land but a surprisingly good place to FLOAT. At 50 km altitude:
- Temperature: ~75 C (hot but manageable with cooling)
- Pressure: ~1 atm (same as Earth sea level)
- Gravity: 0.905 g (nearly Earth-normal)
- Atmosphere above: CO2, but breathable air (N2/O2 mix) is a LIFTING GAS on Venus
  (density ~1.2 kg/m^3 vs Venus atmosphere ~1.6 kg/m^3 at that altitude)
- Solar energy: 1.9x Earth's solar constant (closer to Sun)

A habitat filled with Earth-normal air would float like a balloon on Venus.

**Game settlement profile:**
```
terrain:
  gravity: 0.905
  atmosphere: thick_n2_ch4   # actually CO2/N2/SO2 but game simplification
  water: none                # must be imported or extracted from atmosphere
  farming: hydroponics
  construction: pressurized_domes
  baseSurvivalCost: extreme
```

#### Titan Outpost (2200)

**Based on:** Cassini-Huygens data + Titan atmospheric analysis

Titan is the only moon in the solar system with a dense atmosphere:
- Gravity: 0.138 g (1.35 m/s^2)
- Atmosphere: 1.5 atm pressure, 95% nitrogen, 5% methane
- Temperature: -179 C (cryogenic — methane is liquid)
- Surface: methane/ethane lakes, water-ice "bedrock"
- No radiation concern (Saturn's magnetosphere shields Titan)

Key resource: HYDROCARBONS. Titan's surface has more hydrocarbons than all of Earth's
known oil and natural gas reserves combined. Methane lakes contain roughly 9,000 km^3 of
liquid methane/ethane.

**Transit:**
- Earth to Saturn/Titan via Hohmann transfer: ~6.5 years
- With NTP: ~3 years
- Delta-v (Earth orbit to Titan orbit): ~15.7 km/s (with gravity assists: ~7 km/s)

**Game settlement profile:**
```
terrain:
  gravity: 0.138
  atmosphere: thick_n2_ch4
  water: methane_lakes   # water-ice exists as "bedrock"
  farming: impossible     # too cold for any biology — must import
  construction: standard  # low gravity, dense atmosphere — structural loads are manageable
  baseSurvivalCost: extreme
```

#### O'Neill Cylinder (2400)

**Based on:** Gerard O'Neill's 1975 study at Princeton/NASA Ames

**Specifications:**
- Two counter-rotating cylinders, each 8 km diameter x 32 km long
- Total land area: ~500 square miles
- Population capacity: 100,000 - 820,000
- Rotation: ~28 revolutions/hour for 1 g on inner surface
- 6 lengthwise strips: 3 habitable "land," 3 transparent windows
- Outer agricultural ring: 32 km diameter
- Atmosphere: 20% O2 at Earth partial pressure, 30% N2
- Radiation shielding: 4.5 tonnes/m^2 of regolith/slag (from asteroid processing)

**Construction:**
- Materials: primarily from lunar regolith and asteroid ore
- Mass driver on Moon launches raw material to L5 construction site
- Processing: solar furnaces smelt raw material in zero-g
- Total mass per cylinder pair: ~3 million tonnes (structure) + ~3 million tonnes (shielding)
- Construction time estimate (O'Neill 1975): 6-10 years with 10,000 workers and
  existing space infrastructure
- More realistic estimate with Soviet bureaucratic overhead: 50-100 years

**Game settlement profile:**
```
terrain:
  gravity: 1.0          # artificially maintained by rotation
  atmosphere: breathable # fully enclosed
  water: rivers          # internal water cycle
  farming: soil          # interior landscapes with real soil
  construction: standard # Earthlike interior conditions
  baseSurvivalCost: low  # once built, self-sustaining
```

#### Generation Ship (8000)

**Based on:** Project Daedalus (BIS 1978), Centauri Dreams research, population genetics

A generation ship is not a spacecraft — it is a mobile civilization. It must sustain a
genetically viable population for thousands of years of travel.

**Minimum viable population:**
- Genetic viability (avoiding inbreeding depression): 500-5,000 individuals
  (depending on initial genetic diversity and breeding management)
- Social viability (maintaining functional institutions): 10,000-50,000
- The Soviet solution: 50,000 minimum, because the bureaucracy alone requires 10,000

**Propulsion options (no FTL):**
- Nuclear pulse (Orion-type): 3-5% c → Proxima Centauri in 100-150 years
- Antimatter catalyzed fusion: 5-10% c → Proxima in 45-90 years
- Laser sail (Breakthrough Starshot principle, but crewed): not practical for crewed ships
  (deceleration problem)
- Bussard ramjet: theoretically unlimited, but practical calculations show thrust < drag
  for any conceivable scoop design (debunked by later research)

**Best realistic option for the game:** Nuclear pulse propulsion at 3-5% c.
- Transit to Proxima Centauri (4.24 ly): 85-140 years
- Transit to Tau Ceti (11.9 ly): 240-400 years
- Transit to Epsilon Eridani (10.5 ly): 210-350 years

**Ship specifications (extrapolated from O'Neill Cylinder):**
- Rotating habitat section: 2 km diameter x 10 km long
- Non-rotating engine section: 5 km long
- Total mass: ~10 million tonnes (fuel is the dominant mass)
- Population: 50,000
- Self-sustaining: BIOS-derived closed ecosystem, nuclear power, asteroid-derived materials
- Construction time: 200-500 years (with full Dyson swarm energy budget)

**Game settlement profile:**
```
terrain:
  gravity: variable      # rotation adjustable
  atmosphere: breathable # closed ecosystem
  water: variable        # recycled system
  farming: hydroponics   # interior grow operations
  construction: standard # interior conditions maintained
  baseSurvivalCost: high # requires constant maintenance
```

---

## 4. Tech Tree

### 4.1 Technology Prerequisites

Technologies form a directed acyclic graph (DAG). Each technology requires ALL listed
prerequisites before it can be developed. In historical mode, development follows real
Soviet timelines. In freeform mode, development speed depends on population, industrial
capacity, and political will.

```
ROCKETRY (1920s)
├── ORBITAL_FLIGHT (1957)
│   ├── CREWED_ORBITAL (1961)
│   │   ├── EVA_CAPABILITY (1965)
│   │   │   └── ORBITAL_ASSEMBLY (1980s)
│   │   │       ├── MODULAR_STATIONS (1986 - Mir)
│   │   │       │   ├── LARGE_STATIONS (2020s)
│   │   │       │   │   └── ORBITAL_HABITATS (2080s)
│   │   │       │   │       └── ONEILL_CYLINDERS (2400s)
│   │   │       │   └── CLOSED_ECOSYSTEMS (1997 - BIOS-4)
│   │   │       │       ├── LUNAR_BASE (1980)
│   │   │       │       ├── MARS_BASE (2015)
│   │   │       │       └── GENERATION_SHIPS (8000s)
│   │   │       └── ORBITAL_MANUFACTURING (2025)
│   │   │           ├── SPACE_ELEVATOR (2120)
│   │   │           └── ASTEROID_PROCESSING (2045)
│   │   │               ├── CERES_MINING (2100)
│   │   │               └── DYSON_SWARM (3000+)
│   │   └── LONG_DURATION_HABITATION (1971 - Salyut)
│   │       └── See MODULAR_STATIONS above
│   └── PLANETARY_PROBES (1960s)
│       ├── VENUS_EXPERTISE (1970 - Venera)
│       │   └── VENUS_CLOUD_COLONY (2150)
│       ├── MARS_EXPERTISE (1971 - Mars probes)
│       │   └── MARS_LANDING (2003)
│       └── OUTER_SYSTEM_PROBES (1970s-80s)
│           └── TITAN_OUTPOST (2200)
├── SUPER_HEAVY_LIFT (1960s - N1 program)
│   ├── N1M_SUCCESS (1972 - alt-history)
│   │   └── LUNAR_CARGO_DELIVERY (1975+)
│   │       └── ZVEZDA_LUNAR_BASE (1980)
│   └── ENERGIA (1987)
│       ├── BURAN_FLEET (1990)
│       └── LUNAR_CARGO_DELIVERY (above)
└── NUCLEAR_SPACE_TECH (1960s)
    ├── TOPAZ_REACTOR (1987)
    │   └── SPACE_NUCLEAR_POWER (all off-Earth settlements)
    ├── NTP_ENGINE (1988 - RD-0410 flight-qualified)
    │   ├── MARS_TRANSIT (1995+)
    │   │   ├── MARS_FLYBY (1995)
    │   │   └── MARS_LANDING (2003)
    │   └── OUTER_SYSTEM_TRANSIT (2100+)
    └── NUCLEAR_PULSE (2500+)
        └── INTERSTELLAR_PROPULSION (6000+)

FUSION_RESEARCH (2030s)
├── FUSION_REACTOR (2070)
│   ├── ADVANCED_NTP (2100+)
│   └── DYSON_SWARM_POWER (3000+)
└── HELIUM3_MINING (2020 - requires ZVEZDA_LUNAR_BASE)
    └── FUSION_REACTOR (above)

MATERIALS_SCIENCE (ongoing)
├── CARBON_NANOTUBES (2050s)
│   └── SPACE_ELEVATOR (2120)
├── RADIATION_SHIELDING (2030s)
│   └── All off-Earth settlements
└── METAMATERIALS (2100s)
    └── ADVANCED_HABITATS (2200+)

COMPUTING (ongoing)
├── AUTONOMOUS_ROBOTICS (2030s)
│   ├── ASTEROID_SURVEY (2030)
│   └── ROBOTIC_CONSTRUCTION (2050+)
└── QUANTUM_COMPUTING (2080s)
    └── MATRIOSHKA_BRAIN (25000+)

ANTIMATTER_PHYSICS (2200+)
├── ANTIMATTER_PRODUCTION (3500)
│   └── ANTIMATTER_PROPULSION (5000+)
│       └── FAST_INTERSTELLAR (10000+)
└── Requires DYSON_SWARM at 5%+ coverage
```

### 4.2 Tech Level Computation

The game tracks a single `techLevel` float (0.0-1.0) that aggregates all technological
progress. Tech level drives milestone eligibility and is computed from:

```
techLevel = weighted_average(
  industrialCapacity * 0.25,
  scientificOutput * 0.25,
  populationEducation * 0.15,
  infrastructureQuality * 0.15,
  nuclearCapability * 0.10,
  computingCapability * 0.10
)
```

Approximate tech levels for key milestones:
- 0.1: Sputnik (basic rocketry)
- 0.2: Crewed orbital flight
- 0.3: Space stations, lunar landing
- 0.4: Nuclear thermal propulsion, lunar base
- 0.5: Mars missions, orbital manufacturing
- 0.6: Space elevator, fusion power
- 0.7: Asteroid mining at scale, orbital habitats
- 0.8: O'Neill cylinders, Venus/Titan colonies
- 0.9: Dyson swarm construction, interstellar probes
- 0.95: Generation ships, stellar engineering
- 0.99: Matrioshka brain, galactic expansion

### 4.3 The Soviet Bottleneck

Every technology transition in the Soviet system faces a **bureaucratic drag coefficient**:

```
actualDevelopmentTime = theoreticalDevelopmentTime * bureaucracyMultiplier

bureaucracyMultiplier = base(1.5) * corruption(1.0-2.0) * politicalInterference(1.0-3.0)
                        / scientificFreedom(0.5-1.0) / internationalCooperation(0.5-1.0)
```

In practice:
- Technologies that align with military goals: 1.2x slower than theoretical
- Technologies that align with prestige goals: 1.5x slower
- Technologies with no obvious political benefit: 3-5x slower
- Technologies that threaten existing power structures: 10x slower or blocked entirely

The player can influence these multipliers through political choices: supporting reformist
scientists, bribing the Academy of Sciences, hiding failure reports, or simply waiting for
the right General Secretary to die.

---

## 5. Settlement Types

### 5.1 Settlement Classification

Every settlement in the game falls into one of these categories, each with distinct
environmental constraints, resource models, and gameplay feel.

#### Class A: Terrestrial (Earth Surface)

Standard SimSoviet gameplay. Open atmosphere, standard gravity, natural water cycle.
Late-game ecological collapse forces dome construction, eventually making these settlements
feel like off-world habitats.

#### Class B: Subterranean (Earth Underground, Lunar Lava Tubes, Mars Caves)

Naturally shielded from radiation. Limited space, no natural light. Population capped by
excavation capacity. The Soviets have experience with this: the Moscow Metro was designed
as a nuclear shelter, and numerous closed cities (Chelyabinsk-40, Krasnoyarsk-26) were
built underground.

#### Class C: Pressurized Surface (Moon, Mars, Titan)

Modules on the surface, covered with regolith for radiation shielding. BIOS-derived closed
life support. Agriculture via greenhouse domes. Power from nuclear reactors.

Key constraint: **every breach is lethal**. A punctured module means explosive decompression.
Micrometeorite impacts, construction accidents, and sabotage are existential threats.

#### Class D: Atmospheric Float (Venus Cloud Colony)

Habitats suspended at 50 km altitude in Venus's atmosphere. Earth-normal pressure, near-Earth
gravity, abundant solar energy. But: sulfuric acid clouds, no solid surface access, water
must be extracted from atmosphere or imported.

The most Earthlike off-world environment, paradoxically, is floating above the most hostile
planet in the inner solar system.

#### Class E: Orbital Habitat (Stanford Torus, O'Neill Cylinder)

Rotating habitats in free space, typically at Lagrange points. Fully artificial environment.
Gravity, atmosphere, water cycle, day/night cycle all engineered.

**Stanford Torus** (10,000 pop):
- 1.8 km diameter torus, 130m tube diameter
- Rotates once per minute for 0.9-1.0 g
- Mass: 10 million metric tonnes including radiation shield

**O'Neill Cylinder** (100,000+ pop):
- 8 km diameter x 32 km long (per cylinder)
- 28 rotations/hour for 1 g
- Interior landscapes: rivers, hills, weather systems
- Mass: ~6 million tonnes per pair

#### Class F: Asteroid Station (Ceres, captured NEAs)

Hollowed-out asteroids or surface installations on large bodies. Minimal gravity (Ceres:
0.029 g). Unlimited mineral resources. Key challenge: isolation (Ceres is 2.77 AU from Sun;
light-time delay to Earth: 15-25 minutes).

#### Class G: Generation Ship (Interstellar)

A mobile O'Neill Cylinder with engines. Self-sustaining for centuries to millennia. No
resupply possible. Population must maintain genetic diversity, institutional knowledge,
and industrial capability indefinitely.

The ultimate Soviet test: can the apparatus maintain itself without external oversight for
4,000 years?

#### Class H: Megastructure Component (Dyson Swarm Element)

Individual satellites in the Dyson swarm, each a small habitat/factory. Population: 100-1,000
per element. Millions of elements in the full swarm. Networked by laser communication.

Not so much a "settlement" as a cell in a stellar-scale organism.

### 5.2 Settlement Comparison Matrix

| Class | Gravity | Atmosphere | Water | Farming | Construction | Survival Cost | Pop Cap |
|-------|---------|-----------|-------|---------|-------------|--------------|---------|
| A (Earth) | 1.0 g | breathable→degrading | rivers→depleting | soil→dome | standard→dome | low→high | ~50M |
| B (Underground) | varies | sealed | pumped | hydroponic | excavation | high | ~500K |
| C (Surface) | 0.16-0.38 g | none/thin | ice/subsurface | greenhouse | pressurized | very high | ~100K |
| D (Venus Float) | 0.9 g | external CO2 | extracted | hydroponic | pressurized | extreme | ~10K |
| E (Orbital) | 1.0 g (rotation) | engineered | recycled | soil/hydro | construction | low (post-build) | ~1M |
| F (Asteroid) | 0.01-0.03 g | sealed | ice | hydroponic | excavation | high | ~50K |
| G (Gen Ship) | variable | engineered | recycled | hydroponic | maintenance | high | ~50K |
| H (Dyson Element) | micro-g | sealed | recycled | hydroponic | robotic | extreme | ~1K |

---

## 6. The Soviet Aesthetic

### 6.1 Cosmic Communism

Soviet space culture was not a subset of the space program — the space program was a
manifestation of Soviet identity. From the 1960s onward, the "cosmic style" permeated every
aspect of Soviet life:

- **Architecture**: Buildings and public spaces shaped like rockets, satellites, and flying
  saucers. Bus stops in the Caucasus designed as spacecraft. Metro stations decorated with
  cosmological mosaics.
- **Playgrounds**: Children played on rocket-shaped climbing frames. Schools had star-and-
  galaxy wall murals. Kindergartens featured cosmonaut cutouts.
- **Propaganda**: The CCCP logo appeared on every space image. Cosmonauts were depicted as
  heroic explorers gazing boldly at the viewer. "The cosmos is ours" was not a slogan — it
  was state doctrine.
- **Postage stamps, pin badges, magazine covers**: Space imagery was ubiquitous in everyday
  Soviet material culture.
- **Mosaics**: The most distinctive Soviet space art form. Tile mosaics depicting cosmonauts,
  rockets, and planetary visions adorned buildings, metros, and public spaces across the USSR.

### 6.2 How Soviet Design Manifests in Space

#### Lunar Base (Zvezda)

The Zvezda base would look like a Soviet closed city transplanted to the Moon:
- **Brutalist module exteriors**: Unpainted metal, exposed rivets, stenciled Cyrillic
  designation codes (БЛОК-А, БЛОК-Б, etc.)
- **Interior palette**: institutional green walls, brown linoleum floors, fluorescent
  tube lighting, exposed conduit painted white
- **Communal dining hall**: long aluminum tables, portrait of Lenin on the wall, daily
  Pravda bulletin board (printed from Earth transmission)
- **Political officer's quarters**: slightly larger than standard, red carpet, portrait
  of current General Secretary
- **Monument**: a bust of Gagarin at the landing site, visible from every window
- **Propaganda**: "FORWARD TO THE STARS — THE MOON IS OURS" banner in the main corridor

#### Mars Base (Gagarin)

Mars Base Gagarin inherits Zvezda's aesthetic but with scale:
- **Underground corridors**: wide enough for two people, painted institutional cream,
  with colored stripe navigation (red = command, blue = residential, green = agricultural,
  yellow = industrial)
- **Greenhouse domes**: the most visually striking structures. Translucent hemispheres
  over rows of wheat, potatoes, and cabbage. Workers in coveralls tending crops under
  alien skies.
- **The Red Square**: a central open space (under the largest dome) with a flagpole flying
  the Soviet flag. Used for assemblies, political meetings, and mandatory celebrations.
- **Worker dormitories**: identical to Soviet communal apartments (kommunalki) — shared
  kitchens, shared bathrooms, private sleeping alcoves
- **The problem of vodka on Mars**: officially prohibited. Actually: the first thing
  the crew produces after food. ISRU methanol is chemically close enough to cause problems.

#### O'Neill Cylinder (Soviet Version)

An O'Neill Cylinder built by the Soviet system would be the most Soviet thing ever
constructed:
- **Planned landscape**: no organic growth. Every tree, every hill, every stream is
  placed according to the Master Plan. Grid-pattern streets. Numbered districts (raions).
- **Brutalist interior architecture**: concrete tower blocks (khrushchyovki) but in zero-g
  construction composite. Identical 9-story buildings stretching the length of the cylinder.
- **Central avenue**: a grand boulevard running the full 32 km length, lined with Soviet
  monuments, ending at both "poles" with observation platforms looking back down the cylinder.
- **The weather committee**: weather inside the cylinder is not natural. A committee of
  Party officials decides when it rains, how much sunlight each district receives, and
  whether seasonal changes are permitted.
- **Internal propaganda**: since the "sky" is the far side of the cylinder (you can look
  "up" and see the other half of the habitat), the far side's buildings ARE the skyline.
  Giant murals and neon slogans are visible from everywhere.

#### Generation Ship

The generation ship is the ultimate test of Soviet aesthetics:
- **The ship is named**: suggestions include "Vostok-Eternal," "Korolev's Dream,"
  "Red Star," or "The First of May"
- **Time dilation of culture**: over 4,000 years, Soviet culture on the ship evolves.
  The original ideology fossilizes into ritual. Lenin's words become scripture. The
  October Revolution becomes creation mythology. The Party apparatus becomes a hereditary
  priesthood.
- **Architecture**: starts as familiar Soviet brutalism. Over millennia, evolves into
  something unrecognizable but still bearing the structural DNA — symmetry, monumentalism,
  collective over individual.
- **The Central Committee**: still meets. Still votes. Still files paperwork. After 3,000
  years, nobody remembers what most of the paperwork is for, but the forms must be filled.

### 6.3 Bureaucracy in Space

The Soviet bureaucratic apparatus doesn't simplify in space — it MULTIPLIES.

**Organizational chart for a lunar base of 12 people:**
- Base Commander (military rank)
- Political Commissar (Party representative)
- KGB Liaison Officer
- Chief Engineer
- Chief Scientist
- Medical Officer
- Agricultural Officer
- Communications Officer
- 4 General Workers

That's a 2:1 ratio of administrators to workers. On paper. In practice, the Political
Commissar outranks the Commander on ideological matters. The KGB Liaison reports directly
to Moscow. The Chief Scientist needs the Commissar's approval for research priorities.
The Chief Engineer needs the Commander's approval for resource allocation, which requires
the Commissar's countersignature.

**Forms required to transfer one kilogram of potatoes from the greenhouse to the galley:**
1. Agricultural Production Report (Form 7-K/Lunar)
2. Greenhouse Output Declaration (Form 12-A)
3. Food Storage Transfer Request (Form 3-P, in triplicate)
4. Nutritional Compliance Certificate (Form 15-M, signed by Medical Officer)
5. Resource Allocation Approval (Commander + Commissar signatures)
6. Delivery Confirmation (Form 3-P/Received)
7. Weekly Aggregate Report to Moscow (compiled from above, 6-week transmission delay)

The filing system for interplanetary cargo weighs more than the cargo itself. This is
not a joke — it is the game mechanic. Bureaucratic overhead is a REAL RESOURCE DRAIN.

### 6.4 Space Propaganda

Each milestone generates new propaganda that appears in the game:

| Milestone | Pravda Headline | Poster Slogan |
|-----------|----------------|---------------|
| Lunar landing | "SOVIET BOOT PRINTS ON THE MOON — Another triumph of socialism!" | "THE MOON IS RED" |
| Zvezda base | "BARMINOGRAD LIVES — Workers' paradise on lunar soil!" | "FROM EARTH TO MOON — ONE SYSTEM, ONE PLAN" |
| Mars flyby | "COSMONAUTS GREET MARS — Red planet salutes Red star!" | "MARS AWAITS THE WORKERS' HAND" |
| Mars landing | "BOOTS ON MARS — Gagarin's dream realized!" | "TWO WORLDS, ONE REVOLUTION" |
| Venus colony | "SOVIET CITIZENS FLOAT ABOVE VENUS — Where even hell bows to Soviet engineering!" | "NOT EVEN HELL CAN STOP US" |
| O'Neill Cylinder | "NEW WORLD BUILT BY SOVIET HANDS — A million citizens in the sky!" | "THE SKY IS NOT THE LIMIT — IT IS THE FLOOR" |
| Generation ship | "SOVIET CIVILIZATION SETS SAIL FOR THE STARS — The eternal voyage begins!" | "THE REVOLUTION REACHES BETWEEN THE STARS" |
| Dyson swarm | "THE SUN ITSELF SERVES THE PEOPLE — Boundless energy for boundless ambition!" | "WE HARNESS THE STAR" |

---

## 7. Game Mechanics

### 7.1 How Space Milestones Affect Gameplay

Each space milestone creates concrete gameplay effects across multiple domains:

#### Pressure Effects

Space milestones create new pressure sources AND relieve existing ones:

| Milestone | Pressure Created | Pressure Relieved |
|-----------|-----------------|-------------------|
| Sputnik | +political (arms race expectations) | None |
| Lunar landing | +political (now must maintain lead) | -morale (national pride) |
| Zvezda base | +economic (massive resource drain) | -demographic (emigration valve) |
| Mars base | +economic, +demographic (colonist quotas) | -ecological (backup civilization) |
| Asteroid mining | +infrastructure (processing plants needed) | -economic (resource influx) |
| O'Neill Cylinder | +political (governance of new territory) | -demographic (major pop outlet) |
| Generation ship | +existential (civilization survival) | -all others (ultimate escape valve) |

#### Resource Effects

| Milestone | Resource Impact |
|-----------|----------------|
| Lunar mining (He-3) | +uranium equivalent, fusion fuel |
| Asteroid mining | +rareEarths, +metals, +water (from icy asteroids) |
| Space elevator | -rocketFuel cost for all launches by 90% |
| Venus colony | +solar energy (1.9x Earth), +sulfuric acid (industrial) |
| Titan outpost | +hydrocarbons (virtually unlimited) |
| Dyson swarm | +energy (approaches Type I civilization) |

#### Political Effects

Each space milestone shifts the political landscape:

- **New bureaucratic positions**: Space Commission Chairman, Lunar Commissar, Mars District
  Party Secretary, Interplanetary KGB Division Chief
- **New quota categories**: Space construction materials, colonist quotas (how many citizens
  each settlement must send), rocket fuel production, helium-3 extraction
- **New failure modes**: A failed launch kills the player's political standing. A successful
  Mars landing that the player contributed resources to earns protection from the KGB.
- **New moral dilemmas**: Who gets sent to the Moon? Volunteers? Political prisoners? The
  "unreliable elements"? (Historical precedent: the Soviet Union used forced labor for
  every major construction project.)

### 7.2 Settlement Lifecycle

When a space milestone creates a new settlement, the following lifecycle begins:

```
1. ANNOUNCEMENT (Moscow Directive)
   - Pravda headline announces the project
   - Player receives directive: contribute X resources, Y workers
   - Refusal is not an option (consequence: political standing loss)

2. CONSTRUCTION (3-10 years depending on milestone)
   - Resources drain from player's settlement
   - Workers conscripted for construction crews
   - Progress bar visible in Government HQ
   - Construction accidents create crisis events

3. ACTIVATION (New Settlement Unlocked)
   - New settlement appears in settlement switcher
   - Initial population: transferred from existing settlements
   - Skeleton infrastructure: basic habitat, power, life support
   - New Governor assigned (may be friendly or hostile to player)

4. INTEGRATION (Ongoing)
   - Cross-settlement quotas begin
   - Resource transfer logistics established
   - Player may request transfer TO new settlement (escape route)
   - New settlement creates its own pressure dynamics

5. MATURATION (10-50 years)
   - Settlement becomes self-sustaining
   - Begins generating surplus resources
   - Political dynamics shift (new settlement may rival old one)
   - Cold branches specific to new settlement type activate
```

### 7.3 The Cosmodrome System

Before any space milestone can trigger, the player's settlement must build (or have access
to) a **Cosmodrome** — the Soviet launch facility.

**Cosmodrome requirements:**
- Available from: Thaw era onward
- Construction: 50,000 rubles, 500 steel, 200 cement, 100 electronics
- Workers: 200 permanent staff
- Grid footprint: 4x4 tiles (largest building in the game)
- Prerequisite for: all space-related cold branches

**Cosmodrome gameplay:**
- Monthly launch window events: "Moscow requests launch of [satellite/cargo/crew]"
- Each launch costs resources (rocketFuel, electronics, food for crew missions)
- Launch success probability: 85-95% (Soviet historical average for Soyuz-era)
- Failed launches: political crisis, potential casualties, Pravda covers it up
- The cosmodrome is the player's ONLY direct interaction with the space timeline —
  everything else is autonomous. You build the launch pad. Moscow decides what gets launched.

### 7.4 The Space Quota System

Moscow's quota system extends to space:

| Quota Category | First Appears | Description |
|---------------|--------------|-------------|
| Launch materials | Thaw era | Steel, electronics, fuel for rocket construction |
| Colonist contribution | Zvezda base | X citizens per year sent to off-world settlements |
| Helium-3 processing | Lunar mining | Refine He-3 ore quota from lunar deliveries |
| Mars food surplus | Mars base | Send agricultural surplus to support Mars colony |
| Asteroid ore quota | Asteroid mining | Process and deliver refined minerals |
| Construction labor | O'Neill Cylinder | Workers for orbital construction shifts |

Failing space quotas has the same consequences as failing agricultural quotas: political
standing loss, KGB investigation, potential removal from office. But space quotas are
HARDER because the player has less direct control over supply chains that span millions
of kilometers.

### 7.5 Historical Mode vs Freeform Mode

#### Historical Mode

In historical mode, space milestones fire on their alt-history dates:
- Sputnik: 1957 (automatic)
- Lunar landing: 1974 (requires functional cosmodrome in player's settlement or any
  allied settlement)
- Zvezda base: 1980 (requires player contribution)
- Mars flyby: 1995 (automatic if NTP program funded)
- And so on per the milestone table

The player cannot accelerate or prevent milestones. They can only prepare for the
consequences and optimize their contribution for political benefit.

#### Freeform Mode

In freeform mode, milestones trigger based on:
1. **Tech level threshold** (computed from settlement stats)
2. **Prerequisite milestones** completed
3. **Pressure conditions** (demographic, ecological, economic thresholds)
4. **Sustained duration** (conditions must hold for X ticks)

This means a freeform game might reach lunar landing in 1950 (if the player industrializes
rapidly) or 2100 (if the player focuses on Earth survival). The space timeline adapts
to the player's trajectory.

### 7.6 Transit and Communication

Off-world settlements are not instantly accessible. Physical reality imposes delays:

| Route | Transit Time (NTP) | Light Delay (one-way) |
|-------|-------------------|----------------------|
| Earth → LEO | 8 minutes | <1 second |
| Earth → Moon | 3 days | 1.3 seconds |
| Earth → Mars | 4 months | 4-24 minutes |
| Earth → Ceres | 1.5 years | 15-30 minutes |
| Earth → Jupiter | 2 years | 33-54 minutes |
| Earth → Saturn/Titan | 3.5 years | 67-85 minutes |
| Earth → Proxima Centauri | 85-140 years | 4.24 years |

**Gameplay implications:**
- Lunar settlements: near-real-time communication with Earth. Orders from Moscow arrive
  in seconds. The KGB can monitor you continuously.
- Mars settlements: 4-24 minute light delay. Moscow's orders are always outdated. The Mars
  Commissar has more autonomy. The player has more freedom — and more danger.
- Outer system: hour-long delays. Settlements are effectively autonomous. Moscow sends
  quarterly directives. Local Party apparatus is the real power.
- Generation ships: NO communication with Earth after ~10 light-years. The ship IS the
  Soviet Union. There is no Moscow to report to.

### 7.7 The Inevitability Engine

Space expansion is not a player choice — it is a systemic inevitability driven by
converging pressures:

1. **Population pressure**: Earth settlements hit carrying capacity. Population must go
   somewhere.
2. **Ecological collapse**: Earth's environment degrades. Off-world settlements become
   backup civilizations.
3. **Resource depletion**: Terrestrial rare earths, helium, uranium deposits exhaust.
   Asteroid and lunar mining become necessary.
4. **Political pressure**: Moscow mandates space expansion as ideological imperative.
   Failing to contribute is treason.
5. **Solar evolution**: On geological timescales (10,000+ years), solar luminosity
   increases, making inner system habitats increasingly difficult.

The player's role is not to decide IF space happens, but to survive its consequences.
Each milestone is an earthquake in the bureaucratic landscape — new quotas, new political
rivals, new settlements that might outcompete yours, new ways to be found insufficient.

---

## 8. Cold Branch Integration

### 8.1 Space-Related Cold Branches

The following cold branches connect the space timeline to the existing cold branch system
in `src/config/coldBranches.json`. Each follows the `ColdBranch` interface defined in
`src/ai/agents/core/worldBranches.ts`.

#### Branch: Cosmodrome Construction Rush

```json
{
  "id": "cosmodrome_rush",
  "name": "Cosmodrome Construction Rush",
  "conditions": {
    "worldStateConditions": { "techLevel": { "min": 0.25 } },
    "pressureThresholds": { "political": 0.4 },
    "yearRange": { "min": 1955 },
    "sustainedTicks": 6
  },
  "effects": {
    "pressureSpikes": { "economic": 0.15, "infrastructure": 0.1 },
    "narrative": {
      "pravdaHeadline": "MOSCOW ORDERS COSMODROME — Space is the new frontier!",
      "toast": "Directive: construct cosmodrome facility."
    }
  },
  "oneShot": true
}
```

#### Branch: Lunar Settlement

```json
{
  "id": "lunar_settlement",
  "name": "Zvezda Lunar Base",
  "conditions": {
    "worldStateConditions": { "techLevel": { "min": 0.35 } },
    "pressureThresholds": { "political": 0.5, "demographic": 0.3 },
    "yearRange": { "min": 1975 },
    "sustainedTicks": 12
  },
  "effects": {
    "pressureSpikes": { "economic": 0.2, "demographic": -0.1 },
    "narrative": {
      "pravdaHeadline": "BARMINOGRAD LIVES — Workers' paradise on lunar soil!",
      "toast": "Zvezda Lunar Base construction begins."
    },
    "relocation": {
      "type": "colonial_expansion",
      "targetTerrain": {
        "gravity": 0.166,
        "atmosphere": "none",
        "water": "ice_deposits",
        "farming": "hydroponics",
        "construction": "pressurized_domes",
        "baseSurvivalCost": "very_high"
      }
    },
    "newSettlement": true
  },
  "oneShot": true
}
```

#### Branch: Mars Expedition

```json
{
  "id": "mars_expedition",
  "name": "Mars Base Gagarin",
  "conditions": {
    "worldStateConditions": { "techLevel": { "min": 0.5 } },
    "pressureThresholds": { "demographic": 0.4, "political": 0.5 },
    "yearRange": { "min": 2000 },
    "sustainedTicks": 24
  },
  "effects": {
    "pressureSpikes": { "economic": 0.25, "demographic": -0.15 },
    "crisisDefinition": {
      "id": "mars_expedition_crisis",
      "type": "political",
      "name": "Mars Expedition Resource Drain",
      "startYear": 0,
      "endYear": 0,
      "severity": "national",
      "peakParams": { "productionMult": 0.85, "foodDrain": 30, "moneyDrain": 100 },
      "buildupTicks": 12,
      "aftermathTicks": 24,
      "description": "Massive resource commitment to Mars colonization strains domestic economy."
    },
    "narrative": {
      "pravdaHeadline": "BOOTS ON MARS — Gagarin's dream realized by Soviet hands!",
      "toast": "Mars Base Gagarin established. New quota obligations incoming."
    },
    "relocation": {
      "type": "colonial_expansion",
      "targetTerrain": {
        "gravity": 0.379,
        "atmosphere": "thin_co2",
        "water": "subsurface",
        "farming": "greenhouse",
        "construction": "pressurized_domes",
        "baseSurvivalCost": "high"
      }
    },
    "newSettlement": true
  },
  "oneShot": true
}
```

#### Branch: Asteroid Mining

```json
{
  "id": "asteroid_mining",
  "name": "Ceres Mining Colony",
  "conditions": {
    "worldStateConditions": { "techLevel": { "min": 0.7 } },
    "pressureThresholds": { "economic": 0.6 },
    "yearRange": { "min": 2080 },
    "sustainedTicks": 24
  },
  "effects": {
    "pressureSpikes": { "economic": -0.2, "infrastructure": 0.15 },
    "narrative": {
      "pravdaHeadline": "ASTEROID WEALTH FLOWS — Soviet miners conquer the belt!",
      "toast": "Ceres Mining Colony established. Rare earth quotas begin."
    },
    "relocation": {
      "type": "colonial_expansion",
      "targetTerrain": {
        "gravity": 0.029,
        "atmosphere": "none",
        "water": "ice_deposits",
        "farming": "hydroponics",
        "construction": "pressurized_domes",
        "baseSurvivalCost": "extreme"
      }
    },
    "newSettlement": true
  },
  "oneShot": true
}
```

#### Branch: Venus Cloud Colony

```json
{
  "id": "venus_cloud_colony",
  "name": "Venus Cloud City Tsiolkovsky",
  "conditions": {
    "worldStateConditions": { "techLevel": { "min": 0.75 } },
    "yearRange": { "min": 2120 },
    "sustainedTicks": 24
  },
  "effects": {
    "pressureSpikes": { "economic": 0.2 },
    "narrative": {
      "pravdaHeadline": "SOVIET CITIZENS FLOAT ABOVE VENUS — Where even hell bows to engineering!",
      "toast": "Venus Cloud City Tsiolkovsky becomes operational."
    },
    "relocation": {
      "type": "colonial_expansion",
      "targetTerrain": {
        "gravity": 0.905,
        "atmosphere": "variable",
        "water": "variable",
        "farming": "hydroponics",
        "construction": "pressurized_domes",
        "baseSurvivalCost": "extreme"
      }
    },
    "newSettlement": true
  },
  "oneShot": true
}
```

#### Branch: Titan Hydrocarbon Colony

```json
{
  "id": "titan_colony",
  "name": "Titan Outpost Korolev",
  "conditions": {
    "worldStateConditions": { "techLevel": { "min": 0.8 } },
    "yearRange": { "min": 2170 },
    "sustainedTicks": 36
  },
  "effects": {
    "pressureSpikes": { "economic": 0.15 },
    "narrative": {
      "pravdaHeadline": "HYDROCARBONS OF TITAN — Soviet industry reaches Saturn!",
      "toast": "Titan Outpost Korolev established. Hydrocarbon processing quotas begin."
    },
    "relocation": {
      "type": "colonial_expansion",
      "targetTerrain": {
        "gravity": 0.138,
        "atmosphere": "thick_n2_ch4",
        "water": "methane_lakes",
        "farming": "impossible",
        "construction": "standard",
        "baseSurvivalCost": "extreme"
      }
    },
    "newSettlement": true
  },
  "oneShot": true
}
```

#### Branch: Orbital Habitat (O'Neill Cylinder)

```json
{
  "id": "oneill_cylinder",
  "name": "O'Neill Cylinder 'Kommunar'",
  "conditions": {
    "worldStateConditions": { "techLevel": { "min": 0.8 } },
    "pressureThresholds": { "demographic": 0.7 },
    "yearRange": { "min": 2300 },
    "sustainedTicks": 48
  },
  "effects": {
    "pressureSpikes": { "demographic": -0.3, "economic": 0.1 },
    "narrative": {
      "pravdaHeadline": "A NEW WORLD BUILT BY SOVIET HANDS — 100,000 citizens in the sky!",
      "toast": "O'Neill Cylinder 'Kommunar' reaches habitable capacity."
    },
    "relocation": {
      "type": "colonial_expansion",
      "targetTerrain": {
        "gravity": 1.0,
        "atmosphere": "breathable",
        "water": "rivers",
        "farming": "soil",
        "construction": "standard",
        "baseSurvivalCost": "low"
      }
    },
    "newSettlement": true
  },
  "oneShot": true
}
```

#### Branch: Dyson Swarm Construction

```json
{
  "id": "dyson_swarm",
  "name": "Dyson Swarm Construction",
  "conditions": {
    "worldStateConditions": { "techLevel": { "min": 0.9 } },
    "yearRange": { "min": 2800 },
    "sustainedTicks": 120
  },
  "effects": {
    "pressureSpikes": { "economic": -0.2, "infrastructure": 0.3 },
    "narrative": {
      "pravdaHeadline": "THE SUN ITSELF SERVES THE PEOPLE — Dyson construction begins!",
      "toast": "Dyson swarm construction program initiated."
    }
  },
  "oneShot": true
}
```

#### Branch: Generation Ship

```json
{
  "id": "generation_ship",
  "name": "Generation Ship 'Vostok-Eternal'",
  "conditions": {
    "worldStateConditions": { "techLevel": { "min": 0.95 } },
    "pressureThresholds": { "demographic": 0.8 },
    "yearRange": { "min": 6000 },
    "sustainedTicks": 240
  },
  "effects": {
    "pressureSpikes": { "demographic": -0.4, "morale": 0.2 },
    "narrative": {
      "pravdaHeadline": "THE ETERNAL VOYAGE BEGINS — Soviet civilization reaches for the stars!",
      "toast": "Generation Ship 'Vostok-Eternal' launches toward Proxima Centauri."
    },
    "relocation": {
      "type": "interstellar",
      "targetTerrain": {
        "gravity": 1.0,
        "atmosphere": "breathable",
        "water": "variable",
        "farming": "hydroponics",
        "construction": "standard",
        "baseSurvivalCost": "high"
      }
    },
    "newSettlement": true
  },
  "oneShot": true
}
```

### 8.2 Integration with Existing Systems

The space timeline integrates with existing game systems through these touchpoints:

**SimulationEngine:**
- `spaceTimeline` field: tracks completed milestones, active construction, transit status
- `tickSpaceTimeline()` called during `phaseNarrative` phase
- Milestone evaluation uses same `evaluateBranches()` engine as cold branches

**PressureSystem:**
- Space milestones create pressure events in `demographic`, `economic`, `political`,
  `infrastructure`, and `morale` domains
- Off-world settlements feed back pressure data to parent settlement

**Governor/CrisisSystem:**
- Space crises (launch failures, colony disasters, communication blackouts) are
  `CrisisDefinition` objects with `type: 'disaster'` or `type: 'political'`
- Historical mode: crises fire on preset dates
- Freeform mode: ChaosEngine can generate space-related crises

**WorldAgent:**
- `worldState.techLevel` drives milestone eligibility
- `worldState.spaceInfrastructure` tracks cumulative space capability
- New world state fields: `lunarPresence`, `marsPresence`, `asteroidAccess`,
  `orbitalCapacity`

**ColdBranch system:**
- Space branches use the existing `ColdBranch` interface unchanged
- `relocation.type: 'colonial_expansion'` creates new settlements
- `relocation.type: 'interstellar'` creates generation ship settlements
- Terrain profiles use the existing `TerrainProfile` interface

**Serialization:**
- `SpaceTimelineSaveData` extends existing save format
- Milestone completion flags: `Set<string>` (same pattern as `activatedBranches`)
- Active construction state: progress bars, resource commitments
- Transit state: population/cargo in transit between settlements

### 8.3 The Config File

All space timeline data should ultimately live in `src/config/space.json`, containing:

```typescript
interface SpaceConfig {
  /** All space milestones in order. */
  milestones: SpaceMilestone[];
  /** Terrain profiles for each celestial body. */
  terrainProfiles: Record<string, TerrainProfile>;
  /** Transit data: delta-v, transit times, light delays. */
  transitData: Record<string, TransitProfile>;
  /** Space-specific crisis definitions. */
  crises: CrisisDefinition[];
  /** Cold branch definitions for space events. */
  coldBranches: ColdBranch[];
}

interface SpaceMilestone {
  id: string;
  name: string;
  /** Alt-history year (for historical mode). */
  historicalYear: number;
  /** Tech level threshold (for freeform mode). */
  techLevelThreshold: number;
  /** IDs of prerequisite milestones. */
  prerequisites: string[];
  /** Pressure conditions for freeform activation. */
  pressureConditions?: Partial<Record<PressureDomain, number>>;
  /** Whether this milestone creates a new settlement. */
  createsSettlement: boolean;
  /** Settlement terrain profile (if createsSettlement). */
  settlementTerrain?: TerrainProfile;
  /** Resources drained during construction. */
  constructionCost: Partial<Record<string, number>>;
  /** Ticks for construction phase. */
  constructionTicks: number;
  /** Narrative content. */
  narrative: { pravdaHeadline: string; toast: string; posterSlogan: string };
}

interface TransitProfile {
  /** Origin body. */
  from: string;
  /** Destination body. */
  to: string;
  /** Transit time in ticks (NTP propulsion). */
  transitTicks: number;
  /** One-way light delay in seconds. */
  lightDelaySeconds: number;
  /** Delta-v requirement in km/s. */
  deltaV: number;
}
```

---

## 9. Sources

### Soviet Space Program History
- [Soviet space program - Wikipedia](https://en.wikipedia.org/wiki/Soviet_space_program)
- [N1 (rocket) - Wikipedia](https://en.wikipedia.org/wiki/N1_(rocket))
- [Energia (rocket) - Wikipedia](https://en.wikipedia.org/wiki/Energia_(rocket))
- [Venera - Wikipedia](https://en.wikipedia.org/wiki/Venera)
- [Lunokhod programme - Wikipedia](https://en.wikipedia.org/wiki/Lunokhod_programme)
- [Salyut programme - Wikipedia](https://en.wikipedia.org/wiki/Salyut_programme)
- [Mir - Wikipedia](https://en.wikipedia.org/wiki/Mir)
- [Almaz - Wikipedia](https://en.wikipedia.org/wiki/Almaz)
- [THE SOVIET MANNED LUNAR PROGRAM](https://spp.fas.org/eprint/lindroos_moon1.htm)
- [Buran space shuttle - The Buran Energy](https://www.buran-energia.com/energia/energia-desc.php)

### Soviet Space Plans (Unrealized)
- [TMK - Wikipedia](https://en.wikipedia.org/wiki/TMK)
- [MEK - Astronautix](http://www.astronautix.com/m/mek.html)
- [TMK-E: The Nuclear Mars Train](https://letsgetoffthisrockalready.com/2019/09/16/tmk-e-the-nuclear-mars-train/)
- [Zvezda (moonbase) - Wikipedia](https://en.wikipedia.org/wiki/Zvezda_(moonbase))
- [DLB Lunar Base - Astronautix](http://www.astronautix.com/d/dlblunarbase.html)
- [Russia's plans for manned Mars missions - RussianSpaceWeb](https://www.russianspaceweb.com/spacecraft_manned_mars.html)

### Soviet Nuclear Space Technology
- [TOPAZ nuclear reactor - Wikipedia](https://en.wikipedia.org/wiki/TOPAZ_nuclear_reactor)
- [RD-0410 - Wikipedia](https://en.wikipedia.org/wiki/RD-0410)
- [NERVA - Wikipedia](https://en.wikipedia.org/wiki/NERVA)
- [Nuclear Thermal Propulsion - NASA](https://www.nasa.gov/directorates/stmd/tech-demo-missions-program/nuclear-thermal-propulsion-game-changing-technology-for-deep-space-exploration/)

### Life Support and Closed Ecosystems
- [BIOS-3 - Wikipedia](https://en.wikipedia.org/wiki/BIOS-3)
- [Bios-3: Siberian experiments in bioregenerative life support - PubMed](https://pubmed.ncbi.nlm.nih.gov/11540303/)

### Space Habitats and Megastructures
- [O'Neill cylinder - Wikipedia](https://en.wikipedia.org/wiki/O'Neill_cylinder)
- [Stanford torus - Wikipedia](https://en.wikipedia.org/wiki/Stanford_torus)
- [Dyson sphere - Wikipedia](https://en.wikipedia.org/wiki/Dyson_sphere)
- [Matrioshka brain - Wikipedia](https://en.wikipedia.org/wiki/Matrioshka_brain)
- [Alderson disk - Wikipedia](https://en.wikipedia.org/wiki/Alderson_disk)
- [Shkadov thruster - NextBigFuture](https://www.nextbigfuture.com/2011/12/shkadov-thruster-and-stellar-engines.html)

### Delta-V and Orbital Mechanics
- [Delta-v budget - Wikipedia](https://en.wikipedia.org/wiki/Delta-v_budget)
- [Hohmann transfer orbit - Wikipedia](https://en.wikipedia.org/wiki/Hohmann_transfer_orbit)
- [Mission Table - Atomic Rockets](https://projectrho.com/public_html/rocket/appmissiontable.php)

### Radiation and Artificial Gravity
- [Real Martians: How to Protect Astronauts from Space Radiation on Mars - NASA](https://www.nasa.gov/science-research/heliophysics/real-martians-how-to-protect-astronauts-from-space-radiation-on-mars/)
- [Radiation shielding - Marspedia](https://marspedia.org/Radiation_shielding)
- [Artificial gravity - Wikipedia](https://en.wikipedia.org/wiki/Artificial_gravity)
- [Chapter 2 PHYSICS OF ARTIFICIAL GRAVITY - NASA](https://ntrs.nasa.gov/api/citations/20070001008/downloads/20070001008.pdf)

### Interstellar Travel
- [Interstellar travel - Wikipedia](https://en.wikipedia.org/wiki/Interstellar_travel)
- [Project Daedalus - Wikipedia](https://en.wikipedia.org/wiki/Project_Daedalus)
- [Centauri Dreams - Generation Ship Population](https://www.centauri-dreams.org/2025/03/28/can-an-interstellar-generation-ship-maintain-a-population-on-a-250-year-trip-to-a-habitable-exoplanet/)

### Asteroid Mining
- [Asteroid mining - Wikipedia](https://en.wikipedia.org/wiki/Asteroid_mining)
- [Economics of the Stars - Harvard International Review](https://hir.harvard.edu/economics-of-the-stars/)
- [Asteroid Mining: Key to the Space Economy - NSS](https://space.nss.org/asteroid-mining-key-to-the-space-economy)

### Helium-3 and Lunar Resources
- [ESA - Helium-3 mining on the lunar surface](https://www.esa.int/Enabling_Support/Preparing_for_the_Future/Space_for_Earth/Energy/Helium-3_mining_on_the_lunar_surface)
- [Mining the Moon - American Scientist](https://www.americanscientist.org/article/mining-the-moon)

### Mars Colonization
- [Mars trilogy - Wikipedia](https://en.wikipedia.org/wiki/Mars_trilogy)
- [Mars Direct - The Mars Society](https://www.marssociety.org/concepts/mars-direct/)
- [The Case for Colonizing Mars - NSS](https://nss.org/the-case-for-colonizing-mars-by-robert-zubrin/)
- [Terraforming of Mars - Wikipedia](https://en.wikipedia.org/wiki/Terraforming_of_Mars)

### Space Elevator
- [Space elevator - Wikipedia](https://en.wikipedia.org/wiki/Space_elevator)
- [Tether Materials - ISEC](https://www.isec.org/space-elevator-tether-materials)

### Kardashev Scale
- [Kardashev scale - Wikipedia](https://en.wikipedia.org/wiki/Kardashev_scale)
- [Predicting the Timeline for Humanity to Reach Kardashev Type I](https://arxiv.org/pdf/2204.07070)

### Tsiolkovsky and Russian Cosmism
- [Konstantin Tsiolkovsky - Wikipedia](https://en.wikipedia.org/wiki/Konstantin_Tsiolkovsky)
- [Russian cosmism - Wikipedia](https://en.wikipedia.org/wiki/Russian_cosmism)

### Soviet Space Aesthetic
- [How Soviet Science Magazines Fantasized About Life in Outer Space - Atlas Obscura](https://www.atlasobscura.com/articles/soviet-space-graphics)
- [Cosmonauts and Communism: Soviet Space Propaganda Posters - COMRADE Gallery](https://comradekiev.com/journal/cosmonauts-and-communism-soviet-propaganda-posters-and-the-space-race)
- [Soviet Space Art: Posters of Propaganda and Progress - Daily Art Magazine](https://www.dailyartmagazine.com/soviet-space-posters/)

### Hard Sci-Fi References
- [The Expanse - Scientific Realism (CBR)](https://www.cbr.com/prime-video-the-expanse-perfect-hard-sci-fi-tv/)
- [How real-world science sets The Expanse apart (Science/AAAS)](https://www.science.org/content/article/how-real-world-science-sets-expanse-apart-other-sci-fi-shows)

### Alternate History
- [Space Race Didn't End - Alternative History Wiki](https://althistory.fandom.com/wiki/Space_Race_Didn't_End)
- [What if the Soviet Union never fell? - AlternateHistory.com](https://www.alternatehistory.com/forum/threads/what-if-the-soviet-union-never-fell.508392/)
