# Audio Assets for SimSoviet 2000 🎵⚡

## 🎼 Authentic Soviet Audio Sources

### Primary Source: Marxists.org Soviet Audio Archive
**URL**: https://www.marxists.org/history/ussr/sounds/

This incredible archive contains authentic Soviet-era audio perfect for our game's atmosphere!

**Available Content:**
- **National Anthems** - USSR anthem, various republics
- **Revolutionary Songs** - "The Internationale", "Red Army is the Strongest"
- **Workers' Songs** - Industrial and labor movement music  
- **Military Marches** - Red Army marches and patriotic songs
- **Historical Speeches** - Lenin, Stalin, and other Soviet leaders

## 🎮 Audio Implementation

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

## 📁 Asset Directory Structure

```
app/public/audio/
├── music/           # Background music tracks
├── sfx/             # Sound effects
├── ambient/         # Ambient/environmental sounds
└── voice/           # Voice lines (future)
```

## ⚖️ Legal & Attribution

**Public Domain Status:**
- Pre-1927 recordings: Definitely public domain
- Soviet government works: Generally public domain
- Marxists.org curates for PD status

**Attribution:**
```
Audio sourced from Marxists Internet Archive
https://www.marxists.org/history/ussr/sounds/
```

## 🛠️ Download Script

See `scripts/download-audio.sh` for automated downloading and conversion.

