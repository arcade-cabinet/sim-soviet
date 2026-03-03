import type { ContinuousState, InputAction } from '../../src/input/InputManager';
import { InputManager } from '../../src/input/InputManager';

describe('InputManager', () => {
  beforeEach(() => {
    InputManager.resetInstance();
  });

  it('returns a singleton instance', () => {
    const a = InputManager.getInstance();
    const b = InputManager.getInstance();
    expect(a).toBe(b);
  });

  it('resetInstance creates a new singleton', () => {
    const a = InputManager.getInstance();
    InputManager.resetInstance();
    const b = InputManager.getInstance();
    expect(a).not.toBe(b);
  });

  describe('subscribe / dispatch', () => {
    it('dispatches actions to subscribers', () => {
      const mgr = InputManager.getInstance();
      const received: InputAction[] = [];
      mgr.subscribe((action) => received.push(action));

      mgr.dispatch('pause_toggle');
      mgr.dispatch('tool_1');
      mgr.dispatch('deselect');

      expect(received).toEqual(['pause_toggle', 'tool_1', 'deselect']);
    });

    it('unsubscribe stops receiving actions', () => {
      const mgr = InputManager.getInstance();
      const received: InputAction[] = [];
      const unsub = mgr.subscribe((action) => received.push(action));

      mgr.dispatch('tool_1');
      unsub();
      mgr.dispatch('tool_2');

      expect(received).toEqual(['tool_1']);
    });

    it('supports multiple subscribers', () => {
      const mgr = InputManager.getInstance();
      const a: InputAction[] = [];
      const b: InputAction[] = [];
      mgr.subscribe((action) => a.push(action));
      mgr.subscribe((action) => b.push(action));

      mgr.dispatch('speed_cycle');

      expect(a).toEqual(['speed_cycle']);
      expect(b).toEqual(['speed_cycle']);
    });
  });

  describe('continuous state', () => {
    it('initializes all axes to zero', () => {
      const mgr = InputManager.getInstance();
      const state = mgr.getState();
      expect(state.axes.camera_pan_x).toBe(0);
      expect(state.axes.camera_pan_y).toBe(0);
      expect(state.axes.camera_rotate).toBe(0);
      expect(state.axes.camera_tilt).toBe(0);
      expect(state.axes.camera_zoom).toBe(0);
    });

    it('updates a continuous axis and notifies state listeners', () => {
      const mgr = InputManager.getInstance();
      const states: ContinuousState[] = [];
      mgr.subscribeState((s) => states.push(s));

      mgr.updateContinuous('camera_pan_x', -1);

      expect(states).toHaveLength(1);
      expect(states[0].axes.camera_pan_x).toBe(-1);
      expect(states[0].axes.camera_pan_y).toBe(0);
    });

    it('clamps values to -1..1', () => {
      const mgr = InputManager.getInstance();
      mgr.updateContinuous('camera_zoom', 5);
      expect(mgr.getState().axes.camera_zoom).toBe(1);

      mgr.updateContinuous('camera_zoom', -10);
      expect(mgr.getState().axes.camera_zoom).toBe(-1);
    });

    it('does not notify if value did not change', () => {
      const mgr = InputManager.getInstance();
      let notifyCount = 0;
      mgr.subscribeState(() => {
        notifyCount++;
      });

      mgr.updateContinuous('camera_pan_x', 0);
      expect(notifyCount).toBe(0);

      mgr.updateContinuous('camera_pan_x', 0.5);
      expect(notifyCount).toBe(1);

      mgr.updateContinuous('camera_pan_x', 0.5);
      expect(notifyCount).toBe(1);
    });

    it('unsubscribeState stops receiving updates', () => {
      const mgr = InputManager.getInstance();
      let count = 0;
      const unsub = mgr.subscribeState(() => {
        count++;
      });

      mgr.updateContinuous('camera_pan_x', 0.5);
      unsub();
      mgr.updateContinuous('camera_pan_x', -0.5);

      expect(count).toBe(1);
    });
  });

  describe('attach / detach', () => {
    it('tracks attached state', () => {
      const mgr = InputManager.getInstance();
      expect(mgr.isAttached()).toBe(false);

      mgr.attach();
      expect(mgr.isAttached()).toBe(true);

      mgr.detach();
      expect(mgr.isAttached()).toBe(false);
    });

    it('detach zeroes all axes and notifies state listeners', () => {
      const mgr = InputManager.getInstance();
      mgr.updateContinuous('camera_pan_x', 1);
      mgr.updateContinuous('camera_rotate', -0.5);

      const states: ContinuousState[] = [];
      mgr.subscribeState((s) => states.push(s));

      mgr.detach();

      expect(states).toHaveLength(1);
      expect(states[0].axes.camera_pan_x).toBe(0);
      expect(states[0].axes.camera_rotate).toBe(0);
    });

    it('detach does not notify if axes are already zero', () => {
      const mgr = InputManager.getInstance();
      let count = 0;
      mgr.subscribeState(() => {
        count++;
      });

      mgr.detach();

      expect(count).toBe(0);
    });
  });
});
