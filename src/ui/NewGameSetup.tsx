/**
 * NewGameSetup — Soviet dossier-styled game configuration screen.
 *
 * Shown after clicking "NEW GAME" on the MainMenu, before the 3D engine loads.
 * Lets the player pick consequence level and seed for the historical campaign.
 * Styled as an official Soviet assignment form.
 */

import type React from 'react';
import { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CONSEQUENCE_PRESETS, type ConsequenceLevel, SCORE_MULTIPLIER } from '../ai/agents/political/ScoringSystem';
import { ShaderBackdrop } from './ShaderBackdrop';
import { Colors, monoFont } from './styles';

/** Player-selected options for starting a new game session. */
export interface NewGameConfig {
  consequence: ConsequenceLevel;
  seed: string;
}

export interface NewGameSetupProps {
  onStart: (config: NewGameConfig) => void;
  onBack: () => void;
}

const CONSEQUENCE_FLAVOR: Record<ConsequenceLevel, string> = {
  rehabilitated:
    '\u0420\u0435\u0430\u0431\u0438\u043b\u0438\u0442\u0438\u0440\u043e\u0432\u0430\u043d. Transferred to another post. Return after 1 year. 90% buildings survive.',
  gulag:
    '\u042d\u0442\u0430\u043f. Exiled to distant settlement. Return after 3 years. 40% buildings, 25% workers survive.',
  rasstrelyat:
    '\u0420\u0430\u0441\u0441\u0442\u0440\u0435\u043b\u044f\u043d. The file is closed. Game over. Score multiplier x1.5.',
};

/** Soviet dossier-styled game configuration screen for mode, consequence, and seed. */
export const NewGameSetup: React.FC<NewGameSetupProps> = ({ onStart, onBack }) => {
  const [consequence, setConsequence] = useState<ConsequenceLevel>('gulag');
  const [seed, setSeed] = useState('');

  const consConfig = CONSEQUENCE_PRESETS[consequence];

  return (
    <View style={styles.root}>
      <ShaderBackdrop />
      <View style={styles.scanlines} />
      <View style={styles.dossier}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>ASSIGNMENT ORDER</Text>
          <View style={styles.stamp}>
            <Text style={styles.stampText}>CLASSIFIED</Text>
          </View>
        </View>
        <Text style={styles.subHeader}>CENTRAL PLANNING BUREAU — PERSONNEL DIVISION</Text>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CAMPAIGN RECORD</Text>
          <Text style={styles.flavor}>Historical Soviet campaign, October 1917 through December 1991.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CONSEQUENCE LEVEL</Text>
          <View style={styles.optionRow}>
            {(['rehabilitated', 'gulag', 'rasstrelyat'] as ConsequenceLevel[]).map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.optionBtn, consequence === c && styles.optionBtnActive]}
                onPress={() => setConsequence(c)}
                activeOpacity={0.7}
              >
                <Text style={[styles.optionLabel, consequence === c && styles.optionLabelActive]}>
                  {CONSEQUENCE_PRESETS[c].label.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.flavor}>{CONSEQUENCE_FLAVOR[consequence]}</Text>
          <Text style={styles.flavorItalic}>&quot;{consConfig.subtitle}&quot;</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>MAP SEED (OPTIONAL)</Text>
          <TextInput
            style={styles.seedInput}
            value={seed}
            onChangeText={(text) => setSeed(text.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 100))}
            placeholder="Leave blank for random"
            placeholderTextColor="#666"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={100}
          />
        </View>

        <View style={styles.scoreNote}>
          <Text style={styles.scoreLabel}>SCORE MULTIPLIER: x{SCORE_MULTIPLIER[consequence].toFixed(1)}</Text>
        </View>

        <View style={styles.btnRow}>
          <TouchableOpacity onPress={onBack} style={styles.btnBack} activeOpacity={0.8}>
            <Text style={styles.btnBackText}>RETURN</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              onStart({
                consequence,
                seed: seed.trim() || `simsoviet-${Date.now()}`,
              })
            }
            style={styles.btnStart}
            activeOpacity={0.8}
          >
            <Text style={styles.btnStartText} numberOfLines={1} adjustsFontSizeToFit>
              {'\u2605'} BEGIN ASSIGNMENT
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>REFUSAL IS NOT AN OPTION /// GLORY TO THE CENTRAL COMMITTEE</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bgColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanlines: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.03,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web'
      ? {
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)',
        }
      : {}),
    zIndex: 1,
  },
  dossier: {
    zIndex: 2,
    maxWidth: 520,
    width: '90%',
    backgroundColor: '#1e2228',
    borderWidth: 2,
    borderTopColor: '#444',
    borderLeftColor: '#444',
    borderBottomColor: '#111',
    borderRightColor: '#111',
    padding: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 2,
  },
  stamp: {
    borderWidth: 3,
    borderColor: Colors.sovietRed,
    paddingVertical: 2,
    paddingHorizontal: 10,
    transform: [{ rotate: '-5deg' }],
    opacity: 0.7,
  },
  stampText: {
    color: Colors.sovietRed,
    fontFamily: monoFont,
    fontWeight: 'bold',
    fontSize: 11,
    letterSpacing: 3,
  },
  subHeader: {
    fontSize: 9,
    fontFamily: monoFont,
    color: '#666',
    letterSpacing: 2,
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 2,
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  optionBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
  },
  optionBtnActive: {
    backgroundColor: Colors.sovietRed,
    borderColor: '#ff8a80',
  },
  optionLabel: {
    fontSize: 12,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#999',
    letterSpacing: 1,
  },
  optionLabelActive: {
    color: Colors.white,
  },
  flavor: {
    fontSize: 11,
    fontFamily: monoFont,
    color: '#90a4ae',
    lineHeight: 16,
    marginBottom: 4,
    paddingLeft: 2,
  },
  flavorItalic: {
    fontSize: 11,
    fontFamily: monoFont,
    fontStyle: 'italic',
    color: '#78909c',
    marginTop: 4,
  },
  seedInput: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#444',
    color: Colors.white,
    fontFamily: monoFont,
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 8,
    letterSpacing: 1,
  },
  scoreNote: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 12,
    marginBottom: 16,
  },
  scoreLabel: {
    fontSize: 14,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 2,
    textAlign: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  btnBack: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#333',
    borderWidth: 2,
    borderTopColor: '#555',
    borderLeftColor: '#555',
    borderBottomColor: '#111',
    borderRightColor: '#111',
  },
  btnBackText: {
    color: '#999',
    fontFamily: monoFont,
    fontWeight: 'bold',
    fontSize: 13,
    letterSpacing: 2,
  },
  btnStart: {
    flex: 2,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.sovietRed,
    borderWidth: 2,
    borderTopColor: '#ff8a80',
    borderLeftColor: '#ff8a80',
    borderBottomColor: Colors.sovietDarkRed,
    borderRightColor: Colors.sovietDarkRed,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 12px rgba(198, 40, 40, 0.4)' }
      : {
          shadowColor: Colors.sovietRed,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
          elevation: 8,
        }),
  },
  btnStartText: {
    color: Colors.white,
    fontFamily: monoFont,
    fontWeight: 'bold',
    fontSize: 15,
    letterSpacing: 2,
  },
  footer: {
    fontSize: 9,
    fontFamily: monoFont,
    color: '#555',
    letterSpacing: 2,
    textAlign: 'center',
  },
});
