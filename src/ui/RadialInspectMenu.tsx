/**
 * RadialInspectMenu — SVG pie menu for inspecting existing buildings (React Native port).
 *
 * Opens when the player taps a placed building. Shows contextual actions
 * in the inner ring based on building type (Info, Workers, Demolish, etc.).
 * Selecting an action shows detail text in the outer ring.
 *
 * Ported from archive/src/components/ui/RadialInspectMenu.tsx.
 */

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import { getUpgradeInfo, isUpgradeable, upgradeECSBuilding } from '../bridge/BuildingPlacement';
import { getEngine } from '../bridge/GameInit';
import { getBuildingDef } from '../data/buildingDefs';
import { getMinigameNameForBuilding } from '../game/minigames/BuildingMinigameMap';
import {
  closeInspectMenu,
  type InspectBuildingType,
  type InspectMenuState,
  openBuildingInspector,
  useInspectMenu,
} from '../stores/gameStore';
import { Colors, monoFont } from './styles';

// ── Action Definitions ────────────────────────────────────────────────────

interface ActionDef {
  id: string;
  label: string;
  icon: string;
  /** Returns detail text for the outer ring when selected. */
  getDetail: (state: InspectMenuState) => string;
  /** Optional callback executed when the action is tapped a second time (while selected). */
  onActivate?: (state: InspectMenuState) => string | null;
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
    onActivate: (state) => {
      openBuildingInspector({
        buildingDefId: state.buildingDefId,
        gridX: state.gridX,
        gridY: state.gridY,
      });
      return null; // Close radial menu
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

/** Housing occupant actions. */
const HOUSEHOLD_ACTIONS: ActionDef[] = [
  {
    id: 'men',
    label: 'Men',
    icon: '\u{1F468}',
    getDetail: (state) => {
      const count = state.occupants?.filter((o) => o.gender === 'male' && o.age >= 18 && o.age < 60).length ?? 0;
      return `Men: ${count}`;
    },
  },
  {
    id: 'women',
    label: 'Women',
    icon: '\u{1F469}',
    getDetail: (state) => {
      const count = state.occupants?.filter((o) => o.gender === 'female' && o.age >= 18 && o.age < 60).length ?? 0;
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

/** Storage action. */
const STORAGE_ACTION: ActionDef = {
  id: 'inventory',
  label: 'Inventory',
  icon: '\u{1F4E6}',
  getDetail: () => 'Storage contents',
};

/** Construction action. */
const CONSTRUCTION_ACTION: ActionDef = {
  id: 'construction',
  label: 'Progress',
  icon: '\u{1F6A7}',
  getDetail: () => 'Construction in progress',
};

/** Upgrade action — shown for buildings that have an upgrade path. */
const UPGRADE_ACTION: ActionDef = {
  id: 'upgrade',
  label: 'Upgrade',
  icon: '\u{2B06}',
  getDetail: (state) => {
    const info = getUpgradeInfo(state.buildingDefId);
    if (!info) return 'MAX LEVEL';
    const nextDef = getBuildingDef(info.nextDefId);
    const nextName = nextDef?.presentation.name ?? info.nextDefId;
    return `Upgrade to ${nextName} (${info.cost} rubles)`;
  },
  onActivate: (state) => {
    const result = upgradeECSBuilding(state.gridX, state.gridY);
    if (result.success) {
      return null; // Close menu on success
    }
    return result.reason ?? 'Upgrade failed';
  },
};

/**
 * Create a minigame action for a building.
 * Returns null if no minigame is mapped for the building defId,
 * or if the minigame is on cooldown / another minigame is active.
 */
function createMinigameAction(buildingDefId: string): ActionDef | null {
  const minigameName = getMinigameNameForBuilding(buildingDefId);
  if (!minigameName) return null;

  const engine = getEngine();
  if (!engine || !engine.isMinigameAvailable(buildingDefId)) return null;

  return {
    id: 'minigame',
    label: minigameName,
    icon: '\u{26A1}', // Lightning bolt — special action
    getDetail: () => `SPECIAL ACTION: ${minigameName}`,
    onActivate: (state) => {
      const eng = getEngine();
      if (eng) {
        eng.checkBuildingTapMinigame(state.buildingDefId);
      }
      return null; // Close menu — minigame modal will open via callback chain
    },
  };
}

/**
 * Resolve the set of actions based on building type.
 * Includes the UPGRADE action if the building has an upgrade path.
 * Includes the MINIGAME action if a building-tap minigame is available.
 */
function getActionsForType(buildingType: InspectBuildingType, buildingDefId: string): ActionDef[] {
  const canUpgrade = isUpgradeable(buildingDefId);
  const upgradeSlice = canUpgrade ? [UPGRADE_ACTION] : [];
  const minigameAction = createMinigameAction(buildingDefId);
  const minigameSlice = minigameAction ? [minigameAction] : [];

  switch (buildingType) {
    case 'housing':
      return [BASE_ACTIONS[0]!, ...HOUSEHOLD_ACTIONS, ...minigameSlice, ...upgradeSlice, BASE_ACTIONS[2]!];
    case 'production':
      return [...BASE_ACTIONS, PRODUCTION_ACTION, ...minigameSlice, ...upgradeSlice];
    case 'storage':
      return [...BASE_ACTIONS, STORAGE_ACTION, ...minigameSlice, ...upgradeSlice];
    case 'construction':
      return [...BASE_ACTIONS, CONSTRUCTION_ACTION, ...minigameSlice];
    case 'government':
      return [...BASE_ACTIONS, ...minigameSlice, ...upgradeSlice];
    default:
      return [...BASE_ACTIONS, ...minigameSlice, ...upgradeSlice];
  }
}

// ── SVG Geometry ─────────────────────────────────────────────────────────

const INNER_R = 50;
const OUTER_R = 110;
const DETAIL_INNER_R = 120;
const DETAIL_OUTER_R = 185;
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

// ── Action Wedge (RN port) ───────────────────────────────────────────────

const ActionWedge: React.FC<{
  action: ActionDef;
  index: number;
  actionAngle: number;
  gap: number;
  isSelected: boolean;
  onToggle: () => void;
}> = ({ action, index, actionAngle, gap, isSelected, onToggle }) => {
  const startA = index * actionAngle + gap / 2;
  const endA = (index + 1) * actionAngle - gap / 2;
  const midA = (startA + endA) / 2;
  const labelPos = polarToXY(CENTER, CENTER, (INNER_R + OUTER_R) / 2, midA);

  const isDemolish = action.id === 'demolish';
  const fillColor = isSelected ? '#8b0000' : isDemolish ? '#3a1a1a' : '#2a2a2a';
  const strokeColor = isSelected ? '#ff4444' : isDemolish ? '#662222' : '#444';

  return (
    <G onPress={onToggle}>
      <Path
        d={describeWedge(CENTER, CENTER, INNER_R, OUTER_R, startA, endA)}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={isSelected ? 2 : 1}
      />
      <SvgText x={labelPos.x} y={labelPos.y - 4} textAnchor="middle" alignmentBaseline="central" fontSize={18}>
        {action.icon}
      </SvgText>
      <SvgText
        x={labelPos.x}
        y={labelPos.y + 14}
        textAnchor="middle"
        alignmentBaseline="central"
        fontSize={7}
        fill={isSelected ? '#fff' : '#ccc'}
        fontFamily={monoFont}
        fontWeight="bold"
        letterSpacing={0.5}
      >
        {action.label.toUpperCase()}
      </SvgText>
    </G>
  );
};

// ── Detail Ring (RN port) ────────────────────────────────────────────────

const DetailRing: React.FC<{ text: string }> = ({ text }) => {
  const displayText = text.length > 40 ? `${text.slice(0, 38)}..` : text;

  return (
    <G>
      <Circle
        cx={CENTER}
        cy={CENTER}
        r={DETAIL_INNER_R - 3}
        fill="none"
        stroke="#8b0000"
        strokeWidth={1}
        strokeDasharray="3 3"
        opacity={0.5}
      />
      {/* Full-circle detail background — use a very large arc instead of 0→360 */}
      <Path
        d={describeWedge(CENTER, CENTER, DETAIL_INNER_R, DETAIL_OUTER_R, 0, 359.99)}
        fill="#1e1e1e"
        stroke="#333"
        strokeWidth={1}
        opacity={0.85}
      />
      <SvgText
        x={CENTER}
        y={CENTER - DETAIL_INNER_R - 20}
        textAnchor="middle"
        alignmentBaseline="central"
        fontSize={9}
        fill={Colors.sovietGold}
        fontFamily={monoFont}
        fontWeight="bold"
        letterSpacing={1}
      >
        {displayText}
      </SvgText>
    </G>
  );
};

// ── Main Component ───────────────────────────────────────────────────────

export const RadialInspectMenu: React.FC = () => {
  const menu = useInspectMenu();
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [detailOverride, setDetailOverride] = useState<string | null>(null);

  // Animation values
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

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

  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 150,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSelectedAction(null);
      setDetailOverride(null);
      closeInspectMenu();
    });
  }, [scaleAnim, opacityAnim]);

  if (!menu) return null;

  const { screenX, screenY, buildingType, buildingDefId } = menu;
  const def = getBuildingDef(buildingDefId);
  const buildingName = def?.presentation.name ?? buildingDefId;

  const actions = getActionsForType(buildingType, buildingDefId);
  const actionAngle = 360 / actions.length;
  const gap = 2;

  const selectedActionDef = actions.find((a) => a.id === selectedAction);
  const detailText = detailOverride ?? selectedActionDef?.getDetail(menu) ?? null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />

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
        <Svg width={VIEW_SIZE} height={VIEW_SIZE} viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}>
          {/* Center pip — dark red for inspect */}
          <Circle cx={CENTER} cy={CENTER} r={8} fill="#8b0000" opacity={0.7} />

