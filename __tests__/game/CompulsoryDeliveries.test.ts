import {
  CompulsoryDeliveries,
  type CompulsoryDeliverySaveData,
  type DeliveryRates,
  type Doctrine,
} from '../../src/ai/agents/political/CompulsoryDeliveries';
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

/** Updated base rates from political.json (30-70% range). */
const EXPECTED_RATES: Record<Doctrine, DeliveryRates> = {
  revolutionary: { food: 0.3, vodka: 0.2, money: 0.25 },
  industrialization: { food: 0.45, vodka: 0.35, money: 0.5 },
  wartime: { food: 0.6, vodka: 0.5, money: 0.65 },
  reconstruction: { food: 0.25, vodka: 0.2, money: 0.3 },
  thaw: { food: 0.25, vodka: 0.15, money: 0.25 },
  freeze: { food: 0.4, vodka: 0.3, money: 0.45 },
  stagnation: { food: 0.35, vodka: 0.3, money: 0.4 },
  eternal: { food: 0.3, vodka: 0.25, money: 0.35 },
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

    it('has correct default rates (food: 0.30)', () => {
      const cd = new CompulsoryDeliveries();
      const rates = cd.getRates();
      expect(rates.food).toBeCloseTo(0.3);
      expect(rates.vodka).toBeCloseTo(0.2);
      expect(rates.money).toBeCloseTo(0.25);
    });

    it('defaults to 1.0 difficulty multiplier', () => {
      const cd = new CompulsoryDeliveries();
      expect(cd.getDifficultyMultiplier()).toBe(1.0);
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
      // thaw: food=0.25, vodka=0.15, money=0.25
      expect(result.foodTaken).toBeCloseTo(25);
      expect(result.vodkaTaken).toBeCloseTo(7.5);
      expect(result.moneyTaken).toBeCloseTo(50);
    });

    // ── 4. Remaining food = newFood * (1 - foodRate) ─────────

    it('remaining food equals newFood * (1 - foodRate)', () => {
      const cd = new CompulsoryDeliveries('wartime');
      const result = cd.applyDeliveries(100, 0, 0);
      // wartime food rate = 0.60
      expect(result.totalFoodRemaining).toBeCloseTo(100 * (1 - 0.6));
      expect(result.totalFoodRemaining).toBeCloseTo(40);
    });

    it('remaining food is correct for reconstruction', () => {
      const cd = new CompulsoryDeliveries('reconstruction');
      const result = cd.applyDeliveries(200, 0, 0);
      // reconstruction food rate = 0.25
      expect(result.totalFoodRemaining).toBeCloseTo(200 * (1 - 0.25));
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
      // thaw: food=0.25, vodka=0.15, money=0.25
      expect(totals.food).toBeCloseTo(25 * 3);
      expect(totals.vodka).toBeCloseTo(7.5 * 3);
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
      expect(cd.getRates().food).toBeCloseTo(0.25);

      cd.setDoctrine('wartime');
      expect(cd.getDoctrine()).toBe('wartime');
      expect(cd.getRates().food).toBeCloseTo(0.6);
    });

    it('switching to stagnation activates corruption', () => {
      const cd = new CompulsoryDeliveries('thaw');
      expect(cd.getCorruptionRate()).toBe(0);

      cd.setDoctrine('stagnation');
      expect(cd.getCorruptionRate()).toBeGreaterThanOrEqual(0.03);
      expect(cd.getCorruptionRate()).toBeLessThanOrEqual(0.08);
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

      // Base: food=350, vodka=150, money=800
      // Corruption adds extra on top
      expect(result.foodTaken).toBeGreaterThan(1000 * 0.35);
      expect(result.vodkaTaken).toBeGreaterThan(500 * 0.3);
      expect(result.moneyTaken).toBeGreaterThan(2000 * 0.4);
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
      // = 1000 * 0.35 * (1 + corruptionRate)
      const expectedFoodTaken = 1000 * 0.35 * (1 + corruptionRate);
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
      expect(saved.corruptionRate).toBeGreaterThanOrEqual(0.03);
      expect(saved.corruptionRate).toBeLessThanOrEqual(0.08);

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

    it('deserialize preserves difficulty multiplier when provided', () => {
      const cd = new CompulsoryDeliveries('thaw', 0.5);
      cd.applyDeliveries(100, 50, 200);

      const saved = cd.serialize();
      const restored = CompulsoryDeliveries.deserialize(saved, 0.5);

      expect(restored.getDifficultyMultiplier()).toBe(0.5);
      expect(restored.getRates().food).toBeCloseTo(0.25 * 0.5);
    });
  });

  // ── 13. DeliveryResult contains correct values ───────────────

  describe('DeliveryResult fields', () => {
    it('contains all expected fields with correct values', () => {
      const cd = new CompulsoryDeliveries('industrialization');
      const result = cd.applyDeliveries(100, 80, 500);

      // industrialization: food=0.45, vodka=0.35, money=0.50
      expect(result.foodTaken).toBeCloseTo(45);
      expect(result.vodkaTaken).toBeCloseTo(28);
      expect(result.moneyTaken).toBeCloseTo(250);
      expect(result.corruptionLoss).toBe(0);
      expect(result.totalFoodRemaining).toBeCloseTo(55);
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

      expect(result.foodTaken).toBeCloseTo(bigValue * 0.6);
      expect(result.totalFoodRemaining).toBeCloseTo(bigValue * 0.4);
    });

    it('cumulative totals handle many ticks', () => {
      const cd = new CompulsoryDeliveries('thaw');
      for (let i = 0; i < 10_000; i++) {
        cd.applyDeliveries(100, 50, 200);
      }
      const totals = cd.getTotalDelivered();
      expect(totals.food).toBeCloseTo(25 * 10_000);
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

  // ── Difficulty multiplier tests ──────────────────────────────

  describe('difficulty multiplier', () => {
    it('worker difficulty (0.5x) halves effective rates', () => {
      const cd = new CompulsoryDeliveries('wartime', 0.5);
      const rates = cd.getRates();
      // wartime base: food=0.60, vodka=0.50, money=0.65
      // with 0.5x: food=0.30, vodka=0.25, money=0.325
      expect(rates.food).toBeCloseTo(0.3);
      expect(rates.vodka).toBeCloseTo(0.25);
      expect(rates.money).toBeCloseTo(0.325);
    });

    it('comrade difficulty (1.0x) uses base rates unchanged', () => {
      const cd = new CompulsoryDeliveries('wartime', 1.0);
      const rates = cd.getRates();
      expect(rates.food).toBeCloseTo(0.6);
      expect(rates.vodka).toBeCloseTo(0.5);
      expect(rates.money).toBeCloseTo(0.65);
    });

    it('tovarish difficulty (1.2x) increases effective rates', () => {
      const cd = new CompulsoryDeliveries('thaw', 1.2);
      const rates = cd.getRates();
      // thaw base: food=0.25, vodka=0.15, money=0.25
      // with 1.2x: food=0.30, vodka=0.18, money=0.30
      expect(rates.food).toBeCloseTo(0.3);
      expect(rates.vodka).toBeCloseTo(0.18);
      expect(rates.money).toBeCloseTo(0.3);
    });

    it('difficulty multiplier is applied in applyDeliveries', () => {
      const cdWorker = new CompulsoryDeliveries('revolutionary', 0.5);
      const cdComrade = new CompulsoryDeliveries('revolutionary', 1.0);
      const cdTovarish = new CompulsoryDeliveries('revolutionary', 1.2);

      const rWorker = cdWorker.applyDeliveries(1000, 1000, 1000);
      const rComrade = cdComrade.applyDeliveries(1000, 1000, 1000);
      const rTovarish = cdTovarish.applyDeliveries(1000, 1000, 1000);

      // revolutionary base: food=0.30
      expect(rWorker.foodTaken).toBeCloseTo(1000 * 0.3 * 0.5); // 150
      expect(rComrade.foodTaken).toBeCloseTo(1000 * 0.3 * 1.0); // 300
      expect(rTovarish.foodTaken).toBeCloseTo(1000 * 0.3 * 1.2); // 360

      // Worker takes less than comrade takes less than tovarish
      expect(rWorker.foodTaken).toBeLessThan(rComrade.foodTaken);
      expect(rComrade.foodTaken).toBeLessThan(rTovarish.foodTaken);
    });

    it('stagnation corruption applies on top of difficulty-scaled rates', () => {
      const rng = new GameRng('diff-corruption');
      const cd = new CompulsoryDeliveries('stagnation', 1.2);
      cd.setRng(rng);

      const result = cd.applyDeliveries(1000, 0, 0);
      const corruptionRate = cd.getCorruptionRate();

      // foodTaken = 1000 * 0.35 * 1.2 * (1 + corruptionRate)
      const expected = 1000 * 0.35 * 1.2 * (1 + corruptionRate);
      expect(result.foodTaken).toBeCloseTo(expected);
    });

    it('getDifficultyMultiplier returns the stored value', () => {
      const cd05 = new CompulsoryDeliveries('thaw', 0.5);
      const cd10 = new CompulsoryDeliveries('thaw', 1.0);
      const cd12 = new CompulsoryDeliveries('thaw', 1.2);

      expect(cd05.getDifficultyMultiplier()).toBe(0.5);
      expect(cd10.getDifficultyMultiplier()).toBe(1.0);
      expect(cd12.getDifficultyMultiplier()).toBe(1.2);
    });
  });

  // ── Rate ordering tests ──────────────────────────────────────

  describe('rate ordering across doctrines', () => {
    it('wartime has the highest food rate', () => {
      for (const doctrine of ALL_DOCTRINES) {
        const wartimeRates = EXPECTED_RATES.wartime;
        const otherRates = EXPECTED_RATES[doctrine];
        expect(wartimeRates.food).toBeGreaterThanOrEqual(otherRates.food);
      }
    });

    it('wartime has the highest vodka rate', () => {
      for (const doctrine of ALL_DOCTRINES) {
        const wartimeRates = EXPECTED_RATES.wartime;
        const otherRates = EXPECTED_RATES[doctrine];
        expect(wartimeRates.vodka).toBeGreaterThanOrEqual(otherRates.vodka);
      }
    });

    it('wartime has the highest money rate', () => {
      for (const doctrine of ALL_DOCTRINES) {
        const wartimeRates = EXPECTED_RATES.wartime;
        const otherRates = EXPECTED_RATES[doctrine];
        expect(wartimeRates.money).toBeGreaterThanOrEqual(otherRates.money);
      }
    });

    it('thaw has the lowest food rate (tied with reconstruction)', () => {
      const thawRates = EXPECTED_RATES.thaw;
      for (const doctrine of ALL_DOCTRINES) {
        const otherRates = EXPECTED_RATES[doctrine];
        expect(thawRates.food).toBeLessThanOrEqual(otherRates.food);
      }
    });

    it('thaw has the lowest vodka rate', () => {
      const thawRates = EXPECTED_RATES.thaw;
      for (const doctrine of ALL_DOCTRINES) {
        const otherRates = EXPECTED_RATES[doctrine];
        expect(thawRates.vodka).toBeLessThanOrEqual(otherRates.vodka);
      }
    });

    it('thaw has the lowest money rate (tied with revolutionary)', () => {
      const thawRates = EXPECTED_RATES.thaw;
      for (const doctrine of ALL_DOCTRINES) {
        const otherRates = EXPECTED_RATES[doctrine];
        expect(thawRates.money).toBeLessThanOrEqual(otherRates.money);
      }
    });

    it('all base rates are in the 15-65% range', () => {
      for (const doctrine of ALL_DOCTRINES) {
        const rates = EXPECTED_RATES[doctrine];
        for (const key of ['food', 'vodka', 'money'] as const) {
          expect(rates[key]).toBeGreaterThanOrEqual(0.15);
          expect(rates[key]).toBeLessThanOrEqual(0.65);
        }
      }
    });
  });
});
