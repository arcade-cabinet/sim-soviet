import { GRID_SIZE } from '../config';

export interface GridCell {
  type: string | null;
  z: number;
  mesh?: any; // BabylonJS Mesh reference
}

export interface Building {
  x: number;
  y: number;
  type: string;
  powered: boolean;
  mesh?: any; // BabylonJS Mesh reference
}

export interface SnowParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

export class GameState {
  public money = 2000;
  public pop = 0;
  public food = 200;
  public vodka = 50;
  public power = 0;
  public powerUsed = 0;
  public date = { year: 1980, month: 1, tick: 0 };
  public grid: GridCell[][] = [];
  public buildings: Building[] = [];
  public selectedTool = 'none';
  public snow: SnowParticle[] = [];
  public quota = {
    type: 'food',
    target: 500,
    current: 0,
    deadlineYear: 1985,
  };

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

  public addBuilding(x: number, y: number, type: string): Building {
    const building: Building = { x, y, type, powered: false };
    this.buildings.push(building);
    return building;
  }

  public removeBuilding(x: number, y: number): void {
    this.buildings = this.buildings.filter((b) => !(b.x === x && b.y === y));
  }

  public getBuildingAt(x: number, y: number): Building | null {
    return this.buildings.find((b) => b.x === x && b.y === y) ?? null;
  }
}
