/**
 * NotificationStore — Persistent notification history for toasts and advisor messages.
 *
 * Stores up to MAX_ENTRIES notifications in a FIFO ring buffer.
 * Provides subscribe/getSnapshot for useSyncExternalStore integration,
 * and tracks an unread count that resets when the log is opened.
 */

export type NotificationCategory = 'toast' | 'advisor' | 'event';

export interface NotificationEntry {
  id: number;
  text: string;
  category: NotificationCategory;
  /** Game date string, e.g. "JAN 1917" */
  dateLabel: string;
  /** Wall-clock timestamp for ordering */
  timestamp: number;
  icon?: string;
}

const MAX_ENTRIES = 100;

let _entries: NotificationEntry[] = [];
let _nextId = 1;
let _unreadCount = 0;
let _version = 0;
const _listeners = new Set<() => void>();

function notify(): void {
  _version++;
  for (const cb of _listeners) cb();
}

/** Push a notification to the history log. Newest entries are at index 0. */
export function pushNotification(text: string, category: NotificationCategory, dateLabel: string, icon?: string): void {
  const entry: NotificationEntry = {
    id: _nextId++,
    text,
    category,
    dateLabel,
    timestamp: Date.now(),
    icon,
  };

  _entries = [entry, ..._entries].slice(0, MAX_ENTRIES);
  _unreadCount++;
  notify();
}

/** Mark all notifications as read (resets unread badge). */
export function markAllRead(): void {
  if (_unreadCount > 0) {
    _unreadCount = 0;
    notify();
  }
}

/** Get the current unread count. */
export function getUnreadCount(): number {
  return _unreadCount;
}

/** Get the current entries snapshot (newest first). */
export function getNotificationEntries(): readonly NotificationEntry[] {
  return _entries;
}

/** Clear all notification history (for testing / new game). */
export function clearNotificationHistory(): void {
  _entries = [];
  _nextId = 1;
  _unreadCount = 0;
  notify();
}

/** Get snapshot version for useSyncExternalStore. */
export function getNotificationVersion(): number {
  return _version;
}

/** Subscribe to notification changes. Returns unsubscribe function. */
export function subscribeNotifications(callback: () => void): () => void {
  _listeners.add(callback);
  return () => {
    _listeners.delete(callback);
  };
}
