// The v1.1.0 Phase 2 online work, checked against the shipping block.
//
// The test takes the `v1.1.0 online core` block straight out of game.json and
// runs it in a bare context (no DOM, no runtimeScene), then walks the whole
// club through it:
//
//   * room codes: six characters, no 0/O/1/I, what a player typed is forgiven;
//   * the user's access rule: a room is Pro to create, the ten-player / two-wolf
//     / custom rules are Pro, a free player joins Classic and Deep-Sea Aquarium
//     but never a Pro stage;
//   * seats, readiness, the host's start payload (ten players, two wolves, the
//     same roles for a re-sent seed);
//   * the host-authoritative wire: 10Hz inputs, 5Hz snapshots, stale and wild
//     messages refused;
//   * the thirty second grace, seat Out, and the host moving to the next seat;
//   * the eight stamps: only the id travels, every phone reads it in its own of
//     the twelve languages, two seconds between taps, thirty a match;
//   * both transports: the in-memory hub with ten clients, and the Supabase
//     Realtime adapter driven frame by frame through a fake WebSocket.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import { groupCode, readGame, createI18n, LANGS, KANA } from './helpers.mjs';

/* Values that come out of the vm block carry that realm's Object and Array
 * prototypes, so compare them as plain data. */
const plain = (value) => JSON.parse(JSON.stringify(value));

const ONLINE_GROUP = 'v1.1.0 オンライン中核';
const STAGE_GROUP = 'v1.1.0 ステージ・衣装';
const MENU_GROUP = 'v0.6.5 Production Round Start + Main Menu';
const LOBBY_GROUP = 'v1.1.0 オンラインロビー';
const STAMP_GROUP = 'v1.1.0 クイックスタンプ';

const between = (code, startMarker, endMarker) => {
  const start = code.indexOf(startMarker);
  const end = code.indexOf(endMarker);
  if (start < 0 || end < 0) throw new Error(`markers missing: ${startMarker}`);
  return code.slice(start, end);
};

const coreSource = () => between(groupCode(ONLINE_GROUP), '/* ==== v1.1.0 online core', '/* ==== end v1.1.0 online core ==== */');

const loadOnline = () => {
  const source = `${coreSource()}
  ;globalThis.__online = {
    ICE_WOLF_ONLINE_CODE_LENGTH, ICE_WOLF_ONLINE_CODE_MIN, ICE_WOLF_ONLINE_CODE_MAX,
    ICE_WOLF_ONLINE_ALPHABET, ICE_WOLF_ONLINE_PLAYERS_MIN, ICE_WOLF_ONLINE_PLAYERS_MAX,
    ICE_WOLF_ONLINE_PLAYERS_FREE, ICE_WOLF_ONLINE_SWITCH_CHOICES, ICE_WOLF_ONLINE_SWITCH_FREE,
    ICE_WOLF_ONLINE_DURATIONS, ICE_WOLF_ONLINE_DURATION_FREE, ICE_WOLF_ONLINE_DEFAULT_DURATION,
    ICE_WOLF_ONLINE_SEATS, ICE_WOLF_ONLINE_GRACE_MS, ICE_WOLF_ONLINE_COUNTDOWN_MS,
    ICE_WOLF_ONLINE_STAMP_COOLDOWN_MS, ICE_WOLF_ONLINE_STAMP_LIMIT,
    ICE_WOLF_ONLINE_STAMP_VISIBLE_MS, ICE_WOLF_ONLINE_BOUNDS, ICE_WOLF_ONLINE_STAGES,
    ICE_WOLF_ONLINE_CONFIG_KEY, ICE_WOLF_STAMPS,
    iceWolfOnlineStage, iceWolfOnlineStageIsPro, iceWolfOnlineStageFree,
    iceWolfRoomCodeRandom, iceWolfRoomCodeNormalize,
    iceWolfOnlineCreateAccess, iceWolfOnlineStageAccess, iceWolfOnlineJoinAccess,
    iceWolfOnlineRuleLocked, iceWolfOnlineRoomRules, iceWolfOnlineRulesEqual,
    iceWolfOnlineNewRoom, iceWolfOnlineSeatOf, iceWolfOnlineHumanSeats,
    iceWolfOnlineJoinRoom, iceWolfOnlineSetReady, iceWolfOnlineCanStart,
    iceWolfOnlineNextHost, iceWolfOnlineLeaveRoom, iceWolfOnlineTick,
    iceWolfOnlineSeedRandom, iceWolfOnlineDealRoles, iceWolfOnlineRoster,
    iceWolfOnlineStart, iceWolfOnlineRoleFor, iceWolfOnlineSeatFor,
    iceWolfOnlineInput, iceWolfOnlineAcceptInput, iceWolfOnlineSnapshot,
    iceWolfOnlineApplySnapshot, iceWolfOnlinePlausible,
    iceWolfStampById, iceWolfStampView, iceWolfStampViews, iceWolfStampGate,
    iceWolfStampMessage, iceWolfStampBubble, iceWolfStampVisible,
    iceWolfOnlineConfig, iceWolfOnlineSocketUrl, iceWolfOnlineTopic,
    createIceWolfMockHub, createIceWolfMockTransport, createIceWolfSupabaseTransport,
    createIceWolfOnlineTransport
  };`;
  const context = vm.createContext({ console });
  vm.runInContext(source, context, { filename: 'game.json#v1.1.0 online core' });
  return context.__online;
};

const online = loadOnline();

// ------------------------------------------------------------------ room codes
test('a room code is six characters and never 0, O, 1 or I', () => {
  for (let i = 0; i < 40; i += 1) {
    const code = online.iceWolfRoomCodeRandom();
    assert.equal(code.length, 6, `six characters: ${code}`);
    for (const character of code) {
      assert.ok(online.ICE_WOLF_ONLINE_ALPHABET.includes(character), `${character} is in the alphabet`);
      assert.ok(!'0O1I'.includes(character), `${character} cannot be confused with a letter`);
    }
  }
  /* A deterministic draw keeps the test on one code. */
  assert.equal(online.iceWolfRoomCodeRandom(() => 0), 'AAAAAA');
  assert.equal(online.iceWolfRoomCodeRandom(() => 0.999999), '999999');
});

test('what a player typed becomes the code it means, or a clear refusal', () => {
  assert.deepEqual(plain(online.iceWolfRoomCodeNormalize('abcd23')), { ok: true, code: 'ABCD23', reason: '', messageKey: '' });
  assert.equal(online.iceWolfRoomCodeNormalize(' ab-cd2 ').code, 'ABCD2', 'spaces and dashes are forgiven');
  assert.equal(online.iceWolfRoomCodeNormalize('ABC').ok, false, 'three characters is too short');
  assert.equal(online.iceWolfRoomCodeNormalize('ABC').messageKey, 'online.codeInvalid');
  assert.equal(online.iceWolfRoomCodeNormalize('ABCDEFG').ok, false, 'seven is too long');
  assert.equal(online.iceWolfRoomCodeNormalize('').reason, 'empty');
  assert.equal(online.iceWolfRoomCodeNormalize('----').ok, false);
  /* 4 characters is the shortest a person can share and still join. */
  assert.equal(online.iceWolfRoomCodeNormalize('AB2C').ok, true);
  assert.equal(online.iceWolfRoomCodeNormalize('AB2C').code, 'AB2C');
});

