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
import { GameOverModal } from '@/components/ui/GameOverModal';
import { IntroModal } from '@/components/ui/IntroModal';
import { RadialBuildMenu } from '@/components/ui/RadialBuildMenu';
import { SovietHUD } from '@/components/ui/SovietHUD';
import { Toast } from '@/components/ui/Toast';
import type { SimCallbacks } from '@/game/SimulationEngine';
import { useGameSnapshot } from '@/stores/gameStore';

interface Messages {
  advisor: string | null;
  toast: string | null;
  pravda: string | null;
}

interface GameOverInfo {
  victory: boolean;
  reason: string;
}

/**
 * Root React component for the SimSoviet 2000 application that composes the canvas-based isometric renderer, game world manager, and UI overlays.
 *
 * Renders the main game viewport (canvas and GameWorld), top HUD, bottom strip, modals (intro and game over), pause overlay, message overlays (toast, advisor, inspector), radial build menu, and a slide-out drawer while bridging simulation events into React state.
 *
 * @returns The root JSX element for the application containing the game canvas, UI overlays, and control panels.
 */
export function App() {
  const snap = useGameSnapshot();
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState<GameOverInfo | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [messages, setMessages] = useState<Messages>({
    advisor: null,
    toast: null,
    pravda: null,
  });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Callbacks for SimulationEngine → React state
  const simCallbacks: SimCallbacks = {
    onToast: (msg) => setMessages((p) => ({ ...p, toast: msg })),
    onAdvisor: (msg) => setMessages((p) => ({ ...p, advisor: msg })),
    onPravda: (msg) => setMessages((p) => ({ ...p, pravda: msg })),
    onStateChange: () => {
      /* notifyStateChange() called in GameWorld */
    },
    onGameOver: (victory, reason) => setGameOver({ victory, reason }),
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
        <Toast
          message={messages.toast}
          onDismiss={() => setMessages((p) => ({ ...p, toast: null }))}
        />
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
    </div>
  );
}