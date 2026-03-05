/**
 * Tests for AudioManager -- two-layer audio architecture.
 *
 * Verifies: playTrack with custom fadeMs, playIncidental ducking,
 * unduck restoring volume, saved position tracking.
 */

import AudioManager from '../../src/audio/AudioManager';

// ── Web Audio API mocks ──────────────────────────────────────────────────────

function createMockGainNode(): any {
  return {
    gain: {
      value: 1,
      setValueAtTime: jest.fn(),
      linearRampToValueAtTime: jest.fn(),
    },
    connect: jest.fn(),
    disconnect: jest.fn(),
  };
}

function createMockBufferSource(): any {
  return {
    buffer: null,
    loop: false,
    connect: jest.fn(),
    disconnect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    onended: null as (() => void) | null,
  };
}

function createMockAudioContext(): any {
  return {
    currentTime: 10,
    state: 'running',
    destination: {},
    createGain: jest.fn(() => createMockGainNode()),
    createBufferSource: jest.fn(() => createMockBufferSource()),
    decodeAudioData: jest.fn(async () => ({ duration: 120 })),
    resume: jest.fn(async () => {}),
    close: jest.fn(),
  };
}

// Mock fetch globally for loadBuffer
const mockFetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  }),
) as any;
global.fetch = mockFetch;

// Mock assetUrl to return a simple path
jest.mock('../../src/utils/assetPath', () => ({
  assetUrl: (p: string) => p,
}));

// Inject mock AudioContext
const mockCtx = createMockAudioContext();
(global as any).AudioContext = jest.fn(() => mockCtx);

