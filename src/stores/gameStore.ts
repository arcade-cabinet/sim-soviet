/**
 * Game State Store — bridges ECS with React via useSyncExternalStore.
 *
 * ECS is the single source of truth. React components subscribe to immutable
 * snapshots that refresh when notifyStateChange() is called.
 */
import { useSyncExternalStore } from 'react';
import {
  buildingsLogic,
  citizens,
  dvory,
  getMetaEntity,
  getResourceEntity,
} from '@/ecs/archetypes';
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

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: snapshot aggregates many ECS fields with fallback defaults
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

// ── Color-Blind Mode ─────────────────────────────────────────────────────

let _colorBlindMode = false;
const _colorBlindListeners = new Set<() => void>();

export function isColorBlindMode(): boolean {
  return _colorBlindMode;
}

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

export interface NotificationEntry {
  id: number;
  message: string;
  severity: 'warning' | 'critical' | 'evacuation';
  timestamp: number;
  gridX?: number;
  gridY?: number;
}

const MAX_NOTIFICATIONS = 50;
let _notificationId = 0;
let _notifications: NotificationEntry[] = [];
const _notificationListeners = new Set<() => void>();

function notifyNotificationListeners(): void {
  for (const listener of _notificationListeners) {
    listener();
  }
}

export function addNotification(
  message: string,
  severity: 'warning' | 'critical' | 'evacuation',
  timestamp: number,
  gridX?: number,
  gridY?: number
): void {
  _notificationId++;
  const entry: NotificationEntry = {
    id: _notificationId,
    message,
    severity,
    timestamp,
    gridX,
    gridY,
  };
  _notifications = [entry, ..._notifications].slice(0, MAX_NOTIFICATIONS);
  notifyNotificationListeners();
}

export function getNotifications(): NotificationEntry[] {
  return _notifications;
}

export function useNotifications(): NotificationEntry[] {
  return useSyncExternalStore(subscribeNotifications, getNotifications, getNotifications);
}

function subscribeNotifications(listener: () => void): () => void {
  _notificationListeners.add(listener);
  return () => {
    _notificationListeners.delete(listener);
  };
}

// ── Citizen Dossier Modal ─────────────────────────────────────────────────

export interface CitizenDossierData {
  citizen: {
    name: string;
    class: string;
    happiness: number;
    hunger: number;
    assignment?: string;
    gender?: 'male' | 'female';
    age?: number;
    memberRole?: string;
    dvorId?: string;
  };
  household?: {
    surname: string;
    members: Array<{ name: string; age: number; role: string; gender: string }>;
    headOfHousehold: string;
    loyaltyToCollective: number;
  };
}

let _selectedCitizen: CitizenDossierData | null = null;
const _citizenDossierListeners = new Set<() => void>();

export function getSelectedCitizen(): CitizenDossierData | null {
  return _selectedCitizen;
}

export function openCitizenDossier(data: CitizenDossierData): void {
  _selectedCitizen = data;
  for (const listener of _citizenDossierListeners) {
    listener();
  }
}

export function closeCitizenDossier(): void {
  _selectedCitizen = null;
  for (const listener of _citizenDossierListeners) {
    listener();
  }
}

export function useCitizenDossier(): CitizenDossierData | null {
  return useSyncExternalStore(subscribeCitizenDossier, getSelectedCitizen, getSelectedCitizen);
}

function subscribeCitizenDossier(listener: () => void): () => void {
  _citizenDossierListeners.add(listener);
  return () => {
    _citizenDossierListeners.delete(listener);
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

// ── Radial Inspect Menu ───────────────────────────────────────────────────

export type InspectBuildingType =
  | 'production'
  | 'housing'
  | 'storage'
  | 'government'
  | 'military'
  | 'construction'
  | 'general';

export interface InspectMenuOccupant {
  name: string;
  age: number;
  role: string;
  gender: string;
}

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

export function getInspectMenu(): InspectMenuState | null {
  return _inspectMenu;
}

export function openInspectMenu(state: InspectMenuState): void {
  _inspectMenu = state;
  for (const listener of _inspectMenuListeners) {
    listener();
  }
}

export function closeInspectMenu(): void {
  _inspectMenu = null;
  for (const listener of _inspectMenuListeners) {
    listener();
  }
}

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

export interface BuildingInspectorState {
  buildingDefId: string;
  gridX: number;
  gridY: number;
}

let _buildingInspector: BuildingInspectorState | null = null;
const _buildingInspectorListeners = new Set<() => void>();

export function getBuildingInspector(): BuildingInspectorState | null {
  return _buildingInspector;
}

export function openBuildingInspector(state: BuildingInspectorState): void {
  _buildingInspector = state;
  for (const listener of _buildingInspectorListeners) {
    listener();
  }
}

export function closeBuildingInspector(): void {
  _buildingInspector = null;
  for (const listener of _buildingInspectorListeners) {
    listener();
  }
}

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

export function getCitizenDossierIndex(): number | null {
  return _citizenDossierIndex;
}

export function openCitizenDossierByIndex(index: number): void {
  _citizenDossierIndex = index;
  for (const listener of _citizenDossierIndexListeners) {
    listener();
  }
}

export function closeCitizenDossierByIndex(): void {
  _citizenDossierIndex = null;
  for (const listener of _citizenDossierIndexListeners) {
    listener();
  }
}

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

export function getCursorTooltip(): CursorTooltipState | null {
  return _cursorTooltip;
}

export function setCursorTooltip(state: CursorTooltipState | null): void {
  _cursorTooltip = state;
  for (const listener of _cursorTooltipListeners) {
    listener();
  }
}

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
export function getTerrainVersion(): number {
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

/** Called by RadialBuildMenu to place a building at a grid position. */
export function requestPlacement(gridX: number, gridY: number, defId: string): boolean {
  return _placementCallback?.(gridX, gridY, defId) ?? false;
}

// ── Political Entity Panel (scene-driven) ─────────────────────────────────

let _showPoliticalPanel = false;
const _politicalPanelListeners = new Set<() => void>();

export function getPoliticalPanelVisible(): boolean {
  return _showPoliticalPanel;
}

/** Open the political entity panel from the 3D scene (e.g. tapping a political entity mesh). */
export function openPoliticalPanel(): void {
  _showPoliticalPanel = true;
  for (const listener of _politicalPanelListeners) {
    listener();
  }
}

export function closePoliticalPanel(): void {
  _showPoliticalPanel = false;
  for (const listener of _politicalPanelListeners) {
    listener();
  }
}

export function usePoliticalPanel(): boolean {
  return useSyncExternalStore(subscribePoliticalPanel, getPoliticalPanelVisible, getPoliticalPanelVisible);
}

function subscribePoliticalPanel(listener: () => void): () => void {
  _politicalPanelListeners.add(listener);
  return () => {
    _politicalPanelListeners.delete(listener);
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
    _snapshot = createSnapshot();
  }
  return _snapshot;
}
