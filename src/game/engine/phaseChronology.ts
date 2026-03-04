/**
 * phaseChronology — tick steps 1, 1b, 2, 2.5, 2.6
 *
 * Chronology advance, population mode detection, era transitions,
 * annual reports, governor evaluation, and scoring modifier push.
 */

import type { TickResult } from '../../ai/agents/core/ChronologyAgent';
import { applyWarmingToTerrain, computeWarmingLevel, isWarmingActive } from '../../ai/agents/core/globalWarming';
import { isTileActive, type TerrainTileState, tickTerrain } from '../../ai/agents/core/terrainTick';
import { applyCrisisImpacts } from '../../ai/agents/crisis/CrisisImpactApplicator';
import { FreeformGovernor } from '../../ai/agents/crisis/FreeformGovernor';
import type { GovernorDirective } from '../../ai/agents/crisis/Governor';
import type { PressureReadContext } from '../../ai/agents/crisis/pressure/PressureDomains';
import {
  type AnnualReportEngineState,
  checkQuota as checkQuotaHelper,
  handleQuotaMet as handleQuotaMetHelper,
  handleQuotaMissed as handleQuotaMissedHelper,
} from '../../ai/agents/political/annualReportTick';
import { DIFFICULTY_PRESETS } from '../../ai/agents/political/ScoringSystem';
import { collapseEntitiesToBuildings } from '../../ai/agents/workforce/collectiveTransition';
import { getCurrentGridSize, setCurrentGridSize } from '../../config';
import { LAND_GRANT_TIERS } from '../../config/landGrants';
import { buildingsLogic, getMetaEntity, operationalBuildings } from '../../ecs/archetypes';
import type { RaionPool } from '../../ecs/world';
import { checkHQSplitting } from '../../growth/HQSplitting';
import { INDUSTRIAL_BUILDING_IDS } from '../../growth/OrganicUnlocks';
import { notifyTerrainDirty } from '../../stores/gameStore';
import { shouldExpand } from './endlessMode';
import { expandGrid, getCurrentTier, initializeNewTiles } from './mapExpansion';
import { buildSettlementSummary, type SettlementSummary } from './SettlementSummary';
import type { TickContext } from './tickContext';

/** Result of the chronology phase — engine-owned state that must be written back. */
export interface ChronologyResult {
  /** Updated raion (may be newly created from collapse). */
  raion: RaionPool | undefined;
  /** Cached governor directive for downstream phases. */
  cachedDirective: GovernorDirective | null;
}

/**
 * Run chronology phase: advance time, detect era transitions, evaluate governor.
 *
 * Steps 1, 1b, 2, 2.5, 2.6 of the tick loop.
 */
