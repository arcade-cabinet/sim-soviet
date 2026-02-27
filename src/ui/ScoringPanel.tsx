/**
 * ScoringPanel -- Live scoring tracker panel.
 *
 * Shows the current score, per-era breakdown with bar charts,
 * difficulty/consequence labels, and earned medals.
 * Uses SovietModal with terminal variant for dark-panel aesthetic.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SovietModal } from './SovietModal';
import { Colors, monoFont } from './styles';
import { useGameSnapshot } from '../hooks/useGameState';
import { getEngine } from '../bridge/GameInit';
import type {
  DifficultyLevel,
  ConsequenceLevel,
  EraScoreBreakdown,
  Medal,
} from '../game/ScoringSystem';

// ---------------------------------------------------------------------------
//  Props
// ---------------------------------------------------------------------------

export interface ScoringPanelProps {
  visible: boolean;
  onDismiss: () => void;
}

// ---------------------------------------------------------------------------
//  Constants
// ---------------------------------------------------------------------------

const DIFFICULTY_COLORS: Record<DifficultyLevel, string> = {
  worker: Colors.termGreen,
  comrade: Colors.sovietGold,
  tovarish: Colors.sovietRed,
};

const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  worker: 'WORKER',
  comrade: 'COMRADE',
  tovarish: 'TOVARISH',
};

const CONSEQUENCE_LABELS: Record<ConsequenceLevel, string> = {
  forgiving: 'FORGIVING',
  permadeath: 'PERMADEATH',
  harsh: 'HARSH',
};

const MEDAL_TIER_COLORS: Record<string, string> = {
  tin: '#9e9e9e',
  copper: '#ff9800',
  bronze: Colors.sovietGold,
  iron: Colors.termBlue,
  concrete: Colors.termGreen,
};

/** Score categories rendered in the breakdown section. */
interface BreakdownCategory {
  label: string;
  /** Extract the points value for this category from an era breakdown. */
  extract: (era: EraScoreBreakdown) => number;
  color: string;
}

const BREAKDOWN_CATEGORIES: BreakdownCategory[] = [
  { label: 'WORKERS ALIVE', extract: (e) => e.workersAlivePoints, color: Colors.termGreen },
  { label: 'QUOTAS MET', extract: (e) => e.quotasMetPoints, color: Colors.sovietGold },
  { label: 'QUOTAS EXCEEDED', extract: (e) => e.quotasExceededPoints, color: Colors.termBlue },
  { label: 'BUILDINGS', extract: (e) => e.buildingsStandingPoints, color: '#ff9800' },
  { label: 'COMMENDATIONS', extract: (e) => e.commendationsPoints, color: Colors.sovietGold },
  { label: 'BLACK MARKS', extract: (e) => e.blackMarksPoints, color: Colors.sovietRed },
  { label: 'KGB LOSSES', extract: (e) => e.kgbLossesPoints, color: Colors.sovietRed },
  { label: 'CONSCRIPTED', extract: (e) => e.conscriptedPoints, color: '#ff9800' },
  { label: 'CLEAN ERA', extract: (e) => e.cleanEraBonus, color: Colors.termGreen },
];

// ---------------------------------------------------------------------------
//  Sub-components
// ---------------------------------------------------------------------------

/** Section header with gold text and bottom border. */
const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <Text style={styles.sectionTitle}>{title}</Text>
);

/** Horizontal divider between sections. */
const Divider: React.FC = () => <View style={styles.divider} />;

/** Progress bar with configurable color. */
const ProgressBar: React.FC<{ ratio: number; color: string; height?: number }> = ({
  ratio,
  color,
  height = 10,
}) => {
  const clamped = Math.max(0, Math.min(ratio, 1));
  return (
    <View style={[styles.barTrack, { height }]}>
      <View
        style={[
          styles.barFill,
          {
            width: `${Math.round(clamped * 100)}%`,
            backgroundColor: color,
            height: '100%',
          },
        ]}
      />
    </View>
  );
};

