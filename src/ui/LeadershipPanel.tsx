/**
 * LeadershipPanel — Politburo dossier view.
 *
 * Displays the General Secretary, all 10 Ministers with stats/bars,
 * active policy modifiers that deviate from baseline, and succession
 * history of past leaders. Accessible from the STATE tab or TopBar.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SovietModal } from './SovietModal';
import { Colors, monoFont } from './styles';
import { getEngine } from '../bridge/GameInit';
import { useGameSnapshot } from '../hooks/useGameState';
import { Ministry, PersonalityType } from '../game/politburo/types';
import type {
  GeneralSecretary,
  Minister,
  MinistryModifiers,
} from '../game/politburo/types';

// ─────────────────────────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Color for each personality archetype. */
const PERSONALITY_COLORS: Record<PersonalityType, string> = {
  [PersonalityType.ZEALOT]: Colors.sovietRed,
  [PersonalityType.IDEALIST]: '#42a5f5',
  [PersonalityType.REFORMER]: Colors.termGreen,
  [PersonalityType.TECHNOCRAT]: '#9e9e9e',
  [PersonalityType.APPARATCHIK]: Colors.sovietGold,
  [PersonalityType.POPULIST]: '#ab47bc',
  [PersonalityType.MILITARIST]: '#827717',
  [PersonalityType.MYSTIC]: '#26c6da',
};

/** Short display names for ministries. */
const MINISTRY_SHORT_NAMES: Record<Ministry, string> = {
  [Ministry.KGB]: 'KGB',
  [Ministry.AGRICULTURE]: 'AGRICULTURE',
  [Ministry.HEAVY_INDUSTRY]: 'HEAVY INDUSTRY',
  [Ministry.CULTURE]: 'CULTURE',
  [Ministry.DEFENSE]: 'DEFENSE',
  [Ministry.MVD]: 'MVD',
  [Ministry.GOSPLAN]: 'GOSPLAN',
  [Ministry.HEALTH]: 'HEALTH',
  [Ministry.EDUCATION]: 'EDUCATION',
  [Ministry.TRANSPORT]: 'TRANSPORT',
};

/** Ministry iteration order for consistent rendering. */
const MINISTRY_ORDER: Ministry[] = [
  Ministry.KGB,
  Ministry.GOSPLAN,
  Ministry.AGRICULTURE,
  Ministry.HEAVY_INDUSTRY,
  Ministry.DEFENSE,
  Ministry.MVD,
  Ministry.CULTURE,
  Ministry.HEALTH,
  Ministry.EDUCATION,
  Ministry.TRANSPORT,
];

/** Human-readable labels for modifiers shown in the active modifiers section. */
const MODIFIER_LABELS: Partial<Record<keyof MinistryModifiers, string>> = {
  foodProductionMult: 'FOOD PRODUCTION',
  vodkaProductionMult: 'VODKA PRODUCTION',
  factoryOutputMult: 'FACTORY OUTPUT',
  buildingCostMult: 'BUILDING COST',
  techResearchMult: 'TECH RESEARCH',
  moraleModifier: 'MORALE',
  purgeFrequencyMult: 'PURGE FREQUENCY',
  fearLevel: 'FEAR LEVEL',
  populationGrowthMult: 'POP GROWTH',
  quotaDifficultyMult: 'QUOTA DIFFICULTY',
  hospitalEffectiveness: 'HOSPITAL EFFECT.',
  literacyRate: 'LITERACY',
  pollutionMult: 'POLLUTION',
  infrastructureDecayMult: 'DECAY RATE',
  corruptionDrain: 'CORRUPTION DRAIN',
  accidentRate: 'ACCIDENT RATE',
  supplyChainDelayMult: 'SUPPLY DELAY',
  propagandaIntensity: 'PROPAGANDA',
};

/** Cause of death display strings. */
const DEATH_LABELS: Record<string, string> = {
  natural: 'Natural causes',
  coup: 'Palace coup',
  purged_by_successor: 'Purged by successor',
  assassination: 'Assassination',
};

// ─────────────────────────────────────────────────────────────────────────────
//  PROPS
// ─────────────────────────────────────────────────────────────────────────────

