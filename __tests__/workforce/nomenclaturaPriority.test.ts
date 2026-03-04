/**
 * @fileoverview TDD tests for nomenclatura priority housing system.
 *
 * Nomenclatura (Soviet elite) claim priority housing, evicting lower-priority
 * commoners if needed. KGB > military_officer > party_official >
 * government_worker > worker > kolkhoznik.
 */

import {
  type CitizenClass,
  claimHousing,
  getCitizenPriority,
  type HousingBuilding,
  type HousingResident,
  isNomenclatura,
  PRIORITY_ORDER,
} from '@/ai/agents/workforce/nomenclaturaPriority';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeResident(id: string, citizenClass: CitizenClass): HousingResident {
  return { id, citizenClass };
}

function makeHousing(id: string, capacity: number, residents: HousingResident[] = []): HousingBuilding {
  return { id, capacity, residents: [...residents] };
}

// ─── getCitizenPriority ───────────────────────────────────────────────────────

describe('getCitizenPriority', () => {
  it('returns 6 for kgb (highest)', () => {
    expect(getCitizenPriority('kgb')).toBe(6);
  });

  it('returns 5 for military_officer', () => {
    expect(getCitizenPriority('military_officer')).toBe(5);
  });

  it('returns 4 for party_official', () => {
    expect(getCitizenPriority('party_official')).toBe(4);
  });

  it('returns 3 for government_worker', () => {
    expect(getCitizenPriority('government_worker')).toBe(3);
  });

  it('returns 2 for worker', () => {
    expect(getCitizenPriority('worker')).toBe(2);
  });

  it('returns 1 for kolkhoznik (lowest)', () => {
    expect(getCitizenPriority('kolkhoznik')).toBe(1);
  });

  it('preserves strict ordering: kgb > military > party > gov > worker > kolkhoznik', () => {
    const classes: CitizenClass[] = [
      'kolkhoznik',
      'worker',
      'government_worker',
      'party_official',
      'military_officer',
      'kgb',
    ];
    const priorities = classes.map(getCitizenPriority);
    for (let i = 1; i < priorities.length; i++) {
      expect(priorities[i]).toBeGreaterThan(priorities[i - 1]);
    }
  });
});

// ─── isNomenclatura ───────────────────────────────────────────────────────────

describe('isNomenclatura', () => {
  it('returns true for kgb', () => {
    expect(isNomenclatura('kgb')).toBe(true);
  });

  it('returns true for military_officer', () => {
    expect(isNomenclatura('military_officer')).toBe(true);
  });

  it('returns true for party_official', () => {
    expect(isNomenclatura('party_official')).toBe(true);
  });

  it('returns true for government_worker', () => {
    expect(isNomenclatura('government_worker')).toBe(true);
  });

  it('returns false for worker', () => {
    expect(isNomenclatura('worker')).toBe(false);
  });

  it('returns false for kolkhoznik', () => {
    expect(isNomenclatura('kolkhoznik')).toBe(false);
  });
});

// ─── PRIORITY_ORDER constant ──────────────────────────────────────────────────

describe('PRIORITY_ORDER', () => {
  it('lists all 6 classes in descending priority', () => {
    expect(PRIORITY_ORDER).toEqual([
      'kgb',
      'military_officer',
      'party_official',
      'government_worker',
      'worker',
      'kolkhoznik',
    ]);
  });
});

// ─── claimHousing ─────────────────────────────────────────────────────────────

