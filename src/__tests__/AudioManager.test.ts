/**
 * Tests for AudioManager — era-music switching, volume controls,
 * localStorage persistence, and graceful degradation.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioManager } from '@/audio/AudioManager';
import { ERA_MUSIC } from '@/audio/AudioManifest';

// Stub HTMLAudioElement for happy-dom (which has limited audio support)
class StubAudio {
  src = '';
  volume = 1;
  loop = false;
  preload = 'auto';
  currentTime = 0;
  play = vi.fn().mockResolvedValue(undefined);
  pause = vi.fn();
  addEventListener = vi.fn();
}

vi.stubGlobal('Audio', StubAudio);

// Mock ProceduralSounds — Tone.js isn't available in happy-dom
vi.mock('@/audio/ProceduralSounds', () => ({
  initialize: vi.fn().mockResolvedValue(undefined),
  dispose: vi.fn(),
  playBuildSound: vi.fn(),
  playDestroySound: vi.fn(),
  playNotificationSound: vi.fn(),
  playCoinSound: vi.fn(),
}));

describe('AudioManager', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('constructor — localStorage persistence', () => {
    it('reads music volume from localStorage', () => {
      localStorage.setItem('simsoviet_music_volume', '0.75');
      const am = new AudioManager();
      expect(am.getMusicVolume()).toBe(0.75);
    });

    it('reads ambient volume from localStorage', () => {
      localStorage.setItem('simsoviet_ambient_volume', '0.2');
      const am = new AudioManager();
      expect(am.getAmbientVolume()).toBe(0.2);
    });

    it('reads muted state from localStorage', () => {
      localStorage.setItem('simsoviet_muted', 'true');
      const am = new AudioManager();
      expect(am.isMuted()).toBe(true);
    });

    it('uses defaults when localStorage is empty', () => {
      const am = new AudioManager();
      expect(am.getMusicVolume()).toBe(0.5);
      expect(am.getAmbientVolume()).toBe(0.4);
      expect(am.isMuted()).toBe(false);
    });
  });

  describe('setMusicVolume', () => {
    it('clamps to 0-1 range', () => {
      const am = new AudioManager();
      am.setMusicVolume(1.5);
      expect(am.getMusicVolume()).toBe(1);
      am.setMusicVolume(-0.3);
      expect(am.getMusicVolume()).toBe(0);
    });

    it('persists to localStorage', () => {
      const am = new AudioManager();
      am.setMusicVolume(0.65);
      expect(localStorage.getItem('simsoviet_music_volume')).toBe('0.65');
    });
  });

  describe('setAmbientVolume', () => {
    it('clamps to 0-1 range', () => {
      const am = new AudioManager();
      am.setAmbientVolume(2);
      expect(am.getAmbientVolume()).toBe(1);
      am.setAmbientVolume(-1);
      expect(am.getAmbientVolume()).toBe(0);
    });

    it('persists to localStorage', () => {
      const am = new AudioManager();
      am.setAmbientVolume(0.35);
      expect(localStorage.getItem('simsoviet_ambient_volume')).toBe('0.35');
    });
  });

  describe('toggleMute', () => {
    it('toggles and returns new state', () => {
      const am = new AudioManager();
      expect(am.toggleMute()).toBe(true);
      expect(am.isMuted()).toBe(true);
      expect(am.toggleMute()).toBe(false);
      expect(am.isMuted()).toBe(false);
    });

    it('persists muted state to localStorage', () => {
      const am = new AudioManager();
      am.toggleMute();
      expect(localStorage.getItem('simsoviet_muted')).toBe('true');
    });
  });

  describe('setEra', () => {
    it('changes internal era state', () => {
      const am = new AudioManager();
      expect(am.getCurrentEra()).toBe('');
      am.setEra('war_communism');
      expect(am.getCurrentEra()).toBe('war_communism');
    });

    it('does not re-trigger music for the same era', () => {
      const am = new AudioManager();
      const spy = vi.spyOn(am, 'playMusic');
      am.setEra('great_patriotic');
      expect(spy).toHaveBeenCalledTimes(1);
      am.setEra('great_patriotic');
      // No second call — era hasn't changed
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('picks a track from the era pool', () => {
      const am = new AudioManager();
      const spy = vi.spyOn(am, 'playMusic');
      am.setEra('first_plans');
      expect(spy).toHaveBeenCalledTimes(1);
      const trackId = spy.mock.calls[0]![0];
      expect(ERA_MUSIC.first_plans).toContain(trackId);
    });

    it('handles unknown era gracefully (no crash)', () => {
      const am = new AudioManager();
      expect(() => am.setEra('imaginary_era')).not.toThrow();
      expect(am.getCurrentEra()).toBe('imaginary_era');
    });
  });

  describe('setSeason', () => {
    it('changes internal season state', () => {
      const am = new AudioManager();
      expect(am.getCurrentSeason()).toBe('');
      am.setSeason('winter');
      expect(am.getCurrentSeason()).toBe('winter');
    });

    it('does not re-trigger for the same season', () => {
      const am = new AudioManager();
      const ambientSpy = vi.spyOn(am, 'playAmbient');
      am.setSeason('winter');
      expect(ambientSpy).toHaveBeenCalledTimes(1);
      am.setSeason('winter');
      // No second call
      expect(ambientSpy).toHaveBeenCalledTimes(1);
    });

    it('plays wind ambient for winter', () => {
      const am = new AudioManager();
      const ambientSpy = vi.spyOn(am, 'playAmbient');
      am.setSeason('winter');
      expect(ambientSpy).toHaveBeenCalledWith('wind');
    });

    it('stops wind ambient for summer-like seasons', () => {
      const am = new AudioManager();
      am.setSeason('winter'); // start wind
      const stopSpy = vi.spyOn(am, 'stopAmbient');
      am.setSeason('short_summer');
      expect(stopSpy).toHaveBeenCalledWith('wind');
    });
  });

  describe('ERA_MUSIC manifest', () => {
    it('has entries for all 8 eras', () => {
      const eras = [
        'war_communism',
        'first_plans',
        'great_patriotic',
        'reconstruction',
        'thaw',
        'stagnation',
        'perestroika',
        'eternal_soviet',
      ];
      for (const era of eras) {
        expect(ERA_MUSIC[era]).toBeDefined();
        expect(ERA_MUSIC[era]!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('dispose', () => {
    it('clears tracks without throwing', () => {
      const am = new AudioManager();
      expect(() => am.dispose()).not.toThrow();
    });
  });
});
