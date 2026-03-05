import worldTimeline from '../../src/config/worldTimeline.json';
import spaceTimeline from '../../src/config/spaceTimeline.json';
import lunarTimeline from '../../src/config/lunarTimeline.json';
import venusTimeline from '../../src/config/venusTimeline.json';
import beltTimeline from '../../src/config/beltTimeline.json';
import generationShipTimeline from '../../src/config/generationShipTimeline.json';
import jupiterTimeline from '../../src/config/jupiterTimeline.json';
import titanTimeline from '../../src/config/titanTimeline.json';
import marsTimeline from '../../src/config/marsTimeline.json';
import exoplanetTimeline from '../../src/config/exoplanetTimeline.json';

describe('Timeline JSON validation', () => {
  const allTimelines = [
    { id: 'world', data: worldTimeline },
    { id: 'space', data: spaceTimeline },
    { id: 'lunar', data: lunarTimeline },
    { id: 'venus', data: venusTimeline },
    { id: 'belt', data: beltTimeline },
    { id: 'generationShip', data: generationShipTimeline },
    { id: 'jupiter', data: jupiterTimeline },
    { id: 'titan', data: titanTimeline },
    { id: 'mars', data: marsTimeline },
    { id: 'exoplanet', data: exoplanetTimeline },
  ];

  for (const { id, data } of allTimelines) {
    describe(`${id} timeline`, () => {
      for (const milestone of (data as any).milestones ?? []) {
        const choices = milestone.effects?.narrative?.choices;
        if (choices && choices.length > 0) {
          it(`${milestone.id} has valid autoResolveChoiceId`, () => {
            const autoId = milestone.effects.narrative.autoResolveChoiceId;
            expect(autoId).toBeDefined();
            expect(typeof autoId).toBe('string');
            const validIds = choices.map((c: any) => c.id);
            expect(validIds).toContain(autoId);
          });
        }
      }
    });
  }
});
