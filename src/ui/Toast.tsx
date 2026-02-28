/**
 * Toast — Notification banner (top-center, auto-dismisses).
 * Port of poc.html line 262.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { Colors, monoFont } from './styles';

export interface ToastProps {
  message: string | null;
  onDismiss: () => void;
  duration?: number; // ms, default 3000
}

export const Toast: React.FC<ToastProps> = ({ message, onDismiss, duration = 3000 }) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) {
      opacity.setValue(0);
      return;
    }

    Animated.timing(opacity, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => onDismiss());
    }, duration);

    return () => clearTimeout(timer);
  }, [message, duration, onDismiss, opacity]);

  if (!message) return null;

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    backgroundColor: 'rgba(140, 0, 0, 0.95)',
    borderWidth: 2,
    borderColor: '#ef5350',
    paddingHorizontal: 32,
    paddingVertical: 10,
    zIndex: 1000,
  },
  text: {
    color: Colors.white,
    fontFamily: monoFont,
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 2,
    textAlign: 'center',
  },
});
