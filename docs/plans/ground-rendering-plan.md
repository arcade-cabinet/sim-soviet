# Ground Rendering Plan: Textured Biome Terrain + Edge Masking

## Status: DESIGN v2 (awaiting approval)

---

## 1. Current State Analysis

### What exists today

- **GroundRenderer.ts**: Draws solid-color diamonds per season. Unused in practice -- `Canvas2DRenderer` paints a single `fillRect` for the whole viewport as Layer 0, then draws grid diamonds with `#2e2e2e`/`#333333` fills in Layer 1.
- **FeatureTileRenderer.ts**: Draws decorative terrain features (forests, mountains, rocks) as pre-baked hex sprites from `tiles/{season}/`. 46 tiles per season, ~15KB each, 3 seasons = ~2.1MB total on disk.
- **TerrainGenerator.ts**: Places features ONLY in a 3-cell-deep border ring. Interior is completely empty. This contradicts the GDD: "Terrain is NOT border-only. Mountains, rivers, and forests appear throughout the map."
- **Camera2D.ts**: Pan is unclamped (can scroll infinitely past map edges). Zoom goes to minZoom=0.3 (far too much -- exposes void). No pan bounds at all.
- **Grid**: 30x30 isometric tiles, TILE_WIDTH=80, TILE_HEIGHT=40. 2:1 dimetric.
- **Tile sprites**: 46 hex tiles per season (terrain, features, paths, rivers) already exist. The 5 base terrain tiles (grass, dirt, stone, sand, water) are 154x94px pre-baked at the correct projection but NOT used for ground rendering.
- **No edge masking**: Player can currently see the void outside the map. No concrete frame, no pan clamping.

### What the GDD requires (Section 8)

1. Textured ground tiles per biome type (not solid colors)
2. Terrain scattered **throughout** the map (mountains 10-15%, forests 15-20%, marshland 5-10%)
3. Concrete frame masking viewport edges (UI chrome, not game world)
4. Pan clamped to map bounds -- "can't scroll past edges"
5. Zoom clamped so "viewport never exceeds map bounds"
6. Dense border terrain (mountains + forest) as natural edge camouflage
7. Seasonal texture variation (winter=snow, rasputitsa=mud, summer=green)

---

## 2. Architecture Overview

This plan covers **four coupled systems** that must ship together:

```
A. Ground Tile Rendering   -- textured biome ground layer
B. Biome Map Generation     -- procedural biome assignment per cell
C. Camera Clamping          -- pan + zoom bounds enforcement
D. Concrete Frame           -- UI chrome edge masking
```

Plus the expanded terrain feature generation (interior terrain, marshland).

### Rendering layer changes

```
Layer -1: Concrete frame (DOM overlay, position:fixed, z-index above canvas)
          ┌────────────────────────────────┐
          │ TOP BAR (resources HUD)        │ ← existing React
          │▓▓┌────────────────────────┐▓▓│
          │▓▓│                        │▓▓│ ← 8-12px concrete
          │▓▓│  CANVAS VIEWPORT       │▓▓│    texture borders
          │▓▓│                        │▓▓│
          │▓▓└────────────────────────┘▓▓│
          │ BOTTOM STRIP                   │ ← existing React
          └────────────────────────────────┘

Layer 0:  Ground tiles (was: solid color fillRect)
          - Cached offscreen canvas with biome tile sprites
          - Single drawImage blit per frame

Layer 1:  Grid diamonds (unchanged -- semi-transparent outlines)

Layer 1.5: Terrain features (forests, mountains, rocks, marshes)
           NOW scattered throughout the entire map, not just border

Layer 2+: Buildings, hover, placement, day/night, particles (unchanged)
```

---

## 3. Texture Sourcing: Two-Phase Approach

### Phase 1 (this PR): Existing hex terrain sprites

