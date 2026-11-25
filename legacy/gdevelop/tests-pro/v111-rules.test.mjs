// ICE WOLF Build 21 — the two rule changes a player feels in SETTINGS and on the
// map:
//
//   * a match is 1 / 2 / 3 / 5 minutes (the ten-minute chip is gone, and a stored
//     ten comes back as five);
//   * the switches are 3 / 5 / 7 / 10 with 3 or 5 of them correct, the map has a
//     spot for every one of them with the three gates still clear, and a total of
//     three can never ask for five.
//
// The deal and the gate draw are the shipping functions, read out of game.json
// and run here, so a wrong split or a pad on a wall fails `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import { readGame, sceneOf, groupCode, createI18n, LANGS, KANA } from './helpers.mjs';

const ARENA_GROUP = 'v0.7.0 2階・階段・5スイッチ・3ゲート';
const ROSTER_GROUP = 'v1.1.0 人数・2人狼・ルール';
const STAGE_GROUP = 'v1.1.0 ステージ・衣装';
const ONLINE_GROUP = 'v1.1.0 オンライン中核';
const LOBBY_GROUP = 'v1.1.0 オンラインロビー';

const dealBlock = () => {
  const code = groupCode(ARENA_GROUP);
  const start = code.indexOf('/* ==== v0.7.0 switch deal');
  const end = code.indexOf('/* ==== end v0.7.0 switch deal ==== */');
  if (start < 0 || end < 0) throw new Error('the switch deal markers are missing');
  const context = vm.createContext({ Math, Number, Array, Object });
  vm.runInContext(`${code.slice(start, end)}\n;globalThis.__deal =
    { iceWolfSwitchDeal, iceWolfGateDeal, SWITCH_SPOTS, GATE_SPOTS, SWITCH_SIZE, GATE_SIZE };`,
  context, { filename: 'game.json#switch deal' });
  return context.__deal;
};

const stageData = () => {
  const code = groupCode(STAGE_GROUP);
  const start = code.indexOf('/* ==== v1.1.0 stage data');
  const end = code.indexOf('/* ==== end v1.1.0 stage data ==== */');
  const context = vm.createContext({});
  vm.runInContext(`${code.slice(start, end)}\n;globalThis.__stage = { ICE_WOLF_STAGE_WALLS, ICE_WOLF_STAGES };`,
    context, { filename: 'game.json#stage data' });
  return context.__stage;
};

const rosterBlock = () => {
  const code = groupCode(ROSTER_GROUP);
  const start = code.indexOf('/* ==== v1.1.0 roster rules');
  const end = code.indexOf('/* ==== end v1.1.0 roster rules ==== */');
  const context = vm.createContext({});
  vm.runInContext(`${code.slice(start, end)}\n;globalThis.__r = { iceWolfCorrectCount, iceWolfSwitchCount,
    ICE_WOLF_SWITCH_CHOICES, ICE_WOLF_CORRECT_CHOICES };`, context, { filename: 'game.json#roster rules' });
  return context.__r;
};

const onlineBlock = () => {
  const code = groupCode(ONLINE_GROUP);
  const start = code.indexOf('/* ==== v1.1.0 online core');
  const end = code.indexOf('/* ==== end v1.1.0 online core ==== */');
  const context = vm.createContext({ Math, Number, String, Array, Object, isFinite });
  vm.runInContext(`${code.slice(start, end)}\n;globalThis.__o = { iceWolfOnlineCorrectCount,
    ICE_WOLF_ONLINE_SWITCH_CHOICES, ICE_WOLF_ONLINE_CORRECT_CHOICES, iceWolfOnlineRuleLocked,
    iceWolfOnlineNewRoom, iceWolfOnlineJoinRoom, iceWolfOnlineStart, iceWolfOnlineRoomRules };`,
  context, { filename: 'game.json#online core' });
  return context.__o;
};

