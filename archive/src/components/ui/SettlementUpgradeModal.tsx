/**
 * SettlementUpgradeModal — decree announcing settlement tier promotion.
 *
 * Shown when SettlementSystem fires an upgrade event (selo→posyolok→pgt→gorod).
 * Parchment-themed document with tier transition animation, unlock list,
 * and commendation award. Parent controls visibility via presence of event.
 *
 * Adapted from approved prototype (src/prototypes/SettlementUpgradeModal.tsx).
 */
import { motion } from 'framer-motion';
import { Award, ChevronRight, Star, X } from 'lucide-react';
import type { SettlementTier } from '@/game/SettlementSystem';

// ── Types ────────────────────────────────────────────────────────────────

interface TierInfo {
  label: string;
  russian: string;
  icon: string;
  title: string;
}

export interface SettlementUpgradeModalProps {
  fromTier: SettlementTier;
  toTier: SettlementTier;
  onClose: () => void;
}

// ── Tier display data ────────────────────────────────────────────────────

const TIERS: Record<SettlementTier, TierInfo> = {
  selo: {
    label: 'Selo',
    russian: '\u0441\u0435\u043B\u043E',
    icon: '\uD83C\uDFD8\uFE0F',
    title: 'Collective Farm Chairman',
  },
  posyolok: {
    label: 'Posy\u00F6lok',
    russian:
      '\u0440\u0430\u0431\u043E\u0447\u0438\u0439 \u043F\u043E\u0441\u0451\u043B\u043E\u043A',
    icon: '\uD83C\uDFD7\uFE0F',
    title: 'Settlement Director',
  },
  pgt: {
    label: 'PGT',
    russian:
      '\u043F\u043E\u0441\u0451\u043B\u043E\u043A \u0433\u043E\u0440\u043E\u0434\u0441\u043A\u043E\u0433\u043E \u0442\u0438\u043F\u0430',
    icon: '\uD83C\uDFD9\uFE0F',
    title: 'Urban-Type Settlement Administrator',
  },
  gorod: {
    label: 'Gorod',
    russian: '\u0433\u043E\u0440\u043E\u0434',
    icon: '\uD83C\uDF06',
    title: 'City Soviet Chairman',
  },
};

const UNLOCK_DATA: Partial<Record<SettlementTier, string[]>> = {
  posyolok: [
    'Factory and Power Station now available',
    'Apartment blocks unlocked',
    'First Politruk assigned to your settlement',
    'Industrial production quotas begin',
    'Orgnabor: state may requisition workers',
  ],
  pgt: [
    'Heavy industry complexes unlocked',
    'Public transit system available',
    'District Soviet formed',
    'Cultural Palace construction permitted',
    'Militia garrison established',
  ],
  gorod: [
    'Metro system construction unlocked',
    'University and Research Institute available',
    'Obkom party committee established',
    'International trade routes opened',
    'Nuclear power station permitted',
  ],
};

const COMMENDATIONS: Partial<Record<SettlementTier, string>> = {
  posyolok: 'Order of the Red Banner of Labour',
  pgt: 'Medal for Distinguished Labour',
  gorod: 'Hero of Socialist Labour',
};

// ── Sub-components ───────────────────────────────────────────────────────

function GoldStar({ className }: { className?: string }) {
  return <Star className={`text-[#cfaa48] fill-[#cfaa48] ${className ?? ''}`} size={16} />;
}

function TierTransition({ fromTier, toTier }: { fromTier: TierInfo; toTier: TierInfo }) {
  return (
    <motion.div
      className="flex items-center justify-center gap-3 sm:gap-6 py-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.6, duration: 0.5 }}
    >
      <div className="text-center">
        <div className="text-3xl sm:text-5xl mb-1 opacity-60">{fromTier.icon}</div>
        <div
          className="text-[#654321] text-[10px] sm:text-xs uppercase tracking-wider"
          style={{ fontFamily: "'Courier New', monospace" }}
        >
          {fromTier.label}
        </div>
      </div>

      <motion.div
        initial={{ x: -10, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.4, type: 'spring' }}
      >
        <ChevronRight className="text-[#8b0000] w-6 h-6 sm:w-8 sm:h-8" />
      </motion.div>

      <motion.div
        className="text-center"
        animate={{
          filter: [
            'drop-shadow(0 0 4px #cfaa48)',
            'drop-shadow(0 0 12px #cfaa48)',
            'drop-shadow(0 0 4px #cfaa48)',
          ],
        }}
        transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
      >
        <div className="text-4xl sm:text-6xl mb-1">{toTier.icon}</div>
        <div
          className="text-[#cfaa48] text-xs sm:text-sm font-bold uppercase tracking-wider"
          style={{ fontFamily: "'Courier New', monospace" }}
        >
          {toTier.label}
        </div>
      </motion.div>
    </motion.div>
  );
}

