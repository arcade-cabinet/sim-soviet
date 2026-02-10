/**
 * RadialBuildMenu -- SVG pie menu for building placement.
 *
 * Opens when the player taps an empty grid cell (via CanvasGestureManager).
 * Two-ring interaction: category ring (inner) -> building ring (outer).
 * Building selection triggers placement at the tapped grid cell.
 *
 * Adapted from approved prototype (src/prototypes/RadialBuildMenu.tsx).
 * Data-driven: reads categories and buildings from buildingDefs.ts.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import type { BuildingDef, Role } from '@/data/buildingDefs';
import { BUILDING_DEFS, getBuildingsByRole } from '@/data/buildingDefs';
import {
  closeRadialMenu,
  requestPlacement,
  useGameSnapshot,
  useRadialMenu,
} from '@/stores/gameStore';

// ── Category Definitions ─────────────────────────────────────────────────

interface CategoryDef {
  id: string;
  label: string;
  icon: string;
  roles: Role[];
}

const CATEGORIES: CategoryDef[] = [
  { id: 'res', label: 'Housing', icon: '\u{1F3E0}', roles: ['housing'] },
  { id: 'ind', label: 'Industry', icon: '\u{1F3ED}', roles: ['industry', 'agriculture'] },
  { id: 'utility', label: 'Utility', icon: '\u{1F527}', roles: ['power', 'utility'] },
  { id: 'svc', label: 'Services', icon: '\u{1F3E5}', roles: ['services', 'culture'] },
  {
    id: 'gov',
    label: 'Government',
    icon: '\u{1F3DB}\u{FE0F}',
    roles: ['government', 'propaganda'],
  },
  { id: 'mil', label: 'Military', icon: '\u{1F396}\u{FE0F}', roles: ['military'] },
  { id: 'infra', label: 'Infra', icon: '\u{1F682}', roles: ['transport', 'environment'] },
];

// ── SVG Geometry ─────────────────────────────────────────────────────────

const INNER_R = 50;
const OUTER_R = 110;
const BUILDING_INNER_R = 120;
const BUILDING_OUTER_R = 185;
const CENTER = 200;

function polarToXY(cx: number, cy: number, radius: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

function describeWedge(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number
): string {
  const outerStart = polarToXY(cx, cy, outerR, startAngle);
  const outerEnd = polarToXY(cx, cy, outerR, endAngle);
  const innerEnd = polarToXY(cx, cy, innerR, endAngle);
  const innerStart = polarToXY(cx, cy, innerR, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

/** Check if any building in a category fits the available space. */
function categoryHasFittingBuilding(cat: CategoryDef, availableSpace: number): boolean {
  const ids = cat.roles.flatMap((r) => getBuildingsByRole(r));
  return ids.some((id) => {
    const def = BUILDING_DEFS[id];
    return def && def.footprint.tilesX <= availableSpace && def.footprint.tilesY <= availableSpace;
  });
}

// ── Category Wedge ───────────────────────────────────────────────────────

function CategoryWedge({
  cat,
  index,
  catAngle,
  gap,
  isSelected,
  hasEnabled,
  onToggle,
}: {
  cat: CategoryDef;
  index: number;
  catAngle: number;
  gap: number;
  isSelected: boolean;
  hasEnabled: boolean;
  onToggle: () => void;
}) {
  const startA = index * catAngle + gap / 2;
  const endA = (index + 1) * catAngle - gap / 2;
  const midA = (startA + endA) / 2;
  const labelPos = polarToXY(CENTER, CENTER, (INNER_R + OUTER_R) / 2, midA);

  return (
    // biome-ignore lint/a11y/useSemanticElements: SVG <g> cannot be replaced with <button>
    <g
      role="button"
      tabIndex={0}
      style={{ pointerEvents: 'all', cursor: 'pointer' }}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      aria-label={`${cat.label} category`}
    >
      <path
        d={describeWedge(CENTER, CENTER, INNER_R, OUTER_R, startA, endA)}
        fill={isSelected ? '#8b0000' : hasEnabled ? '#2a2a2a' : '#1a1a1a'}
        stroke={isSelected ? '#ff4444' : '#444'}
        strokeWidth={isSelected ? 2 : 1}
        opacity={hasEnabled ? 1 : 0.4}
      />
      <text
        x={labelPos.x}
        y={labelPos.y - 4}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="18"
        opacity={hasEnabled ? 1 : 0.3}
      >
        {cat.icon}
      </text>
      <text
        x={labelPos.x}
        y={labelPos.y + 14}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="7"
        fill={isSelected ? '#fff' : hasEnabled ? '#ccc' : '#666'}
        fontFamily="'VT323', monospace"
        fontWeight="bold"
        letterSpacing="0.5"
      >
        {cat.label.toUpperCase()}
      </text>
    </g>
  );
}

// ── Building Wedge ───────────────────────────────────────────────────────

