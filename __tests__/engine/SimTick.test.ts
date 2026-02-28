/**
 * SimTick — core simulation logic tests.
 *
 * IMPORTANT: simTick operates on whatever GameState you pass, but the
 * Directives module uses the `gameState` singleton internally for its
 * check functions. So for directive tests we must use the singleton.
 *
 * Directive checks now query ECS building entities (via Miniplex),
 * so directive tests must add entities to the ECS world.
 */
import { GameState, gameState } from '../../src/engine/GameState';
import { simTick } from '../../src/engine/SimTick';
import { GRID_SIZE, TICKS_PER_MONTH } from '../../src/engine/GridTypes';
import { world } from '../../src/ecs/world';
import { createBuilding } from '../../src/ecs/factories/buildingFactories';

/** Reset the singleton to a fresh state for each test. */
function resetSingleton(): GameState {
  // Re-initialize the singleton's grid and reset key fields
  gameState.grid = [];
  gameState.buildings = [];
  gameState.floatingTexts = [];
  gameState.traffic = [];
  gameState.zeppelins = [];
  gameState.money = 2000;
  gameState.lastIncome = 0;
  gameState.pop = 0;
  gameState.food = 200;
  gameState.vodka = 50;
  gameState.powerGen = 0;
  gameState.powerUsed = 0;
  gameState.waterGen = 0;
  gameState.waterUsed = 0;
  gameState.date = { year: 1917, month: 1, tick: 0 };
  gameState.directiveIndex = 0;
  gameState.currentWeather = 'snow';
  gameState.speed = 1;
  gameState.train = { active: false, x: -5, y: 12, timer: 0 };
  gameState.meteor = { active: false, struck: false, x: 0, y: 0, z: 1500, tx: 0, ty: 0 };
  gameState.meteorShake = 0;
  gameState.activeLaunch = null;
  gameState.activeLightning = null;
  gameState.quota = { type: 'food', target: 500, current: 0, deadlineYear: 1922 };
  gameState.simAccumulator = 0;
  gameState.initGrid();

  // Clear ECS world (directive checks now query Miniplex entities)
  for (const entity of [...world.entities]) {
    world.remove(entity);
  }

  return gameState;
}

/** Find a grass tile and place a building. */
function placeBuilding(
  s: GameState,
  type: string,
  opts?: { powered?: boolean },
): { x: number; y: number } {
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const cell = s.grid[y][x];
      if (
        cell.terrain === 'grass' &&
        !cell.isRail &&
        !cell.type &&
        cell.z === 0
      ) {
        cell.type = type;
        s.buildings.push({
          x,
          y,
          type,
          powered: opts?.powered ?? true,
          level: 0,
        });
        return { x, y };
      }
    }
  }
  throw new Error(`No space for ${type}`);
}

/** Place a pump on the first available water tile. */
function placePump(s: GameState): { x: number; y: number } {
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const cell = s.grid[y][x];
      if (cell.terrain === 'water' && !cell.type && !cell.isRail) {
        cell.type = 'pump';
        s.buildings.push({ x, y, type: 'pump', powered: true, level: 0 });
        return { x, y };
      }
    }
  }
  throw new Error('No water cell for pump');
}

/** Place a building on grass within 3 tiles of (cx, cy) — within water expansion radius. */
function placeBuildingNear(
  s: GameState,
  type: string,
  cx: number,
  cy: number,
  opts?: { powered?: boolean },
): { x: number; y: number } {
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      if (Math.hypot(dx, dy) > 3) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) continue;
      const cell = s.grid[y][x];
      if (cell.terrain === 'grass' && !cell.isRail && !cell.type && cell.z === 0) {
        cell.type = type;
        s.buildings.push({ x, y, type, powered: opts?.powered ?? true, level: 0 });
        return { x, y };
      }
    }
  }
  throw new Error(`No grass cell within 3 tiles of (${cx}, ${cy}) for ${type}`);
}

