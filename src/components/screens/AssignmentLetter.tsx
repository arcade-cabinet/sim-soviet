/**
 * AssignmentLetter -- Dynamic intro decree that replaces IntroModal.
 *
 * Displays a parchment-style assignment decree with the player's name,
 * city, era intro text, starting conditions, and a sardonic closing.
 * Includes a CSS-only official stamp and framer-motion paper-unfold animation.
 */
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { accent, DOCUMENT_FONT, parchment, SOVIET_FONT } from '@/design/tokens';
import type { EraDefinition } from '@/game/era';
import { DIFFICULTY_PRESETS, type DifficultyLevel } from '@/game/ScoringSystem';
import type { NewGameConfig } from './NewGameFlow';

/** Props for the AssignmentLetter component. */
export interface AssignmentLetterProps {
  /** The complete new game configuration. */
  config: NewGameConfig;
  /** The era definition for the starting era. */
  era: EraDefinition;
  /** Called when the player accepts the assignment. */
  onAccept: () => void;
}

const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  worker: 'Worker',
  comrade: 'Comrade',
  tovarish: 'Tovarish',
};

/**
 * Assignment decree document shown before the game begins.
 *
 * Styled as an official Soviet parchment document with paper-unfold
 * animation, CSS-only official stamp, and era-specific briefing text.
 */
export function AssignmentLetter({ config, era, onAccept }: AssignmentLetterProps) {
  const decreeNumber = useMemo(() => String(Math.floor(1000 + Math.random() * 9000)), []);

  const multipliers = DIFFICULTY_PRESETS[config.difficulty];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-30 flex items-center justify-center px-3 py-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.92)' }}
    >
      {/* Paper unfold animation */}
      <motion.div
        initial={{ scaleY: 0, opacity: 0 }}
        animate={{ scaleY: 1, opacity: 1 }}
        transition={{
          scaleY: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
          opacity: { duration: 0.3 },
        }}
        style={{ transformOrigin: 'top center' }}
        className="w-full max-w-lg"
      >
        <div
          className="border-2 shadow-2xl relative"
          style={{
            fontFamily: DOCUMENT_FONT,
            background: parchment.surface.paper,
            borderColor: parchment.border.primary,
            color: parchment.text.primary,
          }}
        >
          {/* Official stamp (CSS-only) */}
          <div
            className="absolute top-6 right-6 w-16 h-16 rounded-full border-4 flex items-center justify-center opacity-60 pointer-events-none select-none"
            style={{
              borderColor: accent.red,
              transform: 'rotate(-12deg)',
            }}
            aria-hidden="true"
          >
            <div
              className="text-[10px] font-bold uppercase text-center leading-tight"
              style={{
                fontFamily: SOVIET_FONT,
                color: accent.red,
              }}
            >
              APPROVED
            </div>
          </div>

          {/* Header */}
          <div
            className="px-5 py-4 border-b-2 text-center"
            style={{
              background: parchment.surface.header,
              borderColor: parchment.border.primary,
            }}
          >
            <div className="text-[10px] uppercase tracking-[0.3em] mb-2 opacity-50">
              Central Committee of the Communist Party
            </div>
            <h1
              className="text-xl font-bold uppercase tracking-[0.1em]"
              style={{ fontFamily: SOVIET_FONT }}
            >
              Assignment Decree No. {decreeNumber}
            </h1>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-4 text-xs leading-relaxed">
            <p className="italic opacity-60 text-[10px]">
              By order of the Central Committee of the Communist Party of the Soviet Union
            </p>

            <p>
              Comrade <strong>{config.playerName}</strong> is hereby assigned as Director of
              Settlement <strong>{config.cityName}</strong>.
            </p>

            {/* Era intro */}
            <div className="border-l-4 pl-3 py-1" style={{ borderColor: accent.red }}>
              <div className="font-bold uppercase tracking-wider text-[10px] mb-1">
                {era.introTitle}
              </div>
              <p className="text-[11px] leading-relaxed">{era.introText}</p>
            </div>

            {/* Starting conditions */}
            <div
              className="border-2 p-3 text-[10px] space-y-1"
              style={{
                borderColor: parchment.border.primary,
                background: parchment.surface.alt,
              }}
            >
              <div className="font-bold uppercase tracking-[0.1em] text-xs mb-2">
                Starting Conditions
              </div>
              <ConditionRow label="Era" value={`${era.name} (${era.startYear})`} />
              <ConditionRow label="Difficulty" value={DIFFICULTY_LABELS[config.difficulty]} />
              <ConditionRow label="Quota Multiplier" value={`${multipliers.quotaMultiplier}x`} />
              <ConditionRow
                label="Resource Multiplier"
                value={`${multipliers.resourceMultiplier}x`}
              />
              <ConditionRow label="Decay Rate" value={`${multipliers.decayMultiplier}x`} />
            </div>

            {/* Sardonic closing */}
            <p className="italic text-[10px] opacity-70 pt-2">
              The Party trusts in your unwavering dedication. Failure is not an option. (It is,
              however, statistically likely.)
            </p>

            <p className="text-[10px] opacity-50 text-right">
              Signed and stamped by the appropriate authorities.
              <br />
              This document is self-authorizing.
            </p>
          </div>

          {/* Accept button */}
          <div
            className="px-5 py-4 border-t-2"
            style={{
              background: parchment.surface.alt,
              borderColor: parchment.border.primary,
            }}
          >
            <button
              type="button"
              onClick={onAccept}
              className="w-full py-3 text-base font-bold uppercase tracking-[0.2em] border-2 text-white transition-all active:translate-y-0.5 cursor-pointer hover:brightness-110"
              style={{
                fontFamily: SOVIET_FONT,
                background: accent.red,
                borderColor: accent.red,
              }}
            >
              Accept Assignment
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Sub-component ──────────────────────────────────────────

function ConditionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="opacity-60">{label}:</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}
