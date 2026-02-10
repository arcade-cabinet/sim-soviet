/**
 * @module game/politburo/ministers
 *
 * Name generation, minister/GS creation, and RNG utility functions.
 * Houses the module-level _rng pattern.
 */

import type { GameRng } from '../SeedSystem';
import { FIRST_NAMES, LAST_NAMES, PERSONALITY_STAT_RANGES } from './constants';
import type { GeneralSecretary, Minister, MinistryEventTemplate } from './types';
import { type Ministry, PersonalityType } from './types';

// ─────────────────────────────────────────────────────────────────────────────
//  MODULE-LEVEL RNG
// ─────────────────────────────────────────────────────────────────────────────

/** Module-level RNG reference, set by PolitburoSystem constructor */
let _rng: GameRng | null = null;

export function setRng(rng: GameRng): void {
  _rng = rng;
}

export function getRng(): GameRng | null {
  return _rng;
}

// ─────────────────────────────────────────────────────────────────────────────
//  RNG UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

export function pick<T>(arr: T[]): T {
  return _rng ? _rng.pick(arr) : arr[Math.floor(Math.random() * arr.length)]!;
}

export function randInt(min: number, max: number): number {
  return _rng ? _rng.int(min, max) : Math.floor(Math.random() * (max - min + 1)) + min;
}

export function random(): number {
  return _rng?.random() ?? Math.random();
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ─────────────────────────────────────────────────────────────────────────────
//  NAME & ID GENERATION
// ─────────────────────────────────────────────────────────────────────────────

function generateName(): string {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

export function generateId(): string {
  return _rng
    ? `${Date.now()}_${_rng.id()}`
    : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function randomPersonality(): PersonalityType {
  const types = Object.values(PersonalityType);
  return pick(types);
}

// ─────────────────────────────────────────────────────────────────────────────
//  MINISTER GENERATION
// ─────────────────────────────────────────────────────────────────────────────

export function generateMinister(ministry: Ministry, personality?: PersonalityType): Minister {
  const p = personality ?? randomPersonality();
  const ranges = PERSONALITY_STAT_RANGES[p];

  return {
    id: generateId(),
    name: generateName(),
    ministry,
    personality: p,
    loyalty: randInt(...ranges.loyalty),
    competence: randInt(...ranges.competence),
    ambition: randInt(...ranges.ambition),
    corruption: randInt(...ranges.corruption),
    tenure: 0,
    factionId: null,
    survivedTransition: false,
    purgeRisk: 0,
  };
}

export function generateGeneralSecretary(
  year: number,
  personality?: PersonalityType
): GeneralSecretary {
  const p = personality ?? randomPersonality();
  return {
    id: generateId(),
    name: generateName(),
    personality: p,
    paranoia:
      p === PersonalityType.ZEALOT
        ? randInt(60, 90)
        : p === PersonalityType.MILITARIST
          ? randInt(50, 80)
          : p === PersonalityType.APPARATCHIK
            ? randInt(30, 60)
            : p === PersonalityType.REFORMER
              ? randInt(20, 40)
              : randInt(20, 60),
    health: randInt(60, 95),
    age: randInt(55, 75),
    yearAppointed: year,
    alive: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  WEIGHTED SELECT
// ─────────────────────────────────────────────────────────────────────────────

/** Weighted random selection from ministry event templates. */
export function weightedSelect(eligible: MinistryEventTemplate[]): MinistryEventTemplate {
  const totalWeight = eligible.reduce((sum, t) => sum + (t.weight ?? 1), 0);
  let roll = random() * totalWeight;
  for (const template of eligible) {
    roll -= template.weight ?? 1;
    if (roll <= 0) return template;
  }
  return pick(eligible);
}
