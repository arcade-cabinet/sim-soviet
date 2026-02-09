# ECS Architecture -- Design Document

> Sources: `src/ecs/world.ts`, `src/ecs/archetypes.ts`, `src/ecs/systems/*.ts`
>
> SimSoviet 2000 uses a Miniplex 2.0 Entity Component System as the
> backbone of all gameplay simulation. Every building, citizen, tile, and
> resource stockpile is an entity. Systems are pure functions that operate
> on the world each tick. The People do not need to understand the
> architecture. The architecture understands the People.

---

## Architecture Overview

| Layer | File(s) | Responsibility |
|-------|---------|---------------|
| Entity Definition | `world.ts` | Unified `Entity` interface, component type declarations, singleton world instance, React bindings |
| Archetype Queries | `archetypes.ts` | Pre-built reactive queries for common entity shapes; predicate-based subqueries |
| Systems | `systems/*.ts` | Pure functions that read/write entities each simulation tick |
| React Bridge | `world.ts` (ECS export) | `miniplex-react` bindings for declarative rendering |

**Miniplex 2.0 model:** A single `Entity` interface where every component is
an optional property. Queries narrow the type via `world.with(...)`. Tag
components use `true` literal types for zero-cost boolean filtering.

---

## Component Types

7 data components and 4 tag components define the full entity vocabulary.

### Data Components

#### Position

Maps an entity to a cell in the 30x30 isometric grid.

```typescript
interface Position {
  gridX: number;   // column index (0-based)
  gridY: number;   // row index (0-based)
}
```

Used by: buildings, citizens, tiles.

#### BuildingComponent

Stores building type, power state, production configuration, housing
capacity, and environmental output.

```typescript
interface BuildingComponent {
  type: string;            // key into BUILDING_TYPES config
  powered: boolean;        // currently receiving power
  powerReq: number;        // power units consumed
  powerOutput: number;     // power units generated (power plants only)
  produces?: {             // resource production per tick
    resource: 'food' | 'vodka';
    amount: number;
  };
  housingCap: number;      // max citizens housed (0 for non-housing)
  pollution: number;       // pollution output per tick
  fear: number;            // fear output (e.g. gulags)
}
```

#### CitizenComponent

Individual NPC data: social class, mood, and optional assignments.

```typescript
interface CitizenComponent {
  class: 'worker' | 'party_official' | 'engineer' | 'farmer' | 'soldier' | 'prisoner';
  happiness: number;       // 0 = miserable, 100 = suspiciously content
  hunger: number;          // 0 = fed, 100 = starving
  assignment?: string;     // building type assigned to work at
  home?: { gridX: number; gridY: number };  // housing assignment
}
```

#### Renderable

3D rendering metadata for BabylonJS scene lookup.

```typescript
interface Renderable {
  meshId: string;          // unique mesh identifier
  modelPath?: string;      // path to GLB model file
  scale: number;           // uniform scale factor
  visible: boolean;        // whether to render
}
```

#### Resources

Global economic stockpile, held by a singleton entity.

```typescript
interface Resources {
  money: number;           // rubles
  food: number;            // food units
  vodka: number;           // vodka units
  power: number;           // total power capacity
  powerUsed: number;       // power currently consumed
  population: number;      // total citizen count (cached)
}
```

#### TileComponent

Terrain data for each grid cell.

```typescript
interface TileComponent {
  terrain: 'grass' | 'road' | 'foundation' | 'water';
  elevation: number;       // visual rendering offset
}
```

#### Durability

Structural health for buildings that can decay over time.

```typescript
interface Durability {
  current: number;         // 0 = collapsed, 100 = pristine
  decayRate: number;       // points lost per simulation tick
}
```

### Tag Components

Tags are boolean markers with type `true`. They enable fast filtering
without carrying data.

| Tag | Purpose |
|-----|---------|
| `isBuilding` | Marks entity as a building |
| `isCitizen` | Marks entity as a citizen |
| `isTile` | Marks entity as a grid tile |
| `isResourceStore` | Marks the singleton resource entity |

---

## Unified Entity Interface

All components are optional properties on a single interface. Miniplex
queries narrow the type to only entities possessing the required components.

```typescript
interface Entity {
  // Data components
  position?: Position;
  building?: BuildingComponent;
  citizen?: CitizenComponent;
  renderable?: Renderable;
  resources?: Resources;
  tile?: TileComponent;
  durability?: Durability;

  // Tag components
  isBuilding?: true;
  isCitizen?: true;
  isTile?: true;
  isResourceStore?: true;
}
```

### Entity Archetypes (Common Shapes)

| Archetype | Components Present | Count in Typical Game |
|-----------|-------------------|----------------------:|
| Building | position, building, renderable, isBuilding, durability? | 10--50 |
| Citizen | position, citizen, isCitizen | 20--300 |
| Tile | position, tile, isTile | 900 (30x30 grid) |
| Resource Store | resources, isResourceStore | 1 (singleton) |

---

## World Instance & React API

### Singleton World

```typescript
export const world = new World<Entity>();
```

