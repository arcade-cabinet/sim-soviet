/**
 * GameWorld — imperative game initialization for Canvas 2D rendering.
 *
 * Creates the Canvas2DRenderer, SpriteLoader, gesture manager, and simulation engine.
 * Initializes the ECS world (resource store, grid) before simulation starts.
 * Attaches to a plain HTMLCanvasElement (no BabylonJS/Reactylon).
 */
import { useEffect, useRef } from 'react';
import { AudioManager } from '@/audio/AudioManager';
import { GAMEPLAY_PLAYLIST, MUSIC_CONTEXTS } from '@/audio/AudioManifest';
import { initDatabase } from '@/db/provider';
import { createResourceStore } from '@/ecs/factories';
import { world } from '@/ecs/world';
import { Season } from '@/game/Chronology';
import { GameRng, generateSeedPhrase } from '@/game/SeedSystem';
import type { SimCallbacks } from '@/game/SimulationEngine';
import { SimulationEngine } from '@/game/SimulationEngine';
import { generateTerrain, getTerrainSpriteNames } from '@/game/TerrainGenerator';
import { WeatherType } from '@/game/WeatherSystem';
import { CanvasGestureManager } from '@/input/CanvasGestureManager';
import { Canvas2DRenderer } from '@/rendering/Canvas2DRenderer';
import { GRID_SIZE } from '@/rendering/GridMath';
import { SpriteLoader } from '@/rendering/SpriteLoader';
import {
  getGameSpeed,
  getGameState,
  isPaused,
  notifyStateChange,
  selectTool,
  setInspected,
  togglePause,
} from '@/stores/gameStore';

interface Props {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  callbacks: SimCallbacks;
  gameStarted: boolean;
}

/** Maps Season enum values to renderer season keys. */
function mapSeasonToRenderSeason(season: string): string {
  switch (season) {
    case Season.WINTER:
      return 'winter';
    case Season.RASPUTITSA_SPRING:
    case Season.RASPUTITSA_AUTUMN:
      return 'mud';
    case Season.SHORT_SUMMER:
    case Season.GOLDEN_WEEK:
    case Season.STIFLING_HEAT:
      return 'summer';
    case Season.EARLY_FROST:
      return 'winter';
    default:
      return 'default';
  }
}

/** Maps WeatherType to particle system weather type. */
function mapWeatherToParticleType(weather: string): 'snow' | 'rain' | 'none' {
  switch (weather) {
    case WeatherType.SNOW:
    case WeatherType.BLIZZARD:
      return 'snow';
    case WeatherType.RAIN:
    case WeatherType.MUD_STORM:
      return 'rain';
    default:
      return 'none';
  }
}

/** Maps season to a music context key for dynamic soundtrack. */
function seasonToMusicContext(season: string): keyof typeof MUSIC_CONTEXTS | null {
  switch (season) {
    case Season.WINTER:
    case Season.EARLY_FROST:
      return 'winter';
    case Season.RASPUTITSA_SPRING:
      return 'spring';
    default:
      return null;
  }
}

/**
 * Initializes and manages the imperative game world using the provided canvas:
 * sets up rendering, input gestures, audio, persistence, terrain, RNG, and the simulation loop.
 *
 * This component performs side effects (starts/stops renderer and simulation, wires audio and
 * gesture callbacks, preloads assets, and manages lifecycle cleanup) and does not render any UI.
 *
 * @returns null — the component renders nothing; it only initializes and tears down game systems.
 */
