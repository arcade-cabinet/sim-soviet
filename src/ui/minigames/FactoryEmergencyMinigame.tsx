/**
 * FactoryEmergencyMinigame -- "Factory Emergency" timing-based pressure gauge minigame.
 *
 * A bar fills up continuously. Player must tap when it's in the "green zone"
 * (70-90% full). 3 rounds, need 2/3 correct timing hits.
 */

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, monoFont } from '../styles';

const TOTAL_ROUNDS = 3;
const REQUIRED_SUCCESSES = 2;
const GAUGE_SPEED = 0.015; // Fraction per frame (~60fps => ~1 second to fill)
const GREEN_ZONE_MIN = 0.7;
const GREEN_ZONE_MAX = 0.9;
const GAUGE_WIDTH = 260;
const GAUGE_HEIGHT = 40;

export interface FactoryEmergencyMinigameProps {
  onComplete: (success: boolean, score: number) => void;
}

/** Interactive factory emergency minigame: hit the pressure gauge in the green zone. */
export const FactoryEmergencyMinigame: React.FC<FactoryEmergencyMinigameProps> = ({ onComplete }) => {
  const [round, setRound] = useState(0);
  const [successes, setSuccesses] = useState(0);
  const [gaugeValue, setGaugeValue] = useState(0);
  const [roundResult, setRoundResult] = useState<'hit' | 'miss' | null>(null);
  const [finished, setFinished] = useState(false);
  const animRef = useRef<number | null>(null);
  const gaugeRef = useRef(0);
  const activeRef = useRef(true);

  // Animate the gauge filling
  useEffect(() => {
    if (finished || roundResult !== null) return;

    activeRef.current = true;
    gaugeRef.current = 0;

    const animate = () => {
      if (!activeRef.current) return;

      gaugeRef.current += GAUGE_SPEED;

      // Bounce back if it reaches 1.0
      if (gaugeRef.current >= 1.0) {
        gaugeRef.current = 0;
      }

      setGaugeValue(gaugeRef.current);
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => {
      activeRef.current = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [finished, roundResult]);

  // Advance to next round after showing result
  useEffect(() => {
    if (roundResult === null) return;

    const timer = setTimeout(() => {
      const nextRound = round + 1;
      if (nextRound >= TOTAL_ROUNDS) {
        setFinished(true);
        const finalSuccesses = successes;
        onComplete(finalSuccesses >= REQUIRED_SUCCESSES, finalSuccesses);
      } else {
        setRound(nextRound);
        setRoundResult(null);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [roundResult, round, successes, onComplete]);

  const handleTap = useCallback(() => {
    if (finished || roundResult !== null) return;

    activeRef.current = false;
    if (animRef.current) cancelAnimationFrame(animRef.current);

    const val = gaugeRef.current;
    const isHit = val >= GREEN_ZONE_MIN && val <= GREEN_ZONE_MAX;

    if (isHit) {
      setSuccesses((s) => s + 1);
    }
    setRoundResult(isHit ? 'hit' : 'miss');
  }, [finished, roundResult]);

  const greenLeftPct = GREEN_ZONE_MIN * 100;
  const greenWidthPct = (GREEN_ZONE_MAX - GREEN_ZONE_MIN) * 100;
  const fillPct = gaugeValue * 100;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FACTORY EMERGENCY</Text>
      <Text style={styles.subtitle}>
        Tap when the gauge is in the GREEN ZONE! Round {round + 1}/{TOTAL_ROUNDS}
      </Text>

      {/* Score */}
      <View style={styles.scoreRow}>
        <Text style={styles.scoreText}>
          Successful: {successes}/{REQUIRED_SUCCESSES} needed
        </Text>
      </View>

      {/* Pressure Gauge */}
      <Pressable onPress={handleTap} style={styles.gaugeContainer}>
        <View style={styles.gaugeTrack}>
          {/* Green zone indicator */}
          <View
            style={[
              styles.greenZone,
              {
                left: `${greenLeftPct}%`,
                width: `${greenWidthPct}%`,
              },
            ]}
          />
          {/* Fill bar */}
          <View style={[styles.gaugeFill, { width: `${fillPct}%` }]} />
          {/* Needle indicator */}
          <View style={[styles.needle, { left: `${fillPct}%` }]} />
        </View>

        {/* Zone labels */}
        <View style={styles.zoneLabels}>
          <Text style={styles.zoneLabelDanger}>DANGER</Text>
          <Text style={styles.zoneLabelSafe}>SAFE</Text>
          <Text style={styles.zoneLabelDanger}>OVER</Text>
        </View>
      </Pressable>

      {/* Round result */}
      {roundResult && (
        <View style={styles.resultBox}>
          <Text style={[styles.resultText, roundResult === 'hit' ? styles.resultHit : styles.resultMiss]}>
            {roundResult === 'hit' ? 'PRESSURE STABILIZED!' : 'VALVE MISSED!'}
          </Text>
        </View>
      )}

      {finished && (
        <View style={styles.resultBox}>
          <Text style={[styles.resultText, successes >= REQUIRED_SUCCESSES ? styles.resultHit : styles.resultMiss]}>
            {successes >= REQUIRED_SUCCESSES ? 'FACTORY SAVED' : 'FACTORY DAMAGED'}
          </Text>
        </View>
      )}

      <Text style={styles.instruction}>TAP ANYWHERE TO RELEASE THE VALVE</Text>
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
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
  },
  scoreText: {
    fontSize: 12,
    fontFamily: monoFont,
    color: Colors.textSecondary,
  },
  gaugeContainer: {
    alignSelf: 'center',
    width: GAUGE_WIDTH,
    marginBottom: 12,
  },
  gaugeTrack: {
    width: GAUGE_WIDTH,
    height: GAUGE_HEIGHT,
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#555',
    position: 'relative',
    overflow: 'hidden',
  },
  greenZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 230, 118, 0.25)',
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: Colors.termGreen,
  },
  gaugeFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: 'rgba(198, 40, 40, 0.4)',
  },
  needle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: Colors.sovietGold,
    marginLeft: -1,
  },
  zoneLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  zoneLabelDanger: {
    fontSize: 9,
    fontFamily: monoFont,
    color: Colors.sovietRed,
    letterSpacing: 1,
  },
  zoneLabelSafe: {
    fontSize: 9,
    fontFamily: monoFont,
    color: Colors.termGreen,
    letterSpacing: 1,
  },
  resultBox: {
    alignItems: 'center',
    marginVertical: 8,
  },
  resultText: {
    fontSize: 14,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  resultHit: {
    color: Colors.termGreen,
  },
  resultMiss: {
    color: Colors.sovietRed,
  },
  instruction: {
    fontSize: 10,
    fontFamily: monoFont,
    color: '#546e7a',
    textAlign: 'center',
    letterSpacing: 2,
    marginTop: 4,
  },
});
