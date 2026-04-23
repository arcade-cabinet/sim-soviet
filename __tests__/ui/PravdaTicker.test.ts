/**
 * @fileoverview Tests for the PravdaTicker component:
 * - buildTickerText pure function logic
 * - Renders without crashing
 * - Shows placeholder when no headlines
 * - Shows headline text when provided
 * - Caps at 5 headlines (carousel view)
 * - Hidden when visible=false
 * - Year display
 */

import React from 'react';
import { act, create } from 'react-test-renderer';
import { buildTickerText, PravdaTicker } from '@/ui/PravdaTicker';

describe('buildTickerText', () => {
  it('returns placeholder when no headlines', () => {
    const text = buildTickerText([]);
    expect(text).toContain('\u0421\u041E\u0412\u0415\u0422\u0421\u041A\u0418\u0419 \u0421\u041E\u042E\u0417');
  });

  it('includes headline text when provided', () => {
    const text = buildTickerText(['WORKERS EXCEED QUOTA', 'NEW FACTORY OPERATIONAL']);
    expect(text).toContain('WORKERS EXCEED QUOTA');
    expect(text).toContain('NEW FACTORY OPERATIONAL');
  });

  it('joins multiple headlines with separator', () => {
    const text = buildTickerText(['HEADLINE ONE', 'HEADLINE TWO']);
    expect(text).toContain('HEADLINE ONE');
    expect(text).toContain('HEADLINE TWO');
    expect(text).toContain('\u2726');
  });

  it('caps displayed headlines at 5', () => {
    const headlines = Array.from({ length: 8 }, (_, i) => `HEADLINE_${i}`);
    const text = buildTickerText(headlines);
    expect(text).toContain('HEADLINE_0');
    expect(text).toContain('HEADLINE_4');
    expect(text).not.toContain('HEADLINE_5');
    expect(text).not.toContain('HEADLINE_7');
  });

  it('ends with star separator suffix', () => {
    const text = buildTickerText(['TEST']);
    expect(text).toMatch(/\u2726$/);
  });
});

describe('PravdaTicker component', () => {
  it('renders without crashing', () => {
    let tree: ReturnType<typeof create>;
    act(() => {
      tree = create(React.createElement(PravdaTicker, { headlines: [] }));
    });
    expect(tree!.toJSON()).toBeTruthy();
  });

  it('returns null when visible is false', () => {
    let tree: ReturnType<typeof create>;
    act(() => {
      tree = create(React.createElement(PravdaTicker, { headlines: [], visible: false }));
    });
    expect(tree!.toJSON()).toBeNull();
  });

  it('renders when visible is true', () => {
    let tree: ReturnType<typeof create>;
    act(() => {
      tree = create(React.createElement(PravdaTicker, { headlines: [], visible: true }));
    });
    expect(tree!.toJSON()).toBeTruthy();
  });

  it('renders when visible is undefined (default true)', () => {
    let tree: ReturnType<typeof create>;
    act(() => {
      tree = create(React.createElement(PravdaTicker, { headlines: [] }));
    });
    expect(tree!.toJSON()).toBeTruthy();
  });

  it('renders PRAVDA label', () => {
    let tree: ReturnType<typeof create>;
    act(() => {
      tree = create(React.createElement(PravdaTicker, { headlines: [] }));
    });
    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain('\u041F\u0420\u0410\u0412\u0414\u0410');
  });

  it('renders year when provided', () => {
    let tree: ReturnType<typeof create>;
    act(() => {
      tree = create(React.createElement(PravdaTicker, { headlines: [], year: 'March 1920' }));
    });
    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain('March 1920');
  });

  it('renders without year when not provided', () => {
    let tree: ReturnType<typeof create>;
    act(() => {
      tree = create(React.createElement(PravdaTicker, { headlines: [] }));
    });
    // Should still render without crashing
    expect(tree!.toJSON()).toBeTruthy();
  });
});
