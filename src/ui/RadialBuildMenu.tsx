/**
 * RadialBuildMenu — SVG pie menu for building placement (React Native port).
 *
 * Two-ring interaction: category ring (inner) → building ring (outer).
 * Building selection triggers placement at the tapped grid cell.
 *
 * Ported from archive/src/components/ui/RadialBuildMenu.tsx.
 * Uses react-native-svg instead of DOM <svg>, and React Native Animated
 * instead of framer-motion.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, {
  Circle,
  G,
  Path,
  Text as SvgText,
} from 'react-native-svg';
import { BUILDING_DEFS, getBuildingsByRole } from '../data/buildingDefs';
import type { BuildingDef, Role } from '../data/buildingDefs';
import { DEFAULT_MATERIAL_COST } from '../ecs/systems/constructionSystem';
import { getAvailableBuildingsForYear } from '../game/era';
import type { SettlementTier } from '../game/SettlementSystem';
import {
  closeRadialMenu,
  requestPlacement,
  useRadialMenu,
} from '../stores/gameStore';
import { useGameSnapshot } from '../hooks/useGameState';
import { Colors, monoFont } from './styles';

/** Check if the player can afford the material cost for a building. */
function canAffordBuilding(
  snap: { timber: number; steel: number; cement: number; prefab: number },
  def: BuildingDef
): boolean {
  const cc = def.stats.constructionCost;
  return (
    snap.timber >= (cc?.timber ?? DEFAULT_MATERIAL_COST.timber) &&
    snap.steel >= (cc?.steel ?? DEFAULT_MATERIAL_COST.steel) &&
    snap.cement >= (cc?.cement ?? DEFAULT_MATERIAL_COST.cement) &&
    snap.prefab >= (cc?.prefab ?? 0)
  );
}

/** Format material cost as a compact string for the wedge label. */
function formatMaterialCost(def: BuildingDef): string {
  const cc = def.stats.constructionCost;
  const t = cc?.timber ?? DEFAULT_MATERIAL_COST.timber;
  const s = cc?.steel ?? DEFAULT_MATERIAL_COST.steel;
  const parts: string[] = [];
  if (t > 0) parts.push(`\u{1FAB5}${t}`);
  if (s > 0) parts.push(`\u{1F529}${s}`);
  return parts.join(' ') || 'FREE';
}

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
  { id: 'gov', label: 'Government', icon: '\u{1F3DB}\u{FE0F}', roles: ['government', 'propaganda'] },
  { id: 'mil', label: 'Military', icon: '\u{1F396}\u{FE0F}', roles: ['military'] },
  { id: 'infra', label: 'Infra', icon: '\u{1F682}', roles: ['transport', 'environment'] },
];

// ── SVG Geometry ─────────────────────────────────────────────────────────

const INNER_R = 50;
const OUTER_R = 110;
const BUILDING_INNER_R = 120;
const BUILDING_OUTER_R = 185;
const CENTER = 200;
const VIEW_SIZE = CENTER * 2;

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
  endAngle: number,
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

/** Check if any building in a category fits the available space and is era-unlocked. */
function categoryHasFittingBuilding(
  cat: CategoryDef,
  availableSpace: number,
  eraAvailable: Set<string>,
): boolean {
  const ids = cat.roles.flatMap((r) => getBuildingsByRole(r));
  return ids.some((id) => {
    if (!eraAvailable.has(id)) return false;
    const def = BUILDING_DEFS[id];
    return def && def.footprint.tilesX <= availableSpace && def.footprint.tilesY <= availableSpace;
  });
}

// ── Category Wedge ───────────────────────────────────────────────────────

interface CategoryWedgeProps {
  cat: CategoryDef;
  index: number;
  catAngle: number;
  gap: number;
  isSelected: boolean;
  hasEnabled: boolean;
  onToggle: () => void;
}

