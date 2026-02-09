#!/bin/bash
# Download and convert Soviet-era audio from marxists.org
# Requires: wget, ffmpeg

set -e

AUDIO_DIR="app/public/audio"
BASE_URL="https://www.marxists.org/history/ussr/sounds"

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

# 1944 Soviet National Anthem (the original wartime version)
if [ ! -f "$AUDIO_DIR/music/soviet_anthem_1944.ogg" ]; then
  echo "  Downloading: 1944 Soviet National Anthem..."
  wget -q -O "$AUDIO_DIR/music/soviet_anthem_1944.mp3" "$BASE_URL/mp3/soviet-anthem1944.mp3" && \
  ffmpeg -i "$AUDIO_DIR/music/soviet_anthem_1944.mp3" -c:a libvorbis -q:a 4 "$AUDIO_DIR/music/soviet_anthem_1944.ogg" -y > /dev/null 2>&1 && \
  rm "$AUDIO_DIR/music/soviet_anthem_1944.mp3" && \
  echo "  ✅ 1944 Soviet Anthem downloaded and converted"
else
  echo "  ⏭️  1944 Soviet Anthem already exists"
fi

# The Internationale
if [ ! -f "$AUDIO_DIR/music/internationale.ogg" ]; then
  echo "  Downloading: The Internationale..."
  wget -q -O "$AUDIO_DIR/music/internationale.mp3" "$BASE_URL/mp3/international.mp3" && \
  ffmpeg -i "$AUDIO_DIR/music/internationale.mp3" -c:a libvorbis -q:a 4 "$AUDIO_DIR/music/internationale.ogg" -y > /dev/null 2>&1 && \
  rm "$AUDIO_DIR/music/internationale.mp3" && \
  echo "  ✅ The Internationale downloaded and converted"
else
  echo "  ⏭️  The Internationale already exists"
fi

# Konarmeiskij March (Red Army March - great for building/action)
if [ ! -f "$AUDIO_DIR/music/red_army_march.ogg" ]; then
  echo "  Downloading: Red Army March..."
  wget -q -O "$AUDIO_DIR/music/red_army_march.mp3" "$BASE_URL/mp3/Konarmejskij-marsh.mp3" && \
  ffmpeg -i "$AUDIO_DIR/music/red_army_march.mp3" -c:a libvorbis -q:a 4 "$AUDIO_DIR/music/red_army_march.ogg" -y > /dev/null 2>&1 && \
  rm "$AUDIO_DIR/music/red_army_march.mp3" && \
  echo "  ✅ Red Army March downloaded and converted"
else
  echo "  ⏭️  Red Army March already exists"
fi

# Sviashchennaia Voina (Sacred War - intense, dramatic)
if [ ! -f "$AUDIO_DIR/music/sacred_war.ogg" ]; then
  echo "  Downloading: Sacred War..."
  wget -q -O "$AUDIO_DIR/music/sacred_war.mp3" "$BASE_URL/mp3/Sviashchennaia-vojna.mp3" && \
  ffmpeg -i "$AUDIO_DIR/music/sacred_war.mp3" -c:a libvorbis -q:a 4 "$AUDIO_DIR/music/sacred_war.ogg" -y > /dev/null 2>&1 && \
  rm "$AUDIO_DIR/music/sacred_war.mp3" && \
  echo "  ✅ Sacred War downloaded and converted"
else
  echo "  ⏭️  Sacred War already exists"
fi

# Tachanka (upbeat folk-military song)
if [ ! -f "$AUDIO_DIR/music/tachanka.ogg" ]; then
  echo "  Downloading: Tachanka..."
  wget -q -O "$AUDIO_DIR/music/tachanka.mp3" "$BASE_URL/mp3/Tachanka.mp3" && \
  ffmpeg -i "$AUDIO_DIR/music/tachanka.mp3" -c:a libvorbis -q:a 4 "$AUDIO_DIR/music/tachanka.ogg" -y > /dev/null 2>&1 && \
  rm "$AUDIO_DIR/music/tachanka.mp3" && \
  echo "  ✅ Tachanka downloaded and converted"
else
  echo "  ⏭️  Tachanka already exists"
fi

# Varshavjanka (Warsaw Worker's Song - good for gameplay)
if [ ! -f "$AUDIO_DIR/music/varshavjanka.ogg" ]; then
  echo "  Downloading: Varshavjanka..."
  wget -q -O "$AUDIO_DIR/music/varshavjanka.mp3" "$BASE_URL/mp3/proletariat-01/Varshavjanka.mp3" && \
  ffmpeg -i "$AUDIO_DIR/music/varshavjanka.mp3" -c:a libvorbis -q:a 4 "$AUDIO_DIR/music/varshavjanka.ogg" -y > /dev/null 2>&1 && \
  rm "$AUDIO_DIR/music/varshavjanka.mp3" && \
  echo "  ✅ Varshavjanka downloaded and converted"
else
  echo "  ⏭️  Varshavjanka already exists"
fi

echo ""
echo "✨ Audio download complete!"
echo ""
echo "📝 Downloaded tracks:"
echo "   - 1944 Soviet National Anthem (authentic wartime recording)"
echo "   - The Internationale (revolutionary anthem)"
echo "   - Red Army March (building/action)"
echo "   - Sacred War (intense/dramatic moments)"
echo "   - Tachanka (upbeat folk-military)"
echo "   - Varshavjanka (Warsaw Worker's Song)"
echo ""
echo "🎹 Procedural audio via Tone.js will be used for additional sounds"

