/**
 * HuntMinigame -- "The Hunt" interactive timing/aiming minigame.
 *
 * A target moves across the screen in a sine wave pattern.
 * Player taps/clicks to "shoot" -- success if tap is within range of target.
 * 30-second time limit, need 3/5 hits to succeed.
 */

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, monoFont } from '../styles';

const GAME_DURATION_MS = 30_000;
const REQUIRED_HITS = 3;
const TOTAL_SHOTS = 5;
const HIT_RADIUS = 50;
const TARGET_SIZE = 40;

/** Area dimensions (logical px) -- we use a fixed-size play area. */
const PLAY_WIDTH = 300;
const PLAY_HEIGHT = 200;

export interface HuntMinigameProps {
  onComplete: (success: boolean, score: number) => void;
}

/** Interactive hunting minigame: tap the moving target to score hits. */
export const HuntMinigame: React.FC<HuntMinigameProps> = ({ onComplete }) => {
  const [targetX, setTargetX] = useState(PLAY_WIDTH / 2);
  const [targetY, setTargetY] = useState(PLAY_HEIGHT / 2);
  const [hits, setHits] = useState(0);
  const [shots, setShots] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_MS);
  const [finished, setFinished] = useState(false);
  const animRef = useRef<number | null>(null);
  const startTimeRef = useRef(Date.now());
  const posRef = useRef({ x: PLAY_WIDTH / 2, y: PLAY_HEIGHT / 2 });

  // Animate the target in a sine wave pattern
  useEffect(() => {
    startTimeRef.current = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = GAME_DURATION_MS - elapsed;

      if (remaining <= 0) {
        setTimeLeft(0);
        return;
      }

      setTimeLeft(remaining);

      const t = elapsed / 1000;
      const x = PLAY_WIDTH / 2 + Math.sin(t * 1.7) * (PLAY_WIDTH * 0.35);
      const y = PLAY_HEIGHT / 2 + Math.sin(t * 2.3 + 1.5) * (PLAY_HEIGHT * 0.35);

      posRef.current = { x, y };
      setTargetX(x);
      setTargetY(y);

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  // Check if game is over
  useEffect(() => {
    if (finished) return;

    if (timeLeft <= 0 || shots >= TOTAL_SHOTS) {
      setFinished(true);
      if (animRef.current) cancelAnimationFrame(animRef.current);
      const success = hits >= REQUIRED_HITS;
      onComplete(success, hits);
    }
  }, [timeLeft, shots, hits, finished, onComplete]);

  const handlePress = useCallback(
    (evt: { nativeEvent: { locationX: number; locationY: number } }) => {
      if (finished || shots >= TOTAL_SHOTS) return;

      const tapX = evt.nativeEvent.locationX;
      const tapY = evt.nativeEvent.locationY;

      const dx = tapX - posRef.current.x;
      const dy = tapY - posRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const isHit = distance <= HIT_RADIUS;
      setShots((s) => s + 1);
      if (isHit) {
        setHits((h) => h + 1);
      }
    },
    [finished, shots],
  );

  const timerPct = Math.max(0, timeLeft / GAME_DURATION_MS) * 100;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>THE HUNT</Text>
      <Text style={styles.subtitle}>
        Tap the target! Need {REQUIRED_HITS}/{TOTAL_SHOTS} hits.
      </Text>

      {/* Timer bar */}
      <View style={styles.timerTrack}>
        <View style={[styles.timerFill, { width: `${timerPct}%` }]} />
      </View>

      {/* Score */}
      <View style={styles.scoreRow}>
        <Text style={styles.scoreText}>
          Hits: {hits}/{REQUIRED_HITS}
        </Text>
        <Text style={styles.scoreText}>
          Shots: {shots}/{TOTAL_SHOTS}
        </Text>
        <Text style={styles.scoreText}>{Math.ceil(timeLeft / 1000)}s</Text>
      </View>

      {/* Play area */}
      <Pressable style={styles.playArea} onPress={handlePress}>
        {!finished && (
          <View
            style={[
              styles.target,
              {
                left: targetX - TARGET_SIZE / 2,
                top: targetY - TARGET_SIZE / 2,
              },
            ]}
          >
            <Text style={styles.targetEmoji}>{'\uD83E\uDD8C'}</Text>
          </View>
        )}
        {finished && (
          <View style={styles.resultOverlay}>
            <Text style={styles.resultText}>{hits >= REQUIRED_HITS ? 'HUNT SUCCESSFUL' : 'HUNT FAILED'}</Text>
            <Text style={styles.resultSubtext}>
              {hits}/{TOTAL_SHOTS} targets hit
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 12,
  },
  title: {
    fontSize: 16,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: monoFont,
    color: '#90a4ae',
    textAlign: 'center',
    marginBottom: 8,
  },
  timerTrack: {
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  timerFill: {
    height: '100%',
    backgroundColor: Colors.termGreen,
    borderRadius: 3,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  scoreText: {
    fontSize: 12,
    fontFamily: monoFont,
    color: Colors.textSecondary,
  },
  playArea: {
    width: PLAY_WIDTH,
    height: PLAY_HEIGHT,
    backgroundColor: '#1a2e1a',
    borderWidth: 1,
    borderColor: '#3a5a3a',
    alignSelf: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  target: {
    position: 'absolute',
    width: TARGET_SIZE,
    height: TARGET_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetEmoji: {
    fontSize: 28,
  },
  resultOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultText: {
    fontSize: 18,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 2,
  },
  resultSubtext: {
    fontSize: 13,
    fontFamily: monoFont,
    color: '#90a4ae',
    marginTop: 4,
  },
});
