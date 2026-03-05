/**
 * phaseNarrative — tick steps 24, 25
 *
 * Minigames, events, fire, politburo, pravda, KGB,
 * tutorial, directives, achievements.
 */

import type { WeatherType } from '../../ai/agents/core/weather-types';
import {
  tickAchievements as tickAchievementsHelper,
  tickTutorial as tickTutorialHelper,
} from '../../ai/agents/meta/achievementTick';
import { tickDirectives as tickDirectivesHelper } from '../../ai/agents/meta/directiveTick';
import { tickMinigames as tickMinigamesHelper } from '../../ai/agents/meta/minigameTick';
import { applyMeteorImpact, rollMeteorStrike } from '../../ai/agents/crisis/meteorStrike';
import {
  completeProject,
  demandPrestigeProject,
  startConstruction,
  tickConstruction,
} from '../../ai/agents/narrative/prestigeLifecycle';
import { CONSEQUENCE_PRESETS } from '../../ai/agents/political/ScoringSystem';
import { getCurrentGridSize } from '../../config';
import { buildingsLogic, getResourceEntity } from '../../ecs/archetypes';
import type { TickContext } from './tickContext';

/**
 * Run narrative phase: minigames, events, fire, politburo, pravda, KGB, tutorials, achievements.
 *
 * Steps 24-25 of the tick loop.
 */
export function phaseNarrative(ctx: TickContext): void {
  const { tickResult, callbacks, rng } = ctx;
  const { chronology, kgb: kgbAgent, defense: defenseAgent } = ctx.agents;
  const {
    eventSystem,
    politburo,
    pravda: pravdaSystem,
    scoring,
    minigameRouter,
    tutorial,
    achievements,
    workerSystem,
    agentManager,
  } = ctx.systems;
  const { eraMods } = ctx.modifiers;

  // ── 24. Minigames + events + fire + politburo + pravda + KGB ──
  tickMinigamesHelper({
    chronology,
    minigameRouter,
    personnelFile: kgbAgent,
    callbacks,
  });
  eventSystem.tick(chronology.getDate().totalTicks, eraMods.eventFrequencyMult);
  defenseAgent.update(
    1,
    tickResult.weather as WeatherType,
    ctx.grid,
    chronology.getDate().totalTicks,
    chronology.getDate().month,
  );
  politburo.setCorruptionMult(eraMods.corruptionMult);
  politburo.tick(tickResult);

  // Pravda ambient headlines
  const headline = pravdaSystem.generateAmbientHeadline();
  if (headline) callbacks.onPravda(headline.headline);

  // KGB personnel file tick
  const totalTicks = chronology.getDate().totalTicks;
  kgbAgent.tickPersonnelFile(totalTicks);

  // Threat level tracking for scoring
  const currentThreat = kgbAgent.getThreatLevel();
  if (
    (currentThreat === 'investigated' || currentThreat === 'reviewed' || currentThreat === 'arrested') &&
    ctx.state.lastThreatLevel !== 'investigated' &&
    ctx.state.lastThreatLevel !== 'reviewed' &&
    ctx.state.lastThreatLevel !== 'arrested'
  ) {
    scoring.onInvestigation();
  }
  ctx.state.lastThreatLevel = currentThreat;

  // Autopilot bribery: when KGB threat escalates, attempt bribe if chairman recommends it
  if (agentManager.isAutopilot()) {
    const chairman = agentManager.getChairman();
    if (chairman) {
      const bribeDecision = chairman.shouldAttemptBribe();
      if (bribeDecision.shouldBribe) {
        const res = getResourceEntity();
        if (res && res.resources.blat >= 2) {
          kgbAgent.handleBribeOffer(bribeDecision.amount);
          res.resources.blat = Math.max(0, res.resources.blat - 2);
          callbacks.onToast('Autopilot: blat exchanged to reduce KGB suspicion', 'warning');
        }
      }
    }
  }

  // Arrest check
  if (kgbAgent.isArrested()) {
    const consequenceConfig = CONSEQUENCE_PRESETS[scoring.getConsequence()];
    if (consequenceConfig.permadeath) {
      ctx.endGame(
        false,
        'Your personnel file has been reviewed. You have been declared an Enemy of the People. No further correspondence is expected.',
      );
    } else {
      kgbAgent.applyRehabilitation(consequenceConfig, {
        grid: ctx.grid,
        rng,
        workers: workerSystem,
        scoring,
        chronology,
        callbacks,
      });
    }
  }

  // ── 24b. Prestige project lifecycle (yearly tick) ──
  if (ctx.tickResult.newYear) {
    tickPrestigeProjects(ctx);
  }

  // ── 24c. Meteor strike (yearly roll, any mode) ──
  if (ctx.tickResult.newYear) {
    const year = chronology.getDate().year;
    const strike = rollMeteorStrike(rng, year);
    if (strike) {
      const gridSize = getCurrentGridSize();
      const impact = applyMeteorImpact(strike.targetX, strike.targetY, gridSize);
      // Destroy buildings on impacted tiles by zeroing durability (decay system removes them)
      for (const tile of impact.destroyedTiles) {
        for (const entity of buildingsLogic.entities) {
          if (entity.position.gridX === tile.x && entity.position.gridY === tile.y) {
            if ('durability' in entity && entity.durability) {
              (entity.durability as { current: number }).current = 0;
            }
          }
        }
      }
      callbacks.onPravda(
        `METEORITE IMPACT at sector (${strike.targetX},${strike.targetY})! ` +
          `${impact.destroyedTiles.length} tiles destroyed. ${impact.resourceDeposit} deposit discovered.`,
      );
      callbacks.onToast(`Meteor strike! ${impact.resourceDeposit} deposit found`, 'warning');
    }
  }

  // ── 25. Tutorial + directives + achievements ──
  const achievementCtx = {
    chronology,
    achievements,
    tutorial,
    callbacks,
  };
  tickTutorialHelper(achievementCtx);
  tickDirectivesHelper({ callbacks });
  tickAchievementsHelper(achievementCtx);
}

