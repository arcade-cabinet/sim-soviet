# SimSoviet1917 — Reactylon Native 3D Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the 2D Canvas SimSoviet game with a full 3D BabylonJS city-builder via Reactylon Native, fully translating the POC (poc.html) into a polished, playable native app called SimSoviet1917.

**Architecture:** Reactylon Native (React Native 0.74 + BabylonJS 8 via `@babylonjs/react-native`) with `NativeEngine` for native GL, declarative JSX scene graph, and React Native overlay UI. Game engine is a direct TypeScript port of poc.html's simulation logic. 55 existing Soviet GLB models loaded via `ImportMeshAsync` and cloned per grid cell.

**Tech Stack:** React Native 0.74, Reactylon 3.5, BabylonJS 8, TypeScript 5, babel-plugin-reactylon

---

## Task 0: Archive Old Codebase & Scaffold Reactylon Native App

**Files:**
- Move: `src/`, `app/`, `e2e/`, `scripts/`, `agentic-memory-bank/`, `design/`, `vitest.config.ts`, `vite.config.ts`, `biome.json`, `pnpm-lock.yaml` → `archive/`
- Keep: `public/models/soviet/` (GLB assets), `docs/`, `CLAUDE.md`, `.github/`, `.git/`
- Create: Fresh Reactylon Native scaffold in root

**Step 1: Create archive directory and move old files**

```bash
mkdir -p archive
# Move all old source directories
mv src app e2e scripts agentic-memory-bank design archive/
# Move old config files
mv vitest.config.ts vite.config.ts biome.json tsconfig.json archive/ 2>/dev/null
mv pnpm-lock.yaml package.json pyproject.toml archive/ 2>/dev/null
mv capacitor.config.ts sonar-project.properties archive/ 2>/dev/null
# Keep: public/models/soviet/, docs/, CLAUDE.md, .github/, .git/, poc.html
```

**Step 2: Scaffold Reactylon Native app in /tmp and copy into root**

```bash
cd /tmp && npx create-reactylon-app SimSoviet1917 --native
# Copy scaffolded files into project root
cp /tmp/SimSoviet1917/package.json /path/to/sim-soviet/
cp /tmp/SimSoviet1917/tsconfig.json /path/to/sim-soviet/
cp /tmp/SimSoviet1917/babel.config.js /path/to/sim-soviet/
cp /tmp/SimSoviet1917/metro.config.js /path/to/sim-soviet/
cp /tmp/SimSoviet1917/app.json /path/to/sim-soviet/
cp /tmp/SimSoviet1917/index.js /path/to/sim-soviet/
cp /tmp/SimSoviet1917/.eslintrc.js /path/to/sim-soviet/
cp /tmp/SimSoviet1917/.prettierrc.js /path/to/sim-soviet/
cp /tmp/SimSoviet1917/.watchmanconfig /path/to/sim-soviet/
cp /tmp/SimSoviet1917/Gemfile /path/to/sim-soviet/
cp /tmp/SimSoviet1917/jest.config.js /path/to/sim-soviet/
cp -r /tmp/SimSoviet1917/src /path/to/sim-soviet/
cp -r /tmp/SimSoviet1917/android /path/to/sim-soviet/
cp -r /tmp/SimSoviet1917/ios /path/to/sim-soviet/
cp -r /tmp/SimSoviet1917/__tests__ /path/to/sim-soviet/
cp -r /tmp/SimSoviet1917/.bundle /path/to/sim-soviet/
```

**Step 3: Copy GLB models into the assets directory accessible by the native app**

React Native doesn't serve from `public/` — assets must be bundled or served. For development, we'll reference models from a local asset server or bundle them.

```bash
# Keep models accessible
mkdir -p assets/models/soviet
cp public/models/soviet/*.glb assets/models/soviet/
cp public/models/soviet/manifest.json assets/models/soviet/
```

**Step 4: Install dependencies**

```bash
npm install
```

**Step 5: Verify scaffold runs**

```bash
# For iOS:
cd ios && pod install && cd ..
npm run ios
# OR for Android:
npm run android
```

Expected: Default Reactylon scene with spinning box renders on device/simulator.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: archive 2D codebase, scaffold Reactylon Native app (SimSoviet1917)"
```

---

## Task 1: Game Engine — Core State & Building Types

**Files:**
- Create: `src/engine/GameState.ts`
- Create: `src/engine/BuildingTypes.ts`
- Create: `src/engine/GridTypes.ts`

**Step 1: Create GridTypes.ts — cell and coordinate types**

```typescript
// src/engine/GridTypes.ts
export const GRID_SIZE = 30;
export const TICKS_PER_MONTH = 15;

