/**
 * @module game/map/MapSystem
 *
 * Manages the procedurally generated terrain grid.
 *
 * Provides terrain queries, buildability checks, forest clearing, bridge
 * building, and serialization for save/load.
 */

import {
  clearTerrainFeatures,
  createForest,
  createMarsh,
  createMountain,
  createRiver,
} from '@/ecs/factories';
import { GameRng } from '../SeedSystem';
import { assignFeatures, checkConnectivity, fractalNoise } from './generation';
import { generateRiverPath, rasterizeRiver } from './rivers';
import type {
  MapGenerationOptions,
  SerializedCell,
  SerializedMap,
  TerrainCell,
  TerrainType,
} from './types';
import { DEFAULT_MAP_OPTIONS, MAP_SIZES, TERRAIN_DEFAULTS } from './types';

export class MapSystem {
  private terrain: TerrainCell[][] = [];
  private size: number;
  private rng: GameRng;
  private options: MapGenerationOptions;

  constructor(options: Partial<MapGenerationOptions> = {}) {
    this.options = { ...DEFAULT_MAP_OPTIONS, ...options };
    this.size = MAP_SIZES[this.options.size];
    this.rng = new GameRng(`map-${this.options.seed}`);
    this.initEmptyGrid();
  }

  /** Get the grid dimension. */
  getSize(): number {
    return this.size;
  }

  /** Get the generation options used for this map. */
  getOptions(): Readonly<MapGenerationOptions> {
    return this.options;
  }

  // ── Grid Initialization ─────────────────────────────────────────────────

  private initEmptyGrid(): void {
    this.terrain = [];
    for (let y = 0; y < this.size; y++) {
      const row: TerrainCell[] = [];
      for (let x = 0; x < this.size; x++) {
        row.push(this.createCell('grass'));
      }
      this.terrain.push(row);
    }
  }

  private createCell(type: TerrainType, features: string[] = []): TerrainCell {
    const defaults = TERRAIN_DEFAULTS[type];
    return {
      type,
      elevation: defaults.elevation,
      features,
      buildable: defaults.buildable,
      movementCost: defaults.movementCost,
      timberYield: type === 'forest' ? this.rng.int(5, 15) : undefined,
    };
  }

  private setCell(x: number, y: number, type: TerrainType): void {
    if (x < 0 || x >= this.size || y < 0 || y >= this.size) return;
    const features = assignFeatures(type, this.rng);
    this.terrain[y]![x] = this.createCell(type, features);
  }

  // ── Generation ──────────────────────────────────────────────────────────

  /**
   * Generate the terrain map procedurally.
   *
   * Order of operations:
   * 1. Rivers (carved first so other terrain respects them)
   * 2. Mountains (noise-based clusters, edge-biased away from center)
   * 3. Forests (noise + distance from center)
   * 4. Marshland (near rivers and low-elevation areas)
   * 5. Protect center 5x5 as guaranteed grass
   * 6. Connectivity validation (retry if paths are blocked)
   * 7. Create ECS entities for all terrain features
   */
  generate(): void {
    // Reset RNG for deterministic results
    this.rng = new GameRng(`map-${this.options.seed}`);
    this.initEmptyGrid();

    const maxRetries = 5;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      this.initEmptyGrid();
      this.placeRivers();
      this.placeMountains();
      this.placeForests();
      this.placeMarshland();
      this.protectCenter();

      if (checkConnectivity(this.terrain, this.size)) {
        this.createTerrainEntities();
        return;
      }

      // Failed connectivity — punch corridors and retry with adjusted RNG
      this.punchCorridors();
      this.protectCenter();

      if (checkConnectivity(this.terrain, this.size)) {
        this.createTerrainEntities();
        return;
      }
    }

