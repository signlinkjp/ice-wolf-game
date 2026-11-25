// ICE WOLF Build 26 — the four things the long play of Build 25 asked for, and
// where they live:
//
//   * the world's pills (🔒 LOCK, ◆/✓ ON, 🪜) keep out of the four bands the HUD
//     lives in, so the corner block is never painted over;
//   * ICE WOLF v1.1.0 leaves the STATUS line's row for the bottom-right corner;
//   * the stage banner is a slim pill under the clock instead of a slab across
//     the middle of the ice;
//   * a match carries three wolves at most, so a round that opens with two deals
//     no trap switch and the pick stops at the third.
//
// The rules are read out of game.json and run here; the screen is measured from
// the shipping instances, not described.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import { repoRoot, readGame, sceneOf, groupCode, createI18n, LANGS, KANA } from './helpers.mjs';

const ARENA_GROUP = 'v0.7.0 2階・階段・5スイッチ・3ゲート';
const FX_GROUP = 'v1.1.0 ステージ固有ギミック';
const MENU_GROUP = 'v0.6.5 Production Round Start + Main Menu';
const PICK_GROUP = 'v0.6.5 Survivor/Frozen counter + Wolf role pick';
const SYNC_GROUP = 'v1.1.0 オンライン対戦同期';
const CPU_GROUP = 'v0.6.1 Human CPU Navigation Recovery + CPU Wolf Cycle';

const blockOf = (code, open, close, names) => {
  const from = code.indexOf(open);
  const to = code.indexOf(close);
  if (from < 0 || to < 0) throw new Error(`markers missing: ${open}`);
  const context = vm.createContext({ Math, Number, String, Array, Object, console });
  vm.runInContext(`${code.slice(from, to)}\n;globalThis.__b = { ${names} };`, context,
    { filename: `game.json#${open}` });
  return context.__b;
};

/* The pick group is four code events; the guard sits in the second and third. */
const groupAllCode = (name) => {
  const group = sceneOf(readGame()).events.find((event) => event.name === name);
  if (!group) throw new Error(`event group not found: ${name}`);
  return group.events.map((event) => (Array.isArray(event.inlineCode)
    ? event.inlineCode.join('\n') : event.inlineCode || '')).join('\n');
};

const spotBlock = () => blockOf(groupCode(ARENA_GROUP), '/* ==== v1.1.3 label spots ==== */',
  '/* ==== end v1.1.3 label spots ==== */',
  'ICE_WOLF_HUD_BANDS, iceWolfLabelSpot, iceWolfLabelBox, iceWolfLabelOverlap');

const wolfBlock = () => blockOf(groupCode(ARENA_GROUP), '/* ==== v1.1.3 three wolves ==== */',
  '/* ==== end v1.1.3 three wolves ==== */',
  'ICE_WOLF_WOLF_MAX, iceWolfWolfRoom, iceWolfTrapAllowed');

const PILL = { width: 0.062, height: 0.028, lift: 0.017 };

/* ------------------------------------------------------------- the world's pills */
test('a pill goes above its pad, and keeps out of the HUD bands', () => {
  const { iceWolfLabelSpot, ICE_WOLF_HUD_BANDS } = spotBlock();
  assert.equal(ICE_WOLF_HUD_BANDS.length >= 3, true, 'the bands are declared');
  const middle = iceWolfLabelSpot({ x: 0.5, y: 0.5 }, PILL);
  assert.equal(middle.place, 'above', 'open ice: the pill stays above the pad');
  assert.ok(middle.y < 0.5 && middle.y > 0.4, `and sits just over it (${middle.y})`);
  /* Under the clock, the top spot is taken: the pill drops below the pad. */
  const underClock = iceWolfLabelSpot({ x: 0.5, y: 0.2 }, PILL);
  assert.equal(underClock.place, 'below', 'the clock and the banner own the top band');
  assert.ok(underClock.y > 0.2, 'so the pill moves down, not up');
  /* A pad inside the corner block has no room either way: nothing is drawn. */
  const corner = iceWolfLabelSpot({ x: 0.1, y: 0.21 }, PILL);
  assert.equal(corner.place, 'none', 'スイッチ / ゲート are never painted over');
  /* Just under the block the same pad keeps its pill, above it. */
  const lowCorner = iceWolfLabelSpot({ x: 0.1, y: 0.42 }, PILL);
  assert.equal(lowCorner.place, 'above', 'below the corner block there is room again');
});