The Blender pipeline already produces 5 base terrain tiles per season:
- `grass.png` (154x94), `dirt.png` (154x86), `stone.png` (154x94), `sand.png` (154x94), `water.png` (154x86)
- Rendered at the correct 2:1 dimetric projection with Soviet-themed colormaps
- Seasonal variants (winter/mud/summer) with desaturation + color shifts
- ~16KB each, already shipped in `tiles/{season}/`

These are used as ground tiles immediately. No new assets needed.

**Add marsh tile**: The GDD requires marshland. The Kenney Hexagon Kit does not include a marsh tile. Options:
- (a) Duplicate the `water.png` tile with a green-brown tint in the Blender pipeline (add `marsh` to TILE_CATEGORIES["terrain"])
- (b) Runtime tint: load `water.png`, draw with a `ctx.globalCompositeOperation = 'multiply'` green-brown overlay
- Recommended: Option (a) -- add to `render_hex_tiles.py` TILE_CATEGORIES. The Kenney "grass" hex prism model with a muddy brown colormap variant makes a convincing marsh.

### Phase 2 (follow-up PR): AmbientCG CC0 materials in Blender pipeline

Upgrade visual quality by replacing the Kenney colormap with AmbientCG PBR textures in the Blender pipeline:

| Biome | AmbientCG Material | ID |
|---|---|---|
| grass (summer) | Ground037 (grass) | Ground037_1K-PNG |
| grass (winter) | Snow004 (snow ground) | Snow004_1K-PNG |
| grass (mud) | Ground039 (wet grass) | Ground039_1K-PNG |
| dirt | Ground054 (dry earth) | Ground054_1K-PNG |
| stone | Rock030 (grey rock) | Rock030_1K-PNG |
| sand | Ground033 (sand) | Ground033_1K-PNG |
| water | (procedural in Blender) | N/A |
| marsh | Ground026 (muddy ground) | Ground026_1K-PNG |

Process:
1. Download 1K PBR textures from ambientcg.com (CC0, ~2MB each download, free)
2. Modify `render_hex_tiles.py` to load AmbientCG textures as materials instead of `create_soviet_colormap()`
3. Apply to hex prism geometry, render with existing lighting setup
4. Output replaces existing tile PNGs -- same filenames, same sizes, better visual quality
5. **Zero runtime code changes** -- the ground tile renderer draws the same sprite filenames

Why Phase 2 is separate: The Blender pipeline runs on a workstation with the Kenney Kit asset path. It's an asset pipeline change, not a runtime code change. The runtime architecture in Phase 1 is designed to accept any tile sprite -- upgrading textures is purely an asset swap.

---

## 4. Biome Map Generation

### BiomeType enum

```typescript
export type BiomeType = 'grass' | 'dirt' | 'stone' | 'sand' | 'water' | 'marsh';
```

Six biome types matching the GDD's terrain types. Each cell in the grid gets exactly one biome type.

### Noise-based procedural generation

#### Algorithm

1. **Generate two noise layers** from the seeded RNG:
   - `elevation[x][y]` -- high = mountains, low = valleys/water
   - `moisture[x][y]` -- high = wet (water, marsh, grass), low = dry (sand, dirt)

2. **Biome decision matrix** (Whittaker-lite):

   | | Low moisture | Mid moisture | High moisture |
   |---|---|---|---|
   | **High elevation** | stone | stone | stone |
   | **Mid-high elevation** | sand | dirt | grass |
   | **Mid elevation** | dirt | grass | grass |
   | **Mid-low elevation** | sand | dirt | marsh |
   | **Low elevation** | sand | marsh | water |

3. **Border ring override**: Cells within `BORDER_DEPTH` (3) of edge are forced to `stone`, ensuring dense mountain/rock border that masks the map edge naturally.

4. **Distribution targets** (for interior cells, matching GDD):
   - Flat/buildable (grass + dirt): ~55% of interior cells
   - Mountains (stone): ~12% of interior cells (clusters of 3-8 per GDD)
   - Forest (grass with feature overlays): ~18% of interior cells
   - Marshland (marsh): ~8% of interior cells
   - Water: ~7% of interior cells

