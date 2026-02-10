/**
 * toastStore — module-level toast notification store.
 *
 * Provides severity-based notifications (warning / critical / evacuation)
 * with auto-dismiss and max-visible limit. Imperative code (SimCallbacks)
 * pushes toasts via addSovietToast(); React reads via useSovietToasts().
 */
import { useSyncExternalStore } from 'react';

export type ToastSeverity = 'warning' | 'critical' | 'evacuation';

export interface SovietToast {
  id: string;
  severity: ToastSeverity;
  message: string;
}

const MAX_TOASTS = 3;
const TOAST_DURATION = 4000;

let _toasts: SovietToast[] = [];
const _listeners = new Set<() => void>();

function notify(): void {
  for (const l of _listeners) l();
}

function subscribe(cb: () => void): () => void {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}

function getToasts(): SovietToast[] {
  return _toasts;
}

/** Push a new toast notification. Auto-dismisses after TOAST_DURATION ms. */
export function addSovietToast(severity: ToastSeverity, message: string): void {
  const id = Math.random().toString(36).slice(2, 9);
  _toasts = [{ id, severity, message }, ..._toasts].slice(0, MAX_TOASTS);
  notify();

  setTimeout(() => {
    dismissSovietToast(id);
  }, TOAST_DURATION);
}

/** Manually dismiss a toast by ID. */
export function dismissSovietToast(id: string): void {
  const before = _toasts;
  _toasts = _toasts.filter((t) => t.id !== id);
  if (_toasts !== before) notify();
}

/** React hook — subscribe to the current toast list. */
export function useSovietToasts(): SovietToast[] {
  return useSyncExternalStore(subscribe, getToasts, getToasts);
}

/** Clear all toasts (useful for game restart). */
export function clearAllToasts(): void {
  _toasts = [];
  notify();
}

/** Read current toasts (for testing or non-React consumers). */
export function getToastsSnapshot(): readonly SovietToast[] {
  return _toasts;
}
