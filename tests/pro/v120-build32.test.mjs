// ICE WOLF v1.2.0 (Build 32) — the visual refresh, the three settings and the
// one rule change.
//
// What this file holds to:
//   * the opening wolf keeps the wolf's body for the whole match, and only a
//     wolf made during the round transforms (the rule the brief sets);
//   * the characters are the generated pictures: 18 sprite sheets, four frames
//     each, transparent, one per stage outfit, registered in the project and
//     put on the ice as one billboard per body;
//   * SETTINGS carries text size (標準 / 大 / 特大), vibration and the control
//     chooser (stick / direct touch), all remembered, all twelve languages;
//   * the opening is short, skippable, and leaves no DOM behind;
//   * the icon is a 1024x1024 RGB PNG, in the iOS asset catalogue;
//   * nothing the 1.0.0/1.1.0 game relied on (online, Pro, the twelve-language
//     table, the numbers a player feels) is broken.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';

import { repoRoot, readGame, sceneOf, groupCode, decodePng, createI18n, LANGS, KANA } from './helpers.mjs';

const CHARACTER_GROUP = 'v0.7.3 ブロックトイ3Dキャラ';
const LABEL_GROUP = 'v0.6.2 Color-independent Actor ID Labels';
const SETTINGS_GROUP = 'v1.2.0 表示・操作設定';
const OPENING_GROUP = 'v1.2.0 オープニング';
const MENU_GROUP = 'v0.6.5 Production Round Start + Main Menu';
const OUTFITS = ['classic', 'aquarium', 'park', 'lodge', 'school', 'space'];

const VERSION = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).version;

const blockOf = (groupName, marker) => {
  const code = groupCode(groupName);
  const start = code.indexOf(marker);
  const end = code.indexOf(marker.replace('/* ==== ', '/* ==== end '), start);
  if (start < 0 || end < 0) throw new Error(`${groupName} is missing the marker ${marker}`);
  return code.slice(start, end);
};

const wolfLookBlock = () => {
  const code = blockOf(CHARACTER_GROUP, '/* ==== v1.2.0 wolf look');
  const context = vm.createContext({});
  vm.runInContext(`${code}\nglobalThis.__w = { iceWolfLooksLikeWolf, iceWolfIsOpeningWolf, ICE_WOLF_INITIAL_ORIGINS };`,
    context, { filename: 'game.json#wolf look' });
  return context.__w;
};

const displayBlock = () => {
  const code = blockOf(SETTINGS_GROUP, '/* ==== v1.2.0 display settings');
  const context = vm.createContext({});
  vm.runInContext(`${code}\nglobalThis.__d = { ICE_WOLF_TEXT_SIZES, iceWolfTextScale, ICE_WOLF_CONTROL_MODES, iceWolfControlMode };`,
    context, { filename: 'game.json#display settings' });
  return context.__d;
};

/* ------------------------------------------------------- the one rule change */
test('the opening wolf never disguises itself; a wolf made during the round does', () => {
  const { iceWolfLooksLikeWolf, iceWolfIsOpeningWolf } = wolfLookBlock();
  /* the deal's wolf: an empty origin, or "initial" once written */
  assert.equal(iceWolfLooksLikeWolf('Wolf', '', 0), true, 'the opening wolf is a wolf with no mode running');
  assert.equal(iceWolfLooksLikeWolf('Wolf', 'initial', 0), true, 'and stays one after the origin is named');
  assert.equal(iceWolfIsOpeningWolf('Wolf', ''), true);
  assert.equal(iceWolfIsOpeningWolf('Wolf', 'initial'), true);
  /* a wolf made during the round: a person until its own five seconds */
  for (const origin of ['trap', 'infect', 'cpu']) {
    assert.equal(iceWolfLooksLikeWolf('Wolf', origin, 0), false, `${origin}: a person outside the mode`);
    assert.equal(iceWolfLooksLikeWolf('Wolf', origin, 0.4), true, `${origin}: the wolf for its mode`);
    assert.equal(iceWolfIsOpeningWolf('Wolf', origin), false, `${origin}: never the opening wolf`);
  }
  /* a human is never a wolf, whatever the timers say */
  assert.equal(iceWolfLooksLikeWolf('Human', '', 5), false);
  assert.equal(iceWolfLooksLikeWolf('Human', 'initial', 5), false);
  assert.equal(iceWolfIsOpeningWolf('Human', ''), false);
  /* the look is the shipping decision, not a second copy of it */
  const code = groupCode(CHARACTER_GROUP);
  assert.ok(code.includes('const transformed = iceWolfLooksLikeWolf(role, origin, modeLeft);'),
    'the character block asks the rule');
  assert.ok(code.includes('const alwaysWolf = iceWolfIsOpeningWolf(role, origin);'),
    'and knows which wolf the round opened with');
});

