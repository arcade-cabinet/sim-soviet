/**
 * DiseasePanel — Medical report panel showing disease outbreaks and health status.
 *
 * Iterates ECS citizen entities to compute outbreak data: total citizens,
 * sick count, disease-type breakdown, and infection rate. Displays in a
 * terminal-variant SovietModal with health status bar and disease cards.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SovietModal } from './SovietModal';
import { Colors, monoFont } from './styles';
import { useGameSnapshot } from '../hooks/useGameState';
import { citizens } from '../ecs/archetypes';

// ── Disease Definitions ──────────────────────────────────────────────────────

const DISEASE_INFO: Record<string, { name: string; icon: string; color: string; desc: string }> = {
  typhus: { name: 'TYPHUS', icon: '\u2620', color: Colors.sovietRed, desc: 'High spread, moderate mortality' },
  cholera: { name: 'CHOLERA', icon: '\u2623', color: '#ff5722', desc: 'Moderate spread, high mortality' },
  influenza: { name: 'INFLUENZA', icon: '\u{1F912}', color: Colors.sovietGold, desc: 'Very high spread, low mortality' },
  scurvy: { name: 'SCURVY', icon: '\u{1F34A}', color: '#ff9800', desc: 'Nutritional, no spread' },
};

// ── Types ────────────────────────────────────────────────────────────────────

export interface DiseasePanelProps {
  visible: boolean;
  onDismiss: () => void;
}

interface DiseaseBreakdown {
  type: string;
  count: number;
}

interface HealthSummary {
  totalCitizens: number;
  healthyCitizens: number;
  sickCitizens: number;
  infectionRate: number;
  diseaseBreakdown: DiseaseBreakdown[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Return severity color based on infected count relative to total population. */
function severityColor(infected: number, total: number): string {
  if (total === 0) return Colors.textMuted;
  const ratio = infected / total;
  if (ratio >= 0.2) return Colors.sovietRed;
  if (ratio >= 0.05) return Colors.sovietGold;
  return Colors.termGreen;
}

// ── Sub-components ───────────────────────────────────────────────────────────

/** Section header with gold text and bottom border. */
const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <Text style={styles.sectionTitle}>{title}</Text>
);

/** Horizontal divider between sections. */
const Divider: React.FC = () => <View style={styles.divider} />;

/** Summary stat box. */
const SummaryStat: React.FC<{ label: string; value: string; color: string }> = ({
  label,
  value,
  color,
}) => (
  <View style={styles.summaryStatBox}>
    <Text style={[styles.summaryValue, { color }]}>{value}</Text>
    <Text style={styles.summaryLabel}>{label}</Text>
  </View>
);

/** Individual disease card. */
const DiseaseCard: React.FC<{
  type: string;
  count: number;
  total: number;
}> = ({ type, count, total }) => {
  const info = DISEASE_INFO[type];
  if (!info) return null;

  const sColor = severityColor(count, total);
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <View style={styles.diseaseCard}>
      <View style={styles.diseaseCardHeader}>
        <Text style={[styles.diseaseIcon, { color: info.color }]}>{info.icon}</Text>
        <Text style={[styles.diseaseName, { color: info.color }]}>{info.name}</Text>
        <Text style={[styles.diseaseCount, { color: sColor }]}>{count}</Text>
      </View>

      {/* Infection bar */}
      <View style={styles.diseaseBarTrack}>
        <View
          style={[
            styles.diseaseBarFill,
            {
              width: `${Math.min(pct, 100)}%`,
              backgroundColor: sColor,
            },
          ]}
        />
      </View>

      <View style={styles.diseaseCardFooter}>
        <Text style={styles.diseaseDesc}>{info.desc}</Text>
        <Text style={[styles.diseasePct, { color: sColor }]}>{pct}%</Text>
      </View>
    </View>
  );
};

// ── Main Component ───────────────────────────────────────────────────────────

