/**
 * Universal Settlement Formation — tests that CollectiveAgent.tickAutonomous()
 * bootstraps correctly for ANY celestial body using the same code path.
 *
 * Earth: housing + farm near water (no dome needed)
 * Moon: pressurized shelter first, then demand-driven hydroponics
 * Mars: pressurized shelter first, then greenhouse farm
 */

import { CollectiveAgent } from '@/ai/agents/infrastructure/CollectiveAgent';
import { GRID_SIZE } from '@/config';
import { buildings } from '@/ecs/archetypes';
import { createGrid, createMetaStore, createResourceStore } from '@/ecs/factories';
import { world } from '@/ecs/world';
import { GameRng } from '@/game/SeedSystem';
import { getLocationResources } from '@/game/engine/locationResources';
import { createTestDvory } from '../playthrough/helpers';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeAgent(celestialBody: string): { agent: CollectiveAgent; rng: GameRng } {
  const agent = new CollectiveAgent();
  const rng = new GameRng(`test-${celestialBody}`);
  agent.setRng(rng);
  return { agent, rng };
}

function setupWorld(resources?: Partial<Record<string, number>>): void {
  world.clear();
  createGrid(GRID_SIZE);
  createResourceStore({
    food: 50,
    population: 10,
    timber: 500,
    steel: 100,
    cement: 50,
    ...resources,
  });
  createMetaStore();
  createTestDvory(10);
}

const noopCallbacks = {
  onToast: jest.fn(),
  onAdvisor: jest.fn(),
};
const noopRecord = jest.fn();

function tickUntilBootstrapped(agent: CollectiveAgent, celestialBody: string, maxTicks = 200): void {
  const rng = new GameRng(`tick-${celestialBody}`);
  for (let t = 1; t <= maxTicks; t++) {
    agent.tickAutonomous({
      totalTicks: t,
      rng,
      mandateState: null,
      eraId: 'revolution',
      callbacks: noopCallbacks,
      recordBuildingForMandates: noopRecord,
      celestialBody,
    });
    if (buildings.entities.length > 0) break;
  }
}

// ── Location Resources ──────────────────────────────────────────────────────

describe('getLocationResources', () => {
  it('returns breathable atmosphere for Earth', () => {
    const loc = getLocationResources('earth');
    expect(loc.atmosphereBreathable).toBe(true);
    expect(loc.waterAccess).toBe('rivers');
    expect(loc.soilValue).toBeGreaterThan(0.3);
    expect(loc.solarEfficiency).toBe(1.0);
  });

  it('returns non-breathable atmosphere for Moon', () => {
    const loc = getLocationResources('moon');
    expect(loc.atmosphereBreathable).toBe(false);
    expect(loc.waterAccess).toBe('ice');
    expect(loc.soilValue).toBe(0);
    expect(loc.mineralAbundance).toBeGreaterThan(0.5);
  });

  it('returns non-breathable atmosphere for Mars', () => {
    const loc = getLocationResources('mars');
    expect(loc.atmosphereBreathable).toBe(false);
    expect(loc.waterAccess).toBe('subsurface');
    expect(loc.soilValue).toBeGreaterThan(0);
    expect(loc.soilValue).toBeLessThanOrEqual(0.3);
    expect(loc.solarEfficiency).toBe(0.43);
  });

  it('returns hostile defaults for unknown body', () => {
    const loc = getLocationResources('unknown_planet_xyz');
    expect(loc.atmosphereBreathable).toBe(false);
    expect(loc.waterAccess).toBe('none');
    expect(loc.soilValue).toBe(0);
  });
});

// ── Earth Settlement ────────────────────────────────────────────────────────

describe('Universal Settlement: Earth', () => {
  beforeEach(() => setupWorld());
  afterEach(() => world.clear());

  it('places housing + farm on first bootstrap (no dome needed)', () => {
    const { agent } = makeAgent('earth');
    tickUntilBootstrapped(agent, 'earth');

    const placed = buildings.entities.map((e) => e.building.defId);
    expect(placed.length).toBeGreaterThanOrEqual(3);

    // Must have government HQ
    expect(placed).toContain('government-hq');

    // Must have housing
    const hasHousing = placed.some((id) => id.startsWith('workers-house'));
    expect(hasHousing).toBe(true);

    // Must have farm (Earth has soil > 0.3)
    expect(placed).toContain('collective-farm-hq');
  });

  it('does NOT show pressurization toast on Earth', () => {
    const { agent } = makeAgent('earth');
    const callbacks = { onToast: jest.fn(), onAdvisor: jest.fn() };
    const rng = new GameRng('earth-toast-test');
    for (let t = 1; t <= 200; t++) {
      agent.tickAutonomous({
        totalTicks: t,
        rng,
        mandateState: null,
        eraId: 'revolution',
        callbacks,
        recordBuildingForMandates: noopRecord,
        celestialBody: 'earth',
      });
      if (buildings.entities.length > 0) break;
    }
    const toastCalls = callbacks.onToast.mock.calls.map((c: any[]) => c[0] as string);
    expect(toastCalls.some((msg) => msg.includes('pressurized'))).toBe(false);
  });
});

