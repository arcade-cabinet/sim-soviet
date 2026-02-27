/**
 * WeatherSystem + helpers tests.
 */
import { getSeason, getSeasonColor } from '../../src/engine/WeatherSystem';
import {
  showToast,
  getToast,
  clearToast,
  showAdvisor,
  getAdvisor,
  dismissAdvisor,
  getRandomTickerMsg,
} from '../../src/engine/helpers';
import { GameState } from '../../src/engine/GameState';

describe('getSeason', () => {
  it('returns WINTER for Dec, Jan, Feb, Mar', () => {
    expect(getSeason(12)).toBe('WINTER');
    expect(getSeason(1)).toBe('WINTER');
    expect(getSeason(2)).toBe('WINTER');
    expect(getSeason(3)).toBe('WINTER');
  });

  it('returns MUD (SPRING) for Apr, May', () => {
    expect(getSeason(4)).toBe('MUD (SPRING)');
    expect(getSeason(5)).toBe('MUD (SPRING)');
  });

  it('returns SUMMER for Jun-Sep', () => {
    expect(getSeason(6)).toBe('SUMMER');
    expect(getSeason(7)).toBe('SUMMER');
    expect(getSeason(8)).toBe('SUMMER');
    expect(getSeason(9)).toBe('SUMMER');
  });

  it('returns AUTUMN for Oct, Nov', () => {
    expect(getSeason(10)).toBe('AUTUMN');
    expect(getSeason(11)).toBe('AUTUMN');
  });
});

describe('getSeasonColor', () => {
  it('returns different colors per season', () => {
    const colors = new Set([
      getSeasonColor('WINTER'),
      getSeasonColor('MUD (SPRING)'),
      getSeasonColor('SUMMER'),
      getSeasonColor('AUTUMN'),
    ]);
    expect(colors.size).toBe(4);
  });
});

describe('toast side-channel', () => {
  afterEach(() => clearToast());

  it('stores and retrieves toast', () => {
    const s = new GameState();
    showToast(s, 'TEST MESSAGE');
    const toast = getToast();
    expect(toast).not.toBeNull();
    expect(toast!.text).toBe('TEST MESSAGE');
  });

  it('clears toast', () => {
    const s = new GameState();
    showToast(s, 'TEST');
    clearToast();
    expect(getToast()).toBeNull();
  });
});

describe('advisor side-channel', () => {
  afterEach(() => dismissAdvisor());

  it('stores and retrieves advisor message', () => {
    const s = new GameState();
    showAdvisor(s, 'Build more housing!', 'PLANNING');
    const adv = getAdvisor();
    expect(adv).not.toBeNull();
    expect(adv!.text).toBe('Build more housing!');
    expect(adv!.source).toBe('PLANNING');
  });

  it('dismisses advisor', () => {
    const s = new GameState();
    showAdvisor(s, 'TEST');
    dismissAdvisor();
    expect(getAdvisor()).toBeNull();
  });
});

describe('getRandomTickerMsg', () => {
  it('returns a string', () => {
    const msg = getRandomTickerMsg();
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });
});
