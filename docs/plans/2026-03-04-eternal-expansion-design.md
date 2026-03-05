---
type: design
status: draft
---

# Eternal Expansion: Domes, Resources, Arcologies, Multi-Settlement, Space

## Vision

The game must feel engaging for 100,000 years of Soviet rule. This requires:

1. **Inevitable forces** that prevent stagnation — population ceiling, ecological collapse, resource depletion
2. **Natural growth pathways** — arcologies → domes → multi-settlement → planetary → interstellar
3. **Expanded resource model** — oxygen, hydrogen, water become tracked resources (critical on Earth eventually, critical on other bodies from the start)
4. **Procedural dome system** — translucent enclosures that scale from single-building greenhouses to city-covering atmospheric containment to planetary habitats
5. **Multi-settlement gameplay** — per-settlement agent trees, viewport switching, cross-settlement quotas

## Population Carrying Capacity

### The Mathematical Ceiling

Every settlement has a **carrying capacity** (`K`) determined by:

```
K = min(
  housingCapacity,
  foodProductionCapacity / consumptionPerCapita,
  waterCapacity / waterPerCapita,
  oxygenCapacity / oxygenPerCapita,    // only matters in domes or off-Earth
  powerCapacity / powerPerCapita,
  terrainCarryingCapacity              // finite even for Earth — soil, space, waste
)
```

When `population > 0.85 * K`, pressure builds automatically across ALL domains. When `population > 0.95 * K`, the `demographic` pressure domain spikes — this is the systemic force that makes expansion **feel inevitable**, not arbitrary.

### Arcology Scaling

Population progression:
- **< 200**: Entity mode (individual dvory)
- **200 - 50,000**: Aggregate mode (building-as-container)
- **50,000 - 500,000**: Arcology mode — buildings merge into mega-structures
- **500,000 - 5,000,000**: Dome mode — arcologies enclosed in environmental domes
- **5,000,000 - 50,000,000**: Mega-dome mode — city-scale containment
- **> 50,000,000**: Inevitable expansion pressure — new settlements required

At each tier transition, the visual representation changes but the underlying system is the same.

### Arcology Merging

When population exceeds ~50,000, adjacent buildings of similar type begin **merging** into mega-structures:

```typescript
interface ArcologyMerge {
  /** Buildings that merged into this arcology. */
  componentBuildings: string[];  // defIds
  /** Grid cells this arcology occupies. */
  footprint: { x: number; y: number }[];
  /** Total population housed. */
  population: number;
  /** Merged production capacity. */
  productionMult: number;
  /** Self-containment ratio (0-1): 1.0 = fully enclosed. */
  containment: number;
  /** Whether this arcology has a dome. */
  hasDome: boolean;
}
```

Visually: the same GLB models, just scaled up (brutalist scaling already exists in BuildingRenderer). Adjacent buildings of compatible types merge their footprints. A dome mesh can then be placed over the merged footprint.

## Dome System

### Procedural Translucent Dome Mesh

A single R3F component `<DomeMesh>` that generates a parametric dome:

```typescript
interface DomeProps {
  /** Center position on the grid. */
  position: [number, number, number];
  /** Radius in grid units. */
  radius: number;
  /** Height multiplier (0.5 = hemisphere, 1.0 = full sphere). */
  heightRatio: number;
  /** Opacity (0.15 for glass, 0.3 for atmosphere shield, 0.5 for radiation). */
  opacity: number;
  /** Color tint (blue-white for Earth, orange for Mars, green for life support). */
  tint: string;
  /** Number of segments (LOD: 16 for distant, 64 for close). */
  segments: number;
  /** Whether to render with backface culling (false for full enclosure). */
  doubleSided: boolean;
  /** Fresnel effect intensity (glass-like reflections at edges). */
  fresnelIntensity: number;
}
```

