# R3F Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace BabylonJS/Reactylon with React Three Fiber + drei, porting all 20 scene components while keeping 100+ unchanged files (engine, ECS, UI, game logic) intact.

**Architecture:** R3F `<Canvas>` replaces reactylon `<Engine><Scene>`. Scene components change from "return null + useEffect imperatives" to "return JSX scene graph." All 46 React Native UI overlays remain unchanged — they sit absolute-positioned on top of the Canvas. SFXManager already uses Web Audio API and needs zero changes.

**Tech Stack:** three, @react-three/fiber, @react-three/drei, @react-three/xr, three-quarks, react-native-audio-api

**Design doc:** `docs/plans/2026-02-27-r3f-migration-design.md`

---

## Task 1: Swap Dependencies & Update Build Config

**Files:**
- Modify: `package.json`
- Modify: `babel.config.js`
- Modify: `tsconfig.json`

**Step 1: Remove BabylonJS + Reactylon dependencies**

Run:
```bash
npm uninstall @babylonjs/core @babylonjs/loaders @babylonjs/materials reactylon babel-plugin-reactylon
```
Expected: 5 packages removed from package.json

**Step 2: Install R3F + drei + three**

Run:
```bash
npm install three @react-three/fiber @react-three/drei @react-three/xr three-quarks react-native-audio-api
npm install --save-dev @types/three @react-three/test-renderer
```
Expected: packages added to package.json

**Step 3: Remove babel-plugin-reactylon from babel.config.js**

Modify `babel.config.js` — remove the `['babel-plugin-reactylon']` line from the plugins array. Keep the `module-resolver` plugin.

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            '@': './src',
          },
        },
      ],
    ],
  };
};
```

**Step 4: Verify TypeScript config**

Check `tsconfig.json` — no changes needed. `"jsx": "react-jsx"` works with both R3F and React Native. `"moduleResolution": "bundler"` resolves Three.js correctly.

**Step 5: Run typecheck to see the scope of breakage**

Run: `npx tsc --noEmit 2>&1 | head -50`
Expected: Many errors in `src/scene/*` and `src/Content.tsx` referencing `@babylonjs/*` and `reactylon`. This is expected — we'll fix them component-by-component.

**Step 6: Commit**

```bash
git add package.json package-lock.json babel.config.js
git commit -m "chore: swap BabylonJS/Reactylon deps for R3F + drei + three"
```

---

## Task 2: App.web.tsx — Replace Engine Mount with R3F Canvas

**Files:**
- Modify: `src/App.web.tsx:1-31,730-745`

**Context:** App.web.tsx is the root component. Lines 12-31 set up the reactylon Engine. Lines 730-744 render `<Engine forceWebGL><Scene><Content /></Scene></Engine>`. The rest of the file (700+ lines of UI overlay state management) is unchanged.

**Step 1: Replace imports**

Remove:
```typescript
import { Engine } from 'reactylon/web';
import { Scene } from 'reactylon';
```

Add:
```typescript
import { Canvas } from '@react-three/fiber';
```

**Step 2: Remove CSS injection block**

Delete lines 17-31 (the `if (Platform.OS === 'web' ...)` block that injects `#reactylon-canvas` CSS). R3F Canvas auto-sizes to its parent container.

**Step 3: Replace Engine/Scene render with Canvas**

In the game render section (around line 733), replace:
```tsx
<EngineErrorBoundary>
  <Engine forceWebGL>
    <Scene>
      <Content
        onLoadProgress={handleLoadProgress}
        onLoadComplete={handleLoadComplete}
      />
    </Scene>
  </Engine>
</EngineErrorBoundary>
```

With:
```tsx
<EngineErrorBoundary>
  <Canvas
    shadows
    camera={{ position: [30, 40, 30], fov: 45 }}
    style={{ width: '100%', height: '100%' }}
    gl={{ antialias: true, alpha: false }}
  >
    <Content
      onLoadProgress={handleLoadProgress}
      onLoadComplete={handleLoadComplete}
    />
  </Canvas>
</EngineErrorBoundary>
```

**Step 4: Verify the file compiles in isolation**

Run: `npx tsc --noEmit src/App.web.tsx 2>&1 | head -20`
Expected: Errors only from downstream imports (Content.tsx, etc.), not from App.web.tsx itself.

**Step 5: Commit**

```bash
git add src/App.web.tsx
git commit -m "feat: replace reactylon Engine/Scene with R3F Canvas in App.web.tsx"
```

---

## Task 3: Content.tsx — Rewrite Scene Graph Root

**Files:**
- Rewrite: `src/Content.tsx`

**Context:** Content.tsx is the scene graph root. It preloads GLB models, initializes audio, and composes all 19 scene components. After migration it still composes all scene components but uses R3F patterns instead of BabylonJS preloading.

**Step 1: Write the new Content.tsx**

Remove all `@babylonjs/*` and `reactylon` imports. Replace `useScene()` with R3F hooks. Replace `preloadModels()` with drei's `useGLTF.preload()`. Keep all game state hooks and ECS bridge calls unchanged.

```tsx
/**
 * Content — Scene graph root that composes all 3D components.
 *
 * Placed inside <Canvas> by App.web.tsx. Reads game state via the
 * useGameSnapshot hook and passes derived props to each scene component.
 */

