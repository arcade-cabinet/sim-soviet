/**
 * SimSoviet 2000 — Root Application Component
 *
 * Architecture:
 *   Plain <canvas> element for Canvas 2D isometric rendering.
 *   React DOM components render the 2D UI as overlays.
 *   GameWorld (render-null) imperatively manages renderer, input, simulation.
 *   gameStore bridges mutable GameState with React via useSyncExternalStore.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AudioAPI, SaveSystemAPI, WorkerAPI } from '@/components/GameWorld';
import { GameWorld } from '@/components/GameWorld';
import { AssignmentLetter } from '@/components/screens/AssignmentLetter';
import { LandingPage } from '@/components/screens/LandingPage';
import { type NewGameConfig, NewGameFlow } from '@/components/screens/NewGameFlow';
import { Advisor } from '@/components/ui/Advisor';
import type { AnnualReportData, ReportSubmission } from '@/components/ui/AnnualReportModal';
import { AnnualReportModal } from '@/components/ui/AnnualReportModal';
import { BottomStrip } from '@/components/ui/BottomStrip';
import { BuildingInspector } from '@/components/ui/BuildingInspector';
import { ConcreteFrame } from '@/components/ui/ConcreteFrame';
import { DrawerPanel } from '@/components/ui/DrawerPanel';
import { EraTransitionModal } from '@/components/ui/EraTransitionModal';
import type { PlanDirective } from '@/components/ui/FiveYearPlanModal';
import { FiveYearPlanModal } from '@/components/ui/FiveYearPlanModal';
import { GameOverModal } from '@/components/ui/GameOverModal';
import { GameTallyScreen } from '@/components/ui/GameTallyScreen';
import { MinigameModal } from '@/components/ui/MinigameModal';
import { RadialBuildMenu } from '@/components/ui/RadialBuildMenu';
import { SettlementUpgradeModal } from '@/components/ui/SettlementUpgradeModal';
import { SovietHUD } from '@/components/ui/SovietHUD';
import { SovietToastStack } from '@/components/ui/SovietToastStack';
import { WorkerInfoPanel } from '@/components/ui/WorkerInfoPanel';
import { initDatabase } from '@/db/provider';
import * as dbSchema from '@/db/schema';
import { getResourceEntity } from '@/ecs/archetypes';
import type { EraDefinition } from '@/game/era';
import { ERA_DEFINITIONS } from '@/game/era';
import type { TallyData } from '@/game/GameTally';
import type { ActiveMinigame } from '@/game/minigames/MinigameTypes';
import type { SettlementEvent } from '@/game/SettlementSystem';
import type { SimCallbacks } from '@/game/SimulationEngine';
import { useGameSnapshot } from '@/stores/gameStore';
import { addSovietToast } from '@/stores/toastStore';

interface Messages {
  advisor: string | null;
  pravda: string | null;
}

interface GameOverInfo {
  victory: boolean;
  reason: string;
}

export function App() {
  const snap = useGameSnapshot();
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
  const [hasSavedGame, setHasSavedGame] = useState(false);
  const [loadSaveOnStart, setLoadSaveOnStart] = useState<string | null>(null);
  const [saveApi, setSaveApi] = useState<SaveSystemAPI | null>(null);
  const [audioApi, setAudioApi] = useState<AudioAPI | null>(null);
  const [workerApi, setWorkerApi] = useState<WorkerAPI | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const submitReportRef = useRef<((submission: ReportSubmission) => void) | null>(null);

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

  // Callbacks for SimulationEngine → React state
  const simCallbacks: SimCallbacks = {
    onToast: (msg, severity) => addSovietToast(severity ?? 'warning', msg),
    onAdvisor: (msg) => setMessages((p) => ({ ...p, advisor: msg })),
    onPravda: (msg) => setMessages((p) => ({ ...p, pravda: msg })),
    onStateChange: () => {
      /* notifyStateChange() called in GameWorld */
    },
    onGameOver: (victory, reason) => setGameOver({ victory, reason }),
    onSettlementChange: (event) => setSettlementEvent(event),
    onNewPlan: (plan) => {
      const res = getResourceEntity();
      setPlanDirective({
        ...plan,
        currentFood: res?.resources.food ?? 0,
        currentVodka: res?.resources.vodka ?? 0,
        currentPop: res?.resources.population ?? 0,
        currentPower: res?.resources.power ?? 0,
        currentMoney: res?.resources.money ?? 0,
        mandates: plan.mandates,
      });
    },
    onAnnualReport: (data, submitFn) => {
      setAnnualReport(data);
      submitReportRef.current = submitFn;
    },
    onEraChanged: (era) => setEraTransition(era),
    onMinigame: (active) => setActiveMinigame(active),
    onTutorialMilestone: (_milestone) => {
      // Tutorial milestones already fire onAdvisor with Krupnik dialogue
      // in SimulationEngine.tickTutorial(). This callback is available
      // for future use (e.g. pausing simulation on milestone).
    },
    onAchievement: (name, description) => {
      addSovietToast('warning', `ACHIEVEMENT: ${name} -- ${description}`);
    },
    onGameTally: (tally) => setGameTally(tally),
  };

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

      {/* Game over modal */}
      {gameOver && (
        <GameOverModal
          victory={gameOver.victory}
          reason={gameOver.reason}
          onRestart={handleRestart}
        />
      )}

      {/* Top HUD bar — resources, pause, speed, hamburger */}
      <SovietHUD onMenuToggle={() => setDrawerOpen(true)} />

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

      {/* Slide-out drawer */}
      <DrawerPanel
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        saveApi={saveApi}
        audioApi={audioApi}
        workerApi={workerApi}
      />

      {/* Settlement upgrade decree modal */}
      <AnimatePresence>
        {settlementEvent && settlementEvent.type === 'upgrade' && (
          <SettlementUpgradeModal
            fromTier={settlementEvent.fromTier}
            toTier={settlementEvent.toTier}
            onClose={() => setSettlementEvent(null)}
          />
        )}
      </AnimatePresence>

      {/* Annual Report (pripiski) modal — shown at quota deadline years */}
      {annualReport && (
        <AnnualReportModal
          data={annualReport}
          onSubmit={(submission) => {
            submitReportRef.current?.(submission);
            submitReportRef.current = null;
            setAnnualReport(null);
          }}
        />
      )}

      {/* Five-Year Plan directive modal */}
      {planDirective && (
        <FiveYearPlanModal directive={planDirective} onAccept={() => setPlanDirective(null)} />
      )}

      {/* Era transition briefing modal */}
      <AnimatePresence>
        {eraTransition && (
          <EraTransitionModal era={eraTransition} onClose={() => setEraTransition(null)} />
        )}
      </AnimatePresence>

      {/* Minigame choice modal */}
      <AnimatePresence>
        {activeMinigame && !activeMinigame.resolved && (
          <MinigameModal
            minigame={activeMinigame}
            onChoice={() => {
              // Choice resolution routed through SimulationEngine.resolveMinigameChoice()
              // via GameWorld — auto-resolve handles timeout if not explicitly resolved.
              setActiveMinigame(null);
            }}
            onClose={() => setActiveMinigame(null)}
          />
        )}
      </AnimatePresence>

      {/* End-game tally summary screen */}
      <AnimatePresence>
        {gameTally && <GameTallyScreen tally={gameTally} onClose={() => setGameTally(null)} />}
      </AnimatePresence>
    </div>
  );
}
