// The v1.1.0 Phase 2c online work, end to end.
//
//   * the guest wolf's designation (the one-per-match "wolf role") travels as
//     `action: 'infect'` with the seat it names, and the host applies that seat
//     — never a closer one — once, and only for a frozen human in reach;
//   * the snapshot carries the two words a guest cannot work out alone: why the
//     round ended (gate / time / frozen) and whether the designation is spent;
//   * a host that leaves or stops answering does not leave the other phones on a
//     frozen arena: the next seat hosts, or the round ends on the menu with the
//     reason.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import { groupCode, readGame, sceneOf } from './helpers.mjs';

const plain = (value) => JSON.parse(JSON.stringify(value));

const between = (code, start, end) => {
  const from = code.indexOf(start);
  const to = code.indexOf(end);
  if (from < 0 || to < 0) throw new Error(`markers missing: ${start}`);
  return code.slice(from, to);
};

/* ------------------------------------------------------------------ blocks */
const ONLINE_GROUP = 'v1.1.0 オンライン中核';
const SYNC_GROUP = 'v1.1.0 オンライン対戦同期';

const loadOnline = () => {
  const source = between(groupCode(ONLINE_GROUP), '/* ==== v1.1.0 online core', '/* ==== end v1.1.0 online core ==== */');
  const names = [
    'ICE_WOLF_ONLINE_ACTIONS', 'ICE_WOLF_ONLINE_INPUT_RATE', 'ICE_WOLF_ONLINE_HOST_LOST_MS',
    'ICE_WOLF_ONLINE_WIN_BY', 'ICE_WOLF_ONLINE_PLAYERS_MIN', 'ICE_WOLF_ONLINE_GRACE_MS',
    'iceWolfOnlineSeatId', 'iceWolfOnlineInput', 'iceWolfOnlineAcceptInput',
    'iceWolfOnlineSnapshot', 'iceWolfOnlineApplySnapshot', 'iceWolfOnlineWinBy',
    'iceWolfOnlineHostCheck', 'iceWolfOnlineNewRoom', 'iceWolfOnlineJoinRoom',
    'iceWolfOnlineTick', 'iceWolfOnlineNextHost', 'iceWolfOnlineConfig',
    'createIceWolfOnlineTransport'
  ];
  const context = vm.createContext({ console });
  vm.runInContext(`${source}\n;globalThis.__online = { ${names.join(', ')} };`, context, { filename: 'game.json#online core' });
  return context.__online;
};

const loadSync = () => {
  const source = between(groupCode(SYNC_GROUP), '/* ==== v1.1.0 online sync', '/* ==== end v1.1.0 online sync ==== */');
  const names = [
    'ICE_WOLF_SYNC_ACTIONS', 'ICE_WOLF_SYNC_INFECT_RANGE', 'ICE_WOLF_SYNC_SEAT_LETTERS',
    'iceWolfSyncSeatId', 'iceWolfSyncInfectSeat', 'iceWolfSyncInfectCandidates',
    'iceWolfSyncInfectChoice', 'iceWolfSyncActionOf', 'iceWolfSyncState', 'iceWolfSyncRole'
  ];
  const context = vm.createContext({ console });
  vm.runInContext(`${source}\n;globalThis.__sync = { ${names.join(', ')} };`, context, { filename: 'game.json#online sync' });
  return context.__sync;
};

const online = loadOnline();
const sync = loadSync();

/* --------------------------------------------------------------- the wire */
test('the wire carries the seat a wolf asks for, and only an infect has one', () => {
  assert.ok(online.ICE_WOLF_ONLINE_ACTIONS.includes('infect'), 'infect is a fifth action');
  const ask = online.iceWolfOnlineInput(7, 0.2, -1, 'infect', { x: 100, y: 100 }, 'b');
  assert.equal(ask.kind, 'input');
  assert.equal(ask.action, 'infect');
  assert.equal(ask.target, 'B', 'a lower case seat becomes the roster letter');
  assert.equal(ask.moveX, 0.2);

  assert.equal(online.iceWolfOnlineInput(8, 0, 0, 'infect', null, 'you').target, 'YOU', 'seat 0 is YOU');
  assert.equal(online.iceWolfOnlineInput(9, 0, 0, 'infect', null, 'Z').target, '', 'an unknown seat names nobody');
  assert.equal(online.iceWolfOnlineInput(10, 0, 0, 'infect', null).target, '', 'no seat means the nearest');
  /* Nothing else grew a field. */
  for (const action of ['none', 'wolf', 'rescue', 'switch']) {
    assert.equal('target' in online.iceWolfOnlineInput(1, 0, 0, action, null, 'A'), false, `${action} has no target`);
  }
  /* The host's accept keeps what the guest sent. */
  const accepted = online.iceWolfOnlineAcceptInput(5, ask);
  assert.equal(accepted.ok, true);
  assert.equal(accepted.input.target, 'B');
  assert.equal(accepted.input.action, 'infect');
});

