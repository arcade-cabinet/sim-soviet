/**
 * WeatherForecastPanel — Weather and season information panel.
 *
 * Shows current weather conditions with gameplay modifiers,
 * the active season with its effects, and a full 7-season
 * calendar highlighting the current season.
 *
 * Uses SovietModal with terminal variant for dark-panel aesthetic.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SovietModal } from './SovietModal';
import { Colors, monoFont } from './styles';
import { getEngine } from '../bridge/GameInit';
import { useGameSnapshot } from '../hooks/useGameState';
import { WEATHER_PROFILES, WeatherType } from '../game/WeatherSystem';
import { SEASON_TABLE, getSeasonForMonth } from '../game/Chronology';

// ─────────────────────────────────────────────────────────────────────────────
//  Props
// ─────────────────────────────────────────────────────────────────────────────

export interface WeatherForecastPanelProps {
  visible: boolean;
  onDismiss: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Weather icons
// ─────────────────────────────────────────────────────────────────────────────

const WEATHER_ICONS: Record<WeatherType, string> = {
  [WeatherType.CLEAR]: '\u2600',
  [WeatherType.OVERCAST]: '\u2601',
  [WeatherType.SNOW]: '\u2744',
  [WeatherType.BLIZZARD]: '\uD83C\uDF28',
  [WeatherType.RAIN]: '\uD83C\uDF27',
  [WeatherType.MUD_STORM]: '\uD83C\uDF0A',
  [WeatherType.HEATWAVE]: '\uD83D\uDD25',
  [WeatherType.MIRACULOUS_SUN]: '\u2728',
  [WeatherType.FOG]: '\uD83C\uDF2B',
};

// ─────────────────────────────────────────────────────────────────────────────
//  Month name lookup
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_ABBREVS: readonly string[] = [
  '', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Format a numeric modifier as a signed percentage string. */
function fmtMult(value: number): string {
  const pct = Math.round(value * 100);
  if (pct === 100) return '100%';
  return `${pct}%`;
}

/** Color for a multiplier: green if beneficial (>=1), gold if neutral, red if bad (<1). */
function modColor(value: number, invertIsBad = false): string {
  if (invertIsBad) {
    // Higher is worse (e.g. constructionTimeMult)
    if (value <= 1.0) return Colors.termGreen;
    if (value <= 1.1) return Colors.sovietGold;
    return Colors.sovietRed;
  }
  // Higher is better (e.g. farmModifier, workerSpeedMult)
  if (value >= 1.0) return Colors.termGreen;
  if (value > 0) return Colors.sovietGold;
  return Colors.sovietRed;
}

/** Resolve WeatherType from the snapshot's uppercase label. */
function resolveWeatherType(label: string): WeatherType {
  const lower = label.toLowerCase();
  for (const wt of Object.values(WeatherType)) {
    if (wt === lower) return wt;
  }
  // Fallback: try matching the profile labels
  for (const profile of Object.values(WEATHER_PROFILES)) {
    if (profile.label.toUpperCase() === label) return profile.type;
  }
  return WeatherType.OVERCAST;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Section header with gold text and bottom border. */
const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <Text style={styles.sectionTitle}>{title}</Text>
);

/** Horizontal divider between sections. */
const Divider: React.FC = () => <View style={styles.divider} />;

/** Label + value row. */
const StatRow: React.FC<{ label: string; value: string; color?: string }> = ({
  label,
  value,
  color = Colors.white,
}) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Text style={[styles.value, { color }]}>{value}</Text>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
//  Main Component
// ─────────────────────────────────────────────────────────────────────────────

