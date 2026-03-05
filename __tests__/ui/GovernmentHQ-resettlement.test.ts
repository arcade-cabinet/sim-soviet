/**
 * @fileoverview Tests for Resettlement Alert in GovernmentHQ.
 *
 * Covers:
 * - Resettlement alert visibility based on directiveIssued state
 * - Countdown display from warningTicksRemaining
 * - Preparation gauge logic
 * - Disassembly protocol toggle
 */

import {
  type ResettlementDirectiveState,
  createResettlementState,
  enactDisassembly,
  tickWarningPeriod,
  RESETTLEMENT_CONSTANTS,
} from '@/ai/agents/political/resettlementDirective';

describe('GovernmentHQ — Resettlement Alert', () => {
  describe('resettlement state visibility', () => {
    it('initial state: directiveIssued is false — alert should not show', () => {
      const state = createResettlementState();
      expect(state.directiveIssued).toBe(false);
      expect(state.executed).toBe(false);
    });

    it('active directive shows alert', () => {
      const state: ResettlementDirectiveState = {
        ...createResettlementState(),
        directiveIssued: true,
        warningTicksRemaining: 8,
      };
      // Alert condition: directiveIssued && !executed
      expect(state.directiveIssued && !state.executed).toBe(true);
    });

    it('executed directive does not show alert', () => {
      const state: ResettlementDirectiveState = {
        ...createResettlementState(),
        directiveIssued: true,
        executed: true,
      };
      expect(state.directiveIssued && !state.executed).toBe(false);
    });
  });

  describe('countdown display', () => {
    it('warning period starts at 12 ticks', () => {
      expect(RESETTLEMENT_CONSTANTS.WARNING_PERIOD_TICKS).toBe(12);
    });

    it('warningTicksRemaining decrements each tick', () => {
      const state: ResettlementDirectiveState = {
        ...createResettlementState(),
        directiveIssued: true,
        warningTicksRemaining: 12,
      };
      tickWarningPeriod(state);
      expect(state.warningTicksRemaining).toBe(11);
    });

    it('execution triggers when remaining hits 0', () => {
      const state: ResettlementDirectiveState = {
        ...createResettlementState(),
        directiveIssued: true,
        warningTicksRemaining: 1,
      };
      const shouldExecute = tickWarningPeriod(state);
      expect(shouldExecute).toBe(true);
      expect(state.executed).toBe(true);
    });
  });

  describe('preparation gauge', () => {
    it('preparation starts at 0', () => {
      const state = createResettlementState();
      expect(state.preparationLevel).toBe(0);
    });

    it('base preparation increases per tick', () => {
      const state: ResettlementDirectiveState = {
        ...createResettlementState(),
        directiveIssued: true,
        warningTicksRemaining: 10,
      };
      tickWarningPeriod(state);
      expect(state.preparationLevel).toBeCloseTo(RESETTLEMENT_CONSTANTS.BASE_PREP_PER_TICK);
    });

    it('disassembly increases preparation faster', () => {
      const state: ResettlementDirectiveState = {
        ...createResettlementState(),
        directiveIssued: true,
        warningTicksRemaining: 10,
        disassemblyActive: true,
      };
      tickWarningPeriod(state);
      expect(state.preparationLevel).toBeCloseTo(
        RESETTLEMENT_CONSTANTS.BASE_PREP_PER_TICK + RESETTLEMENT_CONSTANTS.DISASSEMBLY_PREP_PER_TICK,
      );
    });
  });

  describe('disassembly protocol', () => {
    it('can be enacted during warning period', () => {
      const state: ResettlementDirectiveState = {
        ...createResettlementState(),
        directiveIssued: true,
        warningTicksRemaining: 8,
      };
      const success = enactDisassembly(state);
      expect(success).toBe(true);
      expect(state.disassemblyActive).toBe(true);
    });

    it('cannot be enacted twice', () => {
      const state: ResettlementDirectiveState = {
        ...createResettlementState(),
        directiveIssued: true,
        warningTicksRemaining: 8,
        disassemblyActive: true,
      };
      const success = enactDisassembly(state);
      expect(success).toBe(false);
    });

    it('cannot be enacted after execution', () => {
      const state: ResettlementDirectiveState = {
        ...createResettlementState(),
        directiveIssued: true,
        executed: true,
      };
      const success = enactDisassembly(state);
      expect(success).toBe(false);
    });
  });
});