test('the bands leave the middle of the ice and both bottom corners to the game', () => {
  const { ICE_WOLF_HUD_BANDS } = spotBlock();
  const free = (x, y) => !ICE_WOLF_HUD_BANDS.some((band) => x >= band.left && x <= band.right
    && y >= band.top && y <= band.bottom);
  assert.equal(free(0.5, 0.5), true, 'the centre is the play');
  assert.equal(free(0.15, 0.45), true, 'the left-middle lane too');
  assert.equal(free(0.5, 0.2), true, 'and the strip under the clock is not blocked itself');
  assert.equal(free(0.1, 0.21), false, 'while the corner block is');
  assert.equal(free(0.5, 0.03), false, 'and so is the clock');
  assert.equal(free(0.92, 0.08), false, 'and the MENU / CAM corner');
  assert.equal(free(0.12, 0.85), false, 'and the joystick');
});

test('every world label is placed through the spot, and the third place draws nothing', () => {
  const arena = groupCode(ARENA_GROUP);
  assert.ok(arena.includes('const spot = iceWolfLabelSpot('), 'the projection asks for a spot');
  assert.ok(arena.includes("if (spot.place === 'none') {"), 'and hides the pill it cannot place');
  assert.ok(arena.includes("el.style.transform = spot.place === 'above' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)';"),
    'above and below are the two ways a pill hangs');
  /* The lock, the switch and the stair labels all ride this one function. */
  for (const marker of ["tr('world.lock')", "spot.on ? '✓ ON' : '◆'", "'🪜 1F→2F'"]) {
    assert.ok(arena.includes(marker), `the label ${marker} is still drawn`);
  }
});

/* ---------------------------------------------------------------- the version line */
const rectOf = (scene, name) => {
  const instance = scene.instances.find((entry) => entry.name === name);
  assert.ok(instance, `${name} is on the sheet`);
  const width = instance.width || 0;
  const height = instance.height || 0;
  return { left: instance.x, right: instance.x + width, top: instance.y, bottom: instance.y + height };
};

test('ICE WOLF v1.1.0 leaves the STATUS row for the bottom-right corner', () => {
  const scene = sceneOf(readGame());
  const build = rectOf(scene, 'BuildText');
  const status = rectOf(scene, 'StatusText');
  const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  assert.equal(overlaps(build, status), false, 'the version line no longer crosses the STATUS line');
  for (const name of ['TimerText', 'RoleText', 'CountText', 'SwitchText', 'GateText', 'FloorText', 'WinText']) {
    assert.equal(overlaps(build, rectOf(scene, name)), false, `${name} and the version line are apart`);
  }
  assert.ok(build.top > 600, `it sits in the bottom band (${build.top})`);
  assert.ok(build.left > 900, `and on the right (${build.left})`);
  /* The bottom-right is free: the joystick is bottom-left, the hold button and
   * the rescue ring bottom-centre, MENU and CAM top-right. */
  assert.ok(build.left > 1280 * 0.7, 'right of the thumb');
  assert.ok(build.bottom <= 720, 'and still on the screen');
});

/* --------------------------------------------------------------- the slim banner */
test('the stage banner is a slim pill under the clock, not a slab over the ice', () => {
  const fx = groupCode(FX_GROUP);
  const css = fx.slice(fx.indexOf("'[data-ice-wolf-v111-fx] .iwfx-banner{"), fx.indexOf('.iwfx-banner.iwfx-on'));
  assert.ok(css.includes('top:0'), 'the pill is anchored to the top');
  assert.equal(css.includes('bottom:15%'), false, 'the slab across the middle is gone');
  assert.ok(css.includes('font-size:clamp(10px,1.35vw,13px)'), `the type is small (${css.slice(0, 40)}…)`);
  assert.ok(css.includes('padding:2px 11px'), 'and the pill is thin');
  assert.ok(css.includes('border-radius:999px'), 'still a pill');
  assert.ok(css.includes('white-space:nowrap'), 'one line, twelve languages');
  /* The top is measured from the canvas, so a letterboxed view still lands the
   * pill under the clock (whose box ends at 0.10 of the canvas height). */
  assert.ok(fx.includes('const placeBanner = () => {'), 'the pill is placed at run time');
  assert.ok(fx.includes('rectNow.height * 0.105'), 'a hair under the clock');
  assert.ok(fx.includes('if (showBanner) placeBanner();'), 'and only while it is up');
});

