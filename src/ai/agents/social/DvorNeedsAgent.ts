import { Vehicle } from 'yuka';
import { dvory, getResourceEntity, housing } from '../../../ecs/archetypes';
import { MSG, type NewTickPayload } from '../../telegrams';

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

    this.updateNeeds(currentTick);
  }

  /**
   * Evaluate the hierarchy of needs for all Dvory.
   * Grounded in the current historical settlement: housing, warmth, food, and quota pressure.
   */
  public updateNeeds(currentTick: number): void {
    if (currentTick - this.lastEvaluationTick < 10) return;
    this.lastEvaluationTick = currentTick;

    const storeRef = getResourceEntity();
    if (!storeRef) return;
    const foodAvailable = storeRef.resources.food;

    let unhoused = 0;
    let starving = 0;
    let freezing = 0;
    let idle = 0;

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

      // 2. Warmth / Environment Survival
      if (primaryNeed !== 'shelter' && storeRef.resources.power < -10) {
        primaryNeed = 'warmth';
        freezing += size;
      }

      // 3. Food (Famines self-correct imbalances)
      const starvationThreshold = dvory.entities.length * 2;
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
