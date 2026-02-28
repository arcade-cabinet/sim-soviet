/**
 * InfrastructurePanel — Transport, settlement, and utility status panel.
 *
 * Shows road quality, settlement tier progression, and utility
 * (water/power) capacity vs demand. Uses SovietModal with terminal
 * variant for dark-panel aesthetic.
 */

import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getMetaEntity } from '../ecs/archetypes';
import { useGameSnapshot } from '../hooks/useGameState';
import { SovietModal } from './SovietModal';
import { Colors, monoFont } from './styles';

// ─────────────────────────────────────────────────────────────────────────────
//  Props
// ─────────────────────────────────────────────────────────────────────────────

export interface InfrastructurePanelProps {
  visible: boolean;
  onDismiss: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Road quality config
// ─────────────────────────────────────────────────────────────────────────────

const ROAD_CONFIG: Record<string, { label: string; color: string; order: number }> = {
  none: { label: 'NO ROADS', color: Colors.sovietRed, order: 0 },
  dirt: { label: 'DIRT TRACKS', color: '#ff9800', order: 1 },
  gravel: { label: 'GRAVEL ROADS', color: Colors.sovietGold, order: 2 },
  paved: { label: 'PAVED ROADS', color: Colors.termGreen, order: 3 },
  highway: { label: 'HIGHWAY NETWORK', color: Colors.termBlue, order: 4 },
};

// ─────────────────────────────────────────────────────────────────────────────
//  Settlement tier config
// ─────────────────────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<string, { label: string; threshold: number; desc: string }> = {
  selo: { label: 'СЕЛО (VILLAGE)', threshold: 0, desc: 'No bureaucracy. Just peasants.' },
  posyolok: { label: 'ПОСЁЛОК (SETTLEMENT)', threshold: 50, desc: 'First politruk arrives.' },
  pgt: { label: 'ПГТ (URBAN SETTLE.)', threshold: 150, desc: 'KGB station. Full quotas.' },
  gorod: { label: 'ГОРОД (CITY)', threshold: 400, desc: 'Full city soviet. Enormous quotas.' },
};

/** Ordered tier keys for computing next-tier thresholds. */
const TIER_ORDER = ['selo', 'posyolok', 'pgt', 'gorod'];

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Color for road condition percentage. */
function conditionColor(condition: number): string {
  if (condition > 70) return Colors.termGreen;
  if (condition >= 40) return Colors.sovietGold;
  return Colors.sovietRed;
}

