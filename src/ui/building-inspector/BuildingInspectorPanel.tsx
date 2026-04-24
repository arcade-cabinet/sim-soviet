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
import { Text, View } from 'react-native';
import { effectiveWorkers } from '../../ai/agents/economy/productionSystem';
import { getBuildingStorageContribution } from '../../ai/agents/economy/storageSystem';
import { getEngine } from '../../bridge/GameInit';
import { getBuildingDef } from '../../data/buildingDefs';
import { buildingsLogic, decayableBuildings } from '../../ecs/archetypes';
import type { BuildingComponent, Durability } from '../../ecs/world';
import { SovietModal } from '../SovietModal';
import { BuildingDossier } from './BuildingDossier';
import { BuildingRepairPanel } from './BuildingRepairPanel';
import { BuildingStats } from './BuildingStats';
import { BuildingWorkerPanel } from './BuildingWorkerPanel';
import { type AssignedWorkerInfo, efficiencyColor, StatBar } from './shared';
import { ringStyles, styles } from './styles';

// ── Helpers ──────────────────────────────────────────────────────────────────

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

  if (workerCap > 0) {
    if (workerCount === 0) {
      efficiency *= 0;
      reasons.push('No workers assigned');
    } else if (workerCount < workerCap) {
      const staffRatio = workerCount / workerCap;
      efficiency *= staffRatio;
      reasons.push('Understaffed');
    } else if (workerCount > workerCap) {
      const eff = effectiveWorkers(workerCount, workerCap) / workerCount;
      efficiency *= eff;
      if (eff < 0.9) reasons.push('Overstaffed');
    }
  }

  if (health < 100) {
    const healthFactor = health / 100;
    efficiency *= healthFactor;
    if (health < 50) reasons.push('Needs repair');
  }

  if (powerReq > 0 && !powered) {
    efficiency *= 0;
    reasons.push('No power');
  }

  if (workerCap > 0 && workerCount > 0 && avgMorale < 50) {
    const moraleFactor = 0.5 + avgMorale / 100;
    efficiency *= moraleFactor;
    reasons.push('Low morale');
  }

  const pct = Math.round(Math.min(100, efficiency * 100));
  return { pct, reasons };
}

// ── Public Props ─────────────────────────────────────────────────────────────

export interface BuildingInspectorPanelProps {
  visible: boolean;
  buildingDefId: string;
  gridX: number;
  gridY: number;
  onDismiss: () => void;
  onDemolish: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

/** Detailed building inspector showing stats, flavor text, workers, and upgrade options. */
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

  const powered = building?.powered ?? false;
  const powerReq = building?.powerReq ?? def?.stats.powerReq ?? 0;
  const powerOutput = building?.powerOutput ?? def?.stats.powerOutput ?? 0;

  const produces = building?.produces ?? def?.stats.produces;

  const assignedWorkers = getWorkersAt(buildingDefId);
  const workerCap = def?.stats.staffCap ?? def?.stats.jobs ?? 0;
  const workerCount = assignedWorkers.length;

  const avgMorale = workerCount > 0 ? assignedWorkers.reduce((sum, w) => sum + w.morale, 0) / workerCount : 0;
  const avgWorkerEfficiency =
    workerCount > 0 ? assignedWorkers.reduce((sum, w) => sum + w.productionEfficiency, 0) / workerCount : 0;

  const housingCap = building?.housingCap ?? def?.stats.housingCap ?? 0;

  const constructionInfo = building ? getConstructionInfo(building) : null;

  const durability = findDurability(gridX, gridY);
  const health = durability?.current ?? 100;
  const decayRate = durability?.decayRate ?? def?.stats.decayRate ?? 0;

  const pollution = building?.pollution ?? def?.stats.pollution ?? 0;
  const fear = building?.fear ?? def?.stats.fear ?? 0;

  const onFire = building?.onFire ?? false;
  const fireTicksRemaining = building?.fireTicksRemaining ?? 0;

  const storageContribution = getBuildingStorageContribution(buildingDefId);

  const footX = def?.footprint.tilesX ?? 1;
  const footY = def?.footprint.tilesY ?? 1;
  const cost = def?.presentation.cost ?? 0;

  const efficiency = calcEfficiency(
    workerCount,
    workerCap,
    health,
    powered,
    powerReq,
    avgMorale,
    constructionInfo != null,
  );

  const effectiveOutput = produces ? +(produces.amount * (efficiency.pct / 100)).toFixed(1) : 0;

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
            <Text style={styles.efficiencyReasons}>{efficiency.reasons.join(' • ')}</Text>
          )}
        </View>
      )}

      {/* Housing note (compact, above rings) */}
      {housingCap > 0 && (
        <View style={ringStyles.housingBadge}>
          <Text style={ringStyles.housingText}>
            {'⌂'} HOUSING CAPACITY: {housingCap} CITIZENS
          </Text>
        </View>
      )}

      {/* Production Ring */}
      <BuildingStats
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

      {/* Demographic Ring */}
      <BuildingWorkerPanel workers={assignedWorkers} workerCap={workerCap} />

      {/* Records Ring */}
      <BuildingDossier
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

      {/* Demolish action */}
      <BuildingRepairPanel onDemolish={onDemolish} />
    </SovietModal>
  );
};