function UnlockList({ items }: { items: string[] }) {
  return (
    <motion.div
      className="border-2 border-[#8b4513] bg-[#ede0c8] p-3 sm:p-4 mx-2 sm:mx-6"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.0, duration: 0.4 }}
    >
      <div
        className="text-[#8b4513] text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-2 sm:mb-3 text-center"
        style={{ fontFamily: "'Courier New', monospace" }}
      >
        New Capabilities Unlocked
      </div>
      <ul className="space-y-1.5 sm:space-y-2">
        {items.map((item, idx) => (
          <motion.li
            key={item}
            className="flex items-start gap-2"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.2 + idx * 0.1, duration: 0.3 }}
          >
            <span className="text-[#cfaa48] text-xs sm:text-sm flex-shrink-0 leading-4 sm:leading-5">
              &#9733;
            </span>
            <span
              className="text-[#654321] text-[11px] sm:text-sm leading-4 sm:leading-5"
              style={{ fontFamily: "'Courier New', monospace" }}
            >
              {item}
            </span>
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
}

function ApprovedStamp() {
  return (
    <motion.div
      className="absolute bottom-6 right-6 sm:bottom-10 sm:right-10 pointer-events-none select-none"
      initial={{ scale: 2.5, opacity: 0, rotate: -18 }}
      animate={{ scale: 1, opacity: 0.85, rotate: -18 }}
      transition={{
        delay: 0.5,
        duration: 0.25,
        type: 'spring',
        stiffness: 500,
        damping: 15,
      }}
    >
      <div className="border-4 border-[#cc0000] rounded-sm px-4 py-2 sm:px-6 sm:py-3">
        <div
          className="text-[#cc0000] text-lg sm:text-2xl font-bold uppercase tracking-widest whitespace-nowrap"
          style={{ fontFamily: "'Courier New', monospace" }}
        >
          {'\u0423\u0422\u0412\u0415\u0420\u0416\u0414\u0415\u041D\u041E'}
        </div>
      </div>
    </motion.div>
  );
}

// ── Main modal ───────────────────────────────────────────────────────────

