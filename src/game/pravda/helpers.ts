import { getBuildingDef } from '@/data/buildingDefs';
import type { Building } from '../GameView';
import type { GameRng } from '../SeedSystem';

// ─────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────

/** Module-level RNG reference, set by PravdaSystem constructor */
let _rng: GameRng | null = null;

export function setPravdaRng(rng: GameRng): void {
  _rng = rng;
}

export function getPravdaRng(): GameRng | null {
  return _rng;
}

export function pick<T>(arr: readonly T[]): T {
  return _rng ? _rng.pick(arr) : arr[Math.floor(Math.random() * arr.length)]!;
}

export function randInt(min: number, max: number): number {
  return _rng ? _rng.int(min, max) : Math.floor(Math.random() * (max - min + 1)) + min;
}

/** A building is a "gulag" if it has negative housing capacity (drains population). */
export const isGulag = (b: Building): boolean => (getBuildingDef(b.defId)?.stats.housingCap ?? 0) < 0;

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