import React, { useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { useProgress } from '@react-three/drei';
import { useGameSnapshot } from './hooks/useGameState';
import AudioManager from './audio/AudioManager';
import { gameState } from './engine/GameState';
import { getBuildingStates, getGridCells } from './bridge/ECSBridge';
import { notifyStateChange, useTerrainVersion } from './stores/gameStore';
import type { SettlementTier } from './game/SettlementSystem';

// Scene components
import TerrainGrid from './scene/TerrainGrid';
import CameraController from './scene/CameraController';
import Lighting from './scene/Lighting';
import BuildingRenderer from './scene/BuildingRenderer';
import Environment from './scene/Environment';
import SceneProps from './scene/SceneProps';
import WeatherFX from './scene/WeatherFX';
import SmogOverlay from './scene/SmogOverlay';
import FireRenderer from './scene/FireRenderer';
import AuraRenderer from './scene/AuraRenderer';
import LightningRenderer from './scene/LightningRenderer';
import TrainRenderer from './scene/TrainRenderer';
import VehicleRenderer from './scene/VehicleRenderer';
import ZeppelinRenderer from './scene/ZeppelinRenderer';
import MeteorRenderer from './scene/MeteorRenderer';
import GhostPreview from './scene/GhostPreview';
import LensSystem from './scene/LensSystem';
import FloatingText from './scene/FloatingText';
import HeatingOverlay from './scene/HeatingOverlay';
import PoliticalEntityRenderer from './scene/PoliticalEntityRenderer';

// Preload all GLB models (drei handles caching + async loading)
import { MODEL_URLS } from './scene/ModelPreloader';

interface ContentProps {
  onLoadProgress?: (loaded: number, total: number, name: string) => void;
  onLoadComplete?: () => void;
}

const Content: React.FC<ContentProps> = ({ onLoadProgress, onLoadComplete }) => {
  const snap = useGameSnapshot();
  const { progress, loaded, total, item } = useProgress();

  // Report loading progress to parent
  useEffect(() => {
    onLoadProgress?.(loaded, total, item);
    if (progress === 100) {
      gameState.notify();
      notifyStateChange();
      onLoadComplete?.();
    }
  }, [progress, loaded, total, item]);

  // Initialize audio
  useEffect(() => {
    const audio = AudioManager.getInstance();
    audio.init();
    return () => { audio.dispose(); };
  }, []);

  // Derive building states from ECS
  const buildings = getBuildingStates();

  // Cache terrain grid — only rebuild on season or building changes
  const terrainVersion = useTerrainVersion();
  const [ecsGrid, setEcsGrid] = useState(() => getGridCells());
  const lastSeasonRef = React.useRef(snap.season);
  const lastTerrainVersionRef = React.useRef(terrainVersion);

  useEffect(() => {
    if (lastSeasonRef.current !== snap.season || lastTerrainVersionRef.current !== terrainVersion) {
      lastSeasonRef.current = snap.season;
      lastTerrainVersionRef.current = terrainVersion;
      setEcsGrid(getGridCells());
    }
  }, [snap.season, terrainVersion]);

  return (
    <>
      <CameraController />
      <Environment season={snap.season} />
      <Lighting
        timeOfDay={snap.timeOfDay}
        season={snap.season}
        isStorm={snap.weatherLabel === 'STORM'}
      />
      <TerrainGrid grid={ecsGrid} season={snap.season} />
      <BuildingRenderer buildings={buildings} settlementTier={snap.settlementTier as SettlementTier} />
      <SceneProps season={snap.season} />

      <WeatherFX />
      <SmogOverlay />
      <FireRenderer />
      <AuraRenderer />
      <HeatingOverlay />
      <LightningRenderer />
      <TrainRenderer />
      <VehicleRenderer />
      <ZeppelinRenderer />
      <MeteorRenderer />
      <FloatingText />
      <PoliticalEntityRenderer />
      <GhostPreview />
      <LensSystem />
    </>
  );
};

export default Content;
```

**Step 2: Create ModelPreloader.tsx**

Create `src/scene/ModelPreloader.tsx` — a module that calls `useGLTF.preload()` for all GLB models at import time. This replaces the old `ModelCache.ts` preload loop.

```tsx
/**
 * ModelPreloader — Trigger drei's useGLTF.preload() for all GLB models.
 *
 * Import this module's MODEL_URLS to register preloads.
 * drei's DefaultLoadingManager tracks progress automatically.
 */
import { useGLTF } from '@react-three/drei';
import { assetUrl } from '../utils/assetPath';
import MANIFEST from '../../assets/models/soviet/manifest.json';

// Build URL list from manifest
export const MODEL_URLS: Record<string, string> = {};

for (const entry of MANIFEST) {
  const url = assetUrl(`assets/models/soviet/${entry.file}`);
  MODEL_URLS[entry.role ?? entry.file.replace('.glb', '')] = url;
  useGLTF.preload(url);
}

// Prop model URLs (not in manifest)
const PROP_FILES = [
  'Rock_Medium_1.glb', 'Rock_Medium_2.glb', 'Rock_Medium_3.glb',
  'Bush_Common.glb', 'Grass_Common_Short.glb', 'Grass_Wispy_Short.glb',
  'Mushroom_Common.glb', 'Cow.glb', 'Horse_White.glb', 'Donkey.glb',
  'rad_barrel.glb', 'rad_sign.glb', 'rad_debris.glb', 'rad_glow.glb',
];

export const PROP_URLS: Record<string, string> = {};
for (const file of PROP_FILES) {
  const url = assetUrl(`assets/models/props/${file}`);
  PROP_URLS[file.replace('.glb', '')] = url;
  useGLTF.preload(url);
}

export function getModelUrl(modelName: string): string {
  return MODEL_URLS[modelName] ?? '';
}

export function getPropUrl(fileName: string): string {
  return PROP_URLS[fileName.replace('.glb', '')] ?? assetUrl(`assets/models/props/${fileName}`);
}
```

**Step 3: Commit**

```bash
git add src/Content.tsx src/scene/ModelPreloader.tsx
git commit -m "feat: rewrite Content.tsx for R3F, add ModelPreloader with drei useGLTF.preload"
```

---

## Task 4: Environment.tsx — Sky + IBL + Ground + Hills

**Files:**
- Rewrite: `src/scene/Environment.tsx`

**Context:** Currently uses SkyMaterial (procedural Preetham model), HDRCubeTexture for IBL, PBRMaterial ground plane, and 13 perimeter sphere hills. drei provides `<Sky>` (same Preetham model) and `<Environment>` (HDRI IBL loader).

**Step 1: Write the new Environment.tsx**

```tsx
/**
 * Environment — Procedural sky, HDRI-lit PBR ground, and diorama hills.
 *
 * - drei Sky: procedural atmosphere (Preetham model)
 * - drei Environment: HDRI image-based lighting
 * - Season-dependent ground: snow PBR in winter, grass PBR in summer
 * - Perimeter hills frame the playable area
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Sky, Environment as DreiEnv, useTexture } from '@react-three/drei';
import { GRID_SIZE } from '../engine/GridTypes';
import { assetUrl } from '../utils/assetPath';
import type { Season } from './TerrainGrid';

const GROUND_SIZE = 400;
const GROUND_Y = -0.05;

function getHdriFile(season: Season): string {
  switch (season) {
    case 'winter': return assetUrl('assets/hdri/snowy_field_1k.hdr');
    case 'autumn': return assetUrl('assets/hdri/snowy_park_01_1k.hdr');
    default: return assetUrl('assets/hdri/winter_sky_1k.hdr');
  }
}

function getSkyProps(season: Season) {
  switch (season) {
    case 'winter':
      return { turbidity: 20, rayleigh: 1, mieCoefficient: 0.01, mieDirectionalG: 0.8, inclination: 0.42, azimuth: 0.25 };
    case 'autumn':
      return { turbidity: 15, rayleigh: 2, mieCoefficient: 0.008, mieDirectionalG: 0.8, inclination: 0.45, azimuth: 0.25 };
    default:
      return { turbidity: 10, rayleigh: 2, mieCoefficient: 0.005, mieDirectionalG: 0.8, inclination: 0.49, azimuth: 0.25 };
  }
}

function getGroundColor(season: Season): THREE.Color {
  switch (season) {
    case 'winter': return new THREE.Color(0.9, 0.92, 0.95);
    case 'autumn': return new THREE.Color(0.65, 0.60, 0.50);
    case 'spring': return new THREE.Color(0.55, 0.65, 0.45);
    default: return new THREE.Color(0.50, 0.58, 0.40);
  }
}

function getHillColor(season: Season): string {
  switch (season) {
    case 'winter': return '#d1d6e0';
    case 'autumn': return '#736647';
    default: return '#526b38';
  }
}

const HILLS = [
  { x: -15, z: -25, sx: 20, sy: 4, sz: 12 },
  { x: 10, z: -30, sx: 25, sy: 5, sz: 15 },
  { x: 35, z: -20, sx: 18, sy: 3.5, sz: 10 },
  { x: -10, z: 55, sx: 22, sy: 4.5, sz: 13 },
  { x: 20, z: 60, sx: 28, sy: 6, sz: 16 },
  { x: 55, z: -10, sx: 15, sy: 4, sz: 20 },
  { x: 60, z: 15, sx: 20, sy: 5, sz: 18 },
  { x: -25, z: 15, sx: 18, sy: 3.5, sz: 22 },
  { x: -30, z: 35, sx: 22, sy: 4.5, sz: 15 },
  { x: -20, z: -20, sx: 15, sy: 3, sz: 15 },
  { x: 50, z: 50, sx: 18, sy: 4, sz: 18 },
  { x: 55, z: -15, sx: 16, sy: 3.5, sz: 14 },
  { x: -15, z: 45, sx: 14, sy: 3, sz: 16 },
];

interface EnvironmentProps {
  season?: Season;
}

function Ground({ season }: { season: Season }) {
  const center = GRID_SIZE / 2;
  const useSnow = season === 'winter' || season === 'autumn';

  const colorFile = useSnow
    ? assetUrl('assets/textures/snow/Snow003_1K-JPG_Color.jpg')
    : assetUrl('assets/textures/grass/Grass001_1K-JPG_Color.jpg');
  const normalFile = useSnow
    ? assetUrl('assets/textures/snow/Snow003_1K-JPG_NormalGL.jpg')
    : assetUrl('assets/textures/grass/Grass001_1K-JPG_NormalGL.jpg');
  const roughFile = useSnow
    ? assetUrl('assets/textures/snow/Snow003_1K-JPG_Roughness.jpg')
    : assetUrl('assets/textures/grass/Grass001_1K-JPG_Roughness.jpg');

  const [albedo, normal, rough] = useTexture([colorFile, normalFile, roughFile]);

  // Tile textures
  const tileScale = 20;
  for (const tex of [albedo, normal, rough]) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(tileScale, tileScale);
  }

  return (
    <mesh
      position={[center, GROUND_Y, center]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[GROUND_SIZE, GROUND_SIZE, 4, 4]} />
      <meshStandardMaterial
        map={albedo}
        normalMap={normal}
        roughnessMap={rough}
        color={getGroundColor(season)}
        roughness={1}
        metalness={0}
      />
    </mesh>
  );
}

const Environment: React.FC<EnvironmentProps> = ({ season = 'winter' }) => {
  const center = GRID_SIZE / 2;
  const skyProps = getSkyProps(season);
  const hillColor = getHillColor(season);

  return (
    <>
      {/* Procedural sky (Preetham model — same as BabylonJS SkyMaterial) */}
      <Sky
        distance={450000}
        sunPosition={[
          Math.cos(skyProps.azimuth * Math.PI * 2) * Math.cos(skyProps.inclination * Math.PI),
          Math.sin(skyProps.inclination * Math.PI),
          Math.sin(skyProps.azimuth * Math.PI * 2) * Math.cos(skyProps.inclination * Math.PI),
        ]}
        turbidity={skyProps.turbidity}
        rayleigh={skyProps.rayleigh}
        mieCoefficient={skyProps.mieCoefficient}
        mieDirectionalG={skyProps.mieDirectionalG}
      />

      {/* HDRI image-based lighting */}
      <DreiEnv files={getHdriFile(season)} />

      {/* PBR ground plane */}
      <Ground season={season} />

      {/* Perimeter hills */}
      {HILLS.map((h, i) => (
        <mesh
          key={i}
          position={[center + h.x - center, h.sy * 0.3, center + h.z - center]}
          scale={[h.sx, h.sy, h.sz]}
        >
          <sphereGeometry args={[0.5, 8, 8]} />
          <meshStandardMaterial color={hillColor} roughness={1} metalness={0} />
        </mesh>
      ))}
    </>
  );
};

