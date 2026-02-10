import { describe, expect, it } from 'vitest';
import { Camera2D } from '@/rendering/Camera2D';

// ── Default state ──────────────────────────────────────────────────────────────

describe('Camera2D default state', () => {
  it('starts at origin (0, 0)', () => {
    const cam = new Camera2D();
    expect(cam.x).toBe(0);
    expect(cam.y).toBe(0);
  });

  it('starts at zoom level 1.0', () => {
    const cam = new Camera2D();
    expect(cam.zoom).toBe(1);
  });

  it('has sensible min/max zoom defaults', () => {
    const cam = new Camera2D();
    expect(cam.minZoom).toBe(0.3);
    expect(cam.maxZoom).toBe(3);
    expect(cam.minZoom).toBeLessThan(cam.maxZoom);
    expect(cam.minZoom).toBeGreaterThan(0);
  });

  it('starts with zero viewport dimensions', () => {
    const cam = new Camera2D();
    expect(cam.viewportWidth).toBe(0);
    expect(cam.viewportHeight).toBe(0);
  });
});

// ── resize ─────────────────────────────────────────────────────────────────────

describe('Camera2D.resize', () => {
  it('updates viewport dimensions', () => {
    const cam = new Camera2D();
    cam.resize(800, 600);
    expect(cam.viewportWidth).toBe(800);
    expect(cam.viewportHeight).toBe(600);
  });

  it('handles mobile viewport sizes', () => {
    const cam = new Camera2D();
    cam.resize(375, 667); // iPhone SE
    expect(cam.viewportWidth).toBe(375);
    expect(cam.viewportHeight).toBe(667);
  });

  it('can be called multiple times (e.g., on window resize)', () => {
    const cam = new Camera2D();
    cam.resize(800, 600);
    cam.resize(1024, 768);
    expect(cam.viewportWidth).toBe(1024);
    expect(cam.viewportHeight).toBe(768);
  });

  it('does not affect camera position or zoom', () => {
    const cam = new Camera2D();
    cam.x = 100;
    cam.y = 200;
    cam.zoom = 1.5;
    cam.resize(1920, 1080);
    expect(cam.x).toBe(100);
    expect(cam.y).toBe(200);
    expect(cam.zoom).toBe(1.5);
  });
});

// ── worldToScreen ──────────────────────────────────────────────────────────────

describe('Camera2D.worldToScreen', () => {
  it('maps camera center to viewport center at zoom 1', () => {
    const cam = new Camera2D();
    cam.resize(800, 600);
    cam.centerOn(50, 50);
    const s = cam.worldToScreen(50, 50);
    expect(s.x).toBe(400);
    expect(s.y).toBe(300);
  });

  it('maps world origin to viewport center when camera is at origin', () => {
    const cam = new Camera2D();
    cam.resize(800, 600);
    const s = cam.worldToScreen(0, 0);
    expect(s.x).toBe(400);
    expect(s.y).toBe(300);
  });

  it('offset world point appears to the right and down', () => {
    const cam = new Camera2D();
    cam.resize(800, 600);
    const s = cam.worldToScreen(10, 20);
    // (10 - 0) * 1 + 400 = 410
    // (20 - 0) * 1 + 300 = 320
    expect(s.x).toBe(410);
    expect(s.y).toBe(320);
  });

  it('respects zoom level', () => {
    const cam = new Camera2D();
    cam.resize(800, 600);
    cam.zoom = 2;
    const s = cam.worldToScreen(10, 0);
    // (10 - 0) * 2 + 400 = 420
    expect(s.x).toBe(420);
    expect(s.y).toBe(300);
  });

  it('camera offset shifts screen position', () => {
    const cam = new Camera2D();
    cam.resize(800, 600);
    cam.x = 100;
    cam.y = 50;
    const s = cam.worldToScreen(100, 50);
    // Camera looking at (100, 50), world point is (100, 50) → center
    expect(s.x).toBe(400);
    expect(s.y).toBe(300);
  });

  it('handles negative world coordinates', () => {
    const cam = new Camera2D();
    cam.resize(800, 600);
    const s = cam.worldToScreen(-100, -100);
    expect(s.x).toBe(-100 + 400);
    expect(s.y).toBe(-100 + 300);
  });
});

// ── screenToWorld ──────────────────────────────────────────────────────────────

