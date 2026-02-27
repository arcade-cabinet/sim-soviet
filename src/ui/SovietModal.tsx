/**
 * SovietModal — Reusable modal overlay with Soviet dossier styling.
 *
 * Two style variants:
 * - 'parchment': Light gray paper with dark text (reports, plans, decrees)
 * - 'terminal': Dark background with gold/green text (minigames, eras, alerts)
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, ScrollView } from 'react-native';
import { Colors, monoFont } from './styles';

export interface SovietModalProps {
  visible: boolean;
  variant?: 'parchment' | 'terminal';
  title: string;
  stampText?: string;
  children: React.ReactNode;
  /** Primary action button label */
  actionLabel: string;
  onAction: () => void;
  /** Whether tapping the overlay closes the modal */
  dismissOnOverlay?: boolean;
  onDismiss?: () => void;
}

export const SovietModal: React.FC<SovietModalProps> = ({
  visible,
  variant = 'parchment',
  title,
  stampText,
  children,
  actionLabel,
  onAction,
  dismissOnOverlay = false,
  onDismiss,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible, fadeAnim]);

  if (!visible) return null;

  const isParchment = variant === 'parchment';

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={dismissOnOverlay ? (onDismiss ?? onAction) : undefined}
      />
      <View style={[styles.modal, isParchment ? styles.parchment : styles.terminal]}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text
            style={[styles.title, isParchment ? styles.titleParchment : styles.titleTerminal]}
            numberOfLines={2}
          >
            {title}
          </Text>
          {stampText && (
            <View style={[styles.stamp, isParchment ? styles.stampParchment : styles.stampTerminal]}>
              <Text
                style={[
                  styles.stampLabel,
                  isParchment ? styles.stampLabelParchment : styles.stampLabelTerminal,
                ]}
              >
                {stampText}
              </Text>
            </View>
          )}
        </View>

        {/* Content (scrollable) */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>

        {/* Action button */}
        <TouchableOpacity
          onPress={onAction}
          style={[styles.actionBtn, isParchment ? styles.actionParchment : styles.actionTerminal]}
          activeOpacity={0.8}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    zIndex: 2000,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modal: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '80%',
    padding: 24,
    borderWidth: 2,
    shadowColor: Colors.black,
    shadowOffset: { width: 10, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 0,
    elevation: 20,
  },
  parchment: {
    backgroundColor: '#cfd8dc',
    borderTopColor: Colors.white,
    borderLeftColor: Colors.white,
    borderBottomColor: '#90a4ae',
    borderRightColor: '#90a4ae',
  },
  terminal: {
    backgroundColor: '#1a1a1a',
    borderTopColor: '#444',
    borderLeftColor: '#444',
    borderBottomColor: '#111',
    borderRightColor: '#111',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: {
    flex: 1,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  titleParchment: {
    fontSize: 22,
    color: Colors.black,
  },
  titleTerminal: {
    fontSize: 20,
    color: Colors.sovietGold,
  },
  stamp: {
    borderWidth: 3,
    paddingVertical: 3,
    paddingHorizontal: 10,
    transform: [{ rotate: '-5deg' }],
    opacity: 0.9,
    marginLeft: 8,
  },
  stampParchment: {
    borderColor: Colors.sovietRed,
  },
  stampTerminal: {
    borderColor: Colors.sovietGold,
  },
  stampLabel: {
    fontFamily: monoFont,
    fontWeight: 'bold',
    fontSize: 12,
    letterSpacing: 2,
  },
  stampLabelParchment: {
    color: Colors.sovietRed,
  },
  stampLabelTerminal: {
    color: Colors.sovietGold,
  },
  content: {
    marginBottom: 16,
  },
  actionBtn: {
    width: '100%',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  actionParchment: {
    backgroundColor: Colors.sovietRed,
    borderTopColor: '#ff8a80',
    borderLeftColor: '#ff8a80',
    borderBottomColor: Colors.sovietDarkRed,
    borderRightColor: Colors.sovietDarkRed,
  },
  actionTerminal: {
    backgroundColor: '#333',
    borderTopColor: '#555',
    borderLeftColor: '#555',
    borderBottomColor: '#111',
    borderRightColor: '#111',
  },
  actionText: {
    color: Colors.white,
    fontFamily: monoFont,
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 2,
  },
});
