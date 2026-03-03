/**
 * Tests for src/bridge/Reset.ts
 *
 * Verifies that resetAllSingletons() properly clears all module-level
 * singletons so a new game can be initialized from a clean state.
 */

// Mock AudioManager before imports
jest.mock('@/audio/AudioManager', () => ({
  __esModule: true,
  default: {
    getInstance: () => ({
      dispose: jest.fn(),
      isMuted: false,
    }),
  },
}));

// Mock SFXManager before imports
jest.mock('@/audio/SFXManager', () => ({
  __esModule: true,
  default: {
    getInstance: () => ({
      dispose: jest.fn(),
      isMuted: false,
    }),
  },
}));

// Mock expo-sqlite (native module not available in Jest)
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(),
  deserializeDatabaseSync: jest.fn(),
}));

import { isGameInitialized } from '@/bridge/GameInit';
import { resetAllSingletons } from '@/bridge/Reset';
import { world } from '@/ecs/world';
import { gameState } from '@/engine/GameState';
import { clearToast, getAdvisor, getToast, showAdvisor, showToast } from '@/engine/helpers';
import { getNotificationEntries } from '@/ui/NotificationStore';

beforeEach(() => {
  world.clear();
  clearToast();
});

describe('resetAllSingletons', () => {
  it('clears the ECS world', () => {
    world.add({ position: { gridX: 0, gridY: 0 } });
    expect(world.entities.length).toBe(1);

    resetAllSingletons();

    expect(world.entities.length).toBe(0);
  });

  it('resets GameState to initial values', () => {
    gameState.money = 9999;
    gameState.pop = 500;
    gameState.food = 1000;
    gameState.grid = [[]] as any;
    gameState.buildings = [{ x: 0, y: 0, type: 'test', powered: true, level: 0 }];
    gameState.speed = 3;

    resetAllSingletons();

    expect(gameState.money).toBe(2000);
    expect(gameState.pop).toBe(0);
    expect(gameState.food).toBe(200);
    expect(gameState.grid).toEqual([]);
    expect(gameState.buildings).toEqual([]);
    expect(gameState.speed).toBe(1);
  });

  it('clears toast and advisor messages', () => {
    showToast(gameState, 'Test toast');
    showAdvisor(gameState, 'Test advisor');
    expect(getToast()).not.toBeNull();
    expect(getAdvisor()).not.toBeNull();

    resetAllSingletons();

    expect(getToast()).toBeNull();
    expect(getAdvisor()).toBeNull();
  });

  it('clears notification history', () => {
    showToast(gameState, 'Notification 1');
    showToast(gameState, 'Notification 2');
    expect(getNotificationEntries().length).toBeGreaterThan(0);

    resetAllSingletons();

    expect(getNotificationEntries().length).toBe(0);
  });

  it('resets GameInit initialized flag', () => {
    resetAllSingletons();
    expect(isGameInitialized()).toBe(false);
  });

  it('resets GameState weather and time', () => {
    gameState.currentWeather = 'storm';
    gameState.timeOfDay = 0.9;

    resetAllSingletons();

    expect(gameState.currentWeather).toBe('snow');
    expect(gameState.timeOfDay).toBe(0.5);
  });
});
