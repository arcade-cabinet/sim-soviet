#!/bin/bash
# =============================================================================
# SimSoviet 2000 — Audio Pipeline
# Downloads Soviet-era audio from marxists.org, converts MP3 → OGG Vorbis
# Requires: wget, ffmpeg
# Usage: bash scripts/download-audio.sh [--all | --essential | --clean]
# =============================================================================

set -euo pipefail

AUDIO_DIR="app/public/audio"
BASE_URL="https://www.marxists.org/history/ussr/sounds/mp3"
OGG_BITRATE="128k"  # Opus bitrate (128kbps, excellent quality for games)

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "============================================"
echo "  SimSoviet 2000 Audio Pipeline"
echo "  MP3 → OGG Vorbis Converter"
echo "============================================"
echo ""

# Check dependencies
command -v wget >/dev/null 2>&1 || { echo -e "${RED}wget required but not installed.${NC}" >&2; exit 1; }
command -v ffmpeg >/dev/null 2>&1 || { echo -e "${RED}ffmpeg required but not installed.${NC}" >&2; exit 1; }

mkdir -p "$AUDIO_DIR/music"
mkdir -p "$AUDIO_DIR/sfx"
mkdir -p "$AUDIO_DIR/ambient"

# ---------------------------------------------------------------------------
# Track definitions: local_name|remote_path|category|game_context
# Categories: essential (core gameplay), extended (richer experience), anthems
# ---------------------------------------------------------------------------

ESSENTIAL_TRACKS=(
  # Core gameplay music
  "soviet_anthem_1944|soviet-anthem1944.mp3|essential|Main menu, victory"
  "internationale|international.mp3|essential|Default gameplay"
  "red_army_march|Konarmejskij-marsh.mp3|essential|Building/action"
  "sacred_war|Sviashchennaia-vojna.mp3|essential|Dramatic events"
  "tachanka|Tachanka.mp3|essential|Upbeat gameplay"
  "varshavjanka|proletariat-01/Varshavjanka.mp3|essential|Gameplay rotation"
  # Iconic tracks that define the atmosphere
  "katyusha|Katyusha.mp3|essential|Parades, happy events"
  "moskva_majskaia|Moskva-Majskaia.mp3|essential|Spring, celebrations"
  "nash_parovoz|proletariat-01/Nash-paravos.mp3|essential|Industrial/trains"
  "dubinushka|proletariat-01/Dubinushka.mp3|essential|Workers, manual labor"
)

EXTENDED_TRACKS=(
  # Military/patriotic — for events, KGB scenes, intensity
  "white_army_black_baron|Belaia-Armiia-Cherny-Baron.mp3|extended|Revolutionary zeal"
  "smelo_my_v_boj|Smelo-my-v-boj-pojdem.mp3|extended|Boldly into battle"
  "marsh_zashchitnikov|Marsh-zashchitnikov-Moskvy.mp3|extended|Defense events"
  "esli_zavtra_vojna|Esli-zavtra-vojna.mp3|extended|Military threat"
  "nesokrushimaia|Nesokrushimaia-i-legendarnaia.mp3|extended|Army parade"
  # Melancholic/atmospheric — for sad events, winter, blizzards
  "v_zemlianke|V-zemlianke.mp3|extended|Winter, hardship"
  "dorogi|Dorogi.mp3|extended|Desolation, roads"
  "sinij_platochek|Sinij-platochek.mp3|extended|Nostalgia, sadness"
  "smuglianka|Smuglianka.mp3|extended|Lighter moments"
  # Youth/optimism — for education, pioneers, culture
  "orlionok|proletariat-01/Orljonok.mp3|extended|Youth, pioneers"
  "glavnoe_rebiata|Glavnoe-rebiata-serdtsem-ne-staret.mp3|extended|Komsomol spirit"
  "i_vnov_boj|I-vnov-prodolzhaetsia-boj.mp3|extended|Brezhnev era anthem"
  # Workers' songs
  "krasnoe_znamia|Krasnoe-znamia.mp3|extended|Red flag, rallies"
  "smelo_tovarishchi|proletariat-01/Smelo-tovaritshi-v-nogu.mp3|extended|Marching workers"
  "rabochaia_marseleza|proletariat-01/Rabotshaja-Marcelesa.mp3|extended|Revolutionary"
  "my_krasnye_soldaty|My-krasnye-soldaty.mp3|extended|Red soldiers"
  # Scenic/folk
  "slavnoe_more|proletariat-01/Slanoje-morje-sbjashtshenn.mp3|extended|Baikal, nature"
  "po_dolinam|proletariat-01/Pa-dolinam-i-pa-vsgorjam.mp3|extended|Valleys and hills"
  "tam_vdali|proletariat-01/Tam-vdali-sa-rekoj.mp3|extended|Beyond the river"
  "pod_zvezdami|Pod-zvezdami-balkanskimi.mp3|extended|Atmospheric"
  "pa_moriam|proletariat-01/Pa-morjam-pa-volnam.mp3|extended|Seas and waves"
  "pesnia_o_shchorse|Pesnia-o-Shcherse.mp3|extended|Hero's song"
  "vy_zhertvoiu|proletariat-01/Vy-shertvoju-pali.mp3|extended|Fallen heroes"
  "raskinulos_more|proletariat-01/Raskinulos-morje-shiroko.mp3|extended|Wide sea"
)

