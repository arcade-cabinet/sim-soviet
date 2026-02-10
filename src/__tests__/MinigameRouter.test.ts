import { beforeEach, describe, expect, it } from 'vitest';
import { getMinigameDefinition, MINIGAME_DEFINITIONS } from '../game/minigames/definitions';
import { MinigameRouter } from '../game/minigames/MinigameRouter';
import type { MinigameId, MinigameOutcome } from '../game/minigames/MinigameTypes';
import { GameRng } from '../game/SeedSystem';

// ─────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────

const ALL_IDS: MinigameId[] = [
  'the_queue',
  'ideology_session',
  'the_inspection',
  'conscription_selection',
  'black_market',
  'factory_emergency',
  'the_hunt',
  'interrogation',
];

/** Compute a rough "goodness score" for an outcome (positive = good). */
function outcomeScore(o: MinigameOutcome): number {
  let score = 0;
  if (o.resources) {
    score += o.resources.money ?? 0;
    score += (o.resources.food ?? 0) * 2;
    score += (o.resources.vodka ?? 0) * 2;
    score += (o.resources.population ?? 0) * 20;
  }
  score -= (o.blackMarks ?? 0) * 50;
  score += (o.commendations ?? 0) * 30;
  score += (o.blat ?? 0) * 5;
  return score;
}

// ─────────────────────────────────────────────────────────
//  Tests
// ─────────────────────────────────────────────────────────

describe('MinigameDefinitions', () => {
  it('has exactly 8 minigame definitions', () => {
    expect(MINIGAME_DEFINITIONS).toHaveLength(8);
  });

  it('all IDs are unique', () => {
    const ids = MINIGAME_DEFINITIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(8);
  });

  it('covers all expected MinigameId values', () => {
    const ids = new Set(MINIGAME_DEFINITIONS.map((d) => d.id));
    for (const id of ALL_IDS) {
      expect(ids.has(id)).toBe(true);
    }
  });

  describe('structural validity', () => {
    for (const def of MINIGAME_DEFINITIONS) {
      describe(def.id, () => {
        it('has a non-empty name and description', () => {
          expect(def.name.length).toBeGreaterThan(0);
          expect(def.description.length).toBeGreaterThan(0);
        });

        it('has a valid triggerType', () => {
          expect(['building_tap', 'event', 'periodic']).toContain(def.triggerType);
        });

        it('has a non-empty triggerCondition', () => {
          expect(def.triggerCondition.length).toBeGreaterThan(0);
        });

        it('has 2-3 choices', () => {
          expect(def.choices.length).toBeGreaterThanOrEqual(2);
          expect(def.choices.length).toBeLessThanOrEqual(3);
        });

        it('all choices have unique IDs', () => {
          const choiceIds = def.choices.map((c) => c.id);
          expect(new Set(choiceIds).size).toBe(choiceIds.length);
        });

        it('all choices have successChance between 0 and 1', () => {
          for (const choice of def.choices) {
            expect(choice.successChance).toBeGreaterThanOrEqual(0);
            expect(choice.successChance).toBeLessThanOrEqual(1);
          }
        });

        it('all choices have non-empty labels and descriptions', () => {
          for (const choice of def.choices) {
            expect(choice.label.length).toBeGreaterThan(0);
            expect(choice.description.length).toBeGreaterThan(0);
          }
        });

        it('autoResolve has a non-empty announcement', () => {
          expect(def.autoResolve.announcement.length).toBeGreaterThan(0);
        });

        it('tickLimit is a positive number or -1', () => {
          expect(def.tickLimit === -1 || def.tickLimit > 0).toBe(true);
        });
      });
    }
  });

  describe('auto-resolve is worse than engaging', () => {
    for (const def of MINIGAME_DEFINITIONS) {
      it(`${def.id}: autoResolve score is worse than the best engaged choice`, () => {
        const autoScore = outcomeScore(def.autoResolve);

        // Best possible score from any choice (take the better of success/failure)
        const choiceScores = def.choices.map((c) => {
          const successScore = outcomeScore(c.onSuccess);
          const failureScore = outcomeScore(c.onFailure);
          // Expected value: weighted by successChance
          return successScore * c.successChance + failureScore * (1 - c.successChance);
        });

        const bestChoiceScore = Math.max(...choiceScores);
        expect(autoScore).toBeLessThanOrEqual(bestChoiceScore);
      });
    }
  });

  describe('getMinigameDefinition', () => {
    it('returns the correct definition by ID', () => {
      const def = getMinigameDefinition('the_queue');
      expect(def).toBeDefined();
      expect(def!.id).toBe('the_queue');
      expect(def!.name).toBe('The Queue');
    });

    it('returns undefined for an unknown ID', () => {
      expect(getMinigameDefinition('nonexistent')).toBeUndefined();
    });
  });
});

