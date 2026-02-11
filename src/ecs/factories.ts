/**
 * @module ecs/factories
 *
 * Entity factory functions for SimSoviet 2000.
 *
 * Each factory creates a pre-configured entity with the correct components
 * and adds it to the world. Building stats are sourced from the generated
 * buildingDefs.generated.json (via the Zod-validated data layer).
 */

import {
  FEMALE_GIVEN_NAMES,
  MALE_GIVEN_NAMES,
  PATRONYMIC_FATHER_NAMES,
  PATRONYMIC_RULES,
  SURNAMES_MALE,
  SURNAMES_RAW,
} from '@/ai/names';
import { GRID_SIZE } from '@/config';
import { getBuildingDef } from '@/data/buildingDefs';
import type {
  AgeCategory,
  BuildingComponent,
  CitizenComponent,
  CitizenRenderSlot,
  DvorComponent,
  DvorMember,
  Entity,
  GameMeta,
  MemberRole,
  Renderable,
  TileComponent,
} from './world';
import { world } from './world';

// ── Building Factory ────────────────────────────────────────────────────────

/**
 * Creates a building entity at the given grid position.
 *
 * Reads configuration from buildingDefs.generated.json to populate the
 * building component with correct stats and the renderable with sprite data.
 *
 * @param gridX - Column index on the grid (0-based)
 * @param gridY - Row index on the grid (0-based)
 * @param defId - Building definition ID (sprite ID key into BUILDING_DEFS)
 * @returns The created entity, already added to the world
 */
export function createBuilding(gridX: number, gridY: number, defId: string): Entity {
  const def = getBuildingDef(defId);

  // Derive building component from generated defs
  const building: BuildingComponent = {
    defId,
    powered: false,
    powerReq: def?.stats.powerReq ?? 0,
    powerOutput: def?.stats.powerOutput ?? 0,
    produces: def?.stats.produces,
    housingCap: def?.stats.housingCap ?? 0,
    pollution: def?.stats.pollution ?? 0,
    fear: def?.stats.fear ?? 0,
  };

  // Derive renderable from sprite data
  const renderable: Renderable = {
    spriteId: defId,
    spritePath: def?.sprite.path ?? '',
    footprintX: def?.footprint.tilesX ?? 1,
    footprintY: def?.footprint.tilesY ?? 1,
    visible: true,
  };

  const entity: Entity = {
    position: { gridX, gridY },
    building,
    renderable,
    durability: { current: 100, decayRate: def?.stats.decayRate ?? 0.05 },
    isBuilding: true,
  };

  return world.add(entity);
}

// ── New Building Placement (starts construction) ─────────────────────────────

/**
 * Places a new building on the grid that starts in the 'foundation' phase.
 *
 * Unlike `createBuilding()` (which produces operational buildings for
 * deserialization and tests), this is the function the UI calls when a
 * player places a building. The building must progress through construction
 * phases before it becomes operational.
 *
 * @param gridX - Column index on the grid (0-based)
 * @param gridY - Row index on the grid (0-based)
 * @param defId - Building definition ID
 * @returns The created entity (in 'foundation' phase)
 */
export function placeNewBuilding(gridX: number, gridY: number, defId: string): Entity {
  const def = getBuildingDef(defId);

  const building: BuildingComponent = {
    defId,
    powered: false,
    powerReq: def?.stats.powerReq ?? 0,
    powerOutput: def?.stats.powerOutput ?? 0,
    produces: def?.stats.produces,
    housingCap: def?.stats.housingCap ?? 0,
    pollution: def?.stats.pollution ?? 0,
    fear: def?.stats.fear ?? 0,
    constructionPhase: 'foundation',
    constructionProgress: 0,
    constructionTicks: 0,
  };

  const renderable: Renderable = {
    spriteId: defId,
    spritePath: def?.sprite.path ?? '',
    footprintX: def?.footprint.tilesX ?? 1,
    footprintY: def?.footprint.tilesY ?? 1,
    visible: true,
  };

  const entity: Entity = {
    position: { gridX, gridY },
    building,
    renderable,
    durability: { current: 100, decayRate: def?.stats.decayRate ?? 0.05 },
    isBuilding: true,
  };

  return world.add(entity);
}

