/**
 * GameView — read-only snapshot interface for event/headline systems.
 *
 * Replaces the old `GameState` parameter in EventSystem and PravdaSystem
 * lambdas. Built fresh per tick from ECS data. Field names match the old
 * GameState so ~90 lambda bodies remain unchanged.
 */
import { getBuildingDef } from '@/data/buildingDefs';
import { buildingsLogic, getMetaEntity, getResourceEntity } from '@/ecs/archetypes';

export interface Building {
  x: number;
  y: number;
  defId: string;
  powered: boolean;
  constructionPhase?: 'foundation' | 'building' | 'complete';
  constructionProgress?: number;
}

export interface GameView {
  readonly money: number;
  readonly pop: number;
  readonly food: number;
  readonly vodka: number;
  readonly power: number;
  readonly powerUsed: number;
  readonly buildings: ReadonlyArray<Building>;
  readonly date: Readonly<{ year: number; month: number; tick: number }>;
  readonly quota: Readonly<{
    type: string;
    target: number;
    current: number;
    deadlineYear: number;
  }>;
  readonly currentEra: string;
}

/**
 * Creates a GameView by reading current ECS state.
 * Cheap to build — just reads two singleton entities + iterates ~30 buildings.
 *
 * FIX-12: Throws if resource or meta entities are missing instead of
 * silently fabricating fake data that hides initialization bugs.
 */
export function createGameView(): GameView {
  const res = getResourceEntity();
  if (!res) {
    throw new Error('[GameView] Resource entity missing — cannot create GameView');
  }
  const meta = getMetaEntity();
  if (!meta) {
    throw new Error('[GameView] Meta entity missing — cannot create GameView');
  }

  const buildings: Building[] = [];
  for (const entity of buildingsLogic) {
    buildings.push({
      x: entity.position.gridX,
      y: entity.position.gridY,
      defId: entity.building.defId,
      powered: entity.building.powered,
    });
  }

  return {
    money: res.resources.money,
    pop: res.resources.population,
    food: res.resources.food,
    vodka: res.resources.vodka,
    power: res.resources.power,
    powerUsed: res.resources.powerUsed,
    buildings,
    date: meta.gameMeta.date,
    quota: meta.gameMeta.quota,
    currentEra: meta.gameMeta.currentEra,
  };
}

/** Re-export getBuildingDef for PravdaSystem lambdas that inspect building defs. */
export { getBuildingDef };
