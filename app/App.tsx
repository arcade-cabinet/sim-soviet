/**
 * SimSoviet 2000 — Root Application Component
 *
 * Architecture:
 *   Reactylon <Engine>/<Scene> manages the BabylonJS canvas + render loop.
 *   React DOM components render the 2D UI as overlays.
 *   GameWorld (inside <Scene>) imperatively manages meshes, input, particles.
 *   gameStore bridges mutable GameState with React via useSyncExternalStore.
 */
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene as BabylonScene } from '@babylonjs/core/scene';
import { useCallback, useRef, useState } from 'react';
import { Engine } from 'reactylon/web';
import { Scene } from 'reactylon';
import 'reactylon';
import { GameWorld } from '@/components/GameWorld';
import { Advisor } from '@/components/ui/Advisor';
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

export function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const [messages, setMessages] = useState<Messages>({
    advisor: null,
    toast: null,
    pravda: null,
  });
  const cameraRef = useRef<ArcRotateCamera | null>(null);

  // Called by Reactylon when BabylonJS scene is created
  const handleSceneReady = useCallback((scene: BabylonScene) => {
    // ── Camera ──────────────────────────────────────────────────────
    const camera = new ArcRotateCamera(
      'camera',
      -Math.PI / 4,   // alpha: 45deg rotation
      Math.PI / 3,     // beta: 60deg elevation (isometric-ish)
      50,              // radius: zoom distance
      new Vector3(0, 0, 0),
      scene,
    );
    camera.attachControl(scene.getEngine().getRenderingCanvas()!, true);

    // Zoom limits
    camera.lowerRadiusLimit = 15;
    camera.upperRadiusLimit = 120;
    camera.wheelPrecision = 30;

    // Lock vertical angle to keep isometric perspective
    camera.lowerBetaLimit = Math.PI / 6;  // min 30deg
    camera.upperBetaLimit = Math.PI / 2.5; // max 72deg

    // Touch-friendly camera controls
    camera.pinchPrecision = 50;
    camera.panningSensibility = 100;
    camera.angularSensibilityX = 500;
    camera.angularSensibilityY = 500;

    cameraRef.current = camera;

    // ── Lighting ────────────────────────────────────────────────────
    const light = new HemisphericLight('light', new Vector3(0.5, 1, 0.5), scene);
    light.intensity = 0.75;
    light.groundColor = new Color3(0.15, 0.15, 0.18); // Cold reflected light

    // ── Sky ─────────────────────────────────────────────────────────
    // Grey Soviet sky — procedural gradient
    scene.clearColor = new Color4(0.25, 0.28, 0.32, 1);

    // ── Ground plane (invisible, for raycasting) ────────────────────
    const ground = MeshBuilder.CreateGround('ground', { width: 100, height: 100 }, scene);
    ground.isVisible = false;
    ground.isPickable = true; // needed for scene.pick()
  }, []);

  // Callbacks for SimulationEngine → React state
  const simCallbacks: SimCallbacks = {
    onToast: (msg) => setMessages((p) => ({ ...p, toast: msg })),
    onAdvisor: (msg) => setMessages((p) => ({ ...p, advisor: msg })),
    onPravda: (msg) => setMessages((p) => ({ ...p, pravda: msg })),
    onStateChange: () => {
      /* notifyStateChange() called in GameWorld */
    },
  };

  const handleStart = useCallback(() => {
    setGameStarted(true);
    setMessages((p) => ({
      ...p,
      advisor: 'Finally. You are late. Build a Coal Plant first, then Housing. Go.',
    }));
  }, []);

  return (
    <div className="game-root">
      {/* CRT overlay effects */}
      <div className="crt-overlay" />
      <div className="scanlines" />

      {/* Intro modal */}
      {!gameStarted && <IntroModal onStart={handleStart} />}

      {/* Top stats bar */}
      <TopBar />

      {/* Main game viewport */}
      <div className="game-viewport">
        <Engine
          engineOptions={{
            adaptToDeviceRatio: true,
            stencil: true,
            antialias: true,
          }}
          canvasId="gameCanvas"
        >
          <Scene onSceneReady={handleSceneReady}>
            <GameWorld
              callbacks={simCallbacks}
              gameStarted={gameStarted}
            />
          </Scene>
        </Engine>

        {/* DOM overlays on top of canvas */}
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
