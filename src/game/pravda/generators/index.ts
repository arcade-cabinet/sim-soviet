import type { GameEvent } from '../../events';
import type { GameView } from '../../GameView';
import { coinFlip, getPravdaRng, pick } from '../helpers';
import { categoryFromEvent, spinEventEffects } from '../spin';
import type { GeneratedHeadline, HeadlineGenerator } from '../types';
import {
  DESTRUCTION_SPINS,
  INSTITUTIONS,
  LEADER_TITLES,
  QUALIFIERS,
  WESTERN_COUNTRIES,
} from '../wordPools';
import { contextualGenerators } from './absurdist';
import { culturalVictoryGenerators } from './cultural';
import { weatherFillerGenerators } from './daily';
import { internalTriumphGenerators, resourceSpinGenerators } from './economic';
import { externalThreatGenerators } from './military';
import { leaderPraiseGenerators } from './political';

// ─────────────────────────────────────────────────────────
//  HEADLINE COMPOSITION ENGINE
//
//  Selects from generator pools with weighted randomness,
//  preferring contextual generators when game state is
//  interesting. Falls back to generic generators otherwise.
// ─────────────────────────────────────────────────────────

export const ALL_GENERIC_GENERATORS: { generators: HeadlineGenerator[]; weight: number }[] = [
  { generators: externalThreatGenerators, weight: 2.5 },
  { generators: internalTriumphGenerators, weight: 2.0 },
  { generators: leaderPraiseGenerators, weight: 1.5 },
  { generators: culturalVictoryGenerators, weight: 1.5 },
  { generators: resourceSpinGenerators, weight: 1.0 },
  { generators: weatherFillerGenerators, weight: 1.5 },
];

export function generateHeadline(gs: GameView): GeneratedHeadline {
  const rng = getPravdaRng();

  // First, check contextual generators (state-reactive)
  const eligibleContextual = contextualGenerators.filter((cg) => cg.condition(gs));

  // 40% chance to use a contextual generator if any are eligible
  if (eligibleContextual.length > 0 && coinFlip(0.4)) {
    const totalWeight = eligibleContextual.reduce((sum, cg) => sum + cg.weight, 0);
    let roll = (rng?.random() ?? Math.random()) * totalWeight;
    for (const cg of eligibleContextual) {
      roll -= cg.weight;
      if (roll <= 0) {
        return cg.generate(gs);
      }
    }
    // Fallback to first eligible
    return eligibleContextual[0]!.generate(gs);
  }

  // Otherwise, pick from generic generator pools
  const totalWeight = ALL_GENERIC_GENERATORS.reduce((sum, g) => sum + g.weight, 0);
  let roll = (rng?.random() ?? Math.random()) * totalWeight;
  for (const pool of ALL_GENERIC_GENERATORS) {
    roll -= pool.weight;
    if (roll <= 0) {
      return pick(pool.generators)(gs);
    }
  }

  // Ultimate fallback
  return pick(weatherFillerGenerators)(gs);
}

// ─────────────────────────────────────────────────────────
//  EVENT-REACTIVE HEADLINE GENERATOR
//
//  When a game event fires, this generates a Pravda-style
//  headline that reframes the event through propaganda.
//  The event already has a pravdaHeadline field, but this
//  system can also generate a FRESH spin on any event.
// ─────────────────────────────────────────────────────────

export function generateEventReactiveHeadline(event: GameEvent, gs: GameView): GeneratedHeadline {
  // For bad events, sometimes generate an external threat headline
  // to distract from internal problems (the classic Pravda move)
  if (event.type === 'bad' && coinFlip(0.35)) {
    const distraction = pick(externalThreatGenerators)(gs);
    return {
      ...distraction,
      // Append a subtle reference to the actual event
      subtext: `${distraction.subtext} (Unrelated: minor ${event.category} adjustment in progress.)`,
    };
  }

  // For disaster events, sometimes spin the destruction as urban renewal
  if (event.category === 'disaster' && coinFlip(0.3)) {
    return {
      headline: pick(DESTRUCTION_SPINS),
      subtext: `${pick(INSTITUTIONS)} confirms: this was always the plan. The plan is flexible.`,
      reality: event.description,
      category: 'triumph',
    };
  }

  // For catastrophic events, ALWAYS distract with external threats
  if (event.severity === 'catastrophic') {
    const distraction = pick(externalThreatGenerators)(gs);
    return {
      ...distraction,
      subtext: `ALERT: ${pick(WESTERN_COUNTRIES)} threatens peace. All domestic matters: handled.`,
      reality: `Meanwhile: ${event.description}`,
    };
  }

  // For good events, amplify the triumph
  if (event.type === 'good') {
    return {
      headline: `${pick(INSTITUTIONS)} CONFIRMS: ${event.pravdaHeadline}`,
      subtext: `${pick(LEADER_TITLES)} personally ensured this outcome ${pick(QUALIFIERS).toLowerCase()}.`,
      reality: event.description,
      category: 'triumph',
    };
  }

  // Default: use the event's built-in headline with generated spin
  return {
    headline: event.pravdaHeadline,
    subtext: spinEventEffects(event),
    reality: event.description,
    category: categoryFromEvent(event.category),
  };
}

// Re-export generator arrays for external use
export {
  contextualGenerators,
  culturalVictoryGenerators,
  externalThreatGenerators,
  internalTriumphGenerators,
  leaderPraiseGenerators,
  resourceSpinGenerators,
  weatherFillerGenerators,
};
