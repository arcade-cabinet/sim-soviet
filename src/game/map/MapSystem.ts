/**
 * @module game/map/MapSystem
 *
 * Manages the procedurally generated terrain grid.
 *
 * Provides terrain queries, buildability checks, forest clearing, bridge
 * building, and serialization for save/load.
 */

import { clearTerrainFeatures, createForest, createMarsh, createMountain, createRiver } from '@/ecs/factories';
import { GameRng } from '../SeedSystem';
import { ChunkManager } from './chunks/ChunkManager';
import type { MapGenerationOptions, SerializedCell, SerializedMap, TerrainCell, TerrainType } from './types';
import { DEFAULT_MAP_OPTIONS, MAP_SIZES, TERRAIN_DEFAULTS } from './types';

/**
 * Manages the procedurally generated terrain grid, providing terrain queries,
 * buildability checks, forest clearing, bridge building, and serialization.
 */
export class MapSystem {
  private terrain: TerrainCell[][] = [];
  private size: number;
  private rng: GameRng;
  private options: MapGenerationOptions;
  private chunkManager: ChunkManager;

  constructor(options: Partial<MapGenerationOptions> = {}) {
    this.options = { ...DEFAULT_MAP_OPTIONS, ...options };
    this.size = MAP_SIZES[this.options.size] ?? this.options.size; // support arbitrary sizes
    this.rng = new GameRng(`map-${this.options.seed}`);
    this.chunkManager = new ChunkManager(this.options.seed, this.options);
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
    this.terrain[y]![x] = this.createCell(type, []); // features not used dynamically here
  }

  // ── Generation ──────────────────────────────────────────────────────────

  /**
   * Generate the terrain map procedurally using the ChunkManager.
   * Ensures the global planet FBM matches the local terrain tiles.
   */
  generate(): void {
    this.terrain = this.chunkManager.assembleGrid(this.size);
    this.protectCenter(); // Guarantee start location is buildable
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
          case 'water': // ocean from planet config maps to water
          case 'river':
            createRiver(x, y);
            break;
        }
      }
    }
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
