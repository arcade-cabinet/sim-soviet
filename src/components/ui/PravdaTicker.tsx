/**
 * PravdaTicker -- scrolling propaganda news ticker.
 *
 * Displays a single-line marquee at the bottom of the screen.
 * Uses the CSS `.pravda-ticker` / `.pravda-ticker-text` classes
 * which provide the translateX animation. When a new message
 * arrives the animation resets via a React key swap.
 */
import { useState, useEffect } from 'react';

interface PravdaTickerProps {
  message: string | null;
}

export function PravdaTicker({ message }: PravdaTickerProps) {
  // Increment key each time message changes to force animation restart
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    setAnimKey((prev) => prev + 1);
  }, [message]);

  if (!message) return null;

  return (
    <div className="pravda-ticker">
      <span className="pravda-ticker-text" key={animKey}>
        &#9733; PRAVDA &#9733; {message}
      </span>
    </div>
  );
}