test('a snapshot says why the round ended and whether the designation is spent', () => {
  const base = { t: 1000, players: [{ id: 'A', x: 1, y: 1 }] };
  const gate = online.iceWolfOnlineSnapshot(Object.assign({}, base, { win: '人間の勝利', winId: 'human', gateWin: true }));
  assert.equal(gate.winBy, 'gate');
  assert.equal(gate.infectUsed, false);
  const time = online.iceWolfOnlineSnapshot(Object.assign({}, base, { win: '人間の勝利', winId: 'human' }));
  assert.equal(time.winBy, 'time', 'a human win with no gate is the clock');
  const frozen = online.iceWolfOnlineSnapshot(Object.assign({}, base, { win: '人狼の勝利', winId: 'wolf', infectUsed: true }));
  assert.equal(frozen.winBy, 'frozen');
  assert.equal(frozen.infectUsed, true);
  assert.equal(online.iceWolfOnlineSnapshot(base).winBy, '', 'a round still running has no reason');

  /* The receiving side keeps the word, and refuses a word it does not know. */
  const applied = online.iceWolfOnlineApplySnapshot(null, Object.assign({}, gate, { t: 2000, infectUsed: true }));
  assert.equal(applied.ok, true);
  assert.equal(applied.snapshot.winBy, 'gate');
  assert.equal(applied.snapshot.infectUsed, true);
  const odd = online.iceWolfOnlineApplySnapshot(applied.snapshot,
    Object.assign({}, gate, { t: 3000, winBy: 'because', winId: 'human' }));
  assert.equal(odd.snapshot.winBy, 'time', 'an unknown reason is recomputed, not printed');
  assert.equal(online.iceWolfOnlineWinBy('frozen', '', false), 'frozen', 'the wolf reason stands alone');
});

test('the host-loss rule: watch, take over, or end', () => {
  const room = online.iceWolfOnlineNewRoom({
    code: 'ABC234', hostId: 'h1', hostName: 'Hana', stageId: 'classic',
    rules: { playerCount: 7, wolfCount: 1, switchCount: 5, matchSeconds: 180 }, pro: true, now: 0
  });
  let seated = online.iceWolfOnlineJoinRoom(room, { clientId: 'h1', name: 'Hana' }, 0).room;
  seated = online.iceWolfOnlineJoinRoom(seated, { clientId: 'c1', name: 'Ken' }, 0).room;
  seated = online.iceWolfOnlineJoinRoom(seated, { clientId: 'c2', name: 'Mio' }, 0).room;
  const playing = Object.assign({}, seated, { status: 'playing' });

  /* The host is answering: nothing to do. */
  assert.equal(online.iceWolfOnlineHostCheck({
    room: playing, clientId: 'c2', phase: 'Active', now: 5000, lastSnapshotAt: 4900
  }).action, 'none');

  /* A snapshot a few seconds old is a hiccup, not a lost host: its seat is
   * still there. */
  const quiet = online.iceWolfOnlineHostCheck({
    room: playing, clientId: 'c2', phase: 'Active', now: 9000, lastSnapshotAt: 5000
  });
  assert.equal(quiet.action, 'none');
  assert.equal(quiet.reason, 'grace');

  /* Past the window the round ends instead of hanging. */
  const lost = online.iceWolfOnlineHostCheck({
    room: playing, clientId: 'c2', phase: 'Active', now: 5000 + online.ICE_WOLF_ONLINE_HOST_LOST_MS + 1,
    lastSnapshotAt: 5000
  });
  assert.equal(lost.action, 'end');
  assert.equal(lost.reason, 'silent');
  assert.equal(lost.messageKey, 'online.hostLost');

  /* The seat-0 phone goes quiet: the next present seat is told to host. */
  const hostOut = Object.assign({}, playing, {
    seats: playing.seats.map((seat) => (seat.clientId === 'h1' ? Object.assign({}, seat, { out: true }) : seat))
  });
  const takeover = online.iceWolfOnlineHostCheck({
    room: hostOut, clientId: 'c1', phase: 'Active', now: 40000, lastSnapshotAt: 39000
  });
  assert.equal(takeover.action, 'takeover');
  assert.equal(takeover.seat, 1);
  assert.equal(takeover.messageKey, 'online.hostLeft');
  /* A higher seat waits for the lower one to take over. */
  assert.equal(online.iceWolfOnlineHostCheck({
    room: hostOut, clientId: 'c2', phase: 'Active', now: 40000, lastSnapshotAt: 39000
  }).action, 'wait');

  /* Nobody left to host: end, whatever the clock says. */
  const alone = Object.assign({}, playing, {
    seats: playing.seats.map((seat) => (seat.clientId === 'c1' ? seat : Object.assign({}, seat, { out: true })))
  });
  const none = online.iceWolfOnlineHostCheck({
    room: alone, clientId: 'c1', phase: 'Active', now: 40000, lastSnapshotAt: 39000
  });
  assert.equal(none.action, 'takeover', 'the only present seat is next in line: it hosts');

  /* A guest who is the host, or a lobby, is never "lost". */
  assert.equal(online.iceWolfOnlineHostCheck({ room: playing, isHost: true, phase: 'Active', now: 99999 }).action, 'none');
  assert.equal(online.iceWolfOnlineHostCheck({ room: seated, clientId: 'c1', phase: 'Active', now: 99999 }).action, 'none');
  assert.equal(online.iceWolfOnlineHostCheck({ room: playing, clientId: 'c1', phase: 'Result', now: 99999 }).action, 'none');
});

