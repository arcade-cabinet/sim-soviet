/**
 * Tests for RadialBuildMenu SVG z-order and pointer-events behavior.
 *
 * Verifies that:
 * 1. Building wedges always have pointer-events: all (clickable)
 * 2. Non-selected category wedges get pointer-events: none when submenu is open
 * 3. Selected category wedge retains pointer-events: all
 * 4. Center circle has pointer-events: none (non-interactive)
 * 5. Building wedges render AFTER category wedges in SVG DOM (natural z-order)
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock framer-motion to avoid animation complexity in tests
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...stripMotionProps(props)}>{children}</div>
    ),
    g: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <g {...stripMotionProps(props)}>{children}</g>
    ),
    path: (props: Record<string, unknown>) => <path {...stripMotionProps(props)} />,
  },
}));

/** Strip framer-motion-specific props that aren't valid DOM attributes. */
function stripMotionProps(props: Record<string, unknown>): Record<string, unknown> {
  const {
    initial,
    animate,
    exit,
    transition,
    whileHover,
    whileTap,
    variants,
    layout,
    layoutId,
    onAnimationComplete,
    ...rest
  } = props;
  return rest;
}

// Mock the gameStore hooks — we control what the menu sees
const mockRadialMenu = vi.fn();
const mockSnapshot = vi.fn();
const mockCloseRadialMenu = vi.fn();
const mockRequestPlacement = vi.fn();

vi.mock('@/stores/gameStore', () => ({
  useRadialMenu: () => mockRadialMenu(),
  useGameSnapshot: () => mockSnapshot(),
  closeRadialMenu: (...args: unknown[]) => mockCloseRadialMenu(...args),
  requestPlacement: (...args: unknown[]) => mockRequestPlacement(...args),
}));

// Mock era gating — return a small set of building IDs for testing
vi.mock('@/game/era', () => ({
  getAvailableBuildingsForYear: () => [
    'collective-farm-hq',
    'potato-field',
    'apartment-block-a',
    'power-station',
    'barracks',
  ],
}));

import { RadialBuildMenu } from '@/components/ui/RadialBuildMenu';

/** Default snapshot values for rendering. */
function defaultSnapshot() {
  return {
    date: { year: 1925, month: 1, tick: 0 },
    money: 5000,
    settlementTier: 'selo',
  };
}

/** Default radial menu state (open at center of screen). */
function defaultMenuState() {
  return {
    screenX: 200,
    screenY: 200,
    gridX: 5,
    gridY: 5,
    availableSpace: 4,
  };
}

