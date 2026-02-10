import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ConcreteFrame } from '@/components/ui/ConcreteFrame';

afterEach(cleanup);

describe('ConcreteFrame', () => {
  it('renders 4 border divs inside the container', () => {
    render(<ConcreteFrame />);

    expect(screen.getByTestId('concrete-frame-left')).toBeDefined();
    expect(screen.getByTestId('concrete-frame-right')).toBeDefined();
    expect(screen.getByTestId('concrete-frame-top')).toBeDefined();
    expect(screen.getByTestId('concrete-frame-bottom')).toBeDefined();
  });

  it('sets pointer-events-none on the container', () => {
    render(<ConcreteFrame />);

    const container = screen.getByTestId('concrete-frame');
    expect(container.classList.contains('pointer-events-none')).toBe(true);
  });

  it('sets z-index 5 on the container', () => {
    render(<ConcreteFrame />);

    const container = screen.getByTestId('concrete-frame');
    expect(container.style.zIndex).toBe('5');
  });
});
