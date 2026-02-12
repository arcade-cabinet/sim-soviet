/**
 * MedalCeremony -- CSS-only animated medal reveal for the game-over screen.
 *
 * Medals appear one at a time, sliding in from the left with a gold shimmer.
 * Tier-based styling: concrete > iron > bronze > copper > tin.
 * Final score counts up with an ease-out counter.
 *
 * Soviet aesthetic: reds, golds, dark backgrounds, star decorations.
 * Dark sardonic tone -- survival, not comedy.
 */

import { useEffect, useRef, useState } from 'react';
import type { Medal } from '@/game/ScoringSystem';

// ─────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────

const TIER_COLORS: Record<Medal['tier'], { bg: string; border: string; text: string }> = {
  concrete: { bg: '#3a3a3a', border: '#888', text: '#bbb' },
  iron: { bg: '#2a2020', border: '#8b4513', text: '#cd853f' },
  bronze: { bg: '#2a2315', border: '#cd7f32', text: '#daa520' },
  copper: { bg: '#2a1a15', border: '#b87333', text: '#da8a67' },
  tin: { bg: '#252525', border: '#666', text: '#999' },
};

const TIER_STARS: Record<Medal['tier'], string> = {
  concrete: '\u2742',
  iron: '\u2720',
  bronze: '\u272A',
  copper: '\u2605',
  tin: '\u2606',
};

const MEDAL_DELAY_MS = 600;
const SCORE_DURATION_MS = 2000;

// ─────────────────────────────────────────────────────────
//  SCORE COUNTER (CSS-only, no animation library)
// ─────────────────────────────────────────────────────────

function ScoreCountUp({ target }: { target: number }) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / SCORE_DURATION_MS, 1);
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.floor(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target]);

  return <>{value.toLocaleString()}</>;
}

// ─────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────

interface MedalCeremonyProps {
  medals: Medal[];
  finalScore: number;
}

export function MedalCeremony({ medals, finalScore }: MedalCeremonyProps) {
  const [revealedCount, setRevealedCount] = useState(0);
  const [showScore, setShowScore] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stagger medal reveals
  useEffect(() => {
    if (medals.length === 0) {
      setShowScore(true);
      return;
    }
    if (revealedCount >= medals.length) {
      timerRef.current = setTimeout(() => setShowScore(true), 400);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
    timerRef.current = setTimeout(
      () => setRevealedCount((c) => c + 1),
      revealedCount === 0 ? 800 : MEDAL_DELAY_MS
    );
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [revealedCount, medals.length]);

  return (
    <>
      <style>{`
        @keyframes medal-slide-in {
          0% { opacity: 0; transform: translateX(-40px) scale(0.8); }
          60% { opacity: 1; transform: translateX(4px) scale(1.05); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes medal-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes score-reveal {
          0% { opacity: 0; transform: scale(0.6); }
          70% { opacity: 1; transform: scale(1.1); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes star-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        .medal-card {
          animation: medal-slide-in 0.5s ease-out forwards;
        }
        .medal-shimmer {
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 215, 0, 0.15) 45%,
            rgba(255, 215, 0, 0.3) 50%,
            rgba(255, 215, 0, 0.15) 55%,
            transparent 100%
          );
          background-size: 200% 100%;
          animation: medal-shimmer 2s ease-in-out infinite;
          animation-delay: 0.5s;
        }
        .score-block {
          animation: score-reveal 0.6s ease-out forwards;
        }
        .star-deco {
          animation: star-pulse 2s ease-in-out infinite;
        }
      `}</style>

      <div style={{ fontFamily: "'VT323', monospace" }}>
        {/* Header */}
        {medals.length > 0 && (
          <div className="text-center mb-3">
            <div className="text-[10px] uppercase tracking-[0.3em] text-[#666] mb-1">
              Ministry of State Awards
            </div>
            <div
              className="text-xs uppercase tracking-wider font-bold"
              style={{ color: '#cfaa48' }}
            >
              <span className="star-deco inline-block">&#9733;</span> Medals Conferred{' '}
              <span className="star-deco inline-block" style={{ animationDelay: '0.5s' }}>
                &#9733;
              </span>
            </div>
          </div>
        )}

        {/* Medal cards */}
        <div className="space-y-2 mb-4">
          {medals.slice(0, revealedCount).map((medal) => {
            const colors = TIER_COLORS[medal.tier];
            const star = TIER_STARS[medal.tier];
            return (
              <div
                key={medal.id}
                className="medal-card medal-shimmer p-2.5 flex items-start gap-2.5"
                style={{
                  backgroundColor: colors.bg,
                  borderLeft: `3px solid ${colors.border}`,
                  borderRight: `1px solid ${colors.border}33`,
                  borderTop: `1px solid ${colors.border}33`,
                  borderBottom: `1px solid ${colors.border}33`,
                }}
              >
                <div
                  className="text-xl flex-shrink-0 mt-0.5 select-none"
                  style={{ color: colors.text }}
                  aria-hidden="true"
                >
                  {star}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold leading-tight" style={{ color: colors.text }}>
                    {medal.name}
                  </div>
                  <div className="text-[11px] text-[#888] mt-0.5 leading-relaxed">
                    {medal.description}
                  </div>
                  <div className="text-[9px] uppercase tracking-wider mt-1 text-[#555]">
                    Material: {medal.tier}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* No medals notice */}
        {medals.length === 0 && (
          <div className="text-center text-[#555] text-xs italic mb-4">
            No medals awarded. The committee found nothing worth commending.
          </div>
        )}

        {/* Final score */}
        {showScore && (
          <div className="score-block text-center py-3">
            <div className="text-[10px] uppercase tracking-wider text-[#666] mb-1">
              Final Assessment
            </div>
            <div className="text-3xl font-bold" style={{ color: '#cfaa48' }}>
              <ScoreCountUp target={finalScore} />
            </div>
            <div className="text-[10px] uppercase tracking-wider text-[#555] mt-1">
              Points Assigned to Personnel File
            </div>
          </div>
        )}
      </div>
    </>
  );
}
