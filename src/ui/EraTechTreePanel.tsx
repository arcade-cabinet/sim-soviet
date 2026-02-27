/**
 * EraTechTreePanel — Era progression and technology tree panel.
 *
 * Shows the current era details, a chronological timeline of all 8 eras,
 * and building unlock information. Accessible from the STATE tab.
 *
 * Uses SovietModal with terminal variant for dark-panel aesthetic.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SovietModal } from './SovietModal';
import { Colors, monoFont } from './styles';
import { getEngine } from '../bridge/GameInit';
import { useGameSnapshot } from '../hooks/useGameState';
import { ERA_ORDER, ERA_DEFINITIONS } from '../game/era';
import type { EraId, EraModifiers } from '../game/era';
import { BUILDING_DEFS } from '../data/buildingDefs';

// ─────────────────────────────────────────────────────────────────────────────
//  Props
// ─────────────────────────────────────────────────────────────────────────────

export interface EraTechTreePanelProps {
  visible: boolean;
  onDismiss: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Modifier display config
// ─────────────────────────────────────────────────────────────────────────────

interface ModifierConfig {
  key: keyof EraModifiers;
  label: string;
  /** Whether >1.0 is a BAD thing (true for consumption, decay, etc.) */
  highIsBad: boolean;
}

const MODIFIER_CONFIGS: readonly ModifierConfig[] = [
  { key: 'productionMult', label: 'PRODUCTION', highIsBad: false },
  { key: 'consumptionMult', label: 'CONSUMPTION', highIsBad: true },
  { key: 'decayMult', label: 'DECAY', highIsBad: true },
  { key: 'populationGrowthMult', label: 'POP. GROWTH', highIsBad: false },
  { key: 'eventFrequencyMult', label: 'EVENT FREQ.', highIsBad: true },
  { key: 'corruptionMult', label: 'CORRUPTION', highIsBad: true },
];

// ─────────────────────────────────────────────────────────────────────────────
//  Construction method labels
// ─────────────────────────────────────────────────────────────────────────────

const CONSTRUCTION_METHOD_LABELS: Record<string, string> = {
  manual: 'MANUAL (TRUDODNI)',
  mechanized: 'MECHANIZED',
  industrial: 'INDUSTRIAL (PREFAB)',
  decaying: 'DECAYING INFRASTRUCTURE',
};

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Format year range for display. */
function formatYearRange(startYear: number, endYear: number): string {
  if (endYear === -1) return `${startYear} \u2014 ETERNAL`;
  return `${startYear} \u2014 ${endYear}`;
}

/** Color for a modifier value: green if favorable, red if unfavorable, muted if neutral. */
function modifierColor(value: number, highIsBad: boolean): string {
  if (Math.abs(value - 1.0) < 0.01) return Colors.textMuted;
  if (value > 1.0) return highIsBad ? Colors.sovietRed : Colors.termGreen;
  return highIsBad ? Colors.termGreen : Colors.sovietRed;
}

/** Format modifier value for display. */
function formatModifier(value: number): string {
  const pct = Math.round((value - 1) * 100);
  if (pct === 0) return '\u00b10%';
  return pct > 0 ? `+${pct}%` : `${pct}%`;
}

/** Determine era status relative to current. */
function getEraStatus(
  eraId: EraId,
  currentEraId: EraId,
): 'past' | 'current' | 'future' {
  const currentIdx = ERA_ORDER.indexOf(currentEraId);
  const eraIdx = ERA_ORDER.indexOf(eraId);
  if (eraIdx < currentIdx) return 'past';
  if (eraIdx === currentIdx) return 'current';
  return 'future';
}

// ─────────────────────────────────────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Section header with gold text and bottom border. */
const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <Text style={styles.sectionTitle}>{title}</Text>
);

/** Horizontal divider between sections. */
const Divider: React.FC = () => <View style={styles.divider} />;

// ─────────────────────────────────────────────────────────────────────────────
//  Main Component
// ─────────────────────────────────────────────────────────────────────────────

