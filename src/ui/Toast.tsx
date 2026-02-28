/**
 * Toast — Stacking notification banners (top-right, up to 3 visible, auto-dismiss independently).
 * Replaces the single-toast implementation. New toasts push older ones down.
 */

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Colors, monoFont } from './styles';

const MAX_VISIBLE = 3;
const DEFAULT_DURATION = 3000;

// ── Single Toast Item ────────────────────────────────────────────────────

interface ToastItem {
  id: number;
  message: string;
  duration: number;
}

const ToastEntry: React.FC<{
  item: ToastItem;
  index: number;
  onDone: (id: number) => void;
}> = ({ item, index, onDone }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    // Animate in
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss timer
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -20,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => onDone(item.id));
    }, item.duration);

    return () => clearTimeout(timer);
  }, [item.id, item.duration, onDone, opacity, translateY]);

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          opacity,
          transform: [{ translateY }],
          marginTop: index > 0 ? 6 : 0,
        },
      ]}
    >
      <Text style={styles.text}>{item.message}</Text>
    </Animated.View>
  );
};

// ── Toast Stack (public API matches old single-message interface) ──────

export interface ToastProps {
  message: string | null;
  onDismiss: () => void;
  duration?: number;
}

let _nextToastId = 0;

export const Toast: React.FC<ToastProps> = ({ message, onDismiss, duration = DEFAULT_DURATION }) => {
  const [stack, setStack] = useState<ToastItem[]>([]);
  const lastMsg = useRef<string | null>(null);

  // Push new messages onto the stack
  useEffect(() => {
    if (message && message !== lastMsg.current) {
      lastMsg.current = message;
      _nextToastId++;
      const newItem: ToastItem = { id: _nextToastId, message, duration };
      setStack((prev) => [newItem, ...prev].slice(0, MAX_VISIBLE));
    } else if (!message) {
      lastMsg.current = null;
    }
  }, [message, duration]);

  const handleDone = useCallback(
    (id: number) => {
      setStack((prev) => {
        const next = prev.filter((t) => t.id !== id);
        if (next.length === 0) {
          onDismiss();
        }
        return next;
      });
    },
    [onDismiss],
  );

  if (stack.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {stack.map((item, i) => (
        <ToastEntry key={item.id} item={item} index={i} onDone={handleDone} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 70,
    right: 12,
    alignItems: 'flex-end',
    zIndex: 1000,
  },
  toast: {
    backgroundColor: 'rgba(140, 0, 0, 0.95)',
    borderWidth: 2,
    borderColor: '#ef5350',
    paddingHorizontal: 20,
    paddingVertical: 8,
    maxWidth: 400,
  },
  text: {
    color: Colors.white,
    fontFamily: monoFont,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 2,
    textAlign: 'right',
  },
});
