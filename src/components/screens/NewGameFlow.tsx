import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shuffle, ArrowLeft, Stamp, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parchment } from '@/lib/theme';
import type { GameConfig, GameDifficulty, MapSize, GameConsequence } from '@/components/GameWorld';
import { DIFFICULTIES, MAP_SIZES, CONSEQUENCES, TABS } from './NewGameFlow/constants';
import { SelectionList } from './NewGameFlow/tabs/SelectionList';

interface NewGameFlowProps {
  onStart: (config: GameConfig) => void;
  onBack: () => void;
}

export function NewGameFlow({ onStart, onBack }: NewGameFlowProps) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['id']>('assignment');
  const [config, setConfig] = useState<GameConfig>({
    difficulty: 'comrade',
    mapSize: 64,
    consequence: 'none',
    seed: Math.random().toString(36).substring(7),
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRandomizeSeed = () => {
    setConfig(prev => ({
      ...prev,
      seed: Math.random().toString(36).substring(7),
    }));
  };

  const handleBegin = () => {
    setIsSubmitting(true);
    // Simulate stamping/processing delay
    setTimeout(() => {
      onStart(config);
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-4xl h-[80vh] flex flex-col relative shadow-2xl overflow-hidden rounded-sm"
        style={{
          backgroundColor: parchment.bg,
          color: parchment.text,
        }}
      >
        {/* Header - Dossier Style */}
        <div className="h-16 flex items-center px-6 border-b-2 border-[#8b4513]/20 bg-[#8b4513]/5 shrink-0">
          <FileText className="w-6 h-6 mr-3 opacity-70" />
          <div className="flex-1">
            <h2 className="text-xl font-bold uppercase tracking-widest text-[#5d4037]">
              Assignment Dossier #{(Math.random() * 10000).toFixed(0)}
            </h2>
            <div className="text-xs font-mono opacity-60">
              CONFIDENTIAL // EYES ONLY // STATE PLANNING COMMITTEE
            </div>
          </div>
          <div className="text-right text-xs font-mono opacity-50">
            {new Date().toLocaleDateString().toUpperCase()}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Tabs (Folder Tabs) */}
          <div className="w-48 bg-[#8b4513]/5 border-r-2 border-[#8b4513]/20 flex flex-col py-4 shrink-0">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "w-full text-left px-6 py-3 font-bold uppercase tracking-wider text-xs transition-all relative",
                    isActive
                      ? "text-[#8b4513] bg-[#8b4513]/10 border-l-4 border-[#8b4513]"
                      : "text-[#8b4513]/60 hover:bg-[#8b4513]/5 hover:text-[#8b4513]/80 border-l-4 border-transparent"
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-8 relative">
            <div className="max-w-2xl mx-auto">
              <AnimatePresence mode="wait">
                {activeTab === 'assignment' && (
                  <motion.div
                    key="assignment"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <AssignmentTab
                      difficulty={config.difficulty}
                      onChange={(d) => setConfig(prev => ({ ...prev, difficulty: d }))}
                    />
                  </motion.div>
                )}

                {activeTab === 'parameters' && (
                  <motion.div
                    key="parameters"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ParametersTab
                      mapSize={config.mapSize}
                      seed={config.seed}
                      onMapSizeChange={(s) => setConfig(prev => ({ ...prev, mapSize: s }))}
                      onSeedChange={(s) => setConfig(prev => ({ ...prev, seed: s }))}
                      onRandomizeSeed={handleRandomizeSeed}
                    />
                  </motion.div>
                )}

                {activeTab === 'consequences' && (
                  <motion.div
                    key="consequences"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ConsequencesTab
                      consequence={config.consequence}
                      onChange={(c) => setConfig(prev => ({ ...prev, consequence: c }))}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="h-20 border-t-2 border-[#8b4513]/20 bg-[#8b4513]/5 flex items-center justify-between px-8 shrink-0">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center px-6 py-2 text-sm font-bold uppercase tracking-widest border-2 border-transparent hover:border-[#8b4513]/30 transition-colors text-[#654321]/70"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Cancel Assignment
          </button>

          <button
            type="button"
            onClick={handleBegin}
            disabled={isSubmitting}
            className="relative overflow-hidden px-8 py-3 bg-[#8b4513] text-[#f5e6d3] font-bold uppercase tracking-widest shadow-lg hover:bg-[#6d360f] transition-all active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <span className="relative z-10 flex items-center">
              <Stamp className="w-5 h-5 mr-2" />
              Execute Order
            </span>
            {isSubmitting && (
              <motion.div
                className="absolute inset-0 bg-[#3e1f0a]/50 flex items-center justify-center z-20"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="w-5 h-5 border-2 border-[#f5e6d3] border-t-transparent rounded-full animate-spin" />
              </motion.div>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// --- Sub-components for Tabs ---

function AssignmentTab({ difficulty, onChange }: { difficulty: GameDifficulty; onChange: (d: GameDifficulty) => void }) {
  const options = Object.entries(DIFFICULTIES).map(([id, info]) => ({
    id: id as GameDifficulty,
    label: info.label,
    description: info.description,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold uppercase tracking-widest mb-2 border-b border-[#8b4513]/20 pb-1">
          Difficulty Assessment
        </h3>
        <p className="text-sm opacity-80 mb-4">
          Determine the hardship level for the settlement. The Party expects results regardless of conditions.
        </p>
      </div>
      <SelectionList options={options} selectedId={difficulty} onSelect={onChange} />
    </div>
  );
}

function ParametersTab({
  mapSize,
  seed,
  onMapSizeChange,
  onSeedChange,
  onRandomizeSeed
}: {
  mapSize: MapSize;
  seed: string;
  onMapSizeChange: (s: MapSize) => void;
  onSeedChange: (s: string) => void;
  onRandomizeSeed: () => void;
}) {
  const options = Object.entries(MAP_SIZES).map(([id, info]) => ({
    id: Number(id) as MapSize,
    label: info.label,
    description: info.description,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-bold uppercase tracking-widest mb-2 border-b border-[#8b4513]/20 pb-1">
          Territory Specification
        </h3>
        <p className="text-sm opacity-80 mb-4">
          Select the designated region size for development.
        </p>
        <SelectionList options={options} selectedId={mapSize} onSelect={onMapSizeChange} />
      </div>

      <div>
        <h3 className="text-lg font-bold uppercase tracking-widest mb-2 border-b border-[#8b4513]/20 pb-1">
          Generation Seed
        </h3>
        <p className="text-sm opacity-80 mb-4">
          Unique identifier for terrain generation.
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={seed}
              onChange={(e) => onSeedChange(e.target.value)}
              className="w-full bg-[#8b4513]/5 border-2 border-[#8b4513]/20 p-2 font-mono text-sm focus:border-[#8b4513] outline-none transition-colors"
              style={{ fontFamily: 'monospace' }}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] uppercase font-bold opacity-40">
              ID-REF
            </div>
          </div>
          <button
            type="button"
            onClick={onRandomizeSeed}
            className="px-4 py-2 border-2 flex items-center justify-center transition-all active:translate-y-0.5 hover:bg-[#8b4513]/10"
            style={{ borderColor: parchment.border.primary }}
            title="Randomize"
          >
            <Shuffle className="w-5 h-5 text-[#8b4513]" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ConsequencesTab({ consequence, onChange }: { consequence: GameConsequence; onChange: (c: GameConsequence) => void }) {
  const options = Object.entries(CONSEQUENCES).map(([id, info]) => ({
    id: id as GameConsequence,
    label: info.label,
    description: info.description,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold uppercase tracking-widest mb-2 border-b border-[#8b4513]/20 pb-1">
          Special Conditions
        </h3>
        <p className="text-sm opacity-80 mb-4">
          Applied global modifiers. WARNING: These conditions drastically alter simulation parameters.
        </p>
      </div>
      <SelectionList options={options} selectedId={consequence} onSelect={onChange} />
    </div>
  );
}
