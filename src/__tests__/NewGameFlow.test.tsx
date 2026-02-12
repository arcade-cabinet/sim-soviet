/**
 * Tests for Landing Page, NewGameFlow, and AssignmentLetter screens.
 *
 * Uses @testing-library/react with happy-dom environment.
 * Mocks framer-motion so AnimatePresence doesn't block step transitions.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock framer-motion: motion.* renders plain elements, AnimatePresence renders children immediately.
vi.mock('framer-motion', () => {
  const MOTION_PROPS = new Set([
    'initial',
    'animate',
    'exit',
    'transition',
    'variants',
    'whileHover',
    'whileTap',
    'whileInView',
    'transformOrigin',
    'layout',
    'layoutId',
  ]);

  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, tagName: string) {
      const Comp = React.forwardRef<unknown, Record<string, unknown>>(
        ({ children, ...props }, ref) => {
          const filtered: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(props)) {
            if (!MOTION_PROPS.has(k)) filtered[k] = v;
          }
          return React.createElement(tagName, { ...filtered, ref }, children as React.ReactNode);
        }
      );
      Comp.displayName = `motion.${tagName}`;
      return Comp;
    },
  };

  return {
    motion: new Proxy({} as Record<string, unknown>, handler),
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

import { AssignmentLetter } from '@/components/screens/AssignmentLetter';
import { LandingPage } from '@/components/screens/LandingPage';
import { type NewGameConfig, NewGameFlow } from '@/components/screens/NewGameFlow';
import { ERA_DEFINITIONS } from '@/game/era';

afterEach(() => {
  cleanup();
});

// ─────────────────────────────────────────────────────────
//  LandingPage
// ─────────────────────────────────────────────────────────

describe('LandingPage', () => {
  const defaultProps = {
    onNewGame: vi.fn(),
    onContinue: vi.fn(),
    onLoadGame: vi.fn(),
    hasSavedGame: false,
  };

  it('renders NEW GAME and LOAD GAME buttons', () => {
    render(<LandingPage {...defaultProps} />);
    expect(screen.getByText('NEW GAME')).toBeDefined();
    expect(screen.getByText('LOAD GAME')).toBeDefined();
  });

  it('renders game title', () => {
    render(<LandingPage {...defaultProps} />);
    expect(screen.getByText('SIMSOVET 2000')).toBeDefined();
  });

  it('does not render CONTINUE when hasSavedGame is false', () => {
    render(<LandingPage {...defaultProps} hasSavedGame={false} />);
    expect(screen.queryByText('CONTINUE')).toBeNull();
  });

  it('renders CONTINUE when hasSavedGame is true', () => {
    render(<LandingPage {...defaultProps} hasSavedGame={true} />);
    expect(screen.getByText('CONTINUE')).toBeDefined();
  });

  it('calls onNewGame when NEW GAME is clicked', () => {
    const onNewGame = vi.fn();
    render(<LandingPage {...defaultProps} onNewGame={onNewGame} />);
    fireEvent.click(screen.getByText('NEW GAME'));
    expect(onNewGame).toHaveBeenCalledOnce();
  });

  it('calls onLoadGame when LOAD GAME is clicked', () => {
    const onLoadGame = vi.fn();
    render(<LandingPage {...defaultProps} onLoadGame={onLoadGame} />);
    fireEvent.click(screen.getByText('LOAD GAME'));
    expect(onLoadGame).toHaveBeenCalledOnce();
  });

  it('calls onContinue when CONTINUE is clicked', () => {
    const onContinue = vi.fn();
    render(<LandingPage {...defaultProps} hasSavedGame={true} onContinue={onContinue} />);
    fireEvent.click(screen.getByText('CONTINUE'));
    expect(onContinue).toHaveBeenCalledOnce();
  });
});

// ─────────────────────────────────────────────────────────
//  NewGameFlow
// ─────────────────────────────────────────────────────────

describe('NewGameFlow', () => {
  const defaultProps = {
    onStart: vi.fn(),
    onBack: vi.fn(),
  };

  it('renders the first step (Assignment) initially', () => {
    render(<NewGameFlow {...defaultProps} />);
    // Tabs
    expect(screen.getByText('Assignment')).toBeDefined();
    expect(screen.getByText('Parameters')).toBeDefined();
    expect(screen.getByText('Consequences')).toBeDefined();

    // Default content
    expect(screen.getByText('Chairman Identity (Full Name)')).toBeDefined();
  });

  it('navigates to Parameters on tab click', () => {
    render(<NewGameFlow {...defaultProps} />);
    fireEvent.click(screen.getByText('Parameters'));
    expect(screen.getByText('Difficulty Classification')).toBeDefined();
  });

  it('navigates to Consequences on tab click', () => {
    render(<NewGameFlow {...defaultProps} />);
    fireEvent.click(screen.getByText('Consequences'));
    expect(screen.getByText('Failure Consequence (Arrest Protocol)')).toBeDefined();
  });

  it('navigates back to Assignment on tab click', () => {
    render(<NewGameFlow {...defaultProps} />);
    fireEvent.click(screen.getByText('Parameters'));
    expect(screen.getByText('Difficulty Classification')).toBeDefined();
    fireEvent.click(screen.getByText('Assignment'));
    expect(screen.getByText('Chairman Identity (Full Name)')).toBeDefined();
  });

  it('calls onBack when Cancel Assignment is clicked', () => {
    const onBack = vi.fn();
    render(<NewGameFlow {...defaultProps} onBack={onBack} />);
    fireEvent.click(screen.getByText('Cancel Assignment'));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('calls onStart when EXECUTE ORDER is clicked', () => {
    const onStart = vi.fn();
    render(<NewGameFlow {...defaultProps} onStart={onStart} />);
    fireEvent.click(screen.getByText('EXECUTE ORDER'));
    expect(onStart).toHaveBeenCalledOnce();
    // Verify the config shape
    const config = onStart.mock.calls[0]![0] as NewGameConfig;
    expect(config.playerName).toBeTruthy();
    expect(config.cityName).toBeTruthy();
    expect(config.difficulty).toBe('comrade');
    expect(config.mapSize).toBe('medium');
    expect(config.seed).toBeTruthy();
    expect(config.startEra).toBe('war_communism');
    expect(config.consequence).toBe('permadeath');
  });

  it('renders difficulty options on Parameters tab', () => {
    render(<NewGameFlow {...defaultProps} />);
    fireEvent.click(screen.getByText('Parameters'));
    expect(screen.getByText('Worker')).toBeDefined();
    expect(screen.getByText('Comrade')).toBeDefined();
    expect(screen.getByText('Tovarish')).toBeDefined();
  });

  it('renders consequence options on Consequences tab', () => {
    render(<NewGameFlow {...defaultProps} />);
    fireEvent.click(screen.getByText('Consequences'));
    expect(screen.getByText('Forgiving')).toBeDefined();
    expect(screen.getByText('Permadeath')).toBeDefined(); // As button
    expect(screen.getByText('Harsh')).toBeDefined();
  });

  it('selects a consequence level when clicked', () => {
    const onStart = vi.fn();
    render(<NewGameFlow {...defaultProps} onStart={onStart} />);

    // Switch to consequences tab
    fireEvent.click(screen.getByText('Consequences'));

    // Select Harsh
    fireEvent.click(screen.getByText('Harsh'));

    // Submit
    fireEvent.click(screen.getByText('EXECUTE ORDER'));
    const config = onStart.mock.calls[0]![0] as NewGameConfig;
    expect(config.consequence).toBe('harsh');
  });
});

// ─────────────────────────────────────────────────────────
//  AssignmentLetter
// ─────────────────────────────────────────────────────────

describe('AssignmentLetter', () => {
  const sampleConfig: NewGameConfig = {
    playerName: 'Ivan Petrov',
    cityName: 'Leningrad-on-Tundra',
    difficulty: 'worker',
    mapSize: 'medium',
    seed: 'glorious-potato-42',
    startEra: 'war_communism',
    consequence: 'permadeath',
  };
  const era = ERA_DEFINITIONS.war_communism;

  it('displays the player name', () => {
    render(<AssignmentLetter config={sampleConfig} era={era} onAccept={vi.fn()} />);
    expect(screen.getByText(/Ivan Petrov/)).toBeDefined();
  });

  it('displays the city name', () => {
    render(<AssignmentLetter config={sampleConfig} era={era} onAccept={vi.fn()} />);
    expect(screen.getByText(/Leningrad-on-Tundra/)).toBeDefined();
  });

  it('displays the era intro title', () => {
    render(<AssignmentLetter config={sampleConfig} era={era} onAccept={vi.fn()} />);
    expect(screen.getByText(era.introTitle)).toBeDefined();
  });

  it('displays the ACCEPT ASSIGNMENT button', () => {
    render(<AssignmentLetter config={sampleConfig} era={era} onAccept={vi.fn()} />);
    expect(screen.getByText('Accept Assignment')).toBeDefined();
  });

  it('calls onAccept when Accept Assignment is clicked', () => {
    const onAccept = vi.fn();
    render(<AssignmentLetter config={sampleConfig} era={era} onAccept={onAccept} />);
    fireEvent.click(screen.getByText('Accept Assignment'));
    expect(onAccept).toHaveBeenCalledOnce();
  });

  it('displays difficulty information', () => {
    render(<AssignmentLetter config={sampleConfig} era={era} onAccept={vi.fn()} />);
    expect(screen.getByText('Worker')).toBeDefined();
  });

  it('displays a decree number', () => {
    render(<AssignmentLetter config={sampleConfig} era={era} onAccept={vi.fn()} />);
    // Decree number is "Assignment Decree No. XXXX"
    expect(screen.getByText(/Assignment Decree No\. \d{4}/)).toBeDefined();
  });
});