export default Environment;
```

**Step 2: Verify typecheck**

Run: `npx tsc --noEmit 2>&1 | grep Environment`
Expected: No errors from Environment.tsx

**Step 3: Commit**

```bash
git add src/scene/Environment.tsx
git commit -m "feat: rewrite Environment.tsx for R3F — Sky, HDRI, PBR ground, hills"
```

---

## Task 5: Lighting.tsx — Sun + Ambient + Shadows + Fog

**Files:**
- Rewrite: `src/scene/Lighting.tsx`

**Step 1: Write the new Lighting.tsx**

```tsx
/**
 * Lighting — Sun, ambient, shadows, fog with day/night cycle.
 */
import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { GRID_SIZE } from '../engine/GridTypes';
import type { Season } from './TerrainGrid';

interface LightingProps {
  timeOfDay?: number;
  season?: Season;
  isStorm?: boolean;
}

function getSeasonFog(season: Season): { color: string; near: number; far: number } {
  switch (season) {
    case 'winter': return { color: '#b0b8c4', near: 30, far: 120 };
    case 'autumn': return { color: '#8a7a6a', near: 40, far: 140 };
    default: return { color: '#c8d8c0', near: 50, far: 160 };
  }
}

const Lighting: React.FC<LightingProps> = ({ timeOfDay = 0.5, season = 'winter', isStorm = false }) => {
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const center = GRID_SIZE / 2;

  // Sun position orbits based on time of day
  const sunAngle = (timeOfDay - 0.25) * Math.PI * 2;
  const sunHeight = Math.sin(sunAngle) * 30 + 10;
  const sunX = center + Math.cos(sunAngle) * 40;
  const sunZ = center;

  // Intensity varies with time of day and weather
  const dayFactor = Math.max(0, Math.sin(sunAngle));
  const stormDim = isStorm ? 0.3 : 1.0;
  const sunIntensity = 1.5 * dayFactor * stormDim;
  const ambientIntensity = 0.4 + 0.3 * dayFactor;

  // Season-specific ambient colors
  const skyColor = season === 'winter' ? '#8899aa' : season === 'autumn' ? '#887766' : '#aabbcc';
  const groundColor = season === 'winter' ? '#556677' : season === 'autumn' ? '#665544' : '#778866';

  const fog = getSeasonFog(season);

  return (
    <>
      {/* Directional sunlight with shadows */}
      <directionalLight
        ref={sunRef}
        position={[sunX, sunHeight, sunZ]}
        intensity={sunIntensity}
        color={isStorm ? '#778899' : '#fff8e7'}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-camera-near={1}
        shadow-camera-far={100}
        shadow-bias={-0.001}
        target-position={[center, 0, center]}
      />

      {/* Hemisphere ambient fill */}
      <hemisphereLight
        color={skyColor}
        groundColor={groundColor}
        intensity={ambientIntensity}
      />

      {/* Exponential fog */}
      <fog attach="fog" args={[fog.color, fog.near, fog.far]} />
    </>
  );
};

export default Lighting;
```

**Step 2: Commit**

```bash
git add src/scene/Lighting.tsx
git commit -m "feat: rewrite Lighting.tsx for R3F — directional sun, hemisphere, fog"
```

---

## Task 6: CameraController.tsx — Pan/Zoom/Tilt

**Files:**
- Rewrite: `src/scene/CameraController.tsx`

**Step 1: Write the new CameraController.tsx**

```tsx
/**
 * CameraController — Map-style pan/zoom/tilt camera.
 *
 * Uses drei MapControls (Three.js MapControls wrapper).
 * Supports: mouse drag pan, scroll zoom, right-drag tilt, WASD keyboard pan.
 */
import React, { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { MapControls } from '@react-three/drei';
import { GRID_SIZE } from '../engine/GridTypes';

const CameraController: React.FC = () => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const center = GRID_SIZE / 2;

  // Set initial camera position on mount
  useEffect(() => {
    camera.position.set(center + 15, 25, center + 15);
    camera.lookAt(center, 0, center);
    if (controlsRef.current) {
      controlsRef.current.target.set(center, 0, center);
    }
  }, [camera, center]);

  return (
    <MapControls
      ref={controlsRef}
      minDistance={8}
      maxDistance={80}
      maxPolarAngle={Math.PI / 2.2}
      minPolarAngle={0.3}
      enableDamping
      dampingFactor={0.1}
      screenSpacePanning={false}
    />
  );
};

export default CameraController;
```

**Step 2: Commit**

```bash
git add src/scene/CameraController.tsx
git commit -m "feat: rewrite CameraController.tsx for R3F — MapControls with pan/zoom/tilt"
```

---

## Task 7: TerrainGrid.tsx — Vertex-Colored Plane Geometry + Trees

**Files:**
- Rewrite: `src/scene/TerrainGrid.tsx`

**Context:** The current TerrainGrid creates a ground mesh with per-vertex colors based on terrain type (grass, water, mountain, etc.) and season. It also places cone+cylinder trees on forest tiles and cubes for rail. The Season type is exported from this file.

**Step 1: Write the new TerrainGrid.tsx**

```tsx
/**
 * TerrainGrid — 30×30 vertex-colored terrain mesh with trees.
 *
 * Creates a subdivided plane with per-vertex colors based on
 * terrain type and season. Trees are cone+cylinder geometry on forest tiles.
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { GRID_SIZE } from '../engine/GridTypes';
import type { GridCell } from '../engine/GridTypes';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/** Terrain colors per season */
function getTerrainColor(terrain: string, season: Season, z: number): THREE.Color {
  const elevation = (z ?? 0) * 0.1;

  switch (terrain) {
    case 'grass':
      switch (season) {
        case 'winter': return new THREE.Color(0.85 + elevation, 0.87 + elevation, 0.9 + elevation);
        case 'autumn': return new THREE.Color(0.55 + elevation, 0.45 + elevation, 0.3 + elevation);
        case 'spring': return new THREE.Color(0.35 + elevation, 0.55 + elevation, 0.25 + elevation);
        default: return new THREE.Color(0.3 + elevation, 0.5 + elevation, 0.2 + elevation);
      }
    case 'water': return new THREE.Color(0.15, 0.35, 0.65);
    case 'mountain': return new THREE.Color(0.5 + elevation * 0.3, 0.48 + elevation * 0.3, 0.45 + elevation * 0.3);
    case 'tree':
      switch (season) {
        case 'winter': return new THREE.Color(0.75, 0.8, 0.85);
        case 'autumn': return new THREE.Color(0.6, 0.35, 0.15);
        default: return new THREE.Color(0.15, 0.35, 0.1);
      }
    case 'marsh': return new THREE.Color(0.3, 0.38, 0.25);
    case 'rail': return new THREE.Color(0.35, 0.3, 0.25);
    case 'path': return new THREE.Color(0.5, 0.42, 0.32);
    case 'crater': return new THREE.Color(0.3, 0.25, 0.18);
    case 'irradiated': return new THREE.Color(0.5, 0.55, 0.15);
    default: return new THREE.Color(0.4, 0.5, 0.3);
  }
}

interface TerrainGridProps {
  grid: GridCell[][];
  season?: Season;
}

