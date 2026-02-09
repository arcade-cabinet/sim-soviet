/**
 * Game State Store — bridges mutable GameState with React via useSyncExternalStore.
 *
 * GameState stays mutable (SimulationEngine/InputManager mutate it directly),
 * but React components subscribe to immutable snapshots that refresh on notify().
 */
import { useSyncExternalStore } from 'react';
import type { GameOverState } from '@/game/GameState';
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
  gameOver: GameOverState | null;
  paused: boolean;
  leaderName?: string;
  leaderPersonality?: string;
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
    gameOver: gs.gameOver,
    paused: _paused,
    leaderName: gs.leaderName,
    leaderPersonality: gs.leaderPersonality,
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

// ── Drag State (for drag-to-place from toolbar) ─────────────────────────

export interface DragState {
  buildingType: string;
  /** Screen position of the dragged ghost. */
  screenX: number;
  screenY: number;
}

let _dragState: DragState | null = null;
const _dragListeners = new Set<() => void>();

export function getDragState(): DragState | null {
  return _dragState;
}

export function setDragState(state: DragState | null): void {
  _dragState = state;
  for (const listener of _dragListeners) {
    listener();
  }
}

/** React hook for drag state. */
export function useDragState(): DragState | null {
  return useSyncExternalStore(subscribeDrag, getDragState, getDragState);
}

function subscribeDrag(listener: () => void): () => void {
  _dragListeners.add(listener);
  return () => {
    _dragListeners.delete(listener);
  };
}

// ── Pause State ──────────────────────────────────────────────────────────

let _paused = false;

export function isPaused(): boolean {
  return _paused;
}

export function togglePause(): boolean {
  _paused = !_paused;
  notifyStateChange();
  return _paused;
}

export function setPaused(paused: boolean): void {
  _paused = paused;
  notifyStateChange();
}

// ── Inspected Building ──────────────────────────────────────────────────

export interface InspectedBuilding {
  gridX: number;
  gridY: number;
  defId: string;
  powered: boolean;
  cost: number;
  footprintW: number;
  footprintH: number;
  name: string;
  desc: string;
}

let _inspected: InspectedBuilding | null = null;
const _inspectListeners = new Set<() => void>();

export function getInspected(): InspectedBuilding | null {
  return _inspected;
}

export function setInspected(info: InspectedBuilding | null): void {
  _inspected = info;
  for (const listener of _inspectListeners) {
    listener();
  }
}

export function useInspected(): InspectedBuilding | null {
  return useSyncExternalStore(subscribeInspect, getInspected, getInspected);
}

function subscribeInspect(listener: () => void): () => void {
  _inspectListeners.add(listener);
  return () => {
    _inspectListeners.delete(listener);
  };
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
