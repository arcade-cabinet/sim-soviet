/**
 * PolitburoPanel — Politburo cabinet overview panel.
 *
 * Displays the General Secretary, all 10 Ministers with stat bars,
 * active factions with influence/alignment, and leader succession history.
 * Accessible from the STATE tab.
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SovietModal } from './SovietModal';
import { Colors, monoFont } from './styles';
import { getEngine } from '../bridge/GameInit';
import { useGameSnapshot } from '../hooks/useGameState';
import { Ministry, PersonalityType } from '../game/politburo/types';
import type {
  GeneralSecretary,
  Minister,
  Faction,
} from '../game/politburo/types';

// ─────────────────────────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const MINISTRY_LABELS: Record<string, string> = {
  kgb: 'KGB',
  agriculture: 'AGRICULTURE',
  heavy_industry: 'HEAVY INDUSTRY',
  culture: 'CULTURE',
  defense: 'DEFENSE',
  mvd: 'MVD (POLICE)',
  gosplan: 'GOSPLAN',
  health: 'HEALTH',
  education: 'EDUCATION',
  transport: 'TRANSPORT',
};

const PERSONALITY_ICONS: Record<PersonalityType, string> = {
  [PersonalityType.ZEALOT]: '\uD83D\uDD25',
  [PersonalityType.IDEALIST]: '\u2728',
  [PersonalityType.REFORMER]: '\uD83D\uDD27',
  [PersonalityType.TECHNOCRAT]: '\u2699',
  [PersonalityType.APPARATCHIK]: '\uD83D\uDCCB',
  [PersonalityType.POPULIST]: '\uD83D\uDCE2',
  [PersonalityType.MILITARIST]: '\u2694',
  [PersonalityType.MYSTIC]: '\uD83D\uDD2E',
};

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

export interface PolitburoPanelProps {
  visible: boolean;
  onDismiss: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
//  SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/** Section divider with gold title. */
const SectionTitle: React.FC<{ title: string }> = ({ title }) => (
  <Text style={styles.sectionTitle}>{title}</Text>
);

/** Thin colored stat bar (height 4, width proportional to 0-100). */
const StatStrip: React.FC<{
  value: number;
  color: string;
  maxWidth?: number;
}> = ({ value, color, maxWidth = 60 }) => {
  const clamped = Math.max(0, Math.min(value, 100));
  const w = (clamped / 100) * maxWidth;
  return (
    <View style={[styles.stripTrack, { width: maxWidth }]}>
      <View style={[styles.stripFill, { width: w, backgroundColor: color }]} />
    </View>
  );
};

/** Health bar with threshold coloring (red when low). */
const HealthBar: React.FC<{ value: number; width?: number }> = ({ value, width = 80 }) => {
  const clamped = Math.max(0, Math.min(value, 100));
  const pct = (clamped / 100) * width;
  const barColor = clamped < 25 ? Colors.sovietRed : clamped < 50 ? Colors.sovietGold : Colors.termGreen;
  return (
    <View style={styles.healthBarRow}>
      <View style={[styles.healthTrack, { width }]}>
        <View style={[styles.healthFill, { width: pct, backgroundColor: barColor }]} />
      </View>
      <Text style={[styles.healthValue, { color: barColor }]}>{Math.round(clamped)}</Text>
    </View>
  );
};

/** Personality label with icon and colored text. */
const PersonalityLabel: React.FC<{ personality: PersonalityType }> = ({ personality }) => {
  const icon = PERSONALITY_ICONS[personality] ?? '?';
  const color = PERSONALITY_COLORS[personality] ?? '#888';
  return (
    <Text style={[styles.personalityText, { color }]}>
      {icon} {personality.toUpperCase()}
    </Text>
  );
};

// ── Section 1: General Secretary ────────────────────────────────────────────

const GeneralSecretarySection: React.FC<{ gs: GeneralSecretary }> = ({ gs }) => (
  <View style={styles.section}>
    <SectionTitle title="GENERAL SECRETARY" />
    <View style={styles.gsCard}>
      <View style={styles.gsNameRow}>
        <Text style={styles.gsName}>{gs.name}</Text>
        {!gs.alive && <Text style={styles.gsDeadBadge}>DECEASED</Text>}
      </View>

      <View style={styles.gsInfoRow}>
        <PersonalityLabel personality={gs.personality} />
        <Text style={styles.gsDetail}>AGE {gs.age}</Text>
        <Text style={styles.gsDetail}>SINCE {gs.yearAppointed}</Text>
      </View>

      <View style={styles.gsBarSection}>
        <View style={styles.gsBarRow}>
          <Text style={styles.gsBarLabel}>HEALTH</Text>
          <HealthBar value={gs.health} width={80} />
        </View>
        <View style={styles.gsBarRow}>
          <Text style={styles.gsBarLabel}>PARANOIA</Text>
          <HealthBar value={gs.paranoia} width={80} />
        </View>
      </View>
    </View>
  </View>
);

