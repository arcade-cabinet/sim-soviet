/**
 * SettlementTransitionOverlay — full-screen fade-to-black during settlement switch.
 *
 * Shows zone-specific flavor text and a loading indicator during the
 * context switch. The target zone's load zone is resolved to show
 * appropriate messaging (e.g. "The Party has assigned you to Lunar Colony"
 * for Moon transitions).
 */

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useActiveSettlement } from '../stores/gameStore';
import { getLoadZone } from '../scene/loadZones';
import { Colors, monoFont } from './styles';

const TRANSITION_QUOTES = [
  'RELOCATING PERSONNEL...',
  'TRANSFERRING RESOURCE ALLOCATIONS...',
  'ESTABLISHING COMMUNICATIONS LINK...',
  'CALIBRATING ENVIRONMENTAL SYSTEMS...',
  'BRIEFING LOCAL COMMISSAR...',
];

export const SettlementTransitionOverlay: React.FC = () => {
  const { transitioning, activeId, settlements } = useActiveSettlement();
  const opacity = useRef(new Animated.Value(0)).current;
  const [quoteIdx, setQuoteIdx] = useState(0);

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

  // Rotate quotes during transition
  useEffect(() => {
    if (!transitioning) return;
    const interval = setInterval(() => {
      setQuoteIdx((i) => (i + 1) % TRANSITION_QUOTES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [transitioning]);

  const activeEntry = settlements.find((s) => s.id === activeId);
  const activeName = activeEntry?.name ?? '';
  const zone = getLoadZone(activeEntry?.celestialBody ?? 'earth');

  return (
    <Animated.View style={[styles.overlay, { opacity }]} pointerEvents={transitioning ? 'auto' : 'none'}>
      <View style={styles.content}>
        {/* Soviet star */}
        <Text style={styles.star}>{'\u2605'}</Text>

        <Text style={styles.label}>RELOCATING TO</Text>
        <Text style={styles.name}>{activeName || zone.name}</Text>

        {/* Zone flavor text */}
        <Text style={styles.flavor}>{zone.flavorText}</Text>

        {/* Rotating transition quote */}
        <Text style={styles.quote}>{TRANSITION_QUOTES[quoteIdx]}</Text>

        {/* Animated dots */}
        <View style={styles.dots}>
          <Text style={styles.dotText}>{'\u2022 \u2022 \u2022'}</Text>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.bgColor,
    zIndex: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    gap: 8,
    maxWidth: 400,
    paddingHorizontal: 30,
  },
  star: {
    fontSize: 28,
    color: Colors.sovietRed,
    marginBottom: 8,
    textShadowColor: 'rgba(198, 40, 40, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
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
    textAlign: 'center',
  },
  flavor: {
    fontFamily: monoFont,
    fontSize: 10,
    color: Colors.textMuted,
    fontStyle: 'italic',
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  quote: {
    fontFamily: monoFont,
    fontSize: 10,
    color: Colors.sovietGold,
    letterSpacing: 2,
    opacity: 0.6,
  },
  dots: {
    marginTop: 12,
  },
  dotText: {
    fontFamily: monoFont,
    fontSize: 16,
    color: Colors.textSecondary,
    letterSpacing: 8,
  },
});