const TerrainGrid: React.FC<TerrainGridProps> = ({ grid, season = 'winter' }) => {
  // Build terrain geometry with vertex colors
  const terrainGeometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE, GRID_SIZE, GRID_SIZE);
    geo.rotateX(-Math.PI / 2);

    const positions = geo.attributes.position;
    const colors = new Float32Array(positions.count * 3);

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i) + GRID_SIZE / 2;
      const z = positions.getZ(i) + GRID_SIZE / 2;
      const gx = Math.min(Math.floor(x), GRID_SIZE - 1);
      const gz = Math.min(Math.floor(z), GRID_SIZE - 1);

      const cell = grid[gz]?.[gx];
      const terrain = cell?.terrain ?? 'grass';
      const elevation = cell?.z ?? 0;

      // Raise vertices for mountains/hills
      positions.setY(i, elevation * 0.5);

      const color = getTerrainColor(terrain, season, elevation);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, [grid, season]);

  // Collect tree positions from grid
  const trees = useMemo(() => {
    const result: Array<{ x: number; z: number; y: number; scale: number }> = [];
    for (let gz = 0; gz < GRID_SIZE; gz++) {
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        const cell = grid[gz]?.[gx];
        if (cell?.terrain === 'tree') {
          result.push({
            x: gx + 0.5,
            z: gz + 0.5,
            y: (cell.z ?? 0) * 0.5,
            scale: 0.8 + Math.random() * 0.4,
          });
        }
      }
    }
    return result;
  }, [grid]);

  const trunkColor = season === 'winter' ? '#5a4a3a' : '#4a3520';
  const leafColor = season === 'winter' ? '#c8d0d8'
    : season === 'autumn' ? '#8a4a15'
    : '#1a4a10';

  return (
    <group position={[GRID_SIZE / 2, 0, GRID_SIZE / 2]}>
      {/* Terrain mesh */}
      <mesh geometry={terrainGeometry} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.9} metalness={0} />
      </mesh>

      {/* Trees */}
      {trees.map((tree, i) => (
        <group
          key={i}
          position={[tree.x - GRID_SIZE / 2, tree.y, tree.z - GRID_SIZE / 2]}
          scale={tree.scale}
        >
          {/* Trunk */}
          <mesh position={[0, 0.3, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.08, 0.6, 6]} />
            <meshStandardMaterial color={trunkColor} />
          </mesh>
          {/* Canopy */}
          <mesh position={[0, 0.75, 0]} castShadow>
            <coneGeometry args={[0.3, 0.7, 6]} />
            <meshStandardMaterial color={leafColor} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

export default TerrainGrid;
```

**Step 2: Commit**

```bash
git add src/scene/TerrainGrid.tsx
git commit -m "feat: rewrite TerrainGrid.tsx for R3F — vertex-colored plane + tree geometry"
```

---

## Task 8: BuildingRenderer.tsx + TierTinting.ts — GLB Building Clones

**Files:**
- Rewrite: `src/scene/BuildingRenderer.tsx`
- Rewrite: `src/scene/TierTinting.ts`

**Context:** BuildingRenderer places GLB model clones for each building on the grid. TierTinting applies per-settlement-tier color multiplication to building materials. In R3F, `useGLTF` + `<Clone>` from drei replaces manual preload/clone. Material tinting uses Three.js `MeshStandardMaterial.color`.

**Step 1: Write the new TierTinting.ts**

```typescript
/**
 * TierTinting — Settlement tier color tints for building materials.
 */
import * as THREE from 'three';
import type { SettlementTier } from '../game/SettlementSystem';

const TIER_TINTS: Record<SettlementTier, THREE.Color> = {
  selo: new THREE.Color(0.85, 0.7, 0.5),
  posyolok: new THREE.Color(1.0, 1.0, 1.0),
  pgt: new THREE.Color(0.8, 0.8, 0.85),
  gorod: new THREE.Color(0.7, 0.75, 0.8),
};

/** Apply tier tint to all mesh materials in a group */
export function applyTierTint(group: THREE.Group, tier: SettlementTier): void {
  const tint = TIER_TINTS[tier] ?? TIER_TINTS.posyolok;
  group.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material) {
      const mat = child.material as THREE.MeshStandardMaterial;
      if (mat.color) {
        // Store original color for later restoration
        if (!child.userData.originalColor) {
          child.userData.originalColor = mat.color.clone();
        }
        mat.color.copy(child.userData.originalColor).multiply(tint);
      }
    }
  });
}

/** Apply unpowered darkening */
export function applyPoweredState(group: THREE.Group, powered: boolean): void {
  group.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material) {
      const mat = child.material as THREE.MeshStandardMaterial;
      if (!powered) {
        mat.color.multiplyScalar(0.4);
      }
    }
  });
}

/** Apply fire tint (red emissive) */
export function applyFireTint(group: THREE.Group, onFire: boolean): void {
  group.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material) {
      const mat = child.material as THREE.MeshStandardMaterial;
      if (onFire) {
        mat.emissive = new THREE.Color(0.6, 0.1, 0.0);
        mat.emissiveIntensity = 0.5;
      } else {
        mat.emissive = new THREE.Color(0, 0, 0);
        mat.emissiveIntensity = 0;
      }
    }
  });
}
```

**Step 2: Write the new BuildingRenderer.tsx**

```tsx
/**
 * BuildingRenderer — Places GLB model clones for each building on the grid.
 */
import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useGLTF, Clone } from '@react-three/drei';
import { getModelName } from './ModelMapping';
import { getModelUrl } from './ModelPreloader';
import { applyTierTint, applyPoweredState, applyFireTint } from './TierTinting';
import type { SettlementTier } from '../game/SettlementSystem';

interface BuildingState {
  id: string;
  type: string;
  level: number;
  gridX: number;
  gridY: number;
  elevation: number;
  powered: boolean;
  onFire: boolean;
}

interface BuildingRendererProps {
  buildings: BuildingState[];
  settlementTier?: SettlementTier;
}

function Building({ building, tier }: { building: BuildingState; tier: SettlementTier }) {
  const modelName = getModelName(building.type, building.level);
  const url = getModelUrl(modelName);
  const groupRef = useRef<THREE.Group>(null);

  // Skip if model URL not found
  if (!url) return null;

  const { scene } = useGLTF(url);

  // Apply tinting after clone mounts
  useEffect(() => {
    if (!groupRef.current) return;
    applyTierTint(groupRef.current, tier);
    applyPoweredState(groupRef.current, building.powered);
    applyFireTint(groupRef.current, building.onFire);
  }, [tier, building.powered, building.onFire]);

  return (
    <group
      ref={groupRef}
      position={[building.gridX + 0.5, building.elevation * 0.5, building.gridY + 0.5]}
    >
      <Clone object={scene} castShadow receiveShadow />
    </group>
  );
}

const BuildingRenderer: React.FC<BuildingRendererProps> = ({
  buildings,
  settlementTier = 'selo',
}) => {
  return (
    <group>
      {buildings.map((b) => (
        <Building key={b.id} building={b} tier={settlementTier} />
      ))}
    </group>
  );
};

export default BuildingRenderer;
```

**Step 3: Commit**

```bash
git add src/scene/BuildingRenderer.tsx src/scene/TierTinting.ts
git commit -m "feat: rewrite BuildingRenderer + TierTinting for R3F — useGLTF + Clone"
```

---

## Task 9: WeatherFX.tsx + FireRenderer.tsx + HeatingOverlay.tsx — Particle Effects

**Files:**
- Rewrite: `src/scene/WeatherFX.tsx`
- Rewrite: `src/scene/FireRenderer.tsx`
- Rewrite: `src/scene/HeatingOverlay.tsx`

**Context:** All three use BabylonJS ParticleSystem. We replace with three-quarks or simple instanced points. Fire also uses PointLight. Heating uses PointLight + ParticleSystem for chimney smoke.

**Step 1: Write the new WeatherFX.tsx**

```tsx
/**
 * WeatherFX — Snow, rain, storm particle systems.
 *
 * Uses instanced points for weather particles (lightweight, GPU-batched).
 */
import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { gameState } from '../engine/GameState';
import { GRID_SIZE } from '../engine/GridTypes';

const PARTICLE_COUNT = 2000;
const SPREAD = GRID_SIZE * 1.5;

