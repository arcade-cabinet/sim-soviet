/**
 * CompulsoryDeliveriesPanel — Soviet compulsory delivery rates and doctrine overview.
 *
 * Shows the current doctrine with flavor text, delivery rates as visual bars
 * with estimated amounts, and a chronological doctrine history with the
 * current era highlighted.
 *
 * Uses SovietModal with terminal variant for dark-panel aesthetic.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SovietModal } from './SovietModal';
import { Colors, monoFont } from './styles';
import { getEngine } from '../bridge/GameInit';
import { useGameSnapshot } from '../hooks/useGameState';
import type { Doctrine } from '../game/CompulsoryDeliveries';
import { ERA_ORDER, ERA_DEFINITIONS } from '../game/era/definitions';

// ─────────────────────────────────────────────────────────────────────────────
//  Props
// ─────────────────────────────────────────────────────────────────────────────

export interface CompulsoryDeliveriesPanelProps {
  visible: boolean;
  onDismiss: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Doctrine flavor text
// ─────────────────────────────────────────────────────────────────────────────

const DOCTRINE_FLAVOR: Record<Doctrine, string> = {
  revolutionary:
    'All property belongs to the revolution. Deliveries are voluntary. Voluntary is mandatory.',
  industrialization:
    'The Plan demands sacrifice. Your grain feeds the factories. The factories feed the Plan.',
  wartime: 'Everything for the front. Everything for victory. Everything.',
  reconstruction:
    'The rebuilding requires resources. The state requires patience. You require both.',
  thaw: 'A kinder, gentler extraction. The state takes less. Relatively.',
  freeze:
    'Reform of the reform. Deliveries are restructured. The restructuring requires more deliveries.',
  stagnation:
    'The system is mature. The deliveries are traditional. The corruption is administrative.',
  eternal:
    'The quotas are eternal. The deliveries are eternal. The paperwork is eternal.',
};

// ─────────────────────────────────────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Section header with gold text and bottom border. */
const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <Text style={styles.sectionTitle}>{title}</Text>
);

/** Horizontal divider between sections. */
const Divider: React.FC = () => <View style={styles.divider} />;

