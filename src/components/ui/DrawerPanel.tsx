/**
 * DrawerPanel — slide-out command panel from the right edge.
 *
 * Organized into 4 tabs for quick navigation:
 *   1. OVERVIEW — Settlement, Population Registry, Alerts
 *   2. PLAN — 5-Year Plan, Collective Focus, Personnel File, Leader
 *   3. RADIO — Now Playing, Playlist, Announcements, Volume
 *   4. ARCHIVES — Save/Load/Export/Import, Minimap
 */
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Download,
  HardDrive,
  Map as MapIcon,
  Music,
  Pause,
  Play,
  Radio,
  Save,
  ShoppingBag,
  SkipForward,
  Target,
  Upload,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GAMEPLAY_PLAYLIST, getAudioById } from '@/audio/AudioManifest';
import type { AudioAPI, SaveSystemAPI, WorkerAPI } from '@/components/GameWorld';
import { getRandomAnnouncement } from '@/content/worldbuilding/radio';
import { exportDatabaseFile, importDatabaseFile } from '@/db/provider';
import { cn } from '@/lib/utils';
import {
  notifyStateChange,
  setColorBlindMode,
  useColorBlindMode,
  useGameSnapshot,
} from '@/stores/gameStore';
import { addSovietToast } from '@/stores/toastStore';
import { ConsumerGoodsMarket } from './ConsumerGoodsMarket';

export type DrawerTab = 'overview' | 'plan' | 'radio' | 'archives';

interface DrawerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  saveApi?: SaveSystemAPI | null;
  audioApi?: AudioAPI | null;
  workerApi?: WorkerAPI | null;
}

const TIER_RUSSIAN: Record<string, string> = {
  selo: 'село',
  posyolok: 'рабочий посёлок',
  pgt: 'пос. гор. типа',
  gorod: 'город',
};

const ROAD_QUALITY_LABELS: Record<string, string> = {
  none: 'No Roads',
  dirt: 'Dirt Tracks',
  gravel: 'Gravel Roads',
  paved: 'Paved Roads',
  highway: 'Highway Network',
};

const ROAD_QUALITY_COLORS: Record<string, string> = {
  none: 'text-[#888]',
  dirt: 'text-[#d97706]',
  gravel: 'text-[#eab308]',
  paved: 'text-green-500',
  highway: 'text-cyan-400',
};

const THREAT_LABELS: Record<string, { label: string; color: string }> = {
  safe: { label: 'SAFE', color: 'text-green-500' },
  watched: { label: 'WATCHED', color: 'text-yellow-500' },
  warned: { label: 'WARNED', color: 'text-[#ffaa00]' },
  investigated: { label: 'INVESTIGATED', color: 'text-orange-500' },
  reviewed: { label: 'FILE UNDER REVIEW', color: 'text-[#ff4444]' },
  arrested: { label: 'ARRESTED', color: 'text-red-600' },
};

const TABS: { id: DrawerTab; label: string; icon: React.ComponentType<{ className?: string }> }[] =
  [
    { id: 'overview', label: 'STATUS', icon: BarChart3 },
    { id: 'plan', label: 'PLAN', icon: Target },
    { id: 'radio', label: 'RADIO', icon: Radio },
    { id: 'archives', label: 'FILES', icon: HardDrive },
  ];