const CategoryWedge: React.FC<CategoryWedgeProps> = ({
  cat,
  index,
  catAngle,
  gap,
  isSelected,
  hasEnabled,
  onToggle,
}) => {
  const startA = index * catAngle + gap / 2;
  const endA = (index + 1) * catAngle - gap / 2;
  const midA = (startA + endA) / 2;
  const labelPos = polarToXY(CENTER, CENTER, (INNER_R + OUTER_R) / 2, midA);

  return (
    <G onPress={hasEnabled ? onToggle : undefined} opacity={hasEnabled ? 1 : 0.4}>
      <Path
        d={describeWedge(CENTER, CENTER, INNER_R, OUTER_R, startA, endA)}
        fill={isSelected ? '#8b0000' : hasEnabled ? '#2a2a2a' : '#1a1a1a'}
        stroke={isSelected ? '#ff4444' : '#444'}
        strokeWidth={isSelected ? 2 : 1}
      />
      <SvgText
        x={labelPos.x}
        y={labelPos.y - 4}
        textAnchor="middle"
        alignmentBaseline="central"
        fontSize={18}
        opacity={hasEnabled ? 1 : 0.3}
      >
        {cat.icon}
      </SvgText>
      <SvgText
        x={labelPos.x}
        y={labelPos.y + 14}
        textAnchor="middle"
        alignmentBaseline="central"
        fontSize={7}
        fill={isSelected ? '#fff' : hasEnabled ? '#ccc' : '#666'}
        fontFamily={monoFont}
        fontWeight="bold"
        letterSpacing={0.5}
      >
        {cat.label.toUpperCase()}
      </SvgText>
    </G>
  );
};

// ── Building Wedge ───────────────────────────────────────────────────────

interface BuildingWedgeProps {
  id: string;
  def: BuildingDef;
  index: number;
  buildingAngle: number;
  gap: number;
  availableSpace: number;
  snap: { timber: number; steel: number; cement: number; prefab: number };
  onSelect: (defId: string) => void;
}

const BuildingWedge: React.FC<BuildingWedgeProps> = ({
  id,
  def,
  index,
  buildingAngle,
  gap,
  availableSpace,
  snap,
  onSelect,
}) => {
  const startA = index * buildingAngle + gap / 2;
  const endA = (index + 1) * buildingAngle - gap / 2;
  const midA = (startA + endA) / 2;
  const labelPos = polarToXY(CENTER, CENTER, (BUILDING_INNER_R + BUILDING_OUTER_R) / 2, midA);

  const fits = def.footprint.tilesX <= availableSpace && def.footprint.tilesY <= availableSpace;
  const canAfford = canAffordBuilding(snap, def);
  const canBuild = fits && canAfford;
  const displayName =
    def.presentation.name.length > 14
      ? `${def.presentation.name.slice(0, 12)}..`
      : def.presentation.name;

  return (
    <G
      onPress={canBuild ? () => onSelect(id) : undefined}
      opacity={canBuild ? 1 : 0.35}
    >
      <Path
        d={describeWedge(CENTER, CENTER, BUILDING_INNER_R, BUILDING_OUTER_R, startA, endA)}
        fill={canBuild ? '#2a2a2a' : '#1a1a1a'}
        stroke={canBuild ? '#666' : '#333'}
        strokeWidth={1}
      />
      <SvgText
        x={labelPos.x}
        y={labelPos.y - 8}
        textAnchor="middle"
        alignmentBaseline="central"
        fontSize={16}
      >
        {def.presentation.icon}
      </SvgText>
      <SvgText
        x={labelPos.x}
        y={labelPos.y + 7}
        textAnchor="middle"
        alignmentBaseline="central"
        fontSize={6}
        fill={canBuild ? '#ccc' : '#555'}
        fontFamily={monoFont}
      >
        {displayName}
      </SvgText>
      <SvgText
        x={labelPos.x}
        y={labelPos.y + 17}
        textAnchor="middle"
        alignmentBaseline="central"
        fontSize={7}
        fill={canBuild ? Colors.sovietGold : '#555'}
        fontFamily={monoFont}
        fontWeight="bold"
      >
        {fits ? formatMaterialCost(def) : "WON'T FIT"}
      </SvgText>
    </G>
  );
};

// ── Main Component ───────────────────────────────────────────────────────

