# Audio Assets for SimSoviet 2000

## Authentic Soviet Audio Sources

### Primary Source: Marxists.org Soviet Audio Archive

**URL**: https://www.marxists.org/history/ussr/sounds/

This archive contains authentic Soviet-era audio used for the game's atmosphere.

**Available Content:**

- **National Anthems** - USSR anthem, various republics
- **Revolutionary Songs** - "The Internationale", "Red Army is the Strongest"
- **Workers' Songs** - Industrial and labor movement music
- **Military Marches** - Red Army marches and patriotic songs
- **Historical Speeches** - Lenin, Stalin, and other Soviet leaders

## Audio Implementation

All audio assets are defined in `src/audio/AudioManifest.ts` with metadata including:

- Volume levels
- Loop settings
- Preload priority
- Source attribution
- License information

### Usage in Game

```typescript
import { AudioManager } from '@/audio/AudioManager';
import { MUSIC_CONTEXTS } from '@/audio/AudioManifest';

const audio = new AudioManager();
await audio.preloadAssets(); // Preload critical sounds
audio.playMusic(MUSIC_CONTEXTS.menu); // Play menu music
audio.playSFX('build'); // Play build sound
```

## Asset Directory Structure

```text
app/public/audio/
├── music/           # Background music tracks
├── sfx/             # Sound effects
├── ambient/         # Ambient/environmental sounds
└── voice/           # Voice lines (future)
```

## Legal & Attribution

**Public Domain Status:**

These recordings are believed to be in the public domain based on their age and
origin as Soviet government works. However, public domain status may vary by
jurisdiction. Users should verify the copyright status of individual recordings
in their own jurisdiction before redistribution.

- Pre-1927 recordings: Public domain in most jurisdictions
- Soviet government works: Generally considered public domain, but status varies
  by country
- Marxists.org curates recordings believed to be in the public domain

**Attribution:**

```text
Audio sourced from Marxists Internet Archive
https://www.marxists.org/history/ussr/sounds/
```

## Download Script

See `scripts/download-audio.sh` for automated downloading and conversion.