/**
 * Marks a building entity as fully constructed (operational).
 *
 * After calling this, the building participates in power/production/housing.
 * You MUST call `world.reindex(entity)` after this for archetype queries
 * to pick up the change.
 */
export function completeConstruction(entity: Entity): void {
  if (entity.building) {
    entity.building.constructionPhase = 'complete';
    entity.building.constructionProgress = 1;
  }
}

/**
 * Returns true if a building entity is operational (not under construction).
 * Buildings without a constructionPhase are treated as operational (backward compat).
 */
export function isOperational(entity: { building: BuildingComponent }): boolean {
  const phase = entity.building.constructionPhase;
  return phase == null || phase === 'complete';
}

// ── Citizen Render Slot ──────────────────────────────────────────────────────

/** Citizen class → dot color for Canvas2D indicator rendering. */
const CITIZEN_DOT_COLORS: Record<string, string> = {
  worker: '#8D6E63',
  party_official: '#C62828',
  engineer: '#1565C0',
  farmer: '#2E7D32',
  soldier: '#4E342E',
  prisoner: '#616161',
};

/** Citizen class → dialogue pool for tap interaction. */
const CLASS_TO_DIALOGUE_POOL: Record<string, CitizenRenderSlot['dialoguePool']> = {
  worker: 'worker',
  farmer: 'worker',
  engineer: 'worker',
  party_official: 'party_official',
  soldier: 'military',
  prisoner: 'worker',
};

/**
 * Compute the age category bracket from a numeric age.
 * Used for render slot sprite variant selection and role transitions.
 */
export function ageCategoryFromAge(age: number): AgeCategory {
  if (age < 12) return 'child';
  if (age < 16) return 'adolescent';
  if (age < 60) return 'adult';
  return 'elder';
}

/**
 * Build a CitizenRenderSlot from citizen data.
 * Pre-computes all visual + dialogue fields so the renderer and dialogue
 * system can read them directly without runtime lookups.
 */
export function computeRenderSlot(
  citizenClass: string,
  gender: 'male' | 'female' = 'male',
  age: number = 25
): CitizenRenderSlot {
  return {
    gender,
    ageCategory: ageCategoryFromAge(age),
    citizenClass,
    dotColor: CITIZEN_DOT_COLORS[citizenClass] ?? '#757575',
    dialoguePool: CLASS_TO_DIALOGUE_POOL[citizenClass] ?? 'worker',
  };
}

// ── Citizen Factory ─────────────────────────────────────────────────────────

/**
 * Creates a citizen entity with a pre-computed render slot.
 *
 * New citizens start at the center of the grid if no home is assigned.
 *
 * @param citizenClass - Occupation / social class
 * @param homeX        - Optional grid X of housing assignment
 * @param homeY        - Optional grid Y of housing assignment
 * @param gender       - Optional gender (defaults to 'male' for backward compat)
 * @param age          - Optional age in years (defaults to 25)
 * @param dvorId       - Optional dvor (household) ID
 * @returns The created entity, already added to the world
 */
export function createCitizen(
  citizenClass: CitizenComponent['class'],
  homeX?: number,
  homeY?: number,
  gender: 'male' | 'female' = 'male',
  age: number = 25,
  dvorId?: string
): Entity {
  const citizen: CitizenComponent = {
    class: citizenClass,
    happiness: 50,
    hunger: 0,
    home: homeX != null && homeY != null ? { gridX: homeX, gridY: homeY } : undefined,
    gender,
    age,
    dvorId,
    memberRole: memberRoleForAge(age),
  };

  const entity: Entity = {
    position: {
      gridX: homeX ?? Math.floor(GRID_SIZE / 2),
      gridY: homeY ?? Math.floor(GRID_SIZE / 2),
    },
    citizen,
    renderSlot: computeRenderSlot(citizenClass, gender, age),
    isCitizen: true,
  };

  return world.add(entity);
}

// ── Tile Factory ────────────────────────────────────────────────────────────

/**
 * Creates a single tile entity.
 *
 * @param gridX   - Column index on the grid
 * @param gridY   - Row index on the grid
 * @param terrain - Terrain type for this tile
 * @returns The created entity, already added to the world
 */
export function createTile(
  gridX: number,
  gridY: number,
  terrain: TileComponent['terrain'] = 'grass'
): Entity {
  const tile: TileComponent = {
    terrain,
    elevation: 0,
  };

  const entity: Entity = {
    position: { gridX, gridY },
    tile,
    isTile: true,
  };

  return world.add(entity);
}

