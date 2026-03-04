/**
 * GenericContent -- fallback building panel content for any building type not covered
 * by specialized panels.
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

export const GenericContent: React.FC<Props> = ({ def, building, gridX, gridZ }) => {
  const condition =
    building.constructionPhase === 'complete' || !building.constructionPhase
      ? 'OPERATIONAL'
      : building.constructionPhase === 'foundation'
        ? 'FOUNDATION'
        : 'BUILDING';

  return (
    <View style={styles.container}>
      <Row label="POSITION" value={`(${gridX}, ${gridZ})`} />
      <Row label="LEVEL" value={String(building.level)} />
      <Row
        label="STATUS"
        value={condition}
        valueColor={condition === 'OPERATIONAL' ? Colors.termGreen : Colors.sovietGold}
      />
      <Row
        label="POWERED"
        value={building.powered ? 'YES' : 'NO'}
        valueColor={building.powered ? Colors.termGreen : Colors.sovietRed}
      />
      {building.powerReq > 0 && <Row label="POWER REQ" value={String(building.powerReq)} />}
      {building.pollution > 0 && <Row label="POLLUTION" value={String(building.pollution)} />}
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
