/**
 * AudioManager -- Web Audio API-based music playback.
 *
 * Migrated from BabylonJS Sound class to native Web Audio API.
 * Manages playlist rotation, crossfading, and volume control.
 *
 * Usage:
 *   const manager = AudioManager.getInstance();
 *   manager.init();
 *   manager.startPlaylist();
 */

import { assetUrl } from '../utils/assetPath';
import { GAMEPLAY_PLAYLIST, getTrack, MUSIC_CONTEXTS } from './AudioManifest';

const AUDIO_BASE_PATH = `${assetUrl('assets/audio/music')}/`;
const CROSSFADE_MS = 2000;
const MASTER_VOLUME = 0.5;

class AudioManager {
  private static instance: AudioManager | null = null;

  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private bufferCache: Map<string, AudioBuffer> = new Map();

  private playlist: string[] = [];
  private playlistIndex = 0;
  private masterVolume = MASTER_VOLUME;
  private muted = false;

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  /** Initialize the AudioContext and master gain node. No scene param needed. */
  init(): void {
    if (this.audioCtx) return;

    try {
      this.audioCtx = new AudioContext();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = this.masterVolume;
      this.masterGain.connect(this.audioCtx.destination);
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

  /** Play a specific track by ID. */
  async playTrack(trackId: string): Promise<void> {
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
    this.fadeOutCurrent();

    const url = AUDIO_BASE_PATH + track.filename;

    try {
      const buffer = await this.loadBuffer(url);
      if (!this.audioCtx || !this.masterGain) return;

      // Create a gain node for this track's volume
      const trackGain = this.audioCtx.createGain();
      trackGain.gain.value = this.muted ? 0 : track.volume;
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
          this.playNext();
        }
      };

      source.start(0);
      this.currentSource = source;

      // Store the track gain for later volume adjustments
      (source as any)._trackGain = trackGain;
    } catch (err) {
      console.warn(`[AudioManager] Failed to play track "${trackId}":`, err);
    }
  }

  /** Play a context-specific track (e.g., 'winter', 'victory'). */
  playContext(context: string): void {
    const trackId = MUSIC_CONTEXTS[context];
    if (trackId) this.playTrack(trackId);
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

  /** Fade out the currently playing track using Web Audio API ramp. */
  private fadeOutCurrent(): void {
    if (!this.currentSource || !this.audioCtx) return;

    const source = this.currentSource;
    const trackGain: GainNode | undefined = (source as any)._trackGain;
    this.currentSource = null;

    if (trackGain) {
      const now = this.audioCtx.currentTime;
      trackGain.gain.setValueAtTime(trackGain.gain.value, now);
      trackGain.gain.linearRampToValueAtTime(0, now + CROSSFADE_MS / 1000);

      // Stop and disconnect after fade completes
      setTimeout(() => {
        try {
          source.stop();
        } catch {
          // Already stopped
        }
        source.disconnect();
        trackGain.disconnect();
      }, CROSSFADE_MS + 100);
    } else {
      try {
        source.stop();
      } catch {
        // Already stopped
      }
      source.disconnect();
    }
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
    this.bufferCache.set(url, audioBuffer);
    return audioBuffer;
  }

  /** Stop all music. */
  stop(): void {
    this.fadeOutCurrent();
  }

  /** Set master volume (0-1). */
  setVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && !this.muted) {
      this.masterGain.gain.value = this.masterVolume;
    }
  }

  /** Toggle mute. */
  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;
    }
    return this.muted;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Close AudioContext and clear buffer cache. */
  dispose(): void {
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
    this.currentSource = null;
    this.bufferCache.clear();
    this.playlist = [];
    this.playlistIndex = 0;

    AudioManager.instance = null;
  }
}

export default AudioManager;
