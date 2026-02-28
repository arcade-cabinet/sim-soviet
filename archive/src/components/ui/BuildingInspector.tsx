/**
 * BuildingInspector — Info panel shown when inspecting a building.
 *
 * Appears as a floating card near the bottom-left when the user taps
 * a building with the Inspect tool (tool='none').
 */
import { setInspected, useInspected } from '@/stores/gameStore';

export function BuildingInspector() {
  const info = useInspected();
  if (!info) return null;

  return (
    <div
      className="absolute bottom-20 left-2 md:left-4 z-10 select-none"
      style={{
        background: 'rgba(0, 0, 0, 0.85)',
        border: '2px solid var(--soviet-gold)',
        maxWidth: '240px',
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{ borderBottom: '1px solid #444' }}
      >
        <span
          className="text-sm font-bold uppercase tracking-wider"
          style={{ color: 'var(--soviet-gold)' }}
        >
          {info.name}
        </span>
        <button
          type="button"
          className="text-concrete hover:text-white text-lg leading-none px-1"
          onClick={() => setInspected(null)}
        >
          &times;
        </button>
      </div>
      <div className="px-3 py-2 space-y-1 text-xs">
        {info.desc && <p className="text-concrete leading-snug">{info.desc}</p>}
        <div className="flex justify-between">
          <span className="text-concrete">Position</span>
          <span>
            ({info.gridX}, {info.gridY})
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-concrete">Size</span>
          <span>
            {info.footprintW}&times;{info.footprintH}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-concrete">Powered</span>
          <span style={{ color: info.powered ? '#4ade80' : '#f87171' }}>
            {info.powered ? 'YES' : 'NO'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-concrete">Cost</span>
          <span style={{ color: 'var(--soviet-gold)' }}>{info.cost}</span>
        </div>
      </div>
    </div>
  );
}