/* ---------------------------------------------------------- the switch deal */
test('every total deals exactly that many pads, with 3 or 5 of them correct', () => {
  const { iceWolfSwitchDeal, SWITCH_SPOTS } = dealBlock();
  const spots1F = SWITCH_SPOTS.filter((spot) => spot[0] < 792);
  const spots2F = SWITCH_SPOTS.filter((spot) => spot[0] >= 792);
  for (const total of [3, 5, 7, 10]) {
    for (const correct of [3, 5]) {
      if (correct > total) continue;
      for (let run = 0; run < 40; run += 1) {
        const deal = iceWolfSwitchDeal(total, correct, spots1F, spots2F, Math.random, false);
        assert.equal(deal.total, total, `${total}/${correct}: ${total} pads`);
        assert.equal(deal.switches.length, total);
        assert.equal(deal.correct, correct, `${total}/${correct}: ${correct} correct`);
        const corrects = deal.switches.filter((sw) => sw.kind === 'correct').length;
        assert.equal(corrects, correct, 'the correct pads are exactly the chosen number');
        const dummies = deal.switches.filter((sw) => sw.kind === 'dummy').length;
        assert.equal(dummies, total - correct, 'and the rest are dummies');
        assert.equal(deal.switches.filter((sw) => sw.kind === 'trap').length, 0, 'no trap unless it is on');
        assert.ok(deal.floor1 >= 1 && deal.floor2 >= 1, 'both floors get pads');
        assert.equal(deal.floor1 + deal.floor2, total);
        /* No pad on top of another, and every pad inside its floor. */
        for (let i = 0; i < deal.switches.length; i += 1) {
          const a = deal.switches[i];
          const floor = a.x + 32 > 792 ? '2F' : '1F';
          if (floor === '1F') assert.ok(a.x >= -708 && a.x <= 692, 'the pad is on 1F');
          else assert.ok(a.x >= 892 && a.x <= 2292, 'the pad is on 2F');
          for (let j = i + 1; j < deal.switches.length; j += 1) {
            const b = deal.switches[j];
            assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 150, 'two pads never share a spot');
          }
        }
      }
    }
  }
});

test('a total of three can only ever deal three correct', () => {
  const { iceWolfSwitchDeal, SWITCH_SPOTS } = dealBlock();
  const spots1F = SWITCH_SPOTS.filter((spot) => spot[0] < 792);
  const spots2F = SWITCH_SPOTS.filter((spot) => spot[0] >= 792);
  const deal = iceWolfSwitchDeal(3, 5, spots1F, spots2F, Math.random, false);
  assert.equal(deal.total, 3);
  assert.equal(deal.correct, 3, 'the extra correct request is cut to what was drawn');
  assert.equal(deal.switches.filter((sw) => sw.kind === 'correct').length, 3);
  const one = iceWolfSwitchDeal(3, 5, spots1F, spots2F, Math.random, true);
  assert.equal(one.switches.filter((sw) => sw.kind === 'trap').length, 0, 'three pads leave no room for a trap');
});

test('the trap takes a spare pad, and only a spare pad', () => {
  const { iceWolfSwitchDeal, SWITCH_SPOTS } = dealBlock();
  const spots1F = SWITCH_SPOTS.filter((spot) => spot[0] < 792);
  const spots2F = SWITCH_SPOTS.filter((spot) => spot[0] >= 792);
  const five = iceWolfSwitchDeal(5, 3, spots1F, spots2F, Math.random, true);
  assert.equal(five.switches.filter((sw) => sw.kind === 'trap').length, 1, 'five pads: one trap');
  assert.equal(five.switches.filter((sw) => sw.kind === 'dummy').length, 1);
  const ten = iceWolfSwitchDeal(10, 5, spots1F, spots2F, Math.random, true);
  assert.equal(ten.switches.filter((sw) => sw.kind === 'trap').length, 1);
  assert.equal(ten.switches.filter((sw) => sw.kind === 'dummy').length, 4);
  const off = iceWolfSwitchDeal(10, 5, spots1F, spots2F, Math.random, false);
  assert.equal(off.switches.filter((sw) => sw.kind === 'trap').length, 0, 'the trap stays off when it is off');
});