export function phaseChronology(ctx: TickContext): ChronologyResult {
  const { tickResult, storeRef, callbacks, rng } = ctx;
  const { chronology: chronoAgent, political: politicalAgent, economy: economyAgent, kgb: kgbAgent } = ctx.agents;
  const { settlement, scoring, transport, deliveries, workerSystem: workers } = ctx.systems;

  let raion = ctx.raion;
  let cachedDirective: GovernorDirective | null = null;

  // ── 1. Chronology ──
  syncChronologyToMeta(chronoAgent);
  emitChronologyChanges(tickResult, ctx);

  // ── 1b. Population mode detection ── (handled by buildTickContext)

  // ── 2. Year boundary: era transition + quota check ──
  if (tickResult.newYear) {
    // Check for entity → aggregate collapse on year boundary
    if (ctx.popMode === 'aggregate' && !raion) {
      raion = collapseEntitiesToBuildings();
      storeRef.resources.raion = raion;
      storeRef.resources.population = raion.totalPopulation;
      callbacks.onToast('The collective has grown. Individual records are now maintained by the raion.', 'warning');
    }

    // In Freeform mode, provide organic unlock context for condition-based era transitions
    if (ctx.governor instanceof FreeformGovernor) {
      const activeCrises = ctx.governor.getActiveCrises();
      const hasActiveWar = activeCrises.some((id) => id.startsWith('war') || id.includes('war'));
      const counters = ctx.governor.getYearsSinceCounters();
      const industrialCount = buildingsLogic.entities.filter((e) =>
        INDUSTRIAL_BUILDING_IDS.includes(e.building.defId),
      ).length;

      politicalAgent.setOrganicUnlockContext({
        population: storeRef.resources.population,
        industrialBuildingCount: industrialCount,
        hasActiveWar,
        hasExperiencedWar: ctx.governor.getTotalCrisesExperienced() > 0 && counters.war < Infinity,
        yearsSinceLastWar: counters.war,
        recentGrowthRate: 0, // simplified: not tracked precisely
        lowGrowthYears: 0, // will be enhanced later
        simulationYearsElapsed: chronoAgent.getDate().year - ctx.state.startYear,
        currentEraId: politicalAgent.getCurrentEraId(),
      });
    }

    politicalAgent.handleEraTransitionFull({
      year: chronoAgent.getDate().year,
      deliveries,
      economy: economyAgent,
      transport,
      workers,
      kgb: kgbAgent,
      scoring,
      callbacks,
      difficulty: ctx.state.difficulty,
      chronology: chronoAgent,
    });

    const reportCtx = buildAnnualReportContext(ctx, cachedDirective);
    checkQuotaHelper(reportCtx);
    if (reportCtx.engineState.pendingReport && !ctx.state.pendingReport) {
      ctx.state.pendingReportSinceTick = chronoAgent.getDate().totalTicks;
    }
    syncAnnualReportState(ctx, reportCtx.engineState);

    // ── 2.1 Dynamic map expansion ──
    runMapExpansion(ctx);

    // ── 2.2 Terrain yearly tick ──
    runTerrainTick(ctx);

    // ── 2.3 HQ splitting (population milestones) ──
    checkHQSplitting(ctx.state.hqSplitState, {
      population: storeRef.resources.population,
      gridSize: getCurrentGridSize(),
      callbacks,
    });
  }

  // Auto-resolve pending report after 90 ticks
  if (ctx.state.pendingReport) {
    const elapsed = chronoAgent.getDate().totalTicks - ctx.state.pendingReportSinceTick;
    if (elapsed >= 90) {
      ctx.state.pendingReport = false;
      const reportCtx = buildAnnualReportContext(ctx, cachedDirective);
      if (reportCtx.engineState.quota.current >= reportCtx.engineState.quota.target) {
        handleQuotaMetHelper(reportCtx);
      } else {
        handleQuotaMissedHelper(reportCtx);
      }
      syncAnnualReportState(ctx, reportCtx.engineState);
    }
  }

  politicalAgent.tickTransition();

  // ── 2.5 WorldAgent yearly tick ──
  if (tickResult.newYear && ctx.agents.world) {
    const date = chronoAgent.getDate();
    ctx.agents.world.setEra(politicalAgent.getCurrentEraId());
    ctx.agents.world.tickYear(date.year);
  }

  // ── 2.5b Governor evaluation ──
  if (ctx.governor) {
    const date = chronoAgent.getDate();
    const settlement = buildSettlementSummaryFromContext(ctx, date);

    // Assemble PressureReadContext from existing agents
    const pressureReadings = assemblePressureReadContext(ctx);

    const govCtx = {
      year: date.year,
      month: date.month,
      population: storeRef.resources.population,
      food: storeRef.resources.food,
      money: storeRef.resources.money,
      rng,
      totalTicks: date.totalTicks,
      eraId: politicalAgent.getCurrentEra().id,
      settlement,
      pressureReadings,
    };
    cachedDirective = ctx.governor.evaluate(govCtx);
    if (cachedDirective.crisisImpacts.length > 0) {
      applyCrisisImpacts(cachedDirective.crisisImpacts, {
        resources: storeRef.resources,
        callbacks,
        workerSystem: workers,
        buildings: operationalBuildings.entities.map((e) => ({
          gridX: e.position.gridX,
          gridY: e.position.gridY,
          type: e.building.defId,
        })),
        rng,
        totalTicks: chronoAgent.getDate().totalTicks,
      });
    }
    // Year boundary hook
    if (tickResult.newYear && ctx.governor.onYearBoundary) {
      ctx.governor.onYearBoundary(date.year);
    }
  }

  // ── 2.6 Push governor modifiers into ScoringSystem ──
  if (cachedDirective) {
    scoring.setGovernorModifiers(cachedDirective.modifiers);
  } else {
    scoring.setGovernorModifiers(null);
  }

  return { raion, cachedDirective };
}

