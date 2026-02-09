/**
 * IntroModal -- KGB dossier that introduces the game.
 *
 * Renders a full-screen overlay with a paper-textured "dossier" card
 * containing the player's assignment briefing and a start button.
 */

interface IntroModalProps {
  onStart: () => void;
}

export function IntroModal({ onStart }: IntroModalProps) {
  return (
    <div className="intro-overlay">
      <div className="dossier">
        {/* Header */}
        <h1 className="text-center text-xl font-bold tracking-widest uppercase mb-2">
          Ministry of Planning
        </h1>
        <hr className="border-black mb-3" />

        {/* TOP SECRET stamp */}
        <div className="text-center mb-4">
          <span className="stamp">Top Secret</span>
        </div>

        {/* Memo fields */}
        <p className="mb-1">
          <strong>TO:</strong> Director of Sector 7G
        </p>
        <p className="mb-3">
          <strong>SUBJECT:</strong> IMMEDIATE ASSIGNMENT
        </p>

        <hr className="border-black/30 mb-3" />

        {/* Body */}
        <p className="mb-3 leading-relaxed">
          Comrade, you have been &ldquo;volunteered&rdquo; to manage this
          desolate patch of dirt. Your predecessors failed to meet the potato
          quota. They are no longer with us.
        </p>

        {/* Objectives */}
        <p className="mb-1 font-bold uppercase">Your objectives:</p>
        <ul className="list-disc pl-5 mb-4 space-y-1">
          <li>Build Housing</li>
          <li>Build Coal Plants</li>
          <li>Produce Potatoes</li>
          <li>Produce Vodka</li>
        </ul>

        <hr className="border-black/30 mb-4" />

        {/* Start button */}
        <button
          type="button"
          onClick={onStart}
          className="w-full bg-soviet-red text-white font-bold py-3 px-4 text-lg uppercase tracking-wider cursor-pointer border-2 border-black transition-transform active:translate-y-0.5 active:brightness-75 hover:brightness-110"
        >
          I Serve the Soviet Union
        </button>
      </div>
    </div>
  );
}
