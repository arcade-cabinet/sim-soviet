/**
 * BuildingRepairPanel — Demolish action subcomponent.
 *
 * Renders the demolish button and confirmation note at the bottom
 * of the building inspector panel.
 */

import type React from 'react';
import { Text, View } from 'react-native';
import { styles } from './styles';

export interface BuildingRepairPanelProps {
  onDemolish: () => void;
}

/** Demolish action panel shown at the bottom of the inspector. */
export const BuildingRepairPanel: React.FC<BuildingRepairPanelProps> = ({ onDemolish }) => (
  <View style={styles.demolishContainer}>
    <Text style={styles.demolishBtn} onPress={onDemolish}>
      DEMOLISH BUILDING
    </Text>
    <Text style={styles.demolishNote}>This action is irreversible. All workers will be unassigned.</Text>
  </View>
);
