/**
 * QuotaHUD — State Quota panel (top-right).
 * Port of poc.html lines 243-250.
 */

import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, monoFont, SharedStyles } from './styles';

export interface QuotaHUDProps {
  targetType: string;
  targetAmount: number;
  current: number;
  deadlineYear: number;
}

export const QuotaHUD: React.FC<QuotaHUDProps> = ({ targetType, targetAmount, current, deadlineYear }) => {
  const progress = targetAmount > 0 ? Math.min(current / targetAmount, 1) : 0;

  return (
    <View style={[SharedStyles.panel, styles.container]}>
      <Text style={styles.heading}>STATE QUOTA</Text>

      <View style={styles.row}>
        <Text style={styles.label}>TARGET:</Text>
        <Text style={styles.targetValue}>
          {targetType.toUpperCase()} {targetAmount}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>DEADLINE:</Text>
        <Text style={styles.deadlineValue}>{deadlineYear}</Text>
      </View>

      {/* Progress bar */}
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
});