export type TerrainType = 'grass' | 'water' | 'rail' | 'tree' | 'irradiated' | 'crater';

export interface GridCell {
  type: string | null;    // building type or null
  zone: string | null;    // 'res' | 'ind' | 'farm' | null
  z: number;              // elevation (0, 1, 2)
  terrain: TerrainType;
  isRail: boolean;
  bridge: boolean;
  smog: number;
  onFire: number;         // 0 = none, >0 = fire ticks
  hasPipe: boolean;
  watered: boolean;
}

export interface GridPoint {
  x: number;
  y: number;
}
```

**Step 2: Create BuildingTypes.ts — all POC building + grown type definitions**

Port the exact BUILDING_TYPES and GROWN_TYPES objects from poc.html lines 315-356:

```typescript
// src/engine/BuildingTypes.ts
export interface BuildingTypeInfo {
  name: string;
  category: string;
  cost: number;
  icon: string;
  color: string;
  type: string;
  desc?: string;
  power?: number;
  pollution?: number;
  water?: number;
  powerReq?: number;
  cap?: number;
  hidden?: boolean;
}

export interface GrownLevel {
  name: string;
  cap?: number;
  prod?: string;
  amt?: number;
  powerReq: number;
  waterReq: number;
  pollution?: number;
  color: string;
  h: number;
}

export const BUILDING_TYPES: Record<string, BuildingTypeInfo> = {
  none: { name: 'Inspect', category: 'all', cost: 0, icon: '🔍', color: '#000', type: 'tool' },
  'zone-res': { name: 'Res. Zone', category: 'zone', cost: 10, icon: '🟩', type: 'zone', desc: 'Grows Housing. Needs Water/Power.', color: '#4caf50' },
  'zone-ind': { name: 'Ind. Zone', category: 'zone', cost: 15, icon: '🟨', type: 'zone', desc: 'Grows Factories. Needs Water/Power.', color: '#ffeb3b' },
  'zone-farm': { name: 'Agri. Zone', category: 'zone', cost: 5, icon: '🟫', type: 'zone', desc: 'Grows Farms. Needs Water.', color: '#795548' },
  road: { name: 'Road', category: 'infra', cost: 10, icon: '🛣️', type: 'infra', desc: 'Transportation.', color: '#778899' },
  pipe: { name: 'Water Pipe', category: 'infra', cost: 5, icon: '🟦', type: 'infra', desc: 'Distributes Water (Underground).', color: '#00b0ff' },
  pump: { name: 'Water Pump', category: 'infra', cost: 100, icon: '🚰', type: 'utility', water: 50, desc: 'Must be built on river.', color: '#00b0ff' },
  power: { name: 'Coal Plant', category: 'infra', cost: 300, icon: '⚡', type: 'utility', power: 100, pollution: 35, desc: 'Heavy Smog.', color: '#3e2723' },
  station: { name: 'Station', category: 'infra', cost: 300, icon: '🚉', type: 'infra', powerReq: 10, desc: 'Collects Train Drops.', color: '#5d4037' },
  nuke: { name: 'Reactor', category: 'infra', cost: 1000, icon: '☢️', type: 'utility', power: 500, pollution: 0, desc: 'DO NOT LET BURN.', color: '#455a64' },
  tap: { name: 'Cosmic Tap', category: 'infra', cost: 500, icon: '☄️', type: 'utility', power: 1000, pollution: 0, desc: 'Requires Crater.', color: '#4a148c', hidden: true },
  tower: { name: 'Propaganda', category: 'state', cost: 400, icon: '📡', type: 'gov', powerReq: 20, desc: '2x Prod in 5 tiles.', color: '#333' },
  gulag: { name: 'Gulag', category: 'state', cost: 500, icon: '⛓️', type: 'gov', cap: -20, powerReq: 10, desc: 'Stops riots (7 tiles).', color: '#111' },
  mast: { name: 'Aero-Mast', category: 'state', cost: 800, icon: '🎈', type: 'gov', powerReq: 50, desc: 'Fire-Fighting Zeppelin.', color: '#222' },
  space: { name: 'Cosmodrome', category: 'state', cost: 2000, icon: '🚀', type: 'gov', powerReq: 200, desc: 'Win Space Race.', color: '#444' },
  bulldoze: { name: 'Purge', category: 'purge', cost: 20, icon: '💣', type: 'tool', desc: 'Demolish structures.', color: '#d32f2f' },
};

