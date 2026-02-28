/**
 * Ticker — Scrolling Pravda news ticker (full-width bar).
 * Port of poc.html lines 287-290.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, useWindowDimensions } from 'react-native';
import { Colors, SharedStyles, monoFont } from './styles';

export interface TickerProps {
  messages: string;
}

export const Ticker: React.FC<TickerProps> = ({ messages }) => {
  const { width: screenWidth } = useWindowDimensions();
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
  }, [messages, screenWidth, translateX]);

  return (
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ translateX }] }}>
        <Text
          style={styles.text}
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
});
