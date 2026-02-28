/**
 * SettlementProgressPanel — Settlement tier progression panel.
 *
 * Displays the current settlement classification (selo -> posyolok -> pgt -> gorod),
 * a vertical tier roadmap with progress bars, and a requirements checklist for the
 * next tier promotion.
 *
 * Uses SovietModal with terminal variant for dark-panel aesthetic.
 */

import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getBuildingDef } from '@/data/buildingDefs';
import { buildingsLogic, getResourceEntity } from '@/ecs/archetypes';
import { getEngine } from '../bridge/GameInit';
import type { SettlementTier, TierDefinition } from '../game/SettlementSystem';
import { GOROD_MIN_DISTINCT_ROLES, TIER_DEFINITIONS, TIER_ORDER } from '../game/SettlementSystem';
import { useGameSnapshot } from '../hooks/useGameState';
import { SovietModal } from './SovietModal';
import { Colors, monoFont } from './styles';

// ---------------------------------------------------------------------------
//  Props
// ---------------------------------------------------------------------------

export interface SettlementProgressPanelProps {
  visible: boolean;
  onDismiss: () => void;
}

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

/** English display name for a tier. */
const TIER_ENGLISH: Record<SettlementTier, string> = {
  selo: 'Village',
  posyolok: "Workers' Settlement",
  pgt: 'Urban-Type Settlement',
  gorod: 'City',
};

/** Compute current settlement metrics from ECS (mirrors SimulationEngine.tickSettlement). */
function computeCurrentMetrics() {
  const store = getResourceEntity();
  const population = store?.resources.population ?? 0;

  const roles: string[] = [];
  let totalCapacity = 0;
  let nonAgriCapacity = 0;

  for (const entity of buildingsLogic) {
    const def = getBuildingDef(entity.building.defId);
    const role = def?.role ?? 'unknown';
    roles.push(role);

    const cap = Math.max(0, entity.building.housingCap);
    totalCapacity += cap;
    if (role !== 'agriculture') {
      nonAgriCapacity += cap;
    }
  }

  const nonAgriPercent = totalCapacity > 0 ? Math.round((nonAgriCapacity / totalCapacity) * 100) : 0;
  const distinctRoles = new Set(roles);

  return { population, nonAgriPercent, distinctRoles };
}

// ---------------------------------------------------------------------------
//  Sub-components
// ---------------------------------------------------------------------------

/** Section header with gold text and bottom border. */
const SectionHeader: React.FC<{ title: string }> = ({ title }) => <Text style={styles.sectionTitle}>{title}</Text>;

/** Horizontal divider between sections. */
const Divider: React.FC = () => <View style={styles.divider} />;

