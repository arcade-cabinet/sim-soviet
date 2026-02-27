/**
 * GameModals — All in-game modal overlays for the 3D version.
 *
 * Renders modals for: EraTransition, Minigame, AnnualReport,
 * SettlementUpgrade, FiveYearPlan, GameOver.
 *
 * State is managed by App.web.tsx and passed down as props.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SovietModal } from './SovietModal';
import { Colors, monoFont } from './styles';
import type { AnnualReportData, ReportSubmission } from '../components/ui/AnnualReportModal';
import type { EraDefinition } from '../game/era';
import type { ActiveMinigame } from '../game/minigames/MinigameTypes';
import type { SettlementEvent } from '../game/SettlementSystem';
import type { TallyData } from '../game/GameTally';

// ── Types ──

export interface PlanDirective {
  quotaType: 'food' | 'vodka';
  quotaTarget: number;
  startYear: number;
  endYear: number;
  mandates?: { defId: string; label: string; required: number; fulfilled: number }[];
}

export interface GameOverInfo {
  victory: boolean;
  reason: string;
}

export interface GameModalsProps {
  // Era transition
  eraTransition: EraDefinition | null;
  onDismissEra: () => void;

  // Minigame
  activeMinigame: ActiveMinigame | null;
  onMinigameChoice: (choiceId: string) => void;
  onDismissMinigame: () => void;

  // Annual report
  annualReport: AnnualReportData | null;
  onSubmitReport: (submission: ReportSubmission) => void;

  // Settlement upgrade
  settlementEvent: SettlementEvent | null;
  onDismissSettlement: () => void;

  // Five-year plan
  planDirective: PlanDirective | null;
  onAcceptPlan: () => void;

  // Game over
  gameOver: GameOverInfo | null;
  gameTally: TallyData | null;
  onRestart: () => void;
}

export const GameModals: React.FC<GameModalsProps> = ({
  eraTransition,
  onDismissEra,
  activeMinigame,
  onMinigameChoice,
  onDismissMinigame,
  annualReport,
  onSubmitReport,
  settlementEvent,
  onDismissSettlement,
  planDirective,
  onAcceptPlan,
  gameOver,
  gameTally,
  onRestart,
}) => {
  return (
    <>
      <EraTransitionContent era={eraTransition} onClose={onDismissEra} />
      <MinigameContent
        minigame={activeMinigame}
        onChoice={onMinigameChoice}
        onClose={onDismissMinigame}
      />
      <AnnualReportContent data={annualReport} onSubmit={onSubmitReport} />
      <SettlementUpgradeContent event={settlementEvent} onClose={onDismissSettlement} />
      <FiveYearPlanContent directive={planDirective} onAccept={onAcceptPlan} />
      <GameOverContent gameOver={gameOver} tally={gameTally} onRestart={onRestart} />
    </>
  );
};

// ── Era Transition Modal ──

const EraTransitionContent: React.FC<{
  era: EraDefinition | null;
  onClose: () => void;
}> = ({ era, onClose }) => {
  if (!era) return null;
  return (
    <SovietModal
      visible
      variant="terminal"
      title={era.name}
      stampText={`${era.startYear}-${era.endYear}`}
      actionLabel="ACKNOWLEDGED"
      onAction={onClose}
      dismissOnOverlay
      onDismiss={onClose}
    >
      <Text style={modalStyles.terminalHeading}>{era.introTitle}</Text>
      <Text style={modalStyles.terminalBody}>{era.introText}</Text>
      <Text style={modalStyles.terminalQuote}>
        {'\u201C'}
        {era.briefingFlavor}
        {'\u201D'}
      </Text>
    </SovietModal>
  );
};

// ── Minigame Modal ──

const MinigameContent: React.FC<{
  minigame: ActiveMinigame | null;
  onChoice: (choiceId: string) => void;
  onClose: () => void;
}> = ({ minigame, onChoice, onClose }) => {
  if (!minigame || minigame.resolved) return null;

  const def = minigame.definition;

  return (
    <SovietModal
      visible
      variant="terminal"
      title={def.name}
      stampText="EVENT"
      actionLabel="IGNORE (AUTO-RESOLVE)"
      onAction={() => {
        if (def.choices.length > 0) {
          onChoice(def.choices[0].id);
        }
        onClose();
      }}
    >
      <Text style={modalStyles.terminalBody}>{def.description}</Text>
      <View style={modalStyles.choiceList}>
        {def.choices.map((choice) => (
          <TouchableOpacity
            key={choice.id}
            style={modalStyles.choiceButton}
            activeOpacity={0.7}
            onPress={() => {
              onChoice(choice.id);
              onClose();
            }}
          >
            <Text style={modalStyles.choiceLabel}>{choice.label}</Text>
            <Text style={modalStyles.choiceDesc}>{choice.description}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SovietModal>
  );
};

// ── Annual Report Modal ──

const AnnualReportContent: React.FC<{
  data: AnnualReportData | null;
  onSubmit: (submission: ReportSubmission) => void;
}> = ({ data, onSubmit }) => {
  if (!data) return null;

  const met = data.quotaCurrent >= data.quotaTarget;

  return (
    <SovietModal
      visible
      variant="parchment"
      title={`ANNUAL REPORT ${data.year}`}
      stampText={met ? 'MET' : 'MISSED'}
      actionLabel="SUBMIT HONEST REPORT"
      onAction={() =>
        onSubmit({
          reportedQuota: data.quotaCurrent,
          reportedSecondary: data.actualFood,
          reportedPop: data.actualPop,
        })
      }
    >
      <Text style={modalStyles.parchmentHeading}>Production Summary</Text>
      <View style={modalStyles.statRow}>
        <Text style={modalStyles.statLabel}>Quota ({data.quotaType}):</Text>
        <Text style={[modalStyles.statValue, met ? modalStyles.statGood : modalStyles.statBad]}>
          {Math.floor(data.quotaCurrent)} / {data.quotaTarget}
        </Text>
      </View>
      <View style={modalStyles.statRow}>
        <Text style={modalStyles.statLabel}>Population:</Text>
        <Text style={modalStyles.statValue}>{data.actualPop}</Text>
      </View>
      <View style={modalStyles.statRow}>
        <Text style={modalStyles.statLabel}>Food reserves:</Text>
        <Text style={modalStyles.statValue}>{Math.floor(data.actualFood)}</Text>
      </View>
      <View style={modalStyles.statRow}>
        <Text style={modalStyles.statLabel}>Vodka reserves:</Text>
        <Text style={modalStyles.statValue}>{Math.floor(data.actualVodka)}</Text>
      </View>
      <Text style={modalStyles.parchmentNote}>
        {met
          ? '\u2605 The Party commends your adequate performance.'
          : '\u2620 Failure to meet quota has been noted in your personnel file.'}
      </Text>
    </SovietModal>
  );
};

// ── Settlement Upgrade Modal ──

const TIER_LABELS: Record<string, string> = {
  selo: 'Village (Selo)',
  posyolok: 'Settlement (Posyolok)',
  pgt: 'Urban Settlement (PGT)',
  gorod: 'City (Gorod)',
};

const SettlementUpgradeContent: React.FC<{
  event: SettlementEvent | null;
  onClose: () => void;
}> = ({ event, onClose }) => {
  if (!event || event.type !== 'upgrade') return null;
  return (
    <SovietModal
      visible
      variant="parchment"
      title="DECREE OF THE SUPREME SOVIET"
      stampText="APPROVED"
      actionLabel="LONG LIVE THE PARTY"
      onAction={onClose}
      dismissOnOverlay
      onDismiss={onClose}
    >
      <Text style={modalStyles.parchmentHeading}>Settlement Promotion</Text>
      <Text style={modalStyles.parchmentBody}>
        By decree of the Presidium of the Supreme Soviet, this settlement is hereby elevated from{' '}
        <Text style={modalStyles.parchmentBold}>
          {TIER_LABELS[event.fromTier] ?? event.fromTier}
        </Text>
        {' '}to{' '}
        <Text style={modalStyles.parchmentBold}>{TIER_LABELS[event.toTier] ?? event.toTier}</Text>.
      </Text>
      <Text style={modalStyles.parchmentBody}>{event.description}</Text>
      <Text style={modalStyles.parchmentNote}>
        {'\u2605'} New construction options may now be available.
      </Text>
    </SovietModal>
  );
};

// ── Five-Year Plan Modal ──

const FiveYearPlanContent: React.FC<{
  directive: PlanDirective | null;
  onAccept: () => void;
}> = ({ directive, onAccept }) => {
  if (!directive) return null;
  return (
    <SovietModal
      visible
      variant="parchment"
      title={'\u041F\u042F\u0422\u0418\u041B\u0415\u0422\u041D\u0418\u0419 \u041F\u041B\u0410\u041D'}
      stampText={`${directive.startYear}-${directive.endYear}`}
      actionLabel="REFUSAL IS NOT AN OPTION"
      onAction={onAccept}
    >
      <Text style={modalStyles.parchmentHeading}>Five-Year Plan Directive</Text>
      <Text style={modalStyles.parchmentBody}>
        Plan period: {directive.startYear}\u2013{directive.endYear}
      </Text>
      <View style={modalStyles.statRow}>
        <Text style={modalStyles.statLabel}>Primary quota ({directive.quotaType}):</Text>
        <Text style={[modalStyles.statValue, modalStyles.statBold]}>
          {directive.quotaTarget}
        </Text>
      </View>
      {directive.mandates && directive.mandates.length > 0 && (
        <View style={modalStyles.mandateSection}>
          <Text style={modalStyles.parchmentHeading}>Building Mandates</Text>
          {directive.mandates.map((m) => (
            <View key={m.defId} style={modalStyles.statRow}>
              <Text style={modalStyles.statLabel}>{m.label}:</Text>
              <Text style={modalStyles.statValue}>
                {m.fulfilled}/{m.required}
              </Text>
            </View>
          ))}
        </View>
      )}
      <Text style={modalStyles.parchmentNote}>
        {'\u2605'} The Party expects full compliance. Glory to the workers!
      </Text>
    </SovietModal>
  );
};

// ── Game Over Modal ──

const GameOverContent: React.FC<{
  gameOver: GameOverInfo | null;
  tally: TallyData | null;
  onRestart: () => void;
}> = ({ gameOver, tally, onRestart }) => {
  if (!gameOver) return null;
  return (
    <SovietModal
      visible
      variant={gameOver.victory ? 'parchment' : 'terminal'}
      title={gameOver.victory ? 'ORDER OF LENIN AWARDED' : 'KGB NOTICE'}
      stampText={gameOver.victory ? 'VICTORY' : 'DEFEAT'}
      actionLabel="NEW GAME"
      onAction={onRestart}
    >
      <Text
        style={gameOver.victory ? modalStyles.parchmentBody : modalStyles.terminalBody}
      >
        {gameOver.reason}
      </Text>
      {tally && (
        <>
          <View style={modalStyles.statRow}>
            <Text style={modalStyles.statLabel}>Final Score:</Text>
            <Text style={[modalStyles.statValue, modalStyles.statBold]}>
              {tally.finalScore}
            </Text>
          </View>
          {tally.medals.length > 0 && (
            <View style={modalStyles.medalSection}>
              <Text
                style={
                  gameOver.victory ? modalStyles.parchmentHeading : modalStyles.terminalHeading
                }
              >
                Medals Awarded
              </Text>
              {tally.medals.map((medal) => (
                <Text
                  key={medal.id}
                  style={
                    gameOver.victory ? modalStyles.parchmentBody : modalStyles.terminalBody
                  }
                >
                  {'\u2605'} {medal.name} — {medal.description}
                </Text>
              ))}
            </View>
          )}
          {tally.achievements.length > 0 && (
            <Text
              style={gameOver.victory ? modalStyles.parchmentNote : modalStyles.terminalBody}
            >
              Achievements: {tally.achievementsUnlocked}/{tally.achievementsTotal}
            </Text>
          )}
        </>
      )}
    </SovietModal>
  );
};

// ── Shared modal content styles ──

const modalStyles = StyleSheet.create({
  // Terminal (dark) variant
  terminalHeading: {
    fontSize: 16,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    marginBottom: 8,
    letterSpacing: 1,
  },
  terminalBody: {
    fontSize: 13,
    fontFamily: monoFont,
    color: '#b0bec5',
    lineHeight: 20,
    marginBottom: 12,
  },
  terminalQuote: {
    fontSize: 13,
    fontFamily: monoFont,
    fontStyle: 'italic',
    color: '#78909c',
    lineHeight: 20,
    marginBottom: 12,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: Colors.sovietGold,
  },

  // Parchment (light) variant
  parchmentHeading: {
    fontSize: 15,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#263238',
    marginBottom: 8,
    letterSpacing: 1,
  },
  parchmentBody: {
    fontSize: 13,
    fontFamily: monoFont,
    color: '#37474f',
    lineHeight: 20,
    marginBottom: 12,
  },
  parchmentBold: {
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  parchmentNote: {
    fontSize: 12,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#455a64',
    marginTop: 8,
    marginBottom: 4,
  },

  // Stat rows (shared)
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    fontFamily: monoFont,
    color: '#546e7a',
  },
  statValue: {
    fontSize: 13,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#263238',
  },
  statGood: {
    color: '#2e7d32',
  },
  statBad: {
    color: Colors.sovietRed,
  },
  statBold: {
    fontSize: 16,
    color: Colors.sovietGold,
  },

  // Choice buttons (minigame)
  choiceList: {
    marginTop: 8,
    gap: 8,
  },
  choiceButton: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
    padding: 12,
  },
  choiceLabel: {
    fontSize: 14,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    marginBottom: 4,
  },
  choiceDesc: {
    fontSize: 12,
    fontFamily: monoFont,
    color: '#90a4ae',
    lineHeight: 18,
  },

  // Sections
  mandateSection: {
    marginTop: 12,
  },
  medalSection: {
    marginTop: 12,
    marginBottom: 8,
  },
});
