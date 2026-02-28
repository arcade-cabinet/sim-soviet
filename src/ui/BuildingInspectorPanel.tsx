/**
 * BuildingInspectorPanel — Detailed building inspection modal.
 *
 * Triggered from the RadialInspectMenu "Info" action. Shows building name,
 * type, production output, power status, worker list with morale indicators,
 * production rate, efficiency percentage, construction progress, health/decay,
 * smog output, and a DEMOLISH button.
 *
 * Reads the building entity directly from ECS by grid position.
 */

import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getEngine } from '../bridge/GameInit';
import { getBuildingDef } from '../data/buildingDefs';
import { buildingsLogic, decayableBuildings } from '../ecs/archetypes';
import { effectiveWorkers } from '../ecs/systems/productionSystem';
import type { BuildingComponent, CitizenComponent, Durability } from '../ecs/world';
import type { WorkerDisplayInfo } from '../game/workers/types';
import { SovietModal } from './SovietModal';
import { Colors, monoFont } from './styles';

// ── Types ───────────────────────────────────────────────────────────────────

/** Detailed info for a worker assigned to this building. */
interface AssignedWorkerInfo extends WorkerDisplayInfo {
  /** Worker's citizen class */
  class: CitizenComponent['class'];
}

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

/** Get detailed info for all workers assigned to a building defId. */
function getWorkersAt(defId: string): AssignedWorkerInfo[] {
  const engine = getEngine();
  if (!engine) return [];
  const ws = engine.getWorkerSystem();
  const statsMap = ws.getStatsMap();
  const workers: AssignedWorkerInfo[] = [];
  for (const [entity] of statsMap) {
    if (entity.citizen?.assignment === defId) {
      const info = ws.getWorkerInfo(entity);
      if (info) {
        workers.push(info);
      }
    }
  }
  return workers;
}

