/**
 * NewGameSetup — Soviet dossier-styled game configuration screen.
 *
 * Shown after clicking "NEW GAME" on the MainMenu, before the 3D engine loads.
 * Lets the player pick difficulty, consequence level, and seed.
 * Styled as an official Soviet assignment form.
 */

import type React from 'react';
import { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  CONSEQUENCE_PRESETS,
  type ConsequenceLevel,
  DIFFICULTY_PRESETS,
  type DifficultyLevel,
} from '../ai/agents/political/ScoringSystem';
import { Colors, monoFont } from './styles';

/** Available map size options for new game configuration. */
export type MapSize = 'small' | 'medium' | 'large';

/** Grid dimensions and display labels for each map size option. */
export const MAP_SIZE_CONFIG: Record<MapSize, { label: string; gridSize: number; desc: string }> = {
  small: { label: 'Small', gridSize: 20, desc: 'A modest hamlet. 20x20 grid.' },
  medium: { label: 'Medium', gridSize: 30, desc: 'Standard collective. 30x30 grid.' },
  large: { label: 'Large', gridSize: 50, desc: 'Sprawling industrial zone. 50x50 grid.' },
};

/** Game mode — historical follows real Soviet timeline, freeform uses organic divergence, classic uses difficulty presets. */
export type GameMode = 'historical' | 'classic' | 'freeform';

/** Player-selected options for starting a new game session. */
export interface NewGameConfig {
  difficulty: DifficultyLevel;
  consequence: ConsequenceLevel;
  seed: string;
  mapSize: MapSize;
  gameMode: GameMode;
  /** @deprecated Divergence is now organic. Kept for old save compat. */
  divergenceYear?: number;
}

export interface NewGameSetupProps {
  onStart: (config: NewGameConfig) => void;
  onBack: () => void;
}

const DIFFICULTY_FLAVOR: Record<DifficultyLevel, string> = {
  worker: 'The State is lenient. Quotas are gentle. Growth is encouraged. You may even survive.',
  comrade: 'Standard Soviet experience. Expect hardship. The Party demands adequacy.',
  tovarish: 'Maximum authentic suffering. The Party demands excellence. Excellence is never enough.',
};

const CONSEQUENCE_FLAVOR: Record<ConsequenceLevel, string> = {
  forgiving: 'Replaced by an Idiot. Return after 1 year. 90% buildings survive. Humiliation is temporary.',
  permadeath: 'The File Is Closed. No return. Restart from the beginning. Score multiplier x1.5.',
  harsh: 'The Village Is Evacuated. Return after 3 years. 40% buildings survive. Despair is permanent.',
};

const GAME_MODE_FLAVOR: Record<GameMode, string> = {
  historical: 'History IS the difficulty. Survive the actual Soviet timeline.',
  freeform:
    'Same forces, different timing. Historical events happen probabilistically. The timeline diverges naturally. What if?',
  classic: 'Choose your own difficulty. Standard city-builder experience.',
};

/** Map divergence year to its Soviet-era label for display. */
function getEraLabel(year: number): string {
  if (year <= 1921) return 'Revolution & Civil War (1917\u20131921)';
  if (year <= 1928) return 'NEP & Early USSR (1922\u20131928)';
  if (year <= 1933) return 'Collectivization (1929\u20131933)';
  if (year <= 1940) return 'Great Terror & Industrialization (1934\u20131940)';
  if (year <= 1945) return 'Great Patriotic War (1941\u20131945)';
  if (year <= 1953) return 'Late Stalinism (1946\u20131953)';
  if (year <= 1964) return 'Khrushchev Thaw (1954\u20131964)';
  if (year <= 1982) return 'Brezhnev Stagnation (1965\u20131982)';
  if (year <= 1985) return 'Interregnum (1982\u20131985)';
  return 'Perestroika & Collapse (1986\u20131991)';
}


