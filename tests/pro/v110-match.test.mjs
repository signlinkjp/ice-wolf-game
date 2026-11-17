// The v1.1.0 Phase 1 roster: up to 10 players, two wolves, the custom rules and
// the spectator target ring.
//
// These are the pure parts of the two new blocks, read out of game.json and run
// here, so a wrong clamp or a wrong wolf count fails `npm test` without a device.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import { groupCode, readGame, sceneOf, createI18n, LANGS, KANA } from './helpers.mjs';

const ROSTER_GROUP = 'v1.1.0 人数・2人狼・ルール';
const SPECTATOR_GROUP = 'v1.1.0 観戦カメラ';

const blockBetween = (code, open, close, exported) => {
  const start = code.indexOf(open);
  const end = code.indexOf(close);
  if (start < 0 || end < 0) throw new Error(`the markers ${open} / ${close} are missing`);
  const context = vm.createContext({});
  vm.runInContext(`${code.slice(start, end)}\n;globalThis.__pure = { ${exported} };`, context,
    { filename: `game.json#${open}` });
  return context.__pure;
};

const roster = blockBetween(groupCode(ROSTER_GROUP),
  '/* ==== v1.1.0 roster rules', '/* ==== end v1.1.0 roster rules ==== */',
  ['ICE_WOLF_ID_LETTERS', 'ICE_WOLF_PLAYER_MIN', 'ICE_WOLF_PLAYER_MAX', 'ICE_WOLF_PLAYER_FREE_MAX',
    'ICE_WOLF_DURATIONS', 'ICE_WOLF_DEFAULT_DURATION', 'ICE_WOLF_SWITCH_CHOICES',
    'iceWolfClampPlayerCount', 'iceWolfWolfCount', 'iceWolfSwitchCount', 'iceWolfMatchSeconds',
    'iceWolfRosterIds', 'iceWolfWolfSlots', 'iceWolfActorInRound'].join(', '));

const spectator = blockBetween(groupCode(SPECTATOR_GROUP),
  '/* ==== v1.1.0 spectator rules', '/* ==== end v1.1.0 spectator rules ==== */',
  'iceWolfSpectatorStep, iceWolfSpectatorCanWatch');

test('the player count runs 7 to 10, and free stops at 9', () => {
  assert.equal(roster.ICE_WOLF_PLAYER_MIN, 7, 'a match still starts at seven');
  assert.equal(roster.ICE_WOLF_PLAYER_MAX, 10, 'ten is the ceiling');
  assert.equal(roster.ICE_WOLF_PLAYER_FREE_MAX, 9, 'free stops at nine');
  assert.equal(roster.iceWolfClampPlayerCount(7, false), 7);
  assert.equal(roster.iceWolfClampPlayerCount(9, false), 9);
  assert.equal(roster.iceWolfClampPlayerCount(10, false), 9, 'ten is clamped without Pro');
  assert.equal(roster.iceWolfClampPlayerCount(10, true), 10, 'ten is allowed with Pro');
  assert.equal(roster.iceWolfClampPlayerCount(10, 'true'), 9, 'only a real Pro true unlocks it');
  assert.equal(roster.iceWolfClampPlayerCount(3, true), 7, 'below seven is clamped up');
  assert.equal(roster.iceWolfClampPlayerCount(99, true), 10, 'above ten is clamped down');
  assert.equal(roster.iceWolfClampPlayerCount(0, true), 7, 'a missing choice is seven');
});

test('one wolf by default, two only with Pro and eight or more players', () => {
  assert.equal(roster.iceWolfWolfCount(7, 2, false), 1, 'free keeps one wolf');
  assert.equal(roster.iceWolfWolfCount(10, 2, false), 1, 'free keeps one wolf even at ten');
  assert.equal(roster.iceWolfWolfCount(7, 2, true), 1, 'two wolves need eight players');
  assert.equal(roster.iceWolfWolfCount(8, 2, true), 2, 'two wolves at eight');
  assert.equal(roster.iceWolfWolfCount(10, 2, true), 2, 'two wolves at ten');
  assert.equal(roster.iceWolfWolfCount(10, 1, true), 1, 'the default stays one');
  assert.equal(roster.iceWolfWolfCount(10, 9, true), 2, 'two is the maximum');
});

test('the switch count is 5, or 3 / 4 with Pro, and three are always correct', () => {
  assert.deepEqual(Array.from(roster.ICE_WOLF_SWITCH_CHOICES), [5, 4, 3]);
  assert.equal(roster.iceWolfSwitchCount(5, false), 5);
  assert.equal(roster.iceWolfSwitchCount(3, false), 5, 'three switches need Pro');
  assert.equal(roster.iceWolfSwitchCount(4, false), 5, 'four switches need Pro');
  assert.equal(roster.iceWolfSwitchCount(3, true), 3);
  assert.equal(roster.iceWolfSwitchCount(4, true), 4);
  assert.equal(roster.iceWolfSwitchCount(5, true), 5);
  assert.equal(roster.iceWolfSwitchCount(2, true), 5, 'an unknown count falls back to five');
  const core = groupCode('v0.7.0 2階・階段・5スイッチ・3ゲート');
  assert.ok(core.includes("const SWITCH_HOLD = 1.6"), 'the 1.6s hold is untouched');
  assert.ok(core.includes("vars.get('SwitchCorrectTotal').setNumber(3)"), 'three switches are always correct');
});