The dome mesh is a **SphereGeometry** with the bottom hemisphere clipped, using a custom shader:
- **Fresnel effect** at edges (looks glass-like)
- **Translucent with refraction** (drei's `MeshTransmissionMaterial` or custom)
- **Interior fog** for atmosphere containment visual
- **Dynamic tint** based on atmosphere quality

### Triple Duty

| Context | Dome Purpose | Visual |
|---------|-------------|--------|
| Earth (early) | Greenhouse enclosure for farms | Small, green tint, high transparency |
| Earth (ecological collapse) | Atmospheric containment for mega-cities | Massive, blue-white, medium transparency |
| Earth (no ozone) | Radiation shielding | Slight orange tint, lower transparency |
| Moon | Pressurized habitat | White-silver, medium opacity |
| Mars | Atmospheric containment | Orange-tinted, medium opacity |
| Titan | Methane-resistant enclosure | Yellow-green, high opacity |
| Exoplanet | Variable atmosphere containment | Variable |

### Dome Scaling

Domes scale from single-building (r=2 grid units) to city-covering (r=50+ grid units). The procedural generation handles any size. LOD reduces segment count for distant/large domes.

## Expanded Resources

### New Resources

Add to the `Resources` interface:

```typescript
// ── Atmospheric Resources ──
/** Oxygen units (only tracked when in dome or off-Earth). */
oxygen: number;
/** Oxygen production capacity per tick. */
oxygenProduction: number;
/** Hydrogen units (fuel, industrial). */
hydrogen: number;
/** Clean water units (distinct from terrain water access). */
water: number;
/** Water production/recycling capacity. */
waterRecycling: number;

// ── Advanced Resources (late-game) ──
/** Rare earth elements (electronics, advanced construction). */
rareEarths: number;
/** Uranium (nuclear power, weapons). */
uranium: number;
/** Rocket fuel (space launches). */
rocketFuel: number;
```

### Resource Era-Gating

| Resource | Available From | Notes |
|----------|---------------|-------|
| oxygen | When first dome built OR off-Earth | On open-air Earth, infinite supply (not tracked) |
| hydrogen | Industrialization era | Electrolysis from water |
| water | Always | On Earth: derived from terrain water. Off-Earth: extracted/recycled |
| rareEarths | Thaw era | Electronics manufacturing |
| uranium | Industrialization era | Nuclear program |
| rocketFuel | Post-2030 (cold branch tech) | Space launches |

### On-Earth vs Off-Earth Resource Rules

```typescript
function isResourceTracked(resource: string, terrain: TerrainProfile, hasDome: boolean): boolean {
  switch (resource) {
    case 'oxygen':
      // On Earth: only tracked inside domes (ecological collapse)
      // Off-Earth: always tracked
      return terrain.atmosphere !== 'breathable' || hasDome;
    case 'water':
      // On Earth: tracked when water source is not 'rivers' (rivers = abundant)
      // Off-Earth: always tracked
      return terrain.water !== 'rivers';
    case 'hydrogen':
      return true; // always tracked once unlocked
    default:
      return true;
  }
}
```

## Multi-Settlement Full Implementation

### What Exists Now

- `Settlement` type with all fields
- `SettlementRegistry` for managing collection
- `RelocationEngine` for creating settlements + transit mortality
- 19 cold branches (7 create new settlements)
- Serialization/restore for all of the above
- Wired into `SimulationEngine` via `relocationEngine` field

### What's Missing

1. **Per-settlement agent tree** — each settlement needs its own:
   - ECS world (or world partition)
   - PressureSystem state
   - Governor context
   - Building grid
   - Population (entity or aggregate mode, independently)

2. **Viewport switching** — React state for which settlement is being viewed:
   - Camera transitions between settlement grids
   - UI overlays update to show correct settlement data
   - Mini-map shows all settlements (distant ones as dots)

3. **Cross-settlement quotas** — Moscow's demands span ALL settlements:
   - Total food quota = sum across all settlements
   - Failing ANY settlement's individual quota still counts
   - Resources can transfer between settlements (with logistics cost)

4. **Settlement-specific tick** — each settlement ticks independently:
   - Same 27-step tick pipeline per settlement
   - WorldAgent is SHARED (global context)
   - PressureSystem is per-settlement
   - Governor directives can target specific settlements

### Implementation Approach

The key insight: **settlements share the WorldAgent but have separate everything else**.

```typescript
interface SettlementRuntime {
  settlement: Settlement;
  world: World;           // separate miniplex ECS world
  grid: GameGrid;         // separate building grid
  pressureSystem: PressureSystem;
  agents: AgentTree;      // full agent tree
  populationMode: 'entity' | 'aggregate';
}
```

`SimulationEngine.tick()` iterates over `SettlementRuntime[]`, ticking each one. The active settlement's results drive the UI. Background settlements tick but don't render.

## Cold Branch Expansion (Space Pathways)

### New Cold Branches Needed

| Branch | Year | Conditions | Creates Settlement? |
|--------|------|-----------|-------------------|
| Space Station Alpha | 2000+ | techLevel > 0.6, military > 0.7 | Yes (orbital) |
| Permafrost Mining Colony | 2050+ | climateTrend > 0.3, infrastructure > 0.5 | Yes (Arctic) |
| Underwater Habitat | 2080+ | techLevel > 0.75, climateTrend > 0.6 | Yes (subsea) |
| Asteroid Mining | 2100+ | techLevel > 0.85, rareEarths depleted | Yes (asteroid belt) |
| Venus Cloud Colony | 2150+ | techLevel > 0.9 | Yes (Venus) |
| Titan Hydrocarbon Colony | 2200+ | Mars colony exists | Yes (Titan) |
| Dyson Swarm Start | 5000+ | techLevel > 0.99, all solar colonies exist | No (megastructure) |
| Generation Ship | 10000+ | stellar threat OR carrying capacity crisis | Yes (interstellar) |

### Ego Projects (Prestige → Space)

The existing prestige project system already exists. Expand the prestige project catalog:

| Project | Era | Unlocks |
|---------|-----|---------|
| Monument to Revolution | Revolution | Morale boost |
| Palace of the Soviets | Collectivization | Political standing |
| Nuclear Program | Industrialization | Uranium processing |
| Cosmodrome | Thaw | Space launches, lunar branch prerequisite |
| Nuclear Power Plant | Thaw | Power + uranium |
| Satellite Network | Stagnation | Communication + tech boost |
| Space Station | Eternal | Orbital settlement branch |
| Fusion Reactor | Post-2050 | Hydrogen power, water splitting |
| Mass Driver | Post-2100 | Cheap orbital launch |
| Terraforming Engine | Post-2200 | Mars atmosphere processing |

## Ecological Collapse Pathway (Earth Late-Game)

### The Inevitable Timeline

This is the force that makes domes and expansion NECESSARY:

| Year | Event | Effect |
|------|-------|--------|
| 2050 | Permafrost thaw | Infrastructure pressure, disease outbreaks |
| 2100 | Ozone depletion | Health pressure, dome requirement for farming |
| 2200 | Atmospheric toxicity | Oxygen tracking begins on Earth, dome requirement for housing |
| 2500 | Soil exhaustion | Food production drops 50%, hydroponics required |
| 3000 | Water table collapse | Water becomes tracked resource even on Earth |
| 5000 | Solar luminosity increase | Temperature rising, equatorial zones uninhabitable |
| 10000 | Mini ice age cycle | Northern settlements buried in ice |
| 50000 | Continental drift effects | Earthquake frequency doubles |
| 100000 | Magnetic field weakening | Radiation exposure, dome opacity increases |

Each of these creates sustained pressure that drives the player toward expansion. You can't AVOID them — they're geological/stellar inevitabilities. You can only prepare.

### Config JSON Location

All these timelines, thresholds, and parameters should live in:
- `src/config/ecology.json` — ecological collapse timeline, resource thresholds
- `src/config/space.json` — terrain profiles, celestial parameters, transit data
- `src/config/branches.json` — cold branch definitions (extracted from worldBranches.ts)
- `src/config/prestige.json` — prestige project catalog

## Implementation Sequence

### Phase A: Expanded Resources + Carrying Capacity
1. Add oxygen, hydrogen, water, rareEarths, uranium, rocketFuel to Resources interface
2. Add carrying capacity computation to PressureSystem
3. Add ecology.json config for collapse timeline
4. Add resource tracking rules (on-Earth vs off-Earth)

### Phase B: Dome System
1. `src/scene/DomeMesh.tsx` — procedural translucent dome component
2. Dome shader (Fresnel + transmission + tint)
3. Dome placement logic (automatic when containment needed)
4. Dome scaling based on footprint size

### Phase C: Arcology Merging
1. Building merge detection (adjacent compatible buildings at pop > 50k)
2. ArcologyMerge data structure
3. Visual merge (brutalist scaling of merged footprint)
4. Dome auto-placement over arcologies

### Phase D: Multi-Settlement Gameplay
1. SettlementRuntime with per-settlement ECS world
2. Per-settlement tick loop in SimulationEngine
3. Viewport switching (camera transition + UI update)
4. Cross-settlement quota spanning
5. Resource transfer UI

### Phase E: Space Pathways
1. Expand cold branch catalog (8+ new branches)
2. Prestige project catalog for space infrastructure
3. Terrain profiles for new bodies (Venus, asteroid, orbital)
4. Ecological collapse timeline driving dome necessity

### Phase F: Config JSON Extraction
1. Extract ERA_DEFINITIONS to config/eras.json
2. Extract COLD_BRANCHES to config/branches.json
3. Extract terrain profiles to config/space.json
4. Extract historical crises to config/crises.json (already partially done)
5. Loader functions that parse JSON → typed objects

## Decomposing "the_eternal" — Kardashev Sub-Eras

"The_eternal" as a SINGLE era is a design failure. A civilization going from year 2000 to year 100,000 undergoes MORE dramatic transformation than 1917-1991. The Kardashev scale provides the perfect sub-era framework — each 0.1 increment IS a distinct phase with its own resource management, construction types, societal pressures, and aesthetics.

### Sub-Era Progression

| Sub-Era | K-Scale | Years | Key Mechanic | Aesthetic |
|---------|---------|-------|-------------|-----------|
| **Post-Soviet** | 0.72→0.80 | 1991-2100 | Climate adaptation, first domes, sphere dynamics | Brutalist + glass |
| **Planetary** | 0.80→0.90 | 2100-2500 | Multi-settlement, Moon/Mars colonies, dome mandatory | Space station industrial |
| **Solar Engineering** | 0.90→1.00 | 2500-5000 | Orbital megastructures, asteroid mining, O'Neill cylinders | Orbital habitat |
| **Type I (Planetary Mastery)** | 1.0 | ~5000 | Full planetary energy capture, weather/geology control | Pristine controlled |
| **Deconstruction** | 1.0→1.5 | 5000-20000 | Disassemble Mercury, Venus, Moon for Dyson swarm | Industrial solar |
| **Dyson Swarm** | 1.5→1.8 | 20000-50000 | Partial star enclosure, Jupiter gas harvesting | Swarm habitat |
| **MegaEarth** | 1.8→2.0 | 50000-100000 | Consume outer planets to expand habitable surface | Planetary engineering |
| **Type II Peak (The Trap)** | 2.0 | 100000+ | Full solar output captured. NO FTL. The ceiling. | Dyson interior |

Each sub-era transition triggers the same mechanism as historical era transitions: new building types, new pressure dynamics, new cold branches, new prestige projects, visual changes.

### The Type II Trap — "The Soviet Paradox"

**The most interesting gameplay happens when you've WON.** Full Dyson sphere. Every planet deconstructed. Every resource in the solar system being used. Effectively infinite energy within the solar system. But:

- **No FTL**: Generation ships take 10,000-100,000 years. You've sent them. You'll never hear back.
- **No expansion**: Hard ceiling. Everything in the solar system IS you.
- **Bureaucratic singularity**: The Soviet system that got you here is now managing a Dyson sphere. 50 billion souls in a MegaEarth arcology run by committees. Peak absurdity.
- **Internal pressure only**: All the pressure domains that used to come from external sources (border threat, trade, war) now come entirely from WITHIN. Elite overproduction at civilizational scale. Turchin's cycles compressed because there's nowhere to emigrate to.
- **Energy abundance ≠ happiness**: The Sun produces 3.8 × 10²⁶ watts. You have ALL of it. People are still miserable, still sabotaging vodka rations, still bribing their sector commissar. The game's core thesis proven at cosmic scale.
- **The Long Wait**: Generation ships sent to Alpha Centauri 40,000 years ago. Radio silence. Cold branch: "The Long Dark" — did they make it? Will they ever call back? This is the endgame's central tension.

### Planetary Deconstruction as Gameplay

Each planet deconstructed is a SETTLEMENT that transforms into a RESOURCE SUPPLY. The player manages the political crisis of evacuation, the engineering of dismantlement, and the construction of Dyson swarm components.

**Deconstruction order** (optimal engineering sequence):

| Order | Target | Mass (Earth=1) | Resources Gained | Gameplay Drama |
|-------|--------|----------------|-----------------|----------------|
| 1 | **Moon** | 0.012 | Silicates, rare earths, He-3 | First — closest, lowest gravity. Lunar colony becomes mining operation. Politically easy (small population). |
| 2 | **Mercury** | 0.055 | Iron, solar proximity metals | Closest to Sun = ideal Dyson swarm staging. Extreme heat settlement evacuated. Iron is Dyson swarm backbone. |
| 3 | **Venus** | 0.815 | CO2 (carbon), metals, atmosphere | Cloud colonies must evacuate. MASSIVE political crisis — Venus colony may be 500K people. Where do they go? |
| 4 | **Mars** | 0.107 | Iron oxide, water ice | Politically devastating — Mars colony (potentially millions) must relocate BACK to MegaEarth. Wars have been fought over less. |
| 5 | **Jupiter** | 317.8 | Hydrogen, helium-3 (fuel) | NOT full deconstruction — too massive. Gas HARVESTING for fusion fuel. Endless supply. Atmospheric mining colonies. |
| 6 | **Saturn** | 95.2 | Hydrogen, exotic ices | Gas harvesting + ring material (pure water ice, silicates). Ring mining is its own sub-economy. |
| 7 | **Uranus/Neptune** | 14.5/17.1 | Heavy metals, exotic ices, methane | Ice giant mining for fusion fuel + exotic materials. Extreme-distance settlements. |

Each deconstruction is a COLD BRANCH — it fires when resource pressure + tech level + political conditions align. Moscow (or whatever central authority exists) mandates it as a 5-year plan. You choose HOW to manage the evacuation.

**Material math** (grounding in reality):
- Sun output: 3.8 × 10²⁶ watts
- Mercury's mass: 3.3 × 10²³ kg (enough for ~10⁻³ AU² of Dyson swarm)
- Venus's mass: 4.87 × 10²⁴ kg (enough for ~10⁻² AU² of Dyson swarm)
- To fully enclose the Sun at 1 AU: ~2.8 × 10²³ m² surface area, requiring ~10²⁶ kg of material
- Earth + all rocky planets: ~6 × 10²⁴ kg total. NOT ENOUGH for a solid Dyson shell.
- Hence: Dyson SWARM (individual collectors), not solid shell. Even Type II still has limitations.

### MegaEarth Concept

As planets are deconstructed, their material is used for TWO purposes:
1. **Dyson swarm collectors** orbiting the Sun
2. **MegaEarth expansion** — literally ADDING surface area to Earth

MegaEarth is built by:
- Extending the planetary surface outward with deconstructed planetary material
- Building upward in arcology layers (Judge Dredd megacity structure)
- Filling oceans with platform structures (new "land" at sea level)
- Expanding the Moon's orbit outward (or consuming the Moon for material)

At full MegaEarth, the habitable surface is 10-100× original Earth. Population: 50-500 billion. All under domes/arcologies. All still governed by Soviet committee structure. All still receiving 5-year plans from whatever Moscow has become.

### MegaCity Law Enforcement (Judge Dredd Mechanic)

At MegaEarth scale (population > 1 billion), law enforcement becomes a full gameplay domain. This extends the existing KGB/political agent architecture — the SAME systems, scaled to megacity proportions.

**New pressure domain**: `density` — population per habitable area unit

**Sector Blocks**: MegaEarth divided into administrative sectors (like dvory scale up to buildings, buildings to arcologies, arcologies to sectors). Each sector is a mini-settlement within the MegaEarth.

**KGB → Judge Corps evolution**:
| Era | Law Enforcement | Mechanic |
|-----|----------------|----------|
| 1917-1991 | KGB, politruks | Suspicion, marks, blat |
| 1991-2500 | Security services | Same mechanics, less ideological |
| 2500-10000 | Sector Judges | Crime rate per sector, patrol coverage |
| 10000-100000 | Megacity Arbiters | Population density drives crime; undercity exploration |

**Crime rate model**:
```
crimeRate = baseCrime * (1 + densityPressure) * (1 - employmentRate) * (1 - morale/100)
           * (1 + inequalityIndex) * (1 - judgeCoverage)
```

**Undercity**: Below the arcology layers, abandoned infrastructure becomes criminal territory. This is emergent — as arcologies build upward, lower levels are left to decay. The player can invest in undercity maintenance (expensive, reduces crime) or let it rot (cheap, crime pressure increases).

**Iso-Cubes**: Gulag system at megacity scale. Solves overcrowding AND provides forced labor. Same moral choice as historical gulags, just at cosmic scale. The game's thesis remains consistent: the system is the antagonist.

## Long-Running Gameplay Loop (100x for 1 Hour)

### The Math

At 100x speed: 1 real second = 100 game ticks. 1 game year ≈ 12 ticks = 0.12 real seconds.
- 1 hour at 100x = 3600 seconds = 360,000 ticks = ~30,000 game years.
- So an hour-long session starting in 1917 reaches **year ~32,000** — deep into the Deconstruction/Dyson Swarm sub-era.

### What the Player DOES at 100x

At high speed, the player is NOT micromanaging. They're watching civilizational evolution and responding to:
1. **Cold branch activations** — "Alert: Mercury Deconstruction Mandate received" → choose HOW to manage it
2. **Sphere dynamics shifts** — "Western sphere has fragmented into 3 sub-spheres" → affects trade/tension
3. **Pressure crisis emergence** — demographic pressure at Dyson Swarm scale → new settlement mandate
4. **Governance transitions** — "Corporate sphere attempting Type II energy monopoly" → political response
5. **The Long Dark** — generation ship radio silence → hope/despair toggle on morale

The game at 100x should feel like watching a CIVILIZATION unfold, with occasional moments where the player makes high-stakes decisions about the direction of cosmic-scale Soviet planning.

## Verification

1. `npx tsc --noEmit` — zero type errors
2. `pnpm test` — all existing tests pass
3. Dome renders at multiple scales (unit test + visual)
4. Resources tracked correctly per terrain type
5. Carrying capacity triggers expansion pressure
6. Multi-settlement tick completes without crash
7. Cold branches activate in 1000-year freeform run
8. Ecological collapse timeline fires correctly
9. Planetary deconstruction sequence works (Moon → Mercury → Venus → Mars → gas giants)
10. MegaEarth population scales to billions without performance regression
11. Save/load preserves all new state
12. 100x speed for 1 hour (30,000 years) completes without crash or stall
