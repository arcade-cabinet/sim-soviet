/**
 * GhostPreview -- terrain hover and inspection interaction layer.
 *
 * The legacy filename is retained because the scene still imports this layer,
 * but it no longer renders placement ghosts or places buildings. The player
 * inspects existing settlement features, clears an armed bulldoze action, and
 * lets the collective construction systems decide where new buildings emerge.
 */

import { useFrame, useThree } from '@react-three/fiber';
import type React from 'react';
import { useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { bulldozeECSBuilding } from '../bridge/BuildingPlacement';
import { getEngine } from '../bridge/GameInit';
import { getBuildingDef } from '../data/buildingDefs';
import type { Role } from '../data/buildingDefs.schema';
import { buildingsLogic, citizens, getMetaEntity, getResourceEntity } from '../ecs/archetypes';
import { gameState } from '../engine/GameState';
import { GRID_SIZE } from '../engine/GridTypes';
import { showToast } from '../engine/helpers';
import { getSeason } from '../engine/WeatherSystem';
import {
  closeBuildingPanel,
  type InspectBuildingType,
  type InspectMenuOccupant,
  openBuildingPanel,
  openInspectMenu,
  openPoliticalPanel,
  setCursorTooltip,
} from '../stores/gameStore';

const LONG_PRESS_MS = 500;
const LONG_PRESS_DRIFT = 10;

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
  const engine = getEngine();
  if (engine) {
    const politicalSystem = engine.getPoliticalEntities();
    const entitiesAtCell = politicalSystem
      .getVisibleEntities()
      .filter((pe) => pe.stationedAt.gridX === gridX && pe.stationedAt.gridY === gridZ);
    if (entitiesAtCell.length > 0) {
      const pe = entitiesAtCell[0]!;
      const meta = getMetaEntity()?.gameMeta;
      const seasonLabel = getSeason(gameState.date.month);
      const dialogueSeason =
        seasonLabel === 'WINTER'
          ? ('winter' as const)
          : seasonLabel === 'SUMMER'
            ? ('summer' as const)
            : ('mud' as const);
      const res = getResourceEntity()?.resources;
      const food = res?.food ?? 0;
      const resourceLevel =
        food < 50
          ? ('starving' as const)
          : food < 200
            ? ('scarce' as const)
            : food < 500
              ? ('adequate' as const)
              : ('surplus' as const);
      const dialogue = politicalSystem.getEntityDialogue(gridX, gridZ, {
        season: dialogueSeason,
        resourceLevel,
        era: meta?.currentEra ?? 'revolution',
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

// ── Component ──────────────────────────────────────────────────────────────

const GhostPreview: React.FC = () => {
  const { raycaster, camera, gl } = useThree();

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStart = useRef({ x: 0, y: 0 });
  const longPressFired = useRef(false);
  /** True only after the pointer has entered the canvas — prevents the tooltip
   *  from appearing at the default R3F pointer origin (0,0) before any hover. */
  const pointerOverCanvas = useRef(false);

  const pickGrid = useCallback(
    (clientX: number, clientY: number): { gridX: number; gridZ: number } | null => {
      const canvas = gl.domElement;
      const rect = canvas.getBoundingClientRect();
      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
      const pointer = new THREE.Vector2(ndcX, ndcY);

      raycaster.setFromCamera(pointer, camera);

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

  useEffect(() => {
    const canvas = gl.domElement;

    const activatePointer = () => {
      pointerOverCanvas.current = true;
    };
    const onPointerLeave = () => {
      pointerOverCanvas.current = false;
      setCursorTooltip(null);
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      longPressFired.current = false;
    };
    canvas.addEventListener('pointerenter', activatePointer);
    // One-time move listener covers the edge case where the pointer is already
    // over the canvas on mount and pointerenter never fires.
    canvas.addEventListener('pointermove', activatePointer, { once: true });
    canvas.addEventListener('pointerleave', onPointerLeave);

    const preventContextMenu = (e: Event) => e.preventDefault();
    canvas.addEventListener('contextmenu', preventContextMenu);

    const onContextMenu = (e: MouseEvent) => {
      const pick = pickGrid(e.clientX, e.clientY);
      if (!pick) return;
      const cell = gameState.grid[pick.gridZ]?.[pick.gridX];
      if (!cell?.type) return;
      openInspectAtCell(pick.gridX, pick.gridZ, e.clientX, e.clientY);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 2) onContextMenu(e);
    };
    canvas.addEventListener('mousedown', onMouseDown);

    const onClick = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (longPressFired.current) {
        longPressFired.current = false;
        return;
      }

      const pick = pickGrid(e.clientX, e.clientY);
      if (!pick) return;

      const tool = gameState.selectedTool;
      if (tool === 'bulldoze') {
        bulldozeECSBuilding(pick.gridX, pick.gridZ);
        closeBuildingPanel();
        return;
      }

      if (tool && tool !== 'none') {
        showToast(gameState, 'THE COLLECTIVE DECIDES WHERE TO BUILD, COMRADE');
        return;
      }

      const cell = gameState.grid[pick.gridZ]?.[pick.gridX];
      if (cell?.type) {
        openBuildingPanel(pick.gridX, pick.gridZ);
      } else {
        closeBuildingPanel();
      }
    };
    canvas.addEventListener('click', onClick);

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
      canvas.removeEventListener('pointerenter', activatePointer);
      canvas.removeEventListener('pointermove', activatePointer);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('contextmenu', preventContextMenu);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      setCursorTooltip(null);
    };
  }, [gl, pickGrid]);

  useFrame((state) => {
    if (!pointerOverCanvas.current) {
      return;
    }

    const pointer = state.pointer;
    raycaster.setFromCamera(pointer, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersection = new THREE.Vector3();
    const hit = raycaster.ray.intersectPlane(plane, intersection);

    if (!hit) {
      setCursorTooltip(null);
      return;
    }

    const gridX = Math.floor(intersection.x);
    const gridZ = Math.floor(intersection.z);
    if (gridX < 0 || gridX >= GRID_SIZE || gridZ < 0 || gridZ >= GRID_SIZE) {
      setCursorTooltip(null);
      return;
    }

    const tooltipCell = gameState.grid[gridZ]?.[gridX];
    if (!tooltipCell) {
      setCursorTooltip(null);
      return;
    }

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
  });

  return null;
};

export default GhostPreview;
