/**
 * Audio Manager for SimSoviet 2000
 * Handles background music, sound effects, and audio state
 * Integrates with authentic Soviet-era audio from marxists.org
 * Uses Tone.js for procedural sound effects
 */

import { type AudioAsset, ERA_MUSIC, getAudioById, getPreloadAssets } from './AudioManifest';
import * as ProceduralSounds from './ProceduralSounds';

const STORAGE_KEY_MUSIC_VOL = 'simsoviet_music_volume';
const STORAGE_KEY_AMBIENT_VOL = 'simsoviet_ambient_volume';
const STORAGE_KEY_MUTED = 'simsoviet_muted';

function loadStoredNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      const n = Number.parseFloat(raw);
      if (Number.isFinite(n)) return Math.max(0, Math.min(1, n));
    }
  } catch {
    /* localStorage unavailable */
  }
  return fallback;
}

function loadStoredBool(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) return raw === 'true';
  } catch {
    /* localStorage unavailable */
  }
  return fallback;
}

function storeValue(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* localStorage unavailable */
  }
}

export class AudioManager {
  private masterVolume = 0.7;
  private musicVolume: number;
  private sfxVolume = 0.8;
  private ambientVolume: number;
  private muted: boolean;
  private tracks: Map<string, HTMLAudioElement> = new Map();
  private currentMusic: string | null = null;
  private currentEra: string = '';
  private currentSeason: string = '';
  private initialized = false;

