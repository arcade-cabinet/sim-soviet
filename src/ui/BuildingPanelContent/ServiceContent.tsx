/**
 * ServiceContent -- building panel content for service buildings
 * (school, hospital, militia, dom-kultura, etc.).
 */

import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BuildingDef } from '../../data/buildingDefs';
import type { BuildingComponent } from '../../ecs/world';
import { Colors, monoFont } from '../styles';

interface Props {
  def: BuildingDef;
  building: BuildingComponent;
  gridX: number;
  gridZ: number;
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  services: 'COMMUNITY SERVICES',
  culture: 'CULTURAL INSTITUTION',
  propaganda: 'STATE PROPAGANDA',
  military: 'MILITARY FACILITY',
  government: 'GOVERNMENT BUILDING',
};

export const ServiceContent: React.FC<Props> = ({ def, building }) => {
  const isOperational = !building.constructionPhase || building.constructionPhase === 'complete';
  const serviceType = ROLE_DESCRIPTIONS[def.role] ?? def.role.toUpperCase();

  return (
    <View style={styles.container}>
      <Text style={styles.serviceType}>{serviceType}</Text>

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

      {building.powerReq > 0 && <Row label="POWER REQ" value={String(building.powerReq)} />}

      {building.workerCount > 0 && <Row label="STAFF" value={String(building.workerCount)} />}

      {building.fear > 0 && <Row label="FEAR" value={String(building.fear)} valueColor={Colors.sovietRed} />}

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
  serviceType: {
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
});