describe('claimHousing', () => {
  describe('empty housing available', () => {
    it('houses citizen in first building with space', () => {
      const citizen = makeResident('c1', 'worker');
      const buildings = [makeHousing('b1', 2)];

      const result = claimHousing(citizen, buildings);

      expect(result.housed).toBe(true);
      expect(result.building).toBe('b1');
      expect(result.evicted).toBeUndefined();
    });

    it('skips full buildings and picks one with space', () => {
      const citizen = makeResident('c1', 'worker');
      const full = makeHousing('b1', 1, [makeResident('x', 'kgb')]);
      const open = makeHousing('b2', 3, [makeResident('y', 'worker')]);

      const result = claimHousing(citizen, [full, open]);

      expect(result.housed).toBe(true);
      expect(result.building).toBe('b2');
      expect(result.evicted).toBeUndefined();
    });
  });

  describe('no housing exists', () => {
    it('returns housed=false when building list is empty', () => {
      const citizen = makeResident('c1', 'kgb');
      const result = claimHousing(citizen, []);

      expect(result.housed).toBe(false);
      expect(result.evicted).toBeUndefined();
      expect(result.building).toBeUndefined();
    });
  });

  describe('nomenclatura eviction', () => {
    it('nomenclatura evicts lowest-priority resident when all housing full', () => {
      const kgb = makeResident('c1', 'kgb');
      const kolkhoznik = makeResident('c2', 'kolkhoznik');
      const buildings = [makeHousing('b1', 1, [kolkhoznik])];

      const result = claimHousing(kgb, buildings);

      expect(result.housed).toBe(true);
      expect(result.building).toBe('b1');
      expect(result.evicted).toEqual([kolkhoznik]);
    });

    it('evicts the single lowest-priority resident across all buildings', () => {
      const partyOfficial = makeResident('c1', 'party_official');
      const worker1 = makeResident('w1', 'worker');
      const worker2 = makeResident('w2', 'worker');
      const kolkhoznik = makeResident('k1', 'kolkhoznik');

      const buildings = [makeHousing('b1', 1, [worker1]), makeHousing('b2', 2, [worker2, kolkhoznik])];

      const result = claimHousing(partyOfficial, buildings);

      expect(result.housed).toBe(true);
      // Should evict the kolkhoznik (priority 1) — lowest among all residents
      expect(result.evicted).toEqual([kolkhoznik]);
    });

    it('does not evict equal-priority residents', () => {
      const worker1 = makeResident('w1', 'worker');
      const worker2 = makeResident('w2', 'worker');
      const buildings = [makeHousing('b1', 1, [worker2])];

      const result = claimHousing(worker1, buildings);

      expect(result.housed).toBe(false);
      expect(result.evicted).toBeUndefined();
    });

    it('does not evict higher-priority residents', () => {
      const kolkhoznik = makeResident('k1', 'kolkhoznik');
      const kgb = makeResident('c1', 'kgb');
      const buildings = [makeHousing('b1', 1, [kgb])];

      const result = claimHousing(kolkhoznik, buildings);

      expect(result.housed).toBe(false);
      expect(result.evicted).toBeUndefined();
    });

    it('higher-priority nomenclatura beats lower-priority nomenclatura', () => {
      const kgb = makeResident('c1', 'kgb');
      const govWorker = makeResident('g1', 'government_worker');
      const buildings = [makeHousing('b1', 1, [govWorker])];

      const result = claimHousing(kgb, buildings);

      expect(result.housed).toBe(true);
      expect(result.evicted).toEqual([govWorker]);
    });

    it('worker cannot evict anyone (not nomenclatura, but can evict kolkhoznik since priority is higher)', () => {
      const worker = makeResident('w1', 'worker');
      const kolkhoznik = makeResident('k1', 'kolkhoznik');
      const buildings = [makeHousing('b1', 1, [kolkhoznik])];

      const result = claimHousing(worker, buildings);

      // Workers CAN evict kolkhozniks (priority 2 > 1)
      expect(result.housed).toBe(true);
      expect(result.evicted).toEqual([kolkhoznik]);
    });
  });

  describe('multiple buildings', () => {
    it('prefers open slot over eviction', () => {
      const partyOfficial = makeResident('c1', 'party_official');
      const kolkhoznik = makeResident('k1', 'kolkhoznik');
      const fullBuilding = makeHousing('b1', 1, [kolkhoznik]);
      const openBuilding = makeHousing('b2', 2, [makeResident('w1', 'worker')]);

      const result = claimHousing(partyOfficial, [fullBuilding, openBuilding]);

      expect(result.housed).toBe(true);
      expect(result.building).toBe('b2');
      expect(result.evicted).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('handles building with zero capacity', () => {
      const citizen = makeResident('c1', 'kgb');
      const buildings = [makeHousing('b1', 0)];

      const result = claimHousing(citizen, buildings);

      expect(result.housed).toBe(false);
    });

    it('handles multiple residents — evicts only one (the lowest)', () => {
      const kgb = makeResident('c1', 'kgb');
      const worker1 = makeResident('w1', 'worker');
      const kolkhoznik = makeResident('k1', 'kolkhoznik');
      // Building at capacity with 2 residents
      const buildings = [makeHousing('b1', 2, [worker1, kolkhoznik])];

      // Building is full — but since housingCap=2 and residents=2, need to evict
      const result = claimHousing(kgb, buildings);

      expect(result.housed).toBe(true);
      expect(result.evicted).toEqual([kolkhoznik]); // lowest priority evicted
    });

    it('all buildings full with only equal or higher priority — not housed', () => {
      const govWorker = makeResident('g1', 'government_worker');
      const kgb1 = makeResident('k1', 'kgb');
      const military1 = makeResident('m1', 'military_officer');
      const buildings = [makeHousing('b1', 1, [kgb1]), makeHousing('b2', 1, [military1])];

      const result = claimHousing(govWorker, buildings);

      expect(result.housed).toBe(false);
    });
  });
});
