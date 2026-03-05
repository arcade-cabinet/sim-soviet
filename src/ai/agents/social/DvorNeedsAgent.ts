import { Vehicle } from 'yuka';
import { dvory, getResourceEntity, housing } from '../../../ecs/archetypes';
import { world } from '../../../ecs/world';
import type { DvorComponent } from '../../../ecs/world';
import { TICKS_PER_MONTH } from '../../../game/Chronology';
import { getLocationResources } from '../../../game/engine/locationResources';

export type DvorPrimaryNeed = 'shelter' | 'warmth' | 'food' | 'quota' | 'survival';

export interface DvorNeedsState {
  unhousedCount: number;
  starvingCount: number;
  freezingCount: number;
  idleCount: number;
}

/**
 * DvorNeedsAgent — The beating heart of the "Stagnant Solidarity" loop.
 * 
 * Instead of a global omniscient system detecting shortages, each Dvor (household)
 * evaluates its own Maslow's Hierarchy of Needs. 
 * 
 * Hierarchy of Needs:
 * 1. Shelter: If they have no home, their primary impulse is to seek or build one.
 * 2. Warmth: If they are housed but the environment is hostile/cold, they need heat/power.
 * 3. Food: If they are starving, they will seek food (forage, or demand farms).
 * 4. Quota (Production): If basic needs are met, their impulse is to fulfill the State's quota.
 * 
 * If their needs are unmet for too long, loyalty drops, reports are doctored, and the
 * simulation self-corrects through attrition (death) rather than a "Game Over".
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

  public updateNeeds(currentTick: number, celestialBody: string): void {
    // Evaluate needs once per day (or a reasonable interval) to avoid heavy computation every tick
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

    // We can evaluate housing by checking the global housing capacity vs population for now,
    // or eventually map exact dvory to exact houses.
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

      // 1. Shelter
      if (housedAssigned + size > totalHousingCapacity) {
        primaryNeed = 'shelter';
        unhoused += size;
      } else {
        housedAssigned += size;
      }

      // 2. Warmth / Environment Survival
      // If the planet is unbreathable or freezing and they aren't properly sheltered/powered
      if (primaryNeed !== 'shelter' && (!loc.atmosphereBreathable || loc.temperatureRange[0] < -10)) {
        // Assume for now that if they are housed, we need to check if the house has power/heat
        // This is a simplified check: if power is short globally, they are freezing
        if (storeRef.resources.power !== undefined && storeRef.resources.power < 0) {
           primaryNeed = 'warmth';
           freezing += size;
        }
      }

      // 3. Food
      if (primaryNeed === 'quota' && foodAvailable < dvory.entities.length * 2) {
        primaryNeed = 'food';
        starving += size;
      }

      // 4. Quota (Default)
      if (primaryNeed === 'quota') {
        idle += size;
      }

      // We could store the primary need on the DvorComponent itself if we expand the ECS schema,
      // but for now we aggregate it to drive the CollectiveAgent.
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