// ── Section 2: Cabinet (Ministers) ──────────────────────────────────────────

const MinisterCard: React.FC<{ minister: Minister }> = ({ minister }) => {
  const ministryLabel = MINISTRY_LABELS[minister.ministry] ?? minister.ministry.toUpperCase();
  const purgeHigh = minister.purgeRisk > 60;

  return (
    <View style={styles.ministerCard}>
      {/* Header: ministry + name */}
      <View style={styles.mcHeader}>
        <Text style={styles.mcMinistry}>{ministryLabel}</Text>
        {purgeHigh && <Text style={styles.mcSkull}>{'\u2620'}</Text>}
      </View>

      <View style={styles.mcNameRow}>
        <Text style={styles.mcName} numberOfLines={1}>{minister.name}</Text>
        <PersonalityLabel personality={minister.personality} />
      </View>

      {/* Stat bars */}
      <View style={styles.mcStatsGrid}>
        <View style={styles.mcStatRow}>
          <Text style={styles.mcStatLabel}>LOY</Text>
          <StatStrip value={minister.loyalty} color={Colors.termBlue} maxWidth={50} />
          <Text style={styles.mcStatVal}>{Math.round(minister.loyalty)}</Text>
        </View>
        <View style={styles.mcStatRow}>
          <Text style={styles.mcStatLabel}>CMP</Text>
          <StatStrip value={minister.competence} color={Colors.termGreen} maxWidth={50} />
          <Text style={styles.mcStatVal}>{Math.round(minister.competence)}</Text>
        </View>
        <View style={styles.mcStatRow}>
          <Text style={styles.mcStatLabel}>AMB</Text>
          <StatStrip value={minister.ambition} color={Colors.sovietGold} maxWidth={50} />
          <Text style={styles.mcStatVal}>{Math.round(minister.ambition)}</Text>
        </View>
        <View style={styles.mcStatRow}>
          <Text style={styles.mcStatLabel}>COR</Text>
          <StatStrip value={minister.corruption} color={Colors.sovietRed} maxWidth={50} />
          <Text style={styles.mcStatVal}>{Math.round(minister.corruption)}</Text>
        </View>
      </View>

      {/* Footer: tenure + purge risk */}
      <View style={styles.mcFooter}>
        <Text style={styles.mcFooterText}>
          TENURE: {minister.tenure} yr{minister.tenure !== 1 ? 's' : ''}
        </Text>
        <Text
          style={[
            styles.mcFooterText,
            { color: purgeHigh ? Colors.sovietRed : Colors.textMuted },
          ]}
        >
          PURGE RISK: {Math.round(minister.purgeRisk)}
        </Text>
      </View>
    </View>
  );
};

const CabinetSection: React.FC<{ ministers: Map<Ministry, Minister> }> = ({ ministers }) => (
  <View style={styles.section}>
    <SectionTitle title={`CABINET (${ministers.size} MINISTERS)`} />
    <ScrollView
      horizontal={false}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      {MINISTRY_ORDER.map((ministry) => {
        const minister = ministers.get(ministry);
        if (!minister) return null;
        return <MinisterCard key={ministry} minister={minister} />;
      })}
    </ScrollView>
  </View>
);

// ── Section 3: Factions ─────────────────────────────────────────────────────

const FactionRow: React.FC<{ faction: Faction }> = ({ faction }) => {
  const alignColor = PERSONALITY_COLORS[faction.alignment] ?? '#888';
  const alignIcon = PERSONALITY_ICONS[faction.alignment] ?? '?';

  return (
    <View style={styles.factionRow}>
      <View style={styles.factionHeader}>
        <Text style={styles.factionName}>{faction.name}</Text>
        <Text style={styles.factionSupport}>
          {faction.supportsCurrent ? '\u2705' : '\u274C'}
        </Text>
      </View>

      <View style={styles.factionDetails}>
        <Text style={[styles.factionAlignment, { color: alignColor }]}>
          {alignIcon} {faction.alignment.toUpperCase()}
        </Text>
        <Text style={styles.factionStat}>
          {faction.memberIds.length} MEMBER{faction.memberIds.length !== 1 ? 'S' : ''}
        </Text>
        <Text style={styles.factionStat}>
          INFLUENCE: {Math.round(faction.influence)}
        </Text>
      </View>
    </View>
  );
};

