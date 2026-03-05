import { GameRng } from '../../SeedSystem';
import type { PlanetConfig } from '../../../scene/celestial/planetGenerator';
import { sampleTerrainAtGridPos } from './terrainSampler';
import type { TerrainCell, TerrainType, MapGenerationOptions } from '../types';
import { TERRAIN_DEFAULTS } from '../types';
import { assignFeatures } from '../generation';

const CHUNK_SIZE = 10;

/**
 * Manages procedural terrain chunks that map to the global FBM planet generator.
 */
export class ChunkManager {
  private chunks: Map<string, TerrainCell[][]> = new Map();
  private planetConfig: PlanetConfig;
  private rng: GameRng;
  private options: MapGenerationOptions;

  constructor(seedString: string, options: MapGenerationOptions) {
    this.rng = new GameRng(`chunk-${seedString}`);
    this.options = options;
    
    // Hash string to number for planet generator
    let seedNum = 0;
    for (let i = 0; i < seedString.length; i++) {
      seedNum = (seedNum << 5) - seedNum + seedString.charCodeAt(i);
      seedNum |= 0;
    }

    // Adjust planet config based on MapSystem options (for testing backwards compatibility)
    this.planetConfig = {
      seed: seedNum,
      seaLevel: options.riverCount > 0 ? 0.4 : -1, // No rivers/water if 0
      mountainAmplitude: options.mountainDensity > 0 ? 1.0 : 0.0,
      noiseOctaves: 6,
      noiseScale: 1.5,
      continentBias: 0.3,
      craterDensity: 0.0,
    };
  }

  /**
   * Generates or retrieves a 10x10 chunk of terrain based on global coordinates.
   * @param cx Chunk X index
   * @param cy Chunk Y (Z in world) index
   */
  getChunk(cx: number, cy: number): TerrainCell[][] {
    const key = `${cx},${cy}`;
    if (this.chunks.has(key)) {
      return this.chunks.get(key)!;
    }

    const chunk: TerrainCell[][] = [];
    for (let y = 0; y < CHUNK_SIZE; y++) {
      const row: TerrainCell[] = [];
      const globalY = cy * CHUNK_SIZE + y;
      
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const globalX = cx * CHUNK_SIZE + x;
        let { terrain, elevation } = sampleTerrainAtGridPos(globalX, globalY, this.planetConfig);
        
        // Post-process terrain based on legacy MapGenerationOptions overrides
        if (terrain === 'mountain' && this.options.mountainDensity <= 0) terrain = 'grass';
        if (terrain === 'forest' && this.options.forestDensity <= 0) terrain = 'grass';
        if (terrain === 'marsh' && this.options.marshDensity <= 0) terrain = 'grass';
        // Map water back to river for legacy testing compat
        if (terrain === 'water') terrain = 'river';

        row.push(this.createCell(terrain, elevation));
      }
      chunk.push(row);
    }
    
    this.chunks.set(key, chunk);
    return chunk;
  }

  private createCell(type: TerrainType, overrideElevation?: number): TerrainCell {
    const defaults = TERRAIN_DEFAULTS[type];
    const features = assignFeatures(type, this.rng);
    return {
      type,
      elevation: overrideElevation ?? defaults.elevation,
      features,
      buildable: defaults.buildable,
      movementCost: defaults.movementCost,
      timberYield: type === 'forest' ? this.rng.int(5, 15) : undefined,
    };
  }

  /**
   * Assembles the chunks into a contiguous 2D grid array for the legacy MapSystem and 3D rendering.
   * @param gridCells Size of the grid (e.g. 20 for 20x20). Assumes grid spans from 0 to gridCells.
   */
  assembleGrid(gridCells: number): TerrainCell[][] {
    const fullGrid: TerrainCell[][] = [];
    const numChunks = Math.ceil(gridCells / CHUNK_SIZE);
    
    for (let y = 0; y < gridCells; y++) {
      fullGrid.push([]);
    }

    for (let cy = 0; cy < numChunks; cy++) {
      for (let cx = 0; cx < numChunks; cx++) {
        const chunk = this.getChunk(cx, cy);
        
        for (let y = 0; y < CHUNK_SIZE; y++) {
          const globalY = cy * CHUNK_SIZE + y;
          if (globalY >= gridCells) continue;
          
          for (let x = 0; x < CHUNK_SIZE; x++) {
            const globalX = cx * CHUNK_SIZE + x;
            if (globalX >= gridCells) continue;
            
            fullGrid[globalY][globalX] = chunk[y][x];
          }
        }
      }
    }
    
    return fullGrid;
  }
}
