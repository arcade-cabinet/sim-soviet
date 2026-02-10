/**
 * @fileoverview Per-worker tick processing: vodka, food, morale, defection,
 * production efficiency, and class-specific bonus logic.
 */

import type { CitizenComponent } from '@/ecs/world';
import type { GameRng } from '@/game/SeedSystem';
import {
  CLASS_PRODUCTION_BONUS,
  DEFECTION_BASE_CHANCE,
  DEFECTION_LOYALTY_THRESHOLD,
  FACTORY_PREFIXES,
  FARM_PREFIXES,
  FIRST_NAMES_FEMALE,
  FIRST_NAMES_MALE,
  FOOD_PER_WORKER,
  HOUSING_MORALE_BOOST,
  HUNGER_MORALE_PENALTY,
  PARTY_MORALE_BOOST,
  PATRONYMICS_FEMALE,
  PATRONYMICS_MALE,
  PRISONER_ESCAPE_CHANCE,
  SKILL_GROWTH_RATE,
  STAKHANOVITE_CHANCE,
  STAKHANOVITE_MORALE_THRESHOLD,
  UNHOUSED_MORALE_PENALTY,
  VODKA_DEPENDENCY_GROWTH,
  VODKA_MORALE_BOOST,
  VODKA_PER_WORKER,
  VODKA_WITHDRAWAL_PENALTY,
} from './constants';
import type { TickContext, WorkerDisplayInfo, WorkerStats, WorkerTickResult } from './types';

// ─────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────

/** Clamp a value between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Calculate class-specific production bonus for a given assignment. */
export function calcClassBonus(
  cls: CitizenComponent['class'],
  assignment: string | undefined
): number {
  if (!assignment) return 0;
  if (cls === 'engineer' && FACTORY_PREFIXES.some((p) => assignment.startsWith(p))) {
    return CLASS_PRODUCTION_BONUS.engineer;
  }
  if (cls === 'farmer' && FARM_PREFIXES.some((p) => assignment.startsWith(p))) {
    return CLASS_PRODUCTION_BONUS.farmer;
  }
  if (cls === 'party_official') return CLASS_PRODUCTION_BONUS.party_official;
  if (cls === 'prisoner') return CLASS_PRODUCTION_BONUS.prisoner;
  return 0;
}

/** Calculate base production efficiency from morale and skill. */
export function calcBaseEfficiency(morale: number, skill: number): number {
  return (morale / 100) * (0.5 + (skill / 100) * 0.5);
}

/** Determine worker display status. */
export function resolveStatus(
  citizen: CitizenComponent,
  stats: WorkerStats
): WorkerDisplayInfo['status'] {
  if (stats.loyalty < DEFECTION_LOYALTY_THRESHOLD) return 'defecting';
  if (citizen.hunger > 70) return 'hungry';
  if (stats.ticksSinceVodka > 10 && stats.vodkaDependency > 50) return 'drunk';
  if (citizen.assignment) return 'working';
  return 'idle';
}

/** Generate a Soviet-appropriate name using seeded RNG. */
export function generateWorkerName(rng: GameRng): string {
  const isMale = rng.coinFlip();
  if (isMale) {
    return `${rng.pick(FIRST_NAMES_MALE)} ${rng.pick(PATRONYMICS_MALE)}`;
  }
  return `${rng.pick(FIRST_NAMES_FEMALE)} ${rng.pick(PATRONYMICS_FEMALE)}`;
}

// ─────────────────────────────────────────────────────────
//  PER-WORKER TICK PROCESSORS
// ─────────────────────────────────────────────────────────

