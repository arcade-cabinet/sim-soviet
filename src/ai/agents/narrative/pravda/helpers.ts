import { getBuildingDef } from '@/data/buildingDefs';
import type { Building } from '../../../../game/GameView';
import type { GameRng } from '../../../../game/SeedSystem';

// ─────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────

/** Module-level RNG reference, set by PravdaSystem constructor */
let _rng: GameRng | null = null;

/** Set the module-level seeded RNG for deterministic headline generation. */
export function setPravdaRng(rng: GameRng): void {
  _rng = rng;
}

/** Get the current module-level seeded RNG (may be null if not initialized). */
export function getPravdaRng(): GameRng | null {
  return _rng;
}

/** Pick a random element from an array using the seeded RNG (falls back to Math.random). */
export function pick<T>(arr: readonly T[]): T {
  return _rng ? _rng.pick(arr) : arr[Math.floor(Math.random() * arr.length)]!;
}

/** Generate a random integer in [min, max] using the seeded RNG. */
export function randInt(min: number, max: number): number {
  return _rng ? _rng.int(min, max) : Math.floor(Math.random() * (max - min + 1)) + min;
}

/** A building is a "gulag" if it has negative housing capacity (drains population). */
export const isGulag = (b: Building): boolean => (getBuildingDef(b.defId)?.stats.housingCap ?? 0) < 0;

/** Return true with the given probability using the seeded RNG. */
export function coinFlip(probability = 0.5): boolean {
  return _rng ? _rng.coinFlip(probability) : Math.random() < probability;
}

/** Generate an absurdly precise fake percentage */
export function fakePercent(): string {
  return `${randInt(100, 999)}.${randInt(0, 99).toString().padStart(2, '0')}`;
}

/** Generate an impossibly large production number */
export function bigNumber(): string {
  const n = randInt(1, 99) * 10 ** randInt(2, 5);
  return n.toLocaleString();
}

/** The first Soviet Five-Year Plan starts in 1928. */
export function hasFiveYearPlanLanguage(year: number): boolean {
  return year >= 1928;
}

/** Era-safe planning label for player-facing Pravda copy. */
export function planLabelForYear(year: number): string {
  return hasFiveYearPlanLanguage(year) ? 'FIVE-YEAR PLAN' : 'LOCAL WORK PLAN';
}

/** Era-safe internal-security service label for propaganda copy. */
export function securityServiceForYear(year: number): string {
  if (year < 1922) return 'CHEKA';
  if (year < 1934) return 'OGPU';
  if (year < 1946) return 'NKVD';
  if (year < 1954) return 'MGB';
  return 'KGB';
}

export function culturalAuthorityForYear(year: number): string {
  if (year < 1946) return "PEOPLE'S COMMISSARIAT OF ENLIGHTENMENT";
  if (year < 1953) return 'COMMITTEE FOR ARTS';
  return 'MINISTRY OF CULTURE';
}

export function tradeAuthorityForYear(year: number): string {
  if (year < 1922) return 'REVOLUTIONARY SUPPLY COMMITTEE';
  if (year < 1946) return "PEOPLE'S COMMISSARIAT OF TRADE";
  return 'MINISTRY OF TRADE';
}

export function healthAuthorityForYear(year: number): string {
  if (year < 1946) return "PEOPLE'S COMMISSARIAT OF HEALTH";
  return 'MINISTRY OF HEALTH';
}

export function laborAuthorityForYear(year: number): string {
  if (year < 1946) return "PEOPLE'S COMMISSARIAT OF LABOR";
  return 'MINISTRY OF LABOR';
}

export function internalAffairsAuthorityForYear(year: number): string {
  if (year < 1922) return 'CHEKA';
  if (year < 1946) return 'NKVD';
  return 'MINISTRY OF INTERNAL AFFAIRS';
}
