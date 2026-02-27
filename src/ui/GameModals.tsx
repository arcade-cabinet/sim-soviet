/**
 * GameModals — All in-game modal overlays for the 3D version.
 *
 * Renders modals for: EraTransition, Minigame, AnnualReport,
 * SettlementUpgrade, FiveYearPlan, GameOver.
 *
 * State is managed by App.web.tsx and passed down as props.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SovietModal } from './SovietModal';
import { Colors, monoFont } from './styles';
import type { AnnualReportData, ReportSubmission } from '../components/ui/AnnualReportModal';
import type { EraDefinition } from '../game/era';
import type { ActiveMinigame } from '../game/minigames/MinigameTypes';
import type { SettlementEvent } from '../game/SettlementSystem';
import type { TallyData } from '../game/GameTally';
import { getTimelineEvent } from '../content/worldbuilding/timeline';

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

  const timelineEvent = getTimelineEvent(era.startYear);

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
      {timelineEvent && (
        <View style={modalStyles.timelineSection}>
          <Text style={modalStyles.timelineHeadline}>
            PRAVDA ARCHIVES: {timelineEvent.headline}
          </Text>
          <Text style={modalStyles.terminalBody}>{timelineEvent.description}</Text>
          <Text style={modalStyles.classifiedNote}>
            [CLASSIFIED] {timelineEvent.classified}
          </Text>
        </View>
      )}
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
        {def.choices.map((choice) => {
          const pct = Math.round(choice.successChance * 100);
          const riskTier = pct >= 70 ? 0 : pct >= 40 ? 1 : 2;
          const riskColors = [Colors.termGreen, Colors.sovietGold, Colors.sovietRed];
          const riskLabels = ['FAVORABLE', 'UNCERTAIN', 'RISKY'];
          return (
            <TouchableOpacity
              key={choice.id}
              style={[modalStyles.choiceButton, { borderLeftWidth: 3, borderLeftColor: riskColors[riskTier] }]}
              activeOpacity={0.7}
              onPress={() => {
                onChoice(choice.id);
                onClose();
              }}
            >
              <View style={modalStyles.choiceHeader}>
                <Text style={modalStyles.choiceLabel}>{choice.label}</Text>
                <Text style={[modalStyles.choiceRisk, { color: riskColors[riskTier] }]}>
                  {pct}% {riskLabels[riskTier]}
                </Text>
              </View>
              <Text style={modalStyles.choiceDesc}>{choice.description}</Text>
            </TouchableOpacity>
          );
        })}
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

  return <AnnualReportInner data={data} onSubmit={onSubmit} />;
};

const AnnualReportInner: React.FC<{
  data: AnnualReportData;
  onSubmit: (submission: ReportSubmission) => void;
}> = ({ data, onSubmit }) => {
  const [inflation, setInflation] = useState(0);

  const reportedQuota = Math.floor(data.quotaCurrent * (1 + inflation / 100));
  const met = reportedQuota >= data.quotaTarget;
  const isFalsified = inflation > 0;
  const riskLevel = inflation <= 0 ? 0 : inflation <= 15 ? 1 : inflation <= 30 ? 2 : 3;

  const RISK_LABELS = ['NONE', 'LOW', 'MODERATE', 'HIGH'];
  const RISK_COLORS = [Colors.termGreen, Colors.sovietGold, '#ff9800', Colors.sovietRed];

  return (
    <SovietModal
      visible
      variant="parchment"
      title={`ANNUAL REPORT ${data.year}`}
      stampText={met ? 'MET' : 'MISSED'}
      actionLabel={isFalsified ? 'SUBMIT ADJUSTED REPORT' : 'SUBMIT HONEST REPORT'}
      onAction={() =>
        onSubmit({
          reportedQuota,
          reportedSecondary: data.actualFood,
          reportedPop: data.actualPop,
        })
      }
    >
      <Text style={modalStyles.parchmentHeading}>Production Summary</Text>
      <View style={modalStyles.statRow}>
        <Text style={modalStyles.statLabel}>Quota ({data.quotaType}):</Text>
        <Text style={[modalStyles.statValue, met ? modalStyles.statGood : modalStyles.statBad]}>
          {reportedQuota} / {data.quotaTarget}
        </Text>
      </View>
      {isFalsified && (
        <View style={modalStyles.statRow}>
          <Text style={[modalStyles.statLabel, { fontStyle: 'italic' }]}>Actual:</Text>
          <Text style={[modalStyles.statLabel, { fontStyle: 'italic' }]}>
            {Math.floor(data.quotaCurrent)}
          </Text>
        </View>
      )}
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

      <View style={modalStyles.pripiski}>
        <Text style={modalStyles.pripiskiLabel}>
          PRIPISKI (Report Adjustment): {inflation > 0 ? `+${inflation}%` : 'HONEST'}
        </Text>
        <View style={modalStyles.pripiskiButtons}>
          {[0, 10, 20, 30, 50].map((pct) => (
            <TouchableOpacity
              key={pct}
              style={[
                modalStyles.pripiskiBtn,
                inflation === pct && modalStyles.pripiskiBtnActive,
              ]}
              onPress={() => setInflation(pct)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  modalStyles.pripiskiBtnText,
                  inflation === pct && modalStyles.pripiskiBtnTextActive,
                ]}
              >
                {pct === 0 ? 'HONEST' : `+${pct}%`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {inflation > 0 && (
          <View style={modalStyles.riskRow}>
            <Text style={modalStyles.statLabel}>KGB Detection Risk:</Text>
            <Text style={[modalStyles.statValue, { color: RISK_COLORS[riskLevel] }]}>
              {RISK_LABELS[riskLevel]}
            </Text>
          </View>
        )}
      </View>

      <Text style={modalStyles.parchmentNote}>
        {isFalsified
          ? '\u2620 Falsification of reports (pripiski) carries risk of KGB investigation and black marks.'
          : met
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

const TIER_TITLES: Record<string, string> = {
  selo: 'Chairman of the Collective',
  posyolok: 'Settlement Director',
  pgt: 'Urban Administrator',
  gorod: 'City Soviet Chairman',
};

const TIER_CEREMONY: Record<string, string> = {
  posyolok:
    'A modest ceremony is held. The attending brass band consists of one tuba player. He is also the mayor\'s cousin. Attendance was mandatory.',
  pgt:
    'The Presidium sends a telegraph of congratulation. The telegraph operator adds "good luck" in pencil. This is the most sincere communication you will receive from Moscow.',
  gorod:
    'A delegation from the Central Committee arrives for the declaration. They inspect everything. They approve of nothing. They sign the papers anyway. The ink is still wet as they leave.',
};

const SettlementUpgradeContent: React.FC<{
  event: SettlementEvent | null;
  onClose: () => void;
}> = ({ event, onClose }) => {
  if (!event || event.type !== 'upgrade') return null;

  const newTitle = TIER_TITLES[event.toTier];
  const ceremony = TIER_CEREMONY[event.toTier];

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
      {newTitle && (
        <Text style={modalStyles.parchmentBody}>
          Your title is now: <Text style={modalStyles.parchmentBold}>{newTitle}</Text>
        </Text>
      )}
      <Text style={modalStyles.parchmentBody}>{event.description}</Text>
      {ceremony && (
        <Text style={[modalStyles.parchmentBody, { fontStyle: 'italic', opacity: 0.8 }]}>
          {ceremony}
        </Text>
      )}
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

const TIER_FULL_LABELS: Record<string, string> = {
  selo: 'Village (Selo)',
  posyolok: 'Settlement (Posyolok)',
  pgt: 'Urban Settlement (PGT)',
  gorod: 'City (Gorod)',
};

const GameOverContent: React.FC<{
  gameOver: GameOverInfo | null;
  tally: TallyData | null;
  onRestart: () => void;
}> = ({ gameOver, tally, onRestart }) => {
  if (!gameOver) return null;

  const isVictory = gameOver.victory;
  const textStyle = isVictory ? modalStyles.parchmentBody : modalStyles.terminalBody;
  const headingStyle = isVictory ? modalStyles.parchmentHeading : modalStyles.terminalHeading;

  return (
    <SovietModal
      visible
      variant={isVictory ? 'parchment' : 'terminal'}
      title={tally?.verdict.title ?? (isVictory ? 'ORDER OF LENIN AWARDED' : 'KGB NOTICE')}
      stampText={isVictory ? 'VICTORY' : 'DEFEAT'}
      actionLabel="NEW GAME"
      onAction={onRestart}
    >
      <Text style={textStyle}>{gameOver.reason}</Text>
      {tally && (
        <>
          <Text style={[textStyle, { fontStyle: 'italic', opacity: 0.8, marginBottom: 12 }]}>
            {tally.verdict.summary}
          </Text>

          <Text style={headingStyle}>Final Score</Text>
          <View style={modalStyles.statRow}>
            <Text style={modalStyles.statLabel}>Score:</Text>
            <Text style={[modalStyles.statValue, modalStyles.statBold]}>
              {tally.finalScore}
            </Text>
          </View>
          <View style={modalStyles.statRow}>
            <Text style={modalStyles.statLabel}>Difficulty:</Text>
            <Text style={modalStyles.statValue}>
              {tally.difficulty.toUpperCase()} x {tally.consequence.toUpperCase()}
            </Text>
          </View>
          <View style={modalStyles.statRow}>
            <Text style={modalStyles.statLabel}>Multiplier:</Text>
            <Text style={modalStyles.statValue}>
              x{tally.scoreBreakdown.settingsMultiplier.toFixed(1)}
            </Text>
          </View>

          <Text style={headingStyle}>Statistics</Text>
          <View style={modalStyles.statRow}>
            <Text style={modalStyles.statLabel}>Years survived:</Text>
            <Text style={modalStyles.statValue}>{tally.statistics.yearsPlayed}</Text>
          </View>
          <View style={modalStyles.statRow}>
            <Text style={modalStyles.statLabel}>Year reached:</Text>
            <Text style={modalStyles.statValue}>{tally.statistics.yearReached}</Text>
          </View>
          <View style={modalStyles.statRow}>
            <Text style={modalStyles.statLabel}>Settlement tier:</Text>
            <Text style={modalStyles.statValue}>
              {TIER_FULL_LABELS[tally.statistics.settlementTier] ?? tally.statistics.settlementTier}
            </Text>
          </View>
          <View style={modalStyles.statRow}>
            <Text style={modalStyles.statLabel}>Peak population:</Text>
            <Text style={modalStyles.statValue}>{tally.statistics.peakPopulation}</Text>
          </View>
          <View style={modalStyles.statRow}>
            <Text style={modalStyles.statLabel}>Buildings placed:</Text>
            <Text style={modalStyles.statValue}>{tally.statistics.buildingsPlaced}</Text>
          </View>
          <View style={modalStyles.statRow}>
            <Text style={modalStyles.statLabel}>Collapses:</Text>
            <Text style={modalStyles.statValue}>{tally.statistics.buildingCollapses}</Text>
          </View>
          <View style={modalStyles.statRow}>
            <Text style={modalStyles.statLabel}>Quotas met / missed:</Text>
            <Text style={modalStyles.statValue}>
              {tally.statistics.quotasMet} / {tally.statistics.quotasMissed}
            </Text>
          </View>
          <View style={modalStyles.statRow}>
            <Text style={modalStyles.statLabel}>Eras completed:</Text>
            <Text style={modalStyles.statValue}>{tally.statistics.erasCompleted}</Text>
          </View>
          <View style={modalStyles.statRow}>
            <Text style={modalStyles.statLabel}>Black marks / Commendations:</Text>
            <Text style={modalStyles.statValue}>
              {tally.statistics.blackMarks}\u2620 / {tally.statistics.commendations}\u2605
            </Text>
          </View>

          {tally.medals.length > 0 && (
            <View style={modalStyles.medalSection}>
              <Text style={headingStyle}>Medals Awarded</Text>
              {tally.medals.map((medal) => (
                <View key={medal.id} style={modalStyles.medalRow}>
                  <Text style={[textStyle, { fontWeight: 'bold' }]}>
                    {'\u2605'} {medal.name}
                  </Text>
                  <Text style={[textStyle, { fontSize: 11, opacity: 0.8 }]}>
                    {medal.description}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {tally.achievements.length > 0 && (
            <View style={modalStyles.medalSection}>
              <Text style={headingStyle}>
                Achievements ({tally.achievementsUnlocked}/{tally.achievementsTotal})
              </Text>
              {tally.achievements.filter((a) => a.unlocked).map((a) => (
                <View key={a.id} style={modalStyles.medalRow}>
                  <Text style={[textStyle, { fontWeight: 'bold' }]}>
                    {'\u2605'} {a.name}
                  </Text>
                  <Text style={[textStyle, { fontSize: 11, opacity: 0.7 }]}>{a.subtext}</Text>
                </View>
              ))}
            </View>
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
  choiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  choiceLabel: {
    fontSize: 14,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
  },
  choiceRisk: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 1,
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
  medalRow: {
    marginBottom: 8,
  },

  // Timeline (era transitions)
  timelineSection: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#444',
  },
  timelineHeadline: {
    fontSize: 12,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 2,
    marginBottom: 6,
  },
  classifiedNote: {
    fontSize: 11,
    fontFamily: monoFont,
    fontStyle: 'italic',
    color: '#666',
    marginTop: 4,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: Colors.sovietRed,
  },

  // Pripiski (annual report falsification)
  pripiski: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#bbb',
  },
  pripiskiLabel: {
    fontSize: 12,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#37474f',
    letterSpacing: 1,
    marginBottom: 8,
  },
  pripiskiButtons: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  pripiskiBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#90a4ae',
    backgroundColor: '#eceff1',
  },
  pripiskiBtnActive: {
    backgroundColor: Colors.sovietRed,
    borderColor: Colors.sovietDarkRed,
  },
  pripiskiBtnText: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#546e7a',
  },
  pripiskiBtnTextActive: {
    color: Colors.white,
  },
  riskRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    marginTop: 4,
  },
});
