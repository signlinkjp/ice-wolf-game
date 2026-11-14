#!/usr/bin/env bash
# ICE WOLF v0.6.11 wall-through-thaw-prevention round: guard, run the GDevelop
# gameplay suite, publish the iPhone preview branch, then delete this helper,
# the guard and the one-time workflow.
set -euo pipefail

BASE_SHA="9c24143327abfb2bdd9a6a9b0d13cd2f1422eea1"
FEATURE_BRANCH="feature/v065-production-round-start"
PREVIEW_BRANCH="preview-v065-production-round-start"
GDEVELOP_SHA256="c1d23616562befbde242412913785dacb0bb15a79e8c101c1553dc729b1e0472"
GDEVELOP_ZIP_URL="https://github.com/4ian/GDevelop/releases/download/v5.6.282/GDevelop-5-5.6.282-linux.zip"
HELPER_WORKFLOW=".github/workflows/v0611-improvements-ci.yml"
HELPER_SCRIPT="scripts/v0611/run-v0611-improvements-ci.sh"
HELPER_GUARD="scripts/v0611/guard_v0611_improvements.py"
# Everything the feature branch ships on top of main. The iOS/TestFlight shell
# (capacitor.config.ts, ios/**, package*.json, scripts/ios/**) landed on this
# branch after main, so it belongs here; without it the final_files check below
# fails even though the round is correct.
SHIPPED_FILES=".gitignore README.md assets/floor_frostlab.png assets/ice_freeze.png assets/menu_hero.png assets/pad_speed.png assets/pad_warp.png assets/wall_frostlab.png capacitor.config.ts docs/ios-testflight-setup.md docs/ios-testflight-workflow.yml docs/v0611-improvements-ci.yml game.json ios/.gitignore ios/App/App.xcodeproj/project.pbxproj ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/IDEWorkspaceChecks.plist ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme ios/App/App/AppDelegate.swift ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json ios/App/App/Assets.xcassets/Contents.json ios/App/App/Assets.xcassets/Splash.imageset/Contents.json ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.jpg ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.jpg ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.jpg ios/App/App/Base.lproj/LaunchScreen.storyboard ios/App/App/Base.lproj/Main.storyboard ios/App/App/Info.plist ios/App/App/SceneDelegate.swift ios/App/CapApp-SPM/.gitignore ios/App/CapApp-SPM/Package.swift ios/App/CapApp-SPM/README.md ios/App/CapApp-SPM/Sources/CapApp-SPM/CapApp-SPM.swift ios/debug.xcconfig package-lock.json package.json scripts/ios/asc-readonly-preflight.py scripts/ios/build-and-upload-testflight.sh scripts/ios/verify-ios-project.py tools/make_frostlab_textures.py"
EXPORT_ASSETS="floor_frostlab.png wall_frostlab.png ice_freeze.png pad_speed.png pad_warp.png menu_hero.png"

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
data = json.load(open('game.json', encoding='utf-8'))
scene = next(l for l in data['layouts'] if l['name'] == 'FROST LAB')
names = [e.get('name') for e in scene['events']]
group = names.index('v0.6.11 壁越し解凍防止')
assert names[group + 1] == 'v0.6.9 円形解凍リング', names[group:group + 2]
tests = [t['name'] for t in data['tests']]
assert 'v0.6.11 No Wall Rescue test' in tests
print('game.json JSON parse PASS, %d tests, wall check at index %d' % (len(tests), group))
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
  if grep -qE '"(lastRunStatus|status)"[[:space:]]*:[[:space:]]*"(failed|error)"' gameplay-test-results.json; then
    echo "TEST REPORTED A FAILURE: $name"
    exit 1
  fi
  ended="$(date +%s)"
  echo "===== TEST DONE: $name ($((ended - started))s) ====="
}

echo "== 5. v0.6.11 wall-through-thaw test =="
run_test 'v0.6.11 No Wall Rescue test'

