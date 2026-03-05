---
type: design
status: draft
implementation: pending
last_verified: 2026-03-04
---

# Climate Agent Terraforming Dual-Use Design

> The same climate system that destroys Earth can build Mars. Polarity inversion
> turns catastrophe into progress.

## Motivation

SimSoviet's `ClimateEventSystem` and `BlackSwanSystem` drive weather disasters and
black swan events on Earth. As the game expands to multi-world timelines (Mars, Venus,
Titan, Jupiter, Belt, Generation Ship), the climate system must work across all worlds
without rewriting it for each destination.

The key insight: **climate polarity**. A warming trend is GLOBAL WARMING on Earth (bad)
but TERRAFORMING on Mars (good). The same drought event that kills crops on Earth
evaporates ice on Mars — which is progress toward a liquid water cycle. A meteor strike
that destroys infrastructure on Earth can deliver ice to Mars poles.

This design extends the existing climate/crisis infrastructure with a per-world polarity
layer, per-world disaster catalogs, and an asteroid diversion mechanic that reframes
destructive events as constructive terraforming.

## Section 1: Climate Polarity by World

Climate polarity determines whether warming/atmospheric changes are beneficial or harmful.
The existing `climateTrend` value from `WorldAgent` (-1 cooling to +1 warming) feeds
into `ClimateEventSystem.evaluate()` and `EcologicalCollapseSystem`. Polarity inverts
the *interpretation* of that trend for each world.

| World | Polarity | Climate Trend Impact | Key worldState Keys Affected |
|-------|----------|---------------------|------------------------------|
| **Earth** | +1 (warming = bad) | warming → infrastructure + health + food pressure, ecological collapse timeline activates | `globalWarming`, `climateTrend`, `permafrostLevel`, `ozoneDegradation` |
| **Mars** | -1 (warming = good) | warming → `marsAtmosphere`+, `marsWater`+, `marsTemperature`+ — progress toward terraforming milestones | `marsAtmPressure`, `marsWater`, `marsTemperature`, `marsEcology`, `marsArableLand` |
| **Venus** | 0 (neutral — already max hot) | warming has no effect. Cloud colony stability *decreases* with atmospheric perturbation. Cooling would be good but is beyond tech level. | `venusCloudStability`, `venusCloudAltitude`, `venusAcidConcentration` |
| **Titan** | +1 (warming = bad) | any warming → methane sea evaporation (bad — methane is the primary industrial resource and habitat fluid) | `titanMethaneLevel`, `titanMethaneSeaArea`, `titanAtmosphericHaze` |
| **Jupiter** (Ganymede) | 0 (neutral) | no atmosphere to terraform. Climate = radiation environment. Magnetic storm intensity from Jupiter's magnetosphere. | `jupiterRadiationLevel`, `jupiterMagneticActivity`, `ganymedeIceStability` |
| **Belt** (Ceres) | 0 (neutral) | no atmosphere, no weather. "Climate" = solar flux and thermal cycling. Solar flares = radiation events. | `beltSolarFlux`, `beltCollisionRisk` |
| **Generation Ship** | 0 (critical neutral) | temperature control is existential. Any deviation from 20±2°C = cascading pressure. No tolerance for trend drift. | `shipTemperature`, `shipAtmosphereIntegrity`, `shipCO2Level`, `shipO2Level` |

### Polarity Mechanics

The `climatePolarity` value (-1, 0, +1) modifies how `ClimateEventSystem` and
`EcologicalCollapseSystem` interpret the `climateTrend`:

```
effectiveTrend = climateTrend * climatePolarity
```

- **Polarity +1 (Earth, Titan)**: `effectiveTrend` matches raw `climateTrend`. Warming
  trend → warming events. Standard behavior.
- **Polarity -1 (Mars)**: `effectiveTrend` is inverted. A positive `climateTrend`
  (warming) produces *beneficial* effects (atmosphere thickening, ice melting, ecology
  expansion). The `ClimateEventSystem` generates "terraforming progress" events instead
  of "climate disaster" events.
