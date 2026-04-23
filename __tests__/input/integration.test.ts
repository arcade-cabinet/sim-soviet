/**
 * @jest-environment jsdom
 */

/**
 * Integration tests for the input system pipeline:
 * Keyboard/Gamepad -> InputManager -> game state mutations.
 */

import type { InputAction } from '../../src/input/InputManager';
import { InputManager } from '../../src/input/InputManager';
import { KeyboardHandler } from '../../src/input/KeyboardHandler';

// We need to mock the gameStore module since it depends on ECS archetypes
// that are not initialized in tests.
const mockSelectTool = jest.fn();
const mockTogglePause = jest.fn();
const mockCycleGameSpeed = jest.fn();
const mockToggleMinimap = jest.fn();
const mockCycleLens = jest.fn();

jest.mock('../../src/stores/gameStore', () => ({
  selectTool: (...args: unknown[]) => mockSelectTool(...args),
  togglePause: (...args: unknown[]) => mockTogglePause(...args),
  cycleGameSpeed: (...args: unknown[]) => mockCycleGameSpeed(...args),
  toggleMinimap: (...args: unknown[]) => mockToggleMinimap(...args),
  cycleLens: (...args: unknown[]) => mockCycleLens(...args),
}));

function fireKey(key: string, type: 'keydown' | 'keyup' = 'keydown') {
  const event = new KeyboardEvent(type, { key, bubbles: true });
  window.dispatchEvent(event);
}

describe('Input Integration', () => {
  let keyboard: KeyboardHandler;

  beforeEach(() => {
    InputManager.resetInstance();
    keyboard = new KeyboardHandler();
    jest.clearAllMocks();

    // Wire up the action handler the same way useInputManager does
    const mgr = InputManager.getInstance();
    mgr.attach();

    mgr.subscribe((action: InputAction) => {
      switch (action) {
        case 'deselect':
          mockSelectTool('none');
          break;
        case 'pause_toggle':
          mockTogglePause();
          break;
        case 'speed_cycle':
          mockCycleGameSpeed();
          break;
        case 'minimap_toggle':
          mockToggleMinimap();
          break;
        case 'lens_cycle':
          mockCycleLens();
          break;
        case 'bulldoze_mode':
          mockSelectTool('bulldoze');
          break;
      }
    });

    keyboard.attach();
  });

  afterEach(() => {
    keyboard.detach();
    InputManager.resetInstance();
  });

  it('keyboard "1" does not select a placement tool', () => {
    fireKey('1');
    expect(mockSelectTool).not.toHaveBeenCalled();
  });

  it('keyboard Escape deselects the tool', () => {
    fireKey('Escape');
    expect(mockSelectTool).toHaveBeenCalledWith('none');
  });

  it('keyboard Space toggles pause', () => {
    fireKey(' ');
    expect(mockTogglePause).toHaveBeenCalledTimes(1);
  });

  it('keyboard "r" cycles game speed', () => {
    fireKey('r');
    expect(mockCycleGameSpeed).toHaveBeenCalledTimes(1);
  });

  it('keyboard "m" toggles minimap', () => {
    fireKey('m');
    expect(mockToggleMinimap).toHaveBeenCalledTimes(1);
  });

  it('keyboard "l" cycles lens mode', () => {
    fireKey('l');
    expect(mockCycleLens).toHaveBeenCalledTimes(1);
  });

  it('keyboard Delete enters bulldoze mode', () => {
    fireKey('Delete');
    expect(mockSelectTool).toHaveBeenCalledWith('bulldoze');
  });

  it('keyboard Backspace enters bulldoze mode', () => {
    fireKey('Backspace');
    expect(mockSelectTool).toHaveBeenCalledWith('bulldoze');
  });

  it('gamepad axis updates continuous state', () => {
    const mgr = InputManager.getInstance();

    // Simulate what GamepadHandler does internally
    mgr.updateContinuous('camera_pan_x', 0.7);
    mgr.updateContinuous('camera_pan_y', -0.5);

    const state = mgr.getState();
    expect(state.axes.camera_pan_x).toBe(0.7);
    expect(state.axes.camera_pan_y).toBe(-0.5);
  });

  it('input suppressed when activeElement is an INPUT', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    fireKey('1');
    expect(mockSelectTool).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  it('input suppressed when activeElement is a TEXTAREA', () => {
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    ta.focus();

    fireKey(' ');
    expect(mockTogglePause).not.toHaveBeenCalled();

    document.body.removeChild(ta);
  });

  it('keyboard handler detaches cleanly', () => {
    keyboard.detach();

    fireKey('1');
    expect(mockSelectTool).not.toHaveBeenCalled();

    // Verify continuous axes are zeroed after detach
    const mgr = InputManager.getInstance();
    expect(mgr.getState().axes.camera_pan_x).toBe(0);
    expect(mgr.getState().axes.camera_pan_y).toBe(0);
  });

  it('continuous axes reset when keyboard handler is detached while held', () => {
    const mgr = InputManager.getInstance();

    // Hold W key
    fireKey('w', 'keydown');
    expect(mgr.getState().axes.camera_pan_y).toBe(-1);

    // Detach while held
    keyboard.detach();
    expect(mgr.getState().axes.camera_pan_y).toBe(0);
  });

  it('number keys never dispatch placement tools', () => {
    fireKey('1');
    fireKey('3');
    fireKey('7');

    expect(mockSelectTool).not.toHaveBeenCalled();
  });
});
