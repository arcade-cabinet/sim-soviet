/**
 * PravdaArchivePanel — Pravda newspaper archive overlay.
 *
 * Shows the front page, category distribution chart, and headline archive
 * with tap-to-reveal "reality" behind each headline.
 * Uses SovietModal with terminal variant for dark-panel aesthetic.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SovietModal } from './SovietModal';
import { Colors, monoFont } from './styles';
import { useGameSnapshot } from '../hooks/useGameState';
import { getEngine } from '../bridge/GameInit';
import type { PravdaHeadline } from '../game/pravda/types';

// ── Props ────────────────────────────────────────────────────────────────────

export interface PravdaArchivePanelProps {
  visible: boolean;
  onDismiss: () => void;
}

// ── Category config ──────────────────────────────────────────────────────────

type HeadlineCategory = PravdaHeadline['category'];

const CATEGORY_COLOR: Record<HeadlineCategory, string> = {
  triumph: Colors.sovietGold,
  production: Colors.termGreen,
  culture: '#ce93d8',
  weather: '#60a5fa',
  editorial: '#9e9e9e',
  threat: Colors.sovietRed,
  leader: '#fbc02d',
  spin: '#ff9800',
};

const CATEGORY_LABEL: Record<HeadlineCategory, string> = {
  triumph: 'TRIUMPH',
  production: 'PRODUCTION',
  culture: 'CULTURE',
  weather: 'WEATHER',
  editorial: 'EDITORIAL',
  threat: 'THREAT',
  leader: 'LEADER',
  spin: 'SPIN',
};

const ALL_CATEGORIES: HeadlineCategory[] = [
  'triumph',
  'production',
  'culture',
  'weather',
  'editorial',
  'threat',
  'leader',
  'spin',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Format a timestamp as relative time from now (e.g. "2m ago", "1h ago"). */
