# SimSoviet 1917 — R3F Migration Design

## Goal

Replace BabylonJS/Reactylon with React Three Fiber (R3F) + drei + expo-three, targeting **web**, **native mobile** (react-native-webgpu), and **WebXR/AR** from day one.

## Architecture Overview

**Approach A: R3F Everywhere** — One scene graph, one component tree.

| Platform | Runtime | 3D Engine | AR/VR |
|----------|---------|-----------|-------|
| Web | Expo Web (Metro) | `@react-three/fiber` | `@react-three/xr` (WebXR) |
| iOS/Android | Expo + react-native-webgpu | R3F (patched for WGPU) | Deferred (ViroReact later) |
| Quest/Vision Pro | Web browser | R3F + WebXR | `@react-three/xr` |

## What Changes

### Removed Dependencies
- `@babylonjs/core` — entire engine
- `@babylonjs/loaders` — GLB loading
- `@babylonjs/materials` — SkyMaterial
- `reactylon` — React ↔ BabylonJS bridge
- `babel-plugin-reactylon` — Babel transformer

### New Dependencies
- `three` — Three.js core
- `@react-three/fiber` — React reconciler for Three.js
- `@react-three/drei` — Utility components (Sky, Environment, OrbitControls, useGLTF, Billboard, Text, etc.)
- `@react-three/xr` — WebXR integration
- `three-quarks` — Particle system (snow, rain, fire, smoke, explosions)
- `react-native-audio-api` (Software Mansion) — Cross-platform Web Audio API (replaces BabylonJS Sound)
- `react-native-webgpu` — WebGPU backend for native mobile (future)

### What Stays Unchanged
- `src/engine/*` — All game logic (GameState, SimTick, BuildActions, etc.)
- `src/ecs/*` — ECS world, archetypes, components
- `src/bridge/*` — GameInit, ECSBridge, BuildingPlacement
- `src/game/*` — Pravda, settlements, achievements, minigames, era, scoring
- `src/hooks/useGameState.ts` — useSyncExternalStore bridge
- `src/hooks/useECSGameLoop.ts` — Game loop
- `src/stores/*` — Zustand-like stores
- `src/db/*` — SQLite persistence
- `src/ui/*` — **All 46 React Native overlay components** (TopBar, Toolbar, panels, modals, menus)
- `assets/models/soviet/*.glb` — All 55 GLB models (Three.js reads GLB natively)
- `assets/audio/music/*.ogg` — All 52 music tracks
- `assets/hdri/*.hdr` — HDRI environment maps (drei `<Environment>` reads .hdr)
- `assets/textures/**` — PBR textures (Three.js reads JPG natively)

## Component Migration Map

Each BabylonJS scene component becomes an R3F component. The pattern changes from "return null + useEffect imperatives" to "return JSX scene graph."

### 1. App.web.tsx — Root Mount

**Before (BabylonJS):**
```tsx
import { Engine } from 'reactylon/web';
import { Scene } from 'reactylon';

<Engine forceWebGL>
  <Scene>
    <Content />
  </Scene>
</Engine>
```

**After (R3F):**
```tsx
import { Canvas } from '@react-three/fiber';
import { XR } from '@react-three/xr';

<Canvas shadows camera={{ position: [30, 40, 30], fov: 45 }}>
  <XR>
    <Content />
  </XR>
</Canvas>
```

No CSS injection needed — R3F Canvas auto-sizes. `forceWebGL` no longer required (drei Sky has GLSL shaders that work with both WebGL and WebGPU). XR wrapper enables WebXR when available.

### 2. Environment.tsx — Sky + IBL + Ground

**Before:** SkyMaterial + HDRCubeTexture + PBRMaterial ground + sphere hills
**After:**
```tsx
import { Sky, Environment as DreiEnv } from '@react-three/drei';

<Sky turbidity={20} rayleigh={1} inclination={0.42} azimuth={0.25} />
<DreiEnv files={hdriUrl} />
<mesh position={[center, GROUND_Y, center]} receiveShadow>
  <planeGeometry args={[400, 400]} />
  <meshStandardMaterial map={albedo} normalMap={normal} roughnessMap={rough} />
</mesh>
```

drei `<Sky>` uses the same Preetham model as BabylonJS SkyMaterial. `<Environment>` handles HDRI IBL loading. PBRMaterial → `meshStandardMaterial` (Three.js PBR).

### 3. Lighting.tsx — Sun + Ambient + Shadows + Fog

**Before:** DirectionalLight + HemisphericLight + ShadowGenerator + scene.fogMode
**After:**
```tsx
<directionalLight
  position={[20, 30, 10]}
  intensity={sunIntensity}
  castShadow
  shadow-mapSize={[2048, 2048]}
/>
<hemisphereLight
  skyColor={skyColor}
  groundColor={groundColor}
  intensity={ambientIntensity}
/>
<fog attach="fog" args={[fogColor, fogNear, fogFar]} />
```

Three.js DirectionalLight has built-in shadow maps. No separate ShadowGenerator needed.