/* ----------------------------------------------------------- the designation */
test('the designation picks the seat the guest named, or refuses it', () => {
  const people = [
    { seat: 0, role: 'Human', state: 'Frozen', x: 0, y: 0 },
    { seat: 1, role: 'Human', state: 'Frozen', x: 400, y: 0 },
    { seat: 2, role: 'Human', state: 'Active', x: 10, y: 0 },
    { seat: 3, role: 'Wolf', state: 'Frozen', x: 5, y: 0 }
  ];
  assert.deepEqual(plain(sync.iceWolfSyncInfectCandidates(people, 0, 0, 140).map((row) => row.id)), ['YOU'],
    'only frozen humans in reach are offered, whoever they are');

  assert.deepEqual(plain(sync.iceWolfSyncInfectChoice(people, 0, 0, 140, 0)),
    { ok: true, reason: 'named', seat: 0, id: 'YOU', candidates: [{ seat: 0, id: 'YOU', distance: 0 }] });
  /* No name: the nearest one, which is what the single-target button means. */
  const nearest = sync.iceWolfSyncInfectChoice(people, 0, 0, 140, -1);
  assert.equal(nearest.ok, true);
  assert.equal(nearest.reason, 'nearest');
  assert.equal(nearest.seat, 0);
  /* A name that is not in reach is refused, not swapped for another captive. */
  const far = sync.iceWolfSyncInfectChoice(people, 0, 0, 140, 1);
  assert.equal(far.ok, false);
  assert.equal(far.reason, 'far');
  /* Nothing in reach at all. */
  assert.equal(sync.iceWolfSyncInfectChoice(people, 5000, 5000, 140, -1).ok, false);
  /* The seat letters the picker prints and the wire carries. */
  assert.equal(sync.iceWolfSyncInfectSeat('a'), 1);
  assert.equal(sync.iceWolfSyncInfectSeat('YOU'), 0);
  assert.equal(sync.iceWolfSyncInfectSeat('Z'), -1);
  assert.equal(sync.iceWolfSyncSeatId(2), 'B');
  assert.ok(sync.ICE_WOLF_SYNC_ACTIONS.includes('infect'));
});

test('a wolf with a designation to make asks for that before its mode', () => {
  assert.equal(sync.iceWolfSyncActionOf({ role: 'Wolf', wolfMode: 3, infectTarget: 'B' }), 'infect');
  assert.equal(sync.iceWolfSyncActionOf({ role: 'Wolf', wolfMode: 3 }), 'wolf');
  assert.equal(sync.iceWolfSyncActionOf({ role: 'Wolf', infectTarget: '' }), 'none');
  assert.equal(sync.iceWolfSyncActionOf({ role: 'Human', infectTarget: 'B', switchPressed: true }), 'switch',
    'a human never designates');
});

/* ------------------------------------------------------- the freeze relay */
test('a remote wolf freezes the humans it touches on the host', () => {
  const roster = [];
  for (let seat = 0; seat < 7; seat += 1) {
    roster.push({
      seat, id: seat === 0 ? 'YOU' : 'ABCDEFGHI'[seat - 1],
      clientId: seat === 1 ? 'c1' : '', cpu: seat !== 1,
      role: seat === 1 ? 'Wolf' : 'Human', name: ''
    });
  }
  const onlineState = {
    payload: { kind: 'start', roster },
    seat: 0,
    inputs: { c1: { kind: 'input', seq: 2, moveX: 0, moveY: 0, action: 'wolf', x: 200, y: 200, at: Date.now() } },
    remotePoses: {},
    snapshot: null
  };
  const scene = makeScene({
    variables: { OnlineRoomActive: true, OnlineIsHost: true, RoundPhase: 'Active', RosterDealt: true, InfectionUsed: false },
    online: onlineState
  });
  scene.actors[0].values.set('Role', 'Wolf');
  scene.actors[0].x = 200; scene.actors[0].y = 200;
  scene.actors[1].x = 210; scene.actors[1].y = 210; // a human right next to the wolf
  runSyncFrame(scene);
  assert.equal(scene.actors[1].values.get('State'), 'Frozen', 'the touched human is ice on the host');
  assert.equal(scene.values.get('OnlineRemoteFreezeCount'), 1, 'and the host counted the freeze');
  assert.equal(scene.actors[2].values.get('State'), 'Active', 'nobody else was frozen');
});

