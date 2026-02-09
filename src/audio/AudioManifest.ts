/**
 * Audio Asset Manifest for SimSoviet 2000
 * Defines all audio tracks and their properties
 *
 * Sources: marxists.org (public domain Soviet-era recordings)
 * Format: OGG/Opus (converted from MP3 via scripts/download-audio.sh)
 */

export interface AudioAsset {
  id: string;
  category: 'music' | 'sfx' | 'ambient' | 'voice';
  url: string;
  volume: number;
  loop: boolean;
  preload: boolean;
  description: string;
  source?: string;
  license?: string;
  /** Game context hint for dynamic music selection */
  mood?:
    | 'triumphant'
    | 'melancholic'
    | 'industrial'
    | 'upbeat'
    | 'intense'
    | 'pastoral'
    | 'patriotic';
}

const PD = { source: 'marxists.org', license: 'Public Domain' } as const;

function track(
  id: string,
  url: string,
  description: string,
  mood: AudioAsset['mood'],
  opts?: { volume?: number; loop?: boolean; preload?: boolean }
): AudioAsset {
  return {
    id,
    category: 'music',
    url: `/audio/music/${url}`,
    volume: opts?.volume ?? 0.5,
    loop: opts?.loop ?? true,
    preload: opts?.preload ?? false,
    description,
    mood,
    ...PD,
  };
}

