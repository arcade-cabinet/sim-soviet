/**
 * phaseChronology — tick steps 1, 1b, 2, 2.5, 2.6
 *
 * Chronology advance, population mode detection, era transitions,
 * annual reports, governor evaluation, and scoring modifier push.
 */

import type { TickResult } from '../../ai/agents/core/ChronologyAgent';
import { isTileActive, tickTerrain } from '../../ai/agents/core/terrainTick';
import { applyCrisisImpacts } from '../../ai/agents/crisis/CrisisImpactApplicator';
import type { GovernorDirective } from '../../ai/agents/crisis/Governor';
import type { PressureReadContext } from '../../ai/agents/crisis/pressure/PressureDomains';
import {
  type AnnualReportEngineState,
  checkQuota as checkQuotaHelper,
  handleQuotaMet as handleQuotaMetHelper,
  handleQuotaMissed as handleQuotaMissedHelper,
} from '../../ai/agents/political/annualReportTick';
import { createMandatesForEra, createPlanMandateState } from '../../ai/agents/political/PoliticalAgent';
import { DIFFICULTY_PRESETS } from '../../ai/agents/political/ScoringSystem';
import { collapseEntitiesToBuildings } from '../../ai/agents/workforce/collectiveTransition';
import { getCurrentGridSize, setCurrentGridSize } from '../../config';
import { LAND_GRANT_TIERS } from '../../config/landGrants';
import { buildingsLogic, getMetaEntity, operationalBuildings } from '../../ecs/archetypes';
import type { RaionPool } from '../../ecs/world';
import { checkHQSplitting } from '../../growth/HQSplitting';
import { addMassGrave, notifyTerrainDirty } from '../../stores/gameStore';
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
  const { scoring, transport, deliveries, workerSystem: workers } = ctx.systems;

  let raion = ctx.raion;
  let cachedDirective: GovernorDirective | null = null;

  // ── 1. Chronology ──
  syncChronologyToMeta(chronoAgent);
  emitChronologyChanges(tickResult, ctx);
  maybeCompleteHistoricalCampaign(ctx);

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

    const eraBefore = politicalAgent.getCurrentEraId();
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
    const eraAfter = politicalAgent.getCurrentEraId();
    if (eraAfter !== eraBefore) {
      ctx.state.mandateState = createPlanMandateState(createMandatesForEra(eraAfter, ctx.state.difficulty));
    }

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

    // ── 2.4 Mass grave placement (persistent visual markers for mass casualties) ──
    if (ctx.governor) {
      const activeCrises = ctx.governor.getActiveCrises();
      const year = chronoAgent.getDate().year;
      const gridSize = getCurrentGridSize();

      for (const crisisId of activeCrises) {
        let cause: 'purge' | 'famine' | 'gulag' | 'war' | 'plague' | null = null;
        if (crisisId.includes('terror') || crisisId.includes('purge') || crisisId.includes('doctors_plot')) {
          cause = 'purge';
        } else if (crisisId.includes('famine') || crisisId.includes('holodomor')) {
          cause = 'famine';
        } else if (crisisId.includes('gulag')) {
          cause = 'gulag';
        } else if (crisisId.includes('war') || crisisId.includes('civil_war')) {
          cause = 'war';
        } else if (crisisId.includes('plague') || crisisId.includes('pandemic')) {
          cause = 'plague';
        }

        if (cause) {
          // Place cluster at settlement periphery (edge tiles)
          const seed = year * 7919 + crisisId.length * 104729;
          const edge = seed % 4; // 0=north, 1=east, 2=south, 3=west
          const offset = (seed >> 8) % Math.max(1, gridSize - 2);
          let gx: number, gy: number;
          switch (edge) {
            case 0:
              gx = 1 + offset;
              gy = 0;
              break;
            case 1:
              gx = gridSize - 1;
              gy = 1 + offset;
              break;
            case 2:
              gx = 1 + offset;
              gy = gridSize - 1;
              break;
            default:
              gx = 0;
              gy = 1 + offset;
              break;
          }

          const markerCount = 3 + (seed % 3); // 3-5 markers
          addMassGrave({
            id: `${crisisId}-${year}`,
            gridX: gx,
            gridY: gy,
            year,
            markerCount,
            cause,
          });
        }
      }
    }
  }

  // ── 1991 Historical Campaign Completion ─────────────────────────────────
  // This must not rely only on a new-year tick: rehabilitation and other
  // conservative time skips can advance the calendar across 1991 between
  // boundary checks.
  maybeCompleteHistoricalCampaign(ctx);

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
      worldAgent: ctx.agents.world ?? undefined,
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

