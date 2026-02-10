import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Clock,
  Map as MapIcon,
  Menu,
  Pause,
  Play,
  Users,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────

interface Resource {
  icon: string;
  value: number;
  label: string;
}

interface SovietHUDProps {
  era?: string;
  date?: string;
  resources?: Resource[];
  isPaused?: boolean;
  gameSpeed?: 1 | 2 | 3;
  onPauseToggle?: () => void;
  onSpeedChange?: (speed: 1 | 2 | 3) => void;
  onMenuToggle?: () => void;
}

// ─── Top Bar HUD ─────────────────────────────────────────

const SovietHUD: React.FC<SovietHUDProps> = ({
  era = 'Era of Reconstruction',
  date = '15 March 1953',
  resources = [
    { icon: '👷', value: 1247, label: 'Workers' },
    { icon: '🌾', value: 8934, label: 'Food' },
    { icon: '🍾', value: 456, label: 'Vodka' },
    { icon: '⚡', value: 2341, label: 'Power' },
    { icon: '🤝', value: 89, label: 'Blat' },
  ],
  isPaused = false,
  gameSpeed = 1,
  onPauseToggle,
  onSpeedChange,
  onMenuToggle,
}) => {
  return (
    <div className="w-full bg-[#2a2a2a] border-b-2 border-[#8b0000] shadow-[0_4px_12px_rgba(0,0,0,0.6)]">
      <div className="flex items-center justify-between gap-1 px-2 py-1.5">
        {/* Era/Date */}
        <div className="min-w-0 flex-shrink-0">
          <div className="text-[#ff4444] text-[10px] font-bold uppercase tracking-wider truncate">
            {era}
          </div>
          <div className="text-[#888] text-[9px] font-mono truncate">{date}</div>
        </div>

        {/* Resources — scrollable on mobile */}
        <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0 mx-1 scrollbar-hide">
          {resources.map((resource) => (
            <div
              key={resource.label}
              className="flex items-center gap-0.5 bg-[#1a1a1a] border border-[#444] px-1.5 py-0.5 flex-shrink-0"
              title={resource.label}
            >
              <span className="text-xs">{resource.icon}</span>
              <span className="text-[#fff] text-[10px] font-bold font-mono">
                {resource.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        {/* Pause + Speed + Hamburger */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={onPauseToggle}
            className={cn(
              'flex items-center justify-center w-7 h-7 border transition-all',
              isPaused
                ? 'bg-[#8b0000] border-[#ff4444] hover:bg-[#a00000]'
                : 'bg-[#1a1a1a] border-[#444] hover:border-[#666]'
            )}
            aria-label={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? (
              <Play className="w-3 h-3 text-white" fill="currentColor" />
            ) : (
              <Pause className="w-3 h-3 text-[#ccc]" />
            )}
          </button>

          <div className="flex items-center gap-0.5 bg-[#1a1a1a] border border-[#444] p-0.5">
            {([1, 2, 3] as const).map((speed) => (
              <button
                type="button"
                key={speed}
                onClick={() => onSpeedChange?.(speed)}
                className={cn(
                  'px-1.5 py-0.5 text-[10px] font-bold font-mono transition-all',
                  gameSpeed === speed
                    ? 'bg-[#8b0000] text-white'
                    : 'bg-transparent text-[#888] hover:text-[#ccc]'
                )}
                aria-label={`Speed ${speed}x`}
              >
                {speed}x
              </button>
            ))}
          </div>

          {/* Hamburger */}
          <button
            type="button"
            onClick={onMenuToggle}
            className="flex items-center justify-center w-8 h-8 bg-[#1a1a1a] border border-[#8b0000] hover:bg-[#333] transition-colors flex-shrink-0"
            aria-label="Open menu"
          >
            <Menu className="w-4 h-4 text-[#ff4444]" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Bottom Info Strip ───────────────────────────────────

const BottomPanel: React.FC = () => {
  return (
    <div className="w-full bg-[#2a2a2a] border-t-2 border-[#8b0000] shadow-[0_-4px_12px_rgba(0,0,0,0.6)]">
      <div className="flex items-center divide-x divide-[#444] px-2 py-1.5">
        {/* Current Selection */}
        <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
          <span className="text-base">👷</span>
          <div className="flex flex-col min-w-0">
            <span className="text-white text-[11px] font-bold truncate">Worker Brigade #47</span>
            <span className="text-[#888] text-[9px] truncate">Idle &bull; Morale 67%</span>
          </div>
        </div>

        {/* Notification ticker */}
        <div className="flex items-center flex-1 min-w-0 pl-2">
          <span className="text-[#ccc] text-[11px] truncate">⚠️ Food shortage in Sector 7</span>
        </div>
      </div>
    </div>
  );
};

// ─── Slide-out Drawer ────────────────────────────────────

const DrawerPanel: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
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

          {/* Drawer — slides from right */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="fixed right-0 top-0 bottom-0 w-72 sm:w-80 bg-[#2a2a2a] border-l-2 border-[#8b0000] z-50 flex flex-col shadow-2xl"
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-4 py-3 border-b-2 border-[#8b0000] bg-[#1a1a1a]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-[#8b0000] flex items-center justify-center">
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="text-[#cfaa48] w-4 h-4"
                    role="img"
                    aria-label="Star"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
                <span className="text-[#cfaa48] text-sm font-bold uppercase tracking-wider">
                  Command Panel
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center bg-[#2a2a2a] border border-[#444] hover:border-[#8b0000] transition-colors"
                aria-label="Close menu"
              >
                <X className="w-4 h-4 text-[#888]" />
              </button>
            </div>

            {/* Drawer content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Minimap */}
              <DrawerSection icon={MapIcon} title="TACTICAL MAP">
                <div className="w-full aspect-square bg-[#1a1a1a] border-2 border-[#8b0000] relative">
                  <div className="absolute inset-1 bg-gradient-to-br from-[#4a3a2a] to-[#2a1a0a]" />
                  <div className="absolute inset-0 flex items-center justify-center text-[#ff4444] text-xs font-bold">
                    MINIMAP
                  </div>
                  {/* Viewport indicator */}
                  <div className="absolute top-1/3 left-1/4 w-1/3 h-1/4 border border-[#cfaa48] opacity-60" />
                </div>
              </DrawerSection>

              {/* Settlement Stats */}
              <DrawerSection icon={Building2} title="SETTLEMENT">
                <div className="grid grid-cols-2 gap-2">
                  <StatCard label="Buildings" value="23" icon="🏛️" />
                  <StatCard label="Population" value="1,247" icon="👥" />
                  <StatCard label="Happiness" value="54%" icon="😐" />
                  <StatCard label="Corruption" value="31%" icon="🐀" />
                </div>
              </DrawerSection>

              {/* Alerts */}
              <DrawerSection icon={AlertTriangle} title="ALERTS">
                <div className="space-y-2">
                  <AlertItem severity="critical" message="Food reserves below 30%" />
                  <AlertItem severity="warning" message="Power grid at 89% capacity" />
                  <AlertItem severity="info" message="Quota review in 2 months" />
                </div>
              </DrawerSection>

              {/* Production Queue */}
              <DrawerSection icon={Clock} title="PRODUCTION">
                <div className="space-y-2">
                  <QueueItem name="Apartment Block B" progress={72} />
                  <QueueItem name="Vodka Distillery" progress={35} />
                  <QueueItem name="Road Depot" progress={10} />
                </div>
              </DrawerSection>

              {/* Population Breakdown */}
              <DrawerSection icon={Users} title="WORKFORCE">
                <div className="space-y-1.5">
                  <WorkforceRow label="Employed" value={892} total={1247} />
                  <WorkforceRow label="Idle" value={234} total={1247} />
                  <WorkforceRow label="Gulag" value={121} total={1247} />
                </div>
              </DrawerSection>

              {/* Trends */}
              <DrawerSection icon={BarChart3} title="TRENDS">
                <div className="grid grid-cols-2 gap-2">
                  <TrendCard label="Food" trend={-12} />
                  <TrendCard label="Vodka" trend={+5} />
                  <TrendCard label="Power" trend={+18} />
                  <TrendCard label="Blat" trend={-3} />
                </div>
              </DrawerSection>
            </div>

            {/* Drawer footer */}
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
};

// ─── Drawer Sub-components ───────────────────────────────

const DrawerSection: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}> = ({ icon: Icon, title, children }) => (
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

const StatCard: React.FC<{
  label: string;
  value: string;
  icon: string;
}> = ({ label, value, icon }) => (
  <div className="bg-[#1a1a1a] border border-[#444] px-2 py-1.5 text-center">
    <div className="text-sm mb-0.5">{icon}</div>
    <div className="text-white text-xs font-bold font-mono">{value}</div>
    <div className="text-[#888] text-[8px] uppercase tracking-wider">{label}</div>
  </div>
);

const AlertItem: React.FC<{
  severity: 'critical' | 'warning' | 'info';
  message: string;
}> = ({ severity, message }) => {
  const colors = {
    critical: 'border-[#ff4444] text-[#ff4444]',
    warning: 'border-[#ffaa00] text-[#ffaa00]',
    info: 'border-[#888] text-[#888]',
  };
  return (
    <div className={cn('bg-[#1a1a1a] border-l-2 px-2 py-1.5 text-[10px]', colors[severity])}>
      {message}
    </div>
  );
};

const QueueItem: React.FC<{ name: string; progress: number }> = ({ name, progress }) => (
  <div className="bg-[#1a1a1a] border border-[#444] px-2 py-1.5">
    <div className="flex items-center justify-between mb-1">
      <span className="text-white text-[10px] font-bold truncate">{name}</span>
      <span className="text-[#888] text-[9px] font-mono">{progress}%</span>
    </div>
    <div className="w-full h-1 bg-[#333]">
      <div className="h-full bg-[#8b0000] transition-all" style={{ width: `${progress}%` }} />
    </div>
  </div>
);

const WorkforceRow: React.FC<{
  label: string;
  value: number;
  total: number;
}> = ({ label, value, total }) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[#888] text-[10px] w-14">{label}</span>
      <div className="flex-1 h-1.5 bg-[#333]">
        <div className="h-full bg-[#8b0000]" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-white text-[9px] font-mono w-8 text-right">{value}</span>
    </div>
  );
};

const TrendCard: React.FC<{ label: string; trend: number }> = ({ label, trend }) => (
  <div className="bg-[#1a1a1a] border border-[#444] px-2 py-1.5 text-center">
    <div className="text-[#888] text-[8px] uppercase tracking-wider mb-0.5">{label}</div>
    <div
      className={cn(
        'text-xs font-bold font-mono',
        trend > 0 ? 'text-green-500' : trend < 0 ? 'text-[#ff4444]' : 'text-[#888]'
      )}
    >
      {trend > 0 ? '+' : ''}
      {trend}%
    </div>
  </div>
);

// ─── Full Game Screen Demo ───────────────────────────────

export const SovietGameHUDDemo: React.FC = () => {
  const [isPaused, setIsPaused] = useState(false);
  const [gameSpeed, setGameSpeed] = useState<1 | 2 | 3>(1);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div
      className="flex flex-col bg-[#1a1a1a] overflow-hidden"
      style={{ fontFamily: "'VT323', monospace", height: '100dvh' }}
    >
      {/* Top HUD */}
      <SovietHUD
        era="Era of Reconstruction"
        date="15 March 1953"
        isPaused={isPaused}
        gameSpeed={gameSpeed}
        onPauseToggle={() => setIsPaused((p) => !p)}
        onSpeedChange={setGameSpeed}
        onMenuToggle={() => setDrawerOpen(true)}
      />

      {/* Game viewport — grid fills edge-to-edge, zoom locked */}
      <div className="flex-1 relative overflow-hidden min-h-0">
        {/* Lighter muddy ground */}
        <div
          className="absolute inset-0 bg-[#5a4a3a]"
          style={{
            backgroundImage: `
              radial-gradient(circle at 20% 30%, rgba(90, 70, 50, 0.4) 0%, transparent 50%),
              radial-gradient(circle at 80% 70%, rgba(80, 65, 45, 0.4) 0%, transparent 50%),
              radial-gradient(circle at 50% 50%, rgba(85, 68, 48, 0.3) 0%, transparent 60%)
            `,
          }}
        />

        {/* Fake isometric grid — more visible */}
        <svg className="absolute inset-0 w-full h-full opacity-20" aria-hidden="true">
          {Array.from({ length: 20 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static decorative grid lines
            <React.Fragment key={i}>
              <line
                x1={`${50 - i * 5}%`}
                y1="0%"
                x2={`${50 + 30 - i * 5}%`}
                y2="100%"
                stroke="#cfaa48"
                strokeWidth="0.5"
              />
              <line
                x1={`${50 + i * 5}%`}
                y1="0%"
                x2={`${50 - 30 + i * 5}%`}
                y2="100%"
                stroke="#cfaa48"
                strokeWidth="0.5"
              />
            </React.Fragment>
          ))}
        </svg>

        {/* Placeholder content — visible on mobile */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <div className="text-center">
            <div className="text-5xl mb-3">🏗️</div>
            <div className="text-[#cfaa48] text-base uppercase tracking-widest">
              Canvas 2D Viewport
            </div>
            <div className="text-[#888] text-xs mt-1">Tap ☰ to open Command Panel</div>
          </div>
          {/* Fake building scatter */}
          <div className="flex gap-6 opacity-60">
            <div className="text-3xl">🏭</div>
            <div className="text-3xl">🏢</div>
            <div className="text-3xl">⛪</div>
          </div>
        </div>

        {/* Lighter vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 40%, rgba(26,26,26,0.3) 70%, rgba(26,26,26,0.7) 95%)',
          }}
        />

        {/* Pause overlay */}
        <AnimatePresence>
          {isPaused && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none z-10"
            >
              <div className="text-[#ff4444] text-2xl font-bold uppercase tracking-[0.3em] border-2 border-[#ff4444] px-6 py-2 bg-black/60">
                PAUSED
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Panel */}
      <BottomPanel />

      {/* Slide-out Drawer */}
      <DrawerPanel isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
};