// --------------------------------------------------------------- access rules
test('creating a room is Pro, and so is every rule that needs Pro', () => {
  assert.equal(online.iceWolfOnlineCreateAccess(false).allowed, false);
  assert.equal(online.iceWolfOnlineCreateAccess(false).messageKey, 'online.proCreate');
  assert.equal(online.iceWolfOnlineCreateAccess(false).pro, true);
  assert.equal(online.iceWolfOnlineCreateAccess(true).allowed, true);

  /* Ten players, two wolves, three or four switches, one or ten minutes. */
  assert.equal(online.iceWolfOnlineRuleLocked('players', 10, false), true);
  assert.equal(online.iceWolfOnlineRuleLocked('players', 9, false), false);
  assert.equal(online.iceWolfOnlineRuleLocked('wolves', 2, false), true);
  assert.equal(online.iceWolfOnlineRuleLocked('wolves', 1, false), false);
  assert.equal(online.iceWolfOnlineRuleLocked('switches', 4, false), true);
  assert.equal(online.iceWolfOnlineRuleLocked('switches', 3, false), true);
  assert.equal(online.iceWolfOnlineRuleLocked('switches', 5, false), false);
  assert.equal(online.iceWolfOnlineRuleLocked('seconds', 60, false), true);
  assert.equal(online.iceWolfOnlineRuleLocked('seconds', 600, false), true);
  assert.equal(online.iceWolfOnlineRuleLocked('seconds', 180, false), false);
  for (const field of ['players', 'wolves', 'switches', 'seconds']) {
    assert.equal(online.iceWolfOnlineRuleLocked(field, 10, true), false, `${field} is free for Pro`);
  }
});

test('a free host runs the shipped rules; a Pro host runs what was chosen', () => {
  const asked = { playerCount: 10, wolfCount: 2, switchCount: 3, matchSeconds: 600 };
  const free = online.iceWolfOnlineRoomRules(asked, false);
  assert.deepEqual(plain(free), {
    playerCount: 9, wolfCount: 1, switchCount: 5, matchSeconds: 180,
    locked: ['players', 'wolves', 'switches', 'seconds'], pro: false
  });
  const pro = online.iceWolfOnlineRoomRules(asked, true);
  assert.equal(pro.playerCount, 10);
  assert.equal(pro.wolfCount, 2);
  assert.equal(pro.switchCount, 3);
  assert.equal(pro.matchSeconds, 600);
  assert.deepEqual(plain(pro.locked), []);
  /* Two wolves need eight players: the game rule is not a Pro question. */
  assert.equal(online.iceWolfOnlineRoomRules({ playerCount: 7, wolfCount: 2 }, true).wolfCount, 1);
  /* Junk falls back to the shipped numbers instead of a room nobody can play. */
  const junk = online.iceWolfOnlineRoomRules({ playerCount: 99, wolfCount: 9, switchCount: 8, matchSeconds: 7 }, true);
  assert.equal(junk.playerCount, 10);
  assert.equal(junk.wolfCount, 2);
  assert.equal(junk.switchCount, 5);
  assert.equal(junk.matchSeconds, 180);
});

test('a free player joins Classic and the Aquarium, never a Pro stage', () => {
  for (const stageId of ['classic', 'aquarium']) {
    assert.equal(online.iceWolfOnlineJoinAccess({ stageId, pro: false }).allowed, true, stageId);
  }
  for (const stageId of ['park', 'lodge', 'school', 'space']) {
    const denied = online.iceWolfOnlineJoinAccess({ stageId, pro: false });
    assert.equal(denied.allowed, false, `${stageId} is not free to join`);
    assert.equal(denied.reason, 'stage-pro');
    assert.equal(denied.messageKey, 'online.proStage');
    assert.equal(denied.pro, true, 'the tap should offer the Pro sheet');
    assert.equal(online.iceWolfOnlineJoinAccess({ stageId, pro: true }).allowed, true, `${stageId} for Pro`);
  }
  assert.equal(online.iceWolfOnlineJoinAccess({ stageId: 'classic', pro: true, full: true }).reason, 'full');
  assert.equal(online.iceWolfOnlineJoinAccess({ stageId: 'classic', pro: true, started: true }).reason, 'started');
});

test('the online stage table is the stage block table', () => {
  const stageCode = groupCode(STAGE_GROUP);
  const data = between(stageCode, '/* ==== v1.1.0 stage data', '/* ==== end v1.1.0 stage data ==== */');
  const context = vm.createContext({});
  vm.runInContext(`${data}\n;globalThis.__stage = { ICE_WOLF_STAGES };`, context);
  const stages = context.__stage.ICE_WOLF_STAGES;
  assert.deepEqual(plain(stages.map((stage) => stage.id)), plain(online.ICE_WOLF_ONLINE_STAGES.map((stage) => stage.id)));
  assert.deepEqual(plain(stages.map((stage) => stage.pro === true)), plain(online.ICE_WOLF_ONLINE_STAGES.map((stage) => stage.pro === true)));
  assert.equal(stages.filter((stage) => stage.pro !== true).length, 2, 'two stages are free');
});

// ------------------------------------------------------------------ the room
test('seats fill in order, stop at the room size, and a ready flag is a seat flag', () => {
  const room = online.iceWolfOnlineNewRoom({
    code: 'ABC234', hostId: 'h1', hostName: 'Hana', stageId: 'aquarium',
    rules: { playerCount: 7, wolfCount: 1, switchCount: 5, matchSeconds: 180 }, pro: true, now: 1000
  });
  const first = online.iceWolfOnlineJoinRoom(room, { clientId: 'h1', name: 'Hana' }, 1000);
  assert.equal(first.ok, true);
  assert.equal(first.seat, 0);
  assert.equal(first.room.hostId, 'h1');
  let current = first.room;
  for (let index = 1; index < 7; index += 1) {
    const joined = online.iceWolfOnlineJoinRoom(current, { clientId: `c${index}`, name: `P${index}` }, 1000 + index);
    assert.equal(joined.ok, true);
    assert.equal(joined.seat, index, 'seats go in arrival order');
    current = joined.room;
  }
  const full = online.iceWolfOnlineJoinRoom(current, { clientId: 'late', name: 'Late' }, 1100);
  assert.equal(full.ok, false);
  assert.equal(full.reason, 'full');
  assert.equal(full.messageKey, 'online.roomFull');
  /* The same phone coming back keeps its seat instead of taking a new one. */
  const again = online.iceWolfOnlineJoinRoom(current, { clientId: 'c3', name: 'P3' }, 1200);
  assert.equal(again.ok, true);
  assert.equal(again.seat, 3);
  assert.equal(again.room.seats.length, 7);
  /* A match in progress is closed to new phones. */
  const playing = Object.assign({}, current, { status: 'playing' });
  assert.equal(online.iceWolfOnlineJoinRoom(playing, { clientId: 'late', name: 'Late' }, 1300).reason, 'started');

  const ready = online.iceWolfOnlineSetReady(current, 'c2', true);
  assert.equal(online.iceWolfOnlineSeatOf(ready, 'c2').ready, true);
  assert.equal(online.iceWolfOnlineSeatOf(ready, 'c3').ready, false);
});

