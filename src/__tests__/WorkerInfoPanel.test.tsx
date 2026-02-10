/**
 * Tests for src/components/ui/WorkerInfoPanel.tsx
 *
 * Verifies the panel renders when inspectedWorker is set,
 * shows correct data, and dismiss button clears the state.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WorkerInfoPanel } from '@/components/ui/WorkerInfoPanel';
import { createMetaStore, createResourceStore } from '@/ecs/factories';
import { world } from '@/ecs/world';
import { type InspectedWorker, setInspectedWorker } from '@/stores/gameStore';

const MOCK_WORKER: InspectedWorker = {
  name: 'Comrade Petrov',
  class: 'engineer',
  morale: 72,
  loyalty: 55,
  skill: 80,
  vodkaDependency: 35,
  assignedBuildingDefId: 'vodka-distillery-a',
};

describe('WorkerInfoPanel', () => {
  beforeEach(() => {
    world.clear();
    createResourceStore();
    createMetaStore();
    setInspectedWorker(null);
  });

  afterEach(() => {
    cleanup();
    world.clear();
    setInspectedWorker(null);
  });

  it('renders nothing when no worker is inspected', () => {
    const { container } = render(<WorkerInfoPanel />);
    expect(container.innerHTML).toBe('');
  });

  it('renders worker name when inspected', () => {
    setInspectedWorker(MOCK_WORKER);
    render(<WorkerInfoPanel />);
    expect(screen.getByText('Comrade Petrov')).toBeTruthy();
  });

  it('shows class label', () => {
    setInspectedWorker(MOCK_WORKER);
    render(<WorkerInfoPanel />);
    expect(screen.getByText('Engineer')).toBeTruthy();
  });

  it('shows stat bars for morale, loyalty, and skill', () => {
    setInspectedWorker(MOCK_WORKER);
    render(<WorkerInfoPanel />);
    expect(screen.getByText('Morale')).toBeTruthy();
    expect(screen.getByText('Loyalty')).toBeTruthy();
    expect(screen.getByText('Skill')).toBeTruthy();
  });

  it('shows vodka dependency when > 0', () => {
    setInspectedWorker(MOCK_WORKER);
    render(<WorkerInfoPanel />);
    expect(screen.getByText('Vodka Need')).toBeTruthy();
    expect(screen.getByText('35%')).toBeTruthy();
  });

  it('hides vodka dependency when 0', () => {
    setInspectedWorker({ ...MOCK_WORKER, vodkaDependency: 0 });
    render(<WorkerInfoPanel />);
    expect(screen.queryByText('Vodka Need')).toBeNull();
  });

  it('shows assigned building when set', () => {
    setInspectedWorker(MOCK_WORKER);
    render(<WorkerInfoPanel />);
    expect(screen.getByText('Assigned')).toBeTruthy();
    expect(screen.getByText('vodka-distillery-a')).toBeTruthy();
  });

  it('hides assignment info when not assigned', () => {
    setInspectedWorker({ ...MOCK_WORKER, assignedBuildingDefId: null });
    render(<WorkerInfoPanel />);
    expect(screen.queryByText('Assigned')).toBeNull();
  });

  it('dismiss button clears inspected worker', () => {
    setInspectedWorker(MOCK_WORKER);
    render(<WorkerInfoPanel />);
    const dismissBtn = screen.getByText('Dismiss');
    fireEvent.click(dismissBtn);
    expect(screen.queryByText('Comrade Petrov')).toBeNull();
  });

  it('has an assign button', () => {
    setInspectedWorker(MOCK_WORKER);
    render(<WorkerInfoPanel />);
    expect(screen.getByText('Assign')).toBeTruthy();
  });
});