function BuildingWedge({
  id,
  def,
  index,
  buildingAngle,
  gap,
  availableSpace,
  money,
  onSelect,
}: {
  id: string;
  def: BuildingDef;
  index: number;
  buildingAngle: number;
  gap: number;
  availableSpace: number;
  money: number;
  onSelect: (defId: string) => void;
}) {
  const startA = index * buildingAngle + gap / 2;
  const endA = (index + 1) * buildingAngle - gap / 2;
  const midA = (startA + endA) / 2;
  const labelPos = polarToXY(CENTER, CENTER, (BUILDING_INNER_R + BUILDING_OUTER_R) / 2, midA);

  const fits = def.footprint.tilesX <= availableSpace && def.footprint.tilesY <= availableSpace;
  const canAfford = money >= def.presentation.cost;
  const canBuild = fits && canAfford;
  const displayName =
    def.presentation.name.length > 14
      ? `${def.presentation.name.slice(0, 12)}..`
      : def.presentation.name;

  return (
    // biome-ignore lint/a11y/useSemanticElements: SVG <g> cannot be replaced with <button>
    <g
      role="button"
      tabIndex={0}
      style={{ pointerEvents: 'all', cursor: canBuild ? 'pointer' : 'not-allowed' }}
      onClick={(e) => {
        e.stopPropagation();
        if (canBuild) onSelect(id);
      }}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && canBuild) {
          e.preventDefault();
          onSelect(id);
        }
      }}
      aria-label={`${def.presentation.name} - ${canBuild ? `${def.presentation.cost} rubles` : "won't fit"}`}
    >
      <motion.path
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: index * 0.05 }}
        d={describeWedge(CENTER, CENTER, BUILDING_INNER_R, BUILDING_OUTER_R, startA, endA)}
        fill={canBuild ? '#2a2a2a' : '#1a1a1a'}
        stroke={canBuild ? '#666' : '#333'}
        strokeWidth={1}
        opacity={canBuild ? 1 : 0.35}
      />
      <text
        x={labelPos.x}
        y={labelPos.y - 8}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="16"
        opacity={canBuild ? 1 : 0.3}
      >
        {def.presentation.icon}
      </text>
      <text
        x={labelPos.x}
        y={labelPos.y + 7}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="6"
        fill={canBuild ? '#ccc' : '#555'}
        fontFamily="'VT323', monospace"
      >
        {displayName}
      </text>
      <text
        x={labelPos.x}
        y={labelPos.y + 17}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="7"
        fill={canBuild ? '#cfaa48' : '#555'}
        fontFamily="'VT323', monospace"
        fontWeight="bold"
      >
        {fits ? `\u20BD${def.presentation.cost}` : "WON'T FIT"}
      </text>
    </g>
  );
}

// ── Main Component ───────────────────────────────────────────────────────

export function RadialBuildMenu() {
  const menu = useRadialMenu();
  const snap = useGameSnapshot();
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  if (!menu) return null;

  const { screenX, screenY, gridX, gridY, availableSpace } = menu;

  const activeCats = CATEGORIES.filter((c) =>
    c.roles.some((role) => getBuildingsByRole(role).length > 0)
  );
  const catAngle = 360 / activeCats.length;
  const gap = 2;

  const selectedCategory = activeCats.find((c) => c.id === selectedCat);
  const buildingIds = selectedCategory
    ? selectedCategory.roles.flatMap((role) => getBuildingsByRole(role))
    : [];
  buildingIds.sort((a, b) => {
    const defA = BUILDING_DEFS[a];
    const defB = BUILDING_DEFS[b];
    return (defA?.presentation.cost ?? 0) - (defB?.presentation.cost ?? 0);
  });
  const buildingAngle = buildingIds.length > 0 ? 360 / buildingIds.length : 0;

  const handleClose = () => {
    setSelectedCat(null);
    closeRadialMenu();
  };

  const handleSelect = (defId: string) => {
    requestPlacement(gridX, gridY, defId);
    setSelectedCat(null);
    closeRadialMenu();
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismiss is supplementary
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop overlay dismiss pattern
    <div
      className="fixed inset-0 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50"
      />

      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute"
        style={{
          left: screenX - CENTER,
          top: screenY - CENTER,
          width: CENTER * 2,
          height: CENTER * 2,
        }}
      >
        <svg
          viewBox={`0 0 ${CENTER * 2} ${CENTER * 2}`}
          className="w-full h-full"
          style={{ pointerEvents: 'auto' }}
        >
          <title>Build Menu</title>
          <circle cx={CENTER} cy={CENTER} r={8} fill="#cfaa48" opacity={0.6} />

          {activeCats.map((cat, i) => (
            <CategoryWedge
              key={cat.id}
              cat={cat}
              index={i}
              catAngle={catAngle}
              gap={gap}
              isSelected={selectedCat === cat.id}
              hasEnabled={categoryHasFittingBuilding(cat, availableSpace)}
              onToggle={() => setSelectedCat(selectedCat === cat.id ? null : cat.id)}
            />
          ))}

          <AnimatePresence>
            {selectedCat && buildingIds.length > 0 && (
              <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <circle
                  cx={CENTER}
                  cy={CENTER}
                  r={BUILDING_INNER_R - 3}
                  fill="none"
                  stroke="#8b0000"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  opacity={0.5}
                />
                {buildingIds.map((id, i) => {
                  const def = BUILDING_DEFS[id];
                  if (!def) return null;
                  return (
                    <BuildingWedge
                      key={id}
                      id={id}
                      def={def}
                      index={i}
                      buildingAngle={buildingAngle}
                      gap={gap}
                      availableSpace={availableSpace}
                      money={snap.money}
                      onSelect={handleSelect}
                    />
                  );
                })}
              </motion.g>
            )}
          </AnimatePresence>
        </svg>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="absolute bg-[#2a2a2a] border border-[#8b0000] px-2 py-1 text-[10px] text-[#cfaa48] z-50"
        style={{
          left: screenX - 40,
          top: screenY + CENTER + 10,
          fontFamily: "'VT323', monospace",
        }}
      >
        Grid [{gridX},{gridY}] &bull; {availableSpace}x{availableSpace} free
      </motion.div>
    </div>
  );
}
