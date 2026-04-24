/**
 * BuildingWorkerPanel — Demographic Ring subcomponent.
 *
 * Shows class distribution, morale distribution, aggregate stats,
 * and the personnel roster for buildings with worker capacity.
 */

import type React from 'react';
import { Text, View } from 'react-native';
import type { CitizenComponent } from '../../ecs/world';
import { Colors } from '../styles';
import {
  type AssignedWorkerInfo,
  CLASS_ABBREV,
  CLASS_COLOR,
  DistributionBar,
  moraleColor,
  moraleIcon,
  RingHeader,
  StatBar,
  statusColor,
  statusLabel,
} from './shared';
import { ringStyles, styles } from './styles';

const MAX_DISPLAYED_WORKERS = 8;

export interface BuildingWorkerPanelProps {
  workers: AssignedWorkerInfo[];
  workerCap: number;
}

/** Demographic Ring — class distribution, morale, skill breakdown, personnel roster. */
export const BuildingWorkerPanel: React.FC<BuildingWorkerPanelProps> = ({ workers, workerCap }) => {
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

  const avgMorale = workerCount > 0 ? Math.round(workers.reduce((s, w) => s + w.morale, 0) / workerCount) : 0;
  const avgSkill = workerCount > 0 ? Math.round(totalSkill / workerCount) : 0;

  return (
    <View style={ringStyles.ring}>
      <RingHeader label="DEMOGRAPHIC RING" icon={'☺'} color={Colors.sovietGold} />

      <StatBar
        label="STAFFING"
        value={workerCount}
        max={workerCap}
        color={workerCount >= workerCap ? Colors.termGreen : Colors.sovietGold}
      />

      {workerCount > 0 && (
        <>
          <Text style={ringStyles.subLabel}>CLASS DISTRIBUTION</Text>
          <DistributionBar segments={classSegments} total={workerCount} />

          <Text style={ringStyles.subLabel}>MORALE DISTRIBUTION</Text>
          <DistributionBar segments={moraleSegments} total={workerCount} />

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

      {workerCount === 0 && <Text style={styles.noWorkers}>No workers assigned — building idle</Text>}
    </View>
  );
};
