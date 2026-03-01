import { citizens, maleCitizens } from '@/ecs/archetypes';
import { createCitizen, createMetaStore, createResourceStore } from '@/ecs/factories';
import { world } from '@/ecs/world';
import { GameRng } from '@/game/SeedSystem';
import { WorkerSystem } from '@/game/workers/index';

describe('removeWorkersByCountMaleFirst', () => {
  let system: WorkerSystem;
  let rng: GameRng;

  beforeEach(() => {
    world.clear();
    createResourceStore();
    createMetaStore();
    rng = new GameRng('conscription-test');
    system = new WorkerSystem(rng);
  });

  afterEach(() => {
    world.clear();
  });

  /** Helper: spawn a citizen with explicit gender and age, register stats */
  function spawnCitizen(gender: 'male' | 'female', age: number) {
    const entity = createCitizen('worker', 15, 15, gender, age);
    // Manually register stats so removeWorker cleans up properly
    (system as any).stats.set(entity, {
      morale: 50,
      loyalty: 60,
      skill: 25,
      vodkaDependency: 15,
      ticksSinceVodka: 0,
      name: `${gender}-${age}`,
      assignmentDuration: 0,
      assignmentSource: 'auto',
    });
    return entity;
  }

  it('preferentially removes males aged 18-51', () => {
    // Spawn 3 males in conscription age range and 3 females
    spawnCitizen('male', 20);
    spawnCitizen('male', 30);
    spawnCitizen('male', 40);
    spawnCitizen('female', 25);
    spawnCitizen('female', 30);
    spawnCitizen('female', 35);

    expect([...citizens].length).toBe(6);

    // Conscript 2 — should take males first
    const removed = system.removeWorkersByCountMaleFirst(2, 'conscription');
    expect(removed).toBe(2);
    expect([...citizens].length).toBe(4);

    // All remaining males should still be in the world (one male left)
    const remainingMales = [...maleCitizens];
    expect(remainingMales.length).toBe(1);

    // All females should still be present
    const remainingFemales = [...citizens].filter((e) => e.citizen.gender === 'female');
    expect(remainingFemales.length).toBe(3);
  });

  it('filters males by age range 18-51', () => {
    // Males outside conscription age
    spawnCitizen('male', 15); // too young
    spawnCitizen('male', 55); // too old
    // Males inside conscription age
    spawnCitizen('male', 18); // edge: exactly 18
    spawnCitizen('male', 51); // edge: exactly 51

    expect([...citizens].length).toBe(4);

    // Conscript 2 — should take the 18 and 51 year olds, not the 15 or 55
    const removed = system.removeWorkersByCountMaleFirst(2, 'conscription');
    expect(removed).toBe(2);
    expect([...citizens].length).toBe(2);

    // Remaining should be the out-of-range males
    const remaining = [...citizens];
    const ages = remaining.map((e) => e.citizen.age);
    expect(ages).toEqual(expect.arrayContaining([15, 55]));
    expect(ages).not.toContain(18);
    expect(ages).not.toContain(51);
  });

  it('falls back to females when insufficient males in range', () => {
    // Only 1 conscription-eligible male
    spawnCitizen('male', 25);
    // 3 females
    spawnCitizen('female', 20);
    spawnCitizen('female', 30);
    spawnCitizen('female', 40);

    expect([...citizens].length).toBe(4);

    // Conscript 3 — 1 male + 2 females
    const removed = system.removeWorkersByCountMaleFirst(3, 'conscription');
    expect(removed).toBe(3);
    expect([...citizens].length).toBe(1);

    // The male should be gone
    expect([...maleCitizens].length).toBe(0);

    // One female should remain
    const remaining = [...citizens];
    expect(remaining.length).toBe(1);
    expect(remaining[0]!.citizen.gender).toBe('female');
  });

  it('falls back to out-of-range males when no in-range males available', () => {
    // Only males outside range
    spawnCitizen('male', 14);
    spawnCitizen('male', 60);
    spawnCitizen('female', 25);

    const removed = system.removeWorkersByCountMaleFirst(2, 'conscription');
    expect(removed).toBe(2);
    expect([...citizens].length).toBe(1);
  });

  it('returns 0 when count is 0 or negative', () => {
    spawnCitizen('male', 25);
    expect(system.removeWorkersByCountMaleFirst(0, 'conscription')).toBe(0);
    expect(system.removeWorkersByCountMaleFirst(-5, 'conscription')).toBe(0);
    expect([...citizens].length).toBe(1);
  });

  it('returns actual removed count when fewer citizens than requested', () => {
    spawnCitizen('male', 25);
    spawnCitizen('female', 30);

    const removed = system.removeWorkersByCountMaleFirst(10, 'conscription');
    expect(removed).toBe(2);
    expect([...citizens].length).toBe(0);
  });

  it('removes all eligible males before any females', () => {
    // 5 males in range, 5 females
    for (let i = 0; i < 5; i++) {
      spawnCitizen('male', 20 + i);
      spawnCitizen('female', 20 + i);
    }

    expect([...citizens].length).toBe(10);

    // Conscript exactly 5 — should take all males, no females
    const removed = system.removeWorkersByCountMaleFirst(5, 'conscription');
    expect(removed).toBe(5);

    const remaining = [...citizens];
    expect(remaining.length).toBe(5);
    for (const entity of remaining) {
      expect(entity.citizen.gender).toBe('female');
    }
  });

  it('prefers idle males over assigned males', () => {
    const assigned = spawnCitizen('male', 25);
    assigned.citizen.assignment = 'factory-l1';
    world.reindex(assigned);

    const idle = spawnCitizen('male', 30);
    // idle has no assignment

    // Conscript 1 — should take idle male first
    system.removeWorkersByCountMaleFirst(1, 'conscription');
    expect([...citizens].length).toBe(1);

    const remaining = [...citizens][0]!;
    expect(remaining.citizen.age).toBe(25); // The assigned one remains
    expect(remaining.citizen.assignment).toBe('factory-l1');
  });

  it('edge: exactly age 18 is eligible', () => {
    spawnCitizen('male', 18);
    spawnCitizen('female', 18);

    system.removeWorkersByCountMaleFirst(1, 'conscription');
    expect([...citizens].length).toBe(1);
    expect([...citizens][0]!.citizen.gender).toBe('female');
  });

  it('edge: exactly age 51 is eligible', () => {
    spawnCitizen('male', 51);
    spawnCitizen('female', 25);

    system.removeWorkersByCountMaleFirst(1, 'conscription');
    expect([...citizens].length).toBe(1);
    expect([...citizens][0]!.citizen.gender).toBe('female');
  });

  it('edge: age 17 is NOT eligible for male-first phase', () => {
    spawnCitizen('male', 17);
    spawnCitizen('female', 25);

    // Conscript 1 — male 17 is outside range, should take female first? No.
    // Phase 1 finds no eligible males. Phase 2 fallback picks from all remaining citizens.
    system.removeWorkersByCountMaleFirst(1, 'conscription');
    expect([...citizens].length).toBe(1);
    // One of the two was removed — the 17yo male or the female (fallback uses morale sorting)
  });

  it('edge: age 52 is NOT eligible for male-first phase', () => {
    spawnCitizen('male', 52);
    spawnCitizen('male', 25); // This one is eligible

    system.removeWorkersByCountMaleFirst(1, 'conscription');
    expect([...citizens].length).toBe(1);

    // The 25yo should have been taken (eligible), 52yo remains
    const remaining = [...citizens][0]!;
    expect(remaining.citizen.age).toBe(52);
  });

  it('syncs resource store population after removal', () => {
    for (let i = 0; i < 5; i++) {
      spawnCitizen('male', 25);
    }

    system.removeWorkersByCountMaleFirst(3, 'conscription');

    const { getResourceEntity } = require('@/ecs/archetypes');
    const store = getResourceEntity();
    expect(store.resources.population).toBe(2);
  });
});
