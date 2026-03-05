/**
 * Off-screen building tick — DB-only state updates.
 *
 * Buildings not visible in the viewport still tick via the same game logic
 * (tickBuilding), but without ECS entities. Only rendering differs.
 */

import {
  tickBuilding,
  type BuildingTickInput,
  type BuildingTickContext,
} from '@/ai/agents/economy/buildingTick';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ResourceType = 'food' | 'vodka' | 'power' | 'money';

export interface OffscreenBuilding extends BuildingTickInput {
  id: string;
  resourceType: ResourceType;
}

export interface OffscreenTickResult {
  id: string;
  resourceType: ResourceType;
  netOutput: number;
}

export interface AggregateResult {
  totalFood: number;
  totalVodka: number;
  totalPower: number;
  totalMoney: number;
}

// ─── Functions ───────────────────────────────────────────────────────────────

/**
 * Filter to buildings not currently visible in the viewport.
 * @param allBuildings - Every building in the settlement
 * @param visibleIds - Set of building IDs currently on-screen
 */
export function getOffscreenBuildings(
  allBuildings: OffscreenBuilding[],
  visibleIds: Set<string>,
): OffscreenBuilding[] {
  const result: OffscreenBuilding[] = [];
  for (const b of allBuildings) {
    if (!visibleIds.has(b.id)) {
      result.push(b);
    }
  }
  return result;
}

/**
 * Run tickBuilding on each off-screen building and tag results with resource type.
 * @param buildings - Off-screen buildings to tick
 * @param ctx - Shared tick context (weather, season, crisis modifier)
 */
export function tickOffscreenBuildings(
  buildings: OffscreenBuilding[],
  ctx: BuildingTickContext,
): OffscreenTickResult[] {
  const results: OffscreenTickResult[] = [];
  for (const b of buildings) {
    const { netOutput } = tickBuilding(b, ctx);
    results.push({ id: b.id, resourceType: b.resourceType, netOutput });
  }
  return results;
}

/**
 * Sum off-screen production by resource category.
 * @param results - Individual building tick results
 */
export function aggregateOffscreenResults(results: OffscreenTickResult[]): AggregateResult {
  let totalFood = 0;
  let totalVodka = 0;
  let totalPower = 0;
  let totalMoney = 0;

  for (const r of results) {
    switch (r.resourceType) {
      case 'food':
        totalFood += r.netOutput;
        break;
      case 'vodka':
        totalVodka += r.netOutput;
        break;
      case 'power':
        totalPower += r.netOutput;
        break;
      case 'money':
        totalMoney += r.netOutput;
        break;
    }
  }

  return { totalFood, totalVodka, totalPower, totalMoney };
}
