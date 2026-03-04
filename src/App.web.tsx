/**
 * App.web.tsx — Web-specific root component for SimSoviet 1917.
 *
 * Screen flow: MainMenu → Loading (Engine mounts) → IntroModal → Game
 *
 * Uses R3F Canvas (creates an HTML canvas with WebGL)
 * instead of the native NativeEngine.
 */

import { Canvas } from '@react-three/fiber';
import React, { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AudioManager from './audio/AudioManager';
import { ERA_CONTEXTS, SEASON_CONTEXTS } from './audio/AudioManifest';
import SFXManager from './audio/SFXManager';
import { bulldozeECSBuilding } from './bridge/BuildingPlacement';
import { type GameInitOptions, getEngine, getSaveSystem, initGame, isGameInitialized } from './bridge/GameInit';
import { resetAllSingletons } from './bridge/Reset';

// Lazy-load Content — it transitively imports Three.js + all 22 scene
// components (~5 MB). This keeps the menu/setup bundle small and fast.
const Content = React.lazy(() => import('./Content'));

// Lazy-load XR components — only needed when user activates AR/VR
const XRSession = React.lazy(() => import('./xr/XRSession'));
const ARTabletop = React.lazy(() => import('./xr/ARTabletop'));
const VRWalkthrough = React.lazy(() => import('./xr/VRWalkthrough'));

import type { SettlementEvent } from './ai/agents/infrastructure/SettlementSystem';
import type { ActiveMinigame, MinigameOutcome } from './ai/agents/meta/minigames/MinigameTypes';
import type { AnnualReportData, ReportSubmission } from './components/ui/AnnualReportModal';
import { initDatabase } from './db/provider';
import { buildings as ecsBuildingsArchetype, terrainFeatures as ecsTerrainFeatures } from './ecs/archetypes';
import { gameState } from './engine/GameState';
import { clearToast, getToast, setSpeed, showAdvisor, showToast } from './engine/helpers';
import type { RehabilitationData } from './game/engine/types';
import type { EraDefinition } from './game/era';
import type { TallyData } from './game/GameTally';
import { useECSGameLoop } from './hooks/useECSGameLoop';
import { useGameSnapshot } from './hooks/useGameState';
import { useInputManager } from './input/useInputManager';
import { TOTAL_MODEL_COUNT } from './scene/ModelPreloader';
import {
  closeBuildingInspector,
  closeCitizenDossierByIndex,
  closePoliticalPanel,
  type GameSpeed,
  isPaused,
  notifyStateChange,
  setGameSpeed,
  setPaused,
  useBuildingInspector,
  useBuildingPanel,
  useCitizenDossierIndex,
  useCursorTooltip,
  useGovernmentHQ,
  closeGovernmentHQ,
  usePoliticalPanel,
} from './stores/gameStore';
import { AchievementsPanel } from './ui/AchievementsPanel';
// Advisor removed — Phase 1 minimal HUD
import { BuildingInspectorPanel } from './ui/BuildingInspectorPanel';
import { BuildingPanel } from './ui/BuildingPanel';
import { CitizenDossierModal } from './ui/CitizenDossierModal';
import { CompulsoryDeliveriesPanel } from './ui/CompulsoryDeliveriesPanel';
import { ConsumerGoodsMarketPanel } from './ui/ConsumerGoodsMarketPanel';
import { CRTOverlay } from './ui/CRTOverlay';
import { CursorTooltip } from './ui/CursorTooltip';
// DirectiveHUD removed — Phase 1 minimal HUD
import { DiseasePanel } from './ui/DiseasePanel';
import { EconomyDetailPanel } from './ui/EconomyDetailPanel';
import { EconomyPanel } from './ui/EconomyPanel';
import { EdgeIndicators } from './ui/EdgeIndicators';
import { EraTechTreePanel } from './ui/EraTechTreePanel';
import { EventHistoryPanel } from './ui/EventHistoryPanel';
import { GameModals, type GameOverInfo, type PlanDirective } from './ui/GameModals';
import { GovernmentHQ } from './ui/GovernmentHQ';
import { InfrastructurePanel } from './ui/InfrastructurePanel';
import { IntroModal } from './ui/IntroModal';
import { LeadershipPanel } from './ui/LeadershipPanel';
// LensSelector removed — Phase 1 minimal HUD
import { LoadingScreen } from './ui/LoadingScreen';
import { MainMenu } from './ui/MainMenu';
import { MandateProgressPanel } from './ui/MandateProgressPanel';
import { MinigameOverlay } from './ui/MinigameOverlay';
import { MinigameReferencePanel } from './ui/MinigameReferencePanel';
import { Minimap } from './ui/Minimap';
import { type NewGameConfig, NewGameSetup } from './ui/NewGameSetup';
import { NotificationHistory } from './ui/NotificationHistory';
import { getUnreadCount, subscribeNotifications } from './ui/NotificationStore';
import { PersonnelFilePanel } from './ui/PersonnelFilePanel';
import { PolitburoPanel } from './ui/PolitburoPanel';
import { PoliticalEntityPanel } from './ui/PoliticalEntityPanel';
import { PravdaArchivePanel } from './ui/PravdaArchivePanel';
// QuotaHUD removed — Phase 1 minimal HUD
import { RadialMenu } from './ui/RadialMenu';
import { RehabilitationModal } from './ui/RehabilitationModal';
import { SaveLoadPanel } from './ui/SaveLoadPanel';
import { ScoringPanel } from './ui/ScoringPanel';
import { SettingsModal } from './ui/SettingsModal';
import { SettlementProgressPanel } from './ui/SettlementProgressPanel';
import { Colors } from './ui/styles';
// Ticker removed — Phase 1 minimal HUD
import { Toast } from './ui/Toast';
// Toolbar removed — Phase 1 minimal HUD
// UI components
import { TopBar } from './ui/TopBar';
import { ViewportFrame } from './ui/ViewportFrame';
import { WeatherForecastPanel } from './ui/WeatherForecastPanel';
import { WorkerAnalyticsPanel } from './ui/WorkerAnalyticsPanel';
import { WorkerRosterPanel } from './ui/WorkerRosterPanel';

// WorkerStatusBar removed — Phase 1 minimal HUD

/**
 * Error boundary to catch Engine/WebGL crashes and show a fallback
 * instead of a blank white screen.
 */
class EngineErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message || 'Unknown 3D engine error' };
  }
  render() {
    if (this.state.error) {
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: Colors.bgColor,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 40,
          }}
        >
          <Text
            style={{
              color: Colors.sovietRed,
              fontFamily: 'monospace',
              fontSize: 14,
              fontWeight: 'bold',
              marginBottom: 12,
            }}
          >
            ENGINE MALFUNCTION
          </Text>
          <Text style={{ color: '#ccc', fontFamily: 'monospace', fontSize: 11, textAlign: 'center' }}>
            {this.state.error}
          </Text>
          <Text style={{ color: '#888', fontFamily: 'monospace', fontSize: 10, marginTop: 16, textAlign: 'center' }}>
            Reload the page to try again. If this persists, your browser may not support WebGL.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

