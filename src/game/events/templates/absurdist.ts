import type { EventTemplate } from '../types';

export const ABSURDIST_EVENTS: EventTemplate[] = [
  {
    id: 'nothing_happened',
    title: 'DAILY REPORT',
    description:
      'Nothing happened today. Report filed. Report lost. Report about lost report filed. That report also lost. System working as intended.',
    pravdaHeadline: 'STABILITY CONTINUES',
    category: 'absurdist',
    severity: 'trivial',
    effects: {},
  },
  {
    id: 'opinion_corrected',
    title: 'THOUGHT CRIME BULLETIN',
    description:
      'A citizen had an opinion. It has been corrected. The citizen thanks the State for the correction. The gratitude has also been corrected.',
    pravdaHeadline: 'MENTAL HEALTH SERVICES PROVE EFFECTIVE',
    category: 'absurdist',
    severity: 'trivial',
    effects: { pop: -1 },
    condition: (gs) => gs.pop > 3,
    weight: 0.5,
  },
  {
    id: 'grey_weather',
    title: 'METEOROLOGICAL UPDATE',
    description:
      'The weather is grey. This is not news. It has always been grey. The color grey has filed a formal complaint. The complaint is also grey.',
    pravdaHeadline: 'WEATHER REMAINS CONSISTENT WITH FIVE-YEAR WEATHER PLAN',
    category: 'absurdist',
    severity: 'trivial',
    effects: {},
  },
  {
    id: 'someone_smiled',
    title: 'SECURITY ALERT',
    description:
      'Someone smiled. Investigation underway. Witnesses report the smile lasted approximately 0.3 seconds before being replaced by the standard expression.',
    pravdaHeadline: 'SECURITY FORCES RESPOND SWIFTLY TO ANOMALY',
    category: 'absurdist',
    severity: 'trivial',
    effects: {},
  },
  {
    id: 'clock_wrong',
    title: 'TEMPORAL ANOMALY',
    description:
      'The town clock is 3 hours wrong. No one noticed for 2 weeks. Work schedules have been adjusted. The clock has been awarded for creativity.',
    pravdaHeadline: 'INNOVATIVE TIMEKEEPING SYSTEM ADOPTED',
    category: 'absurdist',
    severity: 'trivial',
    effects: {},
  },
  {
    id: 'bird_arrested',
    title: 'WILDLIFE ENFORCEMENT',
    description:
      'A pigeon was arrested for loitering near the Party headquarters. Trial date: pending. The pigeon has been assigned a lawyer. The lawyer is also a pigeon.',
    pravdaHeadline: 'LAW AND ORDER MAINTAINED AT ALL LEVELS OF SOCIETY',
    category: 'absurdist',
    severity: 'trivial',
    effects: { money: -2 },
  },
  {
    id: 'mystery_building',
    title: 'ARCHITECTURAL DISCOVERY',
    description:
      'A building was discovered that no one remembers constructing. It has 4 floors, no doors, and is full of filing cabinets. It has been designated as the new post office.',
    pravdaHeadline: 'MODERN POST OFFICE OPENS TO PUBLIC ACCLAIM',
    category: 'absurdist',
    severity: 'trivial',
    effects: { money: -10 },
  },
  {
    id: 'queue_sentient',
    title: 'SOCIOLOGICAL PHENOMENON',
    description: (gs) =>
      `The queue outside the bread shop has become self-aware. It now has ${Math.max(1, Math.floor(gs.pop / 4))} members and a chairman. It demands recognition as a legal entity.`,
    pravdaHeadline: 'CITIZENS FORM VIBRANT NEW SOCIAL ORGANIZATION',
    category: 'absurdist',
    severity: 'trivial',
    effects: { food: -3 },
    condition: (gs) => gs.pop > 5,
  },
  {
    id: 'map_wrong',
    title: 'CARTOGRAPHIC REVISION',
    description:
      'Official map updated. Your city is no longer on it. This is not considered a problem because the map is always correct. You, however, may need to reconsider your existence.',
    pravdaHeadline: 'NEW MAPS REFLECT LATEST GEOGRAPHIC REALITY',
    category: 'absurdist',
    severity: 'minor',
    effects: { money: -5 },
  },
  {
    id: 'dog_promoted',
    title: 'PERSONNEL CHANGE',
    description:
      'Comrade Dog has been promoted to Assistant Regional Director. His qualifications: loyalty, punctuality, and not asking questions. A model employee.',
    pravdaHeadline: 'MERITOCRACY IN ACTION: DEDICATED WORKER PROMOTED',
    category: 'absurdist',
    severity: 'trivial',
    effects: {},
  },
  {
    id: 'concrete_shortage',
    title: 'MATERIALS REPORT',
    description:
      'Concrete shortage reported. Ironic, given that everything is made of concrete. Investigation reveals: concrete made of other, smaller concrete. It is concrete all the way down.',
    pravdaHeadline: 'CONSTRUCTION MATERIALS UNDERGO QUALITY REVIEW',
    category: 'absurdist',
    severity: 'minor',
    effects: { money: -15 },
  },
  {
    id: 'telephone_works',
    title: 'COMMUNICATIONS MIRACLE',
    description:
      'A telephone worked on the first try. Citizens gathered to witness the miracle. A plaque will be installed. The plaque has been ordered. Estimated arrival: 1997.',
    pravdaHeadline: 'TELECOMMUNICATIONS INFRASTRUCTURE RATED WORLD-CLASS',
    category: 'absurdist',
    severity: 'trivial',
    effects: {},
  },
  {
    id: 'existential_dread',
    title: 'PHILOSOPHICAL EMERGENCY',
    description:
      'Citizens experience collective existential dread. State psychiatrist diagnoses: "normal." Prescribes: vodka. Vodka supply: low. Dread supply: unlimited.',
    pravdaHeadline: 'DEEP THINKERS SHOWCASE SOVIET INTELLECTUAL TRADITION',
    category: 'absurdist',
    severity: 'minor',
    effects: { vodka: -8 },
    condition: (gs) => gs.vodka > 5,
  },
];
