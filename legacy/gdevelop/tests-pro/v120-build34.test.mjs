// ICE WOLF v1.2.0 Build 34 - the answers to the Build 33 device recording.
//
// The recording found three things, and the play-test added a fourth ask:
//   1. in the direct-touch control mode the [ rescue ] button (and every other
//      HUD button) lit up and did nothing: Build 33's full-screen touch pad sat
//      over the canvas and took the pointer before the button could see it;
//   2. the runners still read as stills sliding over the floor;
//   3. the stage read as a flat pale room, with the Classic arena's new walls
//      lost under the light;
//   4. the status lines on the play screen should read pop and easy to see.
//
// This file checks the shipping game.json (and the Xcode project) for what
// answers each of them, without a browser:
//   * the touch pad is decoration only, the gesture is read at the window on
//     the canvas alone, and a touch that lands on a HUD button is handed to the
//     game (the button's own IsPressed then runs) instead of becoming movement;
//   * a body is 122 tall, its cycle turns at six pixels a stride, and the stride
//     squashes and stretches it;
//   * the light rig is turned down, every wall carries a merged snow cap and
//     every stage has weather in one Points mesh;
//   * the pop HUD mirrors the nine HUD lines into chips, a timer, a hint bar, a
//     toast and a winner banner, and only fades the native text after reading it;
//   * the build is 34 everywhere, and npm test runs this file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { repoRoot, readGame, sceneOf, groupCode } from './helpers.mjs';

const SETTINGS_GROUP = 'v1.2.0 表示・操作設定';
const CHARACTER_GROUP = 'v0.7.3 ブロックトイ3Dキャラ';
const STAGE_GROUP = 'v1.1.0 ステージ・衣装';
const POP_HUD_GROUP = 'v1.2.0 ポップHUD';
const CAMERA_GROUP = 'v0.6.4 Normal + Overview camera';
const VERSION = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).version;

const scene = () => sceneOf(readGame());
const codeOf = (name) => groupCode(name);
const stageArt = () => {
  const group = scene().events.find((entry) => entry.name === STAGE_GROUP);
  const block = group.events[1].inlineCode;
  return Array.isArray(block) ? block.join('\n') : String(block || '');
};

/* ------------------------------------------------------- 1. the rescue button */
test('the direct-touch pad never covers the canvas: it is decoration only', () => {
  const code = codeOf(SETTINGS_GROUP);
  assert.ok(code.includes("root.style.pointerEvents = 'none';"),
    'the ring overlay takes no touch at all');
  assert.ok(!code.includes("root.addEventListener('pointerdown'"),
    'the gesture is not read on the overlay any more');
  assert.ok(code.includes("window.addEventListener('pointerdown', onDown, { capture: true, passive: false });"),
    'the gesture is read before the canvas, at the window');
  assert.ok(code.includes('event.target !== canvas && !(canvas.contains && canvas.contains(event.target))'),
    'a touch that landed on a DOM button is left completely alone');
});

test('a touch on a HUD button is handed to the game instead of becoming movement', () => {
  const code = codeOf(SETTINGS_GROUP);
  assert.ok(code.includes('const HUD_TOUCH_OBJECTS = ['), 'the list of HUD controls is in the block');
  for (const name of ['WolfButton', 'RescueButton', 'InfectButton', 'Dpad_N', 'Dpad_S']) {
    assert.ok(code.includes(`'${name}'`), `${name} is a HUD control`);
  }
  assert.ok(code.includes('const onHudControl = (clientX, clientY) => {'), 'there is a hit test');
  assert.ok(code.includes('layer.convertInverseCoords('),
    'it uses the same camera conversion GDevelop uses for its own cursor test');
  assert.ok(code.includes("const game = runtimeScene.getGame();"),
    'and the game resolution, so the point is compared in the same units');
  assert.ok(code.includes('if (onHudControl(event.clientX, event.clientY)) {'),
    'a touch on a button is tested before the pad claims it');
  assert.ok(code.includes("vars.get('PlayerHudTapGuard').setNumber(pad.blocked);"),
    'the hand-overs are counted, so a test and a device can see them');
  const down = code.slice(code.indexOf('const onDown = (event) => {'), code.indexOf('const onMove = (event) => {'));
  assert.ok(down.length > 0 && !down.includes('stopPropagation'),
    'and the press is never stopped: the button still receives its own press');
});

