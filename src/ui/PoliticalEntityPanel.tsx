/**
 * PoliticalEntityPanel — KGB agents, politruks, military and conscription officers.
 *
 * Displays active political entities, their stats and assignments,
 * ongoing KGB investigations, and the conscription queue. Uses
 * SovietModal with terminal variant for the classified dossier aesthetic.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getEngine } from '../bridge/GameInit';
import type { DialogueContext } from '../content/dialogue/types';
import type { ConscriptionEvent, KGBInvestigation, PoliticalEntityStats, PoliticalRole } from '../game/political/types';
import { useGameSnapshot } from '../hooks/useGameState';
import { SovietModal } from './SovietModal';
import { Colors, monoFont } from './styles';

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_ICONS: Record<PoliticalRole, string> = {
  politruk: '\u262D',
  kgb_agent: '\u{1F50D}',
  military_officer: '\u2694',
  conscription_officer: '\u{1F4CB}',
};

const ROLE_COLORS: Record<PoliticalRole, string> = {
  politruk: Colors.sovietRed,
  kgb_agent: Colors.sovietGold,
  military_officer: '#ff5722',
  conscription_officer: Colors.termBlue,
};

const ROLE_LABELS: Record<PoliticalRole, string> = {
  politruk: 'POLITRUKS',
  kgb_agent: 'KGB AGENTS',
  military_officer: 'MILITARY OFFICERS',
  conscription_officer: 'CONSCRIPTION OFFICERS',
};

const ROLE_LABEL_SINGULAR: Record<PoliticalRole, string> = {
  politruk: 'POLITRUK',
  kgb_agent: 'KGB AGENT',
  military_officer: 'MIL. OFFICER',
  conscription_officer: 'CONSCR. OFFICER',
};

const INTENSITY_COLORS: Record<string, string> = {
  routine: Colors.sovietGold,
  thorough: '#ff9800',
  purge: Colors.sovietRed,
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface PoliticalEntityPanelProps {
  visible: boolean;
  onDismiss: () => void;
}

// ── Sub-components ────────────────────────────────────────────────────────────

const SectionHeader: React.FC<{ title: string }> = ({ title }) => <Text style={styles.sectionTitle}>{title}</Text>;

const Divider: React.FC = () => <View style={styles.divider} />;

const ProgressBar: React.FC<{ ratio: number; color: string; height?: number }> = ({ ratio, color, height = 6 }) => {
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

/** Color for effectiveness: red < 30, gold 30-60, green > 60. */
function effectColor(value: number): string {
  if (value < 30) return Colors.sovietRed;
  if (value <= 60) return Colors.sovietGold;
  return Colors.termGreen;
}

/** Role-specific flavor text shown in expanded detail. */
const ROLE_DESCRIPTIONS: Record<PoliticalRole, string> = {
  politruk: 'Conducts ideology sessions and loyalty checks on your workers. Cannot be removed.',
  kgb_agent: 'Investigates disloyalty. Workers may disappear without warning.',
  military_officer: 'Oversees military readiness. Reports to Moscow.',
  conscription_officer: 'Enforces conscription quotas. Drafts your workers.',
};

/** Personality descriptions for politruks. */
const PERSONALITY_DESCRIPTIONS: Record<string, string> = {
  zealous: 'ZEALOUS — Checks often, low tolerance. Hard to satisfy.',
  lazy: 'LAZY — Checks rarely, high tolerance. Susceptible to blat.',
  paranoid: 'PARANOID — Random checks on everyone. Nobody is safe.',
  corrupt: 'CORRUPT — Will accept bribes. But if caught...',
};

