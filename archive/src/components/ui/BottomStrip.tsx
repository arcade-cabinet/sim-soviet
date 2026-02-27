/**
 * BottomStrip — context-sensitive bottom info bar.
 *
 * Three display modes:
 *   1. Default — worker summary (idle/assigned counts) + Pravda/alert ticker
 *   2. Building selected — building name, power status, worker assignment
 *   3. Worker selected — name, class, morale, assignment
 *
 * Left side: context info. Right side: alerts / Pravda ticker.
 */
import {
  type InspectedBuilding,
  type InspectedWorker,
  useGameSnapshot,
  useInspected,
  useInspectedWorker,
} from '@/stores/gameStore';
import { useSovietToasts } from '@/stores/toastStore';

const TIER_TITLES: Record<string, string> = {
  selo: 'Collective Farm Chairman',
  posyolok: 'Settlement Director',
  pgt: 'Urban-Type Settlement Administrator',
  gorod: 'City Soviet Chairman',
};

const CLASS_LABELS: Record<InspectedWorker['class'], string> = {
  worker: 'Worker',
  party_official: 'Party Official',
  engineer: 'Engineer',
  farmer: 'Farmer',
  soldier: 'Soldier',
  prisoner: 'Prisoner',
};

interface BottomStripProps {
  pravdaMessage: string | null;
}

export function BottomStrip({ pravdaMessage }: BottomStripProps) {
  const snap = useGameSnapshot();
  const toasts = useSovietToasts();
  const inspectedBuilding = useInspected();
  const inspectedWorker = useInspectedWorker();
  const latestAlert = toasts[0];

  return (
    <div className="w-full bg-[#2a2a2a] border-t-2 border-[#8b0000] shadow-[0_-4px_12px_rgba(0,0,0,0.6)] select-none">
      <div className="flex items-center divide-x divide-[#444] px-2 py-1.5">
        {/* Left: context-sensitive info */}
        <div className="flex items-center gap-2 flex-shrink-0 pr-2 max-w-[55%]">
          {inspectedBuilding ? (
            <BuildingContext building={inspectedBuilding} />
          ) : inspectedWorker ? (
            <WorkerContext worker={inspectedWorker} />
          ) : (
            <DefaultContext
              title={TIER_TITLES[snap.settlementTier] ?? 'Chairman'}
              assignedWorkers={snap.assignedWorkers}
              idleWorkers={snap.idleWorkers}
              buildingCount={snap.buildingCount}
            />
          )}
        </div>

        {/* Right: alert / Pravda ticker */}
        <div className="flex items-center flex-1 min-w-0 pl-2 overflow-hidden">
          {latestAlert ? (
            <span className="text-[#ccc] text-[11px] truncate">
              {latestAlert.severity === 'evacuation'
                ? '🚨'
                : latestAlert.severity === 'critical'
                  ? '🔴'
                  : '⚠️'}{' '}
              {latestAlert.message}
            </span>
          ) : pravdaMessage ? (
            <span className="text-[#ccc] text-[11px] truncate" key={pravdaMessage}>
              &#9733; PRAVDA: {pravdaMessage}
            </span>
          ) : (
            <span className="text-[#666] text-[11px] italic">No news is good news, Comrade.</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Default: worker summary ──────────────────────────────────

function DefaultContext({
  title,
  assignedWorkers,
  idleWorkers,
  buildingCount,
}: {
  title: string;
  assignedWorkers: number;
  idleWorkers: number;
  buildingCount: number;
}) {
  return (
    <>
      <span className="text-base">☭</span>
      <div className="flex flex-col min-w-0">
        <span className="text-white text-[11px] font-bold truncate">{title}</span>
        <span className="text-[#888] text-[9px] truncate">
          {buildingCount} building{buildingCount !== 1 ? 's' : ''} &bull; {assignedWorkers} assigned
          &bull; {idleWorkers} idle
        </span>
      </div>
    </>
  );
}

// ── Building selected ────────────────────────────────────────

function BuildingContext({ building }: { building: InspectedBuilding }) {
  return (
    <>
      <span className="text-base">🏭</span>
      <div className="flex flex-col min-w-0">
        <span className="text-white text-[11px] font-bold truncate">{building.name}</span>
        <span className="text-[#888] text-[9px] truncate">
          {building.powered ? '⚡ Powered' : '🔌 No power'} &bull; {building.footprintW}x
          {building.footprintH} &bull; ({building.gridX},{building.gridY})
        </span>
      </div>
    </>
  );
}

// ── Worker selected ──────────────────────────────────────────

function WorkerContext({ worker }: { worker: InspectedWorker }) {
  const classLabel = CLASS_LABELS[worker.class] ?? worker.class;
  return (
    <>
      <span className="text-base">👷</span>
      <div className="flex flex-col min-w-0">
        <span className="text-white text-[11px] font-bold truncate">
          {worker.name}{' '}
          <span className="text-[#cfaa48] text-[9px] font-normal">({classLabel})</span>
        </span>
        <span className="text-[#888] text-[9px] truncate">
          Morale {worker.morale}% &bull; Loyalty {worker.loyalty}% &bull;{' '}
          {worker.assignedBuildingDefId ?? 'Idle'}
        </span>
      </div>
    </>
  );
}