// ── Resource Store Factory ──────────────────────────────────────────────────

/**
 * Creates the singleton resource store entity.
 *
 * If a resource store already exists in the world, this is a no-op and
 * returns the existing entity.
 *
 * @param initialValues - Optional partial override of starting resources
 * @returns The resource store entity
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: resource store has many fields with individual defaults
export function createResourceStore(
  initialValues?: Partial<{
    money: number;
    food: number;
    vodka: number;
    power: number;
    powerUsed: number;
    population: number;
    trudodni: number;
    blat: number;
    timber: number;
    steel: number;
    cement: number;
    prefab: number;
    seedFund: number;
    emergencyReserve: number;
    storageCapacity: number;
  }>
): Entity {
  // Check for existing store
  const existing = world.with('resources', 'isResourceStore');
  if (existing.entities.length > 0) {
    return existing.entities[0]!;
  }

  const entity: Entity = {
    resources: {
      money: initialValues?.money ?? 2000,
      food: initialValues?.food ?? 600,
      vodka: initialValues?.vodka ?? 50,
      power: initialValues?.power ?? 0,
      powerUsed: initialValues?.powerUsed ?? 0,
      population: initialValues?.population ?? 12,
      trudodni: initialValues?.trudodni ?? 0,
      blat: initialValues?.blat ?? 10,
      timber: initialValues?.timber ?? 30,
      steel: initialValues?.steel ?? 10,
      cement: initialValues?.cement ?? 0,
      prefab: initialValues?.prefab ?? 0,
      seedFund: initialValues?.seedFund ?? 1.0,
      emergencyReserve: initialValues?.emergencyReserve ?? 0,
      storageCapacity: initialValues?.storageCapacity ?? 200,
    },
    isResourceStore: true,
  };

  return world.add(entity);
}

// ── Grid Factory ────────────────────────────────────────────────────────────

/**
 * Initializes the full grid as tile entities.
 *
 * Creates `size * size` tile entities, all starting as 'grass'.
 * Existing tiles are NOT removed — call this only once during
 * world initialization.
 *
 * @param size - Grid dimension (default: GRID_SIZE from config)
 */
export function createGrid(size: number = GRID_SIZE): void {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      createTile(x, y, 'grass');
    }
  }
}

// ── Meta Store Factory ────────────────────────────────────────────────────

/**
 * Creates the singleton game metadata entity.
 *
 * If a meta store already exists in the world, this is a no-op and
 * returns the existing entity.
 *
 * @param initialValues - Optional partial override of starting metadata
 * @returns The meta store entity
 */
export function createMetaStore(initialValues?: Partial<GameMeta>): Entity {
  const existing = world.with('gameMeta', 'isMetaStore');
  if (existing.entities.length > 0) {
    return existing.entities[0]!;
  }

  const entity: Entity = {
    gameMeta: {
      seed: initialValues?.seed ?? '',
      date: initialValues?.date ?? { year: 1922, month: 10, tick: 0 },
      quota: initialValues?.quota ?? {
        type: 'food',
        target: 500,
        current: 0,
        deadlineYear: 1927,
      },
      selectedTool: initialValues?.selectedTool ?? 'none',
      gameOver: initialValues?.gameOver ?? null,
      leaderName: initialValues?.leaderName,
      leaderPersonality: initialValues?.leaderPersonality,
      settlementTier: initialValues?.settlementTier ?? 'selo',
      blackMarks: initialValues?.blackMarks ?? 0,
      commendations: initialValues?.commendations ?? 0,
      threatLevel: initialValues?.threatLevel ?? 'safe',
      currentEra: initialValues?.currentEra ?? 'war_communism',
    },
    isMetaStore: true,
  };

  return world.add(entity);
}

// ── Dvor (Household) Factories ──────────────────────────────────────────────

/**
 * Compute labor capacity from age, following the historical curve.
 *
 * ```
 * Age  0-11: 0.0  (child — non-productive)
 * Age 12-15: 0.3  (adolescent — light work)
 * Age 16-20: 0.7  (young adult — learning)
 * Age 21-45: 1.0  (prime working age)
 * Age 46-54: 0.8  (declining)
 * Age 55-65: 0.5  (elder work)
 * Age 66+:   0.2  (minimal)
 * ```
 */
