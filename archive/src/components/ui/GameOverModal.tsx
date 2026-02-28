/**
 * GameOverModal — Victory or defeat screen with game stats and medal ceremony.
 *
 * Mirrors the IntroModal "dossier" aesthetic.
 * Victory: congratulations + stats + medal ceremony + final score.
 * Defeat: KGB notification + shame stats + whatever medals were scraped together.
 *
 * When tally data is available (medals + score), the MedalCeremony component
 * renders an animated reveal below the stats summary.
 */
import { MedalCeremony } from '@app/components/MedalCeremony';
import type { Medal } from '@/game/ScoringSystem';
import { useGameSnapshot } from '@/stores/gameStore';

interface GameOverModalProps {
  victory: boolean;
  reason: string;
  onRestart: () => void;
  medals?: Medal[];
  finalScore?: number;
}

export function GameOverModal({
  victory,
  reason,
  onRestart,
  medals,
  finalScore,
}: GameOverModalProps) {
  const snap = useGameSnapshot();
  const hasCeremony = medals != null && finalScore != null;

  return (
    <div className="intro-overlay">
      <div className="dossier">
        {/* Header */}
        <h1 className="text-center text-xl font-bold tracking-widest uppercase mb-2">
          {victory ? 'Order of Lenin' : 'KGB Notice'}
        </h1>
        <hr className="border-black mb-3" />

        {/* Stamp */}
        <div className="text-center mb-4">
          <span className="stamp">{victory ? 'Approved' : 'Terminated'}</span>
        </div>

        {/* Result message */}
        <p className="mb-4 leading-relaxed text-center font-bold">{reason}</p>

        <hr className="border-black/30 mb-3" />

        {/* Stats summary */}
        <p className="mb-1 font-bold uppercase">Final Report:</p>
        <ul className="list-none pl-0 mb-4 space-y-1">
          <li>
            Year Reached: <strong>{snap.date.year}</strong>
          </li>
          <li>
            Population: <strong>{snap.pop}</strong>
          </li>
          <li>
            Buildings: <strong>{snap.buildingCount}</strong>
          </li>
          <li>
            Treasury: <strong>{Math.round(snap.money)}</strong>
          </li>
          <li>
            Food Stores: <strong>{Math.round(snap.food)}</strong>
          </li>
          <li>
            Vodka Reserves: <strong>{Math.round(snap.vodka)}</strong>
          </li>
        </ul>

        {/* Medal ceremony -- animated reveal when tally data available */}
        {hasCeremony && (
          <>
            <hr className="border-black/30 mb-4" />
            <MedalCeremony medals={medals} finalScore={finalScore} />
          </>
        )}

        <hr className="border-black/30 mb-4" />

        {/* Restart button */}
        <button
          type="button"
          onClick={onRestart}
          className="w-full bg-soviet-red text-white font-bold py-3 px-4 text-lg uppercase tracking-wider cursor-pointer border-2 border-black transition-transform active:translate-y-0.5 active:brightness-75 hover:brightness-110"
        >
          {victory ? 'Serve Again' : 'Try Again, Comrade'}
        </button>
      </div>
    </div>
  );
}
