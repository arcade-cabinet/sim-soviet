/**
 * phaseConsumption — tick steps 8, 9, 10, 11, 11b, 11c
 *
 * Storage, economy tick, compulsory deliveries, food consumption,
 * distribution resentment, and foraging.
 */

import { computeAllocation, type BuildingAllocationInput } from '../../ai/agents/economy/allocationDistribution';
import { foragingTick } from '../../ai/agents/economy/foragingSystem';
import { housing } from '../../ecs/archetypes';
import { computeDistribution, computeRoleBuckets } from '../../ecs/systems/distributionWeights';
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
    // Aggregate mode: two-layer allocation distributes food/vodka across housing buildings.
    // 80% uniform baseline per capita + 20% spiky secondary by merit (loyalty, skill, proximity, KGB favor).
    const pop = ctx.raion.totalPopulation;
    const totalFoodDemand = pop * 0.5 * totalConsumptionMult;
    const totalVodkaDemand = pop * 0.1 * totalConsumptionMult;

    const housingBuildings = housing.entities;
    if (housingBuildings.length > 0 && pop > 0) {
      // Build allocation inputs from housing buildings
      const allocationInputs: BuildingAllocationInput[] = housingBuildings.map((e) => ({
        id: e.building.defId,
        residentCount: e.building.residentCount,
        loyalty: e.building.avgLoyalty,
        proximity: 1.0, // TODO: compute from distance to resource stores
        skill: e.building.avgSkill,
        kgbFavor: false, // TODO: wire KGB favor per building
      }));

      const totalResidents = allocationInputs.reduce((s, b) => s + b.residentCount, 0);

      // Allocate food across buildings using two-layer distribution
      const foodAlloc = computeAllocation(totalFoodDemand, totalResidents || pop, allocationInputs);
      const vodkaAlloc = computeAllocation(totalVodkaDemand, totalResidents || pop, allocationInputs);

      // Apply total consumption from allocation results
      const foodConsumed = foodAlloc.reduce((s, r) => s + r.total, 0);
      const vodkaConsumed = vodkaAlloc.reduce((s, r) => s + r.total, 0);
      storeRef.resources.food = Math.max(0, storeRef.resources.food - foodConsumed);
      storeRef.resources.vodka = Math.max(0, storeRef.resources.vodka - vodkaConsumed);
    } else {
      // Fallback: no housing buildings, use flat per-capita
      const foodConsumed = pop * 0.5 * totalConsumptionMult;
      const vodkaConsumed = pop * 0.1 * totalConsumptionMult;
      storeRef.resources.food = Math.max(0, storeRef.resources.food - foodConsumed);
      storeRef.resources.vodka = Math.max(0, storeRef.resources.vodka - vodkaConsumed);
    }

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