export function laborCapacityForAge(age: number, _gender: 'male' | 'female'): number {
  if (age < 12) return 0;
  if (age < 16) return 0.3;
  if (age < 21) return 0.7;
  if (age < 46) return 1.0;
  if (age < 55) return 0.8;
  if (age < 66) return 0.5;
  return 0.2;
}

/**
 * Derive the default member role from age.
 * Head/spouse roles are assigned separately during dvor creation.
 */
export function memberRoleForAge(age: number): MemberRole {
  if (age < 1) return 'infant';
  if (age < 12) return 'child';
  if (age < 16) return 'adolescent';
  if (age < 60) return 'worker';
  return 'elder';
}

/** Seed data for a single dvor member (input to createDvor). */
export interface DvorMemberSeed {
  name: string;
  gender: 'male' | 'female';
  age: number;
}

/**
 * Creates a dvor (household) entity with the given members.
 *
 * The first working-age male is designated head. If no adult male,
 * the first working-age member becomes head. The head's adult
 * opposite-gender partner (closest in age) becomes spouse.
 *
 * @param id - Unique dvor ID
 * @param surname - Family surname (male form)
 * @param memberSeeds - Array of {name, gender, age} for each member
 * @returns The created dvor entity
 */
export function createDvor(id: string, surname: string, memberSeeds: DvorMemberSeed[]): Entity {
  // Build full DvorMember objects
  const members: DvorMember[] = memberSeeds.map((seed, idx) => ({
    id: `${id}-m${idx}`,
    name: seed.name,
    gender: seed.gender,
    age: seed.age,
    role: memberRoleForAge(seed.age),
    laborCapacity: laborCapacityForAge(seed.age, seed.gender),
    trudodniEarned: 0,
    health: 100,
  }));

  // Designate head: first working-age male, or first working-age member
  const workingAge = members.filter((m) => m.age >= 16 && m.age < 60);
  const headCandidate = workingAge.find((m) => m.gender === 'male') ?? workingAge[0] ?? members[0]!;
  headCandidate.role = 'head';

  // Designate spouse: head's partner (opposite gender, working age, closest in age)
  const spouseCandidate = workingAge
    .filter((m) => m !== headCandidate && m.gender !== headCandidate.gender)
    .sort((a, b) => Math.abs(a.age - headCandidate.age) - Math.abs(b.age - headCandidate.age))[0];
  if (spouseCandidate) {
    spouseCandidate.role = 'spouse';
  }

  const dvor: DvorComponent = {
    id,
    members,
    headOfHousehold: headCandidate.id,
    privatePlotSize: 0.35,
    privateLivestock: { cow: 1, pig: 1, sheep: 3, poultry: 10 },
    joinedTick: 0,
    loyaltyToCollective: 50,
    surname,
  };

  return world.add({ dvor, isDvor: true });
}

/** Difficulty level for starting settlement. */
export type Difficulty = 'worker' | 'comrade' | 'tovarish';

/** Dvor count by difficulty. */
const DVOR_COUNTS: Record<Difficulty, number> = {
  worker: 12,
  comrade: 10,
  tovarish: 7,
};

/**
 * Procedural household composition templates.
 * Each template defines the non-head members by relative age offset from head.
 */
interface HouseholdTemplate {
  /** Head age range [min, max] */
  headAge: [number, number];
  /** Head gender */
  headGender: 'male' | 'female';
  /** Other members relative to head: [genderFn, ageDelta] */
  others: Array<{ gender: 'male' | 'female'; ageDelta: number }>;
}

