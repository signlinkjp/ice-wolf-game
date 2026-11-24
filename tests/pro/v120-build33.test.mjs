// ICE WOLF v1.2.0 Build 33 - "step 2" of the device play-test.
//
// The play-test (Build 32, filmed on the phone) found four things:
//   1. after a match the menu's SETTINGS and PRO lit up and opened nothing, and
//      the card slid up and down;
//   2. the runners were small stills sliding over the floor, and a wall could
//      hide one completely;
//   3. the stick sat a little toward the middle and the right-edge pills were
//      cut in half;
//   4. the stages should beat DOROKEI and KACHI-KACHI CATCH in looks, gimmicks
//      and action.
//
// This file checks the shipping game.json (and the Xcode project) for what
// answers each of them, without a browser:
//   * the sheet takes the tap once, at its root, in the capture phase, for
//     pointerdown / touchstart / click - the gesture a browser cannot take away
//     for a scroll - and the card is scaled to fit so it never scrolls;
//   * a body is 112 tall against the 160 wall, its run cycle is faster, it
//     leans, bobs and throws snow, and it is drawn over the walls;
//   * the camera came in, the pills are clamped inside the canvas and the stick
//     sits in the safe-area corner;
//   * the action layer (v1.3.0 アクション演出) and the stage's air/backdrop run
//     last, and the Classic arena has a set of its own;
//   * the build is 33 everywhere, and npm test runs this file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { repoRoot, readGame, sceneOf, groupCode } from './helpers.mjs';

const MENU_GROUP = 'v0.6.5 Production Round Start + Main Menu';
const CHARACTER_GROUP = 'v0.7.3 ブロックトイ3Dキャラ';
const CAMERA_GROUP = 'v0.6.4 Normal + Overview camera';
const PILL_GROUP = 'v0.7.0 2階・階段・5スイッチ・3ゲート';
const JOYSTICK_GROUP = 'v0.6.4 Device-Tuned Mobile Virtual Joystick UI';
const STAGE_GROUP = 'v1.1.0 ステージ・衣装';
const FX_GROUP = 'v1.3.0 アクション演出';
const VERSION = '1.2.0';
const BUILD = '33';

const lastBlockOf = (groupName) => {
  const group = sceneOf(readGame()).events.find((event) => event.name === groupName);
  assert.ok(group, `${groupName} is on the sheet`);
  const raw = group.events[group.events.length - 1].inlineCode;
  return Array.isArray(raw) ? raw.join('\n') : String(raw || '');
};

const codeOf = (groupName) => {
  const raw = groupCode(groupName);
  return Array.isArray(raw) ? raw.join('\n') : raw;
};

