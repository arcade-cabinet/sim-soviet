/**
 * App.tsx — Root component for SimSoviet 1917.
 *
 * Composes the Reactylon 3D engine (Engine + Scene + Content) with
 * React Native UI overlays positioned absolutely on top.
 *
 * The game loop runs inside useGameLoop(). State flows from the mutable
 * GameState singleton through useGameSnapshot() into both the 3D scene
 * (via Content) and the React Native UI components here.
 *
 * Platform notes:
 * - Web: reactylon/web Engine creates an HTML canvas with WebGL/WebGPU
 * - Native: App.web.tsx mirrors this but with the same Engine from reactylon/web
 *   (native @babylonjs/react-native was removed — it only supported RN ≤ 0.70)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SafeAreaView, View, StatusBar, StyleSheet } from 'react-native';
import { Engine } from 'reactylon/web';
import { Scene } from 'reactylon';

import Content from './Content';
import { useGameLoop } from './hooks/useGameLoop';
import { useGameSnapshot } from './hooks/useGameState';
import AudioManager from './audio/AudioManager';
import { gameState } from './engine/GameState';
import {
  setSpeed,
  selectTool,
  setLens,
  getToast,
  clearToast,
  getAdvisor,
  dismissAdvisor,
  getRandomTickerMsg,
} from './engine/helpers';
import type { LensType } from './engine/GameState';

// UI components
import { TopBar } from './ui/TopBar';
import { Toolbar } from './ui/Toolbar';
import type { SovietTab } from './ui/Toolbar';
import { QuotaHUD } from './ui/QuotaHUD';
import { DirectiveHUD } from './ui/DirectiveHUD';
import { Advisor } from './ui/Advisor';
import { Toast } from './ui/Toast';
import { Ticker } from './ui/Ticker';
import { Minimap } from './ui/Minimap';
import { LensSelector } from './ui/LensSelector';
import { IntroModal } from './ui/IntroModal';
import { Colors } from './ui/styles';

const App: React.FC = () => {
  const [showIntro, setShowIntro] = useState(true);
  const [sovietTab, setSovietTab] = useState<SovietTab>('mandates');
  const [tickerText, setTickerText] = useState(
    'CITIZENS REMINDED THAT COMPLAINING IS A CRIME  ///  WEATHER FORECAST: PERPETUAL GRAY  ///  '
  );

  // Start game loop
  useGameLoop();

  // Subscribe to game state
  const snap = useGameSnapshot();

  // Initialize grid on first mount
  useEffect(() => {
    if (gameState.grid.length === 0) {
      gameState.initGrid();
      gameState.placeStarterBuildings();
      gameState.notify();
    }
  }, []);

  // Ticker message accumulation
  const tickerIntervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  useEffect(() => {
    tickerIntervalRef.current = setInterval(() => {
      setTickerText((prev) => prev + getRandomTickerMsg() + '  ///  ');
    }, 8000);
    return () => clearInterval(tickerIntervalRef.current);
  }, []);

  // --- Callbacks ---
  const handleSetSpeed = useCallback((sp: number) => {
    setSpeed(gameState, sp);
  }, []);

  const handleSovietTab = useCallback((tab: SovietTab) => {
    setSovietTab(tab);
    if (tab === 'purge') {
      selectTool(gameState, 'bulldoze');
    }
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
    // Start music after user interaction (required for audio autoplay policy)
    AudioManager.getInstance().startPlaylist();
  }, []);

  // Read toast/advisor from side-channel
  const toast = getToast();
  const advisor = getAdvisor();

  return (
    <>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.root}>
        {/* 3D Scene — reactylon Engine creates a canvas */}
        <View style={styles.sceneContainer}>
          <Engine forceWebGL>
            <Scene>
              <Content />
            </Scene>
          </Engine>
        </View>

        {/* UI Overlays — positioned absolutely on top of the 3D canvas */}
        <View style={styles.uiOverlay} pointerEvents="box-none">
          {/* Top bar */}
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

          {/* Bottom panel: Ticker + Toolbar */}
          <View style={styles.bottomPanel}>
            <Ticker messages={tickerText} />
            <Toolbar
              activeTab={sovietTab}
              onTabChange={handleSovietTab}
            />
          </View>
        </View>

        {/* Intro modal — on top of everything */}
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
