/**
 * ConsumerGoodsMarketPanel -- Underground blat trading interface.
 *
 * "In the Soviet Union, the black market is where the free market lives."
 *
 * Allows players to buy food/vodka on the underground exchange (at a markup),
 * sell surplus at a loss, and risk KGB detection on every transaction.
 * Each trade increases a session-level risk counter. High risk triggers
 * a blat_noticed mark on the player's PersonnelFile.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SovietModal } from './SovietModal';
import { Colors, monoFont } from './styles';
import { getEngine } from '../bridge/GameInit';
import { useGameSnapshot } from '../hooks/useGameState';
import { getResourceEntity } from '@/ecs/archetypes';
import { notifyStateChange } from '@/stores/gameStore';

// ─────────────────────────────────────────────────────────────────────────────
//  Types & Constants
// ─────────────────────────────────────────────────────────────────────────────

export interface ConsumerGoodsMarketPanelProps {
  visible: boolean;
  onDismiss: () => void;
}

type RiskLevel = 'LOW' | 'MODERATE' | 'DANGEROUS' | 'CRITICAL';

interface RiskConfig {
  label: RiskLevel;
  color: string;
  /** Probability of KGB detection per transaction at this level. */
  detectionChance: number;
}

const RISK_TIERS: { threshold: number; config: RiskConfig }[] = [
  { threshold: 8, config: { label: 'CRITICAL', color: '#b71c1c', detectionChance: 0.60 } },
  { threshold: 5, config: { label: 'DANGEROUS', color: Colors.sovietRed, detectionChance: 0.35 } },
  { threshold: 3, config: { label: 'MODERATE', color: '#ff9800', detectionChance: 0.15 } },
  { threshold: 0, config: { label: 'LOW', color: Colors.termGreen, detectionChance: 0.05 } },
];

function getRiskConfig(transactions: number): RiskConfig {
  for (const tier of RISK_TIERS) {
    if (transactions >= tier.threshold) return tier.config;
  }
  return RISK_TIERS[RISK_TIERS.length - 1]!.config;
}

/** Black market markup multiplier (goods cost more than official price). */
const BUY_MARKUP = 2.5;

/** Sell discount (you get less than market value). */
const SELL_DISCOUNT = 0.4;

/** Base cost of food on the "official" market. */
const FOOD_BASE_COST = 10;

/** Base cost of vodka on the "official" market. */
const VODKA_BASE_COST = 15;

/** Units per buy transaction. */
const BUY_FOOD_AMOUNT = 50;
const BUY_VODKA_AMOUNT = 25;

/** Units per sell transaction. */
const SELL_FOOD_AMOUNT = 50;
const SELL_VODKA_AMOUNT = 25;

