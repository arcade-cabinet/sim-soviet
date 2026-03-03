/**
 * @fileoverview ConstructionAgent — wraps the constructionSystem function.
 *
 * Thin Yuka Vehicle wrapper that delegates to the existing
 * constructionSystem() ECS function each tick.
 */

import { Vehicle } from 'yuka';
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