/* ------------------------------------------------------ the Supabase slot */
test('an empty key keeps the practice room and never opens a socket', () => {
  const opened = [];
  const FakeSocket = function (url) { opened.push(url); this.send = () => {}; this.close = () => {}; };
  const empty = online.createIceWolfOnlineTransport({ config: { url: 'https://demo.supabase.co', key: '' }, WebSocket: FakeSocket, now: () => 0 });
  assert.equal(empty.local, true, 'no key: practice mode');
  assert.equal(empty.needsConfig, true, 'and it says why');
  assert.equal(opened.length, 0, 'no socket was opened for a key that is not there');

  const badUrl = online.createIceWolfOnlineTransport({ config: { url: 'demo.supabase.co', key: 'x'.repeat(40) }, WebSocket: FakeSocket, now: () => 0 });
  assert.equal(badUrl.local, true, 'a URL without https:// stays local');
  assert.equal(opened.length, 0);

  const nothing = online.createIceWolfOnlineTransport({ config: {}, WebSocket: FakeSocket, now: () => 0 });
  assert.equal(nothing.local, true);
  assert.equal(nothing.reason, 'online.notConfigured');

  /* Both halves present and well formed: the real wire, one socket, the key in
   * the query string (never in the file). */
  const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.anon-public-key';
  const live = online.createIceWolfOnlineTransport({ config: { url: 'https://demo.supabase.co/', key }, WebSocket: FakeSocket, now: () => 0 });
  assert.equal(live.local, false);
  live.transport.connect({ clientId: 'c1', name: 'Ken' });
  assert.equal(opened.length, 1, 'one socket');
  assert.ok(opened[0].startsWith('wss://demo.supabase.co/realtime/v1/websocket?apikey='), opened[0]);
  assert.ok(opened[0].includes(encodeURIComponent(key)), 'the anon key rides the handshake');

  /* The dashboard's own names work too. */
  const named = online.iceWolfOnlineConfig({ SUPABASE_URL: 'https://demo.supabase.co', SUPABASE_ANON_KEY: key });
  assert.equal(named.configured, true);
  assert.equal(named.host, 'demo.supabase.co');
});

/* --------------------------------------------------------- whole frames */
const sceneVariables = () => new Map(sceneOf(readGame()).variables.map((variable) => [variable.name, variable.value]));

const makeBag = (values) => (name) => ({
  getAsString: () => String(values.has(name) ? values.get(name) : ''),
  setString: (value) => { values.set(name, String(value)); },
  getAsNumber: () => Number(values.has(name) ? values.get(name) : 0) || 0,
  setNumber: (value) => { values.set(name, Number(value)); },
  getAsBoolean: () => values.get(name) === true,
  setBoolean: (value) => { values.set(name, value === true); }
});

const makeObject = (x, y, initial) => {
  const values = new Map(Object.entries(initial || {}));
  const bag = makeBag(values);
  const object = {
    x, y,
    getX: () => object.x,
    setX: (value) => { object.x = Number(value); },
    getY: () => object.y,
    setY: (value) => { object.y = Number(value); },
    getZ: () => 0,
    setZ: () => {},
    getWidth: () => 17,
    getHeight: () => 17,
    getAngle: () => 0,
    getCenterXInScene: () => object.x + 8.5,
    getCenterYInScene: () => object.y + 8.5,
    getVariables: () => ({ get: (name) => bag(name) }),
    values
  };
  return object;
};