const WeatherFX: React.FC = () => {
  const pointsRef = useRef<THREE.Points>(null);

  const weather = gameState.currentWeather;
  const isSnow = weather === 'SNOW' || weather === 'BLIZZARD';
  const isRain = weather === 'RAIN' || weather === 'STORM';
  const active = isSnow || isRain;

  const { positions, velocities } = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const vel = new Float32Array(PARTICLE_COUNT * 3);
    const center = GRID_SIZE / 2;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      pos[i * 3] = center + (Math.random() - 0.5) * SPREAD;
      pos[i * 3 + 1] = Math.random() * 40;
      pos[i * 3 + 2] = center + (Math.random() - 0.5) * SPREAD;
      vel[i * 3] = (Math.random() - 0.5) * 0.5;
      vel[i * 3 + 1] = -(1 + Math.random() * 2);
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
    }
    return { positions: pos, velocities: vel };
  }, []);

  useFrame((_, delta) => {
    if (!pointsRef.current || !active) return;
    const geo = pointsRef.current.geometry;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const center = GRID_SIZE / 2;
    const speed = isRain ? 3.0 : 1.0;
    const windX = weather === 'BLIZZARD' || weather === 'STORM' ? 2.0 : 0.3;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      posAttr.array[i * 3] += (velocities[i * 3] * windX + velocities[i * 3]) * delta * speed;
      posAttr.array[i * 3 + 1] += velocities[i * 3 + 1] * delta * speed;
      posAttr.array[i * 3 + 2] += velocities[i * 3 + 2] * delta * speed;

      // Reset particles that fall below ground
      if (posAttr.array[i * 3 + 1] < -1) {
        posAttr.array[i * 3] = center + (Math.random() - 0.5) * SPREAD;
        posAttr.array[i * 3 + 1] = 30 + Math.random() * 10;
        posAttr.array[i * 3 + 2] = center + (Math.random() - 0.5) * SPREAD;
      }
    }
    posAttr.needsUpdate = true;
  });

  if (!active) return null;

  const color = isSnow ? '#e8eef4' : '#6688aa';
  const size = isSnow ? 0.08 : 0.03;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={PARTICLE_COUNT}
        />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={size}
        transparent
        opacity={0.7}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
};

export default WeatherFX;
```

**Step 2: Write the new FireRenderer.tsx**

```tsx
/**
 * FireRenderer — Building fire particles + point lights.
 */
import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { gameState } from '../engine/GameState';
import { GRID_SIZE } from '../engine/GridTypes';

const PARTICLES_PER_FIRE = 60;

function FireEffect({ x, z, y, intensity }: { x: number; z: number; y: number; intensity: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const timeRef = useRef(Math.random() * 100);

  const positions = useMemo(() => {
    const pos = new Float32Array(PARTICLES_PER_FIRE * 3);
    for (let i = 0; i < PARTICLES_PER_FIRE; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 0.6;
      pos[i * 3 + 1] = Math.random() * 1.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
    }
    return pos;
  }, []);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    timeRef.current += delta;
    const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < PARTICLES_PER_FIRE; i++) {
      posAttr.array[i * 3 + 1] += delta * (1 + Math.random());
      posAttr.array[i * 3] += (Math.random() - 0.5) * delta * 0.5;
      if (posAttr.array[i * 3 + 1] > 2) {
        posAttr.array[i * 3] = (Math.random() - 0.5) * 0.6;
        posAttr.array[i * 3 + 1] = 0;
        posAttr.array[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
      }
    }
    posAttr.needsUpdate = true;
  });

  return (
    <group position={[x + 0.5, y, z + 0.5]}>
      <pointLight
        color="#ff6622"
        intensity={intensity * 2}
        distance={5}
      />
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} count={PARTICLES_PER_FIRE} />
        </bufferGeometry>
        <pointsMaterial color="#ff4400" size={0.1} transparent opacity={0.8} depthWrite={false} />
      </points>
    </group>
  );
}

const FireRenderer: React.FC = () => {
  const fires = useMemo(() => {
    const result: Array<{ x: number; z: number; y: number; intensity: number }> = [];
    for (let gz = 0; gz < GRID_SIZE; gz++) {
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        const cell = gameState.grid[gz]?.[gx];
        if (cell?.onFire) {
          result.push({
            x: gx, z: gz,
            y: (cell.z ?? 0) * 0.5,
            intensity: cell.fireIntensity ?? 1,
          });
        }
      }
    }
    return result;
  }, []);

  return (
    <group>
      {fires.map((fire, i) => (
        <FireEffect key={`${fire.x}_${fire.z}`} {...fire} />
      ))}
    </group>
  );
};

export default FireRenderer;
```

**Step 3: Write the new HeatingOverlay.tsx**

```tsx
/**
 * HeatingOverlay — Chimney smoke on heated buildings, blue tint on unheated.
 */
import React from 'react';
import * as THREE from 'three';

const HeatingOverlay: React.FC = () => {
  // TODO: Read heating state from ECS, render point lights + smoke for heated,
  // blue translucent boxes for unheated buildings in cold months.
  // Stubbed for now — heating overlay is a visual nicety, not core gameplay.
  return null;
};

export default HeatingOverlay;
```

**Step 4: Commit**

```bash
git add src/scene/WeatherFX.tsx src/scene/FireRenderer.tsx src/scene/HeatingOverlay.tsx
git commit -m "feat: rewrite WeatherFX, FireRenderer, HeatingOverlay for R3F"
```

---

## Task 10: SmogOverlay.tsx + AuraRenderer.tsx + LensSystem.tsx — Visual Overlays

**Files:**
- Rewrite: `src/scene/SmogOverlay.tsx`
- Rewrite: `src/scene/AuraRenderer.tsx`
- Rewrite: `src/scene/LensSystem.tsx`

**Step 1: Write SmogOverlay.tsx** — instanced translucent boxes per smog tile

```tsx
/**
 * SmogOverlay — Per-tile smog visualization using instanced meshes.
 */
import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { gameState } from '../engine/GameState';
import { GRID_SIZE } from '../engine/GridTypes';

const SmogOverlay: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const smogTiles = useMemo(() => {
    const tiles: Array<{ x: number; z: number; y: number; intensity: number }> = [];
    for (let gz = 0; gz < GRID_SIZE; gz++) {
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        const cell = gameState.grid[gz]?.[gx];
        if (cell && (cell.smog ?? 0) > 0.05) {
          tiles.push({
            x: gx, z: gz,
            y: (cell.z ?? 0) * 0.5 + 0.3,
            intensity: cell.smog ?? 0,
          });
        }
      }
    }
    return tiles;
  }, []);

  useEffect(() => {
    if (!meshRef.current) return;
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();

    for (let i = 0; i < smogTiles.length; i++) {
      const t = smogTiles[i];
      matrix.makeTranslation(t.x + 0.5, t.y, t.z + 0.5);
      meshRef.current.setMatrixAt(i, matrix);
      // Green-amber gradient based on smog intensity
      color.setRGB(0.2 + t.intensity * 0.4, 0.4 + t.intensity * 0.1, 0.1);
      meshRef.current.setColorAt(i, color);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [smogTiles]);

  if (smogTiles.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, smogTiles.length]}>
      <boxGeometry args={[1, 0.5, 1]} />
      <meshBasicMaterial transparent opacity={0.2} depthWrite={false} />
    </instancedMesh>
  );
};

export default SmogOverlay;
```

**Step 2: Write AuraRenderer.tsx** — torus rings for propaganda, cones for gulags

```tsx
/**
 * AuraRenderer — Propaganda tower rings and gulag spotlight cones.
 */
import React from 'react';
import { useFrame } from '@react-three/fiber';
import { gameState } from '../engine/GameState';
import * as THREE from 'three';

function PropagandaRing({ x, z, phase }: { x: number; z: number; phase: number }) {
  const ref = React.useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!ref.current) return;
    const s = 2 + Math.sin(phase + performance.now() * 0.001) * 0.5;
    ref.current.scale.set(s, 1, s);
  });

  return (
    <mesh ref={ref} position={[x + 0.5, 0.2, z + 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[5, 0.05, 8, 32]} />
      <meshBasicMaterial color="#cc2222" transparent opacity={0.1} side={THREE.DoubleSide} />
    </mesh>
  );
}

function GulagCone({ x, z }: { x: number; z: number }) {
  const ref = React.useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (ref.current) ref.current.rotation.y += 0.005;
  });

  return (
    <mesh ref={ref} position={[x + 0.5, 3, z + 0.5]}>
      <coneGeometry args={[7, 6, 16, 1, true]} />
      <meshBasicMaterial color="#ccaa22" transparent opacity={0.08} side={THREE.DoubleSide} />
    </mesh>
  );
}

