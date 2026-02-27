/**
 * App.web.tsx — Web-specific root component for SimSoviet 1917.
 *
 * Screen flow: MainMenu → Loading (Engine mounts) → IntroModal → Game
 *
 * Uses reactylon/web Engine (creates an HTML canvas with WebGL)
 * instead of the native NativeEngine.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SafeAreaView, View, StatusBar, StyleSheet, Platform } from 'react-native';
import { Engine } from 'reactylon/web';
import { Scene } from 'reactylon';

// Inject global CSS to make the BabylonJS canvas fill its container.
// The reactylon Engine creates <canvas id="reactylon-canvas"> with no sizing CSS.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    #reactylon-canvas {
      width: 100% !important;
      height: 100% !important;
      display: block;
      outline: none;
    }
  `;
  document.head.appendChild(style);
}

import Content from './Content';
import { useECSGameLoop } from './hooks/useECSGameLoop';
import { useGameSnapshot } from './hooks/useGameState';
import AudioManager from './audio/AudioManager';
import { gameState } from './engine/GameState';
import { initGame, isGameInitialized, type GameInitOptions } from './bridge/GameInit';
import { notifyStateChange, setPaused, setGameSpeed } from './stores/gameStore';
import { getTotalModelCount } from './scene/ModelCache';
import { buildings as ecsBuildingsArchetype, terrainFeatures as ecsTerrainFeatures } from './ecs/archetypes';
import {
  setSpeed,
  setTab,
  selectTool,
  setLens,
  getToast,
  clearToast,
  getAdvisor,
  dismissAdvisor,
  getRandomTickerMsg,
  showToast,
  showAdvisor,
} from './engine/helpers';
import type { TabType, LensType } from './engine/GameState';
import type { AnnualReportData, ReportSubmission } from './components/ui/AnnualReportModal';
import type { EraDefinition } from './game/era';
import type { ActiveMinigame } from './game/minigames/MinigameTypes';
import type { SettlementEvent } from './game/SettlementSystem';
import type { TallyData } from './game/GameTally';

// UI components
import { TopBar } from './ui/TopBar';
import { TabBar } from './ui/TabBar';
import { Toolbar } from './ui/Toolbar';
import { QuotaHUD } from './ui/QuotaHUD';
import { DirectiveHUD } from './ui/DirectiveHUD';
import { Advisor } from './ui/Advisor';
import { Toast } from './ui/Toast';
import { Ticker } from './ui/Ticker';
import { Minimap } from './ui/Minimap';
import { LensSelector } from './ui/LensSelector';
import { IntroModal } from './ui/IntroModal';
import { MainMenu } from './ui/MainMenu';
import { LoadingScreen } from './ui/LoadingScreen';
import { GameModals, type PlanDirective, type GameOverInfo } from './ui/GameModals';
import { NewGameSetup, type NewGameConfig } from './ui/NewGameSetup';
import { PersonnelFilePanel } from './ui/PersonnelFilePanel';
import { AchievementsPanel } from './ui/AchievementsPanel';
import { SettingsModal } from './ui/SettingsModal';
import { LeadershipPanel } from './ui/LeadershipPanel';
import { EconomyPanel } from './ui/EconomyPanel';
import { WorkerRosterPanel } from './ui/WorkerRosterPanel';
import { MandateProgressPanel } from './ui/MandateProgressPanel';
import { DiseasePanel } from './ui/DiseasePanel';
import { InfrastructurePanel } from './ui/InfrastructurePanel';
import { Colors } from './ui/styles';

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
    total: getTotalModelCount(),
    name: '',
  });

  const [tickerText, setTickerText] = useState(
    'CITIZENS REMINDED THAT COMPLAINING IS A CRIME  ///  WEATHER FORECAST: PERPETUAL GRAY  ///  '
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

  // Auto-pause when interactive modals are open
  const hasInteractiveModal =
    !!annualReport || !!activeMinigame || !!planDirective || !!gameOver;
  useEffect(() => {
    if (hasInteractiveModal) setPaused(true);
    else setPaused(false);
  }, [hasInteractiveModal]);

  // Start ECS game loop (replaces old flat-state game loop)
  useECSGameLoop();

  // Subscribe to game state (old hook — still used by 3D scene components)
  const snap = useGameSnapshot();

  // Initialize ECS world and SimulationEngine when entering game
  useEffect(() => {
    if (screen === 'game' && !isGameInitialized()) {
      // Initialize ECS with callbacks that bridge to React state
      initGame({
        onToast: (msg) => {
          showToast(gameState, msg);
        },
        onAdvisor: (msg) => {
          showAdvisor(gameState, msg);
        },
        onPravda: (msg) => {
          setTickerText((prev) => prev + msg + '  ///  ');
        },
        onStateChange: () => {
          // Sync ECS building powered state to old GameState for 3D effects
          for (const e of ecsBuildingsArchetype.entities) {
            const b = gameState.buildings.find(
              (bi) => bi.x === e.position.gridX && bi.y === e.position.gridY,
            );
            if (b) b.powered = e.building.powered;
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
        },
        onAchievement: (name, description) => {
          showToast(gameState, `★ ${name}: ${description}`);
        },
        onSeasonChanged: (_season) => {
          // Audio seasonal switching placeholder
        },
        onBuildingCollapsed: (gridX, gridY, type) => {
          showToast(gameState, `BUILDING COLLAPSED: ${type} at (${gridX},${gridY})`);
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
        },
        onGameTally: (tally) => {
          setGameTally(tally);
        },
      }, gameConfigRef.current);

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
    }
  }, [screen]);

  // Ticker message accumulation (only when game is active)
  const tickerIntervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  useEffect(() => {
    if (screen !== 'game' || !loadingFaded) return;
    tickerIntervalRef.current = setInterval(() => {
      setTickerText((prev) => prev + getRandomTickerMsg() + '  ///  ');
    }, 8000);
    return () => clearInterval(tickerIntervalRef.current);
  }, [screen, loadingFaded]);

  // --- Loading callbacks ---
  const handleLoadProgress = useCallback(
    (loaded: number, total: number, name: string) => {
      setLoadProgress({ loaded, total, name });
    },
    [],
  );

  const handleLoadComplete = useCallback(() => {
    setAssetsReady(true);
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

  const handleTabPress = useCallback((tab: TabType) => {
    setTab(gameState, tab);
  }, []);

  const handleSelectTool = useCallback((tool: string) => {
    selectTool(gameState, tool);
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
    // For now, just dismiss — full restart requires page reload
    setGameOver(null);
    setGameTally(null);
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
        <SettingsModal
          visible={showSettings}
          onDismiss={() => setShowSettings(false)}
        />
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
  const loadPct =
    loadProgress.total > 0 ? loadProgress.loaded / loadProgress.total : 0;

  return (
    <>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.root}>
        <View style={styles.sceneContainer}>
          <Engine forceWebGL>
            <Scene>
              <Content
                onLoadProgress={handleLoadProgress}
                onLoadComplete={handleLoadComplete}
              />
            </Scene>
          </Engine>
        </View>

        {loadingFaded && (
          <View style={styles.uiOverlay} pointerEvents="box-none">
            <TopBar
              season={snap.seasonLabel}
              weather={snap.weatherLabel}
              waterUsed={snap.waterUsed}
              waterGen={snap.waterGen}
              powerUsed={snap.powerUsed}
              powerGen={snap.powerGen}
              money={snap.money}
              income={snap.lastIncome}
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
            />

            <Toast
              message={toast?.text ?? null}
              onDismiss={handleDismissToast}
            />

            {snap.quotaTarget > 0 && (
              <QuotaHUD
                targetType={snap.quotaType}
                targetAmount={snap.quotaTarget}
                current={snap.quotaCurrent}
                deadlineYear={snap.quotaDeadline}
              />
            )}

            <Minimap />

            <DirectiveHUD
              text={snap.directiveText}
              reward={snap.directiveReward}
            />

            <LensSelector
              activeLens={snap.activeLens}
              onLensChange={handleLensChange}
            />

            <Advisor
              visible={!!advisor}
              message={advisor?.text ?? ''}
              onDismiss={handleDismissAdvisor}
            />

            <View style={styles.bottomPanel}>
              <Ticker messages={tickerText} />
              <TabBar
                activeTab={snap.activeTab}
                onTabPress={handleTabPress}
              />
              <Toolbar
                activeTab={snap.activeTab}
                selectedTool={snap.selectedTool}
                onSelectTool={handleSelectTool}
              />
            </View>
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

        <PersonnelFilePanel
          visible={showPersonnelFile}
          onDismiss={() => setShowPersonnelFile(false)}
        />

        <AchievementsPanel
          visible={showAchievements}
          onDismiss={() => setShowAchievements(false)}
        />

        <LeadershipPanel
          visible={showLeadership}
          onDismiss={() => setShowLeadership(false)}
        />

        <EconomyPanel
          visible={showEconomy}
          onDismiss={() => setShowEconomy(false)}
        />

        <WorkerRosterPanel
          visible={showWorkers}
          onDismiss={() => setShowWorkers(false)}
        />

        <MandateProgressPanel
          visible={showMandates}
          onDismiss={() => setShowMandates(false)}
        />

        <DiseasePanel
          visible={showDisease}
          onDismiss={() => setShowDisease(false)}
        />

        <InfrastructurePanel
          visible={showInfra}
          onDismiss={() => setShowInfra(false)}
        />

        <SettingsModal
          visible={showSettings}
          onDismiss={() => setShowSettings(false)}
        />

        <IntroModal
          visible={showIntro}
          onDismiss={handleDismissIntro}
        />
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
