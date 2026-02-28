/**
 * LensSelector — Lens toggle buttons (bottom-right vertical column).
 * Port of poc.html lines 277-283.
 */

import type React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, monoFont } from './styles';

export type LensValue = 'default' | 'water' | 'power' | 'smog' | 'aura';

const LENSES: { label: string; value: LensValue }[] = [
  { label: 'CITY', value: 'default' },
  { label: 'WATER', value: 'water' },
  { label: 'POWER', value: 'power' },
  { label: 'TOXICITY', value: 'smog' },
  { label: 'PACIFY', value: 'aura' },
];

export interface LensSelectorProps {
  activeLens: LensValue;
  onLensChange: (lens: LensValue) => void;
}

export const LensSelector: React.FC<LensSelectorProps> = ({ activeLens, onLensChange }) => {
  return (
    <View style={styles.container}>
      {LENSES.map((lens) => {
        const active = activeLens === lens.value;
        return (
          <TouchableOpacity
            key={lens.value}
            onPress={() => onLensChange(lens.value)}
            style={[styles.button, active && styles.buttonActive]}
            activeOpacity={0.7}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{lens.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 140,
    right: 10,
    flexDirection: 'column',
    gap: 4,
    zIndex: 50,
  },
  button: {
    width: 50,
    backgroundColor: Colors.panelBg,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderTopColor: Colors.panelHighlight,
    borderLeftColor: Colors.panelHighlight,
    borderBottomColor: Colors.panelShadow,
    borderRightColor: Colors.panelShadow,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonActive: {
    backgroundColor: Colors.sovietGold,
    borderTopColor: '#fff176',
    borderLeftColor: '#fff176',
    borderBottomColor: '#f9a825',
    borderRightColor: '#f9a825',
  },
  label: {
    fontFamily: monoFont,
    fontSize: 7,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  labelActive: {
    color: Colors.black,
    textShadowColor: 'rgba(255, 255, 255, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
});
