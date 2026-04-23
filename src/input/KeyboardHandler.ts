/**
 * KeyboardHandler -- maps keyboard events to InputManager actions and
 * continuous axes. Attaches to window keydown/keyup.
 */

import type { ContinuousAxis, InputAction } from './InputManager';
import { InputManager } from './InputManager';

/** Tags whose focus should suppress keyboard shortcuts. */
const SUPPRESSED_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * Key-to-action binding. For keys that drive continuous axes when held,
 * `axis` and `axisValue` define the axis and its target value on keydown.
 */
interface KeyBinding {
  action: InputAction;
  axis?: ContinuousAxis;
  axisValue?: number;
}

/** Default keyboard bindings. */
const KEY_MAP: Record<string, KeyBinding> = {
  // General actions
  Escape: { action: 'deselect' },
  ' ': { action: 'pause_toggle' },
  r: { action: 'speed_cycle' },
  R: { action: 'speed_cycle' },

  // Camera pan (WASD + arrows) -- also drive continuous axes
  w: { action: 'camera_pan_up', axis: 'camera_pan_y', axisValue: -1 },
  W: { action: 'camera_pan_up', axis: 'camera_pan_y', axisValue: -1 },
  ArrowUp: { action: 'camera_pan_up', axis: 'camera_pan_y', axisValue: -1 },
  s: { action: 'camera_pan_down', axis: 'camera_pan_y', axisValue: 1 },
  S: { action: 'camera_pan_down', axis: 'camera_pan_y', axisValue: 1 },
  ArrowDown: { action: 'camera_pan_down', axis: 'camera_pan_y', axisValue: 1 },
  a: { action: 'camera_pan_left', axis: 'camera_pan_x', axisValue: -1 },
  A: { action: 'camera_pan_left', axis: 'camera_pan_x', axisValue: -1 },
  ArrowLeft: { action: 'camera_pan_left', axis: 'camera_pan_x', axisValue: -1 },
  d: { action: 'camera_pan_right', axis: 'camera_pan_x', axisValue: 1 },
  D: { action: 'camera_pan_right', axis: 'camera_pan_x', axisValue: 1 },
  ArrowRight: { action: 'camera_pan_right', axis: 'camera_pan_x', axisValue: 1 },

  // Camera rotation
  q: { action: 'camera_rotate_left', axis: 'camera_rotate', axisValue: -1 },
  Q: { action: 'camera_rotate_left', axis: 'camera_rotate', axisValue: -1 },
  e: { action: 'camera_rotate_right', axis: 'camera_rotate', axisValue: 1 },
  E: { action: 'camera_rotate_right', axis: 'camera_rotate', axisValue: 1 },

  // Camera zoom
  '+': { action: 'camera_zoom_in', axis: 'camera_zoom', axisValue: -1 },
  '=': { action: 'camera_zoom_in', axis: 'camera_zoom', axisValue: -1 },
  '-': { action: 'camera_zoom_out', axis: 'camera_zoom', axisValue: 1 },

  // Toggles
  m: { action: 'minimap_toggle' },
  M: { action: 'minimap_toggle' },
  l: { action: 'lens_cycle' },
  L: { action: 'lens_cycle' },

  // Bulldoze
  Delete: { action: 'bulldoze_mode' },
  Backspace: { action: 'bulldoze_mode' },

  // Help
  F1: { action: 'help' },
};

/**
 * Reverse mapping: for each axis, the set of keys that currently hold it.
 * When no keys are holding an axis, it resets to 0.
 */
type HeldKeys = Map<ContinuousAxis, Set<string>>;

/**
 * Attaches to window keydown/keyup. Dispatches discrete actions on keydown
 * and drives continuous axes while keys are held.
 */
export class KeyboardHandler {
  private readonly _input: InputManager;
  private readonly _held: HeldKeys = new Map();
  private _onKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private _onKeyUp: ((e: KeyboardEvent) => void) | null = null;
  private _attached = false;

  constructor() {
    this._input = InputManager.getInstance();
  }

  attach(): void {
    if (this._attached) return;
    this._attached = true;

    this._onKeyDown = (e: KeyboardEvent) => {
      // Suppress when typing in form fields
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag && SUPPRESSED_TAGS.has(tag)) return;

      const binding = KEY_MAP[e.key];
      if (!binding) return;

      // Prevent default for handled keys (e.g. space scrolling, F1 help)
      e.preventDefault();

      // Dispatch the discrete action
      this._input.dispatch(binding.action);

      // Drive continuous axis if applicable
      if (binding.axis != null && binding.axisValue != null) {
        let held = this._held.get(binding.axis);
        if (!held) {
          held = new Set();
          this._held.set(binding.axis, held);
        }
        held.add(e.key);
        this._input.updateContinuous(binding.axis, binding.axisValue);
      }
    };

    this._onKeyUp = (e: KeyboardEvent) => {
      const binding = KEY_MAP[e.key];
      if (!binding || binding.axis == null) return;

      const held = this._held.get(binding.axis);
      if (held) {
        held.delete(e.key);
        if (held.size === 0) {
          this._input.updateContinuous(binding.axis, 0);
        }
      }
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  detach(): void {
    if (!this._attached) return;
    this._attached = false;

    if (this._onKeyDown) {
      window.removeEventListener('keydown', this._onKeyDown);
      this._onKeyDown = null;
    }
    if (this._onKeyUp) {
      window.removeEventListener('keyup', this._onKeyUp);
      this._onKeyUp = null;
    }

    // Reset all held axes
    for (const [axis] of this._held) {
      this._input.updateContinuous(axis, 0);
    }
    this._held.clear();
  }

  isAttached(): boolean {
    return this._attached;
  }
}