function formatRelativeTime(timestamp: number): string {
  const delta = Date.now() - timestamp;
  const seconds = Math.floor(delta / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Sub-components ───────────────────────────────────────────────────────────

/** Section header with gold text and bottom border. */
const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <Text style={styles.sectionTitle}>{title}</Text>
);

/** Horizontal divider between sections. */
const Divider: React.FC = () => <View style={styles.divider} />;

/** Single headline card with tap-to-reveal reality. */
const HeadlineCard: React.FC<{ headline: PravdaHeadline }> = ({ headline }) => {
  const [showReality, setShowReality] = useState(false);
  const color = CATEGORY_COLOR[headline.category] ?? Colors.textSecondary;
  const label = CATEGORY_LABEL[headline.category] ?? headline.category.toUpperCase();

  return (
    <TouchableOpacity
      style={styles.headlineCard}
      activeOpacity={0.8}
      onPress={() => setShowReality((prev) => !prev)}
    >
      {/* Category badge + timestamp */}
      <View style={styles.headlineMeta}>
        <View style={styles.categoryBadge}>
          <View style={[styles.categoryDot, { backgroundColor: color }]} />
          <Text style={[styles.categoryLabel, { color }]}>{label}</Text>
        </View>
        <Text style={styles.timestamp}>{formatRelativeTime(headline.timestamp)}</Text>
      </View>

      {/* Headline text */}
      <Text style={styles.headlineText}>{headline.headline}</Text>

      {/* Subtext */}
      <Text style={styles.subtextText}>{headline.subtext}</Text>

      {/* Reality — shown on tap */}
      {showReality && (
        <View style={styles.realityBox}>
          <Text style={styles.realityPrefix}>TRUTH:</Text>
          <Text style={styles.realityText}>{headline.reality}</Text>
        </View>
      )}

      {/* Tap hint */}
      {!showReality && (
        <Text style={styles.tapHint}>[tap to reveal truth]</Text>
      )}
    </TouchableOpacity>
  );
};

// ── Main Component ───────────────────────────────────────────────────────────

export const PravdaArchivePanel: React.FC<PravdaArchivePanelProps> = ({
  visible,
  onDismiss,
}) => {
  // Subscribe so the panel re-renders on game ticks
  useGameSnapshot();

  // Fetch data from the Pravda system
  const { headlines, frontPage, categoryCounts, maxCount } = useMemo(() => {
    const engine = getEngine();
    const pravda = engine?.getPravdaSystem() ?? null;
    const recentHeadlines: PravdaHeadline[] = pravda?.getRecentHeadlines(50) ?? [];
    const page: string = pravda?.formatFrontPage() ?? 'PRAVDA: NO NEWS IS GOOD NEWS.';

    // Count headlines per category
    const counts: Record<HeadlineCategory, number> = {
      triumph: 0,
      production: 0,
      culture: 0,
      weather: 0,
      editorial: 0,
      threat: 0,
      leader: 0,
      spin: 0,
    };
    for (const h of recentHeadlines) {
      if (h.category in counts) {
        counts[h.category]++;
      }
    }
    const max = Math.max(1, ...Object.values(counts));

    return {
      headlines: recentHeadlines,
      frontPage: page,
      categoryCounts: counts,
      maxCount: max,
    };
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reverse chronological order (newest first)
  const sortedHeadlines = useMemo(
    () => [...headlines].sort((a, b) => b.timestamp - a.timestamp),
    [headlines],
  );

  // Split front page into lines for rendering
  const frontPageLines = useMemo(
    () => frontPage.split('\n').filter((line) => line.trim().length > 0),
    [frontPage],
  );

  if (!visible) return null;

  return (
    <SovietModal
      visible={visible}
      variant="terminal"
      title="PRAVDA ARCHIVE"
      stampText="CLASSIFIED"
      actionLabel="DISMISS"
      onAction={onDismiss}
      dismissOnOverlay
      onDismiss={onDismiss}
    >
      {/* ── FRONT PAGE ───────────────────────────────────────────── */}
      <SectionHeader title="FRONT PAGE" />

      <View style={styles.frontPageBox}>
        <Text style={styles.pravdaTitle}>{'\u041F\u0420\u0410\u0412\u0414\u0410'}</Text>
        <View style={styles.frontPageDivider} />
        {frontPageLines.map((line, i) => (
          <Text key={i} style={styles.frontPageLine}>
            {'\u2605'} {line}
          </Text>
        ))}
      </View>

      <Divider />

      {/* ── CATEGORY DISTRIBUTION ────────────────────────────────── */}
      <SectionHeader title="CATEGORY DISTRIBUTION" />

      <View style={styles.chartContainer}>
        {ALL_CATEGORIES.map((cat) => {
          const count = categoryCounts[cat];
          const color = CATEGORY_COLOR[cat];
          const label = CATEGORY_LABEL[cat];
          const ratio = count / maxCount;

          return (
            <View key={cat} style={styles.chartRow}>
              <Text style={[styles.chartLabel, { color }]}>{label}</Text>
              <View style={styles.chartBarTrack}>
                <View
                  style={[
                    styles.chartBarFill,
                    {
                      width: `${Math.round(ratio * 100)}%`,
                      backgroundColor: color,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.chartCount, { color }]}>{count}</Text>
            </View>
          );
        })}
      </View>

      <Divider />

      {/* ── HEADLINE ARCHIVE ─────────────────────────────────────── */}
      <SectionHeader title="HEADLINE ARCHIVE" />

      {sortedHeadlines.length > 0 ? (
        sortedHeadlines.map((headline, index) => (
          <HeadlineCard
            key={`${headline.timestamp}-${index}`}
            headline={headline}
          />
        ))
      ) : (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            No headlines on file. The presses are silent.
          </Text>
        </View>
      )}

      <Divider />

      {/* ── Footer ───────────────────────────────────────────────── */}
      <View style={styles.footerRow}>
        <Text style={styles.footerLabel}>TOTAL HEADLINES:</Text>
        <Text style={styles.footerValue}>{headlines.length}</Text>
      </View>
    </SovietModal>
  );
};

// ── Styles ───────────────────────────────────────────────────────────────────

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

  // ── Front Page ──
  frontPageBox: {
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#444',
    padding: 12,
  },
  pravdaTitle: {
    fontSize: 22,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: 6,
  },
  frontPageDivider: {
    borderTopWidth: 1,
    borderTopColor: '#555',
    marginBottom: 8,
  },
  frontPageLine: {
    fontSize: 10,
    fontFamily: monoFont,
    color: Colors.textPrimary,
    lineHeight: 16,
    marginBottom: 4,
  },

  // ── Category Distribution ──
  chartContainer: {
    gap: 6,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chartLabel: {
    fontSize: 8,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 1,
    minWidth: 72,
    textAlign: 'right',
  },
  chartBarTrack: {
    flex: 1,
    height: 10,
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#333',
  },
  chartBarFill: {
    height: '100%',
  },
  chartCount: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    minWidth: 20,
    textAlign: 'right',
  },

  // ── Headline Card ──
  headlineCard: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderLeftWidth: 3,
    borderLeftColor: '#555',
    padding: 10,
    marginBottom: 8,
  },
  headlineMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryLabel: {
    fontSize: 8,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  timestamp: {
    fontSize: 8,
    fontFamily: monoFont,
    color: Colors.textMuted,
  },
  headlineText: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.white,
    lineHeight: 16,
    marginBottom: 4,
  },
  subtextText: {
    fontSize: 10,
    fontFamily: monoFont,
    color: Colors.textSecondary,
    lineHeight: 14,
    marginBottom: 4,
  },
  realityBox: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  realityPrefix: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietRed,
    letterSpacing: 1,
    marginBottom: 2,
  },
  realityText: {
    fontSize: 10,
    fontFamily: monoFont,
    fontStyle: 'italic',
    color: Colors.textMuted,
    lineHeight: 14,
  },
  tapHint: {
    fontSize: 8,
    fontFamily: monoFont,
    color: '#444',
    marginTop: 2,
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
