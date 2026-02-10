/**
 * ConcreteFrame -- thin brutalist concrete border overlay around the viewport.
 *
 * Renders 4 positioned divs (left, right, top separator, bottom separator)
 * with a repeating CSS gradient that simulates a concrete texture.
 * The existing TopBar/SovietHUD masks the top and BottomStrip masks the bottom;
 * this frame adds narrow side borders and thin separator strips between
 * the HUD elements and the canvas.
 *
 * pointer-events: none so all clicks pass through to the canvas below.
 */

const CONCRETE_BG = 'repeating-conic-gradient(#6b6b6b 0% 25%, #7a7a7a 0% 50%) 0 0 / 4px 4px';

const INSET_SHADOW = 'inset 0 0 2px rgba(0,0,0,0.5)';

const SIDE_WIDTH = 8;
const SEPARATOR_HEIGHT = 4;

export function ConcreteFrame() {
  return (
    <div
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: 5 }}
      data-testid="concrete-frame"
    >
      {/* Left border */}
      <div
        className="absolute left-0 top-0 bottom-0"
        style={{
          width: SIDE_WIDTH,
          background: CONCRETE_BG,
          boxShadow: INSET_SHADOW,
        }}
        data-testid="concrete-frame-left"
      />

      {/* Right border */}
      <div
        className="absolute right-0 top-0 bottom-0"
        style={{
          width: SIDE_WIDTH,
          background: CONCRETE_BG,
          boxShadow: INSET_SHADOW,
        }}
        data-testid="concrete-frame-right"
      />

      {/* Top separator (between SovietHUD and canvas) */}
      <div
        className="absolute left-0 right-0"
        style={{
          top: 0,
          height: SEPARATOR_HEIGHT,
          background: CONCRETE_BG,
          boxShadow: INSET_SHADOW,
        }}
        data-testid="concrete-frame-top"
      />

      {/* Bottom separator (between canvas and BottomStrip) */}
      <div
        className="absolute left-0 right-0 bottom-0"
        style={{
          height: SEPARATOR_HEIGHT,
          background: CONCRETE_BG,
          boxShadow: INSET_SHADOW,
        }}
        data-testid="concrete-frame-bottom"
      />
    </div>
  );
}