test('the banner lines still count down in every language', () => {
  const { i18n } = createI18n();
  for (const key of ['fx.park.coaster', 'fx.school.chime', 'fx.school.doors', 'fx.space.heavy', 'fx.space.rocket']) {
    for (const lang of LANGS) {
      i18n.setLang(lang);
      const line = i18n.t(key, { n: 5 });
      assert.ok(line.length > 0, `${key} [${lang}] is empty`);
      assert.equal(KANA.test(line) && lang !== 'ja', false, `${key} [${lang}] carries kana: ${line}`);
      assert.ok(line.includes('5'), `${key} [${lang}] names the seconds: ${line}`);
    }
  }
  for (const lang of LANGS) {
    i18n.setLang(lang);
    assert.ok(i18n.t('fx.lodge.blizzard').length > 0, `fx.lodge.blizzard [${lang}] is empty`);
  }
  i18n.setLang('ja');
  assert.ok(i18n.t('fx.park.coaster', { n: 4 }).length <= 20, 'the coaster line fits the slim pill');
});

/* --------------------------------------------------------------- three wolves */
test('a match carries three wolves at most', () => {
  const { ICE_WOLF_WOLF_MAX, iceWolfWolfRoom, iceWolfTrapAllowed } = wolfBlock();
  assert.equal(ICE_WOLF_WOLF_MAX, 3, 'the ceiling');
  assert.equal(iceWolfWolfRoom(2), true, 'two wolves: one more fits');
  assert.equal(iceWolfWolfRoom(3), false, 'three: the pack is full');
  /* The trap switch adds a wolf, so it is dealt only while the round has room. */
  assert.equal(iceWolfTrapAllowed(1, 10, 'Auto'), true, 'one wolf, eight or more players');
  assert.equal(iceWolfTrapAllowed(1, 8, 'Auto'), true, 'the automatic floor is eight');
  assert.equal(iceWolfTrapAllowed(1, 7, 'Auto'), false, 'seven players: no trap');
  assert.equal(iceWolfTrapAllowed(1, 10, 'AlwaysOn'), true, 'always on is honoured for one wolf');
  assert.equal(iceWolfTrapAllowed(1, 10, 'Off'), false, 'and off is off');
  assert.equal(iceWolfTrapAllowed(2, 10, 'AlwaysOn'), false, 'two opening wolves: never a trap');
  assert.equal(iceWolfTrapAllowed(2, 10, 'Auto'), false, 'two opening wolves: never a trap');
});

test('the round deals no trap pad when it opens with two wolves', () => {
  const arena = groupCode(ARENA_GROUP);
  assert.ok(arena.includes('iceWolfTrapAllowed(roundWolvesNow(), totalPlayersNow(), trapModeNow())'),
    'the deal asks the rule');
  assert.ok(arena.includes("const dealt = Math.round(vars.get('WolfCount').getAsNumber());"),
    'and the rule asks the round how many wolves it opened with');
  /* The deal itself is the shipping one: with the trap switched off, no pad. */
  const deal = blockOf(arena, '/* ==== v0.7.0 switch deal', '/* ==== end v0.7.0 switch deal ==== */',
    'iceWolfSwitchDeal, SWITCH_SPOTS');
  const spots1F = deal.SWITCH_SPOTS.filter((spot) => spot[0] < 792);
  const spots2F = deal.SWITCH_SPOTS.filter((spot) => spot[0] >= 792);
  for (const total of [3, 5, 7, 10]) {
    const drawn = deal.iceWolfSwitchDeal(total, 3, spots1F, spots2F, Math.random, false);
    assert.equal(drawn.switches.filter((sw) => sw.kind === 'trap').length, 0, `${total} pads, no trap`);
  }
});

