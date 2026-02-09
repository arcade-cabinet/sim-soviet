# Active Context — SimSoviet 2000

## Current Branch

`copilot/add-github-actions-setup` — PR #1: CI/CD + major systems overhaul + Canvas 2D migration.

## Architecture: Canvas 2D + Sprite Baking (COMPLETE)

BabylonJS/Reactylon fully removed. The game uses a **Canvas 2D** renderer with **pre-baked isometric sprites** from GLB models, matching the SimCity 2000 aesthetic.

**Rendering pipeline**: `Canvas2DRenderer.ts` → 6 layers (ground, grid, buildings, hover, preview, particles) drawn via `CanvasRenderingContext2D`. Camera pan/zoom via `Camera2D.ts`. Sprites loaded from `app/public/sprites/soviet/manifest.json` (31 building PNGs + 138 hex tiles).

**Important**: Vite root is `./app`, so static assets must be in `app/public/` (not project-root `public/`).

## Current Work Focus

### PR #1 Finalization
- [x] Canvas 2D migration complete
- [x] Sprite rendering verified (building placement + sprites work)
- [x] CSS layout fix (#root flex chain for canvas height)
- [x] All 795 unit tests passing
- [x] CI workflows: Copilot Setup Steps, Quality Checks, Mobile CI — all green
- [x] CodeRabbit review comments addressed
- [ ] Wait for final CI run to go green
- [ ] Merge PR to main
- [ ] Verify GitHub Pages deployment

### Systems Overhaul Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Seeded RNG | **COMPLETE** |
| 2 | Chronology data layer | Written, not integrated |
| 3 | Chronology engine integration | Pending |
| 4 | Chronology rendering | Ready (Canvas 2D supports it) |
| 5 | sql.js persistence | Schema written, not integrated |
| 6 | Main menu + difficulty | Pending |
| Canvas 2D | Migration from BabylonJS | **COMPLETE** |

## Active Decisions

- **Canvas 2D over BabylonJS**: Pre-baked sprites on 2D canvas
- **Sprite baking via Blender**: Orthographic camera at 60X/45Z (2:1 dimetric), Cycles renderer
- **Dual state**: Both ECS (Miniplex) and GameState exist; ECS not yet driving SimulationEngine
- **Module-level RNG pattern**: `_rng` set by constructors, avoids param threading
- **Chronology model**: 1 tick = 1s, 3 ticks/day, 10 days/month (dekada), 360 ticks/year

## Key Gotchas

- `notifyStateChange()` MUST be called after any `GameState` mutation
- Miniplex predicate archetypes require `world.reindex(entity)` after mutation
- Vite root is `./app` — static assets go in `app/public/`, NOT `public/`
- Audio files ~100MB, need `pnpm download:audio` on fresh clone
- DPR-aware canvas: `canvas.width = w*dpr; ctx.setTransform(dpr,0,0,dpr,0,0)`
- Sprite anchor: `drawX = screenX - anchorX`, `drawY = screenY + TILE_HEIGHT/2 - anchorY`
