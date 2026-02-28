/**
 * SimSoviet 2000 — Root Application Component
 *
 * Architecture:
 *   Plain <canvas> element for Canvas 2D isometric rendering.
 *   React DOM components render the 2D UI as overlays.
 *   GameWorld (render-null) imperatively manages renderer, input, simulation.
 *   gameStore bridges mutable GameState with React via useSyncExternalStore.
 */

import { GameModals } from '@app/components/GameModals';
import { NotificationLog } from '@app/components/NotificationLog';
import type { GameOverInfo, Messages } from '@app/hooks/useSimCallbacks';
import { useSimCallbacks } from '@app/hooks/useSimCallbacks';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AudioAPI, SaveSystemAPI, WorkerAPI } from '@/components/GameWorld';
import { GameWorld } from '@/components/GameWorld';
import { AssignmentLetter } from '@/components/screens/AssignmentLetter';
import { LandingPage } from '@/components/screens/LandingPage';
import { type NewGameConfig, NewGameFlow } from '@/components/screens/NewGameFlow';
import { Advisor } from '@/components/ui/Advisor';
import type { AnnualReportData } from '@/components/ui/AnnualReportModal';
import { BottomStrip } from '@/components/ui/BottomStrip';
import { BuildingInspector } from '@/components/ui/BuildingInspector';
import { CitizenDossierModal } from '@/components/ui/CitizenDossierModal';
import { ConcreteFrame } from '@/components/ui/ConcreteFrame';
import { DrawerPanel } from '@/components/ui/DrawerPanel';
import type { PlanDirective } from '@/components/ui/FiveYearPlanModal';
import { RadialBuildMenu } from '@/components/ui/RadialBuildMenu';
import { RadialInspectMenu } from '@/components/ui/RadialInspectMenu';
import { SovietHUD } from '@/components/ui/SovietHUD';
import { SovietToastStack } from '@/components/ui/SovietToastStack';
import { WorkerInfoPanel } from '@/components/ui/WorkerInfoPanel';
import { initDatabase } from '@/db/provider';
import * as dbSchema from '@/db/schema';
import type { EraDefinition } from '@/game/era';
import { ERA_DEFINITIONS } from '@/game/era';
import type { TallyData } from '@/game/GameTally';
import type { ActiveMinigame } from '@/game/minigames/MinigameTypes';
import type { SettlementEvent } from '@/game/SettlementSystem';
import { useCitizenDossier, useGameSnapshot } from '@/stores/gameStore';

