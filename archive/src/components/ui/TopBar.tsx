/**
 * TopBar -- compact stat bar across the top of the viewport.
 *
 * Desktop (>= 768px): title + labeled stats (label above number).
 * Phone  (<  768px): icon + number only, no labels, no title.
 */
import { togglePause, useGameSnapshot } from '@/stores/gameStore';

const MONTH_NAMES = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
] as const;

interface StatProps {
  icon: string;
  label: string;
  value: string | number;
  /** Optional color override for the value text. Defaults to soviet-gold. */
  color?: string;
}

function Stat({ icon, label, value, color }: StatProps) {
  return (
    <div className="flex flex-col items-center shrink-0">
      {/* Label visible only on desktop */}
      <span className="hidden md:block text-[10px] leading-none tracking-widest text-concrete uppercase">
        {label}
      </span>
      <span
        className="text-sm md:text-base leading-tight whitespace-nowrap"
        style={{ color: color ?? 'var(--soviet-gold)' }}
      >
        {icon} {value}
      </span>
    </div>
  );
}

export function TopBar() {
  const snap = useGameSnapshot();

  const month = MONTH_NAMES[snap.date.month % 12] ?? '???';
  const dateStr = `${month} ${snap.date.year}`;
  const powerStr = `${snap.powerUsed}/${snap.power}`;

  return (
    <header
      className="flex items-center px-2 md:px-4 shrink-0 select-none"
      style={{
        background: '#222',
        borderBottom: '4px solid #000',
        height: undefined, // handled via the h-* utility below
      }}
    >
      {/* Fixed height per breakpoint */}
      <div className="flex items-center w-full h-12 md:h-14 gap-3 md:gap-5 overflow-hidden">
        {/* Title -- desktop only */}
        <span
          className="hidden md:block text-lg tracking-widest font-bold shrink-0"
          style={{ color: 'var(--soviet-red)' }}
        >
          SIMSOVIET 2000
        </span>

        {/* Divider -- desktop only */}
        <span className="hidden md:block w-px self-stretch my-2 bg-concrete/40" />

        {/* Stats row */}
        <div className="flex items-center gap-3 md:gap-5 overflow-hidden">
          <Stat icon="₽" label="RUBLES" value={snap.money} />
          <Stat icon="👤" label="POP" value={snap.pop} />
          <Stat icon="🥔" label="FOOD" value={snap.food} />
          <Stat icon="🍾" label="VODKA" value={snap.vodka} />
          <Stat
            icon="⚡"
            label="POWER"
            value={powerStr}
            color={snap.powerUsed > snap.power ? '#ff4444' : undefined}
          />
          <Stat icon="📅" label="DATE" value={dateStr} color="#dcdcdc" />
          {snap.leaderName && (
            <Stat icon="☭" label="GEN. SEC." value={snap.leaderName} color="#ff6b6b" />
          )}
        </div>

        {/* Spacer */}
        <span className="flex-1" />

        {/* Pause button */}
        <button
          type="button"
          className="btn-retro px-2 py-1 text-sm shrink-0"
          onClick={togglePause}
          title={snap.paused ? 'Resume (Space)' : 'Pause (Space)'}
        >
          {snap.paused ? '▶' : '⏸'}
        </button>
      </div>
    </header>
  );
}