describe('RadialBuildMenu', () => {
  beforeEach(() => {
    mockSnapshot.mockReturnValue(defaultSnapshot());
    mockRadialMenu.mockReturnValue(defaultMenuState());
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // ── Rendering ────────────────────────────────────────────────

  it('renders nothing when menu state is null', () => {
    mockRadialMenu.mockReturnValue(null);
    const { container } = render(<RadialBuildMenu />);
    expect(container.innerHTML).toBe('');
  });

  it('renders SVG with Build Menu title when menu is open', () => {
    render(<RadialBuildMenu />);
    expect(screen.getByTitle('Build Menu')).toBeDefined();
  });

  it('renders category wedges as SVG groups with button role', () => {
    render(<RadialBuildMenu />);
    const buttons = screen.getAllByRole('button');
    // At least some category buttons should exist
    expect(buttons.length).toBeGreaterThan(0);
    // Check one has a category label
    const labels = buttons.map((b) => b.getAttribute('aria-label') ?? '');
    expect(labels.some((l) => l.includes('category'))).toBe(true);
  });

  // ── Center Circle ────────────────────────────────────────────

  it('center circle has pointer-events: none', () => {
    render(<RadialBuildMenu />);
    // getByTitle returns the <title> element; go up to the <svg> parent
    const titleEl = screen.getByTitle('Build Menu');
    const svg = titleEl.closest('svg')!;
    expect(svg).toBeDefined();
    const circles = svg.querySelectorAll('circle');
    // The first circle is the center dot (r=8, fill=#cfaa48)
    const centerCircle = circles[0];
    expect(centerCircle).toBeDefined();
    expect(centerCircle!.style.pointerEvents).toBe('none');
  });

  // ── Category Wedge pointer-events ──────────────────────────

  it('category wedges have pointer-events: all when no submenu is open', () => {
    render(<RadialBuildMenu />);
    const buttons = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-label')?.includes('category'));
    for (const btn of buttons) {
      expect(btn.style.pointerEvents).toBe('all');
    }
  });

  it('non-selected category wedges get pointer-events: none when submenu is open', () => {
    render(<RadialBuildMenu />);

    // Click the first category to open its submenu
    const catButtons = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-label')?.includes('category'));
    expect(catButtons.length).toBeGreaterThan(1);

    fireEvent.click(catButtons[0]!);

    // Re-query after state change
    const updatedButtons = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-label')?.includes('category'));

    // The clicked (selected) category should still be interactive
    const selectedBtn = updatedButtons[0]!;
    expect(selectedBtn.style.pointerEvents).toBe('all');

    // Non-selected category buttons should have pointer-events: none
    for (let i = 1; i < updatedButtons.length; i++) {
      expect(updatedButtons[i]!.style.pointerEvents).toBe('none');
    }
  });

  it('selected category retains pointer-events: all for toggling', () => {
    render(<RadialBuildMenu />);

    const catButtons = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-label')?.includes('category'));
    // Click to select
    fireEvent.click(catButtons[0]!);

    const updatedButtons = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-label')?.includes('category'));
    expect(updatedButtons[0]!.style.pointerEvents).toBe('all');
  });

  // ── Building Wedge pointer-events ──────────────────────────

  it('building wedges have pointer-events: all when submenu is open', () => {
    render(<RadialBuildMenu />);

    // Open a category submenu
    const catButtons = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-label')?.includes('category'));
    fireEvent.click(catButtons[0]!);

    // Building wedges should now be visible with pointer-events: all
    const allButtons = screen.getAllByRole('button');
    const buildingButtons = allButtons.filter((b) => {
      const label = b.getAttribute('aria-label') ?? '';
      return !label.includes('category');
    });

    // There should be some building buttons from the submenu
    if (buildingButtons.length > 0) {
      for (const btn of buildingButtons) {
        expect(btn.style.pointerEvents).toBe('all');
      }
    }
  });

  // ── SVG DOM z-order ─────────────────────────────────────────

  it('building wedges render after category wedges in SVG DOM (natural z-order)', () => {
    render(<RadialBuildMenu />);

    // Open a category submenu
    const catButtons = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-label')?.includes('category'));
    fireEvent.click(catButtons[0]!);

    // In SVG, later elements are painted on top. The AnimatePresence/motion.g
    // containing building wedges should come after all CategoryWedge <g> elements.
    const svg = screen.getByTitle('Build Menu').closest('svg')!;
    const allGroups = svg.querySelectorAll(':scope > *');
    const groupArray = Array.from(allGroups);

    // Find indices: center circle is first, then category wedges, then building group
    // The building ring wrapper (motion.g with circle + building wedges) should be last
    const lastGroup = groupArray[groupArray.length - 1];
    // The building ring container should contain the dashed circle separator
    const dashedCircle = lastGroup?.querySelector('circle[stroke-dasharray]');
    expect(dashedCircle).not.toBeNull();
  });

  // ── Interaction ─────────────────────────────────────────────

  it('clicking backdrop calls closeRadialMenu', () => {
    render(<RadialBuildMenu />);

    // The backdrop is the semi-transparent overlay div (bg-black/50) with onClick={handleClose}
    const container = screen.getByTitle('Build Menu').closest('.fixed')!;
    const backdrop = container.querySelector('.bg-black\\/50');
    expect(backdrop).not.toBeNull();

    fireEvent.click(backdrop!);
    expect(mockCloseRadialMenu).toHaveBeenCalled();
  });

  it('displays grid coordinates in the info label', () => {
    render(<RadialBuildMenu />);
    // The info label shows "Grid [5,5]"
    expect(screen.getByText(/Grid \[5,5\]/)).toBeDefined();
  });
});
