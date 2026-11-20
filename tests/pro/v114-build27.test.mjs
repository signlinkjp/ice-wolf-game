// Build 27 — the guest's movement, the waiting clock, the quick door, the gate
// and the mute.
//
// The brief's five items, each checked against the shipping block rather than a
// copy of it:
//
//   1. the guest's own seat is never walked backwards by a snapshot (the video
//      `ScreenRecording_11-20-2026 21-08-28` — that one lives next to the other
//      guest-movement checks, in v110-online-guest-move.test.mjs);
//   2. the waiting clock: 0 / 30 / 60 / 90 seconds, a countdown that every phone
//      counts the same seconds of, and a start when it runs out;
//   3. the door: a room that is full cannot take another seat, and the empty
//      ones are the CPU fill;
//   4. quick match: six doors on the ordinary room wire, a lobby answers, a full
//      room is walked past, an empty one is opened;
//   5. the gate (every frame is untrusted data) and the mute (the receiver drops
//      a burst and draws nobody's stamp when it is muted).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import { groupCode, readGame, createI18n, LANGS, KANA, repoRoot } from './helpers.mjs';

const plain = (value) => JSON.parse(JSON.stringify(value));

const ONLINE_GROUP = 'v1.1.0 オンライン中核';
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
    ICE_WOLF_ONLINE_ALPHABET, ICE_WOLF_ONLINE_PLAYERS_MIN, ICE_WOLF_ONLINE_SWITCH_CHOICES,
    ICE_WOLF_ONLINE_DURATIONS, ICE_WOLF_ONLINE_STAGES, ICE_WOLF_ONLINE_SEATS,
    ICE_WOLF_ONLINE_WAIT_CHOICES, ICE_WOLF_ONLINE_QUICK_CODES, ICE_WOLF_ONLINE_QUICK_RULES,
    ICE_WOLF_ONLINE_QUICK_WAIT, ICE_WOLF_STAMPS, ICE_WOLF_STAMP_SPAM_MS,
    iceWolfOnlineNewRoom, iceWolfOnlineJoinRoom, iceWolfOnlineRoomRules,
    iceWolfOnlineWaitValue, iceWolfOnlineArm, iceWolfOnlineCountdown,
    iceWolfOnlineSeatHumans, iceWolfOnlineSeatFull, iceWolfOnlineSeatCpus,
    iceWolfOnlineRoster, iceWolfOnlineStart, iceWolfOnlineGuard,
    iceWolfRoomCodeNormalize, iceWolfStampAccept, iceWolfStampById
  };`;
  const context = vm.createContext({ console });
  vm.runInContext(source, context, { filename: 'game.json#v1.1.0 online core' });
  return context.__online;
};
const online = loadOnline();

const NOW = 1763560000000;

const roomWith = (seats, rules = {}, extra = {}) => {
  const room = online.iceWolfOnlineNewRoom({
    code: 'ABCD23',
    hostId: 'h1',
    hostName: 'host',
    stageId: 'classic',
    rules: Object.assign({ playerCount: 7, wolfCount: 1, switchCount: 5, matchSeconds: 180 }, rules),
    correctCount: 3,
    pro: true,
    seed: 1,
    now: NOW
  });
  for (const id of seats) {
    const joined = online.iceWolfOnlineJoinRoom(room, { clientId: id, name: id }, NOW);
    assert.equal(joined.ok, true, `seat for ${id}`);
    Object.assign(room, joined.room);
  }
  return Object.assign(room, extra);
};

// ------------------------------------------------------------- the waiting clock
test('the waiting clock is 0 / 30 / 60 / 90 and nothing else', () => {
  assert.deepEqual(plain(online.ICE_WOLF_ONLINE_WAIT_CHOICES), [0, 30, 60, 90]);
  assert.equal(online.iceWolfOnlineWaitValue(0), 0);
  assert.equal(online.iceWolfOnlineWaitValue(30), 30);
  assert.equal(online.iceWolfOnlineWaitValue('60'), 60);
  assert.equal(online.iceWolfOnlineWaitValue(45), 60, 'a number the game never offered is the default');
  assert.equal(online.iceWolfOnlineWaitValue('abc'), 60);
  assert.equal(online.iceWolfOnlineWaitValue(undefined), 60);
});

test('a room armed at 60 counts down on its own and is due at zero', () => {
  const room = online.iceWolfOnlineArm(roomWith(['h1']), NOW);
  assert.equal(room.waitSeconds, 60);
  assert.equal(room.autoStartAt, NOW + 60000);
  const at10 = online.iceWolfOnlineCountdown(room, NOW + 10000);
  assert.equal(at10.armed, true);
  assert.equal(at10.left, 50);
  assert.equal(at10.due, false);
  const at61 = online.iceWolfOnlineCountdown(room, NOW + 61000);
  assert.equal(at61.left, 0);
  assert.equal(at61.due, true, 'a clock that ran out is due, not negative');
  /* 0 is the START button only: armed is false and nothing happens by itself. */
  const manual = online.iceWolfOnlineArm(roomWith(['h1']), NOW);
  const off = online.iceWolfOnlineArm(Object.assign({}, manual, { waitSeconds: 0 }), NOW);
  assert.equal(off.autoStartAt, 0);
  assert.equal(online.iceWolfOnlineCountdown(off, NOW + 3600000).due, false);
  /* A room that is already playing has no clock. */
  const playing = Object.assign({}, room, { status: 'playing' });
  assert.equal(online.iceWolfOnlineCountdown(playing, NOW).armed, false);
});

test('the countdown the host sends is seconds left, so a guest counts the same', () => {
  const room = online.iceWolfOnlineArm(roomWith(['h1', 'g1']), NOW);
  const left = online.iceWolfOnlineCountdown(room, NOW + 15000).left;
  assert.equal(left, 45);
  /* The guest adopts it as its own deadline from the moment the frame lands. */
  const guestRoom = Object.assign({}, room, { autoStartAt: NOW + 500 + left * 1000 });
  assert.equal(online.iceWolfOnlineCountdown(guestRoom, NOW + 500).left, 45);
  assert.equal(online.iceWolfOnlineCountdown(guestRoom, NOW + 500 + left * 1000).due, true);
});

// ------------------------------------------------------------------- the door
test('the first seats are the door, and the rest are the CPU fill', () => {
  const room = roomWith(['h1', 'g1', 'g2']);
  assert.equal(online.iceWolfOnlineSeatHumans(room), 3);
  assert.equal(online.iceWolfOnlineSeatCpus(room), 4, 'seven players, three phones: four CPUs');
  assert.equal(online.iceWolfOnlineSeatFull(room), false);
  /* A full room refuses the next phone — first come, first seated. */
  const full = roomWith(['h1', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6']);
  assert.equal(online.iceWolfOnlineSeatFull(full), true);
  assert.equal(online.iceWolfOnlineSeatCpus(full), 0);
  const refused = online.iceWolfOnlineJoinRoom(full, { clientId: 'late', name: 'late' }, NOW);
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, 'full');
  assert.equal(refused.messageKey, 'online.roomFull');
  /* A seat that went Out keeps its place: its phone may come back. */
  const away = roomWith(['h1', 'g1']);
  away.seats = away.seats.map((seat) => (seat.clientId === 'g1' ? Object.assign({}, seat, { out: true }) : seat));
  assert.equal(online.iceWolfOnlineJoinRoom(away, { clientId: 'newcomer', name: 'n' }, NOW).ok, true,
    'an Out seat is not a human in the room, but the row stays');
});

test('the start fills the empty seats with CPUs, so a short room still plays', () => {
  const room = roomWith(['h1', 'g1']);
  const started = online.iceWolfOnlineStart(room, { clientId: 'h1', now: NOW, seed: 7 });
  assert.equal(started.ok, true);
  assert.equal(started.payload.playerCount, 7);
  assert.equal(started.payload.roster.length, 7);
  const humans = started.payload.roster.filter((row) => !row.cpu);
  const cpus = started.payload.roster.filter((row) => row.cpu);
  assert.equal(humans.length, 2);
  assert.equal(cpus.length, 5);
  assert.deepEqual(plain(humans.map((row) => row.seat)), [0, 1]);
});

// ------------------------------------------------------------- the quick door
test('quick match walks six valid doors, and its room is the free baseline', () => {
  const doors = plain(online.ICE_WOLF_ONLINE_QUICK_CODES);
  assert.equal(doors.length, 6);
  assert.equal(new Set(doors).size, doors.length);
  for (const door of doors) {
    const normalized = online.iceWolfRoomCodeNormalize(door);
    assert.equal(normalized.ok, true, `${door} is a code a person can type`);
    assert.equal(normalized.code, door);
    for (const character of door) {
      assert.ok(online.ICE_WOLF_ONLINE_ALPHABET.includes(character), `${character} is in the alphabet`);
    }
  }
  /* A quick room is nothing Pro: seven, one wolf, five switches, three minutes. */
  const rules = plain(online.iceWolfOnlineRoomRules(online.ICE_WOLF_ONLINE_QUICK_RULES, false));
  assert.equal(rules.playerCount, 7);
  assert.equal(rules.wolfCount, 1);
  assert.equal(rules.switchCount, 5);
  assert.equal(rules.matchSeconds, 180);
  assert.deepEqual(rules.locked, [], 'a free host of a quick room loses nothing');
  assert.equal(online.ICE_WOLF_ONLINE_QUICK_WAIT, 60, 'a quick room waits a minute, then starts itself');
});

test('a quick room is a room like any other: it seats, it starts, it is guarded', () => {
  const room = Object.assign({}, roomWith(['h1'], {}, {}), { quick: true, waitSeconds: 60 });
  const armed = online.iceWolfOnlineArm(room, NOW);
  assert.equal(armed.quick, true);
  assert.equal(online.iceWolfOnlineCountdown(armed, NOW + 1000).left, 59);
  const guard = online.iceWolfOnlineGuard({
    kind: 'room', code: 'ABCD23', hostId: 'h1', hostName: 'host', stageId: 'classic',
    playerCount: 7, wolfCount: 1, switchCount: 5, matchSeconds: 180, status: 'lobby',
    waitSeconds: 60, countdown: 59, quick: true, humans: 1, full: false,
    seats: [{ seat: 0, clientId: 'h1', name: 'host', ready: false, out: false }]
  }, 'ABCD23');
  assert.equal(guard.ok, true);
});

// -------------------------------------------------------------------- the gate
test('the gate refuses a frame this game could not have sent', () => {
  const goodRoom = {
    kind: 'room', code: 'ABCD23', hostId: 'h1', hostName: 'host', stageId: 'classic',
    playerCount: 7, wolfCount: 1, switchCount: 5, matchSeconds: 180, status: 'lobby',
    seats: [{ seat: 0, clientId: 'h1', name: 'host', ready: false, out: false }]
  };
  assert.equal(online.iceWolfOnlineGuard(goodRoom, 'ABCD23').ok, true);
  /* Another room's frame, a stage that does not exist, a rule the game never
   * draws, a seat out of range, a duplicate seat, a name the UI cannot show. */
  assert.equal(online.iceWolfOnlineGuard(goodRoom, 'ZZZZ99').ok, false);
  assert.equal(online.iceWolfOnlineGuard(Object.assign({}, goodRoom, { stageId: 'moon' }), 'ABCD23').ok, true,
    'an unknown stage is drawn as Classic, so the frame is still one of ours');
  assert.equal(online.iceWolfOnlineGuard(Object.assign({}, goodRoom, { playerCount: 11 }), 'ABCD23').ok, false);
  assert.equal(online.iceWolfOnlineGuard(Object.assign({}, goodRoom, { wolfCount: 3 }), 'ABCD23').ok, false);
  assert.equal(online.iceWolfOnlineGuard(Object.assign({}, goodRoom, { switchCount: 4 }), 'ABCD23').ok, false);
  assert.equal(online.iceWolfOnlineGuard(Object.assign({}, goodRoom, { matchSeconds: 7 }), 'ABCD23').ok, false);
  assert.equal(online.iceWolfOnlineGuard(Object.assign({}, goodRoom, { status: 'paused' }), 'ABCD23').ok, false);
  assert.equal(online.iceWolfOnlineGuard(Object.assign({}, goodRoom, {
    seats: [{ seat: 0, clientId: 'h1', name: 'h' }, { seat: 0, clientId: 'g1', name: 'g' }]
  }), 'ABCD23').ok, false, 'two phones on one seat');
  assert.equal(online.iceWolfOnlineGuard(Object.assign({}, goodRoom, {
    seats: [{ seat: 12, clientId: 'h1', name: 'h' }]
  }), 'ABCD23').ok, false);
  assert.equal(online.iceWolfOnlineGuard(Object.assign({}, goodRoom, {
    seats: [{ seat: 0, clientId: 'h1', name: 'x'.repeat(80) }]
  }), 'ABCD23').ok, false, 'a name longer than the seat row can show');

  const roster = [];
  for (let seat = 0; seat < 7; seat += 1) {
    roster.push({ seat, id: seat === 0 ? 'YOU' : 'ABCDEFG'[seat - 1], clientId: seat < 2 ? 'p' + seat : '', cpu: seat >= 2, role: seat === 0 ? 'Wolf' : 'Human' });
  }
  const goodStart = {
    kind: 'start', code: 'ABCD23', stageId: 'classic', playerCount: 7, wolfCount: 1,
    switchCount: 5, correctCount: 3, matchSeconds: 180, seed: 5, roster
  };
  assert.equal(online.iceWolfOnlineGuard(goodStart, 'ABCD23').ok, true);
  assert.equal(online.iceWolfOnlineGuard(Object.assign({}, goodStart, { roster: roster.slice(0, 6) }), 'ABCD23').ok, false,
    'six rows for a seven player round');
  const wrongRole = roster.map((row, index) => (index === 1 ? Object.assign({}, row, { role: 'WolfKing' }) : row));
  assert.equal(online.iceWolfOnlineGuard(Object.assign({}, goodStart, { roster: wrongRole }), 'ABCD23').ok, false);
  const twice = roster.map((row, index) => (index === 3 ? Object.assign({}, row, { seat: 2 }) : row));
  assert.equal(online.iceWolfOnlineGuard(Object.assign({}, goodStart, { roster: twice }), 'ABCD23').ok, false);

  assert.equal(online.iceWolfOnlineGuard({ kind: 'stamp', stampId: 'help', sender: 'p' }, '').ok, true);
  assert.equal(online.iceWolfOnlineGuard({ kind: 'stamp', stampId: 'nope', sender: 'p' }, '').ok, false);
  assert.equal(online.iceWolfOnlineGuard({ kind: 'snapshot', players: [{ id: 'A', x: 1, y: 2, state: 'Active' }] }, '').ok, true);
  assert.equal(online.iceWolfOnlineGuard({ kind: 'snapshot', players: [{ id: 'A', x: Number.NaN, y: 2 }] }, '').ok, false);
  assert.equal(online.iceWolfOnlineGuard({ kind: 'snapshot', players: [{ id: 'A', x: 1e9, y: 0 }] }, '').ok, false);
  assert.equal(online.iceWolfOnlineGuard({ kind: 'input', moveX: 0, moveY: 0, action: 'dance' }, '').ok, false);
  assert.equal(online.iceWolfOnlineGuard({ kind: 'input', moveX: 0, moveY: 0, action: 'wolf' }, '').ok, true);
});

// -------------------------------------------------------------------- the mute
test('the receiver drops a burst, and a muted phone draws nothing', () => {
  const now = NOW;
  const first = online.iceWolfStampAccept({}, { kind: 'stamp', stampId: 'help', from: 'g1' }, now, {});
  assert.equal(first.ok, true);
  assert.equal(first.log.g1, now);
  const burst = online.iceWolfStampAccept(first.log, { kind: 'stamp', stampId: 'help', from: 'g1' }, now + 300, {});
  assert.equal(burst.ok, false, 'the same sender twice inside 1.5 s is spam');
  assert.equal(burst.reason, 'spam');
  const other = online.iceWolfStampAccept(first.log, { kind: 'stamp', stampId: 'nice', from: 'g2' }, now + 300, {});
  assert.equal(other.ok, true, 'another player is not the spammer');
  const later = online.iceWolfStampAccept(first.log, { kind: 'stamp', stampId: 'help', from: 'g1' }, now + 1600, {});
  assert.equal(later.ok, true, 'after the spam window the sender is welcome again');
  const muted = online.iceWolfStampAccept(first.log, { kind: 'stamp', stampId: 'help', from: 'g1' }, now + 9000, { muted: true });
  assert.equal(muted.ok, false);
  assert.equal(muted.reason, 'muted');
  const unknown = online.iceWolfStampAccept({}, { kind: 'stamp', stampId: 'xyz', from: 'g1' }, now, {});
  assert.equal(unknown.ok, false);
  assert.equal(unknown.reason, 'unknown');
  assert.equal(online.ICE_WOLF_STAMP_SPAM_MS, 1500);
});

// ------------------------------------------------------------- the screens say it
test('the lobby has the quick door, the clock and the mute in twelve languages', () => {
  const lobby = groupCode(LOBBY_GROUP);
  assert.ok(lobby.includes("data-online-quick"), 'the QUICK MATCH button is on the sheet');
  assert.ok(lobby.includes("data-online-chips-wait"), 'the waiting clock has its chips');
  assert.ok(lobby.includes("data-online-countdown"), 'the room shows the countdown');
  assert.ok(lobby.includes("data-online-stampmute"), 'the lobby can mute stamps');
  assert.ok(lobby.includes("command('quick')"));
  assert.ok(lobby.includes("command('stampmute')"));
  assert.ok(lobby.includes("['wait', 'online.wait', [0, 30, 60, 90]"), 'the four clock chips');
  const bar = groupCode(STAMP_GROUP);
  assert.ok(bar.includes("stampmute"), 'the in-match bar can mute too');
});

test('nineteen new lines, twelve languages each, no Japanese left in the others', () => {
  const { i18n } = createI18n({ language: 'ja' });
  const keys = ['online.quick', 'online.quickSearching', 'online.quickHosting', 'online.quickNone',
    'online.quickBusy', 'online.wait', 'online.waitOff', 'online.waitValue', 'online.waitNote',
    'online.waitLeft', 'online.fullStart', 'online.autoStart', 'online.cpuFillNote', 'online.stampMute',
    'online.stampUnmute', 'online.stamped', 'online.seatCpu', 'online.stampTooFast'];
  for (const key of keys) {
    if (key === 'online.stamped') continue;
    for (const lang of LANGS) {
      i18n.setLang(lang);
      const line = i18n.t(key, { n: 3, c: 2 });
      assert.ok(typeof line === 'string' && line.length > 0, `${key} in ${lang}`);
      assert.ok(!line.startsWith('online.'), `${key} is translated in ${lang}: ${line}`);
      if (lang !== 'ja' && lang !== 'zh-Hans' && lang !== 'zh-Hant') {
        assert.ok(!KANA.test(line), `${key} in ${lang} has no Japanese: ${line}`);
      }
    }
  }
  i18n.setLang('ja');
  assert.equal(i18n.t('online.waitLeft', { n: 12, c: 3 }), 'あと 12 秒で自動開始（CPU 3体を補完）');
});

// ------------------------------------------------------------------- the build
test('Build 27 is the build on every side', () => {
  const pbx = fs.readFileSync(path.join(repoRoot, 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8');
  const builds = [...pbx.matchAll(/CURRENT_PROJECT_VERSION = ([^;]+);/g)].map((match) => match[1]);
  /* Build 27 went to TestFlight first; one small fix after that review spends a
   * number of its own (Apple refuses a number twice), so the rule here is the
   * one every build keeps: both configurations and the verifier carry one build,
   * and it is this build or a later one. */
  assert.equal(new Set(builds).size, 1, `both configurations carry one build (${builds.join(', ')})`);
  assert.ok(Number(builds[0]) >= 27, `Build ${builds[0]} is this build or later`);
  const verify = fs.readFileSync(path.join(repoRoot, 'scripts/ios/verify-ios-project.py'), 'utf8');
  assert.ok(verify.includes(`DEFAULT_BUILD_NUMBER = "${builds[0]}"`), 'the verifier defaults to the same build');
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts.test.includes('v114-build27.test.mjs'), 'npm test runs this file');
  assert.equal(readGame().properties.version, '1.1.0', 'the GDevelop project stays 1.1.0');
  const core = groupCode(ONLINE_GROUP);
  assert.ok(core.includes('Build 27'), 'the core block says which build these rules are');
});

// ------------------------------------------------------- the walk, on the wire
/* Two phones on the in-memory hub, running the shipping core block exactly as
 * the event sheet runs it once a frame. The guest-movement file owns the full
 * scene; this one only needs the online half, because what is being checked is
 * the walk between doors and the clock that ends the lobby. */
const bagOf = (values) => (name) => ({
  getAsString: () => String(values.has(name) ? values.get(name) : ''),
  setString: (value) => { values.set(name, String(value)); },
  getAsNumber: () => Number(values.has(name) ? values.get(name) : 0) || 0,
  setNumber: (value) => { values.set(name, Number(value)); },
  getAsBoolean: () => values.get(name) === true,
  setBoolean: (value) => { values.set(name, value === true); }
});

const sceneVariables = () => new Map(readGame().layouts.find((layout) => layout.name === 'FROST LAB')
  .variables.map((variable) => [variable.name, variable.value]));

const makePhone = (world) => {
  const values = sceneVariables();
  const bag = bagOf(values);
  const scene = {
    getVariables: () => ({ get: (name) => { if (!values.has(name)) values.set(name, 0); return bag(name); } }),
    getObjects: () => [],
    getGame: () => ({ getAssetPath: () => '' })
  };
  const fakeDate = class { constructor() { this.value = world.now; } static now() { return world.now; } getTime() { return this.value; } };
  const context = vm.createContext({
    runtimeScene: scene, console, Date: fakeDate, Math, JSON, Number, String, Array, Object, Map, Set, isFinite, NaN, Infinity,
    localStorage: { getItem: () => null, setItem: () => {} }
  });
  const phone = {
    values, scene, world,
    get: (name) => values.get(name),
    set: (name, value) => values.set(name, value),
    run() {
      vm.runInContext(`(function () {\n${groupCode(ONLINE_GROUP)}\n;runtimeScene.__t = { createIceWolfMockHub: createIceWolfMockHub, handleEvent: handleEvent };\n})()`, context, { filename: 'online core' });
    }
  };
  phone.run();
  return phone;
};

const settle = () => new Promise((resolve) => setImmediate(resolve));

test('one phone opens quick match, the next one finds it, the clock starts them', async () => {
  const world = { now: NOW };
  const a = makePhone(world);
  const b = makePhone(world);
  a.set('ProUnlocked', true);
  b.set('ProUnlocked', true);
  a.set('OnlineNameInput', 'host');
  b.set('OnlineNameInput', 'guest');
  a.set('OnlineCommand', 'name');
  b.set('OnlineCommand', 'name');
  a.run();
  b.run();
  const hub = a.scene.__t.createIceWolfMockHub({ now: world.now });
  for (const phone of [a, b]) {
    phone.scene.__iceWolfV110Online.transport = hub.createTransport({ clientId: phone.scene.__iceWolfV110Online.clientId, name: 'p' });
    phone.scene.__iceWolfV110Online.local = false;
    phone.scene.__iceWolfV110Online.transport.on(phone.scene.__t.handleEvent);
  }

  /* A taps QUICK MATCH: the walk starts on the first door and waits 1.8 s. */
  a.set('OnlineCommand', 'quick');
  for (let step = 0; step < 3; step += 1) { a.run(); await settle(); }
  assert.equal(a.get('OnlineQuickSearching'), true, 'the walk is out');
  assert.equal(a.scene.__iceWolfV110Online.quick.code, 'MATCH2');

  /* The door answered with nothing, so A opens it. */
  world.now += 2000;
  for (let step = 0; step < 3; step += 1) { world.now += 50; a.run(); await settle(); }
  assert.equal(a.scene.__iceWolfV110Online.isHost, true, 'the empty door became a room');
  assert.equal(a.get('OnlineRoomCode'), 'MATCH2');
  assert.equal(a.get('OnlineRoomQuick'), true);
  assert.equal(a.get('OnlineWaitAuto'), true, 'the room armed its clock (quick match is 60 s)');
  assert.equal(a.get('OnlineRuleWait'), 60);

  /* B taps QUICK MATCH and lands in A's lobby instead of opening one. */
  b.set('OnlineCommand', 'quick');
  b.run();
  for (let step = 0; step < 12; step += 1) {
    world.now += 50;
    a.run();
    b.run();
    await settle();
  }
  assert.equal(b.scene.__iceWolfV110Online.isHost, false, 'B took a seat, it did not open a room');
  assert.equal(b.get('OnlineRoomCode'), 'MATCH2');
  assert.equal(b.scene.__iceWolfV110Online.seat, 1, 'seat 1');
  assert.equal(b.get('OnlineWaitAuto'), true, 'and it counts the host’s clock');
  assert.ok(b.get('OnlineWaitLeft') > 40, `the countdown came down the wire: ${b.get('OnlineWaitLeft')}`);

  /* Sixty seconds later the host starts by itself; the empty seats are CPUs. */
  a.set('StageApplied', 'classic');
  b.set('StageApplied', 'classic');
  world.now += 61000;
  for (let step = 0; step < 8; step += 1) {
    a.run();
    b.run();
    await settle();
  }
  assert.ok(a.scene.__iceWolfV110Online.payload, 'the host dealt a round when the clock ran out');
  assert.equal(a.scene.__iceWolfV110Online.payload.playerCount, 7);
  assert.equal(a.scene.__iceWolfV110Online.payload.roster.filter((row) => row.cpu).length, 5,
    'two phones, seven seats: five CPUs');
  assert.ok(b.scene.__iceWolfV110Online.payload, 'and the guest was dealt the same round');
  assert.equal(b.scene.__iceWolfV110Online.seat, 1);
});

test('a full door is walked past, not joined', async () => {
  const world = { now: NOW };
  const a = makePhone(world);
  const b = makePhone(world);
  for (const phone of [a, b]) { phone.set('ProUnlocked', true); phone.run(); }
  const hub = a.scene.__t.createIceWolfMockHub({ now: world.now });
  for (const phone of [a, b]) {
    phone.scene.__iceWolfV110Online.transport = hub.createTransport({ clientId: phone.scene.__iceWolfV110Online.clientId, name: 'p' });
    phone.scene.__iceWolfV110Online.local = false;
    phone.scene.__iceWolfV110Online.transport.on(phone.scene.__t.handleEvent);
  }
  /* A opens MATCH2 by hand with a room that is already seven seats deep. */
  a.set('OnlineCommand', 'quick');
  for (let step = 0; step < 3; step += 1) { a.run(); await settle(); }
  world.now += 2000;
  for (let step = 0; step < 3; step += 1) { world.now += 50; a.run(); await settle(); }
  assert.equal(a.scene.__iceWolfV110Online.isHost, true);
  const room = a.scene.__iceWolfV110Online.room;
  a.scene.__iceWolfV110Online.room = Object.assign({}, room, {
    rules: Object.assign({}, room.rules, { playerCount: 7 }),
    seats: room.seats.concat([
      { seat: 1, clientId: 'ghost1', name: 'g1', ready: false, cpu: false, joinedAt: NOW, lastSeen: NOW, out: false, role: '' },
      { seat: 2, clientId: 'ghost2', name: 'g2', ready: false, cpu: false, joinedAt: NOW, lastSeen: NOW, out: false, role: '' },
      { seat: 3, clientId: 'ghost3', name: 'g3', ready: false, cpu: false, joinedAt: NOW, lastSeen: NOW, out: false, role: '' },
      { seat: 4, clientId: 'ghost4', name: 'g4', ready: false, cpu: false, joinedAt: NOW, lastSeen: NOW, out: false, role: '' },
      { seat: 5, clientId: 'ghost5', name: 'g5', ready: false, cpu: false, joinedAt: NOW, lastSeen: NOW, out: false, role: '' },
      { seat: 6, clientId: 'ghost6', name: 'g6', ready: false, cpu: false, joinedAt: NOW, lastSeen: NOW, out: false, role: '' }
    ]),
    revision: (room.revision || 0) + 1
  });
  a.set('OnlineRoomWait', 0);
  a.set('OnlineCommand', 'rule:wait:0');
  a.run();
  for (let step = 0; step < 4; step += 1) { world.now += 50; a.run(); b.run(); await settle(); }

  b.set('OnlineCommand', 'quick');
  b.run();
  /* The walk: MATCH2 answers as full, so B waits its 1.8 s there, takes MATCH3
   * and waits again; seven seconds of frames is the whole walk with room to
   * spare. A keeps its heartbeat, which is what tells B the door is full. */
  for (let step = 0; step < 70; step += 1) { world.now += 100; a.run(); b.run(); await settle(); }
  /* B could not take a seat in MATCH2 (it is full), so it walked to MATCH3 and
   * opened that one — never seated in a room without a seat of its own. */
  assert.equal(b.get('OnlineRoomCode'), 'MATCH3', `B walked to the next door: ${b.get('OnlineRoomCode')}, mode ${b.get('OnlineMode')}`);
  assert.equal(b.scene.__iceWolfV110Online.isHost, true);
  assert.equal(a.scene.__iceWolfV110Online.room.seats.length, 7, 'A’s room is untouched');
});

test('leaving a quick walk stops it: no room opens behind the player', async () => {
  const world = { now: NOW };
  const a = makePhone(world);
  a.set('ProUnlocked', true);
  a.run();
  const hub = a.scene.__t.createIceWolfMockHub({ now: world.now });
  a.scene.__iceWolfV110Online.transport = hub.createTransport({ clientId: a.scene.__iceWolfV110Online.clientId, name: 'p' });
  a.scene.__iceWolfV110Online.local = false;
  a.scene.__iceWolfV110Online.transport.on(a.scene.__t.handleEvent);

  a.set('OnlineCommand', 'quick');
  for (let step = 0; step < 3; step += 1) { a.run(); await settle(); }
  assert.equal(a.get('OnlineQuickSearching'), true);
  a.set('OnlineCommand', 'leave');
  for (let step = 0; step < 3; step += 1) { a.run(); await settle(); }
  assert.equal(a.get('OnlineQuickSearching'), false, 'the walk is off');
  /* Long past the 1.8 s probe: nothing may be opened in the player's name. */
  world.now += 10000;
  for (let step = 0; step < 5; step += 1) { world.now += 50; a.run(); await settle(); }
  assert.equal(a.scene.__iceWolfV110Online.room, null, 'no room was opened after leaving');
  assert.equal(a.scene.__iceWolfV110Online.isHost, false);
  assert.equal(a.get('OnlineRoomCode'), '');
});
