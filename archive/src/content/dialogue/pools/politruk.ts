import type { DialogueLine } from '../types';

export const POLITRUK_LINES: DialogueLine[] = [
  {
    text: 'Your productivity numbers are... aspirational. Let us discuss your aspirations. In my office.',
    character: 'politruk',
  },
  {
    text: 'Comrade, enthusiasm is not optional. It is scheduled for 8 AM. You were not enthusiastic at 8 AM. This has been noted.',
    character: 'politruk',
  },
  {
    text: 'The Party requires your honest opinion. Your honest opinion is that the Party is correct. Thank you for your honesty.',
    character: 'politruk',
  },
  {
    text: 'I see you are reading. Reading is encouraged. What are you reading? Never mind. I already know. I have always known.',
    character: 'politruk',
  },
  {
    text: 'Your attendance record is exemplary. Your attitude record is... under review. Reviews take six to eight months. Or forever.',
    character: 'politruk',
  },
  {
    text: 'The quota has been revised upward. Your capabilities have been revised upward. These revisions are connected. You are welcome.',
    character: 'politruk',
  },
  {
    text: 'There are no problems. There are only opportunities for the Party to demonstrate its problem-solving. Report your opportunities.',
    character: 'politruk',
  },
  {
    text: 'Comrade, you look tired. Tiredness is a symptom of insufficient ideological commitment. Have you tried believing harder?',
    character: 'politruk',
  },
  {
    text: 'Your neighbor says you did not attend the voluntary meeting. The meeting was voluntary. Your attendance was not.',
    character: 'politruk',
  },
  {
    text: 'I am not here to threaten you. I am here to remind you that threats are unnecessary when cooperation is inevitable.',
    character: 'politruk',
  },
  {
    text: 'Your file is thin. A thin file is suspicious. A thick file is also suspicious. The ideal file thickness is classified.',
    character: 'politruk',
  },
  {
    text: 'The suggestion box has been installed. It is welded shut. Suggestions should be directed to the suggestion box. The system works.',
    character: 'politruk',
  },
  {
    text: 'You have been selected for a commendation. The commendation is: continued employment. Congratulations.',
    character: 'politruk',
  },
  // Critical threat
  {
    text: 'Loyalty is not something you have. It is something you demonstrate. Continuously. Starting now. I am watching.',
    character: 'politruk',
    conditions: { threatLevel: 'critical' },
  },
  // Starving
  {
    text: 'The ration reduction is temporary. Your hunger is temporary. Everything is temporary except the State.',
    character: 'politruk',
    conditions: { resourceLevel: 'starving' },
  },
  // Gorod
  {
    text: 'This city has grown. The Party takes credit. The workers take... continued employment. Everyone receives what they deserve.',
    character: 'politruk',
    conditions: { settlementTier: 'gorod' },
  },
];
