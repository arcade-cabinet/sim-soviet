export const TILE_WIDTH = 2; // BabylonJS units
export const TILE_HEIGHT = 2;
export const GRID_SIZE = 30;

export const COLORS = {
  grass: '#2e2e2e',
  road: '#444444',
  foundation: '#333333',
  highlight: 'rgba(255, 255, 255, 0.3)',
};

export interface BuildingType {
  name: string;
  cost: number;
  icon: string;
  type?: string;
  desc?: string;
  power?: number;
  pollution?: number;
  cap?: number;
  powerReq?: number;
  job?: number;
  prod?: string;
  amt?: number;
  fear?: number;
}

export const BUILDING_TYPES: Record<string, BuildingType> = {
  none: { name: 'Inspect', cost: 0, icon: '🔍' },
  road: { name: 'Road', cost: 10, icon: '🛣️', type: 'infra', desc: 'Muddy path.' },
  power: {
    name: 'Coal Plant',
    cost: 300,
    icon: '⚡',
    type: 'utility',
    power: 100,
    pollution: 20,
    desc: 'Creates smog & power.',
  },
  housing: {
    name: 'Tenement',
    cost: 100,
    icon: '🏢',
    type: 'res',
    cap: 50,
    powerReq: 5,
    desc: 'Concrete sleeping box.',
  },
  farm: {
    name: 'Kolkhoz',
    cost: 150,
    icon: '🥔',
    type: 'ind',
    job: 10,
    prod: 'food',
    amt: 20,
    powerReq: 2,
    desc: 'Potatoes.',
  },
  distillery: {
    name: 'Vodka Plant',
    cost: 250,
    icon: '🍾',
    type: 'ind',
    job: 10,
    prod: 'vodka',
    amt: 10,
    powerReq: 5,
    pollution: 5,
    desc: 'Essential fluid.',
  },
  gulag: {
    name: 'Gulag',
    cost: 500,
    icon: '⛓️',
    type: 'gov',
    cap: -20,
    fear: 15,
    powerReq: 10,
    desc: 'Fixes attitude problems.',
  },
  bulldoze: { name: 'Purge', cost: 20, icon: '💣', type: 'tool', desc: 'Remove structure.' },
};
