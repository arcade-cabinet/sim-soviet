/**
 * @fileoverview Tests for era doctrine mechanics:
 * - Thaw/freeze oscillation (era 5)
 * - Stagnation rot (era 7)
 * - Eternal bureaucratic singularity (era 8)
 * - Original 4 mechanics (regression)
 */

import {
  type DoctrineContext,
  ETERNAL_PAPERWORK_THRESHOLD,
  evaluateDoctrineMechanics,
  getThawFreezeState,
  resetPaperwork,
  resetThawFreezeState,
  setThawFreezeState,
} from '@/ai/agents/political/doctrine';
import { GameRng } from '@/game/SeedSystem';

function makeCtx(overrides: Partial<DoctrineContext> = {}): DoctrineContext {
  return {
    currentEraId: 'revolution',
    totalTicks: 30,
    currentFood: 100,
    currentPop: 50,
    currentMoney: 200,
    quotaProgress: 0.5,
    rng: new GameRng('test-doctrine'),
    eraStartTick: 0,
    currentPaperwork: 0,
    ...overrides,
  };
}

describe('Era Doctrine Mechanics', () => {
  beforeEach(() => {
    resetThawFreezeState();
    resetPaperwork();
  });

  // ── Original mechanics (regression) ─────────────────────────────

  describe('grain_requisitioning (revolution)', () => {
    it('fires every 60 ticks during revolution', () => {
      const effects = evaluateDoctrineMechanics(makeCtx({ currentEraId: 'revolution', totalTicks: 60 }));
      const grain = effects.find((e) => e.mechanicId === 'grain_requisitioning');
      expect(grain).toBeDefined();
      expect(grain!.foodDelta).toBeLessThan(0);
    });

    it('does not fire outside revolution era', () => {
      const effects = evaluateDoctrineMechanics(makeCtx({ currentEraId: 'stagnation', totalTicks: 60 }));
      const grain = effects.find((e) => e.mechanicId === 'grain_requisitioning');
      expect(grain).toBeUndefined();
    });
  });

  describe('wartime_conscription (great_patriotic)', () => {
    it('fires during great_patriotic with sufficient population', () => {
      const effects = evaluateDoctrineMechanics(
        makeCtx({ currentEraId: 'great_patriotic', totalTicks: 120, currentPop: 50 }),
      );
      const conscription = effects.find((e) => e.mechanicId === 'wartime_conscription');
      expect(conscription).toBeDefined();
      expect(conscription!.popDelta).toBeLessThan(0);
    });

    it('does not fire with low population', () => {
      const effects = evaluateDoctrineMechanics(
        makeCtx({ currentEraId: 'great_patriotic', totalTicks: 120, currentPop: 5 }),
      );
      const conscription = effects.find((e) => e.mechanicId === 'wartime_conscription');
      expect(conscription).toBeUndefined();
    });
  });

  // ── Thaw/Freeze Oscillation (era 5: thaw_and_freeze) ──────────

  describe('thaw_freeze_oscillation', () => {
    it('starts in thaw phase with production bonus', () => {
      const effects = evaluateDoctrineMechanics(makeCtx({ currentEraId: 'thaw_and_freeze', totalTicks: 30 }));
      const osc = effects.find((e) => e.mechanicId === 'thaw_freeze_oscillation');
      expect(osc).toBeDefined();
      expect(osc!.productionMult).toBeGreaterThan(1.0);
      expect(osc!.moraleDelta).toBeGreaterThan(0);
      expect(getThawFreezeState().phase).toBe('thaw');
    });

    it('transitions to freeze phase after 720 ticks', () => {
      // Set the thaw phase to have started long ago
      setThawFreezeState({ phase: 'thaw', phaseStartTick: 0 });

      const effects = evaluateDoctrineMechanics(makeCtx({ currentEraId: 'thaw_and_freeze', totalTicks: 720 }));
      const osc = effects.find((e) => e.mechanicId === 'thaw_freeze_oscillation');
      expect(osc).toBeDefined();
      expect(getThawFreezeState().phase).toBe('freeze');
      expect(osc!.productionMult).toBeLessThan(1.0);
      expect(osc!.moraleDelta).toBeLessThan(0);
    });

    it('oscillates back to thaw after another 720 ticks', () => {
      setThawFreezeState({ phase: 'freeze', phaseStartTick: 720 });

      const effects = evaluateDoctrineMechanics(makeCtx({ currentEraId: 'thaw_and_freeze', totalTicks: 1440 }));
      const osc = effects.find((e) => e.mechanicId === 'thaw_freeze_oscillation');
      expect(osc).toBeDefined();
      expect(getThawFreezeState().phase).toBe('thaw');
      expect(osc!.productionMult).toBeGreaterThan(1.0);
    });

    it('does not fire outside thaw_and_freeze era', () => {
      const effects = evaluateDoctrineMechanics(makeCtx({ currentEraId: 'revolution', totalTicks: 30 }));
      const osc = effects.find((e) => e.mechanicId === 'thaw_freeze_oscillation');
      expect(osc).toBeUndefined();
    });
  });

  // ── Stagnation Rot (era 7: stagnation) ─────────────────────────

  describe('stagnation_rot', () => {
    it('fires during stagnation era', () => {
      const effects = evaluateDoctrineMechanics(
        makeCtx({ currentEraId: 'stagnation', totalTicks: 60, eraStartTick: 0 }),
      );
      const rot = effects.find((e) => e.mechanicId === 'stagnation_rot');
      expect(rot).toBeDefined();
    });

    it('applies 1.3x decay multiplier', () => {
      const effects = evaluateDoctrineMechanics(
        makeCtx({ currentEraId: 'stagnation', totalTicks: 60, eraStartTick: 0 }),
      );
      const rot = effects.find((e) => e.mechanicId === 'stagnation_rot');
      expect(rot!.decayMult).toBe(1.3);
    });

    it('accumulates paperwork', () => {
      const effects = evaluateDoctrineMechanics(
        makeCtx({ currentEraId: 'stagnation', totalTicks: 60, eraStartTick: 0 }),
      );
      const rot = effects.find((e) => e.mechanicId === 'stagnation_rot');
      expect(rot!.paperworkDelta).toBeGreaterThan(0);
    });

    it('increases corruption multiplier', () => {
      const effects = evaluateDoctrineMechanics(
        makeCtx({ currentEraId: 'stagnation', totalTicks: 60, eraStartTick: 0 }),
      );
      const rot = effects.find((e) => e.mechanicId === 'stagnation_rot');
      expect(rot!.corruptionMult).toBe(1.2);
    });

    it('productivity decreases over years of stagnation', () => {
      // Year 1 of stagnation (360 ticks in)
      const effectsYear1 = evaluateDoctrineMechanics(
        makeCtx({ currentEraId: 'stagnation', totalTicks: 360, eraStartTick: 0 }),
      );
      const rotYear1 = effectsYear1.find((e) => e.mechanicId === 'stagnation_rot');

      // Year 5 of stagnation (1800 ticks in)
      const effectsYear5 = evaluateDoctrineMechanics(
        makeCtx({ currentEraId: 'stagnation', totalTicks: 1800, eraStartTick: 0 }),
      );
      const rotYear5 = effectsYear5.find((e) => e.mechanicId === 'stagnation_rot');

      expect(rotYear5!.productionMult).toBeLessThan(rotYear1!.productionMult);
    });

    it('does not fire outside stagnation era', () => {
      const effects = evaluateDoctrineMechanics(makeCtx({ currentEraId: 'revolution', totalTicks: 60 }));
      const rot = effects.find((e) => e.mechanicId === 'stagnation_rot');
      expect(rot).toBeUndefined();
    });
  });

  // ── Eternal Bureaucratic Singularity (era 8: the_eternal) ──────

  describe('eternal_bureaucracy', () => {
    it('fires during the_eternal era', () => {
      const effects = evaluateDoctrineMechanics(makeCtx({ currentEraId: 'the_eternal', totalTicks: 20 }));
      const bureau = effects.find((e) => e.mechanicId === 'eternal_bureaucracy');
      expect(bureau).toBeDefined();
    });

    it('generates base paperwork', () => {
      const effects = evaluateDoctrineMechanics(
        makeCtx({ currentEraId: 'the_eternal', totalTicks: 20, currentPaperwork: 0 }),
      );
      const bureau = effects.find((e) => e.mechanicId === 'eternal_bureaucracy');
      expect(bureau!.paperworkDelta).toBeGreaterThan(0);
    });

    it('paperwork grows exponentially with accumulation', () => {
      const effectsLow = evaluateDoctrineMechanics(
        makeCtx({ currentEraId: 'the_eternal', totalTicks: 20, currentPaperwork: 0 }),
      );
      const bureauLow = effectsLow.find((e) => e.mechanicId === 'eternal_bureaucracy');

      const effectsHigh = evaluateDoctrineMechanics(
        makeCtx({ currentEraId: 'the_eternal', totalTicks: 20, currentPaperwork: 3000 }),
      );
      const bureauHigh = effectsHigh.find((e) => e.mechanicId === 'eternal_bureaucracy');

      expect(bureauLow).toBeDefined();
      expect(bureauLow!.paperworkDelta).toBeDefined();
      expect(bureauHigh).toBeDefined();
      expect(bureauHigh!.paperworkDelta).toBeDefined();
      expect(bureauHigh!.paperworkDelta).toBeGreaterThan(bureauLow!.paperworkDelta!);
    });

    it('systems slow down as paperwork accumulates', () => {
      const effectsLow = evaluateDoctrineMechanics(
        makeCtx({ currentEraId: 'the_eternal', totalTicks: 20, currentPaperwork: 100 }),
      );
      const bureauLow = effectsLow.find((e) => e.mechanicId === 'eternal_bureaucracy');

      const effectsHigh = evaluateDoctrineMechanics(
        makeCtx({ currentEraId: 'the_eternal', totalTicks: 20, currentPaperwork: 4000 }),
      );
      const bureauHigh = effectsHigh.find((e) => e.mechanicId === 'eternal_bureaucracy');

      expect(bureauHigh!.productionMult).toBeLessThan(bureauLow!.productionMult);
    });

    it('singularity announcement near threshold', () => {
      const effects = evaluateDoctrineMechanics(
        makeCtx({
          currentEraId: 'the_eternal',
          totalTicks: 20,
          currentPaperwork: ETERNAL_PAPERWORK_THRESHOLD - 1,
        }),
      );
      const bureau = effects.find((e) => e.mechanicId === 'eternal_bureaucracy');
      expect(bureau!.description).toContain('SINGULARITY');
    });

    it('production slowdown caps at 50%', () => {
      const effects = evaluateDoctrineMechanics(
        makeCtx({ currentEraId: 'the_eternal', totalTicks: 20, currentPaperwork: 100000 }),
      );
      const bureau = effects.find((e) => e.mechanicId === 'eternal_bureaucracy');
      expect(bureau!.productionMult).toBeGreaterThanOrEqual(0.5);
    });

    it('does not fire outside the_eternal era', () => {
      const effects = evaluateDoctrineMechanics(makeCtx({ currentEraId: 'stagnation', totalTicks: 20 }));
      const bureau = effects.find((e) => e.mechanicId === 'eternal_bureaucracy');
      expect(bureau).toBeUndefined();
    });
  });

  // ── Cross-era doctrine firing ──────────────────────────────────

  describe('cross-era mechanics', () => {
    it('stakhanovite bonus fires during thaw_and_freeze (multi-era mechanic)', () => {
      const effects = evaluateDoctrineMechanics(
        makeCtx({ currentEraId: 'thaw_and_freeze', totalTicks: 30, quotaProgress: 0.6 }),
      );
      const stakh = effects.find((e) => e.mechanicId === 'stakhanovite_bonus');
      expect(stakh).toBeDefined();
    });

    it('multiple mechanics can fire in same era', () => {
      const effects = evaluateDoctrineMechanics(
        makeCtx({ currentEraId: 'thaw_and_freeze', totalTicks: 30, quotaProgress: 0.6 }),
      );
      // Should have both stakhanovite_bonus and thaw_freeze_oscillation
      const ids = effects.map((e) => e.mechanicId);
      expect(ids).toContain('stakhanovite_bonus');
      expect(ids).toContain('thaw_freeze_oscillation');
    });
  });
});