/** Process vodka consumption for a single worker. */
export function processVodka(
  stats: WorkerStats,
  cls: CitizenComponent['class'],
  ctx: TickContext
): void {
  if (cls === 'prisoner' || stats.vodkaDependency <= 0) return;
  const vodkaWanted = VODKA_PER_WORKER * (stats.vodkaDependency / 50);
  if (ctx.remainingVodka >= vodkaWanted) {
    ctx.remainingVodka -= vodkaWanted;
    ctx.vodkaConsumed += vodkaWanted;
    stats.ticksSinceVodka = 0;
    stats.morale = Math.min(100, stats.morale + VODKA_MORALE_BOOST);
    stats.vodkaDependency = Math.min(100, stats.vodkaDependency + VODKA_DEPENDENCY_GROWTH);
  } else {
    stats.ticksSinceVodka++;
    stats.morale = Math.max(0, stats.morale - VODKA_WITHDRAWAL_PENALTY);
    stats.loyalty = Math.max(0, stats.loyalty - 0.5);
  }
}

/** Process food consumption for a single worker. */
export function processFood(citizen: CitizenComponent, stats: WorkerStats, ctx: TickContext): void {
  if (ctx.remainingFood >= FOOD_PER_WORKER) {
    ctx.remainingFood -= FOOD_PER_WORKER;
    ctx.foodConsumed += FOOD_PER_WORKER;
    citizen.hunger = Math.max(0, citizen.hunger - 5);
  } else {
    citizen.hunger = Math.min(100, citizen.hunger + 10);
    stats.morale = Math.max(0, stats.morale - HUNGER_MORALE_PENALTY);
    stats.loyalty = Math.max(0, stats.loyalty - 1);
  }
}

/** Apply morale adjustments for housing and party officials. */
export function applyMorale(
  citizen: CitizenComponent,
  stats: WorkerStats,
  partyOfficialCount: number
): void {
  if (citizen.home) {
    stats.morale = Math.min(100, stats.morale + HOUSING_MORALE_BOOST);
  } else {
    stats.morale = Math.max(0, stats.morale - UNHOUSED_MORALE_PENALTY);
  }
  if (partyOfficialCount > 0 && citizen.class !== 'party_official') {
    stats.morale = Math.min(100, stats.morale + partyOfficialCount * PARTY_MORALE_BOOST);
  }
  stats.morale = clamp(stats.morale, 0, 100);
  citizen.happiness = Math.round(stats.morale);
}

/** Check if a worker should defect or escape. Returns true if they should be removed. */
export function checkDefection(
  cls: CitizenComponent['class'],
  stats: WorkerStats,
  rng: GameRng | null
): boolean {
  if (cls === 'prisoner') {
    return !!rng?.coinFlip(PRISONER_ESCAPE_CHANCE);
  }
  if (stats.loyalty < DEFECTION_LOYALTY_THRESHOLD) {
    const chance = DEFECTION_BASE_CHANCE * (1 - stats.loyalty / DEFECTION_LOYALTY_THRESHOLD);
    return !!rng?.coinFlip(chance);
  }
  return false;
}

/** Check for stakhanovite event and apply skill growth for assigned workers. */
export function processProductionAndGrowth(
  stats: WorkerStats,
  assignment: string | undefined,
  cls: CitizenComponent['class'],
  rng: GameRng | null,
  stakhanovites: WorkerTickResult['stakhanovites']
): number {
  const efficiency = clamp(
    calcBaseEfficiency(stats.morale, stats.skill) + calcClassBonus(cls, assignment),
    0,
    1.5
  );
  if (rng && assignment && stats.morale > STAKHANOVITE_MORALE_THRESHOLD) {
    if (rng.coinFlip(STAKHANOVITE_CHANCE)) {
      stakhanovites.push({ name: stats.name, class: cls });
    }
  }
  if (assignment) {
    stats.skill = Math.min(100, stats.skill + SKILL_GROWTH_RATE);
    stats.assignmentDuration++;
  }
  return efficiency;
}

/** Create a zero-initialized record keyed by citizen class. */
export function emptyClassRecord(): Record<CitizenComponent['class'], number> {
  return {
    worker: 0,
    engineer: 0,
    farmer: 0,
    party_official: 0,
    soldier: 0,
    prisoner: 0,
  };
}
