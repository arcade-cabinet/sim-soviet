/**
 * @fileoverview ChairmanAgent — The player's Yuka agent.
 *
 * In autopilot mode, uses goal evaluator functions to make
 * all player decisions (minigames, annual reports, directives).
 * In player mode, receives telegrams and surfaces them as UI events.
 */

import { Vehicle } from 'yuka';
import { evaluateSurvival } from '../goals/SurvivalGoal';
import { evaluateQuota } from '../goals/QuotaGoal';
import { evaluatePolitical, type PoliticalInputs } from '../goals/PoliticalGoal';
import { evaluateGrowth } from '../goals/GrowthGoal';
import { evaluateDefense } from '../goals/DefenseGoal';
import type { CollectiveFocus } from './infrastructure/CollectiveAgent';

/** Simplified minigame choice for AI evaluation. */
interface AIMinigameChoice {
  id: string;
  successChance: number;
  onSuccess: { blackMarks?: number; commendations?: number; blat?: number };
  onFailure: { blackMarks?: number; commendations?: number; blat?: number };
}

/** Game state context for goal evaluation. */
interface GameContext {
  quotaProgress?: number;
  quotaDeadlineMonths?: number;
  blackMarks?: number;
  commendations?: number;
  blat?: number;
  kgbAggression?: 'low' | 'medium' | 'high';
  housingUtilization?: number;
  activeFires?: number;
  activeMeteors?: number;
  activeOutbreaks?: number;
}

/**
 * The Chairman — player avatar or autopilot AI.
 * Extends Yuka Vehicle for compatibility with EntityManager.
 *
 * Goal arbitration: evaluates all 5 goals each tick, picks the
 * highest desirability, and recommends a CollectiveFocus directive.
 */
export class ChairmanAgent extends Vehicle {
  /** Current goal desirability scores. */
  private scores = {
    survival: 0,
    quota: 0,
    political: 0,
    growth: 0,
    defense: 0,
  };

  /** Current political state for minigame/report decisions. */
  private politicalState: PoliticalInputs = {
    blackMarks: 0,
    commendations: 0,
    blat: 0,
  };

  /** Yuka Think brain reference (for future Phase 2+ integration). */
  brain = {};

  constructor() {
    super();
    this.name = 'ChairmanAgent';
  }

  /**
   * Assess current game state and compute goal desirability scores.
   *
   * @param resources - Current resource levels (food, population, etc.)
   * @param context - Additional game context (quota, political, emergencies)
   */
  assessGameState(
    resources: { food?: number; population?: number; [key: string]: unknown },
    context?: GameContext,
  ): void {
    const pop = (resources.population as number) ?? 0;
    const food = (resources.food as number) ?? 0;
    const foodPerCapita = pop > 0 ? food / pop : 999;

    this.scores.survival = evaluateSurvival({ foodPerCapita, population: pop });
    this.scores.quota = evaluateQuota({
      quotaProgress: context?.quotaProgress ?? 0.5,
      quotaDeadlineMonths: context?.quotaDeadlineMonths ?? 12,
    });
    this.scores.political = evaluatePolitical({
      blackMarks: context?.blackMarks ?? 0,
      commendations: context?.commendations ?? 0,
      blat: context?.blat ?? 0,
      kgbAggression: context?.kgbAggression,
    });
    this.scores.growth = evaluateGrowth({
      housingUtilization: context?.housingUtilization ?? 0.5,
      foodPerCapita,
      population: pop,
    });
    this.scores.defense = evaluateDefense({
      activeFires: context?.activeFires ?? 0,
      activeMeteors: context?.activeMeteors ?? 0,
      activeOutbreaks: context?.activeOutbreaks ?? 0,
    });

    this.politicalState = {
      blackMarks: context?.blackMarks ?? 0,
      commendations: context?.commendations ?? 0,
      blat: context?.blat ?? 0,
      kgbAggression: context?.kgbAggression,
    };
  }

  /**
   * Get the recommended CollectiveFocus based on current goal scores.
   *
   * @returns The directive the ChairmanAgent recommends
   */
  getRecommendedDirective(): CollectiveFocus {
    const { survival, quota, growth, defense } = this.scores;

    // Defense overrides everything during emergencies
    if (defense > 0.7) return 'food'; // Redirect to food during emergencies

    // Survival is the highest priority
    if (survival > quota && survival > growth) return 'food';

    // Quota urgency
    if (quota > growth && quota > 0.4) return quota > 0.7 ? 'production' : 'construction';

    // Default to balanced growth
    return 'balanced';
  }

  /**
   * Resolve a minigame by choosing the option with best expected value.
   *
   * EV(choice) = successChance * value(onSuccess) + (1-successChance) * value(onFailure)
   * value = commendations + blat - (blackMarks * politicalRiskWeight)
   *
   * @param choices - Available minigame choices
   * @returns ID of the chosen option
   */
  resolveMinigame(choices: AIMinigameChoice[]): string {
    // Political risk weight increases when marks are high
    const markRatio = this.politicalState.blackMarks / 5;
    const riskWeight = 1 + markRatio * 2; // 1x at 0 marks, 3x at 5 marks

    let bestId = choices[0]?.id ?? 'comply';
    let bestEV = -Infinity;

    for (const choice of choices) {
      const successValue =
        (choice.onSuccess.commendations ?? 0) +
        (choice.onSuccess.blat ?? 0) -
        (choice.onSuccess.blackMarks ?? 0) * riskWeight;

      const failureValue =
        (choice.onFailure.commendations ?? 0) +
        (choice.onFailure.blat ?? 0) -
        (choice.onFailure.blackMarks ?? 0) * riskWeight;

      const ev = choice.successChance * successValue + (1 - choice.successChance) * failureValue;

      if (ev > bestEV) {
        bestEV = ev;
        bestId = choice.id;
      }
    }

    return bestId;
  }

  /**
   * Decide annual report strategy.
   *
   * @param quotaPercent - How much of the quota was met (0-1)
   * @returns Whether to submit an honest report
   */
  resolveAnnualReport(quotaPercent: number): boolean {
    // Easy case: quota met, be honest
    if (quotaPercent >= 1.0) return true;

    // Moderate shortfall: falsify if political risk is low
    if (quotaPercent >= 0.6) {
      return this.politicalState.blackMarks >= 3; // Honest if already at risk
    }

    // Large shortfall: honest (falsification too obvious)
    return true;
  }

  /** Get current goal scores for debugging/UI. */
  getScores(): typeof this.scores {
    return { ...this.scores };
  }
}
