/**
 * EraTransitionModal -- briefing modal shown when the game transitions
 * to a new historical era.
 *
 * Soviet dossier aesthetic matching SettlementUpgradeModal pattern.
 * Shows era name, intro title, briefing text, and flavor.
 */
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { EraDefinition } from '@/game/era';

export interface EraTransitionModalProps {
  era: EraDefinition;
  onClose: () => void;
}

export function EraTransitionModal({ era, onClose }: EraTransitionModalProps) {
  return (
    <>
      {/* Dark overlay */}
      <motion.div
        className="fixed inset-0 bg-black/75 z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="era-heading"
          className="relative w-full max-w-lg bg-[#1a1a1a] border-2 border-[#8b0000] shadow-[0_0_40px_rgba(139,0,0,0.4)]"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center bg-[#2a2a2a] border border-[#444] hover:border-[#8b0000] transition-colors"
            aria-label="Close briefing"
          >
            <X className="w-4 h-4 text-[#888]" />
          </button>

          {/* Header */}
          <div className="bg-[#8b0000] border-b-2 border-[#660000] px-4 py-3">
            <h1
              id="era-heading"
              className="text-[#cfaa48] text-sm font-bold uppercase tracking-[0.15em] text-center"
              style={{ fontFamily: "'VT323', monospace" }}
            >
              New Era Assignment
            </h1>
          </div>

          {/* Body */}
          <div className="px-6 py-6">
            {/* Era name */}
            <motion.div
              className="text-center mb-4"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
            >
              <div
                className="text-2xl font-bold uppercase tracking-wider text-[#cfaa48]"
                style={{ fontFamily: "'VT323', monospace" }}
              >
                {era.name}
              </div>
              <div className="text-[#888] text-xs mt-1">
                {era.startYear} &mdash; {era.endYear === -1 ? 'Eternal' : era.endYear}
              </div>
            </motion.div>

            <hr className="border-[#444] mb-4" />

            {/* Intro title */}
            <motion.div
              className="mb-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.4 }}
            >
              <p
                className="text-[#cfaa48] text-sm font-bold uppercase tracking-wider text-center"
                style={{ fontFamily: "'VT323', monospace" }}
              >
                {era.introTitle}
              </p>
            </motion.div>

            {/* Briefing text */}
            <motion.div
              className="mb-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.4 }}
            >
              <p className="text-[#ccc] text-sm leading-relaxed">{era.introText}</p>
            </motion.div>

            {/* Flavor */}
            <motion.div
              className="border-t border-[#444] pt-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.4 }}
            >
              <p className="text-[#888] text-xs italic text-center">{era.briefingFlavor}</p>
            </motion.div>
          </div>

          {/* Footer button */}
          <div className="bg-[#1a1a1a] border-t-2 border-[#8b0000] px-4 py-4">
            <motion.button
              onClick={onClose}
              className="w-full min-h-[44px] px-6 py-3 bg-[#8b0000] hover:bg-[#a00000] active:bg-[#700000] text-white text-sm font-bold uppercase tracking-widest border-2 border-[#660000] shadow-[0_4px_0_0_#440000] hover:shadow-[0_2px_0_0_#440000] hover:translate-y-[2px] transition-all cursor-pointer"
              style={{ fontFamily: "'VT323', monospace" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.1, duration: 0.3 }}
              whileTap={{ scale: 0.98 }}
            >
              For the Motherland
            </motion.button>
          </div>
        </motion.div>
      </div>
    </>
  );
}
