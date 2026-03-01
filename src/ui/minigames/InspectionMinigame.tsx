/**
 * InspectionMinigame -- "The Inspection" Papers Please-style document review.
 *
 * Show a worker dossier with 4-5 fields. One field has a discrepancy.
 * Player must tap the incorrect field within 15 seconds.
 * Success: catch the spy (+commendation). Failure: spy escapes (+black mark).
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, monoFont } from '../styles';

const TIME_LIMIT_MS = 15_000;

/** A dossier field that can be correct or discrepant. */
interface DossierField {
  label: string;
  value: string;
  isDiscrepancy: boolean;
}

/** Pre-defined dossier templates. Each has a "correct" set and a single discrepancy. */
const DOSSIER_TEMPLATES = [
  {
    name: 'Petrov, Ivan Sergeevich',
    fields: [
      { label: 'Age', value: '34', isDiscrepancy: false },
      { label: 'Class', value: 'Worker', isDiscrepancy: false },
      { label: 'Assignment', value: 'Tractor Factory', isDiscrepancy: false },
      { label: 'Loyalty Rating', value: 'RELIABLE', isDiscrepancy: false },
      { label: 'Place of Birth', value: 'Leningrad', isDiscrepancy: true }, // Discrepancy: worker from Leningrad in tractor factory?
    ],
    hint: 'Leningrad workers were reassigned to artillery plants in 1943.',
  },
  {
    name: 'Volkova, Maria Ivanovna',
    fields: [
      { label: 'Age', value: '27', isDiscrepancy: false },
      { label: 'Class', value: 'Miner', isDiscrepancy: true }, // Discrepancy: assigned to farm but class is miner
      { label: 'Assignment', value: 'Collective Farm', isDiscrepancy: false },
      { label: 'Loyalty Rating', value: 'QUESTIONABLE', isDiscrepancy: false },
      { label: 'Party Member', value: 'Since 1951', isDiscrepancy: false },
    ],
    hint: 'A miner assigned to a farm? The classification does not match.',
  },
  {
    name: 'Kuznetsov, Alexei Dmitrievich',
    fields: [
      { label: 'Age', value: '52', isDiscrepancy: false },
      { label: 'Class', value: 'Engineer', isDiscrepancy: false },
      { label: 'Assignment', value: 'Power Station', isDiscrepancy: false },
      { label: 'Party Member', value: 'Since 1938', isDiscrepancy: false },
      { label: 'Loyalty Rating', value: 'HERO OF LABOR', isDiscrepancy: true }, // Discrepancy: no such official rating
    ],
    hint: '"Hero of Labor" is not a standard loyalty classification.',
  },
  {
    name: 'Sidorova, Olga Petrovna',
    fields: [
      { label: 'Age', value: '19', isDiscrepancy: true }, // Discrepancy: party member since 1945 but age 19 (born ~1953)
      { label: 'Class', value: 'Student', isDiscrepancy: false },
      { label: 'Assignment', value: 'School', isDiscrepancy: false },
      { label: 'Party Member', value: 'Since 1945', isDiscrepancy: false },
      { label: 'Loyalty Rating', value: 'RELIABLE', isDiscrepancy: false },
    ],
    hint: 'Age 19 but party member since 1945? The math does not add up.',
  },
  {
    name: 'Morozov, Viktor Nikolaevich',
    fields: [
      { label: 'Age', value: '41', isDiscrepancy: false },
      { label: 'Class', value: 'Officer', isDiscrepancy: false },
      { label: 'Assignment', value: 'Vodka Distillery', isDiscrepancy: true }, // Discrepancy: officer at distillery
      { label: 'Party Member', value: 'Since 1960', isDiscrepancy: false },
      { label: 'Loyalty Rating', value: 'RELIABLE', isDiscrepancy: false },
    ],
    hint: 'A military officer assigned to a vodka distillery? Suspicious.',
  },
];

export interface InspectionMinigameProps {
  onComplete: (success: boolean, score: number) => void;
}

