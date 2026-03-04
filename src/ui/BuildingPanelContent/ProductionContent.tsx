/**
 * ProductionContent -- building panel content for production buildings
 * (farm, factory, vodka-distillery, bread-factory, etc.).
 */

import React from 'react';
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

export const ProductionContent: React.FC<Props> = ({ def, building }) => {
  // Workers assigned via entity mode
  const entityWorkers = citizens.entities.filter((c) => c.citizen.assignment === building.defId).length;
  const workerCount = building.workerCount || entityWorkers;
  const staffCap = def.stats.staffCap ?? def.stats.jobs;

  const isOperational = !building.constructionPhase || building.constructionPhase === 'complete';

  const produces = building.produces ?? def.stats.produces;
  const productionLabel = produces
    ? `${produces.amount} ${produces.resource.toUpperCase()}/tick`
    : 'NONE';

  return (
    <View style={styles.container}>
      <Row label="OUTPUT" value={productionLabel} valueColor={Colors.sovietGold} />

      <Row label="WORKERS" value={`${workerCount} / ${staffCap}`} />
      <View style={styles.barBg}>
        <View
          style={[
            styles.barFill,
            { width: `${staffCap > 0 ? Math.min((workerCount / staffCap) * 100, 100) : 0}%` },
          ]}
        />
      </View>

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

      {building.onFire && <Row label="FIRE" value="BURNING" valueColor={Colors.sovietRed} />}

      {building.trudodniAccrued > 0 && (
        <Row label="TRUDODNI" value={String(Math.round(building.trudodniAccrued))} />
      )}
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