test('the picture never touches the rule: the character block only reads role and state', () => {
  /* The rescue button is decided by Role === "Human" elsewhere. A wolf made
   * during the round keeps Role "Wolf" while it walks as a person, so it is
   * excluded exactly as before - provided the picture never writes the role. */
  const code = groupCode(CHARACTER_GROUP);
  assert.equal(/get\('Role'\)\.setString/.test(code), false, 'the look never writes a role');
  assert.equal(/get\('State'\)\.setString/.test(code), false, 'nor a state');
  assert.equal(/RescueHold|RescueButton/.test(code), false, 'and it never reaches the rescue');
});

/* --------------------------------------------------------------- the pictures */
test('the characters are the generated pictures: six outfits each, four frames', () => {
  const game = readGame();
  const names = new Set(game.resources.resources.map((entry) => entry.name));
  for (const who of ['h1', 'h2', 'w1']) {
    for (const outfit of OUTFITS) {
      const name = `chr_${who}_${outfit}.png`;
      assert.ok(names.has(name), `${name} is a project resource`);
      const file = path.join(repoRoot, 'assets', name);
      assert.ok(fs.existsSync(file), `${name} is on disk`);
      const png = decodePng(file);
      assert.equal(png.width, 800, `${name} is four 200px cells wide`);
      assert.equal(png.height, 200, `${name} is one cell tall`);
      assert.equal(png.channels, 4, `${name} keeps its transparency`);
      /* the corner of every cell is the transparent studio background */
      for (let frame = 0; frame < 4; frame += 1) {
        const x = frame * 200 + 2;
        const y = 2;
        const alpha = png.pixels[y * png.stride + x * 4 + 3];
        assert.equal(alpha, 0, `${name} frame ${frame} is cut out`);
      }
      /* the four cells are four different moments of the run */
      const cell = (frame) => {
        let sum = 0;
        for (let y = 0; y < 200; y += 5) {
          for (let x = 0; x < 200; x += 5) {
            const index = y * png.stride + (frame * 200 + x) * 4;
            sum += (png.pixels[index] + png.pixels[index + 1] + png.pixels[index + 2] + 1) * (x * 3 + y * 7 + 1);
          }
        }
        return sum;
      };
      const sums = [0, 1, 2, 3].map(cell);
      assert.equal(new Set(sums).size, 4, `${name} draws four different frames`);
    }
  }
});

test('the character block draws those pictures and keeps the body it replaced', () => {
  const code = groupCode(CHARACTER_GROUP);
  assert.ok(code.includes("const spriteFile = (who, outfit) => 'chr_' + who + '_' + outfit + '.png';"),
    'the sheet name is the resource name');
  assert.ok(code.includes('new Three.SpriteMaterial'), 'each body is one billboard');
  assert.ok(code.includes('const FRAME_COUNT = 4;'), 'four frames');
  assert.ok(code.includes('map.offset.set'), 'the frame is an offset, not a new texture');
  assert.equal(code.includes('previous.dispose'), false,
    'a sheet clone is never disposed out from under the other bodies');
  assert.ok(code.includes("sprite.center.set(0.5, 0)"), 'the picture stands on the feet');
  assert.ok(code.includes("root.material = hiddenMaterial()"), 'the cube under the picture is hidden, not deleted');
  assert.ok(code.includes('PlayerSpriteMode'), 'the block publishes what it built');
  /* one shared texture per sheet, ten bodies at most */
  assert.ok(code.includes('store.textures[name]'), 'a sheet is loaded once');
  assert.ok(!code.includes('new Three.BoxGeometry(12.4'), 'the block-character geometry is gone');
});

