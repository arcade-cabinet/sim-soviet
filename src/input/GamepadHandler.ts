/**
 * GamepadHandler -- polls navigator.getGamepads() via requestAnimationFrame
 * and maps standard gamepad inputs to InputManager actions/axes.
 *
 * Standard Gamepad mapping:
 *  - Left stick X/Y  -> camera_pan_x / camera_pan_y (0.15 dead zone)
 *  - Right stick X    -> camera_rotate (0.15 dead zone)
 *  - Right stick Y    -> camera_tilt (0.15 dead zone)
 *  - LT (button 6)   -> camera_zoom = 1 (zoom out)
 *  - RT (button 7)    -> camera_zoom = -1 (zoom in)
 *  - A  (button 0)    -> confirm
 *  - B  (button 1)    -> cancel / deselect
 *  - Start (9)        -> pause_toggle
 *  - Select (8)       -> minimap_toggle
 */

import type { InputAction } from './InputManager';
import { InputManager } from './InputManager';

const DEAD_ZONE = 0.15;

/** Button indices that fire discrete actions (only on press, not hold). */
interface ButtonAction {
  action: InputAction;
}

const BUTTON_MAP: Record<number, ButtonAction> = {
  0: { action: 'confirm' },
  1: { action: 'deselect' },
  8: { action: 'minimap_toggle' },
  9: { action: 'pause_toggle' },
};

function applyDeadZone(value: number): number {
  return Math.abs(value) < DEAD_ZONE ? 0 : value;
}

/**
 * Polls connected gamepads each frame and maps their inputs to
 * InputManager actions and continuous axes.
 */
export class GamepadHandler {
  private readonly _input: InputManager;
  private _rafId: number | null = null;
  private _attached = false;

  /** Track previous frame button states for edge detection (press only). */
  private _prevButtons: boolean[] = [];

  private _onConnect: (() => void) | null = null;
  private _onDisconnect: (() => void) | null = null;

  constructor() {
    this._input = InputManager.getInstance();
  }

  attach(): void {
    if (this._attached) return;
    this._attached = true;

    this._onConnect = () => {
      if (!this._rafId) {
        this._startPolling();
      }
    };

    this._onDisconnect = () => {
      // Check if any gamepads remain
      const pads = navigator.getGamepads?.();
      if (!pads) return;
      const anyConnected = Array.from(pads).some((p) => p !== null);
      if (!anyConnected) {
        this._stopPolling();
      }
    };

    window.addEventListener('gamepadconnected', this._onConnect);
    window.addEventListener('gamepaddisconnected', this._onDisconnect);

    // If a gamepad is already connected, start polling immediately
    const pads = navigator.getGamepads?.();
    if (pads) {
      const anyConnected = Array.from(pads).some((p) => p !== null);
      if (anyConnected) {
        this._startPolling();
      }
    }
  }

  detach(): void {
    if (!this._attached) return;
    this._attached = false;

    if (this._onConnect) {
      window.removeEventListener('gamepadconnected', this._onConnect);
      this._onConnect = null;
    }
    if (this._onDisconnect) {
      window.removeEventListener('gamepaddisconnected', this._onDisconnect);
      this._onDisconnect = null;
    }

    this._stopPolling();
    this._prevButtons = [];
  }

  isAttached(): boolean {
    return this._attached;
  }

  private _startPolling(): void {
    if (this._rafId) return;
    const poll = () => {
      this._pollGamepad();
      this._rafId = requestAnimationFrame(poll);
    };
    this._rafId = requestAnimationFrame(poll);
  }

  private _stopPolling(): void {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    // Zero all axes when stopping
    this._input.updateContinuous('camera_pan_x', 0);
    this._input.updateContinuous('camera_pan_y', 0);
    this._input.updateContinuous('camera_rotate', 0);
    this._input.updateContinuous('camera_tilt', 0);
    this._input.updateContinuous('camera_zoom', 0);
  }

  private _pollGamepad(): void {
    const pads = navigator.getGamepads?.();
    if (!pads) return;

    // Use the first connected gamepad
    let pad: Gamepad | null = null;
    for (const p of pads) {
      if (p) {
        pad = p;
        break;
      }
    }
    if (!pad) return;

    // -- Continuous axes --
    const lx = applyDeadZone(pad.axes[0] ?? 0);
    const ly = applyDeadZone(pad.axes[1] ?? 0);
    const rx = applyDeadZone(pad.axes[2] ?? 0);
    const ry = applyDeadZone(pad.axes[3] ?? 0);

    this._input.updateContinuous('camera_pan_x', lx);
    this._input.updateContinuous('camera_pan_y', ly);
    this._input.updateContinuous('camera_rotate', rx);
    this._input.updateContinuous('camera_tilt', ry);

    // Triggers -> zoom
    const lt = pad.buttons[6]?.value ?? 0;
    const rt = pad.buttons[7]?.value ?? 0;
    const zoomValue = lt > 0.1 ? 1 : rt > 0.1 ? -1 : 0;
    this._input.updateContinuous('camera_zoom', zoomValue);

    // -- Discrete buttons (edge-detect: fire on press, not hold) --
    const currButtons = pad.buttons.map((b) => b.pressed);

    for (const [btnIdxStr, btnAction] of Object.entries(BUTTON_MAP)) {
      const btnIdx = Number(btnIdxStr);
      const pressed = currButtons[btnIdx] ?? false;
      const wasPressed = this._prevButtons[btnIdx] ?? false;
      if (pressed && !wasPressed) {
        this._input.dispatch(btnAction.action);
      }
    }

    this._prevButtons = currButtons;
  }
}
