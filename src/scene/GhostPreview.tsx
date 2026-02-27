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
import { handleClick } from '../engine/BuildActions';
import { placeECSBuilding, bulldozeECSBuilding } from '../bridge/BuildingPlacement';
import { getResourceEntity } from '../ecs/archetypes';
import { getBuildingDef } from '../data/buildingDefs';

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
  nuke: 'power-station',
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

const GhostPreview: React.FC = () => {
  const scene = useScene();
  const meshesRef = useRef<GhostMeshes | null>(null);

  useEffect(() => {
    const meshes = createGhostMeshes(scene);
    meshesRef.current = meshes;

    function onPointerMove() {
      const m = meshesRef.current!;
      const tool = gameState.selectedTool;

      // Hide if no tool selected or bulldoze
      if (tool === 'none' || tool === 'bulldoze') {
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
      const gridX = Math.round(worldPos.x);
      const gridZ = Math.round(worldPos.z);

      if (gridX < 0 || gridX >= GRID_SIZE || gridZ < 0 || gridZ >= GRID_SIZE) {
        m.box.isVisible = false;
        m.zoneOverlay.isVisible = false;
        return;
      }

      const valid = canPlace(tool, gridX, gridZ);
      const color = valid ? VALID_COLOR : INVALID_COLOR;

      const cellZ = gameState.grid[gridZ]?.[gridX]?.z ?? 0;

      if (tool.startsWith('zone-')) {
        // Zone overlay
        m.box.isVisible = false;
        m.zoneOverlay.isVisible = true;
        m.zoneOverlay.position = new Vector3(gridX, cellZ + 0.02, gridZ);
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
        m.box.position = new Vector3(gridX, cellZ + height / 2, gridZ);
        m.boxMat.emissiveColor = color;
        m.boxMat.alpha = GHOST_ALPHA;
      }
    }

    // Handle taps (not drags) to place buildings.
    // POINTERTAP only fires if the pointer didn't move much between down and up.
    const tapObs: Observer<PointerInfo> = scene.onPointerObservable.add(
      (info) => {
        if (info.type !== PointerEventTypes.POINTERTAP) return;

        const tool = gameState.selectedTool;
        if (tool === 'none') return;

        const pickResult = info.pickInfo;
        if (!pickResult?.hit || !pickResult.pickedPoint) return;

        const worldPos = pickResult.pickedPoint;
        const gridX = Math.round(worldPos.x);
        const gridZ = Math.round(worldPos.z);

        if (gridX < 0 || gridX >= GRID_SIZE || gridZ < 0 || gridZ >= GRID_SIZE) return;

        // Place building in ECS (source of truth for simulation)
        if (tool === 'bulldoze') {
          bulldozeECSBuilding(gridX, gridZ);
        } else {
          placeECSBuilding(tool, gridX, gridZ);
        }

        // Also update old GameState for legacy grid rendering
        handleClick(gameState, gridX, gridZ, false);
      },
    )!;

    scene.onPointerMove = onPointerMove;
    return () => {
      scene.onPointerMove = undefined as any;
      scene.onPointerObservable.remove(tapObs);
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