          {/* Action ring (inner) */}
          {actions.map((action, i) => (
            <ActionWedge
              key={action.id}
              action={action}
              index={i}
              actionAngle={actionAngle}
              gap={gap}
              isSelected={selectedAction === action.id}
              onToggle={() => {
                if (selectedAction === action.id) {
                  // Second tap on selected action — activate if handler exists
                  if (action.onActivate && menu) {
                    const result = action.onActivate(menu);
                    if (result === null) {
                      // Success — close the menu
                      handleClose();
                      return;
                    }
                    // Failure — show reason in detail ring, keep selected
                    setDetailOverride(result);
                    return;
                  }
                  setSelectedAction(null);
                  setDetailOverride(null);
                } else {
                  setSelectedAction(action.id);
                  setDetailOverride(null);
                }
              }}
            />
          ))}

          {/* Detail ring (outer) — shown when action selected */}
          {selectedAction && detailText && <DetailRing text={detailText} />}
        </Svg>
      </Animated.View>

      {/* Building name tooltip */}
      <Animated.View
        style={[
          styles.tooltip,
          {
            left: screenX - 60,
            top: screenY + CENTER + 10,
            opacity: opacityAnim,
          },
        ]}
      >
        <Animated.Text style={styles.tooltipText}>
          {buildingName} {'\u2022'} [{menu.gridX},{menu.gridY}]
          {buildingType === 'housing' &&
            menu.housingCap != null &&
            ` ${'\u2022'} ${menu.occupants?.length ?? 0}/${menu.housingCap} occupants`}
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
