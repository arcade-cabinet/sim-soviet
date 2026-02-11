/**
 * GameTallyScreen -- end-game summary modal showing score, stats,
 * medals, and achievements in Soviet dossier style.
 *
 * Features a multi-phase "medal ceremony" animation sequence:
 *   1. intro    -- "MINISTRY OF STATE AWARDS" header fades in
 *   2. reviewing -- "REVIEWING PERSONNEL FILE..." typewriter text
 *   3. stamp    -- verdict title slams down with scale/rotate bounce
 *   4. medals   -- each medal slides in from left with staggered spring
 *   5. stats    -- score counter + breakdown + statistics fade in
 *
 * Displayed when the SimulationEngine fires onGameTally on game over.
 */
import { AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TallyData } from '@/game/GameTally';
import type { Medal } from '@/game/ScoringSystem';

// ─────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────

type CeremonyPhase = 'intro' | 'reviewing' | 'stamp' | 'medals' | 'stats';

export interface GameTallyScreenProps {
  tally: TallyData;
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────

const MEDAL_TIER_ICONS: Record<Medal['tier'], string> = {
  tin: '\u2606', // white star
  copper: '\u2605', // black star
  bronze: '\u272A', // circled white star
  iron: '\u2720', // maltese cross
  concrete: '\u2742', // asterisk
};

const VT323_STYLE = { fontFamily: "'VT323', monospace" } as const;

const PHASE_TIMINGS: Record<CeremonyPhase, number> = {
  intro: 1500,
  reviewing: 1000,
  stamp: 800,
  medals: 0, // dynamic: depends on medal count
  stats: 0, // final phase, no auto-advance
};

// ─────────────────────────────────────────────────────────
//  SUB-COMPONENTS
// ─────────────────────────────────────────────────────────

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between items-baseline py-0.5">
      <span className="text-[#999] text-xs">{label}</span>
      <span className="text-[#cfaa48] text-sm font-bold">{value}</span>
    </div>
  );
}

/** Typewriter text that reveals characters one by one. */
function TypewriterText({
  text,
  durationMs = 600,
  onComplete,
}: {
  text: string;
  durationMs?: number;
  onComplete?: () => void;
}) {
  const [displayed, setDisplayed] = useState('');
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const chars = text.split('');
    const interval = durationMs / chars.length;
    let idx = 0;
    const timer = setInterval(() => {
      idx++;
      setDisplayed(text.slice(0, idx));
      if (idx >= chars.length) {
        clearInterval(timer);
        onCompleteRef.current?.();
      }
    }, interval);
    return () => clearInterval(timer);
  }, [text, durationMs]);

  return (
    <span>
      {displayed}
      <span className="animate-pulse">_</span>
    </span>
  );
}

/** Animated score counter that counts from 0 to target over a duration. */
function ScoreCounter({ target, durationMs = 2000 }: { target: number; durationMs?: number }) {
  const motionVal = useMotionValue(0);
  const rounded = useTransform(motionVal, (v) => Math.floor(v));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // Ease-out cubic for a satisfying ramp
      const eased = 1 - (1 - progress) ** 3;
      const current = Math.floor(eased * target);
      motionVal.set(current);
      setDisplay(current);
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      }
    }

    let rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target, durationMs, motionVal]);

  // Keep rounded in sync (used only for motion value consumers)
  void rounded;

  return <>{display.toLocaleString()}</>;
}

