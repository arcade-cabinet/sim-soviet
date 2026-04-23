/**
 * @fileoverview ConstructionAgent — wraps the constructionSystem function.
 *
 * Thin Yuka Vehicle wrapper that delegates to the existing
 * constructionSystem() ECS function each tick.
 */

import { Vehicle } from 'yuka';
import { MSG } from '../../telegrams';
import { constructionSystem } from './constructionSystem';

/**
 * Wraps the constructionSystem() function as a Yuka Vehicle agent.
 *
 * @example
 * const agent = new ConstructionAgent();
 * agent.tickConstruction(1.0, 1.0, 1.0);
 */
export class ConstructionAgent extends Vehicle {
  constructor() {
    super();
    this.name = 'ConstructionAgent';
  }

  /** Handle incoming Yuka telegrams. */
  handleMessage(telegram: any): boolean {
    if (telegram.message === MSG.PHASE_PRODUCTION) {
      const engine = (globalThis as any).simulationEngine;
      if (engine?._lastTickCtx) {
        const ctx = engine._lastTickCtx;

        // Grab the transport result cached by TransportAgent which runs right before this
        const transportAgent = this.manager?.entities.find((e) => e.name === 'TransportAgent') as any;
        const transportMult = transportAgent?._lastTickResult?.seasonBuildMult ?? 1.0;

        this.tickConstruction(
          ctx.modifiers.eraMods.constructionTimeMult,
          ctx.modifiers.weatherProfile.constructionTimeMult,
          transportMult,
        );
      }
      return true;
    }
    return false;
  }

  /**
   * Advance all buildings under construction by one simulation tick.
   *
   * @param eraConstructionTimeMult - Era-specific construction time multiplier
   * @param weatherConstructionTimeMult - Weather-specific construction time multiplier
   * @param transportBuildMult - Seasonal build cost multiplier after road mitigation
   */
  tickConstruction(
    eraConstructionTimeMult: number,
    weatherConstructionTimeMult: number,
    transportBuildMult: number,
  ): void {
    constructionSystem(eraConstructionTimeMult, weatherConstructionTimeMult, transportBuildMult);
  }
}