export const EraTechTreePanel: React.FC<EraTechTreePanelProps> = ({ visible, onDismiss }) => {
  // Subscribe to game state for re-renders
  const snap = useGameSnapshot();

  // Access engine era system — may be null if game not initialized
  const engine = getEngine();
  const eraSystem = engine?.getEraSystem() ?? null;

  if (!visible) return null;

  // ── Read era data (guarded) ──────────────────────────────────────────

  const currentEraId = (eraSystem?.getCurrentEraId() ?? snap.currentEra) as EraId;
  const currentEraDef = eraSystem?.getCurrentEra() ?? ERA_DEFINITIONS[currentEraId];
  const modifiers = eraSystem?.getModifiers() ?? currentEraDef.modifiers;
  const transitioning = eraSystem?.isTransitioning() ?? false;
  const availableBuildings = eraSystem?.getAvailableBuildings() ?? [];
  const lockedBuildings = eraSystem?.getLockedBuildings() ?? [];

  // Buildings unlocked specifically in the current era
  const currentEraBuildings = currentEraDef.unlockedBuildings;

  const stampLabel = transitioning ? 'TRANSITIONING' : currentEraDef.doctrine.toUpperCase();

  return (
    <SovietModal
      visible={visible}
      variant="terminal"
      title="ERA & TECH TREE"
      stampText={stampLabel}
      actionLabel="CLOSE"
      onAction={onDismiss}
      dismissOnOverlay
      onDismiss={onDismiss}
    >
      {/* ── SECTION 1: CURRENT ERA ─────────────────────────────── */}
      <SectionHeader title="CURRENT ERA" />

      <Text style={styles.eraName}>{currentEraDef.name}</Text>
      <View style={styles.row}>
        <Text style={styles.label}>YEARS:</Text>
        <Text style={styles.value}>
          {formatYearRange(currentEraDef.startYear, currentEraDef.endYear)}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>CURRENT YEAR:</Text>
        <Text style={[styles.value, { color: Colors.sovietGold }]}>{snap.year}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>DOCTRINE:</Text>
        <Text style={[styles.value, { color: Colors.termBlue }]}>
          {currentEraDef.doctrine.toUpperCase()}
        </Text>
      </View>

      <Text style={styles.flavorText}>{currentEraDef.briefingFlavor}</Text>

      {/* Modifiers */}
      <Text style={styles.subHeading}>MODIFIERS</Text>
      {transitioning && (
        <Text style={styles.transitionNote}>TRANSITION IN PROGRESS — VALUES BLENDING</Text>
      )}

      {MODIFIER_CONFIGS.map((cfg) => {
        const val = modifiers[cfg.key];
        return (
          <View key={cfg.key} style={styles.modifierRow}>
            <Text style={styles.modifierLabel}>{cfg.label}</Text>
            <Text style={[styles.modifierValue, { color: modifierColor(val, cfg.highIsBad) }]}>
              {formatModifier(val)}
            </Text>
          </View>
        );
      })}

      {/* Construction */}
      <View style={styles.row}>
        <Text style={styles.label}>CONSTRUCTION:</Text>
        <Text style={styles.value}>
          {CONSTRUCTION_METHOD_LABELS[currentEraDef.constructionMethod] ??
            currentEraDef.constructionMethod.toUpperCase()}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>BUILD TIME:</Text>
        <Text
          style={[
            styles.value,
            {
              color:
                currentEraDef.constructionTimeMult > 1.0
                  ? Colors.sovietRed
                  : currentEraDef.constructionTimeMult < 1.0
                    ? Colors.termGreen
                    : Colors.textMuted,
            },
          ]}
        >
          {currentEraDef.constructionTimeMult.toFixed(1)}x
        </Text>
      </View>

      <Divider />

      {/* ── SECTION 2: ERA TIMELINE ────────────────────────────── */}
      <SectionHeader title="ERA TIMELINE" />

      {ERA_ORDER.map((eraId, idx) => {
        const def = ERA_DEFINITIONS[eraId];
        const status = getEraStatus(eraId, currentEraId);
        const isLast = idx === ERA_ORDER.length - 1;

        return (
          <View key={eraId} style={styles.timelineEntry}>
            {/* Connector + dot */}
            <View style={styles.timelineTrack}>
              <View
                style={[
                  styles.timelineDot,
                  status === 'current' && styles.timelineDotCurrent,
                  status === 'past' && styles.timelineDotPast,
                  status === 'future' && styles.timelineDotFuture,
                ]}
              />
              {!isLast && (
                <View
                  style={[
                    styles.timelineLine,
                    status === 'future' && styles.timelineLineFuture,
                  ]}
                />
              )}
            </View>

            {/* Era card */}
            <View
              style={[
                styles.timelineCard,
                status === 'current' && styles.timelineCardCurrent,
                status === 'past' && styles.timelineCardPast,
                status === 'future' && styles.timelineCardFuture,
              ]}
            >
              <View style={styles.timelineCardHeader}>
                <Text
                  style={[
                    styles.timelineEraName,
                    status === 'past' && styles.timelineTextDimmed,
                    status === 'future' && styles.timelineTextLocked,
                  ]}
                >
                  {status === 'current' ? '\u25B6 ' : ''}{def.name}
                </Text>
                <Text
                  style={[
                    styles.timelineYears,
                    status === 'past' && styles.timelineTextDimmed,
                    status === 'future' && styles.timelineTextLocked,
                  ]}
                >
                  {formatYearRange(def.startYear, def.endYear)}
                </Text>
              </View>
              <View style={styles.timelineCardDetails}>
                <Text
                  style={[
                    styles.timelineDetail,
                    status === 'past' && styles.timelineTextDimmed,
                    status === 'future' && styles.timelineTextLocked,
                  ]}
                >
                  {def.doctrine.toUpperCase()} | {def.unlockedBuildings.length} BUILDING{def.unlockedBuildings.length !== 1 ? 'S' : ''}
                </Text>
              </View>
            </View>
          </View>
        );
      })}

      <Divider />

      {/* ── SECTION 3: BUILDING UNLOCKS ────────────────────────── */}
      <SectionHeader title="BUILDING UNLOCKS" />

      <View style={styles.row}>
        <Text style={styles.label}>AVAILABLE:</Text>
        <Text style={[styles.value, { color: Colors.termGreen }]}>
          {availableBuildings.length}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>LOCKED:</Text>
        <Text style={[styles.value, { color: Colors.sovietRed }]}>
          {lockedBuildings.length}
        </Text>
      </View>

      {currentEraBuildings.length > 0 ? (
        <>
          <Text style={styles.subHeading}>
            UNLOCKED IN {currentEraDef.name.toUpperCase()}
          </Text>
          {currentEraBuildings.map((defId) => {
            const bDef = BUILDING_DEFS[defId];
            const name = bDef?.presentation?.name ?? defId;
            const icon = bDef?.presentation?.icon ?? '\u2592';
            const desc = bDef?.presentation?.desc ?? '';

            return (
              <View key={defId} style={styles.buildingRow}>
                <Text style={styles.buildingIcon}>{icon}</Text>
                <View style={styles.buildingInfo}>
                  <Text style={styles.buildingName}>{name}</Text>
                  {desc !== '' && (
                    <Text style={styles.buildingDesc}>{desc}</Text>
                  )}
                </View>
              </View>
            );
          })}
        </>
      ) : (
        <Text style={styles.noData}>No new buildings unlocked in this era.</Text>
      )}
    </SovietModal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────────────────────────────────────

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
  label: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  value: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.white,
  },
  noData: {
    fontSize: 10,
    fontFamily: monoFont,
    color: '#555',
    fontStyle: 'italic',
    marginBottom: 4,
  },

  // ── Current era ─────────────────────────────────────────────────────
  eraName: {
    fontSize: 16,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 1,
    marginBottom: 8,
  },
  flavorText: {
    fontSize: 10,
    fontFamily: monoFont,
    fontStyle: 'italic',
    color: '#78909c',
    marginTop: 6,
    marginBottom: 10,
    lineHeight: 16,
  },
  subHeading: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 6,
  },
  transitionNote: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    marginBottom: 6,
  },

  // ── Modifier rows ──────────────────────────────────────────────────
  modifierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
    paddingLeft: 4,
  },
  modifierLabel: {
    fontSize: 10,
    fontFamily: monoFont,
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  modifierValue: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
    minWidth: 48,
    textAlign: 'right',
  },

  // ── Timeline ───────────────────────────────────────────────────────
  timelineEntry: {
    flexDirection: 'row',
    marginBottom: 0,
  },
  timelineTrack: {
    width: 20,
    alignItems: 'center',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.textMuted,
    marginTop: 4,
    zIndex: 1,
  },
  timelineDotCurrent: {
    backgroundColor: Colors.sovietRed,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.sovietGold,
    marginTop: 3,
  },
  timelineDotPast: {
    backgroundColor: Colors.termGreen,
  },
  timelineDotFuture: {
    backgroundColor: '#444',
    borderWidth: 1,
    borderColor: '#555',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.textMuted,
    marginVertical: 1,
  },
  timelineLineFuture: {
    backgroundColor: '#333',
  },

  timelineCard: {
    flex: 1,
    marginLeft: 8,
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#333',
  },
  timelineCardCurrent: {
    borderColor: Colors.sovietRed,
    borderWidth: 2,
    backgroundColor: '#1a1212',
  },
  timelineCardPast: {
    opacity: 0.6,
  },
  timelineCardFuture: {
    opacity: 0.4,
    backgroundColor: '#1a1a1a',
  },
  timelineCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  timelineEraName: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    flex: 1,
  },
  timelineYears: {
    fontSize: 9,
    fontFamily: monoFont,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  timelineCardDetails: {
    marginTop: 2,
  },
  timelineDetail: {
    fontSize: 9,
    fontFamily: monoFont,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  timelineTextDimmed: {
    color: '#666',
  },
  timelineTextLocked: {
    color: '#444',
  },

  // ── Building unlocks ───────────────────────────────────────────────
  buildingRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  buildingIcon: {
    fontSize: 18,
    marginTop: 1,
  },
  buildingInfo: {
    flex: 1,
  },
  buildingName: {
    fontSize: 12,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.termGreen,
    letterSpacing: 1,
  },
  buildingDesc: {
    fontSize: 10,
    fontFamily: monoFont,
    color: '#999',
    marginTop: 2,
  },
});
