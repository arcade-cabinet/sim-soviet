/**
 * SFXManager --- Procedural sound effects via Web Audio API.
 *
 * Synthesizes all sounds in-memory using OscillatorNode + GainNode chains.
 * No external audio files required. Soviet/industrial aesthetic throughout.
 *
 * Usage:
 *   const sfx = SFXManager.getInstance();
 *   sfx.play('building_place');
 *   sfx.setVolume(0.5);
 *   sfx.toggleMute();
 */

/** All recognized sound effect names. */
export type SFXName =
  // UI
  | 'ui_click'
  | 'ui_modal_open'
  | 'ui_modal_close'
  // Building
  | 'building_place'
  | 'building_construct_tick'
  | 'building_complete'
  | 'building_demolish'
  // Resources
  | 'resource_produce'
  | 'resource_storage_full'
  // Events
  | 'quota_fulfilled'
  | 'quota_failed'
  | 'fire_start'
  | 'worker_death'
  | 'season_change'
  | 'era_transition'
  // Alerts
  | 'advisor_message'
  | 'toast_notification'
  | 'game_over'
  | 'achievement';

/** Per-effect volume multiplier (some effects are naturally louder). */
const EFFECT_VOLUMES: Partial<Record<SFXName, number>> = {
  ui_click: 0.3,
  ui_modal_open: 0.4,
  ui_modal_close: 0.3,
  building_place: 0.5,
  building_construct_tick: 0.15,
  building_complete: 0.5,
  building_demolish: 0.4,
  resource_produce: 0.15,
  resource_storage_full: 0.4,
  quota_fulfilled: 0.6,
  quota_failed: 0.5,
  fire_start: 0.4,
  worker_death: 0.4,
  season_change: 0.3,
  era_transition: 0.6,
  advisor_message: 0.3,
  toast_notification: 0.25,
  game_over: 0.7,
  achievement: 0.5,
};

/**
 * Maximum concurrent oscillators to prevent audio glitches.
 * Older effects are force-stopped when the pool is full.
 */
const MAX_ACTIVE_NODES = 12;

/** A tracked oscillator lifecycle entry. */
interface ActiveNode {
  osc: OscillatorNode;
  gain: GainNode;
  startedAt: number;
}

class SFXManager {
  private static instance: SFXManager | null = null;

  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterVolume = 0.5;
  private muted = false;
  private activeNodes: ActiveNode[] = [];

  static getInstance(): SFXManager {
    if (!SFXManager.instance) {
      SFXManager.instance = new SFXManager();
    }
    return SFXManager.instance;
  }

