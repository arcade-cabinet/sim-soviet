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
import { useCallback, useRef, useState } from 'react';
import { GameWorld } from '@/components/GameWorld';
import { Advisor } from '@/components/ui/Advisor';
import { BottomStrip } from '@/components/ui/BottomStrip';
import { BuildingInspector } from '@/components/ui/BuildingInspector';
import { DrawerPanel } from '@/components/ui/DrawerPanel';
import type { PlanDirective } from '@/components/ui/FiveYearPlanModal';
import { FiveYearPlanModal } from '@/components/ui/FiveYearPlanModal';
import { GameOverModal } from '@/components/ui/GameOverModal';
import { IntroModal } from '@/components/ui/IntroModal';
import { RadialBuildMenu } from '@/components/ui/RadialBuildMenu';
import { SettlementUpgradeModal } from '@/components/ui/SettlementUpgradeModal';
import { SovietHUD } from '@/components/ui/SovietHUD';
import { SovietToastStack } from '@/components/ui/SovietToastStack';
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
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState<GameOverInfo | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settlementEvent, setSettlementEvent] = useState<SettlementEvent | null>(null);
  const [planDirective, setPlanDirective] = useState<PlanDirective | null>(null);
  const [messages, setMessages] = useState<Messages>({
    advisor: null,
    pravda: null,
  });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
    onNewPlan: (plan) =>
      setPlanDirective({
        ...plan,
        currentFood: snap.food,
        currentVodka: snap.vodka,
        currentPop: snap.pop,
        currentPower: snap.power,
        currentMoney: snap.money,
      }),
  };

  const handleStart = useCallback(() => {
    setGameStarted(true);
    setMessages((p) => ({
      ...p,
      advisor: 'Finally. You are late. Build a Coal Plant first, then Housing. Go.',
    }));
  }, []);

  const handleRestart = useCallback(() => {
    // Full page reload for clean state (ECS world, GameState, audio)
    window.location.reload();
  }, []);

  return (
    <div
      className="flex flex-col bg-[#1a1a1a] overflow-hidden"
      style={{ fontFamily: "'VT323', monospace", height: '100dvh' }}
    >
      {/* CRT overlay effects */}
      <div className="crt-overlay" />
      <div className="scanlines" />

      {/* Intro modal */}
      {!gameStarted && <IntroModal onStart={handleStart} />}

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
          style={{ display: 'block', touchAction: 'none', outline: 'none' }}
        />

        {/* Render-null component that manages game systems */}
        <GameWorld canvasRef={canvasRef} callbacks={simCallbacks} gameStarted={gameStarted} />

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
      <DrawerPanel isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />

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

      {/* Five-Year Plan directive modal */}
      {planDirective && (
        <FiveYearPlanModal directive={planDirective} onAccept={() => setPlanDirective(null)} />
      )}
    </div>
  );
}
