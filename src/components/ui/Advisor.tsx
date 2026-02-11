/**
 * Advisor -- "Comrade Krupnik" in-game advisor panel.
 *
 * Renders a small card (bottom-right on desktop, bottom sheet on mobile)
 * with a pixel-art face drawn on a canvas, the advisor's name, a message,
 * and a dismiss button. Auto-dismisses after 8 seconds.
 */
import { useEffect, useRef } from 'react';

interface AdvisorProps {
  message: string | null;
  onDismiss: () => void;
}

/**
 * Draw a 60x60 pixel-art face for Comrade Krupnik:
 * skin-colored rectangle, black ushanka hat with a red star,
 * dot eyes, and a line mouth.
 */
function drawAdvisorFace(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = 60;
  const h = 60;
  ctx.clearRect(0, 0, w, h);

  // Background (transparent)
  ctx.imageSmoothingEnabled = false;

  // Skin
  ctx.fillStyle = '#d4a574';
  ctx.fillRect(14, 24, 32, 30);

  // Hat body (ushanka)
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(8, 10, 44, 18);

  // Hat brim / fur
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(6, 22, 48, 6);

  // Red star on hat
  ctx.fillStyle = '#8a1c1c';
  ctx.fillRect(26, 13, 8, 8);

  // Eyes
  ctx.fillStyle = '#000000';
  ctx.fillRect(22, 34, 4, 4);
  ctx.fillRect(34, 34, 4, 4);

  // Mouth
  ctx.fillStyle = '#000000';
  ctx.fillRect(24, 44, 12, 2);
}

export function Advisor({ message, onDismiss }: AdvisorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw face when component mounts
  useEffect(() => {
    if (canvasRef.current) {
      drawAdvisorFace(canvasRef.current);
    }
  }, []);

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    if (!message) return;

    const timer = setTimeout(() => {
      onDismiss();
    }, 8000);

    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div className="advisor-panel">
      <div className="flex items-start gap-2.5">
        {/* Pixel-art face */}
        <canvas
          ref={canvasRef}
          width={60}
          height={60}
          className="shrink-0"
          style={{ imageRendering: 'pixelated' }}
        />

        <div className="min-w-0 flex-1">
          {/* Name label */}
          <p
            className="text-sm font-bold uppercase tracking-wider mb-1"
            style={{ color: 'var(--soviet-gold)' }}
          >
            Comrade Krupnik:
          </p>

          {/* Message */}
          <p className="text-white text-sm leading-snug">{message}</p>
        </div>
      </div>

      {/* Dismiss button */}
      <button
        type="button"
        onClick={onDismiss}
        className="mt-2 w-full bg-black/40 text-white/70 text-xs uppercase tracking-wider py-1.5 border border-white/20 cursor-pointer hover:bg-black/60 transition-colors"
      >
        Dismiss
      </button>
    </div>
  );
}
