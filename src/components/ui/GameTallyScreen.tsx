/**
 * GameTallyScreen -- end-game summary modal showing score, stats,
 * medals, and achievements in Soviet dossier style.
 *
 * Displayed when the SimulationEngine fires onGameTally on game over.
 */
import { motion } from 'framer-motion';
import type { TallyData } from '@/game/GameTally';

export interface GameTallyScreenProps {
  tally: TallyData;
  onClose: () => void;
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between items-baseline py-0.5">
      <span className="text-[#999] text-xs">{label}</span>
      <span className="text-[#cfaa48] text-sm font-bold">{value}</span>
    </div>
  );
}

export function GameTallyScreen({ tally, onClose }: GameTallyScreenProps) {
  const { verdict, statistics, medals, scoreBreakdown, finalScore } = tally;

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
        >
          {/* Header */}
          <div className="bg-[#8b0000] border-b-2 border-[#660000] px-4 py-3 sticky top-0 z-10">
            <h1
              id="tally-heading"
              className="text-[#cfaa48] text-sm font-bold uppercase tracking-[0.15em] text-center"
              style={{ fontFamily: "'VT323', monospace" }}
            >
              {verdict.victory ? 'Order of Lenin — Final Report' : 'Personnel File — Closed'}
            </h1>
          </div>

          <div className="px-5 py-5 space-y-5">
            {/* Verdict */}
            <motion.div
              className="text-center"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div
                className="text-xl font-bold uppercase tracking-wider text-[#cfaa48] mb-1"
                style={{ fontFamily: "'VT323', monospace" }}
              >
                {verdict.title}
              </div>
              <p className="text-[#888] text-xs italic leading-relaxed">{verdict.summary}</p>
            </motion.div>

            <hr className="border-[#444]" />

            {/* Final score */}
            <motion.div
              className="text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <div className="text-[#888] text-xs uppercase tracking-wider mb-1">Final Score</div>
              <div
                className="text-3xl font-bold text-[#cfaa48]"
                style={{ fontFamily: "'VT323', monospace" }}
              >
                {finalScore}
              </div>
              <div className="text-[#666] text-xs mt-1">
                Difficulty: {tally.difficulty} | Consequence: {tally.consequence}
              </div>
            </motion.div>

            <hr className="border-[#444]" />

            {/* Score breakdown */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <div
                className="text-[#cfaa48] text-xs font-bold uppercase tracking-wider mb-2"
                style={{ fontFamily: "'VT323', monospace" }}
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
              transition={{ delay: 0.7 }}
            >
              <div
                className="text-[#cfaa48] text-xs font-bold uppercase tracking-wider mb-2"
                style={{ fontFamily: "'VT323', monospace" }}
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

            {/* Medals */}
            {medals.length > 0 && (
              <>
                <hr className="border-[#444]" />
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                >
                  <div
                    className="text-[#cfaa48] text-xs font-bold uppercase tracking-wider mb-2"
                    style={{ fontFamily: "'VT323', monospace" }}
                  >
                    Medals Awarded
                  </div>
                  <div className="space-y-2">
                    {medals.map((medal) => (
                      <div key={medal.id} className="bg-[#2a2a2a] border border-[#444] p-2">
                        <div className="text-[#cfaa48] text-sm font-bold">{medal.name}</div>
                        <div className="text-[#888] text-xs">{medal.description}</div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </>
            )}

            {/* Achievements */}
            <hr className="border-[#444]" />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
            >
              <div
                className="text-[#cfaa48] text-xs font-bold uppercase tracking-wider mb-2"
                style={{ fontFamily: "'VT323', monospace" }}
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
          </div>

          {/* Footer button */}
          <div className="bg-[#1a1a1a] border-t-2 border-[#8b0000] px-4 py-4 sticky bottom-0">
            <motion.button
              onClick={onClose}
              className="w-full min-h-[44px] px-6 py-3 bg-[#8b0000] hover:bg-[#a00000] active:bg-[#700000] text-white text-sm font-bold uppercase tracking-widest border-2 border-[#660000] shadow-[0_4px_0_0_#440000] hover:shadow-[0_2px_0_0_#440000] hover:translate-y-[2px] transition-all cursor-pointer"
              style={{ fontFamily: "'VT323', monospace" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0 }}
              whileTap={{ scale: 0.98 }}
            >
              Acknowledged
            </motion.button>
          </div>
        </motion.div>
      </div>
    </>
  );
}
