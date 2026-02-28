import type { DialogueLine } from '../types';

export const WORKER_LINES: DialogueLine[] = [
  // Universal
  {
    text: 'The concrete mix is 40% sand. The report says 0% sand. The sand says nothing.',
    character: 'worker',
  },
  {
    text: 'They gave us new shovels. The old shovels had handles. These are improvements.',
    character: 'worker',
  },
  {
    text: 'My shift ended six hours ago. Nobody told the shift.',
    character: 'worker',
  },
  {
    text: 'I asked for a raise. They raised my quota instead. I should not have asked.',
    character: 'worker',
  },
  {
    text: 'We built this wall in two days. It will stand for two days. Then we build it again. This is called employment.',
    character: 'worker',
  },
  {
    text: 'Petrov fell into the foundation pit. They poured concrete anyway. He is now load-bearing.',
    character: 'worker',
  },
  {
    text: 'The safety inspector came. He inspected. He left. Nothing changed. The inspection was successful.',
    character: 'worker',
  },
  {
    text: 'I have been Employee of the Month for eleven months. The award is: more work.',
    character: 'worker',
  },
  {
    text: 'They say we are building socialism. I cannot see it from down here. But I keep digging.',
    character: 'worker',
  },
  {
    text: 'The foreman says morale is high. The foreman has a different lunch.',
    character: 'worker',
  },
  {
    text: 'I used to be an engineer. Then they found out I could also carry bricks. Now I carry bricks.',
    character: 'worker',
  },
  {
    text: 'My boots have holes. My socks have holes. My feet have adapted. Darwin was right about something.',
    character: 'worker',
  },
  {
    text: 'They printed our names on the Honor Board. The board fell off the wall. We nailed it back up. This counts as two achievements.',
    character: 'worker',
  },
  // Winter-specific
  {
    text: 'The thermometer broke at minus forty. We are now beyond measurement. Beyond measurement is where I live.',
    character: 'worker',
    conditions: { season: 'winter' },
  },
  {
    text: 'My fingers stopped hurting an hour ago. The doctor says this is not a good sign. I disagree. No pain is always good.',
    character: 'worker',
    conditions: { season: 'winter' },
  },
  {
    text: 'The concrete froze before we could pour it. We poured it anyway. It is now a monument to optimism.',
    character: 'worker',
    conditions: { season: 'winter' },
  },
  // Summer-specific
  {
    text: 'The sun came out. We are suspicious. The last time the sun came out, they extended our shift by three hours.',
    character: 'worker',
    conditions: { season: 'summer' },
  },
  // Mud season
  {
    text: 'The road to the worksite is now a river. We swim to work. This is called infrastructure.',
    character: 'worker',
    conditions: { season: 'mud' },
  },
  // Starving
  {
    text: 'Lunch today was a memory of lunch yesterday. Yesterday there was no lunch. The memory was short.',
    character: 'worker',
    conditions: { resourceLevel: 'starving' },
  },
  {
    text: 'I ate my belt last week. My pants fall down now. But I am no longer hungry. Trade-offs.',
    character: 'worker',
    conditions: { resourceLevel: 'starving' },
  },
  // High threat
  {
    text: 'I smile at work now. Not because I am happy. Because Sergei did not smile, and Sergei is gone.',
    character: 'worker',
    conditions: { threatLevel: 'endangered' },
  },
  {
    text: 'We do not complain. Complaining requires witnesses. Witnesses require trust. Trust requires... I forget what trust requires.',
    character: 'worker',
    conditions: { threatLevel: 'watched' },
  },
];
