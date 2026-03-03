import type { GameRng } from '../../../../game/SeedSystem';

/** Module-level RNG reference, set by EventSystem constructor */
let _rng: GameRng | null = null;

/** Inject the seeded RNG used by the event system for deterministic rolls. */
export function setEventRng(rng: GameRng): void {
  _rng = rng;
}

/** Retrieve the current event RNG, or null if not yet initialized. */
export function getEventRng(): GameRng | null {
  return _rng;
}

/** Pick a random element from an array using the seeded RNG or Math.random fallback. */
export function pick<T>(arr: T[]): T {
  return _rng ? _rng.pick(arr) : arr[Math.floor(Math.random() * arr.length)]!;
}
