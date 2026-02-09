/**
 * Game State Store — bridges mutable GameState with React via useSyncExternalStore.
 *
 * GameState stays mutable (SimulationEngine/InputManager mutate it directly),
 * but React components subscribe to immutable snapshots that refresh on notify().
 */
import { useSyncExternalStore } from 'react';
import { GameState } from '@/game/GameState';

// ── Snapshot type (immutable view for React) ──────────────────────────────

export interface GameSnapshot {
  seed: string;
  money: number;
  pop: number;
  food: number;
  vodka: number;
  power: number;
  powerUsed: number;
  date: { year: number; month: number; tick: number };
  selectedTool: string;
  quota: { type: string; target: number; current: number; deadlineYear: number };
  buildingCount: number;
}

// ── Singleton state ───────────────────────────────────────────────────────

let _gameState: GameState | null = null;
const _listeners = new Set<() => void>();
let _snapshot: GameSnapshot | null = null;

function createSnapshot(gs: GameState): GameSnapshot {
  return {
    seed: gs.seed,
    money: gs.money,
    pop: gs.pop,
    food: gs.food,
    vodka: gs.vodka,
    power: gs.power,
    powerUsed: gs.powerUsed,
    date: { ...gs.date },
    selectedTool: gs.selectedTool,
    quota: { ...gs.quota },
    buildingCount: gs.buildings.length,
  };
}

// ── Public API ────────────────────────────────────────────────────────────

/** Get or create the singleton GameState instance. */
export function getGameState(): GameState {
  if (!_gameState) {
    _gameState = new GameState();
    _snapshot = createSnapshot(_gameState);
  }
  return _gameState;
}

/** Call after any mutation to GameState to trigger React re-renders. */
export function notifyStateChange(): void {
  if (_gameState) {
    _snapshot = createSnapshot(_gameState);
  }
  for (const listener of _listeners) {
    listener();
  }
}

/** React hook — components re-render when snapshot changes. */
export function useGameSnapshot(): GameSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Set selected building tool and notify React. */
export function selectTool(tool: string): void {
  getGameState().selectedTool = tool;
  notifyStateChange();
}

// ── Internal ──────────────────────────────────────────────────────────────

function subscribe(listener: () => void): () => void {
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}

function getSnapshot(): GameSnapshot {
  if (!_snapshot) {
    _snapshot = createSnapshot(getGameState());
  }
  return _snapshot;
}