describe('Camera2D.screenToWorld', () => {
  it('maps viewport center to camera center', () => {
    const cam = new Camera2D();
    cam.resize(800, 600);
    cam.centerOn(50, 50);
    const w = cam.screenToWorld(400, 300);
    expect(w.x).toBe(50);
    expect(w.y).toBe(50);
  });

  it('maps viewport origin (0,0) to top-left world corner at zoom 1', () => {
    const cam = new Camera2D();
    cam.resize(800, 600);
    const w = cam.screenToWorld(0, 0);
    // (0 - 400) / 1 + 0 = -400
    // (0 - 300) / 1 + 0 = -300
    expect(w.x).toBe(-400);
    expect(w.y).toBe(-300);
  });

  it('respects zoom level — zoomed in sees less world space', () => {
    const cam = new Camera2D();
    cam.resize(800, 600);
    cam.zoom = 2;
    const w = cam.screenToWorld(0, 0);
    // (0 - 400) / 2 + 0 = -200
    expect(w.x).toBe(-200);
    expect(w.y).toBe(-150);
  });

  it('handles camera offset', () => {
    const cam = new Camera2D();
    cam.resize(800, 600);
    cam.x = 200;
    cam.y = 100;
    const w = cam.screenToWorld(400, 300);
    // viewport center → camera center
    expect(w.x).toBe(200);
    expect(w.y).toBe(100);
  });
});

// ── worldToScreen / screenToWorld round-trip ────────────────────────────────────

describe('worldToScreen ↔ screenToWorld round-trip', () => {
  it('round-trips world coordinates through screen and back', () => {
    const cam = new Camera2D();
    cam.resize(1024, 768);
    cam.x = 150;
    cam.y = -75;
    cam.zoom = 1.5;

    const worldPoints = [
      { x: 0, y: 0 },
      { x: 100, y: 200 },
      { x: -50, y: 80 },
      { x: 999, y: -999 },
    ];

    for (const wp of worldPoints) {
      const s = cam.worldToScreen(wp.x, wp.y);
      const w = cam.screenToWorld(s.x, s.y);
      expect(w.x).toBeCloseTo(wp.x, 10);
      expect(w.y).toBeCloseTo(wp.y, 10);
    }
  });

  it('round-trips screen coordinates through world and back', () => {
    const cam = new Camera2D();
    cam.resize(800, 600);
    cam.x = 50;
    cam.y = 50;
    cam.zoom = 2;

    const screenPoints = [
      { x: 0, y: 0 },
      { x: 400, y: 300 },
      { x: 799, y: 599 },
    ];

    for (const sp of screenPoints) {
      const w = cam.screenToWorld(sp.x, sp.y);
      const s = cam.worldToScreen(w.x, w.y);
      expect(s.x).toBeCloseTo(sp.x, 10);
      expect(s.y).toBeCloseTo(sp.y, 10);
    }
  });

  it('round-trips at minimum zoom', () => {
    const cam = new Camera2D();
    cam.resize(800, 600);
    cam.zoom = cam.minZoom;

    const w0 = { x: 42, y: -17 };
    const s = cam.worldToScreen(w0.x, w0.y);
    const w1 = cam.screenToWorld(s.x, s.y);
    expect(w1.x).toBeCloseTo(w0.x, 10);
    expect(w1.y).toBeCloseTo(w0.y, 10);
  });

  it('round-trips at maximum zoom', () => {
    const cam = new Camera2D();
    cam.resize(800, 600);
    cam.zoom = cam.maxZoom;

    const w0 = { x: -200, y: 300 };
    const s = cam.worldToScreen(w0.x, w0.y);
    const w1 = cam.screenToWorld(s.x, s.y);
    expect(w1.x).toBeCloseTo(w0.x, 10);
    expect(w1.y).toBeCloseTo(w0.y, 10);
  });
});

// ── pan ────────────────────────────────────────────────────────────────────────

describe('Camera2D.pan', () => {
  it('panning right in screen moves camera left in world (screen follows touch)', () => {
    const cam = new Camera2D();
    cam.resize(800, 600);
    cam.pan(100, 0);
    // Dragging screen right → camera.x decreases
    expect(cam.x).toBe(-100);
    expect(cam.y).toBe(0);
  });

  it('panning down in screen moves camera up in world', () => {
    const cam = new Camera2D();
    cam.resize(800, 600);
    cam.pan(0, 50);
    expect(cam.x).toBe(0);
    expect(cam.y).toBe(-50);
  });

  it('panning is scaled by zoom level', () => {
    const cam = new Camera2D();
    cam.resize(800, 600);
    cam.zoom = 2;
    cam.pan(100, 0);
    // At zoom 2, 100 screen px = 50 world units
    expect(cam.x).toBe(-50);
  });

  it('panning at low zoom covers more world distance', () => {
    const cam = new Camera2D();
    cam.resize(800, 600);
    cam.zoom = 0.5;
    cam.pan(100, 0);
    // At zoom 0.5, 100 screen px = 200 world units
    expect(cam.x).toBe(-200);
  });

  it('panning accumulates', () => {
    const cam = new Camera2D();
    cam.resize(800, 600);
    cam.pan(10, 20);
    cam.pan(10, 20);
    cam.pan(10, 20);
    expect(cam.x).toBe(-30);
    expect(cam.y).toBe(-60);
  });

  it('panning with negative delta moves camera in opposite direction', () => {
    const cam = new Camera2D();
    cam.pan(-50, -30);
    expect(cam.x).toBe(50);
    expect(cam.y).toBe(30);
  });

  it('panning with zero delta does not move camera', () => {
    const cam = new Camera2D();
    cam.x = 42;
    cam.y = 17;
    cam.pan(0, 0);
    expect(cam.x).toBe(42);
    expect(cam.y).toBe(17);
  });
});

