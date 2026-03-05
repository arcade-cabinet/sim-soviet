import * as h3 from 'h3-js';
import { classifyBiome, sampleHeight, type PlanetConfig } from '../../../scene/celestial/planetGenerator';

/** 
 * Hierarchical resolutions for SimSoviet:
 * - RES_NATION: Large territories, continents, or countries (Res 1-2)
 * - RES_OBLAST: Regional administrative divisions (Res 4-5)
 * - RES_SETTLEMENT: Local player grid chunks (Res 8-9)
 */
export const RES_NATION = 1;
export const RES_OBLAST = 4;
export const RES_SETTLEMENT = 8;

export interface HexMetadata {
  index: string;
  height: number;
  biome: string;
  ownerId?: string; // e.g. 'ussr', 'nato', 'settlement-0'
  resources: {
    minerals: number;
    biomass: number; // Organic potential
    fuel: number;    // Peat, Methane, Helium-3, or Solar density
    oxygen: number;  // Atmospheric viability
  };
}

export type PlanetProfile = 'terran' | 'martian' | 'lunar' | 'dyson';

/**
 * GlobalHexManager — Manages the planetary hexagonal grid using Uber's H3.
 * Bridges the procedural FBM planet generator with political/territorial logic.
 */
export class GlobalHexManager {
  private planetConfig: PlanetConfig;
  private profile: PlanetProfile;
  private nationCapitals: Map<string, string> = new Map(); // h3Index -> nationId
  private ownedHexes: Map<string, string> = new Map(); // h3Index -> ownerId

  constructor(seedString: string, profile: PlanetProfile = 'terran') {
    this.profile = profile;
    // Generate deterministic numeric seed from string
    let seedNum = 0;
    for (let i = 0; i < seedString.length; i++) {
      seedNum = (seedNum << 5) - seedNum + seedString.charCodeAt(i);
      seedNum |= 0;
    }

    this.planetConfig = {
      seed: seedNum,
      seaLevel: profile === 'terran' ? 0.45 : -1,
      mountainAmplitude: profile === 'dyson' ? 0.1 : 1.0,
      noiseOctaves: 6,
      noiseScale: profile === 'dyson' ? 0.5 : 1.2,
      continentBias: profile === 'terran' ? 0.4 : 0.1,
      craterDensity: profile === 'lunar' ? 0.8 : profile === 'martian' ? 0.3 : 0.0,
    };

    this.initializeNations();
  }

  /** Initialize major world powers at Res 1. */
  private initializeNations(): void {
    const worldHexes = h3.getRes0Cells(); // 122 base cells
    
    // Pick a few base cells as "National Cores"
    const nationIds = ['ussr', 'nato', 'neutral_a', 'neutral_b'];
    
    // For now, just pick some arbitrary indices at Res 1
    const res1Hexes = worldHexes.flatMap(h => h3.cellToChildren(h, RES_NATION));
    
    // Simple deterministic pick based on seed
    for (let i = 0; i < nationIds.length; i++) {
      const idx = Math.abs((this.planetConfig.seed + i * 137) % res1Hexes.length);
      const hex = res1Hexes[idx]!;
      this.nationCapitals.set(hex, nationIds[i]!);
    }
  }

  /**
   * Get metadata for a specific H3 hex, including its sampled procedural properties.
   */
  public getHexMetadata(index: string): HexMetadata {
    if (!h3.isValidCell(index)) {
      return {
        index,
        height: 0,
        biome: 'void',
        resources: { minerals: 0, biomass: 0, fuel: 0, oxygen: 0 }
      };
    }

    const [lat, lng] = h3.cellToLatLng(index);
    
    // Convert Lat/Lng (degrees) to Unit Sphere [x, y, z]
    const rLat = (lat * Math.PI) / 180;
    const rLng = (lng * Math.PI) / 180;
    
    const x = Math.cos(rLat) * Math.cos(rLng);
    const y = Math.sin(rLat);
    const z = Math.cos(rLat) * Math.sin(rLng);

    const height = sampleHeight(x, y, z, this.planetConfig);
    const biome = classifyBiome(height, y, this.planetConfig.seaLevel, this.profile === 'dyson' ? 'terran' : this.profile);

    // Deterministic resource sampling based on hex index
    const h = this.hashString(index);
    
    const res = {
      minerals: 0,
      biomass: 0,
      fuel: 0,
      oxygen: 0
    };

    switch (this.profile) {
      case 'terran':
        res.minerals = biome === 'mountain' ? 0.7 + h * 0.3 : h * 0.2;
        res.biomass = biome === 'land' ? 0.6 + h * 0.4 : biome === 'shore' ? 0.3 : 0;
        res.fuel = (biome === 'ocean' || biome === 'shore') ? h * 0.5 : (h > 0.8 ? 0.6 : 0.1);
        res.oxygen = 1.0; // Breathable
        break;
      case 'lunar':
        res.minerals = 0.8 + h * 0.2; // High regolith
        res.biomass = 0; // Dead
        res.fuel = h > 0.9 ? 0.8 : 0.05; // Rare Helium-3 pockets
        res.oxygen = 0;
        break;
      case 'martian':
        res.minerals = 0.5 + h * 0.5;
        res.biomass = h > 0.95 ? 0.1 : 0; // Rare lichen/brine
        res.fuel = 0.4 + h * 0.4; // High methane potential
        res.oxygen = 0.1; // Thin
        break;
      case 'dyson':
        res.minerals = 0.1; // Artificial structure
        res.biomass = 0;
        res.fuel = 1.0; // Pure solar energy
        res.oxygen = 0; // Vacuum
        break;
    }

    return {
      index,
      height,
      biome,
      ownerId: this.getOwnerOfHex(index),
      resources: res
    };
  }

  /**
   * Get metadata for the neighbors of a hex.
   */
  public getNeighbors(index: string, radius: number = 1): HexMetadata[] {
    const neighbors = h3.gridDisk(index, radius);
    return neighbors.map(h => this.getHexMetadata(h));
  }

  /**
   * Determine who owns a hex based on proximity to Nation Capitals.
   */
  private getOwnerOfHex(index: string): string | undefined {
    // Check if explicitly assigned (e.g. player land grant)
    if (this.ownedHexes.has(index)) return this.ownedHexes.get(index);

    // Otherwise, find the nearest Nation Capital at the Nation resolution
    const nationParent = h3.cellToParent(index, RES_NATION);
    
    let bestDist = Infinity;
    let bestOwner: string | undefined = undefined;

    for (const [capHex, ownerId] of this.nationCapitals) {
      const dist = h3.gridDistance(nationParent, capHex);
      if (dist < bestDist) {
        bestDist = dist;
        bestOwner = ownerId;
      }
    }

    // Only "own" if within a reasonable diplomatic range
    return bestDist < 10 ? bestOwner : 'unclaimed';
  }

  /**
   * Issue a "Land Grant" to a settlement.
   */
  public issueLandGrant(centerHex: string, settlementId: string, radius: number = 0): void {
    const hexes = h3.gridDisk(centerHex, radius);
    for (const h of hexes) {
      this.ownedHexes.set(h, settlementId);
    }
  }

  /**
   * Returns all hexes owned by a specific entity.
   */
  public getTerritory(ownerId: string): string[] {
    const results: string[] = [];
    for (const [hex, owner] of this.ownedHexes) {
      if (owner === ownerId) results.push(hex);
    }
    return results;
  }

  private hashString(s: string): number {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      hash = (hash << 5) - hash + s.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash % 1000) / 1000;
  }
}
