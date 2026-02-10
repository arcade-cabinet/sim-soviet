/**
 * NewGameFlow -- Multi-step new game configuration screen.
 *
 * Three steps styled as a Soviet bureaucratic assignment form:
 *   1. Assignment -- player name + city name
 *   2. Parameters -- difficulty, map size, seed, starting era
 *   3. Consequences -- arrest behavior + summary + BEGIN
 *
 * Uses parchment (light) theme tokens for the form aesthetic.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Shuffle } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { MALE_GIVEN_NAMES, SURNAMES_MALE } from '@/ai/names';
import { generateCityName } from '@/content/worldbuilding';
import { accent, DOCUMENT_FONT, parchment, SOVIET_FONT } from '@/design/tokens';
import { ERA_DEFINITIONS, ERA_ORDER, type EraId } from '@/game/era';
import { MAP_SIZES, type MapSize } from '@/game/map';
import {
  type ConsequenceLevel,
  DIFFICULTY_PRESETS,
  type DifficultyLevel,
} from '@/game/ScoringSystem';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────

/** Complete configuration for starting a new game. */
export interface NewGameConfig {
  difficulty: DifficultyLevel;
  mapSize: MapSize;
  seed: string;
  playerName: string;
  cityName: string;
  startEra: EraId;
  consequence: ConsequenceLevel;
}

/** Props for the NewGameFlow component. */
export interface NewGameFlowProps {
  /** Called with the final configuration when the player presses BEGIN. */
  onStart: (config: NewGameConfig) => void;
  /** Navigate back to the landing page. */
  onBack: () => void;
}

// ─────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────

const DIFFICULTY_INFO: Record<DifficultyLevel, { label: string; description: string }> = {
  worker: {
    label: 'Worker',
    description: 'The State is lenient. Quotas are gentle. Growth is encouraged.',
  },
  comrade: {
    label: 'Comrade',
    description: 'Standard Soviet experience. Expect hardship.',
  },
  tovarish: {
    label: 'Tovarish',
    description: 'Maximum authentic suffering. The Party demands excellence.',
  },
};

const CONSEQUENCE_INFO: Record<ConsequenceLevel, { label: string; description: string }> = {
  forgiving: {
    label: 'Forgiving',
    description: 'Replaced by an Idiot. Return after 1 year with 90% buildings, 80% workers.',
  },
  permadeath: {
    label: 'Permadeath',
    description: 'The File Is Closed. No return. Restart era. Score multiplier x1.5.',
  },
  harsh: {
    label: 'Harsh',
    description: 'The Village Is Evacuated. Return after 3 years with 40% buildings, 25% workers.',
  },
};

const MAP_SIZE_INFO: Record<MapSize, { label: string; tiles: string }> = {
  small: { label: 'Small', tiles: `${MAP_SIZES.small}x${MAP_SIZES.small}` },
  medium: { label: 'Medium', tiles: `${MAP_SIZES.medium}x${MAP_SIZES.medium}` },
  large: { label: 'Large', tiles: `${MAP_SIZES.large}x${MAP_SIZES.large}` },
};

const STEP_LABELS = ['I. ASSIGNMENT', 'II. PARAMETERS', 'III. CONSEQUENCES'];

function randomSeed(): string {
  const adjectives = [
    'glorious',
    'frozen',
    'eternal',
    'concrete',
    'iron',
    'collective',
    'heroic',
    'mighty',
    'red',
    'grey',
  ];
  const nouns = [
    'tractor',
    'potato',
    'quota',
    'factory',
    'comrade',
    'sputnik',
    'kolkhoz',
    'plan',
    'ruble',
    'turnip',
  ];
  const a = adjectives[Math.floor(Math.random() * adjectives.length)]!;
  const n = nouns[Math.floor(Math.random() * nouns.length)]!;
  const num = Math.floor(Math.random() * 9999);
  return `${a}-${n}-${num}`;
}

function randomPlayerName(): string {
  const given = MALE_GIVEN_NAMES[Math.floor(Math.random() * MALE_GIVEN_NAMES.length)]!;
  const surname = SURNAMES_MALE[Math.floor(Math.random() * SURNAMES_MALE.length)]!;
  return `${given} ${surname}`;
}

// ─────────────────────────────────────────────────────────
//  COMPONENT
// ─────────────────────────────────────────────────────────