export const GROWN_TYPES: Record<string, GrownLevel[]> = {
  housing: [
    { name: 'Worker Shacks', cap: 15, powerReq: 0, waterReq: 2, color: '#5d4037', h: 15 },
    { name: 'Tenement Block', cap: 50, powerReq: 5, waterReq: 5, color: '#607d8b', h: 40 },
    { name: 'Khrushchyovka', cap: 150, powerReq: 15, waterReq: 10, color: '#37474f', h: 80 },
  ],
  factory: [
    { name: 'Light Workshop', prod: 'money', amt: 10, powerReq: 2, waterReq: 2, pollution: 10, color: '#795548', h: 20 },
    { name: 'Steel Mill', prod: 'money', amt: 30, powerReq: 10, waterReq: 10, pollution: 25, color: '#4e342e', h: 45 },
    { name: 'Heavy Combine', prod: 'money', amt: 100, powerReq: 30, waterReq: 25, pollution: 60, color: '#212121', h: 75 },
  ],
  distillery: [
    { name: 'Local Still', prod: 'vodka', amt: 5, powerReq: 2, waterReq: 5, pollution: 5, color: '#3f51b5', h: 15 },
    { name: 'Vodka Plant', prod: 'vodka', amt: 20, powerReq: 10, waterReq: 15, pollution: 20, color: '#1a237e', h: 35 },
    { name: 'State Brewery', prod: 'vodka', amt: 60, powerReq: 25, waterReq: 30, pollution: 40, color: '#000051', h: 55 },
  ],
  farm: [
    { name: 'Kolkhoz Plot', prod: 'food', amt: 15, powerReq: 0, waterReq: 5, color: '#33691e', h: 5 },
    { name: 'Mechanized Sovkhoz', prod: 'food', amt: 50, powerReq: 5, waterReq: 15, color: '#1b5e20', h: 10 },
    { name: 'Agri-Dome', prod: 'food', amt: 150, powerReq: 20, waterReq: 40, color: '#004d40', h: 30 },
  ],
};
```

**Step 3: Create GameState.ts — central mutable state**

Port the `Game` object from poc.html lines 392-404, plus all supporting state:

```typescript
// src/engine/GameState.ts
import { GRID_SIZE, GridCell, GridPoint, TerrainType } from './GridTypes';

export interface BuildingInstance {
  x: number;
  y: number;
  type: string;
  powered: boolean;
  level: number;
  progress?: number;
  launched?: boolean;
}

export interface Vehicle {
  x: number; y: number;
  tx: number; ty: number;
  lx: number; ly: number;
  state: 'idle' | 'moving';
  color: string;
}

export interface Zeppelin {
  x: number; y: number;
  tx: number; ty: number;
  lx: number; ly: number;
}

export interface FloatingTextItem {
  x: number; y: number;
  text: string; color: string;
  life: number; maxLife: number;
}

export interface Train {
  active: boolean;
  x: number; y: number;
  timer: number;
}

export interface Meteor {
  active: boolean;
  struck: boolean;
  x: number; y: number;
  z: number;
  tx: number; ty: number;
}

export interface Quota {
  type: string;
  target: number;
  current: number;
  deadlineYear: number;
}

export interface GameDate {
  year: number;
  month: number;
  tick: number;
}

export interface Directive {
  text: string;
  target: number;
  reward: number;
  check: (state: GameState) => boolean;
}

export type LensMode = 'default' | 'water' | 'power' | 'smog' | 'aura';
export type TabMode = 'zone' | 'infra' | 'state' | 'purge';

export class GameState {
  // Simulation
  speed = 1;
  lastTime = 0;
  simAccumulator = 0;
  animTime = 0;
  tickDuration = 1000;

  // Resources
  money = 2000;
  lastIncome = 0;
  pop = 0;
  food = 200;
  vodka = 50;
  powerGen = 0;
  powerUsed = 0;
  waterGen = 0;
  waterUsed = 0;

  // Time
  date: GameDate = { year: 1980, month: 1, tick: 0 };
  timeOfDay = 0.2;
  currentWeather: string = 'snow';

  // Map
  grid: GridCell[][] = [];

