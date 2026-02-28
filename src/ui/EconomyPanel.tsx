/**
 * EconomyPanel — Planned economy overview panel.
 *
 * Shows the full state of the Soviet planned economy:
 * trudodni (labor units), fondy (material allocations), blat (connections),
 * compulsory deliveries, heating, and remainder allocation.
 *
 * Uses SovietModal with terminal variant for dark-panel aesthetic.
 */

import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getEngine } from '../bridge/GameInit';
import type { HeatingTier, TransferableResource } from '../game/economy';
import { HEATING_CONFIGS } from '../game/economy';
import { useGameSnapshot } from '../hooks/useGameState';
import { SovietModal } from './SovietModal';
import { Colors, monoFont } from './styles';

// ─────────────────────────────────────────────────────────────────────────────
//  Props
// ─────────────────────────────────────────────────────────────────────────────

export interface EconomyPanelProps {
  visible: boolean;
  onDismiss: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Resource display labels
// ─────────────────────────────────────────────────────────────────────────────

const RESOURCE_LABELS: Record<TransferableResource, string> = {
  food: 'FOOD',
  vodka: 'VODKA',
  timber: 'TIMBER',
  steel: 'STEEL',
  money: 'RUBLES',
};

const RESOURCE_KEYS: TransferableResource[] = ['food', 'vodka', 'timber', 'steel', 'money'];

// ─────────────────────────────────────────────────────────────────────────────
//  Heating tier display
// ─────────────────────────────────────────────────────────────────────────────

const HEATING_TIER_CONFIG: Record<string, { label: string; color: string }> = {
  pechka: { label: 'PECHKA (STOVE)', color: Colors.sovietGold },
  district: { label: 'DISTRICT', color: Colors.termGreen },
  crumbling: { label: 'CRUMBLING', color: Colors.sovietRed },
};

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Color for a delivery ratio: green=complete, gold=partial, red=none. */
function _deliveryColor(delivered: number, allocated: number): string {
  if (allocated <= 0) return Colors.textMuted;
  const ratio = delivered / allocated;
  if (ratio >= 0.9) return Colors.termGreen;
  if (ratio > 0) return Colors.sovietGold;
  return Colors.sovietRed;
}

/** Color for blat level gauge. */
function blatColor(level: number): string {
  if (level >= 60) return Colors.termGreen;
  if (level >= 30) return Colors.sovietGold;
  return Colors.sovietRed;
}

/** KGB risk label from blat connections level. */
function blatRiskLabel(connections: number): { label: string; color: string } {
  if (connections >= 80) return { label: 'HIGH', color: Colors.sovietRed };
  if (connections >= 50) return { label: 'MODERATE', color: Colors.sovietGold };
  if (connections >= 25) return { label: 'LOW', color: Colors.termGreen };
  return { label: 'MINIMAL', color: Colors.textMuted };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
//  Main Component
// ─────────────────────────────────────────────────────────────────────────────

export const EconomyPanel: React.FC<EconomyPanelProps> = ({ visible, onDismiss }) => {
  // Subscribe to game state for re-renders
  const snap = useGameSnapshot();

  // Access engine systems — may be null if game not initialized
  const engine = getEngine();
  const economy = engine?.getEconomySystem() ?? null;
  const deliveries = engine?.getDeliveries() ?? null;

  if (!visible) return null;

  // ── Read economy data (guarded) ────────────────────────────────────────

  const trudodni = economy?.getTrudodni() ?? null;
  const trudodniRatio = economy?.getTrudodniRatio() ?? 0;
  const fondy = economy?.getFondy() ?? null;
  const blat = economy?.getBlat() ?? null;
  const rations = economy?.getRations() ?? null;
  const heating = economy?.getHeating() ?? null;
  const era = economy?.getEra() ?? 'revolution';

  const deliveryRates = deliveries?.getRates() ?? null;
  const totalDelivered = deliveries?.getTotalDelivered() ?? null;

  // ── Computed values ────────────────────────────────────────────────────

  // Average extraction rate across food/vodka/money
  const avgExtractionRate = deliveryRates
    ? Math.round(((deliveryRates.food + deliveryRates.vodka + deliveryRates.money) / 3) * 100)
    : 0;

  // Heating coverage
  const heatingCoverage = heating ? Math.round(heating.efficiency * 100) : 0;
  const heatingTierCfg = HEATING_TIER_CONFIG[heating?.tier ?? 'pechka'] ?? HEATING_TIER_CONFIG.pechka;

  return (
    <SovietModal
      visible={visible}
      variant="terminal"
      title="PLANNED ECONOMY"
      stampText={era.toUpperCase()}
      actionLabel="CLOSE"
      onAction={onDismiss}
      dismissOnOverlay
      onDismiss={onDismiss}
    >
      {/* ── TRUDODNI ──────────────────────────────────────────────── */}
      <SectionHeader title="TRUDODNI (LABOR UNITS)" />

      <View style={styles.row}>
        <Text style={styles.label}>CONTRIBUTED:</Text>
        <Text style={styles.value}>{Math.round(trudodni?.totalContributed ?? 0)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>MINIMUM REQ:</Text>
        <Text style={styles.value}>{Math.round(trudodni?.minimumRequired ?? 0)}</Text>
      </View>

      <View style={styles.barRow}>
        <ProgressBar ratio={trudodniRatio} color={trudodniRatio >= 1 ? Colors.termGreen : Colors.sovietRed} />
        <Text style={[styles.barPercent, { color: trudodniRatio >= 1 ? Colors.termGreen : Colors.sovietRed }]}>
          {Math.round(trudodniRatio * 100)}%
        </Text>
      </View>

      <Divider />

      {/* ── FONDY ────────────────────────────────────────────────── */}
      <SectionHeader title="FONDY (MATERIAL ALLOCATIONS)" />

      {fondy ? (
        <>
          {RESOURCE_KEYS.map((key) => {
            const allocated = fondy.allocated[key] ?? 0;
            return (
              <View key={key} style={styles.fondyRow}>
                <Text style={styles.fondyLabel}>{RESOURCE_LABELS[key]}</Text>
                <Text style={[styles.fondyValue, { color: allocated > 0 ? Colors.termGreen : Colors.textMuted }]}>
                  {Math.round(allocated)}
                </Text>
              </View>
            );
          })}
          <View style={styles.row}>
            <Text style={styles.sublabel}>RELIABILITY:</Text>
            <Text style={[styles.value, { color: fondy.reliability >= 0.7 ? Colors.termGreen : Colors.sovietRed }]}>
              {Math.round(fondy.reliability * 100)}%
            </Text>
          </View>
        </>
      ) : (
        <Text style={styles.noData}>No allocation data available.</Text>
      )}

      <Divider />

      {/* ── BLAT ─────────────────────────────────────────────────── */}
      <SectionHeader title="BLAT (UNOFFICIAL CONNECTIONS)" />

      {blat ? (
        <>
          <View style={styles.blatGaugeRow}>
            <Text style={styles.label}>LEVEL:</Text>
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
            <Text style={[styles.blatValue, { color: blatColor(blat.connections) }]}>
              {Math.round(blat.connections)}
            </Text>
          </View>

          {(() => {
            const risk = blatRiskLabel(blat.connections);
            return (
              <View style={styles.row}>
                <Text style={styles.sublabel}>KGB RISK:</Text>
                <Text style={[styles.value, { color: risk.color }]}>{risk.label}</Text>
              </View>
            );
          })()}
        </>
      ) : (
        <Text style={styles.noData}>No connection data.</Text>
      )}

      <Divider />

      {/* ── COMPULSORY DELIVERIES ─────────────────────────────────── */}
      <SectionHeader title="COMPULSORY DELIVERIES" />

      {deliveryRates ? (
        <>
          <View style={styles.extractionRow}>
            <Text style={styles.extractionLabel}>STATE TAKES:</Text>
            <Text style={styles.extractionValue}>{avgExtractionRate}%</Text>
          </View>

          <View style={styles.deliveryRatesRow}>
            <View style={styles.deliveryRateItem}>
              <Text style={styles.deliveryRateLabel}>FOOD</Text>
              <Text style={styles.deliveryRateValue}>{Math.round(deliveryRates.food * 100)}%</Text>
            </View>
            <View style={styles.deliveryRateItem}>
              <Text style={styles.deliveryRateLabel}>VODKA</Text>
              <Text style={styles.deliveryRateValue}>{Math.round(deliveryRates.vodka * 100)}%</Text>
            </View>
            <View style={styles.deliveryRateItem}>
              <Text style={styles.deliveryRateLabel}>MONEY</Text>
              <Text style={styles.deliveryRateValue}>{Math.round(deliveryRates.money * 100)}%</Text>
            </View>
          </View>

          {totalDelivered && (
            <>
              <Text style={styles.deliveredHeading}>DELIVERED THIS PERIOD:</Text>
              <View style={styles.row}>
                <Text style={styles.sublabel}>FOOD:</Text>
                <Text style={[styles.value, { color: Colors.sovietRed }]}>{Math.round(totalDelivered.food)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.sublabel}>VODKA:</Text>
                <Text style={[styles.value, { color: Colors.sovietRed }]}>{Math.round(totalDelivered.vodka)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.sublabel}>MONEY:</Text>
                <Text style={[styles.value, { color: Colors.sovietRed }]}>{Math.round(totalDelivered.money)}</Text>
              </View>
            </>
          )}
        </>
      ) : (
        <Text style={styles.noData}>No delivery data.</Text>
      )}

      <Divider />

      {/* ── HEATING ───────────────────────────────────────────────── */}
      <SectionHeader title="HEATING" />

      {heating ? (
        <>
          <View style={styles.row}>
            <Text style={styles.label}>TIER:</Text>
            <Text style={[styles.value, { color: heatingTierCfg.color }]}>{heatingTierCfg.label}</Text>
          </View>

          <View style={styles.barRow}>
            <Text style={styles.sublabel}>COVERAGE:</Text>
            <View style={styles.barRowInner}>
              <ProgressBar
                ratio={heating.efficiency}
                color={
                  heatingCoverage >= 70
                    ? Colors.termGreen
                    : heatingCoverage >= 40
                      ? Colors.sovietGold
                      : Colors.sovietRed
                }
              />
              <Text
                style={[
                  styles.barPercent,
                  {
                    color:
                      heatingCoverage >= 70
                        ? Colors.termGreen
                        : heatingCoverage >= 40
                          ? Colors.sovietGold
                          : Colors.sovietRed,
                  },
                ]}
              >
                {heatingCoverage}%
              </Text>
            </View>
          </View>

          {(() => {
            const cfg = HEATING_CONFIGS[heating.tier as HeatingTier];
            return (
              <View style={styles.row}>
                <Text style={styles.sublabel}>FUEL:</Text>
                <Text style={[styles.value, { color: heating.failing ? Colors.sovietRed : Colors.termGreen }]}>
                  {heating.failing
                    ? 'FAILING'
                    : `${cfg.consumption.resource.toUpperCase()} (${cfg.consumption.amount}/tick)`}
                </Text>
              </View>
            );
          })()}

          {heating.failing && <Text style={styles.warningText}>HEATING FAILURE — Population at risk!</Text>}
        </>
      ) : (
        <Text style={styles.noData}>No heating data.</Text>
      )}

      <Divider />

      {/* ── REMAINDER ─────────────────────────────────────────────── */}
      <SectionHeader title="REMAINDER (AFTER STATE CUT)" />

      <Text style={styles.remainderNote}>After compulsory deliveries, surplus is split:</Text>

      <View style={styles.remainderBreakdown}>
        <View style={styles.remainderItem}>
          <View style={[styles.remainderDot, { backgroundColor: Colors.termGreen }]} />
          <Text style={styles.remainderLabel}>70% WORKER RATIONS</Text>
        </View>
        <View style={styles.remainderItem}>
          <View style={[styles.remainderDot, { backgroundColor: Colors.sovietGold }]} />
          <Text style={styles.remainderLabel}>30% STRATEGIC RESERVE</Text>
        </View>
      </View>

      {rations?.active && (
        <View style={styles.rationsActive}>
          <Text style={styles.rationsActiveLabel}>RATION CARDS ACTIVE</Text>
          <Text style={styles.rationsActiveDetail}>
            Worker: {rations.rations.worker.food}F / {rations.rations.worker.vodka}V per tick
          </Text>
        </View>
      )}

      {/* Current stockpile from snapshot */}
      <View style={styles.stockpileRow}>
        <View style={styles.stockpileItem}>
          <Text style={styles.stockpileValue}>{snap.food}</Text>
          <Text style={styles.stockpileLabel}>FOOD</Text>
        </View>
        <View style={styles.stockpileItem}>
          <Text style={styles.stockpileValue}>{snap.vodka}</Text>
          <Text style={styles.stockpileLabel}>VODKA</Text>
        </View>
        <View style={styles.stockpileItem}>
          <Text style={styles.stockpileValue}>{snap.money}</Text>
          <Text style={styles.stockpileLabel}>RUBLES</Text>
        </View>
      </View>
    </SovietModal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
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
  divider: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    marginVertical: 12,
  },
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

  // ── Progress bars ─────────────────────────────────────────────────────
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  barRowInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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

  // ── Fondy ─────────────────────────────────────────────────────────────
  fondyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
    paddingLeft: 4,
  },
  fondyLabel: {
    fontSize: 10,
    fontFamily: monoFont,
    color: Colors.textSecondary,
    letterSpacing: 1,
    minWidth: 60,
  },
  fondyValue: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
  },

  // ── Blat ──────────────────────────────────────────────────────────────
  blatGaugeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
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
  blatValue: {
    fontSize: 12,
    fontFamily: monoFont,
    fontWeight: 'bold',
    minWidth: 28,
    textAlign: 'right',
  },

  // ── Compulsory deliveries ─────────────────────────────────────────────
  extractionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 8,
  },
  extractionLabel: {
    fontSize: 12,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietRed,
  },
  extractionValue: {
    fontSize: 18,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietRed,
  },
  deliveryRatesRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  deliveryRateItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#333',
  },
  deliveryRateLabel: {
    fontSize: 8,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  deliveryRateValue: {
    fontSize: 14,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietRed,
    marginTop: 2,
  },
  deliveredHeading: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 4,
    marginTop: 4,
  },

  // ── Heating ───────────────────────────────────────────────────────────
  warningText: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietRed,
    marginTop: 4,
    textAlign: 'center',
    letterSpacing: 1,
  },

  // ── Remainder ─────────────────────────────────────────────────────────
  remainderNote: {
    fontSize: 10,
    fontFamily: monoFont,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  remainderBreakdown: {
    gap: 4,
    marginBottom: 10,
  },
  remainderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  remainderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  remainderLabel: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    letterSpacing: 1,
  },
  rationsActive: {
    backgroundColor: '#2a1a1a',
    borderWidth: 1,
    borderColor: Colors.sovietRed,
    padding: 8,
    marginBottom: 10,
  },
  rationsActiveLabel: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietRed,
    letterSpacing: 1,
    marginBottom: 2,
  },
  rationsActiveDetail: {
    fontSize: 9,
    fontFamily: monoFont,
    color: Colors.textSecondary,
  },
  stockpileRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  stockpileItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#222',
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  stockpileValue: {
    fontSize: 16,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.white,
  },
  stockpileLabel: {
    fontSize: 8,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginTop: 2,
  },
});
