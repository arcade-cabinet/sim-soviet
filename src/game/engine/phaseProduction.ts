/**
 * phaseProduction — tick steps 3, 4, 5, 6, 7
 *
 * Production modifiers, power distribution, transport, construction,
 * food/vodka/money production (entity or aggregate mode).
 */

import { getBuildingDef } from '../../data/buildingDefs';
import { buildingsLogic, operationalBuildings } from '../../ecs/archetypes';
import { constructionSystem } from '../../ecs/systems';
import { computeBuildingProduction } from '../../ai/agents/economy/buildingProduction';
import { decayableBuildings } from '../../ecs/archetypes';
import type { TickContext } from './tickContext';

/** Snapshot of resource levels before production, for delivery calculations. */
export interface PreProductionSnapshot {
  foodBefore: number;
  vodkaBefore: number;
  moneyBefore: number;
}

/**
 * Run production phase: power, transport, construction, and food/vodka/money production.
 *
 * Steps 3-7 of the tick loop. Returns pre-production resource snapshot for deliveries.
 */
export function phaseProduction(ctx: TickContext): PreProductionSnapshot {
  const { tickResult, storeRef, rng } = ctx;
  const { power: powerAgent, food: foodAgent, economy: economyAgent, political: politicalAgent } = ctx.agents;
  const { transport, settlement, workerSystem } = ctx.systems;
  const { farmMod, vodkaMod, eraMods, weatherProfile } = ctx.modifiers;

  // ── 4. Power ──
  powerAgent.distributePower();

  // ── 5. Transport ──
  const transportResult = transport.tick(
    operationalBuildings.entities,
    settlement.getCurrentTier(),
    ctx.agents.chronology.getDate().totalTicks,
    tickResult.season,
    storeRef.resources,
  );

  // ── 6. Construction ──
  constructionSystem(
    politicalAgent.getCurrentEra().constructionTimeMult,
    weatherProfile.constructionTimeMult,
    transportResult.seasonBuildMult,
  );

  // ── 7. Production ──
  const snapshot: PreProductionSnapshot = {
    foodBefore: storeRef.resources.food,
    vodkaBefore: storeRef.resources.vodka,
    moneyBefore: storeRef.resources.money,
  };

  if (ctx.raion) {
    // Aggregate mode: compute production per operational building
    for (const entity of operationalBuildings.entities) {
      const bldg = entity.building;
      const def = getBuildingDef(bldg.defId);
      if (!def) continue;

      const prodResult = computeBuildingProduction(bldg, def, {
        eraId: politicalAgent.getCurrentEraId(),
        powered: bldg.powered,
        durability: entity.durability?.current ?? 100,
        season: tickResult.season.season,
        rng,
        eraProductionMod: eraMods.productionMult,
        weatherMod: farmMod,
      });

      if (prodResult.resource === 'food') {
        storeRef.resources.food += prodResult.amount;
      } else if (prodResult.resource === 'vodka') {
        storeRef.resources.vodka += prodResult.amount;
      }
      storeRef.resources.power += prodResult.powerGenerated;
      bldg.trudodniAccrued += prodResult.trudodniAccrued;

      // Stochastic events
      if (prodResult.accidents > 0) {
        workerSystem.removeWorkersByCount(prodResult.accidents, 'workplace_accident');
      }
    }

    // Production chains still run in aggregate mode
    {
      const chainBuildingIds: string[] = [];
      for (const entity of buildingsLogic) chainBuildingIds.push(entity.building.defId);
      economyAgent.tickProductionChains(chainBuildingIds, storeRef.resources);
    }
  } else {
    // Entity mode: existing production path
    const avgSkill = workerSystem.getAverageSkill();
    const avgCondition = getAverageBuildingCondition();

    foodAgent.produce({
      farmModifier: farmMod,
      vodkaModifier: vodkaMod,
      eraId: politicalAgent.getCurrentEraId(),
      skillFactor: avgSkill,
      conditionFactor: avgCondition,
      stakhanoviteBoosts: ctx.state.stakhanoviteBoosts,
      includePrivatePlots: tickResult.newMonth,
    });

    // Production chains
    {
      const chainBuildingIds: string[] = [];
      for (const entity of buildingsLogic) chainBuildingIds.push(entity.building.defId);
      economyAgent.tickProductionChains(chainBuildingIds, storeRef.resources);
    }
  }

  return snapshot;
}

/** Average building condition factor (0.0 - 1.0). Durability 100 = 1.0. */
export function getAverageBuildingCondition(): number {
  let totalCondition = 0;
  let count = 0;
  for (const entity of decayableBuildings) {
    totalCondition += entity.durability.current / 100;
    count++;
  }
  return count === 0 ? 1.0 : totalCondition / count;
}
