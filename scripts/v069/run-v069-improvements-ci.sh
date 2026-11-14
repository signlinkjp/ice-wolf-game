#!/usr/bin/env bash
# ICE WOLF v0.6.9 feel / readability / sound round: guard, run the GDevelop
# gameplay suite, publish the iPhone preview branch, then delete this helper,
# the guard and the one-time workflow.
set -euo pipefail

BASE_SHA="9c24143327abfb2bdd9a6a9b0d13cd2f1422eea1"
FEATURE_BRANCH="feature/v065-production-round-start"
PREVIEW_BRANCH="preview-v065-production-round-start"
GDEVELOP_SHA256="c1d23616562befbde242412913785dacb0bb15a79e8c101c1553dc729b1e0472"
GDEVELOP_ZIP_URL="https://github.com/4ian/GDevelop/releases/download/v5.6.282/GDevelop-5-5.6.282-linux.zip"
HELPER_WORKFLOW=".github/workflows/v069-improvements-ci.yml"
HELPER_SCRIPT="scripts/v069/run-v069-improvements-ci.sh"
HELPER_GUARD="scripts/v069/guard_v069_improvements.py"
SHIPPED_FILES="assets/floor_frostlab.png assets/ice_freeze.png assets/pad_speed.png assets/pad_warp.png assets/wall_frostlab.png game.json tools/make_frostlab_textures.py"
EXPORT_ASSETS="floor_frostlab.png wall_frostlab.png ice_freeze.png pad_speed.png pad_warp.png"

cd "$GITHUB_WORKSPACE"
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

echo "== 1. guard: baseline, expected change set =="
git fetch origin main "$FEATURE_BRANCH" "$PREVIEW_BRANCH"
test "$(git rev-parse origin/main)" = "$BASE_SHA"
expected="$(printf '%s\n' $SHIPPED_FILES "$HELPER_GUARD" "$HELPER_SCRIPT" "$HELPER_WORKFLOW" | sort)"
actual="$(git diff --name-only "$BASE_SHA"..HEAD | sort)"
echo "--- change set since baseline ---"
echo "$actual"
test "$actual" = "$expected"

GAME_COMMIT="$(git log -1 --format=%H -- game.json)"
echo "game.json commit: $GAME_COMMIT"

echo "== 2. guard: project semantics =="
python3 "$HELPER_GUARD"
python3 - <<'PY'
import json
json.load(open('game.json', encoding='utf-8'))
print('game.json JSON parse PASS')
PY

echo "== 3. GDevelop runtime dependencies =="
sudo apt-get update
sudo apt-get install -y libnss3 libasound2t64 xvfb unzip curl

echo "== 4. GDevelop 5.6.282 =="
curl -L --fail --retry 3 -o /tmp/gdevelop.zip "$GDEVELOP_ZIP_URL"
echo "$GDEVELOP_SHA256  /tmp/gdevelop.zip" | sha256sum -c -
mkdir -p /tmp/gdevelop
unzip -q /tmp/gdevelop.zip -d /tmp/gdevelop
GDEVELOP_BIN="$(find /tmp/gdevelop -type f -name gdevelop -perm -111 | head -n 1)"
test -n "$GDEVELOP_BIN"

run_test() {
  local name="$1"
  local started ended
  echo "===== TEST: $name ====="
  started="$(date +%s)"
  rm -f gameplay-test-results.json
  xvfb-run -a "$GDEVELOP_BIN" --no-sandbox --disable-update-check \
    --run-command RUN_ALL_TESTS "$GITHUB_WORKSPACE/game.json" --cmd-args "$name"
  test -f gameplay-test-results.json
  cat gameplay-test-results.json
  ended="$(date +%s)"
  echo "===== TEST DONE: $name ($((ended - started))s) ====="
}

echo "== 5. v0.6.9 feel / readability / sound tests =="
run_test 'v0.6.9 Circular Rescue Meter test'
run_test 'v0.6.9 Sound FX test'
run_test 'v0.6.9 Label Size + Chase Camera test'

echo "== 6. v0.6.8 / v0.6.7 / v0.6.5 feature tests =="
run_test 'v0.6.8 Hold Rescue test'
run_test 'v0.6.8 Speed Pad + Warp test'
run_test 'v0.6.8 Character 3D Rig test'
run_test 'v0.6.7 Role Choice test'
run_test 'v0.6.7 Match Duration test'
run_test 'v0.6.7 Restart Menu test'
run_test 'v0.6.5 All Frozen Instant Wolf Win test'
run_test 'v0.6.5 Survivor Frozen Counter test'
run_test 'v0.6.5 Wolf Role Pick test'

