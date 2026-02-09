/**
 * PravdaTicker -- scrolling propaganda news ticker.
 *
 * Displays a single-line marquee at the bottom of the screen.
 * Uses the CSS `.pravda-ticker` / `.pravda-ticker-text` classes
 * which provide the translateX animation. When a new message
 * arrives the animation resets via a React key swap.
 */
interface PravdaTickerProps {
  message: string | null;
}

export function PravdaTicker({ message }: PravdaTickerProps) {
  if (!message) return null;

  return (
    <div className="pravda-ticker">
      {/* Use message as key so React remounts the span on change, restarting the CSS animation */}
      <span className="pravda-ticker-text" key={message}>
        &#9733; PRAVDA &#9733; {message}
      </span>
    </div>
  );
}
