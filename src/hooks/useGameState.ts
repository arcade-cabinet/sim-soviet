/**
 * useGameState — subscribe to state changes and trigger React re-renders.
 *
 * Reads resources/population/date/quota from the ECS (source of truth),
 * and visual-only fields (timeOfDay, weather, activeTab, lens) from the
 * old GameState singleton. Components should read properties during render
 * but never mutate directly.
 */

import { useSyncExternalStore } from 'react';
import { citizens, dvory, getMetaEntity, getResourceEntity, operationalBuildings } from '@/ecs/archetypes';
import { getGameSpeed } from '@/stores/gameStore';
import { DIRECTIVES } from '../engine/Directives';
import { type GameState, gameState } from '../engine/GameState';
import { TICKS_PER_MONTH } from '../engine/GridTypes';
import { getSeason } from '../engine/WeatherSystem';
import type { Season } from '../scene/TerrainGrid';

/** Immutable snapshot of derived values for UI consumption. */
export interface GameSnapshot {
  // Resources
  money: number;
  lastIncome: number;
  pop: number;
  food: number;
  vodka: number;
  powerGen: number;
  powerUsed: number;
  waterGen: number;
  waterUsed: number;

  // Time
  year: number;
  month: number;
  tick: number;
  speed: number;
  timeOfDay: number;
  monthProgress: number;
  dateLabel: string;
  seasonLabel: string;
  season: Season;
  weatherLabel: string;

  // UI state
  activeTab: GameState['activeTab'];
  selectedTool: string;
  activeLens: GameState['activeLens'];

  // Quota
  quotaType: string;
  quotaTarget: number;
  quotaCurrent: number;
  quotaDeadline: number;

  // Directive
  directiveText: string;
  directiveReward: string;

  // Personnel / Political
  threatLevel: string;
  blackMarks: number;
  commendations: number;
  settlementTier: string;
  currentEra: string;

  // Soviet economy (planned resources)
  timber: number;
  steel: number;
  cement: number;
  prefab: number;

  // Workforce
  assignedWorkers: number;
  idleWorkers: number;
  dvorCount: number;
  avgMorale: number;
  avgLoyalty: number;
}

const MONTH_NAMES = ['', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// Track money across snapshots to compute income delta
let _previousMoney: number | null = null;
let _lastIncome = 0;

function seasonLabelToSeason(label: string): Season {
  if (label === 'WINTER') return 'winter';
  if (label.includes('SPRING')) return 'spring';
  if (label === 'SUMMER') return 'summer';
  return 'autumn';
}

function createSnapshot(state: GameState): GameSnapshot {
  // Read from ECS when available (source of truth for game data)
  const res = getResourceEntity();
  const meta = getMetaEntity();
  const m = meta?.gameMeta;

  // Resources — prefer ECS, fall back to old GameState
  const money = Math.round(res?.resources.money ?? state.money);
  const food = Math.round(res?.resources.food ?? state.food);
  const vodka = Math.round(res?.resources.vodka ?? state.vodka);
  const powerGen = res?.resources.power ?? state.powerGen;
  const powerUsed = res?.resources.powerUsed ?? state.powerUsed;
  const pop = m ? citizens.entities.length : state.pop;

  // Compute income as money delta between snapshots
  if (_previousMoney !== null) {
    _lastIncome = money - _previousMoney;
  }
  _previousMoney = money;

  // Derive water capacity from pump buildings in ECS
  let waterCapacity = 0;
  let waterDemand = 0;
  for (const b of operationalBuildings.entities) {
    // Pump buildings produce water (defId contains 'pump' or has waterOutput)
    if (b.building.defId === 'pump' || b.building.defId === 'water-pump' || b.building.defId === 'warehouse') {
      waterCapacity += 50;
    }
    // All powered buildings consume some water
    if (b.building.powered && b.building.powerReq > 0) {
      waterDemand += Math.ceil(b.building.powerReq / 5);
    }
  }

  // Date — prefer ECS metaStore
  const year = m?.date.year ?? state.date.year;
  const month = m?.date.month ?? state.date.month;
  const tick = m?.date.tick ?? state.date.tick;

  // Quota — prefer ECS metaStore
  const quota = m?.quota ?? state.quota;

  // Speed — prefer ECS gameStore
  const speed = getGameSpeed();

  const seasonLabel = getSeason(month);
  const dir = DIRECTIVES[state.directiveIndex];

  // Workforce breakdown
  let assignedCount = 0;
  for (const c of citizens.entities) {
    if (c.citizen?.assignment) assignedCount++;
  }

  // Dvor loyalty average
  let loyaltySum = 0;
  for (const d of dvory.entities) {
    loyaltySum += d.dvor.loyaltyToCollective;
  }
  const avgLoyalty = dvory.entities.length > 0 ? Math.round(loyaltySum / dvory.entities.length) : 0;

  // Morale average
  let moraleSum = 0;
  for (const c of citizens.entities) {
    moraleSum += c.citizen?.happiness ?? 0;
  }
  const avgMorale = pop > 0 ? Math.round(moraleSum / pop) : 0;

  return {
    money,
    lastIncome: _lastIncome,
    pop,
    food,
    vodka,
    powerGen,
    powerUsed,
    waterGen: waterCapacity,
    waterUsed: waterDemand,

    year,
    month,
    tick,
    speed,
    timeOfDay: state.timeOfDay,
    monthProgress: tick / TICKS_PER_MONTH,
    dateLabel: `${MONTH_NAMES[month] || '???'} ${year}`,
    seasonLabel,
    season: seasonLabelToSeason(seasonLabel),
    weatherLabel: state.currentWeather.toUpperCase(),

    activeTab: state.activeTab,
    selectedTool: state.selectedTool,
    activeLens: state.activeLens,

    quotaType: quota.type,
    quotaTarget: quota.target,
    quotaCurrent: quota.current,
    quotaDeadline: quota.deadlineYear,

    directiveText: dir ? dir.text : 'No active directive.',
    directiveReward: dir ? `+${dir.reward}₽` : '',

    threatLevel: m?.threatLevel ?? 'safe',
    blackMarks: m?.blackMarks ?? 0,
    commendations: m?.commendations ?? 0,
    settlementTier: m?.settlementTier ?? 'selo',
    currentEra: m?.currentEra ?? 'revolution',

    // Soviet economy
    timber: Math.round(res?.resources.timber ?? 0),
    steel: Math.round(res?.resources.steel ?? 0),
    cement: Math.round(res?.resources.cement ?? 0),
    prefab: Math.round(res?.resources.prefab ?? 0),

    // Workforce
    assignedWorkers: assignedCount,
    idleWorkers: pop - assignedCount,
    dvorCount: dvory.entities.length,
    avgMorale,
    avgLoyalty,
  };
}

// Snapshot cache — only recalculate when notify() fires
let cachedSnapshot: GameSnapshot | null = null;
let _snapshotVersion = 0;

function subscribe(callback: () => void): () => void {
  return gameState.subscribe(() => {
    _snapshotVersion++;
    cachedSnapshot = null; // invalidate
    callback();
  });
}

function getSnapshot(): GameSnapshot {
  if (!cachedSnapshot) {
    cachedSnapshot = createSnapshot(gameState);
  }
  return cachedSnapshot;
}

/**
 * React hook that subscribes to gameState changes.
 * Returns a GameSnapshot that updates on every simTick / user action.
 */
export function useGameSnapshot(): GameSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Direct access to the mutable state for imperative operations. */
export function useGameStateRef(): GameState {
  return gameState;
}
