import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, AlertTriangle, ArrowRight, Radio, X } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

// Types
type ToastSeverity = 'warning' | 'critical' | 'evacuation';

interface Toast {
  id: string;
  severity: ToastSeverity;
  message: string;
  showArrow?: boolean;
  arrowDirection?: 'up' | 'down' | 'left' | 'right';
}

interface ToastStackProps {
  maxToasts?: number;
  duration?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

// Severity config
const severityConfig: Record<
  ToastSeverity,
  {
    bannerColor: string;
    bgColor: string;
    icon: React.ComponentType<{ className?: string }>;
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
    label: 'ВНИМАНИЕ',
    borderColor: 'border-yellow-700',
  },
  critical: {
    bannerColor: 'bg-red-700',
    bgColor: 'bg-red-50',
    icon: AlertCircle,
    iconColor: 'text-red-900',
    label: 'ОПАСНОСТЬ',
    borderColor: 'border-red-800',
  },
  evacuation: {
    bannerColor: 'bg-red-900',
    bgColor: 'bg-zinc-100',
    icon: Radio,
    iconColor: 'text-red-950',
    label: 'ЭВАКУАЦИЯ',
    borderColor: 'border-red-950',
  },
};

// Arrow component
const DirectionalArrow = ({ direction }: { direction: 'up' | 'down' | 'left' | 'right' }) => {
  const rotations = {
    right: 'rotate-0',
    down: 'rotate-90',
    left: 'rotate-180',
    up: '-rotate-90',
  };

  return (
    <ArrowRight
      className={cn('w-4 h-4 text-white drop-shadow-md', rotations[direction])}
      strokeWidth={2.5}
    />
  );
};

// Individual toast
const ToastItem = ({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) => {
  const config = severityConfig[toast.severity];
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
      className={cn(
        'relative w-full sm:w-80 shadow-2xl overflow-hidden border-2',
        config.borderColor
      )}
      style={{
        boxShadow: '0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
      }}
    >
      {/* Paper texture */}
      <div
        className="absolute inset-0 opacity-[0.15] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Banner header */}
      <div
        className={cn('relative px-3 py-1.5 flex items-center justify-between', config.bannerColor)}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 relative flex-shrink-0">
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="text-white"
              role="img"
              aria-label="Star"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
          <span className="text-white font-black text-xs tracking-wider uppercase">
            {config.label}
          </span>
        </div>
        {toast.showArrow && toast.arrowDirection && (
          <DirectionalArrow direction={toast.arrowDirection} />
        )}
      </div>

      {/* Content */}
      <div className={cn('relative p-3', config.bgColor)}>
        <div className="flex items-start gap-2">
          <Icon className={cn('w-5 h-5 flex-shrink-0', config.iconColor)} />
          <p
            className={cn(
              'flex-1 min-w-0 text-xs font-bold leading-snug',
              config.iconColor === 'text-yellow-800' ? 'text-yellow-900' : config.iconColor
            )}
          >
            {toast.message}
          </p>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className={cn(
              'flex-shrink-0 p-0.5 hover:bg-black/10 rounded transition-colors -mt-0.5',
              config.iconColor
            )}
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" strokeWidth={2.5} />
          </button>
        </div>

        {/* USSR stamp */}
        <div className="absolute bottom-1.5 right-1.5 opacity-20">
          <div
            className={cn(
              'w-10 h-10 rounded-full border-2 flex items-center justify-center',
              config.borderColor
            )}
          >
            <span className={cn('text-[7px] font-black', config.iconColor)}>СССР</span>
          </div>
        </div>
      </div>

      <div className={cn('h-0.5', config.bannerColor)} />
    </motion.div>
  );
};

