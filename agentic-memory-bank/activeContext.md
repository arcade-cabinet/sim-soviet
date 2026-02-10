# Active Context — SimSoviet 2000

## Current State

**Branch**: `feat/wire-all-game-systems` — active development, ECS Unification complete.

**Live site**: https://arcade-cabinet.github.io/sim-soviet/

## Architecture: Canvas 2D + ECS-Direct (GameState ELIMINATED)

BabylonJS/Reactylon fully removed. The game uses a **Canvas 2D** renderer with **pre-baked isometric sprites** from GLB models, matching the SimCity 2000 aesthetic.

**ECS is the single source of truth.** The old `GameState` class has been deleted. All systems read/write ECS directly:
- **Resources**: `getResourceEntity()!.resources.*` (money, food, vodka, power, population)
- **Metadata**: `getMetaEntity()!.gameMeta.*` (date, quota, leader, settlement, personnel, gameOver, selectedTool, seed)
- **Buildings**: `buildingsLogic.entities` (ECS archetype query)
- **Grid**: `GameGrid` class (spatial index only — no resource/building data)
- **React bridge**: `gameStore.ts` → `createSnapshot()` reads ECS directly via `useSyncExternalStore`

**Rendering pipeline**: `Canvas2DRenderer.ts` → 6 layers (ground, grid, buildings, hover, preview, particles) drawn via `CanvasRenderingContext2D`. Camera pan/zoom via `Camera2D.ts`. Sprites loaded from `app/public/sprites/soviet/manifest.json` (31 building PNGs + 138 hex tiles).

**Important**: Vite root is `./app`, so static assets must be in `app/public/` (not project-root `public/`). Asset URLs must use `import.meta.env.BASE_URL` prefix (not hardcoded `/`) to work on GitHub Pages subdirectory deployment.

## Recently Completed

### ECS Unification (6 Phases — ALL COMPLETE)
- [x] **Phase 1**: Foundation types — GameGrid, GameView, GameMeta ECS component, createMetaStore factory
- [x] **Phase 2**: SimulationEngine — writes ECS directly, deleted syncEcsToGameState, deleted PolitburoSystem delta-capture hack
- [x] **Phase 3**: Systems — EventSystem/PravdaSystem use GameView, PolitburoSystem reads ECS directly
- [x] **Phase 4**: Rendering+Input — Canvas2DRenderer/CanvasGestureManager take GameGrid, read ECS for buildings/money
- [x] **Phase 5**: Store+Save+Wire — gameStore reads ECS, SaveSystem takes GameGrid, GameWorld creates both ECS stores
- [x] **Phase 6**: Delete GameState, update 8 test files (897 tests pass, 0 GameState references remain)

### Previous Work (feat/wire-all-game-systems branch)
- [x] All 6 UI prototypes approved and wired into game
- [x] PersonnelFile, CompulsoryDeliveries, SettlementSystem — all integrated
- [x] Annual Report (pripiski) falsification mechanic
- [x] Legacy type→defId migration complete

### PRs Merged
- **PR #1**: Canvas 2D migration, CI/CD setup, systems overhaul, 795 unit tests
- **PR #2**: Fix deploy workflow (upload-pages-artifact v3→v4)
- **PR #3**: Fix sprite/audio asset paths with Vite BASE_URL
- **PR #4**: Game Systems Integration — PolitburoSystem, weather modifiers, biome terrain

## Key Gotchas

- `notifyStateChange()` MUST be called after any ECS mutation that should trigger React re-renders
- Miniplex predicate archetypes require `world.reindex(entity)` after mutation
- Vite root is `./app` — static assets go in `app/public/`, NOT `public/`
- Asset URLs must use `import.meta.env.BASE_URL` prefix for GitHub Pages compatibility
- Audio files ~100MB, need `pnpm download:audio` on fresh clone
- DPR-aware canvas: `canvas.width = w*dpr; ctx.setTransform(dpr,0,0,dpr,0,0)`
- Sprite anchor: `drawX = screenX - anchorX`, `drawY = screenY + TILE_HEIGHT/2 - anchorY`
- **callbacksRef pattern**: `GameWorld.tsx` stores `callbacks` in a `useRef` — inline objects as useEffect deps kill the simulation interval
- **No more GameState**: All data lives in ECS. Systems use `getResourceEntity()` and `getMetaEntity()` directly.
- **GameView is read-only**: Built fresh per tick from ECS for EventSystem/PravdaSystem lambda conditions — same field names as old GameState

## Active Decisions

- **Canvas 2D over BabylonJS**: Pre-baked sprites on 2D canvas (664 KB main JS, 190 KB gzip)
- **Sprite baking via Blender**: Orthographic camera at 60X/45Z (2:1 dimetric), Cycles renderer
- **ECS as single source of truth**: GameState eliminated, ECS drives everything
- **Module-level RNG pattern**: `_rng` set by constructors, avoids param threading
- **Chronology model**: 1 tick = 1s, 3 ticks/day, 10 days/month (dekada), 360 ticks/year
- **Asset URLs**: Use `import.meta.env.BASE_URL` for all public dir references
