/**
 * useSimCallbacks — Bridges SimulationEngine events to React state.
 *
 * Extracted from App.tsx to reduce file size. The returned `simCallbacks`
 * object is passed to <GameWorld> which forwards it to SimulationEngine.
 */
import type { Dispatch, SetStateAction } from 'react';
import { useRef } from 'react';
import type { AnnualReportData, ReportSubmission } from '@/components/ui/AnnualReportModal';
import type { PlanDirective } from '@/components/ui/FiveYearPlanModal';
import { getResourceEntity } from '@/ecs/archetypes';
import type { EraDefinition } from '@/game/era';
import type { TallyData } from '@/game/GameTally';
import type { ActiveMinigame } from '@/game/minigames/MinigameTypes';
import type { SettlementEvent } from '@/game/SettlementSystem';
import type { SimCallbacks } from '@/game/SimulationEngine';
import { addSovietToast } from '@/stores/toastStore';

interface Messages {
  advisor: string | null;
  pravda: string | null;
}

interface GameOverInfo {
  victory: boolean;
  reason: string;
}

interface UseSimCallbacksParams {
  setMessages: Dispatch<SetStateAction<Messages>>;
  setGameOver: Dispatch<SetStateAction<GameOverInfo | null>>;
  setSettlementEvent: Dispatch<SetStateAction<SettlementEvent | null>>;
  setPlanDirective: Dispatch<SetStateAction<PlanDirective | null>>;
  setAnnualReport: Dispatch<SetStateAction<AnnualReportData | null>>;
  setEraTransition: Dispatch<SetStateAction<EraDefinition | null>>;
  setActiveMinigame: Dispatch<SetStateAction<ActiveMinigame | null>>;
  setGameTally: Dispatch<SetStateAction<TallyData | null>>;
}

interface UseSimCallbacksReturn {
  simCallbacks: SimCallbacks;
  submitReportRef: React.RefObject<((submission: ReportSubmission) => void) | null>;
  resolveMinigameRef: React.RefObject<((choiceId: string) => void) | null>;
}

export type { Messages, GameOverInfo };

export function useSimCallbacks({
  setMessages,
  setGameOver,
  setSettlementEvent,
  setPlanDirective,
  setAnnualReport,
  setEraTransition,
  setActiveMinigame,
  setGameTally,
}: UseSimCallbacksParams): UseSimCallbacksReturn {
  const submitReportRef = useRef<((submission: ReportSubmission) => void) | null>(null);
  const resolveMinigameRef = useRef<((choiceId: string) => void) | null>(null);

  const simCallbacks: SimCallbacks = {
    onToast: (msg, severity) => addSovietToast(severity ?? 'warning', msg),
    onAdvisor: (msg) => setMessages((p) => ({ ...p, advisor: msg })),
    onPravda: (msg) => setMessages((p) => ({ ...p, pravda: msg })),
    onStateChange: () => {
      /* notifyStateChange() called in GameWorld */
    },
    onGameOver: (victory, reason) => setGameOver({ victory, reason }),
    onSettlementChange: (event) => setSettlementEvent(event),
    onNewPlan: (plan) => {
      const res = getResourceEntity();
      setPlanDirective({
        ...plan,
        currentFood: res?.resources.food ?? 0,
        currentVodka: res?.resources.vodka ?? 0,
        currentPop: res?.resources.population ?? 0,
        currentPower: res?.resources.power ?? 0,
        currentMoney: res?.resources.money ?? 0,
        mandates: plan.mandates,
      });
    },
    onAnnualReport: (data, submitFn) => {
      setAnnualReport(data);
      submitReportRef.current = submitFn;
    },
    onEraChanged: (era) => setEraTransition(era),
    onMinigame: (active, resolveChoice) => {
      setActiveMinigame(active);
      resolveMinigameRef.current = resolveChoice;
    },
    onTutorialMilestone: (_milestone) => {
      // Tutorial milestones already fire onAdvisor with Krupnik dialogue
      // in SimulationEngine.tickTutorial(). This callback is available
      // for future use (e.g. pausing simulation on milestone).
    },
    onAchievement: (name, description) => {
      addSovietToast('warning', `ACHIEVEMENT: ${name} -- ${description}`);
    },
    onGameTally: (tally) => setGameTally(tally),
  };

  return { simCallbacks, submitReportRef, resolveMinigameRef };
}