5. **Clustering**: Low-frequency noise (scale ~8-10 cells per cycle) produces natural-looking biome clusters instead of scattered noise. Additional octave at scale ~4 adds smaller-scale variation.

6. **Mountain clustering**: Post-process stone cells: flood-fill to identify clusters. Cull isolated stone cells (< 3 connected). This ensures mountains appear in clusters of 3-8 as specified in the GDD.

#### Value noise implementation

Minimal seeded value noise, no external dependencies:

```typescript
// ~40 lines total
function hash2d(x: number, y: number, seed: number): number {
  // Simple integer hash, returns 0..1
  let h = seed + x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

function valueNoise2d(x: number, y: number, seed: number, scale: number): number {
  const sx = x / scale, sy = y / scale;
  const ix = Math.floor(sx), iy = Math.floor(sy);
  const fx = sx - ix, fy = sy - iy;
  // Smoothstep
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  // Bilinear interpolation of hashed corner values
  return lerp(
    lerp(hash2d(ix, iy, seed), hash2d(ix+1, iy, seed), u),
    lerp(hash2d(ix, iy+1, seed), hash2d(ix+1, iy+1, seed), u),
    v
  );
}
```

Two octaves of value noise (scale 8 + scale 4, weighted 0.7 + 0.3) for each of elevation and moisture. Total: ~60 lines.

#### Data structure

```typescript
// New file: src/game/BiomeMap.ts
export type BiomeType = 'grass' | 'dirt' | 'stone' | 'sand' | 'water' | 'marsh';

export interface BiomeMap {
  readonly cells: BiomeType[][];  // [y][x]
  readonly gridSize: number;
}

/** Buildability by biome type */
export const BIOME_BUILDABLE: Record<BiomeType, boolean> = {
  grass: true,
  dirt: true,
  sand: true,
  stone: false,   // mountains -- impassable per GDD
  water: false,    // rivers/lakes -- bridges only per GDD
  marsh: true,     // buildable but 1.5x construction cost per GDD
};

export function generateBiomeMap(gridSize: number, rng: GameRng): BiomeMap;
```

---

## 5. Interior Terrain Features

### Current problem
TerrainGenerator places features only in a 3-cell border ring. The GDD says: "Terrain is NOT border-only."

### Revised TerrainGenerator

The generator now works in two phases:

**Phase A: Border ring** (existing, retained)
- Cells within BORDER_DEPTH of edge get high-density terrain features
- Forced stone biome ensures mountains/rocks dominate the edge

**Phase B: Interior features** (new)
- Iterate all cells with `distFromEdge >= BORDER_DEPTH`
- Look up `biomeMap.cells[y][x]` to determine biome type
- Roll for feature placement based on biome:

| Biome | Feature candidates | Placement chance | Clearable? |
|---|---|---|---|
| grass | grass-forest, grass-hill | 20% | Yes (forests clearable) |
| dirt | dirt-lumber | 12% | Yes |
| stone | stone-hill, stone-mountain, stone-rocks | 30% | No (permanent obstacle) |
| sand | sand-desert, sand-rocks | 15% | No |
| water | water-island, water-rocks | 15% | No |
| marsh | (new: marsh tile or water-rocks tinted) | 10% | No |

**Mountain cluster enforcement**: After initial placement, scan for isolated stone features (no adjacent stone cell). Either connect them to a nearby cluster or remove them. This creates the "clusters of 3-8 tiles" pattern.

**River generation** (deferred to follow-up -- significant complexity):
The hex tile pipeline has 14 river variants + bridge. River generation requires a pathing algorithm (random walk from one map edge to another, avoiding mountains). Recommended as a separate PR after biome map is in place.

### Modified signature

```typescript
export function generateTerrain(
  gridSize: number,
  rng: GameRng,
  biomeMap: BiomeMap,
): TerrainFeature[];
```