- **Polarity 0 (Venus, Jupiter, Belt, Generation Ship)**: Climate trend has no direct
  terrain/atmosphere effect. World-specific systems handle environmental challenges
  independently (acid storms for Venus, radiation for Jupiter, thermal cycling for Belt,
  life support for Generation Ship).

### Integration with Existing Systems

- `ClimateEventSystem.evaluate()` receives a new `worldId` parameter → looks up
  `climatePolarity` from `TerrainProfile` → applies polarity before event selection.
- `EcologicalCollapseSystem.evaluateEcologicalCollapse()` only runs for worlds with
  `climatePolarity === 1` (Earth). Mars/Venus/etc. have their own degradation timelines
  baked into their per-world milestone progressions.
- `terrainTick.ts` already receives `climateTrend` — extended with `climatePolarity`
  to invert permafrost/pollution/erosion effects for Mars (thaw = good).

## Section 2: Per-World Disaster Types

Each world has its own disaster catalog, replacing or extending the Earth-centric
`climateEvents.json`. Disasters feed into the same `CrisisImpact` pipeline.

| World | Disaster Type | Season/Weather Gate | Game Effect |
|-------|--------------|---------------------|-------------|
| **Earth** | Severe frost | WINTER, EARLY_FROST + BLIZZARD | food + infrastructure + health pressure |
| **Earth** | Summer drought | STIFLING_HEAT + HEATWAVE | food pressure, production drop |
| **Earth** | Spring flood | RASPUTITSA_SPRING + MUD_STORM | infrastructure pressure, decay |
| **Earth** | Wildfire | STIFLING_HEAT + HEATWAVE | infrastructure destruction, production drop |
| **Earth** | Seasonal epidemic | WINTER, RASPUTITSA_AUTUMN + FOG | health + demographic pressure |
| **Earth** | Hailstorm | SHORT_SUMMER + RAIN | food + infrastructure pressure |
| **Mars** | Planet-wide dust storm | Any (no season gate — Mars has 2 seasons) | blocks orbital mirrors → climate setback (`marsTemperature` -0.02), production halt, equipment damage |
| **Mars** | Obliquity shift | None (pure probability, very rare) | multi-century climate setback, terraforming milestone regression, political crisis (Reds vindicated) |
| **Mars** | Perchlorate resurgence | Post-cleanup only | food pressure from contamination, health pressure |
| **Mars** | Subsurface ice collapse | Post-water-mining only | infrastructure damage, water loss, settlement evacuation |
| **Venus** | Acid storm (sulfuric acid rain intensification) | Any | cloud habitat damage (`venusCloudStability` -0.1), health pressure, equipment corrosion |
| **Venus** | Altitude drift (colony drops below safe layer) | Any | existential threat — emergency ballast dump, infrastructure pressure |
| **Venus** | Atmospheric super-rotation event | Any | extreme winds at cloud layer, structural stress |
| **Jupiter** | Radiation surge (Jovian magnetosphere fluctuation) | Any | equipment failure, health pressure (radiation sickness), forced shelter |
| **Jupiter** | Magnetic storm (Io-driven plasma torus) | Any | communication blackout, equipment degradation, mortality risk |
| **Jupiter** | Ice quake (Ganymede tidal stress) | Any | infrastructure damage, subsurface habitat breach risk |
| **Titan** | Methane storm (liquid methane precipitation surge) | Any | infrastructure damage from methane floods, equipment corrosion |
| **Titan** | Nitrogen geyser eruption | Any | explosive decompression risk, infrastructure damage, morale pressure |
| **Titan** | Ethane lake surge (cryogenic tsunami) | Any | settlement inundation, resource contamination |
| **Belt** | Collision (undetected body impact) | N/A | equipment destruction, hull breach, potential total loss |
| **Belt** | Solar flare (high-energy particle event) | N/A | radiation exposure, electronics damage, communication disruption |
| **Belt** | Outgassing (volatile sublimation on Ceres) | N/A | unexpected terrain changes, infrastructure displacement |
| **Generation Ship** | Hull breach (micrometeorite or fatigue failure) | N/A | existential — atmosphere loss, emergency compartment sealing |
| **Generation Ship** | Reactor instability (fusion containment degradation) | N/A | power crisis, radiation risk, existential threat |
| **Generation Ship** | Mutiny (sociopolitical collapse in sealed environment) | N/A | political + morale + loyalty pressure, potential factional split |
| **Generation Ship** | Ecosystem cascade failure (biome collapse) | N/A | food + health + demographic pressure, O2/CO2 imbalance |

