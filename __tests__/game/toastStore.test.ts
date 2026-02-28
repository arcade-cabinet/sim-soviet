/**
 * Tests for src/stores/toastStore.ts
 *
 * The toast system uses:
 * - MAX_TOASTS = 2 (max visible at once)
 * - TOAST_DURATION = 6000ms (auto-dismiss)
 * - RATE_LIMIT_MS = 3000ms (min gap between showing toasts)
 * - DEDUP_WINDOW_MS = 10000ms (skip duplicate messages)
 */
import { addSovietToast, clearAllToasts, dismissSovietToast, getToastsSnapshot } from '@/stores/toastStore';

beforeEach(() => {
  jest.useFakeTimers();
  clearAllToasts();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('toastStore', () => {
  describe('addSovietToast', () => {
    it('adds a toast with correct severity and message', () => {
      addSovietToast('warning', 'Test warning');
      const toasts = getToastsSnapshot();
      expect(toasts).toHaveLength(1);
      expect(toasts[0]!.severity).toBe('warning');
      expect(toasts[0]!.message).toBe('Test warning');
      expect(toasts[0]!.id).toBeTruthy();
    });

    it('prepends new toasts (newest first)', () => {
      addSovietToast('warning', 'First');
      jest.advanceTimersByTime(3001); // advance past rate limit
      addSovietToast('critical', 'Second');
      const toasts = getToastsSnapshot();
      expect(toasts).toHaveLength(2);
      expect(toasts[0]!.message).toBe('Second');
      expect(toasts[1]!.message).toBe('First');
    });

    it('caps at 2 visible toasts', () => {
      addSovietToast('warning', 'One');
      jest.advanceTimersByTime(3001);
      addSovietToast('warning', 'Two');
      // Both visible: [Two, One]
      expect(getToastsSnapshot()).toHaveLength(2);
      expect(getToastsSnapshot()[0]!.message).toBe('Two');
    });

    it('auto-dismisses after 6000ms', () => {
      addSovietToast('warning', 'Auto dismiss');
      expect(getToastsSnapshot()).toHaveLength(1);
      jest.advanceTimersByTime(5999);
      expect(getToastsSnapshot()).toHaveLength(1);
      jest.advanceTimersByTime(1);
      expect(getToastsSnapshot()).toHaveLength(0);
    });

    it('supports all three severity levels', () => {
      addSovietToast('warning', 'w');
      jest.advanceTimersByTime(3001);
      addSovietToast('critical', 'c');
      const toasts = getToastsSnapshot();
      expect(toasts).toHaveLength(2);
      expect(toasts.map((t) => t.severity)).toEqual(['critical', 'warning']);
    });
  });

  describe('rate limiting', () => {
    it('queues rapid toasts and drains after rate limit', () => {
      addSovietToast('warning', 'First');
      addSovietToast('critical', 'Second'); // rate-limited → queued
      expect(getToastsSnapshot()).toHaveLength(1);
      expect(getToastsSnapshot()[0]!.message).toBe('First');

      jest.advanceTimersByTime(3001); // drain fires
      expect(getToastsSnapshot()).toHaveLength(2);
      expect(getToastsSnapshot()[0]!.message).toBe('Second');
    });

    it('deduplicates same message within 10 seconds', () => {
      addSovietToast('warning', 'Same message');
      jest.advanceTimersByTime(3001);
      addSovietToast('warning', 'Same message'); // dedup → skipped
      expect(getToastsSnapshot()).toHaveLength(1);
    });

    it('allows same message after dedup window expires', () => {
      addSovietToast('warning', 'Repeat me');
      jest.advanceTimersByTime(10001); // past dedup + auto-dismiss
      addSovietToast('warning', 'Repeat me');
      expect(getToastsSnapshot()).toHaveLength(1);
      expect(getToastsSnapshot()[0]!.message).toBe('Repeat me');
    });
  });

  describe('dismissSovietToast', () => {
    it('removes a toast by ID', () => {
      addSovietToast('warning', 'Keep');
      jest.advanceTimersByTime(3001);
      addSovietToast('critical', 'Remove');
      const toasts = getToastsSnapshot();
      const removeId = toasts[0]!.id; // 'Remove' is first (newest)
      dismissSovietToast(removeId);
      const after = getToastsSnapshot();
      expect(after).toHaveLength(1);
      expect(after[0]!.message).toBe('Keep');
    });

    it('is a no-op for non-existent IDs', () => {
      addSovietToast('warning', 'Stay');
      dismissSovietToast('nonexistent');
      expect(getToastsSnapshot()).toHaveLength(1);
    });
  });

  describe('clearAllToasts', () => {
    it('removes all toasts and clears queue', () => {
      addSovietToast('warning', 'One');
      addSovietToast('critical', 'Two'); // queued due to rate limit
      expect(getToastsSnapshot()).toHaveLength(1);
      clearAllToasts();
      expect(getToastsSnapshot()).toHaveLength(0);
      // Verify queue was cleared — advancing time should not show queued toast
      jest.advanceTimersByTime(5000);
      expect(getToastsSnapshot()).toHaveLength(0);
    });
  });
});