export function DrawerPanel({ isOpen, onClose, saveApi, audioApi, workerApi }: DrawerPanelProps) {
  const snap = useGameSnapshot();
  const [activeTab, setActiveTab] = useState<DrawerTab>('overview');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const threatInfo = THREAT_LABELS[snap.threatLevel] ?? THREAT_LABELS.safe!;
  const tierRussian = TIER_RUSSIAN[snap.settlementTier] ?? 'село';
  const [musicVol, setMusicVol] = useState(() => audioApi?.getMusicVolume() ?? 0.5);
  const [ambientVol, setAmbientVol] = useState(() => audioApi?.getAmbientVolume() ?? 0.4);
  const [isMuted, setIsMuted] = useState(() => audioApi?.isMuted() ?? true);
  const [collectiveFocus, setCollectiveFocus] = useState<
    'food' | 'construction' | 'production' | 'balanced'
  >(() => workerApi?.getCollectiveFocus() ?? 'balanced');

  // Quota info
  const quotaProgress =
    snap.quota.target > 0 ? Math.min(snap.quota.current / snap.quota.target, 1) : 0;
  const quotaPct = Math.round(quotaProgress * 100);
  const yearsLeft = Math.max(snap.quota.deadlineYear - snap.date.year, 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 z-40"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="fixed right-0 top-0 bottom-0 w-72 sm:w-80 bg-[#2a2a2a] border-l-2 border-[#8b0000] z-50 flex flex-col shadow-2xl"
            style={{ fontFamily: "'VT323', monospace" }}
          >
            {/* Header with close button */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#444] bg-[#1a1a1a]">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-[#8b0000] flex items-center justify-center">
                  <span className="text-[#cfaa48] text-xs">☭</span>
                </div>
                <span className="text-[#cfaa48] text-xs font-bold uppercase tracking-wider">
                  Command Panel
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center bg-[#2a2a2a] border border-[#444] hover:border-[#8b0000] transition-colors"
                aria-label="Close menu"
              >
                <X className="w-3.5 h-3.5 text-[#888]" />
              </button>
            </div>

            {/* Tab bar */}
            <div className="flex border-b-2 border-[#8b0000] bg-[#1a1a1a]">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex-1 flex flex-col items-center gap-0.5 py-2 px-1 transition-colors',
                      isActive
                        ? 'bg-[#2a2a2a] border-b-2 border-[#cfaa48] -mb-[2px]'
                        : 'hover:bg-[#333]'
                    )}
                    aria-label={tab.label}
                  >
                    <Icon
                      className={cn('w-3.5 h-3.5', isActive ? 'text-[#cfaa48]' : 'text-[#666]')}
                    />
                    <span
                      className={cn(
                        'text-[8px] font-bold uppercase tracking-wider',
                        isActive ? 'text-[#cfaa48]' : 'text-[#666]'
                      )}
                    >
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeTab === 'overview' && (
                <OverviewTab
                  snap={snap}
                  tierRussian={tierRussian}
                  threatInfo={threatInfo}
                  quotaPct={quotaPct}
                  yearsLeft={yearsLeft}
                />
              )}
              {activeTab === 'plan' && (
                <PlanTab
                  snap={snap}
                  quotaPct={quotaPct}
                  yearsLeft={yearsLeft}
                  collectiveFocus={collectiveFocus}
                  setCollectiveFocus={setCollectiveFocus}
                  workerApi={workerApi}
                  threatInfo={threatInfo}
                />
              )}
              {activeTab === 'radio' && (
                <RadioTab
                  audioApi={audioApi}
                  isMuted={isMuted}
                  setIsMuted={setIsMuted}
                  musicVol={musicVol}
                  setMusicVol={setMusicVol}
                  ambientVol={ambientVol}
                  setAmbientVol={setAmbientVol}
                />
              )}
              {activeTab === 'archives' && (
                <ArchivesTab saveApi={saveApi} fileInputRef={fileInputRef} onClose={onClose} />
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-[#444] bg-[#1a1a1a]">
              <div className="text-[#666] text-[9px] text-center uppercase tracking-widest">
                Ministry of Information
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB: OVERVIEW — Settlement, Population, Alerts
// ═══════════════════════════════════════════════════════════

function OverviewTab({
  snap,
  tierRussian,
  threatInfo,
  quotaPct,
  yearsLeft,
}: {
  snap: ReturnType<typeof useGameSnapshot>;
  tierRussian: string;
  threatInfo: { label: string; color: string };
  quotaPct: number;
  yearsLeft: number;
}) {
  return (
    <>
      <DrawerSection icon={Building2} title="SETTLEMENT">
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Buildings" value={String(snap.buildingCount)} icon="🏛️" />
          <StatCard label="Population" value={snap.pop.toLocaleString()} icon="👥" />
          <StatCard label="Tier" value={tierRussian} icon="🏘️" />
          <StatCard
            label="Threat"
            value={threatInfo.label}
            icon="📋"
            valueClass={threatInfo.color}
          />
          <StatCard
            label="Roads"
            value={ROAD_QUALITY_LABELS[snap.roadQuality] ?? 'No Roads'}
            icon="🛤️"
            valueClass={ROAD_QUALITY_COLORS[snap.roadQuality] ?? 'text-[#888]'}
          />
          <RoadConditionCard condition={snap.roadCondition} />
          <StatCard label="Power" value={`${snap.powerUsed}/${snap.power}`} icon="⚡" />
        </div>
      </DrawerSection>

      <PopulationRegistrySection snap={snap} />

      <DrawerSection icon={ShoppingBag} title="GUM MARKET">
        <ConsumerGoodsMarket />
      </DrawerSection>

      <AlertsSection snap={snap} quotaPct={quotaPct} yearsLeft={yearsLeft} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB: PLAN — 5-Year Plan, Collective Focus, Personnel, Leader
// ═══════════════════════════════════════════════════════════

function PlanTab({
  snap,
  quotaPct,
  yearsLeft,
  collectiveFocus,
  setCollectiveFocus,
  workerApi,
  threatInfo,
}: {
  snap: ReturnType<typeof useGameSnapshot>;
  quotaPct: number;
  yearsLeft: number;
  collectiveFocus: 'food' | 'construction' | 'production' | 'balanced';
  setCollectiveFocus: (v: 'food' | 'construction' | 'production' | 'balanced') => void;
  workerApi?: WorkerAPI | null;
  threatInfo: { label: string; color: string };
}) {
  return (
    <>
      <QuotaSection snap={snap} quotaPct={quotaPct} yearsLeft={yearsLeft} />

      <CollectiveFocusSection
        collectiveFocus={collectiveFocus}
        setCollectiveFocus={setCollectiveFocus}
        workerApi={workerApi}
      />

      <PersonnelFileSection snap={snap} threatInfo={threatInfo} />

      {snap.leaderName && (
        <div className="bg-[#1a1a1a] border border-[#444] px-3 py-2">
          <div className="text-[#888] text-[8px] uppercase tracking-wider mb-1">
            General Secretary
          </div>
          <div className="text-[#ff6b6b] text-xs font-bold">{snap.leaderName}</div>
          {snap.leaderPersonality && (
            <div className="text-[#888] text-[9px] italic mt-0.5">{snap.leaderPersonality}</div>
          )}
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB: RADIO — Now Playing, Playlist, Announcements, Volume
// ═══════════════════════════════════════════════════════════

function RadioTab({
  audioApi,
  isMuted,
  setIsMuted,
  musicVol,
  setMusicVol,
  ambientVol,
  setAmbientVol,
}: {
  audioApi?: AudioAPI | null;
  isMuted: boolean;
  setIsMuted: (v: boolean) => void;
  musicVol: number;
  setMusicVol: (v: number) => void;
  ambientVol: number;
  setAmbientVol: (v: number) => void;
}) {
  const [currentTrack, setCurrentTrack] = useState<string | null>(
    () => audioApi?.getCurrentMusic() ?? null
  );
  const [announcement, setAnnouncement] = useState(() => getRandomAnnouncement());

  // Poll current track every 2s (music can change from era/season switches)
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTrack(audioApi?.getCurrentMusic() ?? null);
    }, 2000);
    return () => clearInterval(interval);
  }, [audioApi]);

  // Cycle radio announcements every 20s
  useEffect(() => {
    const interval = setInterval(() => {
      setAnnouncement(getRandomAnnouncement());
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  const currentAsset = currentTrack ? getAudioById(currentTrack) : null;

  const handlePlayTrack = useCallback(
    (trackId: string) => {
      audioApi?.playMusic(trackId);
      setCurrentTrack(trackId);
    },
    [audioApi]
  );

  const handleSkip = useCallback(() => {
    // Pick a random track from the playlist that isn't the current one
    const candidates = GAMEPLAY_PLAYLIST.filter((id) => id !== currentTrack);
    if (candidates.length > 0) {
      const next = candidates[Math.floor(Math.random() * candidates.length)]!;
      handlePlayTrack(next);
    }
  }, [currentTrack, handlePlayTrack]);

  return (
    <>
      {/* Now Playing */}
      <DrawerSection icon={Music} title="NOW PLAYING">
        <div className="bg-[#1a1a1a] border border-[#444] px-3 py-2">
          {currentAsset ? (
            <>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#ff4444] animate-pulse flex-shrink-0" />
                <div className="text-[#cfaa48] text-xs font-bold truncate">
                  {currentAsset.description}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={handleSkip}
                  className="flex items-center gap-1 px-2 py-1 bg-[#2a2a2a] border border-[#444] hover:border-[#8b0000] transition-colors text-[#888] hover:text-[#cfaa48]"
                  title="Skip to next track"
                >
                  <SkipForward className="w-3 h-3" />
                  <span className="text-[9px] font-bold uppercase">Skip</span>
                </button>
              </div>
            </>
          ) : (
            <div className="text-[#666] text-[10px] italic">No track playing</div>
          )}
        </div>
      </DrawerSection>

      {/* Radio Announcement */}
      <DrawerSection icon={Radio} title="RADIO BROADCAST">
        <div className="bg-[#1a1a1a] border border-[#444] px-3 py-2 relative">
          <div className="absolute top-1.5 right-2">
            <button
              type="button"
              onClick={() => setAnnouncement(getRandomAnnouncement())}
              className="text-[#666] hover:text-[#cfaa48] text-[8px] uppercase tracking-wider transition-colors"
            >
              next
            </button>
          </div>
          <div className="text-[#888] text-[8px] uppercase tracking-wider mb-1.5">
            {announcement.category.replace('_', ' ')}
          </div>
          <div className="text-[#ddd] text-[11px] leading-relaxed italic pr-6">
            &ldquo;{announcement.text}&rdquo;
          </div>
        </div>
      </DrawerSection>

      {/* Playlist */}
      <DrawerSection icon={BarChart3} title="APPROVED PLAYLIST">
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {GAMEPLAY_PLAYLIST.map((trackId) => {
            const asset = getAudioById(trackId);
            if (!asset) return null;
            const isPlaying = trackId === currentTrack;
            return (
              <button
                key={trackId}
                type="button"
                onClick={() => handlePlayTrack(trackId)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 text-left transition-colors border',
                  isPlaying
                    ? 'border-[#8b0000] bg-[#8b0000]/20 text-[#cfaa48]'
                    : 'border-[#333] bg-[#1a1a1a] text-[#888] hover:border-[#8b0000] hover:text-[#cfaa48]'
                )}
              >
                {isPlaying ? (
                  <Pause className="w-3 h-3 flex-shrink-0" />
                ) : (
                  <Play className="w-3 h-3 flex-shrink-0" />
                )}
                <span className="text-[10px] font-bold truncate">{asset.description}</span>
              </button>
            );
          })}
        </div>
      </DrawerSection>

      {/* Volume Controls */}
      <DrawerSection icon={isMuted ? VolumeX : Volume2} title="VOLUME CONTROLS">
        <div className="space-y-3">
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 border px-3 py-2 text-xs font-bold uppercase tracking-wider"
            style={{
              borderColor: isMuted ? '#8b0000' : '#444',
              background: isMuted ? 'rgba(139,0,0,0.3)' : 'rgba(26,26,26,0.8)',
              color: isMuted ? '#ff4444' : '#aaa',
            }}
            onClick={() => {
              const nowMuted = audioApi?.toggleMute() ?? !isMuted;
              setIsMuted(nowMuted);
            }}
          >
            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            {isMuted ? 'UNMUTE AUDIO' : 'MUTE AUDIO'}
          </button>
          <VolumeSlider
            label="MUSIC"
            value={musicVol}
            onChange={(v) => {
              setMusicVol(v);
              audioApi?.setMusicVolume(v);
            }}
          />
          <VolumeSlider
            label="AMBIENT"
            value={ambientVol}
            onChange={(v) => {
              setAmbientVol(v);
              audioApi?.setAmbientVolume(v);
            }}
          />
        </div>
      </DrawerSection>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB: ARCHIVES — Save/Load, Export/Import, Minimap
// ═══════════════════════════════════════════════════════════

function AccessibilitySection() {
  const colorBlind = useColorBlindMode();

  return (
    <DrawerSection icon={Users} title="ACCESSIBILITY">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={colorBlind}
          onChange={(e) => setColorBlindMode(e.target.checked)}
          className="accent-[#ff4444] w-4 h-4"
        />
        <span className="text-xs text-[#ccaa88]">Color-blind mode (shape outlines on workers)</span>
      </label>
    </DrawerSection>
  );
}

function ArchivesTab({
  saveApi,
  fileInputRef,
  onClose,
}: {
  saveApi?: SaveSystemAPI | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onClose: () => void;
}) {
  return (
    <>
      <ArchivesSection saveApi={saveApi} fileInputRef={fileInputRef} onClose={onClose} />

      <AccessibilitySection />

      {/* Minimap placeholder */}
      <DrawerSection icon={MapIcon} title="TACTICAL MAP">
        <div className="w-full aspect-square bg-[#1a1a1a] border-2 border-[#8b0000] relative">
          <div className="absolute inset-1 bg-gradient-to-br from-[#4a3a2a] to-[#2a1a0a]" />
          <div className="absolute inset-0 flex items-center justify-center text-[#ff4444] text-xs font-bold">
            MINIMAP
          </div>
        </div>
      </DrawerSection>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// Shared Sections (used by tabs)
// ═══════════════════════════════════════════════════════════

function PopulationRegistrySection({ snap }: { snap: ReturnType<typeof useGameSnapshot> }) {
  return (
    <DrawerSection icon={Users} title="POPULATION REGISTRY">
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Dvory" value={String(snap.dvorCount)} icon="🏠" />
        <StatCard label="Citizens" value={snap.pop.toLocaleString()} icon="👤" />
        <StatCard
          label="Morale"
          value={`${snap.avgMorale}%`}
          icon="😐"
          valueClass={thresholdColor(snap.avgMorale)}
          statusLabel={thresholdLabel(snap.avgMorale)}
        />
        <StatCard
          label="Loyalty"
          value={`${snap.avgLoyalty}%`}
          icon="⭐"
          valueClass={thresholdColor(snap.avgLoyalty)}
          statusLabel={thresholdLabel(snap.avgLoyalty)}
        />
        <StatCard label="Assigned" value={String(snap.assignedWorkers)} icon="🔨" />
        <StatCard label="Idle" value={String(snap.idleWorkers)} icon="💤" />
      </div>
    </DrawerSection>
  );
}

function QuotaSection({
  snap,
  quotaPct,
  yearsLeft,
}: {
  snap: ReturnType<typeof useGameSnapshot>;
  quotaPct: number;
  yearsLeft: number;
}) {
  return (
    <DrawerSection icon={BarChart3} title="5-YEAR PLAN">
      <div className="bg-[#1a1a1a] border border-[#444] px-2 py-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[#cfaa48] text-[10px] font-bold uppercase">{snap.quota.type}</span>
          <span className="text-[#888] text-[9px] font-mono">
            {yearsLeft} {yearsLeft === 1 ? 'yr' : 'yrs'} left
          </span>
        </div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-white text-xs font-mono">
            {Math.round(snap.quota.current)}/{snap.quota.target}
          </span>
          <span className="text-[#cfaa48] text-xs font-mono font-bold">{quotaPct}%</span>
        </div>
        <div className="w-full h-1.5 bg-[#333]">
          <div className="h-full bg-[#8b0000] transition-all" style={{ width: `${quotaPct}%` }} />
        </div>
      </div>
    </DrawerSection>
  );
}

function CollectiveFocusSection({
  collectiveFocus,
  setCollectiveFocus,
  workerApi,
}: {
  collectiveFocus: 'food' | 'construction' | 'production' | 'balanced';
  setCollectiveFocus: (v: 'food' | 'construction' | 'production' | 'balanced') => void;
  workerApi?: WorkerAPI | null;
}) {
  return (
    <DrawerSection icon={Target} title="COLLECTIVE FOCUS">
      <div className="grid grid-cols-2 gap-1.5">
        {(
          [
            { id: 'balanced', label: 'BALANCED' },
            { id: 'food', label: 'FOOD' },
            { id: 'construction', label: 'BUILD' },
            { id: 'production', label: 'PRODUCE' },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => {
              setCollectiveFocus(opt.id);
              workerApi?.setCollectiveFocus(opt.id);
            }}
            className={cn(
              'py-1.5 px-2 text-[10px] font-bold uppercase tracking-wider border transition-colors cursor-pointer',
              collectiveFocus === opt.id
                ? 'border-[#8b0000] bg-[#8b0000]/30 text-[#cfaa48]'
                : 'border-[#444] bg-[#1a1a1a] text-[#888] hover:border-[#8b0000]'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="text-[#666] text-[8px] mt-1.5">Shifts worker auto-assignment priorities</p>
    </DrawerSection>
  );
}

function AlertsSection({
  snap,
  quotaPct,
  yearsLeft,
}: {
  snap: ReturnType<typeof useGameSnapshot>;
  quotaPct: number;
  yearsLeft: number;
}) {
  const alerts = buildAlerts(snap, quotaPct, yearsLeft);
  return (
    <DrawerSection icon={AlertTriangle} title="ALERTS">
      <div className="space-y-2">
        {alerts.map((a) => (
          <AlertItem key={a.message} severity={a.severity} message={a.message} />
        ))}
      </div>
    </DrawerSection>
  );
}

function PersonnelFileSection({
  snap,
  threatInfo,
}: {
  snap: ReturnType<typeof useGameSnapshot>;
  threatInfo: { label: string; color: string };
}) {
  return (
    <DrawerSection icon={Users} title="PERSONNEL FILE">
      <div className="space-y-1.5">
        <PersonnelRow label="Black Marks" value={snap.blackMarks} color="text-[#ff4444]" />
        <PersonnelRow label="Commendations" value={snap.commendations} color="text-[#cfaa48]" />
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#444]">
          <span className="text-[#888] text-[10px]">STATUS</span>
          <span className={cn('text-xs font-bold', threatInfo.color)}>{threatInfo.label}</span>
        </div>
      </div>
    </DrawerSection>
  );
}

function ArchivesSection({
  saveApi,
  fileInputRef,
  onClose,
}: {
  saveApi?: SaveSystemAPI | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onClose: () => void;
}) {
  const handleSave = async () => {
    if (!saveApi) return;
    const ok = await saveApi.save('manual_1');
    addSovietToast(
      ok ? 'warning' : 'critical',
      ok ? 'Game saved to state archives' : 'Save failed — archival error'
    );
  };

  const handleLoad = async () => {
    if (!saveApi) return;
    const ok = await saveApi.load('manual_1');
    if (ok) {
      notifyStateChange();
      addSovietToast('warning', 'Game loaded from state archives');
      onClose();
    } else {
      addSovietToast('critical', 'No saved game found in archives');
    }
  };

  const handleExport = () => {
    const data = exportDatabaseFile();
    if (!data) {
      addSovietToast('critical', 'Export failed — database not initialized');
      return;
    }
    const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `simsoviet-save-${new Date().toISOString().slice(0, 10)}.db`;
    a.click();
    URL.revokeObjectURL(url);
    addSovietToast('warning', 'Database exported — guard with your life');
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      await importDatabaseFile(new Uint8Array(buffer));
      addSovietToast('warning', 'Database imported — reloading state');
      if (saveApi) {
        const loaded = await saveApi.load('autosave');
        if (loaded) {
          notifyStateChange();
          onClose();
        }
      }
    } catch (error) {
      console.error('Import failed:', error);
      addSovietToast('critical', 'Import failed — file is corrupted');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <DrawerSection icon={HardDrive} title="STATE ARCHIVES">
      <div className="grid grid-cols-2 gap-2">
        <DrawerButton icon={Save} label="SAVE" onClick={handleSave} disabled={!saveApi} />
        <DrawerButton icon={Upload} label="LOAD" onClick={handleLoad} disabled={!saveApi} />
        <DrawerButton icon={Download} label="EXPORT .DB" onClick={handleExport} />
        <DrawerButton
          icon={Upload}
          label="IMPORT .DB"
          onClick={() => fileInputRef.current?.click()}
        />
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".db,.sqlite,.sqlite3"
        className="hidden"
        onChange={handleFileSelected}
      />
    </DrawerSection>
  );
}

// ═══════════════════════════════════════════════════════════
// Helpers & Primitives
// ═══════════════════════════════════════════════════════════

function thresholdColor(value: number): string {
  if (value < 30) return 'text-[#ff4444]';
  if (value < 60) return 'text-[#ffaa00]';
  return 'text-green-500';
}

/** Returns a text label for color-coded threshold values. */
function thresholdLabel(value: number): string {
  if (value < 30) return 'LOW';
  if (value < 60) return 'OK';
  return 'HIGH';
}

function buildAlerts(
  snap: ReturnType<typeof useGameSnapshot>,
  quotaPct: number,
  yearsLeft: number
): Array<{ severity: 'critical' | 'warning' | 'info'; message: string }> {
  const alerts: Array<{ severity: 'critical' | 'warning' | 'info'; message: string }> = [];
  if (snap.food < 50)
    alerts.push({ severity: 'critical', message: 'Food reserves critically low' });
  if (snap.powerUsed > snap.power)
    alerts.push({ severity: 'critical', message: 'Power demand exceeds supply' });
  if (snap.food >= 50 && snap.food < 200)
    alerts.push({ severity: 'warning', message: 'Food reserves declining' });
  if (snap.blackMarks > 0) {
    alerts.push({
      severity: snap.blackMarks >= 5 ? 'critical' : 'warning',
      message: `${snap.blackMarks} black mark${snap.blackMarks !== 1 ? 's' : ''} in personnel file`,
    });
  }
  if (snap.quota.target > 0 && quotaPct < 30 && yearsLeft <= 1) {
    alerts.push({ severity: 'warning', message: 'Quota deadline approaching — behind schedule' });
  }
  if (alerts.length === 0) alerts.push({ severity: 'info', message: 'No current alerts' });
  return alerts;
}

function DrawerSection({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-[#8b0000]" />
        <span className="text-[#cfaa48] text-[10px] font-bold uppercase tracking-widest">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function DrawerButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center justify-center gap-1.5 py-2 px-2',
        'bg-[#1a1a1a] border border-[#444] text-[10px] font-bold uppercase tracking-wider',
        'transition-colors cursor-pointer',
        disabled
          ? 'opacity-40 cursor-not-allowed'
          : 'hover:border-[#8b0000] hover:text-[#cfaa48] text-[#888]'
      )}
    >
      <Icon className="w-3 h-3" />
      <span>{label}</span>
    </button>
  );
}

function StatCard({
  label,
  value,
  icon,
  valueClass,
  statusLabel,
}: {
  label: string;
  value: string;
  icon: string;
  valueClass?: string;
  /** Color-blind text label (e.g. LOW/OK/HIGH) shown when mode is active. */
  statusLabel?: string;
}) {
  return (
    <div className="bg-[#1a1a1a] border border-[#444] px-2 py-1.5 text-center">
      <div className="text-sm mb-0.5">{icon}</div>
      <div className={cn('text-xs font-bold font-mono', valueClass ?? 'text-white')}>
        {value}
        {statusLabel && <span className="cb-status-label">{statusLabel}</span>}
      </div>
      <div className="text-[#888] text-[8px] uppercase tracking-wider">{label}</div>
    </div>
  );
}

function RoadConditionCard({ condition }: { condition: number }) {
  const pct = Math.round(condition);
  const barColor = pct > 60 ? 'bg-green-500' : pct > 25 ? 'bg-yellow-500' : 'bg-[#ff4444]';
  const condLabel = pct > 60 ? 'GOOD' : pct > 25 ? 'FAIR' : 'POOR';
  return (
    <div className="bg-[#1a1a1a] border border-[#444] px-2 py-1.5 text-center">
      <div className="text-sm mb-0.5">🔧</div>
      <div className="text-xs font-bold font-mono text-white">
        {pct}%<span className="cb-status-label">{condLabel}</span>
      </div>
      <div className="w-full h-1 bg-[#333] mt-0.5">
        <div className={cn('h-full transition-all', barColor)} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-[#888] text-[8px] uppercase tracking-wider mt-0.5">Condition</div>
    </div>
  );
}

function AlertItem({
  severity,
  message,
}: {
  severity: 'critical' | 'warning' | 'info';
  message: string;
}) {
  const colorBlind = useColorBlindMode();
  const colors = {
    critical: 'border-[#ff4444] text-[#ff4444]',
    warning: 'border-[#ffaa00] text-[#ffaa00]',
    info: 'border-[#888] text-[#888]',
  };
  const cbClass = colorBlind ? `alert-cb-${severity}` : '';
  const prefixes: Record<string, string> = {
    critical: 'CRITICAL: ',
    warning: 'WARNING: ',
    info: 'INFO: ',
  };
  return (
    <div
      className={cn('bg-[#1a1a1a] border-l-2 px-2 py-1.5 text-[10px]', colors[severity], cbClass)}
    >
      {colorBlind && <span className="font-bold">{prefixes[severity]}</span>}
      {message}
    </div>
  );
}

function PersonnelRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#888] text-[10px]">{label}</span>
      <span className={cn('text-xs font-bold font-mono', color)}>{value}</span>
    </div>
  );
}

function VolumeSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[#888] text-[10px] uppercase tracking-wider">{label}</span>
        <span className="text-[#cfaa48] text-[10px] font-mono">{pct}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={pct}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="w-full h-1.5 bg-[#333] appearance-none cursor-pointer accent-[#8b0000]"
      />
    </div>
  );
}