---

## 6. Ground Tile Rendering

### Offscreen canvas cache

Drawing 900 sprite images per frame is ~900 `drawImage` calls. At 60fps on mobile this is unacceptable. Solution: **cache the entire ground layer to an offscreen canvas**, re-rendered only when:
- Season changes (~3 times per game year at most)
- A building is placed on a previously-empty cell (optional -- buildings overdraw ground anyway)

### GroundTileRenderer class

Replaces `GroundRenderer.ts`:

```typescript
export class GroundTileRenderer {
  private offscreen: HTMLCanvasElement;
  private offCtx: CanvasRenderingContext2D;
  private dirty = true;
  private season = 'winter';
  private biomeMap: BiomeMap | null = null;
  private tileImages = new Map<BiomeType, HTMLImageElement>();

  // Offscreen canvas origin in world-space
  private readonly originX: number;  // gridToScreen(0, GRID_SIZE-1).x - TILE_WIDTH/2
  private readonly originY: number;  // gridToScreen(0, 0).y

  constructor(gridSize: number);

  setBiomeMap(map: BiomeMap): void;
  setSeason(season: string): void;  // invalidates cache
  async preloadTiles(): Promise<void>;  // loads 6 biome tile images

  /** Called per frame. Blits cached ground to main context (world-space). */
  draw(ctx: CanvasRenderingContext2D): void;

  private rebuildCache(): void;  // re-renders all 900 tiles to offscreen
}
```

### Offscreen canvas dimensions

World-space bounding box of the 30x30 isometric grid:
```
Top-left tile (0,0):    screen = (0, 0)
Top-right tile (29,0):  screen = (1160, 580)
Bottom-left tile (0,29): screen = (-1160, 580)
Bottom-right tile (29,29): screen = (0, 1160)
```

Bounding box: X = [-1160, +1160], Y = [0, 1160]
With tile overhang padding (half tile in each direction):
- Width: 2320 + 80 = **2400px**
- Height: 1160 + 40 = **1200px**

The offscreen canvas stores these world-space pixels. The camera transform scales/translates when blitting to the viewport.

### Biome boundary blending

At biome boundaries, adjacent tiles of different types would create hard edges. To soften this:

**Approach: Semi-transparent neighbor overdraw**

For each cell at a biome boundary (where any neighbor has a different biome type):
1. Draw the cell's own biome tile at full opacity (normal)
2. For each different-biome neighbor, draw that neighbor's tile sprite at the current cell position with `globalAlpha = 0.15`
3. This creates a subtle blended fringe at biome transitions

Cost: ~200 extra `drawImage` calls during cache rebuild (only at boundary cells). Since the cache only rebuilds on season change, this has zero per-frame cost.