/**
 * Multi-step new game configuration flow.
 *
 * Renders three sequential steps with back/next navigation,
 * styled as a Soviet bureaucratic assignment form on parchment.
 */
export function NewGameFlow({ onStart, onBack }: NewGameFlowProps) {
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<NewGameConfig>(() => ({
    playerName: randomPlayerName(),
    cityName: generateCityName(),
    difficulty: 'comrade',
    mapSize: 'medium',
    seed: randomSeed(),
    startEra: 'war_communism',
    consequence: 'permadeath',
  }));

  const update = useCallback(<K extends keyof NewGameConfig>(key: K, value: NewGameConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  const canAdvance = step < 2;
  const canGoBack = step > 0;

  const handleNext = useCallback(() => {
    if (canAdvance) setStep((s) => s + 1);
  }, [canAdvance]);

  const handlePrev = useCallback(() => {
    if (canGoBack) {
      setStep((s) => s - 1);
    } else {
      onBack();
    }
  }, [canGoBack, onBack]);

  const handleBegin = useCallback(() => {
    onStart(config);
  }, [onStart, config]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-30 flex items-center justify-center px-3 py-4 overflow-y-auto"
      style={{
        fontFamily: DOCUMENT_FONT,
        background: 'rgba(0,0,0,0.92)',
      }}
    >
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="w-full max-w-lg rounded-none border-2 shadow-2xl"
        style={{
          background: parchment.surface.paper,
          borderColor: parchment.border.primary,
          color: parchment.text.primary,
        }}
      >
        {/* Header */}
        <div
          className="px-4 py-3 border-b-2 text-center"
          style={{
            background: parchment.surface.header,
            borderColor: parchment.border.primary,
          }}
        >
          <div className="text-[10px] uppercase tracking-[0.3em] mb-1 opacity-60">
            Ministry of Planning -- Form NP-{step + 1}
          </div>
          <h2
            className="text-lg font-bold uppercase tracking-[0.15em]"
            style={{ fontFamily: SOVIET_FONT }}
          >
            {STEP_LABELS[step]}
          </h2>
          {/* Step indicator */}
          <div className="flex justify-center gap-2 mt-2">
            {STEP_LABELS.map((label, i) => (
              <div
                key={label}
                className="w-8 h-1"
                style={{
                  background: i <= step ? accent.red : parchment.surface.alt,
                }}
              />
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="px-4 py-4 min-h-[320px]">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <StepMotion key="step0">
                <StepAssignment
                  playerName={config.playerName}
                  cityName={config.cityName}
                  onPlayerName={(v) => update('playerName', v)}
                  onCityName={(v) => update('cityName', v)}
                />
              </StepMotion>
            )}
            {step === 1 && (
              <StepMotion key="step1">
                <StepParameters
                  difficulty={config.difficulty}
                  mapSize={config.mapSize}
                  seed={config.seed}
                  startEra={config.startEra}
                  onDifficulty={(v) => update('difficulty', v)}
                  onMapSize={(v) => update('mapSize', v)}
                  onSeed={(v) => update('seed', v)}
                  onStartEra={(v) => update('startEra', v)}
                />
              </StepMotion>
            )}
            {step === 2 && (
              <StepMotion key="step2">
                <StepConsequences config={config} onConsequence={(v) => update('consequence', v)} />
              </StepMotion>
            )}
          </AnimatePresence>
        </div>

        {/* Footer navigation */}
        <div
          className="flex items-center justify-between px-4 py-3 border-t-2"
          style={{
            background: parchment.surface.alt,
            borderColor: parchment.border.primary,
          }}
        >
          <button
            type="button"
            onClick={handlePrev}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold uppercase tracking-wider border-2 transition-all active:translate-y-0.5 cursor-pointer"
            style={{
              borderColor: parchment.border.primary,
              color: parchment.text.primary,
              background: parchment.surface.paper,
            }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>

          {canAdvance ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold uppercase tracking-wider border-2 text-white transition-all active:translate-y-0.5 cursor-pointer hover:brightness-110"
              style={{
                borderColor: accent.red,
                background: accent.red,
              }}
            >
              Next
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleBegin}
              className="flex items-center gap-1.5 px-5 py-2 text-base font-bold uppercase tracking-[0.2em] border-2 text-white transition-all active:translate-y-0.5 cursor-pointer hover:brightness-110"
              style={{
                fontFamily: SOVIET_FONT,
                borderColor: accent.red,
                background: accent.red,
              }}
            >
              BEGIN
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
//  STEP ANIMATION WRAPPER
// ─────────────────────────────────────────────────────────

function StepMotion({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -40, opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      {children}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
//  STEP 1: ASSIGNMENT
// ─────────────────────────────────────────────────────────

function StepAssignment({
  playerName,
  cityName,
  onPlayerName,
  onCityName,
}: {
  playerName: string;
  cityName: string;
  onPlayerName: (v: string) => void;
  onCityName: (v: string) => void;
}) {
  return (
    <div className="space-y-5">
      <p className="text-xs leading-relaxed opacity-70 italic">
        Complete your assignment details. The Central Committee requires accurate personal
        information. Inaccuracies will be noted in your personnel file.
      </p>

      <FormField label="Full Name (Comrade)">
        <div className="flex gap-2">
          <input
            type="text"
            value={playerName}
            onChange={(e) => onPlayerName(e.target.value)}
            className="flex-1 px-2 py-1.5 border-2 text-sm bg-white/50 outline-none focus:border-[#8b0000]"
            style={{
              borderColor: parchment.border.primary,
              fontFamily: DOCUMENT_FONT,
              color: parchment.text.primary,
            }}
            placeholder="Enter your name"
          />
          <GenerateButton onClick={() => onPlayerName(randomPlayerName())} label="Generate name" />
        </div>
      </FormField>

      <FormField label="Settlement Designation">
        <div className="flex gap-2">
          <input
            type="text"
            value={cityName}
            onChange={(e) => onCityName(e.target.value)}
            className="flex-1 px-2 py-1.5 border-2 text-sm bg-white/50 outline-none focus:border-[#8b0000]"
            style={{
              borderColor: parchment.border.primary,
              fontFamily: DOCUMENT_FONT,
              color: parchment.text.primary,
            }}
            placeholder="Enter city name"
          />
          <GenerateButton onClick={() => onCityName(generateCityName())} label="Generate city" />
        </div>
      </FormField>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  STEP 2: PARAMETERS
// ─────────────────────────────────────────────────────────

function StepParameters({
  difficulty,
  mapSize,
  seed,
  startEra,
  onDifficulty,
  onMapSize,
  onSeed,
  onStartEra,
}: {
  difficulty: DifficultyLevel;
  mapSize: MapSize;
  seed: string;
  startEra: EraId;
  onDifficulty: (v: DifficultyLevel) => void;
  onMapSize: (v: MapSize) => void;
  onSeed: (v: string) => void;
  onStartEra: (v: EraId) => void;
}) {
  const difficulties = useMemo(() => Object.keys(DIFFICULTY_PRESETS) as DifficultyLevel[], []);
  const mapSizes = useMemo(() => Object.keys(MAP_SIZES) as MapSize[], []);

  return (
    <div className="space-y-4">
      {/* Difficulty */}
      <FormField label="Difficulty Classification">
        <div className="space-y-1.5">
          {difficulties.map((d) => {
            const info = DIFFICULTY_INFO[d];
            const selected = difficulty === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => onDifficulty(d)}
                className={cn(
                  'w-full text-left px-3 py-2 border-2 text-xs transition-all cursor-pointer',
                  selected
                    ? 'border-[#8b0000] bg-[#8b0000]/10'
                    : 'border-transparent hover:border-[#8b4513]/40 bg-white/30'
                )}
                style={{ fontFamily: DOCUMENT_FONT }}
              >
                <span className="font-bold uppercase tracking-wider">{info.label}</span>
                <span className="block text-[10px] opacity-70 mt-0.5">{info.description}</span>
              </button>
            );
          })}
        </div>
      </FormField>

      {/* Map Size */}
      <FormField label="Sector Dimensions">
        <div className="flex gap-2">
          {mapSizes.map((s) => {
            const info = MAP_SIZE_INFO[s];
            const selected = mapSize === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => onMapSize(s)}
                className={cn(
                  'flex-1 py-2 border-2 text-xs font-bold uppercase text-center transition-all cursor-pointer',
                  selected
                    ? 'border-[#8b0000] bg-[#8b0000]/10'
                    : 'border-[#8b4513]/30 hover:border-[#8b4513]/60 bg-white/30'
                )}
              >
                {info.label}
                <span className="block text-[9px] font-normal opacity-60">{info.tiles}</span>
              </button>
            );
          })}
        </div>
      </FormField>

      {/* Seed */}
      <FormField label="Cartographic Seed">
        <div className="flex gap-2">
          <input
            type="text"
            value={seed}
            onChange={(e) => onSeed(e.target.value)}
            className="flex-1 px-2 py-1.5 border-2 text-xs bg-white/50 outline-none focus:border-[#8b0000]"
            style={{
              borderColor: parchment.border.primary,
              fontFamily: DOCUMENT_FONT,
              color: parchment.text.primary,
            }}
          />
          <GenerateButton onClick={() => onSeed(randomSeed())} label="Random seed" />
        </div>
      </FormField>

      {/* Starting Era */}
      <FormField label="Starting Era">
        <select
          value={startEra}
          onChange={(e) => onStartEra(e.target.value as EraId)}
          className="w-full px-2 py-1.5 border-2 text-xs bg-white/50 outline-none focus:border-[#8b0000] cursor-pointer"
          style={{
            borderColor: parchment.border.primary,
            fontFamily: DOCUMENT_FONT,
            color: parchment.text.primary,
          }}
        >
          {ERA_ORDER.map((eraId) => {
            const era = ERA_DEFINITIONS[eraId];
            return (
              <option key={eraId} value={eraId}>
                {era.name} ({era.startYear})
              </option>
            );
          })}
        </select>
      </FormField>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  STEP 3: CONSEQUENCES
// ─────────────────────────────────────────────────────────

function StepConsequences({
  config,
  onConsequence,
}: {
  config: NewGameConfig;
  onConsequence: (v: ConsequenceLevel) => void;
}) {
  const consequences = useMemo(() => Object.keys(CONSEQUENCE_INFO) as ConsequenceLevel[], []);
  const era = ERA_DEFINITIONS[config.startEra];
  const diffInfo = DIFFICULTY_INFO[config.difficulty];

  return (
    <div className="space-y-4">
      {/* Consequence selector */}
      <FormField label="Consequence of Arrest">
        <div className="space-y-1.5">
          {consequences.map((c) => {
            const info = CONSEQUENCE_INFO[c];
            const selected = config.consequence === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => onConsequence(c)}
                className={cn(
                  'w-full text-left px-3 py-2 border-2 text-xs transition-all cursor-pointer',
                  selected
                    ? 'border-[#8b0000] bg-[#8b0000]/10'
                    : 'border-transparent hover:border-[#8b4513]/40 bg-white/30'
                )}
                style={{ fontFamily: DOCUMENT_FONT }}
              >
                <span className="font-bold uppercase tracking-wider">{info.label}</span>
                <span className="block text-[10px] opacity-70 mt-0.5">{info.description}</span>
              </button>
            );
          })}
        </div>
      </FormField>

      {/* Summary */}
      <div
        className="border-2 p-3 text-[10px] space-y-1.5"
        style={{
          borderColor: parchment.border.primary,
          background: parchment.surface.alt,
        }}
      >
        <div className="font-bold uppercase tracking-[0.15em] text-xs mb-2">Assignment Summary</div>
        <SummaryRow label="Comrade" value={config.playerName} />
        <SummaryRow label="Settlement" value={config.cityName} />
        <SummaryRow label="Difficulty" value={diffInfo.label} />
        <SummaryRow label="Sector" value={MAP_SIZE_INFO[config.mapSize].tiles} />
        <SummaryRow label="Era" value={`${era.name} (${era.startYear})`} />
        <SummaryRow label="Seed" value={config.seed} />
        <SummaryRow label="Consequence" value={CONSEQUENCE_INFO[config.consequence].label} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  SHARED SUB-COMPONENTS
// ─────────────────────────────────────────────────────────

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="block text-[10px] font-bold uppercase tracking-[0.15em] mb-1.5 opacity-70">
        {label}
      </div>
      {children}
    </div>
  );
}

function GenerateButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2 py-1.5 border-2 flex items-center justify-center transition-all active:translate-y-0.5 cursor-pointer hover:bg-[#8b4513]/10"
      style={{ borderColor: parchment.border.primary }}
      aria-label={label}
    >
      <Shuffle className="w-3.5 h-3.5" style={{ color: parchment.text.primary }} />
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="opacity-60">{label}:</span>
      <span className="font-bold text-right">{value}</span>
    </div>
  );
}
