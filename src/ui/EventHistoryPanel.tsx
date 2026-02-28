/**
 * EventHistoryPanel — Scrollable log of recent game events from the EventSystem.
 *
 * Displays events in reverse chronological order (most recent first) with
 * category icons, severity indicators, Pravda headlines, and resource deltas.
 * Uses terminal-variant SovietModal for dark-panel aesthetic.
 */

import type React from 'react';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getEngine } from '../bridge/GameInit';
import type { EventCategory, EventSeverity, GameEvent, ResourceDelta } from '../game/events/types';
import { useGameSnapshot } from '../hooks/useGameState';
import { SovietModal } from './SovietModal';
import { Colors, monoFont } from './styles';

// ── Props ───────────────────────────────────────────────────────────────────

export interface EventHistoryPanelProps {
  visible: boolean;
  onDismiss: () => void;
}

// ── Category Icons ──────────────────────────────────────────────────────────

const CATEGORY_ICON: Record<EventCategory, string> = {
  disaster: '\u2620', // ☠
  political: '\u262D', // ☭
  economic: '\u20BD', // ₽
  cultural: '\uD83C\uDFAD', // 🎭
  absurdist: '\uD83E\uDD21', // 🤡
};

// ── Severity Colors ─────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<EventSeverity, string> = {
  trivial: Colors.textSecondary,
  minor: Colors.termGreen,
  major: Colors.sovietGold,
  catastrophic: Colors.sovietDarkRed,
};

const SEVERITY_LABEL: Record<EventSeverity, string> = {
  trivial: 'TRIVIAL',
  minor: 'MINOR',
  major: 'MAJOR',
  catastrophic: 'CATASTROPHIC',
};

// ── Event Type Colors ───────────────────────────────────────────────────────

const TYPE_COLOR: Record<GameEvent['type'], string> = {
  good: Colors.termGreen,
  bad: Colors.sovietRed,
  neutral: Colors.textSecondary,
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Format resource deltas as a compact string, e.g. "+50₽  -10 food" */
function formatEffects(effects: ResourceDelta): string {
  const parts: string[] = [];
  if (effects.money) parts.push(`${effects.money > 0 ? '+' : ''}${effects.money}\u20BD`);
  if (effects.food) parts.push(`${effects.food > 0 ? '+' : ''}${effects.food} food`);
  if (effects.vodka) parts.push(`${effects.vodka > 0 ? '+' : ''}${effects.vodka} vodka`);
  if (effects.pop) parts.push(`${effects.pop > 0 ? '+' : ''}${effects.pop} pop`);
  if (effects.power) parts.push(`${effects.power > 0 ? '+' : ''}${effects.power} power`);
  return parts.join('  ');
}

/** Check if an effects object has any non-zero deltas. */
function hasEffects(effects: ResourceDelta): boolean {
  return !!(effects.money || effects.food || effects.vodka || effects.pop || effects.power);
}

// ── Sub-components ──────────────────────────────────────────────────────────

/** Section header with gold text and bottom border. */
const SectionHeader: React.FC<{ title: string }> = ({ title }) => <Text style={styles.sectionTitle}>{title}</Text>;

/** Horizontal divider between sections. */
const Divider: React.FC = () => <View style={styles.divider} />;

/** Single event card. */
const EventCard: React.FC<{ event: GameEvent }> = ({ event }) => {
  const icon = CATEGORY_ICON[event.category] ?? '?';
  const sevColor = SEVERITY_COLOR[event.severity] ?? Colors.textSecondary;
  const sevLabel = SEVERITY_LABEL[event.severity] ?? event.severity.toUpperCase();
  const typeColor = TYPE_COLOR[event.type] ?? Colors.textSecondary;
  const effectsStr = formatEffects(event.effects);

  return (
    <View style={[styles.eventCard, { borderLeftColor: typeColor }]}>
      {/* Header: icon + title + severity badge */}
      <View style={styles.eventCardHeader}>
        <Text style={styles.categoryIcon}>{icon}</Text>
        <Text style={styles.eventTitle} numberOfLines={2}>
          {event.title}
        </Text>
        <View style={[styles.severityBadge, { borderColor: sevColor }]}>
          <Text style={[styles.severityText, { color: sevColor }]}>{sevLabel}</Text>
        </View>
      </View>

      {/* Description */}
      <Text style={styles.eventDescription}>{event.description}</Text>

      {/* Pravda headline */}
      <Text style={styles.pravdaHeadline}>
        {'\u00AB'}
        {event.pravdaHeadline}
        {'\u00BB'}
      </Text>

      {/* Resource effects */}
      {hasEffects(event.effects) && (
        <View style={styles.effectsRow}>
          <Text style={[styles.effectsText, { color: typeColor }]}>{effectsStr}</Text>
        </View>
      )}
    </View>
  );
};

// ── Main Component ──────────────────────────────────────────────────────────

export const EventHistoryPanel: React.FC<EventHistoryPanelProps> = ({ visible, onDismiss }) => {
  // Subscribe so the panel re-renders on game ticks
  useGameSnapshot();

  // Fetch recent events from the EventSystem
  const events = useMemo<GameEvent[]>(() => {
    const engine = getEngine();
    const recent = engine?.getEventSystem()?.getRecentEvents(20) ?? [];
    // Reverse for most-recent-first display
    return [...recent].reverse();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null;

  const totalCount = events.length;

  return (
    <SovietModal
      visible={visible}
      variant="terminal"
      title="EVENT LOG"
      stampText="PRAVDA ARCHIVES"
      actionLabel="DISMISS"
      onAction={onDismiss}
      dismissOnOverlay
      onDismiss={onDismiss}
    >
      {/* ── Event List ──────────────────────────────────────────── */}
      <SectionHeader title="RECENT EVENTS" />

      {totalCount > 0 ? (
        events.map((event, index) => <EventCard key={`${event.id}-${index}`} event={event} />)
      ) : (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No events recorded. The silence is suspicious.</Text>
        </View>
      )}

      <Divider />

      {/* ── Footer with total count ─────────────────────────────── */}
      <View style={styles.footerRow}>
        <Text style={styles.footerLabel}>TOTAL EVENTS ON FILE:</Text>
        <Text style={styles.footerValue}>{totalCount}</Text>
      </View>
    </SovietModal>
  );
};

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Section header ──
  sectionTitle: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 2,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingBottom: 4,
  },

  // ── Divider ──
  divider: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    marginVertical: 12,
  },

  // ── Event card ──
  eventCard: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderLeftWidth: 3,
    padding: 10,
    marginBottom: 8,
  },
  eventCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  categoryIcon: {
    fontSize: 16,
  },
  eventTitle: {
    flex: 1,
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    letterSpacing: 1,
  },
  severityBadge: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  severityText: {
    fontSize: 7,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  // ── Event body ──
  eventDescription: {
    fontSize: 10,
    fontFamily: monoFont,
    color: Colors.textSecondary,
    marginBottom: 4,
    lineHeight: 14,
  },
  pravdaHeadline: {
    fontSize: 10,
    fontFamily: monoFont,
    fontStyle: 'italic',
    color: Colors.sovietGold,
    marginBottom: 4,
  },
  effectsRow: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  effectsText: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  // ── Empty state ──
  emptyBox: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 11,
    fontFamily: monoFont,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    letterSpacing: 1,
  },

  // ── Footer ──
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLabel: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  footerValue: {
    fontSize: 14,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
  },
});
