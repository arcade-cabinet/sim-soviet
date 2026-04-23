/**
 * CentralCommitteeTab — Directive decrees with lock-in timers + Moscow promotion notice.
 *
 * Lists available directives styled as Soviet decrees. Each directive has a
 * name, description, political capital cost, and lock-in period. Only one
 * directive can be active at a time; a new directive cannot be issued until
 * the current one's lock-in expires.
 *
 * When Moscow notices the player's competence (promotion notification active),
 * a PROMOTION NOTICE section appears at the top with accept/delay/bribe options.
 */

import type React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { MoscowPromotionState, PromotionResponse } from '../../ai/agents/political/moscowPromotion';
import { Colors, monoFont } from '../styles';

// ── Types ───────────────────────────────────────────────────────────────────

/** A single effect description for a directive. */
export interface DirectiveEffect {
  label: string;
  value: string;
}

/** A directive decree that the chairman can issue. */
export interface Directive {
  id: string;
  name: string;
  description: string;
  effects: DirectiveEffect[];
  costPoliticalCapital: number;
  lockInTicks: number;
}

/** Tracks the currently active directive and its timing. */
export interface ActiveDirective {
  directiveId: string;
  issuedAtTick: number;
  lockInTicks: number;
}

/** Props for the promotion notice section. */
export interface PromotionNoticeProps {
  promotionState: MoscowPromotionState;
  onRespond: (response: PromotionResponse) => void;
}

/** Props for the CentralCommitteeTab component. */
export interface CentralCommitteeTabProps {
  directives: Directive[];
  activeDirective: ActiveDirective | null;
  onIssueDirective: (directiveId: string) => void;
  currentTick?: number;
  politicalCapital?: number;
  /** Moscow promotion state — when notificationActive, the promotion notice is shown. */
  promotionState?: MoscowPromotionState | null;
  /** Callback when player responds to a promotion notification. */
  onPromotionRespond?: (response: PromotionResponse) => void;
}

// ── Data ────────────────────────────────────────────────────────────────────

