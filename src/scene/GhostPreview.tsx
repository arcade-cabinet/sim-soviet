/**
 * GhostPreview — Building placement preview.
 *
 * When a tool is selected (not 'none', not 'bulldoze'): show translucent clone
 * of the building model at hovered grid cell. Green tint (alpha 0.4) if valid,
 * red tint (alpha 0.4) if invalid. Position tracks the grid cell under the pointer.
 * For zone tools: show colored ground overlay instead of building model.
 */
import React, { useEffect, useRef } from 'react';
import {
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  PointerEventTypes,
  type Mesh,
  type Scene,
  type Observer,
  type PointerInfo,
} from '@babylonjs/core';
import { useScene } from 'reactylon';

import { gameState } from '../engine/GameState';
import { GRID_SIZE } from '../engine/GridTypes';
import { BUILDING_TYPES, getBuildingHeight } from '../engine/BuildingTypes';
import { placeECSBuilding, bulldozeECSBuilding } from '../bridge/BuildingPlacement';
import { getResourceEntity, buildingsLogic, citizens } from '../ecs/archetypes';
import { getBuildingDef } from '../data/buildingDefs';
import type { Role } from '../data/buildingDefs.schema';
import { showToast } from '../engine/helpers';
import {
  openInspectMenu,
  type InspectBuildingType,
  type InspectMenuOccupant,
} from '../stores/gameStore';

const VALID_COLOR = new Color3(0, 1, 0);
const INVALID_COLOR = new Color3(1, 0, 0);
const GHOST_ALPHA = 0.4;

interface GhostMeshes {
  box: Mesh;
  zoneOverlay: Mesh;
  boxMat: StandardMaterial;
  zoneMat: StandardMaterial;
}

function createGhostMeshes(scene: Scene): GhostMeshes {
  const boxMat = new StandardMaterial('ghostMat', scene);
  boxMat.emissiveColor = VALID_COLOR;
  boxMat.alpha = GHOST_ALPHA;
  boxMat.disableLighting = true;
  boxMat.backFaceCulling = false;

  const box = MeshBuilder.CreateBox(
    'ghostBox',
    { width: 0.9, height: 1, depth: 0.9 },
    scene,
  );
  box.material = boxMat;
  box.isVisible = false;
  box.isPickable = false;

  const zoneMat = new StandardMaterial('ghostZoneMat', scene);
  zoneMat.emissiveColor = new Color3(0.3, 0.7, 0.3);
  zoneMat.alpha = 0.5;
  zoneMat.disableLighting = true;
  zoneMat.backFaceCulling = false;

  const zoneOverlay = MeshBuilder.CreateGround(
    'ghostZone',
    { width: 1, height: 1 },
    scene,
  );
  zoneOverlay.material = zoneMat;
  zoneOverlay.isVisible = false;
  zoneOverlay.isPickable = false;

  return { box, zoneOverlay, boxMat, zoneMat };
}

/** Quick lookup for zone/tool → defId (mirrors BuildingPlacement.ts) */
const TOOL_DEF_MAP: Record<string, string> = {
  'zone-res': 'workers-house-a',
  'zone-ind': 'factory-office',
  'zone-farm': 'collective-farm-hq',
  power: 'power-station',
  nuke: 'cooling-tower',
  station: 'train-station',
  pump: 'warehouse',
  tower: 'radio-station',
  gulag: 'gulag-admin',
  mast: 'fire-station',
  space: 'government-hq',
};

