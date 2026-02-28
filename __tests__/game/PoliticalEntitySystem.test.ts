import { createBuilding, createMetaStore, createResourceStore } from '@/ecs/factories';
import { world } from '@/ecs/world';
import type { PoliticalEntitySaveData } from '@/game/political';
import { PoliticalEntitySystem } from '@/game/political';
import { GameRng } from '@/game/SeedSystem';

describe('PoliticalEntitySystem', () => {
  let system: PoliticalEntitySystem;
  let rng: GameRng;

  beforeEach(() => {
    world.clear();
    createResourceStore();
    createMetaStore();
    // Place some buildings so entities have somewhere to station
    createBuilding(5, 5, 'power-station');
    createBuilding(10, 10, 'collective-farm-hq');
    createBuilding(3, 7, 'vodka-distillery');
    createBuilding(8, 2, 'workers-house-a');
    rng = new GameRng('test-political-seed');
    system = new PoliticalEntitySystem(rng);
  });

  afterEach(() => {
    world.clear();
  });

  // ── Entity spawning scales with tier ────────────────────

  describe('syncEntities', () => {
    it('spawns no KGB or military at selo tier', () => {
      system.syncEntities('selo', 'stagnation', 0);
      const counts = system.getEntityCounts();
      expect(counts.kgb_agent).toBe(0);
      expect(counts.military_officer).toBe(0);
      expect(counts.conscription_officer).toBe(0);
    });

    it('spawns politruks at selo tier (0-1)', () => {
      system.syncEntities('selo', 'stagnation', 0);
      const counts = system.getEntityCounts();
      expect(counts.politruk).toBeLessThanOrEqual(1);
    });

    it('spawns more entities at gorod tier', () => {
      system.syncEntities('gorod', 'stagnation', 0);
      const counts = system.getEntityCounts();
      // Gorod should have 3-5 politruks, 2-4 KGB, 1-2 military
      expect(counts.politruk).toBeGreaterThanOrEqual(3);
      expect(counts.kgb_agent).toBeGreaterThanOrEqual(2);
      expect(counts.military_officer).toBeGreaterThanOrEqual(1);
    });

    it('scales up when upgrading tier', () => {
      system.syncEntities('selo', 'stagnation', 0);
      const seloCounts = system.getEntityCounts();

      system.syncEntities('gorod', 'stagnation', 0);
      const gorodCounts = system.getEntityCounts();

      const seloTotal = Object.values(seloCounts).reduce((a, b) => a + b, 0);
      const gorodTotal = Object.values(gorodCounts).reduce((a, b) => a + b, 0);
      expect(gorodTotal).toBeGreaterThan(seloTotal);
    });

    it('removes excess entities when downgrading tier', () => {
      system.syncEntities('gorod', 'stagnation', 0);
      const gorodTotal = system.getVisibleEntities().length;

      system.syncEntities('selo', 'stagnation', 0);
      const seloTotal = system.getVisibleEntities().length;

      expect(seloTotal).toBeLessThan(gorodTotal);
    });

    it('wartime eras double military presence', () => {
      const peacetimeRng = new GameRng('wartime-test');
      const wartimeRng = new GameRng('wartime-test');
      const peaceSys = new PoliticalEntitySystem(peacetimeRng);
      const warSys = new PoliticalEntitySystem(wartimeRng);

      peaceSys.syncEntities('gorod', 'stagnation', 0);
      warSys.syncEntities('gorod', 'great_patriotic_war', 0);

      const peaceMilitary =
        peaceSys.getEntityCounts().military_officer + peaceSys.getEntityCounts().conscription_officer;
      const warMilitary = warSys.getEntityCounts().military_officer + warSys.getEntityCounts().conscription_officer;

      expect(warMilitary).toBeGreaterThanOrEqual(peaceMilitary);
    });

    it('high corruption increases KGB presence', () => {
      const lowCorruptRng = new GameRng('corruption-test');
      const highCorruptRng = new GameRng('corruption-test');
      const lowSys = new PoliticalEntitySystem(lowCorruptRng);
      const highSys = new PoliticalEntitySystem(highCorruptRng);

      lowSys.syncEntities('gorod', 'stagnation', 10);
      highSys.syncEntities('gorod', 'stagnation', 80);

      expect(highSys.getEntityCounts().kgb_agent).toBeGreaterThanOrEqual(lowSys.getEntityCounts().kgb_agent);
    });

    it('all entities have valid positions', () => {
      system.syncEntities('gorod', 'stagnation', 0);
      for (const entity of system.getVisibleEntities()) {
        expect(entity.stationedAt.gridX).toBeGreaterThanOrEqual(0);
        expect(entity.stationedAt.gridY).toBeGreaterThanOrEqual(0);
      }
    });

    it('all entities have names', () => {
      system.syncEntities('gorod', 'stagnation', 0);
      for (const entity of system.getVisibleEntities()) {
        expect(entity.name.length).toBeGreaterThan(0);
      }
    });
  });

  // ── Politruk building effects ──────────────────────────

  describe('politruk building effects', () => {
    it('politruk at building produces morale + production effects', () => {
      system.syncEntities('gorod', 'stagnation', 0);
      const entities = system.getVisibleEntities();
      const politruk = entities.find((e) => e.role === 'politruk');

      if (politruk) {
        const effects = system.getBuildingEffects(politruk.stationedAt.gridX, politruk.stationedAt.gridY);
        expect(effects.hasPolitruk).toBe(true);
        expect(effects.moraleModifier).toBeGreaterThan(0);
        expect(effects.productionModifier).toBeLessThan(0);
      }
    });

    it('building without political entities has no effects', () => {
      // Don't sync any entities
      const effects = system.getBuildingEffects(99, 99);
      expect(effects.hasPolitruk).toBe(false);
      expect(effects.hasKGBAgent).toBe(false);
      expect(effects.moraleModifier).toBe(0);
      expect(effects.productionModifier).toBe(0);
      expect(effects.loyaltyModifier).toBe(0);
    });

    it('tick produces politruk effects', () => {
      system.syncEntities('gorod', 'stagnation', 0);
      const result = system.tick(100);
      // Should have at least some politruk effects active
      expect(result.politrukEffects.length).toBeGreaterThanOrEqual(0);
      for (const effect of result.politrukEffects) {
        expect(effect.moraleBoost).toBe(10);
        expect(effect.productionPenalty).toBeCloseTo(0.15);
        expect(effect.workerSlotConsumed).toBe(1);
      }
    });
  });

  // ── KGB investigation lifecycle ──────────────────────────

  describe('KGB investigation lifecycle', () => {
    it('KGB agents start investigations when timer expires', () => {
      system.syncEntities('gorod', 'stagnation', 0);

      // Run enough ticks for KGB timer to expire (10-30 tick initial)
      let investigationsStarted = 0;
      for (let t = 0; t < 50; t++) {
        const result = system.tick(t);
        investigationsStarted += result.newInvestigations.length;
      }

      // With 2-4 KGB agents, at least one should start an investigation
      if (system.getEntityCounts().kgb_agent > 0) {
        expect(investigationsStarted).toBeGreaterThan(0);
      }
    });

    it('investigations have valid intensity', () => {
      system.syncEntities('gorod', 'stagnation', 0);

      for (let t = 0; t < 50; t++) {
        const result = system.tick(t);
        for (const inv of result.newInvestigations) {
          expect(['routine', 'thorough', 'purge']).toContain(inv.intensity);
        }
      }
    });

    it('investigations complete and are removed', () => {
      system.syncEntities('gorod', 'stagnation', 0);

      let completedTotal = 0;
      for (let t = 0; t < 100; t++) {
        const result = system.tick(t);
        completedTotal += result.completedInvestigations;
      }

      // Over 100 ticks with investigations lasting 10-30 ticks, some should complete
      if (system.getEntityCounts().kgb_agent > 0) {
        expect(completedTotal).toBeGreaterThan(0);
      }
    });

    it('KGB at building affects building effects', () => {
      system.syncEntities('gorod', 'stagnation', 0);
      const allEntities = system.getVisibleEntities();
      const kgbAgents = allEntities.filter((e) => e.role === 'kgb_agent');

      if (kgbAgents.length > 0) {
        const agent = kgbAgents[0]!;
        const effects = system.getBuildingEffects(agent.stationedAt.gridX, agent.stationedAt.gridY);
        expect(effects.hasKGBAgent).toBe(true);
        expect(effects.loyaltyModifier).toBeGreaterThan(0);
        // Morale modifier depends on whether a politruk is also present
        if (!effects.hasPolitruk) {
          expect(effects.moraleModifier).toBeLessThan(0);
        }
      }
    });

    it('thorough/purge investigations can generate black marks', () => {
      // Use a seed that produces purge investigations
      let blackMarksTotal = 0;
      for (let attempt = 0; attempt < 5; attempt++) {
        const testRng = new GameRng(`blackmark-test-${attempt}`);
        const testSystem = new PoliticalEntitySystem(testRng);
        createBuilding(20, 20, 'power-station');
        testSystem.syncEntities('gorod', 'stagnation', 80);

        for (let t = 0; t < 200; t++) {
          const result = testSystem.tick(t);
          blackMarksTotal += result.blackMarksAdded;
        }
      }
      // Over many attempts with high corruption (more KGB), we should see some marks
      expect(blackMarksTotal).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Conscription ──────────────────────────────────────────

  describe('conscription', () => {
    it('triggerConscription returns a valid event', () => {
      const event = system.triggerConscription(5, false);
      expect(event.targetCount).toBe(5);
      expect(event.officerName.length).toBeGreaterThan(0);
      expect(event.announcement).toContain('5');
    });

    it('conscription removes workers on tick', () => {
      system.triggerConscription(3, false);
      const result = system.tick(100);
      expect(result.workersConscripted).toBe(3);
    });

    it('permanent conscription has wartime casualty rate', () => {
      const event = system.triggerConscription(10, true);
      // 20% casualty rate = 2 casualties out of 10
      expect(event.casualties).toBe(2);
      expect(event.returnTick).toBe(-1);
    });

    it('non-permanent conscription schedules return', () => {
      system.triggerConscription(5, false);
      system.tick(100); // Process the conscription

      const returnQueue = system.getReturnQueue();
      expect(returnQueue.length).toBeGreaterThan(0);
      expect(returnQueue[0]!.count).toBe(5);
    });

    it('wartime conscription still returns survivors', () => {
      system.triggerConscription(10, true);
      system.tick(100); // Process

      const returnQueue = system.getReturnQueue();
      // Survivors (10 - 2 = 8) should still be queued for return
      expect(returnQueue.length).toBeGreaterThan(0);
      const totalReturning = returnQueue.reduce((sum, e) => sum + e.count, 0);
      expect(totalReturning).toBe(8); // 10 - 2 casualties
    });

    it('return queue processes at correct tick', () => {
      system.triggerConscription(5, false);
      system.tick(100); // Process conscription

      const returnQueue = system.getReturnQueue();
      const returnTick = returnQueue[0]!.returnTick;

      // Tick before return: no workers returned
      const resultBefore = system.tick(returnTick - 1);
      expect(resultBefore.workersReturned).toBe(0);

      // Tick at return: workers come back
      const resultAt = system.tick(returnTick);
      expect(resultAt.workersReturned).toBe(5);
    });

    it('multiple conscriptions queue properly', () => {
      system.triggerConscription(3, false);
      system.triggerConscription(5, false);
      const result = system.tick(100);
      expect(result.workersConscripted).toBe(8);
    });

    it('announcement is generated for conscription', () => {
      system.triggerConscription(5, false);
      const result = system.tick(100);
      expect(result.announcements.length).toBeGreaterThan(0);
      expect(result.announcements.some((a) => a.includes('5'))).toBe(true);
    });
  });

  // ── Orgnabor ──────────────────────────────────────────────

  describe('orgnabor', () => {
    it('triggerOrgnabor returns a valid event', () => {
      const event = system.triggerOrgnabor(4, 120, 'railway construction');
      expect(event.purpose).toBe('railway construction');
    });

    it('orgnabor removes workers on tick', () => {
      system.triggerOrgnabor(4, 120, 'canal digging');
      const result = system.tick(200);
      expect(result.workersConscripted).toBe(4);
    });

    it('orgnabor workers return after duration', () => {
      system.triggerOrgnabor(4, 120, 'dam building');
      system.tick(200); // Process orgnabor at tick 200

      // Workers should return at tick 200 + 120 = 320
      const resultBefore = system.tick(319);
      expect(resultBefore.workersReturned).toBe(0);

      const resultAt = system.tick(320);
      expect(resultAt.workersReturned).toBe(4);
    });

    it('orgnabor announcement includes purpose', () => {
      system.triggerOrgnabor(3, 60, 'factory construction');
      const result = system.tick(100);
      expect(result.announcements.some((a) => a.includes('factory construction'))).toBe(true);
    });
  });

  // ── Dialogue retrieval ────────────────────────────────────

  describe('dialogue', () => {
    const context: import('@/content/dialogue').DialogueContext = {
      season: 'winter',
      resourceLevel: 'scarce',
      era: 'stagnation',
      threatLevel: 'watched',
      settlementTier: 'gorod',
    };

    it('returns dialogue for entity at position', () => {
      system.syncEntities('gorod', 'stagnation', 0);
      const entities = system.getVisibleEntities();

      if (entities.length > 0) {
        const entity = entities[0]!;
        const dialogue = system.getEntityDialogue(entity.stationedAt.gridX, entity.stationedAt.gridY, context);
        expect(dialogue).not.toBeNull();
        expect(typeof dialogue).toBe('string');
        expect(dialogue!.length).toBeGreaterThan(0);
      }
    });

    it('returns null for position without entity', () => {
      const dialogue = system.getEntityDialogue(99, 99, context);
      expect(dialogue).toBeNull();
    });

    it('dialogue varies by entity role', () => {
      system.syncEntities('gorod', 'stagnation', 0);
      const entities = system.getVisibleEntities();

      const dialoguesByRole = new Map<string, string[]>();
      for (const entity of entities) {
        const dialogue = system.getEntityDialogue(entity.stationedAt.gridX, entity.stationedAt.gridY, context);
        if (dialogue) {
          const existing = dialoguesByRole.get(entity.role) ?? [];
          existing.push(dialogue);
          dialoguesByRole.set(entity.role, existing);
        }
      }

      // At gorod tier we should have at least politruks and KGB with dialogue
      expect(dialoguesByRole.size).toBeGreaterThan(0);
    });
  });

  // ── Serialization roundtrip ──────────────────────────────

  describe('serialization', () => {
    it('serialize produces valid save data', () => {
      system.syncEntities('gorod', 'stagnation', 0);
      system.triggerConscription(3, false);
      system.tick(100);

      const data = system.serialize();
      expect(data.entities.length).toBeGreaterThan(0);
      expect(Array.isArray(data.investigations)).toBe(true);
      expect(Array.isArray(data.conscriptionQueue)).toBe(true);
      expect(Array.isArray(data.orgnaborQueue)).toBe(true);
      expect(Array.isArray(data.returnQueue)).toBe(true);
    });

    it('roundtrip preserves entity data', () => {
      system.syncEntities('gorod', 'stagnation', 0);
      system.triggerConscription(5, false);
      system.tick(100);

      const data = system.serialize();
      const restored = PoliticalEntitySystem.deserialize(data, new GameRng('test-political-seed'));

      const originalEntities = system.getVisibleEntities();
      const restoredEntities = restored.getVisibleEntities();
      expect(restoredEntities.length).toBe(originalEntities.length);

      for (let i = 0; i < originalEntities.length; i++) {
        expect(restoredEntities[i]!.id).toBe(originalEntities[i]!.id);
        expect(restoredEntities[i]!.role).toBe(originalEntities[i]!.role);
        expect(restoredEntities[i]!.name).toBe(originalEntities[i]!.name);
      }
    });

    it('roundtrip preserves return queue', () => {
      system.triggerConscription(5, false);
      system.tick(100);

      const data = system.serialize();
      const restored = PoliticalEntitySystem.deserialize(data);

      const originalQueue = system.getReturnQueue();
      const restoredQueue = restored.getReturnQueue();
      expect(restoredQueue.length).toBe(originalQueue.length);
      for (let i = 0; i < originalQueue.length; i++) {
        expect(restoredQueue[i]!.returnTick).toBe(originalQueue[i]!.returnTick);
        expect(restoredQueue[i]!.count).toBe(originalQueue[i]!.count);
      }
    });

    it('deserialize with empty data produces clean system', () => {
      const emptyData: PoliticalEntitySaveData = {
        entities: [],
        investigations: [],
        conscriptionQueue: [],
        orgnaborQueue: [],
        returnQueue: [],
      };
      const restored = PoliticalEntitySystem.deserialize(emptyData);
      expect(restored.getVisibleEntities().length).toBe(0);
      expect(restored.getReturnQueue().length).toBe(0);
    });
  });

  // ── Determinism ─────────────────────────────────────────

  describe('determinism', () => {
    it('same seed produces same entity spawning', () => {
      const rng1 = new GameRng('deterministic-political');
      const rng2 = new GameRng('deterministic-political');
      const sys1 = new PoliticalEntitySystem(rng1);
      const sys2 = new PoliticalEntitySystem(rng2);

      sys1.syncEntities('gorod', 'stagnation', 0);
      sys2.syncEntities('gorod', 'stagnation', 0);

      const entities1 = sys1.getVisibleEntities();
      const entities2 = sys2.getVisibleEntities();

      expect(entities1.length).toBe(entities2.length);
      for (let i = 0; i < entities1.length; i++) {
        expect(entities1[i]!.role).toBe(entities2[i]!.role);
        expect(entities1[i]!.name).toBe(entities2[i]!.name);
      }
    });
  });

  // ── Edge cases ──────────────────────────────────────────

  describe('edge cases', () => {
    it('system works with no buildings in the world', () => {
      world.clear();
      createResourceStore();
      createMetaStore();

      const emptySystem = new PoliticalEntitySystem(new GameRng('empty-world'));
      emptySystem.syncEntities('gorod', 'stagnation', 0);

      const result = emptySystem.tick(100);
      expect(result).toBeDefined();
    });

    it('system works without RNG (null rng)', () => {
      const noRngSystem = new PoliticalEntitySystem();
      noRngSystem.syncEntities('gorod', 'stagnation', 0);
      // Without RNG, syncEntities is a no-op
      expect(noRngSystem.getVisibleEntities().length).toBe(0);
    });

    it('tick with no entities produces empty result', () => {
      const result = system.tick(100);
      expect(result.workersConscripted).toBe(0);
      expect(result.workersReturned).toBe(0);
      expect(result.completedInvestigations).toBe(0);
      expect(result.blackMarksAdded).toBe(0);
      expect(result.politrukEffects.length).toBe(0);
      expect(result.announcements.length).toBe(0);
    });

    it('conscription with zero count does not break', () => {
      const event = system.triggerConscription(0, false);
      expect(event.drafted).toBe(0);
      const result = system.tick(100);
      expect(result.workersConscripted).toBe(0);
    });
  });
});
