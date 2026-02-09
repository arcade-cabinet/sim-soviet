# Audio Assets

## 🎵 Downloading Audio Files

Due to network restrictions in CI environments, audio files must be downloaded locally.

### Local Development Setup

1. **Install Dependencies** (if not already installed):
   ```bash
   # Ubuntu/Debian
   sudo apt-get install ffmpeg wget
   
   # macOS
   brew install ffmpeg wget
   ```

2. **Download Audio**:
   ```bash
   pnpm download:audio
   # Or directly:
   ./scripts/download-audio.sh
   ```

3. **Verify Download**:
   ```bash
   ls -lh app/public/audio/music/
   # Should show: anthem_ussr.ogg and other tracks
   ```

## 📁 Expected Files

After downloading, you should have:

```
audio/
├── music/
│   └── anthem_ussr.ogg (USSR National Anthem)
├── sfx/
│   └── (placeholder for future sound effects)
└── ambient/
    └── (placeholder for future ambient sounds)
```

## 🌐 Audio Sources

**Primary Source**: https://www.marxists.org/history/ussr/sounds/

Available tracks include:
- USSR National Anthem (1977 version)
- The Internationale
- Katyusha
- Kalinka
- Red Army songs
- And many more!

## 🎮 Using Placeholder Audio

If you can't download the audio, the game will still work but will be silent. The audio system gracefully handles missing files.

## 📝 Adding Your Own Audio

1. Place OGG files in the appropriate directory
2. Update `src/audio/AudioManifest.ts` with the new asset
3. Test in-game

## ⚖️ License & Attribution

Audio from marxists.org is generally public domain. See `docs/AUDIO_ASSETS.md` for details.