/* -------------------------------------------------------------- the settings */
test('text size is three steps, and the largest still fits the phone', () => {
  const { ICE_WOLF_TEXT_SIZES, iceWolfTextScale } = displayBlock();
  assert.equal(ICE_WOLF_TEXT_SIZES.map((entry) => entry.id).join(','), 'standard,large,xlarge');
  assert.equal(iceWolfTextScale('standard'), 1);
  assert.ok(iceWolfTextScale('large') > 1 && iceWolfTextScale('large') < iceWolfTextScale('xlarge'),
    'the steps grow in order');
  assert.ok(iceWolfTextScale('xlarge') <= 1.3, 'and stay inside a landscape phone');
  assert.equal(iceWolfTextScale('nonsense'), 1, 'an unknown value is the standard size');
  const code = groupCode(SETTINGS_GROUP);
  assert.ok(code.includes('--iw-ui-zoom'), 'the sheets scale through one CSS variable');
  assert.ok(code.includes('/ var(--iw-ui-zoom,1))'), 'and the card width is divided by it, so it cannot run off the edge');
  assert.ok(code.includes("document.documentElement.setAttribute('data-iw-text'"), 'the choice reaches the page');
  assert.ok(code.includes("vars.get('PlayerTextScale').setNumber"), 'and the head bubbles');
});

test('vibration is a switch with the native plugin first and the web API second', () => {
  const code = groupCode(SETTINGS_GROUP);
  assert.ok(code.includes('Plugins.Haptics'), 'Capacitor Haptics when the shell has it');
  assert.ok(code.includes('navigator.vibrate'), 'navigator.vibrate otherwise');
  assert.ok(code.includes("safeSet('iceWolfVibration'"), 'the choice is remembered');
  for (const trigger of ['frozen', 'wolfMode', 'switches', 'gate', 'rescues']) {
    assert.ok(code.includes(`watch.${trigger}`), `${trigger} buzzes`);
  }
  assert.ok(code.includes('if (state.vibration !== true) return;'), 'OFF is silent');
});

test('the control chooser offers the stick and the direct touch, and keeps both', () => {
  const { ICE_WOLF_CONTROL_MODES, iceWolfControlMode } = displayBlock();
  assert.equal(Array.from(ICE_WOLF_CONTROL_MODES).join(','), 'stick,touch');
  assert.equal(iceWolfControlMode('touch'), 'touch');
  assert.equal(iceWolfControlMode('stick'), 'stick');
  assert.equal(iceWolfControlMode(''), 'stick');
  const code = groupCode(SETTINGS_GROUP);
  assert.ok(code.includes("vars.get('JoystickX').setNumber(ux)"), 'the drag writes the same vector as the stick');
  assert.ok(code.includes("vars.get('PlayerControlMode')"), 'the choice is published');
  assert.ok(code.includes('joystick.root.style.display'), 'the stick stands down only in touch mode');
  assert.ok(code.includes("data-ice-wolf-v120-touch"), 'the touch layer has its own element');
  /* the shipped movement block still reads one pair of variables */
  const movement = sceneOf(readGame()).events
    .filter((group) => group.name === 'v0.6.3 Virtual joystick + keyboard movement (fixed camera)')
    .flatMap((group) => group.events.map((event) => (Array.isArray(event.inlineCode) ? event.inlineCode.join('\n') : event.inlineCode || '')))
    .join('\n');
  assert.ok(movement.includes("vars.get('JoystickActive')"), 'the movement still reads the stick variables');
});

test('every new SETTINGS line is in all twelve languages, with no kana outside Japanese', () => {
  const { i18n } = createI18n();
  const keys = ['settings.textSize', 'settings.control', 'settings.vibration',
    'display.standard', 'display.large', 'display.xlarge', 'display.note',
    'control.stick', 'control.touch', 'vibration.on', 'vibration.off'];
  for (const key of keys) {
    for (const lang of LANGS) {
      i18n.setLang(lang);
      const line = i18n.t(key);
      assert.ok(line && line !== key, `${key} [${lang}] exists`);
      if (lang !== 'ja') assert.equal(KANA.test(line), false, `${key} [${lang}] carries Japanese kana: ${line}`);
    }
  }
});

/* ---------------------------------------------------------------- the opening */
test('the opening is short, skippable and leaves nothing behind', () => {
  const code = groupCode(OPENING_GROUP);
  assert.ok(code.includes('setTimeout(finish, 1900)'), 'about two seconds');
  assert.ok(code.includes("addEventListener('pointerdown', onSkip"), 'a tap skips it');
  assert.ok(code.includes("root.parentNode.removeChild(root)"), 'the overlay is removed, not hidden');
  assert.ok(code.includes("stopPropagation"), 'the skip never reaches the menu under it');
  assert.ok(!code.includes('requestAnimationFrame'), 'no per-frame work while the game builds');
  assert.ok(code.includes('data-ice-wolf-v120-opening'), 'it is one marked element');
});

