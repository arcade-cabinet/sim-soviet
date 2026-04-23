/**
 * phaseFinalize — tick steps 26, 27
 *
 * Autopilot chairman assessment, system-to-meta sync, loss check.
 */

import type { SettlementTier } from '../../ai/agents/infrastructure/SettlementSystem';
import type { RoadQuality } from '../../ai/agents/infrastructure/TransportSystem';
import type { QuotaState } from '../../ai/agents/political/PoliticalAgent';
import { buildingsLogic, getMetaEntity, getResourceEntity } from '../../ecs/archetypes';
import type { RaionPool, Resources } from '../../ecs/world';
import { TICKS_PER_YEAR } from '../Chronology';
import type { TickContext } from './tickContext';

/** Minimal deps for syncSystemsToMeta — usable from both phaseFinalize and serialization. */
export interface SyncMetaDeps {
  quota: Readonly<QuotaState>;
  kgb: { getBlackMarks(): number; getCommendations(): number; getThreatLevel(): string };
  political: { getCurrentEraId(): string };
  settlement: { getCurrentTier(): SettlementTier };
  transport: { getQuality(): RoadQuality; getCondition(): number };
  politburo: { getGeneralSecretary(): { name: string; personality: string } };
}

/**
 * Run finalize phase: autopilot, sync systems to meta, and check loss condition.
 *
 * Steps 26-27 of the tick loop.
 */
export function phaseFinalize(ctx: TickContext): void {
  const { storeRef, callbacks } = ctx;
  const { chronology, kgb: kgbAgent, political: politicalAgent } = ctx.agents;
  const { agentManager, workerSystem, settlement, transport, politburo } = ctx.systems;
  sanitizeFiniteRuntimeState(storeRef.resources, ctx.state.quota);

  // ── 26. Autopilot ──
  if (agentManager.isAutopilot()) {
    const chairman = agentManager.getChairman();
    if (chairman) {
      const res = getResourceEntity();
      const pop = res?.resources.population ?? 0;
      const food = res?.resources.food ?? 0;
      const meta = getMetaEntity();
      chairman.assessGameState(
        { food, population: pop },
        {
          quotaProgress: ctx.state.quota.target > 0 ? ctx.state.quota.current / ctx.state.quota.target : 1,
          quotaDeadlineMonths: (ctx.state.quota.deadlineYear - (meta?.gameMeta.date.year ?? 1917)) * 12,
          blackMarks: kgbAgent.getBlackMarks(),
          commendations: kgbAgent.getCommendations(),
          blat: res?.resources.blat ?? 0,
        },
      );
      workerSystem.setCollectiveFocus(chairman.getRecommendedDirective());
    }
  }

  // ── 27. Sync + loss check ──
  syncSystemsToMeta({
    quota: ctx.state.quota,
    kgb: kgbAgent,
    political: politicalAgent,
    settlement,
    transport,
    politburo,
  });
  storeRef.resources.population = workerSystem.getPopulation();
  sanitizeFiniteRuntimeState(storeRef.resources, ctx.state.quota);

  if (
    storeRef.resources.population <= 0 &&
    chronology.getDate().totalTicks > TICKS_PER_YEAR &&
    buildingsLogic.entities.length > 0
  ) {
    ctx.endGame(false, 'All citizens have perished. The settlement is abandoned.');
  }

  callbacks.onStateChange();
}

const NUMERIC_RESOURCE_KEYS: Array<Exclude<keyof Resources, 'raion'>> = [
  'money',
  'food',
  'vodka',
  'power',
  'powerUsed',
  'population',
  'trudodni',
  'blat',
  'timber',
  'steel',
  'cement',
  'prefab',
  'seedFund',
  'emergencyReserve',
  'storageCapacity',
  'water',
];

function nonNegativeFinite(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, value);
}

