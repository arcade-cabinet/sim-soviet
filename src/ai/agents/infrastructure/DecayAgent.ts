/**
 * @fileoverview DecayAgent — wraps the decaySystem function.
 *
 * Thin Yuka Vehicle wrapper that delegates to the existing
 * decaySystem() ECS function each tick.
 */

import { Vehicle } from 'yuka';
import { decaySystem } from './decaySystem';

/**
 * Wraps the decaySystem() function as a Yuka Vehicle agent.
 *
 * @example
 * const agent = new DecayAgent();
 * agent.tickDecay(1.0);
 */
export class DecayAgent extends Vehicle {
  constructor() {
    super();
    this.name = 'DecayAgent';
  }

  /**
   * Run building decay for one simulation tick.
   *
   * @param decayMultiplier - Multiplier on decay rate (higher = faster decay)
   */
  tickDecay(decayMultiplier: number): void {
    decaySystem(decayMultiplier);
  }
}
