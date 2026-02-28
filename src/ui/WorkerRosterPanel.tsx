/**
 * WorkerRosterPanel — Collective worker roster with stats, assignments, and conditions.
 *
 * Shows individual workers in the collective with morale/loyalty/skill bars,
 * class icons, assignment info, and status indicators. Includes a collective
 * focus selector and summary stats row.
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SovietModal } from './SovietModal';
import { Colors, monoFont } from './styles';
import { getEngine } from '../bridge/GameInit';
import { useGameSnapshot } from '../hooks/useGameState';
import type { Entity, CitizenComponent } from '../ecs/world';
import type { WorkerStats } from '../game/workers/types';
import type { CollectiveFocus } from '../game/workers/governor';

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_DISPLAYED_WORKERS = 50;

const CLASS_ICONS: Record<CitizenComponent['class'], string> = {
  worker: '\u2692',         // hammer and pick
  party_official: '\u2605', // star
  engineer: '\u2699',       // gear
  farmer: '\u2E3D',         // wheat (palmyrene left-pointing fleuron, close to wheat glyph)
  soldier: '\u26E8',        // shield
  prisoner: '\u26D3',       // chains
};

const CLASS_COLORS: Record<CitizenComponent['class'], string> = {
  worker: '#90a4ae',
  party_official: '#c62828',
  engineer: '#40c4ff',
  farmer: '#8bc34a',
  soldier: '#4caf50',
  prisoner: '#ff9800',
};

const CLASS_LABELS: Record<CitizenComponent['class'], string> = {
  worker: 'WRK',
  party_official: 'PTY',
  engineer: 'ENG',
  farmer: 'FRM',
  soldier: 'SOL',
  prisoner: 'PRS',
};

/** Class sort order — keeps grouping consistent. */
const CLASS_SORT_ORDER: Record<CitizenComponent['class'], number> = {
  party_official: 0,
  engineer: 1,
  soldier: 2,
  worker: 3,
  farmer: 4,
  prisoner: 5,
};

interface FocusOption {
  key: CollectiveFocus;
  label: string;
  icon: string;
  iconColor: string;
}

const FOCUS_OPTIONS: FocusOption[] = [
  { key: 'food', label: 'FOOD', icon: '\u{1F33E}', iconColor: Colors.termGreen },
  { key: 'construction', label: 'BUILD', icon: '\u{1F3D7}', iconColor: Colors.sovietGold },
  { key: 'production', label: 'PROD', icon: '\u{1F3ED}', iconColor: Colors.termBlue },
  { key: 'balanced', label: 'BAL', icon: '\u2696', iconColor: Colors.white },
];

// ── Types ────────────────────────────────────────────────────────────────────

export interface WorkerRosterPanelProps {
  visible: boolean;
  onDismiss: () => void;
}

