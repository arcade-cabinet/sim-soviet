/**
 * Tests for BuildingInspectorPanel data helpers.
 *
 * Verifies storage contribution lookup and efficiency calculation
 * used by the building inspector panel.
 */

import { getBuildingStorageContribution } from '../../src/ecs/systems/storageSystem';

describe('getBuildingStorageContribution', () => {
  it('returns storage for warehouse', () => {
    expect(getBuildingStorageContribution('warehouse')).toBe(300);
  });

  it('returns storage for grain-elevator', () => {
    expect(getBuildingStorageContribution('grain-elevator')).toBe(2000);
  });

  it('returns storage for cold-storage', () => {
    expect(getBuildingStorageContribution('cold-storage')).toBe(400);
  });

  it('returns 0 for non-storage buildings', () => {
    expect(getBuildingStorageContribution('gulag-admin')).toBe(0);
  });

  it('returns role-based storage for agriculture buildings', () => {
    // Agriculture role buildings should get 50
    expect(getBuildingStorageContribution('collective-farm-hq')).toBe(50);
  });

  it('returns 0 for unknown defIds', () => {
    expect(getBuildingStorageContribution('nonexistent-building')).toBe(0);
  });
});