export const DiseasePanel: React.FC<DiseasePanelProps> = ({ visible, onDismiss }) => {
  // Subscribe so the panel re-renders on game ticks
  useGameSnapshot();

  // Scan all citizen entities for disease data
  const summary: HealthSummary = useMemo(() => {
    const allCitizens = citizens.entities;
    const totalCitizens = allCitizens.length;

    const diseaseCounts: Record<string, number> = {};
    let sickCitizens = 0;

    for (const entity of allCitizens) {
      const disease = entity.citizen.disease;
      if (disease) {
        sickCitizens++;
        diseaseCounts[disease.type] = (diseaseCounts[disease.type] ?? 0) + 1;
      }
    }

    const healthyCitizens = totalCitizens - sickCitizens;
    const infectionRate = totalCitizens > 0 ? Math.round((sickCitizens / totalCitizens) * 100) : 0;

    // Build sorted breakdown (highest count first)
    const diseaseBreakdown: DiseaseBreakdown[] = Object.entries(diseaseCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalCitizens,
      healthyCitizens,
      sickCitizens,
      infectionRate,
      diseaseBreakdown,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [citizens.entities.length]);

  if (!visible) return null;

  const hasOutbreaks = summary.diseaseBreakdown.length > 0;
  const healthyPct = summary.totalCitizens > 0
    ? Math.round((summary.healthyCitizens / summary.totalCitizens) * 100)
    : 100;
  const sickPct = 100 - healthyPct;

  return (
    <SovietModal
      visible={visible}
      variant="terminal"
      title="MEDICAL REPORT"
      stampText="CLASSIFIED"
      actionLabel="DISMISS"
      onAction={onDismiss}
      dismissOnOverlay
      onDismiss={onDismiss}
    >
      {/* ── Summary Row ──────────────────────────────────────────── */}
      <SectionHeader title="POPULATION HEALTH STATUS" />

      <View style={styles.summaryRow}>
        <SummaryStat
          label="TOTAL"
          value={String(summary.totalCitizens)}
          color={Colors.white}
        />
        <SummaryStat
          label="HEALTHY"
          value={String(summary.healthyCitizens)}
          color={Colors.termGreen}
        />
        <SummaryStat
          label="SICK"
          value={String(summary.sickCitizens)}
          color={summary.sickCitizens > 0 ? Colors.sovietRed : Colors.textMuted}
        />
        <SummaryStat
          label="INF. RATE"
          value={`${summary.infectionRate}%`}
          color={
            summary.infectionRate >= 20
              ? Colors.sovietRed
              : summary.infectionRate >= 5
                ? Colors.sovietGold
                : Colors.termGreen
          }
        />
      </View>

      <Divider />

      {/* ── Health Status Bar ────────────────────────────────────── */}
      <SectionHeader title="HEALTH INDEX" />

      <View style={styles.healthBarTrack}>
        {healthyPct > 0 && (
          <View
            style={[
              styles.healthBarSegment,
              {
                width: `${healthyPct}%`,
                backgroundColor: Colors.termGreen,
              },
            ]}
          />
        )}
        {sickPct > 0 && (
          <View
            style={[
              styles.healthBarSegment,
              {
                width: `${sickPct}%`,
                backgroundColor: Colors.sovietRed,
              },
            ]}
          />
        )}
      </View>

      <View style={styles.healthBarLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.termGreen }]} />
          <Text style={styles.legendLabel}>HEALTHY {healthyPct}%</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.sovietRed }]} />
          <Text style={styles.legendLabel}>SICK {sickPct}%</Text>
        </View>
      </View>

      <Divider />

      {/* ── Disease Breakdown ────────────────────────────────────── */}
      <SectionHeader title="ACTIVE OUTBREAKS" />

      {hasOutbreaks ? (
        summary.diseaseBreakdown.map((d) => (
          <DiseaseCard
            key={d.type}
            type={d.type}
            count={d.count}
            total={summary.totalCitizens}
          />
        ))
      ) : (
        <View style={styles.noOutbreakBox}>
          <Text style={styles.noOutbreakText}>
            No active outbreaks. Glory to Soviet medicine!
          </Text>
        </View>
      )}
    </SovietModal>
  );
};

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Section header ──
  sectionTitle: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 2,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingBottom: 4,
  },

  // ── Divider ──
  divider: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    marginVertical: 12,
  },

  // ── Summary row ──
  summaryRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  summaryStatBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#222',
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  summaryValue: {
    fontSize: 16,
    fontFamily: monoFont,
    fontWeight: 'bold',
  },
  summaryLabel: {
    fontSize: 7,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#9e9e9e',
    letterSpacing: 1,
    marginTop: 2,
  },

  // ── Health status bar ──
  healthBarTrack: {
    flexDirection: 'row',
    height: 14,
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#444',
    overflow: 'hidden',
    marginBottom: 6,
  },
  healthBarSegment: {
    height: '100%',
  },
  healthBarLegend: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    letterSpacing: 1,
  },

  // ── Disease cards ──
  diseaseCard: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    padding: 10,
    marginBottom: 8,
  },
  diseaseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  diseaseIcon: {
    fontSize: 16,
  },
  diseaseName: {
    flex: 1,
    fontSize: 12,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  diseaseCount: {
    fontSize: 18,
    fontFamily: monoFont,
    fontWeight: 'bold',
  },
  diseaseBarTrack: {
    height: 6,
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#444',
    overflow: 'hidden',
    marginBottom: 6,
  },
  diseaseBarFill: {
    height: '100%',
  },
  diseaseCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  diseaseDesc: {
    flex: 1,
    fontSize: 9,
    fontFamily: monoFont,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  diseasePct: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    marginLeft: 8,
  },

  // ── No outbreaks ──
  noOutbreakBox: {
    backgroundColor: '#1a2a1a',
    borderWidth: 1,
    borderColor: '#2e7d32',
    padding: 12,
    alignItems: 'center',
  },
  noOutbreakText: {
    fontSize: 11,
    fontFamily: monoFont,
    color: Colors.termGreen,
    fontStyle: 'italic',
    textAlign: 'center',
    letterSpacing: 1,
  },
});
