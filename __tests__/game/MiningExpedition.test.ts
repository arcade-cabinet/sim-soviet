import { getMinigameDefinition } from '../../src/game/minigames/definitions';
import { MinigameRouter } from '../../src/game/minigames/MinigameRouter';
import type { MinigameOutcome } from '../../src/game/minigames/MinigameTypes';
import { autoResolveMiningExpedition } from '../../src/game/minigames/MiningExpedition';
import { GameRng } from '../../src/game/SeedSystem';

// ─────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────

type OutcomeTier = 'success' | 'partial' | 'disaster';

/** Classify an outcome by its characteristics. */
function classifyOutcome(outcome: MinigameOutcome): OutcomeTier {
  const pop = outcome.resources?.population ?? 0;
  const money = outcome.resources?.money ?? 0;

  if (pop < 0) return 'disaster';
  if (money >= 25) return 'success';
  return 'partial';
}

// ─────────────────────────────────────────────────────────
//  Tests — autoResolveMiningExpedition (standalone)
// ─────────────────────────────────────────────────────────

describe('autoResolveMiningExpedition', () => {
  it('returns an outcome with resources and announcement', () => {
    const rng = new GameRng('mining-test-1');
    const outcome = autoResolveMiningExpedition(rng);

    expect(outcome.announcement).toBeDefined();
    expect(outcome.announcement.length).toBeGreaterThan(0);
    expect(outcome.resources).toBeDefined();
    expect(outcome.resources!.money).toBeDefined();
  });

  it('success outcome grants 25-45 money with no casualties', () => {
    // Find a seed that produces a success outcome (roll < 0.6)
    for (let i = 0; i < 200; i++) {
      const rng = new GameRng(`success-hunt-${i}`);
      const outcome = autoResolveMiningExpedition(rng);
      if (classifyOutcome(outcome) === 'success') {
        expect(outcome.resources!.money).toBeGreaterThanOrEqual(25);
        expect(outcome.resources!.money).toBeLessThanOrEqual(45);
        expect(outcome.resources!.population).toBeUndefined();
        expect(outcome.blackMarks).toBeUndefined();
        expect(outcome.severity).toBeUndefined();
        return;
      }
    }
    // With 60% chance, failing 200 times is astronomically unlikely
    expect.unreachable('Could not find a success outcome in 200 trials');
  });

  it('partial outcome grants 5-15 money with no casualties', () => {
    for (let i = 0; i < 200; i++) {
      const rng = new GameRng(`partial-hunt-${i}`);
      const outcome = autoResolveMiningExpedition(rng);
      if (classifyOutcome(outcome) === 'partial') {
        expect(outcome.resources!.money).toBeGreaterThanOrEqual(5);
        expect(outcome.resources!.money).toBeLessThanOrEqual(15);
        expect(outcome.resources!.population).toBeUndefined();
        expect(outcome.blackMarks).toBeUndefined();
        expect(outcome.severity).toBeUndefined();
        return;
      }
    }
    expect.unreachable('Could not find a partial outcome in 200 trials');
  });

  it('disaster outcome loses 1-3 workers and grants small resources', () => {
    for (let i = 0; i < 200; i++) {
      const rng = new GameRng(`disaster-hunt-${i}`);
      const outcome = autoResolveMiningExpedition(rng);
      if (classifyOutcome(outcome) === 'disaster') {
        expect(outcome.resources!.population).toBeLessThanOrEqual(-1);
        expect(outcome.resources!.population).toBeGreaterThanOrEqual(-3);
        expect(outcome.resources!.money).toBeGreaterThanOrEqual(2);
        expect(outcome.resources!.money).toBeLessThanOrEqual(6);
        expect(outcome.blackMarks).toBe(1);
        expect(outcome.severity).toBe('critical');
        return;
      }
    }
    expect.unreachable('Could not find a disaster outcome in 200 trials');
  });

  it('disaster announcement includes casualty count', () => {
    for (let i = 0; i < 200; i++) {
      const rng = new GameRng(`announce-${i}`);
      const outcome = autoResolveMiningExpedition(rng);
      if (classifyOutcome(outcome) === 'disaster') {
        const casualties = -outcome.resources!.population!;
        expect(outcome.announcement).toContain(`${casualties} miner`);
        return;
      }
    }
    expect.unreachable('Could not find a disaster outcome in 200 trials');
  });

  describe('all outcome tiers are reachable', () => {
    const tiers = new Set<OutcomeTier>();

    // Run enough trials to hit all tiers
    for (let i = 0; i < 300; i++) {
      const rng = new GameRng(`reachable-${i}`);
      const outcome = autoResolveMiningExpedition(rng);
      tiers.add(classifyOutcome(outcome));
    }

    it('success tier is reachable', () => {
      expect(tiers.has('success')).toBe(true);
    });

    it('partial tier is reachable', () => {
      expect(tiers.has('partial')).toBe(true);
    });

    it('disaster tier is reachable', () => {
      expect(tiers.has('disaster')).toBe(true);
    });
  });

  it('is deterministic with the same seed', () => {
    const seed = 'determinism-check';
    const outcome1 = autoResolveMiningExpedition(new GameRng(seed));
    const outcome2 = autoResolveMiningExpedition(new GameRng(seed));

    expect(outcome1.resources).toEqual(outcome2.resources);
    expect(outcome1.announcement).toBe(outcome2.announcement);
    expect(outcome1.blackMarks).toBe(outcome2.blackMarks);
    expect(outcome1.severity).toBe(outcome2.severity);
  });

  it('produces different outcomes with different seeds', () => {
    const outcomes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const rng = new GameRng(`variety-${i}`);
      const outcome = autoResolveMiningExpedition(rng);
      outcomes.add(outcome.announcement);
    }
    // With 3 tier types producing different announcements, we should see at least 2
    expect(outcomes.size).toBeGreaterThanOrEqual(2);
  });

  describe('outcome distribution is roughly correct', () => {
    const counts = { success: 0, partial: 0, disaster: 0 };
    const TRIALS = 1000;

    for (let i = 0; i < TRIALS; i++) {
      const rng = new GameRng(`dist-${i}`);
      const outcome = autoResolveMiningExpedition(rng);
      counts[classifyOutcome(outcome)]++;
    }

    it('success rate is approximately 60%', () => {
      const rate = counts.success / TRIALS;
      // Allow generous margin for seeded RNG (±10%)
      expect(rate).toBeGreaterThan(0.45);
      expect(rate).toBeLessThan(0.75);
    });

    it('partial rate is approximately 25%', () => {
      const rate = counts.partial / TRIALS;
      expect(rate).toBeGreaterThan(0.12);
      expect(rate).toBeLessThan(0.38);
    });

    it('disaster rate is approximately 15%', () => {
      const rate = counts.disaster / TRIALS;
      expect(rate).toBeGreaterThan(0.05);
      expect(rate).toBeLessThan(0.28);
    });
  });
});