/** Single entity row in the agent roster — tap to expand with dialogue. */
const EntityRow: React.FC<{
  entity: PoliticalEntityStats;
  isExpanded: boolean;
  onTap: (id: string) => void;
  dialogue: string | null;
}> = React.memo(({ entity, isExpanded, onTap, dialogue }) => {
  const icon = ROLE_ICONS[entity.role];
  const roleColor = ROLE_COLORS[entity.role];
  const roleLabel = ROLE_LABEL_SINGULAR[entity.role];
  const effColor = effectColor(entity.effectiveness);

  return (
    <Pressable
      onPress={() => onTap(entity.id)}
      style={({ pressed }) => [styles.entityRow, pressed && styles.entityRowPressed]}
    >
      {/* Icon + name + role */}
      <View style={styles.entityHeader}>
        <Text style={[styles.entityIcon, { color: roleColor }]}>{icon}</Text>
        <View style={styles.entityNameBlock}>
          <Text style={styles.entityName} numberOfLines={1} ellipsizeMode="tail">
            {entity.name}
          </Text>
          <Text style={[styles.entityRole, { color: roleColor }]}>{roleLabel}</Text>
        </View>
        <Text style={styles.expandIndicator}>{isExpanded ? '\u25BC' : '\u25B6'}</Text>
      </View>

      {/* Position + target building */}
      <View style={styles.entityDetailsRow}>
        <Text style={styles.detailLabel}>POS:</Text>
        <Text style={styles.detailValue}>
          [{entity.stationedAt.gridX},{entity.stationedAt.gridY}]
        </Text>
        <Text style={[styles.detailLabel, styles.detailLabelSpaced]}>BLDG:</Text>
        <Text
          style={[styles.detailValue, !entity.targetBuilding && styles.idleText]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {entity.targetBuilding ?? 'UNASSIGNED'}
        </Text>
      </View>

      {/* Effectiveness bar */}
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>EFFECT.</Text>
        <View style={styles.statBarContainer}>
          <ProgressBar ratio={entity.effectiveness / 100} color={effColor} />
        </View>
        <Text style={[styles.statValue, { color: effColor }]}>{Math.round(entity.effectiveness)}%</Text>
      </View>

      {/* Ticks remaining */}
      <View style={styles.entityDetailsRow}>
        <Text style={styles.detailLabel}>REMAINING:</Text>
        <Text style={[styles.detailValue, { color: Colors.termBlue }]}>{entity.ticksRemaining} ticks</Text>
      </View>

      {/* ── Expanded detail section ── */}
      {isExpanded && (
        <View style={styles.expandedSection}>
          <View style={[styles.expandedDivider, { borderColor: roleColor }]} />

          {/* Role description */}
          <Text style={styles.expandedDesc}>{ROLE_DESCRIPTIONS[entity.role]}</Text>

          {/* Personality (politruks only) */}
          {entity.personality && (
            <Text style={[styles.expandedPersonality, { color: roleColor }]}>
              {PERSONALITY_DESCRIPTIONS[entity.personality] ?? entity.personality.toUpperCase()}
            </Text>
          )}

          {/* Dialogue */}
          {dialogue && (
            <View style={styles.dialogueBubble}>
              <Text style={[styles.dialogueSpeaker, { color: roleColor }]}>
                {icon} {entity.name.toUpperCase()}:
              </Text>
              <Text style={styles.dialogueText}>"{dialogue}"</Text>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
});

/** Single investigation row. */
const InvestigationRow: React.FC<{ inv: KGBInvestigation; index: number }> = React.memo(({ inv, index }) => {
  const intColor = INTENSITY_COLORS[inv.intensity] ?? Colors.sovietGold;

  return (
    <View style={styles.investigationRow}>
      <View style={styles.invHeader}>
        <Text style={styles.invIndex}>#{index + 1}</Text>
        <Text style={styles.invTarget}>
          TARGET: [{inv.targetBuilding.gridX},{inv.targetBuilding.gridY}]
        </Text>
        <Text style={[styles.invIntensity, { color: intColor }]}>{inv.intensity.toUpperCase()}</Text>
      </View>

      <View style={styles.entityDetailsRow}>
        <Text style={styles.detailLabel}>REMAINING:</Text>
        <Text style={[styles.detailValue, { color: Colors.termBlue }]}>{inv.ticksRemaining} ticks</Text>
        {inv.flaggedWorkers > 0 && (
          <>
            <Text style={[styles.detailLabel, styles.detailLabelSpaced]}>FLAGGED:</Text>
            <Text style={[styles.detailValue, { color: Colors.sovietRed }]}>{inv.flaggedWorkers}</Text>
          </>
        )}
      </View>
    </View>
  );
});

/** Single conscription event row. */
const ConscriptionRow: React.FC<{ evt: ConscriptionEvent; index: number }> = React.memo(({ evt, index }) => (
  <View style={styles.conscriptionRow}>
    <View style={styles.conscriptionHeader}>
      <Text style={styles.invIndex}>#{index + 1}</Text>
      <Text style={[styles.conscriptionCount, { color: Colors.sovietRed }]}>
        {evt.drafted}/{evt.targetCount} DRAFTED
      </Text>
    </View>
    <View style={styles.entityDetailsRow}>
      <Text style={styles.detailLabel}>OFFICER:</Text>
      <Text style={styles.detailValue}>{evt.officerName.toUpperCase()}</Text>
    </View>
    {evt.casualties > 0 && (
      <View style={styles.entityDetailsRow}>
        <Text style={styles.detailLabel}>CASUALTIES:</Text>
        <Text style={[styles.detailValue, { color: Colors.sovietRed }]}>{evt.casualties}</Text>
      </View>
    )}
    {evt.returnTick >= 0 && (
      <View style={styles.entityDetailsRow}>
        <Text style={styles.detailLabel}>RETURN TICK:</Text>
        <Text style={[styles.detailValue, { color: Colors.termGreen }]}>{evt.returnTick}</Text>
      </View>
    )}
    {evt.returnTick < 0 && <Text style={styles.permanentText}>PERMANENT — WARTIME DEPLOYMENT</Text>}
  </View>
));

// ── Main Component ────────────────────────────────────────────────────────────

/** Map season label to dialogue season. */
function toDialogueSeason(season: string): DialogueContext['season'] {
  if (season === 'winter') return 'winter';
  if (season === 'spring' || season === 'autumn') return 'mud';
  return 'summer';
}

/** Map food level to dialogue resource level. */
function toResourceLevel(food: number, pop: number): DialogueContext['resourceLevel'] {
  if (pop === 0) return 'adequate';
  const perCapita = food / pop;
  if (perCapita <= 0) return 'starving';
  if (perCapita < 3) return 'scarce';
  if (perCapita < 10) return 'adequate';
  return 'surplus';
}

/** Political entities panel showing KGB agents, politruks, military officers, and conscription queue. */
export const PoliticalEntityPanel: React.FC<PoliticalEntityPanelProps> = ({ visible, onDismiss }) => {
  const snap = useGameSnapshot();
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  const engine = getEngine();
  const politicalSystem = engine?.getPoliticalEntities() ?? null;

  const handleEntityTap = useCallback((id: string) => {
    setSelectedEntityId((prev) => (prev === id ? null : id));
  }, []);

  // Build dialogue context from game snapshot
  const dialogueContext = useMemo<DialogueContext>(
    () => ({
      season: toDialogueSeason(snap.seasonLabel),
      resourceLevel: toResourceLevel(snap.food, snap.pop),
      era: snap.currentEra,
      threatLevel: (snap.threatLevel as DialogueContext['threatLevel']) || 'safe',
      settlementTier: (snap.settlementTier as DialogueContext['settlementTier']) || 'selo',
    }),
    [snap.seasonLabel, snap.food, snap.pop, snap.currentEra, snap.threatLevel, snap.settlementTier],
  );

  const { entityList, roleCounts, investigations, conscriptionQueue } = useMemo(() => {
    if (!politicalSystem) {
      return {
        entityList: [] as PoliticalEntityStats[],
        roleCounts: {
          politruk: 0,
          kgb_agent: 0,
          military_officer: 0,
          conscription_officer: 0,
        } as Record<PoliticalRole, number>,
        investigations: [] as readonly KGBInvestigation[],
        conscriptionQueue: [] as ConscriptionEvent[],
      };
    }

    const entities = politicalSystem.getVisibleEntities();
    const counts = politicalSystem.getEntityCounts();
    const invs = politicalSystem.getActiveInvestigations();
    const saveData = politicalSystem.serialize();

    // Sort by role order, then effectiveness descending
    const roleOrder: Record<PoliticalRole, number> = {
      politruk: 0,
      kgb_agent: 1,
      military_officer: 2,
      conscription_officer: 3,
    };
    const sorted = [...entities].sort((a, b) => {
      const orderA = roleOrder[a.role] ?? 99;
      const orderB = roleOrder[b.role] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return b.effectiveness - a.effectiveness;
    });

    return {
      entityList: sorted,
      roleCounts: counts,
      investigations: invs,
      conscriptionQueue: saveData.conscriptionQueue,
    };
  }, [politicalSystem]);

  if (!visible) return null;

  const totalEntities = entityList.length;

  return (
    <SovietModal
      visible={visible}
      variant="terminal"
      title="POLITICAL ENTITIES"
      stampText="KGB CLASSIFIED"
      actionLabel="CLOSE"
      onAction={onDismiss}
      dismissOnOverlay
      onDismiss={onDismiss}
    >
      {/* ── ACTIVE AGENTS ────────────────────────────────────────── */}
      <SectionHeader title="ACTIVE AGENTS" />

      {totalEntities === 0 ? (
        <Text style={styles.emptyText}>No political entities deployed.</Text>
      ) : (
        <View style={styles.summaryBlock}>
          {(Object.keys(ROLE_LABELS) as PoliticalRole[]).map((role) => {
            const count = roleCounts[role] ?? 0;
            return (
              <View key={role} style={styles.summaryRow}>
                <Text style={[styles.summaryIcon, { color: ROLE_COLORS[role] }]}>{ROLE_ICONS[role]}</Text>
                <Text style={styles.summaryLabel}>{ROLE_LABELS[role]}:</Text>
                <Text style={[styles.summaryValue, { color: count > 0 ? ROLE_COLORS[role] : Colors.textMuted }]}>
                  {count}
                </Text>
              </View>
            );
          })}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>TOTAL:</Text>
            <Text style={[styles.summaryValue, { color: Colors.sovietGold }]}>{totalEntities}</Text>
          </View>
        </View>
      )}

      <Divider />

      {/* ── AGENT ROSTER ─────────────────────────────────────────── */}
      <SectionHeader title="AGENT ROSTER" />

      <ScrollView style={styles.rosterList} nestedScrollEnabled showsVerticalScrollIndicator>
        {entityList.length === 0 ? (
          <Text style={styles.emptyText}>No agents in the field.</Text>
        ) : (
          entityList.map((entity) => (
            <EntityRow
              key={entity.id}
              entity={entity}
              isExpanded={selectedEntityId === entity.id}
              onTap={handleEntityTap}
              dialogue={
                selectedEntityId === entity.id
                  ? (politicalSystem?.getEntityDialogue(
                      entity.stationedAt.gridX,
                      entity.stationedAt.gridY,
                      dialogueContext,
                    ) ?? null)
                  : null
              }
            />
          ))
        )}
      </ScrollView>

      <Divider />

      {/* ── ACTIVE INVESTIGATIONS ────────────────────────────────── */}
      <SectionHeader title="ACTIVE INVESTIGATIONS" />

      {investigations.length === 0 ? (
        <Text style={styles.emptyText}>No active investigations.</Text>
      ) : (
        investigations.map((inv, i) => <InvestigationRow key={`inv-${i}`} inv={inv} index={i} />)
      )}

      <Divider />

      {/* ── CONSCRIPTION QUEUE ───────────────────────────────────── */}
      <SectionHeader title="CONSCRIPTION QUEUE" />

      {conscriptionQueue.length === 0 ? (
        <Text style={styles.emptyText}>No pending conscriptions.</Text>
      ) : (
        conscriptionQueue.map((evt, i) => <ConscriptionRow key={`conscr-${i}`} evt={evt} index={i} />)
      )}
    </SovietModal>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

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
  emptyText: {
    fontSize: 11,
    fontFamily: monoFont,
    color: '#666',
    fontStyle: 'italic',
    paddingVertical: 12,
    textAlign: 'center',
  },
  permanentText: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietRed,
    letterSpacing: 1,
    marginTop: 4,
  },

  // ── Summary block ──
  summaryBlock: { gap: 4 },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryIcon: { fontSize: 12, width: 18, textAlign: 'center' },
  summaryLabel: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    flex: 1,
  },
  summaryValue: {
    fontSize: 12,
    fontFamily: monoFont,
    fontWeight: 'bold',
    minWidth: 24,
    textAlign: 'right',
  },

  // ── Roster list ──
  rosterList: { maxHeight: 260 },

  // ── Entity row ──
  entityRow: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    padding: 8,
    marginBottom: 6,
  },
  entityRowPressed: {
    backgroundColor: '#252525',
    borderColor: '#555',
  },
  entityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  entityIcon: { fontSize: 16 },
  expandIndicator: {
    fontSize: 10,
    color: '#555',
    fontFamily: monoFont,
  },
  entityNameBlock: { flex: 1 },
  entityName: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  entityRole: {
    fontSize: 8,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  // ── Detail rows ──
  entityDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  detailLabel: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textSecondary,
  },
  detailLabelSpaced: { marginLeft: 8 },
  detailValue: {
    fontSize: 9,
    fontFamily: monoFont,
    color: Colors.textPrimary,
  },
  idleText: {
    color: Colors.textMuted,
    fontStyle: 'italic',
  },

  // ── Stat row ──
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statLabel: {
    fontSize: 8,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    letterSpacing: 1,
    width: 56,
  },
  statBarContainer: { flex: 1 },
  statValue: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    minWidth: 30,
    textAlign: 'right',
  },

  // ── Progress bar ──
  barTrack: {
    flex: 1,
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#444',
    overflow: 'hidden',
  },
  barFill: { height: '100%' },

  // ── Investigation row ──
  investigationRow: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    padding: 8,
    marginBottom: 6,
  },
  invHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  invIndex: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
  },
  invTarget: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    flex: 1,
  },
  invIntensity: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  // ── Conscription row ──
  conscriptionRow: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    padding: 8,
    marginBottom: 6,
  },
  conscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  conscriptionCount: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
  },

  // ── Expanded detail section ──
  expandedSection: {
    marginTop: 8,
  },
  expandedDivider: {
    borderTopWidth: 1,
    marginBottom: 8,
  },
  expandedDesc: {
    fontSize: 9,
    fontFamily: monoFont,
    color: Colors.textSecondary,
    lineHeight: 14,
    marginBottom: 6,
  },
  expandedPersonality: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 6,
  },
  dialogueBubble: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    borderLeftWidth: 3,
    padding: 8,
    marginTop: 4,
  },
  dialogueSpeaker: {
    fontSize: 8,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 4,
  },
  dialogueText: {
    fontSize: 10,
    fontFamily: monoFont,
    color: Colors.textPrimary,
    fontStyle: 'italic',
    lineHeight: 15,
  },
});
