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
  gameSpeed: 1 | 2 | 3;
  leaderName?: string;
  leaderPersonality?: string;
  settlementTier: 'selo' | 'posyolok' | 'pgt' | 'gorod';
  blackMarks: number;
  commendations: number;
  threatLevel: string;
}

// ── Singleton state ───────────────────────────────────────────────────────

let _gameState: GameState | null = null;
const _listeners = new Set<() => void>();
let _snapshot: GameSnapshot | null = null;

/**
 * Creates an immutable view of the current game state for React subscribers.
 *
 * @param gs - The mutable GameState to snapshot
 * @returns A GameSnapshot representing the current state; `date` and `quota` are shallow-copied, and `buildingCount` is derived from the number of buildings in `gs`
 */
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
    gameSpeed: _gameSpeed,
    leaderName: gs.leaderName,
    leaderPersonality: gs.leaderPersonality,
    settlementTier: gs.settlementTier,
    blackMarks: gs.blackMarks,
    commendations: gs.commendations,
    threatLevel: gs.threatLevel,
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

/**
 * Subscribe to drag-state changes.
 *
 * @param listener - Callback invoked whenever the drag state is updated
 * @returns A function that unsubscribes the listener when called
 */
function subscribeDrag(listener: () => void): () => void {
  _dragListeners.add(listener);
  return () => {
    _dragListeners.delete(listener);
  };
}

// ── Pause & Speed State ──────────────────────────────────────────────────

let _paused = false;
let _gameSpeed: 1 | 2 | 3 = 1;

/**
 * Report whether the game is currently paused.
 *
 * @returns `true` if the game is paused, `false` otherwise.
 */
export function isPaused(): boolean {
  return _paused;
}

export function togglePause(): boolean {
  _paused = !_paused;
  notifyStateChange();
  return _paused;
}

/**
 * Set the global paused state for the game.
 *
 * @param paused - `true` to pause the game, `false` to resume it
 */
export function setPaused(paused: boolean): void {
  _paused = paused;
  notifyStateChange();
}

export type GameSpeed = 1 | 2 | 3;

/**
 * Returns the current game speed setting.
 *
 * @returns The current game speed (1, 2, or 3)
 */
export function getGameSpeed(): GameSpeed {
  return _gameSpeed;
}

/**
 * Set the game's speed.
 *
 * @param speed - New game speed (1, 2, or 3); updates the global speed and notifies subscribers of the change
 */
export function setGameSpeed(speed: GameSpeed): void {
  _gameSpeed = speed;
  notifyStateChange();
}

/**
 * Cycle the game speed to the next setting (1 → 2 → 3 → 1).
 *
 * Updates the internal game speed, notifies listeners of the change, and returns the new speed.
 *
 * @returns The new game speed: `1`, `2`, or `3`.
 */
export function cycleGameSpeed(): GameSpeed {
  _gameSpeed = (_gameSpeed === 3 ? 1 : _gameSpeed + 1) as GameSpeed;
  notifyStateChange();
  return _gameSpeed;
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

/**
 * Registers a callback to be invoked when the inspected-building state changes.
 *
 * @param listener - A zero-argument callback that will be called on inspected state updates
 * @returns A function that unsubscribes the listener; calling it removes the listener and has no effect if already removed
 */
function subscribeInspect(listener: () => void): () => void {
  _inspectListeners.add(listener);
  return () => {
    _inspectListeners.delete(listener);
  };
}

// ── Radial Build Menu ────────────────────────────────────────────────────

export interface RadialMenuState {
  /** Screen position of the tap that opened the menu. */
  screenX: number;
  screenY: number;
  /** Grid cell the menu targets. */
  gridX: number;
  gridY: number;
  /** Largest NxN footprint that fits at this cell. */
  availableSpace: number;
}

let _radialMenu: RadialMenuState | null = null;
const _radialListeners = new Set<() => void>();

/**
 * Retrieve the current radial build menu state used by UI components.
 *
 * @returns The active RadialMenuState if the radial menu is open, or `null` if it is closed.
 */
export function getRadialMenu(): RadialMenuState | null {
  return _radialMenu;
}

/**
 * Opens the radial build menu with the provided state and notifies all subscribers.
 *
 * @param state - The radial menu state (screen position, target grid coordinates, and available space) to set as active
 */
export function openRadialMenu(state: RadialMenuState): void {
  _radialMenu = state;
  for (const listener of _radialListeners) {
    listener();
  }
}

/**
 * Closes the currently open radial build menu and notifies subscribers.
 *
 * All registered radial menu listeners are invoked so observers can update their state.
 */
export function closeRadialMenu(): void {
  _radialMenu = null;
  for (const listener of _radialListeners) {
    listener();
  }
}

/**
 * React hook that subscribes to updates of the radial build menu state.
 *
 * @returns The current radial menu state, or `null` when the radial menu is closed.
 */
export function useRadialMenu(): RadialMenuState | null {
  return useSyncExternalStore(subscribeRadial, getRadialMenu, getRadialMenu);
}

/**
 * Subscribe to radial menu state changes.
 *
 * @param listener - Callback invoked whenever the radial menu state is updated
 * @returns A function that unsubscribes the provided listener
 */
function subscribeRadial(listener: () => void): () => void {
  _radialListeners.add(listener);
  return () => {
    _radialListeners.delete(listener);
  };
}

// ── Placement Callback (bridges React → imperative CanvasGestureManager) ─

type PlacementCallback = (gridX: number, gridY: number, defId: string) => boolean;

let _placementCallback: PlacementCallback | null = null;

/**
 * Register or clear the callback used to attempt placing a building on the grid.
 *
 * @param cb - The placement callback to register, or `null` to clear the current callback
 */
export function setPlacementCallback(cb: PlacementCallback | null): void {
  _placementCallback = cb;
}

/**
 * Attempt to place a building of the specified definition at the given grid coordinates.
 *
 * @param gridX - Target tile X coordinate on the grid
 * @param gridY - Target tile Y coordinate on the grid
 * @param defId - Identifier of the building definition to place
 * @returns `true` if the placement was accepted, `false` otherwise
 */
export function requestPlacement(gridX: number, gridY: number, defId: string): boolean {
  return _placementCallback?.(gridX, gridY, defId) ?? false;
}

/**
 * Subscribe to game state change notifications.
 *
 * @param listener - Callback invoked whenever the game state changes
 * @returns A function that unsubscribes the provided listener
 */

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