interface TradeOperation {
  id: string;
  label: string;
  description: string;
  /** Resource spent */
  costType: 'money' | 'food' | 'vodka';
  costAmount: number;
  /** Resource gained */
  gainType: 'money' | 'food' | 'vodka';
  gainAmount: number;
  /** Button text */
  actionLabel: string;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Market Gossip
// ─────────────────────────────────────────────────────────────────────────────

const MARKET_GOSSIP: string[] = [
  'Comrade Petrov has extra galoshes. Interested parties should inquire at the usual bench.',
  'A shipment of Bulgarian cigarettes arrived at Depot 7. First come, first served.',
  'The butcher on Sovetskaya Street has real sausage. Tell him Oleg sent you.',
  'Babushka Valentina is knitting shawls for vodka. Fair exchange is not robbery.',
  'Someone at the locomotive works is trading ball bearings for tinned fish.',
  'A crate of Georgian wine fell off a truck near the train station. Such accidents happen.',
  'The factory canteen cook will trade extra portions for a bottle. Medicinal purposes.',
  'Comrade Ivanova says the shoe factory has a surplus. Only left shoes, unfortunately.',
  'A man in Sector 12 sells radio parts. He claims they are from a broken radio. Many radios.',
  'Fresh eggs available behind the collective farm office. Knock three times, ask for Masha.',
  'The watchmaker on Lenin Prospekt will fix anything for vodka. Even things that are not broken.',
  'Word is that the warehouse guard takes a long lunch at 13:00. Just saying.',
  'Comrade Sidorov traded his Party membership card for a winter coat. Bold move.',
  'A sailor in the port district has foreign chocolate. Do not ask which country.',
  'The hospital orderly has aspirin. The price is steep but your headache is worse.',
];

function getRandomGossip(): string {
  return MARKET_GOSSIP[Math.floor(Math.random() * MARKET_GOSSIP.length)]!;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Sub-Components
// ─────────────────────────────────────────────────────────────────────────────

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <Text style={styles.sectionTitle}>{title}</Text>
);

const Divider: React.FC = () => <View style={styles.divider} />;

// ─────────────────────────────────────────────────────────────────────────────
//  Main Component
// ─────────────────────────────────────────────────────────────────────────────

export const ConsumerGoodsMarketPanel: React.FC<ConsumerGoodsMarketPanelProps> = ({
  visible,
  onDismiss,
}) => {
  const snap = useGameSnapshot();
  const engine = getEngine();

  // Session-level transaction counter (resets when panel is remounted)
  const [transactionCount, setTransactionCount] = useState(0);
  const [lastTradeId, setLastTradeId] = useState<string | null>(null);
  const [gossip, setGossip] = useState(() => getRandomGossip());

  // ── Computed values ──────────────────────────────────────────────────────

  const riskConfig = useMemo(() => getRiskConfig(transactionCount), [transactionCount]);

  // Underground exchange rate: how much rubles a unit of food/vodka costs
  const foodBuyCost = Math.round(FOOD_BASE_COST * BUY_MARKUP);
  const vodkaBuyCost = Math.round(VODKA_BASE_COST * BUY_MARKUP);
  const foodSellPrice = Math.round(FOOD_BASE_COST * SELL_DISCOUNT);
  const vodkaSellPrice = Math.round(VODKA_BASE_COST * SELL_DISCOUNT);

  // Trade operations
  const trades: TradeOperation[] = useMemo(
    () => [
      {
        id: 'buy_food',
        label: 'ACQUIRE FOOD',
        description: `Buy ${BUY_FOOD_AMOUNT} food at underground markup`,
        costType: 'money' as const,
        costAmount: foodBuyCost * BUY_FOOD_AMOUNT,
        gainType: 'food' as const,
        gainAmount: BUY_FOOD_AMOUNT,
        actionLabel: 'ACQUIRE',
      },
      {
        id: 'buy_vodka',
        label: 'ACQUIRE VODKA',
        description: `Buy ${BUY_VODKA_AMOUNT} vodka at underground markup`,
        costType: 'money' as const,
        costAmount: vodkaBuyCost * BUY_VODKA_AMOUNT,
        gainType: 'vodka' as const,
        gainAmount: BUY_VODKA_AMOUNT,
        actionLabel: 'ACQUIRE',
      },
      {
        id: 'sell_food',
        label: 'SELL SURPLUS FOOD',
        description: `Convert ${SELL_FOOD_AMOUNT} food to rubles (below market)`,
        costType: 'food' as const,
        costAmount: SELL_FOOD_AMOUNT,
        gainType: 'money' as const,
        gainAmount: foodSellPrice * SELL_FOOD_AMOUNT,
        actionLabel: 'SELL',
      },
      {
        id: 'sell_vodka',
        label: 'SELL SURPLUS VODKA',
        description: `Convert ${SELL_VODKA_AMOUNT} vodka to rubles (below market)`,
        costType: 'vodka' as const,
        costAmount: SELL_VODKA_AMOUNT,
        gainType: 'money' as const,
        gainAmount: vodkaSellPrice * SELL_VODKA_AMOUNT,
        actionLabel: 'SELL',
      },
    ],
    [foodBuyCost, vodkaBuyCost, foodSellPrice, vodkaSellPrice]
  );

  // ── Affordability check ──────────────────────────────────────────────────

  const canAfford = useCallback(
    (trade: TradeOperation): boolean => {
      const available =
        trade.costType === 'money'
          ? snap.money
          : trade.costType === 'food'
            ? snap.food
            : snap.vodka;
      return available >= trade.costAmount;
    },
    [snap.money, snap.food, snap.vodka]
  );

  // ── Transaction handler ──────────────────────────────────────────────────

  const handleTrade = useCallback(
    (trade: TradeOperation) => {
      const res = getResourceEntity();
      if (!res) return;

      const r = res.resources;

      // Defensive re-check
      const available =
        trade.costType === 'money'
          ? r.money
          : trade.costType === 'food'
            ? r.food
            : r.vodka;
      if (available < trade.costAmount) return;

      // Deduct cost
      r[trade.costType] -= trade.costAmount;

      // Grant gain
      r[trade.gainType] += trade.gainAmount;

      // Increment session risk
      const newCount = transactionCount + 1;
      setTransactionCount(newCount);
      setLastTradeId(trade.id);
      setTimeout(() => setLastTradeId(null), 1000);

      // Rotate gossip every 2 trades
      if (newCount % 2 === 0) {
        setGossip(getRandomGossip());
      }

      // KGB detection roll
      const risk = getRiskConfig(newCount);
      const roll = Math.random();
      if (roll < risk.detectionChance && engine) {
        const file = engine.getPersonnelFile();
        // Get current tick from the snapshot (best available without deep engine access)
        const tick = snap.tick ?? 0;
        file.addMark(
          'blat_noticed',
          tick,
          `Underground market activity detected: ${trade.label.toLowerCase()}`
        );
      }

      // Notify React of ECS resource mutation
      notifyStateChange();
    },
    [transactionCount, engine, snap.tick]
  );

  // ── Risk meter ───────────────────────────────────────────────────────────

  const riskSegments = 10;
  const filledSegments = Math.min(transactionCount, riskSegments);

  if (!visible) return null;

  return (
    <SovietModal
      visible={visible}
      variant="terminal"
      title="UNDERGROUND EXCHANGE"
      stampText="UNOFFICIAL"
      actionLabel="LEAVE MARKET"
      onAction={onDismiss}
      dismissOnOverlay
      onDismiss={onDismiss}
    >
      {/* ── MARKET OVERVIEW ────────────────────────────────────── */}
      <SectionHeader title="CURRENT HOLDINGS" />

      <View style={styles.stockpileRow}>
        <View style={styles.stockpileItem}>
          <Text style={styles.stockpileValue}>{Math.round(snap.money)}</Text>
          <Text style={styles.stockpileLabel}>RUBLES</Text>
        </View>
        <View style={styles.stockpileItem}>
          <Text style={styles.stockpileValue}>{Math.round(snap.food)}</Text>
          <Text style={styles.stockpileLabel}>FOOD</Text>
        </View>
        <View style={styles.stockpileItem}>
          <Text style={styles.stockpileValue}>{Math.round(snap.vodka)}</Text>
          <Text style={styles.stockpileLabel}>VODKA</Text>
        </View>
      </View>

      <View style={styles.exchangeRateBox}>
        <Text style={styles.exchangeRateTitle}>UNDERGROUND EXCHANGE RATES</Text>
        <View style={styles.rateRow}>
          <Text style={styles.rateLabel}>FOOD (buy):</Text>
          <Text style={styles.rateValue}>{foodBuyCost} rub/unit</Text>
        </View>
        <View style={styles.rateRow}>
          <Text style={styles.rateLabel}>VODKA (buy):</Text>
          <Text style={styles.rateValue}>{vodkaBuyCost} rub/unit</Text>
        </View>
        <View style={styles.rateRow}>
          <Text style={styles.rateLabel}>FOOD (sell):</Text>
          <Text style={[styles.rateValue, { color: Colors.sovietRed }]}>
            {foodSellPrice} rub/unit
          </Text>
        </View>
        <View style={styles.rateRow}>
          <Text style={styles.rateLabel}>VODKA (sell):</Text>
          <Text style={[styles.rateValue, { color: Colors.sovietRed }]}>
            {vodkaSellPrice} rub/unit
          </Text>
        </View>
      </View>

      <Divider />

      {/* ── KGB RISK METER ─────────────────────────────────────── */}
      <SectionHeader title="KGB SURVEILLANCE STATUS" />

      <View style={styles.riskMeterRow}>
        <Text style={styles.riskMeterLabel}>RISK:</Text>
        <View style={styles.riskMeterTrack}>
          {Array.from({ length: riskSegments }, (_, i) => {
            const filled = i < filledSegments;
            let segColor = '#333';
            if (filled) {
              if (i < 3) segColor = Colors.termGreen;
              else if (i < 5) segColor = '#ff9800';
              else if (i < 8) segColor = Colors.sovietRed;
              else segColor = '#b71c1c';
            }
            return (
              <View
                key={i}
                style={[styles.riskSegment, filled && { backgroundColor: segColor }]}
              />
            );
          })}
        </View>
        <Text style={[styles.riskLevelText, { color: riskConfig.color }]}>
          {riskConfig.label}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.sublabel}>TRANSACTIONS THIS SESSION:</Text>
        <Text style={[styles.value, { color: riskConfig.color }]}>{transactionCount}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.sublabel}>DETECTION PROBABILITY:</Text>
        <Text style={[styles.value, { color: riskConfig.color }]}>
          {Math.round(riskConfig.detectionChance * 100)}%
        </Text>
      </View>