/** Single medal card with slide-in animation. */
function MedalCard({ medal, index }: { medal: Medal; index: number }) {
  const icon = MEDAL_TIER_ICONS[medal.tier] ?? '\u2605';

  return (
    <motion.div
      className="bg-[#2a2a2a] border border-[#444] p-3 flex items-start gap-3"
      initial={{ opacity: 0, x: -60 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        type: 'spring',
        stiffness: 200,
        damping: 18,
        delay: index * 0.3,
      }}
    >
      <div className="text-2xl text-[#cfaa48] flex-shrink-0 mt-0.5 select-none" aria-hidden="true">
        {icon}
      </div>
      <div>
        <div className="text-[#cfaa48] text-sm font-bold" style={VT323_STYLE}>
          {medal.name}
        </div>
        <div className="text-[#888] text-xs mt-0.5 leading-relaxed">{medal.description}</div>
        <div className="text-[#555] text-[10px] uppercase tracking-wider mt-1">
          Material: {medal.tier}
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────

export function GameTallyScreen({ tally, onClose }: GameTallyScreenProps) {
  const { verdict, statistics, medals, scoreBreakdown, finalScore } = tally;

  // ── Phase state machine ──────────────────────────────
  const [phase, setPhase] = useState<CeremonyPhase>('intro');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const advanceTo = useCallback((next: CeremonyPhase) => {
    setPhase(next);
  }, []);

  // Auto-advance through timed phases
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    const timing = PHASE_TIMINGS[phase];
    if (timing <= 0) return; // no auto-advance for medals/stats

    timerRef.current = setTimeout(() => {
      switch (phase) {
        case 'intro':
          advanceTo('reviewing');
          break;
        case 'reviewing':
          advanceTo('stamp');
          break;
        case 'stamp':
          advanceTo(medals.length > 0 ? 'medals' : 'stats');
          break;
        default:
          break;
      }
    }, timing);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [phase, advanceTo, medals.length]);

  // Auto-advance from medals to stats after all medals have animated in
  useEffect(() => {
    if (phase !== 'medals') return;
    const totalDelay = medals.length * 300 + 600; // stagger + settle
    const t = setTimeout(() => advanceTo('stats'), totalDelay);
    return () => clearTimeout(t);
  }, [phase, medals.length, advanceTo]);

  // Allow skipping the intro sequence by clicking/tapping
  const handleSkip = useCallback(() => {
    if (phase !== 'stats') {
      setPhase('stats');
    }
  }, [phase]);

  const phaseGte = (target: CeremonyPhase): boolean => {
    const order: CeremonyPhase[] = ['intro', 'reviewing', 'stamp', 'medals', 'stats'];
    return order.indexOf(phase) >= order.indexOf(target);
  };

  return (
    <>
      {/* Dark overlay */}
      <motion.div
        className="fixed inset-0 bg-black/80 z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="tally-heading"
          className="relative w-full max-w-lg bg-[#1a1a1a] border-2 border-[#8b0000] shadow-[0_0_40px_rgba(139,0,0,0.4)] max-h-[90vh] overflow-y-auto"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          onClick={handleSkip}
        >
          {/* Header — always visible */}
          <div className="bg-[#8b0000] border-b-2 border-[#660000] px-4 py-3 sticky top-0 z-10">
            <h1
              id="tally-heading"
              className="text-[#cfaa48] text-sm font-bold uppercase tracking-[0.15em] text-center"
              style={VT323_STYLE}
            >
              {verdict.victory ? 'Order of Lenin -- Final Report' : 'Personnel File -- Closed'}
            </h1>
          </div>

          <div className="px-5 py-5 space-y-5">
            {/* ── Phase 1: Ministry header ─────────────── */}
            <AnimatePresence>
              {phaseGte('intro') && (
                <motion.div
                  key="ministry-header"
                  className="text-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6 }}
                >
                  <div
                    className="text-[#666] text-[10px] uppercase tracking-[0.3em] mb-1"
                    style={VT323_STYLE}
                  >
                    Ministry of State Awards
                  </div>
                  <div
                    className="text-[#555] text-[9px] uppercase tracking-[0.2em]"
                    style={VT323_STYLE}
                  >
                    Department 7B -- Form 41-K (Revised)
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Phase 2: Reviewing personnel file ────── */}
            <AnimatePresence>
              {phaseGte('reviewing') && !phaseGte('stamp') && (
                <motion.div
                  key="reviewing"
                  className="text-center py-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="text-[#888] text-xs uppercase tracking-wider" style={VT323_STYLE}>
                    <TypewriterText text="REVIEWING PERSONNEL FILE..." durationMs={700} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Phase 3: Verdict stamp ───────────────── */}
            <AnimatePresence>
              {phaseGte('stamp') && (
                <motion.div
                  key="verdict-stamp"
                  className="text-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Stamp animation */}
                  <motion.div
                    className="text-xl font-bold uppercase tracking-wider mb-1"
                    style={{
                      ...VT323_STYLE,
                      color: verdict.victory ? '#cfaa48' : '#ff4444',
                    }}
                    initial={{
                      scale: 3,
                      rotate: -15,
                      opacity: 0,
                      filter: 'blur(4px)',
                    }}
                    animate={{
                      scale: 1,
                      rotate: 0,
                      opacity: 1,
                      filter: 'blur(0px)',
                    }}
                    transition={{
                      type: 'spring',
                      stiffness: 400,
                      damping: 15,
                      duration: 0.3,
                    }}
                  >
                    {verdict.title}
                  </motion.div>

                  <motion.p
                    className="text-[#888] text-xs italic leading-relaxed max-w-sm mx-auto"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.4 }}
                  >
                    {verdict.summary}
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Phase 4: Medals ───────────────────────── */}
            <AnimatePresence>
              {phaseGte('medals') && medals.length > 0 && (
                <motion.div
                  key="medals-section"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <hr className="border-[#444] mb-4" />
                  <div
                    className="text-[#cfaa48] text-xs font-bold uppercase tracking-wider mb-3"
                    style={VT323_STYLE}
                  >
                    Medals Awarded
                  </div>
                  <div className="space-y-2">
                    {medals.map((medal, i) => (
                      <MedalCard key={medal.id} medal={medal} index={i} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Phase 5: Stats (score, breakdown, statistics, achievements) ── */}
            <AnimatePresence>
              {phaseGte('stats') && (
                <motion.div
                  key="stats-section"
                  className="space-y-5"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <hr className="border-[#444]" />

                  {/* Final score with counter */}
                  <div className="text-center">
                    <div className="text-[#888] text-xs uppercase tracking-wider mb-1">
                      Final Score
                    </div>
                    <div className="text-3xl font-bold text-[#cfaa48]" style={VT323_STYLE}>
                      <ScoreCounter target={finalScore} durationMs={2000} />
                    </div>
                    <div className="text-[#666] text-xs mt-1">
                      Difficulty: {tally.difficulty} | Consequence: {tally.consequence}
                    </div>
                  </div>

                  <hr className="border-[#444]" />

                  {/* Score breakdown */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <div
                      className="text-[#cfaa48] text-xs font-bold uppercase tracking-wider mb-2"
                      style={VT323_STYLE}
                    >
                      Score Breakdown
                    </div>
                    {scoreBreakdown.eras.map((era) => (
                      <StatRow key={era.eraIndex} label={era.eraName} value={era.eraTotal} />
                    ))}
                    <div className="border-t border-[#333] mt-1 pt-1">
                      <StatRow label="Subtotal" value={scoreBreakdown.subtotal} />
                      <StatRow
                        label={`Settings multiplier (x${scoreBreakdown.settingsMultiplier})`}
                        value={scoreBreakdown.finalScore}
                      />
                    </div>
                  </motion.div>

                  <hr className="border-[#444]" />

                  {/* Statistics */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    <div
                      className="text-[#cfaa48] text-xs font-bold uppercase tracking-wider mb-2"
                      style={VT323_STYLE}
                    >
                      Statistics
                    </div>
                    <StatRow label="Years played" value={statistics.yearsPlayed} />
                    <StatRow label="Year reached" value={statistics.yearReached} />
                    <StatRow label="Peak population" value={statistics.peakPopulation} />
                    <StatRow label="Final population" value={statistics.finalPopulation} />
                    <StatRow label="Buildings placed" value={statistics.buildingsPlaced} />
                    <StatRow label="Building collapses" value={statistics.buildingCollapses} />
                    <StatRow label="Quotas met" value={statistics.quotasMet} />
                    <StatRow label="Quotas missed" value={statistics.quotasMissed} />
                    <StatRow label="Eras completed" value={statistics.erasCompleted} />
                    <StatRow label="Black marks" value={statistics.blackMarks} />
                    <StatRow label="Commendations" value={statistics.commendations} />
                    <StatRow label="Settlement tier" value={statistics.settlementTier} />
                  </motion.div>

                  {/* Medals (duplicated in stats for final layout if already shown) */}
                  {/* Already shown above in medals phase — no duplication needed */}

                  {/* Achievements */}
                  <hr className="border-[#444]" />
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 }}
                  >
                    <div
                      className="text-[#cfaa48] text-xs font-bold uppercase tracking-wider mb-2"
                      style={VT323_STYLE}
                    >
                      Achievements ({tally.achievementsUnlocked}/{tally.achievementsTotal})
                    </div>
                    <div className="space-y-1">
                      {tally.achievements
                        .filter((a) => a.unlocked)
                        .map((a) => (
                          <div key={a.id} className="flex items-baseline gap-2">
                            <span className="text-[#cfaa48] text-xs flex-shrink-0">&#9733;</span>
                            <span className="text-[#ccc] text-xs">{a.name}</span>
                          </div>
                        ))}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Skip hint — shown during intro phases */}
            <AnimatePresence>
              {!phaseGte('stats') && (
                <motion.div
                  key="skip-hint"
                  className="text-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.4 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: 2, duration: 0.5 }}
                >
                  <span
                    className="text-[#555] text-[10px] uppercase tracking-wider"
                    style={VT323_STYLE}
                  >
                    [ tap to skip ]
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer button — only visible in stats phase */}
          <AnimatePresence>
            {phaseGte('stats') && (
              <motion.div
                key="footer"
                className="bg-[#1a1a1a] border-t-2 border-[#8b0000] px-4 py-4 sticky bottom-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.0, duration: 0.3 }}
              >
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                  className="w-full min-h-[44px] px-6 py-3 bg-[#8b0000] hover:bg-[#a00000] active:bg-[#700000] text-white text-sm font-bold uppercase tracking-widest border-2 border-[#660000] shadow-[0_4px_0_0_#440000] hover:shadow-[0_2px_0_0_#440000] hover:translate-y-[2px] transition-all cursor-pointer"
                  style={VT323_STYLE}
                  whileTap={{ scale: 0.98 }}
                >
                  Acknowledged
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </>
  );
}
