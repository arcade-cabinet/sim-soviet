/**
 * Procedural Sound Generator using Tone.js
 * Creates Soviet-themed sound effects procedurally
 */

import * as Tone from 'tone';

let initialized = false;

/** Handle for stopping a procedural ambient loop. */
export interface ProceduralAmbient {
  stop: () => void;
}

export async function initialize(): Promise<void> {
  if (!initialized) {
    await Tone.start();
    initialized = true;
  }
}

/**
 * Building placement sound - industrial mechanical click
 */
export function playBuildSound(): void {
  const synth = new Tone.MetalSynth({
    envelope: {
      attack: 0.001,
      decay: 0.1,
      release: 0.01,
    },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 4000,
    octaves: 1.5,
  }).toDestination();

  synth.triggerAttackRelease('C2', '0.05');
  setTimeout(() => synth.dispose(), 200);
}

/**
 * Demolition sound - heavy industrial crash
 */
export function playDestroySound(): void {
  const noise = new Tone.Noise('brown').toDestination();
  const envelope = new Tone.AmplitudeEnvelope({
    attack: 0.01,
    decay: 0.2,
    sustain: 0,
    release: 0.3,
  }).toDestination();

  noise.connect(envelope);
  noise.start();
  envelope.triggerAttackRelease('0.3');

  setTimeout(() => {
    noise.stop();
    noise.dispose();
    envelope.dispose();
  }, 500);
}

/**
 * Notification sound - typewriter-style mechanical beep
 */
export function playNotificationSound(): void {
  const synth = new Tone.Synth({
    oscillator: {
      type: 'square',
    },
    envelope: {
      attack: 0.005,
      decay: 0.1,
      sustain: 0.3,
      release: 0.1,
    },
  }).toDestination();

  synth.triggerAttackRelease('C5', '0.1');
  setTimeout(() => synth.dispose(), 300);
}

/**
 * Coin/money sound - metallic chime
 */
export function playCoinSound(): void {
  const synth = new Tone.FMSynth({
    harmonicity: 8,
    modulationIndex: 2,
    oscillator: {
      type: 'sine',
    },
    envelope: {
      attack: 0.001,
      decay: 0.2,
      sustain: 0,
      release: 0.2,
    },
    modulation: {
      type: 'square',
    },
    modulationEnvelope: {
      attack: 0.002,
      decay: 0.2,
      sustain: 0,
      release: 0.2,
    },
  }).toDestination();

  synth.triggerAttackRelease('C6', '0.15');
  setTimeout(() => synth.triggerAttackRelease('E6', '0.1'), 80);
  setTimeout(() => synth.dispose(), 400);
}

/**
 * Siren sound - air-raid siren with frequency sweep (KGB/event/critical alerts)
 */
export function playSirenSound(): void {
  const osc = new Tone.Oscillator({ type: 'sine', frequency: 400 }).toDestination();
  const lfo = new Tone.LFO({ frequency: '2', min: 400, max: 600 });
  lfo.connect(osc.frequency);
  osc.volume.value = -8;

  osc.start();
  lfo.start();

  setTimeout(() => {
    osc.stop();
    lfo.stop();
    osc.dispose();
    lfo.dispose();
  }, 1200);
}

/**
 * Queue shuffle sound - bread line crowd shuffling
 */
export function playQueueShuffleSound(): void {
  const noise = new Tone.Noise('pink').toDestination();
  const filter = new Tone.Filter(1200, 'bandpass').toDestination();
  noise.connect(filter);
  noise.volume.value = -15;

  noise.start();

  setTimeout(() => {
    noise.stop();
    noise.dispose();
    filter.dispose();
  }, 500);
}

/**
 * Collapse sound - building collapse, heavy rumble
 */
export function playCollapseSound(): void {
  const noise = new Tone.Noise('brown').toDestination();
  const filter = new Tone.Filter(300, 'lowpass').toDestination();
  const envelope = new Tone.AmplitudeEnvelope({
    attack: 0.02,
    decay: 0.4,
    sustain: 0.1,
    release: 0.5,
  }).toDestination();

  noise.connect(filter);
  filter.connect(envelope);
  noise.start();
  envelope.triggerAttackRelease('0.8');

  setTimeout(() => {
    noise.stop();
    noise.dispose();
    filter.dispose();
    envelope.dispose();
  }, 1000);
}