export interface LeadershipPanelProps {
  visible: boolean;
  onDismiss: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
//  SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/** Colored personality badge. */
const PersonalityBadge: React.FC<{ personality: PersonalityType }> = ({ personality }) => {
  const color = PERSONALITY_COLORS[personality] ?? '#888';
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>
        {personality.toUpperCase()}
      </Text>
    </View>
  );
};

/** Horizontal stat bar (0-100) with threshold coloring. */
const StatBar: React.FC<{
  value: number;
  max?: number;
  lowColor?: string;
  midColor?: string;
  highColor?: string;
  width?: number;
}> = ({
  value,
  max = 100,
  lowColor = Colors.sovietRed,
  midColor = Colors.sovietGold,
  highColor = Colors.termGreen,
  width = 60,
}) => {
  const clamped = Math.max(0, Math.min(value, max));
  const pct = (clamped / max) * 100;
  const barColor = clamped < 30 ? lowColor : clamped < 60 ? midColor : highColor;

  return (
    <View style={[styles.barTrack, { width }]}>
      <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: barColor }]} />
      <Text style={styles.barValue}>{Math.round(clamped)}</Text>
    </View>
  );
};

/** General Secretary section. */
const GeneralSecretarySection: React.FC<{ gs: GeneralSecretary }> = ({ gs }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>GENERAL SECRETARY</Text>
    <View style={styles.gsCard}>
      <View style={styles.gsRow}>
        <Text style={styles.gsName}>{gs.name}</Text>
        <PersonalityBadge personality={gs.personality} />
      </View>
      <View style={styles.gsStatsRow}>
        <Text style={styles.gsStatLabel}>AGE: {gs.age}</Text>
        <Text style={styles.gsStatLabel}>IN POWER SINCE: {gs.yearAppointed}</Text>
      </View>
      <View style={styles.gsBarRow}>
        <Text style={styles.barLabel}>PARANOIA</Text>
        <StatBar
          value={gs.paranoia}
          lowColor={Colors.termGreen}
          midColor={Colors.sovietGold}
          highColor={Colors.sovietRed}
          width={80}
        />
      </View>
      <View style={styles.gsBarRow}>
        <Text style={styles.barLabel}>HEALTH</Text>
        <StatBar value={gs.health} width={80} />
      </View>
    </View>
  </View>
);

/** Single minister row in the table. */
const MinisterRow: React.FC<{ ministry: Ministry; minister: Minister }> = ({
  ministry,
  minister,
}) => (
  <View style={styles.ministerRow}>
    {/* Ministry name */}
    <View style={styles.ministryCol}>
      <Text style={styles.ministryName} numberOfLines={1}>
        {MINISTRY_SHORT_NAMES[ministry]}
      </Text>
    </View>

    {/* Minister name + personality */}
    <View style={styles.nameCol}>
      <Text style={styles.ministerName} numberOfLines={1}>
        {minister.name}
      </Text>
      <PersonalityBadge personality={minister.personality} />
    </View>

    {/* Loyalty bar */}
    <View style={styles.statCol}>
      <Text style={styles.statHeader}>LOY</Text>
      <StatBar value={minister.loyalty} width={44} />
    </View>

    {/* Competence bar */}
    <View style={styles.statCol}>
      <Text style={styles.statHeader}>CMP</Text>
      <StatBar
        value={minister.competence}
        lowColor="#ff9800"
        midColor={Colors.sovietGold}
        highColor={Colors.termGreen}
        width={44}
      />
    </View>

    {/* Corruption indicator */}
    <View style={styles.corruptCol}>
      {minister.corruption > 50 ? (
        <Text style={styles.corruptIcon}>{'\u2620'}</Text>
      ) : (
        <Text style={styles.corruptClean}>{'\u2014'}</Text>
      )}
    </View>
  </View>
);