All game entities are managed through this single Miniplex world instance.
Systems, archetypes, and React components all reference the same world.

### React Bindings

```typescript
export const ECS = createReactAPI(world);
```

The `ECS` object provides 4 React primitives from `miniplex-react`:

| Primitive | Purpose |
|-----------|---------|
| `ECS.Entity` | Renders children with an entity in React context |
| `ECS.Entities` | Iterates a query bucket, rendering children per entity |
| `ECS.Component` | Declaratively adds/removes a component on mount/unmount |
| `ECS.useCurrentEntity` | Hook to read the entity from the nearest Entity context |

---

## Archetype Queries

Pre-built queries in `archetypes.ts` provide reactive, cached entity
buckets. Each query automatically re-indexes when entities gain or lose
the required components.

### Building Archetypes

| Query | Components Required | Filter | Use Case |
|-------|--------------------|----|---------|
| `buildings` | position, building, renderable | -- | Rendering pipeline |
| `buildingsLogic` | position, building | -- | Logic-only systems (no render dependency) |
| `poweredBuildings` | position, building | `building.powered === true` | Powered building iteration |
| `unpoweredBuildings` | position, building | `building.powered === false` | Power-shortage UI indicators |
| `producers` | position, building | `building.produces != null` | Production system |
| `housing` | position, building | `building.housingCap > 0` | Population growth checks |
| `decayableBuildings` | building, durability | -- | Decay system |

### Citizen Archetypes

| Query | Components Required | Filter | Use Case |
|-------|--------------------|----|---------|
| `citizens` | position, citizen | -- | General citizen iteration |
| `assignedCitizens` | position, citizen | `citizen.assignment != null` | Workplace tracking |
| `housedCitizens` | position, citizen | `citizen.home != null` | Housing utilization |

### Tile Archetypes

| Query | Components Required | Use Case |
|-------|-------|---------|
| `tiles` | position, tile | Grid rendering, terrain checks |

### Singleton Archetypes

| Query | Components Required | Use Case |
|-------|-------|---------|
| `resourceStore` | resources, isResourceStore | Global economy access |

### Helper Functions

```typescript
function getResourceEntity(): With<Entity, 'resources' | 'isResourceStore'> | undefined
```

Safe accessor for the singleton resource entity. Returns `undefined` if
the resource store has not been created yet. All systems use this instead
of raw `resourceStore.entities[0]` for proper TypeScript narrowing.

### Predicate Query Reindexing

Predicate-based queries (`poweredBuildings`, `unpoweredBuildings`,
`producers`, `housing`, `assignedCitizens`, `housedCitizens`) use `.where()`
filters. After mutating a filtered field (e.g., `building.powered`), you
**must** call `world.reindex(entity)` for the entity to move between
predicate buckets.

```typescript
entity.building.powered = true;
world.reindex(entity);  // required for poweredBuildings/unpoweredBuildings to update
```

---

## System Pipeline

6 ECS systems run sequentially each simulation tick. All are exported
from `systems/index.ts` as a barrel module. Each system is a pure
function with no internal state (except optional event callbacks).

### Execution Order

```
SimulationEngine.tick()
  |
  1. powerSystem()         -- distribute power to buildings
  2. productionSystem()    -- generate food and vodka
  3. consumptionSystem()   -- consume food and vodka, starvation check
  4. populationSystem()    -- population growth from housing + food
  5. decaySystem()         -- reduce building durability, collapse check
  6. quotaSystem(quota)    -- update 5-year plan progress
```

The order matters: power must be distributed before production runs (only
powered buildings produce), and production must run before consumption
(so newly produced resources are available).

### System Details

#### 1. powerSystem

**File:** `systems/powerSystem.ts`

Calculates power distribution across all buildings using a first-come,
first-served allocation model.

**Algorithm:**
1. **Phase 1:** Sum total power output from all power-generating buildings.
2. **Phase 2:** Iterate all buildings. For each that requires power, check if
   budget remains. Mark as powered or unpowered. Call `world.reindex()` if
   the powered state changed.
3. **Phase 3:** Update `resources.power` (total capacity) and
   `resources.powerUsed` (consumed).

**Side effects:** Mutates `building.powered` on every building entity. Updates
resource store power fields. Triggers reindexing for predicate queries.

#### 2. productionSystem

**File:** `systems/productionSystem.ts`

Iterates all producer buildings. Powered producers add their output to the
global resource stockpile.

**Algorithm:**
- For each entity in the `producers` archetype query:
  - Skip if not powered.
  - Add `produces.amount` to the corresponding resource (`food` or `vodka`).

**Side effects:** Mutates `resources.food` and `resources.vodka`.

#### 3. consumptionSystem

**File:** `systems/consumptionSystem.ts`

Handles citizen consumption of food and vodka.

**Consumption rates:**

| Resource | Rate | Shortfall Penalty |
|----------|------|-------------------|
| Food | 1 unit per 10 citizens (rounded up) | 5 citizens die (starvation) |
| Vodka | 1 unit per 20 citizens (rounded up) | No penalty (citizens merely suffer in silence) |