const makeScene = (options) => {
  const values = sceneVariables();
  for (const [name, value] of Object.entries(options.variables || {})) values.set(name, value);
  const bag = makeBag(values);
  const actors = [];
  for (let index = 0; index < 9; index += 1) {
    actors.push(makeObject(-488.5 + index * 100, -8.5, {
      Role: 'Human', State: 'Active', DisplayId: 'ABCDEFGHI'[index], LabelText: ''
    }));
  }
  const player = makeObject(0, 350, { Role: 'Human', State: 'Active', DisplayId: 'YOU', LabelText: '' });
  const feedback = makeObject(0, 0, {});
  feedback.setString = (value) => { feedback.text = String(value); };
  feedback.hide = () => {};
  feedback.text = '';
  const scene = {
    values,
    player,
    actors,
    feedback,
    getVariables: () => ({ get: (name) => { if (!values.has(name)) values.set(name, 0); return bag(name); } }),
    getObjects: (name) => {
      if (name === 'Player') return [player];
      if (name === 'Actor') return actors;
      if (name === 'ActionFeedbackText') return [feedback];
      return [];
    },
    getGame: () => ({ getAssetPath: () => '' }),
    __iceWolfV070: { switches: [], gates: [], gateOpenIndex: -1 },
    __iceWolfV110Online: options.online || null,
    __iceWolfI18n: { t: (key) => key }
  };
  return scene;
};

const runSyncFrame = (scene) => {
  const code = groupCode(SYNC_GROUP);
  const context = vm.createContext({ runtimeScene: scene, console, Date, Math, JSON, Number, String, Array, Object, Map, Set, isFinite });
  vm.runInContext(code, context, { filename: `game.json#${SYNC_GROUP}` });
};

test('a guest wolf asks the host, and the host turns the captive it named — once', () => {
  /* Seven seats: seat 0 is the host, seat 1 is a phone playing the wolf, seat 2
   * is a frozen human standing right next to it, seat 3 is a frozen human far
   * away, and the rest are CPUs. */
  const roster = [];
  for (let seat = 0; seat < 7; seat += 1) {
    roster.push({
      seat, id: seat === 0 ? 'YOU' : 'ABCDEFGHI'[seat - 1],
      clientId: seat === 1 ? 'c1' : '', cpu: seat !== 1,
      role: seat === 1 ? 'Wolf' : 'Human', name: seat === 1 ? 'Ken' : ''
    });
  }
  const onlineState = {
    payload: { kind: 'start', roster },
    seat: 0,
    inputs: { c1: { kind: 'input', seq: 3, moveX: 0, moveY: 0, action: 'infect', target: 'B', x: 95, y: 95, at: Date.now() } },
    remotePoses: {},
    snapshot: null
  };
  const scene = makeScene({
    variables: { OnlineRoomActive: true, OnlineIsHost: true, RoundPhase: 'Active', RosterDealt: true, InfectionUsed: false },
    online: onlineState
  });
  scene.actors[0].values.set('Role', 'Wolf');   // seat 1, the guest
  scene.actors[0].x = 95; scene.actors[0].y = 95;
  scene.actors[1].values.set('State', 'Frozen'); // seat 2, 'B', next to it
  scene.actors[1].x = 100; scene.actors[1].y = 100;
  scene.actors[2].values.set('State', 'Frozen'); // seat 3, 'C', far away
  scene.actors[2].x = 1200; scene.actors[2].y = -400;

  runSyncFrame(scene);
  assert.equal(scene.actors[1].values.get('State'), 'FrozenWolfCandidate', 'the named captive became the wolf role');
  assert.equal(scene.actors[2].values.get('State'), 'Frozen', 'the far one is untouched');
  assert.equal(scene.values.get('InfectionUsed'), true, 'the host spent its one designation');
  assert.equal(scene.values.get('OnlineRemoteInfectCount'), 1);
  assert.ok(String(scene.feedback.text).includes('人狼役'), `the host says what happened: ${scene.feedback.text}`);

  /* The same request again (ten inputs a second) does nothing twice. */
  for (let frame = 0; frame < 5; frame += 1) {
    onlineState.inputs.c1.at = Date.now();
    runSyncFrame(scene);
  }
  assert.equal(scene.values.get('OnlineRemoteInfectCount'), 1, 'a repeat cannot designate a second wolf');
});

