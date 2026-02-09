/**
 * Audio Manager for SimSoviet 2000
 * Handles background music, sound effects, and audio state
 * Integrates with authentic Soviet-era audio from marxists.org
 * Uses Tone.js for procedural sound effects
 */

import { AUDIO_MANIFEST, getAudioById, getPreloadAssets, type AudioAsset } from './AudioManifest';
import { ProceduralSounds } from './ProceduralSounds';

export class AudioManager {
  private audioContext: AudioContext | null = null;
  private masterVolume = 0.7;
  private musicVolume = 0.5;
  private sfxVolume = 0.8;
  private ambientVolume = 0.4;
  private muted = false;
  private tracks: Map<string, HTMLAudioElement> = new Map();
  private currentMusic: string | null = null;
  private initialized = false;

  constructor() {
    // Audio context will be initialized on first user interaction
    // (browsers require user gesture to play audio)
  }

  private initAudioContext(): void {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    }
    if (!this.initialized) {
      ProceduralSounds.initialize();
      this.initialized = true;
    }
  }

  public async preloadAssets(): Promise<void> {
    const preloadList = getPreloadAssets();
    console.log(`Preloading ${preloadList.length} audio assets...`);

    const promises = preloadList.map((asset) => this.loadTrack(asset));
    await Promise.allSettled(promises);
    console.log('Audio preload complete');
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
    this.initAudioContext();

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
      if (fadeIn) {
        track.volume = 0;
        track.play().catch((e) => console.warn('Audio play failed:', e));
        this.fadeVolume(trackId, this.calculateVolume(getAudioById(trackId)!), 2000);
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
    this.initAudioContext();

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
    this.initAudioContext();
    const track = this.tracks.get(ambientId);
    if (track && !this.muted) {
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
  }

  public setSFXVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
  }

  public setAmbientVolume(volume: number): void {
    this.ambientVolume = Math.max(0, Math.min(1, volume));
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.muted) {
      this.tracks.forEach((track) => (track.volume = 0));
    } else {
      this.updateAllVolumes();
    }
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

  public getCurrentMusic(): string | null {
    return this.currentMusic;
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
    if (this.audioContext) {
      this.audioContext.close();
    }
    ProceduralSounds.dispose();
  }
}

