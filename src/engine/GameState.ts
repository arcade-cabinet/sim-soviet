/**
 * GameState class and all supporting interfaces.
 * Faithful port of poc.html lines 392-404, 480-502.
 */

import { GRID_SIZE, type GridCell, type GridPoint, type TerrainType } from './GridTypes';

// --- Interfaces ---

export interface GameDate {
  year: number;
  month: number;
  tick: number;
}

export interface BuildingInstance {
  x: number;
  y: number;
  type: string;
  powered: boolean;
  level: number;
  /** Cosmodrome launch progress (ticks toward 60) */
  progress?: number;
  /** Cosmodrome has launched */
  launched?: boolean;
}

export interface Vehicle {
  x: number;
  y: number;
  tx: number;
  ty: number;
  lx: number;
  ly: number;
  state: 'idle' | 'moving';
  color: string;
}

export interface Zeppelin {
  x: number;
  y: number;
  tx: number;
  ty: number;
  lx: number;
  ly: number;
}

export interface FloatingTextItem {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface Train {
  active: boolean;
  x: number;
  y: number;
  timer: number;
}

export interface Meteor {
  active: boolean;
  struck: boolean;
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
}

export interface Quota {
  type: string;
  target: number;
  current: number;
  deadlineYear: number;
}

export type WeatherType = 'snow' | 'rain' | 'storm' | 'clear';
export type LensType = 'default' | 'water' | 'power' | 'smog' | 'aura';
export type TabType = 'zone' | 'infra' | 'state' | 'purge';

export interface Lightning {
  x: number;
  y: number;
  life: number;
}

export interface Launch {
  x: number;
  y: number;
  alt: number;
  vel: number;
}

// --- Subscribe/Notify ---

type Listener = () => void;

// --- GameState class ---

export class GameState {
  speed: number = 1;
  lastTime: number = 0;
  simAccumulator: number = 0;
  animTime: number = 0;
  tickDuration: number = 1000;

  money: number = 2000;
  lastIncome: number = 0;
  pop: number = 0;
  food: number = 200;
  vodka: number = 50;
  powerGen: number = 0;
  powerUsed: number = 0;
  waterGen: number = 0;
  waterUsed: number = 0;

  date: GameDate = { year: 1917, month: 1, tick: 0 };

  grid: GridCell[][] = [];
  buildings: BuildingInstance[] = [];
  traffic: Vehicle[] = [];
  zeppelins: Zeppelin[] = [];
  floatingTexts: FloatingTextItem[] = [];

  train: Train = { active: false, x: -5, y: 12, timer: 0 };
  meteor: Meteor = { active: false, struck: false, x: 0, y: 0, z: 1500, tx: 0, ty: 0 };
  meteorShake: number = 0;

  activeLaunch: Launch | null = null;
  activeLightning: Lightning | null = null;
  currentWeather: WeatherType = 'snow';
  timeOfDay: number = 0.5; // start at noon for good lighting

  directiveIndex: number = 0;
  activeTab: TabType = 'zone';
  selectedTool: string = 'none';
  activeLens: LensType = 'default';

  quota: Quota = { type: 'food', target: 500, current: 0, deadlineYear: 1922 };

  keys: Record<string, boolean> = { w: false, a: false, s: false, d: false };

  // --- Subscribers ---
  private listeners: Listener[] = [];

  subscribe(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  // --- Grid initialization (port of lines 480-502) ---
  initGrid(): void {
    this.grid = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      const row: GridCell[] = [];
      const riverX = Math.floor(GRID_SIZE / 2 + Math.sin(y / 3) * 4);
      const isRailY = y === this.train.y;

      for (let x = 0; x < GRID_SIZE; x++) {
        const isWater = Math.abs(x - riverX) <= 1;
        const isTree = !isWater && !isRailY && Math.random() < 0.2;
        let elev = 0;
        if (!isWater && !isRailY) {
          const noise = Math.sin(x / 3) * Math.cos(y / 3);
          if (noise > 0.4) elev = 1;
          if (noise > 0.8) elev = 2;
        }
        const terrainType: TerrainType = isWater
          ? 'water'
          : isRailY
            ? 'rail'
            : isTree
              ? 'tree'
              : 'grass';

        row.push({
          type: null,
          zone: null,
          z: elev,
          terrain: terrainType,
          isRail: isRailY,
          bridge: isRailY && isWater,
          smog: 0,
          onFire: 0,
          hasPipe: false,
          watered: false,
        });
      }
      this.grid.push(row);
    }
  }

  /**
   * Pre-place starter buildings so the city isn't empty on first load.
   * Called from App after initGrid(). Positions avoid the river and rail line.
   */
  placeStarterBuildings(): void {
    const starters: { x: number; y: number; type: string; level: number }[] = [
      // Power district (top-left cluster)
      { x: 5, y: 4, type: 'power', level: 0 },
      // Housing blocks
      { x: 7, y: 4, type: 'housing', level: 0 },
      { x: 9, y: 4, type: 'housing', level: 1 },
      { x: 7, y: 6, type: 'housing', level: 0 },
      { x: 9, y: 6, type: 'housing', level: 2 },
      // Industry
      { x: 5, y: 6, type: 'factory', level: 0 },
      { x: 5, y: 8, type: 'distillery', level: 0 },
      // Agriculture
      { x: 9, y: 8, type: 'farm', level: 0 },
      // State infrastructure
      { x: 7, y: 8, type: 'tower', level: 0 },
      { x: 3, y: 6, type: 'gulag', level: 0 },
    ];

    for (const s of starters) {
      const cell = this.grid[s.y]?.[s.x];
      if (!cell || cell.terrain === 'water') continue;
      // Clear trees to make room for buildings
      if (cell.terrain === 'tree') cell.terrain = 'grass';
      cell.type = s.type;
      this.buildings.push({
        x: s.x,
        y: s.y,
        type: s.type,
        powered: true,
        level: s.level,
      });
    }
  }
}

// Export singleton
export const gameState = new GameState();
