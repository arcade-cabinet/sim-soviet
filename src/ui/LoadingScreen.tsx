/**
 * LoadingScreen — Soviet propaganda-style asset loading overlay.
 *
 * Displayed on top of the 3D Engine while GLB models, textures, and
 * HDRIs load. Shows a progress bar, rotating propaganda messages,
 * and model count. Fades out when loading completes.
 */

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { Colors, monoFont } from './styles';

export interface LoadingScreenProps {
  /** 0–1 progress value */
  progress: number;
  /** Total asset count */
  total: number;
  /** Currently loaded count */
  loaded: number;
  /** Name of the model currently loading */
  currentModel?: string;
  /** When true, plays fade-out animation then calls onComplete */
  complete: boolean;
  /** Called after fade-out animation finishes */
  onFadeComplete?: () => void;
}

const LOADING_MESSAGES = [
  'REQUISITIONING BUILDING MATERIALS...',
  'CONSULTING THE FIVE-YEAR PLAN...',
  'BRIEFING THE CENTRAL COMMITTEE...',
  'INSPECTING WORKER CREDENTIALS...',
  'CALIBRATING PROPAGANDA LOUDSPEAKERS...',
  'SURVEYING THE MOTHERLAND...',
  'ALLOCATING VODKA RATIONS...',
  'REVIEWING ARCHITECTURAL BLUEPRINTS...',
  'MOBILIZING THE PROLETARIAT...',
  'ESTABLISHING SUPPLY CHAINS...',
  'TRAINING COMMISSAR PERSONNEL...',
  'FILING BUREAUCRATIC PAPERWORK...',
];

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  progress,
  total,
  loaded,
  currentModel,
  complete,
  onFadeComplete,
}) => {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [messageIdx, setMessageIdx] = useState(0);
  const [dots, setDots] = useState('');

  // Rotate loading messages
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  // Animate dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : `${d}.`));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  // Fade out when complete
  useEffect(() => {
    if (complete) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start(() => {
        onFadeComplete?.();
      });
    }
  }, [complete, fadeAnim, onFadeComplete]);

  const pct = Math.round(progress * 100);

  return (
    <Animated.View style={[styles.root, { opacity: fadeAnim }]}>
      {/* Scanline texture */}
      <View style={styles.scanlines} />

      <View style={styles.content}>
        {/* Soviet star */}
        <Text style={styles.star}>{'\u2605'}</Text>

        {/* Header */}
        <Text style={styles.header}>SIMSOVIET 1917</Text>
        <View style={styles.divider} />
        <Text style={styles.subheader}>INITIALIZING COMMAND CENTER</Text>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
            {/* Animated stripes inside the fill bar */}
            <View style={[styles.progressStripes, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.progressPct}>{pct}%</Text>
        </View>

        {/* Model count */}
        <Text style={styles.modelCount}>
          ASSETS: {loaded} / {total}
        </Text>

        {/* Current model name */}
        {currentModel && (
          <Text style={styles.currentModel} numberOfLines={1}>
            {'\u25B6'} {currentModel}
          </Text>
        )}

        {/* Rotating propaganda message */}
        <View style={styles.messageContainer}>
          <Text style={styles.message}>
            {LOADING_MESSAGES[messageIdx]}
            {dots}
          </Text>
        </View>

        {/* Bottom decoration */}
        <View style={styles.bottomDecor}>
          <View style={styles.decLine} />
          <Text style={styles.decText}>CENTRAL PLANNING BUREAU</Text>
          <View style={styles.decLine} />
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.bgColor,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3000,
  },
  scanlines: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.03,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web'
      ? {
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)',
        }
      : {}),
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    maxWidth: 500,
    width: '100%',
  },
  star: {
    fontSize: 36,
    color: Colors.sovietRed,
    marginBottom: 12,
    textShadowColor: 'rgba(198, 40, 40, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    fontFamily: monoFont,
    color: Colors.textPrimary,
    letterSpacing: 4,
  },
  divider: {
    width: 200,
    height: 2,
    backgroundColor: Colors.sovietRed,
    marginVertical: 10,
    opacity: 0.6,
  },
  subheader: {
    fontSize: 11,
    fontFamily: monoFont,
    color: Colors.sovietGold,
    letterSpacing: 3,
    marginBottom: 32,
  },
  progressContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  progressTrack: {
    flex: 1,
    height: 20,
    backgroundColor: Colors.panelBg,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderTopColor: Colors.panelShadow,
    borderLeftColor: Colors.panelShadow,
    borderBottomColor: Colors.panelHighlight,
    borderRightColor: Colors.panelHighlight,
    overflow: 'hidden',
  },
  progressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: Colors.sovietRed,
  },
  progressStripes: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    opacity: 0.15,
    ...(Platform.OS === 'web'
      ? {
          backgroundImage:
            'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(255,255,255,0.3) 6px, rgba(255,255,255,0.3) 12px)',
        }
      : {}),
  },
  progressPct: {
    color: Colors.textPrimary,
    fontFamily: monoFont,
    fontWeight: 'bold',
    fontSize: 16,
    width: 48,
    textAlign: 'right',
  },
  modelCount: {
    color: Colors.textSecondary,
    fontFamily: monoFont,
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 4,
  },
  currentModel: {
    color: Colors.termGreen,
    fontFamily: monoFont,
    fontSize: 10,
    letterSpacing: 1,
    opacity: 0.7,
    marginBottom: 24,
  },
  messageContainer: {
    minHeight: 20,
    marginBottom: 32,
  },
  message: {
    color: Colors.sovietGold,
    fontFamily: monoFont,
    fontSize: 11,
    letterSpacing: 2,
    textAlign: 'center',
    opacity: 0.7,
  },
  bottomDecor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  decLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.panelHighlight,
    opacity: 0.3,
  },
  decText: {
    color: Colors.textMuted,
    fontFamily: monoFont,
    fontSize: 8,
    letterSpacing: 3,
    opacity: 0.4,
  },
});
