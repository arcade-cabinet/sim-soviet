/**
 * ReportsTab — Annual report summary and quota history for the Reports agency tab.
 *
 * Displays quota fulfillment history, annual production/consumption stats,
 * and current 5-year plan progress. Data sourced from engine scoring system
 * and chronology.
 */

import type React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, monoFont } from '../styles';

// ── Types ───────────────────────────────────────────────────────────────────

/** A single quota history entry. */
export interface QuotaHistoryEntry {
  year: number;
  type: string;
  target: number;
  achieved: number;
  met: boolean;
}

/** Annual summary statistics. */
export interface AnnualSummary {
  year: number;
  population: number;
  foodProduced: number;
  buildingsConstructed: number;
  blackMarks: number;
  commendations: number;
}

export interface ReportsTabProps {
  currentYear: number;
  currentEra: string;
  quotaHistory: QuotaHistoryEntry[];
  annualSummary: AnnualSummary | null;
  totalScore: number;
  /** Current 5-year plan quota */
  currentQuota: { type: string; target: number; current: number; deadlineYear: number } | null;
}

// ── Component ───────────────────────────────────────────────────────────────

export const ReportsTab: React.FC<ReportsTabProps> = ({
  currentYear,
  currentEra,
  quotaHistory,
  annualSummary,
  totalScore,
  currentQuota,
}) => {
  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.headerBanner}>
        <Text style={styles.headerText}>ANNUAL REPORTS TO MOSCOW</Text>
      </View>

      {/* Current status */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>CURRENT STATUS</Text>
        <Row label="YEAR" value={String(currentYear)} />
        <Row label="ERA" value={currentEra.toUpperCase()} />
        <Row label="TOTAL SCORE" value={String(totalScore)} valueColor={Colors.sovietGold} />
      </View>

      <View style={styles.separator} />

      {/* Current quota */}
      {currentQuota && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>CURRENT QUOTA</Text>
            <Row label="TYPE" value={currentQuota.type.toUpperCase()} />
            <Row
              label="PROGRESS"
              value={`${Math.round(currentQuota.current)} / ${currentQuota.target}`}
              valueColor={currentQuota.current >= currentQuota.target ? Colors.termGreen : Colors.sovietGold}
            />
            <Row label="DEADLINE" value={String(currentQuota.deadlineYear)} />
            <View style={styles.barOuter}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${Math.min(100, Math.round((currentQuota.current / currentQuota.target) * 100))}%`,
                    backgroundColor:
                      currentQuota.current >= currentQuota.target ? Colors.termGreen : Colors.sovietRed,
                  },
                ]}
              />
            </View>
          </View>
          <View style={styles.separator} />
        </>
      )}

      {/* Annual summary */}
      {annualSummary && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>LAST ANNUAL SUMMARY ({annualSummary.year})</Text>
            <Row label="POPULATION" value={String(annualSummary.population)} />
            <Row label="FOOD PRODUCED" value={String(Math.round(annualSummary.foodProduced))} />
            <Row label="BUILDINGS BUILT" value={String(annualSummary.buildingsConstructed)} />
            <Row
              label="BLACK MARKS"
              value={String(annualSummary.blackMarks)}
              valueColor={annualSummary.blackMarks > 0 ? Colors.sovietRed : Colors.termGreen}
            />
            <Row
              label="COMMENDATIONS"
              value={String(annualSummary.commendations)}
              valueColor={annualSummary.commendations > 0 ? Colors.termGreen : Colors.textMuted}
            />
          </View>
          <View style={styles.separator} />
        </>
      )}

      {/* Quota history */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>QUOTA HISTORY</Text>
        {quotaHistory.length === 0 ? (
          <Text style={styles.emptyText}>No quota records yet.</Text>
        ) : (
          [...quotaHistory].reverse().map((entry, i) => (
            <View key={`${entry.year}-${i}`} style={styles.historyRow}>
              <Text style={styles.historyYear}>{entry.year}</Text>
              <Text style={styles.historyType}>{entry.type.toUpperCase()}</Text>
              <Text style={styles.historyProgress}>
                {Math.round(entry.achieved)} / {entry.target}
              </Text>
              <Text style={[styles.historyStatus, { color: entry.met ? Colors.termGreen : Colors.sovietRed }]}>
                {entry.met ? 'FULFILLED' : 'FAILED'}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* Footer stamp */}
      <View style={styles.footerStamp}>
        <Text style={styles.stampText}>FILED WITH GOSPLAN</Text>
      </View>
    </ScrollView>
  );
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, valueColor ? { color: valueColor } : undefined]}>{value}</Text>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 8,
  },
  headerBanner: {
    backgroundColor: '#3a3225',
    borderWidth: 1,
    borderColor: Colors.sovietGold,
    paddingVertical: 6,
    alignItems: 'center',
    marginBottom: 10,
  },
  headerText: {
    fontFamily: monoFont,
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 2,
  },
  section: {
    paddingVertical: 6,
  },
  sectionHeader: {
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 1,
    marginBottom: 6,
  },
  separator: {
    borderBottomWidth: 1,
    borderBottomColor: '#444',
    marginVertical: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  rowLabel: {
    fontFamily: monoFont,
    fontSize: 10,
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  rowValue: {
    fontFamily: monoFont,
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  barOuter: {
    height: 8,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#555',
    marginTop: 4,
    marginHorizontal: 4,
  },
  barFill: {
    height: '100%',
  },
  emptyText: {
    fontFamily: monoFont,
    fontSize: 10,
    color: Colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 8,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2e33',
  },
  historyYear: {
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    width: 48,
  },
  historyType: {
    fontFamily: monoFont,
    fontSize: 9,
    color: Colors.textSecondary,
    flex: 1,
    letterSpacing: 0.5,
  },
  historyProgress: {
    fontFamily: monoFont,
    fontSize: 9,
    color: Colors.textMuted,
    width: 80,
    textAlign: 'right',
  },
  historyStatus: {
    fontFamily: monoFont,
    fontSize: 9,
    fontWeight: 'bold',
    width: 70,
    textAlign: 'right',
    letterSpacing: 0.5,
  },
  footerStamp: {
    borderWidth: 2,
    borderColor: Colors.sovietRed,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignSelf: 'center',
    marginVertical: 12,
    transform: [{ rotate: '-3deg' }],
    opacity: 0.6,
  },
  stampText: {
    fontFamily: monoFont,
    fontSize: 9,
    fontWeight: 'bold',
    color: Colors.sovietRed,
    letterSpacing: 2,
  },
});