/** Soviet dossier-styled game configuration screen for difficulty, consequence, seed, and map size. */
export const NewGameSetup: React.FC<NewGameSetupProps> = ({ onStart, onBack }) => {
  const [gameMode, setGameMode] = useState<GameMode>('classic');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('comrade');
  const [consequence, setConsequence] = useState<ConsequenceLevel>('permadeath');
  const [seed, setSeed] = useState('');
  const [mapSize, setMapSize] = useState<MapSize>('medium');
  const [divergenceYear, setDivergenceYear] = useState(1945);

  const diffConfig = DIFFICULTY_PRESETS[difficulty];
  const consConfig = CONSEQUENCE_PRESETS[consequence];

  return (
    <View style={styles.root}>
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
          <Text style={styles.sectionLabel}>GAME MODE</Text>
          <View style={styles.optionRow}>
            {(['historical', 'freeform', 'classic'] as GameMode[]).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.optionBtn, gameMode === m && styles.optionBtnActive]}
                onPress={() => setGameMode(m)}
                activeOpacity={0.7}
              >
                <Text style={[styles.optionLabel, gameMode === m && styles.optionLabelActive]}>{m.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.flavor}>{GAME_MODE_FLAVOR[gameMode]}</Text>
        </View>

        {gameMode === 'freeform' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DIVERGENCE YEAR</Text>
            <View style={styles.yearSelector}>
              <TouchableOpacity
                onPress={() => setDivergenceYear(Math.max(1917, divergenceYear - 1))}
                style={styles.yearButton}
                activeOpacity={0.7}
              >
                <Text style={styles.yearButtonText}>{'<'}</Text>
              </TouchableOpacity>
              <Text style={styles.yearDisplay}>{divergenceYear}</Text>
              <TouchableOpacity
                onPress={() => setDivergenceYear(Math.min(1991, divergenceYear + 1))}
                style={styles.yearButton}
                activeOpacity={0.7}
              >
                <Text style={styles.yearButtonText}>{'>'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.eraLabel}>{getEraLabel(divergenceYear)}</Text>
            <Text style={styles.flavor}>History diverges in {divergenceYear}. After that, anything can happen.</Text>
          </View>
        )}

        {gameMode === 'classic' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DIFFICULTY LEVEL</Text>
            <View style={styles.optionRow}>
              {(['worker', 'comrade', 'tovarish'] as DifficultyLevel[]).map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.optionBtn, difficulty === d && styles.optionBtnActive]}
                  onPress={() => setDifficulty(d)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optionLabel, difficulty === d && styles.optionLabelActive]}>
                    {DIFFICULTY_PRESETS[d].label.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.flavor}>{DIFFICULTY_FLAVOR[difficulty]}</Text>
            <View style={styles.statsRow}>
              <Text style={styles.statText}>Quota: x{diffConfig.quotaMultiplier}</Text>
              <Text style={styles.statText}>Growth: x{diffConfig.growthMultiplier}</Text>
              <Text style={styles.statText}>Decay: x{diffConfig.decayMultiplier}</Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CONSEQUENCE LEVEL</Text>
          <View style={styles.optionRow}>
            {(['forgiving', 'permadeath', 'harsh'] as ConsequenceLevel[]).map((c) => (
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
          <Text style={styles.sectionLabel}>MAP SIZE</Text>
          <View style={styles.optionRow}>
            {(['small', 'medium', 'large'] as MapSize[]).map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.optionBtn, mapSize === s && styles.optionBtnActive]}
                onPress={() => setMapSize(s)}
                activeOpacity={0.7}
              >
                <Text style={[styles.optionLabel, mapSize === s && styles.optionLabelActive]}>
                  {MAP_SIZE_CONFIG[s].label.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.flavor}>{MAP_SIZE_CONFIG[mapSize].desc}</Text>
          <View style={styles.statsRow}>
            <Text style={styles.statText}>
              Grid: {MAP_SIZE_CONFIG[mapSize].gridSize}x{MAP_SIZE_CONFIG[mapSize].gridSize}
            </Text>
          </View>
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
          <Text style={styles.scoreLabel}>
            SCORE MULTIPLIER: x
            {(difficulty === 'worker'
              ? consequence === 'forgiving'
                ? 0.5
                : consequence === 'harsh'
                  ? 0.7
                  : 1.0
              : difficulty === 'comrade'
                ? consequence === 'forgiving'
                  ? 0.8
                  : consequence === 'harsh'
                    ? 1.2
                    : 1.5
                : consequence === 'forgiving'
                  ? 1.0
                  : consequence === 'harsh'
                    ? 1.8
                    : 2.0
            ).toFixed(1)}
          </Text>
        </View>

        <View style={styles.btnRow}>
          <TouchableOpacity onPress={onBack} style={styles.btnBack} activeOpacity={0.8}>
            <Text style={styles.btnBackText}>RETURN</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              onStart({
                difficulty,
                consequence,
                seed: seed.trim() || `simsoviet-${Date.now()}`,
                mapSize,
                gameMode,
                ...(gameMode === 'freeform' ? { divergenceYear } : {}),
              })
            }
            style={styles.btnStart}
            activeOpacity={0.8}
          >
            <Text style={styles.btnStartText}>{'\u2605'} BEGIN ASSIGNMENT</Text>
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
  },
  flavorItalic: {
    fontSize: 11,
    fontFamily: monoFont,
    fontStyle: 'italic',
    color: '#78909c',
    marginTop: 4,
  },
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 8,
  },
  yearButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
  },
  yearButtonText: {
    fontSize: 18,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
  },
  yearDisplay: {
    fontSize: 30,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 3,
    minWidth: 100,
    textAlign: 'center',
  },
  eraLabel: {
    fontSize: 10,
    fontFamily: monoFont,
    color: '#90a4ae',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 6,
  },
  statText: {
    fontSize: 10,
    fontFamily: monoFont,
    color: Colors.sovietGold,
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
    shadowColor: Colors.sovietRed,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
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
