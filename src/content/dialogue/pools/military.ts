import type { DialogueLine } from '../types';

export const MILITARY_LINES: DialogueLine[] = [
  {
    text: 'The Motherland needs you. Not you specifically. But someone shaped like you.',
    character: 'military',
  },
  {
    text: 'You have been volunteered. The paperwork is already signed. Your signature was not required. Or possible.',
    character: 'military',
  },
  {
    text: 'The parade is at 0600. Your uniform is at the quartermaster. The quartermaster is at a location. Report to the location.',
    character: 'military',
  },
  {
    text: 'Soldiers do not complain. Soldiers endure. If you are complaining, you are not yet a soldier. We can fix that.',
    character: 'military',
  },
  {
    text: 'The exercise will last four hours. Or until morale improves. We have never seen morale improve. The exercise continues.',
    character: 'military',
  },
  {
    text: 'Your rifle is older than you. Treat it with respect. It has outlasted three previous owners. Do not ask what happened to them.',
    character: 'military',
  },
  {
    text: 'The rations are adequate. If they are not adequate, you are eating too slowly. Eat faster. Problem solved.',
    character: 'military',
  },
  {
    text: 'Retreat is not in our vocabulary. Neither is "lunch break." Or "overtime pay." Our vocabulary is efficient.',
    character: 'military',
  },
  {
    text: 'The border must be defended. From what, you ask? From questions like that. You have answered your own question.',
    character: 'military',
  },
  {
    text: 'You will march until your feet hurt. Then you will march until they stop hurting. The second part takes longer.',
    character: 'military',
  },
  // Winter
  {
    text: 'The cold builds character. You will have more character than you can carry by morning. That is an order.',
    character: 'military',
    conditions: { season: 'winter' },
  },
  // Endangered/Critical
  {
    text: 'The threat level has increased. Your leave has been cancelled. Your leave was never approved. This changes nothing.',
    character: 'military',
    conditions: { threatLevel: 'endangered' },
  },
];
