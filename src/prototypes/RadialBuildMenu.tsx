import { AnimatePresence, motion } from 'framer-motion';
import React, { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';

// ─── Data ────────────────────────────────────────────────

interface BuildingDef {
  id: string;
  icon: string;
  name: string;
  cost: number;
  footprint: [number, number]; // [x, y] tiles
  enabled: boolean;
}

interface Category {
  id: string;
  label: string;
  icon: string;
  buildings: BuildingDef[];
}

const CATEGORIES: Category[] = [
  {
    id: 'res',
    label: 'Housing',
    icon: '\u{1F3E0}',
    buildings: [
      {
        id: 'workers-house-a',
        icon: '\u{1F3E0}',
        name: "Workers' House",
        cost: 80,
        footprint: [1, 1],
        enabled: true,
      },
      {
        id: 'workers-house-b',
        icon: '\u{1F3E0}',
        name: "Workers' Duplex",
        cost: 110,
        footprint: [1, 1],
        enabled: true,
      },
      {
        id: 'apartment-tower-a',
        icon: '\u{1F3E2}',
        name: 'Tenement Block',
        cost: 100,
        footprint: [1, 1],
        enabled: true,
      },
      {
        id: 'apartment-tower-b',
        icon: '\u{1F3E2}',
        name: 'Tenement Tower',
        cost: 120,
        footprint: [1, 1],
        enabled: true,
      },
      {
        id: 'apartment-tower-c',
        icon: '\u{1F3E2}',
        name: 'High-Rise',
        cost: 180,
        footprint: [2, 2],
        enabled: false,
      },
      {
        id: 'apartment-tower-d',
        icon: '\u{1F3E2}',
        name: 'Megablock',
        cost: 250,
        footprint: [2, 2],
        enabled: false,
      },
      {
        id: 'workers-house-c',
        icon: '\u{1F3D8}\u{FE0F}',
        name: "Workers' Complex",
        cost: 200,
        footprint: [2, 1],
        enabled: true,
      },
    ],
  },
  {
    id: 'ind',
    label: 'Industry',
    icon: '\u{1F3ED}',
    buildings: [
      {
        id: 'collective-farm-hq',
        icon: '\u{1F954}',
        name: 'Kolkhoz',
        cost: 150,
        footprint: [2, 2],
        enabled: false,
      },
      {
        id: 'bread-factory',
        icon: '\u{1F35E}',
        name: 'Bread Factory',
        cost: 200,
        footprint: [2, 1],
        enabled: true,
      },
      {
        id: 'factory-office',
        icon: '\u{1F3ED}',
        name: 'Factory Office',
        cost: 180,
        footprint: [1, 1],
        enabled: true,
      },
      {
        id: 'vodka-distillery',
        icon: '\u{1F37E}',
        name: 'Vodka Plant',
        cost: 250,
        footprint: [2, 2],
        enabled: false,
      },
      {
        id: 'warehouse',
        icon: '\u{1F4E6}',
        name: 'Warehouse',
        cost: 120,
        footprint: [1, 1],
        enabled: true,
      },
    ],
  },
  {
    id: 'mil',
    label: 'Military',
    icon: '\u{1F396}\u{FE0F}',
    buildings: [
      {
        id: 'barracks',
        icon: '\u{1F396}\u{FE0F}',
        name: 'Barracks',
        cost: 200,
        footprint: [2, 1],
        enabled: true,
      },
      {
        id: 'guard-post',
        icon: '\u{1F6E1}\u{FE0F}',
        name: 'Guard Post',
        cost: 100,
        footprint: [1, 1],
        enabled: true,
      },
    ],
  },
  {
    id: 'utility',
    label: 'Utility',
    icon: '\u{1F527}',
    buildings: [
      {
        id: 'power-station',
        icon: '\u{26A1}',
        name: 'Coal Plant',
        cost: 300,
        footprint: [2, 2],
        enabled: false,
      },
      {
        id: 'concrete-block',
        icon: '\u{1F9F1}',
        name: 'Concrete Block',
        cost: 60,
        footprint: [1, 1],
        enabled: true,
      },
    ],
  },
  {
    id: 'svc',
    label: 'Services',
    icon: '\u{1F3E5}',
    buildings: [
      {
        id: 'hospital',
        icon: '\u{1F3E5}',
        name: 'Hospital',
        cost: 250,
        footprint: [2, 1],
        enabled: true,
      },
      {
        id: 'polyclinic',
        icon: '\u{1F48A}',
        name: 'Polyclinic',
        cost: 180,
        footprint: [1, 1],
        enabled: true,
      },
      {
        id: 'school',
        icon: '\u{1F4DA}',
        name: 'School',
        cost: 200,
        footprint: [1, 1],
        enabled: true,
      },
      {
        id: 'fire-station',
        icon: '\u{1F692}',
        name: 'Fire Station',
        cost: 150,
        footprint: [1, 1],
        enabled: true,
      },
      {
        id: 'post-office',
        icon: '\u{2709}\u{FE0F}',
        name: 'Post Office',
        cost: 100,
        footprint: [1, 1],
        enabled: true,
      },
    ],
  },
  {
    id: 'gov',
    label: 'Government',
    icon: '\u{1F3DB}\u{FE0F}',
    buildings: [
      {
        id: 'government-hq',
        icon: '\u{1F3DB}\u{FE0F}',
        name: 'Government HQ',
        cost: 400,
        footprint: [2, 2],
        enabled: false,
      },
      {
        id: 'gulag-admin',
        icon: '\u{26D3}\u{FE0F}',
        name: 'Gulag',
        cost: 500,
        footprint: [2, 2],
        enabled: false,
      },
      {
        id: 'kgb-office',
        icon: '\u{1F575}\u{FE0F}',
        name: 'KGB Office',
        cost: 500,
        footprint: [1, 1],
        enabled: true,
      },
      {
        id: 'ministry-office',
        icon: '\u{1F4CB}',
        name: 'Ministry Office',
        cost: 350,
        footprint: [1, 1],
        enabled: true,
      },
    ],
  },
  {
    id: 'cul',
    label: 'Culture',
    icon: '\u{1F3AD}',
    buildings: [
      {
        id: 'cultural-palace',
        icon: '\u{1F3AD}',
        name: 'Cultural Palace',
        cost: 300,
        footprint: [2, 1],
        enabled: true,
      },
      {
        id: 'workers-club',
        icon: '\u{1F3AA}',
        name: "Workers' Club",
        cost: 150,
        footprint: [1, 1],
        enabled: true,
      },
    ],
  },
  {
    id: 'prop',
    label: 'Propaganda',
    icon: '\u{1F4FB}',
    buildings: [
      {
        id: 'radio-station',
        icon: '\u{1F4FB}',
        name: 'Radio Station',
        cost: 250,
        footprint: [1, 1],
        enabled: true,
      },
    ],
  },
  {
    id: 'env',
    label: 'Perimeter',
    icon: '\u{1F6A7}',
    buildings: [
      { id: 'fence', icon: '\u{1F6A7}', name: 'Fence', cost: 10, footprint: [1, 1], enabled: true },
      {
        id: 'fence-low',
        icon: '\u{1F6A7}',
        name: 'Low Fence',
        cost: 15,
        footprint: [1, 1],
        enabled: true,
      },
    ],
  },
  {
    id: 'transport',
    label: 'Transport',
    icon: '\u{1F682}',
    buildings: [
      {
        id: 'train-station',
        icon: '\u{1F682}',
        name: 'Train Station',
        cost: 300,
        footprint: [2, 2],
        enabled: false,
      },
    ],
  },
];

// ─── Geometry helpers ────────────────────────────────────

function polarToXY(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number
): { x: number; y: number } {
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

// ─── Radial Menu ─────────────────────────────────────────

interface RadialMenuProps {
  x: number;
  y: number;
  availableSpace: number; // max footprint that fits at tap point
  onSelect: (building: BuildingDef) => void;
  onClose: () => void;
}

const INNER_R = 50;
const OUTER_R = 110;
const BUILDING_INNER_R = 120;
const BUILDING_OUTER_R = 185;
const CENTER = 200; // SVG viewBox center

const RadialMenu: React.FC<RadialMenuProps> = ({ x, y, availableSpace, onSelect, onClose }) => {
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  const activeCats = CATEGORIES.filter((c) => c.buildings.some((b) => b.enabled));
  const catAngle = 360 / activeCats.length;
  const gap = 2; // degrees gap between wedges

  const selectedCategory = activeCats.find((c) => c.id === selectedCat);
  const buildings = selectedCategory?.buildings ?? [];
  const buildingAngle = buildings.length > 0 ? 360 / buildings.length : 0;

  return (
    <div
      className="fixed inset-0 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Darken background */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50"
      />

      {/* SVG radial menu positioned at tap point */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute"
        style={{
          left: x - CENTER,
          top: y - CENTER,
          width: CENTER * 2,
          height: CENTER * 2,
        }}
      >
        <svg
          viewBox={`0 0 ${CENTER * 2} ${CENTER * 2}`}
          className="w-full h-full"
          style={{ pointerEvents: 'auto' }}
        >
          {/* Center dot */}
          <circle cx={CENTER} cy={CENTER} r={8} fill="#cfaa48" opacity={0.6} />

          {/* Category ring */}
          {activeCats.map((cat, i) => {
            const startA = i * catAngle + gap / 2;
            const endA = (i + 1) * catAngle - gap / 2;
            const midA = (startA + endA) / 2;
            const labelPos = polarToXY(CENTER, CENTER, (INNER_R + OUTER_R) / 2, midA);
            const isSelected = selectedCat === cat.id;
            const hasEnabled = cat.buildings.some(
              (b) =>
                b.enabled && b.footprint[0] <= availableSpace && b.footprint[1] <= availableSpace
            );

            return (
              <g
                key={cat.id}
                style={{ pointerEvents: 'all', cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCat(isSelected ? null : cat.id);
                }}
              >
                <path
                  d={describeWedge(CENTER, CENTER, INNER_R, OUTER_R, startA, endA)}
                  fill={isSelected ? '#8b0000' : hasEnabled ? '#2a2a2a' : '#1a1a1a'}
                  stroke={isSelected ? '#ff4444' : '#444'}
                  strokeWidth={isSelected ? 2 : 1}
                  opacity={hasEnabled ? 1 : 0.4}
                />
                {/* Category icon */}
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
                {/* Category label */}
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
          })}

          {/* Building ring (appears when category selected) */}
          <AnimatePresence>
            {selectedCat && buildings.length > 0 && (
              <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {/* Connecting arc */}
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

                {buildings.map((bld, i) => {
                  const startA = i * buildingAngle + gap / 2;
                  const endA = (i + 1) * buildingAngle - gap / 2;
                  const midA = (startA + endA) / 2;
                  const labelPos = polarToXY(
                    CENTER,
                    CENTER,
                    (BUILDING_INNER_R + BUILDING_OUTER_R) / 2,
                    midA
                  );
                  const fits =
                    bld.footprint[0] <= availableSpace && bld.footprint[1] <= availableSpace;
                  const canBuild = bld.enabled && fits;

                  return (
                    <g
                      key={bld.id}
                      style={{
                        pointerEvents: 'all',
                        cursor: canBuild ? 'pointer' : 'not-allowed',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (canBuild) onSelect(bld);
                      }}
                    >
                      <motion.path
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: i * 0.05 }}
                        d={describeWedge(
                          CENTER,
                          CENTER,
                          BUILDING_INNER_R,
                          BUILDING_OUTER_R,
                          startA,
                          endA
                        )}
                        fill={canBuild ? '#2a2a2a' : '#1a1a1a'}
                        stroke={canBuild ? '#666' : '#333'}
                        strokeWidth={1}
                        opacity={canBuild ? 1 : 0.35}
                      />
                      {/* Building icon */}
                      <text
                        x={labelPos.x}
                        y={labelPos.y - 8}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize="16"
                        opacity={canBuild ? 1 : 0.3}
                      >
                        {bld.icon}
                      </text>
                      {/* Building name */}
                      <text
                        x={labelPos.x}
                        y={labelPos.y + 7}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize="6"
                        fill={canBuild ? '#ccc' : '#555'}
                        fontFamily="'VT323', monospace"
                      >
                        {bld.name.length > 14 ? `${bld.name.slice(0, 12)}..` : bld.name}
                      </text>
                      {/* Cost */}
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
                        {canBuild ? `\u20BD${bld.cost}` : fits ? 'LOCKED' : "WON'T FIT"}
                      </text>
                    </g>
                  );
                })}
              </motion.g>
            )}
          </AnimatePresence>
        </svg>
      </motion.div>

      {/* Tile info badge near touch point */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="absolute bg-[#2a2a2a] border border-[#8b0000] px-2 py-1 text-[10px] text-[#cfaa48] z-50"
        style={{
          left: x - 40,
          top: y + CENTER + 10,
          fontFamily: "'VT323', monospace",
        }}
      >
        Grid [{Math.floor(Math.random() * 12)},{Math.floor(Math.random() * 12)}] &bull;{' '}
        {availableSpace}x{availableSpace} free
      </motion.div>
    </div>
  );
};

// ─── Demo ────────────────────────────────────────────────

export const RadialBuildMenuDemo: React.FC = () => {
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    space: number;
  } | null>(null);
  const [lastPlaced, setLastPlaced] = useState<string | null>(null);
  const [spaceSize, setSpaceSize] = useState(1);

  const handleTap = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Ignore if menu is open
      if (menu) return;
      setMenu({ x: e.clientX, y: e.clientY, space: spaceSize });
    },
    [menu, spaceSize]
  );

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ fontFamily: "'VT323', monospace", height: '100dvh' }}
    >
      {/* Top bar */}
      <div className="bg-[#2a2a2a] border-b-2 border-[#8b0000] px-3 py-2 flex items-center justify-between">
        <div>
          <div className="text-[#cfaa48] text-sm font-bold">RADIAL BUILD MENU</div>
          <div className="text-[#888] text-[10px]">Tap anywhere on the grid to open</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#888] text-[10px]">Available space:</span>
          {([1, 2, 3] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSpaceSize(s)}
              className={cn(
                'px-2 py-0.5 text-[10px] font-bold border transition-all',
                spaceSize === s
                  ? 'bg-[#8b0000] border-[#ff4444] text-white'
                  : 'bg-[#1a1a1a] border-[#444] text-[#888] hover:text-[#ccc]'
              )}
            >
              {s}x{s}
            </button>
          ))}
        </div>
      </div>

      {/* Grid area */}
      <div className="flex-1 relative overflow-hidden cursor-crosshair" onPointerDown={handleTap}>
        {/* Ground */}
        <div
          className="absolute inset-0 bg-[#5a4a3a]"
          style={{
            backgroundImage: `
              radial-gradient(circle at 30% 40%, rgba(90,70,50,0.4) 0%, transparent 50%),
              radial-gradient(circle at 70% 60%, rgba(80,65,45,0.4) 0%, transparent 50%)
            `,
          }}
        />

        {/* Grid lines */}
        <svg className="absolute inset-0 w-full h-full opacity-20">
          {Array.from({ length: 20 }).map((_, i) => (
            <React.Fragment key={i}>
              <line
                x1={`${50 - i * 5}%`}
                y1="0%"
                x2={`${50 + 30 - i * 5}%`}
                y2="100%"
                stroke="#cfaa48"
                strokeWidth="0.5"
              />
              <line
                x1={`${50 + i * 5}%`}
                y1="0%"
                x2={`${50 - 30 + i * 5}%`}
                y2="100%"
                stroke="#cfaa48"
                strokeWidth="0.5"
              />
            </React.Fragment>
          ))}
        </svg>

        {/* Instructions / last placed */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <AnimatePresence mode="wait">
            {lastPlaced ? (
              <motion.div
                key="placed"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <div className="text-[#cfaa48] text-lg">PLACED</div>
                <div className="text-white text-sm">{lastPlaced}</div>
                <div className="text-[#888] text-[10px] mt-2">Tap grid to place another</div>
              </motion.div>
            ) : (
              <motion.div
                key="hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <div className="text-5xl mb-2 opacity-40">{'\u{1F3D7}\u{FE0F}'}</div>
                <div className="text-[#cfaa48] text-base">TAP GRID TO BUILD</div>
                <div className="text-[#888] text-xs mt-1">
                  Categories ring → Buildings ring → Place
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 40%, rgba(26,26,26,0.3) 70%, rgba(26,26,26,0.7) 95%)',
          }}
        />
      </div>

      {/* Bottom info */}
      <div className="bg-[#2a2a2a] border-t-2 border-[#8b0000] px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="text-[#888] text-[10px]">
            {'\u20BD'}2,450 available &bull; 23 buildings placed
          </div>
          <div className="text-[#666] text-[9px] uppercase tracking-widest">
            Ministry of Construction
          </div>
        </div>
      </div>

      {/* Radial menu overlay */}
      <AnimatePresence>
        {menu && (
          <RadialMenu
            x={menu.x}
            y={menu.y}
            availableSpace={menu.space}
            onSelect={(bld) => {
              setLastPlaced(bld.name);
              setMenu(null);
            }}
            onClose={() => setMenu(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
