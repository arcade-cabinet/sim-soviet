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
 */
export function createGameView(): GameView {
  const res = getResourceEntity();
  const meta = getMetaEntity();

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
    money: res?.resources.money ?? 0,
    pop: res?.resources.population ?? 0,
    food: res?.resources.food ?? 0,
    vodka: res?.resources.vodka ?? 0,
    power: res?.resources.power ?? 0,
    powerUsed: res?.resources.powerUsed ?? 0,
    buildings,
    date: meta?.gameMeta.date ?? { year: 1922, month: 10, tick: 0 },
    quota: meta?.gameMeta.quota ?? {
      type: 'food',
      target: 500,
      current: 0,
      deadlineYear: 1927,
    },
    currentEra: meta?.gameMeta.currentEra ?? 'war_communism',
  };
}

/** Re-export getBuildingDef for PravdaSystem lambdas that inspect building defs. */
export { getBuildingDef };
