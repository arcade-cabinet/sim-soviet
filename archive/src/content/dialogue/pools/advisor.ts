import type { DialogueLine } from '../types';

export const ADVISOR_LINES: DialogueLine[] = [
  // Universal wisdom
  {
    text: "I have seen twelve Five-Year Plans. None lasted five years. Some didn't last five weeks.",
    character: 'advisor',
  },
  {
    text: 'Build the coal plant first. Not because it is efficient. Because everything else requires power, and nothing here generates hope.',
    character: 'advisor',
  },
  {
    text: 'You want my advice? Survive. That is the entire strategy. Everything else is decoration on a bunker.',
    character: 'advisor',
  },
  {
    text: 'The quota will never be enough. They raise it when you meet it. They punish you when you do not. Play the middle. Always the middle.',
    character: 'advisor',
  },
  {
    text: 'Every leader before you had a plan. Every plan before yours failed. This is not discouragement. This is calibration.',
    character: 'advisor',
  },
  {
    text: 'I have buried four predecessors of yours. Figuratively, for three of them.',
    character: 'advisor',
  },
  {
    text: 'Build the vodka plant. The people need it. I need it. The concrete needs it. Nothing here works sober.',
    character: 'advisor',
  },
  {
    text: 'Do not trust the statistics. I wrote them. I wrote them with a pencil because the ink was requisitioned. The pencil was also requisitioned. I wrote them from memory.',
    character: 'advisor',
  },
  {
    text: 'The Politburo will send someone to inspect. Smile. Agree. Nod. Hide the actual numbers. This is governance.',
    character: 'advisor',
  },
  {
    text: 'You remind me of the last one. Bright eyes. Big ideas. The eyes dimmed. The ideas shrank. You will be fine. Probably.',
    character: 'advisor',
  },
  {
    text: 'Corruption is the grease that keeps this machine running. I am not endorsing it. I am describing the machine.',
    character: 'advisor',
  },
  {
    text: 'I stopped being surprised in 1974. Now I am only occasionally disappointed. This is what they call wisdom.',
    character: 'advisor',
  },
  {
    text: 'Feed the people. Not because you are kind. Because hungry people remember who did not feed them. They remember very clearly.',
    character: 'advisor',
  },
  {
    text: 'The KGB man smiles at you. Do not smile back. Do not not smile back. Exist near him with carefully calibrated neutrality.',
    character: 'advisor',
  },
  {
    text: 'I have a bottle in my desk. It is for emergencies. Every day is an emergency. The bottle is always empty.',
    character: 'advisor',
  },
  // Winter
  {
    text: 'Winter is when the real governing happens. Anyone still here in February actually lives here. In July, they are all tourists.',
    character: 'advisor',
    conditions: { season: 'winter' },
  },
  {
    text: 'The pipes will freeze. They always freeze. Budget for frozen pipes. Budget for the committee that will investigate the frozen pipes. Budget for the report.',
    character: 'advisor',
    conditions: { season: 'winter' },
  },
  // Summer
  {
    text: 'Summer. The three weeks where people believe things might improve. Enjoy it. Reality returns with the mud.',
    character: 'advisor',
    conditions: { season: 'summer' },
  },
  // Mud
  {
    text: 'Rasputitsa. The mud season. When even the tanks cannot move. I find it the most honest time of year. Everything stops pretending.',
    character: 'advisor',
    conditions: { season: 'mud' },
  },
  // Starving
  {
    text: 'When the people are starving, they look at you. Not at the State. Not at the Party. At you. I hope you have an answer. I never did.',
    character: 'advisor',
    conditions: { resourceLevel: 'starving' },
  },
  {
    text: 'The granary is empty. The report says it is full. The people can tell the difference, even if Moscow cannot.',
    character: 'advisor',
    conditions: { resourceLevel: 'starving' },
  },
  // Surplus
  {
    text: 'A surplus. Enjoy it quietly. If Moscow hears, they will raise the delivery quota until the surplus becomes a deficit. They always do.',
    character: 'advisor',
    conditions: { resourceLevel: 'surplus' },
  },
  // Critical threat
  {
    text: 'Your name is on a list. Everyone is on a list. The question is which list. I suggest you remain useful.',
    character: 'advisor',
    conditions: { threatLevel: 'critical' },
  },
  // Endangered
  {
    text: 'Be careful. Not in general. Right now. Specifically now. Someone is watching who was not watching yesterday.',
    character: 'advisor',
    conditions: { threatLevel: 'endangered' },
  },
  // Selo
  {
    text: 'A village. They all start as villages. The ones that survive become towns. The ones that thrive become targets. Grow carefully.',
    character: 'advisor',
    conditions: { settlementTier: 'selo' },
  },
];
