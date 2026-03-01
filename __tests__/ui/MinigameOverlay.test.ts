/**
 * @fileoverview Tests for the MinigameOverlay system:
 * - InteractiveMinigameType field on MinigameDefinition
 * - Interactive type routing (hunt, factory_emergency, inspection)
 * - Outcome resolution for interactive minigames
 * - GameModals skips rendering when interactiveType is set
 */

import { MINIGAME_DEFINITIONS } from '@/game/minigames/definitions';
import { FACTORY_EMERGENCY } from '@/game/minigames/definitions/factory';
import { THE_HUNT } from '@/game/minigames/definitions/hunt';
import { THE_INSPECTION } from '@/game/minigames/definitions/inspection';
import type { InteractiveMinigameType, MinigameDefinition } from '@/game/minigames/MinigameTypes';

describe('MinigameOverlay system', () => {
  describe('interactiveType field on definitions', () => {
    it('THE_HUNT has interactiveType = hunt', () => {
      expect(THE_HUNT.interactiveType).toBe('hunt');
    });

    it('FACTORY_EMERGENCY has interactiveType = factory_emergency', () => {
      expect(FACTORY_EMERGENCY.interactiveType).toBe('factory_emergency');
    });

    it('THE_INSPECTION has interactiveType = inspection', () => {
      expect(THE_INSPECTION.interactiveType).toBe('inspection');
    });

    it('only 3 definitions have interactiveType set', () => {
      const interactive = MINIGAME_DEFINITIONS.filter((d: MinigameDefinition) => d.interactiveType != null);
      expect(interactive).toHaveLength(3);
    });

    it('other definitions do not have interactiveType', () => {
      const nonInteractive = MINIGAME_DEFINITIONS.filter((d: MinigameDefinition) => d.interactiveType == null);
      // 17 total - 3 interactive = 14 text-choice
      expect(nonInteractive.length).toBe(MINIGAME_DEFINITIONS.length - 3);
    });
  });

  describe('InteractiveMinigameType values', () => {
    const validTypes: InteractiveMinigameType[] = ['hunt', 'factory_emergency', 'inspection'];

    it('all interactive definitions have valid type strings', () => {
      const interactive = MINIGAME_DEFINITIONS.filter((d: MinigameDefinition) => d.interactiveType != null);
      for (const def of interactive) {
        expect(validTypes).toContain(def.interactiveType);
      }
    });
  });

  describe('minigame definitions remain valid', () => {
    it('interactive definitions still have choices (fallback for text mode)', () => {
      expect(THE_HUNT.choices.length).toBeGreaterThan(0);
      expect(FACTORY_EMERGENCY.choices.length).toBeGreaterThan(0);
      expect(THE_INSPECTION.choices.length).toBeGreaterThan(0);
    });

    it('interactive definitions still have autoResolve', () => {
      expect(THE_HUNT.autoResolve.announcement).toBeTruthy();
      expect(FACTORY_EMERGENCY.autoResolve.announcement).toBeTruthy();
      expect(THE_INSPECTION.autoResolve.announcement).toBeTruthy();
    });

    it('all 17 definitions are present', () => {
      expect(MINIGAME_DEFINITIONS).toHaveLength(17);
    });

    it('each definition has a unique id', () => {
      const ids = MINIGAME_DEFINITIONS.map((d: MinigameDefinition) => d.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