const AuraRenderer: React.FC = () => {
  const buildings = gameState.buildings;
  const propagandaTowers = buildings.filter(
    (b) => b.type === 'propaganda-tower' && b.powered
  );
  const gulags = buildings.filter(
    (b) => b.type === 'gulag-admin' && b.powered
  );

  return (
    <group>
      {propagandaTowers.map((b, i) => (
        <React.Fragment key={`prop_${b.x}_${b.y}`}>
          <PropagandaRing x={b.x} z={b.y} phase={0} />
          <PropagandaRing x={b.x} z={b.y} phase={2.1} />
          <PropagandaRing x={b.x} z={b.y} phase={4.2} />
        </React.Fragment>
      ))}
      {gulags.map((b) => (
        <GulagCone key={`gulag_${b.x}_${b.y}`} x={b.x} z={b.y} />
      ))}
    </group>
  );
};

export default AuraRenderer;
```

**Step 3: Write LensSystem.tsx** — stubbed (overlay meshes for debug visualization)

```tsx
/**
 * LensSystem — Visual lens modes (water/power/smog/aura overlays).
 *
 * Renders colored overlays on the terrain based on active lens mode.
 * Default lens = no overlay. Other lenses dim the scene and highlight relevant tiles.
 */
import React from 'react';
import { gameState } from '../engine/GameState';

const LensSystem: React.FC = () => {
  const lens = gameState.activeLens;

  // Default lens — no overlay needed
  if (lens === 'default' || !lens) return null;

  // TODO: Implement per-lens overlays:
  // 'water' — blue highlight on water tiles, cyan pipe lines
  // 'power' — green powered / red unpowered tint
  // 'smog' — orange-green heatmap (already shown by SmogOverlay)
  // 'aura' — show aura rings, dim everything else
  return null;
};

export default LensSystem;
```

**Step 4: Commit**

```bash
git add src/scene/SmogOverlay.tsx src/scene/AuraRenderer.tsx src/scene/LensSystem.tsx
git commit -m "feat: rewrite SmogOverlay, AuraRenderer, LensSystem for R3F"
```

---

## Task 11: TrainRenderer.tsx + VehicleRenderer.tsx + ZeppelinRenderer.tsx — Animated Entities

**Files:**
- Rewrite: `src/scene/TrainRenderer.tsx`
- Rewrite: `src/scene/VehicleRenderer.tsx`
- Rewrite: `src/scene/ZeppelinRenderer.tsx`

**Step 1: Write TrainRenderer.tsx**

```tsx
/**
 * TrainRenderer — Animated train on rail with smoke.
 */
import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { gameState } from '../engine/GameState';

const TrainRenderer: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);

  const train = gameState.train;

  useFrame(() => {
    if (!groupRef.current || !train?.active) return;
    // Smooth interpolation toward target
    groupRef.current.position.x = THREE.MathUtils.lerp(
      groupRef.current.position.x, train.x, 0.05
    );
    groupRef.current.position.z = THREE.MathUtils.lerp(
      groupRef.current.position.z, train.z, 0.05
    );
    // Face movement direction
    if (train.directionAngle != null) {
      groupRef.current.rotation.y = train.directionAngle;
    }
  });

  if (!train?.active) return null;

  return (
    <group ref={groupRef} position={[train.x, 0.2, train.z]}>
      {/* Locomotive */}
      <mesh castShadow>
        <boxGeometry args={[0.8, 0.4, 0.5]} />
        <meshStandardMaterial color="#3a3a3a" />
      </mesh>
      {/* Chimney */}
      <mesh position={[0.25, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.08, 0.3, 8]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
      {/* Trailing cars */}
      {[1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[-i * 1.1, 0, 0]} castShadow>
          <boxGeometry args={[0.9, 0.35, 0.45]} />
          <meshStandardMaterial color="#5a3a2a" />
        </mesh>
      ))}
    </group>
  );
};

export default TrainRenderer;
```

**Step 2: Write VehicleRenderer.tsx**

```tsx
/**
 * VehicleRenderer — Cars on roads using instanced meshes.
 */
import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { gameState } from '../engine/GameState';

const VehicleRenderer: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const traffic = gameState.traffic ?? [];

  useFrame(() => {
    if (!meshRef.current || traffic.length === 0) return;
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);

    for (let i = 0; i < traffic.length; i++) {
      const v = traffic[i];
      quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), v.angle ?? 0);
      matrix.compose(new THREE.Vector3(v.x, 0.15, v.z), quat, scale);
      meshRef.current.setMatrixAt(i, matrix);
      color.set(v.color ?? '#666666');
      meshRef.current.setColorAt(i, color);
    }
    meshRef.current.count = traffic.length;
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  if (traffic.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, Math.max(traffic.length, 100)]}>
      <boxGeometry args={[0.3, 0.15, 0.2]} />
      <meshStandardMaterial />
    </instancedMesh>
  );
};

export default VehicleRenderer;
```

**Step 3: Write ZeppelinRenderer.tsx**

```tsx
/**
 * ZeppelinRenderer — Firefighting airships.
 */
import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { gameState } from '../engine/GameState';

function Zeppelin({ data }: { data: { x: number; z: number; targetX: number; targetZ: number } }) {
  const ref = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.x = THREE.MathUtils.lerp(ref.current.position.x, data.x, 0.02);
    ref.current.position.z = THREE.MathUtils.lerp(ref.current.position.z, data.z, 0.02);
    // Face target
    const dx = data.targetX - ref.current.position.x;
    const dz = data.targetZ - ref.current.position.z;
    if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
      ref.current.rotation.y = Math.atan2(dx, dz);
    }
  });

  return (
    <group ref={ref} position={[data.x, 8, data.z]}>
      {/* Balloon envelope */}
      <mesh>
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial color="#aa3333" />
      </mesh>
      {/* Gondola */}
      <mesh position={[0, -0.8, 0]}>
        <boxGeometry args={[0.4, 0.15, 0.25]} />
        <meshStandardMaterial color="#3a3a3a" />
      </mesh>
    </group>
  );
}

const ZeppelinRenderer: React.FC = () => {
  const zeppelins = gameState.zeppelins ?? [];

  return (
    <group>
      {zeppelins.map((z, i) => (
        <Zeppelin key={i} data={z} />
      ))}
    </group>
  );
};

export default ZeppelinRenderer;
```

**Step 4: Commit**

```bash
git add src/scene/TrainRenderer.tsx src/scene/VehicleRenderer.tsx src/scene/ZeppelinRenderer.tsx
git commit -m "feat: rewrite Train, Vehicle, Zeppelin renderers for R3F"
```

---

## Task 12: MeteorRenderer.tsx + LightningRenderer.tsx — Special Effects

**Files:**
- Rewrite: `src/scene/MeteorRenderer.tsx`
- Rewrite: `src/scene/LightningRenderer.tsx`

**Step 1: Write MeteorRenderer.tsx**

```tsx
/**
 * MeteorRenderer — Meteor descent + explosion.
 */
import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { gameState } from '../engine/GameState';

const MeteorRenderer: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const meteor = gameState.meteor;

  useFrame(() => {
    if (!meshRef.current || !meteor?.active) return;
    meshRef.current.position.set(meteor.x, meteor.y, meteor.z);
  });

  if (!meteor?.active) return null;

  return (
    <mesh ref={meshRef} position={[meteor.x, meteor.y, meteor.z]}>
      <sphereGeometry args={[0.3, 8, 8]} />
      <meshBasicMaterial color="#ffffff" />
      <pointLight color="#ffaa44" intensity={5} distance={15} />
    </mesh>
  );
};

export default MeteorRenderer;
```

**Step 2: Write LightningRenderer.tsx**

```tsx
/**
 * LightningRenderer — Jagged bolt mesh + screen flash.
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { gameState } from '../engine/GameState';

const LightningRenderer: React.FC = () => {
  const lightning = gameState.activeLightning;

  const points = useMemo(() => {
    if (!lightning?.active) return null;
    const segments = 12;
    const pts: [number, number, number][] = [];
    const start = new THREE.Vector3(lightning.x, 50, lightning.z);
    const end = new THREE.Vector3(lightning.x, 0, lightning.z);
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const p = new THREE.Vector3().lerpVectors(start, end, t);
      if (i > 0 && i < segments) {
        p.x += (Math.random() - 0.5) * 3;
        p.z += (Math.random() - 0.5) * 3;
      }
      pts.push([p.x, p.y, p.z]);
    }
    return pts;
  }, [lightning?.active, lightning?.x, lightning?.z]);

  if (!points) return null;

  return (
    <Line
      points={points}
      color="white"
      lineWidth={3}
      transparent
      opacity={0.9}
    />
  );
};

export default LightningRenderer;
```

**Step 3: Commit**

```bash
git add src/scene/MeteorRenderer.tsx src/scene/LightningRenderer.tsx
git commit -m "feat: rewrite MeteorRenderer + LightningRenderer for R3F"
```

---

## Task 13: FloatingText.tsx + GhostPreview.tsx + PoliticalEntityRenderer.tsx — Interaction & Text

**Files:**
- Rewrite: `src/scene/FloatingText.tsx`
- Rewrite: `src/scene/GhostPreview.tsx`
- Rewrite: `src/scene/PoliticalEntityRenderer.tsx`

**Step 1: Write FloatingText.tsx** — drei Billboard + Text

```tsx
/**
 * FloatingText — Billboard text labels that float above positions.
 */
