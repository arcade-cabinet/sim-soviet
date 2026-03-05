/**
 * MilestoneTimelineScreen -- End-of-history display.
 *
 * Shows a chronological record of every milestone activated during the
 * playthrough. Shown when the player ends their assignment at the 1991
 * divergence point (not for gameplay-triggered game-overs).
 *
 * Pure component -- all data passed as props.
 */

import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { MilestoneSummaryEntry } from './milestoneSummary';
import { Colors, monoFont } from './styles';

export interface MilestoneTimelineScreenProps {
  visible: boolean;
  entries: MilestoneSummaryEntry[];
  finalYear: number;
  onDismiss: () => void;
}

export const MilestoneTimelineScreen: React.FC<MilestoneTimelineScreenProps> = ({
  visible,
  entries,
  finalYear,
  onDismiss,
}) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={styles.backdrop}>
      <View style={styles.document}>
        <View style={styles.headerRow}>
          <Text style={styles.divisionLabel}>{'\u0410\u0420\u0425\u0418\u0412'} / HISTORICAL RECORD</Text>
          <Text style={styles.yearRange}>1917 {'\u2014'} {finalYear}</Text>
        </View>

        <Text style={styles.title}>YOUR ASSIGNMENT IS CLOSED</Text>
        <Text style={styles.subtitle}>
          {entries.length} milestones recorded across {new Set(entries.map((e) => e.timelineId)).size} domains.
        </Text>
        <View style={styles.divider} />

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {entries.map((entry) => (
            <View key={`${entry.timelineId}-${entry.milestoneId}`} style={styles.entry}>
              <Text style={styles.entryYear}>{entry.year}</Text>
              <View style={styles.entryContent}>
                <Text style={styles.entryHeadline}>{entry.headline}</Text>
                <Text style={styles.entryMeta}>
                  {entry.name} {'\u2014'} {entry.timelineId.toUpperCase()}
                </Text>
              </View>
            </View>
          ))}

          <View style={styles.closing}>
            <Text style={styles.closingText}>
              The records are filed.{'\n'}
              The Soviet Union is dissolved.{'\n'}
              Your file is closed.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.divider} />
        <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss} activeOpacity={0.8}>
          <Text style={styles.dismissLabel}>CLOSE FILE</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  document: {
    width: '92%',
    maxWidth: 680,
    maxHeight: '90%',
    backgroundColor: '#080808',
    borderWidth: 1,
    borderColor: Colors.textMuted,
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  divisionLabel: {
    fontFamily: monoFont,
    fontSize: 9,
    color: Colors.textSecondary,
    letterSpacing: 2,
  },
  yearRange: {
    fontFamily: monoFont,
    fontSize: 9,
    color: Colors.textMuted,
  },
  title: {
    fontFamily: monoFont,
    fontSize: 16,
    color: Colors.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: monoFont,
    fontSize: 10,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.panelShadow,
    marginVertical: 10,
  },
  scroll: {
    maxHeight: 480,
  },
  entry: {
    flexDirection: 'row',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  entryYear: {
    fontFamily: monoFont,
    fontSize: 13,
    color: Colors.sovietGold,
    fontWeight: 'bold',
    width: 48,
    marginTop: 1,
  },
  entryContent: {
    flex: 1,
  },
  entryHeadline: {
    fontFamily: monoFont,
    fontSize: 11,
    color: Colors.textPrimary,
    lineHeight: 16,
    marginBottom: 2,
  },
  entryMeta: {
    fontFamily: monoFont,
    fontSize: 9,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  closing: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  closingText: {
    fontFamily: monoFont,
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  dismissBtn: {
    borderWidth: 1,
    borderColor: Colors.textMuted,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  dismissLabel: {
    fontFamily: monoFont,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 2,
  },
});