test('the host refuses a named seat that is not a frozen human in reach', () => {
  const roster = [];
  for (let seat = 0; seat < 7; seat += 1) {
    roster.push({
      seat, id: seat === 0 ? 'YOU' : 'ABCDEFGHI'[seat - 1],
      clientId: seat === 1 ? 'c1' : '', cpu: seat !== 1,
      role: seat === 1 ? 'Wolf' : 'Human', name: ''
    });
  }
  const onlineState = {
    payload: { kind: 'start', roster },
    seat: 0,
    inputs: { c1: { kind: 'input', seq: 4, moveX: 0, moveY: 0, action: 'infect', target: 'C', x: 95, y: 95, at: Date.now() } },
    remotePoses: {},
    snapshot: null
  };
  const scene = makeScene({
    variables: { OnlineRoomActive: true, OnlineIsHost: true, RoundPhase: 'Active', RosterDealt: true, InfectionUsed: false },
    online: onlineState
  });
  scene.actors[0].values.set('Role', 'Wolf');
  scene.actors[0].x = 95; scene.actors[0].y = 95;
  scene.actors[1].values.set('State', 'Frozen'); // seat 2 ('B') is right there
  scene.actors[1].x = 100; scene.actors[1].y = 100;
  scene.actors[2].values.set('State', 'Frozen'); // seat 3 ('C') is far
  scene.actors[2].x = 1200; scene.actors[2].y = -400;

  runSyncFrame(scene);
  assert.equal(scene.actors[1].values.get('State'), 'Frozen', 'the closer captive was not swapped in');
  assert.equal(scene.actors[2].values.get('State'), 'Frozen');
  assert.equal(scene.values.get('InfectionUsed'), false, 'nothing was spent');

  /* A human seat asking for the same thing is ignored: only a wolf designates. */
  onlineState.inputs.c1 = { kind: 'input', seq: 5, moveX: 0, moveY: 0, action: 'infect', target: 'B', x: 95, y: 95, at: Date.now() };
  scene.actors[0].values.set('Role', 'Human');
  runSyncFrame(scene);
  assert.equal(scene.actors[1].values.get('State'), 'Frozen');
  assert.equal(scene.values.get('InfectionUsed'), false);
});

test('a guest sees the designation spent and why the round ended', () => {
  const roster = [];
  for (let seat = 0; seat < 7; seat += 1) {
    roster.push({ seat, id: seat === 0 ? 'YOU' : 'ABCDEFGHI'[seat - 1], clientId: seat === 2 ? 'c2' : '', cpu: seat !== 2, role: 'Human', name: '' });
  }
  const makeGuest = (snapshot) => makeScene({
    variables: { OnlineRoomActive: true, OnlineIsHost: false, RoundPhase: 'Active', RosterDealt: true, GameOver: false, EscapeWonByGate: false },
    online: { payload: { kind: 'start', roster }, seat: 2, inputs: {}, snapshot }
  });
  const base = {
    kind: 'snapshot', t: 7000, phase: 'Active', timer: 12,
    players: [{ id: 'YOU', x: 0, y: 0, role: 'Human', state: 'Active', mode: 0 }],
    switches: { active: 0, triggered: 0, on: [], spent: [], layout: [] },
    gates: { openIndex: -1, openFloor: '', unlocked: false, layout: [] }
  };

  /* A designation spent on the host's phone hides the guest's button. */
  const spent = makeGuest(Object.assign({}, base, { infectUsed: true }));
  runSyncFrame(spent);
  assert.equal(spent.values.get('InfectionUsed'), true, 'the guest learns the one designation is gone');

  /* A human win by the clock is not a gate escape. */
  const byTime = makeGuest(Object.assign({}, base, { win: '人間の勝利', winId: 'human', winBy: 'time' }));
  runSyncFrame(byTime);
  assert.equal(byTime.values.get('GameOver'), true);
  assert.equal(byTime.values.get('EscapeWonByGate'), false, 'time ran out, nobody escaped');
  assert.equal(byTime.values.get('OnlineSyncWinId'), 'human');

  const byGate = makeGuest(Object.assign({}, base, { win: '人間の勝利', winId: 'human', winBy: 'gate' }));
  runSyncFrame(byGate);
  assert.equal(byGate.values.get('EscapeWonByGate'), true, 'the gate is the gate');

  const byIce = makeGuest(Object.assign({}, base, { win: '人狼の勝利', winId: 'wolf', winBy: 'frozen' }));
  runSyncFrame(byIce);
  assert.equal(byIce.values.get('EscapeWonByGate'), false);
  assert.equal(byIce.values.get('OnlineSyncWinId'), 'wolf');
});

/* ------------------------------------------------ the online frame loop */
/* A guest phone with a room, a transport that records what it sends, and the
 * scene variables the shipping block reads. */
