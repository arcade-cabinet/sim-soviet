/**
 * GameWorld — imperative game initialization for Canvas 2D rendering.
 *
 * Creates the Canvas2DRenderer, SpriteLoader, gesture manager, and simulation engine.
 * Initializes the ECS world (resource store, meta store, grid) before simulation starts.
 * Attaches to a plain HTMLCanvasElement.
 */
import { useEffect, useRef } from 'react';
import { AudioManager } from '@/audio/AudioManager';
import { GAMEPLAY_PLAYLIST, MUSIC_CONTEXTS } from '@/audio/AudioManifest';
import type { NewGameConfig } from '@/components/screens/NewGameFlow';
import { initDatabase } from '@/db/provider';
import { createMetaStore, createResourceStore } from '@/ecs/factories';
import { world } from '@/ecs/world';
import { Season } from '@/game/Chronology';
import { GameGrid } from '@/game/GameGrid';
import { MapSystem } from '@/game/map';
import { SaveSystem } from '@/game/SaveSystem';
import { GameRng, generateSeedPhrase } from '@/game/SeedSystem';
import type { SimCallbacks } from '@/game/SimulationEngine';
import { SimulationEngine } from '@/game/SimulationEngine';
import { generateTerrain, getTerrainSpriteNames } from '@/game/TerrainGenerator';
import { WeatherType } from '@/game/WeatherSystem';
import { CanvasGestureManager } from '@/input/CanvasGestureManager';
import { Canvas2DRenderer } from '@/rendering/Canvas2DRenderer';
import { GRID_SIZE, gridToScreen } from '@/rendering/GridMath';
import { SpriteLoader } from '@/rendering/SpriteLoader';
import {
  closeRadialMenu,
  getGameSpeed,
  isPaused,
  notifyStateChange,
  selectTool,
  setInspected,
  togglePause,
} from '@/stores/gameStore';

/** API exposed from GameWorld to parent for save/load operations. */
export interface SaveSystemAPI {
  save: (name?: string) => Promise<boolean>;
  load: (name?: string) => Promise<boolean>;
  hasSave: (name?: string) => Promise<boolean>;
}

