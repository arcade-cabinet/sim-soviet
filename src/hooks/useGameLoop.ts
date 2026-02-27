/**
 * useGameLoop — Runs the simulation loop at the correct speed.
 *
 * Calls simTick(), updateTrain(), updateTraffic(), updateMeteor() per tick.
 * Also advances timeOfDay and floating text lifetimes.
 *
 * Speed 0 = paused, 1 = normal (1 tick/sec), 3 = fast (3 ticks/sec).
 */

import { useEffect, useRef } from 'react';
import { gameState } from '../engine/GameState';
import { simTick } from '../engine/SimTick';
import { updateTrain } from '../engine/TrainSystem';
import { updateTraffic } from '../engine/TrafficSystem';
import { updateMeteor } from '../engine/MeteorSystem';
import { GRID_SIZE } from '../engine/GridTypes';

export function useGameLoop(): void {
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    function loop(timestamp: number) {
      if (lastTimeRef.current === 0) lastTimeRef.current = timestamp;
      const dt = (timestamp - lastTimeRef.current) / 1000; // seconds
      lastTimeRef.current = timestamp;

      const state = gameState;

      if (state.speed > 0) {
        // Accumulate time for sim ticks
        state.simAccumulator += dt * 1000; // ms
        const tickMs = state.tickDuration / state.speed;

        while (state.simAccumulator >= tickMs) {
          state.simAccumulator -= tickMs;
          simTick(state);
        }

        // Advance time of day (1 full cycle = ~12 in-game months = ~180 ticks)
        state.timeOfDay = (state.timeOfDay + dt * 0.005 * state.speed) % 1;
      }

      // Per-frame updates (even when paused for visual smoothness)
      updateTrain(state, dt);
      updateTraffic(state, dt);
      updateMeteor(state, dt);

      // Floating text lifetime
      state.floatingTexts = state.floatingTexts.filter((ft) => {
        ft.life--;
        return ft.life > 0;
      });

      // Zeppelin AI: target nearest fire
      const fireBuildings = state.buildings.filter(
        (b) => state.grid[b.y]?.[b.x]?.onFire > 0
      );
      state.zeppelins.forEach((z) => {
        if (fireBuildings.length > 0) {
          // Find nearest fire
          let nearest = fireBuildings[0];
          let nearestDist = Math.hypot(z.x - nearest.x, z.y - nearest.y);
          for (const fb of fireBuildings) {
            const d = Math.hypot(z.x - fb.x, z.y - fb.y);
            if (d < nearestDist) {
              nearest = fb;
              nearestDist = d;
            }
          }
          z.tx = nearest.x;
          z.ty = nearest.y;
        } else {
          // Patrol randomly
          if (
            Math.hypot(z.x - z.tx, z.y - z.ty) < 1 ||
            Math.random() < 0.01
          ) {
            z.tx = Math.random() * GRID_SIZE;
            z.ty = Math.random() * GRID_SIZE;
          }
        }
        // Move toward target
        const moveSpeed = 3 * dt;
        const dx = z.tx - z.x;
        const dy = z.ty - z.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.5) {
          z.x += (dx / dist) * moveSpeed;
          z.y += (dy / dist) * moveSpeed;
        }
        // If over a fire, extinguish it
        if (dist < 1.5) {
          const cell =
            state.grid[Math.round(z.ty)]?.[Math.round(z.tx)];
          if (cell && cell.onFire > 0) {
            cell.onFire = 0;
          }
        }
      });

      state.animTime = timestamp;
      state.notify();

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);
}
