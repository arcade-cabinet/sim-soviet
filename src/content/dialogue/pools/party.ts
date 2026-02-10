import type { DialogueLine } from '../types';

export const PARTY_OFFICIAL_LINES: DialogueLine[] = [
  {
    text: 'The shortage is temporary. The explanation for the shortage is permanent.',
    character: 'party_official',
  },
  {
    text: 'Production exceeded targets by 200%. The targets were set at 50% of last year. This is called growth.',
    character: 'party_official',
  },
  {
    text: 'I take full credit for this success. The previous failure belonged to my predecessor. He has been reassigned. To agriculture. In January.',
    character: 'party_official',
  },
  {
    text: 'The people are satisfied. I have the surveys to prove it. The surveys had one answer option. The people chose wisely.',
    character: 'party_official',
  },
  {
    text: 'There is no crisis. What you see is a planned transition from adequate to... differently adequate.',
    character: 'party_official',
  },
  {
    text: 'The budget shortfall is not a shortfall. It is an opportunity for citizens to demonstrate self-sufficiency. You are welcome.',
    character: 'party_official',
  },
  {
    text: 'I have reorganized the department. The department is now three departments. Each department blames the other two. Efficiency.',
    character: 'party_official',
  },
  {
    text: 'The Five-Year Plan will be completed in seven years. This is ahead of the revised schedule.',
    character: 'party_official',
  },
  {
    text: 'My office has a window. Your office does not. This reflects our respective contributions to the State. The State agrees.',
    character: 'party_official',
  },
  {
    text: 'We have formed a committee to investigate the committee that was investigating the original committee. Progress is being made.',
    character: 'party_official',
  },
  {
    text: 'The power outage was scheduled. It was scheduled retroactively, which is the most efficient form of scheduling.',
    character: 'party_official',
  },
  {
    text: 'Comrades, I bring good news and better news. The good news: there is better news. The better news: the good news.',
    character: 'party_official',
  },
  {
    text: 'Statistics show improvement in every metric. I chose the metrics. I am very good at choosing metrics.',
    character: 'party_official',
  },
  // Starving
  {
    text: 'The food situation is complex. The explanation is simple: it is not my department. Speak to the Ministry of Not My Department.',
    character: 'party_official',
    conditions: { resourceLevel: 'starving' },
  },
  // Surplus
  {
    text: 'The surplus is a direct result of my policies. The previous deficit was weather. The weather has been disciplined.',
    character: 'party_official',
    conditions: { resourceLevel: 'surplus' },
  },
  // Gorod
  {
    text: 'This city has become a model for the entire Union. Other cities aspire to our level of concrete.',
    character: 'party_official',
    conditions: { settlementTier: 'gorod' },
  },
];