  /**
   * Lazily initialize AudioContext.
   * Must be called from a user gesture (click/tap) to satisfy autoplay policy.
   */
  init(): void {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;
      this.masterGain.connect(this.ctx.destination);
    } catch {
      // Graceful degradation --- play() becomes a no-op
      console.warn('[SFXManager] Web Audio API not available');
    }
  }

  /** Resume AudioContext if it was suspended (autoplay policy). */
  private ensureRunning(): boolean {
    if (!this.ctx || !this.masterGain) return false;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return true;
  }

  // ── Pool management ──────────────────────────────────────────────────────

  private track(osc: OscillatorNode, gain: GainNode): void {
    const entry: ActiveNode = { osc, gain, startedAt: performance.now() };
    this.activeNodes.push(entry);

    // Evict oldest if pool is full
    while (this.activeNodes.length > MAX_ACTIVE_NODES) {
      const oldest = this.activeNodes.shift();
      if (oldest) {
        try {
          oldest.osc.stop();
          oldest.osc.disconnect();
          oldest.gain.disconnect();
        } catch {
          // Already stopped
        }
      }
    }

    // Auto-remove when oscillator ends naturally
    osc.onended = () => {
      const idx = this.activeNodes.indexOf(entry);
      if (idx !== -1) this.activeNodes.splice(idx, 1);
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {
        // Already disconnected
      }
    };
  }

  // ── Primitive helpers ────────────────────────────────────────────────────

  private makeOsc(
    type: OscillatorType,
    freq: number,
    duration: number,
    volumeMul = 1,
    delayStart = 0,
  ): { osc: OscillatorNode; gain: GainNode } | null {
    if (!this.ctx || !this.masterGain) return null;
    const now = this.ctx.currentTime + delayStart;

    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volumeMul, now + 0.005);
    gain.gain.linearRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration + 0.01);

    this.track(osc, gain);
    return { osc, gain };
  }

  private noise(duration: number, volumeMul = 0.3, delayStart = 0): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime + delayStart;
    const sampleRate = this.ctx.sampleRate;
    const samples = Math.floor(sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, samples, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < samples; i++) {
      data[i] = (Math.random() * 2 - 1) * volumeMul;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volumeMul, now);
    gain.gain.linearRampToValueAtTime(0.001, now + duration);

    src.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);
    src.stop(now + duration + 0.01);

    // Track as if it were an oscillator (same pool)
    const fakeOsc = src as unknown as OscillatorNode;
    this.track(fakeOsc, gain);
  }

  // ── Sound implementations ────────────────────────────────────────────────

  private playUIClick(): void {
    // Short mechanical click --- two quick square-wave pops
    this.makeOsc('square', 1200, 0.03, 0.6);
    this.makeOsc('square', 800, 0.02, 0.3, 0.02);
  }

  private playModalOpen(): void {
    // Rubber stamp impact + paper slide
    this.noise(0.06, 0.5);
    this.makeOsc('square', 200, 0.08, 0.4, 0.01);
    this.makeOsc('square', 150, 0.06, 0.3, 0.05);
    // Paper rustle
    this.noise(0.12, 0.15, 0.08);
  }

  private playModalClose(): void {
    // Quick closing snap
    this.makeOsc('square', 600, 0.03, 0.3);
    this.makeOsc('square', 400, 0.04, 0.2, 0.02);
  }

  private playBuildingPlace(): void {
    // Hammer hit --- metallic impact with ringing overtone
    this.noise(0.04, 0.5);
    this.makeOsc('square', 300, 0.1, 0.5, 0.01);
    this.makeOsc('sawtooth', 800, 0.15, 0.2, 0.02);
    // Anvil ring
    this.makeOsc('sine', 2200, 0.2, 0.15, 0.03);
  }

  private playConstructTick(): void {
    // Subtle sawing/scraping
    this.makeOsc('sawtooth', 1800, 0.06, 0.15);
    this.makeOsc('sawtooth', 2200, 0.04, 0.1, 0.03);
  }

  private playBuildingComplete(): void {
    // Soviet fanfare chord --- rising major triad (C-E-G)
    this.makeOsc('square', 262, 0.3, 0.4); // C4
    this.makeOsc('square', 330, 0.25, 0.35, 0.08); // E4
    this.makeOsc('square', 392, 0.3, 0.4, 0.16); // G4
    this.makeOsc('square', 523, 0.35, 0.3, 0.24); // C5 (octave cap)
    // Triumphant noise burst
    this.noise(0.08, 0.15, 0.24);
  }

  private playBuildingDemolish(): void {
    // Crumbling impact --- descending noise + low thud
    this.noise(0.15, 0.5);
    this.makeOsc('square', 120, 0.15, 0.5);
    this.makeOsc('square', 80, 0.2, 0.4, 0.05);
    this.noise(0.2, 0.3, 0.1);
  }

  private playResourceProduce(): void {
    // Subtle chime --- single soft bell tone
    this.makeOsc('sine', 1047, 0.15, 0.2); // C6
    this.makeOsc('sine', 1319, 0.12, 0.1, 0.03); // E6 grace note
  }

  private playStorageFull(): void {
    // Warning tone --- pulsing industrial alarm
    this.makeOsc('square', 440, 0.1, 0.4);
    this.makeOsc('square', 440, 0.1, 0.4, 0.15);
    this.makeOsc('square', 440, 0.1, 0.4, 0.3);
  }

  private playQuotaFulfilled(): void {
    // Triumphant brass --- ascending 5ths (Soviet anthem feel)
    this.makeOsc('sawtooth', 196, 0.2, 0.4); // G3
    this.makeOsc('sawtooth', 262, 0.2, 0.4, 0.1); // C4
    this.makeOsc('sawtooth', 330, 0.2, 0.35, 0.2); // E4
    this.makeOsc('sawtooth', 392, 0.25, 0.4, 0.3); // G4
    this.makeOsc('sawtooth', 523, 0.35, 0.5, 0.4); // C5
    // Chord sustain
    this.makeOsc('sine', 262, 0.4, 0.2, 0.4);
    this.makeOsc('sine', 392, 0.4, 0.2, 0.4);
    this.makeOsc('sine', 523, 0.4, 0.2, 0.4);
  }

  private playQuotaFailed(): void {
    // Somber descending minor chord
    this.makeOsc('sawtooth', 330, 0.3, 0.4); // E4
    this.makeOsc('sawtooth', 277, 0.3, 0.35, 0.12); // C#4
    this.makeOsc('sawtooth', 220, 0.35, 0.4, 0.24); // A3
    this.makeOsc('sawtooth', 165, 0.4, 0.35, 0.36); // E3
    // Low rumble
    this.makeOsc('sine', 80, 0.5, 0.2, 0.3);
  }

  private playFireStart(): void {
    // Crackling burst + woosh
    this.noise(0.3, 0.45);
    this.makeOsc('sawtooth', 600, 0.15, 0.3, 0.02);
    this.makeOsc('sawtooth', 900, 0.1, 0.2, 0.05);
    this.noise(0.2, 0.3, 0.15);
  }

  private playWorkerDeath(): void {
    // Solemn bell toll --- low sine with slow decay
    this.makeOsc('sine', 196, 0.8, 0.4); // G3
    this.makeOsc('sine', 247, 0.6, 0.2, 0.05); // B3 overtone
    this.makeOsc('sine', 131, 1.0, 0.15, 0.1); // C3 undertone
  }

  private playSeasonChange(): void {
    // Wind + crystalline chime
    this.noise(0.4, 0.15);
    this.makeOsc('sine', 880, 0.15, 0.2, 0.05); // A5
    this.makeOsc('sine', 1047, 0.12, 0.15, 0.1); // C6
    this.makeOsc('sine', 1319, 0.1, 0.12, 0.15); // E6
  }

  private playEraTransition(): void {
    // Grand anthem chord --- full Soviet brass ensemble feel
    // Build-up noise
    this.noise(0.1, 0.2);
    // Power chord (C-G-C)
    this.makeOsc('sawtooth', 131, 0.5, 0.5, 0.05); // C3
    this.makeOsc('sawtooth', 196, 0.5, 0.45, 0.05); // G3
    this.makeOsc('sawtooth', 262, 0.5, 0.5, 0.05); // C4
    // Major third entry
    this.makeOsc('sawtooth', 330, 0.4, 0.4, 0.2); // E4
    this.makeOsc('sawtooth', 392, 0.45, 0.4, 0.3); // G4
    // Climax octave
    this.makeOsc('square', 523, 0.5, 0.5, 0.4); // C5
    this.makeOsc('sine', 523, 0.6, 0.3, 0.4); // C5 reinforced
  }

  private playAdvisorMessage(): void {
    // Typewriter click --- two quick mechanical pops
    this.makeOsc('square', 2000, 0.015, 0.3);
    this.makeOsc('square', 1500, 0.015, 0.25, 0.03);
    this.makeOsc('square', 2200, 0.01, 0.2, 0.06);
  }

  private playToastNotification(): void {
    // Short attention tone --- rising two-note
    this.makeOsc('sine', 660, 0.08, 0.3);
    this.makeOsc('sine', 880, 0.1, 0.3, 0.06);
  }

  private playGameOver(): void {
    // Dramatic descending chord --- dissonant resolution
    this.noise(0.15, 0.4);
    this.makeOsc('sawtooth', 440, 0.3, 0.5, 0.05); // A4
    this.makeOsc('sawtooth', 370, 0.35, 0.45, 0.15); // F#4
    this.makeOsc('sawtooth', 294, 0.4, 0.5, 0.25); // D4
    this.makeOsc('sawtooth', 220, 0.5, 0.45, 0.35); // A3
    this.makeOsc('sawtooth', 147, 0.6, 0.5, 0.45); // D3
    // Final low rumble
    this.makeOsc('sine', 55, 0.8, 0.3, 0.5);
    this.noise(0.3, 0.2, 0.6);
  }

  private playAchievement(): void {
    // Star unlock --- bright ascending arpeggio
    this.makeOsc('sine', 523, 0.1, 0.3); // C5
    this.makeOsc('sine', 659, 0.1, 0.3, 0.06); // E5
    this.makeOsc('sine', 784, 0.1, 0.3, 0.12); // G5
    this.makeOsc('sine', 1047, 0.2, 0.35, 0.18); // C6
    // Sparkle
    this.makeOsc('sine', 2093, 0.15, 0.15, 0.25);
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /** Play a named sound effect. No-ops gracefully if AudioContext unavailable. */
  play(name: SFXName): void {
    if (!this.ensureRunning()) return;
    if (this.muted) return;

    // Apply per-effect volume as a temporary master gain adjustment
    const effectVol = EFFECT_VOLUMES[name] ?? 0.4;
    const prevGain = this.masterGain!.gain.value;
    this.masterGain!.gain.value = this.masterVolume * effectVol;

    switch (name) {
      case 'ui_click':
        this.playUIClick();
        break;
      case 'ui_modal_open':
        this.playModalOpen();
        break;
      case 'ui_modal_close':
        this.playModalClose();
        break;
      case 'building_place':
        this.playBuildingPlace();
        break;
      case 'building_construct_tick':
        this.playConstructTick();
        break;
      case 'building_complete':
        this.playBuildingComplete();
        break;
      case 'building_demolish':
        this.playBuildingDemolish();
        break;
      case 'resource_produce':
        this.playResourceProduce();
        break;
      case 'resource_storage_full':
        this.playStorageFull();
        break;
      case 'quota_fulfilled':
        this.playQuotaFulfilled();
        break;
      case 'quota_failed':
        this.playQuotaFailed();
        break;
      case 'fire_start':
        this.playFireStart();
        break;
      case 'worker_death':
        this.playWorkerDeath();
        break;
      case 'season_change':
        this.playSeasonChange();
        break;
      case 'era_transition':
        this.playEraTransition();
        break;
      case 'advisor_message':
        this.playAdvisorMessage();
        break;
      case 'toast_notification':
        this.playToastNotification();
        break;
      case 'game_over':
        this.playGameOver();
        break;
      case 'achievement':
        this.playAchievement();
        break;
    }

    // Restore master gain (effects manage their own envelopes)
    this.masterGain!.gain.value = prevGain || this.masterVolume;
  }

  /** Set master volume (0--1). */
  setVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && !this.muted) {
      this.masterGain.gain.value = this.masterVolume;
    }
  }

  /** Get current master volume. */
  getVolume(): number {
    return this.masterVolume;
  }

  /** Toggle mute. Returns new mute state. */
  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;
    }
    return this.muted;
  }

  /** Set mute state explicitly. */
  setMuted(value: boolean): void {
    this.muted = value;
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;
    }
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Stop all currently playing effects and clean up. */
  stopAll(): void {
    for (const node of this.activeNodes) {
      try {
        node.osc.stop();
        node.osc.disconnect();
        node.gain.disconnect();
      } catch {
        // Already stopped
      }
    }
    this.activeNodes = [];
  }

  /** Clean up everything. */
  dispose(): void {
    this.stopAll();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.masterGain = null;
    SFXManager.instance = null;
  }
}

export default SFXManager;
