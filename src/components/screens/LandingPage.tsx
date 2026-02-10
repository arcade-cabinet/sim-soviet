/**
 * LandingPage -- Main menu screen for SimSoviet 2000.
 *
 * Soviet propaganda poster aesthetic: bold, stark, authoritative.
 * Displays title, subtitle, random loading quote, and action buttons.
 * Uses concrete (dark) theme tokens.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { useMemo } from 'react';
import { LOADING_QUOTES } from '@/content/worldbuilding';
import { accent, concrete, SOVIET_FONT } from '@/design/tokens';
import { cn } from '@/lib/utils';

/** Props for the LandingPage component. */
export interface LandingPageProps {
  /** Navigate to new game configuration. */
  onNewGame: () => void;
  /** Load the latest autosave and resume playing. */
  onContinue: () => void;
  /** Open a file/save picker to load a specific save. */
  onLoadGame: () => void;
  /** Whether an autosave exists (controls Continue button visibility). */
  hasSavedGame: boolean;
}

/**
 * Main menu screen with Soviet propaganda poster aesthetic.
 *
 * Full-viewport centered layout with game title, subtitle, random quote,
 * and stacked action buttons. CRT overlay is applied by App.tsx.
 */
export function LandingPage({ onNewGame, onContinue, onLoadGame, hasSavedGame }: LandingPageProps) {
  const quote = useMemo(
    () => LOADING_QUOTES[Math.floor(Math.random() * LOADING_QUOTES.length)]!,
    []
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed inset-0 z-30 flex flex-col items-center justify-center px-4"
      style={{
        fontFamily: SOVIET_FONT,
        background: `radial-gradient(ellipse at center, ${concrete.surface.panel} 0%, ${concrete.surface.deep} 70%)`,
      }}
    >
      {/* Soviet star ornament */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.2 }}
        className="mb-6"
      >
        <div
          className="w-16 h-16 flex items-center justify-center rounded-full border-2"
          style={{ borderColor: accent.red, background: `${accent.red}33` }}
        >
          <Star className="w-8 h-8" style={{ color: accent.gold }} fill={accent.gold} />
        </div>
      </motion.div>

      {/* Title */}
      <motion.h1
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-[0.2em] uppercase text-center mb-2"
        style={{ color: accent.redText }}
      >
        SIMSOVET 2000
      </motion.h1>

      {/* Decorative rule */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="w-48 sm:w-64 h-0.5 mb-3"
        style={{ background: accent.gold }}
      />

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-sm sm:text-base tracking-[0.15em] uppercase text-center mb-10"
        style={{ color: accent.gold }}
      >
        A Five-Year Plan for Urban Development
      </motion.p>

      {/* Action buttons */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.4 }}
        className="flex flex-col gap-3 w-full max-w-xs"
      >
        <MenuButton onClick={onNewGame} primary>
          NEW GAME
        </MenuButton>

        <AnimatePresence>
          {hasSavedGame && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <MenuButton onClick={onContinue}>CONTINUE</MenuButton>
            </motion.div>
          )}
        </AnimatePresence>

        <MenuButton onClick={onLoadGame}>LOAD GAME</MenuButton>
      </motion.div>

      {/* Random loading quote */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.8 }}
        className="absolute bottom-6 left-4 right-4 text-center text-xs sm:text-sm italic max-w-lg mx-auto leading-relaxed"
        style={{ color: concrete.text.muted }}
      >
        &ldquo;{quote}&rdquo;
      </motion.p>
    </motion.div>
  );
}

// ── Sub-component ────────────────────────────────────────────

function MenuButton({
  children,
  onClick,
  primary = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full py-3 px-6 text-lg font-bold uppercase tracking-[0.2em]',
        'border-2 transition-all duration-150',
        'active:translate-y-0.5 active:brightness-75',
        'cursor-pointer',
        primary
          ? 'text-white hover:brightness-125'
          : 'hover:border-[#666] text-white/90 hover:text-white'
      )}
      style={{
        background: primary ? accent.red : concrete.surface.panel,
        borderColor: primary ? accent.red : concrete.border.subtle,
        fontFamily: SOVIET_FONT,
      }}
    >
      {children}
    </button>
  );
}