describe('AudioManager', () => {
  let manager: AudioManager;

  beforeEach(() => {
    jest.useFakeTimers();
    // Reset singleton between tests
    (AudioManager as any).instance = null;
    manager = AudioManager.getInstance();
    // Reset mock AudioContext state
    Object.assign(mockCtx, createMockAudioContext());
    (global as any).AudioContext = jest.fn(() => mockCtx);
    manager.init();
    mockFetch.mockClear();
  });

  afterEach(() => {
    manager.dispose();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('playTrack', () => {
    it('accepts custom fadeMs parameter', async () => {
      await manager.playTrack('katyusha', 5000);

      // Track should be playing (source started)
      const source = mockCtx.createBufferSource.mock.results[0]?.value;
      expect(source?.start).toHaveBeenCalledWith(0);
    });

    it('uses default 2000ms fade when no fadeMs given', async () => {
      // Play a first track to have something to fade out
      await manager.playTrack('katyusha');
      // init() creates masterGain (0) + incidentalGain (1), then playTrack creates trackGain (2)
      const firstTrackGain = mockCtx.createGain.mock.results[2]?.value;

      // Play second track — should fade out first with default 2s
      await manager.playTrack('tachanka');

      expect(firstTrackGain.gain.linearRampToValueAtTime).toHaveBeenCalled();
    });

    it('tracks the current track ID', async () => {
      await manager.playTrack('katyusha');
      // Verify no errors — internal state tracked (tested via getSavedPosition)
      expect(manager.getSavedPosition()).toBe(0);
    });
  });

  describe('playContext', () => {
    it('passes fadeMs to playTrack', async () => {
      const spy = jest.spyOn(manager, 'playTrack');
      manager.playContext('winter', 5000);
      // playContext resolves 'winter' -> 'v_zemlianke' from MUSIC_CONTEXTS
      expect(spy).toHaveBeenCalledWith('v_zemlianke', 5000);
      spy.mockRestore();
    });

    it('uses default fadeMs when not provided', () => {
      const spy = jest.spyOn(manager, 'playTrack');
      manager.playContext('winter');
      expect(spy).toHaveBeenCalledWith('v_zemlianke', 5000);
      spy.mockRestore();
    });
  });

  describe('playIncidental', () => {
    it('ducks the base layer during playback', async () => {
      // Play base track first
      await manager.playTrack('katyusha');
      expect(manager.isDucked).toBe(false);

      // Play incidental
      await manager.playIncidental('sacred_war', 3000);
      expect(manager.isDucked).toBe(true);
    });

    it('saves base layer position when incidental starts', async () => {
      // Set mock time to simulate playback progress
      mockCtx.currentTime = 15; // 5 seconds after track start at time 10
      await manager.playTrack('katyusha');

      mockCtx.currentTime = 18; // 3 more seconds
      await manager.playIncidental('sacred_war');

      // savedPosition should be audioCtx.currentTime - trackStartTime
      // When playTrack was called, currentTime was 15, so trackStartTime = 15
      // When playIncidental runs, currentTime is 18, so savedPosition = 18 - 15 = 3
      expect(manager.getSavedPosition()).toBeCloseTo(3, 1);
    });

    it('unducks base layer when incidental ends naturally', async () => {
      await manager.playTrack('katyusha');
      await manager.playIncidental('sacred_war');
      expect(manager.isDucked).toBe(true);

      // Simulate incidental ending
      const incidentalSource = mockCtx.createBufferSource.mock.results[1]?.value;
      if (incidentalSource?.onended) {
        incidentalSource.onended();
      }

      expect(manager.isDucked).toBe(false);
    });

    it('stops previous incidental before starting new one', async () => {
      await manager.playIncidental('sacred_war');
      const firstSource = mockCtx.createBufferSource.mock.results[0]?.value;

      await manager.playIncidental('katyusha');
      expect(firstSource.stop).toHaveBeenCalled();
    });
  });

  describe('duck / unduck', () => {
    it('duck sets ducked state and level', () => {
      manager.duck(0.7);
      expect(manager.isDucked).toBe(true);
    });

    it('unduck restores ducked state', () => {
      manager.duck(0.7);
      manager.unduck();
      expect(manager.isDucked).toBe(false);
    });

    it('unduck is a no-op when not ducked', () => {
      manager.unduck(); // should not throw
      expect(manager.isDucked).toBe(false);
    });

    it('duck applies gain ramp to current source', async () => {
      await manager.playTrack('katyusha');
      const trackGain = mockCtx.createGain.mock.results.slice(-1)[0]?.value;

      manager.duck(0.7);
      expect(trackGain.gain.linearRampToValueAtTime).toHaveBeenCalled();
    });

    it('unduck ramps gain back to track volume', async () => {
      await manager.playTrack('katyusha');
      const trackGain = mockCtx.createGain.mock.results.slice(-1)[0]?.value;

      manager.duck(0.7);
      trackGain.gain.linearRampToValueAtTime.mockClear();

      manager.unduck();
      expect(trackGain.gain.linearRampToValueAtTime).toHaveBeenCalled();
    });
  });

  describe('setVolume', () => {
    it('updates incidental gain alongside master gain', () => {
      manager.setVolume(0.8);
      // Both masterGain and incidentalGain should be updated
      const gains = mockCtx.createGain.mock.results;
      // init() creates masterGain (index 0) and incidentalGain (index 1)
      expect(gains[0].value.gain.value).toBe(0.8);
      expect(gains[1].value.gain.value).toBe(0.8);
    });
  });

  describe('toggleMute', () => {
    it('mutes both base and incidental layers', () => {
      manager.toggleMute();
      expect(manager.isMuted).toBe(true);
      const gains = mockCtx.createGain.mock.results;
      expect(gains[0].value.gain.value).toBe(0);
      expect(gains[1].value.gain.value).toBe(0);
    });

    it('unmutes both layers', () => {
      manager.toggleMute(); // mute
      manager.toggleMute(); // unmute
      expect(manager.isMuted).toBe(false);
    });
  });

  describe('setEra', () => {
    // Helper to flush microtasks (playTrack is async internally)
    const flushPromises = () => new Promise((r) => jest.requireActual<typeof globalThis>('timers').setImmediate(r));

    it('sets the current era', () => {
      manager.setEra('revolution');
      expect(manager.getCurrentEra()).toBe('revolution');
    });

    it('routes to era-specific playlist tracks', async () => {
      manager.setEra('revolution');
      await flushPromises();
      expect(mockCtx.createBufferSource).toHaveBeenCalled();
    });

    it('does not restart playlist when same era is set', async () => {
      manager.setEra('revolution');
      await flushPromises();
      const callCount = mockCtx.createBufferSource.mock.calls.length;
      manager.setEra('revolution');
      await flushPromises();
      expect(mockCtx.createBufferSource.mock.calls.length).toBe(callCount);
    });

    it('switches playlist when era changes', async () => {
      manager.setEra('revolution');
      await flushPromises();
      const firstCallCount = mockCtx.createBufferSource.mock.calls.length;
      manager.setEra('stagnation');
      await flushPromises();
      expect(mockCtx.createBufferSource.mock.calls.length).toBeGreaterThan(firstCallCount);
    });

    it('falls back to full playlist for unknown era', async () => {
      manager.setEra('unknown_era');
      await flushPromises();
      expect(manager.getCurrentEra()).toBe('unknown_era');
      expect(mockCtx.createBufferSource).toHaveBeenCalled();
    });
  });

  describe('node cleanup', () => {
    it('disconnects source and trackGain when track ends naturally', async () => {
      await manager.playTrack('katyusha');
      const source = mockCtx.createBufferSource.mock.results[0]?.value;
      const trackGain = mockCtx.createGain.mock.results[2]?.value; // index 2: after masterGain + incidentalGain

      // Simulate track ending
      if (source?.onended) {
        source.onended();
      }

      expect(source.disconnect).toHaveBeenCalled();
      expect(trackGain.disconnect).toHaveBeenCalled();
    });

    it('decrements active node count after track ends', async () => {
      await manager.playTrack('katyusha');
      const initialCount = manager.getActiveNodeCount();
      expect(initialCount).toBe(2); // source + trackGain

      const source = mockCtx.createBufferSource.mock.results[0]?.value;
      if (source?.onended) {
        source.onended();
      }

      expect(manager.getActiveNodeCount()).toBe(0);
    });

    it('disconnects incidental source and gain when incidental ends', async () => {
      await manager.playIncidental('sacred_war');
      const source = mockCtx.createBufferSource.mock.results[0]?.value;

      if (source?.onended) {
        source.onended();
      }

      expect(source.disconnect).toHaveBeenCalled();
    });
  });

  describe('context health', () => {
    it('resumes suspended AudioContext on playTrack', async () => {
      mockCtx.state = 'suspended';
      await manager.playTrack('katyusha');
      expect(mockCtx.resume).toHaveBeenCalled();
    });

    it('resumes suspended AudioContext on playIncidental', async () => {
      mockCtx.state = 'suspended';
      await manager.playIncidental('sacred_war');
      expect(mockCtx.resume).toHaveBeenCalled();
    });

    it('tracks active node count', async () => {
      expect(manager.getActiveNodeCount()).toBe(0);
      await manager.playTrack('katyusha');
      expect(manager.getActiveNodeCount()).toBe(2); // source + gain
    });
  });

  describe('dispose', () => {
    it('cleans up incidental state', async () => {
      await manager.playIncidental('sacred_war');
      manager.dispose();
      expect(manager.isDucked).toBe(false);
      expect(manager.getSavedPosition()).toBe(0);
    });

    it('resets era and node count', async () => {
      manager.setEra('revolution');
      await manager.playTrack('katyusha');
      manager.dispose();
      expect(manager.getCurrentEra()).toBeNull();
      expect(manager.getActiveNodeCount()).toBe(0);
    });
  });
});
