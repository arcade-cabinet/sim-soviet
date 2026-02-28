/**
 * WorkerRosterPanel — Population browser with filters, sorting, search,
 * bulk actions, and tap-to-dossier.
 *
 * Shows individual citizens in the collective with morale/loyalty/skill bars,
 * class icons, assignment info, and status indicators. Includes a collective
 * focus selector and summary stats row.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getEngine } from '../bridge/GameInit';
import type { CitizenComponent } from '../ecs/world';
import type { CollectiveFocus } from '../game/workers/governor';
import { useGameSnapshot } from '../hooks/useGameState';
import { openCitizenDossierByIndex } from '../stores/gameStore';
import { citizens as citizensArchetype } from '../ecs/archetypes';
import { SovietModal } from './SovietModal';
import { Colors, monoFont } from './styles';

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_DISPLAYED_WORKERS = 50;

const CLASS_ICONS: Record<CitizenComponent['class'], string> = {
  worker: '\u2692',
  party_official: '\u2605',
  engineer: '\u2699',
  farmer: '\u2E3D',
  soldier: '\u26E8',
  prisoner: '\u26D3',
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

// ── Filter / Sort Types ──────────────────────────────────────────────────────

type FilterTab = 'all' | 'workers' | 'dependents' | 'children' | 'elderly';
type SortKey = 'name' | 'morale' | 'skill' | 'class' | 'age';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'workers', label: 'WORKERS' },
  { key: 'dependents', label: 'DEPEND.' },
  { key: 'children', label: 'CHILDREN' },
  { key: 'elderly', label: 'ELDERLY' },
];

const SORT_KEYS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'NAME' },
  { key: 'morale', label: 'MOR' },
  { key: 'skill', label: 'SKL' },
  { key: 'class', label: 'CLS' },
  { key: 'age', label: 'AGE' },
];

// ── Types ────────────────────────────────────────────────────────────────────

export interface WorkerRosterPanelProps {
  visible: boolean;
  onDismiss: () => void;
}

interface WorkerRow {
  key: string;
  citizenIndex: number;
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

function statColor(value: number): string {
  if (value < 30) return Colors.sovietRed;
  if (value <= 60) return Colors.sovietGold;
  return Colors.termGreen;
}

function genderAge(gender: 'male' | 'female', age: number): string {
  const g = gender === 'male' ? 'M' : 'F';
  return `${g}/${age}`;
}

function matchesFilter(row: WorkerRow, filter: FilterTab): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'workers':
      return row.age >= 18 && row.age < 60 && row.assignment !== 'IDLE';
    case 'dependents':
      return row.age >= 18 && row.age < 60 && row.assignment === 'IDLE';
    case 'children':
      return row.age < 18;
    case 'elderly':
      return row.age >= 60;
  }
}

function sortRows(rows: WorkerRow[], sortKey: SortKey, ascending: boolean): WorkerRow[] {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'name':
        cmp = a.name.localeCompare(b.name);
        break;
      case 'morale':
        cmp = a.morale - b.morale;
        break;
      case 'skill':
        cmp = a.skill - b.skill;
        break;
      case 'class':
        cmp = (CLASS_SORT_ORDER[a.cls] ?? 99) - (CLASS_SORT_ORDER[b.cls] ?? 99);
        break;
      case 'age':
        cmp = a.age - b.age;
        break;
    }
    return ascending ? cmp : -cmp;
  });
  return sorted;
}

// ── Component ────────────────────────────────────────────────────────────────

export const WorkerRosterPanel: React.FC<WorkerRosterPanelProps> = ({ visible, onDismiss }) => {
  useGameSnapshot();

  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [sortKey, setSortKey] = useState<SortKey>('class');
  const [sortAsc, setSortAsc] = useState(true);
  const [searchText, setSearchText] = useState('');

  const engine = getEngine();
  const workerSystem = engine?.getWorkerSystem() ?? null;

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
    const citizenEntities = citizensArchetype.entities;

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
      const gender = citizen.gender ?? 'male';
      const age = citizen.age ?? 25;
      const hasDiseaseFlag = citizen.disease != null;
      const health = 'health' in stats ? (stats as { health: number }).health : 100;

      // Find citizen index in the archetype for dossier linking
      // entity is already verified to have citizen+position via statsMap iteration
      const citizenIndex = citizenEntities.indexOf(entity as (typeof citizenEntities)[number]);

      moraleSum += stats.morale;
      loyaltySum += stats.loyalty;
      skillSum += stats.skill;
      if (hasDiseaseFlag) diseasedCount++;
      if (citizen.hunger > 60) starvingCount++;
      count++;

      allRows.push({
        key: stats.name || `worker-${count}`,
        citizenIndex,
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

    return {
      rows: allRows,
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

  // Apply filter, search, and sort
  const displayRows = useMemo(() => {
    let filtered = rows.filter((r) => matchesFilter(r, activeFilter));
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      filtered = filtered.filter(
        (r) => r.name.toLowerCase().includes(q) || r.assignment.toLowerCase().includes(q),
      );
    }
    const sorted = sortRows(filtered, sortKey, sortAsc);
    return sorted.slice(0, MAX_DISPLAYED_WORKERS);
  }, [rows, activeFilter, searchText, sortKey, sortAsc]);

  const filteredTotal = useMemo(() => {
    let filtered = rows.filter((r) => matchesFilter(r, activeFilter));
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      filtered = filtered.filter(
        (r) => r.name.toLowerCase().includes(q) || r.assignment.toLowerCase().includes(q),
      );
    }
    return filtered.length;
  }, [rows, activeFilter, searchText]);

  const currentFocus = workerSystem?.getCollectiveFocus() ?? 'balanced';

  const handleFocusChange = useCallback(
    (focus: CollectiveFocus) => {
      workerSystem?.setCollectiveFocus(focus);
    },
    [workerSystem],
  );

  const handleSort = useCallback(
    (key: SortKey) => {
      if (key === sortKey) {
        setSortAsc((v) => !v);
      } else {
        setSortKey(key);
        setSortAsc(true);
      }
    },
    [sortKey],
  );

  const handleTapWorker = useCallback((citizenIndex: number) => {
    if (citizenIndex >= 0) {
      openCitizenDossierByIndex(citizenIndex);
    }
  }, []);

  if (!visible) return null;

  const truncated = filteredTotal > MAX_DISPLAYED_WORKERS;

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
              <Text style={[styles.focusIcon, { color: isActive ? Colors.white : opt.iconColor }]}>{opt.icon}</Text>
              <Text style={[styles.focusBtnLabel, isActive && styles.focusBtnLabelActive]}>{opt.label}</Text>
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

      {/* Filter Tabs */}
      <View style={styles.divider} />
      <View style={styles.filterRow}>
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterBtn, activeFilter === tab.key && styles.filterBtnActive]}
            onPress={() => setActiveFilter(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterBtnText, activeFilter === tab.key && styles.filterBtnTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search by name or assignment..."
          placeholderTextColor="#555"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.resultCount}>{filteredTotal} found</Text>
      </View>

      {/* Sort Buttons */}
      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>SORT:</Text>
        {SORT_KEYS.map((s) => (
          <TouchableOpacity
            key={s.key}
            style={[styles.sortBtn, sortKey === s.key && styles.sortBtnActive]}
            onPress={() => handleSort(s.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.sortBtnText, sortKey === s.key && styles.sortBtnTextActive]}>
              {s.label} {sortKey === s.key ? (sortAsc ? '\u25B2' : '\u25BC') : ''}
            </Text>
          </TouchableOpacity>
        ))}
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
        {displayRows.length === 0 ? (
          <Text style={styles.emptyText}>No citizens match filter.</Text>
        ) : (
          displayRows.map((row) => (
            <WorkerRowItem key={row.key} row={row} onTap={handleTapWorker} />
          ))
        )}
        {truncated && (
          <Text style={styles.truncatedText}>... and {filteredTotal - MAX_DISPLAYED_WORKERS} more</Text>
        )}
      </ScrollView>
    </SovietModal>
  );
};