/** Single medal card in the grid. */
const MedalCard: React.FC<{ medal: Medal }> = ({ medal }) => {
  const tierColor = MEDAL_TIER_COLORS[medal.tier] ?? '#9e9e9e';
  return (
    <View style={styles.medalCard}>
      <Text style={[styles.medalIcon, { color: tierColor }]}>{'\u2605'}</Text>
      <Text style={[styles.medalName, { color: tierColor }]} numberOfLines={2}>
        {medal.name}
      </Text>
      <Text style={styles.medalTier}>{medal.tier.toUpperCase()}</Text>
    </View>
  );
};

// ---------------------------------------------------------------------------
//  Main Component
// ---------------------------------------------------------------------------

export const ScoringPanel: React.FC<ScoringPanelProps> = ({ visible, onDismiss }) => {
  // Subscribe to game state for re-renders
  useGameSnapshot();

  const engine = getEngine();
  const scoring = engine?.getScoring() ?? null;

  if (!visible) return null;

  // --- Score data ---
  const breakdown = scoring?.getScoreBreakdown() ?? null;
  const finalScore = breakdown?.finalScore ?? 0;
  const difficulty = scoring?.getDifficulty() ?? 'comrade';
  const consequence = scoring?.getConsequence() ?? 'permadeath';
  const settingsMultiplier = breakdown?.settingsMultiplier ?? 1;
  const medals = scoring?.getAwardedMedals() ?? [];
  const eras = breakdown?.eras ?? [];

  // --- Aggregate category totals across all completed eras ---
  const categoryTotals = BREAKDOWN_CATEGORIES.map((cat) => {
    const total = eras.reduce((sum, era) => sum + cat.extract(era), 0);
    return { ...cat, total };
  });

  // Find the max absolute value for bar scaling
  const maxAbsTotal = Math.max(
    1,
    ...categoryTotals.map((c) => Math.abs(c.total))
  );

  return (
    <SovietModal
      visible={visible}
      variant="terminal"
      title="SCORING"
      stampText="STATE REVIEW"
      actionLabel="CLOSE"
      onAction={onDismiss}
      dismissOnOverlay
      onDismiss={onDismiss}
    >
      {/* -- CURRENT SCORE -------------------------------------------- */}
      <SectionHeader title="CURRENT SCORE" />

      <View style={styles.scoreBlock}>
        <Text style={styles.bigScore}>{finalScore.toLocaleString()}</Text>
        <Text style={styles.scoreUnit}>POINTS</Text>
      </View>

      <View style={styles.labelsRow}>
        <View style={styles.labelPill}>
          <Text style={styles.labelPillCaption}>DIFFICULTY</Text>
          <Text style={[styles.labelPillValue, { color: DIFFICULTY_COLORS[difficulty] }]}>
            {DIFFICULTY_LABELS[difficulty]}
          </Text>
        </View>
        <View style={styles.labelPill}>
          <Text style={styles.labelPillCaption}>CONSEQUENCE</Text>
          <Text style={[styles.labelPillValue, { color: Colors.textPrimary }]}>
            {CONSEQUENCE_LABELS[consequence]}
          </Text>
        </View>
        <View style={styles.labelPill}>
          <Text style={styles.labelPillCaption}>MULTIPLIER</Text>
          <Text style={[styles.labelPillValue, { color: Colors.termBlue }]}>
            x{settingsMultiplier.toFixed(1)}
          </Text>
        </View>
      </View>

      <Divider />

      {/* -- SCORE BREAKDOWN ------------------------------------------ */}
      <SectionHeader title="SCORE BREAKDOWN" />

      {eras.length === 0 ? (
        <Text style={styles.emptyText}>No eras completed yet. The ledger awaits.</Text>
      ) : (
        <>
          {categoryTotals.map((cat) => (
            <View key={cat.label} style={styles.breakdownRow}>
              <View style={styles.breakdownLabelRow}>
                <Text style={styles.breakdownLabel}>{cat.label}</Text>
                <Text
                  style={[
                    styles.breakdownValue,
                    { color: cat.total >= 0 ? cat.color : Colors.sovietRed },
                  ]}
                >
                  {cat.total >= 0 ? '+' : ''}{cat.total}
                </Text>
              </View>
              <View style={styles.barRow}>
                <ProgressBar
                  ratio={Math.abs(cat.total) / maxAbsTotal}
                  color={cat.total >= 0 ? cat.color : Colors.sovietRed}
                  height={8}
                />
              </View>
            </View>
          ))}

          {/* Per-era subtotals */}
          <View style={styles.eraSubtotals}>
            <Text style={styles.eraSubtotalHeader}>ERA TOTALS</Text>
            {eras.map((era) => (
              <View key={era.eraIndex} style={styles.row}>
                <Text style={styles.eraName} numberOfLines={1}>
                  {era.eraName}
                </Text>
                <Text style={styles.eraMultiplier}>x{era.eraMultiplier.toFixed(1)}</Text>
                <Text style={styles.eraTotal}>{era.eraTotal.toLocaleString()}</Text>
              </View>
            ))}
            <View style={[styles.row, styles.subtotalRow]}>
              <Text style={styles.subtotalLabel}>SUBTOTAL</Text>
              <Text style={styles.subtotalValue}>
                {(breakdown?.subtotal ?? 0).toLocaleString()}
              </Text>
            </View>
          </View>
        </>
      )}

      <Divider />

      {/* -- MEDALS EARNED --------------------------------------------- */}
      <SectionHeader title="MEDALS EARNED" />

      {medals.length === 0 ? (
        <Text style={styles.emptyText}>No medals yet. The Party is disappointed.</Text>
      ) : (
        <View style={styles.medalGrid}>
          {medals.map((medal) => (
            <MedalCard key={medal.id} medal={medal} />
          ))}
        </View>
      )}
    </SovietModal>
  );
};

