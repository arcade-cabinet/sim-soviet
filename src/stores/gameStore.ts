/**
 * Game State Store — bridges ECS with React via useSyncExternalStore.
 *
 * ECS is the single source of truth. React components subscribe to immutable
 * snapshots that refresh when notifyStateChange() is called.
 */
import { useSyncExternalStore } from 'react';
import { buildingsLogic, getMetaEntity, getResourceEntity } from '@/ecs/archetypes';
import type { GameMeta } from '@/ecs/world';

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
  gameOver: GameMeta['gameOver'];
  paused: boolean;
  gameSpeed: 1 | 2 | 3;
  leaderName?: string;
  leaderPersonality?: string;
  settlementTier: 'selo' | 'posyolok' | 'pgt' | 'gorod';
  blackMarks: number;
  commendations: number;
  threatLevel: string;
  currentEra: string;

  // ── Planned Economy Resources ──
  trudodni: number;
  blat: number;
  timber: number;
  steel: number;
  cement: number;
  prefab: number;
  seedFund: number;
  emergencyReserve: number;
  storageCapacity: number;
}

// ── Singleton state ───────────────────────────────────────────────────────

const _listeners = new Set<() => void>();
let _snapshot: GameSnapshot | null = null;

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: snapshot aggregates many ECS fields with fallback defaults
function createSnapshot(): GameSnapshot {
  const res = getResourceEntity();
  const meta = getMetaEntity();
  const m = meta?.gameMeta;

  return {
    seed: m?.seed ?? '',
    money: res?.resources.money ?? 0,
    pop: res?.resources.population ?? 0,
    food: res?.resources.food ?? 0,
    vodka: res?.resources.vodka ?? 0,
    power: res?.resources.power ?? 0,
    powerUsed: res?.resources.powerUsed ?? 0,
    date: m?.date ? { ...m.date } : { year: 1922, month: 10, tick: 0 },
    selectedTool: m?.selectedTool ?? 'none',
    quota: m?.quota
      ? { ...m.quota }
      : { type: 'food', target: 500, current: 0, deadlineYear: 1927 },
    buildingCount: buildingsLogic.entities.length,
    gameOver: m?.gameOver ?? null,
    paused: _paused,
    gameSpeed: _gameSpeed,
    leaderName: m?.leaderName,
    leaderPersonality: m?.leaderPersonality,
    settlementTier: m?.settlementTier ?? 'selo',
    blackMarks: m?.blackMarks ?? 0,
    commendations: m?.commendations ?? 0,
    threatLevel: m?.threatLevel ?? 'safe',
    currentEra: m?.currentEra ?? 'war_communism',

    // Planned economy resources
    trudodni: res?.resources.trudodni ?? 0,
    blat: res?.resources.blat ?? 10,
    timber: res?.resources.timber ?? 0,
    steel: res?.resources.steel ?? 0,
    cement: res?.resources.cement ?? 0,
    prefab: res?.resources.prefab ?? 0,
    seedFund: res?.resources.seedFund ?? 1.0,
    emergencyReserve: res?.resources.emergencyReserve ?? 0,
    storageCapacity: res?.resources.storageCapacity ?? 200,
  };
}

// ── Public API ────────────────────────────────────────────────────────────

