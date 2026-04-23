/**
 * GosplanTab — Allocation sliders for resource distribution.
 *
 * Four categories (Food, Industrial, Military, Reserve) must always sum to 100%.
 * Adjusting one slider redistributes the difference proportionally among the others.
 */

import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, monoFont } from '../styles';

// ── Types ───────────────────────────────────────────────────────────────────

/** The four Gosplan allocation categories. */
export type AllocationCategory = 'food' | 'industrial' | 'military' | 'reserve';

/** Allocation percentages keyed by category. Must sum to 100. */
export type Allocations = Record<AllocationCategory, number>;

/** Ordered category definitions for display. */
export const ALLOCATION_CATEGORIES: { key: AllocationCategory; label: string }[] = [
  { key: 'food', label: 'FOOD' },
  { key: 'industrial', label: 'INDUSTRIAL' },
  { key: 'military', label: 'MILITARY' },
  { key: 'reserve', label: 'RESERVE' },
];

/** Default starting allocations (sum = 100). */
export const DEFAULT_ALLOCATIONS: Allocations = {
  food: 40,
  industrial: 30,
  military: 15,
  reserve: 15,
};

/** Era ID for the Great Patriotic War, during which construction is frozen. */
export const GREAT_PATRIOTIC_ERA_ID = 'great_patriotic';

/**
 * Clamp a value between min and max.
 *
 * @param v - value to clamp
 * @param min - lower bound
 * @param max - upper bound
 */
export function clampAllocation(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(v)));
}

/**
 * Redistribute allocations so they sum to 100 after changing one category.
 * The changed category keeps its new value; the difference is distributed
 * proportionally among the other categories (minimum 0 each).
 *
 * @param current - current allocations
 * @param changed - category that was adjusted
 * @param newValue - new percentage for that category (0-100)
 */
export function redistributeAllocations(
  current: Allocations,
  changed: AllocationCategory,
  newValue: number,
): Allocations {
  const clamped = clampAllocation(newValue, 0, 100);
  const others = ALLOCATION_CATEGORIES.filter((c) => c.key !== changed);
  const remaining = 100 - clamped;
  const othersSum = others.reduce((sum, c) => sum + current[c.key], 0);

  const result: Allocations = { ...current, [changed]: clamped };

  if (othersSum === 0) {
    // Edge case: all others are 0, distribute equally
    const share = Math.floor(remaining / others.length);
    let leftover = remaining - share * others.length;
    for (const c of others) {
      result[c.key] = share + (leftover > 0 ? 1 : 0);
      if (leftover > 0) leftover--;
    }
  } else {
    // Proportional redistribution
    let distributed = 0;
    for (let i = 0; i < others.length; i++) {
      if (i === others.length - 1) {
        // Last one gets the remainder to ensure exact sum of 100
        result[others[i].key] = remaining - distributed;
      } else {
        const share = clampAllocation((current[others[i].key] / othersSum) * remaining, 0, remaining - distributed);
        result[others[i].key] = share;
        distributed += share;
      }
    }
  }

  return result;
}

// ── Props ───────────────────────────────────────────────────────────────────

export interface GosplanTabProps {
  currentAllocations: Allocations;
  onAllocationChange: (allocations: Allocations) => void;
  /** Current game era ID. When 'great_patriotic', a construction-freeze notice is displayed. */
  currentEra?: string;
}

// ── Slider bar (pure view — touch-based slider) ────────────────────────────

interface SliderBarProps {
  category: AllocationCategory;
  label: string;
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
}

const SliderBar: React.FC<SliderBarProps> = ({ category, label, value, onDecrement, onIncrement }) => {
  return (
    <View style={sliderStyles.row} testID={`slider-${category}`}>
      <Text style={sliderStyles.label}>{label}</Text>
      <View style={sliderStyles.controls}>
        <Text style={sliderStyles.button} onPress={onDecrement} testID={`dec-${category}`}>
          [-]
        </Text>
        <View style={sliderStyles.barOuter}>
          <View style={[sliderStyles.barFill, { width: `${value}%` }]} />
        </View>
        <Text style={sliderStyles.button} onPress={onIncrement} testID={`inc-${category}`}>
          [+]
        </Text>
      </View>
      <Text style={sliderStyles.value} testID={`value-${category}`}>
        {value}%
      </Text>
    </View>
  );
};

