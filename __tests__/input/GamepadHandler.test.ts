/**
 * @jest-environment jsdom
 */

import { GamepadHandler } from '../../src/input/GamepadHandler';
import type { InputAction } from '../../src/input/InputManager';
import { InputManager } from '../../src/input/InputManager';

/**
 * Create a mock Gamepad object with specified axes and buttons.
 */
function mockGamepad(axes: number[] = [0, 0, 0, 0], buttons: Array<{ pressed: boolean; value: number }> = []): Gamepad {
  // Ensure at least 14 buttons (standard gamepad)
  const paddedButtons: GamepadButton[] = [];
  for (let i = 0; i < 14; i++) {
    const b = buttons[i];
    paddedButtons.push({
      pressed: b?.pressed ?? false,
      value: b?.value ?? 0,
      touched: false,
    });
  }
  return {
    axes,
    buttons: paddedButtons,
    connected: true,
    id: 'Mock Gamepad',
    index: 0,
    mapping: 'standard',
    timestamp: Date.now(),
    hapticActuators: [],
    vibrationActuator: null,
  } as unknown as Gamepad;
}

/**
 * Helper to set the mock return value for navigator.getGamepads.
 */
let mockPads: (Gamepad | null)[] = [null, null, null, null];

function setMockGamepad(pad: Gamepad | null, index = 0) {
  mockPads = [null, null, null, null];
  mockPads[index] = pad;
}

// Mock requestAnimationFrame for synchronous testing
let rafCallbacks: Array<(time: number) => void> = [];
let rafId = 0;

