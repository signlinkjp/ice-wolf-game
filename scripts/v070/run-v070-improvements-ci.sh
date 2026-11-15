#!/usr/bin/env bash
# ICE WOLF v0.7.0 round (2F, stairs, 5 switches, 3 gates): guard, run the
# GDevelop gameplay suite (the 25 protected tests + the 7 v0.7.0 tests), publish
# the iPhone preview branch, then delete this helper, the guard and the one-time
# workflow.
set -euo pipefail

BASE_SHA="e6bbc59a1aa4cc5cc3d626dd4feaf58e2babe520"
FEATURE_BRANCH="feature/v065-production-round-start"
PREVIEW_BRANCH="preview-v065-production-round-start"
GDEVELOP_SHA256="c1d23616562befbde242412913785dacb0bb15a79e8c101c1553dc729b1e0472"
GDEVELOP_ZIP_URL="https://github.com/4ian/GDevelop/releases/download/v5.6.282/GDevelop-5-5.6.282-linux.zip"
HELPER_WORKFLOW=".github/workflows/v070-improvements-ci.yml"
HELPER_SCRIPT="scripts/v070/run-v070-improvements-ci.sh"
HELPER_GUARD="scripts/v070/guard_v070_improvements.py"
# Everything the feature branch ships on top of main. The helpers above are added
# for the run and removed again at the end, so they are not listed here.
SHIPPED_FILES=".gitignore README.md assets/floor_frostlab.png assets/ice_freeze.png assets/menu_hero.png assets/pad_speed.png assets/pad_warp.png assets/wall_frostlab.png capacitor.config.ts docs/ios-testflight-setup.md docs/ios-testflight-workflow.yml docs/v0611-improvements-ci.yml docs/v070-improvements-ci.yml docs/v070-two-floor-switches.md game.json ios/.gitignore ios/App/App.xcodeproj/project.pbxproj ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/IDEWorkspaceChecks.plist ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme ios/App/App/AppDelegate.swift ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json ios/App/App/Assets.xcassets/Contents.json ios/App/App/Assets.xcassets/Splash.imageset/Contents.json ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.jpg ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.jpg ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.jpg ios/App/App/Base.lproj/LaunchScreen.storyboard ios/App/App/Base.lproj/Main.storyboard ios/App/App/Info.plist ios/App/App/SceneDelegate.swift ios/App/CapApp-SPM/.gitignore ios/App/CapApp-SPM/Package.swift ios/App/CapApp-SPM/README.md ios/App/CapApp-SPM/Sources/CapApp-SPM/CapApp-SPM.swift ios/debug.xcconfig package-lock.json package.json scripts/ios/asc-readonly-preflight.py scripts/ios/build-and-upload-testflight.sh scripts/ios/verify-ios-project.py tools/make_frostlab_textures.py"
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

echo "== 2. guard: project semantics (2F slab, walls, pads, tests, versions) =="
python3 "$HELPER_GUARD"
python3 - <<'PY'
import json
data = json.load(open('game.json', encoding='utf-8'))
scene = next(l for l in data['layouts'] if l['name'] == 'FROST LAB')
names = [e.get('name') for e in scene['events']]
assert names[-1] == 'v0.7.0 2階・階段・5スイッチ・3ゲート', names[-3:]
tests = [t['name'] for t in data['tests']]
assert 'v0.7.0 Switch hold and gates open test' in tests
print('game.json JSON parse PASS, %d tests, v0.7.0 group last' % len(tests))
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

echo "== 5. v0.7.0 tests (2F, stairs, switches, trap, gates, settings, button) =="
run_test 'v0.7.0 Infect button one line test'
run_test 'v0.7.0 Two floors and stairs test'
run_test 'v0.7.0 Five switches layout test'
run_test 'v0.7.0 Switch hold and gates open test'
run_test 'v0.7.0 Trap switch third wolf test'
run_test 'v0.7.0 Gate escape wins test'
run_test 'v0.7.0 Settings toggles test'

echo "== 6. v0.6.11 / v0.6.10 / v0.6.9 / v0.6.8 feature tests =="
run_test 'v0.6.11 No Wall Rescue test'
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
run_test 'v0.6.0 human-side CPU Wolf test'
run_test 'v0.6.0 CPU Wolf device diagnostic test'
run_test 'v0.6.1 Human CPU navigation recovery test'
run_test 'v0.6.2 Color-independent Actor ID Labels test'
run_test 'v0.6.3 Mobile Virtual Joystick test'
run_test 'v0.6.4 Compact Joystick + Overview Camera test'

echo "== 9. HTML5 export =="
rm -rf build
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
cp -a build /tmp/v070-build

echo "== 10. publish preview branch =="
test "$(git rev-parse origin/main)" = "$BASE_SHA"
rm -rf /tmp/preview-worktree
git worktree add --detach /tmp/preview-worktree "origin/$PREVIEW_BRANCH"
cd /tmp/preview-worktree
git rm -rf . >/dev/null 2>&1 || true
cp -a /tmp/v070-build/. .
{
  printf 'ICE WOLF v0.7.0 preview (2F, stairs, 5 switches, 3 gates)\n'
  printf 'source branch: %s\n' "$FEATURE_BRANCH"
  printf 'source commit: %s\n' "$GAME_COMMIT"
  printf 'baseline: %s\n' "$BASE_SHA"
  printf 'startup scene: FROST LAB\n'
  printf 'features: a second floor sits beside FROST LAB at +1600px on X so the two floors can never share a coordinate - 2F has its own warm-tinted slab, fourteen walls (border, a closed central ring to run around, two bars, four pillars) and is clamped with its own rectangle; two stair pairs (1F-A <-> 2F-A, 1F-B <-> 2F-B) move the player and every CPU between the floors on a 2.4s cooldown and the CPU AI routes through them when its target or switch is on the other floor; five switch pads are dealt every round from ten safe floor spots with 3 correct and, at seven characters, 2 dummies (8+ characters or SETTINGS 常にON adds the trap instead of a dummy); a switch needs a 1.6s hold on the round ring and releases cleanly when the player walks away; three locked gates stand from the start and the third correct switch opens exactly one of them at random, announcing 1F or 2F, and any living Human who touches it wins the round; the trap turns the Human who starts it into the third Wolf with the red ears at once and tells the whole match; the HUD adds スイッチ: 0/3, the gate state and the current floor, and the right-hand 人狼役にする button is now 30px text in a 300px plate so it stays on one line\n'
} > PREVIEW_SOURCE.txt
git add -A
git commit -m 'preview: v0.7.0 two floors, stairs, five switches, three gates [skip ci]'
git push origin "HEAD:$PREVIEW_BRANCH"
PREVIEW_COMMIT="$(git rev-parse HEAD)"
cd "$GITHUB_WORKSPACE"

echo "== 11. cleanup: remove the one-time helpers =="
git checkout "$FEATURE_BRANCH"
git pull --ff-only origin "$FEATURE_BRANCH"
git rm "$HELPER_WORKFLOW" "$HELPER_SCRIPT" "$HELPER_GUARD"
git commit -m 'chore: remove v070 round helper [skip ci]'
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
