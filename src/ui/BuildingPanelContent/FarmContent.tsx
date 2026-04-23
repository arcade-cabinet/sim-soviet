/**
 * FarmContent -- building panel content for agricultural buildings
 * (collective-farm-hq, bread-factory when role is agriculture, etc.).
 *
 * Shows crop type, yield per tick, brigade workers, livestock count,
 * private plot status, and food stockpile.
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

export const FarmContent: React.FC<Props> = ({ def, building }) => {
  const entityWorkers = citizens.entities.filter((c) => c.citizen.assignment === building.defId).length;
  const workerCount = building.workerCount || entityWorkers;
  const staffCap = def.stats.staffCap ?? def.stats.jobs;

  const isOperational = !building.constructionPhase || building.constructionPhase === 'complete';

  const produces = building.produces ?? def.stats.produces;
  const yieldPerTick = produces ? produces.amount : 0;
  const cropType = produces ? produces.resource.toUpperCase() : 'NONE';

  return (
    <View style={styles.container}>
      <Text style={styles.farmLabel}>AGRICULTURAL FACILITY</Text>

      <Row label="CROP" value={cropType} valueColor={Colors.sovietGold} />
      <Row label="YIELD/TICK" value={String(yieldPerTick)} valueColor={Colors.termGreen} />

      <Row label="BRIGADE" value={`${workerCount} / ${staffCap}`} />
      <View style={styles.barBg}>
        <View
          style={[styles.barFill, { width: `${staffCap > 0 ? Math.min((workerCount / staffCap) * 100, 100) : 0}%` }]}
        />
      </View>

      <Row label="LIVESTOCK" value={String(building.householdCount || 0)} />

      <Row
        label="PRIVATE PLOTS"
        value={building.avgLoyalty > 50 ? 'ACTIVE' : 'IDLE'}
        valueColor={building.avgLoyalty > 50 ? Colors.termGreen : Colors.textMuted}
      />

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
  farmLabel: {
    fontFamily: monoFont,
    fontSize: 10,
    color: Colors.termGreen,
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