// ── Component ───────────────────────────────────────────────────────────────

export const GosplanTab: React.FC<GosplanTabProps> = ({ currentAllocations, onAllocationChange, currentEra }) => {
  const total = ALLOCATION_CATEGORIES.reduce((sum, c) => sum + currentAllocations[c.key], 0);
  const isWartime = currentEra === GREAT_PATRIOTIC_ERA_ID;

  const handleChange = (category: AllocationCategory, delta: number) => {
    const newValue = currentAllocations[category] + delta;
    const redistributed = redistributeAllocations(currentAllocations, category, newValue);
    onAllocationChange(redistributed);
  };

  return (
    <View style={componentStyles.container}>
      <Text style={componentStyles.heading}>RESOURCE ALLOCATION DIRECTIVE</Text>
      <Text style={componentStyles.subheading}>Distribute collective output across priority sectors</Text>

      {isWartime && (
        <View style={freezeStyles.banner} testID="gpw-freeze-banner">
          <Text style={freezeStyles.marker}>[ ! ]</Text>
          <View style={freezeStyles.body}>
            <Text style={freezeStyles.title}>BUILDING PROGRAMME SUSPENDED</Text>
            <Text style={freezeStyles.subtitle}>TOTAL WAR ECONOMY — 1941–1945</Text>
            <Text style={freezeStyles.detail}>
              Construction halted by State Defence Committee decree.{'\n'}All capacity redirected to frontline
              production.
            </Text>
          </View>
          <Text style={freezeStyles.marker}>[ ! ]</Text>
        </View>
      )}

      {ALLOCATION_CATEGORIES.map((cat) => (
        <SliderBar
          key={cat.key}
          category={cat.key}
          label={cat.label}
          value={currentAllocations[cat.key]}
          onDecrement={() => handleChange(cat.key, -5)}
          onIncrement={() => handleChange(cat.key, 5)}
        />
      ))}

      <View style={componentStyles.totalRow}>
        <Text style={componentStyles.totalLabel}>TOTAL:</Text>
        <Text style={[componentStyles.totalValue, total !== 100 && componentStyles.totalError]}>{total}%</Text>
      </View>
    </View>
  );
};

// ── Styles ──────────────────────────────────────────────────────────────────

const sliderStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  label: {
    fontFamily: monoFont,
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    width: 90,
    letterSpacing: 1,
  },
  controls: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    fontFamily: monoFont,
    fontSize: 14,
    color: Colors.textPrimary,
    paddingHorizontal: 6,
  },
  barOuter: {
    flex: 1,
    height: 12,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#555',
    marginHorizontal: 4,
  },
  barFill: {
    height: '100%',
    backgroundColor: Colors.sovietRed,
  },
  value: {
    fontFamily: monoFont,
    fontSize: 11,
    color: Colors.textPrimary,
    width: 40,
    textAlign: 'right',
  },
});

const componentStyles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  heading: {
    fontFamily: monoFont,
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 4,
  },
  subheading: {
    fontFamily: monoFont,
    fontSize: 9,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#444',
  },
  totalLabel: {
    fontFamily: monoFont,
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    marginRight: 8,
  },
  totalValue: {
    fontFamily: monoFont,
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.termGreen,
  },
  totalError: {
    color: '#ef5350',
  },
});

// ── GPW Freeze Banner Styles ──────────────────────────────────────────────

const freezeStyles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1a0a0a',
    borderWidth: 2,
    borderColor: Colors.sovietRed,
    padding: 10,
    marginBottom: 14,
    gap: 8,
  },
  marker: {
    fontFamily: monoFont,
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.sovietRed,
    paddingTop: 2,
  },
  body: {
    flex: 1,
  },
  title: {
    fontFamily: monoFont,
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.sovietRed,
    letterSpacing: 2,
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 1,
    marginBottom: 4,
  },
  detail: {
    fontFamily: monoFont,
    fontSize: 9,
    color: Colors.textSecondary,
    lineHeight: 14,
  },
});
