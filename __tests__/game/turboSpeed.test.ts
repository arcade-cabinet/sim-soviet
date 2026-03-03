import type { GameSpeed } from '../../src/stores/gameStore';
import { cycleGameSpeed, getGameSpeed, setGameSpeed } from '../../src/stores/gameStore';

describe('Turbo Speed Mode', () => {
  afterEach(() => {
    setGameSpeed(1); // Reset to normal speed
  });

  it('supports speed level 10 (fast-forward)', () => {
    setGameSpeed(10);
    expect(getGameSpeed()).toBe(10);
  });

  it('supports speed level 100 (turbo)', () => {
    setGameSpeed(100);
    expect(getGameSpeed()).toBe(100);
  });

  it('cycles through all speed levels including turbo', () => {
    setGameSpeed(1);
    expect(cycleGameSpeed()).toBe(2);
    expect(cycleGameSpeed()).toBe(3);
    expect(cycleGameSpeed()).toBe(10);
    expect(cycleGameSpeed()).toBe(100);
    expect(cycleGameSpeed()).toBe(1); // wraps around
  });

  it('GameSpeed type accepts all valid values', () => {
    const speeds: GameSpeed[] = [1, 2, 3, 10, 100];
    for (const s of speeds) {
      setGameSpeed(s);
      expect(getGameSpeed()).toBe(s);
    }
  });
});
