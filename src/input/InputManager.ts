import { Scene } from '@babylonjs/core/scene';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { GameState } from '../game/GameState';
import { IsometricRenderer } from '../rendering/IsometricRenderer';
import { BUILDING_TYPES, GRID_SIZE } from '../config';

export class InputManager {
  private hoverGrid: { x: number; y: number } = { x: -1, y: -1 };

  constructor(
    private canvas: HTMLCanvasElement,
    private scene: Scene,
    private gameState: GameState,
    private renderer: IsometricRenderer
  ) {
    this.setupPointerEvents();
  }

  private setupPointerEvents(): void {
    this.scene.onPointerObservable.add((pointerInfo) => {
      switch (pointerInfo.type) {
        case PointerEventTypes.POINTERMOVE:
          this.handlePointerMove(pointerInfo.event as PointerEvent);
          break;
        case PointerEventTypes.POINTERDOWN:
          this.handlePointerDown(pointerInfo.event as PointerEvent);
          break;
      }
    });
  }

  private handlePointerMove(event: PointerEvent): void {
    const pickResult = this.scene.pick(event.clientX, event.clientY);
    if (pickResult?.hit && pickResult.pickedPoint) {
      const gridPos = this.renderer.worldToGrid(pickResult.pickedPoint);
      if (
        gridPos.x >= 0 &&
        gridPos.y >= 0 &&
        gridPos.x < GRID_SIZE &&
        gridPos.y < GRID_SIZE
      ) {
        this.hoverGrid = gridPos;
        this.renderer.showHighlight(gridPos.x, gridPos.y);
      } else {
        this.renderer.hideHighlight();
      }
    } else {
      this.renderer.hideHighlight();
    }
  }

  private handlePointerDown(event: PointerEvent): void {
    // Only handle left click for building
    if (event.button !== 0) return;

    const gridX = this.hoverGrid.x;
    const gridY = this.hoverGrid.y;

    if (gridX < 0 || gridY < 0 || gridX >= GRID_SIZE || gridY >= GRID_SIZE) return;

    const tool = this.gameState.selectedTool;
    const bInfo = BUILDING_TYPES[tool];
    const cell = this.gameState.getCell(gridX, gridY);

    if (!cell || !bInfo) return;

    // Inspect tool
    if (tool === 'none') {
      if (cell.type) {
        const buildingInfo = BUILDING_TYPES[cell.type];
        console.log(`This is a ${buildingInfo.name}. It looks miserable.`);
      } else {
        console.log('Dirt. It belongs to the people.');
      }
      return;
    }

    // Bulldoze tool
    if (tool === 'bulldoze') {
      if (cell.type && this.gameState.money >= bInfo.cost) {
        this.gameState.money -= bInfo.cost;
        this.gameState.setCell(gridX, gridY, null);
        this.gameState.removeBuilding(gridX, gridY);
        this.renderer.removeBuilding(gridX, gridY);
      }
      return;
    }

    // Build
    if (cell.type) {
      console.log('OBSTRUCTION');
      return;
    }

    if (this.gameState.money >= bInfo.cost) {
      this.gameState.money -= bInfo.cost;
      this.gameState.setCell(gridX, gridY, tool);
      if (tool !== 'road') {
        this.gameState.addBuilding(gridX, gridY, tool);
      }
      this.renderer.createBuilding(gridX, gridY, tool);
    } else {
      console.log('Not enough Rubles. Sell more Vodka.');
    }
  }
}
