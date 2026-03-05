/**
 * SettlementSelectorPanel — lists all settlements for viewport switching.
 *
 * Shows settlement name, population, celestial body, and active indicator.
 * Keyboard shortcuts 1-9 also switch settlements (handled in App.web.tsx).
 */

import type React from 'react';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { switchSettlement } from '../game/settlement/switchSettlement';
import { useActiveSettlement, type SettlementSummaryEntry } from '../stores/gameStore';
import { Colors, monoFont, SharedStyles } from './styles';

const BODY_LABELS: Record<string, string> = {
  earth: 'EARTH',
  moon: 'LUNA',
  mars: 'MARS',
  titan: 'TITAN',
  exoplanet: 'EXOPLANET',
};

const THREAT_CONFIG: Record<string, { label: string; color: string }> = {
  stable: { label: 'STABLE', color: '#4caf50' },
  elevated: { label: 'ELEVATED', color: '#fbc02d' },
  warning: { label: 'WARNING', color: '#ff9800' },
  critical: { label: 'CRITICAL', color: '#f44336' },
};

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export const SettlementSelectorPanel: React.FC<Props> = ({ visible, onDismiss }) => {
  const { settlements, transitioning } = useActiveSettlement();

  const handleSwitch = useCallback(
    (id: string) => {
      if (transitioning) return;
      switchSettlement(id);
      onDismiss();
    },
    [transitioning, onDismiss],
  );

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onDismiss} />
      <View style={[SharedStyles.panel, styles.panel]}>
        <View style={styles.header}>
          <Text style={styles.title}>SETTLEMENT REGISTRY</Text>
          <TouchableOpacity onPress={onDismiss} activeOpacity={0.7}>
            <Text style={styles.closeBtn}>X</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.list}>
          {settlements.map((s, idx) => (
            <SettlementRow
              key={s.id}
              entry={s}
              index={idx + 1}
              onPress={handleSwitch}
              disabled={transitioning}
            />
          ))}
          {settlements.length === 0 && (
            <Text style={styles.emptyText}>NO SETTLEMENTS REGISTERED</Text>
          )}
        </ScrollView>
        <Text style={styles.hint}>PRESS 1-9 TO SWITCH SETTLEMENTS</Text>
      </View>
    </View>
  );
};

const SettlementRow: React.FC<{
  entry: SettlementSummaryEntry;
  index: number;
  onPress: (id: string) => void;
  disabled: boolean;
}> = ({ entry, index, onPress, disabled }) => (
  <TouchableOpacity
    style={[styles.row, entry.isActive && styles.rowActive]}
    onPress={() => onPress(entry.id)}
    activeOpacity={0.7}
    disabled={disabled || entry.isActive}
  >
    <View style={styles.rowLeft}>
      <Text style={styles.rowIndex}>[{index}]</Text>
      <View>
        <Text style={[styles.rowName, entry.isActive && styles.rowNameActive]}>
          {entry.name}
        </Text>
        <Text style={styles.rowBody}>{BODY_LABELS[entry.celestialBody] ?? entry.celestialBody.toUpperCase()}</Text>
      </View>
    </View>
    <View style={styles.rowRight}>
      <Text style={styles.rowPop}>POP: {entry.population.toLocaleString()}</Text>
      {entry.threatLevel && (
        <View style={styles.threatRow}>
          <View style={[styles.threatDot, { backgroundColor: THREAT_CONFIG[entry.threatLevel]?.color ?? '#888' }]} />
          <Text style={[styles.threatLabel, { color: THREAT_CONFIG[entry.threatLevel]?.color ?? '#888' }]}>
            {THREAT_CONFIG[entry.threatLevel]?.label ?? entry.threatLevel.toUpperCase()}
          </Text>
        </View>
      )}
      {entry.isActive && <Text style={styles.activeBadge}>ACTIVE</Text>}
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  panel: {
    width: 360,
    maxHeight: 500,
    zIndex: 151,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  title: {
    fontFamily: monoFont,
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 2,
  },
  closeBtn: {
    fontFamily: monoFont,
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.textSecondary,
  },
  list: {
    maxHeight: 380,
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  rowActive: {
    backgroundColor: 'rgba(198,40,40,0.15)',
    borderLeftWidth: 3,
    borderLeftColor: Colors.sovietRed,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowIndex: {
    fontFamily: monoFont,
    fontSize: 11,
    color: Colors.textMuted,
    width: 24,
  },
  rowName: {
    fontFamily: monoFont,
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  rowNameActive: {
    color: Colors.sovietGold,
  },
  rowBody: {
    fontFamily: monoFont,
    fontSize: 9,
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  rowPop: {
    fontFamily: monoFont,
    fontSize: 10,
    color: Colors.textSecondary,
  },
  threatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  threatDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  threatLabel: {
    fontFamily: monoFont,
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  activeBadge: {
    fontFamily: monoFont,
    fontSize: 8,
    fontWeight: 'bold',
    color: Colors.termGreen,
    letterSpacing: 1,
  },
  emptyText: {
    fontFamily: monoFont,
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: 20,
  },
  hint: {
    fontFamily: monoFont,
    fontSize: 9,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#333',
    letterSpacing: 1,
  },
});