  constructor() {
    this.musicVolume = loadStoredNumber(STORAGE_KEY_MUSIC_VOL, 0.5);
    this.ambientVolume = loadStoredNumber(STORAGE_KEY_AMBIENT_VOL, 0.4);
    this.muted = loadStoredBool(STORAGE_KEY_MUTED, true);
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      ProceduralSounds.initialize();
      this.initialized = true;
    }
  }

  public async preloadAssets(): Promise<void> {
    const preloadList = getPreloadAssets();
    const promises = preloadList.map((asset) => this.loadTrack(asset));
    await Promise.allSettled(promises);
  }

  public async loadTrack(asset: AudioAsset): Promise<void> {
    try {
      // Skip procedural sounds (generated via Tone.js)
      if (asset.url === 'procedural') {
        return;
      }

      const audio = new Audio(asset.url);
      audio.volume = this.calculateVolume(asset);
      audio.loop = asset.loop;
      audio.preload = asset.preload ? 'auto' : 'none';

      // Handle load errors gracefully
      audio.addEventListener('error', () => {
        console.warn(`Failed to load audio: ${asset.id} from ${asset.url}`);
      });

      this.tracks.set(asset.id, audio);
    } catch (error) {
      console.error(`Error loading track ${asset.id}:`, error);
    }
  }

  private calculateVolume(asset: AudioAsset): number {
    let categoryVolume = 1;
    switch (asset.category) {
      case 'music':
        categoryVolume = this.musicVolume;
        break;
      case 'sfx':
        categoryVolume = this.sfxVolume;
        break;
      case 'ambient':
        categoryVolume = this.ambientVolume;
        break;
      case 'voice':
        categoryVolume = this.sfxVolume;
        break;
    }
    return asset.volume * categoryVolume * this.masterVolume;
  }

  public async playMusic(trackId: string, fadeIn = true): Promise<void> {
    this.ensureInitialized();

    // Stop current music if playing
    if (this.currentMusic && this.currentMusic !== trackId) {
      await this.stopMusic(this.currentMusic, true);
    }

    let track = this.tracks.get(trackId);

    // Lazy load if not preloaded
    if (!track) {
      const asset = getAudioById(trackId);
      if (asset) {
        await this.loadTrack(asset);
        track = this.tracks.get(trackId);
      }
    }

    if (track && !this.muted) {
      const asset = getAudioById(trackId);
      if (fadeIn) {
        track.volume = 0;
        track.play().catch((e) => console.warn('Audio play failed:', e));
        if (asset) {
          this.fadeVolume(trackId, this.calculateVolume(asset), 2000);
        }
      } else {
        track.play().catch((e) => console.warn('Audio play failed:', e));
      }
      this.currentMusic = trackId;
    }
  }

  public async stopMusic(trackId: string, fadeOut = true): Promise<void> {
    const track = this.tracks.get(trackId);
    if (!track) return;

    if (fadeOut) {
      await this.fadeVolume(trackId, 0, 1000);
      track.pause();
      track.currentTime = 0;
    } else {
      track.pause();
      track.currentTime = 0;
    }

    if (this.currentMusic === trackId) {
      this.currentMusic = null;
    }
  }

  private fadeVolume(trackId: string, targetVolume: number, duration: number): Promise<void> {
    return new Promise((resolve) => {
      const track = this.tracks.get(trackId);
      if (!track) {
        resolve();
        return;
      }

      const startVolume = track.volume;
      const startTime = Date.now();

      const fade = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        track.volume = startVolume + (targetVolume - startVolume) * progress;

        if (progress < 1) {
          requestAnimationFrame(fade);
        } else {
          resolve();
        }
      };

      fade();
    });
  }

  public playSFX(soundId: string): void {
    this.ensureInitialized();

    // Check if this is a procedural sound
    const asset = getAudioById(soundId);
    if (asset?.url === 'procedural') {
      if (this.muted) return;

      // Play procedural sound via Tone.js
      switch (soundId) {
        case 'build':
          ProceduralSounds.playBuildSound();
          break;
        case 'destroy':
          ProceduralSounds.playDestroySound();
          break;
        case 'notification':
          ProceduralSounds.playNotificationSound();
          break;
        case 'coin':
          ProceduralSounds.playCoinSound();
          break;
      }
      return;
    }

    // Handle regular audio file SFX
    let track = this.tracks.get(soundId);

    if (!track) {
      if (asset) {
        this.loadTrack(asset).then(() => {
          track = this.tracks.get(soundId);
          if (track && !this.muted) {
            track.currentTime = 0;
            track.play().catch((e) => console.warn('SFX play failed:', e));
          }
        });
      }
    } else if (!this.muted) {
      track.currentTime = 0;
      track.play().catch((e) => console.warn('SFX play failed:', e));
    }
  }

  public playAmbient(ambientId: string): void {
    this.ensureInitialized();
    let track = this.tracks.get(ambientId);

    // Lazy load if not preloaded
    if (!track) {
      const asset = getAudioById(ambientId);
      if (asset) {
        this.loadTrack(asset).then(() => {
          track = this.tracks.get(ambientId);
          if (track && !this.muted) {
            track.play().catch((e) => console.warn('Ambient play failed:', e));
          }
        });
      }
      return;
    }

    if (!this.muted) {
      track.play().catch((e) => console.warn('Ambient play failed:', e));
    }
  }

  public stopAmbient(ambientId: string): void {
    const track = this.tracks.get(ambientId);
    if (track) {
      track.pause();
      track.currentTime = 0;
    }
  }

  public setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.updateAllVolumes();
  }

  public setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    this.updateMusicVolumes();
    storeValue(STORAGE_KEY_MUSIC_VOL, String(this.musicVolume));
  }

  public setSFXVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    this.updateCategoryVolumes('sfx');
  }

  public setAmbientVolume(volume: number): void {
    this.ambientVolume = Math.max(0, Math.min(1, volume));
    this.updateCategoryVolumes('ambient');
    storeValue(STORAGE_KEY_AMBIENT_VOL, String(this.ambientVolume));
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.muted) {
      this.tracks.forEach((track) => {
        track.volume = 0;
      });
    } else {
      this.updateAllVolumes();
    }
    storeValue(STORAGE_KEY_MUTED, String(this.muted));
    return this.muted;
  }

  private updateAllVolumes(): void {
    this.tracks.forEach((track, id) => {
      const asset = getAudioById(id);
      if (asset) {
        track.volume = this.calculateVolume(asset);
      }
    });
  }

  private updateMusicVolumes(): void {
    this.tracks.forEach((track, id) => {
      const asset = getAudioById(id);
      if (asset?.category === 'music') {
        track.volume = this.calculateVolume(asset);
      }
    });
  }

  private updateCategoryVolumes(category: AudioAsset['category']): void {
    this.tracks.forEach((track, id) => {
      const asset = getAudioById(id);
      if (asset?.category === category) {
        track.volume = this.calculateVolume(asset);
      }
    });
  }

  /**
   * Switch music to a random track from the era's curated pool.
   * Crossfades from current track (1s fade out, then new track fades in).
   */
  public setEra(eraId: string): void {
    if (eraId === this.currentEra) return;
    this.currentEra = eraId;

    const pool = ERA_MUSIC[eraId];
    if (!pool || pool.length === 0) return;

    // Pick a random track from the era pool, avoiding the current one
    let trackId = pool[Math.floor(Math.random() * pool.length)]!;
    if (pool.length > 1 && trackId === this.currentMusic) {
      trackId = pool[(pool.indexOf(trackId) + 1) % pool.length]!;
    }

    this.playMusic(trackId);
  }

  /**
   * Adjust ambient sound state based on the current season.
   * Winter/frost plays wind ambient; summer-like seasons stop wind.
   */
  public setSeason(season: string): void {
    if (season === this.currentSeason) return;
    this.currentSeason = season;

    // Winter-like seasons get wind ambience
    if (season === 'winter' || season === 'early_frost') {
      this.playAmbient('wind');
    } else {
      this.stopAmbient('wind');
    }
  }

  public getCurrentMusic(): string | null {
    return this.currentMusic;
  }

  public getCurrentEra(): string {
    return this.currentEra;
  }

  public getCurrentSeason(): string {
    return this.currentSeason;
  }

  public getMusicVolume(): number {
    return this.musicVolume;
  }

  public getAmbientVolume(): number {
    return this.ambientVolume;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public dispose(): void {
    this.tracks.forEach((track) => {
      track.pause();
      track.src = '';
    });
    this.tracks.clear();
    ProceduralSounds.dispose();
  }
}