// ── Helper functions (moved from SimulationEngine private methods) ──

function syncChronologyToMeta(chronoAgent: TickContext['agents']['chronology']): void {
  const date = chronoAgent.getDate();
  const meta = getMetaEntity();
  if (meta) {
    meta.gameMeta.date.year = date.year;
    meta.gameMeta.date.month = date.month;
    meta.gameMeta.date.tick = date.hour;
  }
}

function emitChronologyChanges(tick: TickResult, ctx: TickContext): void {
  const seasonKey = tick.season.season;
  if (seasonKey !== ctx.state.lastSeason) {
    ctx.state.lastSeason = seasonKey;
    ctx.callbacks.onSeasonChanged?.(seasonKey);
  }
  const weatherKey = tick.weather;
  if (weatherKey !== ctx.state.lastWeather) {
    ctx.state.lastWeather = weatherKey;
    ctx.callbacks.onWeatherChanged?.(weatherKey);
  }
  const dayPhaseKey = tick.dayPhase;
  if (dayPhaseKey !== ctx.state.lastDayPhase) {
    ctx.state.lastDayPhase = dayPhaseKey;
    ctx.callbacks.onDayPhaseChanged?.(dayPhaseKey, tick.dayProgress);
  }
}

function syncAnnualReportState(ctx: TickContext, state: AnnualReportEngineState): void {
  ctx.state.consecutiveQuotaFailures = state.consecutiveQuotaFailures;
  ctx.state.pendingReport = state.pendingReport;
  ctx.state.mandateState = state.mandateState;
  ctx.state.pripiskiCount = state.pripiskiCount;
}

/**
 * Build a SettlementSummary from tick context and chronology date.
 * Uses ECS state for buildings/morale/power, and governor for crisis counters.
 */
function buildSettlementSummaryFromContext(ctx: TickContext, date: { year: number; month: number }): SettlementSummary {
  const { storeRef } = ctx;
  const buildings = buildingsLogic.entities;
  const buildingCount = buildings.length;

  // Compute average morale from building workforce (0 if no buildings)
  let totalMorale = 0;
  if (buildingCount > 0) {
    for (const b of buildings) {
      totalMorale += b.building.avgMorale ?? 0;
    }
    totalMorale = totalMorale / buildingCount;
  }

  // Derive yearsSince counters from governor if available
  let yearsSinceLastWar = Infinity;
  let yearsSinceLastFamine = Infinity;
  let yearsSinceLastDisaster = Infinity;
  if (ctx.governor instanceof FreeformGovernor) {
    const counters = ctx.governor.getYearsSinceCounters();
    yearsSinceLastWar = counters.war;
    yearsSinceLastFamine = counters.famine;
    yearsSinceLastDisaster = counters.disaster;
  } else if (ctx.governor) {
    // For HistoricalGovernor: infer from active crises
    const active = ctx.governor.getActiveCrises();
    if (active.some((id) => id.includes('war'))) yearsSinceLastWar = 0;
    if (active.some((id) => id.includes('famine') || id.includes('holodomor'))) yearsSinceLastFamine = 0;
    if (active.some((id) => id.includes('disaster') || id.includes('chernobyl') || id.includes('catastrophe')))
      yearsSinceLastDisaster = 0;
  }

  // Active crisis count and types
  const activeCrises = ctx.governor?.getActiveCrises() ?? [];
  const activeCrisisTypes = new Set<string>();
  for (const id of activeCrises) {
    if (id.includes('war')) activeCrisisTypes.add('war');
    else if (id.includes('famine') || id.includes('holodomor')) activeCrisisTypes.add('famine');
    else if (id.includes('disaster') || id.includes('chernobyl') || id.includes('catastrophe'))
      activeCrisisTypes.add('disaster');
    else activeCrisisTypes.add('political');
  }

  return buildSettlementSummary({
    year: date.year,
    month: date.month,
    population: storeRef.resources.population,
    buildingCount,
    totalFood: storeRef.resources.food,
    totalPower: storeRef.resources.power,
    totalMorale,
    activeCrisisCount: activeCrises.length,
    activeCrisisTypes,
    trendDeltas: { food: 0, population: 0, morale: 0, power: 0 },
    yearsSinceLastWar,
    yearsSinceLastFamine,
    yearsSinceLastDisaster,
  });
}

