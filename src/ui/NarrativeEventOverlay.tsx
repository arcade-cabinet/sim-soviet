/**
 * NarrativeEventOverlay — Full-screen KGB dossier-style display for narrative events.
 *
 * Fires when a timeline milestone activates with narrative choices (onNarrativeEvent).
 * Displays the full scene prose with a typewriter effect, followed by 2-4 player
 * choice buttons with success probability bars. Auto-resolves if the player ignores it.
 *
 * Optionally enriches the scene text via Gemini Flash when EXPO_PUBLIC_GEMINI_API_KEY
 * is set — the static scene from JSON is shown immediately while enrichment loads.
 */

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NarrativeEvent } from '../game/timeline/TimelineLayer';
import { getEnrichedScene } from '../ai/narrative/GeminiNarrativeEnricher';
import { Colors, monoFont } from './styles';

export interface NarrativeEventOverlayProps {
  /** The active narrative event, or null when inactive. */
  event: NarrativeEvent | null;
  /** Called when the player selects a choice (or auto-resolve fires). */
  onResolve: (choiceId: string) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Color for success probability bar. */
function successColor(chance: number): string {
  if (chance >= 0.75) return Colors.termGreen;
  if (chance >= 0.5) return Colors.sovietGold;
  return Colors.sovietRed;
}

/** Ticks → display string. */
function formatTicks(t: number): string {
  if (t <= 0) return 'AUTO-RESOLVING...';
  const years = Math.ceil(t / 12);
  return `AUTO-RESOLVES IN ~${years} ${years === 1 ? 'YEAR' : 'YEARS'}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export const NarrativeEventOverlay: React.FC<NarrativeEventOverlayProps> = ({
  event,
  onResolve,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [displayedScene, setDisplayedScene] = useState('');
  const [typewriterDone, setTypewriterDone] = useState(false);
  const [ticksRemaining, setTicksRemaining] = useState(0);
  const [resolved, setResolved] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset and animate in when a new event arrives
  useEffect(() => {
    if (!event) {
      fadeAnim.setValue(0);
      return;
    }

    setResolved(false);
    setDisplayedScene('');
    setTypewriterDone(false);
    setTicksRemaining(event.tickLimit);

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [event]);

  // Typewriter effect
  useEffect(() => {
    if (!event) return;

    const sourceText = getEnrichedScene(event.milestoneId) ?? event.scene;

    if (typewriterDone) return;

    let index = 0;
    typewriterRef.current = setInterval(() => {
      index += 4; // ~4 chars per frame = readable speed
      const slice = sourceText.slice(0, index);
      setDisplayedScene(slice);
      if (index >= sourceText.length) {
        setDisplayedScene(sourceText);
        setTypewriterDone(true);
        if (typewriterRef.current) clearInterval(typewriterRef.current);
      }
    }, 18);

    return () => {
      if (typewriterRef.current) clearInterval(typewriterRef.current);
    };
  }, [event, typewriterDone]);

  // Auto-resolve countdown (~800ms ≈ 1 display tick)
  useEffect(() => {
    if (!event || resolved) return;

    countdownRef.current = setInterval(() => {
      setTicksRemaining((t) => {
        if (t <= 1) {
          handleChoiceInternal(event.autoResolveChoiceId);
          return 0;
        }
        return t - 1;
      });
    }, 800);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [event, resolved]);

  const handleChoiceInternal = useCallback(
    (choiceId: string) => {
      if (resolved) return;
      setResolved(true);
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (typewriterRef.current) clearInterval(typewriterRef.current);
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start(() => {
        onResolve(choiceId);
      });
    },
    [resolved, onResolve],
  );

  if (!event) return null;

  const progressPct = event.tickLimit > 0 ? ticksRemaining / event.tickLimit : 0;

  return (
    <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
      <View style={styles.document}>
        {/* Header row */}
        <View style={styles.headerRow}>
          <View style={styles.metaBlock}>
            <Text style={styles.divisionLabel}>
              {event.timelineId.replace(/_/g, ' ').toUpperCase()} DIVISION
            </Text>
            <Text style={styles.refNo}>REF: {event.milestoneId.toUpperCase().replace(/_/g, '-')}</Text>
          </View>
          <View style={styles.stamp}>
            <Text style={styles.stampText}>СЕКРЕТНО</Text>
          </View>
        </View>

        {/* Title + headline */}
        <Text style={styles.title}>{event.title.toUpperCase()}</Text>
        <Text style={styles.headline}>{event.headline}</Text>
        <View style={styles.divider} />

        {/* Scene prose */}
        <ScrollView
          style={styles.sceneScroll}
          contentContainerStyle={styles.sceneContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sceneText}>{displayedScene}</Text>
          {!typewriterDone && <Text style={styles.cursor}>█</Text>}
        </ScrollView>

        <View style={styles.divider} />

        {/* Choices — shown after typewriter finishes */}
        {typewriterDone && (
          <View style={styles.choicesSection}>
            <Text style={styles.choicesHeader}>— ДИРЕКТИВА / CHOOSE YOUR RESPONSE —</Text>
            {event.choices.map((choice) => {
              const isDefault = choice.id === event.autoResolveChoiceId;
              return (
                <TouchableOpacity
                  key={choice.id}
                  style={[styles.choiceBtn, isDefault && styles.choiceBtnDefault]}
                  onPress={() => handleChoiceInternal(choice.id)}
                  disabled={resolved}
                  activeOpacity={0.75}
                >
                  <View style={styles.choiceLabelRow}>
                    <Text style={styles.choiceLabel}>{choice.label}</Text>
                    {isDefault && <Text style={styles.defaultTag}>AUTO</Text>}
                  </View>
                  <Text style={styles.choiceDesc}>{choice.description}</Text>

                  {/* Success probability bar */}
                  <View style={styles.probRow}>
                    <View style={styles.probBarBg}>
                      <View
                        style={[
                          styles.probBarFill,
                          {
                            width: `${choice.successChance * 100}%`,
                            backgroundColor: successColor(choice.successChance),
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.probLabel,
                        { color: successColor(choice.successChance) },
                      ]}
                    >
                      {Math.round(choice.successChance * 100)}%
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Auto-resolve countdown */}
        <View style={styles.countdownRow}>
          <View style={styles.countdownBarBg}>
            <View
              style={[
                styles.countdownBarFill,
                {
                  width: `${progressPct * 100}%`,
                  backgroundColor: progressPct > 0.5 ? Colors.termGreen : progressPct > 0.2 ? Colors.sovietGold : Colors.sovietRed,
                },
              ]}
            />
          </View>
          <Text style={styles.countdownLabel}>{formatTicks(ticksRemaining)}</Text>
        </View>
      </View>
    </Animated.View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 900,
  },
  document: {
    width: '90%',
    maxWidth: 680,
    maxHeight: '88%',
    backgroundColor: '#0e0e0e',
    borderWidth: 1,
    borderColor: Colors.sovietRed,
    padding: 18,
    shadowColor: Colors.sovietRed,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  metaBlock: {
    flex: 1,
  },
  divisionLabel: {
    fontFamily: monoFont,
    fontSize: 9,
    color: Colors.textSecondary,
    letterSpacing: 2,
  },
  refNo: {
    fontFamily: monoFont,
    fontSize: 9,
    color: Colors.textMuted,
    marginTop: 2,
  },
  stamp: {
    borderWidth: 2,
    borderColor: Colors.sovietRed,
    paddingHorizontal: 8,
    paddingVertical: 3,
    transform: [{ rotate: '-4deg' }],
  },
  stampText: {
    fontFamily: monoFont,
    fontSize: 11,
    color: Colors.sovietRed,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  title: {
    fontFamily: monoFont,
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 4,
  },
  headline: {
    fontFamily: monoFont,
    fontSize: 11,
    color: Colors.sovietGold,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.panelShadow,
    marginVertical: 8,
  },
  sceneScroll: {
    maxHeight: 200,
    marginBottom: 4,
  },
  sceneContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  sceneText: {
    fontFamily: monoFont,
    fontSize: 12,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  cursor: {
    fontFamily: monoFont,
    fontSize: 12,
    color: Colors.termGreen,
    opacity: 0.9,
  },
  choicesSection: {
    marginTop: 4,
  },
  choicesHeader: {
    fontFamily: monoFont,
    fontSize: 9,
    color: Colors.textSecondary,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 8,
  },
  choiceBtn: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    padding: 10,
    marginBottom: 6,
  },
  choiceBtnDefault: {
    borderColor: Colors.textMuted,
    borderStyle: 'dashed',
  },
  choiceLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  choiceLabel: {
    fontFamily: monoFont,
    fontSize: 12,
    color: Colors.textPrimary,
    fontWeight: 'bold',
    flex: 1,
  },
  defaultTag: {
    fontFamily: monoFont,
    fontSize: 8,
    color: Colors.textMuted,
    borderWidth: 1,
    borderColor: Colors.textMuted,
    paddingHorizontal: 4,
    marginLeft: 6,
  },
  choiceDesc: {
    fontFamily: monoFont,
    fontSize: 10,
    color: Colors.textSecondary,
    marginBottom: 6,
    lineHeight: 15,
  },
  probRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  probBarBg: {
    flex: 1,
    height: 3,
    backgroundColor: '#222',
    marginRight: 6,
  },
  probBarFill: {
    height: 3,
  },
  probLabel: {
    fontFamily: monoFont,
    fontSize: 9,
    width: 30,
    textAlign: 'right',
  },
  countdownRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  countdownBarBg: {
    flex: 1,
    height: 2,
    backgroundColor: '#1a1a1a',
    marginRight: 8,
  },
  countdownBarFill: {
    height: 2,
  },
  countdownLabel: {
    fontFamily: monoFont,
    fontSize: 8,
    color: Colors.textMuted,
    letterSpacing: 1,
    width: 180,
    textAlign: 'right',
  },
});
