/**
 * Game State Store — bridges ECS with React via useSyncExternalStore.
 *
 * ECS is the single source of truth. React components subscribe to immutable
 * snapshots that refresh when notifyStateChange() is called.
 */
import { useSyncExternalStore } from 'react';
import { buildingsLogic, citizens, dvory, getMetaEntity, getResourceEntity } from '@/ecs/archetypes';
import type { GameMeta } from '@/ecs/world';

// ── Snapshot type (immutable view for React) ──────────────────────────────

/** Immutable snapshot of the full game state for React consumption. */
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
  gameSpeed: GameSpeed;
  leaderName?: string;
  leaderPersonality?: string;
  settlementTier: 'selo' | 'posyolok' | 'pgt' | 'gorod';
  blackMarks: number;
  commendations: number;
  threatLevel: string;
  currentEra: string;
  roadQuality: string;
  roadCondition: number;

  // ── Population Breakdown ──
  dvorCount: number;
  avgMorale: number;
  avgLoyalty: number;
  assignedWorkers: number;
  idleWorkers: number;

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

function createSnapshot(): GameSnapshot {
  const res = getResourceEntity();
  const meta = getMetaEntity();
  const m = meta?.gameMeta;

  // Compute population breakdown from ECS
  const citizenList = citizens.entities;
  const totalCitizens = citizenList.length;
  let moraleSum = 0;
  let assigned = 0;
  for (const c of citizenList) {
    moraleSum += c.citizen.happiness;
    if (c.citizen.assignment) assigned++;
  }
  // Average dvor loyalty from household entities
  const dvorList = dvory.entities;
  let loyaltySum = 0;
  for (const d of dvorList) {
    loyaltySum += d.dvor.loyaltyToCollective;
  }

  return {
    seed: m?.seed ?? '',
    money: res?.resources.money ?? 0,
    pop: totalCitizens,
    food: res?.resources.food ?? 0,
    vodka: res?.resources.vodka ?? 0,
    power: res?.resources.power ?? 0,
    powerUsed: res?.resources.powerUsed ?? 0,
    date: m?.date ? { ...m.date } : { year: 1922, month: 10, tick: 0 },
    selectedTool: m?.selectedTool ?? 'none',
    quota: m?.quota ? { ...m.quota } : { type: 'food', target: 500, current: 0, deadlineYear: 1927 },
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
    currentEra: m?.currentEra ?? 'revolution',
    roadQuality: m?.roadQuality ?? 'none',
    roadCondition: m?.roadCondition ?? 100,

    // Population breakdown
    dvorCount: dvory.entities.length,
    avgMorale: totalCitizens > 0 ? Math.round(moraleSum / totalCitizens) : 0,
    avgLoyalty: dvorList.length > 0 ? Math.round(loyaltySum / dvorList.length) : 0,
    assignedWorkers: assigned,
    idleWorkers: totalCitizens - assigned,

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

/** Set selected building tool and notify React. Only 'none' and 'bulldoze' are allowed (Phase 1). */
export function selectTool(tool: string): void {
  // Phase 1: direct building placement disabled — only allow none and bulldoze
  const allowed = tool === 'none' || tool === 'bulldoze' ? tool : 'none';
  const meta = getMetaEntity();
  if (meta) {
    meta.gameMeta.selectedTool = allowed;
  }
  notifyStateChange();
}

// ── Drag State (for drag-to-place from toolbar) ─────────────────────────

/** State for an active drag-to-place building interaction. */
export interface DragState {
  buildingType: string;
  /** Screen position of the dragged ghost. */
  screenX: number;
  screenY: number;
}

let _dragState: DragState | null = null;
const _dragListeners = new Set<() => void>();

/** Get the current drag-to-place state (null if no drag in progress). */
export function getDragState(): DragState | null {
  return _dragState;
}

/** Update the drag-to-place state and notify listeners. */
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

/** Simulation speed multiplier: 1 = normal, 2 = double, 3 = triple, 10 = fast-forward, 100 = turbo. */
export type GameSpeed = 1 | 2 | 3 | 10 | 100;

let _paused = false;
let _gameSpeed: GameSpeed = 1;

/** Whether the game simulation is currently paused. */
export function isPaused(): boolean {
  return _paused;
}

/**
 * Toggle the pause state and notify React.
 *
 * @returns The new paused state
 */
export function togglePause(): boolean {
  _paused = !_paused;
  notifyStateChange();
  return _paused;
}

/** Explicitly set the pause state and notify React. */
export function setPaused(paused: boolean): void {
  _paused = paused;
  notifyStateChange();
}

/** Get the current game simulation speed. */
export function getGameSpeed(): GameSpeed {
  return _gameSpeed;
}

/** Set the game simulation speed and notify React. */
export function setGameSpeed(speed: GameSpeed): void {
  _gameSpeed = speed;
  notifyStateChange();
}

/**
 * Cycle through game speeds: 1 -> 2 -> 3 -> 10 -> 100 -> 1.
 *
 * @returns The new game speed after cycling
 */
export function cycleGameSpeed(): GameSpeed {
  const cycle: GameSpeed[] = [1, 2, 3, 10, 100];
  const idx = cycle.indexOf(_gameSpeed);
  _gameSpeed = cycle[(idx + 1) % cycle.length];
  notifyStateChange();
  return _gameSpeed;
}

// ── Inspected Building ──────────────────────────────────────────────────

/** Data for the currently inspected building in the inspector panel. */
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

/** Get the currently inspected building (null if none selected). */
export function getInspected(): InspectedBuilding | null {
  return _inspected;
}

/** Set the inspected building. Clears any inspected worker when a building is selected. */
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

/** React hook — subscribe to the inspected building state. */
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

/** Data for the currently inspected worker in the inspector panel. */
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

/** Get the currently inspected worker (null if none selected). */
export function getInspectedWorker(): InspectedWorker | null {
  return _inspectedWorker;
}

/** Set the inspected worker. Clears any inspected building when a worker is selected. */
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

/** React hook — subscribe to the inspected worker state. */
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

/** State for worker-to-building assignment mode (tap a building to assign). */
export interface AssignmentMode {
  /** Name of the worker being assigned (used to find the entity). */
  workerName: string;
  /** Class of the worker (for visual feedback). */
  workerClass: InspectedWorker['class'];
}

let _assignmentMode: AssignmentMode | null = null;
const _assignmentListeners = new Set<() => void>();

/** Get the current worker assignment mode (null if not in assignment mode). */
function getAssignmentMode(): AssignmentMode | null {
  return _assignmentMode;
}

/** Enter or exit worker assignment mode. Clears inspected panels when entering. */
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

/** React hook — subscribe to the worker assignment mode state. */
export function useAssignmentMode(): AssignmentMode | null {
  return useSyncExternalStore(subscribeAssignment, getAssignmentMode, getAssignmentMode);
}

function subscribeAssignment(listener: () => void): () => void {
  _assignmentListeners.add(listener);
  return () => {
    _assignmentListeners.delete(listener);
  };
}

// ── Color-Blind Mode ─────────────────────────────────────────────────────

let _colorBlindMode = false;
const _colorBlindListeners = new Set<() => void>();

/** Whether color-blind mode is currently enabled. */
export function isColorBlindMode(): boolean {
  return _colorBlindMode;
}

/** Enable or disable color-blind mode. Toggles a CSS class on document body. */
export function setColorBlindMode(enabled: boolean): void {
  _colorBlindMode = enabled;
  // Toggle CSS class on body for DOM-level color-blind overrides
  if (typeof document !== 'undefined') {
    document.body.classList.toggle('colorblind', enabled);
  }
  for (const listener of _colorBlindListeners) {
    listener();
  }
}

/** React hook — subscribe to the color-blind mode state. */
export function useColorBlindMode(): boolean {
  return useSyncExternalStore(subscribeColorBlind, isColorBlindMode, isColorBlindMode);
}

function subscribeColorBlind(listener: () => void): () => void {
  _colorBlindListeners.add(listener);
  return () => {
    _colorBlindListeners.delete(listener);
  };
}

// ── Notification Log ─────────────────────────────────────────────────────

/** A single notification log entry with severity and optional grid location. */
export interface NotificationEntry {
  id: number;
  message: string;
  severity: 'warning' | 'critical' | 'evacuation';
  timestamp: number;
  gridX?: number;
  gridY?: number;
}

const _notifications: NotificationEntry[] = [];
const _notificationListeners = new Set<() => void>();

/** Get the current notification log (most recent first). */
function getNotifications(): NotificationEntry[] {
  return _notifications;
}

/** React hook — subscribe to the notification log. */
export function useNotifications(): NotificationEntry[] {
  return useSyncExternalStore(subscribeNotifications, getNotifications, getNotifications);
}

function subscribeNotifications(listener: () => void): () => void {
  _notificationListeners.add(listener);
  return () => {
    _notificationListeners.delete(listener);
  };
}

// ── Radial Build Menu ────────────────────────────────────────────────────

/** State for the radial build menu opened by tapping an empty grid cell. */
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

/** Get the current radial build menu state (null if closed). */
export function getRadialMenu(): RadialMenuState | null {
  return _radialMenu;
}

/** Open the radial build menu at the given screen/grid position. */
export function openRadialMenu(state: RadialMenuState): void {
  _radialMenu = state;
  for (const listener of _radialListeners) {
    listener();
  }
}

/** Close the radial build menu. */
export function closeRadialMenu(): void {
  _radialMenu = null;
  for (const listener of _radialListeners) {
    listener();
  }
}

/** React hook — subscribe to the radial build menu state. */
export function useRadialMenu(): RadialMenuState | null {
  return useSyncExternalStore(subscribeRadial, getRadialMenu, getRadialMenu);
}

function subscribeRadial(listener: () => void): () => void {
  _radialListeners.add(listener);
  return () => {
    _radialListeners.delete(listener);
  };
}

// ── Radial Inspect Menu ───────────────────────────────────────────────────

/** Categorized building type for the radial inspect menu ring display. */
export type InspectBuildingType =
  | 'production'
  | 'housing'
  | 'storage'
  | 'government'
  | 'military'
  | 'construction'
  | 'general';

/** A building occupant entry shown in the inspect menu (housing buildings only). */
export interface InspectMenuOccupant {
  name: string;
  age: number;
  role: string;
  gender: string;
}

/** State for the radial inspect menu opened by right-clicking/long-pressing a building. */
export interface InspectMenuState {
  /** Screen position of the tap that opened the menu. */
  screenX: number;
  screenY: number;
  /** Grid cell the menu targets. */
  gridX: number;
  gridY: number;
  /** Building definition ID. */
  buildingDefId: string;
  /** Categorized building type for ring selection. */
  buildingType: InspectBuildingType;
  /** Number of workers currently assigned. */
  workerCount: number;
  /** Max housing capacity (housing buildings only). */
  housingCap?: number;
  /** Current occupants (housing buildings only). */
  occupants?: InspectMenuOccupant[];
}

let _inspectMenu: InspectMenuState | null = null;
const _inspectMenuListeners = new Set<() => void>();

/** Get the current radial inspect menu state (null if closed). */
export function getInspectMenu(): InspectMenuState | null {
  return _inspectMenu;
}

/** Open the radial inspect menu for a building at the given position. */
export function openInspectMenu(state: InspectMenuState): void {
  _inspectMenu = state;
  for (const listener of _inspectMenuListeners) {
    listener();
  }
}

/** Close the radial inspect menu. */
export function closeInspectMenu(): void {
  _inspectMenu = null;
  for (const listener of _inspectMenuListeners) {
    listener();
  }
}

/** React hook — subscribe to the radial inspect menu state. */
export function useInspectMenu(): InspectMenuState | null {
  return useSyncExternalStore(subscribeInspectMenu, getInspectMenu, getInspectMenu);
}

function subscribeInspectMenu(listener: () => void): () => void {
  _inspectMenuListeners.add(listener);
  return () => {
    _inspectMenuListeners.delete(listener);
  };
}

// ── Building Inspector Panel ──────────────────────────────────────────────

/** State for the full building inspector side panel. */
export interface BuildingInspectorState {
  buildingDefId: string;
  gridX: number;
  gridY: number;
}

let _buildingInspector: BuildingInspectorState | null = null;
const _buildingInspectorListeners = new Set<() => void>();

/** Get the current building inspector panel state (null if closed). */
function getBuildingInspector(): BuildingInspectorState | null {
  return _buildingInspector;
}

/** Open the building inspector panel for a building at the given position. */
export function openBuildingInspector(state: BuildingInspectorState): void {
  _buildingInspector = state;
  for (const listener of _buildingInspectorListeners) {
    listener();
  }
}

/** Close the building inspector panel. */
export function closeBuildingInspector(): void {
  _buildingInspector = null;
  for (const listener of _buildingInspectorListeners) {
    listener();
  }
}

/** React hook — subscribe to the building inspector panel state. */
export function useBuildingInspector(): BuildingInspectorState | null {
  return useSyncExternalStore(subscribeBuildingInspector, getBuildingInspector, getBuildingInspector);
}

function subscribeBuildingInspector(listener: () => void): () => void {
  _buildingInspectorListeners.add(listener);
  return () => {
    _buildingInspectorListeners.delete(listener);
  };
}

// ── Citizen Dossier Index ─────────────────────────────────────────────────

let _citizenDossierIndex: number | null = null;
const _citizenDossierIndexListeners = new Set<() => void>();

/** Get the index of the citizen dossier currently viewed (null if closed). */
function getCitizenDossierIndex(): number | null {
  return _citizenDossierIndex;
}

/** Open a citizen dossier by ECS entity index. */
export function openCitizenDossierByIndex(index: number): void {
  _citizenDossierIndex = index;
  for (const listener of _citizenDossierIndexListeners) {
    listener();
  }
}

/** Close the index-based citizen dossier. */
export function closeCitizenDossierByIndex(): void {
  _citizenDossierIndex = null;
  for (const listener of _citizenDossierIndexListeners) {
    listener();
  }
}

/** React hook — subscribe to the citizen dossier index state. */
export function useCitizenDossierIndex(): number | null {
  return useSyncExternalStore(subscribeCitizenDossierIndex, getCitizenDossierIndex, getCitizenDossierIndex);
}

function subscribeCitizenDossierIndex(listener: () => void): () => void {
  _citizenDossierIndexListeners.add(listener);
  return () => {
    _citizenDossierIndexListeners.delete(listener);
  };
}

// ── Cursor Tooltip ────────────────────────────────────────────────────────

/** Data for the cursor tooltip showing tile info on hover. */
export interface CursorTooltipState {
  terrain: string;
  type?: string;
  smog: number;
  watered: boolean;
  onFire: boolean;
  zone?: string;
  z: number;
  screenX: number;
  screenY: number;
}

let _cursorTooltip: CursorTooltipState | null = null;
const _cursorTooltipListeners = new Set<() => void>();

/** Get the current cursor tooltip state (null if no tile hovered). */
function getCursorTooltip(): CursorTooltipState | null {
  return _cursorTooltip;
}

/** Update the cursor tooltip with tile data for the hovered cell. */
export function setCursorTooltip(state: CursorTooltipState | null): void {
  _cursorTooltip = state;
  for (const listener of _cursorTooltipListeners) {
    listener();
  }
}

/** React hook — subscribe to the cursor tooltip state. */
export function useCursorTooltip(): CursorTooltipState | null {
  return useSyncExternalStore(subscribeCursorTooltip, getCursorTooltip, getCursorTooltip);
}

function subscribeCursorTooltip(listener: () => void): () => void {
  _cursorTooltipListeners.add(listener);
  return () => {
    _cursorTooltipListeners.delete(listener);
  };
}

// ── Terrain Dirty Flag (signals Content.tsx to rebuild terrain grid) ─────

let _terrainDirtyVersion = 0;
const _terrainDirtyListeners = new Set<() => void>();

/** Increment the terrain version counter — forces terrain grid refresh. */
export function notifyTerrainDirty(): void {
  _terrainDirtyVersion++;
  for (const listener of _terrainDirtyListeners) {
    listener();
  }
}

/** Current terrain version (monotonically increasing). */
function getTerrainVersion(): number {
  return _terrainDirtyVersion;
}

/** React hook — returns the terrain dirty version for useEffect dependencies. */
export function useTerrainVersion(): number {
  return useSyncExternalStore(subscribeTerrainDirty, getTerrainVersion, getTerrainVersion);
}

function subscribeTerrainDirty(listener: () => void): () => void {
  _terrainDirtyListeners.add(listener);
  return () => {
    _terrainDirtyListeners.delete(listener);
  };
}

// ── Placement Callback (bridges React → imperative CanvasGestureManager) ─

type PlacementCallback = (gridX: number, gridY: number, defId: string) => boolean;

let _placementCallback: PlacementCallback | null = null;

/** Called by CanvasGestureManager to register its placement method. */
export function setPlacementCallback(cb: PlacementCallback | null): void {
  _placementCallback = cb;
}

/**
 * Called by RadialMenu to place a building at a grid position.
 *
 * @param gridX - Grid X coordinate
 * @param gridY - Grid Y coordinate
 * @param defId - Building definition ID to place
 * @returns true if placement succeeded, false otherwise
 */
export function requestPlacement(gridX: number, gridY: number, defId: string): boolean {
  return _placementCallback?.(gridX, gridY, defId) ?? false;
}

// ── Political Entity Panel (scene-driven) ─────────────────────────────────

let _showPoliticalPanel = false;
const _politicalPanelListeners = new Set<() => void>();

/** Whether the political entity panel is currently visible. */
function getPoliticalPanelVisible(): boolean {
  return _showPoliticalPanel;
}

/** Open the political entity panel from the 3D scene (e.g. tapping a political entity mesh). */
export function openPoliticalPanel(): void {
  _showPoliticalPanel = true;
  for (const listener of _politicalPanelListeners) {
    listener();
  }
}

/** Close the political entity panel. */
export function closePoliticalPanel(): void {
  _showPoliticalPanel = false;
  for (const listener of _politicalPanelListeners) {
    listener();
  }
}

/** React hook — subscribe to the political entity panel visibility. */
export function usePoliticalPanel(): boolean {
  return useSyncExternalStore(subscribePoliticalPanel, getPoliticalPanelVisible, getPoliticalPanelVisible);
}

function subscribePoliticalPanel(listener: () => void): () => void {
  _politicalPanelListeners.add(listener);
  return () => {
    _politicalPanelListeners.delete(listener);
  };
}

// ── Minimap Visibility ────────────────────────────────────────────────────

let _minimapVisible = true;
const _minimapListeners = new Set<() => void>();

/** Whether the minimap is currently visible. */
export function isMinimapVisible(): boolean {
  return _minimapVisible;
}

/** Toggle minimap visibility and notify React. */
export function toggleMinimap(): void {
  _minimapVisible = !_minimapVisible;
  for (const listener of _minimapListeners) {
    listener();
  }
}

/** React hook — subscribe to minimap visibility state. */
export function useMinimapVisible(): boolean {
  return useSyncExternalStore(subscribeMinimap, isMinimapVisible, isMinimapVisible);
}

function subscribeMinimap(listener: () => void): () => void {
  _minimapListeners.add(listener);
  return () => {
    _minimapListeners.delete(listener);
  };
}

// ── Building Panel (click-to-inspect side panel) ──────────────────────────

let _selectedBuildingCell: { x: number; z: number } | null = null;
const _buildingPanelListeners = new Set<() => void>();

/** Get the currently selected building cell for the side panel (null if closed). */
function getSelectedBuildingCell(): { x: number; z: number } | null {
  return _selectedBuildingCell;
}

/** Open the building info side panel for the building at (x, z). */
export function openBuildingPanel(x: number, z: number): void {
  _selectedBuildingCell = { x, z };
  setCameraTarget(x, z);
  for (const listener of _buildingPanelListeners) {
    listener();
  }
}

/** Close the building info side panel. */
export function closeBuildingPanel(): void {
  _selectedBuildingCell = null;
  clearCameraTarget();
  for (const listener of _buildingPanelListeners) {
    listener();
  }
}

/** React hook -- subscribe to the building panel cell state. */
export function useBuildingPanel(): { x: number; z: number } | null {
  return useSyncExternalStore(subscribeBuildingPanel, getSelectedBuildingCell, getSelectedBuildingCell);
}

function subscribeBuildingPanel(listener: () => void): () => void {
  _buildingPanelListeners.add(listener);
  return () => {
    _buildingPanelListeners.delete(listener);
  };
}

// ── Camera Target (click-to-zoom street level) ───────────────────────────

/** Camera target state for smooth zoom-to-building animation. */
export interface CameraTargetState {
  x: number;
  z: number;
  returnPos?: [number, number, number];
  returnTarget?: [number, number, number];
}

let _cameraTarget: CameraTargetState | null = null;

/** Get the current camera target (null if no zoom animation active). */
export function getCameraTarget(): CameraTargetState | null {
  return _cameraTarget;
}

/** Set camera target to zoom toward a building at grid (x, z). */
export function setCameraTarget(x: number, z: number): void {
  _cameraTarget = { x, z };
}

/** Clear camera target to trigger return animation. */
export function clearCameraTarget(): void {
  _cameraTarget = null;
}

// ── Lens Cycling ──────────────────────────────────────────────────────────

import type { LensType } from '../engine/GameState';
import { gameState } from '../engine/GameState';
import { setLens } from '../engine/helpers';

const LENS_CYCLE: LensType[] = ['default', 'water', 'power', 'smog', 'aura'];

/** Cycle to the next lens mode and update game state. */
export function cycleLens(): void {
  const current = gameState.activeLens ?? 'default';
  const idx = LENS_CYCLE.indexOf(current);
  const next = LENS_CYCLE[(idx + 1) % LENS_CYCLE.length];
  setLens(gameState, next);
  notifyStateChange();
}

// ── Gosplan Allocations (resource distribution) ──────────────────────────

import type { Allocations } from '@/ui/hq-tabs/GosplanTab';
import { DEFAULT_ALLOCATIONS } from '@/ui/hq-tabs/GosplanTab';

let _gosplanAllocations: Allocations = { ...DEFAULT_ALLOCATIONS };
const _allocationListeners = new Set<() => void>();

/** Get the current Gosplan allocations (read by tick pipeline). */
export function getGosplanAllocations(): Readonly<Allocations> {
  return _gosplanAllocations;
}

/** Update Gosplan allocations (called from GovernmentHQ UI). */
export function setGosplanAllocations(alloc: Allocations): void {
  _gosplanAllocations = { ...alloc };
  for (const listener of _allocationListeners) listener();
}

/** React hook -- subscribe to Gosplan allocation state. */
export function useGosplanAllocations(): Readonly<Allocations> {
  return useSyncExternalStore(subscribeAllocations, getGosplanAllocations, getGosplanAllocations);
}

function subscribeAllocations(listener: () => void): () => void {
  _allocationListeners.add(listener);
  return () => { _allocationListeners.delete(listener); };
}

// ── Government HQ Panel ──────────────────────────────────────────────────

let _showGovernmentHQ = false;
const _govHQListeners = new Set<() => void>();

function getGovernmentHQState(): boolean {
  return _showGovernmentHQ;
}

/** Open the Government HQ panel. */
export function openGovernmentHQ(): void {
  _showGovernmentHQ = true;
  for (const listener of _govHQListeners) listener();
}

/** Close the Government HQ panel. */
export function closeGovernmentHQ(): void {
  _showGovernmentHQ = false;
  for (const listener of _govHQListeners) listener();
}

/** React hook -- subscribe to Government HQ visibility. */
export function useGovernmentHQ(): boolean {
  return useSyncExternalStore(subscribeGovHQ, getGovernmentHQState, getGovernmentHQState);
}

function subscribeGovHQ(listener: () => void): () => void {
  _govHQListeners.add(listener);
  return () => { _govHQListeners.delete(listener); };
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
