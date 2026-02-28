/**
 * WorkerAnalyticsPanel — Soviet terminal overlay showing worker demographics,
 * class composition, aggregate stats, and top performers.
 *
 * Renders inside a SovietModal (variant="terminal") with four data sections:
 *   1. WORKFORCE OVERVIEW — totals, focus, morale, efficiency
 *   2. CLASS COMPOSITION  — stacked bar + per-class breakdown table
 *   3. STATUS BREAKDOWN   — count-by-status horizontal bars
 *   4. TOP WORKERS        — top 5 by production efficiency
 */

import type React from 'react';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getEngine } from '../bridge/GameInit';
import { citizens } from '../ecs/archetypes';
import { CLASS_ORDER } from '../game/workers/constants';
import type { CollectiveFocus } from '../game/workers/governor';
import type { WorkerDisplayInfo } from '../game/workers/types';
import { useGameSnapshot } from '../hooks/useGameState';
import { SovietModal } from './SovietModal';
import { Colors, monoFont } from './styles';

// ── Props ────────────────────────────────────────────────────────────────────

export interface WorkerAnalyticsPanelProps {
  visible: boolean;
  onDismiss: () => void;
}

// ── Class / status color maps ────────────────────────────────────────────────

const CLASS_COLORS: Record<WorkerDisplayInfo['class'], string> = {
  worker: Colors.white,
  engineer: '#60a5fa',
  farmer: '#81c784',
  party_official: Colors.sovietRed,
  soldier: '#ff9800',
  prisoner: '#9e9e9e',
};

const STATUS_COLORS: Record<WorkerDisplayInfo['status'], string> = {
  working: Colors.termGreen,
  idle: Colors.sovietGold,
  hungry: '#ff9800',
  drunk: '#ce93d8',
  defecting: Colors.sovietRed,
};

const STATUS_ORDER: WorkerDisplayInfo['status'][] = ['working', 'idle', 'hungry', 'drunk', 'defecting'];