export const AUDIO_MANIFEST: AudioAsset[] = [
  // ===== ESSENTIAL MUSIC (preloaded or core rotation) =====
  track(
    'soviet_anthem_1944',
    'soviet_anthem_1944.ogg',
    '1944 Soviet National Anthem',
    'triumphant',
    { volume: 0.6, loop: false, preload: true }
  ),
  track('internationale', 'internationale.ogg', 'The Internationale', 'patriotic', {
    volume: 0.5,
    preload: true,
  }),
  track('red_army_march', 'red_army_march.ogg', 'Konarmeiskij March', 'intense', { volume: 0.6 }),
  track('sacred_war', 'sacred_war.ogg', 'Sacred War (Sviashchennaia Vojna)', 'intense', {
    volume: 0.65,
  }),
  track('tachanka', 'tachanka.ogg', 'Tachanka - Folk-military', 'upbeat', { volume: 0.55 }),
  track('varshavjanka', 'varshavjanka.ogg', "Varshavjanka - Warsaw Worker's Song", 'patriotic'),
  track('katyusha', 'katyusha.ogg', 'Katyusha - Iconic wartime song', 'upbeat', { volume: 0.55 }),
  track('moskva_majskaia', 'moskva_majskaia.ogg', 'Moscow in May - Optimistic', 'upbeat', {
    volume: 0.5,
  }),
  track('nash_parovoz', 'nash_parovoz.ogg', 'Our Locomotive - Industrial/trains', 'industrial'),
  track('dubinushka', 'dubinushka.ogg', 'Dubinushka - Workers labor song', 'industrial', {
    volume: 0.55,
  }),

  // ===== EXTENDED: Military/Patriotic =====
  track(
    'white_army_black_baron',
    'white_army_black_baron.ogg',
    'White Army, Black Baron',
    'patriotic'
  ),
  track('smelo_my_v_boj', 'smelo_my_v_boj.ogg', 'Boldly Into Battle', 'intense'),
  track('marsh_zashchitnikov', 'marsh_zashchitnikov.ogg', 'March of Moscow Defenders', 'intense'),
  track('esli_zavtra_vojna', 'esli_zavtra_vojna.ogg', 'If Tomorrow Brings War', 'intense'),
  track('nesokrushimaia', 'nesokrushimaia.ogg', 'Invincible and Legendary', 'triumphant'),
  track('krasnoe_znamia', 'krasnoe_znamia.ogg', 'Red Flag', 'patriotic'),
  track('smelo_tovarishchi', 'smelo_tovarishchi.ogg', 'Boldly, Comrades, In Step', 'patriotic'),
  track('my_krasnye_soldaty', 'my_krasnye_soldaty.ogg', 'We the Red Soldiers', 'patriotic'),

  // ===== EXTENDED: Melancholic/Atmospheric =====
  track('v_zemlianke', 'v_zemlianke.ogg', 'In the Blindage - Winter hardship', 'melancholic', {
    volume: 0.45,
  }),
  track('dorogi', 'dorogi.ogg', 'Oh, Roads - Desolation', 'melancholic', { volume: 0.45 }),
  track('sinij_platochek', 'sinij_platochek.ogg', 'Blue Headkerchief - Nostalgia', 'melancholic', {
    volume: 0.45,
  }),
  track('smuglianka', 'smuglianka.ogg', 'Dark Girl - Lighter moments', 'upbeat'),

  // ===== EXTENDED: Youth/Culture =====
  track('orlionok', 'orlionok.ogg', 'Eaglet - Young Pioneers', 'pastoral'),
  track('glavnoe_rebiata', 'glavnoe_rebiata.ogg', "Don't Grow Old in Heart - Komsomol", 'upbeat'),
  track('i_vnov_boj', 'i_vnov_boj.ogg', 'The Battle Continues - Brezhnev era', 'patriotic'),
  track('rabochaia_marseleza', 'rabochaia_marseleza.ogg', "Workers' Marseillaise", 'patriotic'),

  // ===== EXTENDED: Scenic/Folk =====
  track('slavnoe_more', 'slavnoe_more.ogg', 'Glorious Sea, Sacred Baikal', 'pastoral'),
  track('po_dolinam', 'po_dolinam.ogg', 'Through Valleys and Hills', 'pastoral'),
  track('tam_vdali', 'tam_vdali.ogg', 'Beyond the River', 'melancholic'),
  track('pod_zvezdami', 'pod_zvezdami.ogg', 'Under Balkan Stars', 'melancholic'),
  track('pa_moriam', 'pa_moriam.ogg', 'By Seas, By Waves', 'pastoral'),
  track('pesnia_o_shchorse', 'pesnia_o_shchorse.ogg', "Shchors' Song - Hero", 'patriotic'),
  track('vy_zhertvoiu', 'vy_zhertvoiu.ogg', 'You Fell as Victims', 'melancholic'),
  track('raskinulos_more', 'raskinulos_more.ogg', 'The Wide Sea', 'pastoral'),

  // ===== REPUBLIC ANTHEMS (for SSR mechanics) =====
  track(
    'soviet_anthem_1977',
    'soviet_anthem_1977.ogg',
    'Soviet Anthem - 1977 version',
    'triumphant',
    { loop: false }
  ),
  track('anthem_armenia', 'anthem_armenia.ogg', 'Armenian SSR Anthem', 'triumphant', {
    loop: false,
  }),
  track('anthem_azerbaijan', 'anthem_azerbaijan.ogg', 'Azerbaijan SSR Anthem', 'triumphant', {
    loop: false,
  }),
  track('anthem_byelorussia', 'anthem_byelorussia.ogg', 'Byelorussian SSR Anthem', 'triumphant', {
    loop: false,
  }),
  track('anthem_kazakhstan', 'anthem_kazakhstan.ogg', 'Kazakh SSR Anthem', 'triumphant', {
    loop: false,
  }),
  track('anthem_kyrgyzstan', 'anthem_kyrgyzstan.ogg', 'Kyrgyz SSR Anthem', 'triumphant', {
    loop: false,
  }),
  track('anthem_latvia', 'anthem_latvia.ogg', 'Latvian SSR Anthem', 'triumphant', { loop: false }),
  track('anthem_lithuania', 'anthem_lithuania.ogg', 'Lithuanian SSR Anthem', 'triumphant', {
    loop: false,
  }),
  track('anthem_moldova', 'anthem_moldova.ogg', 'Moldavian SSR Anthem', 'triumphant', {
    loop: false,
  }),
  track('anthem_tajikistan', 'anthem_tajikistan.ogg', 'Tajik SSR Anthem', 'triumphant', {
    loop: false,
  }),
  track('anthem_turkmenistan', 'anthem_turkmenistan.ogg', 'Turkmen SSR Anthem', 'triumphant', {
    loop: false,
  }),
  track('anthem_ukraine', 'anthem_ukraine.ogg', 'Ukrainian SSR Anthem', 'triumphant', {
    loop: false,
  }),
  track('anthem_uzbekistan', 'anthem_uzbekistan.ogg', 'Uzbek SSR Anthem', 'triumphant', {
    loop: false,
  }),

  // ===== SOUND EFFECTS (Tone.js procedural) =====
  {
    id: 'build',
    category: 'sfx',
    url: 'procedural',
    volume: 0.7,
    loop: false,
    preload: true,
    description: 'Building placement (procedural)',
  },
  {
    id: 'destroy',
    category: 'sfx',
    url: 'procedural',
    volume: 0.8,
    loop: false,
    preload: true,
    description: 'Demolition (procedural)',
  },
  {
    id: 'notification',
    category: 'sfx',
    url: 'procedural',
    volume: 0.6,
    loop: false,
    preload: true,
    description: 'UI notification (procedural)',
  },
  {
    id: 'coin',
    category: 'sfx',
    url: 'procedural',
    volume: 0.5,
    loop: false,
    preload: true,
    description: 'Money received (procedural)',
  },
  {
    id: 'siren',
    category: 'sfx',
    url: 'procedural',
    volume: 0.7,
    loop: false,
    preload: true,
    description: 'KGB/event siren (procedural)',
  },
  {
    id: 'queue_shuffle',
    category: 'sfx',
    url: 'procedural',
    volume: 0.4,
    loop: false,
    preload: false,
    description: 'Bread line shuffling (procedural)',
  },

  // ===== AMBIENT (Tone.js procedural) =====
  {
    id: 'wind',
    category: 'ambient',
    url: 'procedural',
    volume: 0.3,
    loop: true,
    preload: false,
    description: 'Wind ambience (procedural)',
  },
  {
    id: 'machinery',
    category: 'ambient',
    url: 'procedural',
    volume: 0.3,
    loop: true,
    preload: false,
    description: 'Industrial machinery (procedural)',
  },
  {
    id: 'radio_static',
    category: 'ambient',
    url: 'procedural',
    volume: 0.15,
    loop: true,
    preload: false,
    description: 'Propaganda radio static (procedural)',
  },
];

