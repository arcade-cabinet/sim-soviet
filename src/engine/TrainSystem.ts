/**
 * Train update logic.
 * Faithful port of poc.html lines 926-946.
 */

import type { GameState } from './GameState';
import { GRID_SIZE } from './GridTypes';
import { addFloatingText, showToast } from './helpers';

/**
 * Updates the supply train each frame.
 *
 * The Vanguard train spawns every 30 seconds, crosses the map on the rail row,
 * and drops supplies (rubles + vodka) at adjacent powered stations. Also adds
 * smog to the rail cells it passes through and destroys vehicles on the tracks.
 *
 * @param state - GameState containing train, buildings, and grid
 * @param dt    - Frame delta time in milliseconds
 */
export function updateTrain(state: GameState, dt: number): void {
  state.train.timer += dt;

  if (!state.train.active && state.train.timer > 30000) {
    state.train.active = true;
    state.train.x = -5;
    state.train.timer = 0;
    showToast(state, '🚂 THE VANGUARD APPROACHES 🚂');
  }

  if (state.train.active) {
    const oldX = Math.floor(state.train.x);
    state.train.x += 0.12 * (dt / 16);
    const newX = Math.floor(state.train.x);

    if (newX > oldX && newX >= 0 && newX < GRID_SIZE) {
      const adjacentStations = state.buildings.filter(
        (b) => b.type === 'station' && b.powered && Math.abs(b.x - newX) <= 1 && Math.abs(b.y - state.train.y) <= 1,
      );

      if (adjacentStations.length > 0) {
        state.money += 200;
        state.vodka += 25;
        addFloatingText(state, newX, state.train.y, '+200₽ +25🍾', '#fbc02d');
        showToast(state, '+200₽, +25 VODKA (SUPPLY DROP)');
      }

      state.grid[state.train.y][newX].smog += 5;

      state.traffic = state.traffic.filter((v) => !(Math.round(v.x) === newX && Math.round(v.y) === state.train.y));
    }

    if (state.train.x > GRID_SIZE + 5) {
      state.train.active = false;
    }
  }
}
