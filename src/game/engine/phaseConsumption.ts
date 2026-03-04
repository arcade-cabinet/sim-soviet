/**
 * phaseConsumption — tick steps 8, 9, 10, 11, 11b, 11c
 *
 * Storage, economy tick, compulsory deliveries, food consumption,
 * distribution resentment, and foraging.
 */

import { computeDistribution, computeRoleBuckets } from '../../ecs/systems/distributionWeights';
import { foragingTick } from '../../ai/agents/economy/foragingSystem';
import type { PreProductionSnapshot } from './phaseProduction';
import type { TickContext } from './tickContext';

/**
 * Run consumption phase: storage, economy, deliveries, food consumption, foraging.
 *
 * Steps 8-11c of the tick loop.
 */
export function phaseConsumption(ctx: TickContext, snapshot: PreProductionSnapshot): void {
  const { storeRef, callbacks, rng } = ctx;
  const { chronology, food: foodAgent, storage: storageAgent, economy: economyAgent, kgb: kgbAgent } = ctx.agents;
  const { settlement, workerSystem, deliveries, politicalEntities } = ctx.systems;
  const { eraMods } = ctx.modifiers;
  const diffConfig = ctx.diffConfig;

  // ── 8. Storage ──
  storageAgent.update(chronology.getDate().month);

  // ── 9. Economy system (fondy, trudodni, blat, stakhanovite, MTS, heating, reforms) ──
  const econResult = economyAgent.applyTickResults({
    chronology,
    workers: workerSystem,
    kgb: kgbAgent,
    callbacks: callbacks as Parameters<typeof economyAgent.applyTickResults>[0]['callbacks'],
    quota: ctx.state.quota,
    settlement,
    stakhanoviteBoosts: ctx.state.stakhanoviteBoosts,
  });
  ctx.state.mtsGrainMultiplier = econResult.mtsGrainMultiplier;

  // ── 10. Compulsory deliveries ──
  {
    const newFood = Math.max(0, storeRef.resources.food - snapshot.foodBefore);
    const newVodka = Math.max(0, storeRef.resources.vodka - snapshot.vodkaBefore);
    const newMoney = Math.max(0, storeRef.resources.money - snapshot.moneyBefore);
    if (newFood > 0 || newVodka > 0 || newMoney > 0) {
      const result = deliveries.applyDeliveries(newFood, newVodka, newMoney);
      storeRef.resources.food = Math.max(0, storeRef.resources.food - result.foodTaken);
      storeRef.resources.vodka = Math.max(0, storeRef.resources.vodka - result.vodkaTaken);
      storeRef.resources.money = Math.max(0, storeRef.resources.money - result.moneyTaken);
    }
  }

  // ── 11. Food consumption + starvation ──
  const totalConsumptionMult = eraMods.consumptionMult * diffConfig.consumptionMultiplier;
  if (ctx.raion) {
    // Aggregate mode: consumption scales with raion population
    const pop = ctx.raion.totalPopulation;
    const foodConsumed = pop * 0.5 * totalConsumptionMult;
    const vodkaConsumed = pop * 0.1 * totalConsumptionMult;
    storeRef.resources.food = Math.max(0, storeRef.resources.food - foodConsumed);
    storeRef.resources.vodka = Math.max(0, storeRef.resources.vodka - vodkaConsumed);

    // Starvation check: delegate to FoodAgent for consistency
    const foodResult = foodAgent.consume(totalConsumptionMult);
    if (foodResult.starvationDeaths > 0) {
      callbacks.onToast('STARVATION DETECTED', 'critical');
      workerSystem.removeWorkersByCount(foodResult.starvationDeaths, 'starvation');
    }
  } else {
    // Entity mode: existing consumption path
    const foodResult = foodAgent.consume(totalConsumptionMult);
    if (foodResult.starvationDeaths > 0) {
      callbacks.onToast('STARVATION DETECTED', 'critical');
      workerSystem.removeWorkersByCount(foodResult.starvationDeaths, 'starvation');
    }
  }

  // ── 11b. Distribution resentment check ──
  {
    const politicalCounts = politicalEntities.getEntityCounts();
    const pop = storeRef.resources.population;
    if (pop > 0) {
      const buckets = computeRoleBuckets(pop, politicalCounts);
      const dist = computeDistribution(pop, totalConsumptionMult, buckets);
      if (dist.resentmentActive) {
        callbacks.onPravda('Some comrades are more equal than others.');
      }
    }
  }

  // ── 11c. Foraging System — survival foraging when food is critically low ──
  {
    const foragingResult = foragingTick(
      storeRef.resources.food,
      storeRef.resources.population,
      chronology.getDate().month,
      ctx.state.foragingState,
      rng,
    );

    if (foragingResult.foodGathered > 0) {
      storeRef.resources.food += foragingResult.foodGathered;
    }

    if (foragingResult.kgbRisk > 0) {
      kgbAgent.addMark(
        'workers_abandoning_collective',
        chronology.getDate().totalTicks,
        'Workers observed abandoning collective duties for personal foraging',
      );
      callbacks.onToast('BLACK MARK: Workers abandoning collective duties for personal foraging', 'warning');
    }

    if (foragingResult.cannibalismFired) {
      workerSystem.removeWorkersByCount(1, 'starvation');
      callbacks.onToast('Something unspeakable has happened in the settlement...', 'critical');
    }

    if (foragingResult.moralePenalty > 0 && foragingResult.method === 'stone_soup') {
      callbacks.onAdvisor('Comrade Mayor, the workers are boiling stones for soup. We have come to this.');
    }
  }
}
