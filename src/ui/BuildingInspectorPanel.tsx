/**
 * BuildingInspectorPanel — Detailed building inspection modal with data rings.
 *
 * Triggered from the RadialInspectMenu "Info" action. Organized into three
 * type-specific data ring sections:
 *
 *   Production Ring  (green)  — output rates, efficiency, worker contribution,
 *                               star rating. Only for buildings that produce.
 *   Demographic Ring (gold)   — class distribution, morale distribution,
 *                               aggregate stats, personnel roster. Only for
 *                               buildings with worker capacity.
 *   Records Ring     (blue)   — identification, operational status, structural
 *                               integrity, power, fire, environmental impact.
 *                               Shown for all buildings.
 *
 * Reads the building entity directly from ECS by grid position.
 */

import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getEngine } from '../bridge/GameInit';
import { getBuildingDef } from '../data/buildingDefs';
import { buildingsLogic, decayableBuildings } from '../ecs/archetypes';
import { effectiveWorkers } from '../ecs/systems/productionSystem';
import { getBuildingStorageContribution } from '../ecs/systems/storageSystem';
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

// ── Ring Header ─────────────────────────────────────────────────────────────

/** A visually distinctive ring section header with Soviet-style framing. */
const RingHeader: React.FC<{ label: string; icon: string; color: string }> = ({ label, icon, color }) => (
  <View style={ringStyles.header}>
    <View style={[ringStyles.headerAccent, { backgroundColor: color }]} />
    <Text style={[ringStyles.headerIcon, { color }]}>{icon}</Text>
    <Text style={[ringStyles.headerLabel, { color }]}>{label}</Text>
    <View style={[ringStyles.headerLine, { backgroundColor: color }]} />
    <Text style={[ringStyles.headerDot, { color }]}>{'\u25C9'}</Text>
  </View>
);

// ── Mini Distribution Bar ───────────────────────────────────────────────────

