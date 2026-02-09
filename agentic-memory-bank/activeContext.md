# Active Context — SimSoviet 2000

## Current Branch

`copilot/add-github-actions-setup` — CI/CD setup branch with GitHub Actions workflows + major systems overhaul.

## Current Work Focus

Implementing a **Major Systems Overhaul Plan** with 6 execution phases. Phase 1 is complete and Phase 2 data layer is written. The plan covers: seeded randomness, chronology system (seasons/weather/day-night), sql.js persistence, and main menu with difficulty selection.

### Phase Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Seeded Randomness (SeedSystem + GameRng) | **COMPLETE** |
| 2 | Chronology data layer (types, seasons, weather) | **Data layer written, not yet integrated** |
| 3 | Chronology engine integration | Pending |
| 4 | Chronology rendering (day/night, snow, seasonal) | Pending |
| 5 | sql.js persistence layer | Pending |
| 6 | Main menu + difficulty system | Pending |

### Recently Completed — Phase 1: Seeded Randomness
- Created `src/game/SeedSystem.ts` with `GameRng` class wrapping `seedrandom`
- Soviet-themed seed phrases: 60 adjectives × 60 nouns = 216K combos (e.g., "frozen-dialectical-turnip")
- Wired `GameRng` into ALL systems that used `Math.random()`:
  - SimulationEngine, EventSystem, PravdaSystem, PolitburoSystem
  - NameGenerator, WorldBuilding, CitizenClasses, populationSystem
- Module-level `_rng` pattern: each module stores a `GameRng | null` set by constructor, so generator functions don't need param changes
- Added `seed` field to GameState and GameSnapshot
- GameWorld.tsx creates GameRng from seed and passes to SimulationEngine

### Recently Completed — Phase 2 Data Layer (not yet integrated)
- Created `src/game/Chronology.ts` — GameDate interface, Season enum, 7-season table, day/night phases, date formatting
- Created `src/game/WeatherSystem.ts` — 9 weather types with profiles, per-season probability tables, weather rolling
- Created `src/game/ChronologySystem.ts` — Tick advancement, season transitions, weather changes, serialize/deserialize

### Previously Completed (last session)
- **Documentation sprint**: 11 design docs totaling 3,891 lines in `docs/`
- **PravdaSystem rewrite**: 1,460 lines, 61 generators, 359 pool entries, 145K+ headline combos
- **PolitburoSystem**: 2,196 lines — ministry/politburo management with 8x10 personality matrix
- **NameGenerator**: 1,108 lines, 1.1M+ unique name combinations
- **WorldBuilding content module**: Timeline, radio announcements, achievements, city naming
- **CI/CD improvements**: Audit and fixes to GitHub Actions workflows

## Active State

- Building placement works (6 types + road + bulldoze)
- SimulationEngine ticks resources every second with seeded RNG
- Event system fires seeded random events with satirical text
- Pravda ticker displays propaganda headlines with seeded generation
- Audio system has 40+ Soviet-era tracks loaded
- Touch controls use GestureManager
- PolitburoSystem written but not yet wired into SimulationEngine.tick()
- Chronology data layer written but not yet replacing SimulationEngine.advanceTime()

## Active Decisions

- **Dual state**: Both `GameState` (mutable class) and ECS (`world` from Miniplex) exist. ECS systems are written but `SimulationEngine` still uses `GameState` directly.
- **Module-level RNG pattern**: Each module stores a `GameRng | null` reference set by the class constructor. This avoids threading RNG through every function parameter in systems with 60+ generator functions.
- **Chronology model**: 1 tick = 1s real, 3 ticks/day, 10 days/month (Soviet dekada), 12 months/year → 360 ticks/year ≈ 6 real minutes
- **7 Russian seasons**: WINTER (Nov-Mar), RASPUTITSA_SPRING (Apr), SHORT_SUMMER (May), GOLDEN_WEEK (Jun), STIFLING_HEAT (Jul-Aug), EARLY_FROST (Sep), RASPUTITSA_AUTUMN (Oct)
- **PolitburoSystem integration still pending**
- **No 3D models yet**: Buildings are procedural BabylonJS meshes

## Next Steps (Overhaul Plan Phases 3-6)

1. **Phase 3**: Wire ChronologySystem into SimulationEngine, apply seasonal modifiers, heating costs, tick-based cooldowns
2. **Phase 4**: DayLightController, controllable snow/rain, seasonal ground colors, TopBar date display
3. **Phase 5**: sql.js WASM persistence (save/load .db files, IndexedDB continue)
4. **Phase 6**: Main menu (New Game/Continue/Load), difficulty selection (COMRADE/PARTY/GULAG), seed display

## Important Patterns & Preferences

- Satirical tone in ALL player-facing text — events, tooltips, advisor messages
- Soviet brutalist aesthetic — grays, reds, gold accents, CRT effects
- Touch-first design — all interactions must work on mobile without conflict
- `notifyStateChange()` must be called after any `GameState` mutation
- Miniplex predicate archetypes require `world.reindex(entity)` after mutating the predicate field
- `_rng` module-level pattern for seeded randomness across all systems