// ── Sub-components ───────────────────────────────────────────────────────────

const SummaryStat: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <View style={styles.summaryStatBox}>
    <Text style={[styles.summaryValue, { color }]}>{value}</Text>
    <Text style={styles.summaryLabel}>{label}</Text>
  </View>
);

const WorkerRowItem: React.FC<{ row: WorkerRow; onTap: (index: number) => void }> = React.memo(({ row, onTap }) => {
  const classColor = CLASS_COLORS[row.cls];
  const classIcon = CLASS_ICONS[row.cls];

  const indicators: string[] = [];
  if (row.hasDiseaseFlag) indicators.push('\u{1F912}');
  if (row.vodkaDependency > 50) indicators.push('\u{1F37A}');
  if (row.health < 20) indicators.push('\u{1F480}');

  return (
    <TouchableOpacity
      style={styles.workerRow}
      activeOpacity={0.6}
      onPress={() => onTap(row.citizenIndex)}
    >
      <View style={styles.colClass}>
        <Text style={[styles.classIcon, { color: classColor }]}>{classIcon}</Text>
        <Text style={[styles.classLabel, { color: classColor }]}>{CLASS_LABELS[row.cls]}</Text>
      </View>
      <Text style={[styles.cellText, styles.colAge]}>{genderAge(row.gender, row.age)}</Text>
      <View style={styles.colBar}>
        <MiniBar value={row.morale} color={statColor(row.morale)} />
      </View>
      <View style={styles.colBar}>
        <MiniBar value={row.loyalty} color={statColor(row.loyalty)} />
      </View>
      <Text style={[styles.cellText, styles.colSkill]}>{Math.round(row.skill)}</Text>
      <Text
        style={[styles.cellText, styles.colAssignment, row.assignment === 'IDLE' && styles.idleText]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {row.assignment.toUpperCase()}
      </Text>
      <Text style={[styles.statusCell, styles.colStatus]}>{indicators.join('')}</Text>
    </TouchableOpacity>
  );
});

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

  // Focus selector
  focusRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  focusBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#444',
  },
  focusBtnActive: { backgroundColor: Colors.sovietRed, borderColor: '#ff5252' },
  focusIcon: { fontSize: 14, marginBottom: 2 },
  focusBtnLabel: {
    fontSize: 8,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#9e9e9e',
    letterSpacing: 1,
  },
  focusBtnLabelActive: { color: Colors.white },

  // Summary stats
  summaryRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  summaryStatBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#222',
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#333',
  },
  summaryValue: { fontSize: 16, fontFamily: monoFont, fontWeight: 'bold' },
  summaryLabel: {
    fontSize: 7,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#9e9e9e',
    letterSpacing: 1,
    marginTop: 1,
  },

  // Divider
  divider: { borderTopWidth: 1, borderTopColor: '#333', marginVertical: 8 },

  // Filter tabs
  filterRow: { flexDirection: 'row', gap: 4, marginBottom: 8 },
  filterBtn: {
    flex: 1,
    paddingVertical: 5,
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
  },
  filterBtnActive: { backgroundColor: '#3a1a1a', borderColor: Colors.sovietRed },
  filterBtnText: { fontSize: 8, fontFamily: monoFont, fontWeight: 'bold', color: '#777', letterSpacing: 1 },
  filterBtnTextActive: { color: '#ff5252' },

  // Search
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  searchInput: {
    flex: 1,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#444',
    color: Colors.white,
    fontFamily: monoFont,
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  resultCount: { fontSize: 9, fontFamily: monoFont, color: '#9e9e9e' },

  // Sort buttons
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  sortLabel: { fontSize: 8, fontFamily: monoFont, fontWeight: 'bold', color: '#777', marginRight: 4 },
  sortBtn: { paddingHorizontal: 6, paddingVertical: 3, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333' },
  sortBtnActive: { backgroundColor: '#2a1a1a', borderColor: Colors.sovietGold },
  sortBtnText: { fontSize: 7, fontFamily: monoFont, fontWeight: 'bold', color: '#777' },
  sortBtnTextActive: { color: Colors.sovietGold },

  // Column headers
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

  // Column widths
  colClass: { width: 44, flexDirection: 'row', alignItems: 'center', gap: 2 },
  colAge: { width: 36 },
  colBar: { width: 40, justifyContent: 'center' },
  colSkill: { width: 28, textAlign: 'center' },
  colAssignment: { flex: 1, marginHorizontal: 4 },
  colStatus: { width: 36, textAlign: 'right' },

  // Worker list
  workerList: { maxHeight: 240 },
  workerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },

  // Cell text
  cellText: { fontSize: 10, fontFamily: monoFont, color: Colors.textPrimary },
  classIcon: { fontSize: 12 },
  classLabel: { fontSize: 8, fontFamily: monoFont, fontWeight: 'bold' },
  idleText: { color: Colors.textMuted, fontStyle: 'italic' },
  statusCell: { fontSize: 12 },

  // Mini bar
  barTrack: { height: 6, backgroundColor: '#333', borderWidth: 1, borderColor: '#444', overflow: 'hidden' },
  barFill: { height: '100%' },

  // Empty / truncated
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
