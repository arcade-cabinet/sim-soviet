/**
 * Audio Asset Manifest for SimSoviet 2000
 * Defines all audio tracks and their properties
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
}

export const AUDIO_MANIFEST: AudioAsset[] = [
  // ===== MUSIC TRACKS =====
  {
    id: 'soviet_anthem_1944',
    category: 'music',
    url: '/audio/music/soviet_anthem_1944.ogg',
    volume: 0.6,
    loop: false,
    preload: true,
    description: '1944 Soviet National Anthem - Authentic wartime recording',
    source: 'marxists.org',
    license: 'Public Domain',
  },
  {
    id: 'internationale',
    category: 'music',
    url: '/audio/music/internationale.ogg',
    volume: 0.5,
    loop: true,
    preload: true,
    description: 'The Internationale - Revolutionary anthem',
    source: 'marxists.org',
    license: 'Public Domain',
  },
  {
    id: 'red_army_march',
    category: 'music',
    url: '/audio/music/red_army_march.ogg',
    volume: 0.6,
    loop: true,
    preload: false,
    description: 'Konarmeiskij March - Red Army march for building/action',
    source: 'marxists.org',
    license: 'Public Domain',
  },
  {
    id: 'sacred_war',
    category: 'music',
    url: '/audio/music/sacred_war.ogg',
    volume: 0.65,
    loop: true,
    preload: false,
    description: 'Sacred War - Intense dramatic music',
    source: 'marxists.org',
    license: 'Public Domain',
  },
  {
    id: 'tachanka',
    category: 'music',
    url: '/audio/music/tachanka.ogg',
    volume: 0.55,
    loop: true,
    preload: false,
    description: 'Tachanka - Upbeat folk-military song',
    source: 'marxists.org',
    license: 'Public Domain',
  },
  {
    id: 'varshavjanka',
    category: 'music',
    url: '/audio/music/varshavjanka.ogg',
    volume: 0.5,
    loop: true,
    preload: false,
    description: 'Varshavjanka - Warsaw Worker\'s Song',
    source: 'marxists.org',
    license: 'Public Domain',
  },

  // ===== SOUND EFFECTS (Tone.js procedural) =====
  {
    id: 'build',
    category: 'sfx',
    url: 'procedural', // Generated via Tone.js
    volume: 0.7,
    loop: false,
    preload: true,
    description: 'Building placement sound (procedural)',
  },
  {
    id: 'destroy',
    category: 'sfx',
    url: 'procedural', // Generated via Tone.js
    volume: 0.8,
    loop: false,
    preload: true,
    description: 'Demolition sound (procedural)',
  },
  {
    id: 'notification',
    category: 'sfx',
    url: 'procedural', // Generated via Tone.js
    volume: 0.6,
    loop: false,
    preload: true,
    description: 'UI notification chime (procedural)',
  },
  {
    id: 'coin',
    category: 'sfx',
    url: 'procedural', // Generated via Tone.js
    volume: 0.5,
    loop: false,
    preload: true,
    description: 'Money received (procedural)',
  },

  // ===== AMBIENT SOUNDS (Tone.js procedural) =====
  {
    id: 'wind',
    category: 'ambient',
    url: 'procedural', // Generated via Tone.js
    volume: 0.3,
    loop: true,
    preload: false,
    description: 'Wind ambience (procedural)',
  },
  {
    id: 'machinery',
    category: 'ambient',
    url: 'procedural', // Generated via Tone.js
    volume: 0.3,
    loop: true,
    preload: false,
    description: 'Industrial machinery ambient (procedural)',
  },

  // ===== VOICE LINES (Future) =====
];

// Helper to get assets by category
export function getAudioByCategory(category: AudioAsset['category']): AudioAsset[] {
  return AUDIO_MANIFEST.filter((asset) => asset.category === category);
}

// Helper to get asset by ID
export function getAudioById(id: string): AudioAsset | undefined {
  return AUDIO_MANIFEST.find((asset) => asset.id === id);
}

// Get all preload assets
export function getPreloadAssets(): AudioAsset[] {
  return AUDIO_MANIFEST.filter((asset) => asset.preload);
}

// Music playlist for gameplay
export const GAMEPLAY_PLAYLIST = [
  'internationale',
  'varshavjanka',
  'red_army_march',
  'tachanka',
];

// Context-specific music mapping
export const MUSIC_CONTEXTS = {
  menu: 'soviet_anthem_1944',
  gameplay: 'internationale',
  building: 'red_army_march',
  victory: 'soviet_anthem_1944',
  defeat: 'sacred_war',
  intense: 'sacred_war',
  upbeat: 'tachanka',
} as const;
