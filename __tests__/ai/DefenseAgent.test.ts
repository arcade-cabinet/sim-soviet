/**
 * @fileoverview DefenseAgent unit tests.
 *
 * Tests fire spread probability, fire station suppression, disease outbreak
 * probability by season, medical building prevention, zeppelin AI decisions,
 * emergency state tracking, and serialization round-trip.
 *
 * The ECS world and archetypes are mocked so tests run without a full sim.
 */

import { DefenseAgent, DISEASE_DEFINITIONS } from '../../src/ai/agents/social/DefenseAgent';
import type { DiseaseDefinition, ZeppelinState } from '../../src/ai/agents/social/DefenseAgent';
import { WeatherType } from '../../src/ai/agents/core/weather-types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Minimal entity shapes for fire/disease tests
type MockBuilding = {
  defId: string;
  onFire: boolean;
  fireTicksRemaining?: number;
  powered?: boolean;
  constructionPhase?: string;
  housingCap?: number;
};

type MockEntity = {
  position: { gridX: number; gridY: number };
  building: MockBuilding;
  durability?: { current: number; max: number };
  citizen?: { disease?: { type: string; ticksRemaining: number } | undefined };
};

// Shared mutable collections used by mocked archetypes
let mockBuildingEntities: MockEntity[] = [];
let mockOperationalEntities: MockEntity[] = [];
let mockCitizenEntities: MockEntity[] = [];
let mockHousingEntities: MockEntity[] = [];
let mockResourceStore: { resources: { population: number; food: number } } | null = null;

jest.mock('../../src/ecs/archetypes', () => ({
  get buildingsLogic() {
    return { entities: mockBuildingEntities };
  },
  get operationalBuildings() {
    return {
      entities: mockOperationalEntities,
      [Symbol.iterator]() {
        return mockOperationalEntities[Symbol.iterator]();
      },
    };
  },
  get citizens() {
    return {
      [Symbol.iterator]() {
        return mockCitizenEntities[Symbol.iterator]();
      },
    };
  },
  get housing() {
    return {
      [Symbol.iterator]() {
        return mockHousingEntities[Symbol.iterator]();
      },
    };
  },
  getResourceEntity: () => mockResourceStore,
}));

jest.mock('../../src/ecs/world', () => ({
  world: {
    reindex: jest.fn(),
    remove: jest.fn(),
  },
}));

jest.mock('../../src/config', () => ({
  GRID_SIZE: 30,
  social: {
    fire: {
      spreadChanceBase: 0.05,
      spreadRadius: 2,
      fireStationSuppression: 0.2,
      fireStationRadius: 5,
      durationMin: 30,
      durationMax: 60,
      damagePerTick: 3,
      rainFactor: 0.5,
      maxZeppelins: 2,
      zeppelinExtinguishTicks: 5,
      zeppelinSpeed: 0.5,
      zeppelinArrivalDist: 1.0,
    },
    disease: {
      baseOutbreakChance: 0.02,
      overcrowdingMult: 2.0,
      winterMult: 1.5,
      foodShortageThreshold: 0.3,
      foodShortageScurvyMult: 3.0,
      clinicReductionPerBuilding: 0.4,
      maxClinicReduction: 0.1,
      sickLaborMult: 0.5,
      definitions: {
        typhus: { spreadRate: 0.04, mortalityRate: 0.15, durationTicks: 90 },
        cholera: { spreadRate: 0.03, mortalityRate: 0.25, durationTicks: 60 },
        influenza: { spreadRate: 0.08, mortalityRate: 0.05, durationTicks: 30 },
        scurvy: { spreadRate: 0.06, mortalityRate: 0.03, durationTicks: 60 },
      },
    },
    gulag: {
      arrestChance: 0.1,
    },
  },
}));

jest.mock('../../src/game/Chronology', () => ({
  TICKS_PER_MONTH: 30,
  Season: {
    WINTER: 'winter',
    RASPUTITSA_SPRING: 'rasputitsa_spring',
    SHORT_SUMMER: 'short_summer',
    GOLDEN_WEEK: 'golden_week',
    STIFLING_HEAT: 'stifling_heat',
    EARLY_FROST: 'early_frost',
    RASPUTITSA_AUTUMN: 'rasputitsa_autumn',
  },
}));