### Disaster Catalog Architecture

Each world gets its own JSON file in `src/config/`:

```
src/config/climateEvents.json          ← Earth (existing)
src/config/climateEventsMars.json      ← Mars disasters
src/config/climateEventsVenus.json     ← Venus disasters
src/config/climateEventsJupiter.json   ← Jupiter (Ganymede) disasters
src/config/climateEventsTitan.json     ← Titan disasters
src/config/climateEventsBelt.json      ← Belt (Ceres) disasters
src/config/climateEventsShip.json      ← Generation Ship disasters
```

All files use the same `ClimateEventDef` schema. For worlds without seasons,
`validSeasons` is set to `["ALL"]` (new sentinel value). For worlds without weather,
`weatherBoosts` is empty.

The `ClimateEventSystem` receives a `worldId` parameter and loads the corresponding
catalog. This is a minor change to `evaluate()`:

```typescript
evaluate(
  season: Season | 'ALL',
  weather: WeatherType | 'NONE',
  climateTrend: number,
  rng: GameRng,
  worldId: string = 'earth',  // NEW: default to Earth for backward compat
): { impacts: CrisisImpact[]; pressureSpikes: ... }
```

## Section 3: Asteroid Diversion Mechanic

Meteor strikes (Tier 3 black swan events in `BlackSwanSystem`) are destructive on Earth.
With the right technology and conditions, they can be REDIRECTED to Mars as constructive
terraforming — delivering ice and volatiles to the Martian surface.

### Unlock Conditions

The asteroid diversion capability unlocks through the timeline milestone system:

1. **`asteroid_diversion` capability** — unlocked by one of:
   - Space timeline milestone `belt_resource_extraction` (Belt mining = asteroid handling tech)
   - Space timeline milestone `asteroid_redirect` (dedicated redirect mission)
   - Belt per-world timeline milestone `ceres_orbital_mechanics` (deep Belt operational expertise)

2. **Active diversion conditions** (all must be true):
   - `asteroid_diversion` capability unlocked
   - `techLevel > 0.7` (sufficient propulsion/guidance technology)
   - `marsAtmPressure > 0.1` (Mars has enough atmosphere for meaningful impact)
   - Mars per-world timeline active (colony exists)

### Diversion Flow

When `rollMeteorStrike()` fires in `BlackSwanSystem.roll()`:

```
1. Roll meteor strike (existing logic, unchanged)
2. IF meteor fires AND diversion conditions met:
   a. Roll diversion success: 60% chance of successful redirect
   b. SUCCESS (60%):
      - Meteor impact suppressed on current world
      - Mars worldState updated:
        - marsWater += 0.05 * magnitude
        - marsAtmPressure += 0.01 * magnitude
        - marsTemperature += 0.005 * magnitude (kinetic energy → heat)
      - CrisisImpact generated:
        - crisisId: "diverted-meteor-{year}"
        - No infrastructure/workforce damage
        - narrative.pravdaHeadlines: "ASTEROID SUCCESSFULLY DIVERTED TO MARS POLAR CAP"
        - narrative.toastMessages: "Asteroid impact delivers {magnitude * 50}kt of ice to Mars"
      - Pressure relief: morale -0.05 (public triumph)
   c. FAILURE (40%):
      - Meteor hits Mars colony unintended location
      - Mars infrastructure pressure spike: +0.15
      - Mars health pressure spike: +0.1
      - CrisisImpact generated:
        - crisisId: "failed-diversion-{year}"
        - infrastructure: { decayMult: 1.3, destructionTargets: [random Mars grid pos] }
        - narrative.pravdaHeadlines: "ASTEROID DIVERSION MISCALCULATED — Impact in Wrong Sector"
        - narrative.toastMessages: "Diversion failed! Unintended impact on Mars colony"
      - Political pressure spike: +0.1 (accountability)
3. IF meteor fires AND diversion conditions NOT met:
   - Standard Earth impact (existing BlackSwanSystem behavior, unchanged)
```

