/**
 * @jest-environment jsdom
 */

import type { InputAction } from '../../src/input/InputManager';
import { InputManager } from '../../src/input/InputManager';
import { KeyboardHandler } from '../../src/input/KeyboardHandler';

function fireKey(key: string, type: 'keydown' | 'keyup' = 'keydown') {
  const event = new KeyboardEvent(type, { key, bubbles: true });
  window.dispatchEvent(event);
}

describe('KeyboardHandler', () => {
  let handler: KeyboardHandler;
  let received: InputAction[];
  let unsub: () => void;

  beforeEach(() => {
    InputManager.resetInstance();
    handler = new KeyboardHandler();
    received = [];
    unsub = InputManager.getInstance().subscribe((a) => received.push(a));
    handler.attach();
  });

  afterEach(() => {
    handler.detach();
    unsub();
    InputManager.resetInstance();
  });

  describe('discrete actions', () => {
    it('ignores number keys because direct placement is not a player action', () => {
      fireKey('1');
      fireKey('5');
      fireKey('9');
      expect(received).toEqual([]);
    });

    it('maps Escape to deselect', () => {
      fireKey('Escape');
      expect(received).toEqual(['deselect']);
    });

    it('maps Space to pause_toggle', () => {
      fireKey(' ');
      expect(received).toEqual(['pause_toggle']);
    });

    it('maps r/R to speed_cycle', () => {
      fireKey('r');
      fireKey('R');
      expect(received).toEqual(['speed_cycle', 'speed_cycle']);
    });

    it('maps m/M to minimap_toggle', () => {
      fireKey('m');
      expect(received).toEqual(['minimap_toggle']);
    });

    it('maps l/L to lens_cycle', () => {
      fireKey('l');
      expect(received).toEqual(['lens_cycle']);
    });

    it('maps Delete and Backspace to bulldoze_mode', () => {
      fireKey('Delete');
      fireKey('Backspace');
      expect(received).toEqual(['bulldoze_mode', 'bulldoze_mode']);
    });

    it('maps F1 to help', () => {
      fireKey('F1');
      expect(received).toEqual(['help']);
    });
  });

  describe('continuous axes', () => {
    it('sets camera_pan_y to -1 on W keydown and 0 on keyup', () => {
      const mgr = InputManager.getInstance();

      fireKey('w', 'keydown');
      expect(mgr.getState().axes.camera_pan_y).toBe(-1);

      fireKey('w', 'keyup');
      expect(mgr.getState().axes.camera_pan_y).toBe(0);
    });

    it('sets camera_pan_x on A/D keys', () => {
      const mgr = InputManager.getInstance();

      fireKey('a', 'keydown');
      expect(mgr.getState().axes.camera_pan_x).toBe(-1);
      fireKey('a', 'keyup');
      expect(mgr.getState().axes.camera_pan_x).toBe(0);

      fireKey('d', 'keydown');
      expect(mgr.getState().axes.camera_pan_x).toBe(1);
      fireKey('d', 'keyup');
      expect(mgr.getState().axes.camera_pan_x).toBe(0);
    });

    it('sets camera_rotate on Q/E keys', () => {
      const mgr = InputManager.getInstance();

      fireKey('q', 'keydown');
      expect(mgr.getState().axes.camera_rotate).toBe(-1);
      fireKey('q', 'keyup');

      fireKey('e', 'keydown');
      expect(mgr.getState().axes.camera_rotate).toBe(1);
      fireKey('e', 'keyup');
      expect(mgr.getState().axes.camera_rotate).toBe(0);
    });

    it('sets camera_zoom on +/- keys', () => {
      const mgr = InputManager.getInstance();

      fireKey('=', 'keydown');
      expect(mgr.getState().axes.camera_zoom).toBe(-1);
      fireKey('=', 'keyup');
      expect(mgr.getState().axes.camera_zoom).toBe(0);

      fireKey('-', 'keydown');
      expect(mgr.getState().axes.camera_zoom).toBe(1);
    });

    it('arrow keys work for camera pan', () => {
      const mgr = InputManager.getInstance();

      fireKey('ArrowUp', 'keydown');
      expect(mgr.getState().axes.camera_pan_y).toBe(-1);
      fireKey('ArrowUp', 'keyup');

      fireKey('ArrowDown', 'keydown');
      expect(mgr.getState().axes.camera_pan_y).toBe(1);
      fireKey('ArrowDown', 'keyup');
      expect(mgr.getState().axes.camera_pan_y).toBe(0);
    });
  });

  describe('input suppression', () => {
    it('ignores keys when activeElement is an INPUT', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      fireKey('1');
      expect(received).toEqual([]);

      document.body.removeChild(input);
    });

    it('ignores keys when activeElement is a TEXTAREA', () => {
      const ta = document.createElement('textarea');
      document.body.appendChild(ta);
      ta.focus();

      fireKey('Escape');
      expect(received).toEqual([]);

      document.body.removeChild(ta);
    });

    it('ignores keys when activeElement is a SELECT', () => {
      const sel = document.createElement('select');
      document.body.appendChild(sel);
      sel.focus();

      fireKey(' ');
      expect(received).toEqual([]);

      document.body.removeChild(sel);
    });
  });

  describe('attach / detach', () => {
    it('does not fire after detach', () => {
      handler.detach();
      fireKey('1');
      expect(received).toEqual([]);
    });

    it('resets continuous axes on detach', () => {
      const mgr = InputManager.getInstance();
      fireKey('w', 'keydown');
      expect(mgr.getState().axes.camera_pan_y).toBe(-1);

      handler.detach();
      expect(mgr.getState().axes.camera_pan_y).toBe(0);
    });

    it('can re-attach after detach', () => {
      handler.detach();
      handler.attach();
      fireKey('r');
      expect(received).toEqual(['speed_cycle']);
    });

    it('ignores duplicate attach calls', () => {
      handler.attach(); // already attached
      fireKey('r');
      expect(received).toEqual(['speed_cycle']); // not doubled
    });
  });

  describe('unknown keys', () => {
    it('ignores unmapped keys', () => {
      fireKey('z');
      fireKey('F12');
      expect(received).toEqual([]);
    });
  });
});
