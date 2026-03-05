import { Vehicle } from 'yuka';
import { dvory, getResourceEntity, housing } from '../../../ecs/archetypes';
import { getLocationResources } from '../../../game/engine/locationResources';
import type { HexMetadata } from '../../../game/map/global/GlobalHexManager';
import { MSG, type NewTickPayload } from '../../telegrams';
import { getMetaEntity } from '../../../ecs/archetypes';

export type DvorPrimaryNeed = 'shelter' | 'warmth' | 'food' | 'quota' | 'survival';

export interface DvorNeedsState {
  unhousedCount: number;
  starvingCount: number;
  freezingCount: number;
  idleCount: number;
}

/**
 * DvorNeedsAgent — The beating heart of the "Stagnant Solidarity" loop.
 */
export class DvorNeedsAgent extends Vehicle {
  private lastEvaluationTick = 0;
  private state: DvorNeedsState = {
    unhousedCount: 0,
    starvingCount: 0,
    freezingCount: 0,
    idleCount: 0,
  };

  constructor() {
    super();
    this.name = 'DvorNeedsAgent';
  }

  /** Handle incoming Yuka telegrams. */
  handleMessage(telegram: any): boolean {
    if (telegram.message === MSG.NEW_TICK) {
      const payload = telegram.data as NewTickPayload;
      this.evaluateNeedsTick(payload.totalTicks);
      return true;
    }
    return false;
  }

  /** Triggered by NEW_TICK telegram */
  private evaluateNeedsTick(currentTick: number): void {
    if (currentTick - this.lastEvaluationTick < 10) return;
    
    // Get location metadata for scarcity scaling
    const meta = getMetaEntity()?.gameMeta;
    // We assume Earth for now if no meta, until the Engine passes this into ECS
    const celestialBody = meta?.currentEra === 'post_soviet' ? 'mars' : 'earth';
    
    let hexMeta: HexMetadata | undefined = undefined;
    // Try to retrieve hex meta globally
    const manager = (globalThis as any).simulationEngine?.getGlobalHexManager();
    if (manager && meta?.currentHex) {
      hexMeta = manager.getHexMetadata(meta.currentHex);
    }

    this.updateNeeds(currentTick, celestialBody, hexMeta);
  }

  /**
   * Evaluate the hierarchy of needs for all Dvory.
   * Influenced by the local biome and global resources of the assigned Hex.
   */
  public updateNeeds(currentTick: number, celestialBody: string, hexMeta?: HexMetadata): void {
    if (currentTick - this.lastEvaluationTick < 10) return;
    this.lastEvaluationTick = currentTick;

    const loc = getLocationResources(celestialBody);
    const storeRef = getResourceEntity();
    if (!storeRef) return;
    const foodAvailable = storeRef.resources.food;

    let unhoused = 0;
    let starving = 0;
    let freezing = 0;
    let idle = 0;

    // Environmental difficulty scales based on global hex resources
    // If biomass is scarce (0.1), food requirements are 10x stricter than Earth-normal (1.0).
    const biomassFactor = hexMeta ? Math.max(0.1, hexMeta.resources.biomass) : 1.0;
    // If fuel is scarce, freezing is more likely during power shortages.
    const fuelFactor = hexMeta ? Math.max(0.1, hexMeta.resources.fuel) : 1.0;

    let totalHousingCapacity = 0;
    for (const h of housing.entities) {
      totalHousingCapacity += h.building.housingCap || 0;
    }

    let housedAssigned = 0;

    for (const entity of dvory.entities) {
      const dvor = entity.dvor;
      const size = dvor.members.length;
      if (size === 0) continue;

      let primaryNeed: DvorPrimaryNeed = 'quota';

      // 1. Shelter (Eminent Domain might have bulldozed their home)
      if (housedAssigned + size > totalHousingCapacity) {
        primaryNeed = 'shelter';
        unhoused += size;
      } else {
        housedAssigned += size;
      }

      // 2. Warmth / Environment Survival (Freezing/Unbreathable)
      if (primaryNeed !== 'shelter' && (!loc.atmosphereBreathable || loc.temperatureRange[0] < -10)) {
        // Starving solidarity: if power is short and fuel is scarce, the cold is lethal.
        const freezeThreshold = -10 * fuelFactor;
        if (storeRef.resources.power !== undefined && storeRef.resources.power < freezeThreshold) {
           primaryNeed = 'warmth';
           freezing += size;
        }
      }

      // 3. Food (Famines self-correct imbalances)
      const starvationThreshold = dvory.entities.length * (2 / biomassFactor);
      if (primaryNeed === 'quota' && foodAvailable < starvationThreshold) {
        primaryNeed = 'food';
        starving += size;
      }

      // 4. Quota (Default)
      if (primaryNeed === 'quota') {
        idle += size;
      }
    }

    this.state = {
      unhousedCount: unhoused,
      starvingCount: starving,
      freezingCount: freezing,
      idleCount: idle,
    };
  }

  public getNeedsState(): DvorNeedsState {
    return this.state;
  }
}