echo "== 7. protected regression suite =="
run_test 'Stability self-test'
run_test 'v0.6.0 human-side CPU Wolf test'
run_test 'v0.6.0 CPU Wolf device diagnostic test'
run_test 'v0.6.1 Human CPU navigation recovery test'
run_test 'v0.6.2 Color-independent Actor ID Labels test'
run_test 'v0.6.3 Mobile Virtual Joystick test'
run_test 'v0.6.4 Compact Joystick + Overview Camera test'
run_test 'v0.6.5 Production Round Start test'
run_test 'v0.6.5 Wolf Mode Multi-Freeze test'
run_test 'v0.6.5 Human Timeout Win Fast test'

echo "== 8. HTML5 export =="
rm -rf build /tmp/v069-improvements-build
xvfb-run -a "$GDEVELOP_BIN" --no-sandbox --disable-update-check \
  --run-command EXPORT_HTML5_EXTERNAL "$GITHUB_WORKSPACE/game.json"
test -f build/index.html
test -f build/code0.js
for asset in $EXPORT_ASSETS; do
  if [ -f "build/assets/$asset" ]; then
    echo "exported: build/assets/$asset"
  elif [ -f "build/$asset" ]; then
    echo "exported: build/$asset"
  else
    echo "MISSING FROM EXPORT: $asset"
    ls -la build/ | head -40
    exit 1
  fi
done
echo "export carries the frost-lab and pad assets"
cp -a build /tmp/v069-improvements-build

echo "== 9. publish preview branch =="
test "$(git rev-parse origin/main)" = "$BASE_SHA"
rm -rf /tmp/preview-worktree
git worktree add --detach /tmp/preview-worktree "origin/$PREVIEW_BRANCH"
cd /tmp/preview-worktree
git rm -rf . >/dev/null 2>&1 || true
cp -a /tmp/v069-improvements-build/. .
{
  printf 'ICE WOLF v0.6.9 preview (circular thaw ring + two-lane speed pads + compact labels + Web Audio cues)\n'
  printf 'source branch: %s\n' "$FEATURE_BRANCH"
  printf 'source commit: %s\n' "$GAME_COMMIT"
  printf 'baseline: %s\n' "$BASE_SHA"
  printf 'startup scene: FROST LAB\n'
  printf 'features: thaw = 1.2s hold filling a 68px circular SVG ring (cyan circumference, % in the middle, 解凍！ when full), 2 speed pads on the wide north/south lanes (1.45x for 2.5s), one warp pad pair (5s cooldown), 14px head labels, chase camera 600/53 deg, and synthesised Web Audio cues (freeze/thaw/warp/speed/countdown/start/win/lose) with a SETTINGS sound ON/OFF toggle stored in localStorage\n'
} > PREVIEW_SOURCE.txt
git add -A
git commit -m 'preview: v0.6.9 circular thaw ring, two-lane speed pads, compact labels, Web Audio cues [skip ci]'
git push origin "HEAD:$PREVIEW_BRANCH"
PREVIEW_COMMIT="$(git rev-parse HEAD)"
cd "$GITHUB_WORKSPACE"

echo "== 10. cleanup: remove one-time helpers =="
git checkout "$FEATURE_BRANCH"
git pull --ff-only origin "$FEATURE_BRANCH"
git rm "$HELPER_WORKFLOW" "$HELPER_SCRIPT" "$HELPER_GUARD"
git commit -m 'chore: remove visual round ci helper (v0.6.9) [skip ci]'
git push origin "HEAD:$FEATURE_BRANCH"

final_files="$(git diff --name-only "$BASE_SHA"..HEAD | sort)"
echo "$final_files"
test "$final_files" = "$(printf '%s\n' $SHIPPED_FILES | sort)"

echo "== RESULT =="
echo "FEATURE_BRANCH_HEAD=$(git rev-parse HEAD)"
echo "GAME_JSON_COMMIT=$GAME_COMMIT"
echo "PREVIEW_COMMIT=$PREVIEW_COMMIT"
echo "PREVIEW_PINNED=https://raw.githack.com/signlinkjp/ice-wolf-game/$PREVIEW_COMMIT/index.html"
echo "PREVIEW_BRANCH_URL=https://raw.githack.com/signlinkjp/ice-wolf-game/$PREVIEW_BRANCH/index.html"
