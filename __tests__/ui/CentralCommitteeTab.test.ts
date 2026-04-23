/**
 * @fileoverview Tests for the CentralCommitteeTab directive decrees component.
 * TDD — tests written before implementation.
 *
 * Covers:
 * - Directive data model (5 directives, correct fields)
 * - Lock-in behavior (can't issue while locked)
 * - Political capital cost validation
 * - Countdown timer logic
 * - Exported types and constants
 */

import {
  type ActiveDirective,
  CENTRAL_COMMITTEE_DIRECTIVES,
  type CentralCommitteeTabProps,
  canIssueDirective,
  type Directive,
  getDirectiveById,
  getRemainingLockIn,
} from '@/ui/hq-tabs/CentralCommitteeTab';

describe('CentralCommitteeTab', () => {
  describe('CENTRAL_COMMITTEE_DIRECTIVES', () => {
    it('exports exactly 5 directives', () => {
      expect(CENTRAL_COMMITTEE_DIRECTIVES).toHaveLength(5);
    });

    it('all directives have required fields', () => {
      for (const d of CENTRAL_COMMITTEE_DIRECTIVES) {
        expect(d.id).toBeDefined();
        expect(typeof d.id).toBe('string');
        expect(d.name).toBeDefined();
        expect(typeof d.name).toBe('string');
        expect(d.description).toBeDefined();
        expect(typeof d.description).toBe('string');
        expect(typeof d.costPoliticalCapital).toBe('number');
        expect(typeof d.lockInTicks).toBe('number');
        expect(d.lockInTicks).toBeGreaterThan(0);
      }
    });

    it('all directive IDs are unique', () => {
      const ids = CENTRAL_COMMITTEE_DIRECTIVES.map((d: Directive) => d.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('Increase Production Quota has correct stats', () => {
      const d = getDirectiveById('increase_production');
      expect(d).toBeDefined();
      expect(d!.name).toBe('Increase Production Quota');
      expect(d!.lockInTicks).toBe(24);
      expect(d!.costPoliticalCapital).toBe(0);
    });

    it('Declare Labor Holiday has correct stats', () => {
      const d = getDirectiveById('labor_holiday');
      expect(d).toBeDefined();
      expect(d!.name).toBe('Declare Labor Holiday');
      expect(d!.lockInTicks).toBe(12);
    });

    it('Emergency Rations has correct stats', () => {
      const d = getDirectiveById('emergency_rations');
      expect(d).toBeDefined();
      expect(d!.name).toBe('Emergency Rations');
      expect(d!.lockInTicks).toBe(6);
    });

    it('Mandatory Overtime has correct stats', () => {
      const d = getDirectiveById('mandatory_overtime');
      expect(d).toBeDefined();
      expect(d!.name).toBe('Mandatory Overtime');
      expect(d!.lockInTicks).toBe(36);
    });

    it('Patriotic Campaign costs political capital', () => {
      const d = getDirectiveById('patriotic_campaign');
      expect(d).toBeDefined();
      expect(d!.name).toBe('Patriotic Campaign');
      expect(d!.costPoliticalCapital).toBe(50);
      expect(d!.lockInTicks).toBe(18);
    });
  });

  describe('getDirectiveById', () => {
    it('returns undefined for unknown ID', () => {
      expect(getDirectiveById('nonexistent')).toBeUndefined();
    });

    it('returns the correct directive for valid ID', () => {
      const d = getDirectiveById('increase_production');
      expect(d).toBeDefined();
      expect(d!.id).toBe('increase_production');
    });
  });

  describe('canIssueDirective', () => {
    it('returns true when no active directive', () => {
      expect(canIssueDirective(null, 100)).toBe(true);
    });

    it('returns false when a directive is still locked in', () => {
      const active: ActiveDirective = {
        directiveId: 'increase_production',
        issuedAtTick: 10,
        lockInTicks: 24,
      };
      // currentTick = 20, lock-in ends at 34
      expect(canIssueDirective(active, 20)).toBe(false);
    });

    it('returns true when lock-in has expired', () => {
      const active: ActiveDirective = {
        directiveId: 'increase_production',
        issuedAtTick: 10,
        lockInTicks: 24,
      };
      // currentTick = 34, lock-in ends at 34
      expect(canIssueDirective(active, 34)).toBe(true);
    });

    it('returns true when lock-in has been exceeded', () => {
      const active: ActiveDirective = {
        directiveId: 'increase_production',
        issuedAtTick: 10,
        lockInTicks: 24,
      };
      expect(canIssueDirective(active, 50)).toBe(true);
    });
  });

  describe('getRemainingLockIn', () => {
    it('returns 0 when no active directive', () => {
      expect(getRemainingLockIn(null, 10)).toBe(0);
    });

    it('returns remaining ticks when locked in', () => {
      const active: ActiveDirective = {
        directiveId: 'emergency_rations',
        issuedAtTick: 10,
        lockInTicks: 6,
      };
      expect(getRemainingLockIn(active, 12)).toBe(4);
    });

    it('returns 0 when lock-in has expired', () => {
      const active: ActiveDirective = {
        directiveId: 'emergency_rations',
        issuedAtTick: 10,
        lockInTicks: 6,
      };
      expect(getRemainingLockIn(active, 16)).toBe(0);
    });

    it('returns 0 when exactly at expiration tick', () => {
      const active: ActiveDirective = {
        directiveId: 'emergency_rations',
        issuedAtTick: 10,
        lockInTicks: 6,
      };
      expect(getRemainingLockIn(active, 16)).toBe(0);
    });

    it('never returns negative values', () => {
      const active: ActiveDirective = {
        directiveId: 'labor_holiday',
        issuedAtTick: 5,
        lockInTicks: 12,
      };
      expect(getRemainingLockIn(active, 100)).toBe(0);
    });
  });

  describe('CentralCommitteeTabProps interface', () => {
    it('accepts required props', () => {
      const props: CentralCommitteeTabProps = {
        directives: CENTRAL_COMMITTEE_DIRECTIVES,
        activeDirective: null,
        onIssueDirective: () => {},
      };
      expect(props.directives).toHaveLength(5);
      expect(props.activeDirective).toBeNull();
      expect(typeof props.onIssueDirective).toBe('function');
    });

    it('accepts active directive in props', () => {
      const active: ActiveDirective = {
        directiveId: 'mandatory_overtime',
        issuedAtTick: 100,
        lockInTicks: 36,
      };
      const props: CentralCommitteeTabProps = {
        directives: CENTRAL_COMMITTEE_DIRECTIVES,
        activeDirective: active,
        onIssueDirective: () => {},
      };
      expect(props.activeDirective).toBe(active);
    });
  });

  describe('directive effects descriptions', () => {
    it('all directives have non-empty descriptions', () => {
      for (const d of CENTRAL_COMMITTEE_DIRECTIVES) {
        expect(d.description.length).toBeGreaterThan(10);
      }
    });

    it('effects array contains at least one effect per directive', () => {
      for (const d of CENTRAL_COMMITTEE_DIRECTIVES) {
        expect(d.effects.length).toBeGreaterThanOrEqual(1);
      }
    });
  });
});
