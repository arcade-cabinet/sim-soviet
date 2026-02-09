/**
 * Procedural Sound Generator using Tone.js
 * Creates Soviet-themed sound effects procedurally
 */

import * as Tone from 'tone';

let initialized = false;

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
 * Wind ambient sound
 */
export function createWindAmbient(): Tone.Player | null {
  try {
    const noise = new Tone.Noise('pink').toDestination();
    const filter = new Tone.Filter(800, 'lowpass').toDestination();
    const lfo = new Tone.LFO('0.1', 400, 1200);

    noise.connect(filter);
    lfo.connect(filter.frequency);

    noise.start();
    lfo.start();

    return null; // Return reference to stop later
  } catch (error) {
    console.error('Failed to create wind ambient:', error);
    return null;
  }
}

/**
 * Industrial machinery ambient
 */
export function createMachineryAmbient(): Tone.Player | null {
  try {
    const noise = new Tone.Noise('brown').toDestination();
    const filter = new Tone.Filter(200, 'lowpass').toDestination();
    const lfo = new Tone.LFO('0.5', 150, 300);

    noise.connect(filter);
    lfo.connect(filter.frequency);
    noise.volume.value = -20; // Quieter

    noise.start();
    lfo.start();

    return null; // Return reference to stop later
  } catch (error) {
    console.error('Failed to create machinery ambient:', error);
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
