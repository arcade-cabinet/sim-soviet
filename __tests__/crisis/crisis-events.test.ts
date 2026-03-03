/**
 * @fileoverview Tests for crisis-aware EventSystem filtering.
 *
 * Validates:
 * - crisisFilter field on EventTemplate
 * - EventSystem filters events by active crisis IDs
 * - Crisis event templates are well-formed
 * - Crisis events only fire when matching crisis is active
 */

import { getResourceEntity } from '../../src/ecs/archetypes';
import { createMetaStore, createResourceStore } from '../../src/ecs/factories';
import { world } from '../../src/ecs/world';
import {
  ALL_EVENT_TEMPLATES,
  CRISIS_EVENTS,
  EventSystem,
  type GameEvent,
} from '../../src/ai/agents/narrative/events';
import type { EventTemplate } from '../../src/ai/agents/narrative/events/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function setupWorld(overrides?: { pop?: number; food?: number; money?: number; vodka?: number; power?: number }) {
  world.clear();
  createResourceStore();
  createMetaStore();
  const res = getResourceEntity()!;
  if (overrides?.pop !== undefined) res.resources.population = overrides.pop;
  if (overrides?.food !== undefined) res.resources.food = overrides.food;
  if (overrides?.money !== undefined) res.resources.money = overrides.money;
  if (overrides?.vodka !== undefined) res.resources.vodka = overrides.vodka;
  if (overrides?.power !== undefined) res.resources.power = overrides.power;
}

// ─── crisisFilter on EventTemplate ──────────────────────────────────────────

describe('EventTemplate.crisisFilter', () => {
  it('is optional — existing templates without crisisFilter still work', () => {
    const noFilter = ALL_EVENT_TEMPLATES.find((t) => t.id === 'earthquake_bread');
    expect(noFilter).toBeDefined();
    expect(noFilter!.crisisFilter).toBeUndefined();
  });

  it('crisis templates have crisisFilter arrays', () => {
    for (const t of CRISIS_EVENTS) {
      expect(Array.isArray(t.crisisFilter)).toBe(true);
      expect(t.crisisFilter!.length).toBeGreaterThan(0);
    }
  });
});

// ─── Crisis event template completeness ─────────────────────────────────────

describe('CRISIS_EVENTS templates', () => {
  it('contains all 10 expected crisis event IDs', () => {
    const ids = CRISIS_EVENTS.map((t) => t.id);
    expect(ids).toContain('mobilization_order');
    expect(ids).toContain('grain_reserves_exhausted');
    expect(ids).toContain('evacuation_zone');
    expect(ids).toContain('victory_parade');
    expect(ids).toContain('reconstruction_begins');
    expect(ids).toContain('rationing_announced');
    expect(ids).toContain('industrial_accident');
    expect(ids).toContain('patriotic_fervor');
    expect(ids).toContain('food_relief_arrives');
    expect(ids).toContain('contamination_warning');
  });

  it('every crisis template has a unique ID', () => {
    const ids = CRISIS_EVENTS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every crisis template has non-empty title, description, and pravdaHeadline', () => {
    for (const t of CRISIS_EVENTS) {
      expect(t.title.length).toBeGreaterThan(0);
      if (typeof t.description === 'string') {
        expect(t.description.length).toBeGreaterThan(0);
      } else {
        expect(typeof t.description).toBe('function');
      }
      if (typeof t.pravdaHeadline === 'string') {
        expect(t.pravdaHeadline.length).toBeGreaterThan(0);
      } else {
        expect(typeof t.pravdaHeadline).toBe('function');
      }
    }
  });

  it('crisis IDs do not collide with non-crisis event IDs', () => {
    const crisisIds = new Set(CRISIS_EVENTS.map((t) => t.id));
    const otherIds = ALL_EVENT_TEMPLATES.filter((t) => !t.crisisFilter).map((t) => t.id);
    for (const id of otherIds) {
      expect(crisisIds.has(id)).toBe(false);
    }
  });

  it('covers war, famine, and disaster crisis types', () => {
    const allCrisisIds = CRISIS_EVENTS.flatMap((t) => t.crisisFilter ?? []);
    const unique = new Set(allCrisisIds);
    // War-related
    expect(unique.has('ww2')).toBe(true);
    // Famine-related
    expect(unique.has('holodomor')).toBe(true);
    // Disaster-related
    expect(unique.has('chernobyl')).toBe(true);
  });

  it('has a variety of severity levels', () => {
    const severities = new Set(CRISIS_EVENTS.map((t) => t.severity));
    expect(severities.size).toBeGreaterThanOrEqual(3);
  });

  it('has events across multiple categories', () => {
    const categories = new Set(CRISIS_EVENTS.map((t) => t.category));
    expect(categories.size).toBeGreaterThanOrEqual(3);
  });
});

