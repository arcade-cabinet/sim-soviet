import { Vehicle } from 'yuka';
import { phaseConsumption } from '../../../game/engine/phaseConsumption';
import { phaseNarrative } from '../../../game/engine/phaseNarrative';
import { phasePolitical } from '../../../game/engine/phasePolitical';
import { phaseProduction } from '../../../game/engine/phaseProduction';
import { phaseSocial } from '../../../game/engine/phaseSocial';
import { MSG } from '../../telegrams';

/**
 * PhaseDirectorAgent — The central conductor of the Stagnant Solidarity simulation.
 *
 * Sits inside the Yuka EntityManager and listens to the ChronologyAgent's
 * phase broadcast telegrams. It unpacks the global engine state and executes
 * the legacy procedural math phases.
 *
 * Over time, these phases will be fully distributed to the autonomous agents
 * (e.g. EconomyAgent handling consumption natively).
 */
export class PhaseDirectorAgent extends Vehicle {
  private lastSnapshot: any = null;

  constructor() {
    super();
    this.name = 'PhaseDirectorAgent';
  }

  handleMessage(telegram: any): boolean {
    switch (telegram.message) {
      // Clock boundary messages are for autonomous agents. The director only
      // acknowledges them to keep Yuka diagnostics clean during headless runs.
      case MSG.NEW_TICK:
      case MSG.NEW_MONTH:
      case MSG.NEW_YEAR:
      case MSG.NEW_SEASON:
        return true;
      default:
        break;
    }

    const engine = (globalThis as any).simulationEngine;
    if (!engine || !engine._lastTickCtx) return false;

    const ctx = engine._lastTickCtx;

    switch (telegram.message) {
      case MSG.PHASE_PRODUCTION:
        this.lastSnapshot = phaseProduction(ctx);
        return true;

      case MSG.PHASE_CONSUMPTION:
        if (this.lastSnapshot) {
          phaseConsumption(ctx, this.lastSnapshot);
        }
        return true;

      case MSG.PHASE_SOCIAL:
        phaseSocial(ctx);
        return true;

      case MSG.PHASE_POLITICAL:
        phasePolitical(ctx);
        return true;

      case MSG.PHASE_NARRATIVE:
        phaseNarrative(ctx);
        return true;
    }

    return false;
  }
}
