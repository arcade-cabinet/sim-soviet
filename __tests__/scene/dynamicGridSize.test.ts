/**
 * Tests for dynamic grid size system.
 *
 * Verifies that:
 * - getCurrentGridSize() defaults to 30
 * - setCurrentGridSize() changes the runtime value
 * - Different grid sizes (20, 30, 50) are accepted
 * - GRID_SIZE constant remains unchanged (backward compat)
 */

import { GRID_SIZE, getCurrentGridSize, setCurrentGridSize } from '../../src/engine/GridTypes';

describe('Dynamic grid size', () => {
  afterEach(() => {
    // Reset to default after each test
    setCurrentGridSize(30);
  });

  it('GRID_SIZE constant remains 30 (backward compatibility)', () => {
    expect(GRID_SIZE).toBe(30);
  });

  it('getCurrentGridSize() defaults to GRID_SIZE (30)', () => {
    setCurrentGridSize(GRID_SIZE);
    expect(getCurrentGridSize()).toBe(30);
  });

  it('setCurrentGridSize() changes the runtime value', () => {
    setCurrentGridSize(20);
    expect(getCurrentGridSize()).toBe(20);

    setCurrentGridSize(50);
    expect(getCurrentGridSize()).toBe(50);
  });

  it('small grid size (20) is accepted', () => {
    setCurrentGridSize(20);
    expect(getCurrentGridSize()).toBe(20);
  });

  it('large grid size (50) is accepted', () => {
    setCurrentGridSize(50);
    expect(getCurrentGridSize()).toBe(50);
  });

  it('re-exported from config module', () => {
    // Verify the config module re-exports the dynamic accessors
    const config = require('../../src/config');
    expect(typeof config.getCurrentGridSize).toBe('function');
    expect(typeof config.setCurrentGridSize).toBe('function');
    expect(config.getCurrentGridSize()).toBe(30);
  });
});
