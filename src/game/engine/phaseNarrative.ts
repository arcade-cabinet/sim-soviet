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
import { CONSEQUENCE_PRESETS } from '../../ai/agents/political/ScoringSystem';
import { getResourceEntity } from '../../ecs/archetypes';
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