  // Entities
  buildings: BuildingInstance[] = [];
  traffic: Vehicle[] = [];
  zeppelins: Zeppelin[] = [];
  floatingTexts: FloatingTextItem[] = [];
  train: Train = { active: false, x: -5, y: 12, timer: 0 };
  meteor: Meteor = { active: false, struck: false, x: 0, y: 0, z: 1500, tx: 0, ty: 0 };
  meteorShake = 0;
  activeLaunch: { x: number; y: number; alt: number; vel: number } | null = null;
  activeLightning: { x: number; y: number; life: number } | null = null;

  // UI State
  directiveIndex = 0;
  activeTab: TabMode = 'zone';
  selectedTool = 'none';
  activeLens: LensMode = 'default';

  // Quota
  quota: Quota = { type: 'food', target: 500, current: 0, deadlineYear: 1985 };

  // Listeners
  private listeners: Set<() => void> = new Set();

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify(): void {
    this.listeners.forEach(fn => fn());
  }

  // Grid initialization
  initGrid(): void {
    this.grid = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      const row: GridCell[] = [];
      const riverX = Math.floor(GRID_SIZE / 2 + Math.sin(y / 3) * 4);
      const isRailY = y === this.train.y;
      for (let x = 0; x < GRID_SIZE; x++) {
        const isWater = Math.abs(x - riverX) <= 1;
        const isTree = !isWater && !isRailY && Math.random() < 0.2;
        let elev = 0;
        if (!isWater && !isRailY) {
          const noise = Math.sin(x / 3) * Math.cos(y / 3);
          if (noise > 0.4) elev = 1;
          if (noise > 0.8) elev = 2;
        }
        const terrain: TerrainType = isWater ? 'water' : isRailY ? 'rail' : isTree ? 'tree' : 'grass';
        row.push({
          type: null, zone: null, z: elev,
          terrain, isRail: isRailY, bridge: isRailY && isWater,
          smog: 0, onFire: 0, hasPipe: false, watered: false,
        });
      }
      this.grid.push(row);
    }
  }
}

// Singleton
export const gameState = new GameState();
```

**Step 4: Commit**

```bash
git add src/engine/
git commit -m "feat: game engine core — GameState, BuildingTypes, GridTypes"
```

---

## Task 2: Game Engine — Simulation Tick (Full POC Port)

**Files:**
- Create: `src/engine/SimTick.ts`
- Create: `src/engine/WaterNetwork.ts`
- Create: `src/engine/WeatherSystem.ts`
- Create: `src/engine/TrainSystem.ts`
- Create: `src/engine/TrafficSystem.ts`
- Create: `src/engine/MeteorSystem.ts`
- Create: `src/engine/Directives.ts`
- Create: `src/engine/BuildActions.ts`

Port every function from poc.html into cleanly separated modules. The sim tick (poc.html lines 618-868) is the heart — zone growth, power/water distribution, smog diffusion, fire/riot spread, production, consumption, population, quotas. Each module is a direct translation of the POC logic, not a rewrite.

Key functions to port per module:
- **WaterNetwork.ts**: `updateWaterNetwork()` (lines 581-615) — BFS from pumps through pipes
- **WeatherSystem.ts**: `getSeason()`, `getSeasonColor()`, `updateWeatherSystem()` (lines 408-423)
- **TrainSystem.ts**: `updateTrain()` (lines 926-946)
- **TrafficSystem.ts**: `updateTraffic()` (lines 871-903)
- **MeteorSystem.ts**: meteor logic from mainLoop (lines 548-572)
- **Directives.ts**: DIRECTIVES array + check logic (lines 377-390)
- **BuildActions.ts**: `handleClick()` (lines 1413-1480) — building placement, bulldoze, validation
- **SimTick.ts**: `simTick()` orchestrator (lines 618-868) — monthly production, growth, fire, smog, riots, quotas

Each file is a direct TypeScript translation of the corresponding POC section. No refactoring, no "improvements" — faithful port.

**Step 5: Commit**

```bash
git add src/engine/
git commit -m "feat: full simulation tick — direct POC port of all game systems"
```

---

## Task 3: Model Cache — GLB Preloading & Cloning

**Files:**
- Create: `src/scene/ModelCache.ts`
- Create: `src/scene/ModelMapping.ts`

**ModelMapping.ts** maps POC building types to GLB model files:

```typescript
// src/scene/ModelMapping.ts

