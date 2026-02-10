# Active Context — SimSoviet 2000

## Current State

**Branch**: `main` — all PRs merged, deployed to GitHub Pages.

**Live site**: https://arcade-cabinet.github.io/sim-soviet/

## Architecture: Canvas 2D + Sprite Baking (COMPLETE)

BabylonJS/Reactylon fully removed. The game uses a **Canvas 2D** renderer with **pre-baked isometric sprites** from GLB models, matching the SimCity 2000 aesthetic.

**Rendering pipeline**: `Canvas2DRenderer.ts` → 6 layers (ground, grid, buildings, hover, preview, particles) drawn via `CanvasRenderingContext2D`. Camera pan/zoom via `Camera2D.ts`. Sprites loaded from `app/public/sprites/soviet/manifest.json` (31 building PNGs + 138 hex tiles).

**Important**: Vite root is `./app`, so static assets must be in `app/public/` (not project-root `public/`). Asset URLs must use `import.meta.env.BASE_URL` prefix (not hardcoded `/`) to work on GitHub Pages subdirectory deployment.

## Recently Completed

### Current Session (feat/wire-all-game-systems branch)
- [x] **PersonnelFile system** — black marks from quota failures, commendations from exceeding, arrest game-over at 7+ marks, mark decay over time (56 tests)
- [x] **CompulsoryDeliveries system** — state extraction of food/vodka production by doctrine (revolutionary→eternal), stagnation corruption 5-15% (48 tests)
- [x] **SettlementSystem** — selo→posyolok→PGT→gorod evolution with hysteresis (30 ticks up, 60 ticks down), building role requirements, non-agricultural workforce % (28 tests)
- [x] **Game speed** — 1x/2x/3x support via gameStore, GameWorld ticks multiple times per interval
- [x] **All 3 systems wired into SimulationEngine** — 13-step tick loop with CompulsoryDeliveries intercepting production, settlement evaluating tier, personnel tracking arrest
- [x] **GameState/GameSnapshot extended** — settlementTier, blackMarks, commendations, threatLevel
- [x] **Design docs committed** — 10 docs under docs/design/
- [x] **UI prototypes committed** — 6 approved prototypes + design tokens
- [x] **911 unit tests passing** (up from 779)
- [x] **checkQuota refactored** — split into handleQuotaMet/handleQuotaMissed to fix Biome cognitive complexity
- [x] **SovietHUD** — replaced TopBar with approved prototype design (settlement tier, date, resources, pause, speed, hamburger)
- [x] **DrawerPanel** — slide-out command panel with real game data (minimap placeholder, settlement stats, 5-year plan, alerts, personnel file, leader)
- [x] **BottomStrip** — replaced PravdaTicker with combined role/title + inline Pravda ticker
- [x] **Pause overlay** — animated "PAUSED" indicator on viewport
- [x] **scrollbar-hide** CSS utility for mobile resource overflow
- [x] **App layout** — switched from `.game-root` CSS to Tailwind flex column with `100dvh`

### PRs Merged
- **PR #1**: Canvas 2D migration, CI/CD setup, systems overhaul, 795 unit tests
- **PR #2**: Fix deploy workflow (upgrade upload-pages-artifact v3→v4 for SHA pinning)
- **PR #3**: Fix sprite/audio asset paths with Vite BASE_URL for GitHub Pages deployment
- **PR #4**: Game Systems Integration — PolitburoSystem, weather modifiers, biome terrain, leader UI

### Verified Working
- [x] Canvas 2D rendering — sprites, grid, terrain features, particles, ground, depth sorting
- [x] Building placement — all 31 types via categorized toolbar
- [x] Political system — named leaders, ministers, coups, purges, events
- [x] Weather affects gameplay — blizzards kill farms, miraculous sun doubles output
- [x] Production build succeeds (624 KB main JS, 180 KB gzip)

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

## UI Prototype Gallery (ALL APPROVED)

**Branch**: `feat/wire-all-game-systems`
**Viewer**: `http://localhost:3000/prototypes.html` (multi-page Vite build)

| Prototype | File | Theme | Status |
|-----------|------|-------|--------|
| Annual Report (Pripiski) | `src/prototypes/AnnualReportModal.tsx` | Parchment | APPROVED |
| Notification Toasts | `src/prototypes/SovietToastStack.tsx` | Concrete | APPROVED |
| Game HUD + Drawer | `src/prototypes/SovietGameHUD.tsx` | Concrete | APPROVED |
| Radial Build Menu | `src/prototypes/RadialBuildMenu.tsx` | Concrete | APPROVED |
| 5-Year Plan Directive | `src/prototypes/FiveYearPlanModal.tsx` | Parchment | APPROVED |
| Settlement Upgrade | `src/prototypes/SettlementUpgradeModal.tsx` | Hybrid | APPROVED |

### Design System: Dual-Theme Tokens
**File**: `src/design/tokens.ts`
- **Concrete** (dark): `#1a1a1a` → `#2a2a2a` → `#3a3535` surfaces, VT323 font
- **Parchment** (light): `#f4e8d0` → `#e8dcc0` → `#d4c4a0` surfaces, Courier New font
- **Shared accents**: red `#8b0000`, gold `#cfaa48`
- Exports: `concrete`, `parchment`, `accent`, `severity`, `SOVIET_FONT`, `DOCUMENT_FONT`

### UI Process
- User generates initial variants via 21st.dev Magic Components
- Claude integrates, adapts to project patterns, and builds subsequent prototypes from the extracted design system
- Review on phone via `--host 0.0.0.0`

### Key UI Decisions
- **Radial pie menu** for building placement (not toolbar) — tap grid → category ring → building ring
- **Hamburger drawer** (top-right) instead of fixed side panels — maximizes viewport
- **Grid scales to viewport** — no cement borders, zoom locked to fill screen
- **100dvh** for mobile viewport (not `h-screen`) to account for browser chrome

### Dependencies Added
`@headlessui/react`, `lucide-react`, `@radix-ui/react-slider`, `clsx`, `tailwind-merge`, `framer-motion`

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
