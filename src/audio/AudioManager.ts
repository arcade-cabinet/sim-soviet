/**
 * Audio Manager for SimSoviet 2000
 * Handles background music, sound effects, and audio state
 */

export interface AudioTrack {
  id: string;
  url: string;
  volume: number;
  loop: boolean;
}

export class AudioManager {
  private audioContext: AudioContext | null = null;
  private masterVolume = 0.7;
  private musicVolume = 0.5;
  private sfxVolume = 0.8;
  private muted = false;
  private tracks: Map<string, HTMLAudioElement> = new Map();

  constructor() {
    // Audio context will be initialized on first user interaction
    // (browsers require user gesture to play audio)
  }

  private initAudioContext(): void {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    }
  }

  public async loadTrack(track: AudioTrack): Promise<void> {
    const audio = new Audio(track.url);
    audio.volume = track.volume * this.musicVolume * this.masterVolume;
    audio.loop = track.loop;
    this.tracks.set(track.id, audio);
  }

  public playMusic(trackId: string): void {
    this.initAudioContext();
    const track = this.tracks.get(trackId);
    if (track && !this.muted) {
      track.play().catch((e) => console.warn('Audio play failed:', e));
    }
  }

  public stopMusic(trackId: string): void {
    const track = this.tracks.get(trackId);
    if (track) {
      track.pause();
      track.currentTime = 0;
    }
  }

  public playSFX(soundId: string): void {
    this.initAudioContext();
    // Play sound effect
    // Implementation depends on sound file format and loading strategy
  }

  public setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.updateAllVolumes();
  }

  public setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    this.updateAllVolumes();
  }

  public setSFXVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
  }

  public toggleMute(): void {
    this.muted = !this.muted;
    if (this.muted) {
      this.tracks.forEach((track) => (track.volume = 0));
    } else {
      this.updateAllVolumes();
    }
  }

  private updateAllVolumes(): void {
    this.tracks.forEach((track) => {
      track.volume = this.musicVolume * this.masterVolume;
    });
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
  }
}
