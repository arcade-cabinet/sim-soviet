/**
 * Tests for src/ui/NotificationStore.ts
 *
 * Verifies notification history persistence, FIFO eviction,
 * unread count tracking, and subscribe/notify pattern.
 */
import {
  clearNotificationHistory,
  getNotificationEntries,
  getUnreadCount,
  markAllRead,
  pushNotification,
  subscribeNotifications,
} from '@/ui/NotificationStore';

beforeEach(() => {
  clearNotificationHistory();
});

describe('NotificationStore', () => {
  describe('pushNotification', () => {
    it('adds a notification with correct fields', () => {
      pushNotification('Test message', 'toast', 'JAN 1917');
      const entries = getNotificationEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]!.text).toBe('Test message');
      expect(entries[0]!.category).toBe('toast');
      expect(entries[0]!.dateLabel).toBe('JAN 1917');
      expect(entries[0]!.id).toBeGreaterThan(0);
      expect(entries[0]!.timestamp).toBeGreaterThan(0);
    });

    it('stores newest entries first', () => {
      pushNotification('First', 'toast', 'JAN 1917');
      pushNotification('Second', 'advisor', 'FEB 1917');
      pushNotification('Third', 'event', 'MAR 1917');
      const entries = getNotificationEntries();
      expect(entries).toHaveLength(3);
      expect(entries[0]!.text).toBe('Third');
      expect(entries[1]!.text).toBe('Second');
      expect(entries[2]!.text).toBe('First');
    });

    it('supports all three categories', () => {
      pushNotification('t', 'toast', 'JAN 1917');
      pushNotification('a', 'advisor', 'JAN 1917');
      pushNotification('e', 'event', 'JAN 1917');
      const cats = getNotificationEntries().map((e) => e.category);
      expect(cats).toEqual(['event', 'advisor', 'toast']);
    });

    it('stores optional icon', () => {
      pushNotification('With icon', 'advisor', 'JAN 1917', '\u262D');
      expect(getNotificationEntries()[0]!.icon).toBe('\u262D');
    });

    it('caps at 100 entries (FIFO eviction)', () => {
      for (let i = 0; i < 110; i++) {
        pushNotification(`Msg ${i}`, 'toast', 'JAN 1917');
      }
      const entries = getNotificationEntries();
      expect(entries).toHaveLength(100);
      // Newest should be Msg 109, oldest should be Msg 10
      expect(entries[0]!.text).toBe('Msg 109');
      expect(entries[99]!.text).toBe('Msg 10');
    });

    it('assigns unique IDs to each entry', () => {
      pushNotification('One', 'toast', 'JAN 1917');
      pushNotification('Two', 'toast', 'JAN 1917');
      const entries = getNotificationEntries();
      expect(entries[0]!.id).not.toBe(entries[1]!.id);
    });
  });

  describe('unread count', () => {
    it('starts at zero', () => {
      expect(getUnreadCount()).toBe(0);
    });

    it('increments with each push', () => {
      pushNotification('A', 'toast', 'JAN 1917');
      expect(getUnreadCount()).toBe(1);
      pushNotification('B', 'advisor', 'JAN 1917');
      expect(getUnreadCount()).toBe(2);
    });

    it('resets to zero on markAllRead', () => {
      pushNotification('A', 'toast', 'JAN 1917');
      pushNotification('B', 'toast', 'JAN 1917');
      expect(getUnreadCount()).toBe(2);
      markAllRead();
      expect(getUnreadCount()).toBe(0);
    });

    it('accumulates again after markAllRead', () => {
      pushNotification('A', 'toast', 'JAN 1917');
      markAllRead();
      pushNotification('B', 'toast', 'JAN 1917');
      expect(getUnreadCount()).toBe(1);
    });
  });

  describe('clearNotificationHistory', () => {
    it('removes all entries and resets unread count', () => {
      pushNotification('A', 'toast', 'JAN 1917');
      pushNotification('B', 'advisor', 'JAN 1917');
      clearNotificationHistory();
      expect(getNotificationEntries()).toHaveLength(0);
      expect(getUnreadCount()).toBe(0);
    });
  });

  describe('subscribeNotifications', () => {
    it('fires callback on push', () => {
      const cb = jest.fn();
      const unsub = subscribeNotifications(cb);
      pushNotification('X', 'toast', 'JAN 1917');
      expect(cb).toHaveBeenCalledTimes(1);
      unsub();
    });

    it('fires callback on markAllRead', () => {
      pushNotification('X', 'toast', 'JAN 1917');
      const cb = jest.fn();
      const unsub = subscribeNotifications(cb);
      markAllRead();
      expect(cb).toHaveBeenCalledTimes(1);
      unsub();
    });

    it('fires callback on clear', () => {
      const cb = jest.fn();
      const unsub = subscribeNotifications(cb);
      clearNotificationHistory();
      expect(cb).toHaveBeenCalledTimes(1);
      unsub();
    });

    it('stops firing after unsubscribe', () => {
      const cb = jest.fn();
      const unsub = subscribeNotifications(cb);
      pushNotification('A', 'toast', 'JAN 1917');
      expect(cb).toHaveBeenCalledTimes(1);
      unsub();
      pushNotification('B', 'toast', 'JAN 1917');
      expect(cb).toHaveBeenCalledTimes(1); // no additional call
    });
  });
});