/**
 * Paper shuffle sound - bureaucratic paperwork rustle
 */
export function playPaperShuffleSound(): void {
  const noise = new Tone.Noise('white').toDestination();
  const filter = new Tone.Filter(4000, 'highpass').toDestination();
  noise.connect(filter);
  noise.volume.value = -20;

  noise.start();

  setTimeout(() => {
    noise.stop();
    noise.dispose();
    filter.dispose();
  }, 300);
}

/**
 * Fanfare sound - achievement/victory chord progression (C maj → G maj → C maj)
 */
export function playFanfareSound(): void {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: {
      attack: 0.02,
      decay: 0.3,
      sustain: 0.2,
      release: 0.4,
    },
  }).toDestination();
  synth.volume.value = -6;

  // C major chord
  synth.triggerAttackRelease(['C4', 'E4', 'G4'], '0.3');
  // G major chord
  setTimeout(() => synth.triggerAttackRelease(['G3', 'B3', 'D4'], '0.3'), 350);
  // C major (higher) resolution
  setTimeout(() => synth.triggerAttackRelease(['C4', 'E4', 'G4', 'C5'], '0.3'), 700);

  setTimeout(() => synth.dispose(), 1200);
}

/**
 * Warning sound - two quick beeps (D4 triangle wave)
 */
export function playWarningSound(): void {
  const synth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: {
      attack: 0.005,
      decay: 0.08,
      sustain: 0.3,
      release: 0.05,
    },
  }).toDestination();
  synth.volume.value = -6;

  synth.triggerAttackRelease('D4', '0.08');
  setTimeout(() => synth.triggerAttackRelease('D4', '0.08'), 120);

  setTimeout(() => synth.dispose(), 400);
}

/**
 * Wind ambient sound — returns handle for clean stop.
 */
export function createWindAmbient(): ProceduralAmbient | null {
  try {
    const filter = new Tone.Filter(800, 'lowpass').toDestination();
    const noise = new Tone.Noise('pink');
    noise.connect(filter);
    const lfo = new Tone.LFO({ frequency: '0.1', min: 400, max: 1200 });
    lfo.connect(filter.frequency);

    noise.start();
    lfo.start();

    return {
      stop() {
        noise.stop();
        lfo.stop();
        noise.dispose();
        filter.dispose();
        lfo.dispose();
      },
    };
  } catch (error) {
    console.error('Failed to create wind ambient:', error);
    return null;
  }
}

/**
 * Industrial machinery ambient — returns handle for clean stop.
 */
export function createMachineryAmbient(): ProceduralAmbient | null {
  try {
    const filter = new Tone.Filter(200, 'lowpass').toDestination();
    const noise = new Tone.Noise('brown');
    noise.connect(filter);
    noise.volume.value = -20;
    const lfo = new Tone.LFO({ frequency: '0.5', min: 150, max: 300 });
    lfo.connect(filter.frequency);

    noise.start();
    lfo.start();

    return {
      stop() {
        noise.stop();
        lfo.stop();
        noise.dispose();
        filter.dispose();
        lfo.dispose();
      },
    };
  } catch (error) {
    console.error('Failed to create machinery ambient:', error);
    return null;
  }
}

/**
 * Propaganda radio static ambient — faint crackle with LFO sweep.
 */
export function createRadioStaticAmbient(): ProceduralAmbient | null {
  try {
    const filter = new Tone.Filter(3000, 'highpass').toDestination();
    const noise = new Tone.Noise('white');
    noise.connect(filter);
    noise.volume.value = -25;
    const lfo = new Tone.LFO({ frequency: '0.3', min: 2500, max: 4500 });
    lfo.connect(filter.frequency);

    noise.start();
    lfo.start();

    return {
      stop() {
        noise.stop();
        lfo.stop();
        noise.dispose();
        filter.dispose();
        lfo.dispose();
      },
    };
  } catch (error) {
    console.error('Failed to create radio static ambient:', error);
    return null;
  }
}

/**
 * Dispose all Tone.js resources
 */
export function dispose(): void {
  Tone.Transport.stop();
  Tone.Transport.cancel();
  initialized = false;
}
