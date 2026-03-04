/**
 * phaseFinalize — tick steps 26, 27
 *
 * Autopilot chairman assessment, system-to-meta sync, loss check.
 */

import type { SettlementTier } from '../../ai/agents/infrastructure/SettlementSystem';
import type { RoadQuality } from '../../ai/agents/infrastructure/TransportSystem';
import type { QuotaState } from '../../ai/agents/political/PoliticalAgent';
import { buildingsLogic, getMetaEntity, getResourceEntity } from '../../ecs/archetypes';
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
  const { agentManager, workerSystem, settlement, scoring, transport, politburo } = ctx.systems;

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

  if (
    storeRef.resources.population <= 0 &&
    chronology.getDate().totalTicks > TICKS_PER_YEAR &&
    buildingsLogic.entities.length > 0
  ) {
    ctx.endGame(false, 'All citizens have perished. The settlement is abandoned.');
  }

  callbacks.onStateChange();
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