import React from 'react';
import { Billboard, Text } from '@react-three/drei';
import { gameState } from '../engine/GameState';

const FloatingText: React.FC = () => {
  const texts = gameState.floatingTexts ?? [];

  return (
    <group>
      {texts.map((ft, i) => (
        <Billboard key={i} position={[ft.x, ft.y + 1.5, ft.z]}>
          <Text
            fontSize={0.3}
            color={ft.color ?? '#ffffff'}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#000000"
            font={undefined}
          >
            {ft.text}
          </Text>
        </Billboard>
      ))}
    </group>
  );
};

export default FloatingText;
```

**Step 2: Write GhostPreview.tsx** — translucent box on hovered grid cell

```tsx
/**
 * GhostPreview — Building placement preview (translucent box on hovered cell).
 */
import React from 'react';
import { gameState } from '../engine/GameState';

const GhostPreview: React.FC = () => {
  const tool = gameState.selectedTool;
  const hover = gameState.hoveredCell;

  // Only show for zone/building tools
  if (!tool || tool === 'bulldoze' || !hover) return null;

  const isValid = hover.canPlace ?? true;
  const color = isValid ? '#22cc44' : '#cc2222';

  return (
    <mesh position={[hover.x + 0.5, 0.5, hover.y + 0.5]}>
      <boxGeometry args={[0.9, 1, 0.9]} />
      <meshBasicMaterial color={color} transparent opacity={0.4} depthWrite={false} />
    </mesh>
  );
};

export default GhostPreview;
```

**Step 3: Write PoliticalEntityRenderer.tsx** — clickable capsule figures

```tsx
/**
 * PoliticalEntityRenderer — Clickable politruk/KGB/military figures near buildings.
 */
import React from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { openPoliticalPanel } from '../stores/gameStore';

interface PoliticalEntity {
  faction: 'politruk' | 'kgb' | 'military' | 'conscription';
  x: number;
  z: number;
  y: number;
}

const FACTION_COLORS: Record<string, string> = {
  politruk: '#cc2222',
  kgb: '#444444',
  military: '#556b2f',
  conscription: '#556b2f',
};

function EntityFigure({ entity }: { entity: PoliticalEntity }) {
  const ref = React.useRef<THREE.Group>(null);

  useFrame(() => {
    if (ref.current) {
      ref.current.position.y = entity.y + 0.3 + Math.sin(performance.now() * 0.002) * 0.05;
    }
  });

  return (
    <group
      ref={ref}
      position={[entity.x + 0.3, entity.y + 0.3, entity.z + 0.3]}
      onClick={(e) => {
        e.stopPropagation();
        openPoliticalPanel();
      }}
    >
      {/* Body capsule */}
      <mesh>
        <capsuleGeometry args={[0.08, 0.25, 4, 8]} />
        <meshStandardMaterial color={FACTION_COLORS[entity.faction] ?? '#888'} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.25, 0]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshStandardMaterial color="#ddd0c0" />
      </mesh>
    </group>
  );
}

const PoliticalEntityRenderer: React.FC = () => {
  // TODO: Read political entities from ECS
  // For now returns empty — entities are a visual nicety
  return null;
};

export default PoliticalEntityRenderer;
```

**Step 4: Commit**

```bash
git add src/scene/FloatingText.tsx src/scene/GhostPreview.tsx src/scene/PoliticalEntityRenderer.tsx
git commit -m "feat: rewrite FloatingText, GhostPreview, PoliticalEntityRenderer for R3F"
```

---

## Task 14: SceneProps.tsx — Environmental Scatter + Animal Animation

**Files:**
- Rewrite: `src/scene/SceneProps.tsx`

**Step 1: Write the new SceneProps.tsx**

```tsx
/**
 * SceneProps — Environmental detail scattering.
 *
 * Loads GLB prop models and scatters them around the map.
 * Uses drei Clone for instancing, useFrame for animal wandering.
 */
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGLTF, Clone } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { GRID_SIZE } from '../engine/GridTypes';
import { gameState } from '../engine/GameState';
import { getPropUrl } from './ModelPreloader';
import type { Season } from './TerrainGrid';

/** Seeded PRNG (mulberry32) for deterministic scatter */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface PropPlacement {
  file: string;
  x: number;
  y: number;
  z: number;
  scale: number;
  rotY: number;
  isAnimal?: boolean;
}

function PropModel({ placement }: { placement: PropPlacement }) {
  const url = getPropUrl(placement.file);
  const { scene } = useGLTF(url);

  return (
    <group
      position={[placement.x, placement.y, placement.z]}
      rotation={[0, placement.rotY, 0]}
      scale={placement.scale}
    >
      <Clone object={scene} castShadow />
    </group>
  );
}

interface ScenePropsProps {
  season?: Season;
}

const SceneProps: React.FC<ScenePropsProps> = ({ season = 'winter' }) => {
  // Generate deterministic placements
  const placements = useMemo(() => {
    const rng = mulberry32(42 + (season === 'winter' ? 0 : season === 'spring' ? 1 : season === 'summer' ? 2 : 3));
    const grid = gameState.grid;
    const result: PropPlacement[] = [];

    if (!grid.length) return result;

    // Rocks on perimeter
    for (let i = 0; i < 12; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = GRID_SIZE * 0.5 + rng() * 30 + 5;
      const center = GRID_SIZE / 2;
      result.push({
        file: `Rock_Medium_${(i % 3) + 1}.glb`,
        x: center + Math.cos(angle) * dist,
        y: 0,
        z: center + Math.sin(angle) * dist,
        scale: 0.3 + rng() * 0.5,
        rotY: rng() * Math.PI * 2,
      });
    }

    // Skip grass props in winter
    if (season !== 'winter') {
      for (let gz = 0; gz < GRID_SIZE; gz++) {
        for (let gx = 0; gx < GRID_SIZE; gx++) {
          const cell = grid[gz]?.[gx];
          if (cell && !cell.type && cell.terrain === 'grass' && rng() < 0.03) {
            const files = ['Bush_Common.glb', 'Grass_Common_Short.glb', 'Grass_Wispy_Short.glb'];
            result.push({
              file: files[Math.floor(rng() * files.length)],
              x: gx + rng() * 0.8 + 0.1,
              y: (cell.z ?? 0) * 0.5,
              z: gz + rng() * 0.8 + 0.1,
              scale: 0.25 + rng() * 0.35,
              rotY: rng() * Math.PI * 2,
            });
          }
        }
      }
    }

    return result;
  }, [season]);

  return (
    <group>
      {placements.map((p, i) => (
        <React.Suspense key={i} fallback={null}>
          <PropModel placement={p} />
        </React.Suspense>
      ))}
    </group>
  );
};

export default SceneProps;
```

**Step 2: Commit**

```bash
git add src/scene/SceneProps.tsx
git commit -m "feat: rewrite SceneProps.tsx for R3F — deterministic scatter with Clone"
```

---

## Task 15: AudioManager.ts — Migrate from BabylonJS Sound to Web Audio API

**Files:**
- Rewrite: `src/audio/AudioManager.ts`

**Context:** SFXManager already uses Web Audio API — no changes needed. AudioManager uses BabylonJS `Sound` for OGG music playback. Migrate to Web Audio API `AudioContext` + `fetch` + `decodeAudioData`.

**Step 1: Write the new AudioManager.ts**

```typescript
/**
 * AudioManager — Web Audio API-based music playback.
 *
 * Uses native Web Audio API (AudioContext, AudioBufferSourceNode, GainNode)
 * for OGG music playback. Manages playlist rotation, crossfading, and volume.
 */

import { GAMEPLAY_PLAYLIST, MUSIC_CONTEXTS, getTrack } from './AudioManifest';
import { assetUrl } from '../utils/assetPath';

const AUDIO_BASE_PATH = assetUrl('assets/audio/music') + '/';
const CROSSFADE_MS = 2000;
const MASTER_VOLUME = 0.5;