describe('MinigameRouter', () => {
  let rng: GameRng;
  let router: MinigameRouter;

  beforeEach(() => {
    rng = new GameRng('test-seed-minigame');
    router = new MinigameRouter(rng);
  });

  // ── Initial state ──────────────────────────────────

  describe('initial state', () => {
    it('has no active minigame', () => {
      expect(router.isActive()).toBe(false);
      expect(router.getActive()).toBeNull();
    });
  });

  // ── Trigger conditions ─────────────────────────────

  describe('trigger conditions', () => {
    it('matches building_tap trigger for black_market', () => {
      const def = router.checkTrigger('building_tap', {
        buildingDefId: 'market',
        totalTicks: 100,
        population: 50,
      });
      expect(def).not.toBeNull();
      expect(def!.id).toBe('black_market');
    });

    it('matches building_tap trigger for the_hunt (forest)', () => {
      const def = router.checkTrigger('building_tap', {
        buildingDefId: 'forest',
        totalTicks: 100,
        population: 50,
      });
      expect(def).not.toBeNull();
      expect(def!.id).toBe('the_hunt');
    });

    it('matches event trigger for ideology_session', () => {
      const def = router.checkTrigger('event', {
        eventId: 'politruk_visit',
        totalTicks: 100,
        population: 50,
      });
      expect(def).not.toBeNull();
      expect(def!.id).toBe('ideology_session');
    });

    it('matches event trigger for factory_emergency', () => {
      const def = router.checkTrigger('event', {
        eventId: 'factory_malfunction',
        totalTicks: 100,
        population: 50,
      });
      expect(def).not.toBeNull();
      expect(def!.id).toBe('factory_emergency');
    });

    it('matches event trigger for conscription_selection', () => {
      const def = router.checkTrigger('event', {
        eventId: 'conscription_order',
        totalTicks: 100,
        population: 50,
      });
      expect(def).not.toBeNull();
      expect(def!.id).toBe('conscription_selection');
    });

    it('matches event trigger for interrogation', () => {
      const def = router.checkTrigger('event', {
        eventId: 'kgb_investigation',
        totalTicks: 100,
        population: 50,
      });
      expect(def).not.toBeNull();
      expect(def!.id).toBe('interrogation');
    });

    it('matches periodic trigger for the_queue when population >= 30 and tick % 60 === 0', () => {
      const def = router.checkTrigger('periodic', {
        totalTicks: 120,
        population: 30,
      });
      expect(def).not.toBeNull();
      expect(def!.id).toBe('the_queue');
    });

    it('does NOT match the_queue when population < 30', () => {
      const def = router.checkTrigger('periodic', {
        totalTicks: 120,
        population: 29,
      });
      // Should not match the_queue, might match inspection
      if (def) {
        expect(def.id).not.toBe('the_queue');
      }
    });

    it('does NOT match the_queue when tick is not divisible by 60', () => {
      const def = router.checkTrigger('periodic', {
        totalTicks: 121,
        population: 50,
      });
      // Should not match the_queue
      if (def) {
        expect(def.id).not.toBe('the_queue');
      }
    });

    it('matches periodic trigger for the_inspection at tick % 180 === 0', () => {
      const def = router.checkTrigger('periodic', {
        totalTicks: 180,
        population: 10,
      });
      // At tick 180, both queue (if pop >= 30) and inspection could match
      // With population 10, only inspection should match
      expect(def).not.toBeNull();
      expect(def!.id).toBe('the_inspection');
    });

    it('returns null for unmatched building_tap', () => {
      const def = router.checkTrigger('building_tap', {
        buildingDefId: 'tenement',
        totalTicks: 100,
        population: 50,
      });
      expect(def).toBeNull();
    });

    it('returns null for unmatched event', () => {
      const def = router.checkTrigger('event', {
        eventId: 'unknown_event',
        totalTicks: 100,
        population: 50,
      });
      expect(def).toBeNull();
    });
  });

  // ── Only one active at a time ──────────────────────

  describe('single active minigame', () => {
    it('returns null from checkTrigger when a minigame is already active', () => {
      const def = getMinigameDefinition('the_queue')!;
      router.startMinigame(def, 100);

      const result = router.checkTrigger('event', {
        eventId: 'politruk_visit',
        totalTicks: 100,
        population: 50,
      });
      expect(result).toBeNull();
    });

    it('allows new triggers after active minigame is resolved and cleared', () => {
      const def = getMinigameDefinition('the_queue')!;
      router.startMinigame(def, 100);
      router.resolveChoice('fair_distribution');
      router.clearResolved();

      // Different minigame should now be available (not the_queue, it is on cooldown)
      const result = router.checkTrigger('event', {
        eventId: 'politruk_visit',
        totalTicks: 200,
        population: 50,
      });
      expect(result).not.toBeNull();
      expect(result!.id).toBe('ideology_session');
    });
  });

  // ── Starting a minigame ────────────────────────────

  describe('startMinigame', () => {
    it('creates an active minigame', () => {
      const def = getMinigameDefinition('black_market')!;
      const active = router.startMinigame(def, 200);

      expect(active.definition.id).toBe('black_market');
      expect(active.startTick).toBe(200);
      expect(active.resolved).toBe(false);
      expect(active.choiceMade).toBeUndefined();
      expect(active.outcome).toBeUndefined();
      expect(router.isActive()).toBe(true);
    });
  });

  // ── Choice resolution ──────────────────────────────

  describe('resolveChoice', () => {
    it('resolves with success outcome when roll succeeds', () => {
      // Use a fixed-seed RNG and find a minigame with successChance 1.0
      const def = getMinigameDefinition('interrogation')!;
      router.startMinigame(def, 100);

      // "cooperate_fully" has successChance 1.0
      const outcome = router.resolveChoice('cooperate_fully');
      expect(outcome.announcement).toContain('cooperated');
      expect(outcome.commendations).toBe(1);
      expect(outcome.resources?.population).toBe(-1);

      const active = router.getActive();
      expect(active!.resolved).toBe(true);
      expect(active!.choiceMade).toBe('cooperate_fully');
    });

    it('marks the minigame as resolved', () => {
      const def = getMinigameDefinition('the_hunt')!;
      router.startMinigame(def, 100);
      router.resolveChoice('small_party');

      expect(router.isActive()).toBe(false);
      expect(router.getActive()!.resolved).toBe(true);
    });

    it('returns no-op for invalid choice ID', () => {
      const def = getMinigameDefinition('the_queue')!;
      router.startMinigame(def, 100);
      const outcome = router.resolveChoice('nonexistent_choice');
      expect(outcome.announcement).toBe('Invalid choice.');
    });

    it('returns no-op when no minigame is active', () => {
      const outcome = router.resolveChoice('fair_distribution');
      expect(outcome.announcement).toBe('No active minigame.');
    });

    it('returns no-op when minigame already resolved', () => {
      const def = getMinigameDefinition('the_queue')!;
      router.startMinigame(def, 100);
      router.resolveChoice('fair_distribution');

      // Try to resolve again
      const outcome = router.resolveChoice('priority_workers');
      expect(outcome.announcement).toBe('No active minigame.');
    });

    it('success/failure depends on RNG roll vs successChance', () => {
      // Run many trials with a low-chance choice to verify both paths are reachable
      const successCount = { yes: 0, no: 0 };
      for (let i = 0; i < 100; i++) {
        const trialRng = new GameRng(`trial-${i}`);
        const trialRouter = new MinigameRouter(trialRng);
        const def = getMinigameDefinition('the_hunt')!;
        trialRouter.startMinigame(def, 100);

        // "poach_state_forests" has 0.45 success chance
        const outcome = trialRouter.resolveChoice('poach_state_forests');
        if (outcome.resources && (outcome.resources.food ?? 0) >= 40) {
          successCount.yes++;
        } else {
          successCount.no++;
        }
      }

      // With 0.45 chance over 100 trials, both should be > 0
      expect(successCount.yes).toBeGreaterThan(0);
      expect(successCount.no).toBeGreaterThan(0);
    });
  });

  // ── Auto-resolve ───────────────────────────────────

  describe('autoResolve', () => {
    it('applies the auto-resolve outcome', () => {
      const def = getMinigameDefinition('factory_emergency')!;
      router.startMinigame(def, 100);

      const outcome = router.autoResolve();
      expect(outcome.resources?.population).toBe(-2);
      expect(outcome.resources?.money).toBe(-50);
      expect(outcome.blackMarks).toBe(1);
      expect(outcome.severity).toBe('critical');
    });

    it('marks the minigame as resolved', () => {
      const def = getMinigameDefinition('the_queue')!;
      router.startMinigame(def, 100);
      router.autoResolve();

      expect(router.isActive()).toBe(false);
      expect(router.getActive()!.resolved).toBe(true);
    });

    it('returns no-op when no minigame is active', () => {
      const outcome = router.autoResolve();
      expect(outcome.announcement).toBe('No active minigame.');
    });
  });

  // ── Tick-based auto-resolve ────────────────────────

  describe('tick', () => {
    it('auto-resolves when tick limit is reached', () => {
      const def = getMinigameDefinition('the_queue')!;
      expect(def.tickLimit).toBe(30);

      router.startMinigame(def, 100);

      // Before limit
      expect(router.tick(129)).toBeNull();
      expect(router.isActive()).toBe(true);

      // At limit (100 + 30 = 130)
      const outcome = router.tick(130);
      expect(outcome).not.toBeNull();
      expect(outcome!.announcement).toContain('Chaotic distribution');
      expect(router.isActive()).toBe(false);
    });

    it('returns null when no minigame is active', () => {
      expect(router.tick(100)).toBeNull();
    });

    it('returns null when minigame is already resolved', () => {
      const def = getMinigameDefinition('the_queue')!;
      router.startMinigame(def, 100);
      router.resolveChoice('fair_distribution');

      expect(router.tick(200)).toBeNull();
    });
  });

  // ── Cooldown system ────────────────────────────────

  describe('cooldowns', () => {
    it('prevents re-triggering a minigame within cooldown period', () => {
      const def = getMinigameDefinition('black_market')!;
      router.startMinigame(def, 100);
      router.resolveChoice('trade_cautiously');
      router.clearResolved();

      // Try to trigger same minigame within cooldown (100 + 60 = 160)
      const result = router.checkTrigger('building_tap', {
        buildingDefId: 'market',
        totalTicks: 150,
        population: 50,
      });
      expect(result).toBeNull();
    });

    it('allows re-triggering after cooldown expires', () => {
      const def = getMinigameDefinition('black_market')!;
      router.startMinigame(def, 100);
      router.resolveChoice('trade_cautiously');
      router.clearResolved();

      // After cooldown (100 + 60 = 160)
      const result = router.checkTrigger('building_tap', {
        buildingDefId: 'market',
        totalTicks: 161,
        population: 50,
      });
      expect(result).not.toBeNull();
      expect(result!.id).toBe('black_market');
    });

    it('cooldown is set on auto-resolve too', () => {
      const def = getMinigameDefinition('the_hunt')!;
      router.startMinigame(def, 200);
      router.autoResolve();
      router.clearResolved();

      // Within cooldown
      const result = router.checkTrigger('building_tap', {
        buildingDefId: 'forest',
        totalTicks: 250,
        population: 50,
      });
      expect(result).toBeNull();
    });

    it('different minigames have independent cooldowns', () => {
      // Resolve black_market
      const def1 = getMinigameDefinition('black_market')!;
      router.startMinigame(def1, 100);
      router.resolveChoice('trade_cautiously');
      router.clearResolved();

      // The hunt should still be available (not on cooldown)
      const result = router.checkTrigger('building_tap', {
        buildingDefId: 'forest',
        totalTicks: 110,
        population: 50,
      });
      expect(result).not.toBeNull();
      expect(result!.id).toBe('the_hunt');
    });
  });

  // ── Serialization ──────────────────────────────────

  describe('serialize / deserialize', () => {
    it('round-trips cooldowns', () => {
      const def = getMinigameDefinition('the_queue')!;
      router.startMinigame(def, 100);
      router.resolveChoice('fair_distribution');
      router.clearResolved();

      const data = router.serialize();
      const restored = MinigameRouter.deserialize(data, new GameRng('test-seed-2'));

      // Should still have cooldown for the_queue
      const result = restored.checkTrigger('periodic', {
        totalTicks: 120,
        population: 50,
      });
      // the_queue is on cooldown until tick 160
      expect(result?.id).not.toBe('the_queue');
    });

    it('round-trips active minigame', () => {
      const def = getMinigameDefinition('interrogation')!;
      router.startMinigame(def, 500);

      const data = router.serialize();
      expect(data.activeMinigameId).toBe('interrogation');
      expect(data.activeStartTick).toBe(500);

      const restored = MinigameRouter.deserialize(data, new GameRng('test-seed-3'));
      expect(restored.isActive()).toBe(true);
      expect(restored.getActive()!.definition.id).toBe('interrogation');
      expect(restored.getActive()!.startTick).toBe(500);
    });

    it('round-trips null active state', () => {
      const data = router.serialize();
      expect(data.activeMinigameId).toBeNull();

      const restored = MinigameRouter.deserialize(data, new GameRng('test-seed-4'));
      expect(restored.isActive()).toBe(false);
      expect(restored.getActive()).toBeNull();
    });

    it('serialized data has correct structure', () => {
      const def = getMinigameDefinition('black_market')!;
      router.startMinigame(def, 200);
      router.resolveChoice('report_market');

      const data = router.serialize();
      expect(data).toEqual({
        activeMinigameId: null, // resolved, so null
        activeStartTick: 200,
        cooldowns: { black_market: 260 }, // 200 + 60
      });
    });
  });

  // ── clearResolved ──────────────────────────────────

  describe('clearResolved', () => {
    it('clears a resolved minigame', () => {
      const def = getMinigameDefinition('the_queue')!;
      router.startMinigame(def, 100);
      router.resolveChoice('fair_distribution');

      expect(router.getActive()).not.toBeNull();
      router.clearResolved();
      expect(router.getActive()).toBeNull();
    });

    it('does not clear an unresolved minigame', () => {
      const def = getMinigameDefinition('the_queue')!;
      router.startMinigame(def, 100);
      router.clearResolved(); // should be a no-op

      expect(router.isActive()).toBe(true);
      expect(router.getActive()).not.toBeNull();
    });
  });
});
