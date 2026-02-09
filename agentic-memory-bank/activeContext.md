# Active Context — SimSoviet 2000

## Current State

**Branch**: `main` — all PRs merged, deployed to GitHub Pages.

**Live site**: https://arcade-cabinet.github.io/sim-soviet/

## Architecture: Canvas 2D + Sprite Baking (COMPLETE)

BabylonJS/Reactylon fully removed. The game uses a **Canvas 2D** renderer with **pre-baked isometric sprites** from GLB models, matching the SimCity 2000 aesthetic.

**Rendering pipeline**: `Canvas2DRenderer.ts` → 6 layers (ground, grid, buildings, hover, preview, particles) drawn via `CanvasRenderingContext2D`. Camera pan/zoom via `Camera2D.ts`. Sprites loaded from `app/public/sprites/soviet/manifest.json` (31 building PNGs + 138 hex tiles).

**Important**: Vite root is `./app`, so static assets must be in `app/public/` (not project-root `public/`). Asset URLs must use `import.meta.env.BASE_URL` prefix (not hardcoded `/`) to work on GitHub Pages subdirectory deployment.

## Recently Completed

### PRs Merged
- **PR #1**: Canvas 2D migration, CI/CD setup, systems overhaul, 795 unit tests
- **PR #2**: Fix deploy workflow (upgrade upload-pages-artifact v3→v4 for SHA pinning)
- **PR #3**: Fix sprite/audio asset paths with Vite BASE_URL for GitHub Pages deployment
- **PR #4**: Game Systems Integration — PolitburoSystem, weather modifiers, biome terrain, leader UI, dead config cleanup, simulation interval fix

### Game Systems Integration (Latest)
- [x] **PolitburoSystem wired** — ticks in SimulationEngine, events feed advisor + Pravda
- [x] **Weather modifiers applied** — farmModifier (0–2x) + politburo foodProductionMult stack on food production
- [x] **Vodka modifiers applied** — politburo vodkaProductionMult on vodka production
- [x] **Biome terrain tiles live** — FeatureTileRenderer with manifest anchors, TerrainGenerator on 3-cell border
- [x] **Leader UI** — General Secretary name + personality in TopBar via GameSnapshot
- [x] **Dead config cleaned** — config.ts reduced to GRID_SIZE only
- [x] **798 unit tests + 139 E2E tests passing**
- [x] **Simulation interval bug fixed** — callbacksRef pattern prevents useEffect cleanup killing the tick interval

### Verified Working
- [x] Canvas 2D rendering — sprites, grid, terrain features, particles, ground, depth sorting
- [x] Building placement — all 31 types via categorized toolbar
- [x] Political system — named leaders, ministers, coups, purges, events
- [x] Weather affects gameplay — blizzards kill farms, miraculous sun doubles output
- [x] Terrain features on map borders with seasonal sprite swaps
- [x] 796 unit tests passing
- [x] Production build succeeds (808 KB JS, 237 KB gzip)

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
| PolitburoSystem | Wiring into SimulationEngine | **COMPLETE** |
| Weather modifiers | Applied to food/vodka production | **COMPLETE** |
| Biome terrain | FeatureTileRenderer + TerrainGenerator | **COMPLETE** |
| Dead config | Removed legacy BabylonJS constants | **COMPLETE** |
| Leader UI | Gen. Sec. name in TopBar | **COMPLETE** |

## Active Decisions

- **Canvas 2D over BabylonJS**: Pre-baked sprites on 2D canvas (808 KB JS, 237 KB gzip — PolitburoSystem adds ~500KB)
- **Sprite baking via Blender**: Orthographic camera at 60X/45Z (2:1 dimetric), Cycles renderer
- **Dual state**: Both ECS (Miniplex) and GameState exist; ECS not yet driving SimulationEngine
- **Module-level RNG pattern**: `_rng` set by constructors, avoids param threading
- **Chronology model**: 1 tick = 1s, 3 ticks/day, 10 days/month (dekada), 360 ticks/year
- **Asset URLs**: Use `import.meta.env.BASE_URL` for all public dir references

## Key Gotchas

- `notifyStateChange()` MUST be called after any `GameState` mutation
- Miniplex predicate archetypes require `world.reindex(entity)` after mutation
- Vite root is `./app` — static assets go in `app/public/`, NOT `public/`
- Asset URLs must use `import.meta.env.BASE_URL` prefix for GitHub Pages compatibility
- Audio files ~100MB, need `pnpm download:audio` on fresh clone
- DPR-aware canvas: `canvas.width = w*dpr; ctx.setTransform(dpr,0,0,dpr,0,0)`
- Sprite anchor: `drawX = screenX - anchorX`, `drawY = screenY + TILE_HEIGHT/2 - anchorY`
- `src/vite-env.d.ts` provides `import.meta.env` types — don't delete it
- **callbacksRef pattern**: `GameWorld.tsx` stores `callbacks` in a `useRef` — passing inline callback objects to `useEffect` deps causes the interval to be torn down on every App re-render
- **ECS money sync before PolitburoSystem**: Must read `store.resources.money` into `gameState.money` before `politburo.tick()`, then capture the delta and apply it back to the ECS store