/** Ministers table section. */
const MinistersSection: React.FC<{ ministers: Map<Ministry, Minister> }> = ({ ministers }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>MINISTERS</Text>

    {/* Column headers */}
    <View style={styles.ministerHeaderRow}>
      <View style={styles.ministryCol}>
        <Text style={styles.colHeader}>MINISTRY</Text>
      </View>
      <View style={styles.nameCol}>
        <Text style={styles.colHeader}>NAME / TYPE</Text>
      </View>
      <View style={styles.statCol}>
        <Text style={styles.colHeader}>LOY</Text>
      </View>
      <View style={styles.statCol}>
        <Text style={styles.colHeader}>CMP</Text>
      </View>
      <View style={styles.corruptCol}>
        <Text style={styles.colHeader}>COR</Text>
      </View>
    </View>

    {/* Minister rows */}
    {MINISTRY_ORDER.map((ministry) => {
      const minister = ministers.get(ministry);
      if (!minister) return null;
      return (
        <MinisterRow
          key={ministry}
          ministry={ministry}
          minister={minister}
        />
      );
    })}
  </View>
);

/** Active modifiers section — only shows values that differ from baseline. */
const ModifiersSection: React.FC<{ modifiers: Readonly<MinistryModifiers> }> = ({ modifiers }) => {
  // Collect modifiers that deviate from baseline (1.0 for multipliers, 0 for flat values)
  const deviations: Array<{ key: string; label: string; value: number; isMult: boolean }> = [];

  for (const [key, label] of Object.entries(MODIFIER_LABELS)) {
    const val = modifiers[key as keyof MinistryModifiers];
    if (typeof val !== 'number') continue;

    // Multipliers baseline at 1.0; flat values baseline at 0 (except fearLevel=30, literacyRate=50)
    const isMultiplier = key.endsWith('Mult');
    const baseline = isMultiplier ? 1.0 : key === 'fearLevel' ? 30 : key === 'literacyRate' ? 50 : 0;
    const diff = Math.abs(val - baseline);

    if (diff > 0.01) {
      deviations.push({ key, label: label!, value: val, isMult: isMultiplier });
    }
  }

  if (deviations.length === 0) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ACTIVE MODIFIERS</Text>
        <Text style={styles.noModifiers}>All modifiers at baseline. The system hums.</Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>ACTIVE MODIFIERS</Text>
      {deviations.map((mod) => {
        // Determine if beneficial or harmful
        // For cost/purge/fear/corruption/decay/pollution/accident/supply/quota mults: lower is better
        const inverseMods = [
          'buildingCostMult',
          'purgeFrequencyMult',
          'fearLevel',
          'corruptionDrain',
          'quotaDifficultyMult',
          'infrastructureDecayMult',
          'pollutionMult',
          'accidentRate',
          'supplyChainDelayMult',
        ];
        const isInverse = inverseMods.includes(mod.key);
        const baseline = mod.isMult ? 1.0 : mod.key === 'fearLevel' ? 30 : mod.key === 'literacyRate' ? 50 : 0;
        const isAboveBaseline = mod.value > baseline;
        const isBeneficial = isInverse ? !isAboveBaseline : isAboveBaseline;
        const valueColor = isBeneficial ? Colors.termGreen : Colors.sovietRed;

        let displayValue: string;
        if (mod.isMult) {
          const pctChange = ((mod.value - 1.0) * 100).toFixed(0);
          displayValue = `${Number(pctChange) >= 0 ? '+' : ''}${pctChange}%`;
        } else {
          displayValue = mod.value.toFixed(1);
        }

        return (
          <View key={mod.key} style={styles.modifierRow}>
            <Text style={styles.modifierLabel}>{mod.label}</Text>
            <Text style={[styles.modifierValue, { color: valueColor }]}>{displayValue}</Text>
          </View>
        );
      })}
    </View>
  );
};

