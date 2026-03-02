/**
 * @fileoverview ChairmanAgent — The player's Yuka agent.
 *
 * In autopilot mode, uses GoalEvaluator + FuzzyModule to make all
 * player decisions (minigames, annual reports, directives).
 * In player mode, receives telegrams and surfaces them as UI events.
 */

import { Vehicle } from 'yuka';

/**
 * The Chairman — player avatar or autopilot AI.
 * Extends Yuka Vehicle for goal-driven decision making.
 */
export class ChairmanAgent extends Vehicle {
  constructor() {
    super();
    this.name = 'ChairmanAgent';
  }
}
