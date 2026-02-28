/**
 * Traffic (vehicle) update logic.
 * Faithful port of poc.html lines 871-903.
 */

import type { GameState } from './GameState';
import { GRID_SIZE } from './GridTypes';
import { getSeason } from './WeatherSystem';

export function updateTraffic(state: GameState, dt: number): void {
  const season = getSeason(state.date.month);
  const speedMult = season === 'MUD (SPRING)' ? 0.015 : season === 'WINTER' ? 0.025 : 0.04;
  const SPEED = speedMult * (dt / 16);

  // Spawn new vehicles
  if (Math.random() < 0.05 * (dt / 16) && state.traffic.length < 20) {
    const roads: { x: number; y: number }[] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (state.grid[y][x].type === 'road') roads.push({ x, y });
      }
    }
    if (roads.length > 0) {
      const start = roads[Math.floor(Math.random() * roads.length)];
      state.traffic.push({
        x: start.x,
        y: start.y,
        tx: start.x,
        ty: start.y,
        lx: start.x,
        ly: start.y,
        state: 'idle',
        color: Math.random() > 0.3 ? '#555' : '#a00',
      });
    }
  }

  // Update existing vehicles
  for (let i = state.traffic.length - 1; i >= 0; i--) {
    const v = state.traffic[i];

    if (v.state === 'idle') {
      const dirs = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ];
      const valid = dirs
        .map((d) => ({ x: v.x + d.x, y: v.y + d.y }))
        .filter(
          (n) => n.x >= 0 && n.x < GRID_SIZE && n.y >= 0 && n.y < GRID_SIZE && state.grid[n.y][n.x].type === 'road',
        );

      // Prefer not to reverse direction
      let forward = valid.filter((n) => !(n.x === v.lx && n.y === v.ly));
      if (forward.length === 0) forward = valid;

      if (forward.length > 0) {
        const next = forward[Math.floor(Math.random() * forward.length)];
        v.lx = v.x;
        v.ly = v.y;
        v.tx = next.x;
        v.ty = next.y;
        v.state = 'moving';
      } else {
        state.traffic.splice(i, 1);
        continue;
      }
    }

    if (v.state === 'moving') {
      const dx = v.tx - v.x;
      const dy = v.ty - v.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= SPEED) {
        v.x = v.tx;
        v.y = v.ty;
        v.state = 'idle';
      } else {
        v.x += (dx / dist) * SPEED;
        v.y += (dy / dist) * SPEED;
      }
    }
  }
}
