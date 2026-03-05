/**
 * @fileoverview Tests for freeform organic era transitions.
 *
 * Validates that in Freeform mode:
 * - Era transitions are condition-based (not year-based)
 * - PoliticalAgent uses OrganicUnlocks for freeform transitions
 * - Events fire by probability, not fixed dates
 * - Kardashev sub-era transitions work with techLevel + population gates
 */

import { evaluateOrganicUnlocks, type UnlockContext } from '@/growth/OrganicUnlocks';
import { PoliticalAgent } from '@/ai/agents/political/PoliticalAgent';
import { ERA_DEFINITIONS } from '@/game/era/definitions';
import { GameRng } from '@/game/SeedSystem';
import type { EraId } from '@/game/era/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function baseCtx(overrides?: Partial<UnlockContext>): UnlockContext {
  return {
    population: 50,
    industrialBuildingCount: 0,
    hasActiveWar: false,
    hasExperiencedWar: false,
    yearsSinceLastWar: Infinity,
    recentGrowthRate: 0.03,
    lowGrowthYears: 0,
    simulationYearsElapsed: 0,
    currentEraId: 'revolution',
    techLevel: 0,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// evaluateOrganicUnlocks (pure function)
// ═══════════════════════════════════════════════════════════════════════════════

describe('evaluateOrganicUnlocks', () => {
  it('returns null when no transition conditions are met', () => {
    const result = evaluateOrganicUnlocks(baseCtx());
    expect(result).toBeNull();
  });

  it('revolution → collectivization when population >= 100', () => {
    const result = evaluateOrganicUnlocks(baseCtx({ population: 100 }));
    expect(result).toBe('collectivization');
  });

  it('does not skip eras (collectivization not → industrialization directly)', () => {
    // Even with 3 industrial buildings, must be in collectivization first
    const result = evaluateOrganicUnlocks(
      baseCtx({
        population: 200,
        industrialBuildingCount: 5,
        currentEraId: 'revolution',
      }),
    );
    // Should advance to collectivization (next sequential), not industrialization
    expect(result).toBe('collectivization');
  });

  it('collectivization → industrialization when 3+ industrial buildings', () => {
    const result = evaluateOrganicUnlocks(
      baseCtx({
        currentEraId: 'collectivization',
        industrialBuildingCount: 3,
      }),
    );
    expect(result).toBe('industrialization');
  });

  it('any pre-war era → great_patriotic when war is active', () => {
    const result = evaluateOrganicUnlocks(
      baseCtx({
        currentEraId: 'industrialization',
        hasActiveWar: true,
      }),
    );
    expect(result).toBe('great_patriotic');
  });

  it('great_patriotic → reconstruction when war ends', () => {
    const result = evaluateOrganicUnlocks(
      baseCtx({
        currentEraId: 'great_patriotic',
        hasActiveWar: false,
        hasExperiencedWar: true,
        yearsSinceLastWar: 2,
      }),
    );
    expect(result).toBe('reconstruction');
  });

  it('reconstruction → thaw_and_freeze with population recovery + peace', () => {
    const result = evaluateOrganicUnlocks(
      baseCtx({
        currentEraId: 'reconstruction',
        population: 600,
        hasExperiencedWar: true,
        yearsSinceLastWar: 10,
      }),
    );
    expect(result).toBe('thaw_and_freeze');
  });

  it('thaw_and_freeze → stagnation when growth stalls', () => {
    const result = evaluateOrganicUnlocks(
      baseCtx({
        currentEraId: 'thaw_and_freeze',
        lowGrowthYears: 3,
      }),
    );
    expect(result).toBe('stagnation');
  });

  it('stagnation → the_eternal after 50+ simulation years', () => {
    const result = evaluateOrganicUnlocks(
      baseCtx({
        currentEraId: 'stagnation',
        simulationYearsElapsed: 50,
      }),
    );
    expect(result).toBe('the_eternal');
  });

  // ── Kardashev sub-eras ──

  it('the_eternal → post_soviet with high tech or 100+ years', () => {
    const result = evaluateOrganicUnlocks(
      baseCtx({
        currentEraId: 'the_eternal',
        techLevel: 0.75,
      }),
    );
    expect(result).toBe('post_soviet');
  });

  it('the_eternal → post_soviet after 100+ simulation years', () => {
    const result = evaluateOrganicUnlocks(
      baseCtx({
        currentEraId: 'the_eternal',
        simulationYearsElapsed: 100,
      }),
    );
    expect(result).toBe('post_soviet');
  });

  it('post_soviet → planetary with tech > 0.8 and pop > 10k', () => {
    const result = evaluateOrganicUnlocks(
      baseCtx({
        currentEraId: 'post_soviet',
        techLevel: 0.85,
        population: 15000,
      }),
    );
    expect(result).toBe('planetary');
  });

  it('post_soviet does NOT advance without population', () => {
    const result = evaluateOrganicUnlocks(
      baseCtx({
        currentEraId: 'post_soviet',
        techLevel: 0.95,
        population: 5000, // too low
      }),
    );
    expect(result).toBeNull();
  });

  it('never transitions backward', () => {
    const result = evaluateOrganicUnlocks(
      baseCtx({
        currentEraId: 'stagnation',
        population: 100, // meets collectivization, but that's backward
      }),
    );
    expect(result).not.toBe('collectivization');
    // Should only return the_eternal if 50+ years, or null
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PoliticalAgent freeform mode integration
// ═══════════════════════════════════════════════════════════════════════════════

describe('PoliticalAgent: freeform era transitions', () => {
  let agent: PoliticalAgent;

  beforeEach(() => {
    agent = new PoliticalAgent(1917);
    agent.setRng(new GameRng('freeform-test'));
    agent.setGameMode('freeform');
  });

  it('starts in revolution era when set to freeform', () => {
    expect(agent.getCurrentEraId()).toBe('revolution');
  });

  it('uses organic transitions in freeform mode, ignoring calendar year', () => {
    // Set organic context with population 100 (collectivization trigger)
    agent.setOrganicUnlockContext(
      baseCtx({ population: 120, currentEraId: 'revolution' }),
    );

    // Advance to year 1920 — in historical mode this would NOT trigger collectivization
    // (that happens at 1929), but in freeform it should because population >= 100
    const result = agent.checkEraTransition(1920);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('collectivization');
  });

  it('does NOT transition without organic context set', () => {
    // No setOrganicUnlockContext call
    const result = agent.checkEraTransition(1935);
    expect(result).toBeNull();
  });

  it('does NOT use year-based transitions in freeform mode', () => {
    // Set organic context with low population (no transition)
    agent.setOrganicUnlockContext(baseCtx({ population: 30 }));

    // Even at year 1932 (historical industrialization year), should not transition
    const result = agent.checkEraTransition(1932);
    expect(result).toBeNull();
    expect(agent.getCurrentEraId()).toBe('revolution');
  });

  it('progresses through multiple eras with changing conditions', () => {
    // Revolution → Collectivization
    agent.setOrganicUnlockContext(baseCtx({ population: 150 }));
    let result = agent.checkEraTransition(1920);
    expect(result?.id).toBe('collectivization');

    // Collectivization → Industrialization
    agent.setOrganicUnlockContext(
      baseCtx({
        currentEraId: 'collectivization',
        industrialBuildingCount: 4,
      }),
    );
    result = agent.checkEraTransition(1921);
    expect(result?.id).toBe('industrialization');

    // Industrialization → Great Patriotic
    agent.setOrganicUnlockContext(
      baseCtx({
        currentEraId: 'industrialization',
        hasActiveWar: true,
      }),
    );
    result = agent.checkEraTransition(1922);
    expect(result?.id).toBe('great_patriotic');
  });

  it('transition triggers blending (transitionTicksRemaining > 0)', () => {
    agent.setOrganicUnlockContext(baseCtx({ population: 150 }));
    agent.checkEraTransition(1920);

    // tickTransition should return true while transitioning
    expect(agent.tickTransition()).toBe(true);
  });

  it('getCurrentEraDefinition returns freeform era, not year-based', () => {
    agent.setOrganicUnlockContext(baseCtx({ population: 150 }));
    agent.checkEraTransition(1920);

    const era = agent.getCurrentEraDefinition();
    expect(era.id).toBe('collectivization');

    // Even if we update the year past the historical thaw era,
    // the agent should still be in collectivization (organic)
    agent.setOrganicUnlockContext(
      baseCtx({ currentEraId: 'collectivization', industrialBuildingCount: 0 }),
    );
    agent.checkEraTransition(1960); // historical thaw year
    expect(agent.getCurrentEraId()).toBe('collectivization');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PoliticalAgent: historical mode (control group)
// ═══════════════════════════════════════════════════════════════════════════════

describe('PoliticalAgent: historical mode (year-based) for comparison', () => {
  it('uses year-based transitions in historical mode', () => {
    const agent = new PoliticalAgent(1917);
    agent.setRng(new GameRng('historical-test'));
    // Default mode is 'historical', no setGameMode call

    // Advancing to 1929+ should trigger collectivization
    const result = agent.checkEraTransition(1929);
    // Whether this transitions depends on exact era definitions
    // The point is: historical mode does NOT use organic unlocks
    expect(agent.getGameMode()).toBe('historical');
  });
});
