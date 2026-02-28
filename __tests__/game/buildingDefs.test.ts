import {
  BUILDING_DEFS,
  BUILDING_IDS,
  DEFS_VERSION,
  getBuildingDef,
  getBuildingsByRole,
  getFootprint,
  getSpriteData,
} from '@/data/buildingDefs';

describe('buildingDefs', () => {
  // ── BUILDING_DEFS / BUILDING_IDS ───────────────────────────

  describe('BUILDING_DEFS and BUILDING_IDS', () => {
    it('BUILDING_DEFS is a non-empty record', () => {
      expect(Object.keys(BUILDING_DEFS).length).toBeGreaterThan(0);
    });

    it('BUILDING_IDS is a non-empty array', () => {
      expect(BUILDING_IDS.length).toBeGreaterThan(0);
    });

    it('BUILDING_IDS matches keys of BUILDING_DEFS', () => {
      const defsKeys = Object.keys(BUILDING_DEFS).sort();
      const ids = [...BUILDING_IDS].sort();
      expect(ids).toEqual(defsKeys);
    });

    it('contains known building IDs', () => {
      // These should exist based on the manifest
      expect(BUILDING_IDS).toContain('power-station');
      expect(BUILDING_IDS).toContain('apartment-tower-a');
      expect(BUILDING_IDS).toContain('vodka-distillery');
      expect(BUILDING_IDS).toContain('collective-farm-hq');
      expect(BUILDING_IDS).toContain('gulag-admin');
    });

    it('has a valid version string', () => {
      expect(typeof DEFS_VERSION).toBe('string');
      expect(DEFS_VERSION.length).toBeGreaterThan(0);
    });
  });

  // ── getBuildingDef ─────────────────────────────────────────

  describe('getBuildingDef', () => {
    it('returns correct data for known ID (apartment-tower-a)', () => {
      const def = getBuildingDef('apartment-tower-a');
      expect(def).toBeDefined();
      expect(def!.id).toBe('apartment-tower-a');
      expect(def!.role).toBe('housing');
    });

    it('returns correct data for power-station', () => {
      const def = getBuildingDef('power-station');
      expect(def).toBeDefined();
      expect(def!.id).toBe('power-station');
      expect(def!.stats.powerOutput).toBeGreaterThan(0);
    });

    it('returns correct data for vodka-distillery', () => {
      const def = getBuildingDef('vodka-distillery');
      expect(def).toBeDefined();
      expect(def!.id).toBe('vodka-distillery');
      expect(def!.stats.produces).toBeDefined();
      expect(def!.stats.produces!.resource).toBe('vodka');
    });

    it('returns correct data for collective-farm-hq', () => {
      const def = getBuildingDef('collective-farm-hq');
      expect(def).toBeDefined();
      expect(def!.stats.produces).toBeDefined();
      expect(def!.stats.produces!.resource).toBe('food');
    });

    it('returns undefined for unknown ID', () => {
      expect(getBuildingDef('nonexistent-building')).toBeUndefined();
    });

    it('returns undefined for empty string', () => {
      expect(getBuildingDef('')).toBeUndefined();
    });

    it('returns undefined for random garbage', () => {
      expect(getBuildingDef('xyz-123-fake')).toBeUndefined();
    });
  });

  // ── All defs have required fields ──────────────────────────

  describe('all defs have required fields', () => {
    it('every building def has an id', () => {
      for (const id of BUILDING_IDS) {
        const def = getBuildingDef(id);
        expect(def).toBeDefined();
        expect(def!.id).toBe(id);
      }
    });

    it('every building def has a name (presentation.name)', () => {
      for (const id of BUILDING_IDS) {
        const def = getBuildingDef(id)!;
        expect(typeof def.presentation.name).toBe('string');
        expect(def.presentation.name.length).toBeGreaterThan(0);
      }
    });

    it('every building def has a cost (presentation.cost)', () => {
      for (const id of BUILDING_IDS) {
        const def = getBuildingDef(id)!;
        expect(typeof def.presentation.cost).toBe('number');
        expect(Number.isInteger(def.presentation.cost)).toBe(true);
      }
    });

    it('every building def has a footprint with positive tilesX/tilesY', () => {
      for (const id of BUILDING_IDS) {
        const def = getBuildingDef(id)!;
        expect(def.footprint).toBeDefined();
        expect(def.footprint.tilesX).toBeGreaterThanOrEqual(1);
        expect(def.footprint.tilesY).toBeGreaterThanOrEqual(1);
        expect(Number.isInteger(def.footprint.tilesX)).toBe(true);
        expect(Number.isInteger(def.footprint.tilesY)).toBe(true);
      }
    });

    it('every building def has a role', () => {
      const validRoles = [
        'housing',
        'industry',
        'agriculture',
        'government',
        'military',
        'services',
        'culture',
        'power',
        'transport',
        'propaganda',
        'utility',
        'environment',
      ];
      for (const id of BUILDING_IDS) {
        const def = getBuildingDef(id)!;
        expect(validRoles).toContain(def.role);
      }
    });

    it('every building def has stats with numeric fields', () => {
      for (const id of BUILDING_IDS) {
        const def = getBuildingDef(id)!;
        expect(typeof def.stats.powerReq).toBe('number');
        expect(typeof def.stats.powerOutput).toBe('number');
        expect(typeof def.stats.housingCap).toBe('number');
        expect(typeof def.stats.pollution).toBe('number');
        expect(typeof def.stats.fear).toBe('number');
        expect(typeof def.stats.decayRate).toBe('number');
        expect(typeof def.stats.jobs).toBe('number');
      }
    });

    it('every building def has a description', () => {
      for (const id of BUILDING_IDS) {
        const def = getBuildingDef(id)!;
        expect(typeof def.presentation.desc).toBe('string');
        expect(def.presentation.desc.length).toBeGreaterThan(0);
      }
    });

    it('every building def has an icon', () => {
      for (const id of BUILDING_IDS) {
        const def = getBuildingDef(id)!;
        expect(typeof def.presentation.icon).toBe('string');
        expect(def.presentation.icon.length).toBeGreaterThan(0);
      }
    });

    it('every building def has model size data', () => {
      for (const id of BUILDING_IDS) {
        const def = getBuildingDef(id)!;
        expect(typeof def.modelSize.x).toBe('number');
        expect(typeof def.modelSize.y).toBe('number');
        expect(typeof def.modelSize.z).toBe('number');
      }
    });
  });

  // ── Sprite paths ───────────────────────────────────────────

  describe('sprite paths', () => {
    it('every building def has a valid sprite path string', () => {
      for (const id of BUILDING_IDS) {
        const def = getBuildingDef(id)!;
        expect(typeof def.sprite.path).toBe('string');
        expect(def.sprite.path.length).toBeGreaterThan(0);
      }
    });

    it('sprite paths end with .png', () => {
      for (const id of BUILDING_IDS) {
        const def = getBuildingDef(id)!;
        expect(def.sprite.path).toMatch(/\.png$/);
      }
    });

    it('sprite paths start with sprites/', () => {
      for (const id of BUILDING_IDS) {
        const def = getBuildingDef(id)!;
        expect(def.sprite.path).toMatch(/^sprites\//);
      }
    });

    it('sprite dimensions are positive integers', () => {
      for (const id of BUILDING_IDS) {
        const def = getBuildingDef(id)!;
        expect(def.sprite.width).toBeGreaterThan(0);
        expect(def.sprite.height).toBeGreaterThan(0);
        expect(Number.isInteger(def.sprite.width)).toBe(true);
        expect(Number.isInteger(def.sprite.height)).toBe(true);
      }
    });

    it('sprite anchors are integers', () => {
      for (const id of BUILDING_IDS) {
        const def = getBuildingDef(id)!;
        expect(Number.isInteger(def.sprite.anchorX)).toBe(true);
        expect(Number.isInteger(def.sprite.anchorY)).toBe(true);
      }
    });
  });

  // ── getSpriteData ──────────────────────────────────────────

  describe('getSpriteData', () => {
    it('returns sprite data for known IDs', () => {
      const sprite = getSpriteData('apartment-tower-a');
      expect(sprite).toBeDefined();
      expect(sprite!.path).toMatch(/\.png$/);
      expect(sprite!.width).toBeGreaterThan(0);
      expect(sprite!.height).toBeGreaterThan(0);
    });

    it('returns undefined for unknown IDs', () => {
      expect(getSpriteData('does-not-exist')).toBeUndefined();
    });
  });

  // ── getFootprint ───────────────────────────────────────────

  describe('getFootprint', () => {
    it('returns footprint for known building', () => {
      const fp = getFootprint('apartment-tower-a');
      expect(fp.tilesX).toBeGreaterThanOrEqual(1);
      expect(fp.tilesY).toBeGreaterThanOrEqual(1);
    });

    it('returns default 1x1 for unknown building', () => {
      const fp = getFootprint('nonexistent');
      expect(fp.tilesX).toBe(1);
      expect(fp.tilesY).toBe(1);
    });

    it('returns default 1x1 for empty string', () => {
      const fp = getFootprint('');
      expect(fp.tilesX).toBe(1);
      expect(fp.tilesY).toBe(1);
    });
  });

  // ── getBuildingsByRole ─────────────────────────────────────

  describe('getBuildingsByRole', () => {
    it('returns housing buildings', () => {
      const housing = getBuildingsByRole('housing');
      expect(housing.length).toBeGreaterThan(0);
      // Verify all returned IDs actually have role=housing
      for (const id of housing) {
        expect(getBuildingDef(id)!.role).toBe('housing');
      }
    });

    it('returns power buildings', () => {
      const power = getBuildingsByRole('power');
      expect(power.length).toBeGreaterThan(0);
      expect(power).toContain('power-station');
    });

    it('returns government buildings', () => {
      const gov = getBuildingsByRole('government');
      expect(gov.length).toBeGreaterThan(0);
      for (const id of gov) {
        expect(getBuildingDef(id)!.role).toBe('government');
      }
    });

    it('every building belongs to exactly one role', () => {
      const allRoles = [
        'housing',
        'industry',
        'agriculture',
        'government',
        'military',
        'services',
        'culture',
        'power',
        'transport',
        'propaganda',
        'utility',
        'environment',
      ] as const;

      for (const id of BUILDING_IDS) {
        let roleCount = 0;
        for (const role of allRoles) {
          if (getBuildingsByRole(role).includes(id)) {
            roleCount++;
          }
        }
        expect(roleCount).toBe(1);
      }
    });

    it('all role queries cover all building IDs', () => {
      const allRoles = [
        'housing',
        'industry',
        'agriculture',
        'government',
        'military',
        'services',
        'culture',
        'power',
        'transport',
        'propaganda',
        'utility',
        'environment',
      ] as const;

      const allFromRoles = new Set<string>();
      for (const role of allRoles) {
        for (const id of getBuildingsByRole(role)) {
          allFromRoles.add(id);
        }
      }

      expect(allFromRoles.size).toBe(BUILDING_IDS.length);
    });
  });

  // ── Data consistency ───────────────────────────────────────

  describe('data consistency', () => {
    it('power-station has powerOutput > 0 and powerReq = 0', () => {
      const def = getBuildingDef('power-station')!;
      expect(def.stats.powerOutput).toBeGreaterThan(0);
      expect(def.stats.powerReq).toBe(0);
    });

    it('housing buildings have housingCap > 0', () => {
      const housing = getBuildingsByRole('housing');
      for (const id of housing) {
        const def = getBuildingDef(id)!;
        expect(def.stats.housingCap).toBeGreaterThan(0);
      }
    });

    it('all buildings have non-negative decayRate', () => {
      for (const id of BUILDING_IDS) {
        const def = getBuildingDef(id)!;
        expect(def.stats.decayRate).toBeGreaterThanOrEqual(0);
      }
    });

    it('all buildings have non-negative pollution', () => {
      for (const id of BUILDING_IDS) {
        const def = getBuildingDef(id)!;
        expect(def.stats.pollution).toBeGreaterThanOrEqual(0);
      }
    });

    it('producer buildings have valid resource type', () => {
      for (const id of BUILDING_IDS) {
        const def = getBuildingDef(id)!;
        if (def.stats.produces) {
          expect(['food', 'vodka']).toContain(def.stats.produces.resource);
          expect(def.stats.produces.amount).toBeGreaterThan(0);
        }
      }
    });
  });
});
