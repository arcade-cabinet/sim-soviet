/**
 * Ticker — Scrolling Pravda news ticker (full-width bar).
 * Port of poc.html lines 287-290.
 */

import type React from 'react';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Colors, monoFont } from './styles';
import { useResponsive } from './useResponsive';

export interface TickerProps {
  messages: string;
}

/** Horizontally scrolling Pravda news ticker along the bottom of the screen. */
export const Ticker: React.FC<TickerProps> = ({ messages }) => {
  const { width: screenWidth } = useWindowDimensions();
  const { isCompact } = useResponsive();
  const translateX = useRef(new Animated.Value(0)).current;
  const textWidthRef = useRef(screenWidth * 2);

  useEffect(() => {
    // Start offscreen right, scroll to offscreen left, then loop
    const startX = screenWidth;
    const endX = -textWidthRef.current;

    translateX.setValue(startX);

    const anim = Animated.loop(
      Animated.timing(translateX, {
        toValue: endX,
        duration: 25000,
        useNativeDriver: true,
      }),
    );
    anim.start();

    return () => anim.stop();
  }, [screenWidth, translateX]);

  return (
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ translateX }] }}>
        <Text
          style={[styles.text, isCompact && styles.compactText]}
          onLayout={(e) => {
            textWidthRef.current = e.nativeEvent.layout.width;
          }}
        >
          {messages}
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.black,
    borderTopWidth: 2,
    borderTopColor: Colors.panelHighlight,
    borderBottomWidth: 2,
    borderBottomColor: Colors.panelShadow,
    paddingVertical: 4,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    color: Colors.termGreen,
    fontFamily: monoFont,
    fontSize: 14,
  },
  compactText: {
    fontSize: 12,
  },
});
