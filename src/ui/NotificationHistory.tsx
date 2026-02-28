/**
 * NotificationHistory — Scrollable log of past toasts, advisor messages, and events.
 *
 * Styled as a Soviet "COMMUNIQUE LOG" with monospace font, dark panel,
 * red/gold accents, and category color coding.
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSyncExternalStore } from 'react';
import { Colors, monoFont } from './styles';
import {
  getNotificationEntries,
  subscribeNotifications,
  markAllRead,
  type NotificationCategory,
} from './NotificationStore';

export interface NotificationHistoryProps {
  visible: boolean;
  onDismiss: () => void;
}

const CATEGORY_CONFIG: Record<
  NotificationCategory,
  { label: string; color: string; icon: string }
> = {
  toast: { label: 'BULLETIN', color: Colors.white, icon: '\u25A0' },
  advisor: { label: 'ADVISOR', color: Colors.sovietGold, icon: '\u262D' },
  event: { label: 'EVENT', color: Colors.sovietRed, icon: '\u2605' },
};

function useNotificationEntries() {
  return useSyncExternalStore(
    subscribeNotifications,
    getNotificationEntries,
    getNotificationEntries,
  );
}

export const NotificationHistory: React.FC<NotificationHistoryProps> = ({
  visible,
  onDismiss,
}) => {
  const entries = useNotificationEntries();

  // Mark all as read when the panel becomes visible
  useEffect(() => {
    if (visible) {
      markAllRead();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onDismiss}
      />
      <View style={styles.panel}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerIcon}>{'\u2638'}</Text>
            <Text style={styles.headerTitle}>COMMUNIQU{'\u00C9'} LOG</Text>
          </View>
          <TouchableOpacity
            onPress={onDismiss}
            style={styles.closeBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.closeBtnText}>{'\u2716'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* Entries */}
        <ScrollView
          style={styles.scrollArea}
          showsVerticalScrollIndicator={false}
        >
          {entries.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                NO COMMUNIQU{'\u00C9'}S RECORDED
              </Text>
              <Text style={styles.emptySubtext}>
                Notifications will appear here as events unfold.
              </Text>
            </View>
          ) : (
            entries.map((entry) => {
              const cfg = CATEGORY_CONFIG[entry.category];
              return (
                <View key={entry.id} style={styles.entryRow}>
                  <View style={styles.entryMeta}>
                    <Text style={[styles.entryIcon, { color: cfg.color }]}>
                      {entry.icon ?? cfg.icon}
                    </Text>
                    <Text style={styles.entryDate}>{entry.dateLabel}</Text>
                  </View>
                  <View style={styles.entryBody}>
                    <Text style={styles.entryCategoryLabel}>
                      <Text style={[styles.categoryTag, { color: cfg.color }]}>
                        [{cfg.label}]
                      </Text>
                    </Text>
                    <Text style={styles.entryText}>{entry.text}</Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {entries.length} / 100 ENTRIES
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 1500,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  panel: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '75%',
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderTopColor: '#444',
    borderLeftColor: '#444',
    borderBottomColor: '#111',
    borderRightColor: '#111',
    shadowColor: Colors.black,
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 0,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    fontSize: 18,
    color: Colors.sovietRed,
  },
  headerTitle: {
    fontFamily: monoFont,
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 3,
  },
  closeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#555',
  },
  closeBtnText: {
    fontFamily: monoFont,
    fontSize: 12,
    color: '#9e9e9e',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.sovietRed,
    opacity: 0.5,
    marginHorizontal: 16,
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontFamily: monoFont,
    fontSize: 13,
    fontWeight: 'bold',
    color: '#555',
    letterSpacing: 2,
    marginBottom: 8,
  },
  emptySubtext: {
    fontFamily: monoFont,
    fontSize: 11,
    color: '#444',
  },
  entryRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  entryMeta: {
    width: 72,
    alignItems: 'center',
    paddingRight: 8,
  },
  entryIcon: {
    fontSize: 14,
    marginBottom: 2,
  },
  entryDate: {
    fontFamily: monoFont,
    fontSize: 9,
    color: '#666',
    letterSpacing: 1,
  },
  entryBody: {
    flex: 1,
  },
  entryCategoryLabel: {
    marginBottom: 2,
  },
  categoryTag: {
    fontFamily: monoFont,
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  entryText: {
    fontFamily: monoFont,
    fontSize: 12,
    color: '#bdbdbd',
    lineHeight: 18,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'flex-end',
  },
  footerText: {
    fontFamily: monoFont,
    fontSize: 9,
    color: '#555',
    letterSpacing: 1,
  },
});