function canPlace(tool: string, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) return false;
  const grid = gameState.grid;
  if (!grid.length) return false;
  const cell = grid[y]?.[x];
  if (!cell) return false;

  if (cell.type && tool !== 'pipe') return false;
  if (cell.terrain === 'water' && tool !== 'road' && tool !== 'pump') return false;
  if (cell.terrain !== 'water' && tool === 'pump') return false;
  if (cell.terrain === 'tree' || cell.terrain === 'irradiated') return false;
  if (cell.terrain === 'mountain') return false;
  if (cell.terrain === 'marsh' && tool !== 'road' && tool !== 'pipe') return false;
  if (cell.terrain === 'rail' && tool !== 'road' && tool !== 'pipe') return false;
  if (tool === 'tap' && cell.terrain !== 'crater') return false;
  if (tool !== 'tap' && cell.terrain === 'crater') return false;
  if (tool === 'station') {
    const railY = gameState.train.y;
    if (y < railY - 1 || y > railY + 1) return false;
  }

  // Check ECS resources for actual cost (more accurate than old GameState)
  const defId = TOOL_DEF_MAP[tool];
  if (defId) {
    const def = getBuildingDef(defId);
    const cost = def?.presentation.cost ?? BUILDING_TYPES[tool]?.cost ?? 0;
    const res = getResourceEntity();
    if (res && res.resources.money < cost) return false;
  } else {
    const cost = BUILDING_TYPES[tool]?.cost ?? 0;
    if (gameState.money < cost) return false;
  }

  return true;
}

// ── Inspect helpers ───────────────────────────────────────────────────────

/** Map building def role → InspectBuildingType for the radial menu. */
function classifyBuildingType(role: Role, constructionPhase?: string): InspectBuildingType {
  if (constructionPhase && constructionPhase !== 'complete') return 'construction';
  switch (role) {
    case 'housing':
      return 'housing';
    case 'industry':
    case 'agriculture':
    case 'power':
      return 'production';
    case 'government':
    case 'propaganda':
      return 'government';
    case 'military':
      return 'military';
    case 'transport':
    case 'utility':
    case 'environment':
      return 'general';
    case 'services':
    case 'culture':
      return 'general';
    default:
      return 'general';
  }
}

/** Find the ECS building entity at a grid cell and open the inspect menu. */
function openInspectAtCell(gridX: number, gridZ: number, screenX: number, screenY: number): void {
  // Find the ECS building entity at this grid position
  const entity = buildingsLogic.entities.find(
    (e) => e.position.gridX === gridX && e.position.gridY === gridZ,
  );
  if (!entity) return;

  const defId = entity.building.defId;
  const def = getBuildingDef(defId);
  if (!def) return;

  const buildingType = classifyBuildingType(def.role, entity.building.constructionPhase);

  // Count workers assigned to this building's defId at this position
  const workerCount = citizens.entities.filter(
    (c) => c.citizen.assignment === defId,
  ).length;

  // Gather occupants for housing buildings
  let housingCap: number | undefined;
  let occupants: InspectMenuOccupant[] | undefined;
  if (buildingType === 'housing' && entity.building.housingCap > 0) {
    housingCap = entity.building.housingCap;
    occupants = citizens.entities
      .filter(
        (c) =>
          c.citizen.home &&
          c.citizen.home.gridX === gridX &&
          c.citizen.home.gridY === gridZ,
      )
      .map((c) => ({
        name: `Citizen`, // Citizens don't store display names on the component
        age: c.citizen.age ?? 30,
        role: c.citizen.memberRole ?? c.citizen.class,
        gender: c.citizen.gender ?? 'male',
      }));
  }

  openInspectMenu({
    screenX,
    screenY,
    gridX,
    gridY: gridZ,
    buildingDefId: defId,
    buildingType,
    workerCount,
    housingCap,
    occupants,
  });
}

/** Long-press threshold in milliseconds. */
const LONG_PRESS_MS = 500;
/** Max pointer drift (pixels) before long-press is cancelled. */
const LONG_PRESS_DRIFT = 10;

