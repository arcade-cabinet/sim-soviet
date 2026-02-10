import type { GameRng } from '@/game/SeedSystem';

/** Module-level RNG reference, set by `setWorldBuildingRng()` */
let _rng: GameRng | null = null;

/** Bind a seeded RNG to all WorldBuilding random functions. */
export function setWorldBuildingRng(rng: GameRng): void {
  _rng = rng;
}

/** Get the current RNG instance (or null if not set). */
export function getRng(): GameRng | null {
  return _rng;
}

export function pick<T>(arr: readonly T[]): T {
  return _rng ? _rng.pick(arr) : arr[Math.floor(Math.random() * arr.length)]!;
}
