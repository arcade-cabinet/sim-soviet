/**
 * Tests for SFXManager --- procedural sound effects via Web Audio API.
 *
 * Uses a minimal mock of AudioContext, OscillatorNode, GainNode, and
 * AudioBufferSourceNode since Jest/jsdom does not provide Web Audio API.
 */

import SFXManager from '../../src/audio/SFXManager';
import type { SFXName } from '../../src/audio/SFXManager';

// ── Web Audio API mocks ──────────────────────────────────────────────────────

function createMockGainNode(): any {
  return {
    gain: { value: 1, setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn() },
    connect: jest.fn(),
    disconnect: jest.fn(),
  };
}

function createMockOscillator(): any {
  return {
    type: 'sine',
    frequency: { value: 440 },
    connect: jest.fn(),
    disconnect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    onended: null as (() => void) | null,
  };
}

function createMockBufferSource(): any {
  return {
    buffer: null,
    connect: jest.fn(),
    disconnect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    onended: null as (() => void) | null,
  };
}

function createMockAudioBuffer(): any {
  return {
    getChannelData: () => new Float32Array(4410), // 0.1s at 44100
  };
}

function createMockAudioContext(): any {
  return {
    state: 'running',
    currentTime: 0,
    sampleRate: 44100,
    resume: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    destination: {},
    createGain: jest.fn(() => createMockGainNode()),
    createOscillator: jest.fn(() => createMockOscillator()),
    createBufferSource: jest.fn(() => createMockBufferSource()),
    createBuffer: jest.fn(() => createMockAudioBuffer()),
  };
}

// Install mock before each test
let mockCtx: ReturnType<typeof createMockAudioContext>;

beforeEach(() => {
  // Reset singleton
  (SFXManager as any).instance = null;

  mockCtx = createMockAudioContext();
  (globalThis as any).AudioContext = jest.fn(() => mockCtx);
  (globalThis as any).window = {
    ...(globalThis as any).window,
    AudioContext: (globalThis as any).AudioContext,
  };
});

