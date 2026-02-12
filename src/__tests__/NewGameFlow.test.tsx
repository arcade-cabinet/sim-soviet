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

  it('renders tabbed interface with all four tabs', () => {
    render(<LandingPage {...defaultProps} />);
    expect(screen.getByText('SIMSOVET 2000')).toBeDefined();
    // Tabs show label text (hidden sm:inline renders in happy-dom)
    expect(screen.getByText('NEW GAME')).toBeDefined();
    expect(screen.getByText('LOAD')).toBeDefined();
    expect(screen.getByText('SETTINGS')).toBeDefined();
    expect(screen.getByText('CREDITS')).toBeDefined();
  });

  it('renders game title', () => {
    render(<LandingPage {...defaultProps} />);
    expect(screen.getByText('SIMSOVET 2000')).toBeDefined();
  });

  it('does not render CONTINUE when hasSavedGame is false', () => {
    render(<LandingPage {...defaultProps} hasSavedGame={false} />);
    expect(screen.queryByText('CONTINUE PREVIOUS ASSIGNMENT')).toBeNull();
  });

  it('renders CONTINUE when hasSavedGame is true', () => {
    render(<LandingPage {...defaultProps} hasSavedGame={true} />);
    expect(screen.getByText('CONTINUE PREVIOUS ASSIGNMENT')).toBeDefined();
  });

  it('calls onNewGame when BEGIN NEW ASSIGNMENT is clicked', () => {
    const onNewGame = vi.fn();
    render(<LandingPage {...defaultProps} onNewGame={onNewGame} />);
    fireEvent.click(screen.getByText('BEGIN NEW ASSIGNMENT'));
    expect(onNewGame).toHaveBeenCalledOnce();
  });

  it('calls onLoadGame via LOAD tab', () => {
    const onLoadGame = vi.fn();
    render(<LandingPage {...defaultProps} onLoadGame={onLoadGame} hasSavedGame={true} />);
    // Switch to Load tab
    fireEvent.click(screen.getByText('LOAD'));
    fireEvent.click(screen.getByText('LOAD FROM FILE'));
    expect(onLoadGame).toHaveBeenCalledOnce();
  });

  it('calls onContinue when CONTINUE PREVIOUS ASSIGNMENT is clicked', () => {
    const onContinue = vi.fn();
    render(<LandingPage {...defaultProps} hasSavedGame={true} onContinue={onContinue} />);
    fireEvent.click(screen.getByText('CONTINUE PREVIOUS ASSIGNMENT'));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('shows credits tab with technology info', () => {
    render(<LandingPage {...defaultProps} />);
    fireEvent.click(screen.getByText('CREDITS'));
    expect(screen.getByText('Canvas 2D + React 19')).toBeDefined();
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
    expect(screen.getByText('I. ASSIGNMENT')).toBeDefined();
  });

  it('navigates from step 1 to step 2 on Next click', () => {
    render(<NewGameFlow {...defaultProps} />);
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('II. PARAMETERS')).toBeDefined();
  });

  it('navigates from step 2 to step 3 on Next click', () => {
    render(<NewGameFlow {...defaultProps} />);
    // step 1 -> 2
    fireEvent.click(screen.getByText('Next'));
    // step 2 -> 3
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('III. CONSEQUENCES')).toBeDefined();
  });

  it('navigates back from step 2 to step 1', () => {
    render(<NewGameFlow {...defaultProps} />);
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('II. PARAMETERS')).toBeDefined();
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText('I. ASSIGNMENT')).toBeDefined();
  });

  it('calls onBack when Back is clicked on step 1', () => {
    const onBack = vi.fn();
    render(<NewGameFlow {...defaultProps} onBack={onBack} />);
    fireEvent.click(screen.getByText('Back'));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('shows BEGIN button on step 3 and calls onStart', () => {
    const onStart = vi.fn();
    render(<NewGameFlow {...defaultProps} onStart={onStart} />);
    // Navigate to step 3
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));
    // Click BEGIN
    fireEvent.click(screen.getByText('BEGIN'));
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

  it('renders difficulty options on step 2', () => {
    render(<NewGameFlow {...defaultProps} />);
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Worker')).toBeDefined();
    expect(screen.getByText('Comrade')).toBeDefined();
    expect(screen.getByText('Tovarish')).toBeDefined();
  });

  it('renders consequence options on step 3', () => {
    render(<NewGameFlow {...defaultProps} />);
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Forgiving')).toBeDefined();
    // "Permadeath" appears both as a consequence button label and in the summary
    expect(screen.getAllByText('Permadeath').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Harsh')).toBeDefined();
  });

  it('selects a consequence level when clicked', () => {
    const onStart = vi.fn();
    render(<NewGameFlow {...defaultProps} onStart={onStart} />);
    // Navigate to step 3
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));
    // Click Harsh (default is permadeath, so Harsh only appears once as a button)
    fireEvent.click(screen.getByText('Harsh'));
    // Click BEGIN
    fireEvent.click(screen.getByText('BEGIN'));
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
