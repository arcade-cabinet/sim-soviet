/**
 * GameModals — All in-game modal overlays extracted from App.tsx.
 *
 * Renders AnimatePresence blocks for: EraTransition, Minigame,
 * GameTally, SettlementUpgrade, FiveYearPlan, AnnualReport, GameOver.
 */

import type { GameOverInfo } from '@app/hooks/useSimCallbacks';
import { AnimatePresence } from 'framer-motion';
import type { Dispatch, SetStateAction } from 'react';
import type { AnnualReportData, ReportSubmission } from '@/components/ui/AnnualReportModal';
import { AnnualReportModal } from '@/components/ui/AnnualReportModal';
import { EraTransitionModal } from '@/components/ui/EraTransitionModal';
import type { PlanDirective } from '@/components/ui/FiveYearPlanModal';
import { FiveYearPlanModal } from '@/components/ui/FiveYearPlanModal';
import { GameOverModal } from '@/components/ui/GameOverModal';
import { GameTallyScreen } from '@/components/ui/GameTallyScreen';
import { MinigameModal } from '@/components/ui/MinigameModal';
import { SettlementUpgradeModal } from '@/components/ui/SettlementUpgradeModal';
import type { EraDefinition } from '@/game/era';
import type { TallyData } from '@/game/GameTally';
import type { ActiveMinigame } from '@/game/minigames/MinigameTypes';
import type { SettlementEvent } from '@/game/SettlementSystem';

interface GameModalsProps {
  gameOver: GameOverInfo | null;
  onRestart: () => void;

  settlementEvent: SettlementEvent | null;
  setSettlementEvent: Dispatch<SetStateAction<SettlementEvent | null>>;

  annualReport: AnnualReportData | null;
  setAnnualReport: Dispatch<SetStateAction<AnnualReportData | null>>;
  submitReportRef: React.RefObject<((submission: ReportSubmission) => void) | null>;

  planDirective: PlanDirective | null;
  setPlanDirective: Dispatch<SetStateAction<PlanDirective | null>>;

  eraTransition: EraDefinition | null;
  setEraTransition: Dispatch<SetStateAction<EraDefinition | null>>;

  activeMinigame: ActiveMinigame | null;
  setActiveMinigame: Dispatch<SetStateAction<ActiveMinigame | null>>;
  resolveMinigameRef: React.RefObject<((choiceId: string) => void) | null>;

  gameTally: TallyData | null;
  setGameTally: Dispatch<SetStateAction<TallyData | null>>;
}

export function GameModals({
  gameOver,
  onRestart,
  settlementEvent,
  setSettlementEvent,
  annualReport,
  setAnnualReport,
  submitReportRef,
  planDirective,
  setPlanDirective,
  eraTransition,
  setEraTransition,
  activeMinigame,
  setActiveMinigame,
  resolveMinigameRef,
  gameTally,
  setGameTally,
}: GameModalsProps) {
  return (
    <>
      {/* Game over modal */}
      {gameOver && (
        <GameOverModal victory={gameOver.victory} reason={gameOver.reason} onRestart={onRestart} />
      )}

      {/* Settlement upgrade decree modal */}
      <AnimatePresence>
        {settlementEvent && settlementEvent.type === 'upgrade' && (
          <SettlementUpgradeModal
            fromTier={settlementEvent.fromTier}
            toTier={settlementEvent.toTier}
            onClose={() => setSettlementEvent(null)}
          />
        )}
      </AnimatePresence>

      {/* Annual Report (pripiski) modal — shown at quota deadline years */}
      {annualReport && (
        <AnnualReportModal
          data={annualReport}
          onSubmit={(submission) => {
            submitReportRef.current?.(submission);
            submitReportRef.current = null;
            setAnnualReport(null);
          }}
        />
      )}

      {/* Five-Year Plan directive modal */}
      {planDirective && (
        <FiveYearPlanModal directive={planDirective} onAccept={() => setPlanDirective(null)} />
      )}

      {/* Era transition briefing modal */}
      <AnimatePresence>
        {eraTransition && (
          <EraTransitionModal era={eraTransition} onClose={() => setEraTransition(null)} />
        )}
      </AnimatePresence>

      {/* Minigame choice modal */}
      <AnimatePresence>
        {activeMinigame && !activeMinigame.resolved && (
          <MinigameModal
            minigame={activeMinigame}
            onChoice={(choiceId) => {
              resolveMinigameRef.current?.(choiceId);
              resolveMinigameRef.current = null;
              setActiveMinigame(null);
            }}
            onClose={() => {
              setActiveMinigame(null);
              resolveMinigameRef.current = null;
            }}
          />
        )}
      </AnimatePresence>

      {/* End-game tally summary screen */}
      <AnimatePresence>
        {gameTally && <GameTallyScreen tally={gameTally} onClose={() => setGameTally(null)} />}
      </AnimatePresence>
    </>
  );
}
