/**
 * DrawerPanel — slide-out command panel from the right edge.
 *
 * Adapted from the approved prototype (src/prototypes/SovietGameHUD.tsx).
 * Wired to real game data via useGameSnapshot().
 */
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, BarChart3, Building2, Map, Users, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameSnapshot } from '@/stores/gameStore';

interface DrawerPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const TIER_RUSSIAN: Record<string, string> = {
  selo: 'село',
  posyolok: 'рабочий посёлок',
  pgt: 'пос. гор. типа',
  gorod: 'город',
};

const THREAT_LABELS: Record<string, { label: string; color: string }> = {
  safe: { label: 'SAFE', color: 'text-green-500' },
  watched: { label: 'WATCHED', color: 'text-yellow-500' },
  warned: { label: 'WARNED', color: 'text-[#ffaa00]' },
  investigated: { label: 'INVESTIGATED', color: 'text-orange-500' },
  reviewed: { label: 'FILE UNDER REVIEW', color: 'text-[#ff4444]' },
  arrested: { label: 'ARRESTED', color: 'text-red-600' },
};

/**
 * Render a slide-out command panel that displays current game state, alerts, and personnel info.
 *
 * @param isOpen - Whether the drawer is visible.
 * @param onClose - Callback invoked when the user requests the panel to close (backdrop or close button).
 * @returns A React element for the command drawer panel populated from the game snapshot.
 */
export function DrawerPanel({ isOpen, onClose }: DrawerPanelProps) {
  const snap = useGameSnapshot();
  const threatInfo = THREAT_LABELS[snap.threatLevel] ?? THREAT_LABELS.safe!;
  const tierRussian = TIER_RUSSIAN[snap.settlementTier] ?? 'село';

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
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b-2 border-[#8b0000] bg-[#1a1a1a]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-[#8b0000] flex items-center justify-center">
                  <span className="text-[#cfaa48] text-sm">☭</span>
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

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Minimap placeholder */}
              <DrawerSection icon={Map} title="TACTICAL MAP">
                <div className="w-full aspect-square bg-[#1a1a1a] border-2 border-[#8b0000] relative">
                  <div className="absolute inset-1 bg-gradient-to-br from-[#4a3a2a] to-[#2a1a0a]" />
                  <div className="absolute inset-0 flex items-center justify-center text-[#ff4444] text-xs font-bold">
                    MINIMAP
                  </div>
                </div>
              </DrawerSection>

              {/* Settlement Stats */}
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
                </div>
              </DrawerSection>

              {/* 5-Year Plan */}
              <DrawerSection icon={BarChart3} title="5-YEAR PLAN">
                <div className="bg-[#1a1a1a] border border-[#444] px-2 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[#cfaa48] text-[10px] font-bold uppercase">
                      {snap.quota.type}
                    </span>
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
                    <div
                      className="h-full bg-[#8b0000] transition-all"
                      style={{ width: `${quotaPct}%` }}
                    />
                  </div>
                </div>
              </DrawerSection>

              {/* Alerts */}
              <DrawerSection icon={AlertTriangle} title="ALERTS">
                <div className="space-y-2">
                  {snap.food < 50 && (
                    <AlertItem severity="critical" message="Food reserves critically low" />
                  )}
                  {snap.powerUsed > snap.power && (
                    <AlertItem severity="critical" message="Power demand exceeds supply" />
                  )}
                  {snap.food < 200 && snap.food >= 50 && (
                    <AlertItem severity="warning" message="Food reserves declining" />
                  )}
                  {snap.blackMarks > 0 && (
                    <AlertItem
                      severity={snap.blackMarks >= 5 ? 'critical' : 'warning'}
                      message={`${snap.blackMarks} black mark${snap.blackMarks !== 1 ? 's' : ''} in personnel file`}
                    />
                  )}
                  {quotaPct < 30 && yearsLeft <= 1 && (
                    <AlertItem
                      severity="warning"
                      message="Quota deadline approaching — behind schedule"
                    />
                  )}
                  {snap.food >= 200 && snap.powerUsed <= snap.power && snap.blackMarks === 0 && (
                    <AlertItem severity="info" message="No current alerts" />
                  )}
                </div>
              </DrawerSection>

              {/* Personnel File */}
              <DrawerSection icon={Users} title="PERSONNEL FILE">
                <div className="space-y-1.5">
                  <PersonnelRow
                    label="Black Marks"
                    value={snap.blackMarks}
                    color="text-[#ff4444]"
                  />
                  <PersonnelRow
                    label="Commendations"
                    value={snap.commendations}
                    color="text-[#cfaa48]"
                  />
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#444]">
                    <span className="text-[#888] text-[10px]">STATUS</span>
                    <span className={cn('text-xs font-bold', threatInfo.color)}>
                      {threatInfo.label}
                    </span>
                  </div>
                </div>
              </DrawerSection>

              {/* Leader */}
              {snap.leaderName && (
                <div className="bg-[#1a1a1a] border border-[#444] px-3 py-2">
                  <div className="text-[#888] text-[8px] uppercase tracking-wider mb-1">
                    General Secretary
                  </div>
                  <div className="text-[#ff6b6b] text-xs font-bold">{snap.leaderName}</div>
                  {snap.leaderPersonality && (
                    <div className="text-[#888] text-[9px] italic mt-0.5">
                      {snap.leaderPersonality}
                    </div>
                  )}
                </div>
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

/**
 * Renders a drawer section with a small iconized header and its content.
 *
 * @param icon - Icon component to display left of the title; receives an optional `className` prop for sizing/color.
 * @param title - Section title text displayed in a compact, uppercase header.
 * @param children - Content rendered below the header.
 * @returns The section element containing the header (icon + title) and the provided children.
 */

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

/**
 * Renders a compact statistic card with an icon, a prominent value, and a small label.
 *
 * @param label - Short uppercase label displayed below the value (e.g., "BUILDINGS")
 * @param value - Prominent value text shown in monospace (e.g., "12")
 * @param icon - Small icon or emoji displayed above the value
 * @param valueClass - Optional additional class names applied to the value for custom styling
 * @returns A JSX element representing the styled stat card
 */
function StatCard({
  label,
  value,
  icon,
  valueClass,
}: {
  label: string;
  value: string;
  icon: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-[#1a1a1a] border border-[#444] px-2 py-1.5 text-center">
      <div className="text-sm mb-0.5">{icon}</div>
      <div className={cn('text-xs font-bold font-mono', valueClass ?? 'text-white')}>{value}</div>
      <div className="text-[#888] text-[8px] uppercase tracking-wider">{label}</div>
    </div>
  );
}

/**
 * Render a single-line alert row styled according to severity.
 *
 * Renders a compact, left-bordered alert bar with color and border determined by `severity`.
 *
 * @param severity - The alert level; 'critical' = high-severity (red), 'warning' = medium (amber), 'info' = neutral (gray)
 * @param message - Text to display inside the alert row
 * @returns A JSX element representing the styled alert row
 */
function AlertItem({
  severity,
  message,
}: {
  severity: 'critical' | 'warning' | 'info';
  message: string;
}) {
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
}

/**
 * Renders a two-column row with a label on the left and a numeric value on the right.
 *
 * @param label - Text label displayed on the left side
 * @param value - Numeric value displayed on the right side
 * @param color - CSS class(es) applied to the value for color/styling
 * @returns A JSX element containing the labeled row with the value styled using `color`
 */
function PersonnelRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#888] text-[10px]">{label}</span>
      <span className={cn('text-xs font-bold font-mono', color)}>{value}</span>
    </div>
  );
}