/** Horizontal stacked distribution bar for showing class/morale breakdowns. */
const DistributionBar: React.FC<{
  segments: Array<{ label: string; value: number; color: string }>;
  total: number;
}> = ({ segments, total }) => {
  if (total === 0) return null;
  return (
    <View style={ringStyles.distContainer}>
      <View style={ringStyles.distBar}>
        {segments.filter(s => s.value > 0).map((seg, i) => (
          <View
            key={i}
            style={[
              ringStyles.distSegment,
              { width: `${(seg.value / total) * 100}%`, backgroundColor: seg.color },
            ]}
          />
        ))}
      </View>
      <View style={ringStyles.distLegend}>
        {segments.filter(s => s.value > 0).map((seg, i) => (
          <View key={i} style={ringStyles.distLegendItem}>
            <View style={[ringStyles.distDot, { backgroundColor: seg.color }]} />
            <Text style={ringStyles.distLegendText}>
              {seg.label} {seg.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// ── Production Ring ─────────────────────────────────────────────────────────

/** Type-specific production data ring — output rates, efficiency, worker contribution. */
const ProductionRing: React.FC<{
  produces: { resource: string; amount: number } | undefined;
  effectiveOutput: number;
  efficiencyPct: number;
  avgWorkerEfficiency: number;
  workerCount: number;
  workerCap: number;
  powerOutput: number;
  storageContribution: number;
  role: string;
}> = ({ produces, effectiveOutput, efficiencyPct, avgWorkerEfficiency, workerCount, workerCap, powerOutput, storageContribution, role }) => {
  // Only show for buildings that produce something
  const hasProduction = produces || powerOutput > 0 || storageContribution > 0;
  if (!hasProduction) return null;

  return (
    <View style={ringStyles.ring}>
      <RingHeader label="PRODUCTION RING" icon={'\u2699'} color={Colors.termGreen} />

      {produces && (
        <>
          <InfoRow
            label="RESOURCE"
            value={produces.resource.toUpperCase()}
            valueColor={Colors.termGreen}
          />
          <InfoRow
            label="BASE RATE"
            value={`${produces.amount}/tick`}
            valueColor="#9e9e9e"
          />
          <StatBar
            label="EFFECTIVE OUTPUT"
            value={effectiveOutput}
            max={produces.amount}
            color={effectiveOutput > 0 ? Colors.termGreen : '#ef4444'}
            suffix="/tick"
          />
          <InfoRow
            label="PLANT EFFICIENCY"
            value={`${efficiencyPct}%`}
            valueColor={efficiencyColor(efficiencyPct)}
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

      {powerOutput > 0 && (
        <>
          <InfoRow label="POWER GENERATED" value={`${powerOutput}W`} valueColor={Colors.termGreen} />
          <InfoRow label="ROLE" value="POWER GENERATION" valueColor="#9e9e9e" />
        </>
      )}

      {storageContribution > 0 && (
        <InfoRow label="STORAGE ADDED" value={`+${storageContribution} units`} valueColor={Colors.sovietGold} />
      )}

      {/* Output rating — a quick visual assessment */}
      {produces && (
        <View style={ringStyles.ratingRow}>
          <Text style={ringStyles.ratingLabel}>OUTPUT RATING</Text>
          <Text style={[ringStyles.ratingStars, { color: efficiencyColor(efficiencyPct) }]}>
            {outputRatingStars(efficiencyPct)}
          </Text>
        </View>
      )}
    </View>
  );
};

/** Convert efficiency pct to a star rating (1-5 stars). */
function outputRatingStars(pct: number): string {
  const stars = Math.max(1, Math.min(5, Math.ceil(pct / 20)));
  return '\u2605'.repeat(stars) + '\u2606'.repeat(5 - stars);
}

// ── Demographic Ring ────────────────────────────────────────────────────────

/** Type-specific demographic data ring — class distribution, morale, skill breakdown. */
const DemographicRing: React.FC<{
  workers: AssignedWorkerInfo[];
  workerCap: number;
}> = ({ workers, workerCap }) => {
  if (workerCap === 0) return null;

  const workerCount = workers.length;

  // Class distribution
  const classCounts: Record<string, number> = {};
  for (const w of workers) {
    classCounts[w.class] = (classCounts[w.class] ?? 0) + 1;
  }
  const classSegments = Object.entries(classCounts).map(([cls, count]) => ({
    label: CLASS_ABBREV[cls as CitizenComponent['class']] ?? cls.toUpperCase(),
    value: count,
    color: CLASS_COLOR[cls as CitizenComponent['class']] ?? '#9e9e9e',
  }));

  // Morale distribution
  const moraleBuckets = { high: 0, mid: 0, low: 0 };
  let totalSkill = 0;
  for (const w of workers) {
    if (w.morale >= 70) moraleBuckets.high++;
    else if (w.morale >= 40) moraleBuckets.mid++;
    else moraleBuckets.low++;
    totalSkill += (w as unknown as { skill?: number }).skill ?? 50;
  }
  const moraleSegments = [
    { label: 'HIGH', value: moraleBuckets.high, color: Colors.termGreen },
    { label: 'MED', value: moraleBuckets.mid, color: Colors.sovietGold },
    { label: 'LOW', value: moraleBuckets.low, color: '#ef4444' },
  ];

  // Average stats
  const avgMorale = workerCount > 0 ? Math.round(workers.reduce((s, w) => s + w.morale, 0) / workerCount) : 0;
  const avgSkill = workerCount > 0 ? Math.round(totalSkill / workerCount) : 0;

  return (
    <View style={ringStyles.ring}>
      <RingHeader label="DEMOGRAPHIC RING" icon={'\u263A'} color={Colors.sovietGold} />

      <StatBar
        label="STAFFING"
        value={workerCount}
        max={workerCap}
        color={workerCount >= workerCap ? Colors.termGreen : Colors.sovietGold}
      />

      {workerCount > 0 && (
        <>
          {/* Class distribution */}
          <Text style={ringStyles.subLabel}>CLASS DISTRIBUTION</Text>
          <DistributionBar segments={classSegments} total={workerCount} />

          {/* Morale distribution */}
          <Text style={ringStyles.subLabel}>MORALE DISTRIBUTION</Text>
          <DistributionBar segments={moraleSegments} total={workerCount} />

          {/* Aggregate stats */}
          <View style={ringStyles.statsRow}>
            <View style={ringStyles.statCell}>
              <Text style={ringStyles.statValue}>{avgMorale}</Text>
              <Text style={ringStyles.statLabel}>AVG MORALE</Text>
            </View>
            <View style={ringStyles.statCell}>
              <Text style={ringStyles.statValue}>{avgSkill}</Text>
              <Text style={ringStyles.statLabel}>AVG SKILL</Text>
            </View>
            <View style={ringStyles.statCell}>
              <Text style={ringStyles.statValue}>{workerCount}</Text>
              <Text style={ringStyles.statLabel}>ASSIGNED</Text>
            </View>
          </View>

          {/* Worker list */}
          <Text style={ringStyles.subLabel}>PERSONNEL ROSTER</Text>
          <View style={styles.workerList}>
            {workers.slice(0, MAX_DISPLAYED_WORKERS).map((w, i) => (
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
        </>
      )}

      {workerCount === 0 && (
        <Text style={styles.noWorkers}>No workers assigned — building idle</Text>
      )}
    </View>
  );
};

// ── Records Ring ────────────────────────────────────────────────────────────

/** Structural records ring — construction data, health, operational stats. */
const RecordsRing: React.FC<{
  constructionInfo: { label: string; progress: number } | null;
  health: number;
  decayRate: number;
  pollution: number;
  fear: number;
  onFire: boolean;
  fireTicksRemaining: number;
  powered: boolean;
  powerReq: number;
  powerOutput: number;
  footX: number;
  footY: number;
  cost: number;
  gridX: number;
  gridY: number;
  role: string;
  level: number;
}> = ({ constructionInfo, health, decayRate, pollution, fear, onFire, fireTicksRemaining, powered, powerReq, powerOutput, footX, footY, cost, gridX, gridY, role, level }) => {
  // Estimated remaining lifespan based on current health and decay rate
  const estimatedLife = decayRate > 0 ? Math.round(health / decayRate) : null;

  // Operational status summary
  const opStatus = constructionInfo
    ? 'UNDER CONSTRUCTION'
    : onFire
      ? 'EMERGENCY — FIRE'
      : !powered && powerReq > 0
        ? 'OFFLINE — NO POWER'
        : 'OPERATIONAL';

  const opColor = constructionInfo
    ? '#ff9800'
    : onFire
      ? '#ef4444'
      : !powered && powerReq > 0
        ? '#ef4444'
        : Colors.termGreen;

  return (
    <View style={ringStyles.ring}>
      <RingHeader label="RECORDS RING" icon={'\u2318'} color={Colors.termBlue} />

      {/* Identification */}
      <InfoRow label="GRID POSITION" value={`[${gridX}, ${gridY}]`} />
      <InfoRow label="CLASSIFICATION" value={role.toUpperCase()} />
      <InfoRow label="UPGRADE LEVEL" value={`TIER ${level}`} />
      <InfoRow label="FOOTPRINT" value={`${footX}\u00D7${footY} cells`} />
      {cost > 0 && <InfoRow label="CONSTRUCTION COST" value={`\u20BD ${cost}`} valueColor={Colors.sovietGold} />}

      {/* Operational status */}
      <View style={ringStyles.statusBadge}>
        <Text style={[ringStyles.statusText, { color: opColor }]}>{'\u25CF'} {opStatus}</Text>
      </View>

      {/* Construction progress */}
      {constructionInfo && (
        <>
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

      {/* Structural integrity */}
      <StatBar label="STRUCTURAL INTEGRITY" value={health} max={100} color={healthColor(health)} />
      {decayRate > 0 && (
        <>
          <InfoRow label="DECAY RATE" value={`-${decayRate}/tick`} valueColor="#ef4444" />
          {estimatedLife !== null && (
            <InfoRow
              label="EST. LIFESPAN"
              value={`~${estimatedLife} ticks`}
              valueColor={estimatedLife < 50 ? '#ef4444' : estimatedLife < 200 ? Colors.sovietGold : '#9e9e9e'}
            />
          )}
        </>
      )}

      {/* Power */}
      {powerOutput > 0 ? (
        <InfoRow label="POWER OUTPUT" value={`${powerOutput}W`} valueColor={Colors.termGreen} />
      ) : powerReq > 0 ? (
        <InfoRow
          label="POWER STATUS"
          value={powered ? `POWERED (${powerReq}W)` : `UNPOWERED (${powerReq}W req.)`}
          valueColor={powerColor(powered)}
        />
      ) : null}

      {/* Fire */}
      {onFire && (
        <>
          <InfoRow label="FIRE STATUS" value="ACTIVE FIRE" valueColor="#ef4444" />
          {fireTicksRemaining > 0 && (
            <InfoRow label="EXTINGUISHES IN" value={`${fireTicksRemaining} ticks`} valueColor="#ff9800" />
          )}
        </>
      )}

      {/* Environmental */}
      {(pollution > 0 || fear > 0) && (
        <>
          {pollution > 0 && <InfoRow label="SMOG OUTPUT" value={`${pollution}/tick`} valueColor="#9e9e9e" />}
          {fear > 0 && <InfoRow label="FEAR RADIUS" value={`${fear}/tick`} valueColor={Colors.sovietRed} />}
        </>
      )}
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

  // Fire
  const onFire = building?.onFire ?? false;
  const fireTicksRemaining = building?.fireTicksRemaining ?? 0;

  // Storage
  const storageContribution = getBuildingStorageContribution(buildingDefId);

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

  // Determine stamp text based on construction / power / fire state
  let stampText: string;
  if (onFire) {
    stampText = 'ON FIRE';
  } else if (constructionInfo) {
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

      {/* Efficiency summary (compact, always visible for productive buildings) */}
      {!constructionInfo && (workerCap > 0 || produces) && (
        <View style={ringStyles.efficiencySummary}>
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
        </View>
      )}

      {/* Housing note (compact, above rings) */}
      {housingCap > 0 && (
        <View style={ringStyles.housingBadge}>
          <Text style={ringStyles.housingText}>
            {'\u2302'} HOUSING CAPACITY: {housingCap} CITIZENS
          </Text>
        </View>
      )}

      {/* ═══ Production Ring ═══ */}
      <ProductionRing
        produces={produces}
        effectiveOutput={effectiveOutput}
        efficiencyPct={efficiency.pct}
        avgWorkerEfficiency={avgWorkerEfficiency}
        workerCount={workerCount}
        workerCap={workerCap}
        powerOutput={powerOutput}
        storageContribution={storageContribution}
        role={role}
      />

      {/* ═══ Demographic Ring ═══ */}
      <DemographicRing
        workers={assignedWorkers}
        workerCap={workerCap}
      />

      {/* ═══ Records Ring ═══ */}
      <RecordsRing
        constructionInfo={constructionInfo}
        health={health}
        decayRate={decayRate}
        pollution={pollution}
        fear={fear}
        onFire={onFire}
        fireTicksRemaining={fireTicksRemaining}
        powered={powered}
        powerReq={powerReq}
        powerOutput={powerOutput}
        footX={footX}
        footY={footY}
        cost={cost}
        gridX={gridX}
        gridY={gridY}
        role={role}
        level={building?.level ?? 0}
      />

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

// ── Ring Styles ────────────────────────────────────────────────────────────

const ringStyles = StyleSheet.create({
  // Ring container
  ring: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: 10,
  },

  // Ring header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  headerAccent: {
    width: 3,
    height: 16,
  },
  headerIcon: {
    fontSize: 14,
    fontFamily: monoFont,
  },
  headerLabel: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  headerLine: {
    flex: 1,
    height: 1,
    opacity: 0.4,
  },
  headerDot: {
    fontSize: 10,
  },

  // Sub-label within a ring
  subLabel: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#777',
    letterSpacing: 1.5,
    marginTop: 8,
    marginBottom: 4,
  },

  // Distribution bar
  distContainer: {
    marginBottom: 6,
  },
  distBar: {
    flexDirection: 'row',
    height: 8,
    borderWidth: 1,
    borderColor: '#444',
    backgroundColor: '#222',
    overflow: 'hidden',
  },
  distSegment: {
    height: '100%',
  },
  distLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 3,
  },
  distLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  distDot: {
    width: 6,
    height: 6,
  },
  distLegendText: {
    fontSize: 8,
    fontFamily: monoFont,
    color: '#999',
  },

  // Stats row (3-column aggregate)
  statsRow: {
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 4,
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 6,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 7,
    fontFamily: monoFont,
    color: '#777',
    letterSpacing: 1,
    marginTop: 2,
  },

  // Rating row
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 6,
  },
  ratingLabel: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#777',
    letterSpacing: 1,
  },
  ratingStars: {
    fontSize: 14,
    fontFamily: monoFont,
    letterSpacing: 2,
  },

  // Status badge
  statusBadge: {
    marginVertical: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 1,
    borderColor: '#444',
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  // Efficiency summary (above rings)
  efficiencySummary: {
    marginBottom: 4,
  },

  // Housing badge
  housingBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(64, 196, 255, 0.1)',
    borderWidth: 1,
    borderColor: Colors.termBlue,
    marginBottom: 4,
  },
  housingText: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.termBlue,
    letterSpacing: 1,
  },
});
