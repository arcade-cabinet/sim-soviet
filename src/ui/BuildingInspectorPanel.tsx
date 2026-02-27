/**
 * BuildingInspectorPanel — Detailed building inspection modal.
 *
 * Triggered from the RadialInspectMenu "Info" action. Shows building name,
 * type, production output, power status, worker count/capacity, construction
 * progress, health/decay, smog output, and a DEMOLISH button.
 *
 * Reads the building entity directly from ECS by grid position.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SovietModal } from './SovietModal';
import { Colors, monoFont } from './styles';
import { getBuildingDef } from '../data/buildingDefs';
import { buildingsLogic, decayableBuildings } from '../ecs/archetypes';
import { getEngine } from '../bridge/GameInit';
import type { BuildingComponent, Durability } from '../ecs/world';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Find the building entity at the given grid position. */
function findBuildingAt(gridX: number, gridY: number) {
  for (const entity of buildingsLogic.entities) {
    if (entity.position.gridX === gridX && entity.position.gridY === gridY) {
      return entity;
    }
  }
  return null;
}

/** Count workers assigned to a building defId at a given grid position. */
function countWorkersAt(defId: string): number {
  const engine = getEngine();
  if (!engine) return 0;
  const ws = engine.getWorkerSystem();
  const statsMap = ws.getStatsMap();
  let count = 0;
  for (const [entity] of statsMap) {
    if (entity.citizen?.assignment === defId) {
      count++;
    }
  }
  return count;
}

/** Get durability for a building entity if it has the durability component. */
function findDurability(gridX: number, gridY: number): Durability | null {
  for (const entity of decayableBuildings.entities) {
    if (
      entity.position?.gridX === gridX &&
      entity.position?.gridY === gridY
    ) {
      return entity.durability;
    }
  }
  return null;
}

/** Determine the construction status label and progress fraction. */
function getConstructionInfo(building: BuildingComponent): {
  label: string;
  progress: number;
} | null {
  if (!building.constructionPhase || building.constructionPhase === 'complete') {
    return null;
  }
  const phaseLabel =
    building.constructionPhase === 'foundation' ? 'FOUNDATION' : 'BUILDING';
  const progress = building.constructionProgress ?? 0;
  return { label: phaseLabel, progress };
}

/** Color for power status. */
function powerColor(powered: boolean): string {
  return powered ? Colors.termGreen : '#ef4444';
}

/** Color for health bar based on value (0-100). */
function healthColor(value: number): string {
  if (value >= 60) return Colors.termGreen;
  if (value >= 30) return Colors.sovietGold;
  return '#ef4444';
}

// ── Stat Bar ────────────────────────────────────────────────────────────────

const StatBar: React.FC<{
  label: string;
  value: number;
  max: number;
  color: string;
  suffix?: string;
}> = ({ label, value, max, color, suffix }) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <View style={styles.barContainer}>
      <View style={styles.barLabelRow}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={[styles.barValue, { color }]}>
          {Math.round(value)}{suffix ? suffix : ''}{max > 0 ? ` / ${max}` : ''}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View
          style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]}
        />
      </View>
    </View>
  );
};

// ── Info Row ────────────────────────────────────────────────────────────────

const InfoRow: React.FC<{
  label: string;
  value: string;
  valueColor?: string;
}> = ({ label, value, valueColor }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={[styles.infoValue, valueColor ? { color: valueColor } : null]}>
      {value}
    </Text>
  </View>
);

// ── Section Divider ─────────────────────────────────────────────────────────

const SectionDivider: React.FC<{ label: string }> = ({ label }) => (
  <View style={styles.sectionDivider}>
    <View style={styles.dividerLine} />
    <Text style={styles.dividerLabel}>{label}</Text>
    <View style={styles.dividerLine} />
  </View>
);

// ── Main Component ──────────────────────────────────────────────────────────

export interface BuildingInspectorPanelProps {
  visible: boolean;
  buildingDefId: string;
  gridX: number;
  gridY: number;
  onDismiss: () => void;
  onDemolish: () => void;
}