export const WeatherForecastPanel: React.FC<WeatherForecastPanelProps> = ({
  visible,
  onDismiss,
}) => {
  const snap = useGameSnapshot();

  if (!visible) return null;

  // ── Resolve weather data ─────────────────────────────────────────────────
  const weatherType = resolveWeatherType(snap.weatherLabel);
  const weatherProfile = WEATHER_PROFILES[weatherType];
  const weatherIcon = WEATHER_ICONS[weatherType] ?? '\u2601';

  // Try to get daysRemaining from the ChronologySystem
  const engine = getEngine();
  const chronology = engine?.getChronology() ?? null;
  const weatherState = chronology?.getWeather() ?? null;
  const daysRemaining = weatherState?.daysRemaining ?? null;

  // ── Resolve season data ──────────────────────────────────────────────────
  const currentSeasonProfile = getSeasonForMonth(snap.month);

  return (
    <SovietModal
      visible={visible}
      variant="terminal"
      title="WEATHER FORECAST"
      stampText="GOSKOMGIDROMET"
      actionLabel="DISMISS"
      onAction={onDismiss}
      dismissOnOverlay
      onDismiss={onDismiss}
    >
      {/* ── SECTION 1: CURRENT WEATHER ─────────────────────────── */}
      <SectionHeader title="CURRENT CONDITIONS" />

      <View style={styles.weatherHeader}>
        <Text style={styles.weatherIcon}>{weatherIcon}</Text>
        <View style={styles.weatherHeaderText}>
          <Text style={styles.weatherName}>{weatherProfile.label.toUpperCase()}</Text>
          <Text style={styles.weatherDesc}>{weatherProfile.description}</Text>
        </View>
      </View>

      <View style={styles.modifierGrid}>
        <View style={styles.modifierItem}>
          <Text style={styles.modifierLabel}>FARM</Text>
          <Text
            style={[
              styles.modifierValue,
              { color: modColor(weatherProfile.farmModifier) },
            ]}
          >
            {fmtMult(weatherProfile.farmModifier)}
          </Text>
        </View>
        <View style={styles.modifierItem}>
          <Text style={styles.modifierLabel}>BUILD</Text>
          <Text
            style={[
              styles.modifierValue,
              { color: modColor(weatherProfile.constructionTimeMult, true) },
            ]}
          >
            {fmtMult(weatherProfile.constructionTimeMult)}
          </Text>
        </View>
        <View style={styles.modifierItem}>
          <Text style={styles.modifierLabel}>SPEED</Text>
          <Text
            style={[
              styles.modifierValue,
              { color: modColor(weatherProfile.workerSpeedMult) },
            ]}
          >
            {fmtMult(weatherProfile.workerSpeedMult)}
          </Text>
        </View>
        <View style={styles.modifierItem}>
          <Text style={styles.modifierLabel}>EVENTS</Text>
          <Text
            style={[
              styles.modifierValue,
              { color: modColor(weatherProfile.eventFrequencyModifier, true) },
            ]}
          >
            {fmtMult(weatherProfile.eventFrequencyModifier)}
          </Text>
        </View>
      </View>

      <View style={styles.durationRow}>
        <Text style={styles.sublabel}>DURATION:</Text>
        <Text style={styles.durationValue}>
          {daysRemaining != null
            ? `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`
            : `${weatherProfile.minDuration}-${weatherProfile.maxDuration} days`}
        </Text>
      </View>

      <Divider />

      {/* ── SECTION 2: CURRENT SEASON ──────────────────────────── */}
      <SectionHeader title="CURRENT SEASON" />

      <View style={styles.seasonHeader}>
        <Text style={styles.seasonName}>{currentSeasonProfile.label.toUpperCase()}</Text>
        <Text style={styles.seasonMonths}>
          {currentSeasonProfile.months.map((m) => MONTH_ABBREVS[m]).join(' ')}
        </Text>
      </View>

      <Text style={styles.seasonDesc}>{currentSeasonProfile.description}</Text>

      <View style={styles.modifierGrid}>
        <View style={styles.modifierItem}>
          <Text style={styles.modifierLabel}>FARM</Text>
          <Text
            style={[
              styles.modifierValue,
              { color: modColor(currentSeasonProfile.farmMultiplier) },
            ]}
          >
            {fmtMult(currentSeasonProfile.farmMultiplier)}
          </Text>
        </View>
        <View style={styles.modifierItem}>
          <Text style={styles.modifierLabel}>BUILD</Text>
          <Text
            style={[
              styles.modifierValue,
              { color: modColor(currentSeasonProfile.buildCostMultiplier, true) },
            ]}
          >
            {fmtMult(currentSeasonProfile.buildCostMultiplier)}
          </Text>
        </View>
        <View style={styles.modifierItem}>
          <Text style={styles.modifierLabel}>HEAT</Text>
          <Text
            style={[
              styles.modifierValue,
              {
                color:
                  currentSeasonProfile.heatCostPerTick === 0
                    ? Colors.termGreen
                    : currentSeasonProfile.heatCostPerTick <= 1
                      ? Colors.sovietGold
                      : Colors.sovietRed,
              },
            ]}
          >
            {currentSeasonProfile.heatCostPerTick}/tick
          </Text>
        </View>
        <View style={styles.modifierItem}>
          <Text style={styles.modifierLabel}>LIGHT</Text>
          <Text
            style={[
              styles.modifierValue,
              {
                color:
                  currentSeasonProfile.daylightHours >= 16
                    ? Colors.termGreen
                    : currentSeasonProfile.daylightHours >= 10
                      ? Colors.sovietGold
                      : Colors.sovietRed,
              },
            ]}
          >
            {currentSeasonProfile.daylightHours}h
          </Text>
        </View>
      </View>

      {currentSeasonProfile.snowRate > 0 && (
        <View style={styles.snowRateRow}>
          <Text style={styles.sublabel}>SNOW RATE:</Text>
          <Text style={[styles.snowRateValue, { color: Colors.termBlue }]}>
            {currentSeasonProfile.snowRate}
          </Text>
        </View>
      )}

      <Divider />

      {/* ── SECTION 3: SEASON CALENDAR ─────────────────────────── */}
      <SectionHeader title="SEASON CALENDAR" />

      {SEASON_TABLE.map((sp) => {
        const isCurrent = sp.season === currentSeasonProfile.season;
        return (
          <View
            key={sp.season}
            style={[
              styles.calendarRow,
              isCurrent ? styles.calendarRowActive : undefined,
            ]}
          >
            <View style={styles.calendarNameCol}>
              <Text
                style={[
                  styles.calendarName,
                  isCurrent ? styles.calendarNameActive : undefined,
                ]}
              >
                {isCurrent ? '\u25B6 ' : '  '}
                {sp.label.toUpperCase()}
              </Text>
              <Text style={styles.calendarMonths}>
                {sp.months.map((m) => MONTH_ABBREVS[m]).join(' ')}
              </Text>
            </View>
            <View style={styles.calendarModifiers}>
              <Text
                style={[
                  styles.calendarModVal,
                  { color: modColor(sp.farmMultiplier) },
                ]}
              >
                F:{fmtMult(sp.farmMultiplier)}
              </Text>
              <Text
                style={[
                  styles.calendarModVal,
                  { color: modColor(sp.buildCostMultiplier, true) },
                ]}
              >
                B:{fmtMult(sp.buildCostMultiplier)}
              </Text>
              <Text
                style={[
                  styles.calendarModVal,
                  {
                    color:
                      sp.heatCostPerTick === 0
                        ? Colors.termGreen
                        : sp.heatCostPerTick <= 1
                          ? Colors.sovietGold
                          : Colors.sovietRed,
                  },
                ]}
              >
                H:{sp.heatCostPerTick}
              </Text>
            </View>
          </View>
        );
      })}
    </SovietModal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Section header ──
  sectionTitle: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 2,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingBottom: 4,
  },

  // ── Divider ──
  divider: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    marginVertical: 12,
  },

  // ── Rows ──
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  sublabel: {
    fontSize: 9,
    fontFamily: monoFont,
    color: Colors.textSecondary,
  },
  value: {
    fontSize: 14,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.white,
  },

  // ── Weather header ──
  weatherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  weatherIcon: {
    fontSize: 32,
  },
  weatherHeaderText: {
    flex: 1,
  },
  weatherName: {
    fontSize: 16,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.white,
    letterSpacing: 2,
  },
  weatherDesc: {
    fontSize: 9,
    fontFamily: monoFont,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
  },

  // ── Modifier grid (2x2) ──
  modifierGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  modifierItem: {
    flex: 1,
    minWidth: '40%',
    alignItems: 'center',
    backgroundColor: '#222',
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#333',
  },
  modifierLabel: {
    fontSize: 8,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  modifierValue: {
    fontSize: 14,
    fontFamily: monoFont,
    fontWeight: 'bold',
    marginTop: 2,
  },

  // ── Duration ──
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  durationValue: {
    fontSize: 11,
    fontFamily: monoFont,
    color: Colors.textPrimary,
  },

  // ── Season header ──
  seasonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  seasonName: {
    fontSize: 14,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.termGreen,
    letterSpacing: 2,
  },
  seasonMonths: {
    fontSize: 9,
    fontFamily: monoFont,
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  seasonDesc: {
    fontSize: 9,
    fontFamily: monoFont,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 8,
  },

  // ── Snow rate ──
  snowRateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  snowRateValue: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
  },

  // ── Calendar rows ──
  calendarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 6,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  calendarRowActive: {
    backgroundColor: '#1a2a1a',
    borderColor: Colors.termGreen,
  },
  calendarNameCol: {
    flex: 1,
  },
  calendarName: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    letterSpacing: 1,
  },
  calendarNameActive: {
    color: Colors.termGreen,
  },
  calendarMonths: {
    fontSize: 8,
    fontFamily: monoFont,
    color: Colors.textMuted,
    marginTop: 1,
  },
  calendarModifiers: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  calendarModVal: {
    fontSize: 8,
    fontFamily: monoFont,
    fontWeight: 'bold',
  },
});
