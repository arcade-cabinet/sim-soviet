import {
  createContaminationZone,
  spreadContamination,
  decayContamination,
  getContaminationAt,
  isHabitable,
  type ContaminationZone,
} from '../../src/ai/agents/core/contaminationSystem';

describe('contaminationSystem', () => {
  describe('createContaminationZone', () => {
    it('creates a zone with given parameters', () => {
      const zone = createContaminationZone(10, 20, 5, 0.8, 'nuclear', 1986);
      expect(zone).toEqual({
        centerX: 10,
        centerY: 20,
        radius: 5,
        intensity: 0.8,
        sourceType: 'nuclear',
        yearCreated: 1986,
      });
    });

    it('clamps intensity to [0, 1]', () => {
      const over = createContaminationZone(0, 0, 3, 1.5, 'chemical', 1970);
      expect(over.intensity).toBe(1);

      const under = createContaminationZone(0, 0, 3, -0.2, 'industrial', 1970);
      expect(under.intensity).toBe(0);
    });

    it('clamps radius to minimum 0', () => {
      const zone = createContaminationZone(0, 0, -1, 0.5, 'nuclear', 1986);
      expect(zone.radius).toBe(0);
    });
  });

  describe('spreadContamination', () => {
    it('increases radius by 0.5 per year', () => {
      const zone = createContaminationZone(5, 5, 3, 0.9, 'nuclear', 1986);
      const spread = spreadContamination(zone, 1987);
      expect(spread.radius).toBeCloseTo(3.5);
    });

    it('spreads proportionally over multiple years', () => {
      const zone = createContaminationZone(5, 5, 3, 0.9, 'nuclear', 1986);
      const spread = spreadContamination(zone, 1990);
      // 4 years * 0.5 = 2.0 growth
      expect(spread.radius).toBeCloseTo(5.0);
    });

    it('caps radius at 20 tiles', () => {
      const zone = createContaminationZone(5, 5, 18, 0.9, 'nuclear', 1950);
      const spread = spreadContamination(zone, 2000);
      expect(spread.radius).toBe(20);
    });

    it('does not spread if year is before or equal to creation year', () => {
      const zone = createContaminationZone(5, 5, 3, 0.9, 'nuclear', 1986);
      const same = spreadContamination(zone, 1986);
      expect(same.radius).toBe(3);
      const before = spreadContamination(zone, 1980);
      expect(before.radius).toBe(3);
    });

    it('does not mutate the original zone', () => {
      const zone = createContaminationZone(5, 5, 3, 0.9, 'nuclear', 1986);
      spreadContamination(zone, 1990);
      expect(zone.radius).toBe(3);
    });
  });

  describe('decayContamination', () => {
    it('decays nuclear with 30-year half-life', () => {
      const zone = createContaminationZone(0, 0, 5, 1.0, 'nuclear', 1986);
      const decayed = decayContamination(zone, 2016); // 30 years
      expect(decayed.intensity).toBeCloseTo(0.5, 1);
    });

    it('decays industrial with 10-year half-life', () => {
      const zone = createContaminationZone(0, 0, 5, 1.0, 'industrial', 1970);
      const decayed = decayContamination(zone, 1980); // 10 years
      expect(decayed.intensity).toBeCloseTo(0.5, 1);
    });

    it('decays chemical with 5-year half-life', () => {
      const zone = createContaminationZone(0, 0, 5, 1.0, 'chemical', 1970);
      const decayed = decayContamination(zone, 1975); // 5 years
      expect(decayed.intensity).toBeCloseTo(0.5, 1);
    });

    it('two half-lives reduce to ~25%', () => {
      const zone = createContaminationZone(0, 0, 5, 1.0, 'nuclear', 1986);
      const decayed = decayContamination(zone, 2046); // 60 years = 2 half-lives
      expect(decayed.intensity).toBeCloseTo(0.25, 1);
    });

    it('does not decay if year is before or equal to creation year', () => {
      const zone = createContaminationZone(0, 0, 5, 0.8, 'nuclear', 1986);
      const same = decayContamination(zone, 1986);
      expect(same.intensity).toBe(0.8);
      const before = decayContamination(zone, 1980);
      expect(before.intensity).toBe(0.8);
    });

    it('does not mutate the original zone', () => {
      const zone = createContaminationZone(0, 0, 5, 1.0, 'nuclear', 1986);
      decayContamination(zone, 2016);
      expect(zone.intensity).toBe(1.0);
    });
  });

  describe('getContaminationAt', () => {
    it('returns 0 with no zones', () => {
      expect(getContaminationAt(5, 5, [])).toBe(0);
    });

    it('returns full intensity at the center', () => {
      const zone = createContaminationZone(10, 10, 5, 0.8, 'nuclear', 1986);
      const level = getContaminationAt(10, 10, [zone]);
      expect(level).toBeCloseTo(0.8);
    });

    it('returns 0 outside the radius', () => {
      const zone = createContaminationZone(10, 10, 5, 0.8, 'nuclear', 1986);
      const level = getContaminationAt(20, 20, [zone]);
      expect(level).toBe(0);
    });

    it('decreases with distance (inverse square falloff)', () => {
      const zone = createContaminationZone(10, 10, 10, 1.0, 'nuclear', 1986);
      const atCenter = getContaminationAt(10, 10, [zone]);
      const atMid = getContaminationAt(15, 10, [zone]);
      const atEdge = getContaminationAt(19, 10, [zone]);
      expect(atCenter).toBeGreaterThan(atMid);
      expect(atMid).toBeGreaterThan(atEdge);
    });

    it('sums contributions from multiple zones', () => {
      const z1 = createContaminationZone(5, 5, 10, 0.5, 'nuclear', 1986);
      const z2 = createContaminationZone(8, 5, 10, 0.3, 'industrial', 1970);
      const combined = getContaminationAt(6, 5, [z1, z2]);
      const z1Only = getContaminationAt(6, 5, [z1]);
      const z2Only = getContaminationAt(6, 5, [z2]);
      expect(combined).toBeCloseTo(z1Only + z2Only);
    });

    it('caps total contamination at 1.0', () => {
      const z1 = createContaminationZone(5, 5, 10, 0.9, 'nuclear', 1986);
      const z2 = createContaminationZone(5, 5, 10, 0.8, 'industrial', 1970);
      const level = getContaminationAt(5, 5, [z1, z2]);
      expect(level).toBe(1.0);
    });
  });

  describe('isHabitable', () => {
    it('returns true when contamination < 0.3', () => {
      expect(isHabitable(0)).toBe(true);
      expect(isHabitable(0.1)).toBe(true);
      expect(isHabitable(0.29)).toBe(true);
    });

    it('returns false when contamination >= 0.3', () => {
      expect(isHabitable(0.3)).toBe(false);
      expect(isHabitable(0.5)).toBe(false);
      expect(isHabitable(1.0)).toBe(false);
    });
  });
});