const FactionsSection: React.FC<{ factions: Faction[] }> = ({ factions }) => {
  if (factions.length === 0) {
    return (
      <View style={styles.section}>
        <SectionTitle title="FACTIONS" />
        <Text style={styles.emptyText}>No factions have formed.</Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <SectionTitle title="FACTIONS" />
      {factions.map((faction) => (
        <FactionRow key={faction.id} faction={faction} />
      ))}
    </View>
  );
};

// ── Section 4: Leader History ───────────────────────────────────────────────

const LeaderHistorySection: React.FC<{ history: GeneralSecretary[] }> = ({ history }) => {
  if (history.length === 0) {
    return (
      <View style={styles.section}>
        <SectionTitle title="LEADER HISTORY" />
        <Text style={styles.emptyText}>No prior leaders. The current regime is the first.</Text>
      </View>
    );
  }

  // Show last 3 past leaders, most recent first
  const recent = [...history].reverse().slice(0, 3);

  return (
    <View style={styles.section}>
      <SectionTitle title="LEADER HISTORY" />
      {recent.map((leader, i) => {
        const personalityColor = PERSONALITY_COLORS[leader.personality] ?? '#888';
        const personalityIcon = PERSONALITY_ICONS[leader.personality] ?? '?';
        const deathText = leader.causeOfDeath
          ? DEATH_LABELS[leader.causeOfDeath] ?? 'Unknown'
          : 'Unknown';

        return (
          <View key={`${leader.id}-${i}`} style={styles.historyRow}>
            <View style={styles.historyNameRow}>
              <Text style={styles.historyName}>{leader.name}</Text>
              <Text style={[styles.historyPersonality, { color: personalityColor }]}>
                {personalityIcon} {leader.personality.toUpperCase()}
              </Text>
            </View>
            <View style={styles.historyDetailRow}>
              <Text style={styles.historyDetail}>
                Appointed {leader.yearAppointed} {'\u00B7'} Age {leader.age}
              </Text>
              <Text style={[styles.historyDeath, { color: Colors.sovietRed }]}>
                {deathText}
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

export const PolitburoPanel: React.FC<PolitburoPanelProps> = ({ visible, onDismiss }) => {
  // Subscribe to game ticks so the panel re-renders with fresh data
  useGameSnapshot();

  const engine = getEngine();
  const politburo = engine?.getPolitburo();

  if (!visible || !politburo) return null;

  const state = politburo.getState();
  const gs = politburo.getGeneralSecretary();

  return (
    <SovietModal
      visible={visible}
      variant="terminal"
      title="POLITBURO"
      stampText="CLASSIFIED"
      actionLabel="CLOSE DOSSIER"
      onAction={onDismiss}
      dismissOnOverlay
      onDismiss={onDismiss}
    >
      <GeneralSecretarySection gs={gs} />
      <CabinetSection ministers={state.ministers} />
      <FactionsSection factions={state.factions} />
      <LeaderHistorySection history={state.leaderHistory} />
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
  emptyText: {
    fontSize: 10,
    fontFamily: monoFont,
    color: '#666',
    fontStyle: 'italic',
  },

  // ── General Secretary ──
  gsCard: {
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#444',
    padding: 10,
  },
  gsNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  gsName: {
    fontSize: 16,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.white,
    flex: 1,
  },
  gsDeadBadge: {
    fontSize: 8,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietRed,
    borderWidth: 1,
    borderColor: Colors.sovietRed,
    paddingHorizontal: 4,
    paddingVertical: 1,
    letterSpacing: 1,
  },
  gsInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  gsDetail: {
    fontSize: 9,
    fontFamily: monoFont,
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  gsBarSection: {
    gap: 4,
  },
  gsBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gsBarLabel: {
    fontSize: 9,
    fontFamily: monoFont,
    color: '#9e9e9e',
    letterSpacing: 1,
    width: 64,
  },

  // ── Health bar ──
  healthBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  healthTrack: {
    height: 10,
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#555',
    overflow: 'hidden',
  },
  healthFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  healthValue: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    minWidth: 20,
  },

  // ── Personality label ──
  personalityText: {
    fontSize: 8,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  // ── Stat strip (thin bar) ──
  stripTrack: {
    height: 4,
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#444',
    overflow: 'hidden',
  },
  stripFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },

  // ── Minister cards ──
  ministerCard: {
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: '#333',
    padding: 8,
    marginBottom: 6,
  },
  mcHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  mcMinistry: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 1,
  },
  mcSkull: {
    fontSize: 14,
  },
  mcNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  mcName: {
    fontSize: 11,
    fontFamily: monoFont,
    color: Colors.textPrimary,
    flex: 1,
  },
  mcStatsGrid: {
    gap: 3,
    marginBottom: 6,
  },
  mcStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mcStatLabel: {
    fontSize: 7,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#777',
    letterSpacing: 1,
    width: 24,
  },
  mcStatVal: {
    fontSize: 8,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    minWidth: 18,
    textAlign: 'right',
  },
  mcFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    paddingTop: 4,
  },
  mcFooterText: {
    fontSize: 8,
    fontFamily: monoFont,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },

  // ── Factions ──
  factionRow: {
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: '#333',
    padding: 8,
    marginBottom: 6,
  },
  factionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  factionName: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
  factionSupport: {
    fontSize: 14,
  },
  factionDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  factionAlignment: {
    fontSize: 8,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  factionStat: {
    fontSize: 8,
    fontFamily: monoFont,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },

  // ── Leader History ──
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