/** Call after any ECS mutation to trigger React re-renders. */
export function notifyStateChange(): void {
  _snapshot = createSnapshot();
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
  const meta = getMetaEntity();
  if (meta) {
    meta.gameMeta.selectedTool = tool;
  }
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

// ── Pause & Speed State ──────────────────────────────────────────────────

let _paused = false;
let _gameSpeed: 1 | 2 | 3 = 1;

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

export type GameSpeed = 1 | 2 | 3;

export function getGameSpeed(): GameSpeed {
  return _gameSpeed;
}

export function setGameSpeed(speed: GameSpeed): void {
  _gameSpeed = speed;
  notifyStateChange();
}

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
  // Clear worker inspection when selecting a building
  if (info && _inspectedWorker) {
    _inspectedWorker = null;
    for (const listener of _inspectWorkerListeners) {
      listener();
    }
  }
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

// ── Inspected Worker ──────────────────────────────────────────────────

export interface InspectedWorker {
  name: string;
  class: 'worker' | 'party_official' | 'engineer' | 'farmer' | 'soldier' | 'prisoner';
  morale: number;
  loyalty: number;
  skill: number;
  vodkaDependency: number;
  assignedBuildingDefId: string | null;
}

let _inspectedWorker: InspectedWorker | null = null;
const _inspectWorkerListeners = new Set<() => void>();

export function getInspectedWorker(): InspectedWorker | null {
  return _inspectedWorker;
}

export function setInspectedWorker(info: InspectedWorker | null): void {
  _inspectedWorker = info;
  // Clear building inspection when selecting a worker (and vice versa)
  if (info) {
    _inspected = null;
    for (const listener of _inspectListeners) {
      listener();
    }
  }
  for (const listener of _inspectWorkerListeners) {
    listener();
  }
}

export function useInspectedWorker(): InspectedWorker | null {
  return useSyncExternalStore(subscribeInspectWorker, getInspectedWorker, getInspectedWorker);
}

function subscribeInspectWorker(listener: () => void): () => void {
  _inspectWorkerListeners.add(listener);
  return () => {
    _inspectWorkerListeners.delete(listener);
  };
}

// ── Worker Assignment Mode ───────────────────────────────────────────────

export interface AssignmentMode {
  /** Name of the worker being assigned (used to find the entity). */
  workerName: string;
  /** Class of the worker (for visual feedback). */
  workerClass: InspectedWorker['class'];
}

let _assignmentMode: AssignmentMode | null = null;
const _assignmentListeners = new Set<() => void>();

export function getAssignmentMode(): AssignmentMode | null {
  return _assignmentMode;
}

export function setAssignmentMode(mode: AssignmentMode | null): void {
  _assignmentMode = mode;
  // Clear inspected panels when entering assignment mode
  if (mode) {
    _inspectedWorker = null;
    _inspected = null;
    for (const listener of _inspectListeners) listener();
    for (const listener of _inspectWorkerListeners) listener();
  }
  for (const listener of _assignmentListeners) listener();
}

export function useAssignmentMode(): AssignmentMode | null {
  return useSyncExternalStore(subscribeAssignment, getAssignmentMode, getAssignmentMode);
}

function subscribeAssignment(listener: () => void): () => void {
  _assignmentListeners.add(listener);
  return () => {
    _assignmentListeners.delete(listener);
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

export function getRadialMenu(): RadialMenuState | null {
  return _radialMenu;
}

export function openRadialMenu(state: RadialMenuState): void {
  _radialMenu = state;
  for (const listener of _radialListeners) {
    listener();
  }
}

export function closeRadialMenu(): void {
  _radialMenu = null;
  for (const listener of _radialListeners) {
    listener();
  }
}

export function useRadialMenu(): RadialMenuState | null {
  return useSyncExternalStore(subscribeRadial, getRadialMenu, getRadialMenu);
}

function subscribeRadial(listener: () => void): () => void {
  _radialListeners.add(listener);
  return () => {
    _radialListeners.delete(listener);
  };
}

// ── Placement Callback (bridges React → imperative CanvasGestureManager) ─

type PlacementCallback = (gridX: number, gridY: number, defId: string) => boolean;

let _placementCallback: PlacementCallback | null = null;

/** Called by CanvasGestureManager to register its placement method. */
export function setPlacementCallback(cb: PlacementCallback | null): void {
  _placementCallback = cb;
}

/** Called by RadialBuildMenu to place a building at a grid position. */
export function requestPlacement(gridX: number, gridY: number, defId: string): boolean {
  return _placementCallback?.(gridX, gridY, defId) ?? false;
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
    _snapshot = createSnapshot();
  }
  return _snapshot;
}