function maybeCompleteHistoricalCampaign(ctx: TickContext): void {
  if (
    ctx.state.gameMode !== 'historical' ||
    ctx.state.historicalCompletionFired ||
    ctx.agents.chronology.getDate().year < 1991
  ) {
    return;
  }

  ctx.state.historicalCompletionFired = true;

  const resolve = (continueInPostCampaign: boolean) => {
    if (continueInPostCampaign) {
      enterPostCampaignFreePlay(ctx);
    } else {
      ctx.endGame(false, 'ussr_dissolved');
    }
  };

  if (ctx.callbacks.onHistoricalEraEnd) {
    ctx.callbacks.onHistoricalEraEnd(resolve);
  } else {
    // No UI handler — auto-continue into grounded post-campaign free play.
    enterPostCampaignFreePlay(ctx);
  }
}

function enterPostCampaignFreePlay(ctx: TickContext): void {
  const date = ctx.agents.chronology.getDate();
  ctx.continuePostCampaign();
  ctx.state.historicalCompletionFired = true;
  ctx.state.consecutiveQuotaFailures = 0;
  ctx.state.pendingReport = false;
  ctx.state.pendingReportSinceTick = date.totalTicks;
  ctx.state.quota.deadlineYear = Math.max(ctx.state.quota.deadlineYear, date.year + 5);
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
  if (ctx.governor) {
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
    const { food, kgb, power, demographic, loyalty } = ctx.agents;
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
    const laborRatio =
      population > 0 ? Math.min(1, ctx.systems.workerSystem.getPopulation() / Math.max(1, population)) : 0.5;

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

    // Law enforcement metrics (crime rate, patrol coverage, district disorder)
    const lawState = kgb.getLawEnforcementState();
    const avgDistrictDecay =
      lawState.sectors.length > 0
        ? lawState.sectors.reduce((sum, s) => sum + s.districtDecay, 0) / lawState.sectors.length
        : 0;

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
      // Carrying capacity: min of housing, food production, and terrain limit
      // This is the mathematical ceiling that forces expansion
      carryingCapacity: Math.max(1, housingCapacity),
      season: ctx.tickResult.season.season,
      weather: ctx.tickResult.weather,
      climateTrend: world?.getClimateTrend(),
      worldState,
      spheres,
      crimeRate: lawState.aggregateCrimeRate,
      judgeCoverage: lawState.totalJudges > 0 ? Math.min(1, lawState.totalJudges / Math.max(1, population / 2000)) : 0,
      districtDecay: avgDistrictDecay,
    };
  } catch {
    // If any agent API isn't available (old saves, missing agents), return undefined.
    return undefined;
  }
}

// ── Terrain yearly tick ────────────────────────────────────────────────────

/**
 * Run one year of terrain evolution on all active tiles.
 * Terrain evolves locally with seasonal rainfall. No post-1991 global warming
 * or off-world systems are part of the 1.0 historical scope.
 */
function runTerrainTick(ctx: TickContext): void {
  const tiles = ctx.state.terrainTiles;
  if (tiles.length === 0) return;

  const rainfall = ctx.tickResult.season.farmMultiplier; // proxy for yearly rainfall
  const terrainCtx = { rainfall, globalWarmingRate: 0 };

  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    // Skip dormant tiles for performance
    if (!isTileActive(tile)) continue;
    tiles[i] = tickTerrain(tile, terrainCtx);
  }
}