describe('simTick', () => {
  beforeEach(() => {
    resetSingleton();
  });

  it('advances the tick counter', () => {
    const s = gameState;
    const before = s.date.tick;
    simTick(s);
    expect(s.date.tick).toBe(before + 1);
  });

  it('rolls over month after TICKS_PER_MONTH ticks', () => {
    const s = gameState;
    s.date.month = 1;
    s.date.tick = TICKS_PER_MONTH - 1;
    simTick(s);
    expect(s.date.month).toBe(2);
  });

  it('rolls over year after month 12', () => {
    const s = gameState;
    s.date.month = 12;
    s.date.tick = TICKS_PER_MONTH - 1;
    simTick(s);
    expect(s.date.month).toBe(1);
    expect(s.date.year).toBe(1918);
  });

  describe('power generation', () => {
    it('coal plant generates power', () => {
      const s = gameState;
      placeBuilding(s, 'power', { powered: true });
      simTick(s);
      expect(s.powerGen).toBeGreaterThan(0);
    });

    it('nuclear plant generates more power', () => {
      const s1 = resetSingleton();
      placeBuilding(s1, 'power', { powered: true });
      simTick(s1);
      const coalPower = s1.powerGen;

      const s2 = resetSingleton();
      placeBuilding(s2, 'nuke', { powered: true });
      simTick(s2);
      expect(s2.powerGen).toBeGreaterThan(coalPower);
    });
  });

  describe('smog diffusion', () => {
    it('factory produces smog', () => {
      const s = gameState;
      // Factory needs power (powerReq: 2) and water (waterReq: 2) to stay powered.
      // SimTick recalculates powerGen/waterGen from buildings each tick.
      placeBuilding(s, 'power', { powered: true }); // provides powerGen: 100
      const pump = placePump(s); // provides waterGen: 50 + waters nearby cells
      const { x, y } = placeBuildingNear(s, 'factory', pump.x, pump.y);
      for (let i = 0; i < 5; i++) simTick(s);
      expect(s.grid[y][x].smog).toBeGreaterThan(0);
    });

    it('smog spreads to adjacent tiles', () => {
      const s = gameState;
      const { x, y } = placeBuilding(s, 'factory', { powered: true });
      s.grid[y][x].smog = 100;
      simTick(s);
      const adj = [
        [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1],
      ];
      let adjacentSmog = 0;
      for (const [ax, ay] of adj) {
        if (ax >= 0 && ax < GRID_SIZE && ay >= 0 && ay < GRID_SIZE) {
          adjacentSmog += s.grid[ay][ax].smog;
        }
      }
      expect(adjacentSmog).toBeGreaterThan(0);
    });
  });

  describe('food production', () => {
    it('farms produce food at month boundary', () => {
      const s = gameState;
      // Farm (level 0) has waterReq: 5, powerReq: 0. Needs water but not power.
      // Food production only triggers at month boundaries (isMonthPassed).
      const pump = placePump(s); // waterGen: 50 + waters nearby cells
      placeBuildingNear(s, 'farm', pump.x, pump.y);
      const beforeFood = s.food;
      // Advance to just before month boundary, then trigger it
      s.date.tick = TICKS_PER_MONTH - 1;
      simTick(s); // tick → TICKS_PER_MONTH → month rollover → production fires
      expect(s.food).toBeGreaterThan(beforeFood);
    });
  });

  describe('population', () => {
    it('housing with food produces population over several months', () => {
      const s = gameState;
      s.food = 1000;
      // Housing (level 0) has waterReq: 2, powerReq: 0. Needs water to stay powered.
      // Population growth: Math.floor(Math.random() * 3) per month — can be 0.
      // Add power plant in case housing upgrades during the run (level 1 needs powerReq: 5).
      placeBuilding(s, 'power', { powered: true });
      const pump = placePump(s);
      for (let i = 0; i < 5; i++) {
        const pos = placeBuildingNear(s, 'housing', pump.x, pump.y);
        s.grid[pos.y][pos.x].zone = 'res';
      }
      // Run 10 month boundaries to overcome randomness — P(all zero) = (1/3)^10 ≈ 0.002%
      s.date.tick = 0;
      for (let i = 0; i < TICKS_PER_MONTH * 10; i++) simTick(s);
      expect(s.pop).toBeGreaterThan(0);
    });
  });

  describe('directives', () => {
    it('completes directive 0 (build 4 housing) when condition met', () => {
      const s = gameState;
      s.directiveIndex = 0;
      // Place 4 housing buildings via ECS (directive checks query Miniplex entities)
      for (let i = 0; i < 4; i++) {
        createBuilding(i, 0, 'workers-house-a');
      }
      const moneyBefore = s.money;
      simTick(s);
      // Directive check uses ECS entities — should detect 4 housing buildings
      expect(s.directiveIndex).toBe(1);
      expect(s.money).toBeGreaterThan(moneyBefore);
    });
  });
});
