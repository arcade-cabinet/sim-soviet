/**
 * phasePolitical — tick steps 16, 17, 18, 19, 20, 21, 22, 23
 *
 * Loyalty, trudodni, collective construction, chairman meddling,
 * decay, gulag, settlement, era conditions, political entities.
 */

import { accrueTrudodni } from '../../ai/agents/economy/EconomyAgent';
import { decaySystem, quotaSystem } from '../../ecs/systems';
import type { TickContext } from './tickContext';

/**
 * Run political phase: loyalty, trudodni, construction, decay, gulag, settlement,
 * era conditions, political entities.
 *
 * Steps 16-23 of the tick loop.
 */
export function phasePolitical(ctx: TickContext): void {
  const { tickResult, storeRef, callbacks, rng } = ctx;
  const { chronology, political: politicalAgent, kgb: kgbAgent, loyalty: loyaltyAgent, collective: collectiveAgent, defense: defenseAgent } = ctx.agents;
  const { settlement, politicalEntities, workerSystem, scoring, politburo } = ctx.systems;
  const { eraMods, politburoMods } = ctx.modifiers;
  const diffConfig = ctx.diffConfig;

  // ── 16. Monthly: loyalty + trudodni ──
  if (tickResult.newMonth) {
    const currentEraId = politicalAgent.getCurrentEraId();
    const pop = storeRef.resources.population;
    const foodLevel = pop > 0 ? Math.min(1, storeRef.resources.food / (pop * 2)) : 1;
    const quotaMet = ctx.state.quota.current >= ctx.state.quota.target;
    loyaltyAgent.setFoodLevel(foodLevel);
    const loyaltyResult = loyaltyAgent.tickLoyalty(currentEraId, quotaMet);

    if (loyaltyResult.sabotageCount > 0) {
      const penalty = Math.max(0.5, 1 - loyaltyResult.sabotageCount * 0.05);
      storeRef.resources.food *= penalty;
      storeRef.resources.vodka *= penalty;
      if (loyaltyResult.sabotageCount >= 2) {
        callbacks.onToast('SABOTAGE: Disloyal elements are destroying collective property!', 'warning');
      }
    }

    if (loyaltyResult.flightCount > 0) {
      workerSystem.removeWorkersByCount(loyaltyResult.flightCount, 'loyalty_flight');
      callbacks.onToast(
        `${loyaltyResult.flightCount} worker(s) fled the collective due to disloyalty`,
        'warning',
      );
    }

    accrueTrudodni();
  }

  // ── 17. Collective autonomous construction ──
  collectiveAgent.tickAutonomous({
    totalTicks: chronology.getDate().totalTicks,
    rng,
    mandateState: ctx.state.mandateState,
    eraId: politicalAgent.getCurrentEraId(),
    callbacks: callbacks as Parameters<typeof collectiveAgent.tickAutonomous>[0]['callbacks'],
    recordBuildingForMandates: (defId: string) => {
      politicalAgent.recordBuildingPlaced(defId);
    },
  });

  // ── 18. Chairman meddling ──
  if (workerSystem.isChairmanMeddling() && chronology.getDate().totalTicks % 60 === 0) {
    callbacks.onAdvisor(
      'Comrade, the workers notice your constant meddling. They whisper that the chairman does not trust the collective.',
    );
    if (rng.random() < 0.05) {
      kgbAgent.addMark(
        'excessive_intervention',
        chronology.getDate().totalTicks,
        'Chairman interfered excessively with collective operations',
      );
      callbacks.onToast('BLACK MARK: Excessive interference with collective operations', 'warning');
    }
  }

  // ── 19. Decay + quota ──
  decaySystem(politburoMods.infrastructureDecayMult * eraMods.decayMult * diffConfig.decayMultiplier);
  quotaSystem(ctx.state.quota);

  // ── 20. Gulag effect ──
  defenseAgent.processGulagEffect({
    population: storeRef.resources.population,
    rng,
    workers: workerSystem,
    scoring,
    kgb: kgbAgent,
    callbacks,
    totalTicks: chronology.getDate().totalTicks,
  });

  // ── 21. Settlement ──
  settlement.tickWithCallbacks(callbacks as Parameters<typeof settlement.tickWithCallbacks>[0]);

  // ── 22. Era conditions ──
  politicalAgent.checkConditions({
    totalTicks: chronology.getDate().totalTicks,
    callbacks,
    endGame: (v, r) => ctx.endGame(v, r),
  });

  // ── 23. Political entities ──
  politicalAgent.tickEntitiesFull({
    politicalEntities,
    workers: workerSystem,
    kgb: kgbAgent,
    scoring,
    callbacks,
    settlement,
    politburo,
    quota: ctx.state.quota,
    rng,
    chronologyTotalTicks: chronology.getDate().totalTicks,
  });
}
