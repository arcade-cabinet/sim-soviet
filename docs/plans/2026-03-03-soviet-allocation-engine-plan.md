# Soviet Allocation Engine — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the entity-scanning simulation with a DB-backed, agent-driven allocation engine where buildings are computational units, dvory are motivated agents, and every tick is `f(currentState) → nextState`.

**Architecture:** Six incremental phases. Each phase leaves the game playable. Phase 1 lays DB foundations. Phase 2 converts the core tick to stateless. Phase 3 adds building lifecycle and dvory motivation. Phase 4 adds terrain and prestige. Phase 5 adds the policy UI (Government HQ). Phase 6 delivers performance at scale. All tests are TDD — write the failing test first.

**Tech Stack:** TypeScript 5.9, expo-sqlite (Drizzle ORM), Miniplex ECS, React Three Fiber, Jest, GameRng (seeded)

**Design doc:** `docs/plans/2026-03-03-soviet-allocation-engine-design.md`

---

## Phase 1: DB Schema + SettlementSummary (Foundation)

Everything else depends on this. Establishes the new DB tables, the fixed-size `SettlementSummary` struct, and the `terrain_tiles` table. No simulation changes yet — just infrastructure.

---

### Task 1: SettlementSummary type + builder

**Files:**
- Create: `src/game/engine/SettlementSummary.ts`
- Test: `__tests__/engine/SettlementSummary.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/engine/SettlementSummary.test.ts
import { buildSettlementSummary, type SettlementSummary } from '../../src/game/engine/SettlementSummary';

describe('SettlementSummary', () => {
  it('builds from minimal inputs', () => {
    const summary = buildSettlementSummary({
      year: 1920,
      month: 3,
      population: 100,
      buildingCount: 5,
      totalFood: 500,
      totalPower: 100,
      totalMorale: 65,
      activeCrisisCount: 0,
      activeCrisisTypes: new Set(),
      trendDeltas: { food: 10, population: 2, morale: -1, power: 0 },
      yearsSinceLastWar: 3,
      yearsSinceLastFamine: 5,
      yearsSinceLastDisaster: 10,
    });
    expect(summary.year).toBe(1920);
    expect(summary.population).toBe(100);
    expect(summary.trendDeltas.food).toBe(10);
  });

  it('is the same shape regardless of game year', () => {
    const early = buildSettlementSummary({ year: 1917, month: 1, population: 10, buildingCount: 1, totalFood: 50, totalPower: 0, totalMorale: 50, activeCrisisCount: 0, activeCrisisTypes: new Set(), trendDeltas: { food: 0, population: 0, morale: 0, power: 0 }, yearsSinceLastWar: Infinity, yearsSinceLastFamine: Infinity, yearsSinceLastDisaster: Infinity });
    const late = buildSettlementSummary({ year: 9999, month: 12, population: 500000000, buildingCount: 30, totalFood: 999999, totalPower: 999999, totalMorale: 80, activeCrisisCount: 3, activeCrisisTypes: new Set(['war', 'famine']), trendDeltas: { food: -100, population: -500, morale: -5, power: -200 }, yearsSinceLastWar: 0, yearsSinceLastFamine: 0, yearsSinceLastDisaster: 50 });
    // Same keys, same structure
    expect(Object.keys(early).sort()).toEqual(Object.keys(late).sort());
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest __tests__/engine/SettlementSummary.test.ts --no-coverage`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/game/engine/SettlementSummary.ts
/**
 * Fixed-size settlement summary — the ONLY input every agent reads.
 * Same size at year 50 or year 50,000. No arrays that grow with time.
 */
export interface SettlementSummary {
  year: number;
  month: number;
  population: number;
  buildingCount: number;
  totalFood: number;
  totalPower: number;
  totalMorale: number;
  activeCrisisCount: number;
  activeCrisisTypes: Set<string>;
  trendDeltas: {
    food: number;
    population: number;
    morale: number;
    power: number;
  };
  yearsSinceLastWar: number;
  yearsSinceLastFamine: number;
  yearsSinceLastDisaster: number;
}

