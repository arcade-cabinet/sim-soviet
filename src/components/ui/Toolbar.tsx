/**
 * Toolbar -- bottom building-tool palette.
 *
 * Renders all 31 building types from buildingDefs grouped by category.
 *
 * Layout:
 *   Top row:  [Inspect] [category tabs...] [Bulldoze]
 *   Bottom:   Buildings in selected category (scrollable)
 *
 * Interaction:
 *   - Click/tap → select tool (inspect, bulldoze, or building placement on tap)
 *   - Pointer-drag from a building button → drag-to-place mode
 */
import { useCallback, useRef, useState } from 'react';
import type { Role } from '@/data/buildingDefs';
import { BUILDING_DEFS, getBuildingDef, getBuildingsByRole } from '@/data/buildingDefs';
import { selectTool, setDragState, useGameSnapshot } from '@/stores/gameStore';

/** Category grouping for the toolbar. Merges small roles together. */
const TOOLBAR_CATEGORIES: { key: string; label: string; icon: string; roles: Role[] }[] = [
  { key: 'housing', label: 'Housing', icon: '🏢', roles: ['housing'] },
  { key: 'industry', label: 'Industry', icon: '🏭', roles: ['industry', 'agriculture'] },
  { key: 'power', label: 'Power', icon: '⚡', roles: ['power', 'utility'] },
  { key: 'services', label: 'Services', icon: '🏥', roles: ['services', 'culture'] },
  { key: 'govt', label: 'Govt', icon: '🏛️', roles: ['government', 'propaganda'] },
  { key: 'military', label: 'Military', icon: '🎖️', roles: ['military'] },
  { key: 'infra', label: 'Infra', icon: '🚂', roles: ['transport', 'environment'] },
];

/** Bulldoze cost must match CanvasGestureManager.BULLDOZE_COST. */
const BULLDOZE_COST = 20;

export function Toolbar() {
  const snap = useGameSnapshot();
  const [activeCategory, setActiveCategory] = useState('housing');
  const dragStartRef = useRef<{ key: string; startX: number; startY: number } | null>(null);

  // Get buildings for the selected category
  const categoryDef = TOOLBAR_CATEGORIES.find((c) => c.key === activeCategory);
  const buildingIds = categoryDef
    ? categoryDef.roles.flatMap((role) => getBuildingsByRole(role))
    : [];

  // Sort by cost ascending for intuitive browsing
  buildingIds.sort((a, b) => {
    const defA = BUILDING_DEFS[a];
    const defB = BUILDING_DEFS[b];
    return (defA?.presentation.cost ?? 0) - (defB?.presentation.cost ?? 0);
  });

  const onBuildingPointerDown = useCallback((id: string, e: React.PointerEvent) => {
    dragStartRef.current = { key: id, startX: e.clientX, startY: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onBuildingPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    const { key, startX, startY } = dragStartRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.sqrt(dx * dx + dy * dy) > 8) {
      setDragState({ buildingType: key, screenX: e.clientX, screenY: e.clientY });
    }
  }, []);

  const onBuildingPointerUp = useCallback((id: string) => {
    if (dragStartRef.current) {
      selectTool(id);
      setDragState(null);
      dragStartRef.current = null;
    }
  }, []);

  return (
    <nav
      className="shrink-0 select-none"
      style={{ background: '#222', borderTop: '4px solid #000' }}
    >
      {/* Category tabs + tools */}
      <div
        className="flex items-center gap-1 px-1 py-0.5 overflow-x-auto"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', borderBottom: '1px solid #444' }}
      >
        {/* Inspect button */}
        <button
          type="button"
          className={`btn-retro flex items-center gap-1 px-2 py-1 text-xs whitespace-nowrap ${snap.selectedTool === 'none' ? 'active' : ''}`}
          onClick={() => selectTool('none')}
        >
          <span>🔍</span>
          <span className="hidden md:inline">Inspect</span>
        </button>

        {/* Category tabs */}
        {TOOLBAR_CATEGORIES.map((cat) => (
          <button
            type="button"
            key={cat.key}
            className={`btn-retro flex items-center gap-1 px-2 py-1 text-xs whitespace-nowrap ${activeCategory === cat.key && snap.selectedTool !== 'none' && snap.selectedTool !== 'bulldoze' ? 'active' : ''}`}
            onClick={() => {
              setActiveCategory(cat.key);
              // If inspect or bulldoze is active, also select the first building
              if (snap.selectedTool === 'none' || snap.selectedTool === 'bulldoze') {
                const ids = cat.roles.flatMap((r) => getBuildingsByRole(r));
                if (ids.length > 0) selectTool(ids[0]!);
              }
            }}
          >
            <span>{cat.icon}</span>
            <span className="hidden md:inline">{cat.label}</span>
          </button>
        ))}

        {/* Bulldoze button */}
        <button
          type="button"
          className={`btn-retro flex items-center gap-1 px-2 py-1 text-xs whitespace-nowrap ${snap.selectedTool === 'bulldoze' ? 'active' : ''}`}
          style={{ opacity: snap.money >= BULLDOZE_COST ? 1 : 0.5 }}
          onClick={() => selectTool('bulldoze')}
        >
          <span>💣</span>
          <span className="hidden md:inline">Purge</span>
        </button>
      </div>

      {/* Buildings in selected category */}
      <div
        className="flex items-stretch gap-1 md:gap-2 px-1 md:px-3 py-1 md:py-2 overflow-x-auto md:justify-center"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {buildingIds.map((id) => {
          const def = getBuildingDef(id);
          if (!def) return null;
          const isActive = snap.selectedTool === id;
          const canAfford = snap.money >= def.presentation.cost;

          return (
            <button
              type="button"
              key={id}
              className={`btn-retro flex flex-col items-center justify-center px-2 md:px-3 py-1 md:py-2 text-center whitespace-nowrap ${isActive ? 'active' : ''}`}
              style={{ opacity: canAfford ? 1 : 0.5, minWidth: '52px' }}
              onPointerDown={(e) => onBuildingPointerDown(id, e)}
              onPointerMove={onBuildingPointerMove}
              onPointerUp={() => onBuildingPointerUp(id)}
              title={def.presentation.desc}
            >
              <span className="text-lg md:text-xl leading-none">{def.presentation.icon}</span>
              <span className="text-[11px] md:text-xs leading-tight mt-0.5 uppercase">
                {def.presentation.name}
              </span>
              {def.presentation.cost > 0 && (
                <span
                  className="hidden md:block text-[10px] leading-none mt-0.5"
                  style={{ color: 'var(--soviet-gold)' }}
                >
                  {def.presentation.cost}₽
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
