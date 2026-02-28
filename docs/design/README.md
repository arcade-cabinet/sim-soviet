# SimSoviet 1917 — Game Design Documents

## Alternate History. The Soviet State Endures.

Each file covers a single design domain. Together they form the complete game design.

**For the unified overview**: See [../GAME_VISION.md](../GAME_VISION.md)
**For the full master GDD**: See [../GDD-master.md](../GDD-master.md)

### Domain Index

| File | Domain | Status |
|------|--------|--------|
| [overview.md](overview.md) | Game identity, core fantasy, core loop, settlement evolution | **Complete** |
| [economy.md](economy.md) | Planned economy: trudodni, fondy, blat, compulsory deliveries, production formulas, heating, storage | **Complete** |
| [workers.md](workers.md) | Worker roles, lifecycle, morale/loyalty/skill, autonomous collective, population dynamics | **Complete** |
| [demographics.md](demographics.md) | Dvor (household) system, family structures, gendered labor, birth/death | **Draft** |
| [political.md](political.md) | Politruks, KGB, military, personnel file, black marks, pripiski | **Complete** |
| [eras.md](eras.md) | 8 era campaigns, transitions, doctrine integration, victory/failure | **Complete** |
| [map-terrain.md](map-terrain.md) | Procedural generation, camera, terrain types | **Complete** |
| [ui-ux.md](ui-ux.md) | Mobile-first brutalist design, panels, gestures, notifications | **Complete** |
| [minigames.md](minigames.md) | 8 building/tile-triggered minigames | **Complete** |
| [scoring.md](scoring.md) | Scoring, difficulty, permadeath, consequences | **Complete** |
| buildings.md | Construction flow, unlock progression, categories by era | Pending |
| audio.md | Music, SFX, era-specific audio | Pending |

### Reference Docs (in parent `docs/`)

Deep architecture and content documents that complement the domain docs above:

- `design-ecs-architecture.md` — Miniplex 2.0 ECS specification
- `design-leadership-architecture.md` — Political ECS components, modifier pipeline
- `design-era-doctrines.md` — 8 composable policy modifier sets
- `design-leader-archetypes.md` — 11 procedural leader personalities
- `design-power-transitions.md` — 7 succession mechanics
- `design-dialog-bible.md` — Complete in-game voice guide
- `reference-politburo-system.md` — Ministry simulation engine
- `reference-pravda-system.md` — Procedural headline generator
- `reference-world-building.md` — Timeline events, achievements, flavor

### Design Principles

1. **Historical authenticity first** — Research how the real Soviet system worked, then gamify it
2. **The system is the enemy** — No external threats, only the apparatus
3. **Comfortable mediocrity** — The optimal strategy is being unremarkable
4. **Top-down pressure** — The player never chooses what to build, only where to survive mandates
5. **Workers, not buildings** — People are the central resource
6. **Autonomous collective** — Workers self-organize; the player sets priorities and intervenes in crisis
7. **Satirical tone** — All user-facing text maintains dark comedy