### Historical Basis

- **Project Icarus** (1967 MIT study): Analyzed redirecting asteroid 1566 Icarus using
  Saturn V rockets with nuclear warheads. Concluded that trajectory modification was
  feasible with existing technology for small bodies (<1 km). The project established
  the mathematical framework for kinetic impactor calculations.
- **NASA DART mission** (2022): Successfully altered the orbit of Dimorphos (160m
  moonlet of Didymos) by 33 minutes using a kinetic impactor. Demonstrated that
  asteroid deflection is operationally achievable.
- **Comet capture for terraforming**: Kim Stanley Robinson's Mars Trilogy describes
  redirecting comets and ice-rich asteroids to Mars to deliver water and volatiles.
  This is the primary water import mechanism for KSR's Martian oceans.
- **Soviet precedent**: The Soviet space program investigated nuclear-powered asteroid
  redirect missions in the 1970s-80s (classified until 1991). The Energia launcher
  (1987) had the payload capacity for deep-space redirect missions.

### Implementation in BlackSwanSystem

The diversion check hooks into `BlackSwanSystem.roll()` after the existing meteor
logic. It requires access to:
- `TimelineLayerState.unlockedCapabilities` (for `asteroid_diversion` check)
- `TimelineContext.worldState` (for `marsAtmPressure`, `techLevel` checks)
- `TimelineContext.allActivatedMilestones` (for Mars colony existence check)

New parameter on `BlackSwanSystem.roll()`:

```typescript
roll(
  year: number,
  rng: GameRng,
  gridSize: number,
  diversionContext?: {  // NEW: optional, absent for backward compat
    canDivert: boolean;
    techLevel: number;
    marsAtmPressure: number;
    marsColonyActive: boolean;
  },
): BlackSwanResult  // Extended: add diversionResult field
```

## Section 4: TerrainProfile Extension

Each world needs a `TerrainProfile` that tells the climate/crisis systems how to behave.
This is the bridge between the data-driven timeline milestones and the procedural
climate/terrain systems.

### TerrainProfile JSON Structure

```jsonc
{
  "worldId": "mars",
  "displayName": "Mars",

  // Climate polarity: how warming trend is interpreted
  // +1 = warming is bad (Earth, Titan)
  // -1 = warming is good (Mars — terraforming)
  //  0 = warming is neutral/irrelevant (Venus, Jupiter, Belt, Ship)
  "climatePolarity": -1,

  // Natural disasters valid for this world (IDs from climateEvents*.json)
  "naturalDisasters": [
    "mars_dust_storm",
    "mars_obliquity_shift",
    "mars_perchlorate_resurgence",
    "mars_ice_collapse"
  ],

  // Whether asteroid diversion can target this world
  "asteroidDiversionViable": true,

  // Whether the atmosphere can be terraformed (thickened/thinned)
  "atmosphereTerraformable": true,

  // Target atmospheric pressure for terraforming completion (atm)
  // Mars: 0.5 atm (500 mbar, ~50% Earth sea level)
  // Venus: not terraformable (too much atmosphere, not too little)
  // Earth: 1.0 atm (baseline, not terraforming target)
  "atmosphereTarget_atm": 0.5,

  // Starting atmospheric pressure (atm) — for worldState initialization
  "atmosphereStart_atm": 0.006,

  // Surface gravity (Earth = 1.0) — affects building construction time,
  // worker productivity, demographic systems
  "surfaceGravity": 0.38,

  // Whether this world has seasons (affects ClimateEventSystem gating)
  "hasSeasons": false,

  // Whether this world has weather (affects ClimateEventSystem weather boosts)
  "hasWeather": true,  // Mars has dust storms, wind

  // Pressure domains that are active on this world
  // (subset of the 10 PressureDomains)
  "activePressureDomains": [
    "food", "morale", "loyalty", "housing", "political",
    "power", "infrastructure", "demographic", "health", "economic"
  ],

  // Additional pressure domains unique to this world
  // (not in the standard 10 — would need PressureDomain extension)
  "extraPressureDomains": ["radiation", "atmosphere"],

  // World-specific resource keys tracked in worldState
  "trackedResources": [
    "marsAtmPressure", "marsWater", "marsTemperature",
    "marsEcology", "marsArableLand"
  ],

  // Climate events JSON file path (relative to src/config/)
  "climateEventsFile": "climateEventsMars.json"
}
```

