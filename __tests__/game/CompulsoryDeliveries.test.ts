import {
  CompulsoryDeliveries,
  type CompulsoryDeliverySaveData,
  type DeliveryRates,
  type Doctrine,
} from '../../src/game/CompulsoryDeliveries';
import { GameRng } from '../../src/game/SeedSystem';

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const ALL_DOCTRINES: Doctrine[] = [
  'revolutionary',
  'industrialization',
  'wartime',
  'reconstruction',
  'thaw',
  'freeze',
  'stagnation',
  'eternal',
];

const EXPECTED_RATES: Record<Doctrine, DeliveryRates> = {
  revolutionary: { food: 0.4, vodka: 0.3, money: 0.2 },
  industrialization: { food: 0.5, vodka: 0.4, money: 0.6 },
  wartime: { food: 0.7, vodka: 0.6, money: 0.7 },
  reconstruction: { food: 0.35, vodka: 0.25, money: 0.3 },
  thaw: { food: 0.3, vodka: 0.2, money: 0.25 },
  freeze: { food: 0.45, vodka: 0.35, money: 0.5 },
  stagnation: { food: 0.45, vodka: 0.4, money: 0.5 },
  eternal: { food: 0.4, vodka: 0.35, money: 0.4 },
};

// ─────────────────────────────────────────────────────────────────────────────
//  TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('CompulsoryDeliveries', () => {
  // ── 1. Default doctrine ──────────────────────────────────────

  describe('default construction', () => {
    it('defaults to revolutionary doctrine', () => {
      const cd = new CompulsoryDeliveries();
      expect(cd.getDoctrine()).toBe('revolutionary');
    });

    it('has correct default rates (food: 0.40)', () => {
      const cd = new CompulsoryDeliveries();
      const rates = cd.getRates();
      expect(rates.food).toBeCloseTo(0.4);
      expect(rates.vodka).toBeCloseTo(0.3);
      expect(rates.money).toBeCloseTo(0.2);
    });
  });

  // ── 2. Each doctrine has correct delivery rates ──────────────

  describe('delivery rates per doctrine', () => {
    for (const doctrine of ALL_DOCTRINES) {
      it(`${doctrine} has correct rates`, () => {
        const cd = new CompulsoryDeliveries(doctrine);
        const rates = cd.getRates();
        const expected = EXPECTED_RATES[doctrine];
        expect(rates.food).toBeCloseTo(expected.food);
        expect(rates.vodka).toBeCloseTo(expected.vodka);
        expect(rates.money).toBeCloseTo(expected.money);
      });
    }
  });

  // ── 3. applyDeliveries takes the correct fraction ────────────

  describe('applyDeliveries', () => {
    it('takes the correct fraction of production', () => {
      const cd = new CompulsoryDeliveries('thaw');
      const result = cd.applyDeliveries(100, 50, 200);
      // thaw: food=0.30, vodka=0.20, money=0.25
      expect(result.foodTaken).toBeCloseTo(30);
      expect(result.vodkaTaken).toBeCloseTo(10);
      expect(result.moneyTaken).toBeCloseTo(50);
    });

    // ── 4. Remaining food = newFood * (1 - foodRate) ─────────

    it('remaining food equals newFood * (1 - foodRate)', () => {
      const cd = new CompulsoryDeliveries('wartime');
      const result = cd.applyDeliveries(100, 0, 0);
      // wartime food rate = 0.70
      expect(result.totalFoodRemaining).toBeCloseTo(100 * (1 - 0.7));
      expect(result.totalFoodRemaining).toBeCloseTo(30);
    });

    it('remaining food is correct for reconstruction', () => {
      const cd = new CompulsoryDeliveries('reconstruction');
      const result = cd.applyDeliveries(200, 0, 0);
      // reconstruction food rate = 0.35
      expect(result.totalFoodRemaining).toBeCloseTo(200 * (1 - 0.35));
    });
  });

  // ── 5. Cumulative totals accumulate ──────────────────────────

  describe('cumulative totals', () => {
    it('accumulates across multiple ticks', () => {
      const cd = new CompulsoryDeliveries('thaw');
      cd.applyDeliveries(100, 50, 200);
      cd.applyDeliveries(100, 50, 200);
      cd.applyDeliveries(100, 50, 200);

      const totals = cd.getTotalDelivered();
      // thaw: food=0.30, vodka=0.20, money=0.25
      expect(totals.food).toBeCloseTo(30 * 3);
      expect(totals.vodka).toBeCloseTo(10 * 3);
      expect(totals.money).toBeCloseTo(50 * 3);
    });

    it('returns a copy, not the internal object', () => {
      const cd = new CompulsoryDeliveries();
      cd.applyDeliveries(100, 100, 100);
      const totals = cd.getTotalDelivered();
      totals.food = 9999;
      expect(cd.getTotalDelivered().food).not.toBe(9999);
    });
  });

  // ── 6. resetTotals clears cumulative tracking ────────────────

  describe('resetTotals', () => {
    it('clears cumulative tracking', () => {
      const cd = new CompulsoryDeliveries('freeze');
      cd.applyDeliveries(100, 100, 100);
      expect(cd.getTotalDelivered().food).toBeGreaterThan(0);

      cd.resetTotals();
      const totals = cd.getTotalDelivered();
      expect(totals.food).toBe(0);
      expect(totals.vodka).toBe(0);
      expect(totals.money).toBe(0);
    });
  });

  // ── 7. setDoctrine changes active rates ──────────────────────

  describe('setDoctrine', () => {
    it('changes the active rates', () => {
      const cd = new CompulsoryDeliveries('thaw');
      expect(cd.getRates().food).toBeCloseTo(0.3);

      cd.setDoctrine('wartime');
      expect(cd.getDoctrine()).toBe('wartime');
      expect(cd.getRates().food).toBeCloseTo(0.7);
    });

    it('switching to stagnation activates corruption', () => {
      const cd = new CompulsoryDeliveries('thaw');
      expect(cd.getCorruptionRate()).toBe(0);

      cd.setDoctrine('stagnation');
      expect(cd.getCorruptionRate()).toBeGreaterThanOrEqual(0.05);
      expect(cd.getCorruptionRate()).toBeLessThanOrEqual(0.15);
    });

    it('switching away from stagnation clears corruption', () => {
      const cd = new CompulsoryDeliveries('stagnation');
      expect(cd.getCorruptionRate()).toBeGreaterThan(0);

      cd.setDoctrine('thaw');
      expect(cd.getCorruptionRate()).toBe(0);
    });
  });

  // ── 8. Zero production → zero deliveries ─────────────────────

  describe('zero production', () => {
    it('returns zero deliveries with no NaN', () => {
      const cd = new CompulsoryDeliveries('wartime');
      const result = cd.applyDeliveries(0, 0, 0);

      expect(result.foodTaken).toBe(0);
      expect(result.vodkaTaken).toBe(0);
      expect(result.moneyTaken).toBe(0);
      expect(result.corruptionLoss).toBe(0);
      expect(result.totalFoodRemaining).toBe(0);
      expect(Number.isNaN(result.foodTaken)).toBe(false);
      expect(Number.isNaN(result.totalFoodRemaining)).toBe(false);
    });

    it('zero production in stagnation also returns zero', () => {
      const cd = new CompulsoryDeliveries('stagnation');
      const result = cd.applyDeliveries(0, 0, 0);

      expect(result.foodTaken).toBe(0);
      expect(result.corruptionLoss).toBe(0);
      expect(result.totalFoodRemaining).toBe(0);
    });
  });

  // ── 9. Stagnation doctrine adds corruption loss ──────────────

  describe('stagnation corruption', () => {
    it('adds corruption loss on top of base delivery', () => {
      const rng = new GameRng('stagnation-test');
      const cd = new CompulsoryDeliveries('stagnation');
      cd.setRng(rng);

      const result = cd.applyDeliveries(1000, 500, 2000);

      // Base: food=450, vodka=200, money=1000
      // Corruption adds extra on top
      expect(result.foodTaken).toBeGreaterThan(1000 * 0.45);
      expect(result.vodkaTaken).toBeGreaterThan(500 * 0.4);
      expect(result.moneyTaken).toBeGreaterThan(2000 * 0.5);
      expect(result.corruptionLoss).toBeGreaterThan(0);
    });

    // ── 10. Corruption is on top of base rate ────────────────

    it('corruption is multiplicative on the base rate', () => {
      const rng = new GameRng('corruption-math');
      const cd = new CompulsoryDeliveries('stagnation');
      cd.setRng(rng);

      const result = cd.applyDeliveries(1000, 0, 0);
      const corruptionRate = cd.getCorruptionRate();

      // foodTaken should be food * baseRate * (1 + corruptionRate)
      // = 1000 * 0.45 * (1 + corruptionRate)
      const expectedFoodTaken = 1000 * 0.45 * (1 + corruptionRate);
      expect(result.foodTaken).toBeCloseTo(expectedFoodTaken);
    });
  });

  // ── 11. Non-stagnation doctrines have zero corruption ────────

  describe('no corruption outside stagnation', () => {
    for (const doctrine of ALL_DOCTRINES.filter((d) => d !== 'stagnation')) {
      it(`${doctrine} has zero corruption`, () => {
        const cd = new CompulsoryDeliveries(doctrine);
        const result = cd.applyDeliveries(1000, 500, 2000);
        expect(result.corruptionLoss).toBe(0);
        expect(cd.getCorruptionRate()).toBe(0);
      });
    }
  });

  // ── 12. serialize/deserialize round-trips correctly ──────────

  describe('serialization', () => {
    it('round-trips correctly', () => {
      const cd = new CompulsoryDeliveries('freeze');
      cd.applyDeliveries(100, 50, 200);
      cd.applyDeliveries(200, 100, 400);

      const saved = cd.serialize();
      const restored = CompulsoryDeliveries.deserialize(saved);

      expect(restored.getDoctrine()).toBe('freeze');
      expect(restored.getRates()).toEqual(cd.getRates());

      const originalTotals = cd.getTotalDelivered();
      const restoredTotals = restored.getTotalDelivered();
      expect(restoredTotals.food).toBeCloseTo(originalTotals.food);
      expect(restoredTotals.vodka).toBeCloseTo(originalTotals.vodka);
      expect(restoredTotals.money).toBeCloseTo(originalTotals.money);
    });

    it('preserves doctrine in serialized data', () => {
      const cd = new CompulsoryDeliveries('wartime');
      const saved = cd.serialize();
      expect(saved.doctrine).toBe('wartime');
    });

    it('preserves corruption rate for stagnation', () => {
      const cd = new CompulsoryDeliveries('stagnation');
      const saved = cd.serialize();
      expect(saved.corruptionRate).toBeGreaterThanOrEqual(0.05);
      expect(saved.corruptionRate).toBeLessThanOrEqual(0.15);

      const restored = CompulsoryDeliveries.deserialize(saved);
      expect(restored.getCorruptionRate()).toBe(saved.corruptionRate);
    });

    it('serialized data has correct shape', () => {
      const cd = new CompulsoryDeliveries();
      const saved: CompulsoryDeliverySaveData = cd.serialize();
      expect(saved).toHaveProperty('doctrine');
      expect(saved).toHaveProperty('totalDelivered');
      expect(saved).toHaveProperty('corruptionRate');
      expect(saved.totalDelivered).toHaveProperty('food');
      expect(saved.totalDelivered).toHaveProperty('vodka');
      expect(saved.totalDelivered).toHaveProperty('money');
    });
  });

  // ── 13. DeliveryResult contains correct values ───────────────

  describe('DeliveryResult fields', () => {
    it('contains all expected fields with correct values', () => {
      const cd = new CompulsoryDeliveries('industrialization');
      const result = cd.applyDeliveries(100, 80, 500);

      // industrialization: food=0.50, vodka=0.40, money=0.60
      expect(result.foodTaken).toBeCloseTo(50);
      expect(result.vodkaTaken).toBeCloseTo(32);
      expect(result.moneyTaken).toBeCloseTo(300);
      expect(result.corruptionLoss).toBe(0);
      expect(result.totalFoodRemaining).toBeCloseTo(50);
    });

    it('totalFoodRemaining = newFood - foodTaken', () => {
      const cd = new CompulsoryDeliveries('eternal');
      const result = cd.applyDeliveries(250, 100, 100);
      expect(result.totalFoodRemaining).toBeCloseTo(250 - result.foodTaken);
    });
  });

  // ── 14. Large production values handled correctly ────────────

  describe('large values', () => {
    it('handles large production without overflow', () => {
      const cd = new CompulsoryDeliveries('wartime');
      const bigValue = 1_000_000_000;
      const result = cd.applyDeliveries(bigValue, bigValue, bigValue);

      expect(Number.isFinite(result.foodTaken)).toBe(true);
      expect(Number.isFinite(result.vodkaTaken)).toBe(true);
      expect(Number.isFinite(result.moneyTaken)).toBe(true);
      expect(Number.isFinite(result.totalFoodRemaining)).toBe(true);

      expect(result.foodTaken).toBeCloseTo(bigValue * 0.7);
      expect(result.totalFoodRemaining).toBeCloseTo(bigValue * 0.3);
    });

    it('cumulative totals handle many ticks', () => {
      const cd = new CompulsoryDeliveries('thaw');
      for (let i = 0; i < 10_000; i++) {
        cd.applyDeliveries(100, 50, 200);
      }
      const totals = cd.getTotalDelivered();
      expect(totals.food).toBeCloseTo(30 * 10_000);
      expect(Number.isFinite(totals.food)).toBe(true);
    });
  });

  // ── 15. Rates are always between 0.0 and 1.0 ────────────────

  describe('rate bounds', () => {
    for (const doctrine of ALL_DOCTRINES) {
      it(`${doctrine} rates are all in [0.0, 1.0]`, () => {
        const cd = new CompulsoryDeliveries(doctrine);
        const rates = cd.getRates();
        for (const key of ['food', 'vodka', 'money'] as const) {
          expect(rates[key]).toBeGreaterThanOrEqual(0.0);
          expect(rates[key]).toBeLessThanOrEqual(1.0);
        }
      });
    }
  });

  // ── Additional edge cases ────────────────────────────────────

  describe('seeded RNG determinism', () => {
    it('produces deterministic corruption with seeded RNG', () => {
      const cd1 = new CompulsoryDeliveries('stagnation');
      cd1.setRng(new GameRng('determinism-test'));
      const result1 = cd1.applyDeliveries(1000, 500, 2000);

      const cd2 = new CompulsoryDeliveries('stagnation');
      cd2.setRng(new GameRng('determinism-test'));
      const result2 = cd2.applyDeliveries(1000, 500, 2000);

      expect(result1.foodTaken).toBeCloseTo(result2.foodTaken);
      expect(result1.corruptionLoss).toBeCloseTo(result2.corruptionLoss);
    });
  });

  describe('constructor with initial doctrine', () => {
    it('accepts an initial doctrine', () => {
      const cd = new CompulsoryDeliveries('eternal');
      expect(cd.getDoctrine()).toBe('eternal');
    });
  });
});
