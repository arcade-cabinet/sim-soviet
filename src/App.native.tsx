/**
 * App.native.tsx — Native-specific root component for SimSoviet 1917.
 *
 * Screen flow: MainMenu → NewGameSetup → Loading (Engine mounts) → IntroModal → Game
 *
 * Uses R3F Canvas from '@react-three/fiber/native' for native GL rendering.
 * On native, Expo/Metro resolves App.native.tsx before App.tsx.
 *
 * Key differences from App.web.tsx:
 * - No CSS injection (native doesn't need it)
 * - No service worker registration
 * - No WebGPURenderer — uses standard GL props via Canvas
 * - No window.addEventListener — uses AppState for lifecycle
 * - Database persistence via AppState instead of beforeunload
 */

import { Canvas } from '@react-three/fiber/native';
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import AudioManager from './audio/AudioManager';
import { ERA_CONTEXTS, SEASON_CONTEXTS } from './audio/AudioManifest';
import SFXManager from './audio/SFXManager';
import { bulldozeECSBuilding } from './bridge/BuildingPlacement';
import { type GameInitOptions, getEngine, getSaveSystem, initGame, isGameInitialized } from './bridge/GameInit';
import Content from './Content';
import type { AnnualReportData, ReportSubmission } from './components/ui/AnnualReportModal';
import { initDatabase, persistToIndexedDB } from './db/provider';
import { buildings as ecsBuildingsArchetype, terrainFeatures as ecsTerrainFeatures } from './ecs/archetypes';
import type { LensType } from './engine/GameState';
import { gameState } from './engine/GameState';
import {
  clearToast,
  dismissAdvisor,
  getAdvisor,
  getToast,
  selectTool,
  setLens,
  setSpeed,
  showAdvisor,
  showToast,
} from './engine/helpers';
import type { EraDefinition } from './game/era';
import type { TallyData } from './game/GameTally';
import type { ActiveMinigame } from './game/minigames/MinigameTypes';
import type { SettlementEvent } from './game/SettlementSystem';
import { useECSGameLoop } from './hooks/useECSGameLoop';
import { useGameSnapshot } from './hooks/useGameState';
import { TOTAL_MODEL_COUNT } from './scene/ModelPreloader';
import {
  closeBuildingInspector,
  closeCitizenDossierByIndex,
  closePoliticalPanel,
  isPaused,
  notifyStateChange,
  setGameSpeed,
  setPaused,
  useBuildingInspector,
  useCitizenDossierIndex,
  useCursorTooltip,
  usePoliticalPanel,
} from './stores/gameStore';
import { AchievementsPanel } from './ui/AchievementsPanel';
import { Advisor } from './ui/Advisor';
import { BuildingInspectorPanel } from './ui/BuildingInspectorPanel';
import { CitizenDossierModal } from './ui/CitizenDossierModal';
import { CompulsoryDeliveriesPanel } from './ui/CompulsoryDeliveriesPanel';
import { ConsumerGoodsMarketPanel } from './ui/ConsumerGoodsMarketPanel';
import { CursorTooltip } from './ui/CursorTooltip';
import { DirectiveHUD } from './ui/DirectiveHUD';
import { DiseasePanel } from './ui/DiseasePanel';
import { EconomyDetailPanel } from './ui/EconomyDetailPanel';
import { EconomyPanel } from './ui/EconomyPanel';
import { EraTechTreePanel } from './ui/EraTechTreePanel';
import { EventHistoryPanel } from './ui/EventHistoryPanel';
import { GameModals, type GameOverInfo, type PlanDirective } from './ui/GameModals';
import { InfrastructurePanel } from './ui/InfrastructurePanel';
import { IntroModal } from './ui/IntroModal';
import { LeadershipPanel } from './ui/LeadershipPanel';
import { LensSelector } from './ui/LensSelector';
import { LoadingScreen } from './ui/LoadingScreen';
import { MainMenu } from './ui/MainMenu';
import { MandateProgressPanel } from './ui/MandateProgressPanel';
import { MinigameReferencePanel } from './ui/MinigameReferencePanel';
import { Minimap } from './ui/Minimap';
import { type NewGameConfig, NewGameSetup } from './ui/NewGameSetup';
import { NotificationHistory } from './ui/NotificationHistory';
import { getUnreadCount, subscribeNotifications } from './ui/NotificationStore';
import { PersonnelFilePanel } from './ui/PersonnelFilePanel';
import { PolitburoPanel } from './ui/PolitburoPanel';
import { PoliticalEntityPanel } from './ui/PoliticalEntityPanel';
import { PravdaArchivePanel } from './ui/PravdaArchivePanel';
import { QuotaHUD } from './ui/QuotaHUD';
import { RadialBuildMenu } from './ui/RadialBuildMenu';
import { RadialInspectMenu } from './ui/RadialInspectMenu';
import { SaveLoadPanel } from './ui/SaveLoadPanel';
import { ScoringPanel } from './ui/ScoringPanel';
import { SettingsModal } from './ui/SettingsModal';
import { SettlementProgressPanel } from './ui/SettlementProgressPanel';
import { Colors } from './ui/styles';
import { Ticker } from './ui/Ticker';
import { Toast } from './ui/Toast';
import type { SovietTab } from './ui/Toolbar';
import { Toolbar } from './ui/Toolbar';
import { TopBar } from './ui/TopBar';
import { WeatherForecastPanel } from './ui/WeatherForecastPanel';
import { WorkerAnalyticsPanel } from './ui/WorkerAnalyticsPanel';
import { WorkerRosterPanel } from './ui/WorkerRosterPanel';
import { WorkerStatusBar } from './ui/WorkerStatusBar';