/** Progress bar with configurable color. */
const ProgressBar: React.FC<{ ratio: number; color: string; height?: number }> = ({ ratio, color, height = 10 }) => {
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

/** Single tier card in the roadmap. */
const TierCard: React.FC<{
  def: TierDefinition;
  isCurrent: boolean;
  isPast: boolean;
}> = ({ def, isCurrent, isPast }) => {
  const nameColor = isCurrent ? Colors.sovietGold : isPast ? Colors.textMuted : '#555';
  const borderColor = isCurrent ? Colors.sovietGold : isPast ? '#333' : '#222';
  const bgColor = isCurrent ? '#2a2200' : '#111';

  return (
    <View style={[styles.tierCard, { borderColor, backgroundColor: bgColor }]}>
      <View style={styles.tierCardHeader}>
        <Text style={[styles.tierRussian, { color: nameColor }]}>{def.russian.toUpperCase()}</Text>
        {isCurrent && <Text style={styles.tierCurrentBadge}>{'\u25C0'} CURRENT</Text>}
      </View>
      <Text style={[styles.tierEnglish, { color: isPast ? Colors.textMuted : Colors.textSecondary }]}>
        {TIER_ENGLISH[def.tier]}
      </Text>
      <Text style={[styles.tierTitle, { color: isPast ? '#444' : Colors.textSecondary }]}>{def.title}</Text>
      <View style={styles.tierReqsRow}>
        <Text style={[styles.tierReqLabel, { color: isPast ? '#444' : Colors.textMuted }]}>
          POP: {def.populationReq}
        </Text>
        {def.nonAgriPercent > 0 && (
          <Text style={[styles.tierReqLabel, { color: isPast ? '#444' : Colors.textMuted }]}>
            NON-AGRI: {def.nonAgriPercent}%
          </Text>
        )}
        {def.buildingReqs.length > 0 && (
          <Text style={[styles.tierReqLabel, { color: isPast ? '#444' : Colors.textMuted }]}>
            ROLES: {def.buildingReqs.join(', ')}
          </Text>
        )}
        {def.tier === 'gorod' && (
          <Text style={[styles.tierReqLabel, { color: isPast ? '#444' : Colors.textMuted }]}>
            {GOROD_MIN_DISTINCT_ROLES}+ DISTINCT ROLES
          </Text>
        )}
      </View>
    </View>
  );
};

/** Requirement checklist row. */
const ReqRow: React.FC<{ label: string; met: boolean; value: string }> = ({ label, met, value }) => (
  <View style={styles.reqRow}>
    <Text style={[styles.reqIcon, { color: met ? Colors.termGreen : Colors.sovietRed }]}>
      {met ? '\u2713' : '\u2717'}
    </Text>
    <Text style={[styles.reqLabel, { color: met ? Colors.termGreen : Colors.textPrimary }]}>{label}</Text>
    <Text style={[styles.reqValue, { color: met ? Colors.termGreen : Colors.textSecondary }]}>{value}</Text>
  </View>
);

// ---------------------------------------------------------------------------
//  Main Component
// ---------------------------------------------------------------------------

export const SettlementProgressPanel: React.FC<SettlementProgressPanelProps> = ({ visible, onDismiss }) => {
  // Subscribe to game state for re-renders
  const snap = useGameSnapshot();

  // Access engine systems
  const engine = getEngine();
  const settlement = engine?.getSettlement() ?? null;

  if (!visible) return null;

  // -- Current tier data --
  const currentTier = (snap.settlementTier as SettlementTier) || 'selo';
  const currentDef = TIER_DEFINITIONS[currentTier];
  const currentIndex = TIER_ORDER.indexOf(currentTier);
  const progress = settlement?.getProgress() ?? { toUpgrade: 0, toDowngrade: 0 };

  // -- Metrics for checklist --
  const metrics = computeCurrentMetrics();

  // -- Next tier (if not already gorod) --
  const hasNextTier = currentIndex < TIER_ORDER.length - 1;
  const nextTier = hasNextTier ? TIER_ORDER[currentIndex + 1] : null;
  const nextDef = nextTier ? TIER_DEFINITIONS[nextTier] : null;

  return (
    <SovietModal
      visible={visible}
      variant="terminal"
      title="SETTLEMENT STATUS"
      stampText={'\u041A\u041B\u0410\u0421\u0421'}
      actionLabel="CLOSE"
      onAction={onDismiss}
      dismissOnOverlay
      onDismiss={onDismiss}
    >
      {/* -- SECTION 1: CURRENT TIER ----------------------------------- */}
      <SectionHeader title="CURRENT CLASSIFICATION" />

      <View style={styles.currentBlock}>
        <Text style={styles.currentRussian}>{currentDef.russian.toUpperCase()}</Text>
        <Text style={styles.currentEnglish}>{TIER_ENGLISH[currentTier]}</Text>
        <Text style={styles.currentTitle}>{currentDef.title}</Text>
        <View style={styles.currentPopRow}>
          <Text style={styles.currentPopLabel}>POPULATION:</Text>
          <Text style={styles.currentPopValue}>
            {metrics.population}
            {hasNextTier && nextDef ? ` / ${nextDef.populationReq} (next tier)` : ' (MAX TIER)'}
          </Text>
        </View>
      </View>

      {/* Progress bars */}
      {hasNextTier && (
        <View style={styles.progressSection}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>UPGRADE</Text>
            <View style={styles.progressBarWrapper}>
              <ProgressBar ratio={progress.toUpgrade} color={Colors.termGreen} height={8} />
            </View>
            <Text style={styles.progressPercent}>{Math.round(progress.toUpgrade * 100)}%</Text>
          </View>
          {currentIndex > 0 && (
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>RISK</Text>
              <View style={styles.progressBarWrapper}>
                <ProgressBar ratio={progress.toDowngrade} color={Colors.sovietRed} height={8} />
              </View>
              <Text style={[styles.progressPercent, { color: Colors.sovietRed }]}>
                {Math.round(progress.toDowngrade * 100)}%
              </Text>
            </View>
          )}
        </View>
      )}

      {currentIndex > 0 && !hasNextTier && (
        <View style={styles.progressSection}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>RISK</Text>
            <View style={styles.progressBarWrapper}>
              <ProgressBar ratio={progress.toDowngrade} color={Colors.sovietRed} height={8} />
            </View>
            <Text style={[styles.progressPercent, { color: Colors.sovietRed }]}>
              {Math.round(progress.toDowngrade * 100)}%
            </Text>
          </View>
        </View>
      )}

      <Divider />

      {/* -- SECTION 2: TIER ROADMAP ----------------------------------- */}
      <SectionHeader title="SETTLEMENT HIERARCHY" />

      {TIER_ORDER.map((tier, idx) => {
        const def = TIER_DEFINITIONS[tier];
        const isCurrent = tier === currentTier;
        const isPast = idx < currentIndex;
        return <TierCard key={tier} def={def} isCurrent={isCurrent} isPast={isPast} />;
      })}

      <Divider />

      {/* -- SECTION 3: REQUIREMENTS CHECKLIST ------------------------- */}
      {hasNextTier && nextDef ? (
        <>
          <SectionHeader title={`REQUIREMENTS FOR ${nextDef.russian.toUpperCase()}`} />

          {/* Population */}
          <ReqRow
            label="Population"
            met={metrics.population >= nextDef.populationReq}
            value={`${metrics.population} / ${nextDef.populationReq}`}
          />

          {/* Non-agricultural percentage */}
          {nextDef.nonAgriPercent > 0 && (
            <ReqRow
              label="Non-agricultural workers"
              met={metrics.nonAgriPercent >= nextDef.nonAgriPercent}
              value={`${metrics.nonAgriPercent}% / ${nextDef.nonAgriPercent}%`}
            />
          )}

          {/* Building role requirements */}
          {nextDef.buildingReqs.map((role) => (
            <ReqRow
              key={role}
              label={`Building role: ${role}`}
              met={metrics.distinctRoles.has(role)}
              value={metrics.distinctRoles.has(role) ? 'PRESENT' : 'MISSING'}
            />
          ))}

          {/* Gorod special: distinct building roles */}
          {nextDef.tier === 'gorod' && (
            <ReqRow
              label="Distinct building roles"
              met={metrics.distinctRoles.size >= GOROD_MIN_DISTINCT_ROLES}
              value={`${metrics.distinctRoles.size} / ${GOROD_MIN_DISTINCT_ROLES}`}
            />
          )}

          {/* Upgrade tick duration note */}
          <View style={styles.tickNote}>
            <Text style={styles.tickNoteText}>
              Requirements must be sustained for {nextDef.upgradeTicks} consecutive ticks to trigger promotion.
            </Text>
          </View>
        </>
      ) : (
        <>
          <SectionHeader title="MAXIMUM CLASSIFICATION ACHIEVED" />
          <Text style={styles.maxTierText}>
            THE SUPREME SOVIET RECOGNIZES THIS SETTLEMENT AS A CITY.
            {'\n'}GLORY TO THE WORKERS WHO MADE THIS POSSIBLE.
          </Text>
        </>
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

  // -- Current tier block --
  currentBlock: {
    alignItems: 'center',
    marginBottom: 8,
  },
  currentRussian: {
    fontSize: 22,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 2,
    marginBottom: 2,
  },
  currentEnglish: {
    fontSize: 12,
    fontFamily: monoFont,
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  currentTitle: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.termGreen,
    letterSpacing: 1,
    marginBottom: 8,
  },
  currentPopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  currentPopLabel: {
    fontSize: 10,
    fontFamily: monoFont,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  currentPopValue: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },

  // -- Progress bars --
  progressSection: {
    marginTop: 8,
    gap: 6,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressLabel: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textMuted,
    letterSpacing: 1,
    minWidth: 56,
  },
  progressBarWrapper: {
    flex: 1,
  },
  progressPercent: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.termGreen,
    minWidth: 32,
    textAlign: 'right',
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

  // -- Tier roadmap cards --
  tierCard: {
    borderWidth: 1,
    padding: 8,
    marginBottom: 6,
  },
  tierCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  tierRussian: {
    fontSize: 13,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  tierCurrentBadge: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 1,
  },
  tierEnglish: {
    fontSize: 10,
    fontFamily: monoFont,
    marginBottom: 2,
  },
  tierTitle: {
    fontSize: 9,
    fontFamily: monoFont,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  tierReqsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tierReqLabel: {
    fontSize: 8,
    fontFamily: monoFont,
    letterSpacing: 1,
  },

  // -- Requirements checklist --
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  reqIcon: {
    fontSize: 14,
    fontFamily: monoFont,
    fontWeight: 'bold',
    width: 16,
    textAlign: 'center',
  },
  reqLabel: {
    flex: 1,
    fontSize: 11,
    fontFamily: monoFont,
  },
  reqValue: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    minWidth: 60,
    textAlign: 'right',
  },

  // -- Tick note --
  tickNote: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  tickNoteText: {
    fontSize: 9,
    fontFamily: monoFont,
    fontStyle: 'italic',
    color: Colors.textMuted,
    lineHeight: 14,
  },

  // -- Max tier --
  maxTierText: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.termGreen,
    textAlign: 'center',
    lineHeight: 18,
    letterSpacing: 1,
  },
});
