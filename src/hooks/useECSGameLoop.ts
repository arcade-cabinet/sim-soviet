/**
 * useECSGameLoop — Runs the full ECS SimulationEngine tick loop.
 *
 * Replaces useGameLoop for the merged version. Calls SimulationEngine.tick()
 * which orchestrates all 18+ ECS systems (power, production, consumption,
 * economy, era, workers, political entities, events, pravda, etc.).
 *
 * Uses the archive's gameStore for React state notification.
 */

import { useEffect, useRef } from 'react';
import { getEngine } from '../bridge/GameInit';
import { gameState } from '../engine/GameState';
import { getGameSpeed, isPaused, notifyStateChange } from '../stores/gameStore';

export function useECSGameLoop(): void {
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const simAccumulator = useRef(0);

  useEffect(() => {
    function loop(timestamp: number) {
      if (lastTimeRef.current === 0) lastTimeRef.current = timestamp;
      const dt = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      const engine = getEngine();
      const paused = isPaused();
      const speed = getGameSpeed();
      let didTick = false;

      if (engine && !paused && speed > 0) {
        // Accumulate time for sim ticks
        const TICK_DURATION_MS = 1000; // 1 tick per second at speed 1
        simAccumulator.current += dt * 1000;
        const tickMs = TICK_DURATION_MS / speed;

        while (simAccumulator.current >= tickMs) {
          simAccumulator.current -= tickMs;
          engine.tick();
          didTick = true;
        }
      }

      // Advance time of day for 3D lighting (cosmetic only)
      if (!paused && speed > 0) {
        gameState.timeOfDay = (gameState.timeOfDay + dt * 0.005 * speed) % 1;
        // Notify old gameState for 3D scene components (lighting updates)
        gameState.notify();
      }

      // Only notify React of state changes when the engine actually ticked
      // (the engine also calls onStateChange per tick via callbacks)
      if (didTick) {
        notifyStateChange();
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);
}
