/**
 * Tests for leader archetype behavioral modifiers.
 *
 * Each General Secretary personality type applies direct gameplay modifiers
 * (resource production, corruption, morale, quota leniency, etc.) via
 * LEADER_MODIFIERS. These are layered on top of minister-level modifiers.
 */

import { DEFAULT_MODIFIERS } from '@/ai/agents/narrative/politburo/constants';
import { LEADER_MODIFIERS } from '@/ai/agents/narrative/politburo/leaderModifiers';
import { applyMinisterOverrides } from '@/ai/agents/narrative/politburo/modifiers';
import type { MinistryModifiers } from '@/ai/agents/narrative/politburo/types';
import { PersonalityType } from '@/ai/agents/narrative/politburo/types';

describe('LeaderArchetypes', () => {
  // ── LEADER_MODIFIERS coverage ──

  describe('LEADER_MODIFIERS', () => {
    const allTypes = Object.values(PersonalityType);

    it('has modifiers for all 8 personality types', () => {
      for (const pt of allTypes) {
        expect(LEADER_MODIFIERS[pt]).toBeDefined();
      }
    });

    it('each modifier set is a non-empty object', () => {
      for (const pt of allTypes) {
        expect(Object.keys(LEADER_MODIFIERS[pt]).length).toBeGreaterThan(0);
      }
    });

    it('all numeric modifier values are finite', () => {
      for (const pt of allTypes) {
        for (const [_key, value] of Object.entries(LEADER_MODIFIERS[pt])) {
          if (typeof value === 'number') {
            expect(Number.isFinite(value)).toBe(true);
          }
        }
      }
    });
  });

  // ── Archetype-specific behavioral tests ──

  describe('Zealot', () => {
    const mods = LEADER_MODIFIERS[PersonalityType.ZEALOT];

    it('boosts factory output', () => {
      expect(mods.factoryOutputMult).toBeGreaterThan(1.0);
    });

    it('penalizes food production', () => {
      expect(mods.foodProductionMult).toBeLessThan(1.0);
    });

    it('has high fear level', () => {
      expect(mods.fearLevel).toBeGreaterThanOrEqual(70);
    });

    it('increases purge frequency', () => {
      expect(mods.purgeFrequencyMult).toBeGreaterThan(1.5);
    });

    it('has negative morale impact', () => {
      expect(mods.moraleModifier).toBeLessThan(0);
    });

    it('enforces art censorship', () => {
      expect(mods.artCensored).toBe(true);
    });
  });

  describe('Reformer', () => {
    const mods = LEADER_MODIFIERS[PersonalityType.REFORMER];

    it('boosts food and vodka production', () => {
      expect(mods.foodProductionMult).toBeGreaterThan(1.0);
      expect(mods.vodkaProductionMult).toBeGreaterThan(1.0);
    });

    it('has low fear level', () => {
      expect(mods.fearLevel).toBeLessThan(30);
    });

    it('allows private gardens and black market', () => {
      expect(mods.privateGardensAllowed).toBe(true);
      expect(mods.blackMarketTolerated).toBe(true);
    });

    it('reduces purge frequency', () => {
      expect(mods.purgeFrequencyMult).toBeLessThan(0.5);
    });

    it('boosts tech research', () => {
      expect(mods.techResearchMult).toBeGreaterThan(1.0);
    });
  });

  describe('Technocrat', () => {
    const mods = LEADER_MODIFIERS[PersonalityType.TECHNOCRAT];

    it('boosts factory output significantly', () => {
      expect(mods.factoryOutputMult).toBeGreaterThanOrEqual(1.3);
    });

    it('has highest tech research multiplier', () => {
      expect(mods.techResearchMult).toBeGreaterThanOrEqual(1.5);
    });

    it('reduces building costs', () => {
      expect(mods.buildingCostMult).toBeLessThan(1.0);
    });

    it('has neutral morale', () => {
      expect(mods.moraleModifier).toBe(0);
    });
  });

  describe('Populist', () => {
    const mods = LEADER_MODIFIERS[PersonalityType.POPULIST];

    it('has highest morale boost', () => {
      expect(mods.moraleModifier).toBeGreaterThanOrEqual(5);
    });

    it('reduces quota difficulty', () => {
      expect(mods.quotaDifficultyMult).toBeLessThan(1.0);
    });

    it('boosts vodka production', () => {
      expect(mods.vodkaProductionMult).toBeGreaterThan(1.0);
    });

    it('allows private gardens', () => {
      expect(mods.privateGardensAllowed).toBe(true);
    });
  });

  describe('Militarist', () => {
    const mods = LEADER_MODIFIERS[PersonalityType.MILITARIST];

    it('has high conscription rate', () => {
      expect(mods.conscriptionRate).toBeGreaterThanOrEqual(10);
    });

    it('boosts factory output (war production)', () => {
      expect(mods.factoryOutputMult).toBeGreaterThan(1.0);
    });

    it('reduces population growth', () => {
      expect(mods.populationGrowthMult).toBeLessThan(1.0);
    });

    it('has negative morale', () => {
      expect(mods.moraleModifier).toBeLessThan(0);
    });

    it('enforces art censorship', () => {
      expect(mods.artCensored).toBe(true);
    });
  });

  describe('Apparatchik', () => {
    const mods = LEADER_MODIFIERS[PersonalityType.APPARATCHIK];

    it('has high corruption drain', () => {
      expect(mods.corruptionDrain).toBeGreaterThan(20);
    });

    it('increases supply chain delays', () => {
      expect(mods.supplyChainDelayMult).toBeGreaterThan(1.0);
    });

    it('increases infrastructure decay', () => {
      expect(mods.infrastructureDecayMult).toBeGreaterThan(1.0);
    });
  });

  // ── Integration: applying modifiers ──

  describe('applyMinisterOverrides integration', () => {
    it('Zealot GS modifiers change defaults correctly', () => {
      const mods: MinistryModifiers = { ...DEFAULT_MODIFIERS };
      applyMinisterOverrides(mods, LEADER_MODIFIERS[PersonalityType.ZEALOT], 1.0);

      // Factory output should be boosted
      expect(mods.factoryOutputMult).toBeGreaterThan(DEFAULT_MODIFIERS.factoryOutputMult);
      // Food should be reduced
      expect(mods.foodProductionMult).toBeLessThan(DEFAULT_MODIFIERS.foodProductionMult);
      // Fear should be higher
      expect(mods.fearLevel).toBeGreaterThan(DEFAULT_MODIFIERS.fearLevel);
    });

    it('Reformer GS modifiers change defaults correctly', () => {
      const mods: MinistryModifiers = { ...DEFAULT_MODIFIERS };
      applyMinisterOverrides(mods, LEADER_MODIFIERS[PersonalityType.REFORMER], 1.0);

      // Fear should be lower
      expect(mods.fearLevel).toBeLessThan(DEFAULT_MODIFIERS.fearLevel);
      // Private gardens should be allowed
      expect(mods.privateGardensAllowed).toBe(true);
    });

    it('Populist GS modifiers improve morale', () => {
      const mods: MinistryModifiers = { ...DEFAULT_MODIFIERS };
      applyMinisterOverrides(mods, LEADER_MODIFIERS[PersonalityType.POPULIST], 1.0);

      expect(mods.moraleModifier).toBeGreaterThan(DEFAULT_MODIFIERS.moraleModifier);
    });

    it('different archetypes produce measurably different modifier profiles', () => {
      const zealotMods: MinistryModifiers = { ...DEFAULT_MODIFIERS };
      const reformerMods: MinistryModifiers = { ...DEFAULT_MODIFIERS };

      applyMinisterOverrides(zealotMods, LEADER_MODIFIERS[PersonalityType.ZEALOT], 1.0);
      applyMinisterOverrides(reformerMods, LEADER_MODIFIERS[PersonalityType.REFORMER], 1.0);

      // Zealot should have higher fear
      expect(zealotMods.fearLevel).toBeGreaterThan(reformerMods.fearLevel);
      // Reformer should have better food production
      expect(reformerMods.foodProductionMult).toBeGreaterThan(zealotMods.foodProductionMult);
      // Zealot should have higher purge frequency
      expect(zealotMods.purgeFrequencyMult).toBeGreaterThan(reformerMods.purgeFrequencyMult);
    });
  });
});