/** Get durability for a building entity if it has the durability component. */
function findDurability(gridX: number, gridY: number): Durability | null {
  for (const entity of decayableBuildings.entities) {
    if (entity.position?.gridX === gridX && entity.position?.gridY === gridY) {
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
  const phaseLabel = building.constructionPhase === 'foundation' ? 'FOUNDATION' : 'BUILDING';
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

/** Color for efficiency percentage. */
function efficiencyColor(pct: number): string {
  if (pct >= 80) return Colors.termGreen;
  if (pct >= 50) return Colors.sovietGold;
  return '#ef4444';
}

/** Morale icon based on morale value (0-100). */
function moraleIcon(morale: number): string {
  if (morale >= 70) return '\u2605'; // star — happy
  if (morale >= 40) return '\u25CF'; // circle — neutral
  return '\u2717'; // cross — unhappy
}

/** Color for morale value. */
function moraleColor(morale: number): string {
  if (morale >= 70) return Colors.termGreen;
  if (morale >= 40) return Colors.sovietGold;
  return '#ef4444';
}

/** Status label for worker display. */
function statusLabel(status: WorkerDisplayInfo['status']): string {
  switch (status) {
    case 'working':
      return 'WORKING';
    case 'idle':
      return 'IDLE';
    case 'hungry':
      return 'HUNGRY';
    case 'drunk':
      return 'INTOXICATED';
    case 'defecting':
      return 'DISLOYAL';
  }
}

/** Color for worker status. */
function statusColor(status: WorkerDisplayInfo['status']): string {
  switch (status) {
    case 'working':
      return Colors.termGreen;
    case 'idle':
      return '#9e9e9e';
    case 'hungry':
      return Colors.sovietGold;
    case 'drunk':
      return '#ff9800';
    case 'defecting':
      return '#ef4444';
  }
}

/** Class abbreviation for display. */
const CLASS_ABBREV: Record<CitizenComponent['class'], string> = {
  worker: 'WRK',
  party_official: 'PTY',
  engineer: 'ENG',
  farmer: 'FRM',
  soldier: 'SOL',
  prisoner: 'PRS',
};

/** Class color for display. */
const CLASS_COLOR: Record<CitizenComponent['class'], string> = {
  worker: '#90a4ae',
  party_official: Colors.sovietRed,
  engineer: Colors.termBlue,
  farmer: '#8bc34a',
  soldier: '#4caf50',
  prisoner: '#ff9800',
};

/**
 * Calculate building efficiency percentage based on staffing, health,
 * power status, and average worker morale.
 *
 * Returns { pct, reasons } where reasons is an array of strings
 * explaining sub-optimal efficiency.
 */
function calcEfficiency(
  workerCount: number,
  workerCap: number,
  health: number,
  powered: boolean,
  powerReq: number,
  avgMorale: number,
  isUnderConstruction: boolean,
): { pct: number; reasons: string[] } {
  if (isUnderConstruction) {
    return { pct: 0, reasons: ['Under construction'] };
  }

  const reasons: string[] = [];
  let efficiency = 1.0;

  // Staffing factor
  if (workerCap > 0) {
    if (workerCount === 0) {
      efficiency *= 0;
      reasons.push('No workers assigned');
    } else if (workerCount < workerCap) {
      const staffRatio = workerCount / workerCap;
      efficiency *= staffRatio;
      reasons.push('Understaffed');
    } else if (workerCount > workerCap) {
      // Overstaffing has diminishing returns
      const eff = effectiveWorkers(workerCount, workerCap) / workerCount;
      efficiency *= eff;
      if (eff < 0.9) reasons.push('Overstaffed');
    }
  }

  // Health factor
  if (health < 100) {
    const healthFactor = health / 100;
    efficiency *= healthFactor;
    if (health < 50) reasons.push('Needs repair');
  }

  // Power factor
  if (powerReq > 0 && !powered) {
    efficiency *= 0;
    reasons.push('No power');
  }

  // Morale factor (only if there are workers)
  if (workerCap > 0 && workerCount > 0 && avgMorale < 50) {
    const moraleFactor = 0.5 + avgMorale / 100;
    efficiency *= moraleFactor;
    reasons.push('Low morale');
  }

  const pct = Math.round(Math.min(100, efficiency * 100));
  return { pct, reasons };
}

/** Max workers displayed in the individual worker list before truncating. */
const MAX_DISPLAYED_WORKERS = 8;

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
          {Math.round(value)}
          {suffix ? suffix : ''}
          {max > 0 ? ` / ${max}` : ''}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
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
    <Text style={[styles.infoValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
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

  // Workers — full detail list
  const assignedWorkers = getWorkersAt(buildingDefId);
  const workerCap = def?.stats.staffCap ?? def?.stats.jobs ?? 0;
  const workerCount = assignedWorkers.length;

  // Average morale across assigned workers
  const avgMorale = workerCount > 0 ? assignedWorkers.reduce((sum, w) => sum + w.morale, 0) / workerCount : 0;

  // Average production efficiency across assigned workers
  const avgWorkerEfficiency =
    workerCount > 0 ? assignedWorkers.reduce((sum, w) => sum + w.productionEfficiency, 0) / workerCount : 0;

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

  // Efficiency calculation
  const efficiency = calcEfficiency(
    workerCount,
    workerCap,
    health,
    powered,
    powerReq,
    avgMorale,
    constructionInfo != null,
  );

  // Effective production rate (base amount * efficiency factor)
  const effectiveOutput = produces ? +(produces.amount * (efficiency.pct / 100)).toFixed(1) : 0;

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
      {cost > 0 && <InfoRow label="COST" value={`${cost}`} valueColor={Colors.sovietGold} />}

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

      {/* Efficiency */}
      {!constructionInfo && (workerCap > 0 || produces) && (
        <>
          <SectionDivider label="Efficiency" />
          <StatBar
            label="EFFICIENCY"
            value={efficiency.pct}
            max={100}
            color={efficiencyColor(efficiency.pct)}
            suffix="%"
          />
          {efficiency.reasons.length > 0 && (
            <Text style={styles.efficiencyReasons}>{efficiency.reasons.join(' \u2022 ')}</Text>
          )}
        </>
      )}

      {/* Power Status */}
      <SectionDivider label="Power" />
      {powerOutput > 0 ? (
        <InfoRow label="POWER OUTPUT" value={`${powerOutput}W`} valueColor={Colors.termGreen} />
      ) : powerReq > 0 ? (
        <>
          <InfoRow label="POWER STATUS" value={powered ? 'POWERED' : 'UNPOWERED'} valueColor={powerColor(powered)} />
          <InfoRow label="POWER DEMAND" value={`${powerReq}W`} />
        </>
      ) : (
        <InfoRow label="POWER" value="NO REQUIREMENT" valueColor="#9e9e9e" />
      )}

      {/* Production Rate */}
      {produces && (
        <>
          <SectionDivider label="Production" />
          <InfoRow
            label="BASE OUTPUT"
            value={`${produces.resource.toUpperCase()}: ${produces.amount}/tick`}
            valueColor="#9e9e9e"
          />
          <InfoRow
            label="EFFECTIVE OUTPUT"
            value={`${produces.resource.toUpperCase()}: ${effectiveOutput}/tick`}
            valueColor={effectiveOutput > 0 ? Colors.termGreen : '#ef4444'}
          />
          {workerCap > 0 && workerCount > 0 && (
            <InfoRow
              label="AVG WORKER EFF."
              value={`${Math.round(avgWorkerEfficiency * 100)}%`}
              valueColor={efficiencyColor(Math.round(avgWorkerEfficiency * 100))}
            />
          )}
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
          {workerCount === 0 ? (
            <Text style={styles.noWorkers}>No workers assigned</Text>
          ) : (
            <View style={styles.workerList}>
              {assignedWorkers.slice(0, MAX_DISPLAYED_WORKERS).map((w, i) => (
                <View key={i} style={styles.workerRow}>
                  <Text style={[styles.workerClass, { color: CLASS_COLOR[w.class] }]}>{CLASS_ABBREV[w.class]}</Text>
                  <Text style={styles.workerName} numberOfLines={1}>
                    {w.name}
                  </Text>
                  <Text style={[styles.workerMorale, { color: moraleColor(w.morale) }]}>
                    {moraleIcon(w.morale)} {w.morale}
                  </Text>
                  <Text style={[styles.workerStatus, { color: statusColor(w.status) }]}>{statusLabel(w.status)}</Text>
                </View>
              ))}
              {workerCount > MAX_DISPLAYED_WORKERS && (
                <Text style={styles.workerOverflow}>+{workerCount - MAX_DISPLAYED_WORKERS} more workers</Text>
              )}
            </View>
          )}
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
      <StatBar label="HEALTH" value={health} max={100} color={healthColor(health)} />
      {decayRate > 0 && <InfoRow label="DECAY RATE" value={`-${decayRate}/tick`} valueColor="#ef4444" />}

      {/* Environmental */}
      {(pollution > 0 || fear > 0) && (
        <>
          <SectionDivider label="Environmental Impact" />
          {pollution > 0 && <InfoRow label="SMOG OUTPUT" value={`${pollution}/tick`} valueColor="#9e9e9e" />}
          {fear > 0 && <InfoRow label="FEAR OUTPUT" value={`${fear}/tick`} valueColor={Colors.sovietRed} />}
        </>
      )}

      {/* Demolish Button */}
      <View style={styles.demolishContainer}>
        <Text style={styles.demolishBtn} onPress={onDemolish}>
          DEMOLISH BUILDING
        </Text>
        <Text style={styles.demolishNote}>This action is irreversible. All workers will be unassigned.</Text>
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

  // Worker list
  workerList: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 4,
  },
  workerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    gap: 6,
  },
  workerClass: {
    fontSize: 8,
    fontFamily: monoFont,
    fontWeight: 'bold',
    width: 24,
    letterSpacing: 1,
  },
  workerName: {
    flex: 1,
    fontSize: 9,
    fontFamily: monoFont,
    color: '#ccc',
  },
  workerMorale: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    width: 36,
    textAlign: 'right',
  },
  workerStatus: {
    fontSize: 8,
    fontFamily: monoFont,
    fontWeight: 'bold',
    width: 60,
    textAlign: 'right',
    letterSpacing: 0.5,
  },
  noWorkers: {
    fontSize: 10,
    fontFamily: monoFont,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 6,
  },
  workerOverflow: {
    fontSize: 9,
    fontFamily: monoFont,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingTop: 4,
  },

  // Efficiency
  efficiencyReasons: {
    fontSize: 9,
    fontFamily: monoFont,
    color: '#ff9800',
    fontStyle: 'italic',
    marginTop: 2,
    marginBottom: 4,
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
