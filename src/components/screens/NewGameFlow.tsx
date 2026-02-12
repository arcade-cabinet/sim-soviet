/**
 * NewGameFlow -- Consolidated new game configuration dossier.
 *
 * A single modal with folder tabs for "Assignment", "Parameters", and "Consequences".
 * Replaces the multi-step wizard for a more consolidated UI.
 *
 * Uses parchment (light) theme tokens.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { Shuffle } from 'lucide-react';
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

type TabId = 'assignment' | 'parameters' | 'consequences';
const TABS: { id: TabId; label: string }[] = [
  { id: 'assignment', label: 'Assignment' },
  { id: 'parameters', label: 'Parameters' },
  { id: 'consequences', label: 'Consequences' },
];

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
 * Consolidated new game configuration dossier.
 *
 * Renders a single modal with tabs for navigating the configuration sections.
 */
export function NewGameFlow({ onStart, onBack }: NewGameFlowProps) {
  const [activeTab, setActiveTab] = useState<TabId>('assignment');
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-30 flex items-center justify-center px-4 py-6 overflow-y-auto"
      style={{
        fontFamily: DOCUMENT_FONT,
        background: 'rgba(0,0,0,0.92)',
      }}
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="w-full max-w-2xl relative flex flex-col h-auto max-h-[90vh]"
      >
        {/* Folder Tabs */}
        <div className="flex items-end pl-4 gap-1 select-none">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-6 py-2 rounded-t-lg border-t-2 border-l-2 border-r-2 text-sm font-bold uppercase tracking-wider transition-all relative z-10',
                  isActive
                    ? 'bg-[#f4e8d0] text-[#654321] border-[#8b4513] translate-y-[2px] pb-3'
                    : 'bg-[#e8dcc0] text-[#8b4513]/70 border-[#8b4513]/50 hover:bg-[#ebdcb0] mb-0'
                )}
                style={{
                  fontFamily: SOVIET_FONT,
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Main Dossier Content */}
        <div
          className="relative z-20 flex-1 flex flex-col rounded-b-sm rounded-tr-sm border-2 shadow-2xl"
          style={{
            background: parchment.surface.paper,
            borderColor: parchment.border.primary,
            color: parchment.text.primary,
          }}
        >
          {/* Header Strip */}
          <div
            className="px-6 py-4 border-b-2 flex justify-between items-center"
            style={{
              background: parchment.surface.header,
              borderColor: parchment.border.primary,
            }}
          >
            <div>
              <div className="text-xs uppercase tracking-[0.2em] opacity-60">
                Ministry of Planning -- Form NP-2000
              </div>
              <h2
                className="text-xl font-bold uppercase tracking-[0.1em] mt-1"
                style={{ fontFamily: SOVIET_FONT }}
              >
                New Settlement Directive
              </h2>
            </div>
            <div className="text-right">
              <div className="text-xs opacity-60 uppercase tracking-widest">Date</div>
              <div className="font-bold font-mono">1922.10.25</div>
            </div>
          </div>

          {/* Scrollable Content Area */}
          <div className="p-6 flex-1 overflow-y-auto min-h-[400px]">
            <AnimatePresence mode="wait">
              {activeTab === 'assignment' && (
                <TabContent key="assignment">
                  <StepAssignment
                    playerName={config.playerName}
                    cityName={config.cityName}
                    onPlayerName={(v) => update('playerName', v)}
                    onCityName={(v) => update('cityName', v)}
                  />
                </TabContent>
              )}
              {activeTab === 'parameters' && (
                <TabContent key="parameters">
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
                </TabContent>
              )}
              {activeTab === 'consequences' && (
                <TabContent key="consequences">
                  <StepConsequences
                    config={config}
                    onConsequence={(v) => update('consequence', v)}
                  />
                </TabContent>
              )}
            </AnimatePresence>
          </div>

          {/* Footer Actions */}
          <div
            className="px-6 py-4 border-t-2 flex justify-between items-center bg-[#e8dcc0]"
            style={{ borderColor: parchment.border.primary }}
          >
            <button
              onClick={onBack}
              className="px-6 py-2 text-sm font-bold uppercase tracking-widest border-2 border-transparent hover:border-[#8b4513]/30 transition-colors text-[#654321]/70"
            >
              Cancel Assignment
            </button>
            <button
              onClick={handleBegin}
              className="px-8 py-3 text-lg font-bold uppercase tracking-[0.2em] text-white transition-transform active:translate-y-0.5 hover:brightness-110 shadow-lg"
              style={{
                fontFamily: SOVIET_FONT,
                background: accent.red,
                boxShadow: '4px 4px 0px rgba(0,0,0,0.2)',
              }}
            >
              EXECUTE ORDER
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
//  TAB ANIMATION WRAPPER
// ─────────────────────────────────────────────────────────

function TabContent({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
//  SECTIONS
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
    <div className="space-y-8 max-w-lg mx-auto mt-4">
      <div className="p-4 border-2 border-[#8b4513]/20 bg-[#f8f1e0] text-sm italic text-[#654321]/80">
        "Comrade, the Central Committee requires accurate personal information. Inaccuracies will be
        noted in your permanent personnel file."
      </div>

      <FormField label="Chairman Identity (Full Name)">
        <div className="flex gap-3">
          <input
            type="text"
            value={playerName}
            onChange={(e) => onPlayerName(e.target.value)}
            className="flex-1 px-4 py-3 border-2 text-base bg-white/60 outline-none focus:border-[#8b0000] transition-colors"
            style={{ borderColor: parchment.border.primary }}
            placeholder="Enter your name"
          />
          <GenerateButton onClick={() => onPlayerName(randomPlayerName())} />
        </div>
      </FormField>

      <FormField label="Settlement Designation">
        <div className="flex gap-3">
          <input
            type="text"
            value={cityName}
            onChange={(e) => onCityName(e.target.value)}
            className="flex-1 px-4 py-3 border-2 text-base bg-white/60 outline-none focus:border-[#8b0000] transition-colors"
            style={{ borderColor: parchment.border.primary }}
            placeholder="Enter city name"
          />
          <GenerateButton onClick={() => onCityName(generateCityName())} />
        </div>
      </FormField>
    </div>
  );
}

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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
      {/* Difficulty */}
      <div className="col-span-1 md:col-span-2">
        <FormField label="Difficulty Classification">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {difficulties.map((d) => {
              const info = DIFFICULTY_INFO[d];
              const selected = difficulty === d;
              return (
                <button
                  key={d}
                  onClick={() => onDifficulty(d)}
                  className={cn(
                    'text-left px-4 py-3 border-2 transition-all hover:bg-[#8b4513]/5',
                    selected
                      ? 'border-[#8b0000] bg-[#8b0000]/10 ring-1 ring-[#8b0000]'
                      : 'border-[#8b4513]/30 bg-white/40'
                  )}
                >
                  <div className="font-bold uppercase tracking-wider text-sm mb-1">
                    {info.label}
                  </div>
                  <div className="text-xs opacity-70 leading-snug">{info.description}</div>
                </button>
              );
            })}
          </div>
        </FormField>
      </div>

      {/* Map Size */}
      <FormField label="Sector Dimensions">
        <div className="flex gap-2">
          {mapSizes.map((s) => {
            const info = MAP_SIZE_INFO[s];
            const selected = mapSize === s;
            return (
              <button
                key={s}
                onClick={() => onMapSize(s)}
                className={cn(
                  'flex-1 py-3 border-2 text-sm font-bold uppercase text-center transition-all',
                  selected
                    ? 'border-[#8b0000] bg-[#8b0000]/10 text-[#8b0000]'
                    : 'border-[#8b4513]/30 hover:border-[#8b4513]/60 bg-white/40'
                )}
              >
                {info.label}
                <span className="block text-[10px] font-normal opacity-60 mt-0.5">
                  {info.tiles}
                </span>
              </button>
            );
          })}
        </div>
      </FormField>

      {/* Starting Era */}
      <FormField label="Starting Era">
        <select
          value={startEra}
          onChange={(e) => onStartEra(e.target.value as EraId)}
          className="w-full px-4 py-3 border-2 text-sm bg-white/60 outline-none focus:border-[#8b0000] cursor-pointer"
          style={{ borderColor: parchment.border.primary }}
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

      {/* Seed */}
      <div className="col-span-1 md:col-span-2">
        <FormField label="Cartographic Seed">
          <div className="flex gap-3">
            <input
              type="text"
              value={seed}
              onChange={(e) => onSeed(e.target.value)}
              className="flex-1 px-4 py-3 border-2 text-sm bg-white/60 outline-none focus:border-[#8b0000]"
              style={{ borderColor: parchment.border.primary }}
            />
            <GenerateButton onClick={() => onSeed(randomSeed())} />
          </div>
        </FormField>
      </div>
    </div>
  );
}

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
    <div className="space-y-8">
      <FormField label="Failure Consequence (Arrest Protocol)">
        <div className="space-y-3">
          {consequences.map((c) => {
            const info = CONSEQUENCE_INFO[c];
            const selected = config.consequence === c;
            return (
              <button
                key={c}
                onClick={() => onConsequence(c)}
                className={cn(
                  'w-full text-left px-4 py-3 border-2 transition-all hover:bg-[#8b4513]/5 flex items-start gap-4',
                  selected
                    ? 'border-[#8b0000] bg-[#8b0000]/10'
                    : 'border-[#8b4513]/30 bg-white/40'
                )}
              >
                <div
                  className={cn(
                    'w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0',
                    selected ? 'border-[#8b0000] bg-[#8b0000]' : 'border-[#8b4513]/50'
                  )}
                />
                <div>
                  <span className="font-bold uppercase tracking-wider text-sm">{info.label}</span>
                  <span className="block text-sm opacity-70 mt-0.5">{info.description}</span>
                </div>
              </button>
            );
          })}
        </div>
      </FormField>

      {/* Summary Box */}
      <div className="mt-8 border-2 border-[#8b4513]/30 bg-[#e8dcc0]/30 p-5">
        <div className="text-xs font-bold uppercase tracking-[0.2em] mb-4 text-[#8b4513]/60 border-b border-[#8b4513]/20 pb-2">
          Final Review
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <SummaryRow label="Comrade" value={config.playerName} />
          <SummaryRow label="Settlement" value={config.cityName} />
          <SummaryRow label="Difficulty" value={diffInfo.label} />
          <SummaryRow label="Map Size" value={MAP_SIZE_INFO[config.mapSize].tiles} />
          <SummaryRow label="Start Era" value={`${era.name} (${era.startYear})`} />
          <SummaryRow label="Seed" value={config.seed} />
        </div>
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
      <div className="block text-xs font-bold uppercase tracking-[0.15em] mb-2 text-[#654321]/70">
        {label}
      </div>
      {children}
    </div>
  );
}

function GenerateButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 border-2 flex items-center justify-center transition-all active:translate-y-0.5 hover:bg-[#8b4513]/10"
      style={{ borderColor: parchment.border.primary }}
      title="Randomize"
    >
      <Shuffle className="w-5 h-5 text-[#8b4513]" />
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase opacity-60 mb-0.5">{label}</span>
      <span className="font-bold font-mono text-[#4a3015]">{value}</span>
    </div>
  );
}