// WeatherType now comes from core/weather-types.ts (real module, not mocked).

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeBuilding(overrides: Partial<MockEntity & { building: Partial<MockBuilding> }>): MockEntity {
  return {
    position: overrides.position ?? { gridX: 5, gridY: 5 },
    building: {
      defId: overrides.building?.defId ?? 'house',
      onFire: overrides.building?.onFire ?? false,
      fireTicksRemaining: overrides.building?.fireTicksRemaining,
      powered: overrides.building?.powered ?? true,
      constructionPhase: overrides.building?.constructionPhase ?? 'complete',
      housingCap: overrides.building?.housingCap ?? 0,
    },
    durability: overrides.durability,
    citizen: overrides.citizen,
  };
}

/** Deterministic RNG stub. */
function makeRng(value = 0.5) {
  return {
    random: jest.fn().mockReturnValue(value),
    int: jest.fn().mockImplementation((min: number, max: number) => Math.floor(min + (max - min) * value)),
    pick: jest.fn().mockImplementation(<T>(arr: T[]) => arr[0]),
  };
}

/** Minimal GameGrid stub. */
const mockGrid = {
  setCell: jest.fn(),
};

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockBuildingEntities = [];
  mockOperationalEntities = [];
  mockCitizenEntities = [];
  mockHousingEntities = [];
  mockResourceStore = null;
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('DefenseAgent', () => {
  describe('instantiation', () => {
    it('can be instantiated with name DefenseAgent', () => {
      const agent = new DefenseAgent();
      expect(agent.name).toBe('DefenseAgent');
    });

    it('exposes MSG constants', () => {
      expect(DefenseAgent.MSG.EMERGENCY_FIRE).toBe('EMERGENCY_FIRE');
      expect(DefenseAgent.MSG.DISEASE_OUTBREAK).toBe('DISEASE_OUTBREAK');
      expect(DefenseAgent.MSG.EMERGENCY_METEOR).toBe('EMERGENCY_METEOR');
    });
  });

  // ── Fire spread probability ─────────────────────────────────────────────────

  describe('fire spread probability', () => {
    it('does not spread when roll >= SPREAD_CHANCE_BASE (0.05)', () => {
      // Building at (5,5) is on fire; neighbor at (5,6) is not
      const burning = makeBuilding({
        position: { gridX: 5, gridY: 5 },
        building: { onFire: true, fireTicksRemaining: 40, defId: 'factory' },
        durability: { current: 100, max: 100 },
      });
      const neighbor = makeBuilding({
        position: { gridX: 5, gridY: 6 },
        building: { onFire: false, defId: 'house' },
      });

      mockBuildingEntities = [burning, neighbor];

      // Roll of 0.1 > 0.05 → no spread
      const rng = makeRng(0.1);
      const agent = new DefenseAgent(rng as unknown as import('../../src/game/SeedSystem').GameRng);
      agent.update(1, WeatherType.CLEAR, mockGrid as unknown as import('../../src/game/GameGrid').GameGrid, 1, 6);

      expect(neighbor.building.onFire).toBe(false);
    });

    it('spreads when roll < SPREAD_CHANCE_BASE (0.05)', () => {
      const burning = makeBuilding({
        position: { gridX: 5, gridY: 5 },
        building: { onFire: true, fireTicksRemaining: 40, defId: 'factory' },
        durability: { current: 100, max: 100 },
      });
      const neighbor = makeBuilding({
        position: { gridX: 5, gridY: 6 },
        building: { onFire: false, defId: 'house' },
      });

      mockBuildingEntities = [burning, neighbor];

      // Roll of 0.01 < 0.05 → spreads
      const rng = makeRng(0.01);
      const agent = new DefenseAgent(rng as unknown as import('../../src/game/SeedSystem').GameRng);
      agent.update(1, WeatherType.CLEAR, mockGrid as unknown as import('../../src/game/GameGrid').GameGrid, 1, 6);

      expect(neighbor.building.onFire).toBe(true);
    });

    it('rain halves spread chance (RAIN_FACTOR = 0.5)', () => {
      // With rain, effective spread = 0.05 * 0.5 = 0.025
      // Roll of 0.03 > 0.025 → no spread under rain
      const burning = makeBuilding({
        position: { gridX: 5, gridY: 5 },
        building: { onFire: true, fireTicksRemaining: 40, defId: 'factory' },
        durability: { current: 100, max: 100 },
      });
      const neighbor = makeBuilding({
        position: { gridX: 5, gridY: 6 },
        building: { onFire: false, defId: 'house' },
      });

      mockBuildingEntities = [burning, neighbor];

      const rng = makeRng(0.03);
      const agent = new DefenseAgent(rng as unknown as import('../../src/game/SeedSystem').GameRng);
      agent.update(1, WeatherType.RAIN, mockGrid as unknown as import('../../src/game/GameGrid').GameGrid, 1, 6);

      expect(neighbor.building.onFire).toBe(false);
    });

    it('fire does not spread beyond SPREAD_RADIUS = 2', () => {
      const burning = makeBuilding({
        position: { gridX: 5, gridY: 5 },
        building: { onFire: true, fireTicksRemaining: 40, defId: 'factory' },
        durability: { current: 100, max: 100 },
      });
      // Distance 3 — outside spread radius
      const farNeighbor = makeBuilding({
        position: { gridX: 5, gridY: 8 },
        building: { onFire: false, defId: 'house' },
      });

      mockBuildingEntities = [burning, farNeighbor];

      const rng = makeRng(0.001); // very low roll → would spread if in range
      const agent = new DefenseAgent(rng as unknown as import('../../src/game/SeedSystem').GameRng);
      agent.update(1, WeatherType.CLEAR, mockGrid as unknown as import('../../src/game/GameGrid').GameGrid, 1, 6);

      expect(farNeighbor.building.onFire).toBe(false);
    });
  });

  // ── Fire station suppression ────────────────────────────────────────────────

  describe('fire station suppression radius', () => {
    it('suppresses spread by 0.2× factor within radius 5', () => {
      // Effective chance with suppression = 0.05 * 0.2 = 0.01
      // Roll of 0.02 > 0.01 → no spread when suppressed
      const burning = makeBuilding({
        position: { gridX: 5, gridY: 5 },
        building: { onFire: true, fireTicksRemaining: 40, defId: 'factory' },
        durability: { current: 100, max: 100 },
      });
      const neighbor = makeBuilding({
        position: { gridX: 5, gridY: 6 },
        building: { onFire: false, defId: 'house' },
      });
      const station = makeBuilding({
        position: { gridX: 3, gridY: 3 }, // within radius 5 of (5,6)
        building: { defId: 'fire-station', onFire: false, powered: true },
      });

      mockBuildingEntities = [burning, neighbor];
      mockOperationalEntities = [station];

      // 0.02 > effective 0.01 (after suppression) → no spread
      const rng = makeRng(0.02);
      const agent = new DefenseAgent(rng as unknown as import('../../src/game/SeedSystem').GameRng);
      agent.update(1, WeatherType.CLEAR, mockGrid as unknown as import('../../src/game/GameGrid').GameGrid, 1, 6);

      expect(neighbor.building.onFire).toBe(false);
    });

    it('unpowered fire station does not suppress', () => {
      // Without powered station: effective chance = 0.05
      // Roll of 0.02 < 0.05 → spreads
      const burning = makeBuilding({
        position: { gridX: 5, gridY: 5 },
        building: { onFire: true, fireTicksRemaining: 40, defId: 'factory' },
        durability: { current: 100, max: 100 },
      });
      const neighbor = makeBuilding({
        position: { gridX: 5, gridY: 6 },
        building: { onFire: false, defId: 'house' },
      });
      const unpoweredStation = makeBuilding({
        position: { gridX: 3, gridY: 3 },
        building: { defId: 'fire-station', onFire: false, powered: false },
      });

      mockBuildingEntities = [burning, neighbor];
      mockOperationalEntities = [unpoweredStation];

      const rng = makeRng(0.02);
      const agent = new DefenseAgent(rng as unknown as import('../../src/game/SeedSystem').GameRng);
      agent.update(1, WeatherType.CLEAR, mockGrid as unknown as import('../../src/game/GameGrid').GameGrid, 1, 6);

      expect(neighbor.building.onFire).toBe(true);
    });
  });

  // ── Fire damage & self-extinguish ───────────────────────────────────────────

  describe('fire damage', () => {
    it('applies FIRE_DAMAGE_PER_TICK (3) to durability each tick', () => {
      const burning = makeBuilding({
        position: { gridX: 5, gridY: 5 },
        building: { onFire: true, fireTicksRemaining: 40, defId: 'factory' },
        durability: { current: 50, max: 100 },
      });

      mockBuildingEntities = [burning];

      const rng = makeRng(0.9); // high roll → no spread
      const agent = new DefenseAgent(rng as unknown as import('../../src/game/SeedSystem').GameRng);
      agent.update(1, WeatherType.CLEAR, mockGrid as unknown as import('../../src/game/GameGrid').GameGrid, 1, 6);

      expect(burning.durability!.current).toBe(47);
    });

    it('self-extinguishes when fireTicksRemaining reaches 0', () => {
      const burning = makeBuilding({
        position: { gridX: 5, gridY: 5 },
        building: { onFire: true, fireTicksRemaining: 1, defId: 'house' },
        durability: { current: 100, max: 100 },
      });

      mockBuildingEntities = [burning];

      const agent = new DefenseAgent();
      agent.update(1, WeatherType.CLEAR, mockGrid as unknown as import('../../src/game/GameGrid').GameGrid, 1, 6);

      expect(burning.building.onFire).toBe(false);
      expect(burning.building.fireTicksRemaining).toBe(0);
    });
  });

  // ── Disease outbreak probability by season ──────────────────────────────────

  describe('disease outbreak probability by season', () => {
    it('calcOutbreakModifier returns higher value in winter (month=1)', () => {
      const agent = new DefenseAgent();
      const typhus = DISEASE_DEFINITIONS.find((d) => d.type === 'typhus')!;
      const summerModifier = agent.calcOutbreakModifier(typhus, 7, 100, 50, 0.8);
      const winterModifier = agent.calcOutbreakModifier(typhus, 1, 100, 50, 0.8);
      expect(winterModifier).toBeGreaterThan(summerModifier);
    });

    it('influenza has zero modifier outside winter (winterOnly)', () => {
      const agent = new DefenseAgent();
      const influenza = DISEASE_DEFINITIONS.find((d) => d.type === 'influenza')!;
      const summerModifier = agent.calcOutbreakModifier(influenza, 7, 100, 50, 0.8);
      expect(summerModifier).toBe(0);
    });

    it('influenza has positive modifier in winter months', () => {
      const agent = new DefenseAgent();
      const influenza = DISEASE_DEFINITIONS.find((d) => d.type === 'influenza')!;
      const winterModifier = agent.calcOutbreakModifier(influenza, 12, 100, 50, 0.8);
      expect(winterModifier).toBeGreaterThan(0);
    });

    it('scurvy modifier triples with food shortage (foodRatio < 0.3)', () => {
      const agent = new DefenseAgent();
      const scurvy = DISEASE_DEFINITIONS.find((d) => d.type === 'scurvy')!;
      const normalModifier = agent.calcOutbreakModifier(scurvy, 6, 100, 50, 0.5);
      const shortageModifier = agent.calcOutbreakModifier(scurvy, 6, 100, 50, 0.1);
      expect(shortageModifier).toBeGreaterThan(normalModifier);
      expect(shortageModifier / normalModifier).toBeCloseTo(3.0, 5);
    });

    it('scurvy modifier is reduced 10× with food surplus (foodRatio >= 0.8)', () => {
      const agent = new DefenseAgent();
      const scurvy = DISEASE_DEFINITIONS.find((d) => d.type === 'scurvy')!;
      const normalModifier = agent.calcOutbreakModifier(scurvy, 6, 100, 50, 0.5);
      const surplusModifier = agent.calcOutbreakModifier(scurvy, 6, 100, 50, 0.9);
      expect(surplusModifier).toBeLessThan(normalModifier);
      expect(normalModifier / surplusModifier).toBeCloseTo(10, 5);
    });

    it('overcrowding doubles outbreak modifier', () => {
      const agent = new DefenseAgent();
      const cholera = DISEASE_DEFINITIONS.find((d) => d.type === 'cholera')!;
      // Summer month (no winter modifier); pop just at capacity vs overcrowded
      const normalModifier = agent.calcOutbreakModifier(cholera, 6, 100, 80, 0.8);
      const crowdedModifier = agent.calcOutbreakModifier(cholera, 6, 100, 120, 0.8);
      expect(crowdedModifier).toBeCloseTo(normalModifier * 2, 5);
    });
  });

  // ── Medical building prevention ─────────────────────────────────────────────

  describe('medical building prevention', () => {
    it('clinicPreventionFactor is 1.0 with no medical buildings', () => {
      const agent = new DefenseAgent();
      const typhus = DISEASE_DEFINITIONS.find((d) => d.type === 'typhus')!;
      const factor = agent.clinicPreventionFactor(typhus, new Map());
      expect(factor).toBe(1.0);
    });

    it('clinicPreventionFactor is 1.0 for scurvy (not prevented by clinics)', () => {
      const agent = new DefenseAgent();
      const scurvy = DISEASE_DEFINITIONS.find((d) => d.type === 'scurvy')!;
      const factor = agent.clinicPreventionFactor(scurvy, new Map([['hospital', 3]]));
      expect(factor).toBe(1.0);
    });

    it('one hospital gives factor = CLINIC_REDUCTION (0.4)', () => {
      const agent = new DefenseAgent();
      const typhus = DISEASE_DEFINITIONS.find((d) => d.type === 'typhus')!;
      const factor = agent.clinicPreventionFactor(typhus, new Map([['hospital', 1]]));
      expect(factor).toBeCloseTo(0.4, 5);
    });

    it('two hospitals give factor = 0.4^2 = 0.16', () => {
      const agent = new DefenseAgent();
      const cholera = DISEASE_DEFINITIONS.find((d) => d.type === 'cholera')!;
      const factor = agent.clinicPreventionFactor(cholera, new Map([['hospital', 2]]));
      expect(factor).toBeCloseTo(0.16, 5);
    });

    it('many hospitals are floored at MAX_CLINIC_REDUCTION (0.1)', () => {
      const agent = new DefenseAgent();
      const typhus = DISEASE_DEFINITIONS.find((d) => d.type === 'typhus')!;
      const factor = agent.clinicPreventionFactor(typhus, new Map([['hospital', 10]]));
      expect(factor).toBe(0.1);
    });

    it('polyclinic also reduces disease factor', () => {
      const agent = new DefenseAgent();
      const influenza = DISEASE_DEFINITIONS.find((d) => d.type === 'influenza')!;
      const noClinic = agent.clinicPreventionFactor(influenza, new Map());
      const withClinic = agent.clinicPreventionFactor(influenza, new Map([['polyclinic', 1]]));
      expect(withClinic).toBeLessThan(noClinic);
    });
  });

  // ── Zeppelin AI decisions ───────────────────────────────────────────────────

  describe('zeppelin AI decisions', () => {
    it('spawns a zeppelin when fire station is powered and building is on fire', () => {
      const burning = makeBuilding({
        position: { gridX: 10, gridY: 10 },
        building: { onFire: true, fireTicksRemaining: 40, defId: 'house' },
        durability: { current: 100, max: 100 },
      });
      const station = makeBuilding({
        position: { gridX: 5, gridY: 5 },
        building: { defId: 'fire-station', onFire: false, powered: true },
      });

      mockBuildingEntities = [burning];
      mockOperationalEntities = [station];

      const rng = makeRng(0.9); // high roll → no spread
      const agent = new DefenseAgent(rng as unknown as import('../../src/game/SeedSystem').GameRng);
      agent.update(1, WeatherType.CLEAR, mockGrid as unknown as import('../../src/game/GameGrid').GameGrid, 1, 6);

      expect(agent.getZeppelins().length).toBeGreaterThanOrEqual(1);
      expect(agent.getZeppelins()[0]!.phase).toBe('flying');
    });

    it('does not spawn a zeppelin when no fire station exists', () => {
      const burning = makeBuilding({
        position: { gridX: 10, gridY: 10 },
        building: { onFire: true, fireTicksRemaining: 40, defId: 'house' },
        durability: { current: 100, max: 100 },
      });

      mockBuildingEntities = [burning];
      mockOperationalEntities = []; // no station

      const agent = new DefenseAgent();
      agent.update(1, WeatherType.CLEAR, mockGrid as unknown as import('../../src/game/GameGrid').GameGrid, 1, 6);

      expect(agent.getZeppelins().length).toBe(0);
    });

    it('does not exceed MAX_ZEPPELINS (2)', () => {
      // Create 5 burning buildings
      const burningBuildings = Array.from({ length: 5 }, (_, i) =>
        makeBuilding({
          position: { gridX: i * 2, gridY: 10 },
          building: { onFire: true, fireTicksRemaining: 40, defId: 'house' },
          durability: { current: 100, max: 100 },
        }),
      );
      const station = makeBuilding({
        position: { gridX: 15, gridY: 5 },
        building: { defId: 'fire-station', onFire: false, powered: true },
      });

      mockBuildingEntities = burningBuildings;
      mockOperationalEntities = [station];

      const rng = makeRng(0.9);
      const agent = new DefenseAgent(rng as unknown as import('../../src/game/SeedSystem').GameRng);
      agent.update(1, WeatherType.CLEAR, mockGrid as unknown as import('../../src/game/GameGrid').GameGrid, 1, 6);

      expect(agent.getZeppelins().length).toBeLessThanOrEqual(2);
    });

    it('zeppelin transitions from flying to extinguishing when near target', () => {
      // Pre-seed a zeppelin almost at its target
      const agent = new DefenseAgent();
      const snapshot = {
        zeppelins: [
          {
            x: 9.6,
            y: 10,
            tx: 10,
            ty: 10,
            phase: 'flying' as const,
            extinguishTicks: 0,
          },
        ],
      };
      agent.restore(snapshot);

      const burning = makeBuilding({
        position: { gridX: 10, gridY: 10 },
        building: { onFire: true, fireTicksRemaining: 40, defId: 'house' },
        durability: { current: 100, max: 100 },
      });
      const station = makeBuilding({
        position: { gridX: 5, gridY: 5 },
        building: { defId: 'fire-station', onFire: false, powered: true },
      });

      mockBuildingEntities = [burning];
      mockOperationalEntities = [station];

      agent.update(1, WeatherType.CLEAR, mockGrid as unknown as import('../../src/game/GameGrid').GameGrid, 1, 6);

      expect(agent.getZeppelins()[0]!.phase).toBe('extinguishing');
    });
  });

  // ── Emergency state tracking ─────────────────────────────────────────────────

  describe('emergency state tracking', () => {
    it('reports 0 active fires when no buildings are burning', () => {
      const house = makeBuilding({ building: { onFire: false, defId: 'house' } });
      mockBuildingEntities = [house];

      const agent = new DefenseAgent();
      agent.update(1, WeatherType.CLEAR, mockGrid as unknown as import('../../src/game/GameGrid').GameGrid, 1, 6);

      expect(agent.getEmergencyState().activeFires).toBe(0);
    });

    it('reports correct active fire count after update', () => {
      const burning1 = makeBuilding({
        position: { gridX: 1, gridY: 1 },
        building: { onFire: true, fireTicksRemaining: 40, defId: 'house' },
        durability: { current: 100, max: 100 },
      });
      const burning2 = makeBuilding({
        position: { gridX: 20, gridY: 20 },
        building: { onFire: true, fireTicksRemaining: 40, defId: 'factory' },
        durability: { current: 100, max: 100 },
      });

      mockBuildingEntities = [burning1, burning2];

      const agent = new DefenseAgent();
      agent.update(1, WeatherType.CLEAR, mockGrid as unknown as import('../../src/game/GameGrid').GameGrid, 1, 6);

      expect(agent.getEmergencyState().activeFires).toBe(2);
    });

    it('getActiveFireCount() returns count of burning buildings', () => {
      const b1 = makeBuilding({ position: { gridX: 1, gridY: 1 }, building: { onFire: true, defId: 'house' } });
      const b2 = makeBuilding({ position: { gridX: 2, gridY: 2 }, building: { onFire: false, defId: 'house' } });
      const b3 = makeBuilding({ position: { gridX: 3, gridY: 3 }, building: { onFire: true, defId: 'factory' } });

      mockBuildingEntities = [b1, b2, b3];

      const agent = new DefenseAgent();
      expect(agent.getActiveFireCount()).toBe(2);
    });

    it('igniteAt() returns true on success and marks building on fire', () => {
      const house = makeBuilding({ position: { gridX: 5, gridY: 5 }, building: { onFire: false, defId: 'house' } });
      mockBuildingEntities = [house];

      const agent = new DefenseAgent();
      const result = agent.igniteAt(5, 5);

      expect(result).toBe(true);
      expect(house.building.onFire).toBe(true);
    });

    it('igniteAt() returns false when no building at coordinates', () => {
      mockBuildingEntities = [];
      const agent = new DefenseAgent();
      expect(agent.igniteAt(5, 5)).toBe(false);
    });

    it('igniteAt() returns false when building already on fire', () => {
      const burning = makeBuilding({ position: { gridX: 5, gridY: 5 }, building: { onFire: true, defId: 'house' } });
      mockBuildingEntities = [burning];
      const agent = new DefenseAgent();
      expect(agent.igniteAt(5, 5)).toBe(false);
    });
  });

  // ── Serialization round-trip ─────────────────────────────────────────────────

  describe('serialization round-trip', () => {
    it('serialize → restore preserves zeppelin state', () => {
      const agent = new DefenseAgent();
      // Pre-seed some zeppelins
      const initial: ZeppelinState[] = [
        { x: 3.5, y: 4.2, tx: 10, ty: 12, phase: 'flying', extinguishTicks: 0 },
        { x: 10, y: 12, tx: 10, ty: 12, phase: 'extinguishing', extinguishTicks: 3 },
      ];
      agent.restore({ zeppelins: initial });

      const snapshot = agent.serialize();
      expect(snapshot.zeppelins).toHaveLength(2);
      expect(snapshot.zeppelins[0]!.phase).toBe('flying');
      expect(snapshot.zeppelins[1]!.phase).toBe('extinguishing');
      expect(snapshot.zeppelins[1]!.extinguishTicks).toBe(3);

      const agent2 = new DefenseAgent();
      agent2.restore(snapshot);
      expect(agent2.getZeppelins()).toEqual(initial);
    });

    it('serialize returns independent copy (mutation does not affect original)', () => {
      const agent = new DefenseAgent();
      agent.restore({
        zeppelins: [{ x: 1, y: 2, tx: 5, ty: 6, phase: 'flying', extinguishTicks: 0 }],
      });

      const snap = agent.serialize();
      snap.zeppelins[0]!.x = 999;

      // Original should be unchanged
      expect(agent.getZeppelins()[0]!.x).toBe(1);
    });

    it('empty state serializes to empty zeppelins array', () => {
      const agent = new DefenseAgent();
      const snap = agent.serialize();
      expect(snap.zeppelins).toEqual([]);
    });
  });

  // ── DISEASE_DEFINITIONS sanity checks ─────────────────────────────────────

  describe('DISEASE_DEFINITIONS', () => {
    it('contains exactly 4 disease types', () => {
      expect(DISEASE_DEFINITIONS).toHaveLength(4);
    });

    it('typhus has 2% mortality', () => {
      const typhus = DISEASE_DEFINITIONS.find((d) => d.type === 'typhus')!;
      expect(typhus.mortalityRate).toBeCloseTo(0.02, 5);
    });

    it('cholera has 3% mortality', () => {
      const cholera = DISEASE_DEFINITIONS.find((d) => d.type === 'cholera')!;
      expect(cholera.mortalityRate).toBeCloseTo(0.03, 5);
    });

    it('influenza has 0.5% mortality', () => {
      const influenza = DISEASE_DEFINITIONS.find((d) => d.type === 'influenza')!;
      expect(influenza.mortalityRate).toBeCloseTo(0.005, 5);
    });

    it('scurvy has 0.3% mortality', () => {
      const scurvy = DISEASE_DEFINITIONS.find((d) => d.type === 'scurvy')!;
      expect(scurvy.mortalityRate).toBeCloseTo(0.003, 5);
    });

    it('influenza is winterOnly = true', () => {
      const influenza = DISEASE_DEFINITIONS.find((d) => d.type === 'influenza')!;
      expect(influenza.winterOnly).toBe(true);
    });

    it('scurvy is nutritional = true and has empty preventedBy', () => {
      const scurvy = DISEASE_DEFINITIONS.find((d) => d.type === 'scurvy')!;
      expect(scurvy.nutritional).toBe(true);
      expect(scurvy.preventedBy).toHaveLength(0);
    });
  });
});
