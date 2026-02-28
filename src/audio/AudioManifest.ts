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
  opts?: { volume?: number; loop?: boolean },
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
  track('soviet_anthem_1944', 'soviet_anthem_1944.ogg', '1944 Soviet National Anthem', 'triumphant', {
    volume: 0.6,
    loop: false,
  }),
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
  track('dorogi', 'dorogi.ogg', 'Roads - Wartime journey song', 'melancholic', { volume: 0.5 }),
  track('krasnoe_znamia', 'krasnoe_znamia.ogg', 'Red Banner - Revolutionary anthem', 'patriotic'),
  track('moskva_majskaia', 'moskva_majskaia.ogg', 'Moscow in May - Spring celebration', 'upbeat', { volume: 0.55 }),
  track('nash_parovoz', 'nash_parovoz.ogg', 'Our Locomotive - Industrial workers song', 'industrial', {
    volume: 0.55,
  }),
  track('orlionok', 'orlionok.ogg', 'Little Eagle - Civil war ballad', 'melancholic', { volume: 0.45 }),
  track('po_dolinam', 'po_dolinam.ogg', 'Through Valleys and Hills - Partisan march', 'intense', { volume: 0.6 }),
  track('rabochaia_marseleza', 'rabochaia_marseleza.ogg', 'Workers Marseillaise - Revolutionary', 'patriotic'),
  track('raskinulos_more', 'raskinulos_more.ogg', 'Sea Spread Wide - Sailors folk song', 'pastoral'),
  track('sacred_war', 'sacred_war.ogg', 'Sacred War - Great Patriotic War anthem', 'intense', { volume: 0.65 }),
  track('sinij_platochek', 'sinij_platochek.ogg', 'Blue Kerchief - Wartime love song', 'melancholic', {
    volume: 0.5,
  }),
  track('smelo_my_v_boj', 'smelo_my_v_boj.ogg', 'Boldly into Battle - Civil war march', 'intense', { volume: 0.6 }),
  track('smelo_tovarishchi', 'smelo_tovarishchi.ogg', 'Forward Comrades - Workers march', 'patriotic'),
  track('smuglianka', 'smuglianka.ogg', 'Smuglianka - Folk partisan romance', 'upbeat', { volume: 0.55 }),
  track('tam_vdali', 'tam_vdali.ogg', 'Far Away Beyond the River - Cossack ballad', 'pastoral', { volume: 0.45 }),

  // Republic anthems
  track('soviet_anthem_1977', 'soviet_anthem_1977.ogg', 'Soviet Anthem 1977', 'triumphant', { loop: false }),
  track('anthem_armenia', 'anthem_armenia.ogg', 'Armenian SSR Anthem', 'triumphant', { loop: false }),
  track('anthem_ukraine', 'anthem_ukraine.ogg', 'Ukrainian SSR Anthem', 'triumphant', { loop: false }),
  track('anthem_uzbekistan', 'anthem_uzbekistan.ogg', 'Uzbek SSR Anthem', 'triumphant', { loop: false }),
  track('anthem_azerbaijan', 'anthem_azerbaijan.ogg', 'Azerbaijani SSR Anthem', 'triumphant', { loop: false }),
  track('anthem_byelorussia', 'anthem_byelorussia.ogg', 'Byelorussian SSR Anthem', 'triumphant', { loop: false }),
  track('anthem_kazakhstan', 'anthem_kazakhstan.ogg', 'Kazakh SSR Anthem', 'triumphant', { loop: false }),
  track('anthem_kyrgyzstan', 'anthem_kyrgyzstan.ogg', 'Kirghiz SSR Anthem', 'triumphant', { loop: false }),
  track('anthem_latvia', 'anthem_latvia.ogg', 'Latvian SSR Anthem', 'triumphant', { loop: false }),
  track('anthem_lithuania', 'anthem_lithuania.ogg', 'Lithuanian SSR Anthem', 'triumphant', { loop: false }),
  track('anthem_moldova', 'anthem_moldova.ogg', 'Moldavian SSR Anthem', 'triumphant', { loop: false }),
  track('anthem_tajikistan', 'anthem_tajikistan.ogg', 'Tajik SSR Anthem', 'triumphant', { loop: false }),
  track('anthem_turkmenistan', 'anthem_turkmenistan.ogg', 'Turkmen SSR Anthem', 'triumphant', { loop: false }),
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
  'white_army_black_baron',
  'my_krasnye_soldaty',
  'nash_parovoz',
  'krasnoe_znamia',
  'moskva_majskaia',
  'smuglianka',
  'smelo_tovarishchi',
  'po_dolinam',
  'rabochaia_marseleza',
  'i_vnov_boj',
];

/** Mood-based selection for context-sensitive music */
export const MUSIC_CONTEXTS: Record<string, string> = {
  menu: 'soviet_anthem_1944',
  gameplay: 'internationale',
  victory: 'soviet_anthem_1944',
  triumphant: 'nesokrushimaia',
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
  winter: 'winter', // melancholic winter hardship
  rasputitsa_spring: 'melancholic', // mud season — bleak
  short_summer: 'upbeat', // brief warmth, hopeful
  golden_week: 'upbeat', // peak harvest, triumphant
  stifling_heat: 'industrial', // hot and dusty, labor
  early_frost: 'melancholic', // frost creeping in
  rasputitsa_autumn: 'melancholic', // mud returns, winter approaches
};

/**
 * Era → music context mapping.
 * Keys match the EraId values from game/era/types.ts.
 */
export const ERA_CONTEXTS: Record<string, string> = {
  war_communism: 'intense', // revolutionary upheaval, civil war
  first_plans: 'industrial', // rapid industrialization
  great_patriotic: 'intense', // wartime struggle
  reconstruction: 'melancholic', // rebuilding from ruins
  thaw: 'upbeat', // cultural relaxation, optimism
  stagnation: 'melancholic', // decline, disillusionment
  perestroika: 'upbeat', // reform and hope
  eternal_soviet: 'triumphant', // utopian endgame — fixed from 'victory' (nonexistent context)
};

export function getTrack(id: string): MusicTrack | undefined {
  return MUSIC_TRACKS.find((t) => t.id === id);
}

export function getTracksByMood(mood: MusicTrack['mood']): MusicTrack[] {
  return MUSIC_TRACKS.filter((t) => t.mood === mood);
}
