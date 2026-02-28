/**
 * Tests for era-gated building availability.
 * Verifies getAvailableBuildingsForYear returns correct buildings per era.
 */
import { describe, expect, it } from 'vitest';
import { getAvailableBuildingsForYear } from '../game/era/definitions';

describe('getAvailableBuildingsForYear', () => {
  it('returns limited buildings for Era 1 (1922)', () => {
    const buildings = getAvailableBuildingsForYear(1922);
    // War Communism should have basic buildings only
    expect(buildings.length).toBeGreaterThan(0);
    expect(buildings.length).toBeLessThan(20);
  });

  it('returns more buildings for later eras', () => {
    const era1 = getAvailableBuildingsForYear(1922);
    const era3 = getAvailableBuildingsForYear(1941);
    const era5 = getAvailableBuildingsForYear(1956);

    // Each subsequent era should have >= the previous era's buildings
    expect(era3.length).toBeGreaterThanOrEqual(era1.length);
    expect(era5.length).toBeGreaterThanOrEqual(era3.length);
  });

  it('returns all buildings for the final era (2100)', () => {
    const all = getAvailableBuildingsForYear(2100);
    // Should include buildings from ALL eras
    expect(all.length).toBeGreaterThan(15);
  });

  it('cumulative: later era includes all earlier era buildings', () => {
    const era1 = getAvailableBuildingsForYear(1922);
    const era2 = getAvailableBuildingsForYear(1929);

    for (const b of era1) {
      expect(era2).toContain(b);
    }
  });

  it('filters by settlement tier when provided', () => {
    const allForYear = getAvailableBuildingsForYear(2000);
    const seloOnly = getAvailableBuildingsForYear(2000, 'selo');
    const gorodAll = getAvailableBuildingsForYear(2000, 'gorod');

    // selo should have fewer buildings than gorod
    expect(seloOnly.length).toBeLessThanOrEqual(gorodAll.length);
    // gorod should have all buildings available for that year
    expect(gorodAll.length).toBe(allForYear.length);
  });

  it('selo tier excludes posyolok+ buildings', () => {
    const seloBuildings = getAvailableBuildingsForYear(2000, 'selo');
    // workers-house-c requires posyolok
    expect(seloBuildings).not.toContain('workers-house-c');
    // kgb-office requires gorod
    expect(seloBuildings).not.toContain('kgb-office');
  });

  it('posyolok tier includes posyolok buildings', () => {
    const buildings = getAvailableBuildingsForYear(2000, 'posyolok');
    // workers-house-c requires posyolok — should be included
    expect(buildings).toContain('workers-house-c');
  });
});
