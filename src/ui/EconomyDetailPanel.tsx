/**
 * EconomyDetailPanel — Detailed economy subsystem breakdown panel.
 *
 * Shows granular data for every economy subsystem: trudodni, fondy,
 * blat, rations, MTS, heating, and currency reforms. A deeper dive
 * than the summary EconomyPanel, intended for players who want to
 * inspect the full machinery of Soviet planned economics.
 *
 * Uses SovietModal with terminal variant for dark-panel aesthetic.
 */

import type React from 'react';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { getEngine } from '../bridge/GameInit';
import type { CurrencyReform, DifficultyLevel, HeatingTier, TransferableResource } from '../game/economy';
import { HEATING_CONFIGS } from '../game/economy';
import { useGameSnapshot } from '../hooks/useGameState';
import { SovietModal } from './SovietModal';
import { Colors, monoFont } from './styles';

// ---------------------------------------------------------------------------
//  Props
// ---------------------------------------------------------------------------

export interface EconomyDetailPanelProps {
  visible: boolean;
  onDismiss: () => void;
}

// ---------------------------------------------------------------------------
//  Constants
// ---------------------------------------------------------------------------

const RESOURCE_LABELS: Record<TransferableResource, string> = {
  food: 'FOOD',
  vodka: 'VODKA',
  timber: 'TIMBER',
  steel: 'STEEL',
  money: 'RUBLES',
};

const RESOURCE_KEYS: TransferableResource[] = ['food', 'vodka', 'timber', 'steel', 'money'];

const HEATING_TIER_DISPLAY: Record<HeatingTier, { label: string; color: string }> = {
  pechka: { label: 'PECHKA (STOVE)', color: Colors.sovietGold },
  district: { label: 'DISTRICT', color: Colors.termGreen },
  crumbling: { label: 'CRUMBLING', color: Colors.sovietRed },
};

const DIFFICULTY_DISPLAY: Record<DifficultyLevel, { label: string; color: string }> = {
  worker: { label: 'WORKER', color: Colors.termGreen },
  comrade: { label: 'COMRADE', color: Colors.sovietGold },
  tovarish: { label: 'TOVARISH', color: Colors.sovietRed },
};

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

/** Trudodni ratio color: green >= 1.0, gold >= 0.7, red < 0.7. */
function trudodniColor(ratio: number): string {
  if (ratio >= 1.0) return Colors.termGreen;
  if (ratio >= 0.7) return Colors.sovietGold;
  return Colors.sovietRed;
}

/** Color for blat connection level gauge. */
function blatColor(level: number): string {
  if (level >= 60) return Colors.termGreen;
  if (level >= 30) return Colors.sovietGold;
  return Colors.sovietRed;
}

// ---------------------------------------------------------------------------
//  Sub-components
// ---------------------------------------------------------------------------

/** Section header with gold text and bottom border. */
const SectionHeader: React.FC<{ title: string }> = ({ title }) => <Text style={styles.sectionTitle}>{title}</Text>;

/** Horizontal divider between sections. */
const Divider: React.FC = () => <View style={styles.divider} />;

/** Progress bar with configurable color. */
const ProgressBar: React.FC<{ ratio: number; color: string; height?: number }> = ({ ratio, color, height = 10 }) => {
  const clamped = Math.max(0, Math.min(ratio, 1));
  return (
    <View style={[styles.barTrack, { height }]}>
      <View
        style={[
          styles.barFill,
          {
            width: `${Math.round(clamped * 100)}%`,
            backgroundColor: color,
            height: '100%',
          },
        ]}
      />
    </View>
  );
};

/** Active / Inactive badge. */
const StatusBadge: React.FC<{ active: boolean }> = ({ active }) => (
  <View style={[styles.badge, active ? styles.badgeActive : styles.badgeInactive]}>
    <Text style={[styles.badgeText, active ? styles.badgeTextActive : styles.badgeTextInactive]}>
      {active ? 'ACTIVE' : 'INACTIVE'}
    </Text>
  </View>
);