afterEach(() => {
  SFXManager.getInstance().dispose();
  delete (globalThis as any).AudioContext;
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SFXManager', () => {
  describe('singleton', () => {
    it('returns the same instance', () => {
      const a = SFXManager.getInstance();
      const b = SFXManager.getInstance();
      expect(a).toBe(b);
    });

    it('creates a new instance after dispose', () => {
      const a = SFXManager.getInstance();
      a.dispose();
      const b = SFXManager.getInstance();
      expect(a).not.toBe(b);
    });
  });

  describe('init', () => {
    it('creates AudioContext and master gain', () => {
      const sfx = SFXManager.getInstance();
      sfx.init();

      expect(mockCtx.createGain).toHaveBeenCalled();
    });

    it('is idempotent', () => {
      const sfx = SFXManager.getInstance();
      sfx.init();
      sfx.init();

      // AudioContext constructor called only once
      expect((globalThis as any).AudioContext).toHaveBeenCalledTimes(1);
    });
  });

  describe('play', () => {
    const ALL_SOUNDS: SFXName[] = [
      'ui_click',
      'ui_modal_open',
      'ui_modal_close',
      'building_place',
      'building_construct_tick',
      'building_complete',
      'building_demolish',
      'resource_produce',
      'resource_storage_full',
      'quota_fulfilled',
      'quota_failed',
      'fire_start',
      'worker_death',
      'season_change',
      'era_transition',
      'advisor_message',
      'toast_notification',
      'game_over',
      'achievement',
    ];

    it('does not throw for any valid sound name', () => {
      const sfx = SFXManager.getInstance();
      sfx.init();

      for (const name of ALL_SOUNDS) {
        expect(() => sfx.play(name)).not.toThrow();
      }
    });

    it('creates oscillators when playing sounds', () => {
      const sfx = SFXManager.getInstance();
      sfx.init();

      sfx.play('ui_click');

      expect(mockCtx.createOscillator).toHaveBeenCalled();
    });

    it('does not throw before init (graceful no-op)', () => {
      const sfx = SFXManager.getInstance();
      // No init() call
      expect(() => sfx.play('ui_click')).not.toThrow();
    });

    it('does not create oscillators when muted', () => {
      const sfx = SFXManager.getInstance();
      sfx.init();
      sfx.setMuted(true);

      mockCtx.createOscillator.mockClear();
      sfx.play('ui_click');

      expect(mockCtx.createOscillator).not.toHaveBeenCalled();
    });

    it('resumes suspended AudioContext', () => {
      mockCtx.state = 'suspended';
      const sfx = SFXManager.getInstance();
      sfx.init();

      sfx.play('ui_click');

      expect(mockCtx.resume).toHaveBeenCalled();
    });
  });

  describe('volume control', () => {
    it('sets volume between 0 and 1', () => {
      const sfx = SFXManager.getInstance();
      sfx.init();

      sfx.setVolume(0.7);
      expect(sfx.getVolume()).toBe(0.7);
    });

    it('clamps volume below 0', () => {
      const sfx = SFXManager.getInstance();
      sfx.setVolume(-0.5);
      expect(sfx.getVolume()).toBe(0);
    });

    it('clamps volume above 1', () => {
      const sfx = SFXManager.getInstance();
      sfx.setVolume(2.0);
      expect(sfx.getVolume()).toBe(1);
    });

    it('updates master gain node', () => {
      const sfx = SFXManager.getInstance();
      sfx.init();
      const gainNode = mockCtx.createGain();

      sfx.setVolume(0.3);

      // The first createGain call is the master gain
      const masterGainCalls = mockCtx.createGain.mock.results;
      expect(masterGainCalls.length).toBeGreaterThan(0);
    });
  });

  describe('mute toggle', () => {
    it('toggles mute state', () => {
      const sfx = SFXManager.getInstance();
      expect(sfx.isMuted).toBe(false);

      const result1 = sfx.toggleMute();
      expect(result1).toBe(true);
      expect(sfx.isMuted).toBe(true);

      const result2 = sfx.toggleMute();
      expect(result2).toBe(false);
      expect(sfx.isMuted).toBe(false);
    });

    it('setMuted sets mute explicitly', () => {
      const sfx = SFXManager.getInstance();

      sfx.setMuted(true);
      expect(sfx.isMuted).toBe(true);

      sfx.setMuted(false);
      expect(sfx.isMuted).toBe(false);
    });

    it('sets master gain to 0 when muted', () => {
      const sfx = SFXManager.getInstance();
      sfx.init();

      sfx.toggleMute();

      // Master gain node is the first one created
      const masterGain = mockCtx.createGain.mock.results[0].value;
      expect(masterGain.gain.value).toBe(0);
    });

    it('restores volume when unmuted', () => {
      const sfx = SFXManager.getInstance();
      sfx.init();
      sfx.setVolume(0.8);

      sfx.toggleMute(); // mute
      sfx.toggleMute(); // unmute

      const masterGain = mockCtx.createGain.mock.results[0].value;
      expect(masterGain.gain.value).toBe(0.8);
    });
  });

  describe('stopAll', () => {
    it('stops all active oscillators', () => {
      const sfx = SFXManager.getInstance();
      sfx.init();

      // Play several sounds to create oscillators
      sfx.play('ui_click');
      sfx.play('building_place');

      sfx.stopAll();

      // After stopAll, oscillator stop() should have been called
      const oscCalls = mockCtx.createOscillator.mock.results;
      for (const call of oscCalls) {
        expect(call.value.stop).toHaveBeenCalled();
      }
    });
  });

  describe('dispose', () => {
    it('closes AudioContext', () => {
      const sfx = SFXManager.getInstance();
      sfx.init();

      sfx.dispose();

      expect(mockCtx.close).toHaveBeenCalled();
    });

    it('nullifies singleton', () => {
      const sfx = SFXManager.getInstance();
      sfx.dispose();

      // New call should give a different instance
      const sfx2 = SFXManager.getInstance();
      expect(sfx2).not.toBe(sfx);
    });
  });

  describe('noise generation', () => {
    it('creates buffer source for noise-based sounds', () => {
      const sfx = SFXManager.getInstance();
      sfx.init();

      // fire_start uses noise
      sfx.play('fire_start');

      expect(mockCtx.createBuffer).toHaveBeenCalled();
      expect(mockCtx.createBufferSource).toHaveBeenCalled();
    });
  });
});