/* ------------------------------------------------------------------ the icon */
test('the app icon is the new picture, 1024x1024 and opaque', () => {
  const icon = path.join(repoRoot, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-512@2x.png');
  const png = decodePng(icon);
  assert.equal(png.width, 1024);
  assert.equal(png.height, 1024);
  assert.equal(png.channels, 3, 'an App Store icon has no alpha channel');
  const contents = JSON.parse(fs.readFileSync(path.join(path.dirname(icon), 'Contents.json'), 'utf8'));
  assert.equal(contents.images[0].filename, 'AppIcon-512@2x.png');
  const hero = decodePng(path.join(repoRoot, 'assets', 'menu_hero.png'));
  assert.equal(hero.width, 512, 'the menu hero is the same picture');
});

/* ------------------------------------------------------------------ the sheet */
test('the two new blocks are at the end of the sheet and the 1.0.0 order is intact', () => {
  const scene = sceneOf(readGame());
  const names = scene.events.map((group) => group.name);
  const settings = names.indexOf(SETTINGS_GROUP);
  const opening = names.indexOf(OPENING_GROUP);
  assert.ok(settings >= 0 && opening >= 0, 'both blocks are on the sheet');
  assert.ok(settings > names.indexOf('v1.1.0 鬼の状態リセット'), 'after the v1.1.0 readers');
  assert.ok(opening > names.indexOf('v1.1.0 鬼の状態リセット'));
  assert.ok(settings >= names.length - 2 && opening >= names.length - 2, 'at the very end');
  assert.ok(names.indexOf('v1.1.0 オンライン対戦同期') < settings, 'the sync still writes before them');
});

test('the label block puts the bubble above the taller picture, and lifts a crowded one', () => {
  const code = groupCode(LABEL_GROUP);
  assert.ok(code.includes('projected.z += 46'), 'the bubble samples the head, not the cube centre');
  assert.ok(code.includes('LABEL_GAP_Y'), 'a bubble can be lifted off the one in front');
  assert.ok(code.includes("obj.getVariables().get('LabelText')"), 'a name still wins over the letter');
  assert.ok(code.includes("obj.getVariables().get('DisplayId').getAsString()"), 'and the letter is the fallback');
});

/* ------------------------------------------------------------- the release */
test(`the build is ${VERSION} (32) on every side, and npm test runs this file`, () => {
  assert.equal(VERSION, '1.2.0', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts.test.includes('v120-build32.test.mjs'), 'npm test runs this file');
  const pbx = fs.readFileSync(path.join(repoRoot, 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8');
  const marketing = [...pbx.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map((match) => match[1]);
  assert.deepEqual(marketing, [VERSION, VERSION], 'MARKETING_VERSION in both configurations');
  const builds = [...pbx.matchAll(/CURRENT_PROJECT_VERSION = ([^;]+);/g)].map((match) => match[1]);
  assert.deepEqual(builds, ['32', '32'], 'Build 32 in the Xcode project, never a number twice');
  const verify = fs.readFileSync(path.join(repoRoot, 'scripts/ios/verify-ios-project.py'), 'utf8');
  assert.ok(verify.includes(`DEFAULT_MARKETING_VERSION = "${VERSION}"`), 'the verifier defaults to this version');
  assert.ok(verify.includes('DEFAULT_BUILD_NUMBER = "32"'), 'and to this build');
  assert.equal(readGame().properties.version, VERSION, 'the GDevelop project version');
  const menu = groupCode(MENU_GROUP);
  assert.ok(menu.includes(`ICE WOLF v${VERSION}`), 'the menu says which build it is');
  assert.ok(menu.includes('iceWolfV120Menu'), 'and the v1.2.0 markup is the one on it');
});

test('the menu keeps every entry it had: START, STAGE, ONLINE, HOW, RECORD, SETTINGS, PRO', () => {
  const menu = groupCode(MENU_GROUP);
  for (const action of ['start', 'stage', 'online', 'how', 'record', 'settings', 'pro']) {
    assert.ok(menu.includes(`data-action="${action}"`), `the menu still carries ${action}`);
  }
  assert.ok(menu.includes('data-i18n="menu.start"') && menu.includes('data-i18n="pro.menu"'),
    'and every line still comes from the twelve-language table');
});
