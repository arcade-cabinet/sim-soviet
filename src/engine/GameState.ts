/**
 * GameState class and all supporting interfaces.
 * Faithful port of poc.html lines 392-404, 480-502.
 */

import { GRID_SIZE, type GridCell, type TerrainType } from './GridTypes';

// --- Interfaces ---

/** Calendar date within the game simulation. */
export interface GameDate {
  /** Current year (e.g. 1917) */
  year: number;
  /** Current month (1-12) */
  month: number;
  /** Tick within the current month (0 to TICKS_PER_MONTH-1) */
  tick: number;
}

/** A placed building on the legacy grid. */
export interface BuildingInstance {
  /** Grid column */
  x: number;
  /** Grid row */
  y: number;
  /** Building type key (e.g. 'housing', 'factory', 'power') */
  type: string;
  /** Whether this building currently receives power */
  powered: boolean;
  /** Upgrade level (0-2 for grown buildings) */
  level: number;
}

/** A vehicle moving along roads on the grid. */
export interface Vehicle {
  /** Current X position (fractional during movement) */
  x: number;
  /** Current Y position (fractional during movement) */
  y: number;
  /** Target X position */
  tx: number;
  /** Target Y position */
  ty: number;
  /** Last X position (to avoid reversing direction) */
  lx: number;
  /** Last Y position (to avoid reversing direction) */
  ly: number;
  /** Movement state */
  state: 'idle' | 'moving';
  /** Vehicle color for rendering */
  color: string;
}

/** A fire-fighting zeppelin patrolling the sky. */
export interface Zeppelin {
  /** Current X position */
  x: number;
  /** Current Y position */
  y: number;
  /** Target X position */
  tx: number;
  /** Target Y position */
  ty: number;
  /** Last X position */
  lx: number;
  /** Last Y position */
  ly: number;
}

/** A floating text label that animates above the grid. */
export interface FloatingTextItem {
  /** Grid X position (with jitter) */
  x: number;
  /** Grid Y position (with jitter) */
  y: number;
  /** Display text */
  text: string;
  /** Text color (CSS hex) */
  color: string;
  /** Remaining lifetime in frames */
  life: number;
  /** Initial lifetime in frames (for fade calculation) */
  maxLife: number;
}

/** State of the supply train that crosses the map. */
export interface Train {
  /** Whether the train is currently crossing */
  active: boolean;
  /** Current X position (fractional) */
  x: number;
  /** Fixed Y row the train travels on */
  y: number;
  /** Timer for spawn interval (ms) */
  timer: number;
}

/** State of the meteor event (rare disaster). */
export interface Meteor {
  /** Whether the meteor is currently descending */
  active: boolean;
  /** Whether the meteor has already struck the ground */
  struck: boolean;
  /** Current X position */
  x: number;
  /** Current Y position */
  y: number;
  /** Current altitude (reaches 0 on impact) */
  z: number;
  /** Target X cell on impact */
  tx: number;
  /** Target Y cell on impact */
  ty: number;
}

/** 5-year plan quota tracking state. */
export interface Quota {
  /** Resource type being tracked ('food' or 'vodka') */
  type: string;
  /** Target amount to reach */
  target: number;
  /** Current progress toward target */
  current: number;
  /** Year the quota must be met by */
  deadlineYear: number;
}

/** Weather types that affect gameplay (smog, fires, construction). */
export type WeatherType = 'snow' | 'rain' | 'storm' | 'clear';

/** Visual overlay lens modes for inspecting infrastructure. */
export type LensType = 'default' | 'water' | 'power' | 'smog' | 'aura';

/** Legacy command tab categories retained for native HUD compatibility. */
export type TabType = 'zone' | 'infra' | 'state' | 'purge';

/** Lightning strike visual effect state. */
export interface Lightning {
  /** Grid X of the strike */
  x: number;
  /** Grid Y of the strike */
  y: number;
  /** Remaining visual lifetime in frames */
  life: number;
}

// --- Subscribe/Notify ---

type Listener = () => void;

// --- GameState class ---

/**
 * Mutable game state singleton for the legacy (non-ECS) engine layer.
 *
 * Holds the canonical grid, building list, resource tallies, weather,
 * and all visual effect state (train, meteor, zeppelins, floating text).
 * UI components subscribe via `useSyncExternalStore` through `useGameSnapshot()`.
 *
 * NOTE: The ECS `SimulationEngine` is the authoritative state source in the
 * current architecture. GameState is synced from ECS for scene rendering.
 */
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

  /**
   * Registers a listener that is called whenever game state changes.
   *
   * @param listener - Callback to invoke on state change
   * @returns Unsubscribe function
   */
  subscribe(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /** Notifies all subscribed listeners that state has changed. */
  notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  /**
   * Initializes the 30x30 grid with terrain (river, trees, hills, rail).
   * Must be called once before any simulation ticks.
   */
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
        const terrainType: TerrainType = isWater ? 'water' : isRailY ? 'rail' : isTree ? 'tree' : 'grass';

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

/** Global singleton GameState instance shared across the legacy engine. */
export const gameState = new GameState();
