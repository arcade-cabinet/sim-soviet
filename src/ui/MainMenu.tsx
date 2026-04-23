/**
 * MainMenu -- production-facing landing screen for the historical campaign.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BrandColors, BrandFonts, DesignTokens, ensureBrandFonts } from './designTokens';
import { ShaderBackdrop } from './ShaderBackdrop';

export interface MainMenuProps {
  onNewGame: () => void;
  onContinue?: () => void;
  hasSaveData?: boolean;
  onSettings?: () => void;
}

const CAMPAIGN_LINES = [
  'A historical campaign from revolution to dissolution.',
  'Organic settlement growth under quotas, weather, politics, scarcity, and fear.',
  'Reach 1991, review the century, then continue grounded free play in the same settlement.',
];

const ERA_RAIL = ['1917 REVOLUTION', '1928 PLANNING', '1941 WAR', '1953 THAW', '1982 STAGNATION', '1991 DISSOLUTION'];

export const MainMenu: React.FC<MainMenuProps> = ({ onNewGame, onContinue, hasSaveData = false, onSettings }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(18)).current;
  const [campaignLine, setCampaignLine] = React.useState(0);

  useEffect(() => {
    ensureBrandFonts();
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 650,
        useNativeDriver: true,
      }),
      Animated.timing(titleSlide, {
        toValue: 0,
        duration: 520,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, titleSlide]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCampaignLine((i) => (i + 1) % CAMPAIGN_LINES.length);
    }, 4600);
    return () => clearInterval(interval);
  }, []);

  return (
    <Animated.View style={[styles.root, { opacity: fadeAnim }]}>
      <ShaderBackdrop />
      <View pointerEvents="none" style={styles.texture} />
      <View pointerEvents="none" style={styles.vignette} />

      <View style={styles.frame}>
        <View style={styles.brandRow}>
          <Text style={styles.brandMark}>SIMSOVIET 1917</Text>
          <Text style={styles.scopeMark}>HISTORICAL CAMPAIGN</Text>
        </View>

        <Animated.View style={[styles.hero, { transform: [{ translateY: titleSlide }] }]}>
          <Text style={styles.kicker}>1917-1991 / ONE SETTLEMENT / ONE CENTURY</Text>
          <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={2} style={styles.title}>
            Survive the Soviet Century
          </Text>
          <Text style={styles.copy}>
            You are the predsedatel of a provincial settlement. The collective builds; Moscow demands results. Keep
            people fed, industry running, power alive, factions contained, and the archives survivable.
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity
              accessibilityLabel="New game. Begin historical campaign."
              onPress={onNewGame}
              style={styles.primaryButton}
              activeOpacity={0.86}
            >
              <Text style={styles.buttonMeta}>NEW GAME</Text>
              <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} style={styles.primaryButtonText}>
                Begin Historical Campaign
              </Text>
            </TouchableOpacity>

            <View style={styles.secondaryRow}>
              <TouchableOpacity
                accessibilityLabel="Continue saved campaign."
                onPress={hasSaveData ? onContinue : undefined}
                style={[styles.secondaryButton, !hasSaveData && styles.disabledButton]}
                activeOpacity={hasSaveData ? 0.82 : 1}
                disabled={!hasSaveData}
              >
                <Text style={[styles.secondaryButtonText, !hasSaveData && styles.disabledText]}>CONTINUE</Text>
                {!hasSaveData && <Text style={styles.secondaryNote}>No save archive</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                accessibilityLabel="Settings."
                onPress={onSettings}
                style={styles.secondaryButton}
                activeOpacity={0.82}
              >
                <Text style={styles.secondaryButtonText}>SETTINGS</Text>
                <Text style={styles.secondaryNote}>Audio, display, saves</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.campaignLine}>{CAMPAIGN_LINES[campaignLine]}</Text>
        </Animated.View>

        <View style={styles.eraRail}>
          {ERA_RAIL.map((era) => (
            <Text key={era} style={styles.eraRailItem}>
              {era}
            </Text>
          ))}
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BrandColors.black,
    overflow: 'hidden',
  },
  texture: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.18,
    ...(Platform.OS === 'web'
      ? {
          backgroundImage:
            'linear-gradient(90deg, rgba(239,228,200,0.06) 1px, transparent 1px), linear-gradient(0deg, rgba(239,228,200,0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px, 48px 48px',
        }
      : {}),
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    ...(Platform.OS === 'web'
      ? {
          backgroundImage:
            'radial-gradient(circle at 28% 36%, transparent 0, rgba(11,11,9,0.12) 38%, rgba(11,11,9,0.84) 100%)',
        }
      : {
          backgroundColor: 'rgba(11,11,9,0.28)',
        }),
  },
  frame: {
    flex: 1,
    minHeight: 560,
    paddingHorizontal: 28,
    paddingVertical: 24,
    justifyContent: 'space-between',
  },
  brandRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: DesignTokens.space.md,
  },
  brandMark: {
    color: BrandColors.paper,
    fontFamily: BrandFonts.display,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0,
  },
  scopeMark: {
    color: BrandColors.frost,
    fontFamily: BrandFonts.mono,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0,
  },
  hero: {
    maxWidth: 820,
    width: '100%',
    alignSelf: 'flex-start',
    paddingBottom: 20,
  },
  kicker: {
    color: BrandColors.amber,
    fontFamily: BrandFonts.mono,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
    marginBottom: 14,
  },
  title: {
    color: BrandColors.white,
    fontFamily: BrandFonts.display,
    fontSize: 64,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 74,
    maxWidth: 720,
  },
  copy: {
    color: BrandColors.paper,
    fontFamily: BrandFonts.mono,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 25,
    letterSpacing: 0,
    maxWidth: 680,
    marginTop: 18,
  },
  actions: {
    width: '100%',
    maxWidth: 620,
    marginTop: 30,
    gap: DesignTokens.space.md,
  },
  primaryButton: {
    minHeight: 66,
    justifyContent: 'center',
    backgroundColor: BrandColors.red,
    borderRadius: DesignTokens.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,247,231,0.34)',
    paddingHorizontal: 22,
    paddingVertical: 12,
    shadowColor: BrandColors.red,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.34,
    shadowRadius: 22,
  },
  buttonMeta: {
    color: BrandColors.paper,
    fontFamily: BrandFonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0,
    marginBottom: 2,
  },
  primaryButtonText: {
    color: BrandColors.white,
    fontFamily: BrandFonts.display,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: DesignTokens.space.md,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 58,
    justifyContent: 'center',
    backgroundColor: 'rgba(21,19,15,0.68)',
    borderRadius: DesignTokens.radius.sm,
    borderWidth: 1,
    borderColor: DesignTokens.border.strong,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  disabledButton: {
    opacity: 0.56,
  },
  secondaryButtonText: {
    color: BrandColors.paper,
    fontFamily: BrandFonts.display,
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0,
  },
  disabledText: {
    color: BrandColors.paperMuted,
  },
  secondaryNote: {
    color: BrandColors.frost,
    fontFamily: BrandFonts.mono,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0,
    marginTop: 2,
  },
  campaignLine: {
    color: BrandColors.amber,
    fontFamily: BrandFonts.mono,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0,
    marginTop: 24,
  },
  eraRail: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: DesignTokens.border.hairline,
    paddingTop: 14,
  },
  eraRailItem: {
    color: BrandColors.paperMuted,
    fontFamily: BrandFonts.mono,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0,
    borderWidth: 1,
    borderColor: 'rgba(239,228,200,0.18)',
    borderRadius: DesignTokens.radius.sm,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: 'rgba(11,11,9,0.28)',
  },
});