export function sanitizeFiniteRuntimeState(resources: Resources, quota: QuotaState): void {
  for (const key of NUMERIC_RESOURCE_KEYS) {
    resources[key] = nonNegativeFinite(resources[key]);
  }
  if (resources.raion) {
    sanitizeRaionPool(resources.raion);
    resources.population = resources.raion.totalPopulation;
  }

  quota.current = nonNegativeFinite(quota.current);
  quota.target = Math.max(1, nonNegativeFinite(quota.target, 500));
  if (!Number.isFinite(quota.deadlineYear) || quota.deadlineYear < 1917) {
    quota.deadlineYear = 1927;
  } else {
    quota.deadlineYear = Math.round(quota.deadlineYear);
  }

  if (quota.resourceQuotas) {
    for (const resourceQuota of Object.values(quota.resourceQuotas)) {
      if (!resourceQuota) continue;
      resourceQuota.current = nonNegativeFinite(resourceQuota.current);
      resourceQuota.target = nonNegativeFinite(resourceQuota.target);
    }
  }
}

function sanitizeBucketArray(values: number[], length: number): number[] {
  const sanitized = values.slice(0, length);
  while (sanitized.length < length) sanitized.push(0);
  for (let i = 0; i < length; i++) {
    sanitized[i] = Math.round(nonNegativeFinite(sanitized[i] ?? 0));
  }
  return sanitized;
}

function sumBuckets(values: number[], start: number, end: number): number {
  let total = 0;
  for (let i = start; i <= end; i++) total += values[i] ?? 0;
  return total;
}

function sanitizeRaionPool(raion: RaionPool): void {
  raion.maleAgeBuckets = sanitizeBucketArray(raion.maleAgeBuckets, 20);
  raion.femaleAgeBuckets = sanitizeBucketArray(raion.femaleAgeBuckets, 20);
  raion.pregnancyWaves = sanitizeBucketArray(raion.pregnancyWaves, 3);

  const totalPopulation =
    raion.maleAgeBuckets.reduce((sum, value) => sum + value, 0) +
    raion.femaleAgeBuckets.reduce((sum, value) => sum + value, 0);
  const laborForce = sumBuckets(raion.maleAgeBuckets, 3, 12) + sumBuckets(raion.femaleAgeBuckets, 3, 12);

  raion.totalPopulation = totalPopulation;
  raion.laborForce = laborForce;
  raion.totalHouseholds = Math.round(nonNegativeFinite(raion.totalHouseholds));
  raion.birthsThisYear = Math.round(nonNegativeFinite(raion.birthsThisYear));
  raion.deathsThisYear = Math.round(nonNegativeFinite(raion.deathsThisYear));
  raion.totalBirths = Math.round(nonNegativeFinite(raion.totalBirths));
  raion.totalDeaths = Math.round(nonNegativeFinite(raion.totalDeaths));
  raion.assignedWorkers = Math.min(laborForce, Math.round(nonNegativeFinite(raion.assignedWorkers)));
  raion.idleWorkers = Math.max(0, laborForce - raion.assignedWorkers);
  raion.avgMorale = Math.min(100, nonNegativeFinite(raion.avgMorale, 50));
  raion.avgLoyalty = Math.min(100, nonNegativeFinite(raion.avgLoyalty, 50));
  raion.avgSkill = Math.min(100, nonNegativeFinite(raion.avgSkill, 30));

  for (const [key, value] of Object.entries(raion.classCounts)) {
    raion.classCounts[key] = Math.round(nonNegativeFinite(value));
  }
}

/** Sync game systems state to ECS meta entity. Used by phaseFinalize and serialization. */
export function syncSystemsToMeta(deps: SyncMetaDeps): void {
  const meta = getMetaEntity();
  if (!meta) return;

  meta.gameMeta.quota.type = deps.quota.type;
  meta.gameMeta.quota.target = deps.quota.target;
  meta.gameMeta.quota.current = deps.quota.current;
  meta.gameMeta.quota.deadlineYear = deps.quota.deadlineYear;
  const gs = deps.politburo.getGeneralSecretary();
  meta.gameMeta.leaderName = gs.name;
  meta.gameMeta.leaderPersonality = gs.personality;
  meta.gameMeta.blackMarks = deps.kgb.getBlackMarks();
  meta.gameMeta.commendations = deps.kgb.getCommendations();
  meta.gameMeta.threatLevel = deps.kgb.getThreatLevel();
  meta.gameMeta.settlementTier = deps.settlement.getCurrentTier();
  meta.gameMeta.currentEra = deps.political.getCurrentEraId();
  meta.gameMeta.roadQuality = deps.transport.getQuality();
  meta.gameMeta.roadCondition = deps.transport.getCondition();
}
