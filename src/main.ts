import { Engine, Scene, FreeCamera, Vector3, HemisphericLight } from '@babylonjs/core';

// Basic BabylonJS setup
const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
const engine = new Engine(canvas, true);
const scene = new Scene(engine);

// Camera
const camera = new FreeCamera('camera1', new Vector3(0, 5, -10), scene);
camera.setTarget(Vector3.Zero());
camera.attachControl(canvas, true);

// Light
new HemisphericLight('light1', new Vector3(0, 1, 0), scene);

// Render loop
engine.runRenderLoop(() => {
  scene.render();
});

// Resize
window.addEventListener('resize', () => {
  engine.resize();
});

console.log('Sim Soviet initialized');
