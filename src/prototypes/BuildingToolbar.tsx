import { AnimatePresence, motion } from 'framer-motion';
import React, { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────

interface Building {
  id: string;
  icon: string;
  name: string;
  cost: number;
}

interface Category {
  key: string;
  label: string;
  icon: string;
  buildings: Building[];
}

// ─── Building Data ───────────────────────────────────────

const CATEGORIES: Category[] = [
  {
    key: 'res',
    label: 'Housing',
    icon: '\u{1F3E0}',
    buildings: [
      { id: 'apartment-tower-a', icon: '\u{1F3E2}', name: 'Tenement Block', cost: 100 },
      { id: 'apartment-tower-b', icon: '\u{1F3E2}', name: 'Tenement Tower', cost: 120 },
      { id: 'apartment-tower-c', icon: '\u{1F3E2}', name: 'High-Rise Block', cost: 180 },
      { id: 'apartment-tower-d', icon: '\u{1F3E2}', name: 'Megablock', cost: 250 },
      { id: 'workers-house-a', icon: '\u{1F3E0}', name: "Workers' House", cost: 80 },
      { id: 'workers-house-b', icon: '\u{1F3E0}', name: "Workers' Duplex", cost: 110 },
      { id: 'workers-house-c', icon: '\u{1F3D8}\uFE0F', name: "Workers' Complex", cost: 200 },
    ],
  },
  {
    key: 'mil',
    label: 'Military',
    icon: '\u{1F396}\uFE0F',
    buildings: [
      { id: 'barracks', icon: '\u{1F396}\uFE0F', name: 'Barracks', cost: 200 },
      { id: 'guard-post', icon: '\u{1F6E1}\uFE0F', name: 'Guard Post', cost: 100 },
    ],
  },
  {
    key: 'ind',
    label: 'Industry',
    icon: '\u{1F3ED}',
    buildings: [
      { id: 'bread-factory', icon: '\u{1F35E}', name: 'Bread Factory', cost: 200 },
      { id: 'collective-farm-hq', icon: '\u{1F954}', name: 'Kolkhoz', cost: 150 },
      { id: 'factory-office', icon: '\u{1F3ED}', name: 'Factory Office', cost: 180 },
      { id: 'vodka-distillery', icon: '\u{1F37E}', name: 'Vodka Plant', cost: 250 },
      { id: 'warehouse', icon: '\u{1F4E6}', name: 'Warehouse', cost: 120 },
    ],
  },
  {
    key: 'utility',
    label: 'Utility',
    icon: '\u{1F527}',
    buildings: [
      { id: 'concrete-block', icon: '\u{1F9F1}', name: 'Concrete Block', cost: 60 },
      { id: 'power-station', icon: '\u26A1', name: 'Coal Plant', cost: 300 },
    ],
  },
  {
    key: 'cul',
    label: 'Culture',
    icon: '\u{1F3AD}',
    buildings: [
      { id: 'cultural-palace', icon: '\u{1F3AD}', name: 'Cultural Palace', cost: 300 },
      { id: 'workers-club', icon: '\u{1F3EA}', name: "Workers' Club", cost: 150 },
    ],
  },
  {
    key: 'env',
    label: 'Perimeter',
    icon: '\u{1F6A7}',
    buildings: [
      { id: 'fence', icon: '\u{1F6A7}', name: 'Fence', cost: 10 },
      { id: 'fence-low', icon: '\u{1F6A7}', name: 'Low Fence', cost: 15 },
    ],
  },
  {
    key: 'svc',
    label: 'Services',
    icon: '\u{1F3E5}',
    buildings: [
      { id: 'fire-station', icon: '\u{1F692}', name: 'Fire Station', cost: 150 },
      { id: 'hospital', icon: '\u{1F3E5}', name: 'Hospital', cost: 250 },
      { id: 'polyclinic', icon: '\u{1F48A}', name: 'Polyclinic', cost: 180 },
      { id: 'post-office', icon: '\u2709\uFE0F', name: 'Post Office', cost: 100 },
      { id: 'school', icon: '\u{1F4DA}', name: 'School', cost: 200 },
    ],
  },
  {
    key: 'gov',
    label: 'Government',
    icon: '\u{1F3DB}\uFE0F',
    buildings: [
      { id: 'government-hq', icon: '\u{1F3DB}\uFE0F', name: 'Government HQ', cost: 400 },
      { id: 'gulag-admin', icon: '\u26D3\uFE0F', name: 'Gulag', cost: 500 },
      { id: 'kgb-office', icon: '\u{1F575}\uFE0F', name: 'KGB Office', cost: 500 },
      { id: 'ministry-office', icon: '\u{1F4CB}', name: 'Ministry Office', cost: 350 },
    ],
  },
  {
    key: 'prop',
    label: 'Propaganda',
    icon: '\u{1F4FB}',
    buildings: [{ id: 'radio-station', icon: '\u{1F4FB}', name: 'Radio Station', cost: 250 }],
  },
  {
    key: 'transport',
    label: 'Transport',
    icon: '\u{1F682}',
    buildings: [{ id: 'train-station', icon: '\u{1F682}', name: 'Train Station', cost: 300 }],
  },
];

// ─── Category Tab ────────────────────────────────────────

const CategoryTab: React.FC<{
  category: Category;
  isActive: boolean;
  onSelect: () => void;
}> = ({ category, isActive, onSelect }) => (
  <button
    type="button"
    onClick={onSelect}
    className={cn(
      'relative flex items-center gap-1.5 px-3 py-2 flex-shrink-0 border-2 transition-colors min-h-[44px]',
      isActive
        ? 'bg-[#8b0000] border-[#8b0000] text-white'
        : 'bg-[#2d2a2a] border-[#444] text-[#ccc] hover:border-[#666] hover:text-white'
    )}
    aria-label={category.label}
    aria-pressed={isActive}
  >
    <span className="text-base leading-none">{category.icon}</span>
    <span className="text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
      {category.label}
    </span>
  </button>
);

// ─── Building Card ───────────────────────────────────────

const BuildingCard: React.FC<{
  building: Building;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ building, isSelected, onSelect }) => (
  <motion.button
    layout
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.9 }}
    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
    onClick={onSelect}
    className={cn(
      'relative flex flex-col items-center gap-1 px-3 py-2 flex-shrink-0 border-2 transition-colors min-h-[44px] min-w-[80px] max-w-[96px]',
      isSelected
        ? 'bg-[#2d2a2a] border-[#cfaa48] shadow-[0_0_8px_rgba(207,170,72,0.3)]'
        : 'bg-[#2d2a2a] border-[#444] hover:border-[#666]'
    )}
    aria-label={`${building.name}, ${building.cost} rubles`}
    aria-pressed={isSelected}
  >
    {/* Building icon */}
    <span className="text-2xl leading-none">{building.icon}</span>

    {/* Building name — truncated */}
    <span
      className={cn(
        'text-[10px] font-bold uppercase tracking-wide leading-tight text-center w-full truncate',
        isSelected ? 'text-[#cfaa48]' : 'text-[#ccc]'
      )}
    >
      {building.name}
    </span>

    {/* Cost with ruble symbol */}
    <span className="flex items-center gap-0.5 text-[10px] font-mono text-[#888]">
      <span className="text-[#cfaa48] text-[9px]">{'\u20BD'}</span>
      {building.cost}
    </span>

    {/* Selected indicator */}
    {isSelected && (
      <motion.div
        layoutId="building-selected-indicator"
        className="absolute -bottom-0.5 left-2 right-2 h-[2px] bg-[#cfaa48]"
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      />
    )}
  </motion.button>
);