### Per-World TerrainProfiles

| World | climatePolarity | asteroidDiversionViable | atmosphereTerraformable | atmosphereTarget_atm | surfaceGravity | hasSeasons | hasWeather |
|-------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Earth | +1 | true | false (already habitable) | 1.0 | 1.0 | true | true |
| Mars | -1 | true | true | 0.5 | 0.38 | false | true |
| Venus | 0 | true | false (cloud colony, not surface) | N/A (cloud layer at 1.0 atm) | 0.9 | false | true |
| Jupiter (Ganymede) | 0 | false | false (no atmosphere to modify) | N/A | 0.146 | false | false |
| Titan | +1 | false | false (atmosphere is useful as-is) | N/A | 0.14 | true | true |
| Belt (Ceres) | 0 | false (you ARE the belt) | false | N/A | 0.029 | false | false |
| Generation Ship | 0 | false | false (sealed system) | 1.0 (controlled) | varies (rotation) | false (artificial) | false (controlled) |

### File Location

`src/config/terrainProfiles.json` — array of `TerrainProfile` objects, one per world.

### Runtime Access

```typescript
// src/game/timeline/TerrainProfileRegistry.ts
import profiles from '@/config/terrainProfiles.json';

export function getTerrainProfile(worldId: string): TerrainProfile | undefined {
  return profiles.find(p => p.worldId === worldId);
}

export function getClimatePolarity(worldId: string): number {
  return getTerrainProfile(worldId)?.climatePolarity ?? 1; // default Earth
}

export function isAsteroidDiversionViable(worldId: string): boolean {
  return getTerrainProfile(worldId)?.asteroidDiversionViable ?? false;
}
```

## Section 5: Implementation Path

The design hooks into existing systems with minimal rewrites. Each step is independently
testable and deployable.

### Step 1: TerrainProfile JSON + Registry (no existing code changes)

1. Create `src/config/terrainProfiles.json` with all 7 world profiles.
2. Create `src/game/timeline/TerrainProfileRegistry.ts` (pure TypeScript, no side effects).
3. Tests: unit tests for `getTerrainProfile()`, `getClimatePolarity()`,
   `isAsteroidDiversionViable()`.

### Step 2: ClimateEventSystem Polarity Support (minor change)

1. Add optional `worldId` parameter to `ClimateEventSystem.evaluate()`.
2. Look up `climatePolarity` from `TerrainProfileRegistry`.
3. Apply `effectiveTrend = climateTrend * climatePolarity` before event evaluation.
4. When `climatePolarity === -1` (Mars): positive trend generates "terraforming
   progress" impacts instead of "climate disaster" impacts:
   - Reuse `CrisisImpact` structure but with *positive* worldState deltas
   - `economy.productionMult > 1.0` instead of `< 1.0`
   - Narrative: "TERRAFORMING PROGRESS" instead of "CLIMATE DISASTER"
5. Backward compatible: `worldId` defaults to `'earth'`, behavior unchanged.

### Step 3: Per-World Disaster Catalogs (additive)

1. Create `climateEventsMars.json`, `climateEventsVenus.json`, etc.
2. Modify `ClimateEventSystem` constructor or `evaluate()` to accept a catalog
   override. Default catalog = existing `climateEvents.json` (Earth).
3. `FreeformGovernor` passes the correct catalog based on active world context.
4. Generation Ship disasters use the same pipeline but with `'ALL'` season gate.

### Step 4: Asteroid Diversion in BlackSwanSystem (additive)