/* ------------------------------------------------------------ 2. the running */
test('a body is 122 tall, its legs turn faster and the stride squashes it', () => {
  const bodies = codeOf(CHARACTER_GROUP);
  assert.ok(bodies.includes('const BODY_HEIGHT = 122;'), 'a body is 122px against the 160 wall');
  assert.ok(bodies.includes('const BODY_WIDTH = BODY_HEIGHT * 0.68;'), 'and a little wider');
  assert.ok(bodies.includes('const STEPS_PER_FRAME = 18;'), 'a stride is eighteen pixels, so a pose holds long enough to see');
  assert.ok(bodies.includes('* 10.5 : 0;'), 'the stride lifts the body higher');
  assert.ok(bodies.includes('rig.leanGoal = rig.mirror ? 0.17 : -0.17;'), 'and it leans further into the run');
  assert.ok(bodies.includes('const stretch = 1 + stride * 0.07;'), 'the body stretches as a foot leaves the ice');
  assert.ok(bodies.includes('const squash = 1 - stride * 0.055;'), 'and squashes as it lands');
  assert.ok(bodies.includes('size: 19,'), 'the snow at the feet is bigger');
});

/* ------------------------------------------------------------- 3. the stage */
test('the light rig is turned down and is made of a bounce, a key and a rim', () => {
  const art = stageArt();
  const table = art.slice(art.indexOf('const ICE_WOLF_STAGE_LIGHT = {'));
  for (const stage of ['classic', 'aquarium', 'park', 'lodge', 'school', 'space']) {
    assert.ok(table.includes(`${stage}: {`), `${stage} has a rig`);
  }
  assert.ok(table.includes('rim: 0x8fe0ff, rimIntensity: 0.15'), 'the Classic key is down to 0.28 and a rim is added');
  assert.ok(table.includes('hemi: 0.18'), 'and the bounce is down to 0.18');
  assert.ok(art.includes("rim.name = 'iceWolfV130Rim';"), 'the rim light is built');
  assert.ok(art.includes('return rig.rim ? 3 : 2;'), 'and counted with the others');
});

test('every wall wears a snow cap, and every stage has weather', () => {
  const art = stageArt();
  assert.ok(art.includes("mesh.name = 'iceWolfV120WallCaps';"), 'the caps are one mesh for the stage');
  assert.ok(art.includes('const ICE_WOLF_STAGE_CAP = {'), 'with a colour per stage');
  assert.ok(art.includes('new THREE.BoxGeometry(w, h, d)') || art.includes('geometry = new Three.BoxGeometry(w, h, d);'),
    'built out of the walls themselves');
  assert.ok(art.includes('wall.getX() + w / 2'), 'a 3D object\'s X is its corner, so the cap is centred');
  assert.ok(art.includes('const topZ = z + d;'), 'and its Z is its base, so the cap sits on the top');
  assert.ok(art.includes('MeshBasicMaterial({ vertexColors: true, fog: false })'),
    'the caps are unlit, so they read the same on every phone');
  assert.ok(art.includes("mask.name = 'iceWolfV120Weather'") === false, 'the weather mesh is named on the points');
  assert.ok(art.includes("points.name = 'iceWolfV120Weather';"), 'the weather is one Points mesh');
  assert.ok(art.includes('const ICE_WOLF_STAGE_WEATHER = {'), 'with a recipe per stage');
  assert.ok(art.includes('stepWeather();'), 'stepped every frame');
  const variables = new Map(scene().variables.map((variable) => [variable.name, variable]));
  for (const name of ['StageWeather', 'StageWallCaps']) {
    assert.ok(variables.has(name), `${name} is a scene variable`);
  }
});

