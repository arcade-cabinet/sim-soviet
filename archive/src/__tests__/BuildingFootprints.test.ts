import { describe, expect, it } from 'vitest';
import { BUILDING_DEFS, BUILDING_IDS } from '@/data/buildingDefs';
import { getFootprint, getSpriteForType, getSpriteVariants } from '@/game/BuildingFootprints';

// ── getSpriteForType — direct sprite IDs ───────────────────────────────────────

describe('getSpriteForType — direct sprite IDs', () => {
  it('returns the sprite ID itself when it exists in BUILDING_DEFS', () => {
    expect(getSpriteForType('power-station')).toBe('power-station');
    expect(getSpriteForType('vodka-distillery')).toBe('vodka-distillery');
    expect(getSpriteForType('apartment-tower-a')).toBe('apartment-tower-a');
  });

  it('returns valid sprite ID for every building in BUILDING_DEFS', () => {
    for (const id of BUILDING_IDS) {
      expect(getSpriteForType(id)).toBe(id);
    }
  });
});

// ── getSpriteForType — unknown types ───────────────────────────────────────────

describe('getSpriteForType — unknown types', () => {
  it('returns empty string for unknown type', () => {
    expect(getSpriteForType('nonexistent')).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(getSpriteForType('')).toBe('');
  });

  it('returns empty string for types similar to but not matching known types', () => {
    expect(getSpriteForType('Power')).toBe(''); // case sensitive
    expect(getSpriteForType('power-')).toBe('');
    expect(getSpriteForType(' power')).toBe('');
    expect(getSpriteForType('HOUSING')).toBe('');
  });
});

// ── getFootprint — known types ─────────────────────────────────────────────────

describe('getFootprint — known types', () => {
  it('returns correct footprint for power-station (direct sprite ID)', () => {
    const fp = getFootprint('power-station');
    expect(fp.w).toBe(1);
    expect(fp.h).toBe(1);
  });

  it('returns correct footprint for kgb-office (2x1)', () => {
    const fp = getFootprint('kgb-office');
    expect(fp.w).toBe(2);
    expect(fp.h).toBe(1);
  });

  it('returns correct footprint for workers-house-a (1x2)', () => {
    const fp = getFootprint('workers-house-a');
    expect(fp.w).toBe(1);
    expect(fp.h).toBe(2);
  });

  it('returns correct footprint for workers-house-c (2x2)', () => {
    const fp = getFootprint('workers-house-c');
    expect(fp.w).toBe(2);
    expect(fp.h).toBe(2);
  });
});

// ── getFootprint — all building types ──────────────────────────────────────────

describe('getFootprint — all building types have valid footprints', () => {
  it('every building ID returns positive integer w and h', () => {
    for (const id of BUILDING_IDS) {
      const fp = getFootprint(id);
      expect(fp.w).toBeGreaterThan(0);
      expect(fp.h).toBeGreaterThan(0);
      expect(Number.isInteger(fp.w)).toBe(true);
      expect(Number.isInteger(fp.h)).toBe(true);
    }
  });

  it('footprint dimensions match the data in BUILDING_DEFS', () => {
    for (const id of BUILDING_IDS) {
      const fp = getFootprint(id);
      const def = BUILDING_DEFS[id]!;
      expect(fp.w).toBe(def.footprint.tilesX);
      expect(fp.h).toBe(def.footprint.tilesY);
    }
  });

  it('footprints are within reasonable bounds (max 4x4)', () => {
    for (const id of BUILDING_IDS) {
      const fp = getFootprint(id);
      expect(fp.w).toBeLessThanOrEqual(4);
      expect(fp.h).toBeLessThanOrEqual(4);
    }
  });
});

// ── getFootprint — unknown types ───────────────────────────────────────────────

describe('getFootprint — unknown types default to 1x1', () => {
  it('returns 1x1 for completely unknown type', () => {
    const fp = getFootprint('banana');
    expect(fp.w).toBe(1);
    expect(fp.h).toBe(1);
  });

  it('returns 1x1 for empty string', () => {
    const fp = getFootprint('');
    expect(fp.w).toBe(1);
    expect(fp.h).toBe(1);
  });

  it('returns 1x1 for a misspelled type', () => {
    const fp = getFootprint('power-staton');
    expect(fp.w).toBe(1);
    expect(fp.h).toBe(1);
  });
});

// ── getSpriteVariants ──────────────────────────────────────────────────────────

