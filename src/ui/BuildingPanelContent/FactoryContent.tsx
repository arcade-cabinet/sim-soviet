/**
 * FactoryContent -- building panel content for industrial buildings
 * (factory-office, bread-factory, vodka-distillery, warehouse, etc.).
 *
 * Shows production output type/rate, workers assigned, machinery condition,
 * and pollution level.
 */

import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BuildingDef } from '../../data/buildingDefs';
import { citizens } from '../../ecs/archetypes';
import type { BuildingComponent } from '../../ecs/world';
import { Colors, monoFont } from '../styles';

interface Props {
  def: BuildingDef;
  building: BuildingComponent;
  gridX: number;
  gridZ: number;
}

export const FactoryContent: React.FC<Props> = ({ def, building }) => {
  const entityWorkers = citizens.entities.filter((c) => c.citizen.assignment === building.defId).length;
  const workerCount = building.workerCount || entityWorkers;
  const staffCap = def.stats.staffCap ?? def.stats.jobs;

  const isOperational = !building.constructionPhase || building.constructionPhase === 'complete';

  const produces = building.produces ?? def.stats.produces;
  const outputLabel = produces ? `${produces.amount} ${produces.resource.toUpperCase()}/tick` : 'NONE';

  // Machinery condition derived from building durability (avgSkill as proxy)
  const machineryCondition = building.avgSkill > 70 ? 'GOOD' : building.avgSkill > 30 ? 'WORN' : 'POOR';
  const machineryColor =
    building.avgSkill > 70 ? Colors.termGreen : building.avgSkill > 30 ? Colors.sovietGold : Colors.sovietRed;

  return (
    <View style={styles.container}>
      <Text style={styles.industryLabel}>INDUSTRIAL FACILITY</Text>

      <Row label="OUTPUT" value={outputLabel} valueColor={Colors.sovietGold} />

      <Row label="WORKERS" value={`${workerCount} / ${staffCap}`} />
      <View style={styles.barBg}>
        <View
          style={[styles.barFill, { width: `${staffCap > 0 ? Math.min((workerCount / staffCap) * 100, 100) : 0}%` }]}
        />
      </View>

      <Row label="MACHINERY" value={machineryCondition} valueColor={machineryColor} />

      <Row
        label="STATUS"
        value={isOperational ? 'OPERATIONAL' : (building.constructionPhase ?? 'UNKNOWN').toUpperCase()}
        valueColor={isOperational ? Colors.termGreen : Colors.sovietGold}
      />

      <Row
        label="POWERED"
        value={building.powered ? 'YES' : 'NO'}
        valueColor={building.powered ? Colors.termGreen : Colors.sovietRed}
      />

      {building.pollution > 0 && <Row label="POLLUTION" value={String(building.pollution)} />}

      {building.trudodniAccrued > 0 && <Row label="TRUDODNI" value={String(Math.round(building.trudodniAccrued))} />}

      {building.onFire && <Row label="FIRE" value="BURNING" valueColor={Colors.sovietRed} />}
    </View>
  );
};

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, valueColor ? { color: valueColor } : undefined]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  industryLabel: {
    fontFamily: monoFont,
    fontSize: 10,
    color: Colors.termBlue,
    letterSpacing: 1,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontFamily: monoFont,
    fontSize: 10,
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  value: {
    fontFamily: monoFont,
    fontSize: 11,
    color: Colors.textPrimary,
  },
  barBg: {
    height: 4,
    backgroundColor: Colors.panelShadow,
    borderRadius: 2,
  },
  barFill: {
    height: 4,
    backgroundColor: Colors.sovietGold,
    borderRadius: 2,
  },
});
