/**
 * QuotaHUD -- small overlay showing 5-Year Plan quota progress.
 *
 * Positioned top-left of the game viewport using the `.quota-hud` CSS class.
 */
import { useGameSnapshot } from '@/stores/gameStore';

export function QuotaHUD() {
  const snap = useGameSnapshot();
  const { quota, date } = snap;

  const progress = quota.target > 0 ? Math.min(quota.current / quota.target, 1) : 0;
  const pct = Math.round(progress * 100);
  const yearsLeft = Math.max(quota.deadlineYear - date.year, 0);

  return (
    <div className="quota-hud">
      <div
        className="text-xs font-bold tracking-widest mb-1"
        style={{ color: 'var(--soviet-gold)' }}
      >
        5-YEAR PLAN
      </div>

      <div className="text-[11px] leading-tight uppercase">
        {quota.type}: {quota.current}/{quota.target}
      </div>

      <div className="text-[10px] leading-tight mt-0.5 text-concrete">
        {yearsLeft} {yearsLeft === 1 ? 'year' : 'years'} remaining
      </div>

      {/* Progress bar */}
      <div
        className="mt-1 w-full h-2 rounded-sm overflow-hidden"
        style={{ background: '#374151' /* gray-700 */ }}
      >
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${pct}%`,
            background: 'var(--soviet-gold)',
          }}
        />
      </div>

      <div className="text-[10px] text-right mt-0.5" style={{ color: 'var(--soviet-gold)' }}>
        {pct}%
      </div>
    </div>
  );
}