// Toast stack
export const SovietToastStack = ({
  maxToasts = 3,
  duration = 3000,
  position = 'top-right',
}: ToastStackProps) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Clean up all timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) clearTimeout(timer);
    };
  }, []);

  const addToast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast = { ...toast, id };

      setToasts((prev) => [newToast, ...prev].slice(0, maxToasts));

      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        timersRef.current.delete(id);
      }, duration);
      timersRef.current.set(id, timer);
    },
    [maxToasts, duration]
  );

  const dismissToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Expose for demo
  useEffect(() => {
    // biome-ignore lint/suspicious/noExplicitAny: attaching demo helper to window for prototype testing
    (window as unknown as Record<string, any>).addSovietToast = addToast;
    return () => {
      // biome-ignore lint/suspicious/noExplicitAny: cleanup demo helper from window
      delete (window as unknown as Record<string, any>).addSovietToast;
    };
  }, [addToast]);

  const positionClasses = {
    'top-right': 'top-3 right-3 sm:top-4 sm:right-4',
    'top-left': 'top-3 left-3 sm:top-4 sm:left-4',
    'bottom-right': 'bottom-3 right-3 sm:bottom-4 sm:right-4',
    'bottom-left': 'bottom-3 left-3 sm:bottom-4 sm:left-4',
  };

  return (
    <div
      className={cn(
        'fixed z-50 flex flex-col gap-2 pointer-events-none px-3 sm:px-0',
        positionClasses[position]
      )}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onDismiss={dismissToast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
};

// Demo page with trigger buttons
export const SovietToastDemo: React.FC = () => {
  const addToast = (
    severity: ToastSeverity,
    message: string,
    showArrow?: boolean,
    arrowDirection?: 'up' | 'down' | 'left' | 'right'
  ) => {
    // biome-ignore lint/suspicious/noExplicitAny: accessing demo helper on window for prototype testing
    const win = window as unknown as Record<string, any>;
    if (win.addSovietToast) {
      win.addSovietToast({
        severity,
        message,
        showArrow,
        arrowDirection,
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1818] flex items-center justify-center p-4 sm:p-8">
      <SovietToastStack maxToasts={3} duration={3000} position="top-right" />

      <div className="max-w-lg w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="w-14 h-14 bg-red-700 rounded-full flex items-center justify-center shadow-xl">
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="text-yellow-400 w-8 h-8"
                role="img"
                aria-label="Star"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
          </div>
          <h1
            className="text-2xl sm:text-3xl font-black text-[#cfaa48] tracking-tight uppercase"
            style={{ fontFamily: "'VT323', monospace" }}
          >
            NOTIFICATION SYSTEM
          </h1>
          <p className="text-xs text-[#888] uppercase tracking-wider">
            Tap buttons to trigger notifications
          </p>
        </div>

        <div
          className="bg-[#2d2a2a] border-2 border-[#8a1c1c] p-4 sm:p-6 space-y-3"
          style={{ fontFamily: "'VT323', monospace" }}
        >
          <div className="bg-[#1a1818] text-[#cfaa48] text-center py-2 font-black tracking-widest text-sm">
            TRIGGER EVENTS
          </div>

          <button
            type="button"
            onClick={() =>
              addToast(
                'warning',
                'Orgnabor: 5 workers requested for industrial project in Sverdlovsk',
                true,
                'right'
              )
            }
            className="w-full bg-yellow-900/30 hover:bg-yellow-900/50 text-yellow-200 font-bold text-sm py-3 px-4 border-l-4 border-yellow-700 transition-colors text-left min-h-[44px]"
          >
            ВНИМАНИЕ — Orgnabor Request
          </button>

          <button
            type="button"
            onClick={() =>
              addToast(
                'critical',
                'KGB Agent has arrived at your collective — investigation in progress',
                true,
                'down'
              )
            }
            className="w-full bg-red-900/30 hover:bg-red-900/50 text-red-200 font-bold text-sm py-3 px-4 border-l-4 border-red-700 transition-colors text-left min-h-[44px]"
          >
            ОПАСНОСТЬ — KGB Arrival
          </button>

          <button
            type="button"
            onClick={() =>
              addToast(
                'evacuation',
                'DECREE: Conscription order — 15% of workers to be drafted immediately',
                true,
                'up'
              )
            }
            className="w-full bg-red-950/40 hover:bg-red-950/60 text-red-100 font-black text-sm py-3 px-4 border-l-4 border-red-950 transition-colors text-left min-h-[44px]"
          >
            ЭВАКУАЦИЯ — Conscription Order
          </button>

          <div className="pt-3 border-t-2 border-[#444]">
            <button
              type="button"
              onClick={() => {
                addToast('warning', 'Politruk scheduled ideology session — Building #3');
                setTimeout(
                  () =>
                    addToast('critical', 'Worker Ivan Petrov flagged for disloyalty', true, 'left'),
                  500
                );
                setTimeout(
                  () =>
                    addToast(
                      'evacuation',
                      'PURGE WAVE: 3 workers disappeared overnight',
                      true,
                      'right'
                    ),
                  1000
                );
              }}
              className="w-full bg-[#8a1c1c] hover:bg-[#a02020] text-white font-black text-sm py-3 px-4 border-2 border-[#cc3333] transition-colors uppercase tracking-wider min-h-[44px]"
            >
              TEST EMERGENCY CASCADE
            </button>
          </div>
        </div>

        <div className="text-center text-xs text-[#666] space-y-1">
          <p>Auto-dismisses after 3 seconds</p>
          <p>Maximum 3 notifications visible</p>
          <p>Directional arrows point toward event location on map</p>
        </div>
      </div>
    </div>
  );
};