const GhostPreview: React.FC = () => {
  const scene = useScene();
  const meshesRef = useRef<GhostMeshes | null>(null);

  useEffect(() => {
    const meshes = createGhostMeshes(scene);
    meshesRef.current = meshes;

    function onPointerMove() {
      const m = meshesRef.current!;
      const tool = gameState.selectedTool;

      // Hide if no tool selected, bulldoze, or unsupported tool
      if (tool === 'none' || tool === 'bulldoze' || tool === 'road' || tool === 'pipe') {
        m.box.isVisible = false;
        m.zoneOverlay.isVisible = false;
        return;
      }

      // Pick the ground position from pointer
      const pickResult = scene.pick(scene.pointerX, scene.pointerY);
      if (!pickResult?.hit || !pickResult.pickedPoint) {
        m.box.isVisible = false;
        m.zoneOverlay.isVisible = false;
        return;
      }

      const worldPos = pickResult.pickedPoint;
      const gridX = Math.floor(worldPos.x);
      const gridZ = Math.floor(worldPos.z);

      if (gridX < 0 || gridX >= GRID_SIZE || gridZ < 0 || gridZ >= GRID_SIZE) {
        m.box.isVisible = false;
        m.zoneOverlay.isVisible = false;
        return;
      }

      const valid = canPlace(tool, gridX, gridZ);
      const color = valid ? VALID_COLOR : INVALID_COLOR;

      const cellElev = (gameState.grid[gridZ]?.[gridX]?.z ?? 0) * 0.5;

      if (tool.startsWith('zone-')) {
        // Zone overlay
        m.box.isVisible = false;
        m.zoneOverlay.isVisible = true;
        m.zoneOverlay.position = new Vector3(gridX + 0.5, cellElev + 0.02, gridZ + 0.5);
        m.zoneMat.emissiveColor = color;

        // Use zone color for tint
        const bInfo = BUILDING_TYPES[tool];
        if (bInfo) {
          const hex = bInfo.color.replace('#', '');
          const r = parseInt(hex.substring(0, 2), 16) / 255;
          const g = parseInt(hex.substring(2, 4), 16) / 255;
          const b = parseInt(hex.substring(4, 6), 16) / 255;
          m.zoneMat.emissiveColor = new Color3(r, g, b);
          m.zoneMat.alpha = valid ? 0.5 : 0.3;
        }
      } else {
        // Building box ghost
        m.zoneOverlay.isVisible = false;
        m.box.isVisible = true;

        // Scale box to building height
        const height = getBuildingHeight(tool, 0) * 0.02 || 0.5;
        m.box.scaling = new Vector3(1, height, 1);
        m.box.position = new Vector3(gridX + 0.5, cellElev + height / 2, gridZ + 0.5);
        m.boxMat.emissiveColor = color;
        m.boxMat.alpha = GHOST_ALPHA;
      }
    }

    // ── Long-press state (hoisted so tapObs can check longPressFired) ────
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let longPressStartX = 0;
    let longPressStartY = 0;
    let longPressFired = false;

    // Handle taps (not drags) to place buildings.
    // POINTERTAP only fires if the pointer didn't move much between down and up.
    const tapObs: Observer<PointerInfo> = scene.onPointerObservable.add(
      (info) => {
        if (info.type !== PointerEventTypes.POINTERTAP) return;

        // Skip if a long-press just triggered the inspect menu
        if (longPressFired) {
          longPressFired = false;
          return;
        }

        const tool = gameState.selectedTool;
        if (tool === 'none') return;

        const pickResult = info.pickInfo;
        if (!pickResult?.hit || !pickResult.pickedPoint) return;

        const worldPos = pickResult.pickedPoint;
        const gridX = Math.floor(worldPos.x);
        const gridZ = Math.floor(worldPos.z);

        if (gridX < 0 || gridX >= GRID_SIZE || gridZ < 0 || gridZ >= GRID_SIZE) return;

        // Handle building placement/demolition through ECS (sole authority)
        if (tool === 'bulldoze') {
          bulldozeECSBuilding(gridX, gridZ);
        } else if (tool === 'road' || tool === 'pipe') {
          showToast(gameState, 'INFRASTRUCTURE DEVELOPMENT PENDING APPROVAL');
        } else {
          placeECSBuilding(tool, gridX, gridZ);
        }
      },
    )!;

    // ── Right-click → inspect building ────────────────────────────────────
    // Suppress browser context menu on the canvas so right-click fires normally.
    const canvas = scene.getEngine().getRenderingCanvas();
    const preventContextMenu = (e: Event) => e.preventDefault();
    canvas?.addEventListener('contextmenu', preventContextMenu);

    const rightClickObs: Observer<PointerInfo> = scene.onPointerObservable.add(
      (info) => {
        if (info.type !== PointerEventTypes.POINTERDOWN) return;
        const evt = info.event as PointerEvent;
        if (evt.button !== 2) return; // Only right-click

        const pickResult = info.pickInfo;
        if (!pickResult?.hit || !pickResult.pickedPoint) return;

        const worldPos = pickResult.pickedPoint;
        const gridX = Math.floor(worldPos.x);
        const gridZ = Math.floor(worldPos.z);
        if (gridX < 0 || gridX >= GRID_SIZE || gridZ < 0 || gridZ >= GRID_SIZE) return;

        // Only inspect if there's a building on this cell
        const cell = gameState.grid[gridZ]?.[gridX];
        if (!cell?.type) return;

        openInspectAtCell(gridX, gridZ, evt.clientX, evt.clientY);
      },
    )!;

    // ── Long-press → inspect building (mobile fallback) ───────────────────
    const longPressDownObs: Observer<PointerInfo> = scene.onPointerObservable.add(
      (info) => {
        if (info.type !== PointerEventTypes.POINTERDOWN) return;
        const evt = info.event as PointerEvent;
        if (evt.button !== 0) return; // Only primary button for long-press

        longPressFired = false;
        longPressStartX = evt.clientX;
        longPressStartY = evt.clientY;

        // Capture pick info at press-time (before any pointer move)
        const pickResult = info.pickInfo;
        if (!pickResult?.hit || !pickResult.pickedPoint) return;
        const worldPos = pickResult.pickedPoint;
        const gridX = Math.floor(worldPos.x);
        const gridZ = Math.floor(worldPos.z);
        if (gridX < 0 || gridX >= GRID_SIZE || gridZ < 0 || gridZ >= GRID_SIZE) return;
        const cell = gameState.grid[gridZ]?.[gridX];
        if (!cell?.type) return;

        longPressTimer = setTimeout(() => {
          longPressTimer = null;
          longPressFired = true;
          openInspectAtCell(gridX, gridZ, evt.clientX, evt.clientY);
        }, LONG_PRESS_MS);
      },
    )!;

    const longPressMoveObs: Observer<PointerInfo> = scene.onPointerObservable.add(
      (info) => {
        if (info.type !== PointerEventTypes.POINTERMOVE) return;
        if (!longPressTimer) return;
        const evt = info.event as PointerEvent;
        const dx = evt.clientX - longPressStartX;
        const dy = evt.clientY - longPressStartY;
        if (dx * dx + dy * dy > LONG_PRESS_DRIFT * LONG_PRESS_DRIFT) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      },
    )!;

    const longPressUpObs: Observer<PointerInfo> = scene.onPointerObservable.add(
      (info) => {
        if (info.type !== PointerEventTypes.POINTERUP) return;
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      },
    )!;

    scene.onPointerMove = onPointerMove;
    return () => {
      scene.onPointerMove = undefined as any;
      scene.onPointerObservable.remove(tapObs);
      scene.onPointerObservable.remove(rightClickObs);
      scene.onPointerObservable.remove(longPressDownObs);
      scene.onPointerObservable.remove(longPressMoveObs);
      scene.onPointerObservable.remove(longPressUpObs);
      canvas?.removeEventListener('contextmenu', preventContextMenu);
      if (longPressTimer) clearTimeout(longPressTimer);
      const m = meshesRef.current!;
      m.box.dispose();
      m.zoneOverlay.dispose();
      m.boxMat.dispose();
      m.zoneMat.dispose();
    };
  }, [scene]);

  return null;
};

export default GhostPreview;
