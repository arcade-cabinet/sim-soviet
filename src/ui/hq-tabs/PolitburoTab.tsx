/**
 * PolitburoTab — Displays 5-year plan demands, prestige project progress,
 * Politburo satisfaction meter, and upcoming mandates.
 *
 * Soviet styling: gold frames, red banners, propaganda poster aesthetics.
 */

import type React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, monoFont } from '../styles';

// ── Types ───────────────────────────────────────────────────────────────────

/** A single 5-year plan demand from Moscow. */
export interface PolitburoDemand {
  type: string;
  target: number;
  current: number;
  deadline: number;
}

/** Status of the current era's prestige project. */
export interface PrestigeProjectStatus {
  name: string;
  progress: number;
  total: number;
}

export interface PolitburoTabProps {
  demands: PolitburoDemand[];
  prestigeProject: PrestigeProjectStatus | null;
  satisfaction: number;
  onAcceptMandate: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Calculate demand progress as a percentage (0-100).
 *
 * @param demand - the demand to evaluate
 */
export function getDemandProgressPercent(demand: PolitburoDemand): number {
  if (demand.target <= 0) return 0;
  return Math.min(100, Math.round((demand.current / demand.target) * 100));
}

/**
 * Format demand progress as "current / target".
 *
 * @param demand - the demand to format
 */
export function formatDemandStatus(demand: PolitburoDemand): string {
  return `${demand.current} / ${demand.target}`;
}

/**
 * Get a Soviet-flavored label for the satisfaction level.
 * Above 90 is suspicious (too happy = politically dangerous).
 *
 * @param satisfaction - value 0-100
 */
export function getSatisfactionLabel(satisfaction: number): string {
  if (satisfaction > 90) return 'SUSPICIOUS';
  if (satisfaction >= 60) return 'ACCEPTABLE';
  if (satisfaction >= 30) return 'CONCERNING';
  return 'CRITICAL';
}

/**
 * Get the color for a satisfaction level.
 *
 * @param satisfaction - value 0-100
 */
export function getSatisfactionColor(satisfaction: number): string {
  if (satisfaction > 90) return Colors.sovietGold;
  if (satisfaction >= 60) return Colors.termGreen;
  if (satisfaction >= 30) return '#ff9800';
  return Colors.sovietRed;
}

// ── Sub-components ──────────────────────────────────────────────────────────

const DemandRow: React.FC<{ demand: PolitburoDemand }> = ({ demand }) => {
  const pct = getDemandProgressPercent(demand);
  const met = pct >= 100;
  return (
    <View style={demandStyles.row} testID={`demand-${demand.type}`}>
      <View style={demandStyles.header}>
        <Text style={demandStyles.type}>{demand.type.toUpperCase()}</Text>
        <Text style={[demandStyles.deadline, met && demandStyles.met]}>
          {met ? 'FULFILLED' : `by ${demand.deadline}`}
        </Text>
      </View>
      <View style={demandStyles.barOuter}>
        <View style={[demandStyles.barFill, { width: `${pct}%` }, met && demandStyles.barFillMet]} />
      </View>
      <Text style={demandStyles.status}>{formatDemandStatus(demand)}</Text>
    </View>
  );
};

const SatisfactionMeter: React.FC<{ satisfaction: number }> = ({ satisfaction }) => {
  const label = getSatisfactionLabel(satisfaction);
  const color = getSatisfactionColor(satisfaction);
  const pct = Math.max(0, Math.min(100, satisfaction));
  return (
    <View style={meterStyles.container} testID="satisfaction-meter">
      <View style={meterStyles.labelRow}>
        <Text style={meterStyles.title}>POLITBURO SATISFACTION</Text>
        <Text style={[meterStyles.label, { color }]}>{label}</Text>
      </View>
      <View style={meterStyles.barOuter}>
        <View style={[meterStyles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[meterStyles.value, { color }]}>{pct}%</Text>
    </View>
  );
};

const PrestigeSection: React.FC<{ project: PrestigeProjectStatus | null }> = ({ project }) => {
  if (!project) {
    return (
      <View style={prestigeStyles.container} testID="prestige-section">
        <Text style={prestigeStyles.heading}>PRESTIGE PROJECT</Text>
        <Text style={prestigeStyles.none}>No active prestige project</Text>
      </View>
    );
  }

  const pct = project.total > 0 ? Math.min(100, Math.round((project.progress / project.total) * 100)) : 0;
  return (
    <View style={prestigeStyles.container} testID="prestige-section">
      <Text style={prestigeStyles.heading}>PRESTIGE PROJECT</Text>
      <Text style={prestigeStyles.name}>{project.name}</Text>
      <View style={prestigeStyles.barOuter}>
        <View style={[prestigeStyles.barFill, { width: `${pct}%` }]} />
      </View>
      <Text style={prestigeStyles.progress}>
        {project.progress} / {project.total} ({pct}%)
      </Text>
    </View>
  );
};

// ── Component ───────────────────────────────────────────────────────────────

export const PolitburoTab: React.FC<PolitburoTabProps> = ({
  demands,
  prestigeProject,
  satisfaction,
  onAcceptMandate,
}) => {
  return (
    <View style={componentStyles.container}>
      {/* Banner */}
      <View style={componentStyles.banner}>
        <Text style={componentStyles.bannerText}>POLITBURO DIRECTIVES</Text>
      </View>

      {/* Satisfaction meter */}
      <SatisfactionMeter satisfaction={satisfaction} />

      {/* 5-year plan demands */}
      <View style={componentStyles.section}>
        <Text style={componentStyles.sectionHeading}>5-YEAR PLAN DEMANDS</Text>
        {demands.length === 0 ? (
          <Text style={componentStyles.emptyText}>No current demands from Moscow</Text>
        ) : (
          demands.map((d) => <DemandRow key={d.type} demand={d} />)
        )}
      </View>

      {/* Prestige project */}
      <PrestigeSection project={prestigeProject} />

      {/* Accept mandate button */}
      <TouchableOpacity
        style={componentStyles.mandateButton}
        onPress={onAcceptMandate}
        activeOpacity={0.7}
        testID="accept-mandate-btn"
      >
        <Text style={componentStyles.mandateButtonText}>ACCEPT NEW MANDATE</Text>
      </TouchableOpacity>
    </View>
  );
};

// ── Styles ──────────────────────────────────────────────────────────────────

const componentStyles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  banner: {
    backgroundColor: Colors.sovietRed,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.sovietDarkRed,
  },
  bannerText: {
    fontFamily: monoFont,
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 3,
    textAlign: 'center',
  },
  section: {
    marginBottom: 12,
  },
  sectionHeading: {
    fontFamily: monoFont,
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 1.5,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.sovietGold,
    paddingBottom: 4,
  },
  emptyText: {
    fontFamily: monoFont,
    fontSize: 10,
    color: Colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 8,
  },
  mandateButton: {
    backgroundColor: Colors.sovietRed,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderTopColor: '#ff5252',
    borderLeftColor: '#ff5252',
    borderBottomColor: Colors.sovietDarkRed,
    borderRightColor: Colors.sovietDarkRed,
    alignItems: 'center',
    marginTop: 8,
  },
  mandateButtonText: {
    fontFamily: monoFont,
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 2,
  },
});