const makeLoopScene = (options) => {
  const settings = options || {};
  const values = sceneVariables();
  for (const [name, value] of Object.entries(settings.variables || {})) values.set(name, value);
  const bag = makeBag(values);
  const sent = [];
  const transport = {
    kind: 'fake',
    state: { joined: true, connected: true, code: 'ABC234' },
    send: (message) => { sent.push(message); return true; },
    pump: () => 0,
    on: () => {},
    off: () => {},
    presence: () => [],
    leave: () => Promise.resolve({ ok: true }),
    disconnect: () => Promise.resolve({ ok: true })
  };
  const player = makeObject(120, 200, { Role: settings.role || 'Wolf', State: 'Active', DisplayId: 'YOU', LabelText: '' });
  const state = Object.assign({
    clientId: settings.clientId || 'c1',
    name: 'Ken',
    config: { configured: false, reason: 'online.notConfigured' },
    configChecked: true,
    local: false,
    transport: transport,
    hub: null,
    room: settings.room || null,
    payload: settings.payload || null,
    snapshot: settings.snapshot || null,
    seat: settings.seat === undefined ? 1 : settings.seat,
    isHost: settings.isHost === true,
    mode: 'guest',
    errorKey: '',
    noteKey: '',
    stampCount: 0,
    stampLastAt: 0,
    stampSerial: 0,
    stampBubble: null,
    inputs: {},
    lastInputAt: 0,
    lastSnapshotAt: 0,
    lastSnapshotRxAt: Date.now(),
    lastRoomAt: 0,
    sequence: 0,
    broadcastRevision: 0,
    pendingStart: null,
    started: true,
    sawPresence: false,
    migrated: false,
    infectTarget: '',
    infectLeft: 0,
    pendingLobbyOpen: false
  }, settings.online || {});
  const scene = {
    values,
    player,
    sent,
    transport,
    getVariables: () => ({ get: (name) => { if (!values.has(name)) values.set(name, 0); return bag(name); } }),
    getObjects: (name) => (name === 'Player' ? [player] : []),
    getGame: () => ({ getAssetPath: () => '' }),
    __iceWolfV110Online: state,
    __iceWolfI18n: { t: (key) => key }
  };
  return scene;
};

const runOnlineFrame = (scene) => {
  const code = `(function () {\n${groupCode(ONLINE_GROUP)}\n})()`;
  const context = vm.createContext({
    runtimeScene: scene, console, Date, Math, JSON, Promise, Set, Map, Number, String, Array, Object,
    isFinite, encodeURIComponent, setTimeout, clearTimeout
  });
  vm.runInContext(code, context, { filename: `game.json#${ONLINE_GROUP}` });
};

const guestRoom = (hostOut) => ({
  code: 'ABC234', hostId: 'h1', hostName: 'Hana', stageId: 'classic',
  rules: { playerCount: 7, wolfCount: 1, switchCount: 5, matchSeconds: 180, locked: [], pro: true },
  pro: true, status: 'playing', seed: 11, createdAt: 0, startedAt: Date.now() - 60000, result: '', revision: 4,
  seats: [
    { seat: 0, clientId: 'h1', name: 'Hana', ready: true, cpu: false, joinedAt: 0, lastSeen: 0, out: hostOut === true, role: '' },
    { seat: 1, clientId: 'c1', name: 'Ken', ready: true, cpu: false, joinedAt: 0, lastSeen: Date.now(), out: false, role: '' },
    { seat: 2, clientId: 'c2', name: 'Mio', ready: true, cpu: false, joinedAt: 0, lastSeen: Date.now(), out: false, role: '' }
  ]
});

const guestPayload = () => ({
  kind: 'start', code: 'ABC234', stageId: 'classic', playerCount: 7, wolfCount: 1,
  switchCount: 5, matchSeconds: 180, seed: 11, startAt: 0, at: 0,
  roster: [
    { seat: 0, id: 'YOU', clientId: 'h1', name: 'Hana', cpu: false, role: 'Human' },
    { seat: 1, id: 'A', clientId: 'c1', name: 'Ken', cpu: false, role: 'Wolf' },
    { seat: 2, id: 'B', clientId: 'c2', name: 'Mio', cpu: false, role: 'Human' }
  ]
});

test('a guest wolf sends its designation as an infect on the wire', () => {
  const scene = makeLoopScene({
    variables: {
      RoundPhase: 'Active', GameOver: false, OnlineRoomActive: true, OnlineIsHost: false,
      ProUnlocked: true, InfectionUsed: false, WolfModeLeft: 0, StageApplied: 'classic', StageId: 'classic',
      OnlineInfectRequest: 'B', OnlineInfectRequestLeft: 1.2
    },
    room: guestRoom(false),
    payload: guestPayload()
  });
  runOnlineFrame(scene);
  const inputs = scene.sent.filter((message) => message && message.kind === 'input');
  assert.ok(inputs.length >= 1, 'the guest sent its input');
  const infect = inputs.find((message) => message.action === 'infect');
  assert.ok(infect, 'the request went out as an infect');
  assert.equal(infect.target, 'B', 'naming the seat the picker chose');
  assert.ok(scene.values.get('OnlineInfectRequestLeft') < 1.2, 'the request is counting down, not kept forever');

  /* Five more frames inside the 1.2s window keep asking; the host is idempotent. */
  for (let frame = 0; frame < 4; frame += 1) {
    scene.__iceWolfV110Online.lastInputAt = 0;
    runOnlineFrame(scene);
  }
  assert.ok(scene.sent.filter((message) => message.action === 'infect').length >= 3, 'it asks more than once');

  /* Past the window the guest stops asking and forgets the name. */
  scene.values.set('OnlineInfectRequestLeft', 0.05);
  scene.__iceWolfV110Online.lastInputAt = 0;
  runOnlineFrame(scene);
  scene.values.set('OnlineInfectRequestLeft', 0);
  scene.values.set('OnlineInfectRequest', 'B');
  scene.__iceWolfV110Online.lastInputAt = 0;
  runOnlineFrame(scene);
  assert.equal(scene.values.get('OnlineInfectRequest'), '', 'a spent request is cleared');
  const last = scene.sent.filter((message) => message.kind === 'input').pop();
  assert.notEqual(last.action, 'infect', `nothing is asked once the window closed: ${last.action}`);
});

