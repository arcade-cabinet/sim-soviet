/**
 * BottomStrip — compact bottom bar combining Pravda ticker + settlement info.
 *
 * Adapted from BottomPanel in the approved prototype (src/prototypes/SovietGameHUD.tsx).
 * Replaces the standalone PravdaTicker with an integrated strip.
 */
import { useGameSnapshot } from '@/stores/gameStore';

const TIER_TITLES: Record<string, string> = {
  selo: 'Collective Farm Chairman',
  posyolok: 'Settlement Director',
  pgt: 'Urban-Type Settlement Administrator',
  gorod: 'City Soviet Chairman',
};

interface BottomStripProps {
  pravdaMessage: string | null;
}

export function BottomStrip({ pravdaMessage }: BottomStripProps) {
  const snap = useGameSnapshot();
  const title = TIER_TITLES[snap.settlementTier] ?? 'Chairman';

  return (
    <div className="w-full bg-[#2a2a2a] border-t-2 border-[#8b0000] shadow-[0_-4px_12px_rgba(0,0,0,0.6)] select-none">
      <div className="flex items-center divide-x divide-[#444] px-2 py-1.5">
        {/* Current role / title */}
        <div className="flex items-center gap-2 flex-shrink-0 pr-2">
          <span className="text-base">☭</span>
          <div className="flex flex-col min-w-0">
            <span className="text-white text-[11px] font-bold truncate">{title}</span>
            <span className="text-[#888] text-[9px] truncate">
              {snap.buildingCount} building{snap.buildingCount !== 1 ? 's' : ''} &bull;{' '}
              {snap.pop.toLocaleString()} citizens
            </span>
          </div>
        </div>

        {/* Pravda ticker */}
        <div className="flex items-center flex-1 min-w-0 pl-2 overflow-hidden">
          {pravdaMessage ? (
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
