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
    'ICE_WOLF_DURATIONS', 'ICE_WOLF_DEFAULT_DURATION', 'ICE_WOLF_DURATION_FALLBACK', 'ICE_WOLF_SWITCH_CHOICES',
    'ICE_WOLF_CORRECT_CHOICES', 'ICE_WOLF_DEFAULT_CORRECT', 'ICE_WOLF_FREE_CORRECT',
    'iceWolfClampPlayerCount', 'iceWolfWolfCount', 'iceWolfSwitchCount', 'iceWolfCorrectCount',
    'iceWolfCorrectChoiceOn', 'iceWolfMatchSeconds', 'iceWolfDurationChipOn',
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

test('the switch count is 3 / 5 / 7 / 10, and 3 or 5 of them are correct', () => {
  assert.deepEqual(Array.from(roster.ICE_WOLF_SWITCH_CHOICES), [3, 5, 7, 10]);
  assert.equal(roster.iceWolfSwitchCount(5, false), 5);
  assert.equal(roster.iceWolfSwitchCount(3, false), 5, 'three switches need Pro');
  assert.equal(roster.iceWolfSwitchCount(7, false), 5, 'seven switches need Pro');
  assert.equal(roster.iceWolfSwitchCount(3, true), 3);
  assert.equal(roster.iceWolfSwitchCount(7, true), 7);
  assert.equal(roster.iceWolfSwitchCount(10, true), 10);
  assert.equal(roster.iceWolfSwitchCount(5, true), 5);
  assert.equal(roster.iceWolfSwitchCount(4, true), 5, 'an unknown count falls back to five');
  assert.equal(roster.iceWolfSwitchCount(2, true), 5);
  /* Build 21: three or five correct, and never more than were drawn. */
  assert.deepEqual(Array.from(roster.ICE_WOLF_CORRECT_CHOICES), [3, 5]);
  assert.equal(roster.iceWolfCorrectCount(5, 3, false), 3, 'three is the free answer');
  assert.equal(roster.iceWolfCorrectCount(5, 5, false), 3, 'five needs Pro');
  assert.equal(roster.iceWolfCorrectCount(5, 5, true), 5);
  assert.equal(roster.iceWolfCorrectCount(10, 5, true), 5);
  assert.equal(roster.iceWolfCorrectCount(7, 3, true), 3);
  assert.equal(roster.iceWolfCorrectCount(3, 5, true), 3, 'three drawn can only want three');
  assert.equal(roster.iceWolfCorrectCount(3, 5, false), 3, 'and the guard holds without Pro too');
  assert.equal(roster.iceWolfCorrectCount(5, 4, true), 3, 'an unknown count is three');
  assert.equal(roster.iceWolfCorrectChoiceOn(3, 5), false, 'the five chip is off at a total of three');
  assert.equal(roster.iceWolfCorrectChoiceOn(5, 5), true);
  const core = groupCode('v0.7.0 2階・階段・5スイッチ・3ゲート');
  assert.ok(core.includes("const SWITCH_HOLD = 1.6"), 'the 1.6s hold is untouched');
  assert.ok(core.includes("vars.get('SwitchCorrectTotal').setNumber(deal.correct)"), 'the deal publishes the chosen correct count');
  assert.ok(core.includes("vars.get('SwitchCorrectPreference').getAsNumber()"), 'the arena reads the correct count');
});

test('a match is 1 / 2 / 3 / 5 minutes, and a stored ten minutes comes back as five', () => {
  assert.deepEqual(Array.from(roster.ICE_WOLF_DURATIONS), [60, 120, 180, 300]);
  assert.equal(roster.ICE_WOLF_DEFAULT_DURATION, 210, 'the untouched default is still 3:30');
  assert.equal(roster.iceWolfMatchSeconds(0, true), 210, 'no choice keeps 3:30');
  assert.equal(roster.iceWolfMatchSeconds(120, false), 120);
  assert.equal(roster.iceWolfMatchSeconds(60, false), 180, 'one minute needs Pro');
  assert.equal(roster.iceWolfMatchSeconds(60, true), 60);
  assert.equal(roster.iceWolfMatchSeconds(300, true), 300);
  assert.equal(roster.iceWolfMatchSeconds(600, false), 300, 'ten minutes is not a match any more');
  assert.equal(roster.iceWolfMatchSeconds(600, true), 300, 'not even with Pro');
  assert.equal(roster.ICE_WOLF_DURATION_FALLBACK, 300, 'the fallback is five minutes');
  assert.equal(roster.iceWolfMatchSeconds(999, true), 210, 'an unknown time falls back to the default');
  assert.equal(roster.iceWolfDurationChipOn(600), 0, 'no chip is lit for a legacy ten');
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
  assert.equal(actions.length, 3, 'a chase camera, an overview camera, and Build 25\'s frozen view');
  /* Build 29: the frozen view is a POSITION the stick pans rather than an object,
   * so only the two follow events go through the 3D behaviour. */
  for (const action of actions.slice(0, 2)) {
    assert.equal(action.parameters[2], 'Object3D', 'through the 3D behaviour');
  }
  assert.equal(actions[0].parameters[1], 'Actor', 'the chase looks at an Actor');
  assert.equal(actions[0].parameters[3], '540', 'the shipped chase distance (Build 34 came in)');
  assert.equal(actions[0].parameters[5], '50', 'the shipped chase height');
  assert.equal(actions[1].parameters[1], 'Actor', 'the overview looks at an Actor');
  assert.equal(actions[1].parameters[3], '960', 'the shipped overview distance');
  assert.equal(actions[1].parameters[5], '73', 'the shipped overview height');
  /* Build 25: frozen, the camera goes above the player's own ice and shows the
   * whole floor, which is what a frozen player asked for. */
  assert.equal(actions[2].type.value, 'ThirdPersonCamera::LookFromDistanceAtPosition3D',
    'the frozen view is a position, so the stick can move the look point');
  assert.equal(actions[2].parameters[1], 'SpectatorPanX', 'over the point the stick has panned to');
  assert.equal(actions[2].parameters[2], 'SpectatorPanY', 'on both axes');
  assert.equal(actions[2].parameters[4], '1350', 'from far enough up to see the floor');
  assert.equal(actions[2].parameters[6], '82', 'and steep enough to read as a plan');
  for (const event of follow.events.slice(0, 2)) {
    const conditions = event.conditions.map((condition) => condition.parameters?.[0]);
    assert.ok(conditions.includes('SpectatorActive'), 'only while spectating');
    assert.ok(conditions.includes('Actor'), 'picking the focused actor');
    assert.ok(conditions.includes('SpectatorFrozen'), 'and never while the frozen view is on');
    const focus = event.conditions.find((condition) => condition.parameters?.[1] === 'SpectatorFocus');
    assert.ok(focus, 'through the SpectatorFocus marker');
    assert.equal(focus.parameters[3], '"1"', 'the marked instance only');
  }
  const frozenEvent = follow.events[2];
  const frozenFlags = frozenEvent.conditions.map((condition) => condition.parameters?.[0]);
  assert.ok(frozenFlags.includes('SpectatorFrozen'), 'the frozen view waits for the frozen flag');
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
    'duration.1', 'settings.correct', 'settings.correctNote', 'spec.title', 'spec.prev', 'spec.next', 'spec.hint'];
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
  assert.ok(code.includes('for (const value of [60])'), 'one minute joins the existing row');
  assert.ok(code.includes("safeStorageSet('iceWolfSwitchCorrectV1'"), 'the correct count is remembered');
  assert.ok(!code.includes('[60, 600]'), 'ten minutes is gone from the row');
});
