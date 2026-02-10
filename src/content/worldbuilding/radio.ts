import { pick } from './_rng';
import type { RadioAnnouncement, RadioCategory } from './types';

export const RADIO_ANNOUNCEMENTS: RadioAnnouncement[] = [
  // -- Morning ---
  {
    text: "Good morning, workers. Today's mandatory emotion is: grateful.",
    category: 'morning',
  },
  {
    text: 'Rise and shine, comrades. The sun has been authorized to appear today. If it does not, the Ministry of Weather will be held accountable.',
    category: 'morning',
  },
  {
    text: 'Good morning. Your daily productivity target has been increased by 15%. Your daily caloric intake has been decreased by 15%. These are unrelated.',
    category: 'morning',
  },
  {
    text: 'It is 6:00 AM. You are now awake. If you were already awake, you were awake incorrectly. The correct time to be awake is now.',
    category: 'morning',
  },
  {
    text: 'Citizens, the bread ration for today is: bread-adjacent. Please form an orderly queue at Distribution Point 7. Distribution Point 7 is currently being repurposed. Please queue at the queue.',
    category: 'morning',
  },

  // -- Shift Changes ---
  {
    text: 'Second shift begins. First shift may now experience exhaustion.',
    category: 'shift_change',
  },
  {
    text: 'Attention: shift change in progress. Workers are reminded that fatigue is a bourgeois concept. Soviet workers feel only purpose.',
    category: 'shift_change',
  },
  {
    text: 'Night shift workers: the darkness is a feature, not a deficiency. Work by the light of your ideological conviction.',
    category: 'shift_change',
  },
  {
    text: 'Third shift begins. Second shift may now sleep. First shift may now remember what sleep was.',
    category: 'shift_change',
  },

  // -- Weather ---
  {
    text: "The weather today is: Soviet. Tomorrow's weather has been approved by committee.",
    category: 'weather',
  },
  {
    text: 'Weather report: it is cold. It will continue to be cold. Warmth has been scheduled for the Third Five-Year Plan.',
    category: 'weather',
  },
  {
    text: 'Today: grey. Tonight: darker grey. Tomorrow: the same grey, but from a different angle. Extended forecast: grey.',
    category: 'weather',
  },
  {
    text: 'A mild breeze is expected from the West. Citizens are reminded that nothing good comes from the West, including breezes.',
    category: 'weather',
  },
  {
    text: 'Snow is falling. This is scheduled snow. Unscheduled snow will be reported to the meteorological authorities.',
    category: 'weather',
  },

  // -- Breaking News ---
  {
    text: 'Breaking news: there is no news. The absence of news is the news. You may return to your productive activities.',
    category: 'breaking',
  },
  {
    text: 'Urgent bulletin: a citizen reported seeing a color other than grey. Investigation pending. Citizens are advised to see only approved colors.',
    category: 'breaking',
  },
  {
    text: 'Alert: the queue at Distribution Point 3 has exceeded its approved length. Surplus queuers will be redistributed to Distribution Point 4. Distribution Point 4 does not exist yet. Please wait.',
    category: 'breaking',
  },
  {
    text: 'Breaking: a building has been completed on schedule. Engineers are being investigated for suspicious competence.',
    category: 'breaking',
  },

  // -- Propaganda ---
  {
    text: 'Remember, comrade: the State provides everything you need. If you need something the State does not provide, you do not need it.',
    category: 'propaganda',
  },
  {
    text: 'Happiness is not a right. It is a privilege distributed by the Party. Current distribution schedule: pending.',
    category: 'propaganda',
  },
  {
    text: 'A reminder: the West does not exist. What you see on the horizon is a mirage caused by superior Soviet atmospheric conditions.',
    category: 'propaganda',
  },
  {
    text: 'Production is up. Morale is up. Everything is up. Do not look down. There is nothing down there. Looking down is not approved.',
    category: 'propaganda',
  },
  {
    text: 'Comrades, the Plan is working. You are part of the Plan. If you feel the Plan is not working, the part that is not working is you.',
    category: 'propaganda',
  },

  // -- Music Intros ---
  {
    text: 'And now, the anthem. Again. You know the words. The words know you.',
    category: 'music_intro',
  },
  {
    text: 'The following musical selection has been approved by the Committee for Acceptable Sounds. Enjoy it the pre-determined amount.',
    category: 'music_intro',
  },
  {
    text: "Up next: the People's Orchestra performing 'Ode to Concrete, Movement 47.' Please remain seated. The seats have been removed. Please remain standing.",
    category: 'music_intro',
  },
  {
    text: "This concludes today's musical programming. Tomorrow's programming will be identical. This is not a lack of variety. It is consistency.",
    category: 'music_intro',
  },

  // -- Public Service ---
  {
    text: 'Public service announcement: if you see something, say nothing. If you hear something, you heard nothing. If you feel something, consult the approved list of feelings.',
    category: 'public_service',
  },
  {
    text: 'Citizens are reminded: the walls have ears. The floors have eyes. The ceiling has opinions. Behave accordingly.',
    category: 'public_service',
  },
  {
    text: 'Fire safety reminder: in the event of a fire, proceed to the nearest exit. If the exit is also on fire, this is a scheduled drill. Remain calm. Remaining calm is mandatory.',
    category: 'public_service',
  },
  {
    text: 'Lost and found update: nothing has been lost. Several things have been found that were not supposed to exist. They have been unfound.',
    category: 'public_service',
  },
  {
    text: 'A reminder to all citizens: your neighbor is your comrade. Your comrade is your friend. Your friend is required to report your activities. Friendship is beautiful.',
    category: 'public_service',
  },

  // -- Evening ---
  {
    text: "The workday is over. You may now experience leisure. Approved leisure activities include: sitting, standing, and thinking about tomorrow's labor.",
    category: 'evening',
  },
  {
    text: 'Good night, comrades. Tomorrow will be better. If today was already perfect, tomorrow will be equally perfect. Perfection is stable.',
    category: 'evening',
  },
  {
    text: 'Curfew begins in 30 minutes. Citizens found outdoors after curfew will be assumed to be volunteering for the night construction brigade.',
    category: 'evening',
  },
  {
    text: 'This is the final broadcast of the day. The static you hear between stations is not loneliness. It is the sound of the State thinking.',
    category: 'evening',
  },
];

/** Returns a random radio announcement, optionally filtered by category. */
export function getRandomAnnouncement(category?: RadioCategory): RadioAnnouncement {
  if (category) {
    const filtered = RADIO_ANNOUNCEMENTS.filter((a) => a.category === category);
    return filtered.length > 0 ? pick(filtered) : pick(RADIO_ANNOUNCEMENTS);
  }
  return pick(RADIO_ANNOUNCEMENTS);
}
