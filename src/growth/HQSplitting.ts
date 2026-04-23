/**
 * HQSplitting — milestone-based building spawns as population grows.
 *
 * At certain population thresholds (checked at year boundary), new
 * administrative buildings split off from the Government HQ:
 *   - Pop 50:  Warehouse (grain office) + Guard Post (militia post)
 *   - Pop 150: Hospital + School
 *   - Pop 400: Ministry Office (city soviet upgrade)
 *
 * Each split only fires once. The system finds an empty adjacent tile
 * for each new building and places it via placeNewBuilding().
 */

import { GRID_SIZE } from '../config';
import { getBuildingDef } from '../data/buildingDefs';
import { buildingsLogic } from '../ecs/archetypes';
import { placeNewBuilding } from '../ecs/factories';
import type { SimCallbacks } from '../game/engine/types';

/** Tracks which thresholds have already fired. */
export interface HQSplitState {
  /** Pop 50 milestone fired. */
  split50: boolean;
  /** Pop 150 milestone fired. */
  split150: boolean;
  /** Pop 400 milestone fired. */
  split400: boolean;
}

export function createHQSplitState(): HQSplitState {
  return { split50: false, split150: false, split400: false };
}

interface SplitContext {
  population: number;
  gridSize: number;
  callbacks: SimCallbacks;
}

interface SplitRule {
  key: keyof HQSplitState;
  threshold: number;
  buildings: string[];
  message: string;
}

const SPLIT_RULES: readonly SplitRule[] = [
  {
    key: 'split50',
    threshold: 50,
    buildings: ['warehouse', 'guard-post'],
    message: 'The settlement grows. A grain office and militia post have been established.',
  },
  {
    key: 'split150',
    threshold: 150,
    buildings: ['hospital', 'school'],
    message: 'Moscow mandates proper facilities. A hospital and school are under construction.',
  },
  {
    key: 'split400',
    threshold: 400,
    buildings: ['ministry-office'],
    message: 'The settlement has been upgraded to City Soviet status.',
  },
];

/**
 * Check population thresholds and spawn buildings that split off from HQ.
 * Call this at year boundary from phaseChronology.
 */
export function checkHQSplitting(state: HQSplitState, ctx: SplitContext): void {
  for (const rule of SPLIT_RULES) {
    if (state[rule.key]) continue;
    if (ctx.population < rule.threshold) continue;

    state[rule.key] = true;

    for (const defId of rule.buildings) {
      const def = getBuildingDef(defId);
      if (!def) continue;

      const tile = findEmptyAdjacentTile(ctx.gridSize, def.footprint.tilesX, def.footprint.tilesY);
      if (tile) {
        placeNewBuilding(tile.x, tile.y, defId);
      }
    }

    ctx.callbacks.onToast(rule.message, 'warning');
  }
}

/**
 * Find an empty tile near the Government HQ (or center of grid if no HQ).
 * Spirals outward from the anchor point to find a valid placement.
 */
function findEmptyAdjacentTile(
  gridSize: number,
  footprintX: number,
  footprintY: number,
): { x: number; y: number } | null {
  const size = gridSize || GRID_SIZE;

  // Find the Government HQ position as anchor
  const hq = buildingsLogic.entities.find((e) => e.building.defId === 'government-hq');
  const anchorX = hq ? hq.position.gridX : Math.floor(size / 2);
  const anchorY = hq ? hq.position.gridY : Math.floor(size / 2);

  // Build a set of occupied tiles for quick lookup
  const occupied = new Set<string>();
  for (const e of buildingsLogic.entities) {
    const def = getBuildingDef(e.building.defId);
    const fx = def?.footprint.tilesX ?? 1;
    const fy = def?.footprint.tilesY ?? 1;
    for (let dx = 0; dx < fx; dx++) {
      for (let dy = 0; dy < fy; dy++) {
        occupied.add(`${e.position.gridX + dx},${e.position.gridY + dy}`);
      }
    }
  }

  // Spiral outward from anchor
  for (let r = 1; r <= size; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // only perimeter
        const x = anchorX + dx;
        const y = anchorY + dy;

        // Bounds check for entire footprint
        if (x < 0 || y < 0 || x + footprintX > size || y + footprintY > size) continue;

        // Check all footprint tiles are empty
        let clear = true;
        for (let fx = 0; fx < footprintX && clear; fx++) {
          for (let fy = 0; fy < footprintY && clear; fy++) {
            if (occupied.has(`${x + fx},${y + fy}`)) clear = false;
          }
        }

        if (clear) return { x, y };
      }
    }
  }

  return null;
}
