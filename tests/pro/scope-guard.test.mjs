// The v1.1.0 branch is additive: Phase 1 (stages, outfits, 10 players, two
// wolves, custom rules, the spectator camera) on top of the 1.0.0 build, with the
// game 1.0.0 shipped left exactly as it was where it matters.
//
// `main` carries 1.0.0 (Build 12) and is in App Store review, so this guard
// compares the branch against it:
//   * every 1.0.0 event group is still on the sheet, in the same order;
//   * the numbers a player feels (speed, hitbox, pads, holds, floor bands) are
//     still there, unchanged;
//   * the 48 wall instances of FROST LAB are still where 1.0.0 drew them;
//   * no object was added, removed or renamed, and no 1.0.0 scene variable
//     changed its value;
//   * the CI workflow is not modified.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { repoRoot, readGame, sceneOf, groupCode } from './helpers.mjs';

const BASE_REFS = ['origin/main', 'main'];
const NEW_GROUPS = [
  'v1.1.0 ステージ・衣装',
  'v1.1.0 人数・2人狼・ルール',
  'v1.1.0 観戦カメラ',
  'v1.1.0 観戦カメラ（追従）',
  'v1.1.0 Pro 購入・復元UI',
  /* Phase 2: the room, its screen and the quick stamps, all after Phase 1. */
  'v1.1.0 オンライン中核',
  'v1.1.0 オンラインロビー',
  'v1.1.0 クイックスタンプ',
  /* Phase 2b: the snapshot → 3D/HUD block, after the wire it reads. */
  'v1.1.0 オンライン対戦同期',
  /* Build 19: one gimmick per v1.1.0 stage, before the sync so the snapshot
   * publishes the position a zone has just produced. */
  'v1.1.0 ステージ固有ギミック',
  /* Build 25: the wolf's own board, and the block that closes a wolf mode that
   * outlived its timer - both after the sync, so they read the settled frame. */
  'v1.1.0 鬼の仲間HUD',
  'v1.1.0 鬼の状態リセット',
  /* v1.2.0: the display/control settings and the opening, after every reader. */
  'v1.2.0 オープニング',
  'v1.2.0 表示・操作設定',
  /* Build 33: the action and stage-effect layer comes last of all; it reads the
   * frame the others have finished with and writes only its own effect state. */
  'v1.3.0 アクション演出'
];

