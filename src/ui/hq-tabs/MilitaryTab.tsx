/**
 * MilitaryTab — Defense posture setting for the Military agency.
 *
 * Four postures (Peacetime → Total War) with escalating effects on
 * production, conscription, defense, and morale. Stats display shows
 * garrison strength, conscription pool, and defense readiness.
 */

import type React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, monoFont } from '../styles';

// ── Types ───────────────────────────────────────────────────────────────────

/** Defense posture levels in escalation order. */
export type DefensePosture = 'peacetime' | 'alert' | 'mobilized' | 'total_war';

/** Ordered posture definitions for display. */
export interface PostureDef {
  key: DefensePosture;
  label: string;
}

/** Numeric effects of a defense posture on settlement systems. */
export interface PostureEffects {
  productionModifier: number;
  conscriptionPercent: number;
  defenseBonus: number;
  moralePenalty: number;
}

export const POSTURE_DEFS: PostureDef[] = [
  { key: 'peacetime', label: 'PEACETIME' },
  { key: 'alert', label: 'ALERT' },
  { key: 'mobilized', label: 'MOBILIZED' },
  { key: 'total_war', label: 'TOTAL WAR' },
];

/** Effect values keyed by posture. */
const POSTURE_EFFECTS: Record<DefensePosture, PostureEffects> = {
  peacetime: { productionModifier: 0, conscriptionPercent: 0, defenseBonus: 0, moralePenalty: 0 },
  alert: { productionModifier: -5, conscriptionPercent: 10, defenseBonus: 10, moralePenalty: 0 },
  mobilized: { productionModifier: -15, conscriptionPercent: 30, defenseBonus: 30, moralePenalty: -10 },
  total_war: { productionModifier: -30, conscriptionPercent: 50, defenseBonus: 50, moralePenalty: -25 },
};

/**
 * Look up the effects for a given defense posture.
 *
 * @param posture - defense posture level
 */
export function getPostureEffects(posture: DefensePosture): PostureEffects {
  return POSTURE_EFFECTS[posture];
}

// ── Props ───────────────────────────────────────────────────────────────────

export interface MilitaryTabProps {
  currentPosture: DefensePosture;
  garrisonStrength: number;
  conscriptionPool: number;
  defenseReadiness: number;
  onPostureChange: (posture: DefensePosture) => void;
}

// ── Effect labels for display ───────────────────────────────────────────────

const EFFECT_LABELS: { key: keyof PostureEffects; label: string; suffix: string }[] = [
  { key: 'productionModifier', label: 'PRODUCTION', suffix: '%' },
  { key: 'conscriptionPercent', label: 'CONSCRIPTION POOL', suffix: '%' },
  { key: 'defenseBonus', label: 'DEFENSE BONUS', suffix: '' },
  { key: 'moralePenalty', label: 'MORALE', suffix: '' },
];

// ── Component ───────────────────────────────────────────────────────────────

export const MilitaryTab: React.FC<MilitaryTabProps> = ({
  currentPosture,
  garrisonStrength,
  conscriptionPool,
  defenseReadiness,
  onPostureChange,
}) => {
  const effects = getPostureEffects(currentPosture);

  return (
    <View style={componentStyles.container}>
      <Text style={componentStyles.heading}>
        {'\u2605'} DEFENSE POSTURE DIRECTIVE {'\u2605'}
      </Text>
      <Text style={componentStyles.subheading}>Set military readiness level for the settlement</Text>

      {/* Posture selector */}
      <View style={componentStyles.postureRow}>
        {POSTURE_DEFS.map((p) => {
          const isActive = currentPosture === p.key;
          return (
            <Pressable
              key={p.key}
              style={[componentStyles.postureBtn, isActive && componentStyles.postureBtnActive]}
              onPress={() => onPostureChange(p.key)}
              testID={`posture-${p.key}`}
              accessibilityRole="button"
              accessibilityLabel={`Set posture to ${p.label}`}
            >
              <Text style={[componentStyles.postureText, isActive && componentStyles.postureTextActive]}>
                {p.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Effects display */}
      <View style={componentStyles.effectsSection}>
        <Text style={componentStyles.sectionLabel}>POSTURE EFFECTS</Text>
        {EFFECT_LABELS.map((ef) => {
          const value = effects[ef.key];
          const formatted = value > 0 ? `+${value}${ef.suffix}` : `${value}${ef.suffix}`;
          return (
            <View key={ef.key} style={componentStyles.effectRow} testID={`effect-${ef.key}`}>
              <Text style={componentStyles.effectLabel}>{ef.label}</Text>
              <Text
                style={[
                  componentStyles.effectValue,
                  value > 0 && componentStyles.effectPositive,
                  value < 0 && componentStyles.effectNegative,
                  value === 0 && componentStyles.effectNeutral,
                ]}
              >
                {formatted}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Stats display */}
      <View style={componentStyles.statsSection}>
        <Text style={componentStyles.sectionLabel}>MILITARY STATUS</Text>
        <View style={componentStyles.statRow} testID="stat-garrison">
          <Text style={componentStyles.statLabel}>GARRISON STRENGTH</Text>
          <Text style={componentStyles.statValue}>{garrisonStrength}</Text>
        </View>
        <View style={componentStyles.statRow} testID="stat-conscription">
          <Text style={componentStyles.statLabel}>CONSCRIPTION POOL</Text>
          <Text style={componentStyles.statValue}>{conscriptionPool}</Text>
        </View>
        <View style={componentStyles.statRow} testID="stat-readiness">
          <Text style={componentStyles.statLabel}>DEFENSE READINESS</Text>
          <Text style={[componentStyles.statValue, componentStyles.readinessValue]}>{defenseReadiness}%</Text>
        </View>
      </View>
    </View>
  );
};

// ── Styles ──────────────────────────────────────────────────────────────────

const OLIVE_DRAB = '#556b2f';
const OLIVE_DARK = '#3b4a20';
const OLIVE_LIGHT = '#6b8e23';

const componentStyles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  heading: {
    fontFamily: monoFont,
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 4,
  },
  subheading: {
    fontFamily: monoFont,
    fontSize: 9,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 16,
  },
  postureRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  postureBtn: {
    flex: 1,
    backgroundColor: '#424242',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#555',
    marginHorizontal: 2,
  },
  postureBtnActive: {
    backgroundColor: OLIVE_DRAB,
    borderColor: OLIVE_LIGHT,
  },
  postureText: {
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#9e9e9e',
    letterSpacing: 0.5,
  },
  postureTextActive: {
    color: Colors.sovietGold,
  },
  effectsSection: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: OLIVE_DARK,
    padding: 8,
  },
  sectionLabel: {
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: 'bold',
    color: OLIVE_LIGHT,
    letterSpacing: 1,
    marginBottom: 8,
  },
  effectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  effectLabel: {
    fontFamily: monoFont,
    fontSize: 10,
    color: Colors.textSecondary,
  },
  effectValue: {
    fontFamily: monoFont,
    fontSize: 11,
    fontWeight: 'bold',
  },
  effectPositive: {
    color: Colors.termGreen,
  },
  effectNegative: {
    color: '#ef5350',
  },
  effectNeutral: {
    color: Colors.textMuted,
  },
  statsSection: {
    borderWidth: 1,
    borderColor: OLIVE_DARK,
    padding: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  statLabel: {
    fontFamily: monoFont,
    fontSize: 10,
    color: Colors.textSecondary,
  },
  statValue: {
    fontFamily: monoFont,
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  readinessValue: {
    color: OLIVE_LIGHT,
  },
});