const HOUSEHOLD_TEMPLATES: HouseholdTemplate[] = [
  // Standard family: husband + wife + 3 kids
  {
    headAge: [30, 45],
    headGender: 'male',
    others: [
      { gender: 'female', ageDelta: -3 },
      { gender: 'male', ageDelta: -20 },
      { gender: 'female', ageDelta: -25 },
      { gender: 'male', ageDelta: -29 },
    ],
  },
  // Extended family: husband + wife + mother + 3 kids
  {
    headAge: [38, 50],
    headGender: 'male',
    others: [
      { gender: 'female', ageDelta: -4 },
      { gender: 'female', ageDelta: 23 },
      { gender: 'male', ageDelta: -21 },
      { gender: 'female', ageDelta: -23 },
      { gender: 'male', ageDelta: -28 },
    ],
  },
  // War widow: woman + kids + brother + niece
  {
    headAge: [25, 35],
    headGender: 'female',
    others: [
      { gender: 'male', ageDelta: -17 },
      { gender: 'female', ageDelta: -21 },
      { gender: 'male', ageDelta: -6 },
      { gender: 'female', ageDelta: -24 },
    ],
  },
  // Older couple: husband + wife + grown son + daughter-in-law + 2 grandchildren
  {
    headAge: [45, 55],
    headGender: 'male',
    others: [
      { gender: 'female', ageDelta: -5 },
      { gender: 'male', ageDelta: -25 },
      { gender: 'female', ageDelta: -26 },
      { gender: 'male', ageDelta: -43 },
      { gender: 'female', ageDelta: -45 },
    ],
  },
  // Young family: husband + wife + 3 small kids
  {
    headAge: [28, 38],
    headGender: 'male',
    others: [
      { gender: 'female', ageDelta: -4 },
      { gender: 'male', ageDelta: -26 },
      { gender: 'female', ageDelta: -29 },
      { gender: 'male', ageDelta: -35 },
    ],
  },
  // Elderly couple with teens and grown daughter
  {
    headAge: [50, 60],
    headGender: 'male',
    others: [
      { gender: 'female', ageDelta: -3 },
      { gender: 'female', ageDelta: -30 },
      { gender: 'female', ageDelta: -34 },
      { gender: 'male', ageDelta: -36 },
    ],
  },
  // Young couple with children
  {
    headAge: [26, 34],
    headGender: 'male',
    others: [
      { gender: 'female', ageDelta: -4 },
      { gender: 'male', ageDelta: -18 },
      { gender: 'male', ageDelta: -22 },
      { gender: 'female', ageDelta: -25 },
    ],
  },
  // Middle-aged couple with older children and youngest
  {
    headAge: [40, 50],
    headGender: 'male',
    others: [
      { gender: 'female', ageDelta: -4 },
      { gender: 'male', ageDelta: -22 },
      { gender: 'male', ageDelta: -25 },
      { gender: 'female', ageDelta: -29 },
      { gender: 'male', ageDelta: -35 },
    ],
  },
  // Elderly widow with son's family and grandchildren
  {
    headAge: [55, 65],
    headGender: 'female',
    others: [
      { gender: 'male', ageDelta: -30 },
      { gender: 'female', ageDelta: -33 },
      { gender: 'male', ageDelta: -53 },
      { gender: 'female', ageDelta: -50 },
    ],
  },
  // Standard family: husband + wife + 4 kids + infant
  {
    headAge: [30, 40],
    headGender: 'male',
    others: [
      { gender: 'female', ageDelta: -5 },
      { gender: 'male', ageDelta: -23 },
      { gender: 'female', ageDelta: -25 },
      { gender: 'male', ageDelta: -28 },
      { gender: 'female', ageDelta: -30 },
    ],
  },
  // Young family with infant
  {
    headAge: [22, 30],
    headGender: 'male',
    others: [
      { gender: 'female', ageDelta: -2 },
      { gender: 'female', ageDelta: -20 },
      { gender: 'male', ageDelta: -22 },
    ],
  },
  // Large extended family
  {
    headAge: [35, 48],
    headGender: 'male',
    others: [
      { gender: 'female', ageDelta: -3 },
      { gender: 'female', ageDelta: 20 },
      { gender: 'male', ageDelta: -18 },
      { gender: 'female', ageDelta: -22 },
      { gender: 'male', ageDelta: -30 },
    ],
  },
];

/** Pick a deterministic given name by gender and index. */
function pickGivenName(gender: 'male' | 'female', index: number): string {
  const pool = gender === 'male' ? MALE_GIVEN_NAMES : FEMALE_GIVEN_NAMES;
  return pool[index % pool.length]!;
}

/** Pick a deterministic father's name for patronymic generation. */
function pickFatherName(index: number): string {
  return PATRONYMIC_FATHER_NAMES[index % PATRONYMIC_FATHER_NAMES.length]!;
}

