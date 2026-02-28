/**
 * Tests for ERA_CONTEXTS mapping in AudioManifest.
 *
 * Verifies that every EraId has a music context and that all mapped
 * context values are valid keys in MUSIC_CONTEXTS.
 */

import { ERA_CONTEXTS, MUSIC_CONTEXTS } from '../../src/audio/AudioManifest';
import { ERA_ORDER } from '../../src/game/era/definitions';

describe('ERA_CONTEXTS', () => {
  it('maps every era in ERA_ORDER to a context', () => {
    for (const eraId of ERA_ORDER) {
      expect(ERA_CONTEXTS[eraId]).toBeDefined();
    }
  });

  it('has no extra keys beyond ERA_ORDER', () => {
    const eraSet = new Set<string>(ERA_ORDER);
    for (const key of Object.keys(ERA_CONTEXTS)) {
      expect(eraSet.has(key)).toBe(true);
    }
  });

  it('maps every era to a valid MUSIC_CONTEXTS key', () => {
    for (const [_eraId, context] of Object.entries(ERA_CONTEXTS)) {
      expect(MUSIC_CONTEXTS).toHaveProperty(context, expect.any(String));
    }
  });
});