// ---------------------------------------------------------------------------
//  Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
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
  divider: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    marginVertical: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },

  // -- Current Score --
  scoreBlock: {
    alignItems: 'center',
    marginBottom: 12,
  },
  bigScore: {
    fontSize: 28,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 2,
  },
  scoreUnit: {
    fontSize: 10,
    fontFamily: monoFont,
    color: Colors.textSecondary,
    letterSpacing: 3,
    marginTop: 2,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 4,
  },
  labelPill: {
    alignItems: 'center',
  },
  labelPillCaption: {
    fontSize: 8,
    fontFamily: monoFont,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: 2,
  },
  labelPillValue: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  // -- Breakdown --
  breakdownRow: {
    marginBottom: 6,
  },
  breakdownLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  breakdownLabel: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  breakdownValue: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  barTrack: {
    flex: 1,
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#444',
  },
  barFill: {
    // height set inline
  },

  // -- Era subtotals --
  eraSubtotals: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  eraSubtotalHeader: {
    fontSize: 9,
    fontFamily: monoFont,
    color: Colors.textMuted,
    letterSpacing: 2,
    marginBottom: 6,
  },
  eraName: {
    flex: 1,
    fontSize: 10,
    fontFamily: monoFont,
    color: Colors.textSecondary,
  },
  eraMultiplier: {
    fontSize: 10,
    fontFamily: monoFont,
    color: Colors.termBlue,
    marginHorizontal: 8,
  },
  eraTotal: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    minWidth: 50,
    textAlign: 'right',
  },
  subtotalRow: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 4,
  },
  subtotalLabel: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 1,
  },
  subtotalValue: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    minWidth: 50,
    textAlign: 'right',
  },

  // -- Empty state --
  emptyText: {
    fontSize: 10,
    fontFamily: monoFont,
    fontStyle: 'italic',
    color: Colors.textMuted,
    textAlign: 'center',
    marginVertical: 8,
  },

  // -- Medals grid --
  medalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  medalCard: {
    width: 90,
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#444',
    padding: 8,
    alignItems: 'center',
  },
  medalIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  medalName: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 2,
  },
  medalTier: {
    fontSize: 7,
    fontFamily: monoFont,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
});