/** Get the gendered form of a surname (canonical from SURNAMES_RAW or algorithmic). */
function genderedSurname(maleSurname: string, gender: 'male' | 'female'): string {
  if (gender === 'male') return maleSurname;
  // Check SURNAMES_RAW for canonical female form
  const entry = SURNAMES_RAW.find((s) => s.male === maleSurname);
  if (entry?.female) return entry.female;
  // Fallback: common Russian suffix rules
  if (maleSurname.endsWith('ov') || maleSurname.endsWith('ev') || maleSurname.endsWith('in')) {
    return maleSurname + 'a';
  }
  if (maleSurname.endsWith('sky') || maleSurname.endsWith('skiy')) {
    return maleSurname.replace(/sk(iy|y)$/, 'skaya');
  }
  return maleSurname;
}

/**
 * Build a full Russian-style name: Имя Отчество Фамилия (Given Patronymic Surname).
 *
 * @param givenName - The person's given name (имя)
 * @param fatherName - The father's given name (for patronymic derivation)
 * @param surname - The family surname (male form)
 * @param gender - The person's gender (for patronymic + surname gender forms)
 */
function buildRussianName(
  givenName: string,
  fatherName: string,
  surname: string,
  gender: 'male' | 'female'
): string {
  const patronymic = PATRONYMIC_RULES.generate(fatherName, gender);
  const genSurname = genderedSurname(surname, gender);
  return `${givenName} ${patronymic} ${genSurname}`;
}

/**
 * Creates the starting settlement with historically-grounded households.
 *
 * Names follow proper Russian patronymic convention:
 * - Head: Given + Patronymic (from random father) + Surname
 * - Spouse: Given + Patronymic (from own random father) + Gendered Surname
 * - Children: Given + Patronymic (from HEAD's given name) + Gendered Surname
 * - Elderly parent: Given + Patronymic (from random father) + Gendered Surname
 *
 * @param difficulty - Difficulty level (determines dvor count)
 */
export function createStartingSettlement(difficulty: Difficulty = 'comrade'): void {
  const dvorCount = DVOR_COUNTS[difficulty];
  const usedSurnames = new Set<string>();

  for (let i = 0; i < dvorCount; i++) {
    const template = HOUSEHOLD_TEMPLATES[i % HOUSEHOLD_TEMPLATES.length]!;

    // Pick a unique surname (male form)
    let surnameIdx = i;
    while (usedSurnames.has(SURNAMES_MALE[surnameIdx % SURNAMES_MALE.length]!)) {
      surnameIdx++;
    }
    const surname = SURNAMES_MALE[surnameIdx % SURNAMES_MALE.length]!;
    usedSurnames.add(surname);

    // Determine head age within template range
    const headAge = template.headAge[0] + (i % (template.headAge[1] - template.headAge[0] + 1));

    // Head's given name and father's name (for patronymic)
    const headGiven = pickGivenName(template.headGender, i * 10);
    const headFatherName = pickFatherName(i * 7); // different seed for variety

    // Build head member seed with full Russian name
    const memberSeeds: DvorMemberSeed[] = [
      {
        name: buildRussianName(headGiven, headFatherName, surname, template.headGender),
        gender: template.headGender,
        age: headAge,
      },
    ];

    for (let j = 0; j < template.others.length; j++) {
      const other = template.others[j]!;
      const age = Math.max(0, headAge + other.ageDelta);
      const otherGiven = pickGivenName(other.gender, i * 10 + j + 1);

      // Determine patronymic source:
      // - Children/grandchildren: head's given name is their father
      // - Spouse: has own father (random)
      // - Elderly parent: has own father (random)
      const isChild = age < headAge - 10;
      const isElder = other.ageDelta > 10; // parent/grandparent
      let fatherNameForPatronymic: string;
      if (isChild && !isElder) {
        // Children get patronymic from the head (if head is male) or head's husband
        fatherNameForPatronymic =
          template.headGender === 'male' ? headGiven : pickFatherName(i * 7 + 50); // female-headed household: father is absent
      } else {
        // Spouse, elderly parent, or other adult: own father
        fatherNameForPatronymic = pickFatherName(i * 7 + j + 20);
      }

      memberSeeds.push({
        name: buildRussianName(otherGiven, fatherNameForPatronymic, surname, other.gender),
        gender: other.gender,
        age,
      });
    }

    createDvor(`dvor-${i + 1}`, surname, memberSeeds);
  }
}
