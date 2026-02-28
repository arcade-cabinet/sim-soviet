/**
 * Audio manifest — adapted from archive for React Native / BabylonJS.
 *
 * All music files live in assets/audio/music/ as OGG/Opus.
 * SFX are procedural via BabylonJS sound generation.
 *
 * Sources: marxists.org (public domain Soviet-era recordings).
 */

export interface MusicTrack {
  id: string;
  filename: string;
  description: string;
  mood: 'triumphant' | 'melancholic' | 'industrial' | 'upbeat' | 'intense' | 'pastoral' | 'patriotic';
  volume: number;
  loop: boolean;
}

function track(
  id: string,
  filename: string,
  description: string,
  mood: MusicTrack['mood'],
  opts?: { volume?: number; loop?: boolean }
): MusicTrack {
  return {
    id,
    filename,
    description,
    mood,
    volume: opts?.volume ?? 0.5,
    loop: opts?.loop ?? true,
  };
}

export const MUSIC_TRACKS: MusicTrack[] = [
  // Core rotation
  track('soviet_anthem_1944', 'soviet_anthem_1944.ogg', '1944 Soviet National Anthem', 'triumphant', { volume: 0.6, loop: false }),
  track('internationale', 'internationale.ogg', 'The Internationale', 'patriotic'),
  track('red_army_march', 'red_army_march.ogg', 'Konarmeiskij March', 'intense', { volume: 0.6 }),
  track('tachanka', 'tachanka.ogg', 'Tachanka - Folk-military', 'upbeat', { volume: 0.55 }),
  track('varshavjanka', 'varshavjanka.ogg', 'Varshavjanka', 'patriotic'),
  track('katyusha', 'katyusha.ogg', 'Katyusha', 'upbeat', { volume: 0.55 }),
  track('dubinushka', 'dubinushka.ogg', 'Dubinushka - Workers labor', 'industrial', { volume: 0.55 }),

  // Military/Patriotic
  track('white_army_black_baron', 'white_army_black_baron.ogg', 'White Army, Black Baron', 'patriotic'),
  track('marsh_zashchitnikov', 'marsh_zashchitnikov.ogg', 'March of Moscow Defenders', 'intense'),
  track('esli_zavtra_vojna', 'esli_zavtra_vojna.ogg', 'If Tomorrow Brings War', 'intense'),
  track('nesokrushimaia', 'nesokrushimaia.ogg', 'Invincible and Legendary', 'triumphant'),
  track('my_krasnye_soldaty', 'my_krasnye_soldaty.ogg', 'We the Red Soldiers', 'patriotic'),

  // Melancholic/Atmospheric
  track('v_zemlianke', 'v_zemlianke.ogg', 'In the Blindage - Winter hardship', 'melancholic', { volume: 0.45 }),

  // Youth/Culture
  track('glavnoe_rebiata', 'glavnoe_rebiata.ogg', "Don't Grow Old in Heart", 'upbeat'),
  track('i_vnov_boj', 'i_vnov_boj.ogg', 'The Battle Continues', 'patriotic'),

  // Scenic/Folk
  track('slavnoe_more', 'slavnoe_more.ogg', 'Glorious Sea, Sacred Baikal', 'pastoral'),
  track('pod_zvezdami', 'pod_zvezdami.ogg', 'Under Balkan Stars', 'melancholic'),
  track('pa_moriam', 'pa_moriam.ogg', 'By Seas, By Waves', 'pastoral'),
  track('pesnia_o_shchorse', 'pesnia_o_shchorse.ogg', "Shchors' Song", 'patriotic'),
  track('vy_zhertvoiu', 'vy_zhertvoiu.ogg', 'You Fell as Victims', 'melancholic'),

  // Republic anthems
  track('soviet_anthem_1977', 'soviet_anthem_1977.ogg', 'Soviet Anthem 1977', 'triumphant', { loop: false }),
  track('anthem_armenia', 'anthem_armenia.ogg', 'Armenian SSR Anthem', 'triumphant', { loop: false }),
  track('anthem_ukraine', 'anthem_ukraine.ogg', 'Ukrainian SSR Anthem', 'triumphant', { loop: false }),
  track('anthem_uzbekistan', 'anthem_uzbekistan.ogg', 'Uzbek SSR Anthem', 'triumphant', { loop: false }),
];

/** Gameplay rotation — shuffled during play */
export const GAMEPLAY_PLAYLIST: string[] = [
  'internationale',
  'varshavjanka',
  'red_army_march',
  'tachanka',
  'katyusha',
  'dubinushka',
  'glavnoe_rebiata',
];

/** Mood-based selection for context-sensitive music */
export const MUSIC_CONTEXTS: Record<string, string> = {
  menu: 'soviet_anthem_1944',
  gameplay: 'internationale',
  victory: 'soviet_anthem_1944',
  intense: 'esli_zavtra_vojna',
  upbeat: 'tachanka',
  melancholic: 'v_zemlianke',
  winter: 'v_zemlianke',
  industrial: 'dubinushka',
};

/**
 * Season → music context mapping.
 * Keys match the Season enum values from game/Chronology.ts.
 * Falls back to 'gameplay' if a season has no specific context.
 */
export const SEASON_CONTEXTS: Record<string, string> = {
  winter: 'winter',               // melancholic winter hardship
  rasputitsa_spring: 'melancholic', // mud season — bleak
  short_summer: 'upbeat',          // brief warmth, hopeful
  golden_week: 'upbeat',           // peak harvest, triumphant
  stifling_heat: 'industrial',     // hot and dusty, labor
  early_frost: 'melancholic',      // frost creeping in
  rasputitsa_autumn: 'melancholic', // mud returns, winter approaches
};

export function getTrack(id: string): MusicTrack | undefined {
  return MUSIC_TRACKS.find((t) => t.id === id);
}

export function getTracksByMood(mood: MusicTrack['mood']): MusicTrack[] {
  return MUSIC_TRACKS.filter((t) => t.mood === mood);
}
