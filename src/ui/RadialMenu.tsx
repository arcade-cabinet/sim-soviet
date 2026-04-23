/**
 * RadialMenu — SVG pie menu for building inspection.
 *
 * Data-driven: consumes `useInspectMenu()` and renders actions
 * (Info, Workers, Demolish, etc.) with an optional outer detail ring.
 */

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import { getMinigameNameForBuilding } from '../ai/agents/meta/minigames/BuildingMinigameMap';
import { getUpgradeInfo, isUpgradeable, upgradeECSBuilding } from '../bridge/BuildingPlacement';
import { getEngine } from '../bridge/GameInit';
import { getBuildingDef } from '../data/buildingDefs';
import {
  closeInspectMenu,
  type InspectBuildingType,
  type InspectMenuState,
  openBuildingInspector,
  useInspectMenu,
} from '../stores/gameStore';
import { Colors, monoFont } from './styles';

// ── SVG Geometry (shared) ─────────────────────────────────────────────────

const INNER_R = 50;
const OUTER_R = 110;
const DETAIL_INNER_R = 120;
const DETAIL_OUTER_R = 185;
const CENTER = 200;
const VIEW_SIZE = CENTER * 2;

/** Converts polar coordinates (angle in degrees) to SVG x/y coordinates. */
function polarToXY(cx: number, cy: number, radius: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

/** Generates an SVG path `d` string for an annular wedge (pie sector) between two radii and angles. */
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

// ── Inspect Mode Types ────────────────────────────────────────────────────

interface ActionDef {
  id: string;
  label: string;
  icon: string;
  getDetail: (state: InspectMenuState) => string;
  onActivate?: (state: InspectMenuState) => string | null;
}

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
      return null;
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

const PRODUCTION_ACTION: ActionDef = {
  id: 'production',
  label: 'Output',
  icon: '\u{1F4CA}',
  getDetail: (state) => {
    const def = getBuildingDef(state.buildingDefId);
    if (def?.stats.produces) return `${def.stats.produces.resource}: ${def.stats.produces.amount}/tick`;
    if (def?.stats.powerOutput) return `Power output: ${def.stats.powerOutput}W`;
    return 'No production data';
  },
};

const HOUSEHOLD_ACTIONS: ActionDef[] = [
  {
    id: 'men',
    label: 'Men',
    icon: '\u{1F468}',
    getDetail: (state) => {
      const count =
        state.occupants?.filter((o) => o.gender === 'male' && Number(o.age) >= 18 && Number(o.age) < 60).length ?? 0;
      return `Men: ${count}`;
    },
  },
  {
    id: 'women',
    label: 'Women',
    icon: '\u{1F469}',
    getDetail: (state) => {
      const count =
        state.occupants?.filter((o) => o.gender === 'female' && Number(o.age) >= 18 && Number(o.age) < 60).length ?? 0;
      return `Women: ${count}`;
    },
  },
  {
    id: 'children',
    label: 'Children',
    icon: '\u{1F9D2}',
    getDetail: (state) => {
      const count = state.occupants?.filter((o) => Number(o.age) < 18).length ?? 0;
      return `Children: ${count}`;
    },
  },
  {
    id: 'elders',
    label: 'Elders',
    icon: '\u{1F9D3}',
    getDetail: (state) => {
      const count = state.occupants?.filter((o) => Number(o.age) >= 60).length ?? 0;
      return `Elders: ${count}`;
    },
  },
];

const STORAGE_ACTION: ActionDef = {
  id: 'inventory',
  label: 'Inventory',
  icon: '\u{1F4E6}',
  getDetail: () => 'Storage contents',
};

const CONSTRUCTION_ACTION: ActionDef = {
  id: 'construction',
  label: 'Progress',
  icon: '\u{1F6A7}',
  getDetail: () => 'Construction in progress',
};

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
    if (result.success) return null;
    return result.reason ?? 'Upgrade failed';
  },
};

function createMinigameAction(buildingDefId: string): ActionDef | null {
  const minigameName = getMinigameNameForBuilding(buildingDefId);
  if (!minigameName) return null;
  const engine = getEngine();
  if (!engine || !engine.isMinigameAvailable(buildingDefId)) return null;
  return {
    id: 'minigame',
    label: minigameName,
    icon: '\u{26A1}',
    getDetail: () => `SPECIAL ACTION: ${minigameName}`,
    onActivate: (state) => {
      const eng = getEngine();
      if (eng) eng.checkBuildingTapMinigame(state.buildingDefId);
      return null;
    },
  };
}

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

// ── Generic Wedge Components ──────────────────────────────────────────────

