/**
 * SettlementTransitionOverlay — full-screen fade-to-black during settlement switch.
 *
 * Renders a black overlay that fades in when transitioning starts,
 * stays opaque during the context switch, then fades out.
 */

import type React from 'react';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useActiveSettlement } from '../stores/gameStore';
import { Colors, monoFont } from './styles';

export const SettlementTransitionOverlay: React.FC = () => {
  const { transitioning, activeId, settlements } = useActiveSettlement();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (transitioning) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: false,
      }).start();
    }
  }, [transitioning, opacity]);

  const activeName = settlements.find((s) => s.id === activeId)?.name ?? '';

  return (
    <Animated.View style={[styles.overlay, { opacity }]} pointerEvents={transitioning ? 'auto' : 'none'}>
      <View style={styles.content}>
        <Text style={styles.label}>RELOCATING TO</Text>
        <Text style={styles.name}>{activeName}</Text>
        <View style={styles.dots}>
          <Text style={styles.dotText}>...</Text>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.black,
    zIndex: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontFamily: monoFont,
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 3,
  },
  name: {
    fontFamily: monoFont,
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 2,
  },
  dots: {
    marginTop: 8,
  },
  dotText: {
    fontFamily: monoFont,
    fontSize: 16,
    color: Colors.textSecondary,
  },
});
