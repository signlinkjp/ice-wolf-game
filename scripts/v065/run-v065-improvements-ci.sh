#!/usr/bin/env bash
# ICE WOLF v0.6.6 visual/presentation round: guard, run the GDevelop gameplay
# suite, publish the iPhone preview branch, then delete this helper, the guard
# and the one-time workflow.
set -euo pipefail

BASE_SHA="9c24143327abfb2bdd9a6a9b0d13cd2f1422eea1"
FEATURE_BRANCH="feature/v065-production-round-start"
PREVIEW_BRANCH="preview-v065-production-round-start"
GDEVELOP_SHA256="c1d23616562befbde242412913785dacb0bb15a79e8c101c1553dc729b1e0472"
GDEVELOP_ZIP_URL="https://github.com/4ian/GDevelop/releases/download/v5.6.282/GDevelop-5-5.6.282-linux.zip"
HELPER_WORKFLOW=".github/workflows/v065-improvements-ci.yml"
HELPER_SCRIPT="scripts/v065/run-v065-improvements-ci.sh"
HELPER_GUARD="scripts/v065/guard_v065_improvements.py"
SHIPPED_FILES="assets/floor_frostlab.png assets/ice_freeze.png assets/wall_frostlab.png game.json tools/make_frostlab_textures.py"

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

# The device-tuning liveness test needs the most headroom: it used to land at the
# very end of the run and come within seconds of its limit, so it goes first.
echo "== 5. device tuning liveness (first, with full time budget) =="
run_test 'v0.6.4 Device Tuning liveness test'

echo "== 6. v0.6.5 feature tests =="
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
rm -rf build /tmp/v065-improvements-build
xvfb-run -a "$GDEVELOP_BIN" --no-sandbox --disable-update-check \
  --run-command EXPORT_HTML5_EXTERNAL "$GITHUB_WORKSPACE/game.json"
test -f build/index.html
test -f build/code0.js
for asset in assets/floor_frostlab.png assets/wall_frostlab.png assets/ice_freeze.png; do
  test -f "build/$asset" || { echo "MISSING FROM EXPORT: $asset"; exit 1; }
done
echo "export carries the frost-lab assets"
cp -a build /tmp/v065-improvements-build

echo "== 9. publish preview branch =="
test "$(git rev-parse origin/main)" = "$BASE_SHA"
rm -rf /tmp/preview-worktree
git worktree add --detach /tmp/preview-worktree "origin/$PREVIEW_BRANCH"
cd /tmp/preview-worktree
git rm -rf . >/dev/null 2>&1 || true
cp -a /tmp/v065-improvements-build/. .
{
  printf 'ICE WOLF v0.6.6 preview (ice-lab visuals + secret second-wolf notice)\n'
  printf 'source branch: %s\n' "$FEATURE_BRANCH"
  printf 'source commit: %s\n' "$GAME_COMMIT"
  printf 'baseline: %s\n' "$BASE_SHA"
  printf 'startup scene: FROST LAB\n'
  printf 'features: frost-lab floor/wall textures, ice-cyan frozen blocks with ice texture, 人狼役にする label, ⚠️ 誰かが人狼に染まった…！ secret notice\n'
} > PREVIEW_SOURCE.txt
git add -A
git commit -m 'preview: v0.6.6 ice-lab visuals + secret second-wolf notice [skip ci]'
git push origin "HEAD:$PREVIEW_BRANCH"
PREVIEW_COMMIT="$(git rev-parse HEAD)"
cd "$GITHUB_WORKSPACE"

echo "== 10. cleanup: remove one-time helpers =="
git checkout "$FEATURE_BRANCH"
git pull --ff-only origin "$FEATURE_BRANCH"
git rm "$HELPER_WORKFLOW" "$HELPER_SCRIPT" "$HELPER_GUARD"
git commit -m 'chore: remove visual round ci helper [skip ci]'
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
