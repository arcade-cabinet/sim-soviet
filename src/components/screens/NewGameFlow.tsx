/**
 * NewGameFlow -- Single-page dossier for new game configuration.
 *
 * All settings on one scrollable parchment page — no wizard, no steps.
 * Styled as a Soviet bureaucratic assignment form with proper contrast.
 */
import { motion } from 'framer-motion';
import { ArrowLeft, Shuffle } from 'lucide-react';
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
 * Single-page new game configuration dossier.
 *
 * All sections visible at once on a scrollable parchment page.
 * No wizard steps — everything is on one form.
 */
export function NewGameFlow({ onStart, onBack }: NewGameFlowProps) {
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

  const handleBegin = useCallback(() => {
    onStart(config);
  }, [onStart, config]);

  const difficulties = useMemo(() => Object.keys(DIFFICULTY_PRESETS) as DifficultyLevel[], []);
  const mapSizes = useMemo(() => Object.keys(MAP_SIZES) as MapSize[], []);
  const consequences = useMemo(() => Object.keys(CONSEQUENCE_INFO) as ConsequenceLevel[], []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-30 flex items-start justify-center px-3 py-4 overflow-y-auto"
      style={{
        fontFamily: DOCUMENT_FONT,
        background: 'rgba(0,0,0,0.92)',
      }}
    >
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="w-full max-w-lg my-4 rounded-none border-2 shadow-2xl"
        style={{
          background: parchment.surface.paper,
          borderColor: parchment.border.primary,
          color: '#3b2510',
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
          <div className="text-[10px] uppercase tracking-[0.3em] mb-1" style={{ color: '#6b4a2a' }}>
            Ministry of Planning -- Form NP-1
          </div>
          <h2
            className="text-lg font-bold uppercase tracking-[0.15em]"
            style={{ fontFamily: SOVIET_FONT, color: '#2a1508' }}
          >
            New Assignment Dossier
          </h2>
        </div>

        {/* Scrollable content — all sections */}
        <div className="px-4 py-4 space-y-5">
          {/* ── Section I: Assignment ── */}
          <SectionDivider label="I. Assignment" />

          <p className="text-xs leading-relaxed" style={{ color: '#5a3d20' }}>
            Complete your assignment details. The Central Committee requires accurate personal
            information. Inaccuracies will be noted in your personnel file.
          </p>

          <FormField label="Full Name (Comrade)">
            <div className="flex gap-2">
              <input
                type="text"
                value={config.playerName}
                onChange={(e) => update('playerName', e.target.value)}
                className="flex-1 px-2 py-1.5 border-2 text-sm outline-none focus:border-[#8b0000]"
                style={{
                  borderColor: parchment.border.primary,
                  fontFamily: DOCUMENT_FONT,
                  color: '#2a1508',
                  background: '#faf3e6',
                }}
                placeholder="Enter your name"
              />
              <GenerateButton
                onClick={() => update('playerName', randomPlayerName())}
                label="Generate name"
              />
            </div>
          </FormField>

          <FormField label="Settlement Designation">
            <div className="flex gap-2">
              <input
                type="text"
                value={config.cityName}
                onChange={(e) => update('cityName', e.target.value)}
                className="flex-1 px-2 py-1.5 border-2 text-sm outline-none focus:border-[#8b0000]"
                style={{
                  borderColor: parchment.border.primary,
                  fontFamily: DOCUMENT_FONT,
                  color: '#2a1508',
                  background: '#faf3e6',
                }}
                placeholder="Enter city name"
              />
              <GenerateButton
                onClick={() => update('cityName', generateCityName())}
                label="Generate city"
              />
            </div>
          </FormField>

          {/* ── Section II: Parameters ── */}
          <SectionDivider label="II. Parameters" />

          {/* Difficulty */}
          <FormField label="Difficulty Classification">
            <div className="space-y-1.5">
              {difficulties.map((d) => {
                const info = DIFFICULTY_INFO[d];
                const selected = config.difficulty === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => update('difficulty', d)}
                    className={cn(
                      'w-full text-left px-3 py-2 border-2 text-xs transition-all cursor-pointer',
                      selected
                        ? 'border-[#8b0000] bg-[#8b0000]/10'
                        : 'border-transparent hover:border-[#8b4513]/40 bg-[#faf3e6]/50'
                    )}
                    style={{ fontFamily: DOCUMENT_FONT, color: '#3b2510' }}
                  >
                    <span className="font-bold uppercase tracking-wider">{info.label}</span>
                    <span className="block text-[10px] mt-0.5" style={{ color: '#6b4a2a' }}>
                      {info.description}
                    </span>
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
                const selected = config.mapSize === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => update('mapSize', s)}
                    className={cn(
                      'flex-1 py-2 border-2 text-xs font-bold uppercase text-center transition-all cursor-pointer',
                      selected
                        ? 'border-[#8b0000] bg-[#8b0000]/10'
                        : 'border-[#8b4513]/30 hover:border-[#8b4513]/60 bg-[#faf3e6]/50'
                    )}
                    style={{ color: '#3b2510' }}
                  >
                    {info.label}
                    <span className="block text-[9px] font-normal" style={{ color: '#6b4a2a' }}>
                      {info.tiles}
                    </span>
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
                value={config.seed}
                onChange={(e) => update('seed', e.target.value)}
                className="flex-1 px-2 py-1.5 border-2 text-xs outline-none focus:border-[#8b0000]"
                style={{
                  borderColor: parchment.border.primary,
                  fontFamily: DOCUMENT_FONT,
                  color: '#2a1508',
                  background: '#faf3e6',
                }}
              />
              <GenerateButton onClick={() => update('seed', randomSeed())} label="Random seed" />
            </div>
          </FormField>

          {/* Starting Era */}
          <FormField label="Starting Era">
            <select
              value={config.startEra}
              onChange={(e) => update('startEra', e.target.value as EraId)}
              className="w-full px-2 py-1.5 border-2 text-xs outline-none focus:border-[#8b0000] cursor-pointer"
              style={{
                borderColor: parchment.border.primary,
                fontFamily: DOCUMENT_FONT,
                color: '#2a1508',
                background: '#faf3e6',
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

          {/* ── Section III: Consequences ── */}
          <SectionDivider label="III. Consequences" />

          <FormField label="Consequence of Arrest">
            <div className="space-y-1.5">
              {consequences.map((c) => {
                const info = CONSEQUENCE_INFO[c];
                const selected = config.consequence === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => update('consequence', c)}
                    className={cn(
                      'w-full text-left px-3 py-2 border-2 text-xs transition-all cursor-pointer',
                      selected
                        ? 'border-[#8b0000] bg-[#8b0000]/10'
                        : 'border-transparent hover:border-[#8b4513]/40 bg-[#faf3e6]/50'
                    )}
                    style={{ fontFamily: DOCUMENT_FONT, color: '#3b2510' }}
                  >
                    <span className="font-bold uppercase tracking-wider">{info.label}</span>
                    <span className="block text-[10px] mt-0.5" style={{ color: '#6b4a2a' }}>
                      {info.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </FormField>

          {/* ── Summary ── */}
          <div
            className="border-2 p-3 text-[11px] space-y-1.5"
            style={{
              borderColor: parchment.border.primary,
              background: '#e8dcc0',
              color: '#3b2510',
            }}
          >
            <div
              className="font-bold uppercase tracking-[0.15em] text-xs mb-2"
              style={{ color: '#2a1508' }}
            >
              Assignment Summary
            </div>
            <SummaryRow label="Comrade" value={config.playerName} />
            <SummaryRow label="Settlement" value={config.cityName} />
            <SummaryRow label="Difficulty" value={DIFFICULTY_INFO[config.difficulty].label} />
            <SummaryRow label="Sector" value={MAP_SIZE_INFO[config.mapSize].tiles} />
            <SummaryRow
              label="Era"
              value={`${ERA_DEFINITIONS[config.startEra].name} (${ERA_DEFINITIONS[config.startEra].startYear})`}
            />
            <SummaryRow label="Seed" value={config.seed} />
            <SummaryRow label="Consequence" value={CONSEQUENCE_INFO[config.consequence].label} />
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-4 py-3 border-t-2"
          style={{
            background: parchment.surface.alt,
            borderColor: parchment.border.primary,
          }}
        >
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold uppercase tracking-wider border-2 transition-all active:translate-y-0.5 cursor-pointer"
            style={{
              borderColor: parchment.border.primary,
              color: '#3b2510',
              background: parchment.surface.paper,
            }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>

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
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
//  SHARED SUB-COMPONENTS
// ─────────────────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-1" style={{ borderColor: parchment.border.primary }}>
      <div className="h-px flex-1" style={{ background: parchment.border.primary }} />
      <span
        className="text-xs font-bold uppercase tracking-[0.15em]"
        style={{ fontFamily: SOVIET_FONT, color: accent.red }}
      >
        {label}
      </span>
      <div className="h-px flex-1" style={{ background: parchment.border.primary }} />
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className="block text-[10px] font-bold uppercase tracking-[0.15em] mb-1.5"
        style={{ color: '#5a3d20' }}
      >
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
      <Shuffle className="w-3.5 h-3.5" style={{ color: '#3b2510' }} />
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: '#6b4a2a' }}>{label}:</span>
      <span className="font-bold text-right" style={{ color: '#2a1508' }}>
        {value}
      </span>
    </div>
  );
}