/** Thin delivery rate bar showing the fraction taken by the state. */
const RateBar: React.FC<{ ratio: number }> = ({ ratio }) => {
  const clamped = Math.max(0, Math.min(ratio, 1));
  return (
    <View style={styles.rateBarTrack}>
      <View
        style={[
          styles.rateBarFill,
          { width: `${Math.round(clamped * 100)}%` },
        ]}
      />
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Resource label mapping
// ─────────────────────────────────────────────────────────────────────────────

const RESOURCE_KEYS: Array<{ key: 'food' | 'vodka' | 'money'; label: string }> = [
  { key: 'food', label: 'FOOD' },
  { key: 'vodka', label: 'VODKA' },
  { key: 'money', label: 'RUBLES' },
];

// ─────────────────────────────────────────────────────────────────────────────
//  Main Component
// ─────────────────────────────────────────────────────────────────────────────

export const CompulsoryDeliveriesPanel: React.FC<CompulsoryDeliveriesPanelProps> = ({
  visible,
  onDismiss,
}) => {
  // Subscribe to game state for re-renders
  const snap = useGameSnapshot();

  // Access engine systems — may be null if game not initialized
  const engine = getEngine();
  const eraSystem = engine?.getEraSystem() ?? null;

  if (!visible) return null;

  // ── Read era data (guarded) ──────────────────────────────────────────
  const doctrine = eraSystem?.getDoctrine() ?? null;
  const deliveryRates = eraSystem?.getDeliveryRates() ?? null;
  const quotaEscalation = eraSystem?.getQuotaEscalation() ?? 1.0;
  const currentEra = eraSystem?.getCurrentEra() ?? null;

  // ── Computed values ──────────────────────────────────────────────────
  const doctrineFlavor = doctrine ? DOCTRINE_FLAVOR[doctrine] : null;

  // Resource amounts from snapshot for estimated delivery calculation
  const resourceAmounts: Record<'food' | 'vodka' | 'money', number> = {
    food: snap.food,
    vodka: snap.vodka,
    money: snap.money,
  };

  return (
    <SovietModal
      visible={visible}
      variant="terminal"
      title="COMPULSORY DELIVERIES"
      stampText={doctrine ? doctrine.toUpperCase() : undefined}
      actionLabel="CLOSE"
      onAction={onDismiss}
      dismissOnOverlay
      onDismiss={onDismiss}
    >
      {/* ── SECTION 1: CURRENT DOCTRINE ────────────────────────── */}
      <SectionHeader title="CURRENT DOCTRINE" />

      {doctrine ? (
        <View style={styles.doctrineSection}>
          <Text style={styles.doctrineName}>{doctrine.toUpperCase()}</Text>

          {doctrineFlavor && (
            <Text style={styles.doctrineFlavor}>{doctrineFlavor}</Text>
          )}

          <View style={styles.row}>
            <Text style={styles.label}>QUOTA ESCALATION:</Text>
            <Text
              style={[
                styles.value,
                {
                  color:
                    quotaEscalation >= 1.4
                      ? Colors.sovietRed
                      : quotaEscalation >= 1.2
                        ? Colors.sovietGold
                        : Colors.termGreen,
                },
              ]}
            >
              {quotaEscalation.toFixed(2)}x
            </Text>
          </View>
        </View>
      ) : (
        <Text style={styles.noData}>No doctrine data available.</Text>
      )}

      <Divider />

      {/* ── SECTION 2: DELIVERY RATES ──────────────────────────── */}
      <SectionHeader title="DELIVERY RATES" />

      {deliveryRates ? (
        <View style={styles.ratesSection}>
          {RESOURCE_KEYS.map(({ key, label }) => {
            const rate = deliveryRates[key];
            const pct = Math.round(rate * 100);
            const currentAmount = resourceAmounts[key];
            const estimatedDelivery = Math.round(rate * currentAmount);

            return (
              <View key={key} style={styles.rateRow}>
                <View style={styles.rateHeader}>
                  <Text style={styles.rateLabel}>{label}</Text>
                  <Text style={styles.ratePct}>{pct}%</Text>
                </View>

                <RateBar ratio={rate} />

                <View style={styles.rateDetails}>
                  <Text style={styles.rateDetailText}>
                    STOCKPILE: {currentAmount}
                  </Text>
                  <Text style={styles.rateEstimate}>
                    EST. DELIVERY: ~{estimatedDelivery}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={styles.noData}>No delivery rate data.</Text>
      )}

      <Divider />

      {/* ── SECTION 3: DOCTRINE HISTORY ────────────────────────── */}
      <SectionHeader title="DOCTRINE HISTORY" />

      <View style={styles.historySection}>
        {ERA_ORDER.map((eraId) => {
          const eraDef = ERA_DEFINITIONS[eraId];
          const isCurrent = currentEra?.id === eraId;
          const rates = eraDef.deliveryRates;

          return (
            <View
              key={eraId}
              style={[
                styles.historyRow,
                isCurrent && styles.historyRowCurrent,
              ]}
            >
              <View style={styles.historyLeft}>
                {isCurrent && <View style={styles.currentIndicator} />}
                <View style={styles.historyInfo}>
                  <Text
                    style={[
                      styles.historyDoctrine,
                      isCurrent && styles.historyDoctrineCurrent,
                    ]}
                  >
                    {eraDef.doctrine.toUpperCase()}
                  </Text>
                  <Text style={styles.historyYears}>
                    {eraDef.startYear}
                    {eraDef.endYear > 0 ? `\u2013${eraDef.endYear}` : '+'}
                  </Text>
                </View>
              </View>

              <View style={styles.historyRates}>
                <Text style={styles.historyRateText}>
                  F:{Math.round(rates.food * 100)}%
                </Text>
                <Text style={styles.historyRateText}>
                  V:{Math.round(rates.vodka * 100)}%
                </Text>
                <Text style={styles.historyRateText}>
                  R:{Math.round(rates.money * 100)}%
                </Text>
              </View>
            </View>
          );
        })}
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

  // ── Current Doctrine ────────────────────────────────────────────────────
  doctrineSection: {
    borderWidth: 1,
    borderColor: Colors.sovietGold,
    padding: 10,
    marginBottom: 4,
    backgroundColor: '#1a1a1a',
  },
  doctrineName: {
    fontSize: 16,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 3,
    marginBottom: 8,
    textAlign: 'center',
  },
  doctrineFlavor: {
    fontSize: 10,
    fontFamily: monoFont,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 10,
    lineHeight: 16,
  },

  // ── Delivery Rates ──────────────────────────────────────────────────────
  ratesSection: {
    gap: 12,
  },
  rateRow: {
    gap: 4,
  },
  rateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rateLabel: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    letterSpacing: 1,
  },
  ratePct: {
    fontSize: 14,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietRed,
  },
  rateBarTrack: {
    height: 8,
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#444',
  },
  rateBarFill: {
    height: '100%',
    backgroundColor: Colors.sovietRed,
  },
  rateDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  rateDetailText: {
    fontSize: 9,
    fontFamily: monoFont,
    color: Colors.textSecondary,
  },
  rateEstimate: {
    fontSize: 9,
    fontFamily: monoFont,
    color: Colors.sovietRed,
  },

  // ── Doctrine History ────────────────────────────────────────────────────
  historySection: {
    gap: 2,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 6,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  historyRowCurrent: {
    borderColor: Colors.sovietGold,
    backgroundColor: '#2a2210',
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  currentIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.sovietGold,
  },
  historyInfo: {
    gap: 1,
  },
  historyDoctrine: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  historyDoctrineCurrent: {
    color: Colors.sovietGold,
  },
  historyYears: {
    fontSize: 8,
    fontFamily: monoFont,
    color: Colors.textMuted,
  },
  historyRates: {
    flexDirection: 'row',
    gap: 6,
  },
  historyRateText: {
    fontSize: 9,
    fontFamily: monoFont,
    color: Colors.textMuted,
  },
});
