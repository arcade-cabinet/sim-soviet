/**
 * useInputManager -- React hook that instantiates and wires up the
 * InputManager, KeyboardHandler, and GamepadHandler. Maps input actions
 * to game state mutations.
 */

import { useEffect, useRef } from 'react';
import { cycleGameSpeed, cycleLens, selectTool, toggleMinimap, togglePause } from '@/stores/gameStore';
import { GamepadHandler } from './GamepadHandler';
import type { InputAction } from './InputManager';
import { InputManager } from './InputManager';
import { KeyboardHandler } from './KeyboardHandler';

/**
 * Maps tool_N actions to building tool names, matching the toolbar order.
 * These correspond to the most commonly used building tools.
 */
const TOOL_ACTIONS: Record<string, string> = {
  tool_1: 'housing',
  tool_2: 'farm',
  tool_3: 'factory',
  tool_4: 'power',
  tool_5: 'road',
  tool_6: 'pipe',
  tool_7: 'pump',
  tool_8: 'gulag',
  tool_9: 'propaganda',
};

function handleAction(action: InputAction): void {
  // Tool selection
  const toolName = TOOL_ACTIONS[action];
  if (toolName) {
    selectTool(toolName);
    return;
  }

  switch (action) {
    case 'deselect':
      selectTool('none');
      break;
    case 'pause_toggle':
      togglePause();
      break;
    case 'speed_cycle':
      cycleGameSpeed();
      break;
    case 'minimap_toggle':
      toggleMinimap();
      break;
    case 'lens_cycle':
      cycleLens();
      break;
    case 'bulldoze_mode':
      selectTool('bulldoze');
      break;
    // Camera actions are handled by CameraController via continuous state
    case 'camera_pan_up':
    case 'camera_pan_down':
    case 'camera_pan_left':
    case 'camera_pan_right':
    case 'camera_rotate_left':
    case 'camera_rotate_right':
    case 'camera_zoom_in':
    case 'camera_zoom_out':
      break;
    // confirm/cancel/help are no-ops for now
    case 'confirm':
    case 'cancel':
    case 'help':
      break;
  }
}

/**
 * React hook that wires up keyboard and gamepad input to the game.
 *
 * @param enabled - When false, all input handlers are detached.
 */
export function useInputManager(enabled: boolean): void {
  const keyboardRef = useRef<KeyboardHandler | null>(null);
  const gamepadRef = useRef<GamepadHandler | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!enabled) {
      // Detach everything if disabled
      keyboardRef.current?.detach();
      gamepadRef.current?.detach();
      unsubRef.current?.();
      unsubRef.current = null;
      InputManager.getInstance().detach();
      return;
    }

    const mgr = InputManager.getInstance();
    mgr.attach();

    // Subscribe to discrete actions
    unsubRef.current = mgr.subscribe(handleAction);

    // Attach keyboard
    if (!keyboardRef.current) {
      keyboardRef.current = new KeyboardHandler();
    }
    keyboardRef.current.attach();

    // Attach gamepad
    if (!gamepadRef.current) {
      gamepadRef.current = new GamepadHandler();
    }
    gamepadRef.current.attach();

    return () => {
      keyboardRef.current?.detach();
      gamepadRef.current?.detach();
      unsubRef.current?.();
      unsubRef.current = null;
      mgr.detach();
    };
  }, [enabled]);
}
