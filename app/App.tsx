/**
 * SimSoviet 2000 — Root Application Component
 *
 * Architecture:
 *   Plain <canvas> element for Canvas 2D isometric rendering.
 *   React DOM components render the 2D UI as overlays.
 *   GameWorld (render-null) imperatively manages renderer, input, simulation.
 *   gameStore bridges mutable GameState with React via useSyncExternalStore.
 */
import { useCallback, useRef, useState } from 'react';
import { GameWorld } from '@/components/GameWorld';
import { Advisor } from '@/components/ui/Advisor';
import { BuildingInspector } from '@/components/ui/BuildingInspector';
import { GameOverModal } from '@/components/ui/GameOverModal';
import { IntroModal } from '@/components/ui/IntroModal';
import { PravdaTicker } from '@/components/ui/PravdaTicker';
import { QuotaHUD } from '@/components/ui/QuotaHUD';
import { Toast } from '@/components/ui/Toast';
import { Toolbar } from '@/components/ui/Toolbar';
import { TopBar } from '@/components/ui/TopBar';
import type { SimCallbacks } from '@/game/SimulationEngine';

interface Messages {
  advisor: string | null;
  toast: string | null;
  pravda: string | null;
}

interface GameOverInfo {
  victory: boolean;
  reason: string;
}

export function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState<GameOverInfo | null>(null);
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
    <div className="game-root">
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

      {/* Top stats bar */}
      <TopBar />

      {/* Main game viewport */}
      <div className="game-viewport">
        <canvas
          ref={canvasRef}
          id="gameCanvas"
          style={{ display: 'block', touchAction: 'none', outline: 'none' }}
        />

        {/* Render-null component that manages game systems */}
        <GameWorld canvasRef={canvasRef} callbacks={simCallbacks} gameStarted={gameStarted} />

        {/* DOM overlays on top of canvas */}
        <BuildingInspector />
        <QuotaHUD />
        <Toast
          message={messages.toast}
          onDismiss={() => setMessages((p) => ({ ...p, toast: null }))}
        />
        <Advisor
          message={messages.advisor}
          onDismiss={() => setMessages((p) => ({ ...p, advisor: null }))}
        />
      </div>

      {/* Pravda news ticker */}
      <PravdaTicker message={messages.pravda} />

      {/* Bottom toolbar */}
      <Toolbar />
    </div>
  );
}
