/**
 * WorkerStatusBar -- Compact bottom bar showing worker distribution
 * and collective focus selector.
 *
 * Displays assigned/total workers, idle count, collective morale,
 * and four focus buttons (FOOD/BUILD/PROD/BAL) that drive the
 * governor's assignment priorities.
 */

import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, SharedStyles, monoFont } from './styles';
import { useGameSnapshot } from '../hooks/useGameState';
import { getEngine } from '../bridge/GameInit';
import { notifyStateChange } from '../stores/gameStore';
import type { CollectiveFocus } from '../game/workers/governor';

const FOCUS_OPTIONS: { key: CollectiveFocus; label: string; icon: string }[] = [
  { key: 'food', label: 'FOOD', icon: '\u{1F33E}' },
  { key: 'construction', label: 'BUILD', icon: '\u{1F3D7}' },
  { key: 'production', label: 'PROD', icon: '\u{1F3ED}' },
  { key: 'balanced', label: 'BAL', icon: '\u2696' },
];

export interface WorkerStatusBarProps {
  onShowWorkers?: () => void;
}

export const WorkerStatusBar: React.FC<WorkerStatusBarProps> = ({ onShowWorkers }) => {
  const snap = useGameSnapshot();
  const engine = getEngine();
  const workerSystem = engine?.getWorkerSystem() ?? null;
  const currentFocus: CollectiveFocus = workerSystem?.getCollectiveFocus() ?? 'balanced';

  const handleFocusChange = useCallback((focus: CollectiveFocus) => {
    workerSystem?.setCollectiveFocus(focus);
    notifyStateChange();
  }, [workerSystem]);

  return (
    <View style={[SharedStyles.panel, styles.container]}>
      <TouchableOpacity style={styles.workerInfo} onPress={onShowWorkers} activeOpacity={0.7}>
        <Text style={styles.label}>WORKERS</Text>
        <Text style={styles.value}>
          <Text style={{ color: Colors.termGreen }}>{snap.assignedWorkers}</Text>
          <Text style={{ color: '#666' }}>/</Text>
          <Text style={{ color: Colors.white }}>{snap.pop}</Text>
        </Text>
        <Text style={styles.sublabel}>{snap.idleWorkers} idle</Text>
      </TouchableOpacity>

      <View style={styles.statBox}>
        <Text style={styles.label}>MORALE</Text>
        <Text style={[styles.value, {
          color: snap.avgMorale > 60 ? Colors.termGreen : snap.avgMorale > 30 ? Colors.sovietGold : Colors.sovietRed,
        }]}>
          {snap.avgMorale}%
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.focusRow}>
        <Text style={styles.focusLabel}>FOCUS</Text>
        {FOCUS_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.focusBtn, currentFocus === opt.key && styles.focusBtnActive]}
            onPress={() => handleFocusChange(opt.key)}
            activeOpacity={0.7}
          >
            <Text style={styles.focusIcon}>{opt.icon}</Text>
            <Text style={[styles.focusText, currentFocus === opt.key && { color: Colors.white }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 12,
  },
  workerInfo: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  statBox: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  label: {
    fontSize: 8,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#9e9e9e',
    letterSpacing: 2,
  },
  value: {
    fontSize: 16,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.white,
  },
  sublabel: {
    fontSize: 8,
    fontFamily: monoFont,
    color: '#666',
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: '#555',
  },
  focusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  focusLabel: {
    fontSize: 8,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#9e9e9e',
  },
  focusBtn: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#444',
    backgroundColor: '#1a1a1a',
    gap: 4,
    alignItems: 'center',
  },
  focusBtnActive: {
    borderColor: Colors.sovietRed,
    backgroundColor: '#3a1a1a',
  },
  focusIcon: {
    fontSize: 14,
  },
  focusText: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#888',
    letterSpacing: 1,
  },
});
