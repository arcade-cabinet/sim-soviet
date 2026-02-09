/**
 * Toolbar -- bottom building-tool palette.
 *
 * Phone:   horizontal scrollable row, compact buttons (icon + name, no cost).
 * Desktop: larger buttons with icon, name, and cost.
 */
import { useGameSnapshot, selectTool } from '@/stores/gameStore';
import { BUILDING_TYPES } from '@/config';

export function Toolbar() {
  const snap = useGameSnapshot();

  return (
    <nav
      className="shrink-0 select-none"
      style={{
        background: '#222',
        borderTop: '4px solid #000',
      }}
    >
      <div
        className="flex items-stretch gap-1 md:gap-2 px-1 md:px-3 py-1 md:py-2 overflow-x-auto md:justify-center"
        style={{
          /* Hide scrollbar but keep scroll on mobile */
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {Object.entries(BUILDING_TYPES).map(([key, bt]) => {
          const isActive = snap.selectedTool === key;
          const canAfford = snap.money >= bt.cost;

          return (
            <button
              key={key}
              className={`btn-retro flex flex-col items-center justify-center px-2 md:px-3 py-1 md:py-2 text-center whitespace-nowrap ${isActive ? 'active' : ''}`}
              style={{
                opacity: canAfford ? 1 : 0.5,
                minWidth: '52px',
              }}
              onClick={() => selectTool(key)}
              title={bt.desc ?? bt.name}
            >
              {/* Icon */}
              <span className="text-lg md:text-xl leading-none">{bt.icon}</span>

              {/* Name */}
              <span className="text-[11px] md:text-xs leading-tight mt-0.5 uppercase">
                {bt.name}
              </span>

              {/* Cost -- hidden on phones */}
              {bt.cost > 0 && (
                <span
                  className="hidden md:block text-[10px] leading-none mt-0.5"
                  style={{ color: 'var(--soviet-gold)' }}
                >
                  {bt.cost}₽
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
