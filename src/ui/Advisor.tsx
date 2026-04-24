/**
 * Advisor — Comrade Krupnik notification panel (bottom-left).
 * Port of poc.html lines 267-274.
 */

import type React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, monoFont } from './styles';
import { useResponsive } from './useResponsive';

export interface AdvisorProps {
  visible: boolean;
  name?: string;
  message: string;
  onDismiss: () => void;
}

/** Comrade advisor notification popup with character name and dismissible message. */
export const Advisor: React.FC<AdvisorProps> = ({ visible, name = 'COMRADE KRUPNIK', message, onDismiss }) => {
  const { isCompact } = useResponsive();

  if (!visible) return null;

  return (
    <View style={[styles.container, isCompact && styles.compactContainer]}>
      <Text style={styles.name}>{name}:</Text>
      <Text style={styles.message}>{message}</Text>
      <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn} activeOpacity={0.7}>
        <Text style={styles.dismissText}>ACKNOWLEDGED</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 148,
    left: 10,
    width: 300,
    backgroundColor: Colors.panelBg,
    borderWidth: 2,
    borderColor: Colors.sovietGold,
    padding: 10,
    zIndex: 100,
  },
  name: {
    color: Colors.sovietGold,
    fontFamily: monoFont,
    fontWeight: 'bold',
    fontSize: 12,
    marginBottom: 4,
  },
  message: {
    color: '#bdbdbd',
    fontFamily: monoFont,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  dismissBtn: {
    width: '100%',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#444',
    paddingVertical: 6,
    alignItems: 'center',
  },
  dismissText: {
    color: '#9e9e9e',
    fontFamily: monoFont,
    fontSize: 10,
  },
  compactContainer: {
    width: '90%',
    left: '5%',
  },
});