echo "== 6. v0.6.10 / v0.6.9 / v0.6.8 feature tests =="
run_test 'v0.6.10 Concealed Identity test'
run_test 'v0.6.10 Menu Hero test'
run_test 'v0.6.9 Circular Rescue Meter test'
run_test 'v0.6.9 Sound FX test'
run_test 'v0.6.9 Label Size + Chase Camera test'
run_test 'v0.6.8 Hold Rescue test'
run_test 'v0.6.8 Speed Pad + Warp test'
run_test 'v0.6.8 Character 3D Rig test'

echo "== 7. v0.6.7 / v0.6.5 feature tests =="
run_test 'v0.6.7 Role Choice test'
run_test 'v0.6.7 Match Duration test'
run_test 'v0.6.7 Restart Menu test'
run_test 'v0.6.5 Production Round Start test'
run_test 'v0.6.5 Wolf Mode Multi-Freeze test'
run_test 'v0.6.5 Human Timeout Win Fast test'
run_test 'v0.6.5 All Frozen Instant Wolf Win test'
run_test 'v0.6.5 Survivor Frozen Counter test'
run_test 'v0.6.5 Wolf Role Pick test'

echo "== 8. protected regression suite =="
run_test 'Stability self-test'
run_test 'Wall block check'
run_test 'STEP1 bounds test'
run_test 'STEP2 core test'
run_test 'v0.3 action clarity test'
run_test 'v0.6.0 human-side CPU Wolf test'
run_test 'v0.6.0 CPU Wolf device diagnostic test'
run_test 'v0.6.1 Human CPU navigation recovery test'
run_test 'v0.6.2 Color-independent Actor ID Labels test'
run_test 'v0.6.3 Mobile Virtual Joystick test'
run_test 'v0.6.4 Compact Joystick + Overview Camera test'

echo "== 9. HTML5 export =="
rm -rf build /tmp/v0611-build
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
echo "export carries the frost-lab, pad and hero assets"
cp -a build /tmp/v0611-build

echo "== 10. publish preview branch =="
test "$(git rev-parse origin/main)" = "$BASE_SHA"
rm -rf /tmp/preview-worktree
git worktree add --detach /tmp/preview-worktree "origin/$PREVIEW_BRANCH"
cd /tmp/preview-worktree
git rm -rf . >/dev/null 2>&1 || true
cp -a /tmp/v0611-build/. .
{
  printf 'ICE WOLF v0.6.11 preview (no thawing through walls)\n'
  printf 'source branch: %s\n' "$FEATURE_BRANCH"
  printf 'source commit: %s\n' "$GAME_COMMIT"
  printf 'baseline: %s\n' "$BASE_SHA"
  printf 'startup scene: FROST LAB\n'
  printf 'features: the thaw chain now checks the line of sight, so a frozen neighbour behind a wall can no longer be rescued through it - every frame the wall check draws the centre-to-centre line from the player to each frozen actor against the 2D footprint of all 30 wall blocks, hides the rescue button when the straight line crosses a wall, holds the ring at zero, and resets a half-filled hold the moment the player steps behind the wall; the rescue reach also tightened from 140px to 105px so the hold has to be earned at arm'"'"'s length, while the same-side rescue at 62px and the infect action keep their old behaviour\n'
} > PREVIEW_SOURCE.txt
git add -A
git commit -m 'preview: v0.6.11 wall-through-thaw prevention [skip ci]'
git push origin "HEAD:$PREVIEW_BRANCH"
PREVIEW_COMMIT="$(git rev-parse HEAD)"
cd "$GITHUB_WORKSPACE"

echo "== 11. cleanup: remove one-time helpers =="
git checkout "$FEATURE_BRANCH"
git pull --ff-only origin "$FEATURE_BRANCH"
git rm "$HELPER_WORKFLOW" "$HELPER_SCRIPT" "$HELPER_GUARD"
git commit -m 'chore: remove visual round ci helper (v0.6.11) [skip ci]'
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
