/**
 * LawEnforcementTab — Sector law enforcement dashboard for gorod+ settlements.
 *
 * Displays enforcement mode, local crime rate, and patrol coverage. Read-only observation panel
 * consistent with the game's bureaucratic observation-not-control pattern.
 */

import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type {
  LawEnforcementMode,
  LawEnforcementState,
  SectorBlock,
} from '../../ai/agents/political/LawEnforcementSystem';
import { Colors, monoFont } from '../styles';

// ── Types ───────────────────────────────────────────────────────────────────

export interface LawEnforcementTabProps {
  /** Full law enforcement state from KGBAgent. */
  state: Readonly<LawEnforcementState>;
  /** Era-appropriate state-security service label. */
  serviceLabel?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function modeLabel(mode: LawEnforcementMode, serviceLabel: string): string {
  if (mode === 'kgb') return `${serviceLabel} POLITICAL SECURITY`;
  return 'STATE SECURITY';
}

function formatPercent(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function crimeColor(rate: number): string {
  if (rate < 0.05) return Colors.termGreen;
  if (rate < 0.15) return Colors.sovietGold;
  return Colors.sovietRed;
}

// ── Component ───────────────────────────────────────────────────────────────

export const LawEnforcementTab: React.FC<LawEnforcementTabProps> = ({ state, serviceLabel = 'STATE SECURITY' }) => {
  return (
    <View style={styles.container} testID="law-enforcement-tab">
      {/* Header */}
      <Text style={styles.sectionTitle}>ENFORCEMENT MODE</Text>
      <Text style={styles.modeLabel}>{modeLabel(state.mode, serviceLabel)}</Text>

      {/* Aggregate stats */}
      <View style={styles.statsRow}>
        <StatBox
          label="CRIME RATE"
          value={formatPercent(state.aggregateCrimeRate)}
          color={crimeColor(state.aggregateCrimeRate)}
        />
        <StatBox label="PATROLS" value={String(state.totalJudges)} color={Colors.termBlue} />
        <StatBox label="DETAINED" value={String(state.totalDetainedPopulation)} color={Colors.sovietGold} />
        <StatBox label="LABOR" value={state.totalPenalLabor.toFixed(0)} color={Colors.textSecondary} />
      </View>

      {/* Sector breakdown (only shown when sectors exist) */}
      {state.sectors.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>SECTOR BREAKDOWN</Text>
          <View style={styles.sectorHeader}>
            <Text style={[styles.sectorCell, styles.sectorNameCol]}>SECTOR</Text>
            <Text style={styles.sectorCell}>CRIME</Text>
            <Text style={styles.sectorCell}>PATROLS</Text>
            <Text style={styles.sectorCell}>DECAY</Text>
            <Text style={styles.sectorCell}>DETAINED</Text>
          </View>
          {state.sectors.map((sector) => (
            <SectorRow key={sector.id} sector={sector} />
          ))}
        </>
      )}

      {state.sectors.length === 0 && (
        <Text style={styles.noSectors}>Settlement does not yet require sector subdivision.</Text>
      )}
    </View>
  );
};

// ── Sub-components ─────────────────────────────────────────────────────────

const StatBox: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <View style={styles.statBox}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
  </View>
);

const SectorRow: React.FC<{ sector: SectorBlock }> = ({ sector }) => (
  <View style={styles.sectorRow}>
    <Text style={[styles.sectorCell, styles.sectorNameCol]} numberOfLines={1}>
      {sector.name}
    </Text>
    <Text style={[styles.sectorCell, { color: crimeColor(sector.crimeRate) }]}>{formatPercent(sector.crimeRate)}</Text>
    <Text style={styles.sectorCell}>{sector.judgeCount}</Text>
    <Text style={[styles.sectorCell, { color: sector.districtDecay > 0.3 ? Colors.sovietRed : Colors.textSecondary }]}>
      {formatPercent(sector.districtDecay)}
    </Text>
    <Text style={styles.sectorCell}>{sector.detainedPopulation}</Text>
  </View>
);

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    padding: 8,
  },
  sectionTitle: {
    fontFamily: monoFont,
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 1.5,
    marginTop: 12,
    marginBottom: 6,
  },
  modeLabel: {
    fontFamily: monoFont,
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.sovietRed,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#424242',
    marginHorizontal: 2,
    backgroundColor: '#1a1d21',
  },
  statLabel: {
    fontFamily: monoFont,
    fontSize: 8,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  statValue: {
    fontFamily: monoFont,
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  sectorHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.sovietRed,
    paddingBottom: 4,
    marginBottom: 4,
  },
  sectorRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  sectorCell: {
    flex: 1,
    fontFamily: monoFont,
    fontSize: 10,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  sectorNameCol: {
    flex: 1.5,
    textAlign: 'left',
  },
  noSectors: {
    fontFamily: monoFont,
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
});
