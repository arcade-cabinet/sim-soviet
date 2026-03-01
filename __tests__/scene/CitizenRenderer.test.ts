/**
 * Tests for CitizenRenderer data logic.
 *
 * Verifies that:
 * - Citizen class colors are defined for all classes
 * - The renderableCitizens archetype can be queried
 * - Citizen position data is accessible from ECS entities
 */

import { renderableCitizens } from '../../src/ecs/archetypes';
import { computeRenderSlot } from '../../src/ecs/factories/citizenFactories';
import { world } from '../../src/ecs/world';

describe('CitizenRenderer data', () => {
  afterEach(() => {
    // Clean up any entities added during tests
    for (const entity of [...world.entities]) {
      world.remove(entity);
    }
  });

  it('renderableCitizens archetype exists', () => {
    expect(renderableCitizens).toBeDefined();
    expect(renderableCitizens.entities).toBeInstanceOf(Array);
  });

  it('citizen entity with renderSlot appears in renderableCitizens', () => {
    const entity = world.add({
      position: { gridX: 5, gridY: 10 },
      citizen: {
        class: 'worker',
        happiness: 50,
        hunger: 20,
        gender: 'male',
        age: 30,
      },
      renderSlot: computeRenderSlot('worker', 'male', 30),
    });

    expect(renderableCitizens.entities).toContain(entity);
    expect(entity.position?.gridX).toBe(5);
    expect(entity.position?.gridY).toBe(10);
    expect(entity.citizen?.class).toBe('worker');
  });

  it('computeRenderSlot produces correct dot colors for all classes', () => {
    const classes = ['worker', 'party_official', 'engineer', 'farmer', 'soldier', 'prisoner'];
    for (const cls of classes) {
      const slot = computeRenderSlot(cls);
      expect(slot.dotColor).toBeTruthy();
      expect(slot.citizenClass).toBe(cls);
    }
  });

  it('citizen without renderSlot does NOT appear in renderableCitizens', () => {
    const entity = world.add({
      position: { gridX: 3, gridY: 7 },
      citizen: {
        class: 'farmer',
        happiness: 60,
        hunger: 10,
        gender: 'female',
        age: 45,
      },
    });

    expect(renderableCitizens.entities).not.toContain(entity);
  });
});
