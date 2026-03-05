/**
 * PravdaTicker — Horizontally scrolling news ticker bar.
 *
 * Displays accumulated Pravda headlines in a continuous scroll
 * at the bottom of the screen, styled as a Soviet news broadcast.
 * Shows the current year prominently on the left as a temporal anchor.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Colors, monoFont } from './styles';

const MAX_HEADLINES = 5;
const PLACEHOLDER = '\u0421\u041E\u0412\u0415\u0422\u0421\u041A\u0418\u0419 \u0421\u041E\u042E\u0417 :: \u0420\u0415\u0412\u041E\u041B\u042E\u0426\u0418\u042F \u041F\u0420\u041E\u0414\u041E\u041B\u0416\u0410\u0415\u0422\u0421\u042F ::';
const SCROLL_DURATION_PER_HEADLINE = 4000;

export interface PravdaTickerProps {
  headlines: string[];
  year?: string;
  visible?: boolean;
}

/** Build the display text from headlines (exported for testing). */
export function buildTickerText(headlines: string[]): string {
  const capped = headlines.slice(0, MAX_HEADLINES);
  if (capped.length === 0) return PLACEHOLDER;
  return capped.join(' \u2726 ') + ' \u2726';
}

export const PravdaTicker: React.FC<PravdaTickerProps> = ({ headlines, year, visible = true }) => {
  const scrollX = useRef(new Animated.Value(0)).current;

  const tickerText = useMemo(() => buildTickerText(headlines), [headlines]);

  useEffect(() => {
    if (!visible) return;

    scrollX.setValue(400);

    const duration = Math.max(
      8000,
      headlines.slice(0, MAX_HEADLINES).length * SCROLL_DURATION_PER_HEADLINE,
    );

    const animation = Animated.loop(
      Animated.timing(scrollX, {
        toValue: -tickerText.length * 7,
        duration,
        useNativeDriver: true,
      }),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [tickerText, visible, scrollX, headlines]);

  if (!visible) return null;

  return (
    <View style={styles.container} testID="pravda-ticker">
      {/* Fixed PRAVDA label + year on the left */}
      <View style={styles.labelSection}>
        <Text style={styles.pravdaLabel}>{'\u041F\u0420\u0410\u0412\u0414\u0410'}</Text>
        {year ? <Text style={styles.yearLabel}>{year}</Text> : null}
      </View>

      {/* Scrolling headline area */}
      <View style={styles.scrollArea}>
        <Animated.Text
          style={[
            styles.tickerText,
            { transform: [{ translateX: scrollX }] },
          ]}
          numberOfLines={1}
        >
          {tickerText}
        </Animated.Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 28,
    backgroundColor: Colors.black,
    borderTopWidth: 1,
    borderTopColor: Colors.sovietRed,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 50,
  },
  labelSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 6,
    borderRightWidth: 1,
    borderRightColor: Colors.sovietRed,
    height: '100%',
    justifyContent: 'center',
  },
  pravdaLabel: {
    fontFamily: monoFont,
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.sovietRed,
    letterSpacing: 2,
  },
  yearLabel: {
    fontFamily: monoFont,
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 1,
  },
  scrollArea: {
    flex: 1,
    overflow: 'hidden',
    height: '100%',
    justifyContent: 'center',
  },
  tickerText: {
    fontFamily: monoFont,
    fontSize: 11,
    color: Colors.white,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
