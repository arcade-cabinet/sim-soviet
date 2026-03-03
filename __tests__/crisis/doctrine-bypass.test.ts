/**
 * @fileoverview Tests for doctrine mechanic bypass when crisis agents are active.
 *
 * Validates that the wartime_conscription doctrine mechanic is skipped when
 * a WarAgent (via the Governor system) is handling conscription, preventing
 * double-conscription. Other mechanics must remain unaffected.
 */

import type { DoctrineContext } from '@/ai/agents/political/doctrine';
import { DOCTRINE_MECHANICS, evaluateDoctrineMechanics } from '@/ai/agents/political/doctrine';
import { PoliticalEntitySystem } from '@/ai/agents/political/PoliticalEntitySystem';
import { createBuilding } from '@/ecs/factories';
import { world } from '@/ecs/world';
import { GameRng } from '@/game/SeedSystem';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** wartime_conscription fires at multiples of this interval. */
const CONSCRIPTION_INTERVAL = DOCTRINE_MECHANICS.wartime_conscription.intervalTicks;

/**
 * Create a DoctrineContext in the great_patriotic era with totalTicks
 * aligned to the wartime_conscription interval so the mechanic fires.
 */
function makeDoctrineCtx(overrides?: Partial<DoctrineContext>): DoctrineContext {
  return {
    currentEraId: 'great_patriotic',
    totalTicks: CONSCRIPTION_INTERVAL, // aligned to interval
    currentFood: 500,
    currentPop: 100,
    currentMoney: 200,
    quotaProgress: 0.5,
    rng: new GameRng('doctrine-bypass-test'),
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Doctrine bypass when crisis agent active', () => {
  describe('evaluateDoctrineMechanics', () => {
    it('fires wartime_conscription normally when no crisisAgentActive function', () => {
      const ctx = makeDoctrineCtx();
      const effects = evaluateDoctrineMechanics(ctx);

      const conscriptionEffects = effects.filter((e) => e.mechanicId === 'wartime_conscription');
      expect(conscriptionEffects).toHaveLength(1);
      expect(conscriptionEffects[0]!.popDelta).toBeLessThan(0);
    });

    it('skips wartime_conscription when crisisAgentActive returns true for war', () => {
      const ctx = makeDoctrineCtx({
        crisisAgentActive: (type: string) => type === 'war',
      });
      const effects = evaluateDoctrineMechanics(ctx);

      const conscriptionEffects = effects.filter((e) => e.mechanicId === 'wartime_conscription');
      expect(conscriptionEffects).toHaveLength(0);
    });

    it('fires wartime_conscription when crisisAgentActive returns false for war', () => {
      const ctx = makeDoctrineCtx({
        crisisAgentActive: (_type: string) => false,
      });
      const effects = evaluateDoctrineMechanics(ctx);

      const conscriptionEffects = effects.filter((e) => e.mechanicId === 'wartime_conscription');
      expect(conscriptionEffects).toHaveLength(1);
      expect(conscriptionEffects[0]!.popDelta).toBeLessThan(0);
    });

    it('does not skip grain_requisitioning when crisisAgentActive returns true for war', () => {
      // grain_requisitioning fires in 'revolution' era at its own interval
      const grainInterval = DOCTRINE_MECHANICS.grain_requisitioning.intervalTicks;
      const ctx = makeDoctrineCtx({
        currentEraId: 'revolution',
        totalTicks: grainInterval,
        crisisAgentActive: (type: string) => type === 'war',
      });
      const effects = evaluateDoctrineMechanics(ctx);

      const grainEffects = effects.filter((e) => e.mechanicId === 'grain_requisitioning');
      expect(grainEffects).toHaveLength(1);
    });

    it('does not skip stakhanovite_bonus when crisisAgentActive returns true for war', () => {
      // stakhanovite_bonus fires in 'industrialization' era
      const stakhInterval = DOCTRINE_MECHANICS.stakhanovite_bonus.intervalTicks;
      const ctx = makeDoctrineCtx({
        currentEraId: 'industrialization',
        totalTicks: stakhInterval,
        crisisAgentActive: (type: string) => type === 'war',
      });
      const effects = evaluateDoctrineMechanics(ctx);

      const stakhEffects = effects.filter((e) => e.mechanicId === 'stakhanovite_bonus');
      expect(stakhEffects).toHaveLength(1);
    });
  });

  describe('PoliticalEntitySystem.setCrisisCheck', () => {
    beforeEach(() => {
      world.clear();
    });

    it('passes crisisAgentActive through to doctrine evaluation when set', () => {
      createBuilding(0, 0, 'power-station');
      const rng = new GameRng('entity-system-bypass');
      const system = new PoliticalEntitySystem(rng);

      // Set crisis check that reports war active
      system.setCrisisCheck((type: string) => type === 'war');

      const doctrineCtx: DoctrineContext = makeDoctrineCtx({ rng });

      const result = system.tick(CONSCRIPTION_INTERVAL, doctrineCtx);

      // wartime_conscription should be skipped
      const conscriptionEffects = result.doctrineMechanicEffects.filter((e) => e.mechanicId === 'wartime_conscription');
      expect(conscriptionEffects).toHaveLength(0);
    });

    it('does not inject crisisAgentActive when no crisis check is set', () => {
      createBuilding(0, 0, 'power-station');
      const rng = new GameRng('entity-system-no-bypass');
      const system = new PoliticalEntitySystem(rng);

      // No setCrisisCheck call

      const doctrineCtx: DoctrineContext = makeDoctrineCtx({ rng });

      const result = system.tick(CONSCRIPTION_INTERVAL, doctrineCtx);

      // wartime_conscription should fire normally
      const conscriptionEffects = result.doctrineMechanicEffects.filter((e) => e.mechanicId === 'wartime_conscription');
      expect(conscriptionEffects).toHaveLength(1);
      expect(conscriptionEffects[0]!.popDelta).toBeLessThan(0);
    });
  });
});
