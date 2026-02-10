# Visual/UX Wiring Plan — PBR Iteration

## Problem Statement

All screen components (LandingPage, NewGameFlow, AssignmentLetter) are BUILT but NOT wired into the app.
Camera has NO edge clamping — you can pan infinitely past the grid.
The old IntroModal is still the only entry point. No proper game flow exists.

## Current State

- `app/App.tsx`: Uses `gameStarted` boolean + `IntroModal` → direct into game
- `src/components/screens/LandingPage.tsx`: BUILT, NOT WIRED. Has onNewGame/onContinue/onLoadGame
- `src/components/screens/NewGameFlow.tsx`: BUILT, NOT WIRED. 3-step config (name, params, consequences)
- `src/components/screens/AssignmentLetter.tsx`: BUILT, NOT WIRED. Shows era briefing + config summary
- `src/rendering/Camera2D.ts`: pan()/zoomAt() have NO bounds clamping
- `src/components/GameWorld.tsx`: Hardcodes seed, map size 'medium', ignores config

## Workstreams (3 parallel agents)

### Agent 1: `app-flow` (App.tsx + flow state machine)

**Goal**: Replace the IntroModal with LandingPage → NewGameFlow → AssignmentLetter → Game

1. Add state machine to App.tsx: `'landing' | 'newGame' | 'assignment' | 'playing'`
2. Add `NewGameConfig` state to hold the config from NewGameFlow
3. Wire LandingPage: onNewGame → 'newGame', onContinue → 'playing' (stub), onLoadGame → (stub)
4. Wire NewGameFlow: onStart(config) → save config → 'assignment', onBack → 'landing'
5. Wire AssignmentLetter: look up era from config.startEra, onAccept → 'playing'
6. Remove IntroModal import and usage entirely
7. Pass `gameConfig` prop down to GameWorld
8. Update GameWorld Props interface to accept optional `NewGameConfig`
9. Remove the hardcoded `generateSeedPhrase()` — use `config.seed` instead
10. Use `config.mapSize` for MapSystem instead of hardcoded `'medium'`
11. Pass `config.startEra` and `config.difficulty` into createMetaStore

**Key files**: `app/App.tsx`, `src/components/GameWorld.tsx`
**Import**: `NewGameFlow` from `@/components/screens/NewGameFlow`, `LandingPage` from `@/components/screens/LandingPage`, `AssignmentLetter` from `@/components/screens/AssignmentLetter`, `ERA_DEFINITIONS` from `@/game/era`

### Agent 2: `camera-clamp` (Camera2D edge clamping)

**Goal**: Prevent the camera from panning beyond the isometric grid bounds

1. Add `setBounds(minX, minY, maxX, maxY)` method to Camera2D
2. Add `clamp()` private method that enforces bounds on `this.x` and `this.y`
3. Call `clamp()` at the end of `pan()` and `zoomAt()`
4. Calculate grid world-space bounds from GridMath:
   - Grid corner (0,0) → gridToScreen(0,0) = (0, 0)
   - Grid corner (GRID_SIZE, 0) → gridToScreen(GRID_SIZE, 0)
   - Grid corner (0, GRID_SIZE) → gridToScreen(0, GRID_SIZE)
   - Grid corner (GRID_SIZE, GRID_SIZE) → gridToScreen(GRID_SIZE, GRID_SIZE)
   - The world bounding box: minX = left corner X, maxX = right corner X, minY = top corner Y, maxY = bottom corner Y
5. Add padding (half viewport) so edge tiles are still visible
6. Set the bounds in GameWorld.tsx after creating Camera2D (which is inside Canvas2DRenderer)
7. Update Camera2D tests to verify clamping

**Key files**: `src/rendering/Camera2D.ts`, `src/components/GameWorld.tsx`, `src/__tests__/Camera2D.test.ts`
**Grid math**: `gridToScreen(0,0)=(0,0)`, `gridToScreen(30,0)=(1200,600)`, `gridToScreen(0,30)=(-1200,600)`, `gridToScreen(30,30)=(0,1200)`. So world bounds are roughly X:[-1200,1200], Y:[0,1200].

### Agent 3: `verify-review` (runs AFTER agents 1+2)

**Goal**: Verify everything works, fix any breakage

1. Run `pnpm typecheck`
2. Run `pnpm test`
3. Run `pnpm build`
4. Fix any issues found
5. Report results

## Acceptance Criteria

- [ ] App opens to LandingPage (soviet propaganda poster aesthetic)
- [ ] "NEW GAME" → NewGameFlow (3-step bureaucratic form)
- [ ] "BEGIN" → AssignmentLetter (era briefing with config summary)
- [ ] "Accept Assignment" → game starts with selected config (seed, map size, difficulty, era)
- [ ] IntroModal is no longer used anywhere
- [ ] Camera cannot pan beyond grid bounds (with reasonable padding)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` — all 1607 tests pass
- [ ] `pnpm build` succeeds
