/**
 * AudioManager -- Web Audio API-based music playback.
 *
 * Two-layer architecture:
 *   Base layer: continuous era-appropriate playlist with crossfade.
 *   Incidental layer: short event cues that play over the base, auto-cleanup.
 *
 * Usage:
 *   const manager = AudioManager.getInstance();
 *   manager.init();
 *   manager.startPlaylist();
 *   manager.playIncidental('sacred_war', 5000);
 */

import { assetUrl } from '../utils/assetPath';
import { GAMEPLAY_PLAYLIST, getTrack, MUSIC_CONTEXTS } from './AudioManifest';

const AUDIO_BASE_PATH = `${assetUrl('assets/audio/music')}/`;
const DEFAULT_CROSSFADE_MS = 5000;
const MASTER_VOLUME = 0.5;
const MAX_BUFFER_CACHE_SIZE = 50;
const DUCK_AMOUNT = 0.7;

/**
 * Web Audio API-based music playback manager (singleton).
 *
 * Manages two independent audio layers:
 * - Base layer: playlist rotation with shuffle, crossfading between tracks
 * - Incidental layer: short cues that play over base with auto-ducking
 */
class AudioManager {
  private static instance: AudioManager | null = null;

  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private bufferCache: Map<string, AudioBuffer> = new Map();

  // Incidental layer
  private incidentalGain: GainNode | null = null;
  private incidentalSource: AudioBufferSourceNode | null = null;
  private incidentalTimeout: ReturnType<typeof setTimeout> | null = null;

  // Base layer position tracking
  private trackStartTime = 0;
  private savedPosition = 0;
  private currentTrackId: string | null = null;

  // Ducking state
  private ducked = false;
  private duckLevel = 1;
  private duckCount = 0;

  private playlist: string[] = [];
  private playlistIndex = 0;
  private masterVolume = MASTER_VOLUME;
  private muted = false;

  /** Get or create the singleton AudioManager instance. */
  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  /** Initialize the AudioContext and master gain node. */
  init(): void {
    if (this.audioCtx) return;

    try {
      this.audioCtx = new AudioContext();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = this.masterVolume;
      this.masterGain.connect(this.audioCtx.destination);

      this.incidentalGain = this.audioCtx.createGain();
      this.incidentalGain.gain.value = this.masterVolume;
      this.incidentalGain.connect(this.audioCtx.destination);
    } catch (err) {
      console.warn('[AudioManager] Failed to create AudioContext:', err);
    }
  }

  /** Start playing the gameplay playlist in shuffled order. */
  startPlaylist(): void {
    this.playlist = [...GAMEPLAY_PLAYLIST].sort(() => Math.random() - 0.5);
    this.playlistIndex = 0;
    this.playNext();
  }

  /**
   * Play a specific track by ID on the base layer.
   *
   * @param trackId - Track identifier from AudioManifest
   * @param fadeMs - Crossfade duration in milliseconds (default 2000)
   */
  async playTrack(trackId: string, fadeMs: number = DEFAULT_CROSSFADE_MS): Promise<void> {
    if (!this.audioCtx || !this.masterGain) return;
    const track = getTrack(trackId);
    if (!track) return;

    // Resume AudioContext if suspended (autoplay policy)
    if (this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
      } catch {
        // Ignore -- will retry on next user gesture
      }
    }

    // Fade out current track
    this.fadeOutCurrent(fadeMs);

    const url = AUDIO_BASE_PATH + track.filename;

