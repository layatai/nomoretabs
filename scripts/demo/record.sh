#!/usr/bin/env bash
# Record the README demo video (macOS).
#
# Launches an isolated Brave instance with the extension loaded, drives the
# real popup over CDP (driver.mjs), records the window with screencapture,
# burns in key captions, and produces demo.mp4 + demo.gif in the repo root.
#
# Requirements: Brave (or set BROWSER_BIN to a Chrome binary), node 22+,
# ffmpeg, python3 + Pillow. Terminal needs Screen Recording permission.
set -euo pipefail
cd "$(dirname "$0")/../.."

BROWSER_BIN="${BROWSER_BIN:-/Applications/Brave Browser.app/Contents/MacOS/Brave Browser}"
PORT=9333
PROFILE=/tmp/nmt-demo-profile
CAPS=/tmp/nmt-caps
RAW=/tmp/nmt-demo-raw.mov
# window geometry: keep in sync with the -R capture region below
WIN_POS=80,40
WIN_SIZE=900,680

cleanup() { pkill -f "user-data-dir=$PROFILE" 2>/dev/null || true; }
trap cleanup EXIT

# 1. fresh isolated browser with the extension and the demo tab set
cleanup; sleep 1
rm -rf "$PROFILE" "$RAW"
"$BROWSER_BIN" \
  --user-data-dir="$PROFILE" \
  --remote-debugging-port=$PORT \
  --load-extension="$PWD" \
  --no-first-run --no-default-browser-check --disable-session-crashed-bubble \
  --window-size=$WIN_SIZE --window-position=$WIN_POS \
  "https://en.wikipedia.org/wiki/Tab_(interface)" \
  "https://en.wikipedia.org/wiki/Browser_extension" \
  "https://github.com/layatai/nomoretabs" \
  "https://github.com/layatai/nomoretabs/releases" \
  "https://github.com/layatai/nomoretabs" \
  "https://news.ycombinator.com" \
  "https://news.ycombinator.com" \
  >/tmp/nmt-brave.log 2>&1 &
sleep 9

# 2. record the window region while the driver performs the demo
screencapture -v -V 38 -R80,40,900,680 "$RAW" &
sleep 1.2
node scripts/demo/driver.mjs demo
wait

# 3. captions (timings = driver MARK offsets + the 1.2s recording lead)
mkdir -p "$CAPS"
python3 scripts/demo/captions.py "$CAPS"
IN=(-i "$RAW")
for i in 1 2 3 4 5 6 7 8 9 10; do IN+=(-i "$CAPS/cap$i.png"); done
ffmpeg -y -v error "${IN[@]}" -filter_complex "
[0:v][1:v]overlay=0:598:enable='between(t,1.3,4.2)'[v1];
[v1][2:v]overlay=0:598:enable='between(t,4.3,6.3)'[v2];
[v2][3:v]overlay=0:598:enable='between(t,6.35,7.85)'[v3];
[v3][4:v]overlay=0:598:enable='between(t,7.9,11.5)'[v4];
[v4][5:v]overlay=0:598:enable='between(t,11.6,13.4)'[v5];
[v5][6:v]overlay=0:598:enable='between(t,13.5,17.8)'[v6];
[v6][7:v]overlay=0:598:enable='between(t,17.85,20.7)'[v7];
[v7][8:v]overlay=0:598:enable='between(t,20.75,22.9)'[v8];
[v8][9:v]overlay=0:598:enable='between(t,23.0,24.5)'[v9];
[v9][10:v]overlay=0:598:enable='between(t,24.6,29.3)'[vout]" \
  -map "[vout]" -t 31.5 -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -an demo.mp4

# 4. GIF for the README
ffmpeg -y -v error -i demo.mp4 -vf \
  "fps=10,scale=720:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4" \
  demo.gif

rm -rf "$PROFILE" "$RAW" "$CAPS"
echo "Built demo.mp4 and demo.gif"