// Maps POC building type + level → GLB model name from manifest
export const MODEL_MAP: Record<string, string | string[]> = {
  // Grown types — array indexed by level
  'housing': ['workers-house-a', 'apartment-tower-a', 'apartment-tower-c'],
  'factory': ['warehouse', 'factory-office', 'bread-factory'],
  'distillery': ['vodka-distillery', 'vodka-distillery', 'vodka-distillery'],
  'farm': ['collective-farm-hq', 'collective-farm-hq', 'collective-farm-hq'],

  // Placed types — single model
  'power': 'power-station',
  'nuke': 'power-station',         // recolored
  'gulag': 'gulag-admin',
  'tower': 'radio-station',
  'pump': 'concrete-block',
  'station': 'train-station',
  'mast': 'guard-post',
  'space': 'government-hq',
  'road': null,                     // procedural flat mesh
  'pipe': null,                     // invisible (underground)
};

export function getModelName(type: string, level: number = 0): string | null {
  const entry = MODEL_MAP[type];
  if (!entry) return null;
  if (Array.isArray(entry)) return entry[Math.min(level, entry.length - 1)];
  return entry;
}
```

**ModelCache.ts** preloads all unique GLBs and provides cloning:

```typescript
// src/scene/ModelCache.ts
import { Scene, Mesh, AbstractMesh, ImportMeshAsync } from '@babylonjs/core';

const cache = new Map<string, AbstractMesh>();

export async function preloadModels(scene: Scene, modelBaseUrl: string): Promise<void> {
  // Load manifest
  const resp = await fetch(`${modelBaseUrl}/manifest.json`);
  const manifest = await resp.json();

  const uniqueModels = new Set<string>();
  for (const [key, asset] of Object.entries(manifest.assets as Record<string, any>)) {
    if (asset.role !== 'modular') {
      uniqueModels.add(key);
    }
  }

  // Preload each unique model
  for (const modelName of uniqueModels) {
    const asset = manifest.assets[modelName];
    if (!asset) continue;
    try {
      const result = await ImportMeshAsync(`${modelBaseUrl}/${asset.file}`, scene);
      const root = result.meshes[0];
      root.setEnabled(false); // hide template
      root.name = `template_${modelName}`;
      cache.set(modelName, root);
    } catch (e) {
      console.warn(`Failed to load model: ${modelName}`, e);
    }
  }
}

export function cloneModel(name: string, instanceName: string, scene: Scene): AbstractMesh | null {
  const template = cache.get(name);
  if (!template) return null;
  const clone = template.clone(instanceName, null);
  if (clone) {
    clone.setEnabled(true);
  }
  return clone;
}

