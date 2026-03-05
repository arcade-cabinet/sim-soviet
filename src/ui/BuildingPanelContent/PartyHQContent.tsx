/**
 * PartyHQContent -- building panel content for the Party HQ (government-hq).
 * Shows economy summary, directive, morale/loyalty, advisor message, quota.
 */

import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BuildingDef } from '../../data/buildingDefs';
import { getMetaEntity, getResourceEntity } from '../../ecs/archetypes';
import type { BuildingComponent } from '../../ecs/world';
import { getAdvisor } from '../../engine/helpers';
import { Colors, monoFont } from '../styles';

interface Props {
  def: BuildingDef;
  building: BuildingComponent;
  gridX: number;
  gridZ: number;
}

export const PartyHQContent: React.FC<Props> = ({ def, building }) => {
  const res = getResourceEntity()?.resources;
  const meta = getMetaEntity()?.gameMeta;

  // Get advisor message
  const advisor = getAdvisor();

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeader}>ECONOMY</Text>
      <Row label="FOOD" value={String(Math.round(res?.food ?? 0))} />
      <Row label="TIMBER" value={String(Math.round(res?.timber ?? 0))} />
      <Row label="POPULATION" value={String(res?.population ?? 0)} />

      <View style={styles.separator} />

      <Text style={styles.sectionHeader}>SETTLEMENT</Text>
      <Row label="TIER" value={(meta?.settlementTier ?? 'selo').toUpperCase()} valueColor={Colors.sovietGold} />
      <Row label="ERA" value={(meta?.currentEra ?? 'revolution').toUpperCase()} />

      {meta?.quota && (
        <>
          <View style={styles.separator} />
          <Text style={styles.sectionHeader}>QUOTA</Text>
          <Row label="TYPE" value={meta.quota.type.toUpperCase()} />
          <Row
            label="PROGRESS"
            value={`${Math.round(meta.quota.current)} / ${meta.quota.target}`}
            valueColor={meta.quota.current >= meta.quota.target ? Colors.termGreen : Colors.sovietGold}
          />
          <Row label="DEADLINE" value={String(meta.quota.deadlineYear)} />
        </>
      )}

      {advisor && (
        <>
          <View style={styles.separator} />
          <Text style={styles.sectionHeader}>COMRADE KRUPNIK</Text>
          <Text style={styles.advisorText}>{advisor.text}</Text>
        </>
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
  sectionHeader: {
    fontFamily: monoFont,
    fontSize: 9,
    color: Colors.sovietRed,
    letterSpacing: 2,
    marginTop: 4,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.panelHighlight,
    marginVertical: 4,
    opacity: 0.5,
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
  directiveText: {
    fontFamily: monoFont,
    fontSize: 10,
    color: Colors.termGreen,
    fontStyle: 'italic',
  },
  advisorText: {
    fontFamily: monoFont,
    fontSize: 10,
    color: Colors.sovietGold,
    fontStyle: 'italic',
  },
});
