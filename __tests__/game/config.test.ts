import { GRID_SIZE } from '../../src/config';

describe('config', () => {
  it('GRID_SIZE is a positive integer', () => {
    expect(GRID_SIZE).toBeGreaterThan(0);
    expect(Number.isInteger(GRID_SIZE)).toBe(true);
  });
});