test('only the host starts, and the start payload is the whole round', () => {
  let room = online.iceWolfOnlineNewRoom({
    code: 'ABC234', hostId: 'h1', hostName: 'Hana', stageId: 'classic',
    rules: { playerCount: 10, wolfCount: 2, switchCount: 4, matchSeconds: 60 }, pro: true, now: 1000
  });
  room = online.iceWolfOnlineJoinRoom(room, { clientId: 'h1', name: 'Hana' }, 1000).room;
  for (let index = 1; index < 5; index += 1) {
    room = online.iceWolfOnlineJoinRoom(room, { clientId: `c${index}`, name: `P${index}` }, 1000 + index).room;
  }
  assert.equal(online.iceWolfOnlineCanStart(room, 'c1').reason, 'not-host');
  assert.equal(online.iceWolfOnlineCanStart(room, 'h1').ok, true);
  const denied = online.iceWolfOnlineStart(room, { clientId: 'c1', now: 2000, seed: 42 });
  assert.equal(denied.ok, false);

  const started = online.iceWolfOnlineStart(room, { clientId: 'h1', now: 2000, seed: 42 });
  assert.equal(started.ok, true);
  const payload = started.payload;
  assert.equal(payload.kind, 'start');
  assert.equal(payload.stageId, 'classic');
  assert.equal(payload.playerCount, 10);
  assert.equal(payload.wolfCount, 2);
  assert.equal(payload.switchCount, 4);
  assert.equal(payload.matchSeconds, 60);
  assert.equal(payload.startAt, 2000 + online.ICE_WOLF_ONLINE_COUNTDOWN_MS);
  assert.equal(payload.roster.length, 10, 'ten seats, five phones and five CPUs');
  assert.equal(payload.roster.filter((row) => row.cpu).length, 5);
  assert.equal(payload.roster.filter((row) => row.role === 'Wolf').length, 2, 'two wolves');
  assert.deepEqual(plain(payload.roster.map((row) => row.id)), ['YOU', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']);
  assert.equal(payload.roster[0].clientId, 'h1');
  assert.equal(payload.roster[1].clientId, 'c1');
  assert.equal(online.iceWolfOnlineRoleFor(payload, 'c1'), payload.roster[1].role);
  assert.equal(online.iceWolfOnlineSeatFor(payload, 'c1'), 1);
  assert.equal(online.iceWolfOnlineSeatFor(payload, 'nobody'), -1);
  assert.equal(started.room.status, 'playing');

  /* The same seed deals the same wolves, so a reconnect can re-send it. */
  const repeat = online.iceWolfOnlineStart(room, { clientId: 'h1', now: 2000, seed: 42 });
  assert.deepEqual(plain(repeat.payload.roster.map((row) => row.role)), plain(payload.roster.map((row) => row.role)));
  const other = online.iceWolfOnlineStart(room, { clientId: 'h1', now: 2000, seed: 43 });
  assert.notDeepEqual(plain(other.payload.roster.map((row) => row.role)), plain(payload.roster.map((row) => row.role)));
});

// -------------------------------------------------------- the host-authoritative wire
test('an input is clamped, and a stale one never moves anybody', () => {
  const input = online.iceWolfOnlineInput(7, 4, -9, 'wolf');
  assert.equal(input.seq, 7);
  assert.equal(input.moveX, 1);
  assert.equal(input.moveY, -1);
  assert.equal(input.action, 'wolf');
  assert.equal(online.iceWolfOnlineInput(1, Number.NaN, Number.NaN, 'dance').action, 'none');
  assert.equal(online.iceWolfOnlineInput(1, Number.NaN, 0, 'none').moveX, 0);

  assert.equal(online.iceWolfOnlineAcceptInput(0, input).ok, true);
  assert.equal(online.iceWolfOnlineAcceptInput(7, input).reason, 'stale', 'the same seq is not applied twice');
  assert.equal(online.iceWolfOnlineAcceptInput(9, input).reason, 'stale', 'an older seq is dropped');
  assert.equal(online.iceWolfOnlineAcceptInput(6, input).ok, true);
  assert.equal(online.iceWolfOnlineAcceptInput(0, { kind: 'stamp' }).reason, 'not-input');
});

test('a ten-player snapshot goes out, and a client refuses the impossible', () => {
  const players = [];
  const ids = ['YOU', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
  ids.forEach((id, index) => players.push({
    id, x: -400 + index * 60, y: 100 - index * 20, z: 0,
    role: index === 4 ? 'Wolf' : 'Human', state: index === 7 ? 'Frozen' : 'Active', mode: index === 4
  }));
  const snapshot = online.iceWolfOnlineSnapshot({
    t: 5000, phase: 'Active', timer: 142.5, players,
    switches: { active: 2, triggered: 3 }, gates: { openIndex: 1, openFloor: '2F', unlocked: true }, win: ''
  });
  assert.equal(snapshot.players.length, 10);
  assert.equal(snapshot.players[4].role, 'Wolf');
  assert.equal(snapshot.players[4].mode, 1);
  assert.equal(snapshot.players[7].state, 'Frozen');
  assert.equal(snapshot.timer, 142.5);
  assert.equal(snapshot.switches.triggered, 3);
  assert.equal(snapshot.gates.openFloor, '2F');

  const first = online.iceWolfOnlineApplySnapshot(null, snapshot);
  assert.equal(first.ok, true);
  assert.equal(first.snapshot.players.length, 10);
  const stale = online.iceWolfOnlineApplySnapshot(first.snapshot, snapshot);
  assert.equal(stale.ok, false);
  assert.equal(stale.reason, 'stale');

  /* A wild coordinate is pinned back into the arena, not sent to the sky. */
  const wild = Object.assign({}, snapshot, { t: 5200, players: [{ id: 'A', x: 99999, y: -99999, z: 900 }] });
  const pinned = online.iceWolfOnlineApplySnapshot(first.snapshot, wild);
  assert.equal(pinned.ok, true);
  assert.equal(pinned.snapshot.players[0].x, online.ICE_WOLF_ONLINE_BOUNDS.maxX);
  assert.equal(pinned.snapshot.players[0].y, online.ICE_WOLF_ONLINE_BOUNDS.minY);
  assert.equal(pinned.snapshot.players[0].z, online.ICE_WOLF_ONLINE_BOUNDS.zMax, 'the z clamp keeps the arena heights');

  const nan = Object.assign({}, snapshot, { t: 5300, players: [{ id: 'A', x: Number.NaN, y: 0 }] });
  assert.equal(online.iceWolfOnlineApplySnapshot(first.snapshot, nan).reason, 'empty');
  assert.equal(online.iceWolfOnlineApplySnapshot(first.snapshot, { kind: 'stamp' }).reason, 'not-snapshot');

  /* Eleven entries never leave the host: the wire carries ten. */
  const eleven = online.iceWolfOnlineSnapshot({ t: 6000, players: players.concat([{ id: 'X', x: 1, y: 1 }]) });
  assert.equal(eleven.players.length, 10);

  /* A teleport is the stairs or a warp pad; a jump of kilometres is garbage. */
  assert.equal(online.iceWolfOnlinePlausible({ id: 'A', x: 0, y: 0 }, { id: 'A', x: 100, y: 100 }, 200), true);
  assert.equal(online.iceWolfOnlinePlausible({ id: 'A', x: 0, y: 0 }, { id: 'A', x: 4000, y: 0 }, 200), false);
});

test('thirty quiet seconds empty a seat, and the host moves to the next one', () => {
  let room = online.iceWolfOnlineNewRoom({
    code: 'ABC234', hostId: 'h1', hostName: 'Hana', stageId: 'classic',
    rules: { playerCount: 8, wolfCount: 1, switchCount: 5, matchSeconds: 180 }, pro: true, now: 0
  });
  room = online.iceWolfOnlineJoinRoom(room, { clientId: 'h1', name: 'Hana' }, 0).room;
  room = online.iceWolfOnlineJoinRoom(room, { clientId: 'c1', name: 'Ken' }, 0).room;
  room = online.iceWolfOnlineJoinRoom(room, { clientId: 'c2', name: 'Mio' }, 0).room;

  const fresh = online.iceWolfOnlineTick(room, 0, ['h1', 'c1', 'c2']);
  assert.equal(fresh.events.length, 0);
  assert.equal(online.iceWolfOnlineSeatOf(fresh.room, 'c1').out, false);

  /* c2 goes quiet: inside the grace nothing happens. */
  const inside = online.iceWolfOnlineTick(fresh.room, 10000, ['h1', 'c1']);
  assert.equal(online.iceWolfOnlineSeatOf(inside.room, 'c2').out, false);
  /* Past thirty seconds the seat is Out, like an unused CPU seat in Phase 1. */
  const past = online.iceWolfOnlineTick(inside.room, 31001, ['h1', 'c1']);
  assert.equal(online.iceWolfOnlineSeatOf(past.room, 'c2').out, true);
  assert.ok(past.events.some((event) => event.kind === 'seatOut' && event.clientId === 'c2'));

  /* c2 comes back: the same seat, present again. */
  const back = online.iceWolfOnlineTick(past.room, 32000, ['h1', 'c1', 'c2']);
  assert.equal(online.iceWolfOnlineSeatOf(back.room, 'c2').out, false);

  /* The host leaves: the lowest seat still there takes over. */
  const left = online.iceWolfOnlineLeaveRoom(back.room, 'h1', 33000);
  assert.equal(left.migrated, true);
  assert.equal(left.room.hostId, 'c1');
  assert.equal(left.room.hostName, 'Ken');
  assert.ok(left.events.some((event) => event.kind === 'hostMigrated' && event.to === 'c1'));

  /* And a host that goes quiet is replaced too. c2 was last seen at 32000, so
   * 61000 is still inside its thirty seconds and 70000 is not. */
  const insideAgain = online.iceWolfOnlineTick(left.room, 61000, ['c1']);
  assert.equal(online.iceWolfOnlineSeatOf(insideAgain.room, 'c2').out, false, 'c2 is still inside its own window');
  const quietHost = online.iceWolfOnlineTick(insideAgain.room, 70000, ['c1']);
  assert.equal(online.iceWolfOnlineSeatOf(quietHost.room, 'c2').out, true);
  /* c1 was last seen at 70000: exactly thirty seconds later is still inside. */
  const stillIn = online.iceWolfOnlineTick(quietHost.room, 100000, ['c2']);
  assert.equal(stillIn.room.hostId, 'c1');
  const gone = online.iceWolfOnlineTick(stillIn.room, 100001, ['c2']);
  assert.equal(gone.room.hostId, 'c2', 'and then it moves');
  assert.ok(gone.events.some((event) => event.kind === 'hostMigrated'));

  /* Everybody leaves: the room closes. */
  const empty = online.iceWolfOnlineLeaveRoom(online.iceWolfOnlineLeaveRoom(gone.room, 'c2', 101000).room, 'c1', 101001);
  assert.equal(empty.room.status, 'closed');
  assert.deepEqual(plain(empty.room.seats), []);
});

// ------------------------------------------------------------------- stamps
test('eight stamps, and only the id and the sender travel', () => {
  assert.equal(online.ICE_WOLF_STAMPS.length, 8);
  assert.deepEqual(plain(online.ICE_WOLF_STAMPS.map((stamp) => stamp.id)),
    ['here', 'help', 'wolf', 'switch', 'nice', 'watch', 'wait', 'gg']);
  for (const stamp of online.ICE_WOLF_STAMPS) {
    assert.match(stamp.key, /^stamp\./);
    assert.ok(stamp.glyph.length > 0, `${stamp.id} has a face`);
  }
  const message = online.iceWolfStampMessage('help', 'Hana', 1000);
  assert.deepEqual(plain(message), { kind: 'stamp', stampId: 'help', sender: 'Hana', at: 1000 });
  assert.equal(online.iceWolfStampMessage('shout', 'Hana', 1000), null, 'an unknown id is not a stamp');
  /* Only words that were translated exist: a stamp can never carry free text. */
  const bubble = online.iceWolfStampBubble({ kind: 'stamp', stampId: 'help', sender: 'Hana', at: 1000 }, (key) => `t:${key}`, 1000);
  assert.equal(bubble.text, 't:stamp.help');
  assert.equal(bubble.sender, 'Hana');
  assert.equal(online.iceWolfStampBubble({ kind: 'stamp', stampId: 'nope' }, () => 'x', 0), null);
  /* A stamp with no sender still says who it was from, in the reader's words. */
  const anon = online.iceWolfStampBubble({ kind: 'stamp', stampId: 'gg', sender: '' }, (key) => (key === 'online.someone' ? 'Someone' : key), 0);
  assert.equal(anon.sender, 'Someone');
  assert.equal(online.iceWolfStampVisible(bubble, 1000 + 2600), true);
  assert.equal(online.iceWolfStampVisible(bubble, 1000 + 2601), false);
});

test('a tap every two seconds, thirty a match', () => {
  assert.equal(online.iceWolfStampGate(1000, 0, 0).ok, true, 'the first tap always goes');
  const early = online.iceWolfStampGate(2500, 1000, 1);
  assert.equal(early.ok, false);
  assert.equal(early.reason, 'cooldown');
  assert.equal(early.cooldownLeft, 500);
  assert.equal(early.messageKey, 'online.stampCooldown');
  assert.equal(online.iceWolfStampGate(3000, 1000, 1).ok, true);
  const capped = online.iceWolfStampGate(999999, 1, 30);
  assert.equal(capped.ok, false);
  assert.equal(capped.reason, 'limit');
  assert.equal(capped.messageKey, 'online.stampLimit');
});

test('a Japanese tap arrives in each receiver\'s own language', () => {
  const { i18n } = createI18n({ language: 'ja' });
  const tr = (key, params) => i18n.t(key, params);
  const seen = new Map();
  for (const lang of LANGS) {
    i18n.setLang(lang);
    const views = online.iceWolfStampViews(tr);
    assert.equal(views.length, 8);
    for (const view of views) {
      assert.ok(view.text && view.text.trim().length > 0, `${lang} ${view.id} has a line`);
      if (lang !== 'ja' && lang !== 'zh-Hans' && lang !== 'zh-Hant') {
        assert.ok(!KANA.test(view.text), `${lang} ${view.id} has no Japanese kana: ${view.text}`);
      }
      /* 'help' is the one that must be different in every language it can be. */
      if (view.id === 'help') seen.set(lang, view.text);
    }
  }
  assert.equal(seen.get('ja'), '助けて！');
  assert.equal(seen.get('en'), 'Help!');
  assert.equal(seen.get('es'), '¡Ayuda!');
  assert.equal(seen.get('ko'), '도와줘!');
  assert.equal(seen.get('de'), 'Hilfe!');
  assert.equal(seen.get('fr'), 'À l’aide !');
  /* Twelve languages, more than six different spellings: the phone, not the
   * sender, decides how a stamp reads. */
  assert.ok(new Set(seen.values()).size >= 6, [...seen.values()].join('|'));
});

// ------------------------------------------------------------------ the texts
test('every new online line exists in all twelve languages, with no leaks', () => {
  const { i18n } = createI18n({ language: 'ja' });
  const keys = i18n.keys();
  const wanted = ['online.menu', 'online.title', 'online.create', 'online.join', 'online.code',
    'online.proCreate', 'online.proStage', 'online.proRules', 'online.notConfigured', 'online.offline',
    'online.roomFull', 'online.started', 'online.hostLeft', 'online.stampAria',
    'stamp.here', 'stamp.help', 'stamp.wolf', 'stamp.switchOn', 'stamp.nice', 'stamp.watch',
    'stamp.wait', 'stamp.gg'];
  for (const key of wanted) assert.ok(keys.includes(key), `${key} is in the table`);
  const audit = i18n.audit();
  assert.deepEqual(plain(audit.missing), [], 'no key is missing a language');
  assert.deepEqual(plain(audit.leaks), [], 'no Japanese is left in a translation');
  assert.ok(audit.keys >= 178 + 50, `the table grew by the online lines: ${audit.keys}`);
  /* The audit and the published counts agree with what the game shows. */
  const group = groupCode('v1.0.0 12言語 i18n');
  assert.ok(group.includes("vars.get('LanguageMissing').setNumber(audit.missing.length)"));
  assert.ok(group.includes("vars.get('LanguageLeaks').setNumber(audit.leaks.length)"));
});

test('the online block is pure: no DOM, no scene, no secret', () => {
  const source = coreSource();
  assert.ok(!/\bdocument\b/.test(source), 'the core never touches the DOM');
  assert.ok(!/\bruntimeScene\b/.test(source), 'the core never touches the scene');
  assert.ok(!/eyJ[A-Za-z0-9_-]{10,}/.test(source), 'no Supabase key is written into the game');
  assert.ok(!/https:\/\/[a-z0-9]{20}\.supabase\.co/.test(source), 'no project URL is hardcoded');
  assert.ok(source.includes("'online.notConfigured'"), 'an unconfigured build says so');
  /* The manifest the screens and the tests read is published by the engine. */
  const engine = groupCode(ONLINE_GROUP);
  for (const name of ['ICE_WOLF_STAMPS', 'iceWolfOnlineStart', 'iceWolfStampView', 'iceWolfRoomCodeNormalize']) {
    assert.ok(engine.includes(name + ': ' + name), `${name} is on the API`);
  }
});

// ------------------------------------------------------------------- config
test('the Supabase settings are configuration, and are checked before use', () => {
  const none = online.iceWolfOnlineConfig({});
  assert.equal(none.configured, false);
  assert.equal(none.reason, 'online.notConfigured');
  const badUrl = online.iceWolfOnlineConfig({ url: 'http://localhost:3000', key: 'k'.repeat(40) });
  assert.equal(badUrl.configured, false);
  assert.equal(badUrl.reason, 'online.badUrl');
  const badKey = online.iceWolfOnlineConfig({ url: 'https://abcd1234.supabase.co', key: 'short' });
  assert.equal(badKey.configured, false);
  assert.equal(badKey.reason, 'online.badKey');
  const good = online.iceWolfOnlineConfig({
    url: 'https://abcd1234.supabase.co/', key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig'
  });
  assert.equal(good.configured, true);
  assert.equal(good.url, 'https://abcd1234.supabase.co', 'a trailing slash is dropped');
  assert.equal(good.host, 'abcd1234.supabase.co');
  assert.equal(online.iceWolfOnlineSocketUrl(good),
    'wss://abcd1234.supabase.co/realtime/v1/websocket?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig&vsn=1.0.0');
  assert.equal(online.iceWolfOnlineTopic('ABC234'), 'realtime:ice-wolf-room-ABC234');
});

class FakeSocket {
  constructor(url) {
    this.url = url;
    this.sent = [];
    this.closed = false;
    FakeSocket.last = this;
  }

  send(text) { this.sent.push(JSON.parse(text)); }

  close() { this.closed = true; }

  open() { if (typeof this.onopen === 'function') this.onopen(); }

  receive(frame) { if (typeof this.onmessage === 'function') this.onmessage({ data: JSON.stringify(frame) }); }

  fail() { if (typeof this.onerror === 'function') this.onerror(); }

  frames(event) { return this.sent.filter((frame) => frame.event === event); }
}

const configured = {
  url: 'https://abcd1234.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig'
};

test('the Supabase transport speaks the Phoenix protocol, frame by frame', async () => {
  let clock = 1000;
  const events = [];
  const transport = online.createIceWolfSupabaseTransport({
    config: configured, WebSocket: FakeSocket, clientId: 'h1', name: 'Hana', now: () => clock
  });
  transport.on((event) => events.push(event));
  assert.equal(transport.status().configured, true);

  const connecting = transport.connect({ clientId: 'h1', name: 'Hana' });
  const socket = FakeSocket.last;
  assert.match(socket.url, /^wss:\/\/abcd1234\.supabase\.co\/realtime\/v1\/websocket\?apikey=/);
  socket.open();
  const connected = await connecting;
  assert.equal(connected.ok, true);
  assert.equal(transport.status().connected, true);

  const joining = transport.join({ code: 'abc234', clientId: 'h1', name: 'Hana', seat: 0 });
  const join = socket.frames('phx_join')[0];
  assert.equal(join.topic, 'realtime:ice-wolf-room-ABC234', 'the code is upper-cased into the topic');
  assert.equal(join.payload.config.presence.key, 'h1');
  socket.receive({ event: 'phx_reply', ref: join.ref, payload: { status: 'ok', response: {} } });
  const joined = await joining;
  assert.equal(joined.ok, true);
  assert.equal(transport.status().joined, true);
  assert.ok(events.some((event) => event.kind === 'joined'));

  /* Presence: two more phones appear, one leaves. */
  socket.receive({
    event: 'presence_state',
    payload: {
      h1: { metas: [{ clientId: 'h1', name: 'Hana', seat: 0 }] },
      c1: { metas: [{ clientId: 'c1', name: 'Ken', seat: 1 }] }
    }
  });
  assert.equal(transport.presence().length, 2);
  socket.receive({
    event: 'presence_diff',
    payload: {
      joins: { c2: { metas: [{ clientId: 'c2', name: 'Mio', seat: 2 }] } },
      leaves: { c1: { metas: [{ clientId: 'c1' }] } }
    }
  });
  const presence = transport.presence().map((member) => member.clientId).sort();
  assert.deepEqual(plain(presence), ['c2', 'h1']);
  const presenceEvents = events.filter((event) => event.kind === 'presence');
  assert.equal(presenceEvents[presenceEvents.length - 1].members.length, 2);

  /* Sending a stamp is one broadcast frame; receiving one is one event. */
  assert.equal(transport.send({ kind: 'stamp', stampId: 'help', sender: 'Hana' }), true);
  const broadcast = socket.frames('broadcast').pop();
  assert.equal(broadcast.payload.type, 'broadcast');
  assert.equal(broadcast.payload.event, 'stamp');
  assert.equal(broadcast.payload.payload.stampId, 'help');
  assert.equal(broadcast.payload.payload.from, 'h1');
  socket.receive({
    event: 'broadcast',
    payload: { type: 'broadcast', event: 'stamp', payload: { stampId: 'gg', sender: 'Mio', from: 'c2', at: 1500 } }
  });
  const stamps = events.filter((event) => event.kind === 'stamp');
  assert.equal(stamps.length, 1);
  assert.equal(stamps[0].stampId, 'gg');
  assert.equal(stamps[0].from, 'c2');

  /* The heartbeat is the transport's own clock: 25 seconds, then once more. */
  clock += 12000;
  assert.equal(transport.pump(), 0);
  clock += 14000;
  assert.equal(transport.pump(), 1);
  assert.equal(socket.frames('heartbeat').length, 1);
  clock += 30000;
  assert.equal(transport.pump(), 1);
  assert.equal(socket.frames('heartbeat').length, 2);

  /* Leaving says goodbye on the wire and stops sending. */
  transport.leave();
  assert.equal(socket.frames('phx_leave').length, 1);
  assert.equal(transport.send({ kind: 'stamp', stampId: 'gg' }), false);
});

test('a refused join, a dead socket and a missing config each say what happened', async () => {
  const refused = online.createIceWolfSupabaseTransport({
    config: configured, WebSocket: FakeSocket, clientId: 'c9', name: 'Nine', now: () => 0
  });
  const opening = refused.connect({});
  FakeSocket.last.open();
  assert.equal((await opening).ok, true);
  const joining = refused.join({ code: 'ZZZZZZ', clientId: 'c9' });
  const join = FakeSocket.last.frames('phx_join')[0];
  FakeSocket.last.receive({ event: 'phx_reply', ref: join.ref, payload: { status: 'error', response: { reason: 'full' } } });
  const answer = await joining;
  assert.equal(answer.ok, false);
  assert.equal(answer.messageKey, 'online.joinFailed');
  assert.equal(refused.status().errorKey, 'online.joinFailed');

  const dead = online.createIceWolfSupabaseTransport({ config: configured, WebSocket: FakeSocket, clientId: 'c8', now: () => 0 });
  const connecting = dead.connect({});
  FakeSocket.last.fail();
  const failed = await connecting;
  assert.equal(failed.ok, false);
  assert.equal(failed.messageKey, 'online.offline');
  assert.equal(dead.status().state, 'error');

  const nothing = online.createIceWolfSupabaseTransport({ config: {}, WebSocket: FakeSocket, clientId: 'c7', now: () => 0 });
  const missing = await nothing.connect({});
  assert.equal(missing.ok, false);
  assert.equal(missing.messageKey, 'online.notConfigured');
  const noJoin = await nothing.join({ code: 'ABC234' });
  assert.equal(noJoin.ok, false);
  assert.equal(noJoin.messageKey, 'online.notConfigured');

  /* No WebSocket at all (a browser without realtime): still a clear answer. */
  const bare = online.createIceWolfSupabaseTransport({ config: configured, WebSocket: null, clientId: 'c6', now: () => 0 });
  assert.equal((await bare.connect({})).messageKey, 'online.offline');
});

test('without a config the game falls back to a practice room on this phone only', () => {
  const made = online.createIceWolfOnlineTransport({ config: {}, now: () => 0 });
  assert.equal(made.local, true);
  assert.equal(made.config.configured, false);
  assert.equal(made.transport.kind, 'mock');
  assert.ok(made.hub, 'the practice room has a hub so it behaves like a room');
  const real = online.createIceWolfOnlineTransport({ config: configured, WebSocket: FakeSocket, now: () => 0 });
  assert.equal(real.local, false);
  assert.equal(real.transport.kind, 'supabase');
});

// ------------------------------------------------------- the loopback club
test('ten phones join, the host deals, and every phone hears the same round', async () => {
  let clock = 5000;
  const hub = online.createIceWolfMockHub({ now: () => clock });
  const phones = [];
  for (let index = 0; index < 10; index += 1) {
    const transport = hub.createTransport({ clientId: index === 0 ? 'h1' : `c${index}`, name: `P${index}` });
    const inbox = [];
    transport.on((event) => inbox.push(event));
    phones.push({ transport, inbox, clientId: index === 0 ? 'h1' : `c${index}` });
  }
  const host = phones[0];
  let room = online.iceWolfOnlineNewRoom({
    code: 'GG2345', hostId: 'h1', hostName: 'P0', stageId: 'aquarium',
    rules: { playerCount: 10, wolfCount: 2, switchCount: 4, matchSeconds: 300 }, pro: true, now: clock
  });
  room = online.iceWolfOnlineJoinRoom(room, { clientId: 'h1', name: 'P0' }, clock).room;

  await host.transport.connect();
  await host.transport.join({ code: 'GG2345', clientId: 'h1', seat: 0 });
  assert.equal(hub.presenceOf('GG2345').length, 1);

  for (const phone of phones.slice(1)) {
    await phone.transport.connect();
    const joined = await phone.transport.join({ code: 'GG2345', clientId: phone.clientId, seat: phones.indexOf(phone) });
    assert.equal(joined.ok, true);
    room = online.iceWolfOnlineJoinRoom(room, { clientId: phone.clientId, name: phone.transport.state.name }, clock).room;
  }
  assert.equal(hub.presenceOf('GG2345').length, 10, 'all ten are on the channel');
  assert.equal(room.seats.length, 10);
  for (const phone of phones) assert.ok(phone.inbox.some((event) => event.kind === 'presence'), `${phone.clientId} saw presence`);

  /* The host sends the room, then the start. */
  const start = online.iceWolfOnlineStart(room, { clientId: 'h1', now: clock, seed: 7 });
  assert.equal(start.ok, true);
  host.transport.send({ kind: 'room', code: room.code, hostId: 'h1', stageId: 'aquarium', playerCount: 10, wolfCount: 2, switchCount: 4, matchSeconds: 300, status: 'lobby', seats: room.seats });
  host.transport.send(start.payload);
  for (const phone of phones.slice(1)) {
    const roomEvent = phone.inbox.find((event) => event.kind === 'room');
    assert.ok(roomEvent, `${phone.clientId} got the room`);
    assert.equal(roomEvent.stageId, 'aquarium');
    const startEvent = phone.inbox.find((event) => event.kind === 'start');
    assert.ok(startEvent, `${phone.clientId} got the start`);
    assert.equal(startEvent.roster.length, 10);
    assert.equal(startEvent.playerCount, 10);
  }
  /* The same round on the host's own phone and on every guest phone. */
  const roles = new Map(phones.map((phone) => [phone.clientId, online.iceWolfOnlineRoleFor(start.payload, phone.clientId)]));
  assert.equal([...roles.values()].filter((role) => role === 'Wolf').length, 2);

  /* A guest's input reaches the host exactly once, and a stale resend does not. */
  const guest = phones[3];
  guest.transport.send(online.iceWolfOnlineInput(1, 1, 0, 'none'));
  const hostInbox = host.inbox.filter((event) => event.kind === 'input');
  assert.equal(hostInbox.length, 1);
  assert.equal(hostInbox[0].from, guest.clientId);
  assert.equal(online.iceWolfOnlineAcceptInput(1, hostInbox[0]).ok, false, 'the same seq again is stale');

  /* The host's snapshot reaches all nine guests. */
  clock += 200;
  const snapshot = online.iceWolfOnlineSnapshot({
    t: clock, phase: 'Active', timer: 280,
    players: start.payload.roster.map((row, index) => ({ id: row.id, x: index * 10, y: index * -5, z: 0, role: row.role, state: 'Active' })),
    switches: { active: 1, triggered: 1 }, gates: { openIndex: 0, openFloor: '1F', unlocked: false }
  });
  host.transport.send(snapshot);
  for (const phone of phones.slice(1)) {
    const got = phone.inbox.filter((event) => event.kind === 'snapshot').pop();
    assert.ok(got, `${phone.clientId} got a snapshot`);
    const applied = online.iceWolfOnlineApplySnapshot(null, got);
    assert.equal(applied.ok, true);
    assert.equal(applied.snapshot.players.length, 10);
    assert.equal(applied.snapshot.timer, 280);
  }

  /* A stamp from one phone lands on the other nine with the id intact. */
  guest.transport.send(online.iceWolfStampMessage('wolf', 'P3', clock));
  for (const phone of phones) {
    if (phone === guest) continue;
    const stamp = phone.inbox.filter((event) => event.kind === 'stamp').pop();
    assert.ok(stamp, `${phone.clientId} got the stamp`);
    assert.equal(stamp.stampId, 'wolf');
    assert.equal(stamp.sender, 'P3');
  }

  /* The host's phone dies: the seat goes Out after the grace, and the club
   * carries on under the next seat. */
  hub.setOnline('h1', false);
  assert.equal(hub.presenceOf('GG2345').length, 9);
  const quiet = online.iceWolfOnlineTick(room, clock + 1000, hub.presenceOf('GG2345').map((member) => member.clientId));
  assert.equal(online.iceWolfOnlineSeatOf(quiet.room, 'h1').out, false, 'inside the thirty second window');
  const gone = online.iceWolfOnlineTick(quiet.room, clock + 40000, hub.presenceOf('GG2345').map((member) => member.clientId));
  assert.equal(online.iceWolfOnlineSeatOf(gone.room, 'h1').out, true);
  assert.equal(gone.room.hostId, 'c1', 'the next seat takes over');

  hub.setOnline('h1', true);
  const back = online.iceWolfOnlineTick(gone.room, clock + 41000, hub.presenceOf('GG2345').map((member) => member.clientId));
  assert.equal(online.iceWolfOnlineSeatOf(back.room, 'h1').out, false, 'and it can come back to its own seat');
  assert.equal(back.room.hostId, 'c1', 'the host duty stays where it moved');
});

// -------------------------------------------------- the screens are wired up
test('the menu carries ONLINE, the lobby draws it, and the stamps ride the HUD', () => {
  const menu = groupCode(MENU_GROUP);
  assert.ok(menu.includes('data-action="online"'), 'the menu has an ONLINE button');
  assert.ok(menu.includes('data-i18n="online.menu"'), 'and the button is translated');
  assert.ok(menu.includes("vars.get('OnlineUiCommand').setString('open')"), 'the tap opens the sheet');

  const lobby = groupCode(LOBBY_GROUP);
  for (const hook of ['data-online-codeinput', 'data-online-create', 'data-online-chips-players',
    'data-online-chips-wolves', 'data-online-chips-switches', 'data-online-chips-seconds',
    'data-online-chips-stage', 'data-online-seats', 'data-online-start', 'data-online-ready',
    'data-online-roomcode', 'data-online-stamplist']) {
    assert.ok(lobby.includes(hook), `the lobby has ${hook}`);
  }
  assert.ok(lobby.includes("command('join:'"), 'the JOIN button sends a code');
  assert.ok(lobby.includes("command('start')"), 'the host can start');
  assert.ok(lobby.includes('iceWolfOnlineRuleLocked'), 'the Pro rule badge is the core rule');
  assert.ok(lobby.includes('OnlineLobbyReady'), 'the lobby says it is up');

  const stamps = groupCode(STAMP_GROUP);
  assert.ok(stamps.includes('data-stamp-id'), 'the bar builds one button per stamp');
  assert.ok(stamps.includes("stampVars.get('StampCommand').setString(stamp.id)"), 'a tap sends only the id');
  assert.ok(stamps.includes('OnlineStampButtons'), 'the bar publishes how many stamps it has');
});

test('the room settings the host deals reach the round blocks', () => {
  const roster = groupCode('v1.1.0 人数・2人狼・ルール');
  assert.ok(roster.includes('onlineRoomActiveNow()'), 'the roster takes the host rules in a room');
  assert.ok(roster.includes("vars.get('OnlineStartPlayers')"), 'ten players from the host');
  assert.ok(roster.includes("vars.get('OnlineStartWolves')"), 'two wolves from the host');
  const switches = groupCode('v0.7.0 2階・階段・5スイッチ・3ゲート');
  assert.ok(switches.includes('const inRoom = vars.get(\'OnlineRoomActive\').getAsBoolean() === true;'),
    'the switch count follows the room');
  const engine = groupCode(ONLINE_GROUP);
  for (const variable of ['OnlineStartSwitches', 'OnlineStartSeconds', 'OnlineStartRole', 'OnlineRoomActive']) {
    assert.ok(engine.includes(variable), `the start handshake sets ${variable}`);
  }
  assert.ok(engine.includes("vars.get('RoundCommand').setString('Start')"), 'the round starts from the payload');
  assert.ok(engine.includes("vars.get('StageApplied').getAsString() === payload.stageId"),
    'it waits for the host\'s walls before starting');
});

test('every online scene variable exists and starts neutral', () => {
  const variables = new Map(readGame().layouts
    .find((layout) => layout.name === 'FROST LAB').variables
    .map((variable) => [variable.name, variable]));
  const wanted = ['OnlineCommand', 'OnlineUiCommand', 'OnlineRoomCode', 'OnlineRoomActive',
    'OnlineStartStage', 'OnlineSnapshotT', 'OnlineLobbyOpen', 'OnlineStampSerial', 'StampCommand',
    'OnlineConfigUrl', 'OnlineConfigKey'];
  for (const name of wanted) assert.ok(variables.has(name), `${name} is a scene variable`);
  assert.equal(variables.get('OnlineRoomActive').value, false, 'no room at launch');
  assert.equal(variables.get('OnlineStartRole').value, 'Human');
  assert.equal(variables.get('OnlineConfigUrl').value, '', 'no URL is shipped in the file');
  assert.equal(variables.get('OnlineConfigKey').value, '', 'no key is shipped in the file');
  assert.equal(variables.get('OnlineRulePlayers').type, 'number');
  assert.equal(variables.get('OnlineMode').value, 'idle');
});

// ------------------------------------------------ the blocks run in one frame
test('a frame of the shipping blocks runs, creates a practice room, and stays quiet', () => {
  const game = readGame();
  const sceneVars = game.layouts.find((layout) => layout.name === 'FROST LAB').variables;
  const values = new Map(sceneVars.map((variable) => [variable.name, variable.value]));

  const bag = (name) => ({
    getAsString: () => String(values.has(name) ? values.get(name) : ''),
    setString: (value) => values.set(name, String(value)),
    getAsNumber: () => Number(values.has(name) ? values.get(name) : 0) || 0,
    setNumber: (value) => values.set(name, Number(value)),
    getAsBoolean: () => values.get(name) === true,
    setBoolean: (value) => values.set(name, value === true)
  });
  const scene = {
    getVariables: () => ({ get: (name) => { if (!values.has(name)) values.set(name, 0); return bag(name); } }),
    getObjects: () => [],
    getGame: () => ({ getAssetPath: () => '' })
  };
  values.set('StageApplied', 'classic');
  values.set('StageId', 'classic');
  values.set('RoundPhase', 'Menu');
  values.set('MatchTimeLeft', 180);
  values.set('LanguageCommand', 'ja');

  /* The i18n block first, then the three Phase 2 blocks, each in its own
   * function scope the way a GDevelop inline event runs. */
  const context = vm.createContext({ runtimeScene: scene, console, Date, Math, JSON, Promise, Set, Number, String, Array, Object, isFinite, encodeURIComponent, setTimeout, clearTimeout });
  const run = (group, label) => {
    const code = groupCode(group);
    vm.runInContext(`(function () {\n${code}\n})()`, context, { filename: `game.json#${label}` });
  };
  run('v1.0.0 12言語 i18n', 'i18n');
  const frame = () => {
    run('v1.1.0 オンライン中核', 'online core');
    run('v1.1.0 オンラインロビー', 'online lobby');
    run('v1.1.0 クイックスタンプ', 'quick stamps');
  };

  frame();
  assert.equal(values.get('OnlineUiReady'), true, 'the core published its state');
  assert.equal(values.get('OnlineMode'), 'idle', 'nobody is in a room at the menu');
  assert.equal(values.get('OnlineRoomActive'), false);
  assert.equal(values.get('OnlineConfigured'), false, 'no project keys in the file');

  /* A free player taps CREATE: the Pro sheet is what should happen, no room. */
  values.set('OnlineCommand', 'create');
  frame();
  assert.equal(values.get('OnlineRoomCode'), '', 'a free player gets no room');
  assert.equal(values.get('OnlineLocal'), true);

  /* With Pro, CREATE opens a practice room on this phone. */
  values.set('ProUnlocked', true);
  values.set('OnlineCommand', 'create');
  frame();
  const code = String(values.get('OnlineRoomCode') || '');
  assert.equal(code.length, 6, `a six character room: ${code}`);
  assert.equal(values.get('OnlineIsHost'), true, 'the creator hosts');
  assert.equal(values.get('OnlineLocal'), true, 'practice mode: no server yet');
  assert.equal(values.get('OnlineRoomStage'), 'classic');
  assert.equal(values.get('OnlineLocal'), true);

  /* A rule tap and a start: the round handshake asks the stage block first,
   * so the first frame only lines it up. */
  values.set('OnlineCommand', 'rule:players:8');
  frame();
  assert.equal(values.get('OnlineRoomPlayers'), 8, 'the room took the rule');
  values.set('OnlineCommand', 'rule:players:10');
  frame();
  assert.equal(values.get('OnlineRoomPlayers'), 10, 'Pro, so ten players is allowed');
  values.set('OnlineCommand', 'start');
  frame();
  assert.equal(values.get('OnlineRoomStatus'), 'playing', 'the host dealt the round');
  assert.equal(values.get('OnlineStartPlayers'), 10);
  assert.ok(['Wolf', 'Human'].includes(String(values.get('OnlineStartRole'))), 'the host got a role');
  assert.match(String(values.get('OnlineRoster')), /^0:YOU:(Wolf|Human):h|^0:YOU:(Wolf|Human):c/, 'the roster is published');

  /* The stamp bar sends an id; the same id comes back as a translated line. */
  values.set('OnlineRoomActive', true);
  values.set('StampCommand', 'help');
  frame();
  assert.equal(values.get('OnlineStampCount'), 1);
  assert.equal(values.get('OnlineStampGlyph'), '🆘');
  assert.ok(String(values.get('OnlineStampText')).length > 0, 'the bubble has a line');

  /* Leaving clears the room and the match flag. */
  values.set('OnlineCommand', 'leave');
  frame();
  assert.equal(values.get('OnlineRoomCode'), '');
  assert.equal(values.get('OnlineRoomActive'), false);
  assert.equal(values.get('OnlineMode'), 'idle');
});

// ------------------------------------------- the screens run against a DOM
test('one frame with a screen builds the lobby and the stamp bar without throwing', () => {
  const game = readGame();
  const sceneVars = game.layouts.find((layout) => layout.name === 'FROST LAB').variables;
  const values = new Map(sceneVars.map((variable) => [variable.name, variable.value]));
  const bag = (name) => ({
    getAsString: () => String(values.has(name) ? values.get(name) : ''),
    setString: (value) => values.set(name, String(value)),
    getAsNumber: () => Number(values.has(name) ? values.get(name) : 0) || 0,
    setNumber: (value) => values.set(name, Number(value)),
    getAsBoolean: () => values.get(name) === true,
    setBoolean: (value) => values.set(name, value === true)
  });
  const scene = {
    getVariables: () => ({ get: (name) => { if (!values.has(name)) values.set(name, 0); return bag(name); } }),
    getObjects: () => [],
    getGame: () => ({ getAssetPath: () => '' })
  };

  /* The smallest document the overlays touch. innerHTML is scanned for its
   * data- attributes, so querySelector only finds what the template really
   * contains: a mistyped selector comes back null here, the way it would on the
   * phone. */
  const attributesIn = (html) => {
    const found = new Map();
    const pattern = /data-([a-z0-9-]+)(?:="([^"]*)")?/g;
    let match = pattern.exec(String(html || ''));
    while (match) {
      const name = 'data-' + match[1];
      if (!found.has(name)) found.set(name, []);
      if (match[2] !== undefined) found.get(name).push(match[2]);
      match = pattern.exec(String(html || ''));
    }
    return found;
  };
  const makeElement = () => {
    const element = {
      children: [],
      attributes: {},
      style: {},
      dataset: {},
      textContent: '',
      value: '',
      disabled: false,
      title: '',
      complete: false,
      naturalWidth: 1,
      classList: {
        _set: new Set(),
        add(name) { this._set.add(name); },
        remove(name) { this._set.delete(name); },
        toggle(name, on) { if (on === undefined) { this._set.has(name) ? this._set.delete(name) : this._set.add(name); } else if (on) this._set.add(name); else this._set.delete(name); },
        contains(name) { return this._set.has(name); }
      },
      appendChild(child) { element.children.push(child); return child; },
      removeChild(child) { return child; },
      setAttribute(name, value) { element.attributes[name] = String(value); },
      getAttribute(name) { return element.attributes[name] === undefined ? null : element.attributes[name]; },
      addEventListener() {},
      removeEventListener() {},
      querySelector(selector) {
        const found = attributesIn(element._html);
        const wanted = /^\[(data-[a-z0-9-]+)(?:="([^"]*)")?\]$/.exec(String(selector));
        if (wanted) {
          if (!found.has(wanted[1])) return null;
          if (wanted[2] !== undefined && !found.get(wanted[1]).includes(wanted[2])) return null;
          return makeElement();
        }
        if (String(selector).startsWith('.')) return makeElement();
        return makeElement();
      },
      querySelectorAll(selector) {
        const found = attributesIn(element._html);
        const wanted = /^\[(data-[a-z0-9-]+)\]$/.exec(String(selector));
        if (wanted && found.has(wanted[1])) return found.get(wanted[1]).map(() => makeElement());
        return [];
      },
      closest() { return makeElement(); },
      get innerHTML() { return element._html || ''; },
      set innerHTML(value) { element._html = String(value); },
      get parentNode() { return makeElement(); },
      remove() {}
    };
    return element;
  };
  const body = makeElement();
  const document = {
    body,
    head: makeElement(),
    documentElement: makeElement(),
    activeElement: null,
    createElement: () => makeElement(),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {}
  };

  values.set('StageApplied', 'classic');
  values.set('StageId', 'classic');
  values.set('RoundPhase', 'Menu');
  values.set('MatchTimeLeft', 180);
  values.set('LanguageCommand', 'ja');
  values.set('ProUnlocked', true);

  const context = vm.createContext({
    runtimeScene: scene, document, console, Date, Math, JSON, Promise, Set, Map, Number, String, Array, Object, isFinite, encodeURIComponent, setTimeout, clearTimeout
  });
  const run = (group, label) => {
    const code = groupCode(group);
    vm.runInContext(`(function () {\n${code}\n})()`, context, { filename: `game.json#${label}` });
  };
  run('v1.0.0 12言語 i18n', 'i18n');
  const frame = () => {
    run('v1.1.0 オンライン中核', 'online core');
    run('v1.1.0 オンラインロビー', 'online lobby');
    run('v1.1.0 クイックスタンプ', 'quick stamps');
  };

  /* The menu's ONLINE tap, then a room, then a start: every screen state. */
  values.set('OnlineUiCommand', 'open');
  frame();
  assert.equal(values.get('OnlineLobbyReady'), true, 'the lobby built itself');
  assert.equal(values.get('OnlineLobbyOpen'), true, 'and it is open');

  values.set('OnlineCommand', 'create');
  frame();
  assert.equal(String(values.get('OnlineRoomCode')).length, 6, 'a room exists');
  frame();
  assert.equal(values.get('OnlineLobbyOpen'), true, 'still open on the room');

  values.set('OnlineCommand', 'ready');
  frame();
  values.set('OnlineCommand', 'start');
  frame();
  assert.equal(values.get('OnlineRoomStatus'), 'playing');
  /* The round start hands over to ROLE REVEAL on the next frame (the menu block
   * does that in the game); the sheet steps aside and the stamp bar appears. */
  values.set('RoundPhase', 'RoleReveal');
  frame();
  assert.equal(values.get('OnlineLobbyOpen'), false, 'the sheet steps aside for the round');
  assert.equal(values.get('OnlineStampButtons'), 8, 'eight stamps on the bar');

  values.set('RoundPhase', 'Menu');
  values.set('OnlineUiCommand', 'open');
  frame();
  assert.equal(values.get('OnlineLobbyOpen'), true, 'and it opens again from the menu');

  values.set('OnlineCommand', 'leave');
  frame();
  assert.equal(values.get('OnlineLobbyOpen'), true, 'the lobby stays up after leaving a room');
  assert.equal(values.get('OnlineRoomCode'), '');
});
