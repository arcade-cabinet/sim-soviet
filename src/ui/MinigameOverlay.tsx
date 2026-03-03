/**
 * MinigameOverlay -- Full-screen overlay that hosts interactive minigame content.
 *
 * Renders the appropriate interactive minigame component based on the
 * minigame's `interactiveType`. Falls back to null for text-choice minigames
 * (which are handled by GameModals).
 */

import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type {
  ActiveMinigame,
  InteractiveMinigameType,
  MinigameOutcome,
} from '../ai/agents/meta/minigames/MinigameTypes';
import { FactoryEmergencyMinigame } from './minigames/FactoryEmergencyMinigame';
import { HuntMinigame } from './minigames/HuntMinigame';
import { InspectionMinigame } from './minigames/InspectionMinigame';
import { Colors, monoFont } from './styles';

export interface MinigameOverlayProps {
  /** The active minigame to render. */
  activeMinigame: ActiveMinigame | null;
  /** Called when the interactive minigame completes with an outcome. */
  onInteractiveComplete: (outcome: MinigameOutcome) => void;
  /** Called to dismiss the overlay. */
  onDismiss: () => void;
}

/**
 * Map interactive minigame results to outcomes based on the minigame definition.
 * @param interactiveType - The type of interactive minigame ('hunt', 'factory_emergency', 'inspection')
 * @param success - Whether the player succeeded at the minigame
 * @param score - Numeric score achieved (interpretation varies by minigame type)
 * @returns A MinigameOutcome with resource deltas, marks, and announcement text
 */
function resolveInteractiveOutcome(
  interactiveType: InteractiveMinigameType,
  success: boolean,
  score: number,
): MinigameOutcome {
  switch (interactiveType) {
    case 'hunt':
      return success
        ? {
            resources: { food: 15 + score * 5 },
            announcement: `The hunt was successful! ${score} targets hit. Fresh meat for the settlement.`,
          }
        : {
            resources: { money: -20 },
            announcement: 'The hunt failed. Ammunition wasted. The deer send their condolences.',
            severity: 'warning',
          };

    case 'factory_emergency':
      return success
        ? {
            announcement: `Factory emergency contained! ${score}/3 valves secured. The boiler survives another day.`,
          }
        : {
            resources: { money: -40, population: -1 },
            blackMarks: 1,
            announcement: 'Factory emergency response failed. Equipment damaged. One worker injured.',
            severity: 'critical',
          };

    case 'inspection':
      return success
        ? {
            commendations: 1,
            announcement: 'Discrepancy found! The spy has been apprehended. A commendation for your vigilance.',
          }
        : {
            blackMarks: 1,
            announcement: 'The spy escaped your inspection. The KGB is not impressed.',
            severity: 'warning',
          };
  }
}

/** Full-screen overlay for interactive (real-time) minigames. */
export const MinigameOverlay: React.FC<MinigameOverlayProps> = ({
  activeMinigame,
  onInteractiveComplete,
  onDismiss,
}) => {
  const [completed, setCompleted] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<MinigameOutcome | null>(null);

  // Reset stale state when a new minigame starts
  useEffect(() => {
    setCompleted(false);
    setLastOutcome(null);
  }, []);

  const interactiveType = activeMinigame?.definition.interactiveType;

  const handleComplete = useCallback(
    (success: boolean, score: number) => {
      if (!interactiveType) return;
      const outcome = resolveInteractiveOutcome(interactiveType, success, score);
      setLastOutcome(outcome);
      setCompleted(true);
      onInteractiveComplete(outcome);
    },
    [interactiveType, onInteractiveComplete],
  );

  const handleDismiss = useCallback(() => {
    setCompleted(false);
    setLastOutcome(null);
    onDismiss();
  }, [onDismiss]);

  // Don't render if no interactive minigame is active
  if (!activeMinigame || !interactiveType || activeMinigame.resolved) {
    return null;
  }

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.modalContainer}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{activeMinigame.definition.name}</Text>
            <Text style={styles.headerStamp}>INTERACTIVE</Text>
          </View>

          {/* Description */}
          <Text style={styles.description}>{activeMinigame.definition.description}</Text>

          {/* Interactive content */}
          {!completed && interactiveType === 'hunt' && <HuntMinigame onComplete={handleComplete} />}
          {!completed && interactiveType === 'factory_emergency' && (
            <FactoryEmergencyMinigame onComplete={handleComplete} />
          )}
          {!completed && interactiveType === 'inspection' && <InspectionMinigame onComplete={handleComplete} />}

          {/* Outcome display */}
          {completed && lastOutcome && (
            <View style={styles.outcomeBox}>
              <Text style={styles.outcomeText}>{lastOutcome.announcement}</Text>
              <TouchableOpacity style={styles.dismissButton} onPress={handleDismiss} activeOpacity={0.7}>
                <Text style={styles.dismissText}>ACKNOWLEDGED</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContainer: {
    maxWidth: 420,
    width: '90%',
  },
  modal: {
    backgroundColor: Colors.panelBg,
    borderWidth: 2,
    borderColor: Colors.sovietGold,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.panelBg,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 2,
  },
  headerStamp: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.termGreen,
    letterSpacing: 1,
    borderWidth: 1,
    borderColor: Colors.termGreen,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  description: {
    fontSize: 12,
    fontFamily: monoFont,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  outcomeBox: {
    marginTop: 12,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.panelBg,
    alignItems: 'center',
  },
  outcomeText: {
    fontSize: 13,
    fontFamily: monoFont,
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  dismissButton: {
    backgroundColor: Colors.sovietRed,
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: Colors.sovietDarkRed,
  },
  dismissText: {
    fontSize: 12,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.white,
    letterSpacing: 2,
  },
});