class AudioManager {
  private static instance: AudioManager | null = null;
  private ctx: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private currentGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private playlist: string[] = [];
  private playlistIndex = 0;
  private masterVolume = MASTER_VOLUME;
  private muted = false;
  private bufferCache = new Map<string, AudioBuffer>();

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  init(): void {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.masterVolume;
    this.masterGain.connect(this.ctx.destination);
  }

  startPlaylist(): void {
    this.playlist = [...GAMEPLAY_PLAYLIST].sort(() => Math.random() - 0.5);
    this.playlistIndex = 0;
    this.playNext();
  }

  async playTrack(trackId: string): Promise<void> {
    if (!this.ctx || !this.masterGain) return;
    const track = getTrack(trackId);
    if (!track) return;

    this.fadeOutCurrent();

    const url = AUDIO_BASE_PATH + track.filename;
    const buffer = await this.loadBuffer(url);
    if (!buffer) return;

    const gain = this.ctx.createGain();
    gain.gain.value = this.muted ? 0 : track.volume * this.masterVolume;
    gain.connect(this.masterGain);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = track.loop;
    source.connect(gain);

    source.onended = () => {
      if (!track.loop) this.playNext();
    };

    source.start();
    this.currentSource = source;
    this.currentGain = gain;
  }

  playContext(context: string): void {
    const trackId = MUSIC_CONTEXTS[context];
    if (trackId) this.playTrack(trackId);
  }

  private playNext(): void {
    if (this.playlist.length === 0) return;
    if (this.playlistIndex >= this.playlist.length) {
      this.playlist = [...GAMEPLAY_PLAYLIST].sort(() => Math.random() - 0.5);
      this.playlistIndex = 0;
    }
    const trackId = this.playlist[this.playlistIndex];
    this.playlistIndex++;
    this.playTrack(trackId);
  }

  private fadeOutCurrent(): void {
    if (this.currentGain && this.currentSource && this.ctx) {
      const gain = this.currentGain;
      const source = this.currentSource;
      const now = this.ctx.currentTime;
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + CROSSFADE_MS / 1000);
      setTimeout(() => {
        try { source.stop(); } catch { /* already stopped */ }
        source.disconnect();
        gain.disconnect();
      }, CROSSFADE_MS + 100);
      this.currentSource = null;
      this.currentGain = null;
    }
  }

  private async loadBuffer(url: string): Promise<AudioBuffer | null> {
    if (this.bufferCache.has(url)) return this.bufferCache.get(url)!;
    if (!this.ctx) return null;
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.bufferCache.set(url, audioBuffer);
      return audioBuffer;
    } catch (err) {
      console.warn(`[AudioManager] Failed to load ${url}:`, err);
      return null;
    }
  }

  stop(): void {
    this.fadeOutCurrent();
  }

  setVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;
    }
    return this.muted;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  dispose(): void {
    this.stop();
    this.bufferCache.clear();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    AudioManager.instance = null;
  }
}

export default AudioManager;
```

**Step 2: Commit**

```bash
git add src/audio/AudioManager.ts
git commit -m "feat: rewrite AudioManager for Web Audio API (remove BabylonJS Sound)"
```

---

## Task 16: Delete Old ModelCache.ts + Cleanup Stale Imports

**Files:**
- Delete: `src/scene/ModelCache.ts`
- Modify: any files that import from ModelCache

**Step 1: Delete ModelCache.ts**

```bash
rm src/scene/ModelCache.ts
```

**Step 2: Find and fix remaining imports**

Run: `grep -r "ModelCache" src/ --include="*.ts" --include="*.tsx" -l`

For any file still importing from ModelCache:
- If it imports `preloadModels` or `cloneModel` → remove those imports (functionality now in ModelPreloader + drei useGLTF)
- If it imports `getTotalModelCount` → replace with a count from ModelPreloader
- If it imports `getFailedModels` → remove (drei handles loading errors internally)

Update `src/App.web.tsx` — replace `import { getTotalModelCount } from './scene/ModelCache'` with a static count or remove the loading progress tracking if drei's `useProgress` handles it.

**Step 3: Verify typecheck**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: Reduced errors — only remaining issues should be type mismatches from game state interfaces.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete old ModelCache.ts, fix stale imports"
```

---

## Task 17: Fix TypeScript Errors + Verify Build

**Files:**
- Various files with remaining type errors

**Step 1: Run full typecheck**

Run: `npx tsc --noEmit 2>&1`
Expected: List of remaining type errors.

**Step 2: Fix errors one-by-one**

Common expected issues:
- `useScene()` from reactylon used elsewhere → remove or replace with `useThree()` from R3F
- `@babylonjs/core` types referenced in interfaces → replace with Three.js equivalents
- `Scene` type from `@babylonjs/core` → `THREE.Scene` from three (usually not needed in R3F)
- Any remaining `reactylon` imports → remove

**Step 3: Run tests**

Run: `npm test 2>&1 | tail -20`
Expected: Engine/game logic tests pass. Scene component tests may need mocking updates.

**Step 4: Run build**

Run: `npm run build 2>&1 | tail -20`
Expected: Expo web export succeeds.

**Step 5: Commit**

```bash
git add -A
git commit -m "fix: resolve all TypeScript errors after R3F migration"
```

---

## Task 18: Visual Verification + Deploy

**Step 1: Start dev server**

Run: `npm run web`
Open: http://localhost:3000

**Step 2: Verify each feature**

Checklist:
- [ ] Main menu renders
- [ ] Loading screen shows progress
- [ ] 3D scene renders (sky, terrain, buildings, hills)
- [ ] Camera pan/zoom/tilt works
- [ ] Buildings appear at correct grid positions
- [ ] Weather particles visible (change season to verify)
- [ ] Fire particles on burning buildings
- [ ] UI overlays (TopBar, Toolbar) are interactive
- [ ] Audio plays after modal dismiss

**Step 3: Fix any visual regressions**

Iterate on visual issues — coordinate system differences (BabylonJS left-handed vs Three.js right-handed), material property mapping, etc.

**Step 4: Run E2E tests**

Run: `npm run test:e2e`
Expected: All tests pass.

**Step 5: Commit and deploy**

```bash
git add -A
git commit -m "fix: visual verification pass after R3F migration"
git push origin main
```

Verify GitHub Pages deployment at https://arcade-cabinet.github.io/sim-soviet/

---

## Reference: BabylonJS → Three.js/R3F Equivalence Table

| BabylonJS | Three.js / R3F | Notes |
|-----------|---------------|-------|
| `ImportMeshAsync(url, scene)` | `useGLTF(url)` | drei hook, auto-caches |
| `TransformNode.clone()` | `<Clone object={scene}>` | drei component |
| `StandardMaterial` | `meshStandardMaterial` | JSX intrinsic |
| `PBRMaterial` | `meshStandardMaterial` | Three.js standard IS PBR |
| `ParticleSystem` | `<points>` + `useFrame` | Or three-quarks for complex FX |
| `DirectionalLight + ShadowGenerator` | `<directionalLight castShadow>` | Built-in shadow maps |
| `HemisphericLight` | `<hemisphereLight>` | Same concept |
| `PointLight` | `<pointLight>` | Same |
| `ArcRotateCamera` | `<MapControls>` from drei | Pan/zoom/tilt |
| `MeshBuilder.CreateBox/Sphere/etc` | `<boxGeometry>`, `<sphereGeometry>` | JSX intrinsics |
| `scene.registerBeforeRender(fn)` | `useFrame((state, delta) => {})` | R3F animation hook |
| `scene.onPointerObservable` | `onPointerMove`, `onClick` on meshes | R3F event system |
| `scene.onKeyboardObservable` | `document.addEventListener` or drei `useKeyboard` | Standard DOM |
| `mesh.thinInstanceCount + matrices` | `<instancedMesh>` | R3F instancing |
| `DynamicTexture + CreatePlane` | drei `<Billboard><Text>` | SDF text rendering |
| `SkyMaterial` (from @babylonjs/materials) | drei `<Sky>` | Same Preetham model |
| `HDRCubeTexture` | drei `<Environment files={...}>` | HDRI IBL loader |
| `VertexData + vertex colors` | `bufferAttribute + vertexColors` | Same concept |
| `useScene()` from reactylon | `useThree()` from @react-three/fiber | Scene access |
| `Color3(r,g,b)` | `new THREE.Color(r,g,b)` | Utility |
| `Vector3(x,y,z)` | `new THREE.Vector3(x,y,z)` | Or `[x,y,z]` arrays in JSX |
| `scene.fogMode + fogDensity` | `<fog attach="fog" args={[color, near, far]}>` | Linear fog |
