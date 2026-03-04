/**
 * phaseProduction — tick steps 3, 4, 5, 6, 7
 *
 * Production modifiers, power distribution, transport, construction,
 * food/vodka/money production (entity or aggregate mode).
 */

import { type BuildingTickContext, type BuildingTickInput, tickBuilding } from '../../ai/agents/economy/buildingTick';
import { getBuildingDef } from '../../data/buildingDefs';
import { buildingsLogic, decayableBuildings, operationalBuildings } from '../../ecs/archetypes';
import { constructionSystem } from '../../ecs/systems';
import { poissonSample } from '../../math/poissonSampling';
import { getDefensePosture, getGosplanAllocations } from '../../stores/gameStore';
import { getPostureEffects } from '../../ui/hq-tabs/MilitaryTab';
import {
  aggregateOffscreenResults,
  getOffscreenBuildings,
  type OffscreenBuilding,
  type ResourceType,
  tickOffscreenBuildings,
} from './offscreenTick';
import { tickDirective } from './directiveTick';
import type { TickContext } from './tickContext';
import { type BuildingPosition, getVisibleBounds, queryVisibleBuildings } from './viewportQuery';

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

  // ── 6b. Central Committee directive tick ──
  const directiveResult = tickDirective(
    ctx.agents.chronology.getDate().totalTicks,
    workerSystem,
    storeRef.resources,
    ctx.raion,
    ctx.callbacks,
  );

  // ── 7. Production ──
  const snapshot: PreProductionSnapshot = {
    foodBefore: storeRef.resources.food,
    vodkaBefore: storeRef.resources.vodka,
    moneyBefore: storeRef.resources.money,
  };

  // Labor holiday: skip all production for this tick
  if (directiveResult.laborHoliday) {
    return snapshot;
  }

  // Gosplan allocation modifiers: food allocation (default 40%) scales food production,
  // industrial allocation (default 30%) scales industrial output.
  // Normalized so default allocation = 1.0 modifier.
  const gosplanAlloc = getGosplanAllocations();
  const foodAllocMod = gosplanAlloc.food / 40;
  const industrialAllocMod = gosplanAlloc.industrial / 30;

  // Defense posture production penalty (e.g. mobilized = -15% → 0.85)
  const postureEffects = getPostureEffects(getDefensePosture());
  const postureProdMod = 1 + postureEffects.productionModifier / 100;

  // Central Committee directive production modifier
  const directiveProdMod = directiveResult.productionMult;

  if (ctx.raion) {
    // Aggregate mode: compute production per operational building via tickBuilding
    const tickCtx: BuildingTickContext = {
      weather: ctx.state.lastWeather || 'clear',
      season: tickResult.season.season,
      activeCrisisModifier: eraMods.productionMult * farmMod,
    };

    for (const entity of operationalBuildings.entities) {
      const bldg = entity.building;
      const def = getBuildingDef(bldg.defId);
      if (!def) continue;

      const staffCap = def.stats.staffCap ?? def.stats.housingCap ?? 10;
      const baseRate = def.stats.produces ? def.stats.produces.amount / staffCap : 0;

      const tickInput: BuildingTickInput = {
        defId: bldg.defId,
        workerCount: bldg.workerCount,
        avgSkill: bldg.avgSkill,
        avgMorale: bldg.avgMorale,
        avgLoyalty: bldg.avgLoyalty,
        powered: bldg.powered,
        baseRate,
        tileFertility: 50, // DB default; per-tile lookup not yet wired
      };

      const tickResult2 = tickBuilding(tickInput, tickCtx);

      // Apply resource output (scaled by Gosplan allocation + posture + directive)
      if (def.stats.produces && tickResult2.netOutput > 0) {
        const resource = def.stats.produces.resource as 'food' | 'vodka';
        if (resource === 'food') {
          storeRef.resources.food += tickResult2.netOutput * foodAllocMod * postureProdMod * directiveProdMod;
        } else if (resource === 'vodka') {
          storeRef.resources.vodka += tickResult2.netOutput * industrialAllocMod * postureProdMod * directiveProdMod;
        }
      }

      // Power generation (not handled by tickBuilding)
      if (bldg.powerOutput > 0) {
        const conditionFactor = (entity.durability?.current ?? 100) / 100;
        storeRef.resources.power += bldg.powerOutput * conditionFactor;
      }

      // Trudodni accrual
      const utilization = Math.min(1, bldg.workerCount / staffCap);
      bldg.trudodniAccrued += bldg.workerCount * utilization * (bldg.avgSkill / 100);

      // Stochastic events (Poisson sampled)
      const accidentLambda = bldg.workerCount * 0.001;
      const accidents = poissonSample(accidentLambda, rng);
      if (accidents > 0) {
        workerSystem.removeWorkersByCount(accidents, 'workplace_accident');
      }
    }

    // ── 7b. Offscreen building tick (viewport-aware) ──
    // In aggregate mode with many buildings, offscreen buildings use a simplified
    // tick path via tickOffscreenBuildings(). Camera position is approximated from
    // the grid center when no viewport info is available.
    if (operationalBuildings.entities.length > 50) {
      const allPositions: BuildingPosition[] = [];
      const allOffscreen: OffscreenBuilding[] = [];

      for (const entity of operationalBuildings.entities) {
        const pos = entity.position;
        allPositions.push({ id: `${pos.gridX},${pos.gridY}`, x: pos.gridX, z: pos.gridY });

        const bldg = entity.building;
        const def = getBuildingDef(bldg.defId);
        if (!def) continue;
        const staffCap = def.stats.staffCap ?? def.stats.housingCap ?? 10;
        const baseRate = def.stats.produces ? def.stats.produces.amount / staffCap : 0;
        const resourceType: ResourceType = def.stats.produces
          ? (def.stats.produces.resource as ResourceType)
          : bldg.powerOutput > 0
            ? 'power'
            : 'money';

        allOffscreen.push({
          id: `${pos.gridX},${pos.gridY}`,
          defId: bldg.defId,
          workerCount: bldg.workerCount,
          avgSkill: bldg.avgSkill,
          avgMorale: bldg.avgMorale,
          avgLoyalty: bldg.avgLoyalty,
          powered: bldg.powered,
          baseRate,
          tileFertility: 50,
          resourceType,
        });
      }

      // Use grid center as camera approximation; viewDistance covers most of the grid
      const bounds = getVisibleBounds(15, 15, 15);
      const visibleIds = new Set(queryVisibleBuildings(bounds, allPositions));
      const offscreen = getOffscreenBuildings(allOffscreen, visibleIds);

      if (offscreen.length > 0) {
        const offResults = tickOffscreenBuildings(offscreen, tickCtx);
        const agg = aggregateOffscreenResults(offResults);
        storeRef.resources.food += agg.totalFood;
        storeRef.resources.vodka += agg.totalVodka;
        storeRef.resources.power += agg.totalPower;
        storeRef.resources.money += agg.totalMoney;
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
      farmModifier: farmMod * foodAllocMod * postureProdMod * directiveProdMod,
      vodkaModifier: vodkaMod * industrialAllocMod * postureProdMod * directiveProdMod,
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