/** Flattened worker row data for rendering. */
interface WorkerRow {
  key: string;
  cls: CitizenComponent['class'];
  gender: 'male' | 'female';
  age: number;
  morale: number;
  loyalty: number;
  skill: number;
  health: number;
  vodkaDependency: number;
  assignment: string;
  hasDiseaseFlag: boolean;
  name: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Return a color based on a 0-100 value: red < 30, gold 30-60, green > 60. */
function statColor(value: number): string {
  if (value < 30) return Colors.sovietRed;
  if (value <= 60) return Colors.sovietGold;
  return Colors.termGreen;
}

/** Format gender + age string. */
function genderAge(gender: 'male' | 'female', age: number): string {
  const g = gender === 'male' ? 'M' : 'F';
  return `${g}/${age}`;
}

// ── Component ────────────────────────────────────────────────────────────────

export const WorkerRosterPanel: React.FC<WorkerRosterPanelProps> = ({ visible, onDismiss }) => {
  // Subscribe so the panel re-renders on game ticks
  useGameSnapshot();

  const engine = getEngine();
  const workerSystem = engine?.getWorkerSystem() ?? null;

  // Build worker rows from the stats map
  const { rows, totalCount, summaryStats } = useMemo(() => {
    if (!workerSystem) {
      return {
        rows: [] as WorkerRow[],
        totalCount: 0,
        summaryStats: { avgMorale: 0, avgLoyalty: 0, avgSkill: 0, diseasedCount: 0, starvingCount: 0 },
      };
    }

    const statsMap = workerSystem.getStatsMap();
    const allRows: WorkerRow[] = [];

    let moraleSum = 0;
    let loyaltySum = 0;
    let skillSum = 0;
    let diseasedCount = 0;
    let starvingCount = 0;
    let count = 0;

    for (const [entity, stats] of statsMap) {
      const citizen = entity.citizen;
      if (!citizen) continue;

      const cls = citizen.class;
      if (!citizen.gender) console.warn(`[WorkerRoster] Citizen missing gender`);
      if (citizen.age == null) console.warn(`[WorkerRoster] Citizen missing age`);
      const gender = citizen.gender ?? 'male';
      const age = citizen.age ?? 25;
      const hasDiseaseFlag = citizen.disease != null;
      // health may not exist on WorkerStats yet — forward-compatible access
      const health = 'health' in stats ? (stats as { health: number }).health : 100;

      moraleSum += stats.morale;
      loyaltySum += stats.loyalty;
      skillSum += stats.skill;
      if (hasDiseaseFlag) diseasedCount++;
      if (citizen.hunger > 60) starvingCount++;
      count++;

      allRows.push({
        key: stats.name || `worker-${count}`,
        cls,
        gender,
        age,
        morale: stats.morale,
        loyalty: stats.loyalty,
        skill: stats.skill,
        health,
        vodkaDependency: stats.vodkaDependency,
        assignment: citizen.assignment ?? 'IDLE',
        hasDiseaseFlag,
        name: stats.name,
      });
    }

    // Sort: by class order, then by morale ascending (most urgent first)
    allRows.sort((a, b) => {
      const classA = CLASS_SORT_ORDER[a.cls] ?? 99;
      const classB = CLASS_SORT_ORDER[b.cls] ?? 99;
      if (classA !== classB) return classA - classB;
      return a.morale - b.morale;
    });

    return {
      rows: allRows.slice(0, MAX_DISPLAYED_WORKERS),
      totalCount: allRows.length,
      summaryStats: {
        avgMorale: count > 0 ? Math.round(moraleSum / count) : 0,
        avgLoyalty: count > 0 ? Math.round(loyaltySum / count) : 0,
        avgSkill: count > 0 ? Math.round(skillSum / count) : 0,
        diseasedCount,
        starvingCount,
      },
    };
  }, [workerSystem]);

  const currentFocus = workerSystem?.getCollectiveFocus() ?? 'balanced';

  const handleFocusChange = useCallback(
    (focus: CollectiveFocus) => {
      workerSystem?.setCollectiveFocus(focus);
    },
    [workerSystem],
  );

  if (!visible) return null;

  const truncated = totalCount > MAX_DISPLAYED_WORKERS;

  return (
    <SovietModal
      visible={visible}
      variant="terminal"
      title="COLLECTIVE ROSTER"
      stampText={`${totalCount} SOULS`}
      actionLabel="DISMISS"
      onAction={onDismiss}
      dismissOnOverlay
      onDismiss={onDismiss}
    >
      {/* Collective Focus Selector */}
      <Text style={styles.sectionLabel}>COLLECTIVE FOCUS</Text>
      <View style={styles.focusRow}>
        {FOCUS_OPTIONS.map((opt) => {
          const isActive = currentFocus === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.focusBtn, isActive && styles.focusBtnActive]}
              activeOpacity={0.7}
              onPress={() => handleFocusChange(opt.key)}
            >
              <Text style={[styles.focusIcon, { color: isActive ? Colors.white : opt.iconColor }]}>
                {opt.icon}
              </Text>
              <Text style={[styles.focusBtnLabel, isActive && styles.focusBtnLabelActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Summary Stats */}
      <View style={styles.divider} />
      <View style={styles.summaryRow}>
        <SummaryStat label="MORALE" value={summaryStats.avgMorale} color={statColor(summaryStats.avgMorale)} />
        <SummaryStat label="LOYALTY" value={summaryStats.avgLoyalty} color={statColor(summaryStats.avgLoyalty)} />
        <SummaryStat label="SKILL" value={summaryStats.avgSkill} color={Colors.termBlue} />
        <SummaryStat
          label="SICK"
          value={summaryStats.diseasedCount}
          color={summaryStats.diseasedCount > 0 ? Colors.sovietRed : Colors.textMuted}
        />
        <SummaryStat
          label="STARVING"
          value={summaryStats.starvingCount}
          color={summaryStats.starvingCount > 0 ? Colors.sovietRed : Colors.textMuted}
        />
      </View>

      {/* Column headers */}
      <View style={styles.divider} />
      <View style={styles.headerRow}>
        <Text style={[styles.colHeader, styles.colClass]}>CLS</Text>
        <Text style={[styles.colHeader, styles.colAge]}>AGE</Text>
        <Text style={[styles.colHeader, styles.colBar]}>MOR</Text>
        <Text style={[styles.colHeader, styles.colBar]}>LOY</Text>
        <Text style={[styles.colHeader, styles.colSkill]}>SKL</Text>
        <Text style={[styles.colHeader, styles.colAssignment]}>ASSIGN</Text>
        <Text style={[styles.colHeader, styles.colStatus]}>ST</Text>
      </View>

      {/* Worker list */}
      <ScrollView style={styles.workerList} nestedScrollEnabled showsVerticalScrollIndicator>
        {rows.length === 0 ? (
          <Text style={styles.emptyText}>No workers in collective.</Text>
        ) : (
          rows.map((row) => <WorkerRowItem key={row.key} row={row} />)
        )}
        {truncated && (
          <Text style={styles.truncatedText}>
            ... and {totalCount - MAX_DISPLAYED_WORKERS} more workers
          </Text>
        )}
      </ScrollView>
    </SovietModal>
  );
};

// ── Sub-components ───────────────────────────────────────────────────────────

const SummaryStat: React.FC<{ label: string; value: number; color: string }> = ({
  label,
  value,
  color,
}) => (
  <View style={styles.summaryStatBox}>
    <Text style={[styles.summaryValue, { color }]}>{value}</Text>
    <Text style={styles.summaryLabel}>{label}</Text>
  </View>
);

const WorkerRowItem: React.FC<{ row: WorkerRow }> = React.memo(({ row }) => {
  const classColor = CLASS_COLORS[row.cls];
  const classIcon = CLASS_ICONS[row.cls];

  // Status indicators
  const indicators: string[] = [];
  if (row.hasDiseaseFlag) indicators.push('\u{1F912}');         // sick face
  if (row.vodkaDependency > 50) indicators.push('\u{1F37A}');   // beer mug (vodka proxy)
  if (row.health < 20) indicators.push('\u{1F480}');            // skull

  return (
    <View style={styles.workerRow}>
      {/* Class icon + label */}
      <View style={styles.colClass}>
        <Text style={[styles.classIcon, { color: classColor }]}>{classIcon}</Text>
        <Text style={[styles.classLabel, { color: classColor }]}>{CLASS_LABELS[row.cls]}</Text>
      </View>

      {/* Gender / Age */}
      <Text style={[styles.cellText, styles.colAge]}>{genderAge(row.gender, row.age)}</Text>

      {/* Morale bar */}
      <View style={styles.colBar}>
        <MiniBar value={row.morale} color={statColor(row.morale)} />
      </View>

      {/* Loyalty bar */}
      <View style={styles.colBar}>
        <MiniBar value={row.loyalty} color={statColor(row.loyalty)} />
      </View>

      {/* Skill number */}
      <Text style={[styles.cellText, styles.colSkill]}>{Math.round(row.skill)}</Text>

      {/* Assignment */}
      <Text
        style={[
          styles.cellText,
          styles.colAssignment,
          row.assignment === 'IDLE' && styles.idleText,
        ]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {row.assignment.toUpperCase()}
      </Text>

      {/* Status indicators */}
      <Text style={[styles.statusCell, styles.colStatus]}>{indicators.join('')}</Text>
    </View>
  );
});

/** Tiny horizontal bar (0-100 scale). */
const MiniBar: React.FC<{ value: number; color: string }> = ({ value, color }) => {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
};

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 2,
    marginBottom: 6,
  },

  // ── Focus selector ──
  focusRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  focusBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#444',
  },
  focusBtnActive: {
    backgroundColor: Colors.sovietRed,
    borderColor: '#ff5252',
  },
  focusIcon: {
    fontSize: 14,
    marginBottom: 2,
  },
  focusBtnLabel: {
    fontSize: 8,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#9e9e9e',
    letterSpacing: 1,
  },
  focusBtnLabelActive: {
    color: Colors.white,
  },

  // ── Summary stats ──
  summaryRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  summaryStatBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#222',
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#333',
  },
  summaryValue: {
    fontSize: 16,
    fontFamily: monoFont,
    fontWeight: 'bold',
  },
  summaryLabel: {
    fontSize: 7,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#9e9e9e',
    letterSpacing: 1,
    marginTop: 1,
  },