/** The 5 Central Committee directives available to the chairman. */
export const CENTRAL_COMMITTEE_DIRECTIVES: Directive[] = [
  {
    id: 'increase_production',
    name: 'Increase Production Quota',
    description:
      'By decree of the Central Committee, all production quotas are raised by 20%. Workers shall fulfill their patriotic duty.',
    effects: [
      { label: 'Production', value: '+20%' },
      { label: 'Morale', value: '-10' },
    ],
    costPoliticalCapital: 0,
    lockInTicks: 24,
  },
  {
    id: 'labor_holiday',
    name: 'Declare Labor Holiday',
    description: 'The Central Committee grants the collective one tick of rest in celebration of Soviet achievements.',
    effects: [
      { label: 'Morale', value: '+15' },
      { label: 'Production', value: '-1 tick' },
    ],
    costPoliticalCapital: 0,
    lockInTicks: 12,
  },
  {
    id: 'emergency_rations',
    name: 'Emergency Rations',
    description: 'Strategic reserves are to be distributed immediately to prevent starvation among the working masses.',
    effects: [{ label: 'Action', value: 'Distribute reserves' }],
    costPoliticalCapital: 0,
    lockInTicks: 6,
  },
  {
    id: 'mandatory_overtime',
    name: 'Mandatory Overtime',
    description:
      'All workers are required to extend their shifts for the glory of the Soviet state. Production must not falter.',
    effects: [
      { label: 'Production', value: '+30%' },
      { label: 'Morale', value: '-20' },
    ],
    costPoliticalCapital: 0,
    lockInTicks: 36,
  },
  {
    id: 'patriotic_campaign',
    name: 'Patriotic Campaign',
    description:
      'A propaganda campaign to remind citizens of their duty to the motherland. Costs significant political capital.',
    effects: [
      { label: 'Loyalty', value: '+10' },
      { label: 'Cost', value: '50 political capital' },
    ],
    costPoliticalCapital: 50,
    lockInTicks: 18,
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Find a directive by its ID. */
export function getDirectiveById(id: string): Directive | undefined {
  return CENTRAL_COMMITTEE_DIRECTIVES.find((d) => d.id === id);
}

/** Whether a new directive can be issued given the current state. */
export function canIssueDirective(active: ActiveDirective | null, currentTick: number): boolean {
  if (!active) return true;
  return currentTick >= active.issuedAtTick + active.lockInTicks;
}

/** Ticks remaining on the active directive's lock-in, or 0 if expired/none. */
export function getRemainingLockIn(active: ActiveDirective | null, currentTick: number): number {
  if (!active) return 0;
  const remaining = active.issuedAtTick + active.lockInTicks - currentTick;
  return Math.max(0, remaining);
}

// ── Promotion helpers ────────────────────────────────────────────────────────

/** Classify promotion risk into a display tier. */
export function getPromotionRiskLevel(risk: number): 'low' | 'medium' | 'high' {
  if (risk >= 0.7) return 'high';
  if (risk >= 0.4) return 'medium';
  return 'low';
}

const RISK_COLORS: Record<'low' | 'medium' | 'high', string> = {
  low: Colors.termGreen,
  medium: Colors.sovietGold,
  high: Colors.sovietRed,
};

const RISK_LABELS: Record<'low' | 'medium' | 'high', string> = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
};

// ── Component ───────────────────────────────────────────────────────────────

export const CentralCommitteeTab: React.FC<CentralCommitteeTabProps> = ({
  directives,
  activeDirective,
  onIssueDirective,
  currentTick = 0,
  politicalCapital = 0,
  promotionState,
  onPromotionRespond,
}) => {
  const locked = !canIssueDirective(activeDirective, currentTick);
  const remaining = getRemainingLockIn(activeDirective, currentTick);

  return (
    <ScrollView style={tabStyles.container}>
      <Text style={tabStyles.header}>DECREES OF THE CENTRAL COMMITTEE</Text>

      {/* ── PROMOTION NOTICE ─────────────────────────────────────── */}
      {promotionState?.notificationActive && onPromotionRespond && (
        <View style={promoStyles.container} testID="promotion-notice">
          <Text style={promoStyles.title}>PROMOTION NOTICE</Text>
          <Text style={promoStyles.body}>
            Moscow has noted your competence. The Central Committee recommends expanded responsibilities.
          </Text>

          {/* Risk meter */}
          <View style={promoStyles.riskRow}>
            <Text style={promoStyles.riskLabel}>RISK ASSESSMENT:</Text>
            <Text
              style={[promoStyles.riskValue, { color: RISK_COLORS[getPromotionRiskLevel(promotionState.currentRisk)] }]}
            >
              {RISK_LABELS[getPromotionRiskLevel(promotionState.currentRisk)]}
            </Text>
            <View style={promoStyles.riskBarBg}>
              <View
                style={[
                  promoStyles.riskBarFill,
                  {
                    width: `${Math.round(promotionState.currentRisk * 100)}%`,
                    backgroundColor: RISK_COLORS[getPromotionRiskLevel(promotionState.currentRisk)],
                  },
                ]}
              />
            </View>
          </View>

          {promotionState.delayCount > 0 && (
            <Text style={promoStyles.delayWarning}>
              Moscow has noted {promotionState.delayCount} previous delay{promotionState.delayCount > 1 ? 's' : ''}.
              Patience is not unlimited.
            </Text>
          )}

          {/* Action buttons */}
          <View style={promoStyles.buttonRow}>
            <Pressable
              style={promoStyles.acceptBtn}
              onPress={() => onPromotionRespond('accept')}
              testID="promotion-accept"
              accessibilityRole="button"
              accessibilityLabel="Accept promotion assignment"
            >
              <Text style={promoStyles.btnText}>ACCEPT ASSIGNMENT</Text>
            </Pressable>

            <Pressable
              style={promoStyles.delayBtn}
              onPress={() => onPromotionRespond('delay')}
              testID="promotion-delay"
              accessibilityRole="button"
              accessibilityLabel="Negotiate delay on promotion"
            >
              <Text style={promoStyles.btnText}>NEGOTIATE DELAY</Text>
            </Pressable>

            <Pressable
              style={promoStyles.bribeBtn}
              onPress={() => onPromotionRespond('bribe')}
              testID="promotion-bribe"
              accessibilityRole="button"
              accessibilityLabel="Arrange special consideration to avoid promotion"
            >
              <Text style={promoStyles.btnText}>ARRANGE CONSIDERATION</Text>
            </Pressable>
          </View>
        </View>
      )}

      {locked && activeDirective && (
        <View style={tabStyles.lockBanner}>
          <Text style={tabStyles.lockText}>DIRECTIVE IN EFFECT — {remaining} TICKS REMAINING</Text>
          <Text style={tabStyles.lockSubtext}>
            Active: {getDirectiveById(activeDirective.directiveId)?.name ?? activeDirective.directiveId}
          </Text>
        </View>
      )}

      {directives.map((directive) => {
        const isActive = activeDirective?.directiveId === directive.id && locked;
        const canAfford = politicalCapital >= directive.costPoliticalCapital;
        const disabled = locked || !canAfford;

        return (
          <View
            key={directive.id}
            style={[tabStyles.decree, isActive && tabStyles.decreeActive]}
            testID={`directive-${directive.id}`}
          >
            {/* Decree header with red stamp */}
            <View style={tabStyles.decreeHeader}>
              <Text style={tabStyles.decreeName}>{directive.name.toUpperCase()}</Text>
              {isActive && <Text style={tabStyles.stamp}>ACTIVE</Text>}
            </View>

            {/* Decree body */}
            <Text style={tabStyles.decreeText}>{directive.description}</Text>

            {/* Effects */}
            <View style={tabStyles.effectsRow}>
              {directive.effects.map((effect) => (
                <View key={effect.label} style={tabStyles.effectBadge}>
                  <Text style={tabStyles.effectLabel}>{effect.label}:</Text>
                  <Text style={tabStyles.effectValue}>{effect.value}</Text>
                </View>
              ))}
            </View>

            {/* Footer: cost + lock-in + issue button */}
            <View style={tabStyles.decreeFooter}>
              <Text style={tabStyles.lockInText}>Lock-in: {directive.lockInTicks} ticks</Text>
              {directive.costPoliticalCapital > 0 && (
                <Text style={tabStyles.costText}>Cost: {directive.costPoliticalCapital} PC</Text>
              )}
              <Pressable
                onPress={() => onIssueDirective(directive.id)}
                style={[tabStyles.issueBtn, disabled && tabStyles.issueBtnDisabled]}
                disabled={disabled}
                testID={`issue-${directive.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Issue directive: ${directive.name}`}
              >
                <Text style={[tabStyles.issueBtnText, disabled && tabStyles.issueBtnTextDisabled]}>
                  {isActive ? 'IN EFFECT' : 'ISSUE DECREE'}
                </Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
};

// ── Styles ──────────────────────────────────────────────────────────────────

const tabStyles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 8,
  },
  header: {
    fontFamily: monoFont,
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  lockBanner: {
    backgroundColor: Colors.sovietDarkRed,
    borderWidth: 1,
    borderColor: Colors.sovietRed,
    padding: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  lockText: {
    fontFamily: monoFont,
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 1,
  },
  lockSubtext: {
    fontFamily: monoFont,
    fontSize: 9,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  decree: {
    backgroundColor: '#3a3225',
    borderWidth: 1,
    borderColor: '#5a4a30',
    marginBottom: 10,
    padding: 10,
  },
  decreeActive: {
    borderColor: Colors.sovietRed,
    backgroundColor: '#3d2828',
  },
  decreeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  decreeName: {
    fontFamily: monoFont,
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    letterSpacing: 1,
    flex: 1,
  },
  stamp: {
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.sovietRed,
    borderWidth: 2,
    borderColor: Colors.sovietRed,
    paddingHorizontal: 6,
    paddingVertical: 2,
    transform: [{ rotate: '-5deg' }],
    letterSpacing: 1,
  },
  decreeText: {
    fontFamily: monoFont,
    fontSize: 10,
    color: Colors.textSecondary,
    lineHeight: 16,
    marginBottom: 8,
  },
  effectsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  effectBadge: {
    flexDirection: 'row',
    backgroundColor: '#2a2e33',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#444',
  },
  effectLabel: {
    fontFamily: monoFont,
    fontSize: 9,
    color: Colors.textMuted,
    marginRight: 4,
  },
  effectValue: {
    fontFamily: monoFont,
    fontSize: 9,
    fontWeight: 'bold',
    color: Colors.termGreen,
  },
  decreeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#444',
    paddingTop: 6,
  },
  lockInText: {
    fontFamily: monoFont,
    fontSize: 9,
    color: Colors.textMuted,
  },
  costText: {
    fontFamily: monoFont,
    fontSize: 9,
    color: Colors.sovietGold,
  },
  issueBtn: {
    backgroundColor: Colors.sovietRed,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.sovietDarkRed,
  },
  issueBtnDisabled: {
    backgroundColor: '#424242',
    borderColor: '#333',
  },
  issueBtnText: {
    fontFamily: monoFont,
    fontSize: 9,
    fontWeight: 'bold',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  issueBtnTextDisabled: {
    color: Colors.textMuted,
  },
});

// ── Promotion Notice Styles ─────────────────────────────────────────────────

const promoStyles = StyleSheet.create({
  container: {
    backgroundColor: '#2d3a2d',
    borderWidth: 2,
    borderColor: Colors.sovietGold,
    padding: 10,
    marginBottom: 12,
  },
  title: {
    fontFamily: monoFont,
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 6,
  },
  body: {
    fontFamily: monoFont,
    fontSize: 10,
    color: Colors.textSecondary,
    lineHeight: 16,
    marginBottom: 8,
  },
  riskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  riskLabel: {
    fontFamily: monoFont,
    fontSize: 9,
    color: Colors.textMuted,
  },
  riskValue: {
    fontFamily: monoFont,
    fontSize: 9,
    fontWeight: 'bold',
  },
  riskBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#555',
  },
  riskBarFill: {
    height: '100%',
  },
  delayWarning: {
    fontFamily: monoFont,
    fontSize: 9,
    color: Colors.sovietRed,
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 6,
  },
  acceptBtn: {
    flex: 1,
    backgroundColor: '#2e7d32',
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1b5e20',
  },
  delayBtn: {
    flex: 1,
    backgroundColor: '#f9a825',
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f57f17',
  },
  bribeBtn: {
    flex: 1,
    backgroundColor: Colors.sovietRed,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.sovietDarkRed,
  },
  btnText: {
    fontFamily: monoFont,
    fontSize: 8,
    fontWeight: 'bold',
    color: Colors.white,
    letterSpacing: 0.5,
  },
});
