/**
 * @module game/relocation/Settlement
 *
 * Settlement type for the multi-settlement mechanic.
 *
 * Each settlement has its own grid, terrain profile, pressure state,
 * and population. The player switches viewport between settlements.
 * Resources can transfer between settlements with logistics cost
 * proportional to distance.
 *
 * Moscow's quotas span ALL settlements — meeting quota from
 * Settlement A doesn't exempt Settlement B.
 */

import type { TerrainProfile } from '../../ai/agents/core/worldBranches';
import type { PressureStateSaveData } from '../../ai/agents/crisis/pressure/PressureDomains';

// ─── Celestial Body ─────────────────────────────────────────────────────────

export type CelestialBody = 'earth' | 'moon' | 'mars' | 'titan' | 'exoplanet';

// ─── Settlement ─────────────────────────────────────────────────────────────

export interface Settlement {
  /** Unique settlement identifier. */
  id: string;
  /** Human-readable settlement name. */
  name: string;
  /** Grid size (diameter). Starts small, expands via land grants. */
  gridSize: number;
  /** Terrain profile defining environmental parameters. */
  terrain: TerrainProfile;
  /** Current population. */
  population: number;
  /** Distance from primary settlement (affects transfer logistics). */
  distance: number;
  /** Which celestial body this settlement is on. */
  celestialBody: CelestialBody;
  /** Year the settlement was established. */
  foundedYear: number;
  /** Whether this is the player's currently viewed settlement. */
  isActive: boolean;
}

// ─── Save Data ──────────────────────────────────────────────────────────────

export interface SettlementSaveData {
  id: string;
  name: string;
  gridSize: number;
  terrain: TerrainProfile;
  population: number;
  distance: number;
  celestialBody: CelestialBody;
  foundedYear: number;
  isActive: boolean;
  /** Pressure state snapshot for this settlement. */
  pressureState?: PressureStateSaveData;
}

// ─── Settlement Registry ────────────────────────────────────────────────────

/**
 * Manages the collection of settlements the player oversees.
 * The primary settlement (index 0) is always the original one.
 */
export class SettlementRegistry {
  private settlements: Settlement[] = [];

  /** Create the primary settlement. */
  createPrimary(name: string, gridSize: number, foundedYear: number): Settlement {
    const settlement: Settlement = {
      id: 'primary',
      name,
      gridSize,
      terrain: {
        gravity: 1.0,
        atmosphere: 'breathable',
        water: 'rivers',
        farming: 'soil',
        construction: 'standard',
        baseSurvivalCost: 'low',
      },
      population: 0,
      distance: 0,
      celestialBody: 'earth',
      foundedYear,
      isActive: true,
    };
    this.settlements = [settlement];
    return settlement;
  }

  /**
   * Add a new settlement (from relocation event or cold branch).
   *
   * @param name - Settlement name
   * @param terrain - Terrain profile for the new location
   * @param celestialBody - Which body it's on
   * @param distance - Distance from primary settlement
   * @param foundedYear - Year of establishment
   * @returns The new settlement
   */
  addSettlement(
    name: string,
    terrain: TerrainProfile,
    celestialBody: CelestialBody,
    distance: number,
    foundedYear: number,
  ): Settlement {
    const id = `settlement-${this.settlements.length}`;
    const settlement: Settlement = {
      id,
      name,
      gridSize: 11, // start small
      terrain,
      population: 0,
      distance,
      celestialBody,
      foundedYear,
      isActive: false,
    };
    this.settlements.push(settlement);
    return settlement;
  }

  /** Get all settlements. */
  getAll(): readonly Settlement[] {
    return this.settlements;
  }

  /** Get the currently active (viewed) settlement. */
  getActive(): Settlement | undefined {
    return this.settlements.find((s) => s.isActive);
  }

  /** Get a settlement by ID. */
  getById(id: string): Settlement | undefined {
    return this.settlements.find((s) => s.id === id);
  }

  /** Switch viewport to a different settlement. */
  switchTo(id: string): boolean {
    const target = this.settlements.find((s) => s.id === id);
    if (!target) return false;
    for (const s of this.settlements) s.isActive = false;
    target.isActive = true;
    return true;
  }

  /** Get count of settlements. */
  count(): number {
    return this.settlements.length;
  }

  /** Update population for a settlement. */
  updatePopulation(id: string, population: number): void {
    const s = this.settlements.find((s) => s.id === id);
    if (s) s.population = population;
  }

  // ── Serialization ──────────────────────────────────────────────────────────

  serialize(): SettlementSaveData[] {
    return this.settlements.map((s) => ({
      id: s.id,
      name: s.name,
      gridSize: s.gridSize,
      terrain: { ...s.terrain },
      population: s.population,
      distance: s.distance,
      celestialBody: s.celestialBody,
      foundedYear: s.foundedYear,
      isActive: s.isActive,
    }));
  }

  restore(data: SettlementSaveData[]): void {
    this.settlements = data.map((d) => ({
      id: d.id,
      name: d.name,
      gridSize: d.gridSize,
      terrain: { ...d.terrain },
      population: d.population,
      distance: d.distance,
      celestialBody: d.celestialBody,
      foundedYear: d.foundedYear,
      isActive: d.isActive,
    }));
  }
}