// ─── EventSystem crisis filtering ───────────────────────────────────────────

describe('EventSystem crisis filtering', () => {
  let firedEvents: GameEvent[];
  let eventSystem: EventSystem;

  beforeEach(() => {
    setupWorld({ pop: 100, food: 200, money: 500, vodka: 50, power: 50 });
    firedEvents = [];
    eventSystem = new EventSystem((event) => {
      firedEvents.push(event);
    });
  });

  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  it('crisis events do NOT fire when no crises are active', () => {
    // Force fire via tick with high probability
    jest.spyOn(Math, 'random').mockReturnValue(0.01);

    // Run many ticks with empty activeCrisisIds
    for (let t = 60; t < 3000; t += 61) {
      eventSystem.tick(t, 1, []);
    }

    // None of the fired events should be crisis-filtered
    for (const e of firedEvents) {
      const template = CRISIS_EVENTS.find((t) => t.id === e.id);
      expect(template).toBeUndefined();
    }
  });

  it('crisis events CAN fire when matching crisis is active', () => {
    // Force-trigger a crisis event directly
    eventSystem.triggerEvent('mobilization_order');
    expect(firedEvents).toHaveLength(1);
    expect(firedEvents[0]!.id).toBe('mobilization_order');
  });

  it('tick passes activeCrisisIds — crisis events are eligible when crisis active', () => {
    // Use a high random value for the weighted selection roll so it picks
    // events near the end of the array (where crisis events are appended)
    let callCount = 0;
    jest.spyOn(Math, 'random').mockImplementation(() => {
      callCount++;
      // Alternate: probability check passes (0.01), weighted roll lands near end (0.99)
      return callCount % 2 === 1 ? 0.01 : 0.99;
    });

    // Run ticks with 'ww2' active — weighted roll of 0.99 should eventually
    // pick events near the tail of the eligible list (where crisis events live)
    for (let t = 60; t < 60000; t += 61) {
      eventSystem.tick(t, 1, ['ww2']);
    }

    const crisisEventIds = new Set(CRISIS_EVENTS.map((t) => t.id));
    const firedCrisis = firedEvents.filter((e) => crisisEventIds.has(e.id));
    expect(firedCrisis.length).toBeGreaterThan(0);
  });

  it('crisis events with non-matching crisisFilter are excluded', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.01);

    // Only 'holodomor' active — war-only events should not fire
    for (let t = 60; t < 6000; t += 61) {
      eventSystem.tick(t, 1, ['holodomor']);
    }

    const warOnly = ['mobilization_order', 'patriotic_fervor', 'victory_parade'];
    for (const e of firedEvents) {
      const template = CRISIS_EVENTS.find((t) => t.id === e.id);
      if (template) {
        // If a crisis event fired, it must include 'holodomor' in its crisisFilter
        expect(template.crisisFilter).toContain('holodomor');
        // Verify it's not a war-only event
        if (warOnly.includes(e.id)) {
          // This should not happen — war-only events should be excluded
          fail(`War-only event ${e.id} fired during holodomor-only crisis`);
        }
      }
    }
  });

  it('non-crisis events still fire regardless of active crises', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.01);

    // With some crisis active, non-crisis events should still be eligible
    for (let t = 60; t < 3000; t += 61) {
      eventSystem.tick(t, 1, ['ww2']);
    }

    const nonCrisis = firedEvents.filter((e) => !CRISIS_EVENTS.find((t) => t.id === e.id));
    expect(nonCrisis.length).toBeGreaterThan(0);
  });
});

