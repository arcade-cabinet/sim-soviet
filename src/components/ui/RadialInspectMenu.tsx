/**
 * RadialInspectMenu -- SVG pie menu for inspecting existing buildings.
 *
 * Opens when the player taps a placed building. Shows contextual actions
 * in the inner ring based on building type (Info, Workers, Demolish, etc.).
 * Selecting an action shows detail text in the outer ring.
 *
 * Uses the same SVG wedge geometry as RadialBuildMenu for visual consistency.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { getBuildingDef } from '@/data/buildingDefs';
import {
  closeInspectMenu,
  type InspectBuildingType,
  type InspectMenuState,
  useInspectMenu,
} from '@/stores/gameStore';

// ── Action Definitions ────────────────────────────────────────────────────

interface ActionDef {
  id: string;
  label: string;
  icon: string;
  /** Returns detail text for the outer ring when selected. */
  getDetail: (state: InspectMenuState) => string;
}

/** Shared actions available for all building types. */
const BASE_ACTIONS: ActionDef[] = [
  {
    id: 'info',
    label: 'Info',
    icon: '\u{1F50D}',
    getDetail: (state) => {
      const def = getBuildingDef(state.buildingDefId);
      const name = def?.presentation.name ?? state.buildingDefId;
      const powered = def?.stats.powerReq ? `Power: ${def.stats.powerReq}W` : 'No power needed';
      return `${name} [${state.gridX},${state.gridY}] ${powered}`;
    },
  },
  {
    id: 'workers',
    label: 'Workers',
    icon: '\u{1F477}',
    getDetail: (state) => {
      const def = getBuildingDef(state.buildingDefId);
      const cap = def?.stats.staffCap ?? def?.stats.jobs ?? 0;
      return `Workers: ${state.workerCount} / ${cap}`;
    },
  },
  {
    id: 'demolish',
    label: 'Demolish',
    icon: '\u{1F4A5}',
    getDetail: () => 'Hold to demolish',
  },
];

/** Extra action for production buildings. */
const PRODUCTION_ACTION: ActionDef = {
  id: 'production',
  label: 'Output',
  icon: '\u{1F4CA}',
  getDetail: (state) => {
    const def = getBuildingDef(state.buildingDefId);
    if (def?.stats.produces) {
      return `${def.stats.produces.resource}: ${def.stats.produces.amount}/tick`;
    }
    if (def?.stats.powerOutput) {
      return `Power output: ${def.stats.powerOutput}W`;
    }
    return 'No production data';
  },
};

/** Housing occupant actions (HOUSEHOLD mode). */
const HOUSEHOLD_ACTIONS: ActionDef[] = [
  {
    id: 'men',
    label: 'Men',
    icon: '\u{1F468}',
    getDetail: (state) => {
      const count =
        state.occupants?.filter((o) => o.gender === 'male' && o.age >= 18 && o.age < 60).length ??
        0;
      return `Men: ${count}`;
    },
  },
  {
    id: 'women',
    label: 'Women',
    icon: '\u{1F469}',
    getDetail: (state) => {
      const count =
        state.occupants?.filter((o) => o.gender === 'female' && o.age >= 18 && o.age < 60).length ??
        0;
      return `Women: ${count}`;
    },
  },
  {
    id: 'children',
    label: 'Children',
    icon: '\u{1F9D2}',
    getDetail: (state) => {
      const count = state.occupants?.filter((o) => o.age < 18).length ?? 0;
      return `Children: ${count}`;
    },
  },
  {
    id: 'elders',
    label: 'Elders',
    icon: '\u{1F9D3}',
    getDetail: (state) => {
      const count = state.occupants?.filter((o) => o.age >= 60).length ?? 0;
      return `Elders: ${count}`;
    },
  },
];

/** Storage action for storage buildings. */
const STORAGE_ACTION: ActionDef = {
  id: 'inventory',
  label: 'Inventory',
  icon: '\u{1F4E6}',
  getDetail: () => 'Storage contents',
};

/** Construction action for buildings under construction. */
const CONSTRUCTION_ACTION: ActionDef = {
  id: 'construction',
  label: 'Progress',
  icon: '\u{1F6A7}',
  getDetail: () => 'Construction in progress',
};

/** Resolve the set of actions based on building type. */
function getActionsForType(buildingType: InspectBuildingType): ActionDef[] {
  switch (buildingType) {
    case 'housing':
      // Housing replaces Workers/Demolish with HOUSEHOLD demographic actions
      return [
        BASE_ACTIONS[0]!, // Info
        ...HOUSEHOLD_ACTIONS,
        BASE_ACTIONS[2]!, // Demolish
      ];
    case 'production':
      return [...BASE_ACTIONS, PRODUCTION_ACTION];
    case 'storage':
      return [...BASE_ACTIONS, STORAGE_ACTION];
    case 'construction':
      return [...BASE_ACTIONS, CONSTRUCTION_ACTION];
    default:
      return [...BASE_ACTIONS];
  }
}

