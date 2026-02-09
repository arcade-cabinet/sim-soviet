/**
 * GameWorld — imperative game initialization inside Reactylon's <Scene>.
 *
 * Uses useScene()/useCanvas() hooks to get BabylonJS objects,
 * then creates the renderer, gesture manager, and particle system.
 * Returns null (no BabylonJS JSX elements — all imperative).
 */
import { useEffect, useRef } from 'react';
import { useCanvas, useScene } from 'reactylon';
import type { SimCallbacks } from '@/game/SimulationEngine';
import { SimulationEngine } from '@/game/SimulationEngine';
import { GameRng, generateSeedPhrase } from '@/game/SeedSystem';
import { GestureManager } from '@/input/GestureManager';
import { IsometricRenderer } from '@/rendering/IsometricRenderer';
import { ParticleSystem } from '@/rendering/ParticleSystem';
import { getGameState, notifyStateChange } from '@/stores/gameStore';

interface Props {
  callbacks: SimCallbacks;
  gameStarted: boolean;
}

export function GameWorld({ callbacks, gameStarted }: Props) {
  const scene = useScene();
  const canvas = useCanvas();

  const rendererRef = useRef<IsometricRenderer | null>(null);
  const gestureRef = useRef<GestureManager | null>(null);
  const particlesRef = useRef<ParticleSystem | null>(null);
  const simRef = useRef<SimulationEngine | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initializedRef = useRef(false);

  // Create renderer and gesture manager once scene is available
  useEffect(() => {
    if (!scene || !canvas || !(canvas instanceof HTMLCanvasElement)) return;

    const gameState = getGameState();
    const renderer = new IsometricRenderer(scene, gameState);
    const gestures = new GestureManager(canvas, scene, gameState, renderer);
    const particles = new ParticleSystem(scene);

    rendererRef.current = renderer;
    gestureRef.current = gestures;
    particlesRef.current = particles;

    // Start snow immediately (it's always snowing in the Soviet Union)
    particles.createSnowEffect();

    // Renderer update in the render loop
    scene.onBeforeRenderObservable.add(() => {
      renderer.update();
    });

    return () => {
      gestures.dispose();
      particles.dispose();
    };
  }, [scene, canvas]);

  // Initialize grid + start simulation when game starts
  useEffect(() => {
    if (!gameStarted || initializedRef.current) return;
    if (!rendererRef.current) return;

    initializedRef.current = true;
    rendererRef.current.initialize();

    // Start simulation engine with seeded RNG
    const gameState = getGameState();
    const seed = gameState.seed || generateSeedPhrase();
    gameState.seed = seed;
    const rng = new GameRng(seed);

    simRef.current = new SimulationEngine(
      gameState,
      {
        ...callbacks,
        onStateChange: () => {
          callbacks.onStateChange();
          notifyStateChange();
        },
      },
      rng,
    );

    tickRef.current = setInterval(() => {
      simRef.current?.tick();
    }, 1000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [gameStarted, callbacks]);

  return null;
}