/** Minimum time (ms) the loading screen stays visible so it doesn't just flash */
const MIN_LOADING_DISPLAY_MS = 1500;

type AppScreen = 'menu' | 'setup' | 'game';

const App: React.FC = () => {
  // Screen state
  const [screen, setScreen] = useState<AppScreen>('menu');
  const gameConfigRef = useRef<GameInitOptions | undefined>(undefined);
  const [assetsReady, setAssetsReady] = useState(false);
  const [loadingFaded, setLoadingFaded] = useState(false);
  const [showIntro, setShowIntro] = useState(false);

  // Loading progress
  const [loadProgress, setLoadProgress] = useState({
    loaded: 0,
    total: TOTAL_MODEL_COUNT,
    name: '',
  });

  // Ticker is not rendered in Phase 1 — state removed to avoid accumulation

  // ── Panel state ──
  const [showPersonnelFile, setShowPersonnelFile] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLeadership, setShowLeadership] = useState(false);
  const [showEconomy, setShowEconomy] = useState(false);
  const [showWorkers, setShowWorkers] = useState(false);
  const [showMandates, setShowMandates] = useState(false);
  const [showDisease, setShowDisease] = useState(false);
  const [showInfra, setShowInfra] = useState(false);
  const [showEvents, setShowEvents] = useState(false);
  const [showPolitical, setShowPolitical] = useState(false);
  const [showScoring, setShowScoring] = useState(false);
  const [showWeather, setShowWeather] = useState(false);
  const [showEra, setShowEra] = useState(false);
  const [showSettlement, setShowSettlement] = useState(false);
  const [showPolitburo, setShowPolitburo] = useState(false);
  const [showDeliveries, setShowDeliveries] = useState(false);
  const [showMinigames, setShowMinigames] = useState(false);
  const [showPravda, setShowPravda] = useState(false);
  const [showWorkerAnalytics, setShowWorkerAnalytics] = useState(false);
  const [showEconomyDetail, setShowEconomyDetail] = useState(false);
  const [showSaveLoad, setShowSaveLoad] = useState(false);
  const [showMarket, setShowMarket] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // ── XR mode state ──
  const [xrMode, setXrMode] = useState<'ar' | 'vr' | null>(null);

  // ── Modal state ──
  const [eraTransition, setEraTransition] = useState<EraDefinition | null>(null);
  const [activeMinigame, setActiveMinigame] = useState<ActiveMinigame | null>(null);
  const resolveMinigameRef = useRef<((choiceId: string) => void) | null>(null);
  const [annualReport, setAnnualReport] = useState<AnnualReportData | null>(null);
  const submitReportRef = useRef<((submission: ReportSubmission) => void) | null>(null);
  const [settlementEvent, setSettlementEvent] = useState<SettlementEvent | null>(null);
  const [planDirective, setPlanDirective] = useState<PlanDirective | null>(null);
  const [gameOver, setGameOver] = useState<GameOverInfo | null>(null);
  const [gameTally, setGameTally] = useState<TallyData | null>(null);
  const [rehabilitation, setRehabilitation] = useState<RehabilitationData | null>(null);

  // Auto-pause when interactive modals are open (restore prior state on close)
  const hasInteractiveModal = !!annualReport || !!activeMinigame || !!planDirective || !!gameOver || !!rehabilitation;
  const wasPausedBeforeModal = useRef(false);
  useEffect(() => {
    if (hasInteractiveModal) {
      wasPausedBeforeModal.current = isPaused();
      setPaused(true);
    } else {
      // Restore prior pause state when modal closes
      if (!wasPausedBeforeModal.current) setPaused(false);
    }
  }, [hasInteractiveModal]);

  // Initialize SFXManager on first user interaction (autoplay policy)
  useEffect(() => {
    const initSFX = () => {
      SFXManager.getInstance().init();
      window.removeEventListener('click', initSFX);
      window.removeEventListener('keydown', initSFX);
      window.removeEventListener('touchstart', initSFX);
    };
    window.addEventListener('click', initSFX);
    window.addEventListener('keydown', initSFX);
    window.addEventListener('touchstart', initSFX);
    return () => {
      window.removeEventListener('click', initSFX);
      window.removeEventListener('keydown', initSFX);
      window.removeEventListener('touchstart', initSFX);
    };
  }, []);

  // Universal input system (keyboard + gamepad)
  useInputManager(screen === 'game' && loadingFaded);

  // Start ECS game loop (replaces old flat-state game loop)
  useECSGameLoop();

  // Subscribe to game state (old hook — still used by 3D scene components)
  const snap = useGameSnapshot();

  // ── Building Inspector + Citizen Dossier + Cursor Tooltip + Political Panel (store-driven) ──
  const buildingInspector = useBuildingInspector();
  const citizenDossierIdx = useCitizenDossierIndex();
  const cursorTooltip = useCursorTooltip();
  const politicalPanelFromScene = usePoliticalPanel();
  const _buildingPanelCell = useBuildingPanel();
  const showGovHQ = useGovernmentHQ();

  // ── Notification history (store-driven unread count) ──
  const unreadNotifications = useSyncExternalStore(subscribeNotifications, getUnreadCount, getUnreadCount);

  const handleDismissBuildingInspector = useCallback(() => {
    closeBuildingInspector();
  }, []);

  const handleDemolishInspected = useCallback(() => {
    if (buildingInspector) {
      bulldozeECSBuilding(buildingInspector.gridX, buildingInspector.gridY);
      closeBuildingInspector();
      notifyStateChange();
    }
  }, [buildingInspector]);

  const handleDismissCitizenDossier = useCallback(() => {
    closeCitizenDossierByIndex();
  }, []);

  // Initialize ECS world and SimulationEngine when entering game
  useEffect(() => {
    if (screen !== 'game' || isGameInitialized()) return;

    // Async init: database first, then game engine
    (async () => {
      // Initialize SQLite database (expo-sqlite handles persistence automatically)
      try {
        await initDatabase();
      } catch (err) {
        console.error('[DB] Failed to open SQLite database:', err);
      }

      initGame(
        {
          onToast: (msg) => {
            showToast(gameState, msg);
            SFXManager.getInstance().play('toast_notification');
          },
          onAdvisor: (msg) => {
            showAdvisor(gameState, msg);
            SFXManager.getInstance().play('advisor_message');
          },
          onPravda: (_msg) => {
            // Ticker is not rendered in Phase 1 — do not accumulate text in state
          },
          onStateChange: () => {
            // Sync ECS building powered state to old GameState for 3D effects
            for (const e of ecsBuildingsArchetype.entities) {
              const b = gameState.buildings.find((bi) => bi.x === e.position.gridX && bi.y === e.position.gridY);
              if (b) b.powered = e.building.powered;
            }

            // Sync fire + zeppelin state from ECS → GameState for 3D renderers
            const eng = getEngine();
            if (eng) {
              const fireSys = eng.getFireSystem();
              fireSys.syncToGameState(gameState.grid);
              gameState.zeppelins = fireSys.getZeppelinRenderState();
            }

            notifyStateChange();
            gameState.notify();
          },
          onWeatherChanged: (weather) => {
            gameState.currentWeather = weather as typeof gameState.currentWeather;
          },
          onDayPhaseChanged: (_phase, dayProgress) => {
            gameState.timeOfDay = dayProgress;
          },
          onGameOver: (victory, reason) => {
            setGameOver({ victory, reason });
            SFXManager.getInstance().play('game_over');
          },
          onRehabilitation: (data) => {
            setRehabilitation(data);
          },
          onAchievement: (name, description) => {
            showToast(gameState, `★ ${name}: ${description}`);
            SFXManager.getInstance().play('achievement');
          },
          onSeasonChanged: (season) => {
            const ctx = SEASON_CONTEXTS[season];
            if (ctx) {
              AudioManager.getInstance().playContext(ctx);
            }
            SFXManager.getInstance().play('season_change');
          },
          onBuildingCollapsed: (gridX, gridY, type) => {
            showToast(gameState, `BUILDING COLLAPSED: ${type} at (${gridX},${gridY})`);
            SFXManager.getInstance().play('building_demolish');
          },
          onSettlementChange: (event) => {
            setSettlementEvent(event);
          },
          onNewPlan: (plan) => {
            setPlanDirective({
              quotaType: plan.quotaType,
              quotaTarget: plan.quotaTarget,
              startYear: plan.startYear,
              endYear: plan.endYear,
              mandates: plan.mandates,
            });
          },
          onEraChanged: (era) => {
            setEraTransition(era);
            SFXManager.getInstance().play('era_transition');
            const ctx = ERA_CONTEXTS[era.id];
            if (ctx) {
              AudioManager.getInstance().playContext(ctx, 5000);
            }
            // Notify store so RadialMenu re-renders with newly unlocked buildings
            notifyStateChange();
          },
          onAnnualReport: (data, submitReport) => {
            setAnnualReport(data);
            submitReportRef.current = submitReport;
          },
          onMinigame: (active, resolveChoice) => {
            setActiveMinigame(active);
            resolveMinigameRef.current = resolveChoice;
          },
          onTutorialMilestone: (milestone) => {
            showAdvisor(gameState, `COMRADE KRUPNIK: ${milestone.dialogue}`);
            // Notify store so RadialMenu re-renders with newly unlocked categories
            notifyStateChange();
          },
          onGameTally: (tally) => {
            setGameTally(tally);
          },
        },
        gameConfigRef.current,
      );

      // Also initialize the old flat grid for 3D terrain rendering
      if (gameState.grid.length === 0) {
        gameState.initGrid();

        // Sync ECS terrain → old grid so canPlace() terrain checks match 3D scene
        const featureToTerrain: Record<string, string> = {
          mountain: 'mountain',
          forest: 'tree',
          marsh: 'marsh',
          river: 'water',
          water: 'water',
        };
        for (const entity of ecsTerrainFeatures.entities) {
          const { gridX, gridY } = entity.position;
          const cell = gameState.grid[gridY]?.[gridX];
          if (cell) {
            const mapped = featureToTerrain[entity.terrainFeature.featureType];
            if (mapped) cell.terrain = mapped as typeof cell.terrain;
            cell.z = entity.terrainFeature.elevation;
          }
        }

        // Sync ECS buildings → old grid + buildings array for scene components
        for (const entity of ecsBuildingsArchetype.entities) {
          const { gridX, gridY } = entity.position;
          const cell = gameState.grid[gridY]?.[gridX];
          if (cell) cell.type = entity.building.defId;
          gameState.buildings.push({
            x: gridX,
            y: gridY,
            type: entity.building.defId,
            powered: entity.building.powered,
            level: 0,
          });
        }
      }
    })();

    // expo-sqlite handles persistence automatically — no beforeunload needed
  }, [screen]);

  // Ticker messages now come exclusively from PravdaSystem via
  // the onPravda callback (event-reactive + ambient headlines).
  // The old static setInterval fallback has been removed.

  // --- Loading callbacks ---
  const handleLoadProgress = useCallback((loaded: number, total: number, name: string) => {
    setLoadProgress({ loaded, total, name });
  }, []);

  // Track when loading started so we can enforce a minimum display time
  const loadStartRef = useRef(0);
  useEffect(() => {
    if (screen === 'game' && loadStartRef.current === 0) {
      loadStartRef.current = Date.now();
    }
  }, [screen]);

  const handleLoadComplete = useCallback(() => {
    const elapsed = Date.now() - loadStartRef.current;
    const remaining = Math.max(0, MIN_LOADING_DISPLAY_MS - elapsed);
    if (remaining > 0) {
      setTimeout(() => setAssetsReady(true), remaining);
    } else {
      setAssetsReady(true);
    }
  }, []);

  const handleLoadingFadeComplete = useCallback(() => {
    setLoadingFaded(true);
    setShowIntro(true);
  }, []);

  // --- Menu callbacks ---
  const handleNewGame = useCallback(() => {
    setScreen('setup');
  }, []);

  const handleSetupBack = useCallback(() => {
    setScreen('menu');
  }, []);

  const handleSetupStart = useCallback((config: NewGameConfig) => {
    gameConfigRef.current = config;
    setScreen('game');
  }, []);

  const handleSettings = useCallback(() => {
    setShowSettings(true);
  }, []);

  // --- Game callbacks ---
  const handleSetSpeed = useCallback((sp: number) => {
    if (sp === 0) {
      setPaused(true);
      setSpeed(gameState, 0);
    } else {
      setPaused(false);
      setGameSpeed(sp as GameSpeed);
      setSpeed(gameState, sp);
    }
  }, []);

  const handleDismissToast = useCallback(() => {
    clearToast();
  }, []);

  const handleDismissIntro = useCallback(() => {
    setShowIntro(false);
    AudioManager.getInstance().startPlaylist();
    SFXManager.getInstance().play('ui_modal_close');
  }, []);

  const handleThreatPress = useCallback(() => {
    setShowPersonnelFile(true);
  }, []);

  const handleShowAchievements = useCallback(() => {
    setShowAchievements(true);
  }, []);

  const handleShowLeadership = useCallback(() => {
    setShowLeadership(true);
  }, []);

  const handleShowEconomy = useCallback(() => {
    setShowEconomy(true);
  }, []);

  const handleShowWorkers = useCallback(() => {
    setShowWorkers(true);
  }, []);

  const handleShowMandates = useCallback(() => {
    setShowMandates(true);
  }, []);

  const handleShowDisease = useCallback(() => {
    setShowDisease(true);
  }, []);

  const handleShowInfra = useCallback(() => {
    setShowInfra(true);
  }, []);
  const handleShowEvents = useCallback(() => {
    setShowEvents(true);
  }, []);
  const handleShowPolitical = useCallback(() => {
    setShowPolitical(true);
  }, []);
  const handleShowScoring = useCallback(() => {
    setShowScoring(true);
  }, []);
  const handleShowWeather = useCallback(() => {
    setShowWeather(true);
  }, []);
  const handleShowEra = useCallback(() => {
    setShowEra(true);
  }, []);
  const handleShowSettlement = useCallback(() => {
    setShowSettlement(true);
  }, []);
  const handleShowPolitburo = useCallback(() => {
    setShowPolitburo(true);
  }, []);
  const handleShowDeliveries = useCallback(() => {
    setShowDeliveries(true);
  }, []);
  const handleShowMinigames = useCallback(() => {
    setShowMinigames(true);
  }, []);
  const handleShowPravda = useCallback(() => {
    setShowPravda(true);
  }, []);
  const handleShowWorkerAnalytics = useCallback(() => {
    setShowWorkerAnalytics(true);
  }, []);
  const handleShowEconomyDetail = useCallback(() => {
    setShowEconomyDetail(true);
  }, []);
  const handleShowMarket = useCallback(() => {
    setShowMarket(true);
  }, []);
  const handleShowNotifications = useCallback(() => {
    setShowNotifications(true);
  }, []);
  // ── Save/Load state ──
  const [saveNames, setSaveNames] = useState<string[]>([]);
  const [lastSaveTime, setLastSaveTime] = useState<number | undefined>(undefined);

  const refreshSaveState = useCallback(async () => {
    const sys = getSaveSystem();
    if (!sys) return;
    const names = await sys.listSaves();
    const time = await sys.getLastSaveTime();
    setSaveNames(names);
    setLastSaveTime(time);
  }, []);

  const handleShowSaveLoad = useCallback(() => {
    refreshSaveState();
    setShowSaveLoad(true);
  }, [refreshSaveState]);

  const handleSaveGame = useCallback(
    async (name: string): Promise<boolean> => {
      const sys = getSaveSystem();
      if (!sys) return false;
      const ok = await sys.save(name);
      await refreshSaveState();
      return ok;
    },
    [refreshSaveState],
  );

  const handleLoadGame = useCallback(async (name: string): Promise<boolean> => {
    const sys = getSaveSystem();
    if (!sys) return false;
    const ok = await sys.load(name);
    if (ok) {
      notifyStateChange();
      gameState.notify();
    }
    return ok;
  }, []);

  const handleDeleteSave = useCallback(
    async (name: string): Promise<void> => {
      const sys = getSaveSystem();
      if (!sys) return;
      await sys.deleteSave(name);
      await refreshSaveState();
    },
    [refreshSaveState],
  );

  const handleExportSave = useCallback((): string | null => {
    const sys = getSaveSystem();
    if (!sys) return null;
    return sys.exportSaveData();
  }, []);

  const handleImportSave = useCallback((json: string): boolean => {
    const sys = getSaveSystem();
    if (!sys) return false;
    const ok = sys.importSaveData(json);
    if (ok) {
      notifyStateChange();
      gameState.notify();
    }
    return ok;
  }, []);

  // --- Modal callbacks ---
  const handleDismissEra = useCallback(() => setEraTransition(null), []);
  const handleMinigameChoice = useCallback((choiceId: string) => {
    resolveMinigameRef.current?.(choiceId);
    resolveMinigameRef.current = null;
  }, []);
  const handleDismissMinigame = useCallback(() => {
    setActiveMinigame(null);
    resolveMinigameRef.current = null;
  }, []);
  const handleInteractiveMinigameComplete = useCallback((_outcome: MinigameOutcome) => {
    // Outcome is applied by MinigameOverlay via resolveInteractiveOutcome.
    // The engine's minigame router will be notified when we dismiss.
  }, []);
  const handleSubmitReport = useCallback((submission: ReportSubmission) => {
    submitReportRef.current?.(submission);
    submitReportRef.current = null;
    setAnnualReport(null);
  }, []);
  const handleDismissSettlement = useCallback(() => setSettlementEvent(null), []);
  const handleAcceptPlan = useCallback(() => setPlanDirective(null), []);
  const handleRestart = useCallback(() => {
    setGameOver(null);
    setGameTally(null);
    setXrMode(null);
    setRehabilitation(null);
    setActiveMinigame(null);
    resolveMinigameRef.current = null;
    submitReportRef.current = null;
    // Reset all module-level singletons so a fresh game can be initialized
    resetAllSingletons();
    // Reset local component state for a clean game screen
    setAssetsReady(false);
    setLoadingFaded(false);
    setShowIntro(false);
    setLoadProgress({ loaded: 0, total: TOTAL_MODEL_COUNT, name: '' });
    loadStartRef.current = 0;
    setScreen('menu');
  }, []);

  // Read toast from side-channel (advisor removed in Phase 1)
  const toast = getToast();

  // ─── MAIN MENU ───
  if (screen === 'menu') {
    return (
      <>
        <StatusBar barStyle="light-content" />
        <MainMenu onNewGame={handleNewGame} onSettings={handleSettings} />
        <SettingsModal visible={showSettings} onDismiss={() => setShowSettings(false)} />
      </>
    );
  }

  if (screen === 'setup') {
    return (
      <>
        <StatusBar barStyle="light-content" />
        <NewGameSetup onStart={handleSetupStart} onBack={handleSetupBack} />
      </>
    );
  }

  // ─── GAME (with loading overlay) ───
  const loadPct = loadProgress.total > 0 ? loadProgress.loaded / loadProgress.total : 0;

  return (
    <>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.root}>
        <View style={styles.sceneContainer}>
          <EngineErrorBoundary>
            <Canvas
              shadows="percentage"
              camera={{ position: [30, 40, 30], fov: 45 }}
              style={{ width: '100%', height: '100%' }}
              gl={{ antialias: true, alpha: false }}
            >
              {xrMode ? (
                <Suspense fallback={null}>
                  <XRSession onSessionEnd={() => setXrMode(null)}>
                    {xrMode === 'ar' ? (
                      <ARTabletop>
                        <Content
                          onLoadProgress={handleLoadProgress}
                          onLoadComplete={handleLoadComplete}
                          disableCamera
                        />
                      </ARTabletop>
                    ) : (
                      <VRWalkthrough>
                        <Content
                          onLoadProgress={handleLoadProgress}
                          onLoadComplete={handleLoadComplete}
                          disableCamera
                        />
                      </VRWalkthrough>
                    )}
                  </XRSession>
                </Suspense>
              ) : (
                <Content onLoadProgress={handleLoadProgress} onLoadComplete={handleLoadComplete} />
              )}
            </Canvas>
          </EngineErrorBoundary>
        </View>

        {/* Decorative overlays */}
        <CRTOverlay />
        <ViewportFrame />
        <EdgeIndicators />

        {loadingFaded && (
          <View style={styles.uiOverlay} pointerEvents="box-none">
            <TopBar
              food={snap.food}
              timber={snap.timber}
              population={snap.pop}
              dateLabel={snap.dateLabel}
              monthProgress={snap.monthProgress}
              speed={isPaused() ? 0 : snap.speed}
              onSetSpeed={handleSetSpeed}
              threatLevel={snap.threatLevel}
              blackMarks={snap.blackMarks}
              commendations={snap.commendations}
              settlementTier={snap.settlementTier}
              onThreatPress={handleThreatPress}
              onShowAchievements={handleShowAchievements}
              onShowLeadership={handleShowLeadership}
              onShowEconomy={handleShowEconomy}
              onShowWorkers={handleShowWorkers}
              onShowMandates={handleShowMandates}
              onShowDisease={handleShowDisease}
              onShowInfra={handleShowInfra}
              onShowEvents={handleShowEvents}
              onShowPolitical={handleShowPolitical}
              onShowScoring={handleShowScoring}
              onShowWeather={handleShowWeather}
              onShowEra={handleShowEra}
              onShowSettlement={handleShowSettlement}
              onShowPolitburo={handleShowPolitburo}
              onShowDeliveries={handleShowDeliveries}
              onShowMinigames={handleShowMinigames}
              onShowPravda={handleShowPravda}
              onShowWorkerAnalytics={handleShowWorkerAnalytics}
              onShowEconomyDetail={handleShowEconomyDetail}
              onShowSaveLoad={handleShowSaveLoad}
              onShowMarket={handleShowMarket}
              onShowNotifications={handleShowNotifications}
              unreadNotifications={unreadNotifications}
              autopilot={getEngine()?.getAgentManager().isAutopilot() ?? false}
            />

            <Toast message={toast?.text ?? null} onDismiss={handleDismissToast} />

            <Minimap />

            <BuildingPanel />

            <CursorTooltip
              visible={!!cursorTooltip}
              tileData={
                cursorTooltip
                  ? {
                      terrain: cursorTooltip.terrain,
                      type: cursorTooltip.type,
                      smog: cursorTooltip.smog,
                      watered: cursorTooltip.watered,
                      onFire: cursorTooltip.onFire,
                      zone: cursorTooltip.zone,
                      z: cursorTooltip.z,
                    }
                  : { terrain: 'grass', smog: 0, watered: false, onFire: false, z: 0 }
              }
              position={cursorTooltip ? { x: cursorTooltip.screenX, y: cursorTooltip.screenY } : { x: 0, y: 0 }}
            />
          </View>
        )}

        {!loadingFaded && (
          <LoadingScreen
            progress={loadPct}
            total={loadProgress.total}
            loaded={loadProgress.loaded}
            currentModel={loadProgress.name}
            complete={assetsReady}
            onFadeComplete={handleLoadingFadeComplete}
          />
        )}

        <GameModals
          eraTransition={eraTransition}
          onDismissEra={handleDismissEra}
          activeMinigame={activeMinigame}
          onMinigameChoice={handleMinigameChoice}
          onDismissMinigame={handleDismissMinigame}
          annualReport={annualReport}
          onSubmitReport={handleSubmitReport}
          settlementEvent={settlementEvent}
          onDismissSettlement={handleDismissSettlement}
          planDirective={planDirective}
          onAcceptPlan={handleAcceptPlan}
          gameOver={gameOver}
          gameTally={gameTally}
          onRestart={handleRestart}
        />

        <MinigameOverlay
          activeMinigame={activeMinigame}
          onInteractiveComplete={handleInteractiveMinigameComplete}
          onDismiss={handleDismissMinigame}
        />

        <RehabilitationModal
          visible={!!rehabilitation}
          data={rehabilitation}
          onResume={() => setRehabilitation(null)}
        />

        <PersonnelFilePanel visible={showPersonnelFile} onDismiss={() => setShowPersonnelFile(false)} />

        <AchievementsPanel visible={showAchievements} onDismiss={() => setShowAchievements(false)} />

        <LeadershipPanel visible={showLeadership} onDismiss={() => setShowLeadership(false)} />

        <EconomyPanel visible={showEconomy} onDismiss={() => setShowEconomy(false)} />

        <WorkerRosterPanel visible={showWorkers} onDismiss={() => setShowWorkers(false)} />

        <MandateProgressPanel visible={showMandates} onDismiss={() => setShowMandates(false)} />

        <DiseasePanel visible={showDisease} onDismiss={() => setShowDisease(false)} />

        <InfrastructurePanel visible={showInfra} onDismiss={() => setShowInfra(false)} />

        <EventHistoryPanel visible={showEvents} onDismiss={() => setShowEvents(false)} />

        <PoliticalEntityPanel
          visible={showPolitical || politicalPanelFromScene}
          onDismiss={() => {
            setShowPolitical(false);
            closePoliticalPanel();
          }}
        />

        <ScoringPanel visible={showScoring} onDismiss={() => setShowScoring(false)} />

        <WeatherForecastPanel visible={showWeather} onDismiss={() => setShowWeather(false)} />

        <EraTechTreePanel visible={showEra} onDismiss={() => setShowEra(false)} />

        <SettlementProgressPanel visible={showSettlement} onDismiss={() => setShowSettlement(false)} />

        <PolitburoPanel visible={showPolitburo} onDismiss={() => setShowPolitburo(false)} />

        <CompulsoryDeliveriesPanel visible={showDeliveries} onDismiss={() => setShowDeliveries(false)} />

        <MinigameReferencePanel visible={showMinigames} onDismiss={() => setShowMinigames(false)} />

        <PravdaArchivePanel visible={showPravda} onDismiss={() => setShowPravda(false)} />

        <WorkerAnalyticsPanel visible={showWorkerAnalytics} onDismiss={() => setShowWorkerAnalytics(false)} />

        <EconomyDetailPanel visible={showEconomyDetail} onDismiss={() => setShowEconomyDetail(false)} />

        <SaveLoadPanel
          visible={showSaveLoad}
          onDismiss={() => setShowSaveLoad(false)}
          onSave={handleSaveGame}
          onLoad={handleLoadGame}
          onDelete={handleDeleteSave}
          onExport={handleExportSave}
          onImport={handleImportSave}
          saveNames={saveNames}
          autoSaveEnabled
          lastSaveTime={lastSaveTime}
        />

        <ConsumerGoodsMarketPanel visible={showMarket} onDismiss={() => setShowMarket(false)} />

        <NotificationHistory visible={showNotifications} onDismiss={() => setShowNotifications(false)} />

        <GovernmentHQ visible={showGovHQ} onClose={closeGovernmentHQ} />

        <BuildingInspectorPanel
          visible={!!buildingInspector}
          buildingDefId={buildingInspector?.buildingDefId ?? ''}
          gridX={buildingInspector?.gridX ?? 0}
          gridY={buildingInspector?.gridY ?? 0}
          onDismiss={handleDismissBuildingInspector}
          onDemolish={handleDemolishInspected}
        />

        <CitizenDossierModal
          visible={citizenDossierIdx != null}
          citizenIndex={citizenDossierIdx ?? 0}
          onDismiss={handleDismissCitizenDossier}
        />

        <SettingsModal visible={showSettings} onDismiss={() => setShowSettings(false)} onEnterXR={setXrMode} />

        <IntroModal visible={showIntro} onDismiss={handleDismissIntro} />

        {/* XR exit overlay — shown when in AR/VR mode */}
        {xrMode && (
          <View style={styles.xrExitOverlay} pointerEvents="box-none">
            <TouchableOpacity style={styles.xrExitButton} onPress={() => setXrMode(null)} activeOpacity={0.7}>
              <Text style={styles.xrExitText}>EXIT {xrMode === 'ar' ? 'AR' : 'VR'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Radial menu — unified build/inspect overlay */}
        <RadialMenu />
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bgColor,
  },
  sceneContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  uiOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  xrExitOverlay: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 200,
  },
  xrExitButton: {
    backgroundColor: Colors.sovietRed,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: Colors.sovietGold,
  },
  xrExitText: {
    color: Colors.white,
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
});

export default App;

// Service worker registration (production only)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sim-soviet/sw.js').catch(() => {});
  });
}
