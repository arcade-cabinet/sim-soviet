/**
 * @fileoverview DecayAgent — wraps the decaySystem function.
 *
 * Thin Yuka Vehicle wrapper that delegates to the existing
 * decaySystem() ECS function each tick. Applies profile-based
 * modifiers for atmospheric decay rate and radiation exposure.
 */

import { Vehicle } from 'yuka';
import type { AgentParameterProfile } from '../../../game/engine/agentParameterMatrix';
import { decaySystem } from './decaySystem';

/**
 * Wraps the decaySystem() function as a Yuka Vehicle agent.
 *
 * @example
 * const agent = new DecayAgent();
 * agent.tickDecay(1.0);
 */
export class DecayAgent extends Vehicle {
  /** Active terrain profile — controls atmospheric decay rate and radiation bonus. */
  private profile: Readonly<AgentParameterProfile> | null = null;

  constructor() {
    super();
    this.name = 'DecayAgent';
  }

  /**
   * Set the active agent parameter profile.
   * Decay rate is multiplied by atmosphericDecayRate and boosted by radiationDecayBonus.
   */
  setProfile(profile: Readonly<AgentParameterProfile>): void {
    this.profile = profile;
  }

  /**
   * Run building decay for one simulation tick.
   * The base decayMultiplier is further modified by the active profile's
   * atmospheric decay rate and radiation bonus.
   *
   * @param decayMultiplier - Multiplier on decay rate (higher = faster decay)
   */
  tickDecay(decayMultiplier: number): void {
    let effective = decayMultiplier;
    if (this.profile) {
      effective *= this.profile.atmosphericDecayRate;
      effective += this.profile.radiationDecayBonus;
    }
    decaySystem(effective);
  }
}
