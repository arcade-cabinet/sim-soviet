/**
 * @fileoverview Tests for the MilitaryTab component:
 * - DefensePosture type and POSTURE_DEFS exports
 * - Posture effect calculations
 * - MilitaryTabProps interface
 * - Stats display data model
 */

import {
  type DefensePosture,
  getPostureEffects,
  type MilitaryTabProps,
  POSTURE_DEFS,
  type PostureEffects,
} from '@/ui/hq-tabs/MilitaryTab';

describe('MilitaryTab', () => {
  describe('POSTURE_DEFS', () => {
    it('exports exactly 4 defense postures', () => {
      expect(POSTURE_DEFS).toHaveLength(4);
    });

    it('postures are in escalation order', () => {
      const keys = POSTURE_DEFS.map((p) => p.key);
      expect(keys).toEqual(['peacetime', 'alert', 'mobilized', 'total_war']);
    });

    it('all posture keys are unique', () => {
      const keys = POSTURE_DEFS.map((p) => p.key);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('all posture labels are uppercase strings', () => {
      for (const p of POSTURE_DEFS) {
        expect(p.label).toBe(p.label.toUpperCase());
        expect(p.label.length).toBeGreaterThan(0);
      }
    });

    it('each posture has the expected label', () => {
      const expected: Record<DefensePosture, string> = {
        peacetime: 'PEACETIME',
        alert: 'ALERT',
        mobilized: 'MOBILIZED',
        total_war: 'TOTAL WAR',
      };
      for (const p of POSTURE_DEFS) {
        expect(p.label).toBe(expected[p.key]);
      }
    });
  });

  describe('getPostureEffects', () => {
    it('peacetime has no penalties', () => {
      const effects = getPostureEffects('peacetime');
      expect(effects.productionModifier).toBe(0);
      expect(effects.conscriptionPercent).toBe(0);
      expect(effects.defenseBonus).toBe(0);
      expect(effects.moralePenalty).toBe(0);
    });

    it('alert has mild effects', () => {
      const effects = getPostureEffects('alert');
      expect(effects.productionModifier).toBe(-5);
      expect(effects.conscriptionPercent).toBe(10);
      expect(effects.defenseBonus).toBe(10);
      expect(effects.moralePenalty).toBe(0);
    });

    it('mobilized has moderate effects', () => {
      const effects = getPostureEffects('mobilized');
      expect(effects.productionModifier).toBe(-15);
      expect(effects.conscriptionPercent).toBe(30);
      expect(effects.defenseBonus).toBe(30);
      expect(effects.moralePenalty).toBe(-10);
    });

    it('total war has severe effects', () => {
      const effects = getPostureEffects('total_war');
      expect(effects.productionModifier).toBe(-30);
      expect(effects.conscriptionPercent).toBe(50);
      expect(effects.defenseBonus).toBe(50);
      expect(effects.moralePenalty).toBe(-25);
    });

    it('returns all four effect fields for every posture', () => {
      for (const p of POSTURE_DEFS) {
        const effects = getPostureEffects(p.key);
        expect(effects).toHaveProperty('productionModifier');
        expect(effects).toHaveProperty('conscriptionPercent');
        expect(effects).toHaveProperty('defenseBonus');
        expect(effects).toHaveProperty('moralePenalty');
      }
    });

    it('defense bonus increases with escalation', () => {
      const bonuses = POSTURE_DEFS.map((p) => getPostureEffects(p.key).defenseBonus);
      for (let i = 1; i < bonuses.length; i++) {
        expect(bonuses[i]).toBeGreaterThanOrEqual(bonuses[i - 1]);
      }
    });

    it('production penalty worsens with escalation', () => {
      const penalties = POSTURE_DEFS.map((p) => getPostureEffects(p.key).productionModifier);
      for (let i = 1; i < penalties.length; i++) {
        expect(penalties[i]).toBeLessThanOrEqual(penalties[i - 1]);
      }
    });
  });

  describe('MilitaryTabProps interface', () => {
    it('accepts all required props', () => {
      const props: MilitaryTabProps = {
        currentPosture: 'peacetime',
        garrisonStrength: 42,
        conscriptionPool: 150,
        defenseReadiness: 65,
        onPostureChange: () => {},
      };
      expect(props.currentPosture).toBe('peacetime');
      expect(props.garrisonStrength).toBe(42);
      expect(props.conscriptionPool).toBe(150);
      expect(props.defenseReadiness).toBe(65);
      expect(typeof props.onPostureChange).toBe('function');
    });

    it('onPostureChange receives the selected posture', () => {
      const received: DefensePosture[] = [];
      const handler = (p: DefensePosture) => received.push(p);

      handler('alert');
      handler('total_war');

      expect(received).toEqual(['alert', 'total_war']);
    });
  });

  describe('DefensePosture type completeness', () => {
    it('all 4 posture keys are valid DefensePosture values', () => {
      const allKeys: DefensePosture[] = ['peacetime', 'alert', 'mobilized', 'total_war'];
      expect(allKeys).toHaveLength(4);
      for (const key of allKeys) {
        const found = POSTURE_DEFS.find((p) => p.key === key);
        expect(found).toBeDefined();
      }
    });
  });

  describe('PostureEffects type', () => {
    it('is a plain object with numeric fields', () => {
      const effects: PostureEffects = {
        productionModifier: -10,
        conscriptionPercent: 20,
        defenseBonus: 20,
        moralePenalty: -5,
      };
      expect(typeof effects.productionModifier).toBe('number');
      expect(typeof effects.conscriptionPercent).toBe('number');
      expect(typeof effects.defenseBonus).toBe('number');
      expect(typeof effects.moralePenalty).toBe('number');
    });
  });
});