### 4. CameraController.tsx — Pan/Zoom/Tilt

**Before:** ArcRotateCamera + manual keyboard/pointer handlers
**After:**
```tsx
import { MapControls } from '@react-three/drei';

<MapControls
  minDistance={10}
  maxDistance={80}
  maxPolarAngle={Math.PI / 2.5}
  enableDamping
/>
```

MapControls (drei wrapper around Three.js MapControls) provides pan/zoom/tilt matching our current ArcRotateCamera behavior. Keyboard WASD and mouse drag work by default.

### 5. TerrainGrid.tsx — 30x30 Merged Mesh + Vertex Colors

**Before:** MeshBuilder.CreateGround + VertexData + vertex colors
**After:**
```tsx
const geometry = useMemo(() => {
  const geo = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE, GRID_SIZE, GRID_SIZE);
  geo.rotateX(-Math.PI / 2);
  // Set vertex colors per cell based on terrain type + season
  const colors = new Float32Array(geo.attributes.position.count * 3);
  // ... fill colors
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}, [grid, season]);

<mesh geometry={geometry} receiveShadow>
  <meshStandardMaterial vertexColors />
</mesh>
```

Same approach — procedural geometry with vertex colors. Three.js PlaneGeometry with manual vertex color assignment.

### 6. BuildingRenderer.tsx — GLB Clones

**Before:** ImportMeshAsync + TransformNode.clone() + material tinting
**After:**
```tsx
import { useGLTF, Clone } from '@react-three/drei';

function Building({ defId, x, y, level }) {
  const model = useGLTF(getModelUrl(defId));
  return (
    <Clone
      object={model.scene}
      position={[x, 0, y]}
      scale={getScale(defId)}
    />
  );
}
```

drei `useGLTF` auto-caches. `Clone` deep-clones geometry + materials. No manual preload/dispose cycle needed — React handles lifecycle.

### 7. ModelCache.ts → Preloading

**Before:** Custom preload loop with ImportMeshAsync + template storage
**After:**
```tsx
import { useGLTF } from '@react-three/drei';

// Preload all models at startup
MODEL_URLS.forEach(url => useGLTF.preload(url));
```

drei's `useGLTF.preload()` handles async loading with caching. Progress tracking via Three.js `LoadingManager`.

### 8. WeatherFX.tsx — Snow/Rain/Storm Particles

**Before:** BabylonJS ParticleSystem with custom emitters
**After:**
```tsx
import { BatchedParticleRenderer, QuarksLoader } from 'three-quarks';

// three-quarks provides GPU-instanced particles
// Snow: downward velocity, small white quads, wind offset
// Rain: fast downward, blue streaks
// Storm: heavy rain + wind particles
```

three-quarks gives us GPU-instanced particles with billboarding, color-over-life, size-over-life — matching BabylonJS ParticleSystem capabilities.

### 9. FireRenderer.tsx — Building Fires

**Before:** BabylonJS ParticleSystem + PointLight per fire
**After:**
```tsx
function Fire({ position }) {
  return (
    <group position={position}>
      <pointLight color="#ff6622" intensity={2} distance={5} />
      {/* three-quarks emitter for flame particles */}
    </group>
  );
}
```

### 10. SceneProps.tsx — Environmental Scatter (Rocks, Bushes, Animals)

**Before:** ImportMeshAsync + manual clone loop + wandering animation via onBeforeRenderObservable
**After:**
```tsx
import { useGLTF, Instances } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';

// drei Instances for GPU-instanced props (rocks, bushes, grass)
// useFrame for animal wandering animation (replaces registerBeforeRender)
```

drei `<Instances>` for batched rendering. `useFrame` for per-frame animation (direct equivalent of BabylonJS `onBeforeRenderObservable`).

### 11-20. Remaining Scene Components

| Component | BabylonJS Pattern | R3F Pattern |
|-----------|-------------------|-------------|
| **SmogOverlay** | Thin instances + Matrix | drei `<Instances>` |
| **AuraRenderer** | CreateTorus + spotlight cone | `<mesh><torusGeometry />` + `<spotLight>` |
| **LightningRenderer** | LinesMesh + white flash | `<Line>` from drei + screen flash |
| **TrainRenderer** | MeshBuilder + ParticleSystem smoke | useGLTF + three-quarks smoke |
| **VehicleRenderer** | Thin instances + Matrix | drei `<Instances>` |
| **ZeppelinRenderer** | MeshBuilder + ParticleSystem | useGLTF + three-quarks |
| **MeteorRenderer** | MeshBuilder + ParticleSystem + camera shake | Procedural mesh + three-quarks + camera shake via useFrame |
| **FloatingText** | DynamicTexture + CreatePlane | drei `<Billboard><Text>` |
| **GhostPreview** | CreateBox + PointerEventTypes | `<mesh>` + R3F `onPointerMove` |
| **LensSystem** | Overlay meshes | Shader material overlays or post-processing |
| **HeatingOverlay** | PointLight + ParticleSystem | `<pointLight>` + three-quarks |
| **PoliticalEntityRenderer** | ActionManager + procedural capsule | `<mesh onClick>` + CapsuleGeometry |
| **TierTinting** | Material color lerp per render | useFrame + material.color.lerp |