ANTHEM_TRACKS=(
  # Republic anthems — for expanding to SSR management
  "soviet_anthem_1977|soviet-anthem.mp3|anthem|1977 version"
  "anthem_armenia|anthems/Armenia.mp3|anthem|Armenian SSR"
  "anthem_azerbaijan|anthems/Azerbaijan.mp3|anthem|Azerbaijan SSR"
  "anthem_byelorussia|anthems/Byelorussia.mp3|anthem|Byelorussian SSR"
  "anthem_estonia|anthems/Estonia.mp3|anthem|Estonian SSR"
  "anthem_georgia|anthems/Georgia.mp3|anthem|Georgian SSR"
  "anthem_kazakhstan|anthems/Kazakhstan.mp3|anthem|Kazakh SSR"
  "anthem_kyrgyzstan|anthems/Kyrgyzstan.mp3|anthem|Kyrgyz SSR"
  "anthem_latvia|anthems/Latvia.mp3|anthem|Latvian SSR"
  "anthem_lithuania|anthems/Lithuania.mp3|anthem|Lithuanian SSR"
  "anthem_moldova|anthems/Moldova.mp3|anthem|Moldavian SSR"
  "anthem_tajikistan|anthems/Tajikistan.mp3|anthem|Tajik SSR"
  "anthem_turkmenistan|anthems/Turkmenistan.mp3|anthem|Turkmen SSR"
  "anthem_ukraine|anthems/Ukraine.mp3|anthem|Ukrainian SSR"
  "anthem_uzbekistan|anthems/Uzbekistan.mp3|anthem|Uzbek SSR"
)

# ---------------------------------------------------------------------------
# Download + convert function
# ---------------------------------------------------------------------------
download_count=0
skip_count=0
fail_count=0

download_track() {
  local entry="$1"
  local name remote category context
  IFS='|' read -r name remote category context <<< "$entry"

  local ogg_path="$AUDIO_DIR/music/${name}.ogg"
  local mp3_tmp="$AUDIO_DIR/music/${name}.mp3"

  if [ -f "$ogg_path" ]; then
    echo -e "  ${YELLOW}SKIP${NC} ${name} (already exists)"
    skip_count=$((skip_count + 1))
    return 0
  fi

  echo -n "  Downloading: ${name}... "
  if wget -q --timeout=15 -O "$mp3_tmp" "${BASE_URL}/${remote}" 2>/dev/null; then
    if ffmpeg -i "$mp3_tmp" -c:a libopus -b:a $OGG_BITRATE "$ogg_path" -y > /dev/null 2>&1; then
      rm -f "$mp3_tmp"
      local size_kb
      size_kb=$(du -k "$ogg_path" | cut -f1)
      echo -e "${GREEN}OK${NC} (${size_kb} KB) — ${context}"
      download_count=$((download_count + 1))
    else
      rm -f "$mp3_tmp" "$ogg_path"
      echo -e "${RED}FAIL${NC} (ffmpeg conversion error)"
      fail_count=$((fail_count + 1))
    fi
  else
    rm -f "$mp3_tmp"
    echo -e "${RED}FAIL${NC} (download error)"
    fail_count=$((fail_count + 1))
  fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

MODE="${1:---essential}"

case "$MODE" in
  --essential)
    echo "Mode: ESSENTIAL (${#ESSENTIAL_TRACKS[@]} core tracks)"
    echo ""
    for track in "${ESSENTIAL_TRACKS[@]}"; do
      download_track "$track"
    done
    ;;
  --all)
    echo "Mode: ALL (${#ESSENTIAL_TRACKS[@]} essential + ${#EXTENDED_TRACKS[@]} extended + ${#ANTHEM_TRACKS[@]} anthems)"
    echo ""
    echo "--- Essential ---"
    for track in "${ESSENTIAL_TRACKS[@]}"; do
      download_track "$track"
    done
    echo ""
    echo "--- Extended ---"
    for track in "${EXTENDED_TRACKS[@]}"; do
      download_track "$track"
    done
    echo ""
    echo "--- Republic Anthems ---"
    for track in "${ANTHEM_TRACKS[@]}"; do
      download_track "$track"
    done
    ;;
  --clean)
    echo "Removing all downloaded audio..."
    rm -rf "$AUDIO_DIR/music/"*.ogg
    echo "Done."
    exit 0
    ;;
  *)
    echo "Usage: $0 [--essential | --all | --clean]"
    exit 1
    ;;
esac

# Clean up any stray MP3s (we only keep OGG)
find "$AUDIO_DIR" -name "*.mp3" -delete 2>/dev/null || true

echo ""
echo "============================================"
echo "  Pipeline complete"
echo "  Downloaded: ${download_count}"
echo "  Skipped:    ${skip_count}"
echo "  Failed:     ${fail_count}"
echo "============================================"
echo ""
echo "All audio is OGG/Opus (no MP3s in the repo)."
echo "Procedural SFX via Tone.js: build, destroy, notification, coin, wind, machinery"
