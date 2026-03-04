/**
 * phaseFinalize — tick steps 26, 27
 *
 * Autopilot chairman assessment, system-to-meta sync, loss check.
 */

import { buildingsLogic, getMetaEntity, getResourceEntity } from '../../ecs/archetypes';
import { TICKS_PER_YEAR } from '../Chronology';
import type { TickContext } from './tickContext';

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
  syncSystemsToMeta(ctx);
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

/** Sync game systems state to ECS meta entity. */
function syncSystemsToMeta(ctx: TickContext): void {
  const meta = getMetaEntity();
  if (!meta) return;
  const { chronology, kgb: kgbAgent, political: politicalAgent } = ctx.agents;
  const { settlement, transport, politburo } = ctx.systems;

  meta.gameMeta.quota.type = ctx.state.quota.type;
  meta.gameMeta.quota.target = ctx.state.quota.target;
  meta.gameMeta.quota.current = ctx.state.quota.current;
  meta.gameMeta.quota.deadlineYear = ctx.state.quota.deadlineYear;
  const gs = politburo.getGeneralSecretary();
  meta.gameMeta.leaderName = gs.name;
  meta.gameMeta.leaderPersonality = gs.personality;
  meta.gameMeta.blackMarks = kgbAgent.getBlackMarks();
  meta.gameMeta.commendations = kgbAgent.getCommendations();
  meta.gameMeta.threatLevel = kgbAgent.getThreatLevel();
  meta.gameMeta.settlementTier = settlement.getCurrentTier();
  meta.gameMeta.currentEra = politicalAgent.getCurrentEraId();
  meta.gameMeta.roadQuality = transport.getQuality();
  meta.gameMeta.roadCondition = transport.getCondition();
}