1. Add optional `diversionContext` parameter to `BlackSwanSystem.roll()`.
2. When a meteor fires AND diversion is viable, apply the diversion logic
   (Section 3 above).
3. Return diversion result in `BlackSwanResult` (new optional field).
4. `FreeformGovernor.evaluate()` assembles `diversionContext` from timeline state.
5. Backward compatible: absent `diversionContext` = existing behavior.

### Step 5: Wire into FreeformGovernor (integration)

1. `FreeformGovernor.evaluate()` already has the Tier 2 (climate) and Tier 3
   (black swan) pipeline. Extend with:
   - Pass `worldId` to `ClimateEventSystem.evaluate()`
   - Pass `diversionContext` to `BlackSwanSystem.roll()`
2. For multi-world support, the governor evaluates each active world's climate
   system separately. Each per-world timeline tracks which world is "active"
   for the player's current settlement.
3. Terraforming worldState deltas from inverted climate events feed back into
   `TimelineContext.worldState`, where they can trigger Mars timeline milestones
   (e.g., `mars_first_open_water` requires `marsTemperature > 0.15`).

### Step 6: EcologicalCollapseSystem World Scoping (minor change)

1. `evaluateEcologicalCollapse()` receives a `worldId` parameter.
2. Earth-specific collapse events (permafrost, ozone, etc.) only fire for
   `worldId === 'earth'`.
3. Mars-specific ecological milestones are handled by the per-world timeline
   (already implemented in `marsTimeline.json` — `mars_native_ecology`,
   `mars_ocean_formation`, etc.).
4. No new EcologicalCollapseSystem for other worlds — their environmental
   progression is milestone-driven, not tick-driven.

### Dependencies

```
Step 1 (TerrainProfile) ← no deps
Step 2 (ClimateEventSystem polarity) ← Step 1
Step 3 (per-world catalogs) ← Step 1
Step 4 (asteroid diversion) ← Step 1
Step 5 (governor integration) ← Steps 2, 3, 4
Step 6 (ecological scoping) ← Step 1
```

Steps 2, 3, 4 can be developed in parallel after Step 1 completes.

### What NOT to Rewrite

- `ClimateEventSystem` core loop — only add `worldId` param and polarity lookup.
- `BlackSwanSystem` core loop — only add optional `diversionContext` and diversion branch.
- `EcologicalCollapseSystem` — only add worldId gate, not per-world collapse catalogs.
- `CrisisImpact` interface — unchanged. Terraforming impacts use the same structure
  with positive values where Earth impacts use negative values.
- `PressureDomain` type — keep the existing 10 domains. World-specific "extra" domains
  (radiation, atmosphere) can be tracked as worldState keys rather than first-class
  pressure domains, avoiding type changes across the codebase.
- `FreeformGovernor` architecture — the 3-tier pipeline (Pressure → Climate → BlackSwan)
  is extended, not replaced.

### File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `src/config/terrainProfiles.json` | NEW | Per-world terrain profiles |
| `src/game/timeline/TerrainProfileRegistry.ts` | NEW | Profile lookup utilities |
| `src/config/climateEventsMars.json` | NEW | Mars disaster catalog |
| `src/config/climateEventsVenus.json` | NEW | Venus disaster catalog |
| `src/config/climateEventsJupiter.json` | NEW | Jupiter disaster catalog |
| `src/config/climateEventsTitan.json` | NEW | Titan disaster catalog |
| `src/config/climateEventsBelt.json` | NEW | Belt disaster catalog |
| `src/config/climateEventsShip.json` | NEW | Generation Ship disaster catalog |
| `src/ai/agents/crisis/ClimateEventSystem.ts` | MODIFY | Add `worldId` param, polarity lookup |
| `src/ai/agents/crisis/BlackSwanSystem.ts` | MODIFY | Add optional `diversionContext`, diversion logic |
| `src/ai/agents/crisis/EcologicalCollapseSystem.ts` | MODIFY | Add `worldId` gate |
| `src/ai/agents/crisis/FreeformGovernor.ts` | MODIFY | Pass worldId + diversionContext to subsystems |