const demandStyles = StyleSheet.create({
  row: {
    marginBottom: 10,
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: '#1e2226',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  type: {
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    letterSpacing: 1,
  },
  deadline: {
    fontFamily: monoFont,
    fontSize: 9,
    color: Colors.textMuted,
  },
  met: {
    color: Colors.termGreen,
    fontWeight: 'bold',
  },
  barOuter: {
    height: 8,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#555',
    marginBottom: 2,
  },
  barFill: {
    height: '100%',
    backgroundColor: Colors.sovietRed,
  },
  barFillMet: {
    backgroundColor: Colors.termGreen,
  },
  status: {
    fontFamily: monoFont,
    fontSize: 9,
    color: Colors.textSecondary,
    textAlign: 'right',
  },
});

const meterStyles = StyleSheet.create({
  container: {
    marginBottom: 14,
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.sovietGold,
    backgroundColor: '#1e2226',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 1,
  },
  label: {
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  barOuter: {
    height: 10,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#555',
    marginBottom: 4,
  },
  barFill: {
    height: '100%',
  },
  value: {
    fontFamily: monoFont,
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'right',
  },
});

const prestigeStyles = StyleSheet.create({
  container: {
    marginBottom: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.sovietGold,
    backgroundColor: '#1e2226',
  },
  heading: {
    fontFamily: monoFont,
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  name: {
    fontFamily: monoFont,
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  none: {
    fontFamily: monoFont,
    fontSize: 10,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  barOuter: {
    height: 10,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#555',
    marginBottom: 4,
  },
  barFill: {
    height: '100%',
    backgroundColor: Colors.sovietGold,
  },
  progress: {
    fontFamily: monoFont,
    fontSize: 9,
    color: Colors.textSecondary,
    textAlign: 'right',
  },
});