interface Props {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  callbacks: SimCallbacks;
  gameStarted: boolean;
  gameConfig?: NewGameConfig | null;
  /** Name of save to load on game start (e.g. 'autosave' for Continue). */
  loadSaveOnStart?: string | null;
  /** Called when the SaveSystem is ready for manual save/load operations. */
  onSaveSystemReady?: (api: SaveSystemAPI) => void;
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

export function GameWorld({
  canvasRef,
  callbacks,
  gameStarted,
  gameConfig,
  loadSaveOnStart,
  onSaveSystemReady,
}: Props) {
  const rendererRef = useRef<Canvas2DRenderer | null>(null);
  const gestureRef = useRef<CanvasGestureManager | null>(null);
  const simRef = useRef<SimulationEngine | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<AudioManager | null>(null);
  const saveRef = useRef<SaveSystem | null>(null);
  const playlistIndexRef = useRef(0);
  const initializedRef = useRef(false);
  const gridRef = useRef<GameGrid | null>(null);
  // Store callbacks in a ref so the simulation effect doesn't re-run
  // (and clean up the interval) when App re-renders with a new callbacks object.
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;
  const onSaveSystemReadyRef = useRef(onSaveSystemReady);
  onSaveSystemReadyRef.current = onSaveSystemReady;
  const loadSaveOnStartRef = useRef(loadSaveOnStart);
  loadSaveOnStartRef.current = loadSaveOnStart;

  // Initialize renderer + gestures once canvas is available
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const grid = new GameGrid();
    gridRef.current = grid;
    const spriteLoader = new SpriteLoader();

    const renderer = new Canvas2DRenderer(canvas, grid, spriteLoader);
    const gestures = new CanvasGestureManager(canvas, grid, renderer);

    rendererRef.current = renderer;
    gestureRef.current = gestures;

    // Set camera bounds to isometric grid extents with padding
    const topLeft = gridToScreen(0, 0);
    const topRight = gridToScreen(GRID_SIZE, 0);
    const bottomLeft = gridToScreen(0, GRID_SIZE);
    const bottomRight = gridToScreen(GRID_SIZE, GRID_SIZE);

    const padding = 200;
    renderer.camera.setBounds(
      bottomLeft.x - padding, // minX (leftmost point of diamond)
      topLeft.y - padding, // minY (topmost point)
      topRight.x + padding, // maxX (rightmost point)
      bottomRight.y + padding // maxY (bottommost point)
    );

    // Start render loop immediately (grid draws without sprites),
    // then restart after sprites are loaded so they appear.
    renderer.start();
    spriteLoader.init().then(() => {
      renderer.start(); // idempotent — cancels previous loop, re-renders with sprites
    });

    // Handle resize — use ResizeObserver for reliable fold/unfold + orientation detection.
    // window.resize alone misses foldable phone transitions and some orientation changes.
    const onResize = () => renderer.resize();

    const parent = canvas.parentElement;
    let resizeObserver: ResizeObserver | undefined;
    if (parent) {
      resizeObserver = new ResizeObserver(onResize);
      resizeObserver.observe(parent);
    }
    // Fallback for older mobile browsers that fire orientationchange but not resize
    window.addEventListener('orientationchange', onResize);

    // DPR can change when a foldable phone unfolds (e.g., 2.625 → 3).
    // matchMedia fires when the device pixel ratio changes.
    const dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    const onDprChange = () => renderer.resize();
    dprQuery.addEventListener('change', onDprChange);

    return () => {
      renderer.stop();
      gestures.dispose();
      resizeObserver?.disconnect();
      window.removeEventListener('orientationchange', onResize);
      dprQuery.removeEventListener('change', onDprChange);
    };
  }, [canvasRef]);

  // Start simulation when game starts
  useEffect(() => {
    if (!gameStarted || initializedRef.current) return;
    if (!rendererRef.current || !gridRef.current) return;

    initializedRef.current = true;
    const renderer = rendererRef.current;
    const gestures = gestureRef.current;
    const grid = gridRef.current;

    // Initialize SQLite database for persistence. SaveSystem falls back to
    // localStorage if the DB isn't ready, but we await it so Continue/Load
    // can restore from SQLite before the first tick fires.
    const dbReady = initDatabase().catch(() => {
      // sql.js Wasm load failure is non-fatal; localStorage fallback handles it
    });

    // Create SaveSystem early so it's available for load-on-start
    const saveSystem = new SaveSystem(grid);
    saveRef.current = saveSystem;

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

    // Initialize ECS world — resource store + meta store
    createResourceStore();
    const seed = gameConfig?.seed ?? generateSeedPhrase();
    createMetaStore({ seed });

    // Start simulation engine with seeded RNG
    const rng = new GameRng(seed);

    // Generate procedural terrain map (rivers, forests, mountains, marshland)
    const mapSystem = new MapSystem({
      seed,
      size: gameConfig?.mapSize ?? 'medium',
      riverCount: 1,
      forestDensity: 0.15,
      marshDensity: 0.05,
      mountainDensity: 0.05,
    });
    mapSystem.generate();
    renderer.setMapSystem(mapSystem);

    // Preload ground tile sprites for the offscreen cache
    renderer.preloadGroundTiles().then(() => {
      renderer.start(); // Re-render with ground tiles
    });

    // Generate terrain features (low-profile on border ring, prominent in interior fringe)
    const terrainFeatures = generateTerrain(GRID_SIZE, rng);
    renderer.featureTiles.setFeatures(terrainFeatures);
    const terrainSpriteNames = getTerrainSpriteNames(terrainFeatures);

    // Also preload terrain overlay sprites based on map interior features
    const mapSpriteNames = renderer.groundTiles.getTerrainSpriteNames();
    const allTerrainSprites = [...new Set([...terrainSpriteNames, ...mapSpriteNames])];
    renderer.featureTiles.preload(allTerrainSprites).then(() => {
      renderer.start(); // Re-render now that terrain tiles are loaded
    });

    simRef.current = new SimulationEngine(
      grid,
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
          // Reload ground tile sprites (different season = different sprites)
          renderer.preloadGroundTiles();
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

    // Wire building tap → minigame trigger routing
    if (gestures) {
      gestures.onBuildingTap = (defId) => simRef.current?.checkBuildingTapMinigame(defId);
    }

    // Wire SaveSystem to engine for subsystem serialization
    saveSystem.setEngine(simRef.current);

    // Expose save/load API to parent component
    onSaveSystemReadyRef.current?.({
      save: (name) => saveSystem.save(name),
      load: (name) => saveSystem.load(name),
      hasSave: (name) => saveSystem.hasSave(name),
    });

    // Load save on start if requested (Continue / Load Game from landing page).
    // Wait for DB to be ready first, then load and notify React.
    const loadOnStartName = loadSaveOnStartRef.current;
    if (loadOnStartName) {
      dbReady.then(() => {
        saveSystem.load(loadOnStartName).then((loaded) => {
          if (loaded) {
            notifyStateChange();
          }
        });
      });
    }

    // Start autosave (saves every 60s)
    const stopAutoSave = saveSystem.startAutoSave();

    tickRef.current = setInterval(() => {
      if (!isPaused()) {
        const speed = getGameSpeed();
        for (let i = 0; i < speed; i++) {
          simRef.current?.tick();
        }
        // Sync political entity positions to renderer for overlay indicators
        const polEntities = simRef.current?.getPoliticalEntities().getVisibleEntities();
        renderer.setPoliticalEntities(polEntities ?? []);
      }
    }, 1000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      stopAutoSave();
      clearTimeout(musicTimeout);
      audio.dispose();
      // Clean up ECS world entities
      world.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callbacks stored in callbacksRef
  }, [gameStarted, gameConfig?.mapSize, gameConfig?.seed]);

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
          closeRadialMenu();
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
