/**
 * WorkerInfoPanel — Shows info about a tapped citizen and allows assignment.
 *
 * Appears when a worker is tapped on the grid. Shows stats (morale, loyalty,
 * skill) as percentage bars, vodka dependency indicator, class with color
 * badge, and "Assign" / "Dismiss" buttons.
 *
 * Style follows the Soviet propaganda aesthetic: red/cream, rough borders.
 */

import {
  setAssignmentMode,
  setInspectedWorker,
  useAssignmentMode,
  useInspectedWorker,
} from '@/stores/gameStore';

const CLASS_COLORS: Record<string, string> = {
  worker: '#8D6E63',
  party_official: '#C62828',
  engineer: '#1565C0',
  farmer: '#2E7D32',
  soldier: '#4E342E',
  prisoner: '#616161',
};

const CLASS_LABELS: Record<string, string> = {
  worker: 'Worker',
  party_official: 'Party Official',
  engineer: 'Engineer',
  farmer: 'Farmer',
  soldier: 'Soldier',
  prisoner: 'Prisoner',
};

function StatBar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = pct > 60 ? '#4ade80' : pct > 30 ? '#fbbf24' : '#f87171';
  return (
    <div className="mb-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-concrete">{label}</span>
        <span>{Math.round(value)}%</span>
      </div>
      <div className="h-1 w-full" style={{ background: '#333' }}>
        <div className="h-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export function WorkerInfoPanel() {
  const worker = useInspectedWorker();
  const assignment = useAssignmentMode();

  if (assignment) {
    return (
      <div
        className="absolute bottom-20 left-2 md:left-4 z-10 select-none"
        style={{
          background: 'rgba(0, 0, 0, 0.85)',
          border: '2px solid #8b0000',
          maxWidth: '240px',
        }}
      >
        <div className="px-3 py-1.5 text-center" style={{ borderBottom: '1px solid #444' }}>
          <span
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: '#ff4444' }}
          >
            Assignment Mode
          </span>
        </div>
        <div className="px-3 py-2 text-xs">
          <p className="text-concrete text-center leading-snug">
            Tap a building to assign{' '}
            <span className="font-bold" style={{ color: 'var(--soviet-gold)' }}>
              {assignment.workerName}
            </span>
          </p>
          <button
            type="button"
            className="mt-2 w-full border border-[#444] bg-[#1a1a1a] px-2 py-1 text-[10px] text-concrete hover:border-[#666] hover:text-white"
            onClick={() => setAssignmentMode(null)}
          >
            CANCEL
          </button>
        </div>
      </div>
    );
  }

  if (!worker) return null;

  const classColor = CLASS_COLORS[worker.class] ?? '#757575';
  const classLabel = CLASS_LABELS[worker.class] ?? worker.class;

  return (
    <div
      className="absolute bottom-20 left-2 md:left-4 z-10 select-none"
      style={{
        background: 'rgba(0, 0, 0, 0.85)',
        border: '2px solid var(--soviet-gold)',
        maxWidth: '240px',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{ borderBottom: '1px solid #444' }}
      >
        <span
          className="text-sm font-bold uppercase tracking-wider"
          style={{ color: 'var(--soviet-gold)' }}
        >
          {worker.name}
        </span>
        <button
          type="button"
          className="text-concrete hover:text-white text-lg leading-none px-1"
          onClick={() => setInspectedWorker(null)}
          aria-label="Dismiss worker info"
        >
          &times;
        </button>
      </div>

      {/* Body */}
      <div className="px-3 py-2 space-y-1">
        {/* Class badge */}
        <div className="flex items-center gap-1.5 mb-2">
          <div className="h-2.5 w-2.5" style={{ backgroundColor: classColor }} />
          <span className="text-xs font-bold" style={{ color: classColor }}>
            {classLabel}
          </span>
        </div>

        {/* Stat bars */}
        <StatBar label="Morale" value={worker.morale} />
        <StatBar label="Loyalty" value={worker.loyalty} />
        <StatBar label="Skill" value={worker.skill} />

        {/* Vodka dependency indicator */}
        {worker.vodkaDependency > 0 && (
          <div className="flex justify-between text-[10px] mt-1">
            <span className="text-concrete">Vodka Need</span>
            <span style={{ color: worker.vodkaDependency > 50 ? '#f87171' : '#fbbf24' }}>
              {Math.round(worker.vodkaDependency)}%
            </span>
          </div>
        )}

        {/* Assignment info */}
        {worker.assignedBuildingDefId && (
          <div className="flex justify-between text-[10px] mt-1">
            <span className="text-concrete">Assigned</span>
            <span style={{ color: 'var(--soviet-gold)' }}>{worker.assignedBuildingDefId}</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-1 mt-2 pt-1" style={{ borderTop: '1px solid #333' }}>
          <button
            type="button"
            className="flex-1 border border-[#8b0000] bg-[#8b0000]/30 px-2 py-1 text-[10px] font-bold uppercase text-[#ff4444] hover:bg-[#8b0000]/60"
            onClick={() => {
              setAssignmentMode({ workerName: worker.name, workerClass: worker.class });
            }}
          >
            Assign
          </button>
          <button
            type="button"
            className="flex-1 border border-[#444] bg-[#1a1a1a] px-2 py-1 text-[10px] text-concrete hover:border-[#666] hover:text-white"
            onClick={() => setInspectedWorker(null)}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
