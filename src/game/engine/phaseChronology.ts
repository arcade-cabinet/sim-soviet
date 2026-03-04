/**
 * phaseChronology — tick steps 1, 1b, 2, 2.5, 2.6
 *
 * Chronology advance, population mode detection, era transitions,
 * annual reports, governor evaluation, and scoring modifier push.
 */

import type { TickResult } from '../../ai/agents/core/ChronologyAgent';
import type { GovernorDirective } from '../../ai/agents/crisis/Governor';
import { applyCrisisImpacts } from '../../ai/agents/crisis/CrisisImpactApplicator';
import { FreeformGovernor } from '../../ai/agents/crisis/FreeformGovernor';
import {
  type AnnualReportEngineState,
  checkQuota as checkQuotaHelper,
  handleQuotaMet as handleQuotaMetHelper,
  handleQuotaMissed as handleQuotaMissedHelper,
} from '../../ai/agents/political/annualReportTick';
import { DIFFICULTY_PRESETS } from '../../ai/agents/political/ScoringSystem';
import { collapseEntitiesToBuildings } from '../../ai/agents/workforce/collectiveTransition';
import { buildingsLogic, getMetaEntity, operationalBuildings } from '../../ecs/archetypes';
import { INDUSTRIAL_BUILDING_IDS } from '../../growth/OrganicUnlocks';
import type { RaionPool } from '../../ecs/world';
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
      callbacks.onToast(
        'The collective has grown. Individual records are now maintained by the raion.',
        'warning',
      );
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

  // ── 2.5 Governor evaluation ──
  if (ctx.governor) {
    const date = chronoAgent.getDate();
    const govCtx = {
      year: date.year,
      month: date.month,
      population: storeRef.resources.population,
      food: storeRef.resources.food,
      money: storeRef.resources.money,
      rng,
      totalTicks: date.totalTicks,
      eraId: politicalAgent.getCurrentEra().id,
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