/* ------------------------------------------------------------------ the menu */
test('the sheet takes the tap itself, once, at its root', () => {
  const menu = codeOf(MENU_GROUP);
  /* Build 32 listened on each button's own pointerdown; a browser may take that
   * gesture for a pan of the sheet, and the tap is spent on scrolling. */
  assert.ok(menu.includes("for (const tapType of ['pointerdown', 'touchstart', 'click'])"),
    'the sheet listens for all three gestures a WebView may deliver');
  assert.ok(menu.includes('root.addEventListener(tapType, sheetTap, { passive: false, capture: true })'),
    'and takes them at the root, first');
  assert.ok(menu.includes("event.target.closest('[data-action]')"),
    'the action is read from the element under the finger');
  assert.ok(menu.includes('const MENU_ACTIONS'), 'only the menu\'s own actions are taken');
  assert.ok(menu.includes('action === lastTapAction') && menu.includes('< 500'),
    'one tap is answered once, never twice');
  assert.equal(/querySelectorAll\('\[data-action\]'\)\) \{\n    button\.addEventListener\('pointerdown'/.test(menu), false,
    'no per-button pointerdown listener is left behind');
});

test('the menu card fits the phone, and the sheet keeps the screen that was asked for', () => {
  const menu = codeOf(MENU_GROUP);
  assert.ok(menu.includes('fitMenuCard'), 'the card is scaled until the menu fits');
  assert.ok(menu.includes('ui.sheet.screen'), 'the requested screen is remembered');
  assert.ok(menu.includes("if (shown !== wanted) ui.showOnly(wanted);"),
    'and put back on a frame that painted over it');
  /* SETTINGS and PRO are the two buttons the play-test could not open. */
  for (const action of ['settings', 'pro']) {
    assert.ok(menu.includes(`action === '${action}'`), `${action} is still wired`);
  }
});

/* ------------------------------------------------------------- the running body */
test('a body stands 112 against the 160 wall, and it is drawn over the walls', () => {
  const bodies = codeOf(CHARACTER_GROUP);
  assert.ok(bodies.includes('const BODY_HEIGHT = 112;'), 'a body is 112px against the 160 wall');
  assert.ok(bodies.includes('const STEPS_PER_FRAME = 9;'), 'the four-frame cycle turns faster');
  assert.ok(bodies.includes('depthTest: false'), 'a wall can no longer hide a runner');
  assert.ok(bodies.includes('sprite.renderOrder = 12'), 'a body draws over the walls');
  for (const [needle, why] of [
    ['lean', 'the figure leans into its run'],
    ['bob', 'each stride lifts the body'],
    ['sprayAt', 'the feet throw snow'],
    ['PlayerRunSnow', 'the snow is published for the frame']
  ]) {
    assert.ok(bodies.includes(needle), why);
  }
});

test('the camera came in and steepened, so a wall hides less', () => {
  const group = sceneOf(readGame()).events.find((event) => event.name === CAMERA_GROUP);
  assert.ok(group, 'the camera group is on the sheet');
  const looks = [];
  for (const event of group.events) {
    for (const action of event.actions || []) {
      const params = action.parameters || [];
      if (params[1] === 'Player' && (params[3] === '500' || params[3] === '600' || params[3] === '1050' || params[3] === '980')) {
        looks.push({ distance: params[3], angle: params[6] });
      }
    }
  }
  assert.deepEqual(looks, [{ distance: '500', angle: '58' }, { distance: '980', angle: '80' }],
    'the normal view is 500 at 58 degrees and the overview 980 at 80');
});

/* ------------------------------------------------------------------ the HUD */
test('a pill is clamped inside the canvas and the stick sits in the safe corner', () => {
  const pills = codeOf(PILL_GROUP);
  assert.ok(pills.includes('leftClamped'), 'a world pill is clamped on the x axis');
  assert.ok(pills.includes('topClamped'), 'and on the y axis');
  assert.ok(pills.includes('const halfW = labelSize.width / 2;'), 'the pill is kept whole');
  const stick = codeOf(JOYSTICK_GROUP);
  assert.ok(stick.includes("env(safe-area-inset-left"), 'the stick clears the notch');
  assert.ok(stick.includes("env(safe-area-inset-bottom"), 'and the home bar');
  assert.equal(stick.includes("root.style.left = '28px';"), false, 'it is not 28px in from the edge any more');
});

/* ----------------------------------------------------- the action and the air */
test('the action layer runs last and owns only its own effect state', () => {
  const scene = sceneOf(readGame());
  const names = scene.events.map((group) => group.name);
  assert.equal(names[names.length - 1], FX_GROUP, 'the action layer is the last block on the sheet');
  const fx = codeOf(FX_GROUP);
  for (const variable of ['StageFxPillars', 'StageFxRings', 'StageFxShards', 'StageFxFlashes',
    'StageFxPadRings', 'StageFxLive', 'StageFxFired']) {
    assert.ok(fx.includes(variable), `${variable} is published`);
    assert.ok(scene.variables.some((entry) => entry.name === variable), `${variable} is a scene variable`);
  }
  /* Decoration only: the numbers a player feels are never read or written. */
  for (const constant of ['WolfModeDuration', 'RescueHoldDuration', 'SpeedBoostFactor', 'SwitchHoldDuration']) {
    assert.equal(fx.includes(constant), false, `the action layer does not touch ${constant}`);
  }
});

test('every stage has its own air and backdrop, the Classic arena included', () => {
  const stage = lastBlockOf(STAGE_GROUP);
  assert.ok(stage.includes('ICE_WOLF_STAGE_LIGHT'), 'each stage brings its own light rig');
  assert.ok(stage.includes('ICE_WOLF_STAGE_BACKDROP'), 'and its own backdrop');
  assert.ok(stage.includes('HemisphereLight'), 'a hemisphere light carries the colour of the room');
  for (const id of ['classic', 'aquarium', 'park', 'lodge', 'school', 'space']) {
    assert.ok(stage.includes(`  ${id}: {`), `${id} has a recipe`);
  }
  /* Build 33 gave the Classic arena its own set; the frost lab stays as the
   * fallback for a stage whose PNGs never arrive. */
  assert.ok(stage.includes("wall: 'wall_classic.png'"), 'Classic has its own wall');
  assert.ok(stage.includes("floor: 'wall_frostlab.png'") || stage.includes("wall: 'wall_frostlab.png'"),
    'the 1.0.0 frost lab is still the fallback');
  assert.ok(stage.includes("'160x32': ['rink', 2]"), 'the Classic rink is dressed');
  for (const name of ['wall_classic.png', 'cap_classic.png', 'floor_classic.png']) {
    const entry = readGame().resources.resources.find((resource) => resource.name === name);
    assert.ok(entry, `${name} is declared in game.json`);
    assert.equal(entry.file, `assets/${name}`);
    assert.ok(fs.existsSync(path.join(repoRoot, 'assets', name)), `${name} is in assets/`);
  }
});

/* ---------------------------------------------------------------- the release */
test(`the build is ${VERSION} (${BUILD}) on every side, and npm test runs this file`, () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.version, VERSION, 'package.json');
  assert.ok(pkg.scripts.test.includes('v120-build33.test.mjs'), 'npm test runs this file');
  const pbx = fs.readFileSync(path.join(repoRoot, 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8');
  assert.deepEqual([...pbx.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map((match) => match[1]),
    [VERSION, VERSION], 'MARKETING_VERSION in both configurations');
  assert.deepEqual([...pbx.matchAll(/CURRENT_PROJECT_VERSION = ([^;]+);/g)].map((match) => match[1]),
    [BUILD, BUILD], `Build ${BUILD} in the Xcode project`);
  const verify = fs.readFileSync(path.join(repoRoot, 'scripts/ios/verify-ios-project.py'), 'utf8');
  assert.ok(verify.includes(`DEFAULT_BUILD_NUMBER = "${BUILD}"`), 'the verifier defaults to this build');
  assert.ok(verify.includes(`DEFAULT_MARKETING_VERSION = "${VERSION}"`), 'and to this version');
  assert.equal(readGame().properties.version, VERSION, 'the GDevelop project version');
});
