/**
 * QuotaHUD — State Quota panel (top-right).
 * Port of poc.html lines 243-250.
 */

import type React from 'react';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, monoFont, SharedStyles } from './styles';
import { useResponsive } from './useResponsive';

export interface QuotaHUDProps {
  targetType: string;
  targetAmount: number;
  current: number;
  deadlineYear: number;
}

/** Five-Year Plan quota progress display with resource target and deadline year. */
export const QuotaHUD: React.FC<QuotaHUDProps> = ({ targetType, targetAmount, current, deadlineYear }) => {
  const progress = targetAmount > 0 ? Math.min(current / targetAmount, 1) : 0;
  const { isCompact } = useResponsive();
  const [expanded, setExpanded] = useState(false);

  if (isCompact && !expanded) {
    return (
      <TouchableOpacity
        style={[SharedStyles.panel, styles.container, styles.compactContainer]}
        onPress={() => setExpanded(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.compactSummary}>
          {targetType.toUpperCase()} {current}/{targetAmount}
        </Text>
        <View style={styles.compactBar}>
          <View style={[styles.barFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[SharedStyles.panel, styles.container]}>
      {isCompact && (
        <TouchableOpacity onPress={() => setExpanded(false)} activeOpacity={0.7}>
          <Text style={styles.collapseHint}>TAP TO COLLAPSE</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.heading}>STATE QUOTA</Text>

      <View style={styles.row}>
        <Text style={styles.label}>TARGET:</Text>
        <Text testID="quota-target" style={styles.targetValue}>
          {targetType.toUpperCase()} {targetAmount}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>DEADLINE:</Text>
        <Text testID="quota-deadline" style={styles.deadlineValue}>
          {deadlineYear}
        </Text>
      </View>

      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    right: 10,
    width: 200,
    padding: 10,
    zIndex: 50,
  },
  heading: {
    color: Colors.sovietGold,
    fontFamily: monoFont,
    fontWeight: 'bold',
    fontSize: 12,
    letterSpacing: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#555',
    marginBottom: 8,
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    color: Colors.textPrimary,
    fontFamily: monoFont,
    fontSize: 12,
  },
  targetValue: {
    color: Colors.white,
    fontFamily: monoFont,
    fontSize: 12,
    fontWeight: 'bold',
  },
  deadlineValue: {
    color: '#ef5350',
    fontFamily: monoFont,
    fontSize: 12,
    fontWeight: 'bold',
  },
  barTrack: {
    width: '100%',
    height: 8,
    backgroundColor: Colors.black,
    borderWidth: 1,
    borderColor: '#444',
    marginTop: 8,
  },
  barFill: {
    height: '100%',
    backgroundColor: Colors.termBlue,
  },
  compactContainer: {
    width: 160,
    padding: 6,
    flexDirection: 'column',
  },
  compactSummary: {
    color: Colors.sovietGold,
    fontFamily: monoFont,
    fontWeight: 'bold',
    fontSize: 12,
    letterSpacing: 1,
  },
  compactBar: {
    width: '100%',
    height: 4,
    backgroundColor: Colors.black,
    borderWidth: 1,
    borderColor: '#444',
    marginTop: 4,
  },
  collapseHint: {
    color: Colors.textMuted,
    fontFamily: monoFont,
    fontSize: 8,
    letterSpacing: 1,
    textAlign: 'right',
    marginBottom: 2,
  },
});