    // Final fallback: clear all impassable terrain and re-place lightly
    this.initEmptyGrid();
    this.placeRivers();
    this.placeForests();
    this.protectCenter();
    this.createTerrainEntities();
  }

  /**
   * Create ECS entities for all terrain features in the grid.
   * Clears existing terrain feature entities first (for save/load or regeneration).
   */
  private createTerrainEntities(): void {
    clearTerrainFeatures();

    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const cell = this.terrain[y]![x]!;
        switch (cell.type) {
          case 'mountain':
            createMountain(x, y, cell.elevation);
            break;
          case 'forest':
            createForest(x, y);
            break;
          case 'marsh':
            createMarsh(x, y);
            break;
          case 'river':
            createRiver(x, y);
            break;
        }
      }
    }
  }

  private placeRivers(): void {
    const riverCells: Set<string>[] = [];

    for (let i = 0; i < this.options.riverCount; i++) {
      const path = generateRiverPath(this.size, this.rng);
      const cells = rasterizeRiver(path, this.size, this.rng);
      riverCells.push(cells);

      for (const key of cells) {
        const [x, y] = key.split(',').map(Number) as [number, number];
        this.setCell(x, y, 'river');
      }
    }

    // Store river cells for marshland placement
    this._riverCells = new Set(riverCells.flatMap((s) => [...s]));
  }

  /** Temporary storage for river cell positions, used during generation. */
  private _riverCells: Set<string> = new Set();

  private placeMountains(): void {
    if (this.options.mountainDensity <= 0) return;

    const noise = fractalNoise(this.size, this.size, this.rng);
    const center = this.size / 2;
    const targetCount = Math.floor(this.size * this.size * this.options.mountainDensity);

    // Score each grass cell: noise weighted by edge bias (mountains prefer periphery)
    const candidates: { x: number; y: number; score: number }[] = [];
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (this.terrain[y]![x]!.type !== 'grass') continue;
        const distFromCenter =
          Math.sqrt((x - center) ** 2 + (y - center) ** 2) / (center * Math.SQRT2);
        const edgeBias = 0.2 + 0.8 * distFromCenter;
        candidates.push({ x, y, score: noise[y]![x]! * edgeBias });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    const count = Math.min(targetCount, candidates.length);
    for (let i = 0; i < count; i++) {
      const { x, y } = candidates[i]!;
      this.setCell(x, y, 'mountain');
    }
  }

  private placeForests(): void {
    if (this.options.forestDensity <= 0) return;

    const noise = fractalNoise(this.size, this.size, this.rng);
    const center = this.size / 2;
    const targetCount = Math.floor(this.size * this.size * this.options.forestDensity);

    // Score each grass cell: noise weighted by distance from center (more forests at edges)
    const candidates: { x: number; y: number; score: number }[] = [];
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (this.terrain[y]![x]!.type !== 'grass') continue;
        const distFromCenter =
          Math.sqrt((x - center) ** 2 + (y - center) ** 2) / (center * Math.SQRT2);
        const edgeBias = 0.3 + 0.7 * distFromCenter;
        candidates.push({ x, y, score: noise[y]![x]! * edgeBias });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    const count = Math.min(targetCount, candidates.length);
    for (let i = 0; i < count; i++) {
      const { x, y } = candidates[i]!;
      this.setCell(x, y, 'forest');
    }
  }

  /** Compute noise threshold for marsh placement at a cell. */
  private marshThreshold(x: number, y: number): number {
    const riverBonus = this.isNearRiver(x, y, 3) ? 0.3 : 0;
    return 1 - this.options.marshDensity - riverBonus;
  }

  private placeMarshland(): void {
    if (this.options.marshDensity <= 0) return;

    const noise = fractalNoise(this.size, this.size, this.rng);
    const targetCount = Math.floor(this.size * this.size * this.options.marshDensity);
    let placed = 0;

    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (placed >= targetCount) return;
        if (this.terrain[y]![x]!.type !== 'grass') continue;
        if (noise[y]![x]! > this.marshThreshold(x, y)) {
          this.setCell(x, y, 'marsh');
          placed++;
        }
      }
    }
  }

  private isNearRiver(x: number, y: number, radius: number): boolean {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (this._riverCells.has(`${x + dx},${y + dy}`)) return true;
      }
    }
    return false;
  }

  /**
   * Protect the center 5x5 area — always grass, always buildable.
   */
  private protectCenter(): void {
    const center = Math.floor(this.size / 2);
    const radius = 2; // 5x5 = center +/- 2
    for (let y = center - radius; y <= center + radius; y++) {
      for (let x = center - radius; x <= center + radius; x++) {
        if (x >= 0 && x < this.size && y >= 0 && y < this.size) {
          this.setCell(x, y, 'grass');
        }
      }
    }
  }

  /**
   * Punch grass corridors from center to each edge to guarantee connectivity.
   */
  private punchCorridors(): void {
    const center = Math.floor(this.size / 2);

    // Corridor to top edge
    for (let y = 0; y < center; y++) {
      this.setCell(center, y, 'grass');
    }
    // Corridor to bottom edge
    for (let y = center; y < this.size; y++) {
      this.setCell(center, y, 'grass');
    }
    // Corridor to left edge
    for (let x = 0; x < center; x++) {
      this.setCell(x, center, 'grass');
    }
    // Corridor to right edge
    for (let x = center; x < this.size; x++) {
      this.setCell(x, center, 'grass');
    }
  }

  // ── Queries ─────────────────────────────────────────────────────────────

  /** Get the terrain cell at a grid position, or null if out of bounds. */
  getCell(x: number, y: number): TerrainCell | null {
    if (x < 0 || x >= this.size || y < 0 || y >= this.size) return null;
    return this.terrain[y]?.[x] ?? null;
  }

  /**
   * Check if a building with the given footprint can be placed at (x, y).
   *
   * All cells within the footprint must be buildable.
   */
  isBuildable(x: number, y: number, footprintX = 1, footprintY = 1): boolean {
    for (let dy = 0; dy < footprintY; dy++) {
      for (let dx = 0; dx < footprintX; dx++) {
        const cell = this.getCell(x + dx, y + dy);
        if (!cell || !cell.buildable) return false;
      }
    }
    return true;
  }

  /**
   * Clear forest at the given position, converting it to grass.
   *
   * @returns The timber yield from the cleared forest, or 0 if not a forest.
   */
  clearForest(x: number, y: number): number {
    const cell = this.getCell(x, y);
    if (!cell || cell.type !== 'forest') return 0;

    const timber = cell.timberYield ?? 0;
    this.setCell(x, y, 'grass');
    return timber;
  }

  /**
   * Build a bridge at a river position, making it passable.
   *
   * @returns true if the bridge was built, false if the cell is not a river.
   */
  buildBridge(x: number, y: number): boolean {
    const cell = this.getCell(x, y);
    if (!cell || cell.type !== 'river') return false;

    // Convert to road (bridged river)
    this.setCell(x, y, 'road');
    return true;
  }

  /** Get the movement cost at a grid position. Returns Infinity if out of bounds. */
  getMovementCost(x: number, y: number): number {
    const cell = this.getCell(x, y);
    if (!cell) return Infinity;
    return cell.movementCost;
  }

  /** Get all cell positions of a given terrain type. */
  getCellsOfType(type: TerrainType): { x: number; y: number }[] {
    const result: { x: number; y: number }[] = [];
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (this.terrain[y]![x]!.type === type) {
          result.push({ x, y });
        }
      }
    }
    return result;
  }

  // ── Serialization ───────────────────────────────────────────────────────

  /** Serialize the map to a plain object for save/load. */
  serialize(): SerializedMap {
    const cells: SerializedCell[][] = [];
    for (let y = 0; y < this.size; y++) {
      const row: SerializedCell[] = [];
      for (let x = 0; x < this.size; x++) {
        const cell = this.terrain[y]![x]!;
        const serialized: SerializedCell = {
          t: cell.type,
          e: cell.elevation,
          f: cell.features,
        };
        if (cell.timberYield !== undefined) {
          serialized.ty = cell.timberYield;
        }
        row.push(serialized);
      }
      cells.push(row);
    }

    return {
      version: 1,
      size: this.size,
      options: { ...this.options },
      cells,
    };
  }

  /** Deserialize a map from a plain object. */
  static deserialize(data: unknown): MapSystem {
    const d = data as SerializedMap;
    if (!d || d.version !== 1 || !Array.isArray(d.cells)) {
      throw new Error('Invalid map data: missing version or cells');
    }

    const map = new MapSystem(d.options);
    map.terrain = [];

    for (let y = 0; y < d.size; y++) {
      const row: TerrainCell[] = [];
      for (let x = 0; x < d.size; x++) {
        const sc = d.cells[y]![x]!;
        const defaults = TERRAIN_DEFAULTS[sc.t];
        row.push({
          type: sc.t,
          elevation: sc.e,
          features: sc.f,
          buildable: defaults.buildable,
          movementCost: defaults.movementCost,
          timberYield: sc.ty,
        });
      }
      map.terrain.push(row);
    }

    return map;
  }
}
