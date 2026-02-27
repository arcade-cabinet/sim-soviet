/**
 * MinigameReferencePanel — Reference panel showing all 9 minigame definitions
 * and any currently active minigame.
 *
 * Section 1: ACTIVE MINIGAME (shown only when a minigame is in progress or just resolved)
 * Section 2: MINIGAME COMPENDIUM (expandable cards for all 9 definitions)
 *
 * Uses SovietModal with terminal variant for dark-panel aesthetic.
 */

import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SovietModal } from './SovietModal';
import { Colors, monoFont } from './styles';
import { useGameSnapshot } from '../hooks/useGameState';
import { getEngine } from '../bridge/GameInit';
import { MINIGAME_DEFINITIONS } from '../game/minigames/definitions';
import type {
  MinigameDefinition,
  MinigameChoice,
  MinigameOutcome,
  ActiveMinigame,
} from '../game/minigames/MinigameTypes';

// ─────────────────────────────────────────────────────────────────────────────
//  Props
// ─────────────────────────────────────────────────────────────────────────────

export interface MinigameReferencePanelProps {
  visible: boolean;
  onDismiss: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────────────────────

const TRIGGER_BADGE_COLOR: Record<string, string> = {
  periodic: Colors.termGreen,
  building_tap: Colors.termBlue,
  event: Colors.sovietGold,
};

const TRIGGER_LABEL: Record<string, string> = {
  periodic: 'PERIODIC',
  building_tap: 'BUILDING TAP',
  event: 'EVENT',
};

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Format resource deltas as compact colored spans. Returns an array of {text, color} pairs. */
function formatOutcomeDeltas(outcome: MinigameOutcome): Array<{ text: string; color: string }> {
  const parts: Array<{ text: string; color: string }> = [];

  if (outcome.resources) {
    const r = outcome.resources;
    if (r.money) {
      parts.push({
        text: `${r.money > 0 ? '+' : ''}${r.money}\u20BD`,
        color: r.money > 0 ? Colors.termGreen : Colors.sovietRed,
      });
    }
    if (r.food) {
      parts.push({
        text: `${r.food > 0 ? '+' : ''}${r.food} food`,
        color: r.food > 0 ? Colors.termGreen : Colors.sovietRed,
      });
    }
    if (r.vodka) {
      parts.push({
        text: `${r.vodka > 0 ? '+' : ''}${r.vodka} vodka`,
        color: r.vodka > 0 ? Colors.termGreen : Colors.sovietRed,
      });
    }
    if (r.population) {
      parts.push({
        text: `${r.population > 0 ? '+' : ''}${r.population} pop`,
        color: r.population > 0 ? Colors.termGreen : Colors.sovietRed,
      });
    }
  }

  if (outcome.blackMarks) {
    parts.push({
      text: `${outcome.blackMarks > 0 ? '+' : ''}${outcome.blackMarks} marks`,
      color: outcome.blackMarks > 0 ? Colors.sovietRed : Colors.termGreen,
    });
  }
  if (outcome.commendations) {
    parts.push({
      text: `${outcome.commendations > 0 ? '+' : ''}${outcome.commendations} commend.`,
      color: outcome.commendations > 0 ? Colors.termGreen : Colors.sovietRed,
    });
  }
  if (outcome.blat) {
    parts.push({
      text: `${outcome.blat > 0 ? '+' : ''}${outcome.blat} blat`,
      color: outcome.blat > 0 ? Colors.termGreen : Colors.sovietRed,
    });
  }

  return parts;
}

/** Color for a success chance value. */
function chanceColor(chance: number): string {
  if (chance > 0.7) return Colors.termGreen;
  if (chance > 0.4) return Colors.sovietGold;
  return Colors.sovietRed;
}

/** Format a success chance as a percentage string. */
function formatChance(chance: number): string {
  return `${Math.round(chance * 100)}%`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Section header with gold text and bottom border. */
const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <Text style={styles.sectionTitle}>{title}</Text>
);

/** Horizontal divider. */
const Divider: React.FC = () => <View style={styles.divider} />;

/** Colored resource delta row. */
const OutcomeDeltas: React.FC<{ outcome: MinigameOutcome }> = ({ outcome }) => {
  const deltas = formatOutcomeDeltas(outcome);
  if (deltas.length === 0) return null;
  return (
    <View style={styles.deltasRow}>
      {deltas.map((d, i) => (
        <Text key={i} style={[styles.deltaText, { color: d.color }]}>
          {d.text}
          {i < deltas.length - 1 ? '  ' : ''}
        </Text>
      ))}
    </View>
  );
};

/** Success chance bar visualization. */
const ChanceBar: React.FC<{ chance: number }> = ({ chance }) => {
  const color = chanceColor(chance);
  return (
    <View style={styles.chanceBarContainer}>
      <View style={styles.chanceBarTrack}>
        <View style={[styles.chanceBarFill, { width: `${Math.round(chance * 100)}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.chanceBarLabel, { color }]}>{formatChance(chance)}</Text>
    </View>
  );
};

/** Single choice detail row (used in both active and compendium views). */
const ChoiceDetail: React.FC<{ choice: MinigameChoice }> = ({ choice }) => (
  <View style={styles.choiceCard}>
    <View style={styles.choiceHeader}>
      <Text style={styles.choiceLabel}>{choice.label}</Text>
      <ChanceBar chance={choice.successChance} />
    </View>
    <Text style={styles.choiceDescription}>{choice.description}</Text>
    <View style={styles.choiceOutcomes}>
      <View style={styles.outcomeColumn}>
        <Text style={styles.outcomeLabel}>SUCCESS:</Text>
        <Text style={styles.outcomeAnnouncement}>{choice.onSuccess.announcement}</Text>
        <OutcomeDeltas outcome={choice.onSuccess} />
      </View>
      <View style={styles.outcomeColumn}>
        <Text style={[styles.outcomeLabel, { color: Colors.sovietRed }]}>FAILURE:</Text>
        <Text style={styles.outcomeAnnouncement}>{choice.onFailure.announcement}</Text>
        <OutcomeDeltas outcome={choice.onFailure} />
      </View>
    </View>
  </View>
);

/** Active minigame section — shown only when a minigame is active or just resolved. */
const ActiveMinigameSection: React.FC<{ active: ActiveMinigame }> = ({ active }) => {
  const { definition, resolved, choiceMade, outcome } = active;

  return (
    <View style={styles.activeSection}>
      <SectionHeader title="ACTIVE MINIGAME" />

      <View style={styles.activeCard}>
        <Text style={styles.activeName}>{definition.name}</Text>
        <Text style={styles.activeDescription}>{definition.description}</Text>

        {/* Status indicator */}
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>STATUS:</Text>
          <Text
            style={[
              styles.statusValue,
              { color: resolved ? Colors.textMuted : Colors.sovietGold },
            ]}
          >
            {resolved ? 'RESOLVED' : 'AWAITING DECISION'}
          </Text>
        </View>

        {/* Time limit */}
        {definition.tickLimit >= 0 && (
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>TIME LIMIT:</Text>
            <Text style={styles.statusValue}>{definition.tickLimit} ticks</Text>
          </View>
        )}

        {/* Choices */}
        {!resolved && (
          <>
            <Divider />
            <Text style={styles.choicesSectionLabel}>AVAILABLE CHOICES:</Text>
            {definition.choices.map((c) => (
              <ChoiceDetail key={c.id} choice={c} />
            ))}
          </>
        )}

        {/* Resolved outcome */}
        {resolved && outcome && (
          <>
            <Divider />
            {choiceMade && (
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>CHOICE MADE:</Text>
                <Text style={styles.statusValue}>
                  {definition.choices.find((c) => c.id === choiceMade)?.label ?? choiceMade}
                </Text>
              </View>
            )}
            {!choiceMade && (
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>RESOLUTION:</Text>
                <Text style={[styles.statusValue, { color: Colors.sovietRed }]}>AUTO-RESOLVED (IGNORED)</Text>
              </View>
            )}
            <Text style={styles.outcomeAnnouncementActive}>{outcome.announcement}</Text>
            <OutcomeDeltas outcome={outcome} />
          </>
        )}
      </View>

      <Divider />
    </View>
  );
};

/** Expandable compendium card for a single minigame definition. */
const CompendiumCard: React.FC<{
  definition: MinigameDefinition;
  expanded: boolean;
  onToggle: () => void;
}> = ({ definition, expanded, onToggle }) => {
  const triggerColor = TRIGGER_BADGE_COLOR[definition.triggerType] ?? Colors.textSecondary;
  const triggerLabel = TRIGGER_LABEL[definition.triggerType] ?? definition.triggerType.toUpperCase();

  return (
    <View style={styles.compendiumCard}>
      {/* Collapsed header — always visible */}
      <TouchableOpacity onPress={onToggle} activeOpacity={0.7} style={styles.compendiumHeader}>
        <View style={styles.compendiumTitleRow}>
          <Text style={styles.expandIndicator}>{expanded ? '\u25BC' : '\u25B6'}</Text>
          <Text style={styles.compendiumName}>{definition.name}</Text>
        </View>
        <View style={[styles.triggerBadge, { borderColor: triggerColor }]}>
          <Text style={[styles.triggerBadgeText, { color: triggerColor }]}>{triggerLabel}</Text>
        </View>
      </TouchableOpacity>

      {/* Description — always visible */}
      <Text style={styles.compendiumDescription}>{definition.description}</Text>

      {/* Expanded detail */}
      {expanded && (
        <View style={styles.compendiumDetail}>
          {/* Trigger condition */}
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>TRIGGER:</Text>
            <Text style={styles.statusValue}>{definition.triggerCondition}</Text>
          </View>

          {/* Time limit */}
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>TIME LIMIT:</Text>
            <Text style={styles.statusValue}>
              {definition.tickLimit < 0 ? 'NONE' : `${definition.tickLimit} ticks`}
            </Text>
          </View>

          {/* Choices */}
          <Divider />
          <Text style={styles.choicesSectionLabel}>CHOICES:</Text>
          {definition.choices.map((c) => (
            <ChoiceDetail key={c.id} choice={c} />
          ))}

          {/* Auto-resolve penalty */}
          <Divider />
          <Text style={[styles.choicesSectionLabel, { color: Colors.sovietRed }]}>
            AUTO-RESOLVE PENALTY (IGNORED):
          </Text>
          <View style={styles.autoResolveBox}>
            <Text style={styles.outcomeAnnouncement}>{definition.autoResolve.announcement}</Text>
            <OutcomeDeltas outcome={definition.autoResolve} />
          </View>
        </View>
      )}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Main Component
// ─────────────────────────────────────────────────────────────────────────────

export const MinigameReferencePanel: React.FC<MinigameReferencePanelProps> = ({
  visible,
  onDismiss,
}) => {
  // Subscribe so the panel re-renders on game ticks (for active minigame updates)
  useGameSnapshot();

  // Track which compendium cards are expanded
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Fetch active minigame from engine
  const active = useMemo<ActiveMinigame | null>(() => {
    const engine = getEngine();
    const router = engine?.getMinigameRouter() ?? null;
    return router?.getActive() ?? null;
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCard = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (!visible) return null;

  return (
    <SovietModal
      visible={visible}
      variant="terminal"
      title="MINIGAMES"
      stampText="CLASSIFIED"
      actionLabel="DISMISS"
      onAction={onDismiss}
      dismissOnOverlay
      onDismiss={onDismiss}
    >
      {/* ── Section 1: Active Minigame ──────────────────────────── */}
      {active && <ActiveMinigameSection active={active} />}

      {/* ── Section 2: Minigame Compendium ──────────────────────── */}
      <SectionHeader title="MINIGAME COMPENDIUM" />

      <Text style={styles.compendiumSubtitle}>
        {MINIGAME_DEFINITIONS.length} scenarios on file. Tap to expand.
      </Text>

      {MINIGAME_DEFINITIONS.map((def) => (
        <CompendiumCard
          key={def.id}
          definition={def}
          expanded={expandedIds.has(def.id)}
          onToggle={() => toggleCard(def.id)}
        />
      ))}

      <Divider />

      {/* ── Footer ─────────────────────────────────────────────── */}
      <View style={styles.footerRow}>
        <Text style={styles.footerLabel}>SCENARIOS ON FILE:</Text>
        <Text style={styles.footerValue}>{MINIGAME_DEFINITIONS.length}</Text>
      </View>
    </SovietModal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────────────────────────────────────

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
    marginVertical: 10,
  },

  // ── Active minigame section ──
  activeSection: {
    marginBottom: 4,
  },
  activeCard: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: Colors.sovietGold,
    padding: 10,
    marginBottom: 8,
  },
  activeName: {
    fontSize: 13,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 1,
    marginBottom: 4,
  },
  activeDescription: {
    fontSize: 10,
    fontFamily: monoFont,
    fontStyle: 'italic',
    color: Colors.textSecondary,
    marginBottom: 8,
    lineHeight: 14,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  statusLabel: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  statusValue: {
    fontSize: 9,
    fontFamily: monoFont,
    color: Colors.textPrimary,
    letterSpacing: 1,
  },
  outcomeAnnouncementActive: {
    fontSize: 10,
    fontFamily: monoFont,
    fontStyle: 'italic',
    color: Colors.sovietGold,
    marginVertical: 6,
    lineHeight: 14,
  },

  // ── Choices ──
  choicesSectionLabel: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 6,
  },
  choiceCard: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderLeftWidth: 3,
    borderLeftColor: Colors.textMuted,
    padding: 8,
    marginBottom: 6,
  },
  choiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  choiceLabel: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    letterSpacing: 1,
    flex: 1,
  },
  choiceDescription: {
    fontSize: 9,
    fontFamily: monoFont,
    color: Colors.textSecondary,
    marginBottom: 6,
    lineHeight: 13,
  },
  choiceOutcomes: {
    gap: 6,
  },
  outcomeColumn: {
    paddingLeft: 6,
    borderLeftWidth: 1,
    borderLeftColor: '#333',
    marginBottom: 2,
  },
  outcomeLabel: {
    fontSize: 8,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.termGreen,
    letterSpacing: 1,
    marginBottom: 2,
  },
  outcomeAnnouncement: {
    fontSize: 9,
    fontFamily: monoFont,
    fontStyle: 'italic',
    color: Colors.textMuted,
    marginBottom: 2,
    lineHeight: 13,
  },

  // ── Chance bar ──
  chanceBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chanceBarTrack: {
    width: 50,
    height: 6,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
  },
  chanceBarFill: {
    height: '100%',
  },
  chanceBarLabel: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  // ── Resource deltas ──
  deltasRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  deltaText: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  // ── Auto-resolve box ──
  autoResolveBox: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: Colors.sovietRed,
    padding: 8,
  },

  // ── Compendium ──
  compendiumSubtitle: {
    fontSize: 9,
    fontFamily: monoFont,
    color: Colors.textMuted,
    marginBottom: 10,
    letterSpacing: 1,
  },
  compendiumCard: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    padding: 10,
    marginBottom: 6,
  },
  compendiumHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  compendiumTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  expandIndicator: {
    fontSize: 8,
    color: Colors.sovietGold,
  },
  compendiumName: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 1,
  },
  triggerBadge: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  triggerBadgeText: {
    fontSize: 7,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  compendiumDescription: {
    fontSize: 9,
    fontFamily: monoFont,
    fontStyle: 'italic',
    color: Colors.textSecondary,
    lineHeight: 13,
    marginBottom: 2,
  },
  compendiumDetail: {
    marginTop: 8,
  },

  // ── Footer ──
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLabel: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  footerValue: {
    fontSize: 14,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
  },
});
