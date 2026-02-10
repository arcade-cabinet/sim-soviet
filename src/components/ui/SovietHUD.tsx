/**
 * SovietHUD — top bar replacing the legacy TopBar.
 *
 * Adapted from the approved prototype (src/prototypes/SovietGameHUD.tsx).
 * Wired to real game data via useGameSnapshot().
 *
 * Layout: [Settlement/Date] [Resources...] [Pause] [Speed] [Hamburger]
 */
import { Menu, Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { setGameSpeed, togglePause, useGameSnapshot } from '@/stores/gameStore';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const TIER_LABELS: Record<string, string> = {
  selo: 'Selo',
  posyolok: "Workers' Settlement",
  pgt: 'Urban-Type Settlement',
  gorod: 'City',
};

interface SovietHUDProps {
  onMenuToggle: () => void;
}

/**
 * Renders the game's top HUD bar displaying settlement tier, current date, resources, power status, and controls for pause, speed, and the menu.
 *
 * @param onMenuToggle - Callback invoked when the menu button is pressed.
 * @returns The HUD React element.
 */
export function SovietHUD({ onMenuToggle }: SovietHUDProps) {
  const snap = useGameSnapshot();

  const month = MONTH_NAMES[snap.date.month % 12] ?? '???';
  const dateStr = `${month} ${snap.date.year}`;
  const tierLabel = TIER_LABELS[snap.settlementTier] ?? 'Selo';
  const powerStr = `${snap.powerUsed}/${snap.power}`;
  const powerCritical = snap.powerUsed > snap.power;

  return (
    <div className="w-full bg-[#2a2a2a] border-b-2 border-[#8b0000] shadow-[0_4px_12px_rgba(0,0,0,0.6)] select-none">
      <div className="flex items-center justify-between gap-1 px-2 py-1.5">
        {/* Settlement / Date */}
        <div className="min-w-0 flex-shrink-0">
          <div className="text-[#ff4444] text-[10px] font-bold uppercase tracking-wider truncate">
            {tierLabel}
          </div>
          <div className="text-[#888] text-[9px] font-mono truncate">{dateStr}</div>
        </div>

        {/* Resources — scrollable on mobile */}
        <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0 mx-1 scrollbar-hide">
          <ResourceChip icon="₽" value={snap.money} label="Rubles" />
          <ResourceChip icon="👤" value={snap.pop} label="Population" />
          <ResourceChip icon="🥔" value={snap.food} label="Food" />
          <ResourceChip icon="🍾" value={snap.vodka} label="Vodka" />
          <ResourceChip icon="⚡" value={powerStr} label="Power" alert={powerCritical} />
        </div>

        {/* Controls: Pause + Speed + Hamburger */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Pause */}
          <button
            type="button"
            onClick={togglePause}
            className={cn(
              'flex items-center justify-center w-7 h-7 border transition-all',
              snap.paused
                ? 'bg-[#8b0000] border-[#ff4444] hover:bg-[#a00000]'
                : 'bg-[#1a1a1a] border-[#444] hover:border-[#666]'
            )}
            aria-label={snap.paused ? 'Resume' : 'Pause'}
            title={snap.paused ? 'Resume (Space)' : 'Pause (Space)'}
          >
            {snap.paused ? (
              <Play className="w-3 h-3 text-white" fill="currentColor" />
            ) : (
              <Pause className="w-3 h-3 text-[#ccc]" />
            )}
          </button>

          {/* Speed selector */}
          <div className="flex items-center gap-0.5 bg-[#1a1a1a] border border-[#444] p-0.5">
            {([1, 2, 3] as const).map((speed) => (
              <button
                key={speed}
                type="button"
                onClick={() => setGameSpeed(speed)}
                className={cn(
                  'px-1.5 py-0.5 text-[10px] font-bold font-mono transition-all',
                  snap.gameSpeed === speed
                    ? 'bg-[#8b0000] text-white'
                    : 'bg-transparent text-[#888] hover:text-[#ccc]'
                )}
                aria-label={`Speed ${speed}x`}
              >
                {speed}x
              </button>
            ))}
          </div>

          {/* Hamburger menu */}
          <button
            type="button"
            onClick={onMenuToggle}
            className="flex items-center justify-center w-8 h-8 bg-[#1a1a1a] border border-[#8b0000] hover:bg-[#333] transition-colors flex-shrink-0"
            aria-label="Open menu"
          >
            <Menu className="w-4 h-4 text-[#ff4444]" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Render a compact resource chip that displays an icon and a formatted value.
 *
 * @param icon - Short icon or glyph string shown at the start of the chip
 * @param value - Numeric or string value to display; numbers are rounded and locale-formatted
 * @param label - Tooltip and accessible label for the chip
 * @param alert - If true, visually highlights the chip as an alert (red border and text)
 * @returns A JSX element representing the styled resource chip
 */

function ResourceChip({
  icon,
  value,
  label,
  alert,
}: {
  icon: string;
  value: number | string;
  label: string;
  alert?: boolean;
}) {
  const formatted = typeof value === 'number' ? Math.round(value).toLocaleString() : value;

  return (
    <div
      className={cn(
        'flex items-center gap-0.5 bg-[#1a1a1a] border px-1.5 py-0.5 flex-shrink-0',
        alert ? 'border-[#ff4444]' : 'border-[#444]'
      )}
      title={label}
    >
      <span className="text-xs">{icon}</span>
      <span
        className={cn('text-[10px] font-bold font-mono', alert ? 'text-[#ff4444]' : 'text-[#fff]')}
      >
        {formatted}
      </span>
    </div>
  );
}