/** Succession history section — past leaders. */
const SuccessionSection: React.FC<{ history: GeneralSecretary[] }> = ({ history }) => {
  if (history.length === 0) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SUCCESSION HISTORY</Text>
        <Text style={styles.noModifiers}>No prior leaders. The current regime is the first.</Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>SUCCESSION HISTORY</Text>
      {[...history].reverse().map((leader, i) => {
        const personalityColor = PERSONALITY_COLORS[leader.personality] ?? '#888';
        const deathText = leader.causeOfDeath
          ? DEATH_LABELS[leader.causeOfDeath] ?? 'Unknown'
          : 'Unknown';

        return (
          <View key={`${leader.id}-${i}`} style={styles.historyRow}>
            <View style={styles.historyNameRow}>
              <Text style={styles.historyName}>{leader.name}</Text>
              <Text style={[styles.historyPersonality, { color: personalityColor }]}>
                {leader.personality.toUpperCase()}
              </Text>
            </View>
            <View style={styles.historyDetailRow}>
              <Text style={styles.historyDetail}>
                {leader.yearAppointed} {'\u00B7'} Age {leader.age} {'\u00B7'} {deathText}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const LeadershipPanel: React.FC<LeadershipPanelProps> = ({ visible, onDismiss }) => {
  // Subscribe to game ticks so the panel re-renders with fresh data
  useGameSnapshot();

  const engine = getEngine();
  const politburo = engine?.getPolitburo();

  if (!visible || !politburo) return null;

  const state = politburo.getState();
  const gs = politburo.getGeneralSecretary();
  const modifiers = politburo.getModifiers();

  return (
    <SovietModal
      visible={visible}
      variant="terminal"
      title="POLITBURO DOSSIER"
      stampText="CLASSIFIED"
      actionLabel="CLOSE DOSSIER"
      onAction={onDismiss}
      dismissOnOverlay
      onDismiss={onDismiss}
    >
      <GeneralSecretarySection gs={gs} />
      <MinistersSection ministers={state.ministers} />
      <ModifiersSection modifiers={modifiers} />
      <SuccessionSection history={state.leaderHistory} />
    </SovietModal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Sections ──
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 2,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingBottom: 4,
  },

  // ── General Secretary ──
  gsCard: {
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#444',
    padding: 10,
  },
  gsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  gsName: {
    fontSize: 16,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.white,
    flex: 1,
  },
  gsStatsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  gsStatLabel: {
    fontSize: 10,
    fontFamily: monoFont,
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  gsBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },

  // ── Bars ──
  barLabel: {
    fontSize: 9,
    fontFamily: monoFont,
    color: '#9e9e9e',
    letterSpacing: 1,
    width: 64,
  },
  barTrack: {
    height: 12,
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#555',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  barFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  barValue: {
    fontSize: 8,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.white,
    textAlign: 'center',
    width: '100%',
    zIndex: 1,
  },

  // ── Personality Badge ──
  badge: {
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeText: {
    fontSize: 7,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  // ── Ministers Table ──
  ministerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
    marginBottom: 4,
  },
  colHeader: {
    fontSize: 8,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#777',
    letterSpacing: 1,
  },
  ministerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  ministryCol: {
    width: 90,
    paddingRight: 4,
  },
  ministryName: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 0.5,
  },
  nameCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 4,
  },
  ministerName: {
    fontSize: 10,
    fontFamily: monoFont,
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  statCol: {
    width: 50,
    alignItems: 'center',
  },
  statHeader: {
    fontSize: 7,
    fontFamily: monoFont,
    color: '#666',
    letterSpacing: 1,
    marginBottom: 2,
  },
  corruptCol: {
    width: 24,
    alignItems: 'center',
  },
  corruptIcon: {
    fontSize: 14,
    color: Colors.sovietRed,
  },
  corruptClean: {
    fontSize: 12,
    color: '#444',
  },

  // ── Active Modifiers ──
  noModifiers: {
    fontSize: 10,
    fontFamily: monoFont,
    color: '#666',
    fontStyle: 'italic',
  },
  modifierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  modifierLabel: {
    fontSize: 10,
    fontFamily: monoFont,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  modifierValue: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 1,
    minWidth: 50,
    textAlign: 'right',
  },

  // ── Succession History ──
  historyRow: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  historyNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  historyName: {
    fontSize: 12,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  historyPersonality: {
    fontSize: 8,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  historyDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyDetail: {
    fontSize: 9,
    fontFamily: monoFont,
    color: '#888',
  },
  historyDeath: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
  },
});