// ── SVG Geometry (shared constants with RadialBuildMenu) ──────────────────

const INNER_R = 50;
const OUTER_R = 110;
const DETAIL_INNER_R = 120;
const DETAIL_OUTER_R = 185;
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

// ── Action Wedge ──────────────────────────────────────────────────────────

function ActionWedge({
  action,
  index,
  actionAngle,
  gap,
  isSelected,
  onToggle,
}: {
  action: ActionDef;
  index: number;
  actionAngle: number;
  gap: number;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const startA = index * actionAngle + gap / 2;
  const endA = (index + 1) * actionAngle - gap / 2;
  const midA = (startA + endA) / 2;
  const labelPos = polarToXY(CENTER, CENTER, (INNER_R + OUTER_R) / 2, midA);

  const isDemolish = action.id === 'demolish';
  const fillColor = isSelected ? '#8b0000' : isDemolish ? '#3a1a1a' : '#2a2a2a';
  const strokeColor = isSelected ? '#ff4444' : isDemolish ? '#662222' : '#444';

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
      aria-label={`${action.label} action`}
    >
      <motion.path
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: index * 0.04 }}
        d={describeWedge(CENTER, CENTER, INNER_R, OUTER_R, startA, endA)}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={isSelected ? 2 : 1}
      />
      <text
        x={labelPos.x}
        y={labelPos.y - 4}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="18"
      >
        {action.icon}
      </text>
      <text
        x={labelPos.x}
        y={labelPos.y + 14}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="7"
        fill={isSelected ? '#fff' : '#ccc'}
        fontFamily="'VT323', monospace"
        fontWeight="bold"
        letterSpacing="0.5"
      >
        {action.label.toUpperCase()}
      </text>
    </g>
  );
}

// ── Detail Ring ───────────────────────────────────────────────────────────

function DetailRing({ text }: { text: string }) {
  // Full-circle wedge for the detail text
  const displayText = text.length > 40 ? `${text.slice(0, 38)}..` : text;

  return (
    <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <circle
        cx={CENTER}
        cy={CENTER}
        r={DETAIL_INNER_R - 3}
        fill="none"
        stroke="#8b0000"
        strokeWidth={1}
        strokeDasharray="3 3"
        opacity={0.5}
      />
      <motion.path
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        d={describeWedge(CENTER, CENTER, DETAIL_INNER_R, DETAIL_OUTER_R, 0, 360)}
        fill="#1e1e1e"
        stroke="#333"
        strokeWidth={1}
        opacity={0.85}
      />
      <text
        x={CENTER}
        y={CENTER - DETAIL_INNER_R - 20}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="9"
        fill="#cfaa48"
        fontFamily="'VT323', monospace"
        fontWeight="bold"
        letterSpacing="1"
      >
        {displayText}
      </text>
    </motion.g>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export function RadialInspectMenu() {
  const menu = useInspectMenu();
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  if (!menu) return null;

  const { screenX, screenY, buildingType, buildingDefId } = menu;
  const def = getBuildingDef(buildingDefId);
  const buildingName = def?.presentation.name ?? buildingDefId;

  const actions = getActionsForType(buildingType);
  const actionAngle = 360 / actions.length;
  const gap = 2;

  const selectedActionDef = actions.find((a) => a.id === selectedAction);
  const detailText = selectedActionDef?.getDetail(menu) ?? null;

  const handleClose = () => {
    setSelectedAction(null);
    closeInspectMenu();
  };

  return (
    <div className="fixed inset-0 z-50">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
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
          <title>Inspect Menu</title>

          {/* Center pip */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={8}
            fill="#8b0000"
            opacity={0.7}
            style={{ pointerEvents: 'none' }}
          />

          {/* Inner ring — action wedges */}
          {actions.map((action, i) => (
            <ActionWedge
              key={action.id}
              action={action}
              index={i}
              actionAngle={actionAngle}
              gap={gap}
              isSelected={selectedAction === action.id}
              onToggle={() => setSelectedAction(selectedAction === action.id ? null : action.id)}
            />
          ))}

          {/* Outer ring — detail text for selected action */}
          <AnimatePresence>
            {selectedAction && detailText && <DetailRing text={detailText} />}
          </AnimatePresence>
        </svg>
      </motion.div>

      {/* Building name label below the radial */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="absolute bg-[#2a2a2a] border border-[#8b0000] px-2 py-1 text-[10px] text-[#cfaa48] z-50"
        style={{
          left: screenX - 60,
          top: screenY + CENTER + 10,
          fontFamily: "'VT323', monospace",
        }}
      >
        {buildingName} &bull; [{menu.gridX},{menu.gridY}]
        {buildingType === 'housing' && menu.housingCap != null && (
          <>
            {' '}
            &bull; {menu.occupants?.length ?? 0}/{menu.housingCap} occupants
          </>
        )}
      </motion.div>
    </div>
  );
}