// ─────────────────────────────────────────────────────────
//  Tests — MinigameRouter integration
// ─────────────────────────────────────────────────────────

describe('MiningExpedition router integration', () => {
  it('router auto-resolve uses RNG-driven outcome for mining_expedition', () => {
    const rng = new GameRng('router-mining-1');
    const router = new MinigameRouter(rng);
    const def = getMinigameDefinition('mining_expedition')!;

    router.startMinigame(def, 100);
    const outcome = router.autoResolve();

    // Should be one of the three dynamic outcomes, not the static fallback
    expect(outcome.announcement.length).toBeGreaterThan(0);
    expect(outcome.resources).toBeDefined();
    expect(outcome.resources!.money).toBeDefined();
    // The static fallback has money = -2; dynamic outcomes always have money > 0
    expect(outcome.resources!.money).toBeGreaterThan(0);
  });

  it('router tick-based auto-resolve uses RNG-driven outcome', () => {
    const rng = new GameRng('router-mining-tick');
    const router = new MinigameRouter(rng);
    const def = getMinigameDefinition('mining_expedition')!;
    expect(def.tickLimit).toBe(30);

    router.startMinigame(def, 100);

    // Before limit — no resolve
    expect(router.tick(129)).toBeNull();

    // At limit (100 + 30 = 130) — auto-resolve fires
    const outcome = router.tick(130);
    expect(outcome).not.toBeNull();
    expect(outcome!.resources!.money).toBeGreaterThan(0);
  });

  it('other minigames still use static auto-resolve', () => {
    const rng = new GameRng('router-other');
    const router = new MinigameRouter(rng);
    const def = getMinigameDefinition('factory_emergency')!;

    router.startMinigame(def, 100);
    const outcome = router.autoResolve();

    // Factory emergency static auto-resolve values
    expect(outcome.resources?.population).toBe(-2);
    expect(outcome.resources?.money).toBe(-50);
    expect(outcome.blackMarks).toBe(1);
  });

  it('mining_expedition choice resolution still works normally', () => {
    const rng = new GameRng('router-choice');
    const router = new MinigameRouter(rng);
    const def = getMinigameDefinition('mining_expedition')!;

    router.startMinigame(def, 100);
    const outcome = router.resolveChoice('surface_mining');

    // Choice resolution is not affected — still uses standard success/failure logic
    expect(outcome.announcement.length).toBeGreaterThan(0);
    expect(router.isActive()).toBe(false);
  });
});