/** Blinking "FAILING" warning indicator. */
const FailingWarning: React.FC = () => {
  const blinkAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, {
          toValue: 0.2,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(blinkAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [blinkAnim]);

  return (
    <Animated.View style={[styles.failingBox, { opacity: blinkAnim }]}>
      <Text style={styles.failingText}>HEATING FAILURE — Population at risk!</Text>
    </Animated.View>
  );
};

// ---------------------------------------------------------------------------
//  Main Component
// ---------------------------------------------------------------------------

export const EconomyDetailPanel: React.FC<EconomyDetailPanelProps> = ({ visible, onDismiss }) => {
  // Subscribe to game state for re-renders
  useGameSnapshot();

  // Access engine systems — may be null if game not initialized
  const engine = getEngine();
  const economy = engine?.getEconomySystem() ?? null;

  if (!visible) return null;

  // -- Read economy data (guarded) ------------------------------------------

  const trudodni = economy?.getTrudodni() ?? null;
  const trudodniRatio = economy?.getTrudodniRatio() ?? 0;
  const fondy = economy?.getFondy() ?? null;
  const blat = economy?.getBlat() ?? null;
  const rations = economy?.getRations() ?? null;
  const mts = economy?.getMTS() ?? null;
  const heating = economy?.getHeating() ?? null;
  const reforms = economy?.getCurrencyReforms() ?? [];
  const difficulty = economy?.getDifficulty() ?? 'comrade';

  // -- Computed values -------------------------------------------------------

  const trudodniPct = Math.round(trudodniRatio * 100);
  const trudodniClr = trudodniColor(trudodniRatio);

  const heatingTierCfg = HEATING_TIER_DISPLAY[heating?.tier ?? 'pechka'];
  const heatingEffPct = heating ? Math.round(heating.efficiency * 100) : 0;
  const heatingEffColor =
    heatingEffPct >= 70 ? Colors.termGreen : heatingEffPct >= 40 ? Colors.sovietGold : Colors.sovietRed;

  const diffCfg = DIFFICULTY_DISPLAY[difficulty] ?? DIFFICULTY_DISPLAY.comrade;

  return (
    <SovietModal
      visible={visible}
      variant="terminal"
      title="ECONOMY DETAIL"
      stampText={diffCfg.label}
      actionLabel="CLOSE"
      onAction={onDismiss}
      dismissOnOverlay
      onDismiss={onDismiss}
    >
      {/* -- Difficulty badge ------------------------------------------------ */}
      <View style={styles.difficultyRow}>
        <Text style={styles.sublabel}>DIFFICULTY:</Text>
        <View style={[styles.difficultyBadge, { borderColor: diffCfg.color }]}>
          <Text style={[styles.difficultyBadgeText, { color: diffCfg.color }]}>{diffCfg.label}</Text>
        </View>
      </View>

      <Divider />

      {/* ================================================================= */}
      {/* SECTION 1: TRUDODNI                                               */}
      {/* ================================================================= */}
      <SectionHeader title="TRUDODNI (WORK-DAY UNITS)" />

      <View style={styles.row}>
        <Text style={styles.label}>CONTRIBUTED:</Text>
        <Text style={styles.value}>{Math.round(trudodni?.totalContributed ?? 0)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>MINIMUM REQ:</Text>
        <Text style={styles.value}>{Math.round(trudodni?.minimumRequired ?? 0)}</Text>
      </View>

      <View style={styles.barRow}>
        <ProgressBar ratio={trudodniRatio} color={trudodniClr} />
        <Text style={[styles.barPercent, { color: trudodniClr }]}>{trudodniPct}%</Text>
      </View>

      <Text style={styles.flavorText}>Collective labor points. Meet the minimum or face consequences.</Text>

      <Divider />

      {/* ================================================================= */}
      {/* SECTION 2: FONDY                                                  */}
      {/* ================================================================= */}
      <SectionHeader title="FONDY (STATE ALLOCATIONS)" />

      {fondy ? (
        <>
          {/* Table header */}
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeader, styles.tableColResource]}>RESOURCE</Text>
            <Text style={[styles.tableHeader, styles.tableColValue]}>ALLOCATED</Text>
          </View>

          {/* Table rows */}
          {RESOURCE_KEYS.map((key) => {
            const allocated = fondy.allocated[key] ?? 0;

            return (
              <View key={key} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.tableColResource]}>{RESOURCE_LABELS[key]}</Text>
                <Text style={[styles.tableCellValue, styles.tableColValue]}>{Math.round(allocated)}</Text>
              </View>
            );
          })}

          {/* Reliability bar */}
          <View style={styles.reliabilitySection}>
            <View style={styles.row}>
              <Text style={styles.sublabel}>RELIABILITY:</Text>
              <Text style={[styles.value, { color: fondy.reliability >= 0.7 ? Colors.termGreen : Colors.sovietRed }]}>
                {Math.round(fondy.reliability * 100)}%
              </Text>
            </View>
            <ProgressBar
              ratio={fondy.reliability}
              color={
                fondy.reliability >= 0.7
                  ? Colors.termGreen
                  : fondy.reliability >= 0.4
                    ? Colors.sovietGold
                    : Colors.sovietRed
              }
              height={6}
            />
          </View>

          {/* Next delivery countdown */}
          <View style={styles.deliveryCountdown}>
            <Text style={styles.countdownText}>NEXT DELIVERY IN: {fondy.nextDeliveryTick} TICKS</Text>
          </View>
        </>
      ) : (
        <Text style={styles.noData}>No allocation data available.</Text>
      )}

      <Divider />

      {/* ================================================================= */}
      {/* SECTION 3: BLAT                                                   */}
      {/* ================================================================= */}
      <SectionHeader title="BLAT (FAVOR NETWORK)" />

      {blat ? (
        <>
          {/* Large connection number */}
          <View style={styles.blatHeroRow}>
            <Text style={styles.blatHeroValue}>{Math.round(blat.connections)}</Text>
            <Text style={styles.blatHeroLabel}>CONNECTIONS</Text>
          </View>

          {/* Gauge meter 0-100 */}
          <View style={styles.blatGaugeRow}>
            <Text style={styles.sublabel}>LEVEL:</Text>
            <View style={styles.blatGauge}>
              <View
                style={[
                  styles.blatGaugeFill,
                  {
                    width: `${Math.min(blat.connections, 100)}%`,
                    backgroundColor: blatColor(blat.connections),
                  },
                ]}
              />
            </View>
          </View>

          {/* Earned / Spent */}
          <View style={styles.blatStatsRow}>
            <View style={styles.blatStatItem}>
              <Text style={[styles.blatStatValue, { color: Colors.termGreen }]}>{Math.round(blat.totalEarned)}</Text>
              <Text style={styles.blatStatLabel}>EARNED</Text>
            </View>
            <View style={styles.blatStatItem}>
              <Text style={[styles.blatStatValue, { color: Colors.sovietRed }]}>{Math.round(blat.totalSpent)}</Text>
              <Text style={styles.blatStatLabel}>SPENT</Text>
            </View>
          </View>
        </>
      ) : (
        <Text style={styles.noData}>No connection data.</Text>
      )}

      <Divider />

      {/* ================================================================= */}
      {/* SECTION 4: RATIONS                                                */}
      {/* ================================================================= */}
      <SectionHeader title="RATIONS" />

      {rations ? (
        <>
          <StatusBadge active={rations.active} />

          {rations.active && (
            <View style={styles.rationGrid}>
              {(
                [
                  ['worker', rations.rations.worker],
                  ['employee', rations.rations.employee],
                  ['dependent', rations.rations.dependent],
                  ['children', rations.rations.children],
                ] as const
              ).map(([tier, r]) => (
                <View key={tier} style={styles.rationCard}>
                  <Text style={styles.rationTierLabel}>{tier.toUpperCase()}</Text>
                  <View style={styles.rationAmounts}>
                    <Text style={styles.rationAmount}>
                      <Text style={styles.rationAmountValue}>{r.food}</Text>
                      <Text style={styles.rationAmountUnit}> FOOD</Text>
                    </Text>
                    <Text style={styles.rationAmount}>
                      <Text style={styles.rationAmountValue}>{r.vodka}</Text>
                      <Text style={styles.rationAmountUnit}> VODKA</Text>
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {!rations.active && (
            <Text style={styles.flavorText}>Ration cards are currently suspended. Citizens may purchase freely.</Text>
          )}
        </>
      ) : (
        <Text style={styles.noData}>No ration data.</Text>
      )}

      <Divider />

      {/* ================================================================= */}
      {/* SECTION 5: MTS                                                    */}
      {/* ================================================================= */}
      <SectionHeader title="MTS (MACHINE-TRACTOR STATION)" />

      {mts ? (
        <>
          <StatusBadge active={mts.active} />

          <View style={styles.row}>
            <Text style={styles.label}>TRACTOR UNITS:</Text>
            <Text style={styles.value}>{mts.tractorUnits}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>TOTAL RENTAL SPENT:</Text>
            <Text style={[styles.value, { color: Colors.sovietRed }]}>{Math.round(mts.totalRentalSpent)} RUB</Text>
          </View>
        </>
      ) : (
        <Text style={styles.noData}>No MTS data.</Text>
      )}

      <Divider />

      {/* ================================================================= */}
      {/* SECTION 6: HEATING                                                */}
      {/* ================================================================= */}
      <SectionHeader title="HEATING" />

      {heating ? (
        <>
          {/* Tier */}
          <View style={styles.row}>
            <Text style={styles.label}>TIER:</Text>
            <Text style={[styles.value, { color: heatingTierCfg.color }]}>{heatingTierCfg.label}</Text>
          </View>

          {/* Efficiency bar */}
          <View style={styles.row}>
            <Text style={styles.sublabel}>EFFICIENCY:</Text>
            <Text style={[styles.barPercent, { color: heatingEffColor }]}>{heatingEffPct}%</Text>
          </View>
          <ProgressBar ratio={heating.efficiency} color={heatingEffColor} />

          {/* Consumption */}
          {(() => {
            const cfg = HEATING_CONFIGS[heating.tier];
            return (
              <View style={[styles.row, { marginTop: 6 }]}>
                <Text style={styles.sublabel}>CONSUMPTION:</Text>
                <Text style={styles.value}>
                  {cfg.consumption.amount} {cfg.consumption.resource.toUpperCase()}/TICK
                </Text>
              </View>
            );
          })()}

          {/* Maintenance */}
          <View style={styles.row}>
            <Text style={styles.sublabel}>TICKS SINCE REPAIR:</Text>
            <Text style={styles.value}>{heating.ticksSinceRepair}</Text>
          </View>

          {/* Failing warning with blink */}
          {heating.failing && <FailingWarning />}
        </>
      ) : (
        <Text style={styles.noData}>No heating data.</Text>
      )}

      <Divider />

      {/* ================================================================= */}
      {/* SECTION 7: CURRENCY REFORMS                                       */}
      {/* ================================================================= */}
      <SectionHeader title="CURRENCY REFORMS" />

      {reforms.length > 0 ? (
        reforms.map((reform: CurrencyReform, idx: number) => (
          <View key={reform.year} style={[styles.reformCard, idx < reforms.length - 1 && styles.reformCardSpacing]}>
            <View style={styles.reformHeader}>
              <Text style={[styles.reformYear, { color: reform.applied ? Colors.textMuted : Colors.white }]}>
                {reform.year}
              </Text>
              <Text style={[styles.reformName, { color: reform.applied ? Colors.textMuted : Colors.white }]}>
                {reform.name}
              </Text>
              <Text style={[styles.reformRate, { color: reform.applied ? Colors.textMuted : Colors.sovietRed }]}>
                {reform.rate}:1
              </Text>
            </View>

            {reform.applied && (
              <View style={styles.reformAppliedBadge}>
                <Text style={styles.reformAppliedText}>APPLIED</Text>
              </View>
            )}
          </View>
        ))
      ) : (
        <Text style={styles.noData}>No reform data.</Text>
      )}
    </SovietModal>
  );
};

// ---------------------------------------------------------------------------
//  Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // -- Section header -------------------------------------------------------
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

  // -- Divider --------------------------------------------------------------
  divider: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    marginVertical: 12,
  },

  // -- Row / label / value --------------------------------------------------
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  sublabel: {
    fontSize: 10,
    fontFamily: monoFont,
    color: Colors.textSecondary,
  },
  value: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.white,
  },
  noData: {
    fontSize: 10,
    fontFamily: monoFont,
    color: '#555',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  flavorText: {
    fontSize: 9,
    fontFamily: monoFont,
    color: Colors.textMuted,
    fontStyle: 'italic',
    marginTop: 6,
    marginBottom: 2,
  },

  // -- Progress bars --------------------------------------------------------
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  barTrack: {
    flex: 1,
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#444',
  },
  barFill: {
    // height set inline
  },
  barPercent: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    minWidth: 36,
    textAlign: 'right',
  },

  // -- Difficulty badge -----------------------------------------------------
  difficultyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  difficultyBadge: {
    borderWidth: 2,
    paddingVertical: 2,
    paddingHorizontal: 10,
  },
  difficultyBadgeText: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 2,
  },

  // -- Status badge ---------------------------------------------------------
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  badgeActive: {
    borderColor: Colors.termGreen,
    backgroundColor: '#1a2a1a',
  },
  badgeInactive: {
    borderColor: Colors.textMuted,
    backgroundColor: '#1a1a1a',
  },
  badgeText: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  badgeTextActive: {
    color: Colors.termGreen,
  },
  badgeTextInactive: {
    color: Colors.textMuted,
  },

  // -- Fondy table ----------------------------------------------------------
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#444',
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableHeader: {
    fontSize: 8,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  tableColResource: {
    flex: 2,
  },
  tableColValue: {
    flex: 1,
    textAlign: 'right',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
    paddingLeft: 2,
  },
  tableCell: {
    fontSize: 10,
    fontFamily: monoFont,
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  tableCellValue: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.white,
    textAlign: 'right',
  },
  reliabilitySection: {
    marginTop: 8,
  },
  deliveryCountdown: {
    marginTop: 8,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  countdownText: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.termBlue,
    letterSpacing: 1,
  },

  // -- Blat -----------------------------------------------------------------
  blatHeroRow: {
    alignItems: 'center',
    marginBottom: 8,
  },
  blatHeroValue: {
    fontSize: 32,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
  },
  blatHeroLabel: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    letterSpacing: 2,
    marginTop: 2,
  },
  blatGaugeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  blatGauge: {
    flex: 1,
    height: 12,
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#444',
  },
  blatGaugeFill: {
    height: '100%',
  },
  blatStatsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  blatStatItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  blatStatValue: {
    fontSize: 16,
    fontFamily: monoFont,
    fontWeight: 'bold',
  },
  blatStatLabel: {
    fontSize: 7,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginTop: 2,
  },

  // -- Rations --------------------------------------------------------------
  rationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  rationCard: {
    width: '48%',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    padding: 8,
  },
  rationTierLabel: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 1,
    marginBottom: 4,
  },
  rationAmounts: {
    gap: 2,
  },
  rationAmount: {
    fontSize: 10,
    fontFamily: monoFont,
    color: Colors.textSecondary,
  },
  rationAmountValue: {
    fontWeight: 'bold',
    color: Colors.white,
  },
  rationAmountUnit: {
    color: Colors.textSecondary,
  },

  // -- Heating --------------------------------------------------------------
  failingBox: {
    marginTop: 8,
    backgroundColor: '#2a1a1a',
    borderWidth: 1,
    borderColor: Colors.sovietRed,
    padding: 8,
    alignItems: 'center',
  },
  failingText: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietRed,
    letterSpacing: 1,
    textAlign: 'center',
  },

  // -- Currency reforms -----------------------------------------------------
  reformCard: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    padding: 10,
  },
  reformCardSpacing: {
    marginBottom: 6,
  },
  reformHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reformYear: {
    fontSize: 12,
    fontFamily: monoFont,
    fontWeight: 'bold',
    minWidth: 40,
  },
  reformName: {
    flex: 1,
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  reformRate: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
    minWidth: 50,
    textAlign: 'right',
  },
  reformAppliedBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: Colors.textMuted,
  },
  reformAppliedText: {
    fontSize: 7,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textMuted,
    letterSpacing: 1,
  },
});
