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
import { initGame, isGameInitialized } from './bridge/GameInit';
import { notifyStateChange } from './stores/gameStore';
import { getTotalModelCount } from './scene/ModelCache';
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
} from './engine/helpers';
import type { TabType, LensType } from './engine/GameState';

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
import { Colors } from './ui/styles';

type AppScreen = 'menu' | 'game';

const App: React.FC = () => {
  // Screen state
  const [screen, setScreen] = useState<AppScreen>('menu');
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

  // Start ECS game loop (replaces old flat-state game loop)
  useECSGameLoop();

  // Subscribe to game state (old hook — still used by 3D scene components)
  const snap = useGameSnapshot();

  // Initialize ECS world and SimulationEngine when entering game
  useEffect(() => {
    if (screen === 'game' && !isGameInitialized()) {
      // Initialize ECS with callbacks that bridge to React state
      initGame({
        onToast: (msg, severity) => {
          // Bridge to the existing toast system
          const { showToast } = require('./engine/helpers');
          showToast(gameState, msg);
        },
        onAdvisor: (msg) => {
          const { showAdvisor } = require('./engine/helpers');
          showAdvisor(gameState, msg);
        },
        onPravda: (msg) => {
          setTickerText((prev) => prev + msg + '  ///  ');
        },
        onStateChange: () => {
          notifyStateChange();
          gameState.notify();
        },
        onWeatherChanged: (weather) => {
          // Sync ECS weather to old GameState for 3D WeatherFX
          gameState.currentWeather = weather as typeof gameState.currentWeather;
        },
      });

      // Also initialize the old flat grid for 3D terrain rendering
      if (gameState.grid.length === 0) {
        gameState.initGrid();
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
    setScreen('game');
  }, []);

  // --- Game callbacks ---
  const handleSetSpeed = useCallback((sp: number) => {
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

  // Read toast/advisor from side-channel
  const toast = getToast();
  const advisor = getAdvisor();

  // ─── MAIN MENU ───
  if (screen === 'menu') {
    return (
      <>
        <StatusBar barStyle="light-content" />
        <MainMenu onNewGame={handleNewGame} />
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
        {/* 3D Scene — reactylon/web Engine creates an HTML canvas */}
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

        {/* UI Overlays — only visible after loading completes */}
        {loadingFaded && (
          <View style={styles.uiOverlay} pointerEvents="box-none">
            {/* Top bar */}
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
            />

            {/* Toast notification */}
            <Toast
              message={toast?.text ?? null}
              onDismiss={handleDismissToast}
            />

            {/* Quota HUD (top-right) */}
            {snap.quotaTarget > 0 && (
              <QuotaHUD
                targetType={snap.quotaType}
                targetAmount={snap.quotaTarget}
                current={snap.quotaCurrent}
                deadlineYear={snap.quotaDeadline}
              />
            )}

            {/* Minimap (top-left) */}
            <Minimap />

            {/* Directive HUD (below minimap) */}
            <DirectiveHUD
              text={snap.directiveText}
              reward={snap.directiveReward}
            />

            {/* Lens selector (bottom-right) */}
            <LensSelector
              activeLens={snap.activeLens}
              onLensChange={handleLensChange}
            />

            {/* Advisor (bottom-left) */}
            <Advisor
              visible={!!advisor}
              message={advisor?.text ?? ''}
              onDismiss={handleDismissAdvisor}
            />

            {/* Bottom panel: Ticker + Tabs + Toolbar */}
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

        {/* Loading screen overlay — fades out when assets are ready */}
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

        {/* Intro modal — shown after loading, on top of everything */}
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
