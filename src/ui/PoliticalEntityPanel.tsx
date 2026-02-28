/**
 * PoliticalEntityPanel — KGB agents, politruks, military and conscription officers.
 *
 * Displays active political entities, their stats and assignments,
 * ongoing KGB investigations, and the conscription queue. Uses
 * SovietModal with terminal variant for the classified dossier aesthetic.
 */

import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SovietModal } from './SovietModal';
import { Colors, monoFont } from './styles';
import { useGameSnapshot } from '../hooks/useGameState';
import { getEngine } from '../bridge/GameInit';
import type {
  PoliticalRole,
  PoliticalEntityStats,
  KGBInvestigation,
  ConscriptionEvent,
} from '../game/political/types';

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

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <Text style={styles.sectionTitle}>{title}</Text>
);

const Divider: React.FC = () => <View style={styles.divider} />;

const ProgressBar: React.FC<{ ratio: number; color: string; height?: number }> = ({
  ratio,
  color,
  height = 6,
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

/** Color for effectiveness: red < 30, gold 30-60, green > 60. */
function effectColor(value: number): string {
  if (value < 30) return Colors.sovietRed;
  if (value <= 60) return Colors.sovietGold;
  return Colors.termGreen;
}

/** Single entity row in the agent roster. */
const EntityRow: React.FC<{ entity: PoliticalEntityStats }> = React.memo(({ entity }) => {
  const icon = ROLE_ICONS[entity.role];
  const roleColor = ROLE_COLORS[entity.role];
  const roleLabel = ROLE_LABEL_SINGULAR[entity.role];
  const effColor = effectColor(entity.effectiveness);

  return (
    <View style={styles.entityRow}>
      {/* Icon + name + role */}
      <View style={styles.entityHeader}>
        <Text style={[styles.entityIcon, { color: roleColor }]}>{icon}</Text>
        <View style={styles.entityNameBlock}>
          <Text style={styles.entityName} numberOfLines={1} ellipsizeMode="tail">
            {entity.name}
          </Text>
          <Text style={[styles.entityRole, { color: roleColor }]}>{roleLabel}</Text>
        </View>
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
        <Text style={[styles.statValue, { color: effColor }]}>
          {Math.round(entity.effectiveness)}%
        </Text>
      </View>

      {/* Ticks remaining */}
      <View style={styles.entityDetailsRow}>
        <Text style={styles.detailLabel}>REMAINING:</Text>
        <Text style={[styles.detailValue, { color: Colors.termBlue }]}>
          {entity.ticksRemaining} ticks
        </Text>
      </View>
    </View>
  );
});

/** Single investigation row. */
const InvestigationRow: React.FC<{ inv: KGBInvestigation; index: number }> = React.memo(
  ({ inv, index }) => {
    const intColor = INTENSITY_COLORS[inv.intensity] ?? Colors.sovietGold;

    return (
      <View style={styles.investigationRow}>
        <View style={styles.invHeader}>
          <Text style={styles.invIndex}>#{index + 1}</Text>
          <Text style={styles.invTarget}>
            TARGET: [{inv.targetBuilding.gridX},{inv.targetBuilding.gridY}]
          </Text>
          <Text style={[styles.invIntensity, { color: intColor }]}>
            {inv.intensity.toUpperCase()}
          </Text>
        </View>

        <View style={styles.entityDetailsRow}>
          <Text style={styles.detailLabel}>REMAINING:</Text>
          <Text style={[styles.detailValue, { color: Colors.termBlue }]}>
            {inv.ticksRemaining} ticks
          </Text>
          {inv.flaggedWorkers > 0 && (
            <>
              <Text style={[styles.detailLabel, styles.detailLabelSpaced]}>FLAGGED:</Text>
              <Text style={[styles.detailValue, { color: Colors.sovietRed }]}>
                {inv.flaggedWorkers}
              </Text>
            </>
          )}
        </View>
      </View>
    );
  },
);

/** Single conscription event row. */
const ConscriptionRow: React.FC<{ evt: ConscriptionEvent; index: number }> = React.memo(
  ({ evt, index }) => (
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
          <Text style={[styles.detailValue, { color: Colors.sovietRed }]}>
            {evt.casualties}
          </Text>
        </View>
      )}
      {evt.returnTick >= 0 && (
        <View style={styles.entityDetailsRow}>
          <Text style={styles.detailLabel}>RETURN TICK:</Text>
          <Text style={[styles.detailValue, { color: Colors.termGreen }]}>
            {evt.returnTick}
          </Text>
        </View>
      )}
      {evt.returnTick < 0 && (
        <Text style={styles.permanentText}>PERMANENT — WARTIME DEPLOYMENT</Text>
      )}
    </View>
  ),
);

// ── Main Component ────────────────────────────────────────────────────────────

export const PoliticalEntityPanel: React.FC<PoliticalEntityPanelProps> = ({
  visible,
  onDismiss,
}) => {
  useGameSnapshot();

  const engine = getEngine();
  const politicalSystem = engine?.getPoliticalEntities() ?? null;

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
                <Text style={[styles.summaryIcon, { color: ROLE_COLORS[role] }]}>
                  {ROLE_ICONS[role]}
                </Text>
                <Text style={styles.summaryLabel}>{ROLE_LABELS[role]}:</Text>
                <Text
                  style={[
                    styles.summaryValue,
                    { color: count > 0 ? ROLE_COLORS[role] : Colors.textMuted },
                  ]}
                >
                  {count}
                </Text>
              </View>
            );
          })}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>TOTAL:</Text>
            <Text style={[styles.summaryValue, { color: Colors.sovietGold }]}>
              {totalEntities}
            </Text>
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
          entityList.map((entity) => <EntityRow key={entity.id} entity={entity} />)
        )}
      </ScrollView>

      <Divider />

      {/* ── ACTIVE INVESTIGATIONS ────────────────────────────────── */}
      <SectionHeader title="ACTIVE INVESTIGATIONS" />

      {investigations.length === 0 ? (
        <Text style={styles.emptyText}>No active investigations.</Text>
      ) : (
        investigations.map((inv, i) => (
          <InvestigationRow key={`inv-${i}`} inv={inv} index={i} />
        ))
      )}

      <Divider />

      {/* ── CONSCRIPTION QUEUE ───────────────────────────────────── */}
      <SectionHeader title="CONSCRIPTION QUEUE" />

      {conscriptionQueue.length === 0 ? (
        <Text style={styles.emptyText}>No pending conscriptions.</Text>
      ) : (
        conscriptionQueue.map((evt, i) => (
          <ConscriptionRow key={`conscr-${i}`} evt={evt} index={i} />
        ))
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
  entityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  entityIcon: { fontSize: 16 },
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
});