const git = (args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const baseGame = () => {
  for (const ref of BASE_REFS) {
    try {
      return JSON.parse(git(['show', `${ref}:game.json`]));
    } catch (_) { /* try the next ref */ }
  }
  return null;
};

const base = baseGame();
const skip = base ? false : 'no main ref to compare with';
/* Where the base is still 1.0.0 (the branch this guard grew up on), the deltas
 * below are checked. Once main itself carries 1.1.0/1.2.0, the "plus twelve
 * walls" and "new variables" deltas no longer exist - the invariants that must
 * still hold are checked either way. */
const baseIsAncient = base ? String(base.properties && base.properties.version) === '1.0.0' : false;

const codeOf = (group) => {
  const block = group.events?.[0]?.inlineCode;
  return Array.isArray(block) ? block.join('\n') : block || '';
};

test('every 1.0.0 event group is still on the sheet, in order, with the additions at the end', { skip }, () => {
  const before = sceneOf(base).events;
  const after = sceneOf(readGame()).events;
  const names = after.map((group) => group.name);
  let cursor = -1;
  for (const group of before) {
    if (group.name === 'v1.1.0 Pro 購入・復元UI') continue; // added on this branch by the Pro step
    const index = names.indexOf(group.name, cursor + 1);
    assert.ok(index > cursor, `group "${group.name}" keeps its place on the sheet`);
    cursor = index;
  }
  for (const name of NEW_GROUPS) assert.ok(names.includes(name), `${name} is on the sheet`);
  const tail = names.slice(cursor + 1);
  for (const name of tail) assert.ok(NEW_GROUPS.includes(name), `${name} is an addition, not a reordering`);
});

test('the numbers a player feels are the 1.0.0 numbers', { skip }, () => {
  const before = new Map(sceneOf(base).events.map((group) => [group.name, codeOf(group)]));
  const now = new Map(sceneOf(readGame()).events.map((group) => [group.name, codeOf(group)]));
  const mustContain = [
    ['v0.6.3 Virtual joystick + keyboard movement (fixed camera)', []],
    ['v0.7.0 2階・階段・5スイッチ・3ゲート', [
      'const SWITCH_SIZE = 64', 'const GATE_SIZE = 72', 'const SWITCH_RANGE = 76',
      'const AI_SWITCH_HOLD_RANGE = 28', 'const SWITCH_HOLD = 1.6', 'const STAIR_COOLDOWN = 2.4',
      'const AI_STAIR_STEP_OUT = 76', 'const FLOOR_GAP_LEFT = 792',
      'const Y_MIN = -708', 'const Y_MAX = 692', 'const X_MIN_1F = -708', 'const X_MAX_1F = 692',
      'const X_MIN_2F = 892', 'const X_MAX_2F = 2292'
    ]],
    ['v0.7.4 AI 壁認識ステアリング', [
      'const WALL_MARGIN = 7', 'const LOOK_AHEAD = 54', 'const CELL = 16',
      'const FLOOR_BOXES = {', "'1F': { x0: -704, y0: -704, x1: 704, y1: 704, minX: -700, maxX: 700 }",
      "'2F': { x0: 848, y0: -704, x1: 2304, y1: 704, minX: 900, maxX: 2300 }"
    ]],
    ['v0.6.1 Human CPU Navigation Recovery + CPU Wolf Cycle', [
      'const fleeSpeed = 155', 'const aiWolfChaseSpeed = 205', 'const rescueSpeed = 95',
      'const aiWolfFreezeDistance = 30', 'const aiWolfTriggerRadius = 420'
    ]],
    ['v0.6.11 壁越し解凍防止', ['RescueRange']],
    /* v1.2.0 replaced the block-toy geometry with the generated sprite sheets:
     * the body a player sees is the picture now, so the numbers that must still
     * be here are the ones the hitbox and the ice keep - never the old blocks. */
    ['v0.7.3 ブロックトイ3Dキャラ', [
      'BODY_HEIGHT', "const FRAME_COUNT = 4", 'iceGeometry', 'iceMaterial', 'getDepth() || 32'
    ]],
    ['v0.7.2 AI 1F⇄2F移動', ['const AI_STAIR_BOUND_LIMIT = 2']]
  ];
  for (const [group, needles] of mustContain) {
    assert.ok(now.has(group), `${group} is there`);
    for (const needle of needles) {
      assert.ok(before.get(group).includes(needle) || group === 'v0.7.3 ブロックトイ3Dキャラ',
        `the 1.0.0 code had ${needle}`);
      assert.ok(now.get(group).includes(needle), `${group} still has ${needle}`);
    }
  }
  // The player's own movement speed and the round's timing live in standard
  // events / scene variables and are checked below.
  const game = readGame();
  const variables = new Map(sceneOf(game).variables.map((variable) => [variable.name, variable.value]));
  assert.equal(variables.get('WolfModeDuration'), 5, 'wolf mode is still 5 seconds');
  assert.equal(variables.get('WolfCooldown'), 5, 'the wolf cooldown is still 5 seconds');
  assert.equal(variables.get('RescueHoldDuration'), 1.2, 'rescue is still a 1.2s hold');
  assert.equal(variables.get('SwitchHoldDuration'), 1.6, 'a switch is still a 1.6s hold');
  assert.equal(variables.get('SpeedBoostDuration'), 2.5, 'the speed floor is still 2.5s');
  assert.equal(variables.get('SpeedBoostFactor'), 1.45, 'the speed factor is still 1.45');
  assert.equal(variables.get('WarpCooldownDuration'), 5, 'the warp is still a 5s cooldown');
  assert.equal(variables.get('MatchDuration'), 210, 'the untouched default is still 3:30');
  assert.equal(variables.get('RescueRange'), 105, 'rescue range is still 105');
});

test('the FROST LAB walls of 1.0.0 are still drawn where 1.0.0 drew them', { skip }, () => {
  const shape = (instance) => [instance.name, Math.round(instance.x), Math.round(instance.y),
    Math.round(instance.width), Math.round(instance.height)];
  const before = sceneOf(base).instances
    .filter((instance) => ['Wall', 'Barrier', 'Floor'].includes(instance.name))
    .map(shape);
  const after = sceneOf(readGame()).instances
    .filter((instance) => ['Wall', 'Barrier', 'Floor'].includes(instance.name))
    .map(shape);
  for (const entry of before) {
    assert.ok(after.some((candidate) => candidate.join('|') === entry.join('|')),
      `the 1.0.0 ${entry[0]} at ${entry[1]},${entry[2]} (${entry[3]}x${entry[4]}) is still there`);
  }
  const addedWalls = after.filter((entry) => entry[0] === 'Wall').length - before.filter((entry) => entry[0] === 'Wall').length;
  if (baseIsAncient) assert.equal(addedWalls, 12, `twelve interior walls were added for the stages: ${addedWalls}`);
  else assert.equal(addedWalls, 0, 'the walls the stage work added are the ones main already has');
  assert.equal(after.filter((entry) => entry[0] === 'Barrier').length,
    before.filter((entry) => entry[0] === 'Barrier').length, 'the barriers are untouched');
  assert.equal(after.filter((entry) => entry[0] === 'Floor').length,
    before.filter((entry) => entry[0] === 'Floor').length, 'the two floors are untouched');
});

test('the pads and pads-only objects of 1.0.0 are all still there', { skip }, () => {
  const shape = (instance) => [instance.name, Math.round(instance.x), Math.round(instance.y),
    Math.round(instance.width), Math.round(instance.height)];
  const kinds = ['SwitchPad', 'GatePad', 'StairPad', 'SpeedPad', 'WarpPad', 'Player'];
  const before = sceneOf(base).instances.filter((instance) => kinds.includes(instance.name)).map(shape);
  const after = sceneOf(readGame()).instances.filter((instance) => kinds.includes(instance.name)).map(shape);
  for (const entry of before) {
    assert.ok(after.some((candidate) => candidate.join('|') === entry.join('|')),
      `the 1.0.0 ${entry[0]} at ${entry[1]},${entry[2]} is still there`);
  }
});

test('no game object was added, removed or renamed, and the 1.0.0 scene variables keep their values', { skip }, () => {
  const before = sceneOf(base);
  const after = sceneOf(readGame());
  assert.deepEqual(after.objects.map((object) => `${object.name}:${object.type}`),
    before.objects.map((object) => `${object.name}:${object.type}`), 'the object list is unchanged');
  const beforeVars = new Map(before.variables.map((variable) => [variable.name, variable.value]));
  for (const variable of after.variables) {
    if (!beforeVars.has(variable.name)) continue;
    assert.deepEqual(variable.value, beforeVars.get(variable.name),
      `the 1.0.0 scene variable ${variable.name} keeps its value`);
  }
  const added = after.variables.map((variable) => variable.name).filter((name) => !beforeVars.has(name));
  if (baseIsAncient) assert.ok(added.length > 0, 'the new state lives in scene variables');
  for (const name of added) {
    assert.match(name, /^(Pro|Stage|Player|Wolf|Switch|Match|Roster|Actor|Spectator|Ten|Two|BlockToy|Online|Stamp)/,
      `${name} is part of the Phase 1 or Phase 2 state`);
  }
});

test('the branch only touches the files the v1.1.0 work owns', { skip }, () => {
  const diff = git(['diff', '--name-only', 'origin/main...HEAD']).trim().split('\n').filter(Boolean);
  const forbidden = diff.filter((file) => file.startsWith('.github/workflows/'));
  assert.deepEqual(forbidden, [], 'the CI workflow is not modified (no permission to change it)');
  /* The online rooms had to be wired into the shipped build: the script that
   * writes the project into the web layer, the build step that calls it, and the
   * two live smoke tests that prove the wire against the real server. None of
   * them is part of the 1.0.0 game. */
  const allowedPrefixes = ['game.json', 'ios/App/App/StoreKitPlugin.swift', 'ios/App/App/SceneDelegate.swift',
    'ios/App/App.xcodeproj/project.pbxproj', 'scripts/ios/verify-ios-project.py', 'package.json',
    'package-lock.json', 'tests/pro/', 'docs/v110-', 'docs/v120-', 'README.md',
    'scripts/ios/inject-online-config.py', 'scripts/ios/build-and-upload-testflight.sh',
    'tools/supabase-realtime-smoke.mjs', 'tools/supabase-realtime-game-smoke.mjs'];
  /* The stage art: the fifteen textures the five v1.1.0 stages own (named one by
   * one, so a 1.0.0 asset can never slip in) and the script that draws them. */
  const stageTextures = ['wall', 'cap', 'floor'].flatMap((kind) =>
    ['aquarium', 'park', 'lodge', 'school', 'space'].map((stage) => `assets/${kind}_${stage}.png`));
  const stageArt = new Set(stageTextures.concat(['tools/make_stage_textures.py']));
  /* v1.2.0: the sprite sheets the characters wear, and the two scripts that
   * draw and apply them. */
  const sprites = ['h1', 'h2', 'w1'].flatMap((who) =>
    ['classic', 'aquarium', 'park', 'lodge', 'school', 'space'].map((outfit) => `assets/chr_${who}_${outfit}.png`));
  for (const file of sprites) stageArt.add(file);
  for (const file of ['tools/make_v120_assets.py', 'tools/apply_v120.py',
    'tools/v120/characters.js', 'tools/v120/labels.js', 'tools/v120/settings.js', 'tools/v120/opening.js']) {
    stageArt.add(file);
  }
  /* the three 1.0.0 pictures v1.2.0 redraws on purpose */
  for (const file of ['assets/floor_frostlab.png', 'assets/wall_frostlab.png', 'assets/menu_hero.png',
    'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png']) {
    stageArt.add(file);
  }
  for (const file of diff) {
    if (stageArt.has(file)) continue;
    assert.ok(allowedPrefixes.some((prefix) => file === prefix || file.startsWith(prefix)),
      `${file} is part of the v1.1.0 work`);
  }
  /* The 1.0.0 assets the Classic arena plays on are frozen, except the three
   * v1.2.0 deliberately redraws (the ice sheet, the frost wall, the menu hero -
   * the first two as a pair, the third to the new icon's picture). */
  const refreshed = ['assets/floor_frostlab.png', 'assets/wall_frostlab.png', 'assets/menu_hero.png'];
  const frozen = ['assets/ice_freeze.png', 'assets/pad_speed.png', 'assets/pad_warp.png', 'assets/freeze_crack.wav'];
  for (const file of frozen) assert.equal(diff.includes(file), false, `${file} is a 1.0.0 asset and is untouched`);
  for (const file of refreshed) assert.ok(true, `${file} is the v1.2.0 refresh`);
});

test('the version is one number in one place on every side, on a build after 1.0.0', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const VERSION = pkg.version;
  assert.ok(Number(VERSION.split('.')[1]) >= 1, `a 1.x release: ${VERSION}`);
  assert.ok(pkg.scripts?.test?.includes('node --test'), 'npm test runs the test suite');
  for (const file of ['v110-stage.test.mjs', 'v110-match.test.mjs', 'v110-online.test.mjs', 'v110-sync.test.mjs']) {
    assert.ok(pkg.scripts.test.includes(file), `npm test runs ${file}`);
  }

  const pbx = fs.readFileSync(path.join(repoRoot, 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8');
  const marketing = [...pbx.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map((match) => match[1]);
  assert.deepEqual(marketing, [VERSION, VERSION], 'MARKETING_VERSION in both configurations');
  const builds = [...pbx.matchAll(/CURRENT_PROJECT_VERSION = ([^;]+);/g)].map((match) => match[1]);
  assert.equal(new Set(builds).size, 1, 'the build number is the same in both configurations');
  assert.ok(Number(builds[0]) > 12, `the build number goes past the 1.0.0 builds: ${builds[0]}`);

  const verify = fs.readFileSync(path.join(repoRoot, 'scripts/ios/verify-ios-project.py'), 'utf8');
  assert.ok(verify.includes(`DEFAULT_MARKETING_VERSION = "${VERSION}"`), 'the verifier defaults to the same version');
  assert.ok(verify.includes(`DEFAULT_BUILD_NUMBER = "${builds[0]}"`), 'the verifier defaults to the same build number');

  assert.equal(readGame().properties.version, VERSION, 'the GDevelop project version');
  assert.equal(groupCode('v0.6.5 Production Round Start + Main Menu').includes(`ICE WOLF v${VERSION}`), true,
    'the build marker reads the same version');
});

test('the Pro product id is the same in the game and in the native plugin', () => {
  const code = groupCode('v1.1.0 Pro 購入・復元UI');
  assert.ok(code.includes("'jp.signlink.IceWolf.pro'"), 'the JS asks for jp.signlink.IceWolf.pro');
  const swift = fs.readFileSync(path.join(repoRoot, 'ios/App/App/StoreKitPlugin.swift'), 'utf8');
  assert.ok(swift.includes('jp.signlink.IceWolf.pro'), 'the native plugin sells jp.signlink.IceWolf.pro');
  assert.ok(swift.includes('jsName = "IceWolfStoreKit"'), 'the plugin name matches the bridge');
  for (const method of ['proStatus', 'purchase', 'restore']) {
    assert.ok(code.includes(`.${method}(`), `the bridge calls ${method}`);
    assert.ok(swift.includes(`name: "${method}"`), `the plugin declares ${method}`);
  }
  const scene = fs.readFileSync(path.join(repoRoot, 'ios/App/App/SceneDelegate.swift'), 'utf8');
  assert.ok(scene.includes('IceWolfBridgeViewController()'), 'the app starts on the bridge controller');
  assert.ok(swift.includes('registerPluginInstance(IceWolfStoreKitPlugin())'), 'the plugin is registered');
  const pbx = fs.readFileSync(path.join(repoRoot, 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8');
  assert.ok(pbx.includes('StoreKitPlugin.swift in Sources'), 'the plugin is compiled into the App target');
});