/** Build a SettlementSummary from raw inputs. Pure function. */
export function buildSettlementSummary(input: SettlementSummary): SettlementSummary {
  return { ...input };
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest __tests__/engine/SettlementSummary.test.ts --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add src/game/engine/SettlementSummary.ts __tests__/engine/SettlementSummary.test.ts
git commit -m "feat: add SettlementSummary fixed-size agent input struct"
```

---

### Task 2: terrain_tiles DB schema + migration

**Files:**
- Modify: `src/db/schema.ts`
- Create: `src/db/terrain.ts`
- Test: `__tests__/db/terrain-schema.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/db/terrain-schema.test.ts
import { terrainTiles } from '../../src/db/terrain';

describe('terrain_tiles schema', () => {
  it('exports a Drizzle table definition', () => {
    expect(terrainTiles).toBeDefined();
    // Drizzle tables have a Symbol for the table name
    expect(typeof terrainTiles).toBe('object');
  });

  it('has required columns', () => {
    // Drizzle SQLite tables expose column definitions
    const cols = Object.keys(terrainTiles);
    expect(cols).toContain('x');
    expect(cols).toContain('y');
    expect(cols).toContain('terrainType');
    expect(cols).toContain('fertility');
    expect(cols).toContain('contamination');
    expect(cols).toContain('moisture');
    expect(cols).toContain('forestAge');
    expect(cols).toContain('erosionLevel');
    expect(cols).toContain('elevation');
    expect(cols).toContain('hasRoad');
    expect(cols).toContain('hasPipe');
    expect(cols).toContain('modifiedYear');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest __tests__/db/terrain-schema.test.ts --no-coverage`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/db/terrain.ts
/**
 * Drizzle schema for terrain_tiles — per-tile world state.
 * This is the living landscape, not static terrain features.
 */
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const terrainTiles = sqliteTable('terrain_tiles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  x: integer('x').notNull(),
  y: integer('y').notNull(),
  terrainType: text('terrain_type').notNull().default('grass'),
  fertility: integer('fertility').notNull().default(50),
  contamination: integer('contamination').notNull().default(0),
  moisture: integer('moisture').notNull().default(50),
  forestAge: integer('forest_age').notNull().default(0),
  erosionLevel: integer('erosion_level').notNull().default(0),
  elevation: integer('elevation').notNull().default(0),
  hasRoad: integer('has_road', { mode: 'boolean' }).notNull().default(false),
  hasPipe: integer('has_pipe', { mode: 'boolean' }).notNull().default(false),
  modifiedYear: integer('modified_year').notNull().default(1917),
});

/** Valid terrain types for the type column. */
export type TerrainTileType =
  | 'forest' | 'steppe' | 'marsh' | 'tundra' | 'water'
  | 'mountain' | 'urban' | 'rubble' | 'crater' | 'contaminated' | 'grass';
```

Then add the re-export in `src/db/schema.ts`:

```typescript
// Add to bottom of src/db/schema.ts
export { terrainTiles } from './terrain';
```

**Step 4: Run test to verify it passes**

Run: `npx jest __tests__/db/terrain-schema.test.ts --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add src/db/terrain.ts src/db/schema.ts __tests__/db/terrain-schema.test.ts
git commit -m "feat: add terrain_tiles DB schema for living landscape state"
```

---

### Task 3: settlement_state DB schema

**Files:**
- Create: `src/db/settlement.ts`
- Modify: `src/db/schema.ts`
- Test: `__tests__/db/settlement-schema.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/db/settlement-schema.test.ts
import { settlementState } from '../../src/db/settlement';

describe('settlement_state schema', () => {
  it('has required columns', () => {
    const cols = Object.keys(settlementState);
    expect(cols).toContain('population');
    expect(cols).toContain('totalBuildings');
    expect(cols).toContain('era');
    expect(cols).toContain('year');
    expect(cols).toContain('month');
    expect(cols).toContain('landGrantRadius');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest __tests__/db/settlement-schema.test.ts --no-coverage`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/db/settlement.ts
/**
 * Single-row settlement state — the canonical current state summary.
 * Agents read this instead of scanning entities.
 */
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const settlementState = sqliteTable('settlement_state', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  population: integer('population').notNull().default(0),
  totalBuildings: integer('total_buildings').notNull().default(0),
  era: text('era').notNull().default('revolution'),
  year: integer('year').notNull().default(1917),
  month: integer('month').notNull().default(10),
  landGrantRadius: integer('land_grant_radius').notNull().default(15),
  trendFoodDelta: real('trend_food_delta').notNull().default(0),
  trendPopDelta: real('trend_pop_delta').notNull().default(0),
  trendMoraleDelta: real('trend_morale_delta').notNull().default(0),
  trendPowerDelta: real('trend_power_delta').notNull().default(0),
  yearsSinceLastWar: integer('years_since_last_war').notNull().default(999),
  yearsSinceLastFamine: integer('years_since_last_famine').notNull().default(999),
  yearsSinceLastDisaster: integer('years_since_last_disaster').notNull().default(999),
});
```

Add to `src/db/schema.ts`:
```typescript
export { settlementState } from './settlement';
```

**Step 4: Run test, verify pass**

Run: `npx jest __tests__/db/settlement-schema.test.ts --no-coverage`

**Step 5: Commit**

```bash
git add src/db/settlement.ts src/db/schema.ts __tests__/db/settlement-schema.test.ts
git commit -m "feat: add settlement_state DB schema for fixed-size agent input"
```

---

### Task 4: Land grant radius config + tier mapping

**Files:**
- Create: `src/config/landGrants.ts`
- Test: `__tests__/game/LandGrants.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/game/LandGrants.test.ts
import { getLandGrantRadius, LAND_GRANT_TIERS } from '../../src/config/landGrants';

describe('Land Grants', () => {
  it('selo gets radius 15', () => {
    expect(getLandGrantRadius('selo')).toBe(15);
  });

  it('posyolok gets radius 30', () => {
    expect(getLandGrantRadius('posyolok')).toBe(30);
  });

  it('pgt gets radius 60', () => {
    expect(getLandGrantRadius('pgt')).toBe(60);
  });

  it('gorod gets radius 120', () => {
    expect(getLandGrantRadius('gorod')).toBe(120);
  });

  it('unknown tier falls back to selo', () => {
    expect(getLandGrantRadius('unknown' as never)).toBe(15);
  });

  it('all tiers are defined', () => {
    expect(Object.keys(LAND_GRANT_TIERS)).toHaveLength(4);
  });
});
```

**Step 2: Run, expect fail**

Run: `npx jest __tests__/game/LandGrants.test.ts --no-coverage`

**Step 3: Implement**

```typescript
// src/config/landGrants.ts
/**
 * Land grant radius by settlement tier.
 * Territory is a reward/punishment mechanic controlled by the state.
 */

export const LAND_GRANT_TIERS: Record<string, { radius: number; description: string }> = {
  selo: { radius: 15, description: 'Initial allotment — ~15 tiles from HQ' },
  posyolok: { radius: 30, description: '50+ population, 1 industry' },
  pgt: { radius: 60, description: '150+ pop, 50% non-agricultural' },
  gorod: { radius: 120, description: '400+ pop, 85% non-agricultural, 5+ building roles' },
};

/** Get the land grant radius for a settlement tier. */
export function getLandGrantRadius(tier: string): number {
  return LAND_GRANT_TIERS[tier]?.radius ?? LAND_GRANT_TIERS.selo.radius;
}
```

**Step 4: Run, expect pass**

**Step 5: Commit**

```bash
git add src/config/landGrants.ts __tests__/game/LandGrants.test.ts
git commit -m "feat: add land grant radius config by settlement tier"
```

---

### Task 5: Protected class priority config

**Files:**
- Create: `src/config/protectedClasses.ts`
- Test: `__tests__/game/ProtectedClasses.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/game/ProtectedClasses.test.ts
import {
  PROTECTED_CLASSES,
  isProtected,
  getDemolitionPriority,
  type BuildingProtectionClass,
} from '../../src/config/protectedClasses';

describe('Protected Classes', () => {
  it('government is never demolished', () => {
    expect(isProtected('government')).toBe(true);
  });

  it('military is never demolished', () => {
    expect(isProtected('military')).toBe(true);
  });

  it('housing is fully expendable', () => {
    expect(isProtected('housing')).toBe(false);
  });

  it('farms are fully expendable', () => {
    expect(isProtected('farms')).toBe(false);
  });

  it('demolition priority orders expendables first', () => {
    const farmPriority = getDemolitionPriority('farms');
    const housingPriority = getDemolitionPriority('housing');
    const industryPriority = getDemolitionPriority('industry');
    const powerPriority = getDemolitionPriority('power_water');
    // Lower number = demolished first
    expect(farmPriority).toBeLessThan(industryPriority);
    expect(housingPriority).toBeLessThan(industryPriority);
    expect(industryPriority).toBeLessThan(powerPriority);
  });

  it('protected classes have Infinity priority', () => {
    expect(getDemolitionPriority('government')).toBe(Infinity);
    expect(getDemolitionPriority('military')).toBe(Infinity);
  });
});
```

**Step 2: Run, expect fail**

**Step 3: Implement**

```typescript
// src/config/protectedClasses.ts
/**
 * Protected class hierarchy — in the "classless" Soviet system.
 * Government > Military > Power/Water > Industry > Housing > Farms
 */

export type BuildingProtectionClass =
  | 'government' | 'military' | 'power_water'
  | 'industry' | 'housing' | 'farms';

export interface ProtectionConfig {
  protectionClass: BuildingProtectionClass;
  protected: boolean;
  demolitionPriority: number; // Lower = demolished first. Infinity = never.
  description: string;
}

export const PROTECTED_CLASSES: Record<BuildingProtectionClass, ProtectionConfig> = {
  government: {
    protectionClass: 'government',
    protected: true,
    demolitionPriority: Infinity,
    description: 'Never demolished. Never displaced. Expands toward center.',
  },
  military: {
    protectionClass: 'military',
    protected: true,
    demolitionPriority: Infinity,
    description: 'Never demolished. Priority housing. Claims defensive positions.',
  },
  power_water: {
    protectionClass: 'power_water',
    protected: true,
    demolitionPriority: Infinity,
    description: 'Critical infrastructure. Never demolished.',
  },
  industry: {
    protectionClass: 'industry',
    protected: false,
    demolitionPriority: 30,
    description: 'Demolishable but costly — lost production.',
  },
  housing: {
    protectionClass: 'housing',
    protected: false,
    demolitionPriority: 10,
    description: 'Fully expendable. First to go when government needs space.',
  },
  farms: {
    protectionClass: 'farms',
    protected: false,
    demolitionPriority: 5,
    description: 'Fully expendable. Relocated to outskirts.',
  },
};

/** Check if a building class is protected from demolition. */
export function isProtected(cls: BuildingProtectionClass): boolean {
  return PROTECTED_CLASSES[cls]?.protected ?? false;
}

/** Get demolition priority (lower = demolished first, Infinity = never). */
export function getDemolitionPriority(cls: BuildingProtectionClass): number {
  return PROTECTED_CLASSES[cls]?.demolitionPriority ?? 20;
}
```

**Step 4: Run, expect pass**

**Step 5: Commit**

```bash
git add src/config/protectedClasses.ts __tests__/game/ProtectedClasses.test.ts
git commit -m "feat: add protected class hierarchy config"
```

---

### Task 6: Building role → protection class mapping

**Files:**
- Create: `src/config/buildingClassification.ts`
- Test: `__tests__/game/BuildingClassification.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/game/BuildingClassification.test.ts
import { classifyBuilding } from '../../src/config/buildingClassification';

describe('Building Classification', () => {
  it('classifies power stations as power_water', () => {
    expect(classifyBuilding('power-station')).toBe('power_water');
  });

  it('classifies housing as housing', () => {
    expect(classifyBuilding('apartment-tower-a')).toBe('housing');
    expect(classifyBuilding('workers-house-a')).toBe('housing');
  });

  it('classifies farms as farms', () => {
    expect(classifyBuilding('collective-farm-hq')).toBe('farms');
  });

  it('classifies government buildings', () => {
    expect(classifyBuilding('government-hq')).toBe('government');
    expect(classifyBuilding('party-office')).toBe('government');
  });

  it('classifies military buildings', () => {
    expect(classifyBuilding('militia-post')).toBe('military');
    expect(classifyBuilding('barracks')).toBe('military');
  });

  it('classifies industry', () => {
    expect(classifyBuilding('vodka-distillery')).toBe('industry');
    expect(classifyBuilding('warehouse')).toBe('industry');
  });

  it('defaults unknown buildings to industry', () => {
    expect(classifyBuilding('some-unknown-building')).toBe('industry');
  });
});
```

**Step 2: Run, expect fail**

**Step 3: Implement**

```typescript
// src/config/buildingClassification.ts
/**
 * Maps building defIds to protection classes.
 * Uses building role from buildingDefs when available,
 * falls back to name-based heuristics.
 */
import type { BuildingProtectionClass } from './protectedClasses';

/** Explicit overrides for buildings that don't match role-based classification. */
const EXPLICIT_CLASS: Record<string, BuildingProtectionClass> = {
  'government-hq': 'government',
  'party-office': 'government',
  'settlement-hq': 'government',
  'raion-office': 'government',
  'militia-post': 'military',
  'barracks': 'military',
  'guard-tower': 'military',
  'power-station': 'power_water',
  'water-pump': 'power_water',
  'water-tower': 'power_water',
};

/** Role to protection class mapping. */
const ROLE_CLASS: Record<string, BuildingProtectionClass> = {
  government: 'government',
  military: 'military',
  power: 'power_water',
  water: 'power_water',
  housing: 'housing',
  agriculture: 'farms',
  industry: 'industry',
  storage: 'industry',
  education: 'industry',
  medical: 'industry',
  culture: 'industry',
};

/**
 * Classify a building by its defId into a protection class.
 * Checks explicit overrides first, then building role, then name heuristics.
 */
export function classifyBuilding(defId: string): BuildingProtectionClass {
  // 1. Explicit override
  if (EXPLICIT_CLASS[defId]) return EXPLICIT_CLASS[defId];

  // 2. Name heuristics
  if (defId.includes('house') || defId.includes('apartment') || defId.includes('dormitor')) return 'housing';
  if (defId.includes('farm') || defId.includes('grain') || defId.includes('silo')) return 'farms';
  if (defId.includes('power') || defId.includes('generator')) return 'power_water';
  if (defId.includes('government') || defId.includes('party') || defId.includes('soviet')) return 'government';
  if (defId.includes('militia') || defId.includes('barrack') || defId.includes('guard')) return 'military';

  // 3. Default
  return 'industry';
}
```

**Step 4: Run, expect pass**

**Step 5: Commit**

```bash
git add src/config/buildingClassification.ts __tests__/game/BuildingClassification.test.ts
git commit -m "feat: add building defId → protection class mapping"
```

---

### Task 7: Mega-scaling tier config

**Files:**
- Create: `src/config/megaScaling.ts`
- Test: `__tests__/game/MegaScaling.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/game/MegaScaling.test.ts
import { getMaxBuildingTier, getScaleFactor, MEGA_SCALING_TIERS } from '../../src/config/megaScaling';

describe('Mega Scaling', () => {
  it('revolution era allows only base tier', () => {
    expect(getMaxBuildingTier('revolution')).toBe(0);
    expect(getScaleFactor(0)).toBe(1);
  });

  it('collectivization unlocks tier 1 (×10)', () => {
    expect(getMaxBuildingTier('collectivization')).toBe(1);
    expect(getScaleFactor(1)).toBe(10);
  });

  it('industrialization unlocks tier 2 (×100)', () => {
    expect(getMaxBuildingTier('industrialization')).toBe(2);
    expect(getScaleFactor(2)).toBe(100);
  });

  it('reconstruction unlocks tier 3 (×1000)', () => {
    expect(getMaxBuildingTier('reconstruction')).toBe(3);
    expect(getScaleFactor(3)).toBe(1000);
  });

  it('stagnation unlocks tier 4 (×10000)', () => {
    expect(getMaxBuildingTier('stagnation')).toBe(4);
    expect(getScaleFactor(4)).toBe(10000);
  });

  it('eternal unlocks tier 5+ (×100000)', () => {
    expect(getMaxBuildingTier('the_eternal')).toBe(5);
    expect(getScaleFactor(5)).toBe(100000);
  });

  it('unknown era defaults to 0', () => {
    expect(getMaxBuildingTier('unknown')).toBe(0);
  });
});
```

**Step 2: Run, expect fail**

**Step 3: Implement**

```typescript
// src/config/megaScaling.ts
/**
 * Mega-scaling tiers — buildings scale by orders of magnitude.
 * Same 50 GLB models, brutalist-scaled. Era unlocks ability.
 */

export interface MegaScalingTier {
  tier: number;
  scaleFactor: number;
  label: string;
}

export const MEGA_SCALING_TIERS: MegaScalingTier[] = [
  { tier: 0, scaleFactor: 1,      label: 'Base' },
  { tier: 1, scaleFactor: 10,     label: 'Tier 1' },
  { tier: 2, scaleFactor: 100,    label: 'Tier 2' },
  { tier: 3, scaleFactor: 1000,   label: 'Tier 3' },
  { tier: 4, scaleFactor: 10000,  label: 'Tier 4' },
  { tier: 5, scaleFactor: 100000, label: 'Tier 5+' },
];

const ERA_MAX_TIER: Record<string, number> = {
  revolution: 0,
  collectivization: 1,
  industrialization: 2,
  great_patriotic: 2,
  reconstruction: 3,
  thaw: 3,
  freeze: 3,
  stagnation: 4,
  the_eternal: 5,
};

/** Get the maximum building tier allowed by the current era. */
export function getMaxBuildingTier(eraId: string): number {
  return ERA_MAX_TIER[eraId] ?? 0;
}

/** Get the scale factor for a building tier. */
export function getScaleFactor(tier: number): number {
  return MEGA_SCALING_TIERS[tier]?.scaleFactor ?? 1;
}
```

**Step 4: Run, expect pass**

**Step 5: Commit**

```bash
git add src/config/megaScaling.ts __tests__/game/MegaScaling.test.ts
git commit -m "feat: add mega-scaling tier config with era gating"
```

---

### Task 8: Two-layer resource distribution pure function

**Files:**
- Create: `src/ai/agents/economy/allocationDistribution.ts`
- Test: `__tests__/economy/allocationDistribution.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/economy/allocationDistribution.test.ts
import { computeAllocation, type BuildingAllocationInput } from '../../src/ai/agents/economy/allocationDistribution';

describe('Two-layer resource distribution', () => {
  const buildings: BuildingAllocationInput[] = [
    { id: 'b1', residentCount: 100, loyalty: 80, proximity: 1.0, skill: 70, kgbFavor: false },
    { id: 'b2', residentCount: 100, loyalty: 30, proximity: 0.5, skill: 40, kgbFavor: false },
    { id: 'b3', residentCount: 50,  loyalty: 90, proximity: 0.8, skill: 60, kgbFavor: true },
  ];

  it('distributes baseline equally per capita', () => {
    const result = computeAllocation(1000, 250, buildings);
    // baseline = 1000 / 250 = 4 per capita
    expect(result[0].baseline).toBe(400); // 100 * 4
    expect(result[1].baseline).toBe(400); // 100 * 4
    expect(result[2].baseline).toBe(200); // 50 * 4
  });

  it('spiky layer gives more to high-loyalty buildings', () => {
    const result = computeAllocation(1000, 250, buildings);
    // b1 has loyalty 80, b2 has loyalty 30 — b1 should get more spike
    expect(result[0].spike).toBeGreaterThan(result[1].spike);
  });

  it('kgb favor boosts allocation', () => {
    const result = computeAllocation(1000, 250, buildings);
    // b3 has kgb favor — normalized spike should be boosted
    const b3PerCapitaSpike = result[2].spike / 50;
    const b2PerCapitaSpike = result[1].spike / 100;
    expect(b3PerCapitaSpike).toBeGreaterThan(b2PerCapitaSpike);
  });

  it('total allocation equals total supply', () => {
    const result = computeAllocation(1000, 250, buildings);
    const total = result.reduce((s, r) => s + r.baseline + r.spike, 0);
    expect(total).toBeCloseTo(1000, 1);
  });

  it('handles zero supply gracefully', () => {
    const result = computeAllocation(0, 250, buildings);
    expect(result.every(r => r.baseline === 0 && r.spike === 0)).toBe(true);
  });
});
```

**Step 2: Run, expect fail**

**Step 3: Implement**

```typescript
// src/ai/agents/economy/allocationDistribution.ts
/**
 * Two-layer resource distribution — the Soviet promise meets Soviet reality.
 *
 * Layer 1 (Uniform baseline): Everyone gets equal per-capita share.
 * Layer 2 (Spiky secondary): Loyalty, proximity, skill, KGB favor boost allocation.
 */

export interface BuildingAllocationInput {
  id: string;
  residentCount: number;
  loyalty: number;      // 0-100
  proximity: number;    // 0-1 (distance from government center, 1 = closest)
  skill: number;        // 0-100
  kgbFavor: boolean;
}

export interface BuildingAllocationResult {
  id: string;
  baseline: number;
  spike: number;
  total: number;
}

/**
 * Compute two-layer allocation for a resource across buildings.
 *
 * @param totalSupply - Total resource available
 * @param totalPopulation - Total residents across all buildings
 * @param buildings - Per-building allocation inputs
 * @returns Per-building allocation results
 */
export function computeAllocation(
  totalSupply: number,
  totalPopulation: number,
  buildings: BuildingAllocationInput[],
): BuildingAllocationResult[] {
  if (totalPopulation <= 0 || totalSupply <= 0 || buildings.length === 0) {
    return buildings.map(b => ({ id: b.id, baseline: 0, spike: 0, total: 0 }));
  }

  // Layer 1: uniform baseline (80% of supply)
  const baselinePool = totalSupply * 0.8;
  const perCapita = baselinePool / totalPopulation;

  // Layer 2: spiky secondary (20% of supply)
  const spikePool = totalSupply * 0.2;

  // Compute raw spike scores
  const rawScores = buildings.map(b => {
    const loyaltyFactor = b.loyalty / 100;
    const proximityFactor = b.proximity;
    const skillFactor = b.skill / 100;
    const kgbBonus = b.kgbFavor ? 1.5 : 1.0;
    return b.residentCount * (loyaltyFactor * 0.4 + proximityFactor * 0.25 + skillFactor * 0.2 + 0.15) * kgbBonus;
  });

  const totalScore = rawScores.reduce((s, v) => s + v, 0);

  return buildings.map((b, i) => {
    const baseline = b.residentCount * perCapita;
    const spike = totalScore > 0 ? (rawScores[i] / totalScore) * spikePool : 0;
    return { id: b.id, baseline, spike, total: baseline + spike };
  });
}
```

**Step 4: Run, expect pass**

**Step 5: Commit**

```bash
git add src/ai/agents/economy/allocationDistribution.ts __tests__/economy/allocationDistribution.test.ts
git commit -m "feat: add two-layer resource distribution (uniform baseline + spiky secondary)"
```

---

### Task 9: Per-building tick pure function

**Files:**
- Create: `src/ai/agents/economy/buildingTick.ts`
- Test: `__tests__/economy/buildingTick.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/economy/buildingTick.test.ts
import { tickBuilding, type BuildingTickInput, type BuildingTickContext } from '../../src/ai/agents/economy/buildingTick';

describe('tickBuilding', () => {
  const baseBuilding: BuildingTickInput = {
    defId: 'collective-farm-hq',
    workerCount: 10,
    avgSkill: 60,
    avgMorale: 70,
    avgLoyalty: 50,
    powered: true,
    baseRate: 5,
    tileFertility: 80,
  };

  const baseCtx: BuildingTickContext = {
    weather: 'clear',
    season: 'summer',
    activeCrisisModifier: 1.0,
  };

  it('computes positive output for a working farm', () => {
    const result = tickBuilding(baseBuilding, baseCtx);
    expect(result.netOutput).toBeGreaterThan(0);
  });

  it('zero workers means zero output', () => {
    const result = tickBuilding({ ...baseBuilding, workerCount: 0 }, baseCtx);
    expect(result.netOutput).toBe(0);
  });

  it('unpowered building produces nothing', () => {
    const result = tickBuilding({ ...baseBuilding, powered: false }, baseCtx);
    expect(result.netOutput).toBe(0);
  });

  it('crisis modifier reduces output', () => {
    const normal = tickBuilding(baseBuilding, baseCtx);
    const crisis = tickBuilding(baseBuilding, { ...baseCtx, activeCrisisModifier: 0.5 });
    expect(crisis.netOutput).toBeLessThan(normal.netOutput);
  });

  it('winter reduces farm output', () => {
    const summer = tickBuilding(baseBuilding, baseCtx);
    const winter = tickBuilding(baseBuilding, { ...baseCtx, season: 'winter' });
    expect(winter.netOutput).toBeLessThan(summer.netOutput);
  });

  it('pure function: no mutation of inputs', () => {
    const building = { ...baseBuilding };
    const ctx = { ...baseCtx };
    tickBuilding(building, ctx);
    expect(building).toEqual(baseBuilding);
    expect(ctx).toEqual(baseCtx);
  });
});
```

**Step 2: Run, expect fail**

**Step 3: Implement**

```typescript
// src/ai/agents/economy/buildingTick.ts
/**
 * Per-building tick — pure function.
 *
 * O(1) per building. No entity scanning. No history lookup.
 * nextState = f(currentState, context)
 */

export interface BuildingTickInput {
  defId: string;
  workerCount: number;
  avgSkill: number;     // 0-100
  avgMorale: number;    // 0-100
  avgLoyalty: number;   // 0-100
  powered: boolean;
  baseRate: number;
  tileFertility: number; // 0-100
}

export interface BuildingTickContext {
  weather: string;
  season: string;
  activeCrisisModifier: number; // 1.0 = no crisis, 0.5 = halved
}

export interface BuildingTickResult {
  netOutput: number;
}

const SEASON_MODIFIERS: Record<string, number> = {
  spring: 0.8,
  summer: 1.0,
  autumn: 0.9,
  winter: 0.3,
};

const WEATHER_MODIFIERS: Record<string, number> = {
  clear: 1.0,
  cloudy: 0.95,
  rain: 0.8,
  storm: 0.5,
  snow: 0.6,
  blizzard: 0.3,
};

/**
 * Compute one tick of building output. Pure function.
 */
export function tickBuilding(building: BuildingTickInput, ctx: BuildingTickContext): BuildingTickResult {
  if (building.workerCount <= 0 || !building.powered) {
    return { netOutput: 0 };
  }

  const effectiveWorkers = building.workerCount * (building.avgSkill / 100);
  const moraleFactor = 0.5 + 0.5 * (building.avgMorale / 100);
  const weatherFactor = WEATHER_MODIFIERS[ctx.weather] ?? 1.0;
  const seasonFactor = SEASON_MODIFIERS[ctx.season] ?? 1.0;
  const terrainFactor = building.tileFertility / 100;

  const netOutput =
    building.baseRate *
    effectiveWorkers *
    moraleFactor *
    weatherFactor *
    seasonFactor *
    ctx.activeCrisisModifier *
    terrainFactor;

  return { netOutput };
}
```

**Step 4: Run, expect pass**

**Step 5: Commit**

```bash
git add src/ai/agents/economy/buildingTick.ts __tests__/economy/buildingTick.test.ts
git commit -m "feat: add per-building tick pure function — O(1) per building"
```

---

### Task 10: Per-tile terrain tick pure function

**Files:**
- Create: `src/ai/agents/core/terrainTick.ts`
- Test: `__tests__/engine/terrainTick.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/engine/terrainTick.test.ts
import { tickTerrain, type TerrainTileState, type YearlyTerrainContext } from '../../src/ai/agents/core/terrainTick';

describe('tickTerrain', () => {
  const baseTile: TerrainTileState = {
    type: 'grass',
    fertility: 80,
    contamination: 0,
    moisture: 50,
    forestAge: 0,
    erosionLevel: 0,
    elevation: 5,
  };

  const baseCtx: YearlyTerrainContext = {
    rainfall: 0.5,
    globalWarmingRate: 0,
  };

  it('stable tile has no change', () => {
    const result = tickTerrain(baseTile, baseCtx);
    expect(result.fertility).toBe(80);
    expect(result.erosionLevel).toBe(0);
  });

  it('deforested tile erodes', () => {
    const deforested: TerrainTileState = { ...baseTile, type: 'steppe', erosionLevel: 10 };
    const result = tickTerrain(deforested, baseCtx);
    expect(result.erosionLevel).toBeGreaterThan(10);
  });

  it('contamination reduces fertility', () => {
    const contaminated: TerrainTileState = { ...baseTile, contamination: 50 };
    const result = tickTerrain(contaminated, baseCtx);
    expect(result.fertility).toBeLessThan(80);
  });

  it('forest ages by 1 each year', () => {
    const forested: TerrainTileState = { ...baseTile, type: 'forest', forestAge: 5 };
    const result = tickTerrain(forested, baseCtx);
    expect(result.forestAge).toBe(6);
  });

  it('non-forest tile has forestAge 0', () => {
    const result = tickTerrain(baseTile, baseCtx);
    expect(result.forestAge).toBe(0);
  });

  it('pure function: no mutation', () => {
    const tile = { ...baseTile };
    tickTerrain(tile, baseCtx);
    expect(tile).toEqual(baseTile);
  });
});
```

**Step 2: Run, expect fail**

**Step 3: Implement**

```typescript
// src/ai/agents/core/terrainTick.ts
/**
 * Per-tile terrain tick — runs yearly, not per-tick.
 * Only active tiles (erosion > 0, contamination > 0, forest growing) compute.
 * Dormant tiles skip entirely.
 */

export interface TerrainTileState {
  type: string;
  fertility: number;
  contamination: number;
  moisture: number;
  forestAge: number;
  erosionLevel: number;
  elevation: number;
}

export interface YearlyTerrainContext {
  rainfall: number;          // 0-1
  globalWarmingRate: number;  // 0+ (Freeform only)
}

/**
 * Compute one year of terrain evolution. Pure function.
 */
export function tickTerrain(tile: TerrainTileState, ctx: YearlyTerrainContext): TerrainTileState {
  const isDeforested = tile.type !== 'forest' && tile.type !== 'marsh' && tile.type !== 'water' && tile.type !== 'mountain';

  // Erosion increases on deforested land with rainfall
  const erosion = tile.erosionLevel + (isDeforested && tile.erosionLevel > 0 ? ctx.rainfall * 0.1 : 0);

  // Fertility degrades from erosion and contamination
  const fertility = Math.max(
    0,
    tile.fertility - erosion * 0.01 - tile.contamination * 0.05,
  );

  // Forest aging
  const forestAge = tile.type === 'forest' ? tile.forestAge + 1 : 0;

  // Contamination slow decay (half-life ~50 years)
  const contamination = Math.max(0, tile.contamination * 0.986);

  return {
    type: tile.type,
    fertility,
    contamination,
    moisture: tile.moisture,
    forestAge,
    erosionLevel: Math.min(100, erosion),
    elevation: tile.elevation,
  };
}

/**
 * Check if a tile needs yearly computation (active process running).
 * Dormant tiles can skip entirely.
 */
export function isTileActive(tile: TerrainTileState): boolean {
  return tile.erosionLevel > 0 || tile.contamination > 0 || tile.type === 'forest';
}
```

**Step 4: Run, expect pass**

**Step 5: Commit**

```bash
git add src/ai/agents/core/terrainTick.ts __tests__/engine/terrainTick.test.ts
git commit -m "feat: add per-tile terrain tick pure function (yearly)"
```

---

### Task 11: Crisis condition-based transitions (replace tick counters)

**Files:**
- Create: `src/ai/agents/crisis/crisisConditions.ts`
- Test: `__tests__/crisis/crisisConditions.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/crisis/crisisConditions.test.ts
import {
  transitionCrisis,
  type CrisisConditionState,
  type ConditionContext,
} from '../../src/ai/agents/crisis/crisisConditions';

describe('Crisis condition-based transitions', () => {
  it('dormant → building when activation conditions met', () => {
    const crisis: CrisisConditionState = {
      phase: 'dormant',
      activationCondition: (ctx) => ctx.food < ctx.population * 2,
      peakCondition: (ctx) => ctx.food < ctx.population,
      reliefCondition: (ctx) => ctx.food > ctx.population * 3,
    };
    const ctx: ConditionContext = { food: 50, population: 100, morale: 50 };
    expect(transitionCrisis(crisis, ctx)).toBe('building');
  });

  it('stays dormant when conditions not met', () => {
    const crisis: CrisisConditionState = {
      phase: 'dormant',
      activationCondition: (ctx) => ctx.food < ctx.population * 2,
      peakCondition: () => false,
      reliefCondition: () => false,
    };
    const ctx: ConditionContext = { food: 500, population: 100, morale: 50 };
    expect(transitionCrisis(crisis, ctx)).toBe('dormant');
  });

  it('building → peak when peak conditions met', () => {
    const crisis: CrisisConditionState = {
      phase: 'building',
      activationCondition: () => true,
      peakCondition: (ctx) => ctx.food < ctx.population,
      reliefCondition: () => false,
    };
    const ctx: ConditionContext = { food: 10, population: 100, morale: 30 };
    expect(transitionCrisis(crisis, ctx)).toBe('peak');
  });

  it('peak → waning when relief conditions met', () => {
    const crisis: CrisisConditionState = {
      phase: 'peak',
      activationCondition: () => true,
      peakCondition: () => true,
      reliefCondition: (ctx) => ctx.food > ctx.population * 3,
    };
    const ctx: ConditionContext = { food: 500, population: 100, morale: 50 };
    expect(transitionCrisis(crisis, ctx)).toBe('waning');
  });
});
```

**Step 2: Run, expect fail**

**Step 3: Implement**

```typescript
// src/ai/agents/crisis/crisisConditions.ts
/**
 * Condition-based crisis state machine.
 * Transitions on CONDITIONS, not tick counters.
 * A famine peaks when food drops below threshold, wanes when food recovers.
 */

export type CrisisPhaseCondition = 'dormant' | 'building' | 'peak' | 'waning';

export interface ConditionContext {
  food: number;
  population: number;
  morale: number;
  [key: string]: number; // extensible
}

export interface CrisisConditionState {
  phase: CrisisPhaseCondition;
  activationCondition: (ctx: ConditionContext) => boolean;
  peakCondition: (ctx: ConditionContext) => boolean;
  reliefCondition: (ctx: ConditionContext) => boolean;
}

/**
 * Evaluate crisis phase transition. Pure function.
 */
export function transitionCrisis(crisis: CrisisConditionState, ctx: ConditionContext): CrisisPhaseCondition {
  switch (crisis.phase) {
    case 'dormant':
      return crisis.activationCondition(ctx) ? 'building' : 'dormant';
    case 'building':
      return crisis.peakCondition(ctx) ? 'peak' : 'building';
    case 'peak':
      return crisis.reliefCondition(ctx) ? 'waning' : 'peak';
    case 'waning':
      // Waning exits when activation conditions no longer apply
      return crisis.activationCondition(ctx) ? 'waning' : 'dormant';
  }
}
```

**Step 4: Run, expect pass**

**Step 5: Commit**

```bash
git add src/ai/agents/crisis/crisisConditions.ts __tests__/crisis/crisisConditions.test.ts
git commit -m "feat: add condition-based crisis state machine (replaces tick counters)"
```

---

## Phase 1 Complete — Checkpoint

At this point:
- `SettlementSummary` struct exists (fixed-size agent input)
- DB schemas for `terrain_tiles` and `settlement_state` are defined
- Land grants, protected classes, building classification, mega-scaling configs are all tested
- Two-layer resource distribution pure function works
- Per-building tick and per-tile terrain tick are pure functions
- Crisis condition-based transitions replace tick counters

**All existing tests still pass** — nothing was modified, only new files added.

Run: `npm test -- --no-coverage`
Expected: All existing tests pass + 11 new test files pass.

---

## Phase 2: Stateless Tick Refactor (Tasks 12-18)

> **Goal:** Wire the pure functions from Phase 1 into the existing SimulationEngine tick loop. Replace `GovernorContext` with `SettlementSummary`. Make `ChaosEngine.generate()` read fixed-size counters instead of `timeline.getAllEvents()`. Update `FreeformGovernor` to use condition-based crisis transitions. Patch the diagnostic tests to use seeded RNG.

### Task 12: Wire SettlementSummary into GovernorContext

**Files:**
- Modify: `src/ai/agents/crisis/Governor.ts:74-91` — extend GovernorContext with SettlementSummary fields
- Modify: `src/game/SimulationEngine.ts:754-765` — build SettlementSummary and pass to Governor
- Test: `__tests__/crisis/governor-settlement-summary.test.ts`

This task connects the SettlementSummary from Task 1 to the existing Governor evaluation pipeline. GovernorContext gains the trend deltas and years-since counters. SimulationEngine builds the summary from current state (ECS resources + buildings + governor crisis tracking) and passes it through.

### Task 13: Remove timeline.getAllEvents() from ChaosEngine

**Files:**
- Modify: `src/ai/agents/crisis/ChaosEngine.ts` — replace `timeline.getAllEvents()` with fixed-size `ChaosState.yearsSinceLastX` counters
- Modify: `src/ai/agents/crisis/FreeformGovernor.ts` — maintain counter state, pass to ChaosEngine
- Test: `__tests__/crisis/chaos-engine-stateless.test.ts`

ChaosEngine currently reads timeline event history to compute years-since counters. This task pre-computes those counters in FreeformGovernor (O(1) state) and passes them via ChaosState, making ChaosEngine a pure function of fixed-size input.

### Task 14: Wire per-building tick into aggregate mode production

**Files:**
- Modify: `src/game/SimulationEngine.ts:834-863` — use `tickBuilding()` from Task 9 instead of inline computation
- Test: `__tests__/economy/buildingTick-integration.test.ts`

Replace the inline aggregate-mode production loop (step 7) with calls to the pure `tickBuilding()` function. Same result, but now testable in isolation.

### Task 15: Wire two-layer distribution into consumption

**Files:**
- Modify: `src/game/SimulationEngine.ts:922-960` — use `computeAllocation()` from Task 8 for food/vodka distribution
- Test: `__tests__/economy/allocation-integration.test.ts`

Replace the flat per-capita consumption with two-layer allocation. Existing `computeRoleBuckets` / `computeDistribution` from `distributionWeights.ts` can be replaced by the new `computeAllocation()`.

### Task 16: Patch Freeform diagnostic test with seeded RNG

**Files:**
- Modify: `__tests__/playthrough/16-diagnostic-freeform.test.ts` — use `seed: 'glorious-frozen-tractor'` instead of `deterministicRandom: true`
- Reduce simulation from 200 years to 50 years (keep test under 30s)

### Task 17: settlement_state DB writer

**Files:**
- Create: `src/db/settlementWriter.ts`
- Test: `__tests__/db/settlementWriter.test.ts`

Pure function that takes `SettlementSummary` + current ECS state and produces a `settlement_state` DB row. Called at end of each tick to update the single-row current state.

### Task 18: Remove Build toolbar buttons

**Files:**
- Modify: `src/ui/Toolbar.tsx` — remove BUILD tab and building placement tools
- Modify: `src/App.web.tsx` — remove build-related props and state

The player doesn't build anything. They set policies. Remove the BUILD tab from the Toolbar UI. Keep MANDATES | WORKERS | REPORTS | PURGE. This is a user-requested removal — the building controls were "intentionally killed."

---

## Phase 3: Building Lifecycle + Dvory Motivation (Tasks 19-24)

> **Goal:** Buildings evolve emergently. Government expands from center, displaces expendables. Dvory seek shelter → food → party. Displaced dvory pathfind to housing.

### Task 19: Building displacement system

Implements the protected covenant demolition cascade: when a protected building needs space, expendable buildings are demolished, residents ejected as displaced dvory.

### Task 20: Dvory motivation agent (shelter → food → party)

Creates the DvorMotivationSystem that drives unhoused dvory to pathfind toward nearest housing with capacity.

### Task 21: Building tier (mega-scaling) system

Implements the scaling-up trigger logic: when demand exceeds capacity and era allows, buildings scale UP instead of building more small structures.

### Task 22: Multi-function HQ decomposition

Starting state is one multi-function settlement HQ. When government agents decide they need dedicated buildings, the HQ decomposes into single-purpose buildings.

### Task 23: Nomenclatura priority housing

Government officials, military officers, KGB agents immediately claim priority space when displaced, pushing others out.

### Task 24: Displacement cascade integration test

End-to-end test: government demolishes housing → dvory ejected → pathfind → eventually re-housed → absorbed to aggregate.

---

## Phase 4: Terrain + Prestige Projects (Tasks 25-30)

> **Goal:** Landscape changes over time. Politburo demands prestige projects.

### Task 25: terrain_tiles DB writer + yearly tick integration
### Task 26: Deforestation + erosion processes
### Task 27: Meteor strike → Open-Pit Mine conversion
### Task 28: Contamination zones (Chernobyl-style)
### Task 29: Prestige project definitions (era-locked)
### Task 30: Prestige project lifecycle (demand → construction → success/failure)

---

## Phase 5: Government HQ Policy UI (Tasks 31-36)

> **Goal:** Government HQ is the player's primary interface. Each agency has its own tab.

### Task 31: GovernmentHQ component skeleton (6 agency tabs)
### Task 32: Gosplan tab — allocation sliders
### Task 33: Central Committee tab — directive decrees with lock-in
### Task 34: KGB tab — read-only reports
### Task 35: Military tab — posture setting
### Task 36: Politburo tab — demands + prestige project status

---

## Phase 6: Performance + Infinite Map (Tasks 37-42)

> **Goal:** DB-backed viewport rendering. Only visible buildings loaded to ECS. Scales to 10,000+ years.

### Task 37: Viewport spatial query (camera → DB → ECS entity loading)
### Task 38: Off-screen building tick (DB-only state updates)
### Task 39: Dynamic map expansion via land grants
### Task 40: Freeform endless mode (no map size limit)
### Task 41: Performance benchmark test (1000+ years in <60s)
### Task 42: Global warming terrain effects (Freeform centuries)

---

## Cross-Cutting Concerns

### Serialization

Every new system must implement save/load via `SubsystemSaveData`. DB tables are the canonical state — ECS entities are derived.

### Test Strategy

All new logic is TDD: failing test → minimal implementation → pass → commit. Integration tests use `createPlaythroughEngine()` with `seed: 'glorious-frozen-tractor'` for deterministic RNG.

### Merge Safety

Phase 1 adds only new files (zero conflicts with existing code). Phase 2 modifies SimulationEngine tick loop (sequential, not parallel). Phases 3-6 can potentially run in parallel with careful file coordination.

---

## Verification

After all 42 tasks:

1. `npm test -- --no-coverage` — All existing + new tests pass
2. `expo start --web` — Game loads, plays through
3. No BUILD toolbar — player uses Government HQ policies
4. Historical mode: 80 years in <15s (diagnostic test)
5. Freeform mode: 200+ years without timeout or memory growth
6. Buildings visually scale when era allows and population demands
7. Displaced dvory visible wandering at small scale
8. Terrain changes over decades (deforestation, contamination)

---

## Execution

Plan complete and saved to `docs/plans/2026-03-03-soviet-allocation-engine-plan.md`.