test('ten pads still leave the map a clear spot for all three gates', () => {
  const { iceWolfSwitchDeal, iceWolfGateDeal, SWITCH_SPOTS, GATE_SPOTS, SWITCH_SIZE, GATE_SIZE } = dealBlock();
  const spots1F = SWITCH_SPOTS.filter((spot) => spot[0] < 792);
  const spots2F = SWITCH_SPOTS.filter((spot) => spot[0] >= 792);
  for (let run = 0; run < 60; run += 1) {
    const deal = iceWolfSwitchDeal(10, 5, spots1F, spots2F, Math.random, true);
    const gates = iceWolfGateDeal(deal.switches, GATE_SPOTS, Math.random, SWITCH_SIZE, GATE_SIZE);
    assert.equal(gates.length, 3, 'three gates are always placed');
    for (const gate of gates) {
      const gx = gate[0] + GATE_SIZE / 2;
      const gy = gate[1] + GATE_SIZE / 2;
      assert.ok(gx >= 892 && gx <= 2292 || gx >= -708 && gx <= 692, 'the gate is on a floor');
      for (const pad of deal.switches) {
        const distance = Math.hypot(pad.x + SWITCH_SIZE / 2 - gx, pad.y + SWITCH_SIZE / 2 - gy);
        assert.ok(distance >= 150, `a gate never lands on a pad (${distance.toFixed(0)})`);
      }
    }
  }
});

test('thirteen switch spots, every one clear of every stage wall', () => {
  const { SWITCH_SPOTS, GATE_SPOTS } = dealBlock();
  const stage = stageData();
  assert.ok(SWITCH_SPOTS.length >= 10, `ten pads need ten spots (${SWITCH_SPOTS.length})`);
  assert.equal(SWITCH_SPOTS.length, 13, 'thirteen, so ten still leaves a choice');
  assert.ok(SWITCH_SPOTS.filter((spot) => spot[0] < 792).length >= 5, 'one floor owns enough for a ten-pad round');
  assert.ok(SWITCH_SPOTS.filter((spot) => spot[0] >= 792).length >= 5, 'and so does the other');
  const pad = 64;
  const margin = 6;
  for (const stageId of Object.keys(stage.ICE_WOLF_STAGE_WALLS)) {
    const walls = [];
    for (const [size, spots] of Object.entries(stage.ICE_WOLF_STAGE_WALLS[stageId])) {
      const [w, h] = size.split('x').map(Number);
      for (const spot of spots) {
        /* A parked wall sits far outside the arena. */
        if (spot[1] > 10000) continue;
        walls.push([spot[0], spot[1], spot[0] + w, spot[1] + h]);
      }
    }
    for (const spot of SWITCH_SPOTS) {
      const rect = [spot[0] - margin, spot[1] - margin, spot[0] + pad + margin, spot[1] + pad + margin];
      for (const wall of walls) {
        const hit = rect[0] < wall[2] && rect[2] > wall[0] && rect[1] < wall[3] && rect[3] > wall[1];
        assert.equal(hit, false, `${stageId}: the switch spot at ${spot[0]},${spot[1]} is not in a wall`);
      }
    }
    for (const spot of GATE_SPOTS) {
      const rect = [spot[0] - margin, spot[1] - margin, spot[0] + 72 + margin, spot[1] + 72 + margin];
      for (const wall of walls) {
        const hit = rect[0] < wall[2] && rect[2] > wall[0] && rect[1] < wall[3] && rect[3] > wall[1];
        assert.equal(hit, false, `${stageId}: the gate spot at ${spot[0]},${spot[1]} is not in a wall`);
      }
    }
  }
});

test('the scene carries ten switch pads and three gates', () => {
  const scene = sceneOf(readGame());
  const pads = scene.instances.filter((instance) => instance.name === 'SwitchPad');
  assert.equal(pads.length, 10, `ten switch pads: ${pads.length}`);
  const ids = pads.map((instance) => instance.persistentUuid);
  assert.equal(new Set(ids).size, ids.length, 'every pad has its own uuid');
  assert.equal(scene.instances.filter((instance) => instance.name === 'GatePad').length, 3);
  const names = scene.objects.map((object) => object.name);
  assert.equal(names.filter((name) => name === 'SwitchPad').length, 1, 'still one SwitchPad object');
});