const FOCUS_LABELS: Record<CollectiveFocus, string> = {
  balanced: 'BALANCED',
  production: 'PRODUCTION',
  food: 'FOOD',
  construction: 'CONSTRUCTION',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatPct(value: number): string {
  return `${Math.round(value)}%`;
}

function formatEff(value: number): string {
  return `x${value.toFixed(2)}`;
}

function moraleColor(morale: number): string {
  if (morale > 60) return Colors.termGreen;
  if (morale > 40) return Colors.sovietGold;
  return Colors.sovietRed;
}

function classLabel(cls: WorkerDisplayInfo['class']): string {
  return cls.toUpperCase().replace('_', ' ');
}

// ── Derived analytics ────────────────────────────────────────────────────────

interface ClassStats {
  count: number;
  pct: number;
  avgMorale: number;
  avgEfficiency: number;
}

interface Analytics {
  total: number;
  focus: CollectiveFocus;
  avgMorale: number;
  avgEfficiency: number;
  byClass: Map<WorkerDisplayInfo['class'], ClassStats>;
  byStatus: Map<WorkerDisplayInfo['status'], number>;
  topWorkers: WorkerDisplayInfo[];
}

function computeAnalytics(workers: WorkerDisplayInfo[], focus: CollectiveFocus): Analytics {
  const total = workers.length;

  // Per-class accumulators
  const classAccum = new Map<WorkerDisplayInfo['class'], { count: number; moraleSum: number; effSum: number }>();
  for (const cls of CLASS_ORDER) {
    classAccum.set(cls, { count: 0, moraleSum: 0, effSum: 0 });
  }

  // Per-status counts
  const statusCounts = new Map<WorkerDisplayInfo['status'], number>();
  for (const s of STATUS_ORDER) {
    statusCounts.set(s, 0);
  }

  let moraleSum = 0;
  let effSum = 0;

  for (const w of workers) {
    moraleSum += w.morale;
    effSum += w.productionEfficiency;

    const ca = classAccum.get(w.class);
    if (ca) {
      ca.count++;
      ca.moraleSum += w.morale;
      ca.effSum += w.productionEfficiency;
    }

    statusCounts.set(w.status, (statusCounts.get(w.status) ?? 0) + 1);
  }

  const avgMorale = total > 0 ? moraleSum / total : 0;
  const avgEfficiency = total > 0 ? effSum / total : 0;

  const byClass = new Map<WorkerDisplayInfo['class'], ClassStats>();
  for (const cls of CLASS_ORDER) {
    const ca = classAccum.get(cls)!;
    byClass.set(cls, {
      count: ca.count,
      pct: total > 0 ? (ca.count / total) * 100 : 0,
      avgMorale: ca.count > 0 ? ca.moraleSum / ca.count : 0,
      avgEfficiency: ca.count > 0 ? ca.effSum / ca.count : 0,
    });
  }

  // Top 5 by efficiency
  const topWorkers = [...workers].sort((a, b) => b.productionEfficiency - a.productionEfficiency).slice(0, 5);

  return { total, focus, avgMorale, avgEfficiency, byClass, byStatus: statusCounts, topWorkers };
}

// ── Component ────────────────────────────────────────────────────────────────

export const WorkerAnalyticsPanel: React.FC<WorkerAnalyticsPanelProps> = ({ visible, onDismiss }) => {
  // Pull game snapshot to trigger re-renders on state change
  useGameSnapshot();

  const analytics = useMemo(() => {
    const engine = getEngine();
    const workerSystem = engine?.getWorkerSystem() ?? null;

    const allWorkers: WorkerDisplayInfo[] = [];
    for (const entity of citizens) {
      const info = workerSystem?.getWorkerInfo(entity);
      if (info) allWorkers.push(info);
    }

    const focus = workerSystem?.getCollectiveFocus() ?? 'balanced';
    return computeAnalytics(allWorkers, focus as CollectiveFocus);
  }, []);

  return (
    <SovietModal
      visible={visible}
      variant="terminal"
      title="WORKER ANALYTICS"
      stampText="CLASSIFIED"
      actionLabel="DISMISS"
      onAction={onDismiss}
      dismissOnOverlay
      onDismiss={onDismiss}
    >
      {/* Section 1: WORKFORCE OVERVIEW */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>WORKFORCE OVERVIEW</Text>
        <View style={styles.overviewRow}>
          <View style={styles.overviewStat}>
            <Text style={styles.bigNumber}>{analytics.total}</Text>
            <Text style={styles.statCaption}>TOTAL WORKERS</Text>
          </View>
          <View style={styles.overviewStat}>
            <View style={styles.focusBadge}>
              <Text style={styles.focusBadgeText}>
                {FOCUS_LABELS[analytics.focus] ?? analytics.focus.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.statCaption}>COLLECTIVE FOCUS</Text>
          </View>
        </View>
        <View style={styles.overviewRow}>
          <View style={styles.overviewStat}>
            <Text style={[styles.statValue, { color: moraleColor(analytics.avgMorale) }]}>
              {formatPct(analytics.avgMorale)}
            </Text>
            <Text style={styles.statCaption}>AVG MORALE</Text>
          </View>
          <View style={styles.overviewStat}>
            <Text style={[styles.statValue, { color: Colors.termBlue }]}>{formatEff(analytics.avgEfficiency)}</Text>
            <Text style={styles.statCaption}>AVG EFFICIENCY</Text>
          </View>
        </View>
      </View>

      {/* Section 2: CLASS COMPOSITION */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>CLASS COMPOSITION</Text>

        {/* Stacked bar */}
        {analytics.total > 0 && (
          <View style={styles.stackedBarContainer}>
            <View style={styles.stackedBar}>
              {CLASS_ORDER.map((cls) => {
                const stats = analytics.byClass.get(cls);
                if (!stats || stats.pct === 0) return null;
                return (
                  <View
                    key={cls}
                    style={[
                      styles.stackedSegment,
                      {
                        width: `${stats.pct}%`,
                        backgroundColor: CLASS_COLORS[cls],
                      },
                    ]}
                  />
                );
              })}
            </View>
            {/* Legend */}
            <View style={styles.legendRow}>
              {CLASS_ORDER.map((cls) => {
                const stats = analytics.byClass.get(cls);
                if (!stats || stats.count === 0) return null;
                return (
                  <View key={cls} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: CLASS_COLORS[cls] }]} />
                    <Text style={styles.legendLabel}>{classLabel(cls)}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Class table */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCell, styles.classCol]}>CLASS</Text>
          <Text style={[styles.tableCell, styles.countCol]}>CNT</Text>
          <Text style={[styles.tableCell, styles.pctCol]}>%</Text>
          <Text style={[styles.tableCell, styles.moraleCol]}>MORALE</Text>
          <Text style={[styles.tableCell, styles.effCol]}>EFF</Text>
        </View>
        {CLASS_ORDER.map((cls) => {
          const stats = analytics.byClass.get(cls)!;
          return (
            <View key={cls} style={styles.tableRow}>
              <Text style={[styles.tableCellValue, styles.classCol, { color: CLASS_COLORS[cls] }]} numberOfLines={1}>
                {classLabel(cls)}
              </Text>
              <Text style={[styles.tableCellValue, styles.countCol]}>{stats.count}</Text>
              <Text style={[styles.tableCellValue, styles.pctCol]}>{formatPct(stats.pct)}</Text>
              <Text style={[styles.tableCellValue, styles.moraleCol, { color: moraleColor(stats.avgMorale) }]}>
                {stats.count > 0 ? formatPct(stats.avgMorale) : '-'}
              </Text>
              <Text style={[styles.tableCellValue, styles.effCol]}>
                {stats.count > 0 ? formatEff(stats.avgEfficiency) : '-'}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Section 3: STATUS BREAKDOWN */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>STATUS BREAKDOWN</Text>
        {STATUS_ORDER.map((status) => {
          const count = analytics.byStatus.get(status) ?? 0;
          const pct = analytics.total > 0 ? (count / analytics.total) * 100 : 0;
          return (
            <View key={status} style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: STATUS_COLORS[status] }]}>{status.toUpperCase()}</Text>
              <View style={styles.statusBarTrack}>
                <View
                  style={[
                    styles.statusBarFill,
                    {
                      width: `${pct}%`,
                      backgroundColor: STATUS_COLORS[status],
                    },
                  ]}
                />
              </View>
              <Text style={styles.statusCount}>{count}</Text>
            </View>
          );
        })}
      </View>

      {/* Section 4: TOP WORKERS */}
      {analytics.topWorkers.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>TOP WORKERS</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCell, styles.nameCol]}>NAME</Text>
            <Text style={[styles.tableCell, styles.twClassCol]}>CLASS</Text>
            <Text style={[styles.tableCell, styles.twMoraleCol]}>MOR</Text>
            <Text style={[styles.tableCell, styles.twEffCol]}>EFF</Text>
          </View>
          {analytics.topWorkers.map((w, i) => (
            <View key={`${w.name}-${i}`} style={styles.tableRow}>
              <Text style={[styles.tableCellValue, styles.nameCol]} numberOfLines={1}>
                {w.status === 'defecting' ? '\u2620 ' : ''}
                {w.name}
              </Text>
              <Text
                style={[styles.tableCellValue, styles.twClassCol, { color: CLASS_COLORS[w.class] }]}
                numberOfLines={1}
              >
                {classLabel(w.class)}
              </Text>
              <Text style={[styles.tableCellValue, styles.twMoraleCol, { color: moraleColor(w.morale) }]}>
                {formatPct(w.morale)}
              </Text>
              <Text style={[styles.tableCellValue, styles.twEffCol]}>{formatEff(w.productionEfficiency)}</Text>
            </View>
          ))}
        </View>
      )}
    </SovietModal>
  );
};

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Sections
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    fontFamily: monoFont,
    fontWeight: 'bold',
    fontSize: 11,
    letterSpacing: 2,
    color: Colors.sovietGold,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingBottom: 4,
    marginBottom: 8,
  },

  // Overview
  overviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  overviewStat: {
    alignItems: 'center',
    flex: 1,
  },
  bigNumber: {
    fontFamily: monoFont,
    fontWeight: 'bold',
    fontSize: 28,
    color: Colors.textPrimary,
  },
  statValue: {
    fontFamily: monoFont,
    fontWeight: 'bold',
    fontSize: 18,
  },
  statCaption: {
    fontFamily: monoFont,
    fontSize: 9,
    letterSpacing: 1,
    color: Colors.textMuted,
    marginTop: 2,
  },
  focusBadge: {
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: Colors.sovietGold,
    paddingVertical: 3,
    paddingHorizontal: 10,
    marginBottom: 2,
  },
  focusBadgeText: {
    fontFamily: monoFont,
    fontWeight: 'bold',
    fontSize: 12,
    letterSpacing: 1,
    color: Colors.sovietGold,
  },

  // Stacked bar
  stackedBarContainer: {
    marginBottom: 10,
  },
  stackedBar: {
    flexDirection: 'row',
    height: 12,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#444',
    overflow: 'hidden',
  },
  stackedSegment: {
    height: '100%',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    marginRight: 3,
  },
  legendLabel: {
    fontFamily: monoFont,
    fontSize: 8,
    color: Colors.textSecondary,
  },

  // Class table
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingBottom: 3,
    marginBottom: 3,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 2,
  },
  tableCell: {
    fontFamily: monoFont,
    fontSize: 9,
    letterSpacing: 1,
    color: Colors.textMuted,
  },
  tableCellValue: {
    fontFamily: monoFont,
    fontSize: 10,
    color: Colors.textPrimary,
  },
  classCol: {
    flex: 3,
  },
  countCol: {
    flex: 1,
    textAlign: 'right',
  },
  pctCol: {
    flex: 1.2,
    textAlign: 'right',
  },
  moraleCol: {
    flex: 1.5,
    textAlign: 'right',
  },
  effCol: {
    flex: 1.5,
    textAlign: 'right',
  },

  // Status breakdown
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusLabel: {
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: 'bold',
    width: 80,
  },
  statusBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    marginHorizontal: 6,
    overflow: 'hidden',
  },
  statusBarFill: {
    height: '100%',
  },
  statusCount: {
    fontFamily: monoFont,
    fontSize: 10,
    color: Colors.textPrimary,
    width: 28,
    textAlign: 'right',
  },

  // Top workers table
  nameCol: {
    flex: 3.5,
  },
  twClassCol: {
    flex: 2.5,
  },
  twMoraleCol: {
    flex: 1.5,
    textAlign: 'right',
  },
  twEffCol: {
    flex: 1.5,
    textAlign: 'right',
  },
});
