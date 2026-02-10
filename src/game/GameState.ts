import { GRID_SIZE } from '../config';

export interface GridCell {
  type: string | null;
  z: number;
}

export interface Building {
  x: number;
  y: number;
  defId: string;
  powered: boolean;
}

export interface SnowParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

export interface GameOverState {
  victory: boolean;
  reason: string;
}

export class GameState {
  public seed = '';
  public money = 2000;
  public pop = 0;
  public food = 200;
  public vodka = 50;
  public power = 0;
  public powerUsed = 0;
  public date = { year: 1922, month: 10, tick: 0 };
  public grid: GridCell[][] = [];
  public buildings: Building[] = [];
  public selectedTool = 'none';
  public snow: SnowParticle[] = [];
  public quota = {
    type: 'food',
    target: 500,
    current: 0,
    deadlineYear: 1927,
  };
  public gameOver: GameOverState | null = null;
  public leaderName: string | undefined = undefined;
  public leaderPersonality: string | undefined = undefined;
  public settlementTier: 'selo' | 'posyolok' | 'pgt' | 'gorod' = 'selo';
  public blackMarks = 0;
  public commendations = 0;
  public threatLevel: 'safe' | 'watched' | 'warned' | 'investigated' | 'reviewed' | 'arrested' =
    'safe';

  constructor() {
    // Initialize grid
    for (let y = 0; y < GRID_SIZE; y++) {
      const row: GridCell[] = [];
      for (let x = 0; x < GRID_SIZE; x++) {
        row.push({ type: null, z: 0 });
      }
      this.grid.push(row);
    }
  }

  public getCell(x: number, y: number): GridCell | null {
    if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) return null;
    return this.grid[y]?.[x] ?? null;
  }

  public setCell(x: number, y: number, type: string | null): void {
    const cell = this.getCell(x, y);
    if (cell) {
      cell.type = type;
    }
  }

  public addBuilding(x: number, y: number, defId: string): Building {
    // Guard against duplicate placement at the same coordinates
    const existing = this.getBuildingAt(x, y);
    if (existing) {
      return existing;
    }
    const building: Building = { x, y, defId, powered: false };
    this.buildings.push(building);
    return building;
  }

  /** Reset all grid cells to empty (used before loading a save). */
  public resetGrid(): void {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const cell = this.grid[y]?.[x];
        if (cell) {
          cell.type = null;
          cell.z = 0;
        }
      }
    }
  }

  public removeBuilding(x: number, y: number): void {
    this.buildings = this.buildings.filter((b) => !(b.x === x && b.y === y));
  }

  public getBuildingAt(x: number, y: number): Building | null {
    return this.buildings.find((b) => b.x === x && b.y === y) ?? null;
  }
}
