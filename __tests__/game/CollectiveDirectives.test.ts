// __tests__/game/CollectiveDirectives.test.ts
import { COLLECTIVE_DIRECTIVES, getDirectiveByFocus } from '@/game/workers/collectiveDirectives';

describe('Collective Directives', () => {
  it('has 4 directives matching CollectiveFocus values', () => {
    expect(COLLECTIVE_DIRECTIVES.length).toBe(4);
  });

  it('each directive has a name, description, focus, and risk level', () => {
    for (const d of COLLECTIVE_DIRECTIVES) {
      expect(d.name.length).toBeGreaterThan(0);
      expect(d.description.length).toBeGreaterThan(0);
      expect(['food', 'construction', 'production', 'balanced']).toContain(d.focus);
      expect(['none', 'low', 'medium']).toContain(d.risk);
    }
  });

  it('getDirectiveByFocus returns the correct directive', () => {
    const d = getDirectiveByFocus('food');
    expect(d).toBeDefined();
    expect(d!.name).toBe('All Hands to the Harvest');
  });

  it('"balanced" has no risk', () => {
    const d = getDirectiveByFocus('balanced');
    expect(d!.risk).toBe('none');
  });
});
