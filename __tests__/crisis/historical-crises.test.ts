/**
 * @fileoverview Tests for the Soviet historical crisis database.
 *
 * Validates structural integrity, date ranges, type correctness,
 * era alignment, uniqueness, and lookup functionality.
 */

import { HISTORICAL_CRISES, getCrisisById } from '@/config/historicalCrises';
import type { CrisisDefinition, CrisisType, CrisisSeverity } from '@/ai/agents/crisis/types';
import { ERA_ORDER } from '@/game/era/definitions';

// ─── Valid enums ────────────────────────────────────────────────────────────

const VALID_TYPES: CrisisType[] = ['war', 'famine', 'disaster', 'political'];
const VALID_SEVERITIES: CrisisSeverity[] = ['localized', 'regional', 'national', 'existential'];
const VALID_ERA_IDS: string[] = [...ERA_ORDER];

// ─── Structural validation ──────────────────────────────────────────────────

describe('HISTORICAL_CRISES — structural integrity', () => {
  it('contains between 25 and 35 crisis definitions', () => {
    expect(HISTORICAL_CRISES.length).toBeGreaterThanOrEqual(25);
    expect(HISTORICAL_CRISES.length).toBeLessThanOrEqual(35);
  });

  it.each(HISTORICAL_CRISES.map((c) => [c.id, c] as const))(
    '%s has all required CrisisDefinition fields',
    (_id, crisis) => {
      expect(typeof crisis.id).toBe('string');
      expect(crisis.id.length).toBeGreaterThan(0);
      expect(typeof crisis.type).toBe('string');
      expect(typeof crisis.name).toBe('string');
      expect(crisis.name.length).toBeGreaterThan(0);
      expect(typeof crisis.startYear).toBe('number');
      expect(typeof crisis.endYear).toBe('number');
      expect(typeof crisis.severity).toBe('string');
      expect(typeof crisis.peakParams).toBe('object');
      expect(crisis.peakParams).not.toBeNull();
      expect(typeof crisis.buildupTicks).toBe('number');
      expect(typeof crisis.aftermathTicks).toBe('number');
    },
  );
});

// ─── Date range validation ──────────────────────────────────────────────────

describe('HISTORICAL_CRISES — date ranges', () => {
  it.each(HISTORICAL_CRISES.map((c) => [c.id, c] as const))(
    '%s has startYear <= endYear',
    (_id, crisis) => {
      expect(crisis.startYear).toBeLessThanOrEqual(crisis.endYear);
    },
  );

  it.each(HISTORICAL_CRISES.map((c) => [c.id, c] as const))(
    '%s has startYear >= 1917 (post-Revolution)',
    (_id, crisis) => {
      expect(crisis.startYear).toBeGreaterThanOrEqual(1917);
    },
  );

  it.each(HISTORICAL_CRISES.map((c) => [c.id, c] as const))(
    '%s has endYear <= 2000',
    (_id, crisis) => {
      expect(crisis.endYear).toBeLessThanOrEqual(2000);
    },
  );
});

// ─── Uniqueness ─────────────────────────────────────────────────────────────

