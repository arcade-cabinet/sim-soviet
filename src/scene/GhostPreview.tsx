/**
 * GhostPreview -- Building placement preview + pointer interaction.
 *
 * When a tool is selected (not 'none', not 'bulldoze'): show translucent box
 * at hovered grid cell. Green if placement valid, red if invalid.
 * Handles tap-to-place, right-click inspect, and long-press inspect.
 *
 * R3F migration: uses <mesh> with transparent material + useFrame for
 * position tracking. Pointer events handled via canvas event listeners
 * attached in useEffect (R3F's raycasting is used for grid picking).
 */

import { useFrame, useThree } from '@react-three/fiber';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { bulldozeECSBuilding, placeECSBuilding } from '../bridge/BuildingPlacement';
import { getEngine } from '../bridge/GameInit';
import { getBuildingDef } from '../data/buildingDefs';
import type { Role } from '../data/buildingDefs.schema';
import { buildingsLogic, citizens, getMetaEntity, getResourceEntity } from '../ecs/archetypes';
import { BUILDING_TYPES, getBuildingHeight } from '../engine/BuildingTypes';
import { gameState } from '../engine/GameState';
import { GRID_SIZE } from '../engine/GridTypes';
import { showToast } from '../engine/helpers';
import { getSeason } from '../engine/WeatherSystem';
import {
  type InspectBuildingType,
  type InspectMenuOccupant,
  openInspectMenu,
  openPoliticalPanel,
  setCursorTooltip,
} from '../stores/gameStore';

const VALID_COLOR = new THREE.Color(0, 1, 0);
const INVALID_COLOR = new THREE.Color(1, 0, 0);
const GHOST_ALPHA = 0.4;

/** Quick lookup for zone/tool -> defId (mirrors BuildingPlacement.ts) */
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

  // Check ECS resources for actual cost
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

// ── Inspect helpers ────────────────────────────────────────────────────────

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

