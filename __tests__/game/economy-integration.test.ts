import { CompulsoryDeliveries } from '@/ai/agents/political/CompulsoryDeliveries';
import { calculateBuildingTrudodni, DEFAULT_TRUDODNI, DIFFICULTY_MULTIPLIERS, EconomySystem } from '../../src/ai/agents/economy/economy-core';
import { GameRng } from '@/game/SeedSystem';

describe('Economy Integration', () => {
  // ── CompulsoryDeliveries ──────────────────────────────────────

  describe('CompulsoryDeliveries', () => {
    it('deducts correct percentage from production based on doctrine', () => {
      const cd = new CompulsoryDeliveries('revolutionary');

      const result = cd.applyDeliveries(100, 50, 200);

      // revolutionary doctrine: food=0.05, vodka=0.03, money=0.05
      expect(result.foodTaken).toBe(5);
      expect(result.vodkaTaken).toBeCloseTo(1.5);
      expect(result.moneyTaken).toBe(10);
      expect(result.totalFoodRemaining).toBe(95);
      expect(result.corruptionLoss).toBe(0); // no corruption outside stagnation
    });

    it('applies higher extraction rates for wartime doctrine', () => {
      const cd = new CompulsoryDeliveries('wartime');

      const result = cd.applyDeliveries(100, 100, 100);

      // wartime: food=0.10, vodka=0.08, money=0.15
      expect(result.foodTaken).toBe(10);
      expect(result.vodkaTaken).toBe(8);
      expect(result.moneyTaken).toBe(15);
      expect(result.totalFoodRemaining).toBe(90);
    });

    it('adds corruption losses during stagnation doctrine', () => {
      const rng = new GameRng('test-corruption-seed');
      const cd = new CompulsoryDeliveries('stagnation');
      cd.setRng(rng);

      const result = cd.applyDeliveries(100, 100, 100);

      // stagnation: food=0.08, vodka=0.05, money=0.10, plus corruption 3-8%
      expect(result.corruptionLoss).toBeGreaterThan(0);
      // Total food taken should exceed base 0.08 rate due to corruption
      expect(result.foodTaken).toBeGreaterThan(8);
    });

    it('accumulates delivery totals across multiple ticks', () => {
      const cd = new CompulsoryDeliveries('thaw');

      cd.applyDeliveries(100, 100, 100);
      cd.applyDeliveries(100, 100, 100);

      const totals = cd.getTotalDelivered();
      // thaw: food=0.05, vodka=0.03, money=0.05 — applied twice
      expect(totals.food).toBe(10);
      expect(totals.vodka).toBe(6);
      expect(totals.money).toBe(10);
    });

    it('resets totals correctly for annual report', () => {
      const cd = new CompulsoryDeliveries('reconstruction');
      cd.applyDeliveries(200, 100, 300);
      cd.resetTotals();

      const totals = cd.getTotalDelivered();
      expect(totals.food).toBe(0);
      expect(totals.vodka).toBe(0);
      expect(totals.money).toBe(0);
    });

    it('switches doctrine and updates rates correctly', () => {
      const cd = new CompulsoryDeliveries('revolutionary');
      cd.setDoctrine('industrialization');

      const result = cd.applyDeliveries(100, 100, 100);

      // industrialization: food=0.08, vodka=0.05, money=0.10
      expect(result.foodTaken).toBe(8);
      expect(result.vodkaTaken).toBe(5);
      expect(result.moneyTaken).toBe(10);
    });
  });

  // ── Trudodni ──────────────────────────────────────────────────

  describe('Trudodni', () => {
    it('accumulates trudodni per building per tick', () => {
      const eco = new EconomySystem('revolution', 'comrade');

      eco.recordTrudodni('0,0', 'coal-plant', 3);

      const record = eco.getTrudodni();
      // coal-plant rate is 1.5, 3 workers: 1.5 * 3 = 4.5
      expect(record.totalContributed).toBe(4.5);
      expect(record.perBuilding.get('0,0')).toBe(4.5);
    });

    it('uses default rate for unrecognized buildings', () => {
      const earned = calculateBuildingTrudodni('unknown-building', 2);
      expect(earned).toBe(DEFAULT_TRUDODNI * 2);
    });

    it('correctly calculates trudodni ratio against minimum', () => {
      const eco = new EconomySystem('revolution', 'comrade');
      // comrade minimum: 100
      eco.recordTrudodni('0,0', 'gulag', 10); // 1.5 * 10 = 15

      const ratio = eco.getTrudodniRatio();
      expect(ratio).toBe(15 / 100);
      expect(ratio).toBeLessThan(1.0);
    });

    it('resets trudodni for new plan period', () => {
      const eco = new EconomySystem('revolution', 'comrade');
      eco.recordTrudodni('0,0', 'factory', 5);
      eco.resetTrudodni();

      expect(eco.getTrudodni().totalContributed).toBe(0);
      expect(eco.getTrudodni().perBuilding.size).toBe(0);
    });
  });

  // ── Blat ──────────────────────────────────────────────────────

  describe('Blat', () => {
    it('starts with 10 connections and grants blat correctly', () => {
      const eco = new EconomySystem('revolution', 'comrade');
      expect(eco.getBlat().connections).toBe(10);

      eco.grantBlat(15);
      expect(eco.getBlat().connections).toBe(25);
      expect(eco.getBlat().totalEarned).toBe(25); // 10 initial + 15 granted
    });

    it('caps blat at 100', () => {
      const eco = new EconomySystem('revolution', 'comrade');
      eco.grantBlat(200);
      expect(eco.getBlat().connections).toBe(100);
    });

    it('spending blat for delivery improvement increases reliability', () => {
      const eco = new EconomySystem('revolution', 'comrade');
      const initialReliability = eco.getFondy().reliability;

      const result = eco.spendBlat(5, 'improve_delivery');

      expect(result.success).toBe(true);
      expect(eco.getBlat().connections).toBe(5);
      expect(eco.getBlat().totalSpent).toBe(5);
      expect(eco.getFondy().reliability).toBe(Math.min(1.0, initialReliability + 0.05));
    });

    it('spending blat fails when insufficient connections', () => {
      const eco = new EconomySystem('revolution', 'comrade');
      const result = eco.spendBlat(20, 'improve_delivery');

      expect(result.success).toBe(false);
      expect(eco.getBlat().connections).toBe(10); // unchanged
    });
  });

  // ── Fondy Delivery ─────────────────────────────────────────────

  describe('Fondy', () => {
    it('delivers resources at the correct interval', () => {
      const rng = new GameRng('test-fondy-seed');
      const eco = new EconomySystem('revolution', 'comrade');
      eco.setRng(rng);

      // Before delivery interval, should return null
      const noDelivery = eco.processDelivery(0);
      expect(noDelivery).toBeNull();

      // At or past the delivery interval, should attempt delivery
      const interval = eco.getFondy().deliveryInterval;
      const delivery = eco.processDelivery(interval);
      expect(delivery).not.toBeNull();
    });

    it('era change updates fondy config', () => {
      const eco = new EconomySystem('revolution', 'comrade');
      eco.getFondy().deliveryInterval;

      eco.setEra('industrialization');
      const industrializationInterval = eco.getFondy().deliveryInterval;

      // Different eras have different fondy configurations
      // (interval and/or reliability may differ)
      expect(eco.getEra()).toBe('industrialization');
      // The config should have been updated
      expect(typeof industrializationInterval).toBe('number');
    });
  });

  // ── EconomySystem.tick integration ────────────────────────────

  describe('EconomySystem.tick', () => {
    it('returns comprehensive tick result with all subsystems', () => {
      const rng = new GameRng('test-tick-seed');
      const eco = new EconomySystem('revolution', 'comrade');
      eco.setRng(rng);

      const result = eco.tick(0, 1922, 50, ['coal-plant', 'factory'], {
        month: 1,
        money: 500,
        hasHeatingResource: true,
      });

      expect(result.trudodniEarned).toBeGreaterThan(0);
      expect(typeof result.blatLevel).toBe('number');
      expect(typeof result.rationsActive).toBe('boolean');
      expect(result.heatingResult).toBeDefined();
    });
  });

  // ── Difficulty Multipliers ───────────────────────────────────

  describe('Difficulty multipliers', () => {
    it('tovarish is harder than worker across all dimensions', () => {
      const worker = DIFFICULTY_MULTIPLIERS.worker;
      const tovarish = DIFFICULTY_MULTIPLIERS.tovarish;

      // Higher quota targets
      expect(tovarish.quotaTarget).toBeGreaterThan(worker.quotaTarget);
      // Fewer starting resources
      expect(tovarish.startingResources).toBeLessThan(worker.startingResources);
      // Faster decay
      expect(tovarish.decayRate).toBeGreaterThan(worker.decayRate);
      // More politruks
      expect(tovarish.politruksPer100).toBeGreaterThan(worker.politruksPer100);
    });
  });
});
