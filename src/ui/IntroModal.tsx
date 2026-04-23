/**
 * IntroModal — Opening dossier briefing overlay.
 * Port of poc.html lines 148-177.
 */

import type React from 'react';
import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, monoFont } from './styles';

export interface IntroModalProps {
  visible: boolean;
  onDismiss: () => void;
}

const BULLET_POINTS = [
  'Balance food, power, labor, and state demands',
  'Steer collective priorities without direct control',
  'Preserve the settlement through crisis and decay',
  'Fulfill state quotas',
];

/** Dossier briefing overlay shown once after asset loading, before gameplay begins. */
export const IntroModal: React.FC<IntroModalProps> = ({ visible, onDismiss }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible, fadeAnim]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      <View style={styles.dossier}>
        {/* Header row */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>SIMSOVIET 1917</Text>
            <Text style={styles.subtitle}>The Predsedatel Protocol</Text>
          </View>
          <View style={styles.stamp}>
            <Text style={styles.stampText}>TOP SECRET</Text>
          </View>
        </View>

        {/* Briefing text */}
        <Text style={styles.briefing}>Comrade Predsedatel,</Text>
        <Text style={styles.body}>
          You have been assigned oversight of this settlement by order of the Central Committee. The Party expects
          nothing less than total dedication to the construction of a model Soviet settlement. Resources are scarce, the
          people are restless, and the state plan waits for no one.
        </Text>
        <Text style={styles.body}>
          Your mandate is clear: keep the settlement functioning, satisfy Moscow, and survive the historical record.
          Failure will not be tolerated. Success will be noted in your personnel file.
        </Text>
        <Text style={styles.body}>
          Your collective will construct itself as workers arrive — your task is to steer allocation and priority, not
          to place stones.
        </Text>

        {/* Bullet points */}
        <View style={styles.bulletList}>
          {BULLET_POINTS.map((point) => (
            <Text key={point} style={styles.bullet}>
              {'\u2605'} {point}
            </Text>
          ))}
        </View>

        {/* CTA button */}
        <TouchableOpacity onPress={onDismiss} style={styles.ctaButton} activeOpacity={0.8}>
          <Text style={styles.ctaText}>ACCEPT THE CHAIR</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    zIndex: 2000,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dossier: {
    backgroundColor: '#cfd8dc',
    width: '100%',
    maxWidth: 500,
    padding: 28,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderTopColor: Colors.white,
    borderLeftColor: Colors.white,
    borderBottomColor: '#90a4ae',
    borderRightColor: '#90a4ae',
    ...(Platform.OS === 'web'
      ? { boxShadow: '15px 15px 0 rgba(0, 0, 0, 0.5)' }
      : {
          shadowColor: Colors.black,
          shadowOffset: { width: 15, height: 15 },
          shadowOpacity: 0.5,
          shadowRadius: 0,
          elevation: 20,
        }),
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    fontFamily: monoFont,
    color: Colors.black,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: monoFont,
    fontStyle: 'italic',
    color: '#607d8b',
    letterSpacing: 2,
    marginTop: 2,
  },
  stamp: {
    borderWidth: 4,
    borderColor: Colors.sovietRed,
    paddingVertical: 5,
    paddingHorizontal: 15,
    transform: [{ rotate: '-5deg' }],
    opacity: 0.9,
  },
  stampText: {
    color: Colors.sovietRed,
    fontFamily: monoFont,
    fontWeight: 'bold',
    fontSize: 18,
    letterSpacing: 2,
  },
  briefing: {
    fontSize: 16,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#263238',
    marginBottom: 10,
  },
  body: {
    fontSize: 13,
    fontFamily: monoFont,
    color: '#37474f',
    lineHeight: 20,
    marginBottom: 12,
  },
  bulletList: {
    marginTop: 8,
    marginBottom: 24,
    gap: 8,
  },
  bullet: {
    fontSize: 13,
    fontFamily: monoFont,
    color: '#263238',
    fontWeight: 'bold',
  },
  ctaButton: {
    backgroundColor: Colors.sovietRed,
    width: '100%',
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderTopColor: '#ff8a80',
    borderLeftColor: '#ff8a80',
    borderBottomColor: Colors.sovietDarkRed,
    borderRightColor: Colors.sovietDarkRed,
    ...(Platform.OS === 'web'
      ? { boxShadow: '4px 4px 0 rgba(0, 0, 0, 0.5)' }
      : {
          shadowColor: Colors.black,
          shadowOffset: { width: 4, height: 4 },
          shadowOpacity: 0.5,
          shadowRadius: 0,
          elevation: 8,
        }),
  },
  ctaText: {
    color: Colors.white,
    fontFamily: monoFont,
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 2,
  },
});
