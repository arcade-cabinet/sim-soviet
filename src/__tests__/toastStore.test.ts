/**
 * Tests for src/stores/toastStore.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addSovietToast,
  clearAllToasts,
  dismissSovietToast,
  getToastsSnapshot,
} from '@/stores/toastStore';

beforeEach(() => {
  vi.useFakeTimers();
  clearAllToasts();
});

afterEach(() => {
  vi.useRealTimers();
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
      addSovietToast('critical', 'Second');
      const toasts = getToastsSnapshot();
      expect(toasts).toHaveLength(2);
      expect(toasts[0]!.message).toBe('Second');
      expect(toasts[1]!.message).toBe('First');
    });

    it('caps at 3 toasts', () => {
      addSovietToast('warning', 'One');
      addSovietToast('warning', 'Two');
      addSovietToast('warning', 'Three');
      addSovietToast('warning', 'Four');
      const toasts = getToastsSnapshot();
      expect(toasts).toHaveLength(3);
      // Oldest (One) should be evicted
      expect(toasts.map((t) => t.message)).toEqual(['Four', 'Three', 'Two']);
    });

    it('auto-dismisses after 4000ms', () => {
      addSovietToast('warning', 'Auto dismiss');
      expect(getToastsSnapshot()).toHaveLength(1);
      vi.advanceTimersByTime(3999);
      expect(getToastsSnapshot()).toHaveLength(1);
      vi.advanceTimersByTime(1);
      expect(getToastsSnapshot()).toHaveLength(0);
    });

    it('supports all three severity levels', () => {
      addSovietToast('warning', 'w');
      addSovietToast('critical', 'c');
      addSovietToast('evacuation', 'e');
      const toasts = getToastsSnapshot();
      expect(toasts.map((t) => t.severity)).toEqual(['evacuation', 'critical', 'warning']);
    });
  });

  describe('dismissSovietToast', () => {
    it('removes a toast by ID', () => {
      addSovietToast('warning', 'Keep');
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
    it('removes all toasts', () => {
      addSovietToast('warning', 'One');
      addSovietToast('critical', 'Two');
      addSovietToast('evacuation', 'Three');
      expect(getToastsSnapshot()).toHaveLength(3);
      clearAllToasts();
      expect(getToastsSnapshot()).toHaveLength(0);
    });
  });
});