describe('GamepadHandler', () => {
  let handler: GamepadHandler;
  let received: InputAction[];
  let unsub: () => void;
  let origGetGamepads: typeof navigator.getGamepads;
  let origRaf: typeof requestAnimationFrame;
  let origCaf: typeof cancelAnimationFrame;

  beforeEach(() => {
    InputManager.resetInstance();
    received = [];
    unsub = InputManager.getInstance().subscribe((a) => received.push(a));

    // Mock navigator.getGamepads
    origGetGamepads = navigator.getGamepads?.bind(navigator);
    Object.defineProperty(navigator, 'getGamepads', {
      value: () => mockPads,
      writable: true,
      configurable: true,
    });

    // Mock requestAnimationFrame / cancelAnimationFrame
    rafCallbacks = [];
    rafId = 0;
    origRaf = globalThis.requestAnimationFrame;
    origCaf = globalThis.cancelAnimationFrame;

    globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
      rafId++;
      rafCallbacks.push(cb as (time: number) => void);
      return rafId;
    };
    globalThis.cancelAnimationFrame = (_id: number): void => {
      rafCallbacks = [];
    };

    mockPads = [null, null, null, null];
    handler = new GamepadHandler();
  });

  afterEach(() => {
    handler.detach();
    unsub();
    InputManager.resetInstance();
    Object.defineProperty(navigator, 'getGamepads', {
      value: origGetGamepads,
      writable: true,
      configurable: true,
    });
    globalThis.requestAnimationFrame = origRaf;
    globalThis.cancelAnimationFrame = origCaf;
  });

  /** Pump one frame of the rAF loop. */
  function tick() {
    const cbs = [...rafCallbacks];
    rafCallbacks = [];
    for (const cb of cbs) {
      cb(performance.now());
    }
  }

  describe('axis mapping', () => {
    it('maps left stick to camera_pan_x/y with dead zone', () => {
      const pad = mockGamepad([0.5, -0.8, 0, 0]);
      setMockGamepad(pad);

      handler.attach();
      // Simulate gamepadconnected
      window.dispatchEvent(new Event('gamepadconnected'));
      tick(); // start polling
      tick(); // first poll

      const mgr = InputManager.getInstance();
      expect(mgr.getState().axes.camera_pan_x).toBe(0.5);
      expect(mgr.getState().axes.camera_pan_y).toBe(-0.8);
    });

    it('applies dead zone (values below 0.15 become 0)', () => {
      const pad = mockGamepad([0.1, -0.05, 0.14, 0]);
      setMockGamepad(pad);

      handler.attach();
      window.dispatchEvent(new Event('gamepadconnected'));
      tick();
      tick();

      const mgr = InputManager.getInstance();
      expect(mgr.getState().axes.camera_pan_x).toBe(0);
      expect(mgr.getState().axes.camera_pan_y).toBe(0);
      expect(mgr.getState().axes.camera_rotate).toBe(0);
    });

    it('maps right stick to camera_rotate and camera_tilt', () => {
      const pad = mockGamepad([0, 0, 0.7, -0.4]);
      setMockGamepad(pad);

      handler.attach();
      window.dispatchEvent(new Event('gamepadconnected'));
      tick();
      tick();

      const mgr = InputManager.getInstance();
      expect(mgr.getState().axes.camera_rotate).toBe(0.7);
      expect(mgr.getState().axes.camera_tilt).toBe(-0.4);
    });

    it('maps LT/RT to camera_zoom', () => {
      const buttons: Array<{ pressed: boolean; value: number }> = [];
      for (let i = 0; i < 14; i++) buttons.push({ pressed: false, value: 0 });
      buttons[6] = { pressed: true, value: 0.8 }; // LT
      const pad = mockGamepad([0, 0, 0, 0], buttons);
      setMockGamepad(pad);

      handler.attach();
      window.dispatchEvent(new Event('gamepadconnected'));
      tick();
      tick();

      const mgr = InputManager.getInstance();
      expect(mgr.getState().axes.camera_zoom).toBe(1); // LT = zoom out
    });
  });

  describe('discrete buttons', () => {
    it('dispatches confirm on A button press', () => {
      const buttons: Array<{ pressed: boolean; value: number }> = [];
      for (let i = 0; i < 14; i++) buttons.push({ pressed: false, value: 0 });

      // Frame 1: no buttons
      const pad1 = mockGamepad([0, 0, 0, 0], buttons);
      setMockGamepad(pad1);

      handler.attach();
      window.dispatchEvent(new Event('gamepadconnected'));
      tick();
      tick(); // read initial state

      // Frame 2: press A
      const buttons2 = buttons.map((b) => ({ ...b }));
      buttons2[0] = { pressed: true, value: 1 };
      setMockGamepad(mockGamepad([0, 0, 0, 0], buttons2));
      tick();

      expect(received).toContain('confirm');
    });

    it('dispatches deselect on B button press', () => {
      const buttons: Array<{ pressed: boolean; value: number }> = [];
      for (let i = 0; i < 14; i++) buttons.push({ pressed: false, value: 0 });

      setMockGamepad(mockGamepad([0, 0, 0, 0], buttons));
      handler.attach();
      window.dispatchEvent(new Event('gamepadconnected'));
      tick();
      tick();

      const buttons2 = buttons.map((b) => ({ ...b }));
      buttons2[1] = { pressed: true, value: 1 };
      setMockGamepad(mockGamepad([0, 0, 0, 0], buttons2));
      tick();

      expect(received).toContain('deselect');
    });

    it('dispatches pause_toggle on Start press', () => {
      const buttons: Array<{ pressed: boolean; value: number }> = [];
      for (let i = 0; i < 14; i++) buttons.push({ pressed: false, value: 0 });

      setMockGamepad(mockGamepad([0, 0, 0, 0], buttons));
      handler.attach();
      window.dispatchEvent(new Event('gamepadconnected'));
      tick();
      tick();

      const buttons2 = buttons.map((b) => ({ ...b }));
      buttons2[9] = { pressed: true, value: 1 };
      setMockGamepad(mockGamepad([0, 0, 0, 0], buttons2));
      tick();

      expect(received).toContain('pause_toggle');
    });

    it('only fires on press edge, not hold', () => {
      const buttons: Array<{ pressed: boolean; value: number }> = [];
      for (let i = 0; i < 14; i++) buttons.push({ pressed: false, value: 0 });

      setMockGamepad(mockGamepad([0, 0, 0, 0], buttons));
      handler.attach();
      window.dispatchEvent(new Event('gamepadconnected'));
      tick();
      tick();

      // Press A
      const buttons2 = buttons.map((b) => ({ ...b }));
      buttons2[0] = { pressed: true, value: 1 };
      setMockGamepad(mockGamepad([0, 0, 0, 0], buttons2));
      tick();

      const countAfterPress = received.filter((a) => a === 'confirm').length;
      expect(countAfterPress).toBe(1);

      // Hold A (same state)
      tick();
      const countAfterHold = received.filter((a) => a === 'confirm').length;
      expect(countAfterHold).toBe(1); // no duplicate
    });
  });

  describe('D-pad', () => {
    it('does not cycle placement tools', () => {
      const buttons: Array<{ pressed: boolean; value: number }> = [];
      for (let i = 0; i < 14; i++) buttons.push({ pressed: false, value: 0 });

      setMockGamepad(mockGamepad([0, 0, 0, 0], buttons));
      handler.attach();
      window.dispatchEvent(new Event('gamepadconnected'));
      tick();
      tick();

      // Press D-pad up
      const buttons2 = buttons.map((b) => ({ ...b }));
      buttons2[12] = { pressed: true, value: 1 };
      setMockGamepad(mockGamepad([0, 0, 0, 0], buttons2));
      tick();

      expect(received).not.toContain('bulldoze_mode');
      expect(received).not.toContain('confirm');
      expect(received).not.toContain('deselect');
    });
  });

  describe('attach / detach', () => {
    it('stops polling on detach', () => {
      handler.attach();
      handler.detach();

      const mgr = InputManager.getInstance();
      expect(mgr.getState().axes.camera_pan_x).toBe(0);
    });

    it('starts polling if gamepad already connected on attach', () => {
      setMockGamepad(mockGamepad([0.5, 0, 0, 0]));
      handler.attach();
      tick();
      tick();

      const mgr = InputManager.getInstance();
      expect(mgr.getState().axes.camera_pan_x).toBe(0.5);
    });
  });
});
