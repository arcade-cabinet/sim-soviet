/**
 * Minimap — Minimap overlay (top-left). Placeholder until wired to camera render.
 * Port of poc.html lines 103-106, 237-240.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors, SharedStyles } from './styles';

export interface MinimapProps {
  // Will receive an Image source from minimap camera render in the future.
  // For now this is a placeholder gray box.
}

export const Minimap: React.FC<MinimapProps> = () => {
  return (
    <View style={[SharedStyles.panel, styles.container]}>
      <View style={styles.placeholder} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 10,
    width: 120,
    height: 120,
    zIndex: 50,
  },
  placeholder: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
});