export const RadialBuildMenu: React.FC = () => {
  const menu = useRadialMenu();
  const snap = useGameSnapshot();
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  // Animation values
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const outerOpacityAnim = useRef(new Animated.Value(0)).current;

  // Animate in when menu opens
  useEffect(() => {
    if (menu) {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          stiffness: 500,
          damping: 30,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [menu, scaleAnim, opacityAnim]);

  // Animate outer ring when category selected
  useEffect(() => {
    Animated.timing(outerOpacityAnim, {
      toValue: selectedCat ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [selectedCat, outerOpacityAnim]);

  const handleClose = useCallback(() => {
    // Animate out then close
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSelectedCat(null);
      closeRadialMenu();
    });
  }, [scaleAnim, opacityAnim]);

  const handleSelect = useCallback((defId: string) => {
    if (!menu) return;
    requestPlacement(menu.gridX, menu.gridY, defId);
    setSelectedCat(null);
    closeRadialMenu();
  }, [menu]);

  if (!menu) return null;

  const { screenX, screenY, gridX, gridY, availableSpace } = menu;

  // Filter buildings by era + settlement tier
  const eraAvailable = new Set(
    getAvailableBuildingsForYear(snap.year, snap.settlementTier as SettlementTier),
  );

  const activeCats = CATEGORIES.filter((c) =>
    c.roles.some((role) => getBuildingsByRole(role).some((id) => eraAvailable.has(id))),
  );
  const catAngle = activeCats.length > 0 ? 360 / activeCats.length : 0;
  const gap = 2;

  const selectedCategory = activeCats.find((c) => c.id === selectedCat);
  const buildingIds = selectedCategory
    ? selectedCategory.roles
        .flatMap((role) => getBuildingsByRole(role))
        .filter((id) => eraAvailable.has(id))
    : [];
  buildingIds.sort((a, b) => {
    const defA = BUILDING_DEFS[a];
    const defB = BUILDING_DEFS[b];
    const tA = defA?.stats.constructionCost?.timber ?? DEFAULT_MATERIAL_COST.timber;
    const tB = defB?.stats.constructionCost?.timber ?? DEFAULT_MATERIAL_COST.timber;
    return tA - tB;
  });
  const buildingAngle = buildingIds.length > 0 ? 360 / buildingIds.length : 0;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Overlay backdrop */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={handleClose}
      />

      {/* SVG Pie Menu */}
      <Animated.View
        style={[
          styles.menuContainer,
          {
            left: screenX - CENTER,
            top: screenY - CENTER,
            width: VIEW_SIZE,
            height: VIEW_SIZE,
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          },
        ]}
        pointerEvents="box-none"
      >
        <Svg
          width={VIEW_SIZE}
          height={VIEW_SIZE}
          viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
        >
          {/* Center dot */}
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={8}
            fill={Colors.sovietGold}
            opacity={0.6}
          />

          {/* Category ring (inner) */}
          {activeCats.map((cat, i) => (
            <CategoryWedge
              key={cat.id}
              cat={cat}
              index={i}
              catAngle={catAngle}
              gap={gap}
              isSelected={selectedCat === cat.id}
              hasEnabled={categoryHasFittingBuilding(cat, availableSpace, eraAvailable)}
              onToggle={() => setSelectedCat(selectedCat === cat.id ? null : cat.id)}
            />
          ))}

          {/* Building ring (outer) — shown when category selected */}
          {selectedCat && buildingIds.length > 0 && (
            <G>
              {/* Separator ring */}
              <Circle
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
                    snap={{ timber: snap.timber, steel: snap.steel, cement: snap.cement, prefab: snap.prefab }}
                    onSelect={handleSelect}
                  />
                );
              })}
            </G>
          )}
        </Svg>
      </Animated.View>

      {/* Grid info tooltip */}
      <Animated.View
        style={[
          styles.tooltip,
          {
            left: screenX - 50,
            top: screenY + CENTER + 10,
            opacity: opacityAnim,
          },
        ]}
      >
        <Animated.Text style={styles.tooltipText}>
          Grid [{gridX},{gridY}] {'\u2022'} {availableSpace}x{availableSpace} free
        </Animated.Text>
      </Animated.View>
    </View>
  );
};

// ── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  menuContainer: {
    position: 'absolute',
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#8b0000',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tooltipText: {
    fontSize: 10,
    color: Colors.sovietGold,
    fontFamily: monoFont,
    fontWeight: 'bold',
  },
});