/**
 * Prestige project lifecycle: demand announcement, construction start/tick, completion.
 * Runs once per year during the narrative phase.
 */
function tickPrestigeProjects(ctx: TickContext): void {
  const { callbacks, rng, storeRef } = ctx;
  const { chronology, political: politicalAgent } = ctx.agents;
  const currentEra = politicalAgent.getCurrentEraId();
  const year = chronology.getDate().year;

  // If no demand yet for this era, announce it
  if (!ctx.state.prestigeDemand || ctx.state.prestigeDemand.era !== currentEra) {
    const demand = demandPrestigeProject(currentEra, rng);
    if (!demand) return; // Sub-eras have no prestige projects
    ctx.state.prestigeDemand = demand;
    ctx.state.prestigeConstruction = null;
    callbacks.onPravda(
      `Politburo mandates: ${demand.project.name}! Construction to begin by ${demand.announcementYear}.`,
    );
  }

  const demand = ctx.state.prestigeDemand;
  if (!demand) return;

  // If construction hasn't started and we've reached the announcement year, try to start
  if (!ctx.state.prestigeConstruction && year >= demand.announcementYear) {
    // Check required buildings exist
    const existingDefIds = new Set<string>();
    for (const entity of buildingsLogic.entities) {
      existingDefIds.add(entity.building.defId);
    }
    const hasRequired = demand.project.requiredBuildings.every((id) => existingDefIds.has(id));
    if (!hasRequired) return;

    const resources = {
      money: storeRef.resources.money,
      food: storeRef.resources.food,
      power: storeRef.resources.power,
    };
    const construction = startConstruction(demand.project, resources, year);
    if (construction) {
      // Deduction happened in-place on the resources object; write back
      storeRef.resources.money = resources.money;
      storeRef.resources.food = resources.food;
      storeRef.resources.power = resources.power;
      ctx.state.prestigeConstruction = construction;
      callbacks.onToast(`Construction begun: ${demand.project.name}`, 'warning');
    }
    return;
  }

  // If construction is in progress, advance it
  if (ctx.state.prestigeConstruction) {
    ctx.state.prestigeConstruction = tickConstruction(ctx.state.prestigeConstruction);

    // Check completion
    const result = completeProject(ctx.state.prestigeConstruction);
    if (result.success && result.rewards) {
      storeRef.resources.blat += result.rewards.politicalCapital;
      callbacks.onPravda(`${demand.project.name} completed! The Politburo commends your leadership.`);
      callbacks.onToast(`Prestige project complete: ${demand.project.name}`, 'warning');
      ctx.state.prestigeConstruction = null;
    }
  }
}
