/**
 * CanvasGestureManager — Touch + mouse input state machine for Canvas 2D.
 *
 * States:
 *   idle → pending → (tap | panning)
 *   idle → pending → dragging_from_toolbar (when drag starts from toolbar)
 *
 * Distinguishes taps from pans using distance + time thresholds.
 * Handles scroll-wheel zoom and pinch-to-zoom.
 *
 * Building placement and removal operates through the ECS world:
 *   - Build: calls createBuilding() from ecs/factories
 *   - Bulldoze: finds and removes the ECS entity from the world
 *   - Stats (cost, footprint) come from buildingDefs, not BUILDING_TYPES
 */

import type { With } from 'miniplex';
import { getBuildingDef } from '@/data/buildingDefs';
import { buildingsLogic, citizens, getMetaEntity, getResourceEntity } from '@/ecs/archetypes';
import { createBuilding } from '@/ecs/factories';
import type { Entity } from '@/ecs/world';
import { world } from '@/ecs/world';
import { getFootprint } from '@/game/BuildingFootprints';
import type { GameGrid } from '@/game/GameGrid';
import type { Canvas2DRenderer } from '@/rendering/Canvas2DRenderer';
import {
  closeRadialMenu,
  getAssignmentMode,
  getDragState,
  type InspectedWorker,
  notifyStateChange,
  openRadialMenu,
  setAssignmentMode,
  setDragState,
  setInspected,
  setInspectedWorker,
  setPlacementCallback,
} from '@/stores/gameStore';

type GestureState = 'idle' | 'pending' | 'panning' | 'dragging_from_toolbar';

const TAP_MAX_DURATION_MS = 250;
const TAP_MAX_DISTANCE_PX = 12;
const ZOOM_WHEEL_FACTOR = 0.001;
const ZOOM_PINCH_FACTOR = 0.01;

interface PointerStart {
  x: number;
  y: number;
  time: number;
  pointerId: number;
}

/** Cost to bulldoze a building. */
const BULLDOZE_COST = 20;

/** Gets the placement cost for a building def ID. */
function getBuildingCost(defId: string): number {
  const def = getBuildingDef(defId);
  return def?.presentation.cost ?? 0;
}

export class CanvasGestureManager {
  private state: GestureState = 'idle';
  private pointerStart: PointerStart | null = null;
  private activePointers = new Map<number, { x: number; y: number }>();
  private lastPinchDist = 0;