const Wedge: React.FC<{
  index: number;
  totalAngle: number;
  gap: number;
  innerR: number;
  outerR: number;
  icon: string;
  label: string;
  isSelected?: boolean;
  isDisabled?: boolean;
  isDanger?: boolean;
  subLabel?: string;
  subLabelColor?: string;
  iconSize?: number;
  labelSize?: number;
  fillActive?: string;
  fillDefault?: string;
  fillDisabled?: string;
  strokeActive?: string;
  strokeDefault?: string;
  onPress?: () => void;
}> = ({
  index,
  totalAngle,
  gap,
  innerR,
  outerR,
  icon,
  label,
  isSelected = false,
  isDisabled = false,
  isDanger = false,
  subLabel,
  subLabelColor,
  iconSize = 18,
  labelSize = 7,
  fillActive = '#8b0000',
  fillDefault = '#2a2a2a',
  fillDisabled = '#1a1a1a',
  strokeActive = '#ff4444',
  strokeDefault = '#444',
  onPress,
}) => {
  const startA = index * totalAngle + gap / 2;
  const endA = (index + 1) * totalAngle - gap / 2;
  const midA = (startA + endA) / 2;
  const labelPos = polarToXY(CENTER, CENTER, (innerR + outerR) / 2, midA);
  const fill = isDisabled ? fillDisabled : isSelected ? fillActive : isDanger ? '#3a1a1a' : fillDefault;
  const stroke = isDisabled ? '#333' : isSelected ? strokeActive : isDanger ? '#662222' : strokeDefault;

  return (
    <G onPress={!isDisabled ? onPress : undefined} opacity={isDisabled ? 0.3 : 1}>
      <Path
        d={describeWedge(CENTER, CENTER, innerR, outerR, startA, endA)}
        fill={fill}
        stroke={stroke}
        strokeWidth={isSelected ? 2 : 1}
      />
      <SvgText
        x={labelPos.x}
        y={labelPos.y - (subLabel ? 8 : 4)}
        textAnchor="middle"
        alignmentBaseline="central"
        fontSize={iconSize}
        opacity={isDisabled ? 0.3 : 1}
      >
        {icon}
      </SvgText>
      <SvgText
        x={labelPos.x}
        y={labelPos.y + (subLabel ? 6 : 14)}
        textAnchor="middle"
        alignmentBaseline="central"
        fontSize={labelSize}
        fill={isSelected ? '#fff' : isDisabled ? '#666' : '#ccc'}
        fontFamily={monoFont}
        fontWeight="bold"
        letterSpacing={0.5}
      >
        {label.toUpperCase()}
      </SvgText>
      {subLabel && (
        <SvgText
          x={labelPos.x}
          y={labelPos.y + 17}
          textAnchor="middle"
          alignmentBaseline="central"
          fontSize={subLabel.length > 12 ? 5.5 : 7}
          fill={subLabelColor ?? Colors.sovietGold}
          fontFamily={monoFont}
          fontWeight="bold"
        >
          {subLabel}
        </SvgText>
      )}
    </G>
  );
};

// ── Detail Ring ──────────────────────────────────────────────────────────

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

// ══════════════════════════════════════════════════════════════════════════
// Inspect Mode Sub-component
// ══════════════════════════════════════════════════════════════════════════

const InspectModeContent: React.FC<{
  menu: InspectMenuState;
  onClose: () => void;
}> = ({ menu, onClose }) => {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [detailOverride, setDetailOverride] = useState<string | null>(null);

  const actions = getActionsForType(menu.buildingType, menu.buildingDefId);
  const actionAngle = 360 / actions.length;
  const gap = 2;

  const selectedActionDef = actions.find((a) => a.id === selectedAction);
  const detailText = detailOverride ?? selectedActionDef?.getDetail(menu) ?? null;

  return (
    <>
      <Circle cx={CENTER} cy={CENTER} r={8} fill="#8b0000" opacity={0.7} />

      {/* Action ring (inner) */}
      {actions.map((action, i) => (
        <Wedge
          key={action.id}
          index={i}
          totalAngle={actionAngle}
          gap={gap}
          innerR={INNER_R}
          outerR={OUTER_R}
          icon={action.icon}
          label={action.label}
          isSelected={selectedAction === action.id}
          isDanger={action.id === 'demolish'}
          onPress={() => {
            if (selectedAction === action.id) {
              if (action.onActivate) {
                const result = action.onActivate(menu);
                if (result === null) {
                  onClose();
                  return;
                }
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

      {/* Detail ring (outer) */}
      {selectedAction && detailText && <DetailRing text={detailText} />}
    </>
  );
};

// ══════════════════════════════════════════════════════════════════════════
// Main Unified Component
// ══════════════════════════════════════════════════════════════════════════

/** SVG pie menu root for inspecting existing buildings. */
export const RadialMenu: React.FC = () => {
  const inspectMenu = useInspectMenu();

  const menu = inspectMenu;

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (menu) {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, stiffness: 500, damping: 30, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 150, useNativeDriver: Platform.OS !== 'web' }),
      ]).start();
    }
  }, [menu, scaleAnim, opacityAnim]);

  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 150,
        easing: Easing.out(Easing.ease),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 150, useNativeDriver: Platform.OS !== 'web' }),
    ]).start(() => {
      closeInspectMenu();
    });
  }, [scaleAnim, opacityAnim]);

  if (!menu) return null;

  const { screenX, screenY, gridX, gridY } = menu;
  const buildingName = getBuildingDef(inspectMenu.buildingDefId)?.presentation.name ?? inspectMenu.buildingDefId;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />

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
          <InspectModeContent menu={inspectMenu} onClose={handleClose} />
        </Svg>
      </Animated.View>

      {/* Tooltip */}
      <Animated.View style={[styles.tooltip, { left: screenX - 50, top: screenY + CENTER + 10, opacity: opacityAnim }]}>
        <Animated.Text style={styles.tooltipText}>
          {`${buildingName} \u2022 [${gridX},${gridY}]${
            inspectMenu.buildingType === 'housing' && inspectMenu.housingCap != null
              ? ` \u2022 ${inspectMenu.occupants?.length ?? 0}/${inspectMenu.housingCap} occupants`
              : ''
          }`}
        </Animated.Text>
      </Animated.View>
    </View>
  );
};

// Re-export the old inspect name for backward compatibility during migration.
export { RadialMenu as RadialInspectMenu };

// ── Styles ────────────────────────────────────────────────────────────────

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