export function SettlementUpgradeModal({ fromTier, toTier, onClose }: SettlementUpgradeModalProps) {
  const from = TIERS[fromTier];
  const to = TIERS[toTier];
  const unlocks = UNLOCK_DATA[toTier] ?? [];
  const commendation = COMMENDATIONS[toTier];

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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6 overflow-y-auto">
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="upgrade-heading"
          className="relative w-full sm:max-w-2xl bg-[#1a1a1a] border-2 border-[#8b0000] shadow-[0_0_40px_rgba(139,0,0,0.4)] min-h-screen sm:min-h-0 sm:rounded-sm flex flex-col"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25, duration: 0.5 }}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center bg-[#2a2a2a] border border-[#444] hover:border-[#8b0000] transition-colors"
            aria-label="Close decree"
          >
            <X className="w-4 h-4 text-[#888]" />
          </button>

          {/* Dark chrome header */}
          <div className="bg-[#8b0000] border-b-2 border-[#660000] px-4 py-3 sm:py-4">
            <div className="flex items-center justify-center gap-2 sm:gap-3">
              <GoldStar className="w-4 h-4 sm:w-5 sm:h-5" />
              <h1
                id="upgrade-heading"
                className="text-[#cfaa48] text-sm sm:text-lg font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-center"
                style={{ fontFamily: "'VT323', monospace" }}
              >
                Decree of the Supreme Soviet
              </h1>
              <GoldStar className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>

          {/* Parchment body */}
          <div className="flex-1 overflow-y-auto">
            <div className="relative bg-[#f4e8d0] mx-0">
              {/* Paper texture */}
              <div
                className="absolute inset-0 opacity-[0.04] pointer-events-none"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(0deg, transparent, transparent 3px, #000 3px, #000 4px)',
                }}
              />

              <div className="relative px-4 sm:px-8 py-5 sm:py-8">
                {/* Decree preamble */}
                <motion.div
                  className="text-center mb-4 sm:mb-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                >
                  <p
                    className="text-[#654321] text-xs sm:text-sm leading-relaxed"
                    style={{ fontFamily: "'Courier New', monospace" }}
                  >
                    By order of the Presidium of the Supreme Soviet,
                    <br />
                    the {from.label} is hereby
                    <br />
                    reclassified as a
                  </p>
                </motion.div>

                {/* New tier — large gold text */}
                <motion.div
                  className="text-center mb-2"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                >
                  <div
                    className="text-2xl sm:text-4xl font-bold uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-b from-[#cfaa48] via-[#e8c860] to-[#a08030]"
                    style={{ fontFamily: "'Courier New', monospace" }}
                  >
                    {to.label}
                  </div>
                  <div
                    className="text-[#8b4513] text-sm sm:text-base mt-1 italic"
                    style={{ fontFamily: "'Courier New', monospace" }}
                  >
                    {to.russian}
                  </div>
                </motion.div>

                {/* Continuation text */}
                <motion.p
                  className="text-center text-[#654321] text-xs sm:text-sm leading-relaxed mb-5 sm:mb-6"
                  style={{ fontFamily: "'Courier New', monospace" }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6, duration: 0.4 }}
                >
                  in recognition of its productive contributions
                  <br />
                  to the Socialist cause.
                </motion.p>

                <div className="border-t-2 border-dashed border-[#c4a882] mx-4 sm:mx-8 mb-5 sm:mb-6" />

                {/* Tier transition visual */}
                <TierTransition fromTier={from} toTier={to} />

                <div className="border-t-2 border-dashed border-[#c4a882] mx-4 sm:mx-8 my-5 sm:my-6" />

                {/* Unlocks */}
                {unlocks.length > 0 && <UnlockList items={unlocks} />}

                {/* Player title */}
                <motion.div
                  className="text-center mt-5 sm:mt-6 px-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.8, duration: 0.4 }}
                >
                  <p
                    className="text-[#654321] text-xs sm:text-sm"
                    style={{ fontFamily: "'Courier New', monospace" }}
                  >
                    Comrade, you are now
                  </p>
                  <p
                    className="text-[#8b4513] text-sm sm:text-base font-bold mt-1"
                    style={{ fontFamily: "'Courier New', monospace" }}
                  >
                    {to.title}
                  </p>
                </motion.div>

                {/* Commendation */}
                {commendation && (
                  <motion.div
                    className="flex items-center justify-center gap-2 mt-4 sm:mt-5 px-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2.0, duration: 0.4 }}
                  >
                    <Award className="text-[#cfaa48] w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                    <p
                      className="text-[#654321] text-[11px] sm:text-sm text-center"
                      style={{ fontFamily: "'Courier New', monospace" }}
                    >
                      You have been awarded:{' '}
                      <span className="font-bold text-[#8b4513]">{commendation}</span>
                    </p>
                  </motion.div>
                )}
              </div>

              <ApprovedStamp />
            </div>
          </div>

          {/* Dark chrome footer */}
          <div className="bg-[#1a1a1a] border-t-2 border-[#8b0000] px-4 py-4 sm:py-5">
            <motion.button
              onClick={onClose}
              className="w-full min-h-[44px] px-6 py-3 bg-[#8b0000] hover:bg-[#a00000] active:bg-[#700000] text-white text-sm sm:text-base font-bold uppercase tracking-widest border-2 border-[#660000] shadow-[0_4px_0_0_#440000] hover:shadow-[0_2px_0_0_#440000] hover:translate-y-[2px] transition-all cursor-pointer"
              style={{ fontFamily: "'VT323', monospace" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.2, duration: 0.3 }}
              whileTap={{ scale: 0.98 }}
            >
              Glory to the Workers' State
            </motion.button>

            <div
              className="text-[#555] text-[9px] sm:text-[10px] text-center mt-3 uppercase tracking-widest"
              style={{ fontFamily: "'VT323', monospace" }}
            >
              Ministry of Settlement Classification
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}
