import type { DialogueLine } from '../types';

export const AMBIENT_LINES: DialogueLine[] = [
  {
    text: '\u2014Did you hear about Petrov? \u2014Which Petrov? \u2014Exactly.',
    character: 'ambient',
  },
  {
    text: '\u2014The bread line was short today. \u2014That means the bread was short today. \u2014...',
    character: 'ambient',
  },
  {
    text: '\u2014My son wants to be a cosmonaut. \u2014Better than what they want him to be. \u2014What do they want him to be? \u2014Quiet.',
    character: 'ambient',
  },
  {
    text: '\u2014I heard they are building a new factory. \u2014What does it produce? \u2014Reports about production.',
    character: 'ambient',
  },
  {
    text: '[A politruk lectures an empty room. The chairs listen attentively. The chairs have always been reliable.]',
    character: 'ambient',
  },
  {
    text: '\u2014Three rubles for a potato? \u2014The potato is aspirational. \u2014What does that mean? \u2014It means there is no potato.',
    character: 'ambient',
  },
  {
    text: '[Two workers sharing a cigarette in silence. The silence says everything. The cigarette says nothing. It was the last one.]',
    character: 'ambient',
  },
  {
    text: '\u2014My grandmother remembers when things were different. \u2014Different how? \u2014She will not say. She remembers that too.',
    character: 'ambient',
  },
  {
    text: '[A man in a grey coat writes in a small notebook. He has been writing for forty minutes. No one approaches. No one leaves.]',
    character: 'ambient',
  },
  {
    text: '\u2014Is it true they arrested Volkov? \u2014Nobody arrested Volkov. \u2014Then where is Volkov? \u2014Volkov never existed. Keep up.',
    character: 'ambient',
  },
  {
    text: '\u2014My ceiling leaks. \u2014My ceiling also leaks. \u2014At least we have ceilings. \u2014[Long pause.] \u2014Yes. At least.',
    character: 'ambient',
  },
  {
    text: '[A child recites the national anthem while skipping rope. The rhythm is off. The words are perfect. The words are always perfect.]',
    character: 'ambient',
  },
  {
    text: '\u2014The radio said production is up 300%. \u2014The radio also said the weather is mild. \u2014[They both glance at the blizzard.]',
    character: 'ambient',
    conditions: { season: 'winter' },
  },
  {
    text: '\u2014Do you trust him? \u2014I trust the wall between us. \u2014The wall is thin. \u2014Then I trust him quietly.',
    character: 'ambient',
    conditions: { threatLevel: 'watched' },
  },
  {
    text: "\u2014What's for dinner? \u2014Hope. \u2014Again?",
    character: 'ambient',
    conditions: { resourceLevel: 'starving' },
  },
  {
    text: '\u2014The mud swallowed a truck today. \u2014Whole? \u2014Including the driver. He is filing a complaint. From the mud.',
    character: 'ambient',
    conditions: { season: 'mud' },
  },
  {
    text: '[Two babushkas on a bench, watching the settlement. They have watched it since before it was a settlement. They will watch after.]',
    character: 'ambient',
    conditions: { settlementTier: 'selo' },
  },
];