test('a guest whose host goes silent ends the round on the online screen, not on a frozen arena', () => {
  const scene = makeLoopScene({
    variables: { RoundPhase: 'Active', GameOver: false, OnlineRoomActive: true, OnlineIsHost: false, ProUnlocked: true, StageApplied: 'classic', StageId: 'classic' },
    room: guestRoom(false),
    payload: guestPayload(),
    online: { lastSnapshotRxAt: Date.now() - 60000, snapshot: null }
  });
  runOnlineFrame(scene);
  assert.equal(scene.values.get('OnlineHostLost'), true, 'the phone noticed the host is gone');
  assert.equal(scene.values.get('RoundCommand'), 'Menu', 'the round is over, the menu is next');
  assert.equal(scene.values.get('OnlineRoomActive'), false, 'no half-live room is left behind');
  assert.equal(scene.values.get('OnlineRoomCode'), '', 'the room is closed');
  assert.equal(scene.values.get('OnlineNoteText'), 'online.hostLost', 'and it says why');

  /* The sheet opens once the menu is actually on screen. */
  scene.values.set('RoundPhase', 'Menu');
  runOnlineFrame(scene);
  assert.equal(scene.values.get('OnlineUiCommand'), 'open', 'the ONLINE sheet asks to open');
});

test('a guest whose host left takes the room over instead of ending the round', () => {
  const scene = makeLoopScene({
    variables: { RoundPhase: 'Active', GameOver: false, OnlineRoomActive: true, OnlineIsHost: false, ProUnlocked: true, StageApplied: 'classic', StageId: 'classic' },
    room: Object.assign({}, guestRoom(true), {
      seats: [
        { seat: 0, clientId: 'h1', name: 'Hana', ready: true, cpu: false, joinedAt: 0, lastSeen: 0, out: true, role: '' },
        { seat: 1, clientId: 'c1', name: 'Ken', ready: true, cpu: false, joinedAt: 0, lastSeen: Date.now(), out: false, role: '' }
      ]
    }),
    payload: guestPayload()
  });
  runOnlineFrame(scene);
  assert.equal(scene.values.get('OnlineIsHost'), true, 'the next seat hosts the same round');
  assert.equal(scene.values.get('OnlineMigrated'), true);
  assert.equal(scene.values.get('OnlineNoteText'), 'online.hostLeft');
  assert.equal(scene.values.get('OnlineHostLost'), false, 'this phone is not lost: it is the host');
  assert.equal(scene.values.get('OnlineRoomActive'), true, 'the round keeps its room');
  assert.equal(scene.values.get('RoundCommand'), '', 'and it is not sent back to the menu');
  assert.ok(scene.sent.some((message) => message && message.kind === 'room'), 'the new host tells the room');
});

test('a wire that dies mid-round is given the grace, an error ends it at once', () => {
  /* Build 31: a socket that closes while the phone is in LINE is a pause, not
   * the end (the frame loop rejoins; see v116-build31.test.mjs). An error from
   * the server, or a grace that runs out, ends the round exactly as before. The
   * two frame tests above prove endOnlineRound itself. */
  const code = groupCode(ONLINE_GROUP);
  assert.ok(code.includes("if (kind === 'error' || kind === 'closed')"), 'the wire reports both kinds');
  const branch = code.slice(code.indexOf("if (kind === 'error' || kind === 'closed')"));
  assert.ok(branch.slice(0, 900).includes("online.room.status === 'playing'"), 'and only a live round is concerned');
  assert.ok(branch.slice(0, 900).includes("online.wireLostAt = clock()"), 'a closed wire opens the grace');
  assert.ok(branch.slice(0, 900).includes('endOnlineRound('), 'an error still ends the round');
  assert.ok(branch.slice(0, 1200).includes("setError(key)"), 'a lobby just says why');
});
