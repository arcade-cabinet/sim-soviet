/**
 * toastStore — module-level toast notification store.
 *
 * Provides severity-based notifications (warning / critical / evacuation)
 * with auto-dismiss, max-visible limit, deduplication, and rate limiting.
 * Imperative code (SimCallbacks) pushes toasts via addSovietToast();
 * React reads via useSovietToasts().
 */
import { useSyncExternalStore } from 'react';

export type ToastSeverity = 'warning' | 'critical' | 'evacuation';

export interface SovietToast {
  id: string;
  severity: ToastSeverity;
  message: string;
}

const MAX_TOASTS = 2;
const TOAST_DURATION = 6000;

/** Dedup window — skip duplicate message text within this period. */
const DEDUP_WINDOW_MS = 10000;

/** Rate limit — minimum ms between showing new toasts. */
const RATE_LIMIT_MS = 3000;

let _toasts: SovietToast[] = [];
const _listeners = new Set<() => void>();

/** Recent messages for deduplication: message text → timestamp. */
const _recentMessages = new Map<string, number>();

/** Pending queue for rate-limited toasts. */
const _queue: { severity: ToastSeverity; message: string }[] = [];
let _lastToastTime = 0;
let _drainTimer: ReturnType<typeof setTimeout> | null = null;

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

let _toastCounter = 0;

/** Show a toast immediately (bypasses rate limit — used by the drain loop). */
function showToast(severity: ToastSeverity, message: string): void {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `toast-${Date.now()}-${++_toastCounter}`;
  _toasts = [{ id, severity, message }, ..._toasts].slice(0, MAX_TOASTS);
  _lastToastTime = Date.now();
  _recentMessages.set(message, Date.now());
  notify();

  setTimeout(() => {
    dismissSovietToast(id);
  }, TOAST_DURATION);
}

/** Drain the next queued toast if rate limit allows. */
function drainQueue(): void {
  _drainTimer = null;
  if (_queue.length === 0) return;

  const now = Date.now();
  const elapsed = now - _lastToastTime;

  if (elapsed >= RATE_LIMIT_MS) {
    const next = _queue.shift()!;
    showToast(next.severity, next.message);
  }

  // Schedule next drain if there are more queued
  if (_queue.length > 0 && !_drainTimer) {
    const wait = Math.max(0, RATE_LIMIT_MS - (Date.now() - _lastToastTime));
    _drainTimer = setTimeout(drainQueue, wait);
  }
}

/** Push a new toast notification. Deduplicates and rate-limits. */
export function addSovietToast(severity: ToastSeverity, message: string): void {
  // Dedup: skip if same message was shown recently
  const lastSeen = _recentMessages.get(message);
  if (lastSeen && Date.now() - lastSeen < DEDUP_WINDOW_MS) return;

  // Clean up stale dedup entries
  const now = Date.now();
  for (const [msg, ts] of _recentMessages) {
    if (now - ts > DEDUP_WINDOW_MS) _recentMessages.delete(msg);
  }

  // Rate limit: if within window, queue instead of showing immediately
  if (now - _lastToastTime < RATE_LIMIT_MS) {
    _queue.push({ severity, message });
    if (!_drainTimer) {
      const wait = Math.max(0, RATE_LIMIT_MS - (now - _lastToastTime));
      _drainTimer = setTimeout(drainQueue, wait);
    }
    return;
  }

  showToast(severity, message);
}

/** Manually dismiss a toast by ID. */
export function dismissSovietToast(id: string): void {
  const len = _toasts.length;
  _toasts = _toasts.filter((t) => t.id !== id);
  if (_toasts.length !== len) notify();
}

/** React hook — subscribe to the current toast list. */
export function useSovietToasts(): SovietToast[] {
  return useSyncExternalStore(subscribe, getToasts, getToasts);
}

/** Clear all toasts (useful for game restart). */
export function clearAllToasts(): void {
  _toasts = [];
  _queue.length = 0;
  _recentMessages.clear();
  _lastToastTime = 0;
  if (_drainTimer) {
    clearTimeout(_drainTimer);
    _drainTimer = null;
  }
  notify();
}

/** Read current toasts (for testing or non-React consumers). */
export function getToastsSnapshot(): readonly SovietToast[] {
  return _toasts;
}