/** Compile-time type for all known audio track IDs */
export type AudioTrackId = (typeof AUDIO_MANIFEST)[number]['id'];

// Helper to get assets by category
export function getAudioByCategory(category: AudioAsset['category']): AudioAsset[] {
  return AUDIO_MANIFEST.filter((asset) => asset.category === category);
}

// Helper to get asset by ID
export function getAudioById(id: string): AudioAsset | undefined {
  return AUDIO_MANIFEST.find((asset) => asset.id === id);
}

// Get assets by mood
export function getAudioByMood(mood: AudioAsset['mood']): AudioAsset[] {
  return AUDIO_MANIFEST.filter((asset) => asset.mood === mood);
}

// Get all preload assets
export function getPreloadAssets(): AudioAsset[] {
  return AUDIO_MANIFEST.filter((asset) => asset.preload);
}

// Gameplay rotation — shuffled during play
export const GAMEPLAY_PLAYLIST: AudioTrackId[] = [
  'internationale',
  'varshavjanka',
  'red_army_march',
  'tachanka',
  'katyusha',
  'moskva_majskaia',
  'nash_parovoz',
  'dubinushka',
  'smuglianka',
  'glavnoe_rebiata',
];

// Context-specific music — mapped to game states/events
export const MUSIC_CONTEXTS: Record<string, AudioTrackId> = {
  // Core states
  menu: 'soviet_anthem_1944',
  gameplay: 'internationale',
  building: 'red_army_march',
  victory: 'soviet_anthem_1944',
  defeat: 'sacred_war',
  // Moods
  intense: 'sacred_war',
  upbeat: 'tachanka',
  melancholic: 'v_zemlianke',
  // Events
  blizzard: 'v_zemlianke',
  parade: 'katyusha',
  kgb_inspection: 'esli_zavtra_vojna',
  quota_deadline: 'marsh_zashchitnikov',
  industrial: 'nash_parovoz',
  celebration: 'moskva_majskaia',
  desolation: 'dorogi',
  pioneers: 'orlionok',
  propaganda: 'i_vnov_boj',
  labor: 'dubinushka',
  revolution: 'white_army_black_baron',
  // Seasonal/time
  winter: 'sinij_platochek',
  spring: 'moskva_majskaia',
  night: 'tam_vdali',
};
