/**
 * MainMenu — Soviet-themed game landing page.
 *
 * Displays before the 3D engine loads. Pure React Native — no BabylonJS overhead.
 * Features: New Game, Continue Game (disabled if no save), Settings.
 *
 * Design: retro dossier aesthetic matching IntroModal, with beveled buttons
 * inspired by SimCity 3000 and Win95 panel borders.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, monoFont } from './styles';

export interface MainMenuProps {
  onNewGame: () => void;
  onContinue?: () => void;
  hasSaveData?: boolean;
  onSettings?: () => void;
}

const PROPAGANDA_LINES = [
  'THE PARTY PROVIDES. THE PARTY PREVAILS.',
  'WORKERS OF THE WORLD, BUILD!',
  'EVERY BRICK IS A STEP TOWARD UTOPIA.',
  'GLORY TO THE CENTRAL COMMITTEE.',
  'COMRADE, YOUR CITY AWAITS.',
];

export const MainMenu: React.FC<MainMenuProps> = ({ onNewGame, onContinue, hasSaveData = false, onSettings }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(-30)).current;
  const [propagandaIdx, setPropagandaIdx] = React.useState(0);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(titleSlide, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, titleSlide]);

  // Rotate propaganda lines
  useEffect(() => {
    const interval = setInterval(() => {
      setPropagandaIdx((i) => (i + 1) % PROPAGANDA_LINES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Animated.View style={[styles.root, { opacity: fadeAnim }]}>
      {/* Scanline overlay effect */}
      <View style={styles.scanlines} />

      {/* Content container */}
      <View style={styles.content}>
        {/* Soviet star decoration */}
        <Text style={styles.star}>{'\u2605'}</Text>

        {/* Title block */}
        <Animated.View style={[styles.titleBlock, { transform: [{ translateY: titleSlide }] }]}>
          <View style={styles.titleBorder}>
            <Text style={styles.title}>SIMSOVIET</Text>
            <Text style={styles.titleYear}>1 9 1 7</Text>
          </View>
          <Text style={styles.subtitle}>THE ARCHITECTURAL PROTOCOL</Text>
        </Animated.View>

        {/* Classified stamp */}
        <View style={styles.stampContainer}>
          <View style={styles.stamp}>
            <Text style={styles.stampText}>CLASSIFIED</Text>
          </View>
        </View>

        {/* Menu buttons */}
        <View style={styles.menuButtons}>
          {/* New Game — primary action */}
          <TouchableOpacity onPress={onNewGame} style={styles.btnPrimary} activeOpacity={0.8}>
            <Text style={styles.btnPrimaryText}>{'\u2605'} NEW GAME</Text>
          </TouchableOpacity>

          {/* Continue — disabled if no save */}
          <TouchableOpacity
            onPress={hasSaveData ? onContinue : undefined}
            style={[styles.btnSecondary, !hasSaveData && styles.btnDisabled]}
            activeOpacity={hasSaveData ? 0.8 : 1}
            disabled={!hasSaveData}
          >
            <Text style={[styles.btnSecondaryText, !hasSaveData && styles.btnDisabledText]}>CONTINUE GAME</Text>
            {!hasSaveData && <Text style={styles.btnSubText}>NO SAVE DATA</Text>}
          </TouchableOpacity>

          {/* Settings */}
          <TouchableOpacity onPress={onSettings} style={styles.btnTertiary} activeOpacity={0.8}>
            <Text style={styles.btnTertiaryText}>SETTINGS</Text>
          </TouchableOpacity>
        </View>

        {/* Rotating propaganda text */}
        <Text style={styles.propaganda}>{PROPAGANDA_LINES[propagandaIdx]}</Text>

        {/* Version */}
        <Text style={styles.version}>v0.1.0 /// CENTRAL PLANNING BUREAU</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bgColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanlines: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.03,
    // CSS-only scanline effect via repeating border trick
    // This is subtle on purpose — just enough texture
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web'
      ? {
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)',
        }
      : {}),
    zIndex: 1,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    paddingHorizontal: 40,
    maxWidth: 500,
    width: '100%',
  },
  star: {
    fontSize: 48,
    color: Colors.sovietRed,
    marginBottom: 8,
    textShadowColor: 'rgba(198, 40, 40, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  titleBlock: {
    alignItems: 'center',
    marginBottom: 8,
  },
  titleBorder: {
    borderTopWidth: 3,
    borderBottomWidth: 3,
    borderColor: Colors.sovietRed,
    paddingVertical: 8,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 44,
    fontWeight: 'bold',
    fontFamily: monoFont,
    color: Colors.textPrimary,
    letterSpacing: 6,
  },
  titleYear: {
    fontSize: 28,
    fontWeight: 'bold',
    fontFamily: monoFont,
    color: Colors.sovietGold,
    letterSpacing: 16,
    marginTop: 2,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: monoFont,
    color: Colors.textSecondary,
    letterSpacing: 5,
    marginTop: 10,
  },
  stampContainer: {
    marginVertical: 20,
    transform: [{ rotate: '-3deg' }],
  },
  stamp: {
    borderWidth: 3,
    borderColor: Colors.sovietRed,
    paddingVertical: 4,
    paddingHorizontal: 16,
    opacity: 0.7,
  },
  stampText: {
    color: Colors.sovietRed,
    fontFamily: monoFont,
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 4,
  },
  menuButtons: {
    width: '100%',
    gap: 12,
    marginBottom: 32,
  },
  btnPrimary: {
    backgroundColor: Colors.sovietRed,
    width: '100%',
    height: 56,
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
    shadowColor: Colors.sovietRed,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  btnPrimaryText: {
    color: Colors.white,
    fontFamily: monoFont,
    fontWeight: 'bold',
    fontSize: 18,
    letterSpacing: 3,
  },
  btnSecondary: {
    backgroundColor: Colors.btnBg,
    width: '100%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderTopColor: Colors.btnHighlight,
    borderLeftColor: Colors.btnHighlight,
    borderBottomColor: Colors.btnShadow,
    borderRightColor: Colors.btnShadow,
  },
  btnSecondaryText: {
    color: Colors.textPrimary,
    fontFamily: monoFont,
    fontWeight: 'bold',
    fontSize: 15,
    letterSpacing: 2,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnDisabledText: {
    color: Colors.textMuted,
  },
  btnSubText: {
    color: Colors.textMuted,
    fontFamily: monoFont,
    fontSize: 9,
    letterSpacing: 2,
    marginTop: 2,
  },
  btnTertiary: {
    backgroundColor: Colors.timeBtnBg,
    width: '100%',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderTopColor: Colors.timeBtnHighlight,
    borderLeftColor: Colors.timeBtnHighlight,
    borderBottomColor: Colors.timeBtnShadow,
    borderRightColor: Colors.timeBtnShadow,
  },
  btnTertiaryText: {
    color: Colors.textSecondary,
    fontFamily: monoFont,
    fontWeight: 'bold',
    fontSize: 13,
    letterSpacing: 2,
  },
  propaganda: {
    color: Colors.sovietGold,
    fontFamily: monoFont,
    fontSize: 10,
    letterSpacing: 2,
    textAlign: 'center',
    opacity: 0.6,
    marginBottom: 20,
  },
  version: {
    color: Colors.textMuted,
    fontFamily: monoFont,
    fontSize: 9,
    letterSpacing: 1,
    opacity: 0.5,
  },
});