// ── zoomAt ─────────────────────────────────────────────────────────────────────

describe('Camera2D.zoomAt', () => {
  it('zooming in increases zoom level', () => {
    const cam = new Camera2D();
    cam.resize(800, 600);
    cam.zoomAt(400, 300, 1.5);
    expect(cam.zoom).toBe(1.5);
  });

  it('zooming out decreases zoom level', () => {
    const cam = new Camera2D();
    cam.resize(800, 600);
    cam.zoomAt(400, 300, 0.5);
    expect(cam.zoom).toBe(0.5);
  });

  it('clamps zoom at maxZoom', () => {
    const cam = new Camera2D();
    cam.resize(800, 600);
    cam.zoomAt(400, 300, 100);
    expect(cam.zoom).toBe(cam.maxZoom);
  });

  it('clamps zoom at minZoom', () => {
    const cam = new Camera2D();
    cam.resize(800, 600);
    cam.zoomAt(400, 300, 0.01);
    expect(cam.zoom).toBe(cam.minZoom);
  });

  it('zooming at viewport center does not pan the camera', () => {
    const cam = new Camera2D();
    cam.resize(800, 600);
    cam.centerOn(50, 50);
    cam.zoomAt(400, 300, 2);
    // World point under viewport center is (50, 50) — should stay there
    expect(cam.x).toBeCloseTo(50, 10);
    expect(cam.y).toBeCloseTo(50, 10);
  });

  it('zooming at a corner shifts camera toward that corner', () => {
    const cam = new Camera2D();
    cam.resize(800, 600);
    cam.centerOn(0, 0);
    const factor = 2;
    // Zoom at top-left corner (0, 0) of screen
    cam.zoomAt(0, 0, factor);
    // World point at screen (0,0) before zoom: (-400, -300)
    // After zoom, that point should still be at screen (0,0)
    const s = cam.worldToScreen(-400, -300);
    expect(s.x).toBeCloseTo(0, 5);
    expect(s.y).toBeCloseTo(0, 5);
  });

  it('world point under cursor stays under cursor after zoom', () => {
    const cam = new Camera2D();
    cam.resize(800, 600);
    cam.centerOn(100, 100);
    cam.zoom = 1.5;

    const screenPt = { x: 250, y: 150 };
    const worldBefore = cam.screenToWorld(screenPt.x, screenPt.y);

    cam.zoomAt(screenPt.x, screenPt.y, 1.3);

    const worldAfter = cam.screenToWorld(screenPt.x, screenPt.y);
    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 5);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 5);
  });

  it('sequential zooms are multiplicative', () => {
    const cam = new Camera2D();
    cam.resize(800, 600);
    cam.zoomAt(400, 300, 1.5);
    cam.zoomAt(400, 300, 2);
    expect(cam.zoom).toBe(3);
  });

  it('sequential zooms do not exceed maxZoom', () => {
    const cam = new Camera2D();
    cam.resize(800, 600);
    cam.zoomAt(400, 300, 2);
    cam.zoomAt(400, 300, 2);
    cam.zoomAt(400, 300, 2);
    expect(cam.zoom).toBe(cam.maxZoom);
  });

  it('zoom factor of 1 does not change anything', () => {
    const cam = new Camera2D();
    cam.resize(800, 600);
    cam.centerOn(42, 17);
    cam.zoom = 1.5;
    cam.zoomAt(200, 150, 1);
    expect(cam.zoom).toBe(1.5);
    expect(cam.x).toBeCloseTo(42, 10);
    expect(cam.y).toBeCloseTo(17, 10);
  });
});

// ── centerOn ───────────────────────────────────────────────────────────────────

describe('Camera2D.centerOn', () => {
  it('sets camera position to specified world coordinates', () => {
    const cam = new Camera2D();
    cam.centerOn(200, 300);
    expect(cam.x).toBe(200);
    expect(cam.y).toBe(300);
  });

  it('can center on negative coordinates', () => {
    const cam = new Camera2D();
    cam.centerOn(-50, -100);
    expect(cam.x).toBe(-50);
    expect(cam.y).toBe(-100);
  });

  it('does not affect zoom', () => {
    const cam = new Camera2D();
    cam.zoom = 2.5;
    cam.centerOn(100, 100);
    expect(cam.zoom).toBe(2.5);
  });

  it('overwrites previous position completely', () => {
    const cam = new Camera2D();
    cam.centerOn(100, 100);
    cam.centerOn(200, 200);
    expect(cam.x).toBe(200);
    expect(cam.y).toBe(200);
  });
});