      <Divider />

      {/* ── BUY/SELL OPERATIONS ─────────────────────────────────── */}
      <SectionHeader title="AVAILABLE TRANSACTIONS" />

      {trades.map((trade) => {
        const affordable = canAfford(trade);
        const justTraded = lastTradeId === trade.id;
        const isBuy = trade.id.startsWith('buy');

        return (
          <View
            key={trade.id}
            style={[
              styles.tradeCard,
              justTraded && styles.tradeCardSuccess,
              !affordable && styles.tradeCardDisabled,
            ]}
          >
            <View style={styles.tradeContent}>
              <Text style={styles.tradeName}>{trade.label}</Text>
              <Text style={styles.tradeDesc}>{trade.description}</Text>
              <View style={styles.tradeCostRow}>
                <Text style={styles.tradeCost}>
                  {isBuy ? 'COST' : 'SPEND'}: {trade.costAmount}{' '}
                  {trade.costType === 'money' ? 'rub' : trade.costType}
                </Text>
                <Text style={styles.tradeGain}>
                  {isBuy ? 'RECEIVE' : 'GAIN'}: +{trade.gainAmount}{' '}
                  {trade.gainType === 'money' ? 'rub' : trade.gainType}
                </Text>
              </View>
              {/* Per-transaction KGB risk indicator */}
              <View style={styles.tradeRiskRow}>
                <Text style={styles.tradeRiskIcon}>{'\u2620'}</Text>
                <Text style={[styles.tradeRiskText, { color: riskConfig.color }]}>
                  KGB RISK: {riskConfig.label}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => handleTrade(trade)}
              disabled={!affordable}
              style={[styles.tradeBtn, !affordable && styles.tradeBtnDisabled]}
              activeOpacity={0.7}
            >
              <Text style={[styles.tradeBtnText, !affordable && styles.tradeBtnTextDisabled]}>
                {justTraded ? 'DONE' : trade.actionLabel}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}

      <Divider />

      {/* ── MARKET GOSSIP ──────────────────────────────────────── */}
      <SectionHeader title="MARKET GOSSIP" />

      <View style={styles.gossipBox}>
        <Text style={styles.gossipQuote}>{`"${gossip}"`}</Text>
        <Text style={styles.gossipAttribution}>
          -- overheard at the communal kitchen, {snap.year}
        </Text>
      </View>

      {/* Footer disclaimer */}
      <Text style={styles.footer}>
        The Soviet state does not acknowledge the existence of this exchange.
        {'\n'}All transactions are your personal responsibility, comrade.
      </Text>
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

  // ── Stockpile ──────────────────────────────────────────────────────────
  stockpileRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
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

  // ── Exchange Rates ─────────────────────────────────────────────────────
  exchangeRateBox: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#444',
    padding: 10,
    marginTop: 4,
  },
  exchangeRateTitle: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 1,
    marginBottom: 6,
    textAlign: 'center',
  },
  rateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  rateLabel: {
    fontSize: 10,
    fontFamily: monoFont,
    color: Colors.textSecondary,
  },
  rateValue: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.termGreen,
  },

  // ── KGB Risk Meter ─────────────────────────────────────────────────────
  riskMeterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  riskMeterLabel: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#9e9e9e',
    letterSpacing: 1,
  },
  riskMeterTrack: {
    flexDirection: 'row',
    gap: 3,
    flex: 1,
  },
  riskSegment: {
    flex: 1,
    height: 12,
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#555',
  },
  riskLevelText: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 1,
    minWidth: 80,
    textAlign: 'right',
  },

  // ── Trade Cards ────────────────────────────────────────────────────────
  tradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#444',
    padding: 10,
    marginBottom: 8,
  },
  tradeCardSuccess: {
    borderColor: Colors.termGreen,
  },
  tradeCardDisabled: {
    opacity: 0.5,
  },
  tradeContent: {
    flex: 1,
    marginRight: 10,
  },
  tradeName: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    letterSpacing: 1,
  },
  tradeDesc: {
    fontSize: 9,
    fontFamily: monoFont,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 2,
    lineHeight: 13,
  },
  tradeCostRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  tradeCost: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietRed,
  },
  tradeGain: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.termGreen,
  },
  tradeRiskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  tradeRiskIcon: {
    fontSize: 10,
    color: Colors.sovietRed,
  },
  tradeRiskText: {
    fontSize: 8,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  tradeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderColor: Colors.sovietDarkRed,
    backgroundColor: 'rgba(198, 40, 40, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tradeBtnDisabled: {
    borderColor: '#333',
    backgroundColor: '#222',
  },
  tradeBtnText: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 1,
  },
  tradeBtnTextDisabled: {
    color: '#555',
  },

  // ── Gossip ─────────────────────────────────────────────────────────────
  gossipBox: {
    backgroundColor: '#111',
    borderLeftWidth: 3,
    borderLeftColor: Colors.sovietGold,
    padding: 10,
    marginBottom: 8,
  },
  gossipQuote: {
    fontSize: 10,
    fontFamily: monoFont,
    color: '#aaa',
    fontStyle: 'italic',
    lineHeight: 16,
  },
  gossipAttribution: {
    fontSize: 8,
    fontFamily: monoFont,
    color: '#555',
    marginTop: 6,
    textAlign: 'right',
  },

  // ── Footer ─────────────────────────────────────────────────────────────
  footer: {
    fontSize: 8,
    fontFamily: monoFont,
    color: '#444',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 12,
  },
});
