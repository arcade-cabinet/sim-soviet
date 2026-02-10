import type { GameRng } from '@/game/SeedSystem';

let _rng: GameRng | null = null;

/** Bind a seeded RNG to all dialogue random functions. */
export function setDialogueRng(rng: GameRng): void {
  _rng = rng;
}

export function weightedPick<T extends { weight?: number }>(arr: readonly T[]): T {
  if (!_rng) return arr[Math.floor(Math.random() * arr.length)]!;
  const weights = arr.map((item) => item.weight ?? 1);
  const idx = _rng.weightedIndex(weights);
  return arr[idx]!;
}
