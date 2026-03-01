# System Patterns

## ECS Architecture (Miniplex 2.0)

### World Structure
```typescript
// src/ecs/world.ts — single world instance
const world = new World<Entity>();
```

### Archetype Pattern
Components are plain objects composed into entity types:
```typescript
// src/ecs/archetypes.ts
type BuildingEntity = { position: Vec2; buildingType: string; level: number; ... };
type WorkerEntity = { workerId: string; role: WorkerRole; morale: number; ... };
```

### System Pattern
Systems query the world and operate on matching entities:
```typescript
// src/ecs/systems/*.ts
export function productionSystem(world: World, dt: number) {
  for (const entity of world.with("buildingType", "production")) {
    // update entity
  }
}
```

### Factory Pattern
Entity creation through factory functions:
```typescript
// src/ecs/factories/*.ts
export function createBuilding(type: string, pos: Vec2): BuildingEntity { ... }
```

## SimulationEngine Tick Orchestration

`SimulationEngine.tick()` runs all systems in a fixed order each game tick:
1. Resource production
2. Resource consumption
3. Construction progress
4. Power distribution
5. Population updates
6. Demographics (births, deaths, aging)
7. Weather progression
8. Political events
9. Achievement checking

## Bridge Pattern (ECS ↔ React)

`GameInit.ts` creates the ECS world and wires callbacks:
```typescript
initGame(options: GameInitOptions) → {
  world, engine, getPersonnelFile, getAchievements, ...
}
```

Callbacks bridge ECS events to React state in App.web.tsx:
- `onToast(msg)` → toast state
- `onEra(era)` → era modal
- `onMinigame(def)` → minigame modal
- `onGameOver(reason)` → game over modal

## UI Overlay Pattern

React Native components sit on top of the 3D canvas:
```tsx
<View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
  <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    <TopBar />
    <QuotaHUD />
    {/* ... */}
  </View>
</View>
```

`pointerEvents="box-none"` passes through touches to the 3D canvas beneath.

## Model Loading Pattern

1. `ModelPreloader.tsx` calls `useGLTF.preload()` for all 55 GLBs
2. `BuildingRenderer.tsx` uses `useGLTF()` to get loaded models
3. Models are cloned per-building instance via `scene.clone()`
4. `ModelMapping.ts` maps building types → GLB model names

## Toast/Advisor Side-Channel

`src/engine/helpers.ts` uses module-level functions (not on GameState):
```typescript
let toastCallback: ((msg: string) => void) | null = null;
export function setToastCallback(cb: typeof toastCallback) { toastCallback = cb; }
export function showToast(msg: string) { toastCallback?.(msg); }
```

## Demographics (Dvor System)

- **Dvory** are the canonical population source
- Citizens derive from dvor members, not a hardcoded count
- `memberRoleForAge(age, gender)` determines role (child/worker/elder)
- Gender-differentiated retirement: 55F/60M
- Male-first conscription via `removeWorkersByCountMaleFirst()`, age 18-51
- Era birth rates modulated by `ERA_BIRTH_RATE_MULTIPLIER`

## Consequence Mode System

Three consequence modes determine what happens at 7+ black marks:

| Mode | Effect | Score Multiplier |
|------|--------|-----------------|
| Forgiving | Return after 1 year, 90% buildings survive | x0.8 |
| Permadeath | Game over. Restart era. | x1.5 |
| Harsh | Return after 3 years, 40% buildings, 25% workers | x1.0 |

Rehabilitation flow (non-permadeath modes):
1. `SimulationEngine.handleRehabilitation()` triggers on arrest
2. `ChronologySystem.advanceYears()` skips forward
3. Workers/buildings removed proportionally
4. `PersonnelFile.resetAfterRehabilitation()` clears marks
5. `onRehabilitation` callback fires to show modal in App.web.tsx

## Interactive Minigame Framework

Minigames are triggered by game events via `MinigameRouter`:
1. `SimulationEngine` detects trigger condition
2. `MinigameRouter.route(trigger)` selects appropriate minigame definition
3. `onMinigame(def)` callback fires to App.web.tsx
4. Simulation auto-pauses while minigame is active
5. Player makes choices; results apply via `MinigameRouter.resolve()`

9 minigame definitions in `src/game/minigames/definitions/`:
- Text-choice format with success probabilities and risk tiers
- Each choice shows consequence preview

## Dynamic Grid Size

Grid size is configurable per-game via `GameGrid` constructor:
```typescript
// src/game/GameGrid.ts
constructor(size: number = GRID_SIZE) // GRID_SIZE = 30 (default)
```

`GameInitOptions.gridSize` passes through to `GameGrid`, `TerrainGenerator`, and scene components. Affects terrain mesh size, building placement bounds, and pathfinding grid.