  // ── Divider ──
  divider: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    marginVertical: 8,
  },

  // ── Column headers ──
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
    marginBottom: 4,
  },
  colHeader: {
    fontSize: 8,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 1,
  },

  // ── Column widths ──
  colClass: {
    width: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  colAge: {
    width: 36,
  },
  colBar: {
    width: 40,
    justifyContent: 'center',
  },
  colSkill: {
    width: 28,
    textAlign: 'center',
  },
  colAssignment: {
    flex: 1,
    marginHorizontal: 4,
  },
  colStatus: {
    width: 36,
    textAlign: 'right',
  },

  // ── Worker list ──
  workerList: {
    maxHeight: 280,
  },
  workerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },

  // ── Cell text ──
  cellText: {
    fontSize: 10,
    fontFamily: monoFont,
    color: Colors.textPrimary,
  },
  classIcon: {
    fontSize: 12,
  },
  classLabel: {
    fontSize: 8,
    fontFamily: monoFont,
    fontWeight: 'bold',
  },
  idleText: {
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  statusCell: {
    fontSize: 12,
  },

  // ── Mini bar ──
  barTrack: {
    height: 6,
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#444',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
  },

  // ── Empty / truncated ──
  emptyText: {
    fontSize: 11,
    fontFamily: monoFont,
    color: '#666',
    fontStyle: 'italic',
    paddingVertical: 16,
    textAlign: 'center',
  },
  truncatedText: {
    fontSize: 10,
    fontFamily: monoFont,
    color: Colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
});