/* --------------------------------------------------------------- the wiring */
test('the gate opens on the last correct pad and the HUD counts to the drawn total', () => {
  const code = groupCode(ARENA_GROUP);
  assert.ok(code.includes("const needed = Math.max(1, Math.round(vars.get('SwitchCorrectTotal').getAsNumber()) || 3);"),
    'the gate reads the round’s correct count');
  assert.ok(code.includes('if (active >= needed) openGate();'), 'and opens on the last one');
  assert.ok(code.includes("'スイッチ: ' + activeCount + '/' + correctTotal"), 'the HUD shows X/total');
  assert.ok(code.includes("feedback('スイッチ起動！（' + active + '/' + needed + '）'"), 'and so does the feedback line');
  const roster = groupCode(ROSTER_GROUP);
  assert.ok(roster.includes("vars.get('SwitchCorrectSetting').setNumber(correctNow)"), 'the setting is published');
  assert.ok(roster.includes("vars.get('OnlineStartCorrect')"), 'and a room’s count comes from the host');
});

test('the SETTINGS panel offers 3 / 5 / 7 / 10 pads and 3 / 5 correct', () => {
  const roster = groupCode(ROSTER_GROUP);
  assert.ok(roster.includes('const ICE_WOLF_SWITCH_CHOICES = [3, 5, 7, 10];'));
  assert.ok(roster.includes('const ICE_WOLF_CORRECT_CHOICES = [3, 5];'));
  assert.ok(roster.includes("makeChip('correct', value, String(value)"), 'the correct row exists');
  assert.ok(roster.includes("makeChip('switches', value, String(value)"), 'and the total row');
  assert.ok(roster.includes('iceWolfCorrectChoiceOn(totalNow, value)'), 'a correct chip is off when the total cannot hold it');
  assert.ok(roster.includes("safeStorageSet('iceWolfSwitchCorrectV1'"), 'the choice is remembered');
  assert.ok(roster.includes('for (const value of [60])'), 'one minute is the only extra chip');
  assert.ok(!roster.includes('[60, 600]'), 'ten minutes is gone from the row');
});

test('the guard cuts a five-correct request to three when three pads are drawn', () => {
  const roster = rosterBlock();
  assert.equal(roster.iceWolfCorrectCount(3, 5, true), 3);
  assert.equal(roster.iceWolfCorrectCount(3, 5, false), 3);
  assert.equal(roster.iceWolfCorrectCount(5, 5, true), 5);
  assert.equal(roster.iceWolfCorrectCount(7, 5, true), 5);
  assert.equal(roster.iceWolfCorrectCount(10, 5, true), 5);
  assert.equal(roster.iceWolfCorrectCount(10, 3, true), 3);
  for (const total of [3, 5, 7, 10]) {
    for (const choice of [3, 5]) {
      assert.ok(roster.iceWolfCorrectCount(total, choice, true) <= total, `${total}/${choice}: never more than drawn`);
    }
  }
});

