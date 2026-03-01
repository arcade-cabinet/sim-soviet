/**
 * Building type definitions, grown building levels, ticker messages, and height lookup.
 * Faithful port of poc.html lines 315-371.
 */

/** Static definition for a placeable building type (toolbar entry). */
export interface BuildingTypeInfo {
  /** Display name */
  name: string;
  /** Toolbar category (zone, infra, state, purge) */
  category: string;
  /** Ruble cost to place */
  cost: number;
  /** Emoji icon for toolbar button */
  icon: string;
  /** Render color (legacy 2D canvas) */
  color: string;
  /** Functional type (zone, infra, utility, gov, tool) */
  type: string;
  /** Short description for tooltip */
  desc?: string;
  /** Power units generated (power plants only) */
  power?: number;
  /** Water units generated (pumps only) */
  water?: number;
  /** Pollution output per tick */
  pollution?: number;
  /** Power units required to operate */
  powerReq?: number;
  /** Population capacity (negative for gulags) */
  cap?: number;
  /** Whether this building is hidden until unlocked */
  hidden?: boolean;
}

/** Stats for one upgrade level of a zone-grown building (housing, factory, distillery, farm). */
export interface GrownLevel {
  /** Display name for this level */
  name: string;
  /** Render color (legacy 2D canvas) */
  color: string;
  /** Visual height in pixels (legacy 2D canvas) */
  h: number;
  /** Population capacity (housing only) */
  cap?: number;
  /** Power units required to operate */
  powerReq: number;
  /** Water units required to operate */
  waterReq: number;
  /** Resource type produced ('food', 'vodka', 'money') */
  prod?: string;
  /** Amount produced per month */
  amt?: number;
  /** Pollution output per tick */
  pollution?: number;
}

/**
 * Registry of all placeable building types keyed by tool ID.
 * Includes zones, infrastructure, state buildings, and the bulldoze tool.
 */
export const BUILDING_TYPES: Record<string, BuildingTypeInfo> = {
  none: { name: 'Inspect', category: 'all', cost: 0, icon: '🔍', color: '#000', type: 'tool' },
  'zone-res': {
    name: 'Housing',
    category: 'zone',
    cost: 80,
    icon: '🏠',
    type: 'zone',
    desc: 'Worker housing (workers-house-a).',
    color: '#4caf50',
  },
  'zone-ind': {
    name: 'Factory',
    category: 'zone',
    cost: 180,
    icon: '🏭',
    type: 'zone',
    desc: 'Factory office. Produces money.',
    color: '#ffeb3b',
  },
  'zone-farm': {
    name: 'Kolkhoz',
    category: 'zone',
    cost: 150,
    icon: '🌾',
    type: 'zone',
    desc: 'Collective farm. Produces food.',
    color: '#795548',
  },
  road: {
    name: 'Road',
    category: 'infra',
    cost: 10,
    icon: '🛣️',
    type: 'infra',
    desc: 'Transportation.',
    color: '#778899',
  },
  pipe: {
    name: 'Water Pipe',
    category: 'infra',
    cost: 5,
    icon: '🟦',
    type: 'infra',
    desc: 'Distributes Water (Underground).',
    color: '#00b0ff',
  },
  pump: {
    name: 'Water Pump',
    category: 'infra',
    cost: 100,
    icon: '🚰',
    type: 'utility',
    water: 50,
    desc: 'Must be built on river.',
    color: '#00b0ff',
  },
  power: {
    name: 'Coal Plant',
    category: 'infra',
    cost: 300,
    icon: '⚡',
    type: 'utility',
    power: 100,
    pollution: 35,
    desc: 'Heavy Smog.',
    color: '#3e2723',
  },
  station: {
    name: 'Station',
    category: 'infra',
    cost: 300,
    icon: '🚉',
    type: 'infra',
    powerReq: 10,
    desc: 'Collects Train Drops.',
    color: '#5d4037',
  },
  nuke: {
    name: 'Reactor',
    category: 'infra',
    cost: 1000,
    icon: '☢️',
    type: 'utility',
    power: 500,
    pollution: 0,
    desc: 'DO NOT LET BURN.',
    color: '#455a64',
  },
  tap: {
    name: 'Cosmic Tap',
    category: 'infra',
    cost: 500,
    icon: '☄️',
    type: 'utility',
    power: 1000,
    pollution: 0,
    desc: 'Requires Crater.',
    color: '#4a148c',
    hidden: true,
  },
  tower: {
    name: 'Propaganda',
    category: 'state',
    cost: 400,
    icon: '📡',
    type: 'gov',
    powerReq: 20,
    desc: '2x Prod in 5 tiles.',
    color: '#333',
  },
  gulag: {
    name: 'Gulag',
    category: 'state',
    cost: 500,
    icon: '⛓️',
    type: 'gov',
    cap: -20,
    powerReq: 10,
    desc: 'Stops riots (7 tiles).',
    color: '#111',
  },
  mast: {
    name: 'Aero-Mast',
    category: 'state',
    cost: 800,
    icon: '🎈',
    type: 'gov',
    powerReq: 50,
    desc: 'Fire-Fighting Zeppelin.',
    color: '#222',
  },
  space: {
    name: 'Cosmodrome',
    category: 'state',
    cost: 2000,
    icon: '🚀',
    type: 'gov',
    powerReq: 200,
    desc: 'Win Space Race.',
    color: '#444',
  },
  bulldoze: {
    name: 'Purge',
    category: 'purge',
    cost: 20,
    icon: '💣',
    type: 'tool',
    desc: 'Demolish structures.',
    color: '#d32f2f',
  },
};

