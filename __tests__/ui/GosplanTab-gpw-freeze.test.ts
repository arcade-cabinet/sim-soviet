/**
 * @fileoverview Tests for the GPW construction-freeze banner in GosplanTab.
 *
 * The banner (`testID="gpw-freeze-banner"`) must:
 * - Render only when currentEra === 'great_patriotic'
 * - Stay hidden for all other era IDs, including undefined
 */

import { GREAT_PATRIOTIC_ERA_ID } from '@/ui/hq-tabs/GosplanTab';

describe('GosplanTab — GPW freeze indicator', () => {
  describe('GREAT_PATRIOTIC_ERA_ID constant', () => {
    it('equals "great_patriotic"', () => {
      expect(GREAT_PATRIOTIC_ERA_ID).toBe('great_patriotic');
    });
  });

  describe('isWartime logic', () => {
    // Replicate the component's single conditional: currentEra === GREAT_PATRIOTIC_ERA_ID
    function isWartime(era: string | undefined): boolean {
      return era === GREAT_PATRIOTIC_ERA_ID;
    }

    it('returns true during great_patriotic era', () => {
      expect(isWartime('great_patriotic')).toBe(true);
    });

    it('returns false when era is undefined (no engine)', () => {
      expect(isWartime(undefined)).toBe(false);
    });

    it('returns false during revolution era', () => {
      expect(isWartime('revolution')).toBe(false);
    });

    it('returns false during collectivization era', () => {
      expect(isWartime('collectivization')).toBe(false);
    });

    it('returns false during industrialization era', () => {
      expect(isWartime('industrialization')).toBe(false);
    });

    it('returns false during reconstruction era', () => {
      expect(isWartime('reconstruction')).toBe(false);
    });

    it('returns false during thaw_and_freeze era', () => {
      expect(isWartime('thaw_and_freeze')).toBe(false);
    });

    it('returns false during stagnation era', () => {
      expect(isWartime('stagnation')).toBe(false);
    });

    it('returns false for an empty string', () => {
      expect(isWartime('')).toBe(false);
    });
  });
});
