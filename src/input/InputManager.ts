/**
 * InputManager -- singleton input event bus for keyboard, gamepad, and touch.
 * Decouples input sources from game actions.
 */

// Discrete input actions (one-shot events)
export type InputAction =
  | 'tool_1'
  | 'tool_2'
  | 'tool_3'
  | 'tool_4'
  | 'tool_5'
  | 'tool_6'
  | 'tool_7'
  | 'tool_8'
  | 'tool_9'
  | 'deselect'
  | 'pause_toggle'
  | 'speed_cycle'
  | 'camera_pan_up'
  | 'camera_pan_down'
  | 'camera_pan_left'
  | 'camera_pan_right'
  | 'camera_rotate_left'
  | 'camera_rotate_right'
  | 'camera_zoom_in'
  | 'camera_zoom_out'
  | 'minimap_toggle'
  | 'lens_cycle'
  | 'bulldoze_mode'
  | 'help'
  | 'confirm'
  | 'cancel';

// Continuous axes (analog values -1..1)
export type ContinuousAxis = 'camera_pan_x' | 'camera_pan_y' | 'camera_rotate' | 'camera_tilt' | 'camera_zoom';

export type InputListener = (action: InputAction) => void;

export interface ContinuousState {
  axes: Record<ContinuousAxis, number>;
}

export type StateListener = (state: ContinuousState) => void;

const ALL_AXES: ContinuousAxis[] = ['camera_pan_x', 'camera_pan_y', 'camera_rotate', 'camera_tilt', 'camera_zoom'];

function createZeroAxes(): Record<ContinuousAxis, number> {
  const axes = {} as Record<ContinuousAxis, number>;
  for (const a of ALL_AXES) {
    axes[a] = 0;
  }
  return axes;
}

/**
 * Singleton input event bus. Handlers (keyboard, gamepad, touch) dispatch
 * actions and update continuous axes. Consumers subscribe to receive them.
 */
export class InputManager {
  private static _instance: InputManager | null = null;

  private readonly _listeners = new Set<InputListener>();
  private readonly _stateListeners = new Set<StateListener>();
  private _state: ContinuousState = { axes: createZeroAxes() };
  private _attached = false;

  private constructor() {}

  static getInstance(): InputManager {
    if (!InputManager._instance) {
      InputManager._instance = new InputManager();
    }
    return InputManager._instance;
  }

  /** Reset the singleton (for testing). */
  static resetInstance(): void {
    if (InputManager._instance) {
      InputManager._instance.detach();
      InputManager._instance._listeners.clear();
      InputManager._instance._stateListeners.clear();
      InputManager._instance._state = { axes: createZeroAxes() };
    }
    InputManager._instance = null;
  }

  /** Subscribe to discrete input actions. Returns an unsubscribe function. */
  subscribe(listener: InputListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  /** Subscribe to continuous state changes. Returns an unsubscribe function. */
  subscribeState(listener: StateListener): () => void {
    this._stateListeners.add(listener);
    return () => {
      this._stateListeners.delete(listener);
    };
  }

  /** Dispatch a discrete input action to all listeners. */
  dispatch(action: InputAction): void {
    for (const listener of this._listeners) {
      listener(action);
    }
  }

  /** Update a continuous axis value and notify state listeners. */
  updateContinuous(axis: ContinuousAxis, value: number): void {
    const clamped = Math.max(-1, Math.min(1, value));
    if (this._state.axes[axis] === clamped) return;
    this._state = {
      axes: { ...this._state.axes, [axis]: clamped },
    };
    for (const listener of this._stateListeners) {
      listener(this._state);
    }
  }

  /** Mark the manager as attached (handlers are active). */
  attach(): void {
    this._attached = true;
  }

  /** Mark the manager as detached and zero all axes. */
  detach(): void {
    this._attached = false;
    const hadNonZero = ALL_AXES.some((a) => this._state.axes[a] !== 0);
    if (hadNonZero) {
      this._state = { axes: createZeroAxes() };
      for (const listener of this._stateListeners) {
        listener(this._state);
      }
    }
  }

  /** Get the current continuous state snapshot. */
  getState(): ContinuousState {
    return this._state;
  }

  /** Whether the manager is currently attached (handlers active). */
  isAttached(): boolean {
    return this._attached;
  }
}