## Audio Migration

**Before:** BabylonJS `Sound` class
**After:** `react-native-audio-api` (Software Mansion)

```tsx
// Web Audio API spec — works on web, iOS, Android
import { AudioContext } from 'react-native-audio-api';

const ctx = new AudioContext();
// Load OGG via fetch → decodeAudioData → AudioBufferSourceNode
```

This library implements the full Web Audio API spec across all platforms. Crossfading, volume control, and playlist management stay in AudioManager — only the playback backend changes from `new Sound()` to Web Audio API nodes.

SFXManager similarly migrates — instead of BabylonJS Sound for one-shot effects, use short AudioBuffer playback.

## UI Layer Strategy

**All 46 React Native overlay components stay as-is.** They have zero BabylonJS dependency.

The current architecture — absolute-positioned React Native views on top of a full-screen 3D canvas — works identically with R3F's `<Canvas>`. The `pointerEvents="box-none"` pass-through pattern is unchanged.

```
┌──────────────────────────────┐
│ React Native UI Overlays     │  ← TopBar, Toolbar, Panels, Modals (z-index: 1+)
│ (pointerEvents="box-none")   │
├──────────────────────────────┤
│ R3F <Canvas>                 │  ← 3D scene (z-index: 0)
│   <Sky /><Environment />     │
│   <TerrainGrid />            │
│   <BuildingRenderer />       │
│   <WeatherFX />              │
│   ...19 more components      │
└──────────────────────────────┘
```

For in-scene text (floating labels, building names), we use drei `<Billboard>` + `<Text>` instead of DynamicTexture planes. These render as 3D objects in the scene, not DOM overlays, so they work on all platforms.

## WebXR / AR Strategy

### Phase 1 (This Migration)
- `@react-three/xr` wraps the scene — WebXR is opt-in when a headset is connected
- AR mode works on Android Chrome (WebXR AR module)
- Desktop/mobile web: standard mouse/touch controls
- Quest browser: immersive VR mode automatically

### Phase 2 (Future)
- Native iOS AR via ViroReact (separate scene bridge, not R3F)
- Native Android AR via ViroReact or ARCore web fallback

The `<XR>` wrapper from @react-three/xr is zero-cost when no headset is present — it simply renders the regular scene. When an XR session is available, it provides controller inputs and head tracking.

## File Changes Summary

### Files to DELETE (24 files)
- `src/scene/ModelCache.ts` — replaced by drei useGLTF.preload
- All 20 scene components rewritten (old versions deleted, new versions created)
- `src/audio/AudioManager.ts` — rewritten for react-native-audio-api
- `src/audio/SFXManager.ts` — rewritten for react-native-audio-api
- `babel-plugin-reactylon` config from babel.config.js

### Files to CREATE (22 files)
- `src/scene/` — 20 new R3F scene components (same names, new implementations)
- `src/scene/ModelPreloader.tsx` — drei-based GLB preloader with progress
- `src/audio/AudioManager.ts` — Web Audio API backend

### Files to MODIFY (3 files)
- `App.web.tsx` — Replace `<Engine><Scene>` with `<Canvas><XR>`
- `Content.tsx` — Update imports, remove BabylonJS preload logic
- `package.json` — Swap dependencies

### Files UNCHANGED (100+ files)
- All `src/engine/*`, `src/ecs/*`, `src/bridge/*`, `src/game/*`
- All `src/ui/*` (46 components)
- All `src/hooks/*`, `src/stores/*`, `src/db/*`
- All assets (GLB, OGG, HDR, textures)
- CI/CD workflows, app.json, tsconfig.json

## Migration Order

1. **Infrastructure** — Swap dependencies, update App.web.tsx mount point, configure Canvas
2. **Core Scene** — Environment (Sky + IBL + Ground), Lighting, CameraController
3. **Terrain** — TerrainGrid (vertex-colored plane geometry)
4. **Buildings** — ModelPreloader + BuildingRenderer (useGLTF + Clone)
5. **Props** — SceneProps (instanced scatter)
6. **VFX** — WeatherFX, FireRenderer, SmogOverlay, AuraRenderer, HeatingOverlay
7. **Animation** — TrainRenderer, VehicleRenderer, ZeppelinRenderer, MeteorRenderer
8. **Interaction** — GhostPreview, LensSystem, PoliticalEntityRenderer
9. **Text** — FloatingText (Billboard + Text)
10. **Effects** — LightningRenderer
11. **Audio** — AudioManager + SFXManager migration
12. **XR** — WebXR integration testing

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| react-native-webgpu patch instability | Web-first development; native mobile as stretch goal |
| three-quarks particle quality | Fallback to drei/Sparkles or custom shaders |
| GLB loading differences | Same format — Three.js GLTFLoader reads identical files |
| Performance regression | drei Instances for batching; React.memo for scene components |
| WebXR browser support gaps | Progressive enhancement — XR is optional overlay |
