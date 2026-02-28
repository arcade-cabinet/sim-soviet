/**
 * CRTOverlay — Subtle CRT scanline effect during gameplay.
 *
 * Semi-transparent overlay with horizontal scan lines at very low opacity (0.04)
 * so it does not impede gameplay. Uses CSS repeating-linear-gradient on web,
 * no-op on native (no CSS gradients).
 */

import type React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

export const CRTOverlay: React.FC = () => {
  if (Platform.OS !== 'web') return null;

  return <View style={styles.overlay} pointerEvents="none" />;
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.04,
    zIndex: 50,
    ...(Platform.OS === 'web'
      ? {
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.4) 2px, rgba(0,0,0,0.4) 4px)',
        }
      : {}),
  },
});