export function GameWorld({ canvasRef, callbacks, gameStarted }: Props) {
  const rendererRef = useRef<Canvas2DRenderer | null>(null);
  const gestureRef = useRef<CanvasGestureManager | null>(null);
  const simRef = useRef<SimulationEngine | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<AudioManager | null>(null);
  const playlistIndexRef = useRef(0);
  const initializedRef = useRef(false);
  // Store callbacks in a ref so the simulation effect doesn't re-run
  // (and clean up the interval) when App re-renders with a new callbacks object.
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  // Initialize renderer + gestures once canvas is available
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gameState = getGameState();
    const spriteLoader = new SpriteLoader();

    const renderer = new Canvas2DRenderer(canvas, gameState, spriteLoader);
    const gestures = new CanvasGestureManager(canvas, gameState, renderer);

    rendererRef.current = renderer;
    gestureRef.current = gestures;

    // Start render loop immediately (grid draws without sprites),
    // then restart after sprites are loaded so they appear.
    renderer.start();
    spriteLoader.init().then(() => {
      renderer.start(); // idempotent — cancels previous loop, re-renders with sprites
    });

    // Handle resize
    const onResize = () => renderer.resize();
    window.addEventListener('resize', onResize);

    return () => {
      renderer.stop();
      gestures.dispose();
      window.removeEventListener('resize', onResize);
    };
  }, [canvasRef]);

  // Start simulation when game starts
  useEffect(() => {
    if (!gameStarted || initializedRef.current) return;
    if (!rendererRef.current) return;

    initializedRef.current = true;
    const renderer = rendererRef.current;
    const gestures = gestureRef.current;

    // Initialize SQLite database for persistence (fire-and-forget — SaveSystem
    // falls back to localStorage if the DB isn't ready yet)
    initDatabase().catch(() => {
      // sql.js Wasm load failure is non-fatal; localStorage fallback handles it
    });

    // Initialize AudioManager (user gesture from "Start" click satisfies autoplay policy)
    const audio = new AudioManager();
    audioRef.current = audio;
    audio.preloadAssets();

    // Wire gesture SFX callbacks
    if (gestures) {
      gestures.onBuild = () => audio.playSFX('build');
      gestures.onBulldoze = () => audio.playSFX('destroy');
    }

    // Start background music — play through shuffled GAMEPLAY_PLAYLIST
    const shuffled = [...GAMEPLAY_PLAYLIST].sort(() => Math.random() - 0.5);
    playlistIndexRef.current = 0;

    const playNextTrack = () => {
      const trackId = shuffled[playlistIndexRef.current % shuffled.length]!;
      audio.playMusic(trackId).then(() => {
        // When track ends, advance to next (for non-looping tracks)
        // Most gameplay tracks loop, so this is a fallback
      });
      playlistIndexRef.current++;
    };

    // Slight delay to let preload settle
    const musicTimeout = setTimeout(playNextTrack, 2000);

    // Initialize ECS world
    const gameState = getGameState();

    // Create resource store singleton entity with starting resources
    createResourceStore({
      money: gameState.money,
      food: gameState.food,
      vodka: gameState.vodka,
      power: gameState.power,
      powerUsed: gameState.powerUsed,
      population: gameState.pop,
    });

    // Start simulation engine with seeded RNG
    const seed = gameState.seed || generateSeedPhrase();
    gameState.seed = seed;
    const rng = new GameRng(seed);

    // Generate and render terrain features on map border
    const terrainFeatures = generateTerrain(GRID_SIZE, rng);
    renderer.featureTiles.setFeatures(terrainFeatures);
    const terrainSpriteNames = getTerrainSpriteNames(terrainFeatures);
    renderer.featureTiles.preload(terrainSpriteNames).then(() => {
      renderer.start(); // Re-render now that terrain tiles are loaded
    });

    simRef.current = new SimulationEngine(
      gameState,
      {
        ...callbacksRef.current,
        onToast: (msg) => {
          callbacksRef.current.onToast(msg);
          audio.playSFX('notification');
        },
        onStateChange: () => {
          callbacksRef.current.onStateChange();
          notifyStateChange();
        },
        onSeasonChanged: (season) => {
          const renderSeason = mapSeasonToRenderSeason(season);
          renderer.setSeason(renderSeason);
          // Reload terrain tiles for the new season
          renderer.featureTiles.preload(terrainSpriteNames);
          // Switch music context for dramatic season transitions
          const musicCtx = seasonToMusicContext(season);
          if (musicCtx) {
            const trackId = MUSIC_CONTEXTS[musicCtx];
            if (trackId) {
              audio.playMusic(trackId);
            }
          }
        },
        onWeatherChanged: (weather) => {
          renderer.particles.setWeather(mapWeatherToParticleType(weather));
        },
        onDayPhaseChanged: (_phase, dayProgress) => {
          renderer.setDayProgress(dayProgress);
        },
      },
      rng
    );

    tickRef.current = setInterval(() => {
      if (!isPaused()) {
        const speed = getGameSpeed();
        for (let i = 0; i < speed; i++) {
          simRef.current?.tick();
        }
      }
    }, 1000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      clearTimeout(musicTimeout);
      audio.dispose();
      // Clean up ECS world entities
      world.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callbacks stored in callbacksRef
  }, [gameStarted]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePause();
          break;
        case 'Escape':
          selectTool('none');
          setInspected(null);
          break;
        case 'KeyB':
          selectTool('bulldoze');
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return null;
}