/** Interactive inspection minigame: find the discrepancy in the worker dossier. */
export const InspectionMinigame: React.FC<InspectionMinigameProps> = ({ onComplete }) => {
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT_MS);
  const [selectedField, setSelectedField] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(Date.now());

  // Pick a random dossier template
  const dossier = useMemo(() => {
    const idx = Math.floor(Math.random() * DOSSIER_TEMPLATES.length);
    return DOSSIER_TEMPLATES[idx]!;
  }, []);

  // Timer countdown
  useEffect(() => {
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = TIME_LIMIT_MS - elapsed;

      if (remaining <= 0) {
        setTimeLeft(0);
      } else {
        setTimeLeft(remaining);
      }
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Handle time expiry
  useEffect(() => {
    if (finished) return;
    if (timeLeft <= 0) {
      setFinished(true);
      if (timerRef.current) clearInterval(timerRef.current);
      onComplete(false, 0);
    }
  }, [timeLeft, finished, onComplete]);

  const handleFieldTap = useCallback(
    (index: number) => {
      if (finished) return;

      setSelectedField(index);
      setFinished(true);
      if (timerRef.current) clearInterval(timerRef.current);

      const field = dossier.fields[index]!;
      onComplete(field.isDiscrepancy, field.isDiscrepancy ? 1 : 0);
    },
    [finished, dossier, onComplete],
  );

  const timerPct = Math.max(0, timeLeft / TIME_LIMIT_MS) * 100;
  const timerColor = timerPct > 50 ? Colors.termGreen : timerPct > 25 ? Colors.sovietGold : Colors.sovietRed;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>THE INSPECTION</Text>
      <Text style={styles.subtitle}>Find the discrepancy in this worker dossier!</Text>

      {/* Timer bar */}
      <View style={styles.timerTrack}>
        <View style={[styles.timerFill, { width: `${timerPct}%`, backgroundColor: timerColor }]} />
      </View>
      <Text style={styles.timerText}>{Math.ceil(timeLeft / 1000)}s remaining</Text>

      {/* Dossier */}
      <View style={styles.dossier}>
        <View style={styles.dossierHeader}>
          <Text style={styles.dossierTitle}>PERSONAL DOSSIER</Text>
          <Text style={styles.dossierStamp}>CLASSIFIED</Text>
        </View>
        <Text style={styles.dossierName}>{dossier.name}</Text>

        {dossier.fields.map((field: DossierField, index: number) => {
          const isSelected = selectedField === index;
          const showResult = finished && isSelected;
          const isCorrectPick = showResult && field.isDiscrepancy;
          const isWrongPick = showResult && !field.isDiscrepancy;
          const isRevealedAnswer = finished && !isSelected && field.isDiscrepancy;

          return (
            <Pressable
              key={field.label}
              style={[
                styles.fieldRow,
                isCorrectPick && styles.fieldCorrect,
                isWrongPick && styles.fieldWrong,
                isRevealedAnswer && styles.fieldRevealed,
              ]}
              onPress={() => handleFieldTap(index)}
              disabled={finished}
            >
              <Text style={styles.fieldLabel}>{field.label}:</Text>
              <Text style={styles.fieldValue}>{field.value}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Result */}
      {finished && (
        <View style={styles.resultBox}>
          <Text
            style={[
              styles.resultText,
              selectedField !== null && dossier.fields[selectedField]?.isDiscrepancy
                ? styles.resultSuccess
                : styles.resultFail,
            ]}
          >
            {selectedField !== null && dossier.fields[selectedField]?.isDiscrepancy
              ? 'SPY CAUGHT! COMMENDATION EARNED.'
              : timeLeft <= 0
                ? 'TIME EXPIRED. THE SPY ESCAPED.'
                : 'WRONG FIELD. THE SPY ESCAPED.'}
          </Text>
          <Text style={styles.hintText}>{dossier.hint}</Text>
        </View>
      )}

      {!finished && <Text style={styles.instruction}>TAP THE SUSPICIOUS FIELD</Text>}
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
    marginBottom: 4,
  },
  timerFill: {
    height: '100%',
    borderRadius: 3,
  },
  timerText: {
    fontSize: 11,
    fontFamily: monoFont,
    color: '#546e7a',
    textAlign: 'center',
    marginBottom: 8,
  },
  dossier: {
    backgroundColor: '#f5f0e8',
    borderWidth: 1,
    borderColor: '#8d7b6a',
    padding: 12,
    marginBottom: 8,
  },
  dossierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#bbb',
    paddingBottom: 6,
  },
  dossierTitle: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#37474f',
    letterSpacing: 2,
  },
  dossierStamp: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietRed,
    letterSpacing: 1,
    borderWidth: 1,
    borderColor: Colors.sovietRed,
    paddingHorizontal: 4,
    paddingVertical: 1,
    transform: [{ rotate: '-5deg' }],
  },
  dossierName: {
    fontSize: 14,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: 2,
  },
  fieldCorrect: {
    borderColor: Colors.termGreen,
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
  },
  fieldWrong: {
    borderColor: Colors.sovietRed,
    backgroundColor: 'rgba(198, 40, 40, 0.15)',
  },
  fieldRevealed: {
    borderColor: Colors.sovietGold,
    backgroundColor: 'rgba(251, 192, 45, 0.15)',
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: monoFont,
    color: '#546e7a',
  },
  fieldValue: {
    fontSize: 12,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#263238',
  },
  resultBox: {
    alignItems: 'center',
    marginTop: 8,
  },
  resultText: {
    fontSize: 13,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 1,
    textAlign: 'center',
  },
  resultSuccess: {
    color: Colors.termGreen,
  },
  resultFail: {
    color: Colors.sovietRed,
  },
  hintText: {
    fontSize: 11,
    fontFamily: monoFont,
    fontStyle: 'italic',
    color: '#78909c',
    marginTop: 4,
    textAlign: 'center',
  },
  instruction: {
    fontSize: 10,
    fontFamily: monoFont,
    color: '#546e7a',
    textAlign: 'center',
    letterSpacing: 2,
    marginTop: 8,
  },
});