describe('getSpriteVariants', () => {
  it('returns an object keyed by role', () => {
    const variants = getSpriteVariants();
    expect(typeof variants).toBe('object');
    expect(Object.keys(variants).length).toBeGreaterThan(0);
  });

  it('contains expected roles from the building defs', () => {
    const variants = getSpriteVariants();
    // At minimum, we know these roles exist in the generated data
    expect(variants.housing).toBeDefined();
    expect(variants.industry).toBeDefined();
    expect(variants.government).toBeDefined();
    expect(variants.military).toBeDefined();
    expect(variants.power).toBeDefined();
  });

  it('each variant has valid spriteName, w, h', () => {
    const variants = getSpriteVariants();
    for (const [_role, defs] of Object.entries(variants)) {
      expect(Array.isArray(defs)).toBe(true);
      expect(defs.length).toBeGreaterThan(0);
      for (const def of defs) {
        expect(def.spriteName.length).toBeGreaterThan(0);
        expect(def.w).toBeGreaterThan(0);
        expect(def.h).toBeGreaterThan(0);
        expect(Number.isInteger(def.w)).toBe(true);
        expect(Number.isInteger(def.h)).toBe(true);
      }
    }
  });

  it('total sprite count matches BUILDING_IDS length', () => {
    const variants = getSpriteVariants();
    let total = 0;
    for (const defs of Object.values(variants)) {
      total += defs.length;
    }
    expect(total).toBe(BUILDING_IDS.length);
  });

  it('all sprite names are unique across all roles', () => {
    const variants = getSpriteVariants();
    const allNames: string[] = [];
    for (const defs of Object.values(variants)) {
      for (const def of defs) {
        allNames.push(def.spriteName);
      }
    }
    const unique = new Set(allNames);
    expect(unique.size).toBe(allNames.length);
  });

  it('housing role contains apartment towers and workers houses', () => {
    const variants = getSpriteVariants();
    const housingNames = variants.housing!.map((d) => d.spriteName);
    expect(housingNames).toContain('apartment-tower-a');
    expect(housingNames).toContain('workers-house-a');
  });

  it('power role contains power-station', () => {
    const variants = getSpriteVariants();
    const powerNames = variants.power!.map((d) => d.spriteName);
    expect(powerNames).toContain('power-station');
  });
});

// ── BUILDING_DEFS data integrity ───────────────────────────────────────────────

describe('BUILDING_DEFS data integrity', () => {
  it('has at least 20 buildings', () => {
    expect(BUILDING_IDS.length).toBeGreaterThanOrEqual(20);
  });

  it('every building has a valid sprite path', () => {
    for (const id of BUILDING_IDS) {
      const def = BUILDING_DEFS[id]!;
      expect(def.sprite.path).toMatch(/^sprites\/soviet\/.+\.png$/);
    }
  });

  it('every building has positive sprite dimensions', () => {
    for (const id of BUILDING_IDS) {
      const def = BUILDING_DEFS[id]!;
      expect(def.sprite.width).toBeGreaterThan(0);
      expect(def.sprite.height).toBeGreaterThan(0);
    }
  });

  it('every building has a non-negative cost', () => {
    for (const id of BUILDING_IDS) {
      const def = BUILDING_DEFS[id]!;
      expect(def.presentation.cost).toBeGreaterThanOrEqual(0);
    }
  });

  it('building IDs match the id field inside each def', () => {
    for (const id of BUILDING_IDS) {
      const def = BUILDING_DEFS[id]!;
      expect(def.id).toBe(id);
    }
  });

  it('multi-tile buildings exist in the data (not all 1x1)', () => {
    const hasMultiTile = BUILDING_IDS.some((id) => {
      const def = BUILDING_DEFS[id]!;
      return def.footprint.tilesX > 1 || def.footprint.tilesY > 1;
    });
    expect(hasMultiTile).toBe(true);
  });

  it('at least one building produces food', () => {
    const foodProducers = BUILDING_IDS.filter((id) => {
      const def = BUILDING_DEFS[id]!;
      return def.stats.produces?.resource === 'food';
    });
    expect(foodProducers.length).toBeGreaterThan(0);
  });

  it('at least one building produces vodka', () => {
    const vodkaProducers = BUILDING_IDS.filter((id) => {
      const def = BUILDING_DEFS[id]!;
      return def.stats.produces?.resource === 'vodka';
    });
    expect(vodkaProducers.length).toBeGreaterThan(0);
  });

  it('at least one building generates power', () => {
    const powerGenerators = BUILDING_IDS.filter((id) => {
      const def = BUILDING_DEFS[id]!;
      return def.stats.powerOutput > 0;
    });
    expect(powerGenerators.length).toBeGreaterThan(0);
  });

  it('gulag has negative housing capacity', () => {
    const gulag = BUILDING_DEFS['gulag-admin'];
    expect(gulag).toBeDefined();
    expect(gulag!.stats.housingCap).toBeLessThan(0);
  });
});
