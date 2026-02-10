/**
 * SovietToastStack — severity-based notification toasts.
 *
 * Reads from toastStore (module-level state). Three severity levels:
 *   - warning (yellow):    routine alerts, upgrades, commendations
 *   - critical (red):      starvation, building collapse, quota failure
 *   - evacuation (dark):   purges, arrests, catastrophic events
 *
 * Adapted from approved prototype (src/prototypes/SovietToastStack.tsx).
 */
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, AlertTriangle, Radio, X } from 'lucide-react';
import type { ToastSeverity } from '@/stores/toastStore';
import { dismissSovietToast, useSovietToasts } from '@/stores/toastStore';

// ── Severity config ──────────────────────────────────────────────────────

const severityConfig: Record<
  ToastSeverity,
  {
    bannerColor: string;
    bgColor: string;
    icon: typeof AlertTriangle;
    iconColor: string;
    label: string;
    borderColor: string;
  }
> = {
  warning: {
    bannerColor: 'bg-yellow-600',
    bgColor: 'bg-amber-50',
    icon: AlertTriangle,
    iconColor: 'text-yellow-800',
    label: '\u0412\u041D\u0418\u041C\u0410\u041D\u0418\u0415',
    borderColor: 'border-yellow-700',
  },
  critical: {
    bannerColor: 'bg-red-700',
    bgColor: 'bg-red-50',
    icon: AlertCircle,
    iconColor: 'text-red-900',
    label: '\u041E\u041F\u0410\u0421\u041D\u041E\u0421\u0422\u042C',
    borderColor: 'border-red-800',
  },
  evacuation: {
    bannerColor: 'bg-red-900',
    bgColor: 'bg-zinc-100',
    icon: Radio,
    iconColor: 'text-red-950',
    label: '\u042D\u0412\u0410\u041A\u0423\u0410\u0426\u0418\u042F',
    borderColor: 'border-red-950',
  },
};

// ── Toast item ───────────────────────────────────────────────────────────

function ToastItem({
  id,
  severity,
  message,
}: {
  id: string;
  severity: ToastSeverity;
  message: string;
}) {
  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 300, scale: 0.9 }}
      animate={{
        opacity: 1,
        x: 0,
        scale: 1,
        transition: { type: 'spring', stiffness: 400, damping: 30 },
      }}
      exit={{
        opacity: 0,
        x: 300,
        scale: 0.8,
        transition: { duration: 0.2 },
      }}
      className={`relative w-full sm:w-80 shadow-2xl overflow-hidden border-2 ${config.borderColor}`}
      style={{
        boxShadow: '0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
      }}
    >
      {/* Banner header */}
      <div
        className={`relative px-3 py-1.5 flex items-center justify-between ${config.bannerColor}`}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 relative flex-shrink-0">
            <svg viewBox="0 0 24 24" fill="currentColor" className="text-white">
              <title>Star</title>
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
          <span className="text-white font-black text-xs tracking-wider uppercase">
            {config.label}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className={`relative p-3 ${config.bgColor}`}>
        <div className="flex items-start gap-2">
          <Icon className={`w-5 h-5 flex-shrink-0 ${config.iconColor}`} />
          <p
            className={`flex-1 min-w-0 text-xs font-bold leading-snug ${
              severity === 'warning' ? 'text-yellow-900' : config.iconColor
            }`}
          >
            {message}
          </p>
          <button
            type="button"
            onClick={() => dismissSovietToast(id)}
            className={`flex-shrink-0 p-0.5 hover:bg-black/10 rounded transition-colors -mt-0.5 ${config.iconColor}`}
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <div className={`h-0.5 ${config.bannerColor}`} />
    </motion.div>
  );
}

// ── Toast stack ──────────────────────────────────────────────────────────

export function SovietToastStack() {
  const toasts = useSovietToasts();

  return (
    <div className="fixed z-50 top-14 right-3 sm:right-4 flex flex-col gap-2 pointer-events-none px-3 sm:px-0">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem id={toast.id} severity={toast.severity} message={toast.message} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
