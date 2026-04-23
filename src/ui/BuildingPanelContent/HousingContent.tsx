/**
 * HousingContent -- building panel content for housing buildings
 * (izba, tenement, apartment-tower, khrushchyovka, etc.).
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

export const HousingContent: React.FC<Props> = ({ building, gridX, gridZ }) => {
  // Count residents assigned to this housing
  const residents = citizens.entities.filter(
    (c) => c.citizen.home && c.citizen.home.gridX === gridX && c.citizen.home.gridY === gridZ,
  );
  const residentCount = building.residentCount || residents.length;
  const capacity = building.housingCap;
  const occupancy = capacity > 0 ? Math.round((residentCount / capacity) * 100) : 0;

  // Average morale from residents
  let avgMorale = building.avgMorale;
  if (!avgMorale && residents.length > 0) {
    avgMorale = Math.round(residents.reduce((sum, r) => sum + r.citizen.happiness, 0) / residents.length);
  }

  const isOperational = !building.constructionPhase || building.constructionPhase === 'complete';

  return (
    <View style={styles.container}>
      <Row label="RESIDENTS" value={`${residentCount} / ${capacity}`} />
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${Math.min(occupancy, 100)}%` }]} />
      </View>

      <Row
        label="MORALE"
        value={`${avgMorale ?? 0}%`}
        valueColor={
          (avgMorale ?? 0) > 60 ? Colors.termGreen : (avgMorale ?? 0) > 30 ? Colors.sovietGold : Colors.sovietRed
        }
      />

      <Row
        label="STATUS"
        value={isOperational ? 'OPERATIONAL' : (building.constructionPhase ?? 'UNKNOWN').toUpperCase()}
        valueColor={isOperational ? Colors.termGreen : Colors.sovietGold}
      />

      {building.powered !== undefined && (
        <Row
          label="HEATED"
          value={building.powered ? 'YES' : 'NO'}
          valueColor={building.powered ? Colors.termGreen : Colors.sovietRed}
        />
      )}

      {building.onFire && <Row label="FIRE" value="BURNING" valueColor={Colors.sovietRed} />}

      {building.householdCount > 0 && <Row label="HOUSEHOLDS" value={String(building.householdCount)} />}
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
    backgroundColor: Colors.termGreen,
    borderRadius: 2,
  },
});
