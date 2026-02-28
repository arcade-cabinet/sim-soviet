/**
 * NotificationLog — slide-down panel showing the last 50 notifications.
 *
 * Color-coded by severity:
 *   - Red: critical/evacuation
 *   - Yellow: warning
 *
 * Each entry shows message + game tick timestamp.
 */
import { X } from 'lucide-react';
import type { NotificationEntry } from '@/stores/gameStore';
import { useNotifications } from '@/stores/gameStore';

interface NotificationLogProps {
  isOpen: boolean;
  onClose: () => void;
}

function tickToDate(tick: number): string {
  const year = 1922 + Math.floor(tick / 360);
  const month = Math.floor((tick % 360) / 30) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

function severityColor(severity: NotificationEntry['severity']): string {
  switch (severity) {
    case 'critical':
    case 'evacuation':
      return 'border-l-red-600 text-red-300';
    case 'warning':
    default:
      return 'border-l-yellow-600 text-yellow-200';
  }
}

export function NotificationLog({ isOpen, onClose }: NotificationLogProps) {
  const notifications = useNotifications();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 max-h-[60vh] bg-[#1a1a1a]/95 border-b-2 border-[#8b0000] backdrop-blur-sm overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 flex items-center justify-between px-3 py-2 bg-[#2a2a2a] border-b border-[#444]">
        <span className="text-[#ff4444] text-xs font-bold uppercase tracking-wider">
          Dispatch Log ({notifications.length})
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-[#888] hover:text-white transition-colors"
          aria-label="Close notification log"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Entries */}
      {notifications.length === 0 ? (
        <div className="p-4 text-center text-[#666] text-xs">
          No dispatches recorded. The silence is suspicious.
        </div>
      ) : (
        <div className="divide-y divide-[#333]">
          {notifications.map((entry) => (
            <div key={entry.id} className={`px-3 py-2 border-l-4 ${severityColor(entry.severity)}`}>
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] leading-tight">{entry.message}</span>
                <span className="text-[9px] text-[#666] font-mono whitespace-nowrap flex-shrink-0">
                  {tickToDate(entry.timestamp)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
