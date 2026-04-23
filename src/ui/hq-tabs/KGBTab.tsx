/**
 * KGBTab — Read-only intelligence reports dashboard for the state-security agency tab.
 *
 * Displays loyalty overview, suspected dissidents, recent arrests, and
 * surveillance status in a classified document aesthetic with redacted
 * sections and Soviet nomenclature.
 *
 * The player cannot control the KGB directly — this is observation only.
 */

import type React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { KGBMoraleReport } from '../../ai/agents/political/types';
import { Colors, monoFont } from '../styles';

// ── Types ───────────────────────────────────────────────────────────────────

/** A single arrest record for display in the recent arrests section. */
export interface ArrestRecord {
  name: string;
  reason: string;
  date: string;
}

/** Props for the state-security tab component. */
export interface KGBTabProps {
  /** Overall settlement loyalty level (0-100). */
  loyaltyLevel: number;
  /** Number of suspected dissidents under observation. */
  dissidentCount: number;
  /** Recent arrest records for display. */
  recentArrests: ArrestRecord[];
  /** Whether active surveillance operations are running. */
  surveillanceActive: boolean;
  /** KGB morale intelligence reports (most recent last). */
  moraleReports?: readonly KGBMoraleReport[];
  /** Historical service label to show in visible copy. */
  serviceLabel?: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

/** Classification header displayed at top and bottom of the report. */
export const CLASSIFICATION_HEADER = 'СЕКРЕТНО / TOP SECRET';

/** Loyalty level thresholds for status classification. */
export const LOYALTY_THRESHOLDS = {
  critical: 25,
  low: 50,
  acceptable: 75,
  exemplary: 100,
} as const;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Format a loyalty level into a human-readable status string. */
export function formatLoyaltyStatus(level: number): string {
  const clamped = Math.max(0, Math.min(level, 100));
  if (clamped < LOYALTY_THRESHOLDS.critical) return 'CRITICAL — IMMEDIATE ACTION REQUIRED';
  if (clamped < LOYALTY_THRESHOLDS.low) return 'LOW — UNDER OBSERVATION';
  if (clamped < LOYALTY_THRESHOLDS.acceptable) return 'ACCEPTABLE — STANDARD MONITORING';
  return 'EXEMPLARY — COMMENDATION RECOMMENDED';
}

/** Get the color for a loyalty level. */
function loyaltyColor(level: number): string {
  const clamped = Math.max(0, Math.min(level, 100));
  if (clamped < LOYALTY_THRESHOLDS.critical) return '#ff1744';
  if (clamped < LOYALTY_THRESHOLDS.low) return '#ff9100';
  if (clamped < LOYALTY_THRESHOLDS.acceptable) return Colors.sovietGold;
  return Colors.termGreen;
}

// ── Component ───────────────────────────────────────────────────────────────

/** Get display color for morale report severity. */
function severityColor(severity: KGBMoraleReport['severity']): string {
  switch (severity) {
    case 'critical':
      return '#ff1744';
    case 'warning':
      return '#ff9100';
    case 'concern':
      return Colors.sovietGold;
  }
}

/** Get Soviet-style label for morale report severity. */
function severityLabel(severity: KGBMoraleReport['severity']): string {
  switch (severity) {
    case 'critical':
      return 'CRITICAL — COUNTER-REVOLUTIONARY RISK';
    case 'warning':
      return 'WARNING — DETERIORATING CONDITIONS';
    case 'concern':
      return 'CONCERN — BELOW ACCEPTABLE STANDARDS';
  }
}

export const KGBTab: React.FC<KGBTabProps> = ({
  loyaltyLevel,
  dissidentCount,
  recentArrests,
  surveillanceActive,
  moraleReports = [],
  serviceLabel = 'KGB',
}) => {
  const status = formatLoyaltyStatus(loyaltyLevel);
  const color = loyaltyColor(loyaltyLevel);

  return (
    <ScrollView style={styles.container}>
      {/* Classification header */}
      <View style={styles.classificationBanner}>
        <Text style={styles.classificationText}>{CLASSIFICATION_HEADER}</Text>
      </View>

      {/* Document header */}
      <View style={styles.docHeader}>
        <Text style={styles.docTitle}>{serviceLabel} SECURITY DOSSIER</Text>
        <Text style={styles.docSubtitle}>{serviceLabel} intelligence summary</Text>
        <View style={styles.stampMark}>
          <Text style={styles.stampText}>УТВЕРЖДЕНО</Text>
        </View>
      </View>

      <View style={styles.separator} />

      {/* Section 1: Loyalty Overview */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>I. LOYALTY OVERVIEW</Text>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Settlement Loyalty Index:</Text>
          <Text style={[styles.fieldValue, { color }]}>{loyaltyLevel}%</Text>
        </View>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Assessment:</Text>
          <Text style={[styles.fieldValue, { color }]}>{status}</Text>
        </View>
        <View style={styles.loyaltyBar}>
          <View
            style={[
              styles.loyaltyFill,
              { width: `${Math.max(0, Math.min(loyaltyLevel, 100))}%`, backgroundColor: color },
            ]}
          />
        </View>
      </View>

      <View style={styles.separator} />

      {/* Section 2: Suspected Dissidents */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>II. SUSPECTED DISSIDENTS</Text>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Active Subjects:</Text>
          <Text style={[styles.fieldValue, dissidentCount > 0 ? styles.warningText : styles.safeText]}>
            {dissidentCount}
          </Text>
        </View>
        {dissidentCount > 0 ? (
          <View style={styles.redactedBlock}>
            <Text style={styles.redactedLine}>Subject identities: [REDACTED]</Text>
            <Text style={styles.redactedLine}>Operational details: ████████████████</Text>
            <Text style={styles.redactedLine}>Handler assignments: [CLASSIFIED]</Text>
          </View>
        ) : (
          <Text style={styles.noDataText}>No active subjects under observation.</Text>
        )}
      </View>

      <View style={styles.separator} />

      {/* Section 3: Recent Arrests */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>III. RECENT ARRESTS</Text>
        {recentArrests.length === 0 ? (
          <Text style={styles.noDataText}>No arrests in current reporting period.</Text>
        ) : (
          recentArrests.map((arrest, i) => (
            <View key={`${arrest.date}-${i}`} style={styles.arrestRecord}>
              <View style={styles.arrestHeader}>
                <Text style={styles.arrestIndex}>#{i + 1}</Text>
                <Text style={styles.arrestDate}>{arrest.date}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Subject:</Text>
                <Text style={styles.fieldValue}>{arrest.name}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Charge:</Text>
                <Text style={styles.fieldValue}>{arrest.reason}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.separator} />

      {/* Section 4: Surveillance Status */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>IV. SURVEILLANCE STATUS</Text>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Active Operations:</Text>
          <Text style={[styles.fieldValue, surveillanceActive ? styles.activeText : styles.inactiveText]}>
            {surveillanceActive ? 'ACTIVE' : 'SUSPENDED'}
          </Text>
        </View>
        {surveillanceActive ? (
          <View style={styles.redactedBlock}>
            <Text style={styles.redactedLine}>Operation codenames: [CLASSIFIED]</Text>
            <Text style={styles.redactedLine}>Informant network: ██ assets deployed</Text>
            <Text style={styles.redactedLine}>Coverage area: ████████████</Text>
          </View>
        ) : (
          <Text style={styles.noDataText}>Surveillance operations temporarily suspended. Awaiting authorization.</Text>
        )}
      </View>

      <View style={styles.separator} />

      {/* Section 5: Morale Intelligence */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>V. MORALE INTELLIGENCE</Text>
        {moraleReports.length === 0 ? (
          <Text style={styles.noDataText}>No morale anomalies detected. All sectors within acceptable parameters.</Text>
        ) : (
          moraleReports
            .slice(-5)
            .reverse()
            .map((report, i) => (
              <View
                key={`${report.timestamp}-${report.sectorId.gridX}-${report.sectorId.gridY}-${i}`}
                style={styles.moraleReport}
              >
                <View style={styles.arrestHeader}>
                  <Text style={[styles.fieldValue, { color: severityColor(report.severity) }]}>
                    {severityLabel(report.severity)}
                  </Text>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Sector:</Text>
                  <Text style={styles.fieldValue}>
                    ({report.sectorId.gridX}, {report.sectorId.gridY})
                  </Text>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Observed Index:</Text>
                  <Text style={[styles.fieldValue, { color: severityColor(report.severity) }]}>
                    {report.avgMorale}%
                  </Text>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Report Tick:</Text>
                  <Text style={styles.fieldValue}>{report.timestamp}</Text>
                </View>
              </View>
            ))
        )}
      </View>

      {/* Classification footer */}
      <View style={styles.classificationBanner}>
        <Text style={styles.classificationText}>{CLASSIFICATION_HEADER}</Text>
      </View>
    </ScrollView>
  );
};

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 8,
  },
  classificationBanner: {
    backgroundColor: Colors.sovietRed,
    paddingVertical: 4,
    alignItems: 'center',
    marginVertical: 6,
  },
  classificationText: {
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.white,
    letterSpacing: 3,
  },
  docHeader: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  docTitle: {
    fontFamily: monoFont,
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 1,
    textAlign: 'center',
  },
  docSubtitle: {
    fontFamily: monoFont,
    fontSize: 9,
    color: Colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  stampMark: {
    position: 'absolute',
    right: 4,
    top: 4,
    borderWidth: 2,
    borderColor: Colors.sovietRed,
    paddingHorizontal: 6,
    paddingVertical: 2,
    transform: [{ rotate: '-12deg' }],
    opacity: 0.6,
  },
  stampText: {
    fontFamily: monoFont,
    fontSize: 8,
    fontWeight: 'bold',
    color: Colors.sovietRed,
    letterSpacing: 1,
  },
  separator: {
    borderBottomWidth: 1,
    borderBottomColor: '#444',
    marginVertical: 4,
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
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  fieldLabel: {
    fontFamily: monoFont,
    fontSize: 10,
    color: Colors.textSecondary,
  },
  fieldValue: {
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  loyaltyBar: {
    height: 6,
    backgroundColor: '#333',
    marginTop: 6,
    marginHorizontal: 4,
  },
  loyaltyFill: {
    height: '100%',
  },
  warningText: {
    color: '#ff9100',
  },
  safeText: {
    color: Colors.termGreen,
  },
  activeText: {
    color: Colors.termGreen,
  },
  inactiveText: {
    color: Colors.textMuted,
  },
  redactedBlock: {
    backgroundColor: '#1a1a1a',
    padding: 8,
    marginTop: 4,
    marginHorizontal: 4,
    borderLeftWidth: 2,
    borderLeftColor: Colors.sovietRed,
  },
  redactedLine: {
    fontFamily: monoFont,
    fontSize: 9,
    color: Colors.textMuted,
    paddingVertical: 1,
  },
  noDataText: {
    fontFamily: monoFont,
    fontSize: 9,
    color: Colors.textMuted,
    fontStyle: 'italic',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  arrestRecord: {
    backgroundColor: '#1a1a1a',
    padding: 6,
    marginVertical: 3,
    marginHorizontal: 4,
    borderLeftWidth: 2,
    borderLeftColor: '#ff9100',
  },
  arrestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  arrestIndex: {
    fontFamily: monoFont,
    fontSize: 9,
    fontWeight: 'bold',
    color: Colors.textSecondary,
  },
  arrestDate: {
    fontFamily: monoFont,
    fontSize: 9,
    color: Colors.textMuted,
  },
  moraleReport: {
    backgroundColor: '#1a1a1a',
    padding: 6,
    marginVertical: 3,
    marginHorizontal: 4,
    borderLeftWidth: 2,
    borderLeftColor: Colors.sovietRed,
  },
});
