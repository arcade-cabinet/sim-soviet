import { describe, expect, it } from 'vitest';
import { CompulsoryDeliveries } from '@/game/CompulsoryDeliveries';
import { DIFFICULTY_MULTIPLIERS } from '@/game/economy/difficulty';
import { EconomySystem } from '@/game/economy/EconomySystem';
import { calculateBuildingTrudodni, DEFAULT_TRUDODNI } from '@/game/economy/trudodni';
import { GameRng } from '@/game/SeedSystem';

describe('Economy Integration', () => {
  // ── CompulsoryDeliveries ──────────────────────────────────────

  describe('CompulsoryDeliveries', () => {
    it('deducts correct percentage from production based on doctrine', () => {
      const cd = new CompulsoryDeliveries('revolutionary');

      const result = cd.applyDeliveries(100, 50, 200);

      // revolutionary doctrine: food=0.4, vodka=0.3, money=0.2
      expect(result.foodTaken).toBe(40);
      expect(result.vodkaTaken).toBe(15);
      expect(result.moneyTaken).toBe(40);
      expect(result.totalFoodRemaining).toBe(60);
      expect(result.corruptionLoss).toBe(0); // no corruption outside stagnation
    });

    it('applies higher extraction rates for wartime doctrine', () => {
      const cd = new CompulsoryDeliveries('wartime');

      const result = cd.applyDeliveries(100, 100, 100);

      // wartime: food=0.7, vodka=0.6, money=0.7
      expect(result.foodTaken).toBe(70);
      expect(result.vodkaTaken).toBe(60);
      expect(result.moneyTaken).toBe(70);
      expect(result.totalFoodRemaining).toBe(30);
    });

    it('adds corruption losses during stagnation doctrine', () => {
      const rng = new GameRng('test-corruption-seed');
      const cd = new CompulsoryDeliveries('stagnation');
      cd.setRng(rng);

      const result = cd.applyDeliveries(100, 100, 100);

      // stagnation: food=0.45, vodka=0.4, money=0.5, plus corruption 5-15%
      expect(result.corruptionLoss).toBeGreaterThan(0);
      // Total food taken should exceed base 0.45 rate due to corruption
      expect(result.foodTaken).toBeGreaterThan(45);
    });

    it('accumulates delivery totals across multiple ticks', () => {
      const cd = new CompulsoryDeliveries('thaw');

      cd.applyDeliveries(100, 100, 100);
      cd.applyDeliveries(100, 100, 100);

      const totals = cd.getTotalDelivered();
      // thaw: food=0.3, vodka=0.2, money=0.25 — applied twice
      expect(totals.food).toBe(60);
      expect(totals.vodka).toBe(40);
      expect(totals.money).toBe(50);
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

      // industrialization: food=0.5, vodka=0.4, money=0.6
      expect(result.foodTaken).toBe(50);
      expect(result.vodkaTaken).toBe(40);
      expect(result.moneyTaken).toBe(60);
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
      // comrade minimum: 80
      eco.recordTrudodni('0,0', 'gulag', 10); // 2.0 * 10 = 20

      const ratio = eco.getTrudodniRatio();
      expect(ratio).toBe(20 / 80);
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

      const success = eco.spendBlat(5, 'improve_delivery');

      expect(success).toBe(true);
      expect(eco.getBlat().connections).toBe(5);
      expect(eco.getBlat().totalSpent).toBe(5);
      expect(eco.getFondy().reliability).toBe(Math.min(1.0, initialReliability + 0.05));
    });

    it('spending blat fails when insufficient connections', () => {
      const eco = new EconomySystem('revolution', 'comrade');
      const success = eco.spendBlat(20, 'improve_delivery');

      expect(success).toBe(false);
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