/**
 * Error boundary to catch Engine/GL crashes and show a fallback
 * instead of a blank screen.
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
            Restart the app to try again. If this persists, your device may not support the required GL features.
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

  const [tickerText, setTickerText] = useState(
    'CITIZENS REMINDED THAT COMPLAINING IS A CRIME  ///  WEATHER FORECAST: PERPETUAL GRAY  ///  ',
  );

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

  // ── Soviet tab state ──
  const [sovietTab, setSovietTab] = useState<SovietTab>('mandates');

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

  // Auto-pause when interactive modals are open (restore prior state on close)
  const hasInteractiveModal = !!annualReport || !!activeMinigame || !!planDirective || !!gameOver;
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

  // Initialize SFXManager eagerly on native (no autoplay policy restriction)
  useEffect(() => {
    SFXManager.getInstance().init();
  }, []);

  // Start ECS game loop (replaces old flat-state game loop)
  useECSGameLoop();

  // Subscribe to game state (old hook — still used by 3D scene components)
  const snap = useGameSnapshot();

  // ── Building Inspector + Citizen Dossier + Cursor Tooltip + Political Panel (store-driven) ──
  const buildingInspector = useBuildingInspector();
  const citizenDossierIdx = useCitizenDossierIndex();
  const cursorTooltip = useCursorTooltip();
  const politicalPanelFromScene = usePoliticalPanel();

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
      // Initialize SQLite database
      try {
        await initDatabase();
      } catch {
        // Falls back to localStorage if sql.js WASM fails to load
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
          onPravda: (msg) => {
            setTickerText((prev) => `${prev + msg}  ///  `);
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
              AudioManager.getInstance().playContext(ctx);
            }
            // Notify store so RadialBuildMenu re-renders with newly unlocked buildings
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
            // Notify store so RadialBuildMenu re-renders with newly unlocked categories
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

    // Persist database when app goes to background (native equivalent of beforeunload)
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        persistToIndexedDB();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [screen]);

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
    // Update both ECS game loop speed and old GameState for UI display
    setGameSpeed(sp as 1 | 2 | 3);
    setSpeed(gameState, sp);
  }, []);

  const handleLensChange = useCallback((lens: LensType) => {
    setLens(gameState, lens);
  }, []);

  const handleDismissToast = useCallback(() => {
    clearToast();
  }, []);

  const handleDismissAdvisor = useCallback(() => {
    dismissAdvisor();
    gameState.notify();
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

  const handleSovietTab = useCallback(
    (tab: SovietTab) => {
      setSovietTab(tab);
      switch (tab) {
        case 'mandates':
          handleShowMandates();
          break;
        case 'workers':
          handleShowWorkers();
          break;
        case 'reports':
          handleShowEconomy();
          break;
        case 'purge':
          selectTool(gameState, 'bulldoze');
          break;
      }
    },
    [handleShowMandates, handleShowWorkers, handleShowEconomy],
  );

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
    // On native, we cannot do window.location.reload().
    // For now, reset to main menu. A full engine reset would require
    // clearing all module-level singletons — future work.
    setScreen('menu');
  }, []);

  // Read toast/advisor from side-channel
  const toast = getToast();
  const advisor = getAdvisor();

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
              shadows
              camera={{ position: [30, 40, 30], fov: 45 }}
              style={{ flex: 1 }}
              gl={{ antialias: true, alpha: false }}
            >
              <Content onLoadProgress={handleLoadProgress} onLoadComplete={handleLoadComplete} />
            </Canvas>
          </EngineErrorBoundary>
        </View>

        {loadingFaded && (
          <View style={styles.uiOverlay} pointerEvents="box-none">
            <TopBar
              season={snap.seasonLabel}
              weather={snap.weatherLabel}
              timber={snap.timber}
              steel={snap.steel}
              cement={snap.cement}
              powerUsed={snap.powerUsed}
              powerGen={snap.powerGen}
              currentEra={snap.currentEra}
              food={snap.food}
              vodka={snap.vodka}
              population={snap.pop}
              dateLabel={snap.dateLabel}
              monthProgress={snap.monthProgress}
              speed={snap.speed}
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
            />

            <Toast message={toast?.text ?? null} onDismiss={handleDismissToast} />

            {snap.quotaTarget > 0 && (
              <QuotaHUD
                targetType={snap.quotaType}
                targetAmount={snap.quotaTarget}
                current={snap.quotaCurrent}
                deadlineYear={snap.quotaDeadline}
              />
            )}

            <Minimap />

            <DirectiveHUD text={snap.directiveText} reward={snap.directiveReward} />

            <LensSelector activeLens={snap.activeLens} onLensChange={handleLensChange} />

            <Advisor visible={!!advisor} message={advisor?.text ?? ''} onDismiss={handleDismissAdvisor} />

            <View style={styles.bottomPanel}>
              <Ticker messages={tickerText} />
              <Toolbar activeTab={sovietTab} onTabChange={handleSovietTab} />
              <WorkerStatusBar onShowWorkers={handleShowWorkers} />
            </View>

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

        <SettingsModal visible={showSettings} onDismiss={() => setShowSettings(false)} />

        <IntroModal visible={showIntro} onDismiss={handleDismissIntro} />

        {/* Radial menus — topmost overlays */}
        <RadialBuildMenu />
        <RadialInspectMenu />
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
  bottomPanel: {
    backgroundColor: Colors.panelBg,
  },
});

export default App;