function openInspectAtCell(gridX: number, gridZ: number, screenX: number, screenY: number): void {
  // Check for political entities at this cell — show dialogue toast + open panel
  const engine = getEngine();
  if (engine) {
    const politicalSystem = engine.getPoliticalEntities();
    const entitiesAtCell = politicalSystem.getVisibleEntities().filter(
      (pe) => pe.stationedAt.gridX === gridX && pe.stationedAt.gridY === gridZ,
    );
    if (entitiesAtCell.length > 0) {
      const pe = entitiesAtCell[0]!;
      // Build dialogue context from live game state
      const meta = getMetaEntity()?.gameMeta;
      const seasonLabel = getSeason(gameState.date.month);
      const dialogueSeason = seasonLabel === 'WINTER' ? 'winter' as const : seasonLabel === 'SUMMER' ? 'summer' as const : 'mud' as const;
      const res = getResourceEntity()?.resources;
      const food = res?.food ?? 0;
      const resourceLevel = food < 50 ? 'starving' as const : food < 200 ? 'scarce' as const : food < 500 ? 'adequate' as const : 'surplus' as const;
      const dialogue = politicalSystem.getEntityDialogue(gridX, gridZ, {
        season: dialogueSeason,
        resourceLevel,
        era: meta?.currentEra ?? 'war_communism',
        threatLevel: (meta?.threatLevel as 'safe' | 'watched' | 'endangered' | 'critical') ?? 'safe',
        settlementTier: (meta?.settlementTier as 'selo' | 'posyolok' | 'pgt' | 'gorod') ?? 'selo',
      });
      if (dialogue) {
        showToast(gameState, `${pe.name}: "${dialogue}"`);
      }
      openPoliticalPanel();
      return;
    }
  }

  const entity = buildingsLogic.entities.find((e) => e.position.gridX === gridX && e.position.gridY === gridZ);
  if (!entity) return;

  const defId = entity.building.defId;
  const def = getBuildingDef(defId);
  if (!def) return;

  const buildingType = classifyBuildingType(def.role, entity.building.constructionPhase);

  const workerCount = citizens.entities.filter((c) => c.citizen.assignment === defId).length;

  let housingCap: number | undefined;
  let occupants: InspectMenuOccupant[] | undefined;
  if (buildingType === 'housing' && entity.building.housingCap > 0) {
    housingCap = entity.building.housingCap;
    occupants = citizens.entities
      .filter((c) => c.citizen.home && c.citizen.home.gridX === gridX && c.citizen.home.gridY === gridZ)
      .map((c) => ({
        name: 'Citizen',
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

const LONG_PRESS_MS = 500;
const LONG_PRESS_DRIFT = 10;

// ── Component ──────────────────────────────────────────────────────────────

const GhostPreview: React.FC = () => {
  const boxRef = useRef<THREE.Mesh>(null);
  const zonePlaneRef = useRef<THREE.Mesh>(null);
  const boxMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const zoneMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const { raycaster, camera, gl } = useThree();

  // Long-press state
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStart = useRef({ x: 0, y: 0 });
  const longPressFired = useRef(false);

  // Materials (memoized to avoid re-creation)
  const _boxMaterial = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({
      color: VALID_COLOR,
      transparent: true,
      opacity: GHOST_ALPHA,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    return mat;
  }, []);

  const _zoneMaterial = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.3, 0.7, 0.3),
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    return mat;
  }, []);

  // Pick grid position from pointer using R3F raycaster against ground plane
  const pickGrid = useCallback(
    (clientX: number, clientY: number): { gridX: number; gridZ: number } | null => {
      const canvas = gl.domElement;
      const rect = canvas.getBoundingClientRect();
      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
      const pointer = new THREE.Vector2(ndcX, ndcY);

      raycaster.setFromCamera(pointer, camera);

      // Intersect with y=0 ground plane
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const intersection = new THREE.Vector3();
      const hit = raycaster.ray.intersectPlane(plane, intersection);
      if (!hit) return null;

      const gridX = Math.floor(intersection.x);
      const gridZ = Math.floor(intersection.z);
      if (gridX < 0 || gridX >= GRID_SIZE || gridZ < 0 || gridZ >= GRID_SIZE) return null;

      return { gridX, gridZ };
    },
    [raycaster, camera, gl],
  );

  // Canvas event handlers for tap, right-click, and long-press
  useEffect(() => {
    const canvas = gl.domElement;

    // Suppress browser context menu
    const preventContextMenu = (e: Event) => e.preventDefault();
    canvas.addEventListener('contextmenu', preventContextMenu);

    // Right-click inspect
    const onContextMenu = (e: MouseEvent) => {
      const pick = pickGrid(e.clientX, e.clientY);
      if (!pick) return;
      const cell = gameState.grid[pick.gridZ]?.[pick.gridX];
      if (!cell?.type) return;
      openInspectAtCell(pick.gridX, pick.gridZ, e.clientX, e.clientY);
    };
    canvas.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button === 2) onContextMenu(e);
    });

    // Tap to place
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (longPressFired.current) {
        longPressFired.current = false;
        return;
      }

      const tool = gameState.selectedTool;
      if (tool === 'none') return;

      const pick = pickGrid(e.clientX, e.clientY);
      if (!pick) return;

      if (tool === 'bulldoze') {
        bulldozeECSBuilding(pick.gridX, pick.gridZ);
      } else if (tool === 'road' || tool === 'pipe') {
        showToast(gameState, 'INFRASTRUCTURE DEVELOPMENT PENDING APPROVAL');
      } else {
        placeECSBuilding(tool, pick.gridX, pick.gridZ);
      }
    };
    canvas.addEventListener('click', onClick);

    // Long-press (mobile fallback for inspect)
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      longPressFired.current = false;
      longPressStart.current = { x: e.clientX, y: e.clientY };

      const pick = pickGrid(e.clientX, e.clientY);
      if (!pick) return;
      const cell = gameState.grid[pick.gridZ]?.[pick.gridX];
      if (!cell?.type) return;

      const gx = pick.gridX;
      const gz = pick.gridZ;
      const cx = e.clientX;
      const cy = e.clientY;

      longPressTimer.current = setTimeout(() => {
        longPressTimer.current = null;
        longPressFired.current = true;
        openInspectAtCell(gx, gz, cx, cy);
      }, LONG_PRESS_MS);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!longPressTimer.current) return;
      const dx = e.clientX - longPressStart.current.x;
      const dy = e.clientY - longPressStart.current.y;
      if (dx * dx + dy * dy > LONG_PRESS_DRIFT * LONG_PRESS_DRIFT) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    };

    const onPointerUp = () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);

    return () => {
      canvas.removeEventListener('contextmenu', preventContextMenu);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      setCursorTooltip(null);
    };
  }, [gl, pickGrid]);

  // Per-frame ghost position update
  useFrame((state) => {
    const box = boxRef.current;
    const zonePlane = zonePlaneRef.current;
    if (!box || !zonePlane) return;

    const tool = gameState.selectedTool;

    // Use pointer from R3F state to pick ground
    const pointer = state.pointer;
    raycaster.setFromCamera(pointer, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersection = new THREE.Vector3();
    const hit = raycaster.ray.intersectPlane(plane, intersection);

    if (!hit) {
      box.visible = false;
      zonePlane.visible = false;
      setCursorTooltip(null);
      return;
    }

    const gridX = Math.floor(intersection.x);
    const gridZ = Math.floor(intersection.z);

    if (gridX < 0 || gridX >= GRID_SIZE || gridZ < 0 || gridZ >= GRID_SIZE) {
      box.visible = false;
      zonePlane.visible = false;
      setCursorTooltip(null);
      return;
    }

    // Publish hovered tile data for CursorTooltip
    const tooltipCell = gameState.grid[gridZ]?.[gridX];
    if (tooltipCell) {
      const rect = gl.domElement.getBoundingClientRect();
      const screenX = ((pointer.x + 1) / 2) * rect.width + rect.left;
      const screenY = ((-pointer.y + 1) / 2) * rect.height + rect.top;
      setCursorTooltip({
        terrain: tooltipCell.terrain,
        type: tooltipCell.type || undefined,
        smog: tooltipCell.smog ?? 0,
        watered: tooltipCell.watered ?? false,
        onFire: !!tooltipCell.onFire,
        zone: tooltipCell.zone || undefined,
        z: tooltipCell.z ?? 0,
        screenX,
        screenY,
      });
    } else {
      setCursorTooltip(null);
    }

    // Hide ghost if no tool selected or unsupported tool
    if (tool === 'none' || tool === 'bulldoze' || tool === 'road' || tool === 'pipe') {
      box.visible = false;
      zonePlane.visible = false;
      return;
    }

    const valid = canPlace(tool, gridX, gridZ);
    const color = valid ? VALID_COLOR : INVALID_COLOR;
    const cellElev = (gameState.grid[gridZ]?.[gridX]?.z ?? 0) * 0.5;

    if (tool.startsWith('zone-')) {
      // Zone overlay
      box.visible = false;
      zonePlane.visible = true;
      zonePlane.position.set(gridX + 0.5, cellElev + 0.02, gridZ + 0.5);

      const bInfo = BUILDING_TYPES[tool];
      if (bInfo && zoneMatRef.current) {
        const hex = bInfo.color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16) / 255;
        const g = parseInt(hex.substring(2, 4), 16) / 255;
        const b = parseInt(hex.substring(4, 6), 16) / 255;
        zoneMatRef.current.color.setRGB(r, g, b);
        zoneMatRef.current.opacity = valid ? 0.5 : 0.3;
      }
    } else {
      // Building box ghost
      zonePlane.visible = false;
      box.visible = true;

      const height = getBuildingHeight(tool, 0) * 0.02 || 0.5;
      box.scale.set(1, height, 1);
      box.position.set(gridX + 0.5, cellElev + height / 2, gridZ + 0.5);

      if (boxMatRef.current) {
        boxMatRef.current.color.copy(color);
        boxMatRef.current.opacity = GHOST_ALPHA;
      }
    }
  });

  return (
    <>
      {/* Building ghost box */}
      <mesh ref={boxRef} visible={false}>
        <boxGeometry args={[0.9, 1, 0.9]} />
        <meshBasicMaterial
          ref={boxMatRef}
          color={VALID_COLOR}
          transparent
          opacity={GHOST_ALPHA}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Zone overlay plane */}
      <mesh ref={zonePlaneRef} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          ref={zoneMatRef}
          color={new THREE.Color(0.3, 0.7, 0.3)}
          transparent
          opacity={0.5}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );
};

export default GhostPreview;