export const BuildingInspectorPanel: React.FC<BuildingInspectorPanelProps> = ({
  visible,
  buildingDefId,
  gridX,
  gridY,
  onDismiss,
  onDemolish,
}) => {
  if (!visible) return null;

  const def = getBuildingDef(buildingDefId);
  const entity = findBuildingAt(gridX, gridY);
  const building = entity?.building;

  const name = def?.presentation.name ?? buildingDefId;
  const desc = def?.presentation.desc ?? '';
  const role = def?.role ?? 'utility';
  const icon = def?.presentation.icon ?? '';

  // Power info
  const powered = building?.powered ?? false;
  const powerReq = building?.powerReq ?? def?.stats.powerReq ?? 0;
  const powerOutput = building?.powerOutput ?? def?.stats.powerOutput ?? 0;

  // Production info
  const produces = building?.produces ?? def?.stats.produces;

  // Workers
  const workerCap = def?.stats.staffCap ?? def?.stats.jobs ?? 0;
  const workerCount = countWorkersAt(buildingDefId);

  // Housing
  const housingCap = building?.housingCap ?? def?.stats.housingCap ?? 0;

  // Construction
  const constructionInfo = building ? getConstructionInfo(building) : null;

  // Durability / health
  const durability = findDurability(gridX, gridY);
  const health = durability?.current ?? 100;
  const decayRate = durability?.decayRate ?? def?.stats.decayRate ?? 0;

  // Pollution / smog
  const pollution = building?.pollution ?? def?.stats.pollution ?? 0;

  // Fear
  const fear = building?.fear ?? def?.stats.fear ?? 0;

  // Footprint
  const footX = def?.footprint.tilesX ?? 1;
  const footY = def?.footprint.tilesY ?? 1;

  // Cost
  const cost = def?.presentation.cost ?? 0;

  // Determine stamp text based on construction / power state
  let stampText: string;
  if (constructionInfo) {
    stampText = 'CONSTRUCTION';
  } else if (powered || powerReq === 0) {
    stampText = 'OPERATIONAL';
  } else {
    stampText = 'UNPOWERED';
  }

  return (
    <SovietModal
      visible={visible}
      variant="terminal"
      title={`${icon} ${name.toUpperCase()}`}
      stampText={stampText}
      actionLabel="CLOSE REPORT"
      onAction={onDismiss}
      dismissOnOverlay
      onDismiss={onDismiss}
    >
      {/* Description */}
      {desc ? <Text style={styles.desc}>{desc}</Text> : null}

      {/* Location & Type */}
      <SectionDivider label="Identification" />
      <InfoRow label="POSITION" value={`[${gridX}, ${gridY}]`} />
      <InfoRow label="TYPE" value={role.toUpperCase()} />
      <InfoRow label="FOOTPRINT" value={`${footX} x ${footY}`} />
      {cost > 0 && (
        <InfoRow label="COST" value={`${cost}`} valueColor={Colors.sovietGold} />
      )}

      {/* Construction Progress */}
      {constructionInfo && (
        <>
          <SectionDivider label="Construction" />
          <InfoRow label="PHASE" value={constructionInfo.label} valueColor="#ff9800" />
          <StatBar
            label="PROGRESS"
            value={Math.round(constructionInfo.progress * 100)}
            max={100}
            color="#ff9800"
            suffix="%"
          />
        </>
      )}

      {/* Power Status */}
      <SectionDivider label="Power" />
      {powerOutput > 0 ? (
        <InfoRow
          label="POWER OUTPUT"
          value={`${powerOutput}W`}
          valueColor={Colors.termGreen}
        />
      ) : powerReq > 0 ? (
        <>
          <InfoRow
            label="POWER STATUS"
            value={powered ? 'POWERED' : 'UNPOWERED'}
            valueColor={powerColor(powered)}
          />
          <InfoRow label="POWER DEMAND" value={`${powerReq}W`} />
        </>
      ) : (
        <InfoRow label="POWER" value="NO REQUIREMENT" valueColor="#9e9e9e" />
      )}

      {/* Production */}
      {produces && (
        <>
          <SectionDivider label="Production" />
          <InfoRow
            label="OUTPUT"
            value={`${produces.resource.toUpperCase()}: ${produces.amount}/tick`}
            valueColor={Colors.termGreen}
          />
        </>
      )}

      {/* Workers */}
      {workerCap > 0 && (
        <>
          <SectionDivider label="Workers" />
          <StatBar
            label="STAFF"
            value={workerCount}
            max={workerCap}
            color={workerCount >= workerCap ? Colors.termGreen : Colors.sovietGold}
          />
        </>
      )}

      {/* Housing */}
      {housingCap > 0 && (
        <>
          <SectionDivider label="Housing" />
          <InfoRow label="CAPACITY" value={`${housingCap} citizens`} />
        </>
      )}

      {/* Health / Decay */}
      <SectionDivider label="Structural Integrity" />
      <StatBar
        label="HEALTH"
        value={health}
        max={100}
        color={healthColor(health)}
      />
      {decayRate > 0 && (
        <InfoRow
          label="DECAY RATE"
          value={`-${decayRate}/tick`}
          valueColor="#ef4444"
        />
      )}

      {/* Environmental */}
      {(pollution > 0 || fear > 0) && (
        <>
          <SectionDivider label="Environmental Impact" />
          {pollution > 0 && (
            <InfoRow
              label="SMOG OUTPUT"
              value={`${pollution}/tick`}
              valueColor="#9e9e9e"
            />
          )}
          {fear > 0 && (
            <InfoRow
              label="FEAR OUTPUT"
              value={`${fear}/tick`}
              valueColor={Colors.sovietRed}
            />
          )}
        </>
      )}

      {/* Demolish Button */}
      <View style={styles.demolishContainer}>
        <Text
          style={styles.demolishBtn}
          onPress={onDemolish}
        >
          DEMOLISH BUILDING
        </Text>
        <Text style={styles.demolishNote}>
          This action is irreversible. All workers will be unassigned.
        </Text>
      </View>
    </SovietModal>
  );
};

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  desc: {
    fontSize: 11,
    fontFamily: monoFont,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 8,
    lineHeight: 16,
  },

  // Section divider
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.sovietDarkRed,
  },
  dividerLabel: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#ff4444',
    letterSpacing: 2,
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    paddingVertical: 2,
  },
  infoLabel: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#9e9e9e',
    letterSpacing: 1,
  },
  infoValue: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#ccc',
  },

  // Stat bar
  barContainer: {
    marginBottom: 6,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  barLabel: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#9e9e9e',
    letterSpacing: 1,
  },
  barValue: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
  },
  barTrack: {
    height: 10,
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#555',
  },
  barFill: {
    height: '100%',
  },

  // Demolish
  demolishContainer: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 12,
  },
  demolishBtn: {
    width: '100%',
    textAlign: 'center',
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 2,
    color: '#ff4444',
    backgroundColor: 'rgba(139, 0, 0, 0.3)',
    borderWidth: 1,
    borderColor: Colors.sovietDarkRed,
    overflow: 'hidden',
  },
  demolishNote: {
    fontSize: 9,
    fontFamily: monoFont,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 6,
  },
});