export function disposeModel(mesh: AbstractMesh): void {
  mesh.dispose();
}
```

**Step 6: Commit**

```bash
git add src/scene/
git commit -m "feat: GLB model cache with preloading and cloning"
```

---

## Task 4: 3D Scene — Terrain Grid

**Files:**
- Create: `src/scene/TerrainGrid.tsx`

Render the 30x30 grid as a BabylonJS ground plane with per-tile materials for grass, water, rail, trees, elevation. Each tile is a small ground mesh positioned in 3D space.

Grid layout: tiles are flat squares on the XZ plane. No isometric projection needed — the camera angle provides the isometric look.

Tile size: 1 BabylonJS unit = 1 grid cell. Grid spans (0,0) to (30,0,30).

Water tiles animate via shader or material alpha. Trees are simple cylinder+sphere meshes. Elevation offsets Y position.

**Step 7: Commit**

```bash
git add src/scene/TerrainGrid.tsx
git commit -m "feat: 3D terrain grid — 30x30 with water, rail, trees, elevation"
```

---

## Task 5: 3D Scene — Camera Controller

**Files:**
- Create: `src/scene/CameraController.tsx`

UniversalCamera (not ArcRotate — we need free movement for street-level).

Controls:
- **Bird's-eye**: high altitude (~100 units), looking down at ~60 degrees
- **Street-level**: altitude ~2 units, looking horizontally between buildings
- **Zoom**: pinch/scroll interpolates smoothly between altitude levels
- **Pan**: touch drag / WASD moves camera position on XZ plane
- **Clamp**: camera stays within grid bounds + margin

**Step 8: Commit**

```bash
git add src/scene/CameraController.tsx
git commit -m "feat: camera controller — bird-eye to street-level zoom"
```

---

## Task 6: 3D Scene — Building Renderer

**Files:**
- Create: `src/scene/BuildingRenderer.tsx`

React component that observes `gameState.buildings[]` and for each building:
1. Looks up the GLB model name via `getModelName(type, level)`
2. Clones the model from `ModelCache`
3. Positions it at `(gridX, elevation * tileHeight, gridY)`
4. Scales appropriately
5. Applies tint for unpowered (dark gray), fire (red emissive), lens mode colors

When buildings change (placed, destroyed, upgraded), diff against previous frame and add/remove/swap meshes.

**Step 9: Commit**

```bash
git add src/scene/BuildingRenderer.tsx
git commit -m "feat: building renderer — GLB clones on grid with state-driven materials"
```

---

## Task 7: 3D Scene — Lighting & Day/Night Cycle

**Files:**
- Create: `src/scene/Lighting.tsx`

- **DirectionalLight** (sun): rotates around scene based on `timeOfDay`
- **HemisphericLight**: perpetual overcast ambient (gray-blue, low intensity)
- **Night**: reduce directional to near-zero, add fog, emissive windows on powered buildings
- **Storm**: darken ambient further, add fog density
- **Winter**: whiter ambient, snow ground material

Time of day drives: light direction, intensity, shadow angle, fog color/density.

**Step 10: Commit**

```bash
git add src/scene/Lighting.tsx
git commit -m "feat: lighting — day/night cycle with overcast atmosphere"
```

---

## Task 8: 3D Scene — Weather Particles

**Files:**
- Create: `src/scene/WeatherFX.tsx`

BabylonJS GPU ParticleSystem:
- **Snow** (winter): white particles, slow fall, drift
- **Rain** (spring/fall): blue-gray streaks, fast diagonal fall
- **Storm**: heavy rain + darker scene + occasional screen flash for lightning
- **Clear**: no particles

Particle emitter: large box above camera, particles fall through scene.

**Step 11: Commit**

```bash
git add src/scene/WeatherFX.tsx
git commit -m "feat: weather particles — snow, rain, storm effects"
```

---

## Task 9: 3D Scene — Smog, Fire, Auras, Lightning

**Files:**
- Create: `src/scene/SmogOverlay.tsx`
- Create: `src/scene/FireRenderer.tsx`
- Create: `src/scene/AuraRenderer.tsx`
- Create: `src/scene/LightningRenderer.tsx`

- **Smog**: semi-transparent green-tinted box/plane per polluted tile, alpha = smog/100
- **Fire**: orange particle system per burning building + flickering point light
- **Auras**: Propaganda tower = pulsing red rings (torus). Gulag = sweeping spotlight cone.
- **Lightning**: brief white line mesh from sky to ground + screen flash

**Step 12: Commit**

```bash
git add src/scene/SmogOverlay.tsx src/scene/FireRenderer.tsx src/scene/AuraRenderer.tsx src/scene/LightningRenderer.tsx
git commit -m "feat: smog, fire, aura, lightning visual effects"
```

---

## Task 10: 3D Scene — Train, Vehicles, Zeppelins, Meteor

**Files:**
- Create: `src/scene/TrainRenderer.tsx`
- Create: `src/scene/VehicleRenderer.tsx`
- Create: `src/scene/ZeppelinRenderer.tsx`
- Create: `src/scene/MeteorRenderer.tsx`

- **Train**: box meshes (locomotive + 4 cars) moving along rail Y row. Screen shake on pass.
- **Vehicles**: small box meshes on road tiles, pathfind between roads. Speed varies by season.
- **Zeppelins**: ellipsoid meshes floating above grid, patrol or target fires. Shadow on ground.
- **Meteor**: glowing sphere with trail particles descending from sky. Impact = explosion particles + crater.

**Step 13: Commit**

```bash
git add src/scene/TrainRenderer.tsx src/scene/VehicleRenderer.tsx src/scene/ZeppelinRenderer.tsx src/scene/MeteorRenderer.tsx
git commit -m "feat: train, vehicle, zeppelin, meteor renderers"
```

---

## Task 11: 3D Scene — Placement Preview & Lens System

**Files:**
- Create: `src/scene/GhostPreview.tsx`
- Create: `src/scene/LensSystem.tsx`
- Create: `src/scene/FloatingText.tsx`

- **Ghost**: translucent clone of selected building model at hovered grid cell. Green = valid, red = invalid. Tracks pointer/touch position via scene.pick().
- **Lens modes**: Material overrides on all buildings/terrain:
  - Water: dark overlay + blue highlight on watered tiles + cyan pipe lines
  - Power: green (powered) / red (unpowered) tint on all buildings
  - Smog: orange-green heatmap on terrain
  - Aura: show aura rings, dim everything else
- **FloatingText**: Billboard text meshes that float up and fade out (+200₽, BUILT, -DECAY-, etc.)

**Step 14: Commit**

```bash
git add src/scene/GhostPreview.tsx src/scene/LensSystem.tsx src/scene/FloatingText.tsx
git commit -m "feat: ghost preview, lens system, floating text"
```

---

## Task 12: 3D Scene — Minimap

**Files:**
- Create: `src/scene/MinimapCamera.tsx`

Secondary camera rendering to an offscreen render target, displayed as a React Native Image overlay. Top-down orthographic view of entire grid. Buildings as colored dots, fires as red, train as gold.

**Step 15: Commit**

```bash
git add src/scene/MinimapCamera.tsx
git commit -m "feat: minimap via secondary camera render target"
```

---

## Task 13: React Native UI — Top Bar

**Files:**
- Create: `src/ui/TopBar.tsx`
- Create: `src/ui/styles.ts` (shared retro panel styles)

Port the POC's top bar (lines 179-231): title, season/weather, water/power stats, funds, food, vodka, population, calendar with month progress bar, speed controls (pause/play/fast).

Retro aesthetic: beveled panels, monospace font (Share Tech Mono or system monospace), Soviet red/gold/green color scheme, dark backgrounds.

**Step 16: Commit**

```bash
git add src/ui/
git commit -m "feat: TopBar UI — resources, calendar, speed controls"
```

---

## Task 14: React Native UI — Toolbar (Categorized Build Tools)

**Files:**
- Create: `src/ui/Toolbar.tsx`
- Create: `src/ui/TabBar.tsx`

Port the POC's categorized toolbar (lines 292-301, 440-474):
- Tab bar: ZONING, INFRASTRUCTURE, STATE, PURGE
- Tool buttons: icon + name + cost, highlight active tool
- Always show Inspect button
- Retro beveled button style with active state inversion

**Step 17: Commit**

```bash
git add src/ui/Toolbar.tsx src/ui/TabBar.tsx
git commit -m "feat: categorized toolbar with build tools"
```

---

## Task 15: React Native UI — HUD Panels (Quota, Directive, Advisor, Toast, Ticker)

**Files:**
- Create: `src/ui/QuotaHUD.tsx`
- Create: `src/ui/DirectiveHUD.tsx`
- Create: `src/ui/Advisor.tsx`
- Create: `src/ui/Toast.tsx`
- Create: `src/ui/Ticker.tsx`
- Create: `src/ui/Minimap.tsx`
- Create: `src/ui/CursorTooltip.tsx`
- Create: `src/ui/LensSelector.tsx`

Port each HUD element from the POC:
- **QuotaHUD**: target, deadline, progress bar (lines 243-250)
- **DirectiveHUD**: active directive text + reward (lines 252-259)
- **Advisor**: Comrade Vanya advisory panel with dismiss button (lines 267-274)
- **Toast**: notification banner (line 262)
- **Ticker**: scrolling Pravda headlines (lines 287-290) with animation
- **Minimap**: overlay showing minimap render target (positioned top-left)
- **CursorTooltip**: tile info on long-press/hover (lines 108-145)
- **LensSelector**: 5 lens toggle buttons (lines 277-283)

**Step 18: Commit**

```bash
git add src/ui/
git commit -m "feat: HUD panels — quota, directive, advisor, toast, ticker, minimap, tooltip, lens selector"
```

---

## Task 16: React Native UI — Intro Modal (Dossier)

**Files:**
- Create: `src/ui/IntroModal.tsx`

Port the POC's intro dossier (lines 148-177): "TOP SECRET" stamp, briefing text, categorized UI instructions, "ASSUME MAYORAL AUTHORITY" button. Soviet paper-dossier aesthetic with beveled border and shadow.

**Step 19: Commit**

```bash
git add src/ui/IntroModal.tsx
git commit -m "feat: intro dossier modal"
```

---

## Task 17: Wire Everything Together — App.tsx

**Files:**
- Modify: `src/App.tsx`
- Create: `src/Content.tsx` (complete scene)
- Create: `src/hooks/useGameState.ts`
- Create: `src/hooks/useGameLoop.ts`
- Create: `src/hooks/useBuildingPicker.ts`

**App.tsx** orchestrates:
1. `NativeEngine` + `Scene` wrapping `Content`
2. React Native overlay views (TopBar, Toolbar, HUD panels) positioned with `position: 'absolute'`
3. IntroModal shown on first load
4. Game state subscription for UI updates

**Content.tsx** composes all scene components:
1. TerrainGrid
2. BuildingRenderer
3. CameraController
4. Lighting
5. WeatherFX
6. SmogOverlay, FireRenderer, AuraRenderer, LightningRenderer
7. TrainRenderer, VehicleRenderer, ZeppelinRenderer, MeteorRenderer
8. GhostPreview, LensSystem, FloatingText
9. MinimapCamera

**useGameLoop.ts**: `scene.registerBeforeRender()` driving `simTick()` + entity updates per frame.

**useBuildingPicker.ts**: `scene.onPointerDown` → `scene.pick()` → grid coords → `handleClick()`.

**useGameState.ts**: `useSyncExternalStore(gameState.subscribe, () => snapshot)` for React re-renders.

**Step 20: Commit**

```bash
git add src/
git commit -m "feat: wire App.tsx — scene + UI overlay + game loop integration"
```

---

## Task 18: Polish — Materials, Textures, Atmosphere

**Files:**
- Create: `src/scene/Materials.ts`

Apply materials that make the scene feel like Soviet brutalism:
- **Concrete**: PBR material with roughness 0.9, slight desaturation
- **Water**: animated water material with subtle wave normal map
- **Road**: dark asphalt material, mud-brown in spring
- **Winter ground**: white/gray material
- **Smog tint**: green fog when zoomed to street level
- **Night windows**: emissive yellow rectangles on powered housing meshes
- **Fire glow**: orange point lights + particle emitters
- **Irradiated**: sickly green glow material
- **Crater**: purple emissive glow (cosmic energy)

**Step 21: Commit**

```bash
git add src/scene/Materials.ts
git commit -m "feat: materials — brutalist concrete, water, atmospheric effects"
```

---

## Task 19: Polish — Sound System

**Files:**
- Create: `src/audio/SoundManager.ts`

Basic sound system for Phase 1:
- Build sound (ascending tone)
- Destroy sound (descending)
- Notification beep
- Train horn on approach
- Meteor rumble
- Lightning crack
- Background ambient (wind/rain based on weather)
- Music placeholder (can use archived audio files)

Use BabylonJS Sound class or React Native audio library.

**Step 22: Commit**

```bash
git add src/audio/
git commit -m "feat: sound system — build, destroy, weather, events"
```

---

## Task 20: Integration Testing & Final Polish

**Files:**
- Create: `__tests__/GameState.test.ts`
- Create: `__tests__/SimTick.test.ts`
- Create: `__tests__/WaterNetwork.test.ts`
- Create: `__tests__/BuildActions.test.ts`

Test the game engine logic (pure functions, no 3D dependency):
- Grid initialization (terrain types, river placement, rail row)
- Water BFS from pump through pipes
- Building placement validation
- Simulation tick: growth, power, production, consumption, population
- Smog diffusion math
- Train supply drops
- Quota checking

**Step 23: Run full test suite**

```bash
npm test
```

Expected: All tests pass.

**Step 24: Run on device**

```bash
npm run ios
# or
npm run android
```

Expected: Full playable game with all POC features in 3D.

**Step 25: Final commit**

```bash
git add -A
git commit -m "feat: SimSoviet1917 — complete Reactylon Native 3D city-builder"
```

---

## Task 21: Update CLAUDE.md for Autonomous Agent Sessions

**Files:**
- Modify: `CLAUDE.md`

Replace old project instructions with new ones covering:
- Reactylon Native project structure
- Build/run commands (npm start, npm run ios/android)
- Engine architecture (GameState + SimTick + scene components)
- GLB model pipeline
- Testing commands
- Phase 2 roadmap reference

---

## Execution Notes

**Total tasks**: 21 (Task 0 = setup, Tasks 1-2 = engine, Tasks 3-12 = 3D scene, Tasks 13-16 = UI, Task 17 = wiring, Tasks 18-19 = polish, Tasks 20-21 = testing + docs)

**Parallelizable**: Tasks 1-2 (engine) can run in parallel with Tasks 3-12 (scene). Tasks 13-16 (UI) can run in parallel with scene work. Task 17 (wiring) depends on all prior tasks.

**Agent swarm structure**:
- Agent 1: Engine port (Tasks 1-2)
- Agent 2: Scene components (Tasks 3-12)
- Agent 3: UI components (Tasks 13-16)
- Lead: Wiring + polish (Tasks 17-21)

**POC reference**: `archive/poc.html` (moved from root). All game logic is a direct TypeScript port of this file's JavaScript. Line references in this plan refer to poc.html.
