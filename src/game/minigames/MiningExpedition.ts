/**
 * @fileoverview Mining Expedition -- RNG-driven auto-resolve logic for the
 * mountain mining minigame.
 *
 * When the player ignores the minigame (or it times out), this module
 * provides a weighted-random outcome instead of a single static result.
 *
 * Outcome tiers:
 *   - Success   (60%): bonus steel/cement resources (represented as money)
 *   - Partial   (25%): small resource gain
 *   - Disaster  (15%): cave-in — lose 1-3 workers, small resource gain
 *
 * Uses the seeded GameRng for deterministic results.
 */

import type { GameRng } from '../SeedSystem';
import type { MinigameOutcome } from './MinigameTypes';

// ─────────────────────────────────────────────────────────
//  OUTCOME WEIGHTS
// ─────────────────────────────────────────────────────────

/** Probability thresholds for auto-resolve tiers. */
const SUCCESS_THRESHOLD = 0.6;
const PARTIAL_THRESHOLD = 0.85; // 0.6 + 0.25

// ─────────────────────────────────────────────────────────
//  AUTO-RESOLVE
// ─────────────────────────────────────────────────────────

/**
 * RNG-driven auto-resolve for the mining expedition.
 *
 * Instead of a single static outcome, rolls against weighted tiers
 * to produce variable results — rewarding the mountain's fickleness.
 */
export function autoResolveMiningExpedition(rng: GameRng): MinigameOutcome {
  const roll = rng.random();

  if (roll < SUCCESS_THRESHOLD) {
    return miningSuccess(rng);
  }

  if (roll < PARTIAL_THRESHOLD) {
    return miningPartial(rng);
  }

  return miningDisaster(rng);
}

// ─────────────────────────────────────────────────────────
//  TIER OUTCOMES
// ─────────────────────────────────────────────────────────

/** Success (60%): significant resource haul. */
function miningSuccess(rng: GameRng): MinigameOutcome {
  const money = rng.int(25, 45);
  return {
    resources: { money },
    announcement: 'The miners struck a rich vein of iron ore. The mountain yielded its treasure willingly — for once.',
  };
}

/** Partial (25%): modest gains, nothing dramatic. */
function miningPartial(rng: GameRng): MinigameOutcome {
  const money = rng.int(5, 15);
  return {
    resources: { money },
    announcement:
      'The expedition returned with a cart of mediocre stone. The geologist calls it "promising." Nobody believes him.',
  };
}

/** Disaster (15%): cave-in with worker casualties and minimal resources. */
function miningDisaster(rng: GameRng): MinigameOutcome {
  const casualties = rng.int(1, 3);
  const money = rng.int(2, 6);
  return {
    resources: { money, population: -casualties },
    blackMarks: 1,
    announcement:
      `Cave-in at shaft level three. ${casualties} miner${casualties > 1 ? 's' : ''} did not return. ` +
      'The mountain keeps what it takes. Safety commission blames saboteurs.',
    severity: 'critical',
  };
}