**Alternative (simpler, if blending isn't worth the complexity)**: Rely on the noise clustering to make biome transitions look natural. With scale-8 noise, biome zones are 6-10 tiles across, and the Soviet color palette is muted enough that adjacent different biomes don't look jarring.

### Draw flow

```
Per frame:
  1. If dirty flag set:
     a. Clear offscreen canvas
     b. For each (x, y) in 0..GRID_SIZE:
        - biome = biomeMap.cells[y][x]
        - tile = tileImages.get(biome)
        - screenPos = gridToScreen(x, y)
        - Draw tile at (screenPos.x - originX, screenPos.y - originY) on offscreen
     c. (Optional) Boundary blending pass
     d. Clear dirty flag

  2. ctx.drawImage(offscreen, originX, originY)
     // Camera transform is already applied by Canvas2DRenderer
```

Per-frame cost: **1 drawImage call** (the blit). Down from 900 fill operations.

---

## 7. Camera Clamping (Pan + Zoom)

### Current problem

`Camera2D.ts` has:
- `minZoom = 0.3` (way too far out -- exposes void around entire map)
- No pan bounds at all -- user can scroll infinitely past map edges
- GDD requires: "Zoom-out is clamped so the viewport never exceeds map bounds" and "Pan is clamped to map bounds"

### Zoom clamping

Calculate the minimum zoom level dynamically so the viewport never exceeds map bounds:

```typescript
/** Minimum zoom such that viewport fits within map world bounds. */
get computedMinZoom(): number {
  const mapWorldWidth = 2400;   // world-space width of grid bounding box
  const mapWorldHeight = 1200;  // world-space height
  const minZoomX = this.viewportWidth / mapWorldWidth;
  const minZoomY = this.viewportHeight / mapWorldHeight;
  return Math.max(minZoomX, minZoomY, 0.5);  // floor at 0.5 for usability
}
```

On a 390px-wide phone: `minZoom = max(390/2400, 844/1200, 0.5) = max(0.16, 0.70, 0.5) = 0.70`
On a 1920px desktop: `minZoom = max(1920/2400, 1080/1200, 0.5) = max(0.80, 0.90, 0.5) = 0.90`

This means on phone, max zoom-out shows ~560px of world width (7 tiles across). On desktop, slightly more. The concrete frame fills remaining screen edges.

Update `zoomAt()` to use `computedMinZoom` instead of the fixed `minZoom`:

```typescript
zoomAt(screenX: number, screenY: number, factor: number): void {
  const worldBefore = this.screenToWorld(screenX, screenY);
  const effectiveMin = Math.max(this.minZoom, this.computedMinZoom);
  this.zoom = Math.max(effectiveMin, Math.min(this.maxZoom, this.zoom * factor));
  // ... rest unchanged
}
```

### Pan clamping

After any pan operation, clamp the camera center so the viewport stays within world bounds:

```typescript
clampPan(): void {
  // Visible world-space half-extents at current zoom
  const halfW = (this.viewportWidth / 2) / this.zoom;
  const halfH = (this.viewportHeight / 2) / this.zoom;

  // World bounds (grid bounding box with padding)
  const worldMinX = -1200;  // left edge of grid
  const worldMaxX = 1200;
  const worldMinY = -20;
  const worldMaxY = 1200;

  // Clamp camera center so viewport edges don't exceed world bounds
  this.x = Math.max(worldMinX + halfW, Math.min(worldMaxX - halfW, this.x));
  this.y = Math.max(worldMinY + halfH, Math.min(worldMaxY - halfH, this.y));
}
```

Call `clampPan()` at the end of `pan()`, `zoomAt()`, and `centerOn()`.

### World bounds constants

Extract world bounds from grid geometry (computed once):

```typescript
// In Camera2D or GridMath
export function computeWorldBounds(gridSize: number): {
  minX: number; maxX: number; minY: number; maxY: number;
} {
  const topLeft = gridToScreen(0, gridSize - 1);    // leftmost point
  const topRight = gridToScreen(gridSize - 1, 0);   // rightmost point
  const top = gridToScreen(0, 0);                    // topmost point
  const bottom = gridToScreen(gridSize - 1, gridSize - 1); // bottommost point
  return {
    minX: topLeft.x - TILE_WIDTH / 2,
    maxX: topRight.x + TILE_WIDTH / 2,
    minY: top.y - TILE_HEIGHT / 2,
    maxY: bottom.y + TILE_HEIGHT,
  };
}
```

---

## 8. Concrete Frame (Edge Masking)

### GDD requirement

> "Left/right borders: thin (8-12px) brutalist concrete texture. Top: thicker, holds resource bar / era info. Bottom: worker assignment panel. The frame is part of the UI chrome, not the game world."

> "At maximum zoom-out, the concrete frame meets the map edge -- no floating plane visible."

### Implementation: CSS/DOM overlay (NOT canvas rendering)

The concrete frame is **UI chrome** per the GDD. It sits in the DOM, above the canvas, rendered by React. This keeps the canvas rendering pipeline clean and leverages CSS for the texture tiling.

```
DOM stack (z-index order):
  1. <canvas> — game world (bottom)
  2. <div class="concrete-frame"> — 4 positioned divs (L, R, T, B)
  3. <div class="game-hud"> — TopBar, BottomStrip, etc. (top)
```

### ConcreteFrame React component

```tsx
// src/components/ConcreteFrame.tsx
export function ConcreteFrame() {
  return (
    <div className="pointer-events-none fixed inset-0 z-10">
      {/* Left border */}
      <div className="absolute left-0 top-0 bottom-0 w-2 bg-repeat"
           style={{ backgroundImage: `url(${BASE_URL}textures/concrete.png)` }} />
      {/* Right border */}
      <div className="absolute right-0 top-0 bottom-0 w-2 bg-repeat"
           style={{ backgroundImage: `url(${BASE_URL}textures/concrete.png)` }} />
      {/* Top border (below TopBar) */}
      <div className="absolute left-0 right-0 top-[var(--topbar-h)] h-1 bg-repeat"
           style={{ backgroundImage: `url(${BASE_URL}textures/concrete.png)` }} />
      {/* Bottom border (above BottomStrip) */}
      <div className="absolute left-0 right-0 bottom-[var(--bottomstrip-h)] h-1 bg-repeat"
           style={{ backgroundImage: `url(${BASE_URL}textures/concrete.png)` }} />
    </div>
  );
}
```

### Concrete texture asset

- Single 64x64 tileable concrete texture (~5KB PNG)
- Soviet brutalist aesthetic: raw grey concrete with subtle aggregate texture
- Source: AmbientCG CC0 `Concrete034_1K` downsampled to 64x64, or hand-painted to match game style
- Stored at `app/public/textures/concrete.png`

### TopBar / BottomStrip already mask edges

The existing TopBar and BottomStrip React components already sit at the top and bottom of the screen. They naturally mask the top and bottom map edges. The concrete frame only needs thin (8px) left/right borders plus thin separators between the HUD panels and the game viewport.

### Why DOM and not canvas

1. The frame is static -- never changes per frame, never scrolls/zooms
2. CSS `background-repeat` handles texture tiling for free
3. `pointer-events: none` passes clicks through to the canvas
4. No canvas rendering budget consumed
5. Matches the existing React DOM overlay architecture (TopBar, Toolbar, etc.)

---

## 9. Seasonal Texture Variation

### Season-to-render mapping (existing, expanded)

The game has 7 seasons. The renderer maps them to 3 sprite seasons:

| Game Season | Render Season | Ground visual |
|---|---|---|
| WINTER | `winter` | Snow/ice tiles, frozen water, bare stone |
| RASPUTITSA_SPRING | `mud` | Brown mud tiles, swampy marshes |
| SHORT_SUMMER | `summer` | Green grass, blue water, growing forests |
| GOLDEN_WEEK | `summer` | Peak green, lush |
| STIFLING_HEAT | `summer` | Same summer tiles (could add "dry" variant later) |
| EARLY_FROST | `winter` | Returning to snow/ice |
| RASPUTITSA_AUTUMN | `mud` | Brown mud again |

When season changes:
1. `Canvas2DRenderer.setSeason()` propagates to `GroundTileRenderer.setSeason()`
2. Ground tile renderer reloads 6 biome tile images from `tiles/{newSeason}/`
3. Marks offscreen cache as dirty
4. Next frame: cache is rebuilt with new season sprites (~900 drawImage calls, once)
5. Feature tile renderer also reloads (existing behavior, unchanged)

### Per-season sprite budget

| Season | Tiles loaded | Size on disk | In-memory decoded |
|---|---|---|---|
| winter | 6 (grass, dirt, stone, sand, water, marsh) | ~96KB | ~340KB |
| mud | 6 | ~96KB | ~340KB |
| summer | 6 | ~96KB | ~340KB |
| **Active at any time** | **6** | **~96KB** | **~340KB** |

Only the current season's tiles are in memory. Previous season's tiles are evicted when `tileImages` is cleared on season change.

---

## 10. Performance Budget

### Memory

| Asset | Size | Notes |
|---|---|---|
| Ground offscreen canvas | ~11.5 MB | 2400x1200 @ 4 bytes/pixel RGBA |
| 6 biome tile sprites (decoded) | ~340 KB | 154x94 @ 4 bytes * 6 |
| Biome map data | ~3.6 KB | 30x30 Uint8Array |
| Concrete texture | ~5 KB | 64x64 CSS background (DOM, not canvas) |
| **Total new memory** | **~12 MB** | |

Context: Removing BabylonJS saved ~50MB of VRAM. This is well within budget.

### CPU per frame

| Operation | Before | After |
|---|---|---|
| Ground | 1 fillRect + 900 (drawDiamond + fill) | 1 drawImage (offscreen blit) |
| Grid lines | 900 (drawDiamond + stroke) | 900 (drawDiamond + stroke) [unchanged] |
| Feature tiles | ~100 drawImage (border only) | ~300 drawImage (interior + border) |
| Day/night | 1 fillRect | 1 fillRect [unchanged] |
| **Total draw calls** | **~1900** | **~1200** |

Net reduction: ~700 draw calls per frame. The ground layer goes from ~900 calls to 1.

### Cache rebuild cost (on season change)

- ~900 drawImage calls for ground tiles + ~200 for boundary blending = ~1100 calls
- Happens at most 3 times per game year (winter -> mud -> summer)
- Takes <16ms on modern hardware (1 frame stutter, if any)
- Could be spread across 2-3 frames if needed (progressive rebuild)

### Bundle size impact

| Change | Delta (gzipped) |
|---|---|
| BiomeMap.ts (noise + biome gen) | +~2 KB |
| GroundTileRenderer.ts | +~1.5 KB |
| ConcreteFrame.tsx | +~0.5 KB |
| Camera2D.ts (clamping logic) | +~0.3 KB |
| Removed GroundRenderer.ts | -0.3 KB |
| **Net JS bundle delta** | **+~4 KB** |
| concrete.png texture | +~5 KB |
| marsh tile sprites (3 seasons) | +~48 KB |
| **Net total asset delta** | **+~57 KB** |

---

## 11. File Changes Summary

### New files

| File | Purpose |
|---|---|
| `src/game/BiomeMap.ts` | BiomeType enum, value noise, biome map generation, buildability rules |
| `src/rendering/GroundTileRenderer.ts` | Offscreen-cached ground tile rendering with biome sprites |
| `src/components/ConcreteFrame.tsx` | DOM overlay for brutalist concrete edge masking |
| `app/public/textures/concrete.png` | 64x64 tileable concrete texture for frame |
| `src/__tests__/BiomeMap.test.ts` | Biome generation tests |
| `src/__tests__/GroundTileRenderer.test.ts` | Ground tile renderer tests |
| `src/__tests__/CameraClamp.test.ts` | Camera clamping tests |

### Modified files

| File | Changes |
|---|---|
| `src/rendering/Canvas2DRenderer.ts` | Remove fillRect ground. Instantiate GroundTileRenderer. Draw ground tiles as Layer 0. Remove GROUND_COLORS constant. |
| `src/rendering/Camera2D.ts` | Add `computedMinZoom`, `clampPan()`, `setWorldBounds()`. Call clamp after pan/zoom/centerOn. |
| `src/game/TerrainGenerator.ts` | Accept BiomeMap param. Add interior feature placement. Mountain cluster enforcement. |
| `src/components/GameWorld.tsx` | Generate BiomeMap at startup. Pass to TerrainGenerator + GroundTileRenderer. Wire season changes. |
| `src/components/App.tsx` | Add `<ConcreteFrame />` to DOM overlay stack. |
| `src/rendering/GridMath.ts` | Add `computeWorldBounds()` helper. |

### Deleted files

| File | Reason |
|---|---|
| `src/rendering/GroundRenderer.ts` | Replaced by GroundTileRenderer (was already unused by Canvas2DRenderer). |

### Blender pipeline (for marsh tile)

| File | Changes |
|---|---|
| `scripts/render_hex_tiles.py` | Add `marsh` to TILE_CATEGORIES["terrain"]. Add marsh colormap variant (brown-green tint of grass). |

---

## 12. Implementation Order

### Phase 1: Core systems (must ship together)

```
Step 1: BiomeMap.ts
        - Value noise implementation
        - Biome generation with Whittaker matrix
        - Border ring override
        - Mountain cluster enforcement
        - Unit tests (determinism, distribution, border override)

Step 2: GroundTileRenderer.ts
        - Offscreen canvas creation and sizing
        - Tile image loading from tiles/{season}/ manifest
        - Cache rebuild logic (dirty flag)
        - Single-blit draw method
        - Biome boundary blending (optional, can defer)
        - Unit tests (dirty flag, season swap)

Step 3: Camera2D clamping
        - computeWorldBounds() in GridMath
        - setWorldBounds() / computedMinZoom in Camera2D
        - clampPan() called after pan, zoomAt, centerOn
        - Unit tests (bounds enforcement, zoom limits)

Step 4: Canvas2DRenderer integration
        - Remove fillRect ground
        - Instantiate GroundTileRenderer
        - Draw as Layer 0 (before grid lines)
        - Pass season changes through

Step 5: ConcreteFrame.tsx
        - DOM overlay with concrete texture
        - Positioned around existing HUD panels
        - pointer-events: none
        - Add to App.tsx

Step 6: GameWorld.tsx wiring
        - Generate BiomeMap at startup from seed
        - Pass to TerrainGenerator and GroundTileRenderer
        - Propagate season changes to ground tiles
```

### Phase 2: Terrain expansion (can follow immediately or in same PR)

```
Step 7: TerrainGenerator expansion
        - Accept BiomeMap parameter
        - Interior feature placement based on biome type
        - Mountain cluster enforcement
        - Update tests

Step 8: Marsh tile in Blender pipeline
        - Add marsh to render_hex_tiles.py
        - Generate marsh tile sprites (3 seasons)
        - Update tiles manifest

Step 9: Cleanup
        - Delete GroundRenderer.ts
        - Remove GROUND_COLORS from Canvas2DRenderer
        - Update memory bank docs
```

### Deferred (separate PRs)

- River generation (14 river tile variants already exist, needs pathing algorithm)
- AmbientCG texture upgrade (Blender pipeline change, zero runtime changes)
- Variable map sizes (20x20, 50x50 -- BiomeMap already parameterized by gridSize)
- Tile variation (multiple sprites per biome type for visual variety)

---

## 13. Risks and Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Offscreen canvas too large on low-end mobile | Medium | Canvas is 2400x1200 = ~11.5MB. iOS Safari caps at ~16MP. If problematic, reduce to half-resolution and scale up (slightly blurry ground, still better than solid colors). |
| Season change causes visible frame stutter | Low | Cache rebuild is ~1100 drawImage on offscreen (not displayed). Modern devices handle this in <16ms. If slow, spread across 2-3 frames with progressive rebuild. |
| Biome noise looks artificial | Medium | Tuning required. The hash function and noise scale parameters may need iteration. Provide a debug overlay that visualizes the biome map (toggled with a dev key). |
| Concrete frame conflicts with existing HUD | Low | The frame is `pointer-events: none` and pure visual. HUD panels sit on top of it with higher z-index. Test on all device sizes. |
| Marsh tile looks wrong without dedicated Blender model | Medium | Phase 1 fallback: use `water.png` with a green-brown tint via `globalCompositeOperation`. Phase 2: proper Blender-rendered marsh tile. |
