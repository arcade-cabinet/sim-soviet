/**
 * Meteor update logic.
 * Faithful port of poc.html lines 548-572 (from mainLoop).
 */

import { GRID_SIZE } from './GridTypes';
import type { GameState } from './GameState';
import { showAdvisor } from './helpers';

export function updateMeteor(state: GameState, dt: number): void {
  if (!state.meteor.active) return;

  state.meteor.z -= 0.4 * dt;
  state.meteor.x += (state.meteor.tx - state.meteor.x) * 0.0008 * dt;
  state.meteor.y += (state.meteor.ty - state.meteor.y) * 0.0008 * dt;

  if (state.meteor.z <= 0) {
    state.meteor.active = false;
    state.meteor.struck = true;
    state.activeLightning = { x: state.meteor.tx, y: state.meteor.ty, life: 40 };
    state.meteorShake = 50;

    const cx = Math.floor(state.meteor.tx);
    const cy = Math.floor(state.meteor.ty);

    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (Math.hypot(dx, dy) <= 2.5) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
            const cell = state.grid[ny][nx];
            if (dx === 0 && dy === 0) {
              cell.terrain = 'crater';
              cell.type = null;
              cell.zone = null;
              cell.onFire = 0;
              cell.bridge = false;
              cell.z = 0;
            } else {
              if (cell.type && cell.type !== 'road') cell.onFire = 1;
            }
            state.buildings = state.buildings.filter(
              (ob) => !(ob.x === nx && ob.y === ny && dx === 0 && dy === 0)
            );
          }
        }
      }
    }

    showAdvisor(
      state,
      'Min. Defense: A cosmic body struck Sector 7G. The crater radiates energy. The Cosmic Tap has been authorized.',
      'DEFENSE'
    );
    // NOTE: In the POC, the Cosmic Tap button is revealed here.
    // The renderer/UI layer should check state.meteor.struck to show the tap tool.
  }
}
