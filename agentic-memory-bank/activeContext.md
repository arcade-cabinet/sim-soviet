# Active Context — SimSoviet 2000

## Current Branch

`copilot/add-github-actions-setup` — CI/CD setup branch with GitHub Actions workflows + major systems overhaul.

## CRITICAL: Architecture Pivot — BabylonJS → Canvas 2D + Sprite Baking

**Decision made**: The BabylonJS/Reactylon 3D rendering approach is being replaced with a **Canvas 2D** renderer using **pre-baked isometric sprites** from the existing GLB models. This matches the SimCity 2000 aesthetic the project is targeting.

**Rationale**: Copilot originally converted the POC (pure Canvas 2D isometric) into a full 3D BabylonJS app, which was:
- Overly complex for a 2D isometric city-builder
- Missing the classic SC2000 "pieces on a gameboard" feel
- Causing layout/rendering bugs (black viewport, wrong camera mode, 3D HUD elements)

**The new pipeline**:
1. `scripts/sovietize_kenney.py` — Stage 1: Kenney GLBs → Soviet-retextured GLBs (DONE)
2. `scripts/render_sprites.py` — Stage 2: Soviet GLBs → Isometric sprite PNGs (WRITTEN, needs Blender run)
3. New Canvas 2D renderer — replaces BabylonJS/Reactylon (TODO)

**55 GLB models** already exist in `public/models/soviet/` (31 complete buildings + 24 modular pieces).

## Current Work Focus

### Asset Pipeline Completion
- [x] Stage 1: `sovietize_kenney.py` — retexture Kenney models with Soviet concrete
- [x] Stage 2: `render_sprites.py` — render GLBs as 2:1 dimetric isometric sprites
- [ ] Run Stage 2 via `blender --background --python scripts/render_sprites.py`
- [ ] Replace BabylonJS rendering with Canvas 2D using baked sprites

### Systems Overhaul (partially complete)

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Seeded Randomness (SeedSystem + GameRng) | **COMPLETE** |
| 2 | Chronology data layer (types, seasons, weather) | **Data layer written, not yet integrated** |
| 3 | Chronology engine integration | Pending |
| 4 | Chronology rendering (day/night, snow, seasonal) | Pending — will need rethink for Canvas 2D |
| 5 | sql.js persistence layer | Pending |
| 6 | Main menu + difficulty system | Pending |

## Active Decisions

- **Canvas 2D over BabylonJS**: Pre-baked sprites on 2D canvas, matching POC approach
- **Sprite baking via Blender**: Orthographic camera at 60°X/45°Z (2:1 dimetric), Cycles renderer
- **Layout vision**: Concrete texture sidebars framing the tilted game view, top HUD bar, bottom info/dialog bar
- **Dual state**: Both `GameState` and ECS exist; ECS not yet driving SimulationEngine
- **Module-level RNG pattern**: `_rng` set by constructors, avoids param threading
- **Chronology model**: 1 tick = 1s, 3 ticks/day, 10 days/month (dekada), 360 ticks/year ≈ 6 min

## Next Steps

1. **Run sprite pipeline** — `pnpm pipeline:sprites` (requires Blender installed)
2. **Build Canvas 2D renderer** — Replace BabylonJS with `<canvas>` 2D context, sprite drawing, painter's algorithm
3. **Integrate chronology** — Wire ChronologySystem into SimulationEngine
4. **Frame layout** — Concrete texture sidebars, proper HUD bars (like the POC but fancier)

## Important Patterns & Preferences

- Satirical tone in ALL player-facing text
- Soviet brutalist aesthetic — grays, reds, gold accents, CRT effects
- Touch-first design — all interactions must work on mobile
- `notifyStateChange()` must be called after any `GameState` mutation
- Miniplex predicate archetypes require `world.reindex(entity)` after mutations
- `_rng` module-level pattern for seeded randomness across all systems