export function App() {
  const snap = useGameSnapshot();
  const citizenDossier = useCitizenDossier();
  type Screen = 'landing' | 'newGame' | 'assignment' | 'playing';
  const [screen, setScreen] = useState<Screen>('landing');
  const [gameConfig, setGameConfig] = useState<NewGameConfig | null>(null);
  const [gameOver, setGameOver] = useState<GameOverInfo | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settlementEvent, setSettlementEvent] = useState<SettlementEvent | null>(null);
  const [planDirective, setPlanDirective] = useState<PlanDirective | null>(null);
  const [annualReport, setAnnualReport] = useState<AnnualReportData | null>(null);
  const [eraTransition, setEraTransition] = useState<EraDefinition | null>(null);
  const [activeMinigame, setActiveMinigame] = useState<ActiveMinigame | null>(null);
  const [gameTally, setGameTally] = useState<TallyData | null>(null);
  const [messages, setMessages] = useState<Messages>({
    advisor: null,
    pravda: null,
  });
  const [notificationLogOpen, setNotificationLogOpen] = useState(false);
  const [hasSavedGame, setHasSavedGame] = useState(false);
  const [loadSaveOnStart, setLoadSaveOnStart] = useState<string | null>(null);
  const [saveApi, setSaveApi] = useState<SaveSystemAPI | null>(null);
  const [audioApi, setAudioApi] = useState<AudioAPI | null>(null);
  const [workerApi, setWorkerApi] = useState<WorkerAPI | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Callbacks for SimulationEngine → React state
  const { simCallbacks, submitReportRef, resolveMinigameRef } = useSimCallbacks({
    setMessages,
    setGameOver,
    setSettlementEvent,
    setPlanDirective,
    setAnnualReport,
    setEraTransition,
    setActiveMinigame,
    setGameTally,
  });

  // Check for existing saves on mount
  useEffect(() => {
    initDatabase()
      .then((db) => {
        const rows = db.select().from(dbSchema.saves).all();
        setHasSavedGame(rows.length > 0);
      })
      .catch(() => {
        // Fall back to localStorage check
        const hasLocal =
          localStorage.getItem('simsoviet_save_v2') !== null ||
          localStorage.getItem('simsoviet_save_v1') !== null;
        setHasSavedGame(hasLocal);
      });
  }, []);

  const handleRestart = useCallback(() => {
    // Full page reload for clean state (ECS world, GameState, audio)
    window.location.reload();
  }, []);

  const handleSaveSystemReady = useCallback((api: SaveSystemAPI) => {
    setSaveApi(api);
  }, []);

  const handleAudioReady = useCallback((api: AudioAPI) => {
    setAudioApi(api);
  }, []);

  const handleWorkerApiReady = useCallback((api: WorkerAPI) => {
    setWorkerApi(api);
  }, []);

  return (
    <div
      className="flex flex-col bg-[#1a1a1a] overflow-hidden"
      style={{ fontFamily: "'VT323', monospace", height: '100dvh' }}
    >
      {/* CRT overlay effects */}
      <div className="crt-overlay" />
      <div className="scanlines" />

      {/* Brutalist concrete border frame */}
      <ConcreteFrame />

      {/* Screen flow */}
      {screen === 'landing' && (
        <LandingPage
          onNewGame={() => setScreen('newGame')}
          onContinue={() => {
            setLoadSaveOnStart('autosave');
            setScreen('playing');
          }}
          onLoadGame={() => {
            setLoadSaveOnStart('manual_1');
            setScreen('playing');
          }}
          hasSavedGame={hasSavedGame}
        />
      )}
      {screen === 'newGame' && (
        <NewGameFlow
          onStart={(config) => {
            setGameConfig(config);
            setScreen('assignment');
          }}
          onBack={() => setScreen('landing')}
        />
      )}
      {screen === 'assignment' && gameConfig && (
        <AssignmentLetter
          config={gameConfig}
          era={ERA_DEFINITIONS[gameConfig.startEra]}
          onAccept={() => {
            setScreen('playing');
            setMessages((p) => ({
              ...p,
              advisor: 'Finally. You are late. Build a Coal Plant first, then Housing. Go.',
            }));
          }}
        />
      )}

      {/* All game modals — GameOver, Settlement, AnnualReport, Plan, Era, Minigame, Tally */}
      <GameModals
        gameOver={gameOver}
        onRestart={handleRestart}
        settlementEvent={settlementEvent}
        setSettlementEvent={setSettlementEvent}
        annualReport={annualReport}
        setAnnualReport={setAnnualReport}
        submitReportRef={submitReportRef}
        planDirective={planDirective}
        setPlanDirective={setPlanDirective}
        eraTransition={eraTransition}
        setEraTransition={setEraTransition}
        activeMinigame={activeMinigame}
        setActiveMinigame={setActiveMinigame}
        resolveMinigameRef={resolveMinigameRef}
        gameTally={gameTally}
        setGameTally={setGameTally}
      />

      {/* Citizen dossier modal — opened when a citizen is tapped */}
      {citizenDossier && <CitizenDossierModal data={citizenDossier} />}

      {/* Notification dispatch log */}
      <NotificationLog isOpen={notificationLogOpen} onClose={() => setNotificationLogOpen(false)} />

      {/* Top HUD bar — resources, pause, speed, hamburger */}
      <SovietHUD
        onMenuToggle={() => setDrawerOpen(true)}
        onNotificationLogToggle={() => setNotificationLogOpen((o) => !o)}
      />

      {/* Main game viewport */}
      <div className="flex-1 relative overflow-hidden min-h-0">
        <canvas
          ref={canvasRef}
          id="gameCanvas"
          className="absolute inset-0 w-full h-full"
          style={{ display: 'block', touchAction: 'none', outline: 'none' }}
        />

        {/* Render-null component that manages game systems */}
        <GameWorld
          canvasRef={canvasRef}
          callbacks={simCallbacks}
          gameStarted={screen === 'playing'}
          gameConfig={gameConfig}
          loadSaveOnStart={loadSaveOnStart}
          onSaveSystemReady={handleSaveSystemReady}
          onAudioReady={handleAudioReady}
          onWorkerApiReady={handleWorkerApiReady}
        />

        {/* Pause overlay */}
        <AnimatePresence>
          {snap.paused && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none z-10"
            >
              <div className="text-[#ff4444] text-2xl font-bold uppercase tracking-[0.3em] border-2 border-[#ff4444] px-6 py-2 bg-black/60">
                PAUSED
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* DOM overlays on top of canvas */}
        <BuildingInspector />
        <WorkerInfoPanel />
        <SovietToastStack />
        <Advisor
          message={messages.advisor}
          onDismiss={() => setMessages((p) => ({ ...p, advisor: null }))}
        />
      </div>

      {/* Bottom strip — settlement info + Pravda ticker */}
      <BottomStrip pravdaMessage={messages.pravda} />

      {/* Radial build menu — opens on empty grid cell tap */}
      <RadialBuildMenu />

      {/* Radial inspect menu — opens on existing building tap */}
      <RadialInspectMenu />

      {/* Slide-out drawer */}
      <DrawerPanel
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        saveApi={saveApi}
        audioApi={audioApi}
        workerApi={workerApi}
      />
    </div>
  );
}
