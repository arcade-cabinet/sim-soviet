import './style.css';
import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import anime from 'animejs';
import { GameState } from '../src/game/GameState';
import { IsometricRenderer } from '../src/rendering/IsometricRenderer';
import { UIManager } from '../src/ui/UIManager';
import { InputManager } from '../src/input/InputManager';
import { SimulationEngine } from '../src/game/SimulationEngine';

class Game {
  private canvas: HTMLCanvasElement;
  private engine: Engine;
  private scene: Scene;
  private gameState: GameState;
  private renderer: IsometricRenderer;
  private uiManager: UIManager;
  private inputManager: InputManager;
  private simEngine: SimulationEngine;

  constructor() {
    this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    this.engine = new Engine(this.canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });
    this.scene = new Scene(this.engine);

    this.gameState = new GameState();
    this.renderer = new IsometricRenderer(this.scene, this.gameState);
    this.uiManager = new UIManager(this.gameState);
    this.inputManager = new InputManager(this.canvas, this.scene, this.gameState, this.renderer);
    this.simEngine = new SimulationEngine(this.gameState, this.uiManager);

    this.setupScene();
    this.setupEventListeners();
  }

  private setupScene(): void {
    // Camera setup for isometric view
    const camera = new ArcRotateCamera(
      'camera',
      -Math.PI / 4,
      Math.PI / 3,
      50,
      new Vector3(0, 0, 0),
      this.scene
    );
    camera.attachControl(this.canvas, true);
    camera.lowerRadiusLimit = 20;
    camera.upperRadiusLimit = 100;
    camera.wheelPrecision = 50;

    // Lighting
    const light = new HemisphericLight('light', new Vector3(0.5, 1, 0.5), this.scene);
    light.intensity = 0.8;

    // Ground plane reference (invisible)
    const ground = MeshBuilder.CreateGround('ground', { width: 100, height: 100 }, this.scene);
    ground.isVisible = false;
  }

  private setupEventListeners(): void {
    // Start button
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => this.startGame());
    }

    // Dismiss advisor
    const dismissBtn = document.getElementById('dismiss-advisor');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => this.uiManager.hideAdvisor());
    }

    // Window resize
    window.addEventListener('resize', () => {
      this.engine.resize();
      this.renderer.onResize();
    });
  }

  private startGame(): void {
    const introModal = document.getElementById('intro-modal');
    if (introModal) {
      anime({
        targets: introModal,
        opacity: [1, 0],
        duration: 500,
        easing: 'easeInOutQuad',
        complete: () => {
          introModal.style.display = 'none';
        },
      });
    }

    this.uiManager.showAdvisor(
      'Finally. You are late. Build a Coal Plant first, then Housing. Go.'
    );
    this.renderer.initialize();
    this.uiManager.updateUI();
  }

  public run(): void {
    // Render loop
    this.engine.runRenderLoop(() => {
      this.scene.render();
      this.renderer.update();
    });

    // Simulation loop (1 second intervals)
    setInterval(() => {
      this.simEngine.tick();
    }, 1000);
  }

  public dispose(): void {
    this.engine.dispose();
  }
}

// Initialize game on window load
window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  game.run();
});
