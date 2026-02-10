import type { GameRng } from '../SeedSystem';

/** Module-level RNG reference, set by EventSystem constructor */
let _rng: GameRng | null = null;

export function setEventRng(rng: GameRng): void {
  _rng = rng;
}

export function getEventRng(): GameRng | null {
  return _rng;
}

export function pick<T>(arr: T[]): T {
  return _rng ? _rng.pick(arr) : arr[Math.floor(Math.random() * arr.length)]!;
}