// ── Moon Settlement ─────────────────────────────────────────────────────────

describe('Universal Settlement: Moon', () => {
  beforeEach(() => setupWorld());
  afterEach(() => world.clear());

  it('places government HQ + housing (pressurized context), no farm', () => {
    const { agent } = makeAgent('moon');
    tickUntilBootstrapped(agent, 'moon');

    const placed = buildings.entities.map((e) => e.building.defId);
    expect(placed.length).toBeGreaterThanOrEqual(2);

    // Must have government HQ
    expect(placed).toContain('government-hq');

    // Must have housing
    const hasHousing = placed.some((id) => id.startsWith('workers-house'));
    expect(hasHousing).toBe(true);

    // Must NOT have farm (Moon soilValue === 0)
    expect(placed).not.toContain('collective-farm-hq');
  });

  it('shows pressurization toast on Moon', () => {
    const { agent } = makeAgent('moon');
    const callbacks = { onToast: jest.fn(), onAdvisor: jest.fn() };
    const rng = new GameRng('moon-toast-test');
    for (let t = 1; t <= 200; t++) {
      agent.tickAutonomous({
        totalTicks: t,
        rng,
        mandateState: null,
        eraId: 'revolution',
        callbacks,
        recordBuildingForMandates: noopRecord,
        celestialBody: 'moon',
      });
      if (buildings.entities.length > 0) break;
    }
    const toastCalls = callbacks.onToast.mock.calls.map((c: any[]) => c[0] as string);
    expect(toastCalls.some((msg) => msg.includes('pressurized'))).toBe(true);
  });
});

// ── Mars Settlement ─────────────────────────────────────────────────────────

describe('Universal Settlement: Mars', () => {
  beforeEach(() => setupWorld());
  afterEach(() => world.clear());

  it('places government HQ + housing, no farm (Mars soil <= 0.3)', () => {
    const { agent } = makeAgent('mars');
    tickUntilBootstrapped(agent, 'mars');

    const placed = buildings.entities.map((e) => e.building.defId);
    expect(placed.length).toBeGreaterThanOrEqual(2);

    // Must have government HQ
    expect(placed).toContain('government-hq');

    // Must have housing
    const hasHousing = placed.some((id) => id.startsWith('workers-house'));
    expect(hasHousing).toBe(true);

    // Mars has soilValue = 0.15 (greenhouse * 0.5 * 0.3) which is <= 0.3, so no farm
    // Food will come through demand system once hydroponics/greenhouse buildings exist
    expect(placed).not.toContain('collective-farm-hq');
  });

  it('shows pressurization toast on Mars', () => {
    const { agent } = makeAgent('mars');
    const callbacks = { onToast: jest.fn(), onAdvisor: jest.fn() };
    const rng = new GameRng('mars-toast-test');
    for (let t = 1; t <= 200; t++) {
      agent.tickAutonomous({
        totalTicks: t,
        rng,
        mandateState: null,
        eraId: 'revolution',
        callbacks,
        recordBuildingForMandates: noopRecord,
        celestialBody: 'mars',
      });
      if (buildings.entities.length > 0) break;
    }
    const toastCalls = callbacks.onToast.mock.calls.map((c: any[]) => c[0] as string);
    expect(toastCalls.some((msg) => msg.includes('pressurized'))).toBe(true);
  });
});

// ── Same Code Path ──────────────────────────────────────────────────────────

describe('Universal Settlement: Same Code Path', () => {
  afterEach(() => world.clear());

  it('all bodies use CollectiveAgent.tickAutonomous — no separate bootstrap', () => {
    for (const body of ['earth', 'moon', 'mars']) {
      setupWorld();
      const { agent } = makeAgent(body);
      tickUntilBootstrapped(agent, body);

      // Every body should have at least government-hq + housing
      const placed = buildings.entities.map((e) => e.building.defId);
      expect(placed).toContain('government-hq');
      expect(placed.some((id) => id.startsWith('workers-house'))).toBe(true);

      world.clear();
    }
  });
});
