/**
 * Gesture State Machine for touch + mouse input.
 *
 * P0 FIX: The old InputManager fired building placement on POINTERDOWN,
 * making it impossible to pan the camera on touch devices (every pan attempt
 * placed a building). This state machine distinguishes:
 *
 *   TAP    → build/bulldoze (pointer down + up within 200ms and 10px)
 *   PAN    → camera orbit (handled by BabylonJS ArcRotateCamera)
 *   PINCH  → camera zoom (handled by BabylonJS ArcRotateCamera)
 *
 * We only call scene.pick() on confirmed TAPs, not on every pointer event.
 * Hover highlighting still works on POINTERMOVE (desktop only).
 */
import type { Scene } from '@babylonjs/core/scene';
import { BUILDING_TYPES, GRID_SIZE } from '../config';
import type { GameState } from '../game/GameState';
import type { IsometricRenderer } from '../rendering/IsometricRenderer';
import { notifyStateChange } from '../stores/gameStore';

type GestureState = 'idle' | 'pending' | 'panning';

const TAP_MAX_DURATION_MS = 250;
const TAP_MAX_DISTANCE_PX = 12;

interface PointerStart {
  x: number;
  y: number;
  time: number;
  pointerId: number;
}

export class GestureManager {
  private state: GestureState = 'idle';
  private pointerStart: PointerStart | null = null;
  private activePointers = new Set<number>();
  constructor(
    private canvas: HTMLCanvasElement,
    private scene: Scene,
    private gameState: GameState,
    private renderer: IsometricRenderer,
  ) {
    this.setupEvents();
  }

  private setupEvents(): void {
    // Use canvas-level events instead of BabylonJS observables
    // so we get canvas-relative coordinates directly (P0 FIX)
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerCancel);
  }

  // ── Event Handlers ────────────────────────────────────────────────────

  private onPointerDown = (e: PointerEvent): void => {
    this.activePointers.add(e.pointerId);

    // Multi-touch → immediately transition to panning (let camera handle it)
    if (this.activePointers.size > 1) {
      this.state = 'panning';
      this.pointerStart = null;
      return;
    }

    // Single pointer → start tracking for tap detection
    this.state = 'pending';
    this.pointerStart = {
      x: e.offsetX,
      y: e.offsetY,
      time: performance.now(),
      pointerId: e.pointerId,
    };
  };

  private onPointerMove = (e: PointerEvent): void => {
    // Check if this move exceeds tap threshold → transition to panning
    if (this.state === 'pending' && this.pointerStart) {
      const dx = e.offsetX - this.pointerStart.x;
      const dy = e.offsetY - this.pointerStart.y;
      if (Math.sqrt(dx * dx + dy * dy) > TAP_MAX_DISTANCE_PX) {
        this.state = 'panning';
        this.pointerStart = null;
        this.renderer.hideHighlight();
      }
    }

    // Desktop hover highlighting (only when idle or pending, not during pan)
    if (e.pointerType === 'mouse' && this.state !== 'panning') {
      this.updateHover(e.offsetX, e.offsetY);
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.activePointers.delete(e.pointerId);

    if (this.state === 'pending' && this.pointerStart) {
      const elapsed = performance.now() - this.pointerStart.time;
      const dx = e.offsetX - this.pointerStart.x;
      const dy = e.offsetY - this.pointerStart.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (elapsed < TAP_MAX_DURATION_MS && distance < TAP_MAX_DISTANCE_PX) {
        // Confirmed TAP → place/inspect/bulldoze
        // P0 FIX: Use offsetX/offsetY (canvas-relative, not clientX/clientY)
        this.handleTap(e.offsetX, e.offsetY);
      }
    }

    if (this.activePointers.size === 0) {
      this.state = 'idle';
      this.pointerStart = null;
    }
  };

  private onPointerCancel = (e: PointerEvent): void => {
    this.activePointers.delete(e.pointerId);
    if (this.activePointers.size === 0) {
      this.state = 'idle';
      this.pointerStart = null;
    }
  };

  // ── Game Actions ──────────────────────────────────────────────────────

  private handleTap(canvasX: number, canvasY: number): void {
    // P0 FIX: scene.pick() needs canvas-relative coordinates
    const pickResult = this.scene.pick(canvasX, canvasY);
    if (!pickResult?.hit || !pickResult.pickedPoint) return;

    const gridPos = this.renderer.worldToGrid(pickResult.pickedPoint);
    const { x: gridX, y: gridY } = gridPos;

    if (gridX < 0 || gridY < 0 || gridX >= GRID_SIZE || gridY >= GRID_SIZE) return;

    const tool = this.gameState.selectedTool;
    const bInfo = BUILDING_TYPES[tool];
    const cell = this.gameState.getCell(gridX, gridY);

    if (!cell || !bInfo) return;

    // Inspect
    if (tool === 'none') {
      // TODO: show info in advisor panel
      return;
    }

    // Bulldoze
    if (tool === 'bulldoze') {
      if (cell.type && this.gameState.money >= bInfo.cost) {
        this.gameState.money -= bInfo.cost;
        this.gameState.setCell(gridX, gridY, null);
        this.gameState.removeBuilding(gridX, gridY);
        this.renderer.removeBuilding(gridX, gridY);
        notifyStateChange();
      }
      return;
    }

    // Build
    if (cell.type) return; // occupied

    if (this.gameState.money >= bInfo.cost) {
      this.gameState.money -= bInfo.cost;
      this.gameState.setCell(gridX, gridY, tool);
      if (tool !== 'road') {
        this.gameState.addBuilding(gridX, gridY, tool);
      }
      this.renderer.createBuilding(gridX, gridY, tool);
      notifyStateChange();
    }
  }

  private updateHover(canvasX: number, canvasY: number): void {
    const pickResult = this.scene.pick(canvasX, canvasY);
    if (pickResult?.hit && pickResult.pickedPoint) {
      const gridPos = this.renderer.worldToGrid(pickResult.pickedPoint);
      if (gridPos.x >= 0 && gridPos.y >= 0 && gridPos.x < GRID_SIZE && gridPos.y < GRID_SIZE) {
        this.renderer.showHighlight(gridPos.x, gridPos.y);
        return;
      }
    }
    this.renderer.hideHighlight();
  }

  public dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel);
  }
}