test('the pick and the host stop at the third wolf', () => {
  const arena = groupCode(ARENA_GROUP);
  assert.ok(arena.includes("vars.get('WolfTotal').setNumber(wolfTotalPublished)"), 'the pack size is published');
  assert.ok(arena.includes("vars.get('WolfMax').setNumber(ICE_WOLF_WOLF_MAX)"), 'and the ceiling with it');
  assert.ok(arena.includes('if (!iceWolfWolfRoom(wolfTotalNow())) return;'), 'the trap checks before it converts');
  const pick = groupAllCode(PICK_GROUP);
  assert.ok(pick.includes("const packRoom = () => vars.get('WolfTotal').getAsNumber() < Math.max(1, vars.get('WolfMax').getAsNumber());"),
    'the picker asks the ceiling');
  assert.ok(pick.includes('&& packRoom()'), 'and refuses the designation at three');
  assert.ok(pick.includes('|| !packRoomNow'), 'and closes a picker that is already open');
  const sync = groupCode(SYNC_GROUP);
  assert.ok(sync.includes("vars.get('WolfTotal').getAsNumber() < Math.max(1, vars.get('WolfMax').getAsNumber())"),
    'the host applies the same ceiling to a guest wolf');
});

test('SETTINGS says a two-wolf match has no trap switch', () => {
  const menu = groupCode(MENU_GROUP);
  assert.ok(menu.includes("tr('settings.trapNoteTwoWolves'"), 'the row has a line for it');
  assert.ok(menu.includes("Math.round(Number(vars.get('WolfCountSetting').getAsNumber())) >= 2 ? 2 : 1"),
    'read from the round\'s own wolf count');
  const { i18n } = createI18n();
  for (const lang of LANGS) {
    i18n.setLang(lang);
    const line = i18n.t('settings.trapNoteTwoWolves', { p: 10 });
    assert.ok(line.length > 0, `settings.trapNoteTwoWolves [${lang}] is empty`);
    if (lang !== 'ja' && lang !== 'zh-Hans' && lang !== 'zh-Hant') {
      assert.equal(KANA.test(line), false, `settings.trapNoteTwoWolves [${lang}] carries kana: ${line}`);
    }
  }
  i18n.setLang('ja');
  assert.match(i18n.t('settings.trapNoteTwoWolves'), /2人狼/);
});

test('the help text names the ceiling in twelve languages', () => {
  const { i18n } = createI18n();
  const markers = ['鬼は最大3人まで', 'Three wolves at most', '鬼最多3人', '鬼最多3人', '최대 3명',
    'Tres lobos como máximo', 'Trois loups au maximum', 'Höchstens drei Wölfe',
    'No máximo três lobos', 'Al massimo tre lupi', 'अधिकतम तीन भेड़िये', 'Paling banyak tiga serigala'];
  LANGS.forEach((lang, index) => {
    i18n.setLang(lang);
    const body = i18n.t('how.items');
    assert.ok(body.includes(markers[index]), `how.items [${lang}] names the three wolves at most`);
  });
  i18n.setLang('ja');
  const audit = i18n.audit();
  assert.equal(audit.missing.length, 0, `no key is missing a language: ${[...audit.missing].join(',')}`);
  assert.equal(audit.leaks.length, 0, `no Japanese leaked: ${[...audit.leaks].join(',')}`);
});

/* ------------------------------------------------------------------- the build */
test('Build 26 is the build on every side', () => {
  const pbx = fs.readFileSync(path.join(repoRoot, 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8');
  const builds = [...pbx.matchAll(/CURRENT_PROJECT_VERSION = ([^;]+);/g)].map((match) => match[1]);
  /* Build 27 moved the number on; the rule this file checks is that both
   * configurations and the verifier carry the one build the project is on. */
  assert.equal(new Set(builds).size, 1, `both configurations carry one build (${builds.join(', ')})`);
  assert.ok(Number(builds[0]) >= 26, `Build ${builds[0]} is past Build 25`);
  const verify = fs.readFileSync(path.join(repoRoot, 'scripts/ios/verify-ios-project.py'), 'utf8');
  assert.ok(verify.includes(`DEFAULT_BUILD_NUMBER = "${builds[0]}"`), 'the verifier defaults to the same build');
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts.test.includes('v113-build26.test.mjs'), 'npm test runs this file');
});