/* ------------------------------------------------------------ the twelve lines */
test('the two new rules are on the settings and stage cards in twelve languages', () => {
  const { i18n } = createI18n();
  const keys = ['settings.correct', 'settings.correctNote', 'settings.switchesNote',
    'hud.switch', 'fb.switchOn', 'stage.school.gimmick', 'stage.space.gimmick',
    'fx.school.chime', 'fx.school.doors', 'fx.space.alarm', 'fx.space.gravity'];
  for (const key of keys) {
    for (const lang of LANGS) {
      i18n.setLang(lang);
      const line = i18n.t(key, { n: 2, t: 5, p: 8 });
      assert.ok(line.length > 0, `${key} [${lang}] is empty`);
      if (lang !== 'ja' && lang !== 'zh-Hans' && lang !== 'zh-Hant') {
        assert.equal(KANA.test(line), false, `${key} [${lang}] carries Japanese kana: ${line}`);
      }
    }
  }
  i18n.setLang('en');
  assert.equal(i18n.t('hud.switch', { n: 2, t: 5 }), 'Switches: 2/5');
  assert.equal(i18n.t('fb.switchOn', { n: 5, t: 5 }), 'Switch on! (5/5)');
  assert.equal(i18n.hud('スイッチ: 4/5'), 'Switches: 4/5', 'the HUD pass reads the total');
  i18n.setLang('ja');
  assert.equal(i18n.hud('スイッチ: 4/5'), 'スイッチ: 4/5');
  const audit = i18n.audit();
  assert.equal(audit.missing.length, 0, `no missing line: ${[...audit.missing].join(',')}`);
  assert.equal(audit.leaks.length, 0, `no Japanese leaked: ${[...audit.leaks].join(',')}`);
});

/* -------------------------------------------------------------- the room pair */
test('the room and its start payload carry the total and the correct count', () => {
  const online = onlineBlock();
  assert.deepEqual(Array.from(online.ICE_WOLF_ONLINE_SWITCH_CHOICES), [3, 5, 7, 10]);
  assert.deepEqual(Array.from(online.ICE_WOLF_ONLINE_CORRECT_CHOICES), [3, 5]);
  assert.equal(online.iceWolfOnlineCorrectCount(3, 5, true), 3, 'the guard is the same in a room');
  assert.equal(online.iceWolfOnlineCorrectCount(10, 5, true), 5);
  let room = online.iceWolfOnlineNewRoom({
    code: 'ABC234', hostId: 'h1', hostName: 'Hana', stageId: 'classic',
    rules: { playerCount: 10, wolfCount: 2, switchCount: 10, matchSeconds: 300 },
    correctCount: 5, pro: true, now: 1000
  });
  assert.equal(room.rules.switchCount, 10, 'a room can draw ten');
  assert.equal(room.correctCount, 5, 'and five of them are correct');
  room = online.iceWolfOnlineJoinRoom(room, { clientId: 'h1', name: 'Hana' }, 1000).room;
  for (let index = 1; index < 4; index += 1) {
    room = online.iceWolfOnlineJoinRoom(room, { clientId: `c${index}`, name: `P${index}` }, 1000 + index).room;
  }
  const started = online.iceWolfOnlineStart(room, { clientId: 'h1', now: 2000, seed: 42 });
  assert.equal(started.ok, true);
  assert.equal(started.payload.switchCount, 10);
  assert.equal(started.payload.correctCount, 5, 'the host’s pair travels with the round');
  const three = online.iceWolfOnlineNewRoom({
    code: 'ABC235', hostId: 'h1', stageId: 'classic',
    rules: { playerCount: 7, switchCount: 3, matchSeconds: 180 }, correctCount: 5, pro: true, now: 0
  });
  assert.equal(three.correctCount, 3, 'three pads can only want three');
});

test('the lobby offers the four totals and the two correct counts', () => {
  const lobby = groupCode(LOBBY_GROUP);
  assert.ok(lobby.includes("['switches', 'settings.switches', [3, 5, 7, 10]"), 'the total chips');
  assert.ok(lobby.includes("['correct', 'settings.correct', [3, 5]"), 'the correct chips');
  assert.ok(lobby.includes("[120, 180, 300, 60]"), 'the times stop at five minutes');
  assert.ok(!lobby.includes('600'), 'no ten-minute chip in the lobby');
  const core = groupCode(ONLINE_GROUP);
  assert.ok(core.includes("vars.get('OnlineStartCorrect').setNumber"), 'a guest is told the count');
  assert.ok(core.includes("vars.get('SwitchCorrectPreference').setNumber(iceWolfOnlineCorrectCount("),
    'and the next round is dealt from it');
  assert.ok(core.includes('ICE_WOLF_ONLINE_SWITCH_MAX = 10'), 'the wire carries ten pads');
});
