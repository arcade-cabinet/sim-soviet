/**
 * AudioManager — BabylonJS-based music playback for React Native.
 *
 * Uses BabylonJS Sound class for OGG music playback.
 * Manages playlist rotation, crossfading, and volume control.
 *
 * Usage:
 *   const manager = AudioManager.getInstance();
 *   manager.init(scene);
 *   manager.startPlaylist();
 */

import { Sound, type Scene } from '@babylonjs/core';
import { MUSIC_TRACKS, GAMEPLAY_PLAYLIST, MUSIC_CONTEXTS, getTrack } from './AudioManifest';
import { assetUrl } from '../utils/assetPath';

const AUDIO_BASE_PATH = assetUrl('assets/audio/music') + '/';
const CROSSFADE_MS = 2000;
const MASTER_VOLUME = 0.5;

class AudioManager {
  private static instance: AudioManager | null = null;
  private scene: Scene | null = null;
  private currentSound: Sound | null = null;
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

  init(scene: Scene): void {
    this.scene = scene;
  }

  /** Start playing the gameplay playlist in shuffled order. */
  startPlaylist(): void {
    this.playlist = [...GAMEPLAY_PLAYLIST].sort(() => Math.random() - 0.5);
    this.playlistIndex = 0;
    this.playNext();
  }

  /** Play a specific track by ID. */
  playTrack(trackId: string): void {
    if (!this.scene) return;
    const track = getTrack(trackId);
    if (!track) return;

    // Fade out current
    this.fadeOutCurrent();

    const url = AUDIO_BASE_PATH + track.filename;
    const sound = new Sound(track.id, url, this.scene, () => {
      // Ready callback
      sound.setVolume(this.muted ? 0 : track.volume * this.masterVolume);
      sound.play();
    }, {
      loop: track.loop,
      autoplay: false,
    });

    sound.onEndedObservable.add(() => {
      // When a non-looping track ends, play next in playlist
      if (!track.loop) {
        this.playNext();
      }
    });

    this.currentSound = sound;
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

  /** Fade out the currently playing track. */
  private fadeOutCurrent(): void {
    if (this.currentSound) {
      const sound = this.currentSound;
      const startVol = sound.getVolume();
      const steps = 20;
      const stepMs = CROSSFADE_MS / steps;
      let step = 0;
      const interval = setInterval(() => {
        step++;
        sound.setVolume(startVol * (1 - step / steps));
        if (step >= steps) {
          clearInterval(interval);
          sound.stop();
          sound.dispose();
        }
      }, stepMs);
      this.currentSound = null;
    }
  }

  /** Stop all music. */
  stop(): void {
    this.fadeOutCurrent();
  }

  /** Set master volume (0-1). */
  setVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.currentSound && !this.muted) {
      this.currentSound.setVolume(this.masterVolume);
    }
  }

  /** Toggle mute. */
  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.currentSound) {
      this.currentSound.setVolume(this.muted ? 0 : this.masterVolume);
    }
    return this.muted;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  dispose(): void {
    this.stop();
    this.scene = null;
    AudioManager.instance = null;
  }
}

export default AudioManager;