test('the match time keeps 2/3/5 free and adds 1 and 10 with Pro', () => {
  assert.deepEqual(Array.from(roster.ICE_WOLF_DURATIONS), [60, 120, 180, 300, 600]);
  assert.equal(roster.ICE_WOLF_DEFAULT_DURATION, 210, 'the untouched default is still 3:30');
  assert.equal(roster.iceWolfMatchSeconds(0, true), 210, 'no choice keeps 3:30');
  assert.equal(roster.iceWolfMatchSeconds(120, false), 120);
  assert.equal(roster.iceWolfMatchSeconds(60, false), 180, 'one minute needs Pro');
  assert.equal(roster.iceWolfMatchSeconds(600, false), 180, 'ten minutes need Pro');
  assert.equal(roster.iceWolfMatchSeconds(60, true), 60);
  assert.equal(roster.iceWolfMatchSeconds(600, true), 600);
  assert.equal(roster.iceWolfMatchSeconds(999, true), 210, 'an unknown time falls back to the default');
});

test('the roster ids are YOU plus A..I, and only the first N-1 CPUs play', () => {
  assert.deepEqual(Array.from(roster.iceWolfRosterIds(7)), ['YOU', 'A', 'B', 'C', 'D', 'E', 'F']);
  assert.deepEqual(Array.from(roster.iceWolfRosterIds(8)), ['YOU', 'A', 'B', 'C', 'D', 'E', 'F', 'G']);
  assert.deepEqual(Array.from(roster.iceWolfRosterIds(9)), ['YOU', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
  assert.deepEqual(Array.from(roster.iceWolfRosterIds(10)), ['YOU', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']);
  assert.equal(roster.iceWolfRosterIds(10).length, 10);
  assert.equal(roster.iceWolfActorInRound(8, 10), true, 'the ninth CPU plays a ten-player match');
  assert.equal(roster.iceWolfActorInRound(8, 9), false, 'and sits out a nine-player match');
  assert.equal(roster.iceWolfActorInRound(5, 7), true);
  assert.equal(roster.iceWolfActorInRound(6, 7), false);
  assert.deepEqual(Array.from(roster.iceWolfWolfSlots(false, 9, 1)), [0], 'one CPU wolf');
  assert.deepEqual(Array.from(roster.iceWolfWolfSlots(false, 9, 2)), [0, 1], 'two CPU wolves');
  assert.deepEqual(Array.from(roster.iceWolfWolfSlots(true, 9, 2)), ['player', 0], 'the player is one of the two');
  assert.deepEqual(Array.from(roster.iceWolfWolfSlots(true, 9, 1)), ['player'], 'the player can be the only wolf');
});

test('the scene owns nine actors and no actor object was added', () => {
  const scene = sceneOf(readGame());
  const actors = scene.instances.filter((entry) => entry.name === 'Actor');
  assert.equal(actors.length, 9, `nine CPU actors: ${actors.length}`);
  const ids = actors.map((entry) => (entry.initialVariables || []).find((variable) => variable.name === 'DisplayId')?.value);
  assert.deepEqual(ids.slice(0, 6), ['A', 'B', 'C', 'D', 'E', 'F'], 'the six 1.0.0 actors keep A..F');
  assert.deepEqual(ids.slice(6), ['G', 'H', 'I'], 'the three new actors are G, H, I');
  const names = scene.objects.map((object) => object.name);
  assert.equal(names.filter((name) => name === 'Actor').length, 1, 'one Actor object, nine instances');
  for (const name of ['Player', 'Wall', 'Floor', 'Barrier', 'SwitchPad', 'GatePad', 'StairPad', 'SpeedPad', 'WarpPad']) {
    assert.ok(names.includes(name), `the ${name} object is still there`);
  }
});

test('a CPU that sits the round out is Out everywhere it matters', () => {
  const rosterCode = groupCode(ROSTER_GROUP);
  assert.ok(rosterCode.includes("av.get('State').setString('Out')"), 'the roster parks the spare actors as Out');
  assert.ok(rosterCode.includes("actor.setY(OUT_PARK_Y)"), 'and moves them outside the arena');
  const counters = groupCode('v0.6.5 Survivor/Frozen counter + Wolf role pick');
  assert.ok(counters.includes("if (state === 'Out') continue;"), 'the survivor/frozen counter skips them');
  const labels = groupCode('v0.6.2 Color-independent Actor ID Labels');
  assert.ok(labels.includes("=== 'Out'"), 'the head labels skip them');
  const rig = groupCode('v0.7.3 ブロックトイ3Dキャラ');
  assert.ok(rig.includes("state === 'Out'"), 'the block toy hides them');
  const core = groupCode('v0.7.0 2階・階段・5スイッチ・3ゲート');
  assert.ok(core.includes("!== 'Out'"), 'the player count only counts the players in the round');
});

test('the spectator camera steps through the CPU ids and only while the player is out', () => {
  assert.equal(spectator.iceWolfSpectatorCanWatch('Frozen', false, true), true);
  assert.equal(spectator.iceWolfSpectatorCanWatch('FrozenWolfCandidate', false, true), true);
  assert.equal(spectator.iceWolfSpectatorCanWatch('Active', false, true), false, 'the active player owns the camera');
  assert.equal(spectator.iceWolfSpectatorCanWatch('Frozen', true, true), false, 'the round is over');
  assert.equal(spectator.iceWolfSpectatorCanWatch('Frozen', false, false), false, 'the round is not running');
  assert.equal(spectator.iceWolfSpectatorCanWatch('', false, true), false);
  assert.equal(spectator.iceWolfSpectatorStep(0, 6, 1), 1);
  assert.equal(spectator.iceWolfSpectatorStep(5, 6, 1), 0, 'next wraps');
  assert.equal(spectator.iceWolfSpectatorStep(0, 6, -1), 5, 'prev wraps');
  assert.equal(spectator.iceWolfSpectatorStep(-1, 6, 1), 1, 'no target starts from the first');
  assert.equal(spectator.iceWolfSpectatorStep(0, 0, 1), -1, 'nothing to watch');
});

test('the camera hands over to the picked actor and stands the old group down', () => {
  const scene = sceneOf(readGame());
  const groups = scene.events.map((group) => group.name);
  assert.ok(groups.includes('v1.1.0 観戦カメラ（追従）'), 'the follow group is on the sheet');
  const follow = scene.events.find((group) => group.name === 'v1.1.0 観戦カメラ（追従）');
  const actions = follow.events.flatMap((event) => event.actions || []);
  assert.equal(actions.length, 2, 'a chase camera and an overview camera');
  for (const action of actions) {
    assert.equal(action.parameters[1], 'Actor', 'the camera looks at an Actor');
    assert.equal(action.parameters[2], 'Object3D', 'through the 3D behaviour');
  }
  assert.equal(actions[0].parameters[3], '600', 'the shipped chase distance');
  assert.equal(actions[0].parameters[5], '53', 'the shipped chase height');
  assert.equal(actions[1].parameters[3], '1050', 'the shipped overview distance');
  assert.equal(actions[1].parameters[5], '78', 'the shipped overview height');
  for (const event of follow.events) {
    const conditions = event.conditions.map((condition) => condition.parameters?.[0]);
    assert.ok(conditions.includes('SpectatorActive'), 'only while spectating');
    assert.ok(conditions.includes('Actor'), 'picking the focused actor');
    const focus = event.conditions.find((condition) => condition.parameters?.[1] === 'SpectatorFocus');
    assert.ok(focus, 'through the SpectatorFocus marker');
    assert.equal(focus.parameters[3], '"1"', 'the marked instance only');
  }
  const shipped = scene.events.find((group) => group.name === 'v0.6.4 Normal + Overview camera');
  for (const event of shipped.events) {
    const conditions = event.conditions.map((condition) => condition.parameters?.[0]);
    assert.ok(conditions.includes('SpectatorActive'), 'the shipped camera group stands down while spectating');
  }
});

test('the roster and spectator lines are complete in all twelve languages', () => {
  const { i18n } = createI18n();
  const keys = ['settings.players', 'settings.wolves', 'settings.switches', 'players.value', 'wolves.value',
    'switches.value', 'settings.playersNote', 'settings.wolvesNote', 'settings.switchesNote',
    'duration.1', 'duration.10', 'spec.title', 'spec.prev', 'spec.next', 'spec.hint'];
  for (const key of keys) {
    for (const lang of LANGS) {
      i18n.setLang(lang);
      const line = i18n.t(key, { n: 10, id: 'C' });
      assert.ok(line.length > 0, `${key} [${lang}] is empty`);
      if (lang !== 'ja' && lang !== 'zh-Hans' && lang !== 'zh-Hant') {
        assert.equal(KANA.test(line), false, `${key} [${lang}] carries Japanese kana: ${line}`);
      }
    }
  }
  i18n.setLang('en');
  assert.equal(i18n.t('players.value', { n: 10 }), '10 players');
  assert.equal(i18n.t('spec.title', { id: 'C' }), 'Watching C');
  assert.equal(i18n.t('wolves.value', { n: 2 }), '2');
});

test('the settings rows are wired to the Pro screen, not to a dead end', () => {
  const code = groupCode(ROSTER_GROUP);
  assert.ok(code.includes('openProSheet()'), 'a locked choice opens the Pro screen');
  assert.ok(code.includes("safeStorageSet('iceWolfPlayerCountV1'"), 'the player count is remembered');
  assert.ok(code.includes("safeStorageSet('iceWolfWolfCountV1'"), 'the wolf count is remembered');
  assert.ok(code.includes("safeStorageSet('iceWolfSwitchCountV1'"), 'the switch count is remembered');
  assert.ok(code.includes("setNumber(600)") || code.includes('[60, 600]'), '1 and 10 minutes are offered');
  assert.ok(code.includes("'data-action', 'time'"), 'the extra match times join the existing row');
});
