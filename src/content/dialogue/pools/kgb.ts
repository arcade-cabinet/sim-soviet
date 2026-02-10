import type { DialogueLine } from '../types';

export const KGB_LINES: DialogueLine[] = [
  {
    text: 'Your records are... interesting. I am sure there is a perfectly good explanation. Take your time. We have your time.',
    character: 'kgb',
  },
  {
    text: 'I am not following you. I simply happen to walk in the same direction. Every day. At the same time. For seven months.',
    character: 'kgb',
  },
  {
    text: 'Your wife mentioned you talk in your sleep. She did not mention it to you. She mentioned it to us.',
    character: 'kgb',
  },
  {
    text: 'We received an anonymous tip about you. Well, not entirely anonymous. Your brother sends his regards.',
    character: 'kgb',
  },
  {
    text: 'I noticed your light was on at 2 AM. You must be very dedicated to your work. What work were you doing at 2 AM? Just curious.',
    character: 'kgb',
  },
  {
    text: 'Please, sit down. The chair is comfortable. I had it brought in specially. For conversations like this. Routine conversations.',
    character: 'kgb',
  },
  {
    text: 'Your file says you are loyal. I believe your file. Your file has never lied to me. You, on the other hand...',
    character: 'kgb',
  },
  {
    text: 'I am just asking questions. The answers are optional. The questions are not.',
    character: 'kgb',
  },
  {
    text: 'You look nervous. Innocent people do not look nervous. Then again, we have never met an innocent person. Interesting coincidence.',
    character: 'kgb',
  },
  {
    text: 'Your neighbor reports that you are an excellent citizen. Your other neighbor disagrees. We are interviewing both. Separately.',
    character: 'kgb',
  },
  {
    text: 'That is a nice family you have. It would be a shame if they had to relocate. Siberia is lovely this time of year. Every time of year.',
    character: 'kgb',
  },
  {
    text: 'We know everything. We also know what we do not know. What we do not know about you is... concerning.',
    character: 'kgb',
  },
  {
    text: 'The door is not locked. You may leave whenever you wish. We will note the exact time you wish to leave. And why.',
    character: 'kgb',
  },
  // Endangered
  {
    text: 'Several of your colleagues have been... promoted. To different locations. Very different locations. Would you like a promotion?',
    character: 'kgb',
    conditions: { threatLevel: 'endangered' },
  },
  // Critical
  {
    text: 'The list is getting shorter. This is not a comfort. It means we are thorough.',
    character: 'kgb',
    conditions: { threatLevel: 'critical' },
  },
  // Winter
  {
    text: 'Cold, is it not? Some of our guests report that Siberia is colder. We can arrange a comparison.',
    character: 'kgb',
    conditions: { season: 'winter' },
  },
];
