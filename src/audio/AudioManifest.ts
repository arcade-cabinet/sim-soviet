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
    id: 'anthem_ussr',
    category: 'music',
    url: '/audio/music/anthem_ussr.ogg',
    volume: 0.6,
    loop: false,
    preload: true,
    description: 'USSR National Anthem - Menu/Intro theme',
    source: 'marxists.org',
    license: 'Public Domain',
  },
  {
    id: 'volga_boatmen',
    category: 'music',
    url: '/audio/music/volga_boatmen.ogg',
    volume: 0.5,
    loop: true,
    preload: true,
    description: 'Song of the Volga Boatmen - Main gameplay background',
    source: 'marxists.org',
    license: 'Public Domain',
  },
  {
    id: 'kalinka',
    category: 'music',
    url: '/audio/music/kalinka.ogg',
    volume: 0.6,
    loop: true,
    preload: false,
    description: 'Kalinka - Upbeat gameplay moments',
    source: 'marxists.org',
    license: 'Public Domain',
  },
  {
    id: 'katyusha',
    category: 'music',
    url: '/audio/music/katyusha.ogg',
    volume: 0.5,
    loop: true,
    preload: false,
    description: 'Katyusha - Building and expansion',
    source: 'marxists.org',
    license: 'Public Domain',
  },
  {
    id: 'polyushko',
    category: 'music',
    url: '/audio/music/polyushko.ogg',
    volume: 0.7,
    loop: false,
    preload: false,
    description: 'Polyushko-polye - Victory theme',
    source: 'marxists.org',
    license: 'Public Domain',
  },

  // ===== SOUND EFFECTS =====
  {
    id: 'build',
    category: 'sfx',
    url: '/audio/sfx/build.ogg',
    volume: 0.7,
    loop: false,
    preload: true,
    description: 'Building placement sound',
  },
  {
    id: 'destroy',
    category: 'sfx',
    url: '/audio/sfx/destroy.ogg',
    volume: 0.8,
    loop: false,
    preload: true,
    description: 'Demolition sound',
  },
  {
    id: 'notification',
    category: 'sfx',
    url: '/audio/sfx/notification.ogg',
    volume: 0.6,
    loop: false,
    preload: true,
    description: 'UI notification chime',
  },
  {
    id: 'coin',
    category: 'sfx',
    url: '/audio/sfx/coin.ogg',
    volume: 0.5,
    loop: false,
    preload: true,
    description: 'Money received',
  },
  {
    id: 'advisor_in',
    category: 'sfx',
    url: '/audio/sfx/advisor_in.ogg',
    volume: 0.7,
    loop: false,
    preload: true,
    description: 'Advisor appears',
  },
  {
    id: 'advisor_out',
    category: 'sfx',
    url: '/audio/sfx/advisor_out.ogg',
    volume: 0.7,
    loop: false,
    preload: true,
    description: 'Advisor dismissed',
  },

  // ===== AMBIENT SOUNDS =====
  {
    id: 'wind',
    category: 'ambient',
    url: '/audio/ambient/wind.ogg',
    volume: 0.3,
    loop: true,
    preload: false,
    description: 'Wind ambience',
  },
  {
    id: 'crowd',
    category: 'ambient',
    url: '/audio/ambient/crowd.ogg',
    volume: 0.2,
    loop: true,
    preload: false,
    description: 'Crowd/population sounds',
  },
  {
    id: 'machinery',
    category: 'ambient',
    url: '/audio/ambient/machinery.ogg',
    volume: 0.3,
    loop: true,
    preload: false,
    description: 'Industrial machinery ambient',
  },

  // ===== VOICE LINES (Future) =====
  {
    id: 'advisor_welcome',
    category: 'voice',
    url: '/audio/voice/advisor_welcome.ogg',
    volume: 0.8,
    loop: false,
    preload: false,
    description: 'Advisor welcome message',
  },
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
  'volga_boatmen',
  'kalinka',
  'katyusha',
];

// Context-specific music mapping
export const MUSIC_CONTEXTS = {
  menu: 'anthem_ussr',
  gameplay: 'volga_boatmen',
  building: 'katyusha',
  victory: 'polyushko',
  defeat: 'volga_boatmen', // Somber version
} as const;