    try {
      const buffer = await this.loadBuffer(url);
      if (!this.audioCtx || !this.masterGain) return;

      // Create a gain node for this track's volume
      const trackGain = this.audioCtx.createGain();
      const baseVol = this.muted ? 0 : track.volume;
      trackGain.gain.value = baseVol * this.duckLevel;
      trackGain.connect(this.masterGain);

      // Create source
      const source = this.audioCtx.createBufferSource();
      source.buffer = buffer;
      source.loop = track.loop;
      source.connect(trackGain);

      // On ended, advance playlist (for non-looping tracks)
      source.onended = () => {
        if (!track.loop && this.currentSource === source) {
          this.currentSource = null;
          this.currentTrackId = null;
          this.playNext();
        }
      };

      source.start(0);
      this.currentSource = source;
      this.currentTrackId = trackId;
      this.trackStartTime = this.audioCtx.currentTime;
      this.savedPosition = 0;

      // Store the track gain for later volume adjustments
      (source as any)._trackGain = trackGain;
    } catch (err) {
      console.warn(`[AudioManager] Failed to play track "${trackId}":`, err);
    }
  }

  /**
   * Play a context-specific track (e.g., 'winter', 'victory').
   *
   * @param context - Context key from MUSIC_CONTEXTS
   * @param fadeMs - Crossfade duration in milliseconds (default 2000)
   */
  playContext(context: string, fadeMs: number = DEFAULT_CROSSFADE_MS): void {
    const trackId = MUSIC_CONTEXTS[context];
    if (trackId) this.playTrack(trackId, fadeMs);
  }

  /**
   * Play a short incidental cue over the base layer.
   * Ducks the base layer by 30% during playback.
   *
   * @param trackId - Track identifier from AudioManifest
   * @param durationMs - Duration in ms before auto-cleanup (default: track length)
   */
  async playIncidental(trackId: string, durationMs?: number): Promise<void> {
    if (!this.audioCtx || !this.incidentalGain) return;
    const track = getTrack(trackId);
    if (!track) return;

    // Resume AudioContext if suspended
    if (this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
      } catch {
        // Ignore
      }
    }

    // Stop any existing incidental
    this.stopIncidental();

    // Save base layer position
    if (this.currentSource && this.currentTrackId) {
      this.savedPosition = this.audioCtx.currentTime - this.trackStartTime;
    }

    // Duck base layer
    this.duck(DUCK_AMOUNT);

    const url = AUDIO_BASE_PATH + track.filename;

    try {
      const buffer = await this.loadBuffer(url);
      if (!this.audioCtx || !this.incidentalGain) return;

      // Create source on incidental chain with per-track volume
      const source = this.audioCtx.createBufferSource();
      source.buffer = buffer;
      source.loop = false;
      const trackVolumeGain = this.audioCtx.createGain();
      trackVolumeGain.gain.value = track.volume ?? 1.0;
      source.connect(trackVolumeGain);
      trackVolumeGain.connect(this.incidentalGain);

      source.onended = () => {
        if (this.incidentalSource === source) {
          this.cleanupIncidental();
        }
      };

      source.start(0);
      this.incidentalSource = source;

      // Auto-cleanup after durationMs if specified
      if (durationMs != null && durationMs > 0) {
        this.incidentalTimeout = setTimeout(() => {
          this.stopIncidental();
        }, durationMs);
      }
    } catch (err) {
      console.warn(`[AudioManager] Failed to play incidental "${trackId}":`, err);
      this.unduck();
    }
  }

  /**
   * Duck the base layer volume by a multiplier (0-1).
   *
   * @param amount - Volume multiplier (e.g., 0.7 = 30% reduction)
   */
  duck(amount: number): void {
    this.duckCount++;
    this.ducked = true;
    this.duckLevel = Math.max(0, Math.min(1, amount));

    if (this.currentSource && this.audioCtx && this.currentTrackId) {
      const trackGain: GainNode | undefined = (this.currentSource as any)._trackGain;
      if (trackGain) {
        const track = getTrack(this.currentTrackId);
        const baseVol = this.muted ? 0 : (track?.volume ?? 1);
        const now = this.audioCtx.currentTime;
        trackGain.gain.setValueAtTime(trackGain.gain.value, now);
        trackGain.gain.linearRampToValueAtTime(baseVol * this.duckLevel, now + 0.3);
      }
    }
  }

  /** Restore base layer volume after ducking. */
  unduck(): void {
    if (!this.ducked) return;
    this.duckCount = Math.max(0, this.duckCount - 1);
    if (this.duckCount > 0) return;
    this.ducked = false;
    this.duckLevel = 1;

    if (this.currentSource && this.audioCtx) {
      const trackGain: GainNode | undefined = (this.currentSource as any)._trackGain;
      if (trackGain && this.currentTrackId) {
        const track = getTrack(this.currentTrackId);
        if (track) {
          const targetVol = this.muted ? 0 : track.volume;
          const now = this.audioCtx.currentTime;
          trackGain.gain.setValueAtTime(trackGain.gain.value, now);
          trackGain.gain.linearRampToValueAtTime(targetVol, now + 0.3);
        }
      }
    }
  }

  /** Get the saved base layer position in seconds. */
  getSavedPosition(): number {
    return this.savedPosition;
  }

  /** Whether the base layer is currently ducked. */
  get isDucked(): boolean {
    return this.ducked;
  }

  /** Advance to the next track in the playlist. */
  private playNext(): void {
    if (this.playlist.length === 0) return;
    if (this.playlistIndex >= this.playlist.length) {
      // Reshuffle and restart
      this.playlist = [...GAMEPLAY_PLAYLIST].sort(() => Math.random() - 0.5);
      this.playlistIndex = 0;
    }
    const trackId = this.playlist[this.playlistIndex];
    this.playlistIndex++;
    this.playTrack(trackId);
  }

  /** Fade out the currently playing base track. */
  private fadeOutCurrent(fadeMs: number = DEFAULT_CROSSFADE_MS): void {
    if (!this.currentSource || !this.audioCtx) return;

    const source = this.currentSource;
    const trackGain: GainNode | undefined = (source as any)._trackGain;
    this.currentSource = null;

    if (trackGain) {
      const now = this.audioCtx.currentTime;
      trackGain.gain.setValueAtTime(trackGain.gain.value, now);
      trackGain.gain.linearRampToValueAtTime(0, now + fadeMs / 1000);

      // Stop and disconnect after fade completes
      setTimeout(() => {
        try {
          source.stop();
        } catch {
          // Already stopped
        }
        source.disconnect();
        trackGain.disconnect();
      }, fadeMs + 100);
    } else {
      try {
        source.stop();
      } catch {
        // Already stopped
      }
      source.disconnect();
    }
  }

  /** Stop the incidental source and restore base volume. */
  private stopIncidental(): void {
    if (this.incidentalSource) {
      try {
        this.incidentalSource.stop();
      } catch {
        // Already stopped
      }
      this.incidentalSource.disconnect();
      this.incidentalSource = null;
    }
    this.cleanupIncidental();
  }

  /** Cleanup incidental state and unduck base. */
  private cleanupIncidental(): void {
    if (this.incidentalTimeout) {
      clearTimeout(this.incidentalTimeout);
      this.incidentalTimeout = null;
    }
    this.incidentalSource = null;
    this.unduck();
  }

  /** Fetch and decode an audio file, with caching. */
  private async loadBuffer(url: string): Promise<AudioBuffer> {
    const cached = this.bufferCache.get(url);
    if (cached) return cached;

    if (!this.audioCtx) throw new Error('AudioContext not initialized');

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching ${url}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);

    // Evict oldest entry if cache exceeds max size (simple LRU by insertion order)
    if (this.bufferCache.size >= MAX_BUFFER_CACHE_SIZE) {
      const oldestKey = this.bufferCache.keys().next().value;
      if (oldestKey) this.bufferCache.delete(oldestKey);
    }

    this.bufferCache.set(url, audioBuffer);
    return audioBuffer;
  }

  /** Stop all music. */
  stop(): void {
    this.stopIncidental();
    this.fadeOutCurrent();
  }

  /** Set master volume (0-1). */
  setVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && !this.muted) {
      this.masterGain.gain.value = this.masterVolume;
    }
    if (this.incidentalGain && !this.muted) {
      this.incidentalGain.gain.value = this.masterVolume;
    }
  }

  /** Toggle mute. */
  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;
    }
    if (this.incidentalGain) {
      this.incidentalGain.gain.value = this.muted ? 0 : this.masterVolume;
    }
    return this.muted;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Close AudioContext and clear buffer cache. */
  dispose(): void {
    this.stopIncidental();
    this.fadeOutCurrent();

    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch {
        // Ignore
      }
    }

    this.audioCtx = null;
    this.masterGain = null;
    this.incidentalGain = null;
    this.currentSource = null;
    this.incidentalSource = null;
    this.currentTrackId = null;
    this.savedPosition = 0;
    this.trackStartTime = 0;
    this.ducked = false;
    this.duckLevel = 1;
    this.duckCount = 0;
    this.bufferCache.clear();
    this.playlist = [];
    this.playlistIndex = 0;

    AudioManager.instance = null;
  }
}

export default AudioManager;