/** Color for utility ratio (gen vs used). */
function utilityColor(gen: number, used: number): string {
  return gen >= used ? Colors.termGreen : Colors.sovietRed;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
//  Main Component
// ─────────────────────────────────────────────────────────────────────────────

export const InfrastructurePanel: React.FC<InfrastructurePanelProps> = ({ visible, onDismiss }) => {
  // Subscribe to game state for re-renders
  const snap = useGameSnapshot();

  // Access ECS meta entity for infrastructure data
  const meta = getMetaEntity();
  const gameMeta = meta?.gameMeta;

  if (!visible) return null;

  // ── Road data ─────────────────────────────────────────────────────────
  const roadQuality = gameMeta?.roadQuality ?? 'none';
  const roadCondition = gameMeta?.roadCondition ?? 0;
  const roadCfg = ROAD_CONFIG[roadQuality] ?? ROAD_CONFIG.none;
  const condColor = conditionColor(roadCondition);

  // ── Settlement data ───────────────────────────────────────────────────
  const settlementTier = gameMeta?.settlementTier ?? snap.settlementTier ?? 'selo';
  const tierCfg = TIER_CONFIG[settlementTier] ?? TIER_CONFIG.selo;
  const pop = snap.pop;

  // Compute progress toward next tier
  const currentTierIndex = TIER_ORDER.indexOf(settlementTier);
  const nextTierKey = currentTierIndex < TIER_ORDER.length - 1 ? TIER_ORDER[currentTierIndex + 1] : null;
  const nextTierCfg = nextTierKey ? TIER_CONFIG[nextTierKey] : null;

  const prevThreshold = tierCfg.threshold;
  const nextThreshold = nextTierCfg?.threshold ?? prevThreshold;
  const tierRange = nextThreshold - prevThreshold;
  const tierProgress = tierRange > 0 ? Math.min((pop - prevThreshold) / tierRange, 1) : 1;

  // ── Utility data ──────────────────────────────────────────────────────
  const waterGen = snap.waterGen;
  const waterUsed = snap.waterUsed;
  const powerGen = snap.powerGen;
  const powerUsed = snap.powerUsed;

  const waterRatio = waterGen > 0 ? Math.min(waterUsed / waterGen, 1) : waterUsed > 0 ? 1 : 0;
  const powerRatio = powerGen > 0 ? Math.min(powerUsed / powerGen, 1) : powerUsed > 0 ? 1 : 0;

  return (
    <SovietModal
      visible={visible}
      variant="terminal"
      title="INFRASTRUCTURE"
      stampText="MINISTRY OF TRANSPORT"
      actionLabel="CLOSE"
      onAction={onDismiss}
      dismissOnOverlay
      onDismiss={onDismiss}
    >
      {/* ── ROAD NETWORK ──────────────────────────────────────────── */}
      <SectionHeader title="ROAD NETWORK" />

      <View style={styles.row}>
        <Text style={styles.label}>QUALITY:</Text>
        <Text style={[styles.value, { color: roadCfg.color }]}>{roadCfg.label}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>CONDITION:</Text>
        <Text style={[styles.value, { color: condColor }]}>{Math.round(roadCondition)}%</Text>
      </View>

      <View style={styles.barRow}>
        <ProgressBar ratio={roadCondition / 100} color={condColor} />
        <Text style={[styles.barPercent, { color: condColor }]}>{Math.round(roadCondition)}%</Text>
      </View>

      <Divider />

      {/* ── SETTLEMENT STATUS ─────────────────────────────────────── */}
      <SectionHeader title="SETTLEMENT STATUS" />

      <View style={styles.row}>
        <Text style={styles.label}>TIER:</Text>
        <Text style={[styles.value, { color: Colors.sovietGold }]}>{tierCfg.label}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>POPULATION:</Text>
        <Text style={styles.value}>{pop}</Text>
      </View>

      <Text style={styles.tierDesc}>{tierCfg.desc}</Text>

      {nextTierCfg ? (
        <>
          <View style={styles.row}>
            <Text style={styles.sublabel}>NEXT TIER:</Text>
            <Text style={[styles.sublabelValue, { color: Colors.textSecondary }]}>
              {nextTierCfg.label} ({nextThreshold} pop)
            </Text>
          </View>

          <View style={styles.barRow}>
            <ProgressBar ratio={tierProgress} color={tierProgress >= 1 ? Colors.termGreen : Colors.sovietGold} />
            <Text style={[styles.barPercent, { color: tierProgress >= 1 ? Colors.termGreen : Colors.sovietGold }]}>
              {Math.round(tierProgress * 100)}%
            </Text>
          </View>
        </>
      ) : (
        <Text style={styles.maxTierText}>MAXIMUM TIER ACHIEVED</Text>
      )}

      <Divider />

      {/* ── UTILITIES ─────────────────────────────────────────────── */}
      <SectionHeader title="UTILITIES" />

      {/* Water */}
      <View style={styles.utilityBlock}>
        <View style={styles.row}>
          <Text style={styles.label}>WATER:</Text>
          <Text style={[styles.value, { color: utilityColor(waterGen, waterUsed) }]}>
            {waterUsed} / {waterGen}
          </Text>
        </View>
        <View style={styles.barRow}>
          <ProgressBar ratio={waterRatio} color={utilityColor(waterGen, waterUsed)} />
          <Text style={[styles.barPercent, { color: utilityColor(waterGen, waterUsed) }]}>
            {waterGen > 0 ? Math.round((waterUsed / waterGen) * 100) : waterUsed > 0 ? 'OVER' : '0'}
            {waterGen > 0 ? '%' : ''}
          </Text>
        </View>
      </View>

      {/* Power */}
      <View style={styles.utilityBlock}>
        <View style={styles.row}>
          <Text style={styles.label}>POWER:</Text>
          <Text style={[styles.value, { color: utilityColor(powerGen, powerUsed) }]}>
            {powerUsed} / {powerGen}
          </Text>
        </View>
        <View style={styles.barRow}>
          <ProgressBar ratio={powerRatio} color={utilityColor(powerGen, powerUsed)} />
          <Text style={[styles.barPercent, { color: utilityColor(powerGen, powerUsed) }]}>
            {powerGen > 0 ? Math.round((powerUsed / powerGen) * 100) : powerUsed > 0 ? 'OVER' : '0'}
            {powerGen > 0 ? '%' : ''}
          </Text>
        </View>
      </View>
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
  sublabel: {
    fontSize: 10,
    fontFamily: monoFont,
    color: Colors.textSecondary,
  },
  sublabelValue: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
  },
  value: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.white,
  },
  tierDesc: {
    fontSize: 10,
    fontFamily: monoFont,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 8,
  },
  maxTierText: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.termGreen,
    letterSpacing: 1,
    marginTop: 6,
    textAlign: 'center',
  },

  // ── Progress bars ─────────────────────────────────────────────────────
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    marginBottom: 4,
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
  barPercent: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    minWidth: 36,
    textAlign: 'right',
  },

  // ── Utility block ─────────────────────────────────────────────────────
  utilityBlock: {
    marginBottom: 8,
  },
});