/**
 * Upgrade level definitions for zone-grown buildings.
 * Each building type has an array of 3 levels (0, 1, 2) with escalating stats.
 */
export const GROWN_TYPES: Record<string, GrownLevel[]> = {
  housing: [
    { name: 'Worker Shacks', cap: 15, powerReq: 0, waterReq: 2, color: '#5d4037', h: 15 },
    { name: 'Tenement Block', cap: 50, powerReq: 5, waterReq: 5, color: '#607d8b', h: 40 },
    { name: 'Khrushchyovka', cap: 150, powerReq: 15, waterReq: 10, color: '#37474f', h: 80 },
  ],
  factory: [
    {
      name: 'Light Workshop',
      prod: 'money',
      amt: 10,
      powerReq: 2,
      waterReq: 2,
      pollution: 10,
      color: '#795548',
      h: 20,
    },
    { name: 'Steel Mill', prod: 'money', amt: 30, powerReq: 10, waterReq: 10, pollution: 25, color: '#4e342e', h: 45 },
    {
      name: 'Heavy Combine',
      prod: 'money',
      amt: 100,
      powerReq: 30,
      waterReq: 25,
      pollution: 60,
      color: '#212121',
      h: 75,
    },
  ],
  distillery: [
    { name: 'Local Still', prod: 'vodka', amt: 5, powerReq: 2, waterReq: 5, pollution: 5, color: '#3f51b5', h: 15 },
    { name: 'Vodka Plant', prod: 'vodka', amt: 20, powerReq: 10, waterReq: 15, pollution: 20, color: '#1a237e', h: 35 },
    {
      name: 'State Brewery',
      prod: 'vodka',
      amt: 60,
      powerReq: 25,
      waterReq: 30,
      pollution: 40,
      color: '#000051',
      h: 55,
    },
  ],
  farm: [
    { name: 'Kolkhoz Plot', prod: 'food', amt: 15, powerReq: 0, waterReq: 5, color: '#33691e', h: 5 },
    { name: 'Mechanized Sovkhoz', prod: 'food', amt: 50, powerReq: 5, waterReq: 15, color: '#1b5e20', h: 10 },
    { name: 'Agri-Dome', prod: 'food', amt: 150, powerReq: 20, waterReq: 40, color: '#004d40', h: 30 },
  ],
};

/** Pravda news ticker messages displayed in the scrolling banner. */
export const TICKER_MESSAGES: string[] = [
  'CITIZENS REMINDED THAT COMPLAINING IS A CRIME',
  'POTATO YIELDS UP 0.01% - DIRECTOR PRAISED',
  'WEATHER FORECAST: PERPETUAL GRAY',
  'VANGUARD TRAIN SCHEDULE DELAYED DUE TO SABOTAGE',
  'ASTRONOMERS DENY RUMORS OF FALLING STARS',
  'GLORIOUS FIVE YEAR PLAN PROCEEDING AHEAD OF SCHEDULE',
  'REPORT SUSPICIOUS BEHAVIOR TO THE NEAREST GULAG',
  'SMOG IS MERELY THE FRAGRANCE OF PROGRESS',
];

/**
 * Returns the visual height (in pixels) for a building type at a given level.
 * Used by the legacy 2D canvas renderer for isometric projection.
 *
 * @param type  - Building type key
 * @param level - Upgrade level (0-2, default 0)
 * @returns Height in pixels
 */
export function getBuildingHeight(type: string, level: number = 0): number {
  if (GROWN_TYPES[type]) return GROWN_TYPES[type][level].h;
  if (type === 'power') return 40;
  if (type === 'gulag') return 20;
  if (type === 'pump') return 15;
  if (type === 'tower') return 70;
  if (type === 'nuke') return 35;
  if (type === 'mast') return 50;
  if (type === 'space') return 80;
  if (type === 'station') return 15;
  if (type === 'tap') return 25;
  return 0;
}
