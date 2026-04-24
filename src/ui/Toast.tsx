/**
 * Toast — Stacking notification banners (top-right, up to 5 visible, auto-dismiss independently).
 * Replaces the single-toast implementation. New toasts push older ones down.
 */

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { Colors, monoFont } from './styles';
import { useResponsive } from './useResponsive';

const MAX_VISIBLE = 5;
const DEFAULT_DURATION = 4000;

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
  compact?: boolean;
}> = ({ item, index, onDone, compact }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    // Animate in
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 150,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();

    // Auto-dismiss timer
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(translateY, {
          toValue: -20,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start(() => onDone(item.id));
    }, item.duration);

    return () => clearTimeout(timer);
  }, [item.id, item.duration, onDone, opacity, translateY]);

  return (
    <Animated.View
      style={[
        styles.toast,
        compact && styles.compactToast,
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

/** Stacking notification banners (top-right, up to 5 visible, auto-dismiss independently). */
export const Toast: React.FC<ToastProps> = ({ message, onDismiss, duration = DEFAULT_DURATION }) => {
  const [stack, setStack] = useState<ToastItem[]>([]);
  const lastMsg = useRef<string | null>(null);
  const { isCompact } = useResponsive();

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
    <View style={[styles.container, isCompact && styles.compactContainer]} pointerEvents="box-none">
      {stack.map((item, i) => (
        <ToastEntry key={item.id} item={item} index={i} onDone={handleDone} compact={isCompact} />
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
  compactContainer: {
    top: 50,
    right: 8,
    left: 8,
    alignItems: 'stretch',
  },
  toast: {
    backgroundColor: 'rgba(140, 0, 0, 0.95)',
    borderWidth: 2,
    borderColor: '#ef5350',
    paddingHorizontal: 20,
    paddingVertical: 8,
    maxWidth: 400,
  },
  compactToast: {
    maxWidth: '100%',
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