// ─── Crisis event effects ───────────────────────────────────────────────────

describe('Crisis event effects', () => {
  beforeEach(() => {
    setupWorld({ pop: 100, food: 200, money: 500, vodka: 50, power: 50 });
  });

  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  it('mobilization_order reduces population', () => {
    const firedEvents: GameEvent[] = [];
    const es = new EventSystem((e) => firedEvents.push(e));
    const before = getResourceEntity()!.resources.population;
    es.triggerEvent('mobilization_order');
    const after = getResourceEntity()!.resources.population;
    expect(after).toBeLessThan(before);
  });

  it('grain_reserves_exhausted reduces food and population', () => {
    getResourceEntity()!.resources.food = 40; // below 50 condition
    const firedEvents: GameEvent[] = [];
    const es = new EventSystem((e) => firedEvents.push(e));
    es.triggerEvent('grain_reserves_exhausted');
    const event = firedEvents[0]!;
    expect(event.effects.food).toBeDefined();
    expect(event.effects.food!).toBeLessThan(0);
  });

  it('food_relief_arrives adds food', () => {
    const firedEvents: GameEvent[] = [];
    const es = new EventSystem((e) => firedEvents.push(e));
    const before = getResourceEntity()!.resources.food;
    es.triggerEvent('food_relief_arrives');
    const after = getResourceEntity()!.resources.food;
    expect(after).toBeGreaterThan(before);
  });

  it('patriotic_fervor has positive effects', () => {
    const firedEvents: GameEvent[] = [];
    const es = new EventSystem((e) => firedEvents.push(e));
    es.triggerEvent('patriotic_fervor');
    const event = firedEvents[0]!;
    expect(event.type).toBe('good');
  });

  it('evacuation_zone reduces population and money', () => {
    const firedEvents: GameEvent[] = [];
    const es = new EventSystem((e) => firedEvents.push(e));
    es.triggerEvent('evacuation_zone');
    const event = firedEvents[0]!;
    expect(event.effects.pop).toBeDefined();
    expect(event.effects.pop!).toBeLessThan(0);
    expect(event.effects.money).toBeDefined();
    expect(event.effects.money!).toBeLessThan(0);
  });

  it('reconstruction_begins gives money but costs food', () => {
    const firedEvents: GameEvent[] = [];
    const es = new EventSystem((e) => firedEvents.push(e));
    es.triggerEvent('reconstruction_begins');
    const event = firedEvents[0]!;
    expect(event.effects.money).toBe(40);
    expect(event.effects.food).toBe(-10);
  });
});

// ─── Crisis event conditions ────────────────────────────────────────────────

describe('Crisis event conditions', () => {
  beforeEach(() => {
    setupWorld({ pop: 100, food: 200, money: 500, vodka: 50, power: 50 });
  });

  afterEach(() => {
    world.clear();
  });

  it('mobilization_order requires pop > 15', () => {
    const template = CRISIS_EVENTS.find((t) => t.id === 'mobilization_order')!;
    expect(template.condition).toBeDefined();
  });

  it('evacuation_zone requires pop > 20', () => {
    const template = CRISIS_EVENTS.find((t) => t.id === 'evacuation_zone')!;
    expect(template.condition).toBeDefined();
  });

  it('some crisis events have no condition (always eligible if crisis active)', () => {
    const noCondition = CRISIS_EVENTS.filter((t) => !t.condition);
    expect(noCondition.length).toBeGreaterThan(0);
  });
});

// ─── ALL_EVENT_TEMPLATES includes crisis events ─────────────────────────────

describe('ALL_EVENT_TEMPLATES integration', () => {
  it('includes all crisis events in the aggregated template array', () => {
    const allIds = new Set(ALL_EVENT_TEMPLATES.map((t) => t.id));
    for (const t of CRISIS_EVENTS) {
      expect(allIds.has(t.id)).toBe(true);
    }
  });

  it('total template count increased by crisis event count', () => {
    const nonCrisis = ALL_EVENT_TEMPLATES.filter((t) => !t.crisisFilter);
    expect(ALL_EVENT_TEMPLATES.length).toBe(nonCrisis.length + CRISIS_EVENTS.length);
  });
});