// ─── Building Toolbar ────────────────────────────────────

const BuildingToolbar: React.FC<{
  selectedBuilding: string | null;
  onSelectBuilding: (id: string | null) => void;
}> = ({ selectedBuilding, onSelectBuilding }) => {
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0]!.key);
  const buildingScrollRef = useRef<HTMLDivElement>(null);

  const currentCategory = CATEGORIES.find((c) => c.key === activeCategory) ?? CATEGORIES[0]!;

  const handleCategoryChange = (key: string) => {
    setActiveCategory(key);
    // Reset scroll position when switching categories
    if (buildingScrollRef.current) {
      buildingScrollRef.current.scrollLeft = 0;
    }
  };

  const handleBuildingSelect = (id: string) => {
    // Toggle: second tap deselects
    onSelectBuilding(selectedBuilding === id ? null : id);
  };

  return (
    <div className="w-full bg-[#2a2a2a] border-t-2 border-[#8b0000] shadow-[0_-4px_12px_rgba(0,0,0,0.6)]">
      {/* Category tabs row */}
      <div
        className="flex items-center gap-1 px-2 py-1.5 overflow-x-auto scrollbar-hide"
        role="tablist"
        aria-label="Building categories"
      >
        {CATEGORIES.map((cat) => (
          <CategoryTab
            key={cat.key}
            category={cat}
            isActive={activeCategory === cat.key}
            onSelect={() => handleCategoryChange(cat.key)}
          />
        ))}
      </div>

      {/* Divider */}
      <div className="h-px bg-[#444] mx-2" />

      {/* Building cards row */}
      <div
        ref={buildingScrollRef}
        className="flex items-center gap-2 px-2 py-2 overflow-x-auto scrollbar-hide"
        role="tabpanel"
        aria-label={`${currentCategory.label} buildings`}
      >
        <AnimatePresence mode="popLayout">
          {currentCategory.buildings.map((building) => (
            <BuildingCard
              key={building.id}
              building={building}
              isSelected={selectedBuilding === building.id}
              onSelect={() => handleBuildingSelect(building.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ─── Full-Screen Demo Wrapper ────────────────────────────

export const BuildingToolbarDemo: React.FC = () => {
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);

  // Find the selected building's display name
  const selectedBuildingData = selectedBuilding
    ? CATEGORIES.flatMap((c) => c.buildings).find((b) => b.id === selectedBuilding)
    : null;

  return (
    <div
      className="flex flex-col bg-[#1a1a1a] overflow-hidden"
      style={{ fontFamily: "'VT323', monospace", height: '100dvh' }}
    >
      {/* Simulated game viewport */}
      <div className="flex-1 relative overflow-hidden min-h-0">
        {/* Ground texture */}
        <div
          className="absolute inset-0 bg-[#5a4a3a]"
          style={{
            backgroundImage: `
              radial-gradient(circle at 20% 30%, rgba(90, 70, 50, 0.4) 0%, transparent 50%),
              radial-gradient(circle at 80% 70%, rgba(80, 65, 45, 0.4) 0%, transparent 50%),
              radial-gradient(circle at 50% 50%, rgba(85, 68, 48, 0.3) 0%, transparent 60%)
            `,
          }}
        />

        {/* Fake isometric grid */}
        <svg
          className="absolute inset-0 w-full h-full opacity-20"
          role="img"
          aria-label="Isometric grid"
        >
          {Array.from({ length: 20 }).map((_, i) => (
            <React.Fragment key={`grid-${String(i)}`}>
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

        {/* Selection indicator */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <AnimatePresence mode="wait">
            {selectedBuildingData ? (
              <motion.div
                key="selected"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="text-center"
              >
                <div className="text-5xl mb-3">{selectedBuildingData.icon}</div>
                <div className="bg-[#2a2a2a]/90 border-2 border-[#cfaa48] px-4 py-2 shadow-[0_4px_12px_rgba(0,0,0,0.6)]">
                  <div className="text-[#cfaa48] text-xs uppercase tracking-widest mb-0.5">
                    Selected
                  </div>
                  <div className="text-white text-base font-bold uppercase">
                    {selectedBuildingData.name}
                  </div>
                  <div className="text-[#888] text-xs font-mono mt-0.5">
                    {'\u20BD'}
                    {selectedBuildingData.cost} rubles
                  </div>
                </div>
                <div className="text-[#888] text-[10px] mt-2 uppercase tracking-wider">
                  Tap grid to place building
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="text-center"
              >
                <div className="text-5xl mb-3">{'\u{1F3D7}\uFE0F'}</div>
                <div className="text-[#cfaa48] text-base uppercase tracking-widest">
                  Canvas 2D Viewport
                </div>
                <div className="text-[#888] text-xs mt-1">
                  Select a building below to begin placement
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

      {/* Building Toolbar */}
      <BuildingToolbar selectedBuilding={selectedBuilding} onSelectBuilding={setSelectedBuilding} />

      {/* Bottom info strip */}
      <div className="w-full bg-[#1a1a1a] border-t border-[#444] px-3 py-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[#888] text-[10px] uppercase tracking-wider">
            Ministry of Construction
          </span>
          <span className="text-[#888] text-[10px] font-mono">31 structures available</span>
        </div>
      </div>
    </div>
  );
};