  /** Optional audio hook — called after a building is successfully placed. */
  public onBuild: ((type: string) => void) | null = null;
  /** Optional audio hook — called after a building is successfully bulldozed. */
  public onBulldoze: (() => void) | null = null;
  /** Optional hook — called when a building is tapped (for minigame trigger routing). */
  public onBuildingTap: ((defId: string) => void) | null = null;
  /** Optional hook — called when a worker is tapped. */
  public onWorkerTap: ((info: InspectedWorker) => void) | null = null;
  /** Optional hook — called to assign a worker to a building. Returns true on success. */
  public onWorkerAssign:
    | ((workerName: string, buildingGridX: number, buildingGridY: number) => boolean)
    | null = null;
  /** Provider for extended worker stats (set by GameWorld after SimulationEngine init). */
  public workerStatsProvider:
    | ((
        entity: Entity
      ) => { name: string; loyalty: number; skill: number; vodkaDependency: number } | null)
    | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private grid: GameGrid,
    private renderer: Canvas2DRenderer
  ) {
    this.setupEvents();
    setPlacementCallback(this.tryPlaceBuilding);
  }

  /**
   * Public placement API — called by RadialBuildMenu via gameStore.requestPlacement().
   * Returns true if building was successfully placed.
   */
  private tryPlaceBuilding = (gridX: number, gridY: number, defId: string): boolean => {
    const cost = getBuildingCost(defId);
    const fp = getFootprint(defId);
    if (!this.isFootprintClear(gridX, gridY, fp.w, fp.h)) return false;
    const store = getResourceEntity();
    if (!store || store.resources.money < cost) return false;

    this.placeBuilding(gridX, gridY, defId, cost, fp);
    notifyStateChange();
    return true;
  };

  /** Calculate the largest NxN square of clear cells starting at (gridX, gridY). */
  private getAvailableSpace(gridX: number, gridY: number): number {
    for (let size = 3; size >= 1; size--) {
      if (this.isFootprintClear(gridX, gridY, size, size)) return size;
    }
    return 0;
  }

  private setupEvents(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerCancel);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });

    // Global listeners for drag-to-place (drag starts from toolbar, drop on canvas)
    window.addEventListener('pointermove', this.onGlobalPointerMove);
    window.addEventListener('pointerup', this.onGlobalPointerUp);

    // Prevent default touch behaviors (scroll, zoom)
    this.canvas.style.touchAction = 'none';
  }

  // ── Event Handlers ────────────────────────────────────────────────────

  private onPointerDown = (e: PointerEvent): void => {
    this.activePointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });

    // Multi-touch → panning / pinch zoom
    if (this.activePointers.size > 1) {
      this.state = 'panning';
      this.pointerStart = null;
      this.lastPinchDist = this.getPinchDistance();
      return;
    }

    // Single pointer → track for tap detection
    this.state = 'pending';
    this.pointerStart = {
      x: e.offsetX,
      y: e.offsetY,
      time: performance.now(),
      pointerId: e.pointerId,
    };
  };

  private onPointerMove = (e: PointerEvent): void => {
    const prev = this.activePointers.get(e.pointerId);
    this.activePointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });

    // Pinch zoom with two fingers
    if (this.activePointers.size === 2 && this.state === 'panning') {
      const dist = this.getPinchDistance();
      if (this.lastPinchDist > 0) {
        const delta = dist - this.lastPinchDist;
        const center = this.getPinchCenter();
        this.renderer.camera.zoomAt(center.x, center.y, 1 + delta * ZOOM_PINCH_FACTOR);
      }
      this.lastPinchDist = dist;
    }

    // Check for tap→pan transition
    if (this.state === 'pending' && this.pointerStart) {
      const dx = e.offsetX - this.pointerStart.x;
      const dy = e.offsetY - this.pointerStart.y;
      if (Math.sqrt(dx * dx + dy * dy) > TAP_MAX_DISTANCE_PX) {
        this.state = 'panning';
        this.pointerStart = null;
        this.renderer.hoverCell = null;
      }
    }

    // Pan camera
    if (this.state === 'panning' && prev && this.activePointers.size === 1) {
      const dx = e.offsetX - prev.x;
      const dy = e.offsetY - prev.y;
      this.renderer.camera.pan(dx, dy);
    }

    // Desktop hover highlighting
    if (e.pointerType === 'mouse' && (this.state === 'idle' || this.state === 'pending')) {
      const cell = this.renderer.screenToGridCell(e.offsetX, e.offsetY);
      this.renderer.hoverCell = cell;
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
        this.handleTap(e.offsetX, e.offsetY);
      }
    }

    if (this.activePointers.size === 0) {
      this.state = 'idle';
      this.pointerStart = null;
      this.lastPinchDist = 0;
    }
  };

  private onPointerCancel = (e: PointerEvent): void => {
    this.activePointers.delete(e.pointerId);
    if (this.activePointers.size === 0) {
      this.state = 'idle';
      this.pointerStart = null;
      this.lastPinchDist = 0;
    }
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const factor = 1 - e.deltaY * ZOOM_WHEEL_FACTOR;
    this.renderer.camera.zoomAt(e.offsetX, e.offsetY, factor);
  };

  // ── Game Actions ──────────────────────────────────────────────────────

  private handleTap(screenX: number, screenY: number): void {
    // Close radial menu on any tap (it re-opens if needed in handleInspect)
    closeRadialMenu();

    const cell = this.renderer.screenToGridCell(screenX, screenY);
    if (!cell) return;

    const { x: gridX, y: gridY } = cell;

    // ── Assignment mode: tapping a building completes worker assignment ──
    const assignMode = getAssignmentMode();
    if (assignMode) {
      const gridCell = this.grid.getCell(gridX, gridY);
      if (gridCell?.type) {
        // Tap on a building → assign the worker
        const success = this.onWorkerAssign?.(assignMode.workerName, gridX, gridY) ?? false;
        if (success) {
          setAssignmentMode(null);
          notifyStateChange();
        }
      } else {
        // Tap on empty ground → cancel assignment mode
        setAssignmentMode(null);
      }
      return;
    }

    const tool = getMetaEntity()?.gameMeta.selectedTool ?? 'none';
    const gridCell = this.grid.getCell(gridX, gridY);
    if (!gridCell) return;

    if (tool === 'none') {
      this.handleInspect(gridX, gridY, gridCell, screenX, screenY);
      return;
    }

    if (tool === 'bulldoze') {
      this.handleBulldozeTap(gridX, gridY, gridCell);
      return;
    }

    this.handleBuildTap(gridX, gridY, tool);
  }

  /** Inspect -- show building info panel on tap, or open radial menu on empty cell. */
  private handleInspect(
    gridX: number,
    gridY: number,
    gridCell: { type: string | null },
    screenX: number,
    screenY: number
  ): void {
    if (!gridCell.type) {
      // Empty cell: check for citizens at this position first
      const workerInfo = this.findCitizenAtCell(gridX, gridY);
      if (workerInfo) {
        setInspectedWorker(workerInfo);
        this.onWorkerTap?.(workerInfo);
        return;
      }
      // No citizen → open radial build menu at tap position
      setInspected(null);
      setInspectedWorker(null);
      const space = this.getAvailableSpace(gridX, gridY);
      if (space > 0) {
        // Convert canvas-relative coords to viewport coords for the overlay
        const rect = this.canvas.getBoundingClientRect();
        openRadialMenu({
          screenX: rect.left + screenX,
          screenY: rect.top + screenY,
          gridX,
          gridY,
          availableSpace: space,
        });
      }
      return;
    }
    const defId = gridCell.type;
    // Notify minigame system about building tap
    this.onBuildingTap?.(defId);
    const def = getBuildingDef(defId);
    const fp = getFootprint(defId);
    const powered = this.findBuildingPowered(gridX, gridY);
    setInspected({
      gridX,
      gridY,
      defId,
      powered,
      cost: def?.presentation.cost ?? 0,
      footprintW: fp.w,
      footprintH: fp.h,
      name: def?.presentation.name ?? defId,
      desc: def?.presentation.desc ?? '',
    });

    // Also check for citizens assigned to this building
    const workerInfo = this.findCitizenForBuilding(defId);
    if (workerInfo) {
      setInspectedWorker(workerInfo);
      this.onWorkerTap?.(workerInfo);
    }
  }

  /** Find a citizen entity positioned at the given grid cell. */
  private findCitizenAtCell(gridX: number, gridY: number): InspectedWorker | null {
    for (const entity of citizens) {
      if (entity.position.gridX === gridX && entity.position.gridY === gridY) {
        return this.buildWorkerInfo(entity);
      }
    }
    return null;
  }

  /** Find a citizen entity assigned to a building with the given defId. */
  private findCitizenForBuilding(defId: string): InspectedWorker | null {
    for (const entity of citizens) {
      if (entity.citizen.assignment === defId) {
        return this.buildWorkerInfo(entity);
      }
    }
    return null;
  }

  /** Build an InspectedWorker from a citizen entity. */
  private buildWorkerInfo(entity: Entity): InspectedWorker | null {
    if (!entity.citizen) return null;
    const extStats = this.workerStatsProvider?.(entity);
    return {
      name: extStats?.name ?? 'Unknown Worker',
      class: entity.citizen.class,
      morale: entity.citizen.happiness,
      loyalty: extStats?.loyalty ?? 50,
      skill: extStats?.skill ?? 25,
      vodkaDependency: extStats?.vodkaDependency ?? 0,
      assignedBuildingDefId: entity.citizen.assignment ?? null,
    };
  }

  /** Find whether the building entity covering (gridX, gridY) is powered. */
  private findBuildingPowered(gridX: number, gridY: number): boolean {
    for (const entity of buildingsLogic) {
      const bx = entity.position.gridX;
      const by = entity.position.gridY;
      const fpX = entity.renderable?.footprintX ?? 1;
      const fpY = entity.renderable?.footprintY ?? 1;
      if (gridX >= bx && gridX < bx + fpX && gridY >= by && gridY < by + fpY) {
        return entity.building.powered;
      }
    }
    return false;
  }

  /** Handle bulldoze tool tap. */
  private handleBulldozeTap(gridX: number, gridY: number, gridCell: { type: string | null }): void {
    if (gridCell.type && (getResourceEntity()?.resources.money ?? 0) >= BULLDOZE_COST) {
      this.bulldozeAt(gridX, gridY);
      notifyStateChange();
    }
  }

  /** Handle build tool tap -- check affordability and clear footprint. */
  private handleBuildTap(gridX: number, gridY: number, tool: string): void {
    const cost = getBuildingCost(tool);
    const fp = getFootprint(tool);
    const clear = this.isFootprintClear(gridX, gridY, fp.w, fp.h);
    if (!clear) return;

    if ((getResourceEntity()?.resources.money ?? 0) >= cost) {
      this.placeBuilding(gridX, gridY, tool, cost, fp);
      notifyStateChange();
    }
  }

  /** Check whether ALL footprint cells are clear. */
  private isFootprintClear(gridX: number, gridY: number, w: number, h: number): boolean {
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        const c = this.grid.getCell(gridX + dx, gridY + dy);
        if (!c || c.type != null) return false;
      }
    }
    return true;
  }

  /**
   * Places a building via ECS and syncs to grid.
   */
  private placeBuilding(
    gridX: number,
    gridY: number,
    tool: string,
    cost: number,
    fp: { w: number; h: number }
  ): void {
    // Deduct cost from ECS resource store
    const store = getResourceEntity();
    if (store) {
      store.resources.money -= cost;
    }

    // Mark ALL footprint cells as occupied
    for (let dx = 0; dx < fp.w; dx++) {
      for (let dy = 0; dy < fp.h; dy++) {
        this.grid.setCell(gridX + dx, gridY + dy, tool);
      }
    }

    // Create ECS entity
    createBuilding(gridX, gridY, tool);

    this.onBuild?.(tool);
  }

  /**
   * Bulldozes a building at the given grid position.
   * Finds the ECS entity, clears all footprint cells, removes entity.
   */
  private bulldozeAt(gridX: number, gridY: number): void {
    // Deduct bulldoze cost
    const store = getResourceEntity();
    if (store) {
      store.resources.money -= BULLDOZE_COST;
    }

    const found = this.findBuildingEntityAt(gridX, gridY);
    this.removeBuildingFromGrid(found, gridX, gridY);

    this.onBulldoze?.();
  }

  /** Find the ECS entity whose footprint covers (gridX, gridY). */
  private findBuildingEntityAt(
    gridX: number,
    gridY: number
  ): { entity: With<Entity, 'position' | 'building'>; originX: number; originY: number } | null {
    for (const entity of buildingsLogic) {
      const bx = entity.position.gridX;
      const by = entity.position.gridY;
      const fpX = entity.renderable?.footprintX ?? 1;
      const fpY = entity.renderable?.footprintY ?? 1;
      if (gridX >= bx && gridX < bx + fpX && gridY >= by && gridY < by + fpY) {
        return { entity, originX: bx, originY: by };
      }
    }
    return null;
  }

  /** Clear grid cells and remove ECS entity for a bulldozed building. */
  private removeBuildingFromGrid(
    found: {
      entity: With<Entity, 'position' | 'building'>;
      originX: number;
      originY: number;
    } | null,
    gridX: number,
    gridY: number
  ): void {
    if (found) {
      const fpX = found.entity.renderable?.footprintX ?? 1;
      const fpY = found.entity.renderable?.footprintY ?? 1;
      for (let dx = 0; dx < fpX; dx++) {
        for (let dy = 0; dy < fpY; dy++) {
          this.grid.setCell(found.originX + dx, found.originY + dy, null);
        }
      }
      world.remove(found.entity);
    } else {
      this.grid.setCell(gridX, gridY, null);
    }
  }

  // ── Drag-to-place (global listeners) ───────────────────────────────────

  private onGlobalPointerMove = (e: PointerEvent): void => {
    const drag = getDragState();
    if (!drag) return;

    // Update drag position
    setDragState({ ...drag, screenX: e.clientX, screenY: e.clientY });

    // Update placement preview on the canvas
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const cell = this.renderer.screenToGridCell(canvasX, canvasY);

    if (cell) {
      const fp = getFootprint(drag.buildingType);
      this.renderer.placementPreview = {
        gridX: cell.x,
        gridY: cell.y,
        spriteName: drag.buildingType,
        valid: this.isFootprintClear(cell.x, cell.y, fp.w, fp.h),
        footprintW: fp.w,
        footprintH: fp.h,
      };
    } else {
      this.renderer.placementPreview = null;
    }
  };

  private onGlobalPointerUp = (_e: PointerEvent): void => {
    const drag = getDragState();
    if (!drag) return;

    // Try to place building at the preview location
    const preview = this.renderer.placementPreview;
    if (preview?.valid) {
      const cost = getBuildingCost(drag.buildingType);
      const fp = getFootprint(drag.buildingType);
      if ((getResourceEntity()?.resources.money ?? 0) >= cost) {
        this.placeBuilding(preview.gridX, preview.gridY, drag.buildingType, cost, fp);
        notifyStateChange();
        // Note: onBuild is already called inside placeBuilding
      }
    }

    // Clear drag state
    setDragState(null);
    this.renderer.placementPreview = null;
  };

  // ── Pinch helpers ─────────────────────────────────────────────────────

  private getPinchDistance(): number {
    const pts = [...this.activePointers.values()];
    if (pts.length < 2) return 0;
    const dx = pts[0]!.x - pts[1]!.x;
    const dy = pts[0]!.y - pts[1]!.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private getPinchCenter(): { x: number; y: number } {
    const pts = [...this.activePointers.values()];
    if (pts.length < 2) return { x: 0, y: 0 };
    return {
      x: (pts[0]!.x + pts[1]!.x) / 2,
      y: (pts[0]!.y + pts[1]!.y) / 2,
    };
  }

  public dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel);
    this.canvas.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('pointermove', this.onGlobalPointerMove);
    window.removeEventListener('pointerup', this.onGlobalPointerUp);
    setPlacementCallback(null);
  }
}