// ── DPR-aware behavior ─────────────────────────────────────────────────────────

describe('Camera2D DPR-aware usage patterns', () => {
  it('viewport size should use CSS pixels, not physical pixels', () => {
    const cam = new Camera2D();
    // DPR 2: physical canvas is 1600x1200, CSS viewport is 800x600
    // Camera should use CSS pixels for transforms
    cam.resize(800, 600);
    const center = cam.worldToScreen(0, 0);
    expect(center.x).toBe(400);
    expect(center.y).toBe(300);
  });

  it('screenToWorld uses CSS pixel coordinates from pointer events', () => {
    const cam = new Camera2D();
    cam.resize(800, 600);
    cam.centerOn(0, 0);
    // A click at CSS (400, 300) should map to world (0, 0)
    const w = cam.screenToWorld(400, 300);
    expect(w.x).toBe(0);
    expect(w.y).toBe(0);
  });
});

// ── Edge cases ─────────────────────────────────────────────────────────────────

describe('Camera2D edge cases', () => {
  it('works with zero-size viewport', () => {
    const cam = new Camera2D();
    cam.resize(0, 0);
    const s = cam.worldToScreen(10, 20);
    expect(s.x).toBe(10);
    expect(s.y).toBe(20);
    const w = cam.screenToWorld(10, 20);
    expect(w.x).toBe(10);
    expect(w.y).toBe(20);
  });

  it('very small zoom does not produce Infinity', () => {
    const cam = new Camera2D();
    cam.resize(800, 600);
    cam.zoom = cam.minZoom;
    const w = cam.screenToWorld(0, 0);
    expect(Number.isFinite(w.x)).toBe(true);
    expect(Number.isFinite(w.y)).toBe(true);
  });

  it('very large world coordinates produce finite screen coordinates', () => {
    const cam = new Camera2D();
    cam.resize(800, 600);
    const s = cam.worldToScreen(1e8, 1e8);
    expect(Number.isFinite(s.x)).toBe(true);
    expect(Number.isFinite(s.y)).toBe(true);
  });

  it('combined pan then zoom preserves consistency', () => {
    const cam = new Camera2D();
    cam.resize(800, 600);
    cam.pan(100, 50);
    cam.zoomAt(400, 300, 1.5);

    // Verify round-trip still works
    const wp = { x: 42, y: -17 };
    const s = cam.worldToScreen(wp.x, wp.y);
    const w = cam.screenToWorld(s.x, s.y);
    expect(w.x).toBeCloseTo(wp.x, 10);
    expect(w.y).toBeCloseTo(wp.y, 10);
  });
});

// ── Bounds clamping ───────────────────────────────────────────────────────────

describe('Camera2D bounds clamping', () => {
  it('clamps pan to bounds', () => {
    const cam = new Camera2D();
    cam.setBounds(-100, -100, 100, 100);
    cam.resize(400, 300);
    cam.centerOn(0, 0);

    // Pan far to the right (negative deltaX moves camera right)
    cam.pan(-50000, 0);
    expect(cam.x).toBeLessThanOrEqual(100);

    // Pan far to the left
    cam.pan(50000, 0);
    expect(cam.x).toBeGreaterThanOrEqual(-100);
  });

  it('clamps zoomAt to bounds', () => {
    const cam = new Camera2D();
    cam.setBounds(-100, -100, 100, 100);
    cam.resize(400, 300);
    cam.centerOn(0, 0);

    // Zoom way out then check bounds
    cam.zoomAt(200, 150, 0.1); // zoom out a lot
    expect(cam.x).toBeGreaterThanOrEqual(-100);
    expect(cam.x).toBeLessThanOrEqual(100);
    expect(cam.y).toBeGreaterThanOrEqual(-100);
    expect(cam.y).toBeLessThanOrEqual(100);
  });

  it('allows free pan when no bounds set', () => {
    const cam = new Camera2D();
    cam.resize(400, 300);
    cam.centerOn(0, 0);

    cam.pan(-999999, 0);
    // Should be very large positive (panning left moves camera.x right in world)
    expect(Math.abs(cam.x)).toBeGreaterThan(1000);
  });

  it('clamps centerOn to bounds', () => {
    const cam = new Camera2D();
    cam.setBounds(-100, -100, 100, 100);

    cam.centerOn(500, 500);
    expect(cam.x).toBe(100);
    expect(cam.y).toBe(100);

    cam.centerOn(-500, -500);
    expect(cam.x).toBe(-100);
    expect(cam.y).toBe(-100);
  });
});
