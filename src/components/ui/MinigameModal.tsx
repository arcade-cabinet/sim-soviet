/**
 * MinigameModal -- presents an active minigame with its choices.
 *
 * Each minigame gives the player 2-3 impossible choices. The UI
 * renders the minigame description and choice buttons. Selecting
 * a choice calls back to the parent which routes to SimulationEngine.
 */
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { ActiveMinigame } from '@/game/minigames/MinigameTypes';

export interface MinigameModalProps {
  minigame: ActiveMinigame;
  onChoice: (choiceId: string) => void;
  onClose: () => void;
}

export function MinigameModal({ minigame, onChoice, onClose }: MinigameModalProps) {
  const def = minigame.definition;

  return (
    <>
      {/* Dark overlay */}
      <motion.div
        className="fixed inset-0 bg-black/75 z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="minigame-heading"
          className="relative w-full max-w-md bg-[#1a1a1a] border-2 border-[#8b0000] shadow-[0_0_40px_rgba(139,0,0,0.4)]"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          {/* Close button (auto-resolves with penalty) */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center bg-[#2a2a2a] border border-[#444] hover:border-[#8b0000] transition-colors"
            aria-label="Ignore (auto-resolve with penalty)"
          >
            <X className="w-4 h-4 text-[#888]" />
          </button>

          {/* Header */}
          <div className="bg-[#8b0000] border-b-2 border-[#660000] px-4 py-3">
            <h1
              id="minigame-heading"
              className="text-[#cfaa48] text-sm font-bold uppercase tracking-[0.15em] text-center"
              style={{ fontFamily: "'VT323', monospace" }}
            >
              {def.name}
            </h1>
          </div>

          {/* Body */}
          <div className="px-5 py-5">
            {/* Description */}
            <p className="text-[#ccc] text-sm leading-relaxed mb-5">{def.description}</p>

            {/* Choices */}
            <div className="space-y-3">
              {def.choices.map((choice, idx) => (
                <motion.button
                  key={choice.id}
                  onClick={() => onChoice(choice.id)}
                  className="w-full text-left p-3 bg-[#2a2a2a] border border-[#444] hover:border-[#cfaa48] transition-colors cursor-pointer"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + idx * 0.1, duration: 0.3 }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <div
                    className="text-[#cfaa48] text-sm font-bold uppercase tracking-wider mb-1"
                    style={{ fontFamily: "'VT323', monospace" }}
                  >
                    {choice.label}
                  </div>
                  <div className="text-[#999] text-xs leading-relaxed">{choice.description}</div>
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}