describe('HISTORICAL_CRISES — uniqueness', () => {
  it('has no duplicate IDs', () => {
    const ids = HISTORICAL_CRISES.map((c) => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('has no duplicate names', () => {
    const names = HISTORICAL_CRISES.map((c) => c.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});

// ─── Type and severity validation ───────────────────────────────────────────

describe('HISTORICAL_CRISES — type and severity', () => {
  it.each(HISTORICAL_CRISES.map((c) => [c.id, c] as const))(
    '%s has a valid crisis type',
    (_id, crisis) => {
      expect(VALID_TYPES).toContain(crisis.type);
    },
  );

  it.each(HISTORICAL_CRISES.map((c) => [c.id, c] as const))(
    '%s has a valid severity level',
    (_id, crisis) => {
      expect(VALID_SEVERITIES).toContain(crisis.severity);
    },
  );

  it('uses all four crisis types', () => {
    const usedTypes = new Set(HISTORICAL_CRISES.map((c) => c.type));
    for (const t of VALID_TYPES) {
      expect(usedTypes).toContain(t);
    }
  });

  it('uses all four severity levels', () => {
    const usedSeverities = new Set(HISTORICAL_CRISES.map((c) => c.severity));
    for (const s of VALID_SEVERITIES) {
      expect(usedSeverities).toContain(s);
    }
  });
});

// ─── Era alignment ──────────────────────────────────────────────────────────

describe('HISTORICAL_CRISES — era alignment', () => {
  it.each(
    HISTORICAL_CRISES.filter((c) => c.eraAlignment != null).map((c) => [c.id, c] as const),
  )('%s has eraAlignment matching a valid era ID', (_id, crisis) => {
    expect(VALID_ERA_IDS).toContain(crisis.eraAlignment);
  });

  it('every crisis has an eraAlignment', () => {
    for (const crisis of HISTORICAL_CRISES) {
      expect(crisis.eraAlignment).toBeDefined();
      expect(typeof crisis.eraAlignment).toBe('string');
    }
  });
});

// ─── Peak params validation ─────────────────────────────────────────────────

describe('HISTORICAL_CRISES — peakParams', () => {
  it.each(HISTORICAL_CRISES.map((c) => [c.id, c] as const))(
    '%s has non-empty peakParams with numeric values',
    (_id, crisis) => {
      const keys = Object.keys(crisis.peakParams);
      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) {
        expect(typeof crisis.peakParams[key]).toBe('number');
      }
    },
  );

  it.each(HISTORICAL_CRISES.map((c) => [c.id, c] as const))(
    '%s has non-negative buildupTicks and aftermathTicks',
    (_id, crisis) => {
      expect(crisis.buildupTicks).toBeGreaterThanOrEqual(0);
      expect(crisis.aftermathTicks).toBeGreaterThanOrEqual(0);
    },
  );
});

// ─── compoundsWith validation ───────────────────────────────────────────────

describe('HISTORICAL_CRISES — compoundsWith references', () => {
  const allIds = new Set(HISTORICAL_CRISES.map((c) => c.id));

  it.each(
    HISTORICAL_CRISES.filter((c) => c.compoundsWith && c.compoundsWith.length > 0).map(
      (c) => [c.id, c] as const,
    ),
  )('%s compoundsWith references only existing crisis IDs', (_id, crisis) => {
    for (const ref of crisis.compoundsWith!) {
      expect(allIds).toContain(ref);
    }
  });
});

// ─── Date coverage ──────────────────────────────────────────────────────────

describe('HISTORICAL_CRISES — historical coverage', () => {
  it('has crises spanning 1918 through 1991', () => {
    const earliest = Math.min(...HISTORICAL_CRISES.map((c) => c.startYear));
    const latest = Math.max(...HISTORICAL_CRISES.map((c) => c.endYear));
    expect(earliest).toBeLessThanOrEqual(1921);
    expect(latest).toBeGreaterThanOrEqual(1991);
  });

  it('has at least one crisis starting in each decade from 1920s to 1980s', () => {
    const decades = [1920, 1930, 1940, 1950, 1960, 1970, 1980];
    for (const decade of decades) {
      const inDecade = HISTORICAL_CRISES.filter(
        (c) => c.startYear >= decade && c.startYear < decade + 10,
      );
      expect(inDecade.length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ─── getCrisisById ──────────────────────────────────────────────────────────

describe('getCrisisById', () => {
  it('returns the correct crisis for known IDs', () => {
    const ww2 = getCrisisById('great_patriotic_war');
    expect(ww2).toBeDefined();
    expect(ww2!.name).toBe('Great Patriotic War');
    expect(ww2!.severity).toBe('existential');

    const chernobyl = getCrisisById('chernobyl');
    expect(chernobyl).toBeDefined();
    expect(chernobyl!.type).toBe('disaster');
    expect(chernobyl!.aftermathTicks).toBe(120);
  });

  it('returns undefined for unknown IDs', () => {
    expect(getCrisisById('nonexistent')).toBeUndefined();
    expect(getCrisisById('')).toBeUndefined();
  });

  it('returns the same object reference as in HISTORICAL_CRISES', () => {
    for (const crisis of HISTORICAL_CRISES) {
      expect(getCrisisById(crisis.id)).toBe(crisis);
    }
  });
});

// ─── Description coverage ───────────────────────────────────────────────────

describe('HISTORICAL_CRISES — descriptions', () => {
  it('every crisis has a description', () => {
    for (const crisis of HISTORICAL_CRISES) {
      expect(crisis.description).toBeDefined();
      expect(typeof crisis.description).toBe('string');
      expect(crisis.description!.length).toBeGreaterThan(20);
    }
  });
});