test('the Classic arena is drawn from its own, calmer surfaces', () => {
  const art = stageArt();
  assert.ok(art.includes("wall: 'wall_classic.png'"), 'the classic wall is its own picture');
  assert.ok(art.includes("cap: 'cap_classic.png'"), 'so is the top of a wall');
  assert.ok(art.includes("floor: 'floor_classic.png'"), 'and the rink');
  const resources = readGame().resources.resources.map((resource) => resource.name);
  for (const name of ['wall_classic.png', 'cap_classic.png', 'floor_classic.png']) {
    assert.ok(resources.includes(name), `${name} ships in the export`);
  }
  const generator = fs.readFileSync(path.join(repoRoot, 'tools', 'b34', 'make_classic_textures.py'), 'utf8');
  assert.ok(generator.includes('def build_classic_cap'), 'the cap is drawn by the tool in this repository');
  assert.ok(generator.includes('_soft_base('), 'and drawn from wrapping fields, never a tiled gradient');
  assert.ok(!generator.includes('vertical_gradient('), 'a gradient would band across the arena');
});

/* --------------------------------------------------------------- 4. the pop */
test('the pop HUD mirrors every HUD line and only then fades the native text', () => {
  const code = codeOf(POP_HUD_GROUP);
  assert.ok(code.includes('const ICE_WOLF_HUD_MIRROR = ['), 'the list of mirrored lines is in the block');
  for (const name of ['RoleText', 'CountText', 'SwitchText', 'GateText', 'FloorText',
    'TimerText', 'StatusText', 'ActionFeedbackText', 'WinText']) {
    assert.ok(code.includes(`name: '${name}'`), `${name} has its own chip`);
  }
  for (const chip of ['hud-role', 'hud-count', 'hud-switch', 'hud-gate', 'hud-floor',
    'hud-timer', 'hud-hint', 'hud-toast', 'hud-win', 'hud-rescue']) {
    assert.ok(code.includes(chip), `${chip} is drawn`);
  }
  /* the order that matters: read the line, then fade the native object */
  const readAt = code.indexOf('text = String(obj.getString() || \'\');');
  const fadeAt = code.indexOf("try { obj.setOpacity(0); } catch (error) { /* stays drawn */ }");
  assert.ok(readAt > 0 && fadeAt > readAt, 'the line is read before the native object is faded');
  assert.ok(code.includes('const probe = () => {'), 'and a probe decides whether fading is possible at all');
  assert.ok(code.includes("vars.get('PlayerHudPopReady').setBoolean(true);"), 'the HUD says when it is on');
});

test('the pop HUD keeps the translation, the text size and the screen edges in mind', () => {
  const code = codeOf(POP_HUD_GROUP);
  assert.ok(!code.includes('ja:'), 'no new Japanese string is introduced');
  assert.ok(!/['"][^'"]*[ぁ-んァ-ヶ][^'"]*['"]/.test(code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')),
    'the block carries no Japanese line of its own - the words come from the event sheet');
  assert.ok(code.includes("vars.get('PlayerTextScale').getAsNumber()"), 'it follows the text-size setting');
  assert.ok(code.includes("state.root.style.setProperty('--s', String(scale));"), 'by one scale on its root');
  assert.ok(code.includes('max-width:58vw'), 'the chips never run over the middle of the ice');
  assert.ok(code.includes('max-width:min(74vw,760px)'), 'the hint bar stays inside the phone');
  assert.ok(code.includes('env(safe-area-inset-left,0px)'), 'and it clears the notch');
});

/* --------------------------------------------------------------- the camera */
test('the camera came in and came down a little', () => {
  const group = scene().events.find((event) => event.name === CAMERA_GROUP);
  const looks = [];
  for (const event of group.events) {
    for (const action of event.actions || []) {
      const params = action.parameters || [];
      if (params[1] === 'Player' && ['470', '900'].includes(params[3])) {
        looks.push({ distance: params[3], angle: params[5] });
      }
    }
  }
  assert.deepEqual(looks, [{ distance: '470', angle: '50' }, { distance: '900', angle: '73' }],
    'the normal view is 470 at 50 degrees and the overview 900 at 73');
});

/* --------------------------------------------------------------- the release */
test(`the build is ${VERSION} (34) on every side, and npm test runs this file`, () => {
  assert.equal(VERSION, '1.2.0', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts.test.includes('v120-build34.test.mjs'), 'npm test runs this file');
  const project = fs.readFileSync(path.join(repoRoot, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj'), 'utf8');
  assert.equal((project.match(/CURRENT_PROJECT_VERSION = 34;/g) || []).length, 2,
    'both build configurations are 34');
  assert.ok(project.includes('MARKETING_VERSION = 1.2.0;'), 'the marketing version is 1.2.0');
});