function buildAnnualReportContext(ctx: TickContext, cachedDirective: GovernorDirective | null) {
  return {
    chronology: ctx.agents.chronology,
    personnelFile: ctx.agents.kgb,
    scoring: ctx.systems.scoring,
    callbacks: ctx.callbacks,
    rng: ctx.rng,
    deliveries: ctx.systems.deliveries,
    engineState: {
      quota: ctx.state.quota,
      consecutiveQuotaFailures: ctx.state.consecutiveQuotaFailures,
      pendingReport: ctx.state.pendingReport,
      mandateState: ctx.state.mandateState,
      pripiskiCount: ctx.state.pripiskiCount,
      quotaMultiplier:
        cachedDirective?.modifiers.quotaMultiplier ?? DIFFICULTY_PRESETS[ctx.state.difficulty].quotaMultiplier,
    },
    endGame: (victory: boolean, reason: string) => ctx.endGame(victory, reason),
  };
}

// ── Dynamic map expansion ──────────────────────────────────────────────────

/**
 * Check whether the settlement has grown enough to expand the grid.
 * If so, expand, initialize new terrain tiles, and signal the scene to rebuild.
 */
function runMapExpansion(ctx: TickContext): void {
  const population = ctx.storeRef.resources.population;
  const currentRadius = Math.floor(getCurrentGridSize() / 2);

  if (!shouldExpand(ctx.state.gameMode, population, currentRadius)) return;

  const tier = getCurrentTier(population);
  const tierRadius = LAND_GRANT_TIERS[tier]?.radius ?? currentRadius;

  const { newTiles, newRadius } = expandGrid(currentRadius, tierRadius);
  if (newTiles.length === 0) return;

  // Update the runtime grid size (diameter = 2 * radius + 1)
  setCurrentGridSize(newRadius * 2 + 1);

  // Initialize terrain state for new tiles
  const season = ctx.tickResult.season.season;
  const defaultTerrain = season === 'winter' ? 'snow' : 'grass';
  const newTileStates = initializeNewTiles(newTiles, defaultTerrain);
  ctx.state.terrainTiles.push(...newTileStates);

  // Signal the 3D scene to rebuild TerrainGrid
  notifyTerrainDirty();

  ctx.callbacks.onToast(`The settlement has been granted additional land (${newTiles.length} new tiles).`, 'warning');
}

// ── Pressure context assembly ───────────────────────────────────────────────

/**
 * Assemble a PressureReadContext from existing agent APIs.
 * NO new computation — just reads from agents already ticked.
 */
