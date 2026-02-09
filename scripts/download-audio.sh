#!/bin/bash
# Download and convert Soviet-era audio from marxists.org
# Requires: wget, ffmpeg

set -e

AUDIO_DIR="app/public/audio"
BASE_URL="https://www.marxists.org/history/ussr/sounds/mp3"

echo "🎵 SimSoviet 2000 Audio Downloader"
echo "=================================="
echo ""

# Check dependencies
command -v wget >/dev/null 2>&1 || { echo "❌ wget required but not installed. Aborting." >&2; exit 1; }
command -v ffmpeg >/dev/null 2>&1 || { echo "❌ ffmpeg required but not installed. Aborting." >&2; exit 1; }

# Create directories
mkdir -p "$AUDIO_DIR/music"
mkdir -p "$AUDIO_DIR/sfx"
mkdir -p "$AUDIO_DIR/ambient"

echo "📥 Downloading music tracks from marxists.org..."

# USSR Anthem (1977 version)
if [ ! -f "$AUDIO_DIR/music/anthem_ussr.ogg" ]; then
  echo "  Downloading: USSR Anthem..."
  wget -q -O "$AUDIO_DIR/music/anthem_ussr.mp3" "$BASE_URL/anthem1977.mp3" && \
  ffmpeg -i "$AUDIO_DIR/music/anthem_ussr.mp3" -c:a libvorbis -q:a 4 "$AUDIO_DIR/music/anthem_ussr.ogg" -y > /dev/null 2>&1 && \
  rm "$AUDIO_DIR/music/anthem_ussr.mp3" && \
  echo "  ✅ USSR Anthem downloaded and converted"
else
  echo "  ⏭️  USSR Anthem already exists"
fi

# Add more downloads here as needed
# Example:
# wget -q -O "$AUDIO_DIR/music/katyusha.mp3" "$BASE_URL/katyusha.mp3"

echo ""
echo "✨ Audio download complete!"
echo ""
echo "📝 Note: Some tracks may need to be sourced separately."
echo "   Check docs/AUDIO_ASSETS.md for full list and sources."