**Callbacks:** Exposes `setStarvationCallback(cb)` to bridge starvation
events from the ECS layer to the UI/game store.

**Side effects:** Mutates `resources.food`, `resources.vodka`, and
`resources.population`.

#### 4. populationSystem

**File:** `systems/populationSystem.ts`

Manages stochastic population growth based on housing capacity and food
availability.

**Growth conditions:**
- Population is below total powered housing capacity.
- Food stockpile is above 10 units.

**Growth rate:** 0--2 new citizens per eligible tick (`Math.floor(Math.random() * 3)`).

**Side effects:** Mutates `resources.population`.

#### 5. decaySystem

**File:** `systems/decaySystem.ts`

Reduces building durability over time. Collapsed buildings are removed from
the world entirely.

**Algorithm:**
1. For each entity in `decayableBuildings`, subtract `decayRate` from
   `durability.current`.
2. Collect entities where `current <= 0`.
3. Remove collapsed entities from the world via `world.remove()`.
4. Fire `BuildingCollapsedCallback` with grid position and building type.

**Callbacks:** Exposes `setBuildingCollapsedCallback(cb)` for UI notifications.

**Side effects:** Mutates `durability.current`. Removes entities from the
world (destructive).

#### 6. quotaSystem

**File:** `systems/quotaSystem.ts`

Tracks 5-year plan progress by reading the current food or vodka stockpile
and updating the quota's `current` value.

**Interface:**

```typescript
interface QuotaState {
  type: 'food' | 'vodka';    // resource being tracked
  target: number;             // goal amount
  current: number;            // progress (updated each tick)
  deadlineYear: number;       // year the quota must be met
}
```

**Default quota:** Food target of 500, deadline year 1985.

**Note:** Quota deadline checking and advancement is handled by
`SimulationEngine`, not by the quota system itself. The system only
reads the current resource value.

---

## System Exports

All systems and their types are re-exported from `systems/index.ts`:

```typescript
export { powerSystem } from './powerSystem';
export { productionSystem } from './productionSystem';
export { consumptionSystem, setStarvationCallback } from './consumptionSystem';
export type { StarvationCallback } from './consumptionSystem';
export { populationSystem } from './populationSystem';
export { decaySystem, setBuildingCollapsedCallback } from './decaySystem';
export type { BuildingCollapsedCallback } from './decaySystem';
export { quotaSystem, createDefaultQuota } from './quotaSystem';
export type { QuotaState } from './quotaSystem';
```

---

## ECS and GameState Relationship

The ECS world and the `GameState` object serve complementary roles:

| Concern | ECS World | GameState |
|---------|-----------|-----------|
| Buildings | Entity with position + building + renderable | `buildings[]` array (legacy reference) |
| Resources | Singleton entity with `resources` component | `money`, `food`, `vodka`, `power`, `pop` fields |
| Citizens | Entity with position + citizen | `pop` count |
| Grid | 900 tile entities | Grid state for placement validation |
| Date / Time | Not in ECS | `date.year`, `date.month`, `date.tick` |
| Political State | Not in ECS | Managed by `PolitburoSystem` |
| Quotas | Not in ECS | `QuotaState` passed to `quotaSystem()` |
| Events | Not in ECS | Managed by `EventSystem` |

The `SimulationEngine` orchestrates both worlds: it ticks the ECS systems
in order, then ticks `PolitburoSystem` and `EventSystem`, and finally
synchronizes any shared state (resource counts, population).

---

## Data Flow Diagram

```
         Game Loop
            |
   SimulationEngine.tick()
            |
   +--------+--------+
   |                  |
   v                  v
ECS Systems       Political Systems
(pure functions)  (PolitburoSystem, EventSystem, PravdaSystem)
   |                  |
   v                  v
world (entities)   GameState (global state)
   |                  |
   +--------+---------+
            |
            v
    React Components
    (ECS.Entities, stores)
```

---

## Adding a New System

To add a new ECS system:

1. Create `src/ecs/systems/mySystem.ts` with a pure function signature:
   ```typescript
   export function mySystem(): void {
     const store = getResourceEntity();
     if (!store) return;
     // ... operate on archetypes
   }
   ```

2. If the system needs a new archetype query, add it to `archetypes.ts`:
   ```typescript
   export const myQuery = world.with('position', 'building').where(
     (entity) => /* predicate */
   );
   ```

3. Export from `systems/index.ts`.

4. Add the call to `SimulationEngine.tick()` in the correct position
   relative to existing systems.

5. If the system needs to communicate events to the UI layer, use the
   callback pattern established by `consumptionSystem` and `decaySystem`.

---

## Adding a New Component

To add a new component type:

1. Define the interface in `world.ts`:
   ```typescript
   export interface MyComponent {
     field: string;
   }
   ```

2. Add it as an optional property on the `Entity` interface:
   ```typescript
   export interface Entity {
     // ... existing components
     myComponent?: MyComponent;
   }
   ```

3. Add archetype queries in `archetypes.ts` if needed.

4. Miniplex automatically tracks the new component. No registration step
   is required.

> *"The system is perfect. If you do not understand the system, that is
> your failing, not the system's."*