function assemblePressureReadContext(ctx: TickContext): PressureReadContext | undefined {
  try {
    const { food, kgb, power, demographic, loyalty, political } = ctx.agents;
    const buildings = buildingsLogic.entities;
    const totalBuildings = buildings.length;

    // Average durability from durability components
    let avgDurability = 100;
    const durableBuildings = buildings.filter((b) => (b as any).durability);
    if (durableBuildings.length > 0) {
      let totalDur = 0;
      for (const b of durableBuildings) {
        totalDur += (b as any).durability.current ?? 100;
      }
      avgDurability = totalDur / durableBuildings.length;
    }

    // Housing capacity from building housingCap
    let housingCapacity = 0;
    for (const b of buildings) {
      housingCapacity += b.building.housingCap ?? 0;
    }

    // Sick count approximation (no direct getter — use 0 as baseline)
    const sickCount = 0;

    // Labor ratio approximation
    const population = ctx.storeRef.resources.population;
    const laborRatio = population > 0 ? Math.min(1, ctx.systems.workerSystem.getPopulation() / Math.max(1, population)) : 0.5;

    // Production trend from economy agent
    const productionTrend = 0.5; // neutral default — could be enhanced from economy metrics

    // Quota deficit
    const quota = ctx.state.quota;
    const quotaDeficit = quota.target > 0 ? Math.max(0, Math.min(1, 1 - quota.current / quota.target)) : 0;

    // World state from WorldAgent (optional)
    const world = ctx.agents.world;
    const worldState = world ? (world.getState() as Record<string, unknown>) : undefined;
    const spheres = world
      ? Object.fromEntries(
          Object.entries((world.getState() as any).spheres).map(([id, s]: [string, any]) => [
            id,
            { governance: s.governance, aggregateHostility: s.aggregateHostility },
          ]),
        )
      : undefined;

    return {
      foodState: food.getFoodState(),
      starvationCounter: food.getStarvationCounter(),
      starvationGraceTicks: 90,
      averageMorale: ctx.systems.workerSystem.getAverageMorale(),
      averageLoyalty: loyalty.getAvgLoyalty(),
      sabotageCount: loyalty.getSabotageCount(),
      flightCount: loyalty.getFlightCount(),
      population,
      housingCapacity: Math.max(1, housingCapacity),
      suspicionLevel: kgb.getSuspicionLevel(),
      blackMarks: kgb.getBlackMarks(),
      blat: ctx.storeRef.resources.blat ?? 0,
      powerShortage: power.isInShortage(),
      unpoweredCount: power.getUnpoweredCount(),
      totalBuildings: Math.max(1, totalBuildings),
      averageDurability: avgDurability,
      growthRate: demographic.getGrowthRate(),
      laborRatio,
      sickCount,
      quotaDeficit,
      productionTrend,
      season: ctx.tickResult.season.season,
      weather: ctx.tickResult.weather,
      climateTrend: world?.getClimateTrend(),
      worldState,
      spheres,
    };
  } catch {
    // If any agent API isn't available (old saves, missing agents), return undefined
    // FreeformGovernor will fall back to ChaosEngine when pressureReadings is undefined
    return undefined;
  }
}

// ── Terrain yearly tick ────────────────────────────────────────────────────

/**
 * Run one year of terrain evolution on all active tiles.
 * Global warming effects only apply in freeform mode after 2050.
 */
function runTerrainTick(ctx: TickContext): void {
  const tiles = ctx.state.terrainTiles;
  if (tiles.length === 0) return;

  const year = ctx.agents.chronology.getDate().year;
  const gameMode = ctx.state.gameMode;
  const rainfall = ctx.tickResult.season.farmMultiplier; // proxy for yearly rainfall

  const warmingActive = isWarmingActive(gameMode, year);
  const warmingLevel = warmingActive ? computeWarmingLevel(year) : 0;

  const terrainCtx = { rainfall, globalWarmingRate: warmingLevel };

  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    // Skip dormant tiles for performance
    if (!isTileActive(tile) && !warmingActive) continue;

    let updated: TerrainTileState = tickTerrain(tile, terrainCtx);

    // Apply global warming effects (freeform mode only, post-2050)
    if (warmingActive) {
      updated = applyWarmingToTerrain(updated, warmingLevel);
    }

    tiles[i] = updated;
  }
}
