# Progress

## Critical Reminder

**This is not a city builder.** The player is a predsedatel. The settlement
grows organically. The player does not freely choose buildings or draw roads.

## Current 1.0 Surface

### Engine Architecture

- [x] SimulationEngine phase orchestration.
- [x] TickContext shared across phase modules.
- [x] Yuka-style agent architecture.
- [x] Miniplex ECS and legacy compatibility surfaces.
- [x] Historical governor and classical pressure-valve crisis system.
- [x] Seeded RNG and serialization support.
- [x] Protected government and military building behavior.

### Historical Campaign

- [x] Campaign start fixed to October 1917.
- [x] Seven historical eras ending at the 1991 dissolution endpoint.
- [x] Historical crises and era doctrines.
- [x] One-shot campaign completion modal and score summary path.
- [x] Grounded same-settlement continuation after 1991.

### Settlement Systems

- [x] Organic growth demand pipeline, site selection, construction, and HQ splitting.
- [x] Food, vodka, power, water, money, labor, housing, and population systems.
- [x] Five-year plan quotas and annual review pressure.
- [x] Settlement tiers and local map expansion.
- [x] Per-building and per-tile tick logic.

### Demographics And Workers

- [x] Dvor household model.
- [x] Birth, death, aging, retirement, conscription, and private plots.
- [x] Worker self-organization around priorities.
- [x] Loyalty, morale, sabotage, trudodni, and statistical aggregation.

### Politics And Narrative

- [x] Personnel file, black marks, scrutiny, and consequences.
- [x] KGB, politruks, military, party pressure, succession, and coups.
- [x] Historical worldbuilding timeline and achievements.
- [x] Building panels and HQ tabs as the main UI surface.

### Rendering, Audio, And UI

- [x] React Three Fiber scene rendering for the settlement.
- [x] Historical terrain states, weather, lighting, war overlay, and model mapping.
- [x] Soviet-era audio playlists.
- [x] Historical-only new game setup.
- [x] USSR dissolution modal and grounded continuation copy.

## Removed From 1.0

- [x] Removed deep-future era progression and `the_eternal` runtime scope.
- [x] Removed Kardashev sub-eras and space timeline runtime scope.
- [x] Removed per-world timelines and global expansion layers.
- [x] Removed multi-settlement relocation and settlement switching.
- [x] Removed celestial, Dyson, O'Neill, Mars, alien fauna, arcology, and space rendering scope.
- [x] Removed post-scarcity pressure domains.
- [x] Removed freeform chaos branch product mode.

## Verification Status

- [x] Git bundle backup verified before mutations.
- [x] TypeScript typecheck passed after runtime pruning.
- [x] Focused historical-scope tests added.
- [x] Final lint, targeted tests, build smoke checks, and browser e2e have passed.
