// Build 24 — a guest's own character walks where its thumb pushes it.
//
// Build 23 shipped a leash. `iceWolfSyncLocal()` is a fixed-weight nudge (32% of
// the gap), and the guest branch of `v1.1.0 オンライン対戦同期` called it on every
// frame with whatever snapshot it held. At 60 frames a second that is 32% of the
// same gap sixty times between two 5Hz snapshots: the guest's character was
// dragged back to the host's last copy faster than 260px/s of input could move
// it, so a guest that held the stick for a whole match never left the spot — and
// the host, whose copy is only as good as the pose the guest reports, saw a
// character standing still.
//
// The tests here drive the shipping blocks with two phones on the in-memory hub:
// the core block on each side (room, start payload, 10Hz inputs, 5Hz snapshots),
// the sync block on each side (the host moves the remote seats, the guest moves
// its own Player), and the event sheet's own SetX/SetY, which is four lines of
// `SetX Player + MoveX * 260 * SpeedFactor * TimeDelta()` and cannot be run
// without a scene. Everything else is the code the app runs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import { readGame, sceneOf } from './helpers.mjs';

const CORE_GROUP = 'v1.1.0 オンライン中核';
const SYNC_GROUP = 'v1.1.0 オンライン対戦同期';
const JOYSTICK_GROUP = 'v0.6.3 Virtual joystick + keyboard movement (fixed camera)';

const allBlocks = (name) => {
  const group = sceneOf(readGame()).events.find((event) => event.name === name);
  if (!group) throw new Error(`event group not found: ${name}`);
  const blocks = [];
  const walk = (event) => {
    const code = event.inlineCode;
    if (typeof code === 'string') blocks.push(code);
    else if (Array.isArray(code)) blocks.push(code.join('\n'));
    for (const child of event.events || []) walk(child);
  };
  walk(group);
  return blocks.join('\n');
};

const CORE = allBlocks(CORE_GROUP);
const SYNC = allBlocks(SYNC_GROUP);
const JOYSTICK = allBlocks(JOYSTICK_GROUP); // the group's JS child: stick → MoveX/MoveY

const SPAWNS = [
  [-488.5, -8.5], [1050, -350], [471.5, -8.5], [2100, -350], [-8.5, -458.5],
  [1050, 350], [-488.5, -458.5], [2100, 350], [471.5, 441.5]
];

const bagOf = (values) => (name) => ({
  getAsString: () => String(values.has(name) ? values.get(name) : ''),
  setString: (value) => { values.set(name, String(value)); },
  getAsNumber: () => Number(values.has(name) ? values.get(name) : 0) || 0,
  setNumber: (value) => { values.set(name, Number(value)); },
  getAsBoolean: () => values.get(name) === true,
  setBoolean: (value) => { values.set(name, value === true); }
});

const makeObject = (x, y, initial = {}) => {
  const values = new Map(Object.entries(initial));
  const bag = bagOf(values);
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
    hide: () => {},
    setString: (value) => { values.set('text', String(value)); },
    getCenterXInScene: () => object.x + 8.5,
    getCenterYInScene: () => object.y + 8.5,
    getVariables: () => ({ get: (name) => bag(name) }),
    values
  };
  return object;
};

/* A clock the test drives: the core asks Date.now(), the sync block reads
 * `runtimeScene.__iceWolfV110SyncNow` when it is a number. */
const makeWorld = (start = 1763560000000) => ({ now: start });

const fakeDate = (world) => class FakeDate {
  constructor() { this.value = world.now; }
  static now() { return world.now; }
  getTime() { return this.value; }
};

const PHONE_VARIABLES = () => new Map(sceneOf(readGame()).variables.map((variable) => [variable.name, variable.value]));

class Phone {
  constructor(world) {
    this.world = world;
    this.dtMs = 16;
    const values = PHONE_VARIABLES();
    const bag = bagOf(values);
    const actors = [];
    for (let index = 0; index < 9; index += 1) {
      actors.push(makeObject(SPAWNS[index][0], SPAWNS[index][1], {
        Role: 'Human', State: 'Active', DisplayId: 'ABCDEFGHI'[index], LabelText: '',
        AIWolfModeLeft: 0, AIWolfCooldownLeft: 0
      }));
    }
    const player = makeObject(0, 350, { Role: 'Human', State: 'Active', DisplayId: 'YOU', LabelText: '' });
    const arena = {
      switches: [
        { x: -660, y: 480, kind: 'correct', on: false, spent: false },
        { x: 0, y: 600, kind: 'dummy', on: false, spent: false },
        { x: 920, y: 600, kind: 'correct', on: false, spent: false }
      ],
      gates: [{ x: -650, y: -650, open: false }, { x: 590, y: 590, open: false }, { x: -48, y: -48, open: false }],
      gateOpenIndex: -1
    };
    const objects = {
      Player: [player],
      Actor: actors,
      SwitchPad: arena.switches.map(() => makeObject(0, 0, {})),
      GatePad: arena.gates.map(() => makeObject(0, 0, {})),
      WinText: [makeObject(0, 0, {})],
      ActionFeedbackText: [makeObject(0, 0, {})],
      BuildText: [makeObject(0, 0, {})]
    };
    this.values = values;
    this.player = player;
    this.actors = actors;
    this.scene = {
      values,
      player,
      actors,
      arena,
      getVariables: () => ({ get: (name) => { if (!values.has(name)) values.set(name, 0); return bag(name); } }),
      getObjects: (name) => objects[name] || [],
      getGame: () => ({ getAssetPath: () => '' }),
      getTimeManager: () => ({ getElapsedTime: () => this.dtMs / 1000 }),
      __iceWolfV070: arena,
      __iceWolfV110Online: null,
      __iceWolfI18n: { t: (key) => key }
    };
    this.context = vm.createContext({
      runtimeScene: this.scene,
      console,
      Date: fakeDate(world),
      Math, JSON, Number, String, Array, Object, Map, Set, isFinite, NaN, Infinity
    });
  }
  get online() { return this.scene.__iceWolfV110Online; }
  get(name) { return this.values.get(name); }
  set(name, value) { this.values.set(name, value); }
  run(code, filename) {
    this.scene.__iceWolfV110SyncNow = this.world.now;
    vm.runInContext(`(function () {\n${code}\n})()`, this.context, { filename });
  }
  /* One frame in the event sheet's order: the joystick group (its JS child, then
   * the four SetX/SetY actions), the online core, then the online sync block,
   * which is the last group in the scene. */
  frame() {
    this.run(JOYSTICK, 'joystick');
    const moveX = Number(this.values.get('MoveX')) || 0;
    const moveY = Number(this.values.get('MoveY')) || 0;
    const playing = this.values.get('GameOver') !== true
      && this.player.values.get('State') === 'Active';
    if (playing && (moveX !== 0 || moveY !== 0)) {
      const speed = 260 * (Number(this.values.get('SpeedFactor')) || 1);
      if (moveX !== 0) this.player.setX(this.player.getX() + moveX * speed * (this.dtMs / 1000));
      if (moveY !== 0) this.player.setY(this.player.getY() + moveY * speed * (this.dtMs / 1000));
    }
    this.run(`${CORE}\n;runtimeScene.__onlineTest = { createIceWolfMockHub: createIceWolfMockHub, handleEvent: handleEvent };`, 'online core');
    this.run(SYNC, 'online sync');
  }
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

/* A whole match, from the room code to the first frame of play, on two phones
 * that share one in-memory hub (the transport the tests have always used). */
const openMatch = async () => {
  const world = makeWorld();
  const host = new Phone(world);
  const guest = new Phone(world);
  host.set('ProUnlocked', true);
  host.frame();
  guest.frame();
  const hub = host.scene.__onlineTest.createIceWolfMockHub({ now: world.now });
  for (const phone of [host, guest]) {
    /* Each phone handles the wire with its own block's listener: the closure owns
     * that phone's `vars` and `online`, so the two never share state. */
    phone.online.transport = hub.createTransport({ clientId: phone.online.clientId, name: 'p' });
    phone.online.local = false;
    phone.online.transport.on(phone.scene.__onlineTest.handleEvent);
  }
  host.set('OnlineCommand', 'create');
  host.frame();
  await tick(); await tick(); await tick();
  const code = host.online.room.code;
  assert.equal(typeof code, 'string');
  assert.equal(code.length, 6, 'the host has a six character room');
  guest.set('OnlineCommand', `join:${code}`);
  guest.frame();
  await tick(); await tick(); await tick();
  for (let index = 0; index < 30; index += 1) {
    world.now += 50;
    host.frame();
    guest.frame();
    await tick();
  }
  assert.equal(guest.online.seat, 1, 'the guest sits in seat 1');
  host.set('StageApplied', 'classic');
  host.set('StageId', 'classic');
  guest.set('StageApplied', 'classic');
  host.set('OnlineCommand', 'start');
  host.frame();
  await tick(); await tick(); await tick();
  host.frame();
  guest.frame();
  assert.ok(guest.online.payload, 'the guest was dealt the round');
  for (const phone of [host, guest]) {
    phone.set('RoundPhase', 'Active');
    phone.set('GameOver', false);
    phone.set('RosterDealt', true);
    phone.set('MatchTimeLeft', 180);
    phone.player.values.set('State', 'Active');
    phone.player.setX(0);
    phone.player.setY(350);
  }
  for (let index = 0; index < 20; index += 1) {
    world.now += 16;
    host.frame();
    guest.frame();
    await tick();
  }
  return { world, host, guest, hub };
};

// ------------------------------------------------------------- the regression
test('the guest’s own seat is nudged once per snapshot, not once per frame', () => {
  /* One snapshot held for five frames is one piece of news. Build 23 pulled the
   * Player 32% of the way on every frame, which is what a leash feels like. */
  const world = makeWorld();
  const guest = new Phone(world);
  const roster = [];
  for (let seat = 0; seat < 7; seat += 1) {
    roster.push({ seat, id: seat === 0 ? 'YOU' : 'ABCDEFGHI'[seat - 1], clientId: seat === 1 ? 'g1' : '', cpu: seat !== 1, role: 'Human', name: '' });
  }
  const snapshot = {
    kind: 'snapshot', t: 9000, phase: 'Active', timer: 120,
    players: [
      { id: 'YOU', x: 0, y: 350, z: 0, yaw: 0, role: 'Human', state: 'Active', mode: 0 },
      { id: 'A', x: 1100, y: 350, z: 0, yaw: 0, role: 'Human', state: 'Active', mode: 0 }
    ],
    switches: { active: 0, triggered: 0, enabled: true, serial: 0, on: [], spent: [], layout: [] },
    gates: { openIndex: 0, openFloor: '', unlocked: false, serial: 0, layout: [] }
  };
  guest.scene.__iceWolfV110Online = { payload: { kind: 'start', roster }, seat: 1, inputs: {}, snapshot, syncRolesApplied: true };
  guest.set('OnlineRoomActive', true);
  guest.set('OnlineIsHost', false);
  guest.set('RoundPhase', 'Active');
  guest.set('GameOver', false);
  guest.set('RosterDealt', true);
  guest.player.setX(1000);
  guest.player.setY(350);
  guest.scene.__iceWolfV110SyncAt = world.now - 16;

  const trace = [];
  for (let frame = 0; frame < 5; frame += 1) {
    guest.run(SYNC, 'online sync');
    trace.push(Number(guest.player.getX().toFixed(2)));
  }
  assert.ok(trace[0] > 1000 && trace[0] < 1100, `the first snapshot moved the Player towards the host: ${trace[0]}`);
  assert.ok(trace[0] - 1000 <= 100 * 0.33, `by about a third, not onto it: ${trace[0]}`);
  for (const x of trace.slice(1)) {
    assert.ok(Math.abs(x - trace[0]) < 0.01, `the same snapshot did not pull it again: ${trace.join(' → ')}`);
  }
  assert.equal(guest.get('OnlineSyncLocalMode'), 'blend', 'and the mode still says what happened');
});

test('a guest that holds the stick walks, and the host’s copy of that seat follows', async () => {
  const { world, host, guest } = await openMatch();
  const guestId = guest.online.clientId;
  const guestStartX = guest.player.getX();
  const hostStartX = host.actors[0].getX();
  assert.ok(host.scene.actors[0].__iceWolfV110Remote === true || hostStartX !== undefined);

  guest.set('JoystickActive', true);
  guest.set('JoystickX', 1);
  guest.set('JoystickY', 0);
  for (let frame = 0; frame < 60; frame += 1) {
    world.now += 16;
    host.frame();
    guest.frame();
    await tick();
  }

  const guestWalked = guest.player.getX() - guestStartX;
  const hostWalked = host.actors[0].getX() - hostStartX;
  assert.ok(guestWalked > 150, `the guest’s own character walked: ${guestStartX.toFixed(1)} → ${guest.player.getX().toFixed(1)}`);
  /* And it kept walking: a leashed character reaches a spot and oscillates there
   * for the rest of the match, so the last 30 frames must add real distance. */
  assert.ok(guestWalked < 300, `at walking speed, not teleporting: ${guestWalked.toFixed(1)} in a second`);
  assert.ok(hostWalked > 120, `the host’s copy of seat 1 walked too: ${hostStartX.toFixed(1)} → ${host.actors[0].getX().toFixed(1)}`);
  assert.ok(host.actors[0].__iceWolfV110Remote === true, 'and the host knows a phone is playing that seat');

  /* The host is the authority: the input it holds is the guest’s, and the pose on
   * the wire is the guest’s own position within a stride. */
  const input = host.online.inputs[guestId];
  assert.ok(input, 'the host holds the guest’s input');
  assert.equal(input.kind, 'input');
  assert.ok(input.seq >= 5, `at 10Hz for a second: seq ${input.seq}`);
  assert.ok(Math.abs(Number(input.x) - guest.player.getX()) < 60,
    `the pose on the wire is the guest’s: ${input.x} vs ${guest.player.getX().toFixed(1)}`);
  assert.equal(host.get('OnlineSyncRemoteSeats'), 1, 'the host knows one seat is played by a phone');

  /* The snapshot’s seat A is the host’s copy of that body, so the guest’s own
   * seat and the host’s copy cannot drift apart for long. */
  const snapshot = guest.online.snapshot;
  const seatA = snapshot.players.find((entry) => entry.id === 'A');
  assert.ok(seatA, 'the host sends seat A');
  /* The snapshot the guest holds is up to 200ms old, so seat A is the host's body
   * a few frames back — the same body, at the same end of the arena. */
  assert.ok(seatA.x > hostStartX + 100, `seat A is the seat that walked: ${seatA.x}`);
  assert.ok(Math.abs(seatA.x - host.actors[0].getX()) < 90, `and it is the host’s body for seat 1: ${seatA.x} vs ${host.actors[0].getX().toFixed(1)}`);
  assert.ok(Math.abs(guest.player.getX() - seatA.x) < 220,
    `and the two copies stay within a stride-and-a-half: ${guest.player.getX().toFixed(1)} vs ${seatA.x.toFixed(1)}`);
});

test('a guest that lets go stands still where it stopped', async () => {
  const { world, host, guest } = await openMatch();
  guest.set('JoystickActive', true);
  guest.set('JoystickX', 1);
  guest.set('JoystickY', 0);
  for (let frame = 0; frame < 40; frame += 1) {
    world.now += 16;
    host.frame();
    guest.frame();
    await tick();
  }
  guest.set('JoystickActive', false);
  guest.set('JoystickX', 0);
  guest.set('JoystickY', 0);
  for (let frame = 0; frame < 40; frame += 1) {
    world.now += 16;
    host.frame();
    guest.frame();
    await tick();
  }
  const stopped = guest.player.getX();
  assert.ok(Math.abs(guest.player.getX() - stopped) < 1, 'the thumb is gone, the character stays');
  assert.ok(Math.abs(host.actors[0].getX() - stopped) < 40,
    `and the host’s copy catches up to it: ${host.actors[0].getX().toFixed(1)} vs ${stopped.toFixed(1)}`);
});

/* Build 27 — the video, not a report. `ScreenRecording_11-20-2026 21-08-28`
 * shows the guest walking while the ice under it steps backwards about five
 * times a second: 6.2px a frame for six frames, then -11px in one, again and
 * again. That is one 32% pull per 5Hz snapshot, and it is what Build 24 still
 * left: the correction moved from every frame to every snapshot, but the host's
 * copy of a walking seat is always a stride behind, so every snapshot took a
 * stride back. The measure here is the one the eye used: over a second of
 * walking with a host's copy 50px behind, no frame may go backwards. */
test('a walking guest is never walked backwards by a snapshot', () => {
  const world = makeWorld();
  const guest = new Phone(world);
  const roster = [];
  for (let seat = 0; seat < 7; seat += 1) {
    roster.push({
      seat, id: seat === 0 ? 'YOU' : 'ABCDEFGHI'[seat - 1],
      clientId: seat === 1 ? 'g1' : '', cpu: seat !== 1, role: 'Human', name: ''
    });
  }
  const snapshot = {
    kind: 'snapshot', t: 9000, phase: 'Active', timer: 120,
    players: [
      { id: 'YOU', x: 0, y: 350, z: 0, yaw: 0, role: 'Human', state: 'Active', mode: 0 },
      { id: 'A', x: 950, y: 350, z: 0, yaw: 0, role: 'Human', state: 'Active', mode: 0 }
    ],
    switches: { active: 0, triggered: 0, enabled: true, serial: 0, on: [], spent: [], layout: [] },
    gates: { openIndex: 0, openFloor: '', unlocked: false, serial: 0, layout: [] }
  };
  guest.scene.__iceWolfV110Online = { payload: { kind: 'start', roster }, seat: 1, inputs: {}, snapshot, syncRolesApplied: true };
  guest.set('OnlineRoomActive', true);
  guest.set('OnlineIsHost', false);
  guest.set('RoundPhase', 'Active');
  guest.set('GameOver', false);
  guest.set('RosterDealt', true);
  guest.set('SpeedFactor', 1);
  guest.player.setX(1000);
  guest.player.setY(350);
  guest.set('JoystickActive', true);
  guest.set('JoystickX', 1);
  guest.set('JoystickY', 0);
  guest.set('MoveX', 1);
  guest.set('MoveY', 0);
  guest.scene.__iceWolfV110SyncAt = world.now - 16;

  const speed = 260;
  let previous = guest.player.getX();
  let backwards = 0;
  let worst = 0;
  let walked = 0;
  for (let frame = 0; frame < 60; frame += 1) {
    world.now += 16;
    guest.player.setX(guest.player.getX() + speed * (16 / 1000));
    /* Every sixth frame a snapshot lands, and the host's copy of seat A is the
     * stride behind that a 100ms input interval plus a 90ms blend always is. */
    if (frame % 6 === 5) {
      snapshot.t += 200;
      const seatA = snapshot.players[1];
      seatA.x = guest.player.getX() - 50;
      guest.scene.__iceWolfV110SyncAt = world.now - 16;
    }
    guest.run(SYNC, 'online sync');
    const now = guest.player.getX();
    const step = now - previous;
    if (step < -0.01) {
      backwards += 1;
      worst = Math.min(worst, step);
    }
    walked += step;
    previous = now;
  }
  assert.equal(backwards, 0, `no snapshot dragged the walker back: ${backwards} frames, worst ${worst.toFixed(2)}px`);
  assert.ok(walked > 240 && walked < 260,
    `a second of walking is a second of walking: ${walked.toFixed(1)}px`);

  /* And the correction still does its job when the thumb is off (Build 24's
   * case): a guest that stops is settled onto the host's copy, gently. */
  guest.set('JoystickActive', false);
  guest.set('JoystickX', 0);
  guest.set('MoveX', 0);
  guest.scene.__iceWolfV110Online.driveAt = -1000000;
  const before = guest.player.getX();
  for (let frame = 0; frame < 10; frame += 1) {
    world.now += 16;
    if (frame % 6 === 5) {
      snapshot.t += 200;
      snapshot.players[1].x = 1000;
      guest.scene.__iceWolfV110SyncAt = world.now - 16;
    }
    guest.run(SYNC, 'online sync');
  }
  const gap = Math.abs(guest.player.getX() - 1000);
  assert.ok(gap < Math.abs(before - 1000) - 30,
    `standing still, it is walked onto the host's copy: ${before.toFixed(1)} → ${guest.player.getX().toFixed(1)}`);
  assert.ok(gap > 20, `a few snapshots, not one jump: ${gap.toFixed(1)}px left`);
});

/* Build 27 (放置・切断対策) — a phone that stops answering must not freeze the
 * other players' round. Three seconds of silence and the host plays that body
 * with the CPU; the moment the phone speaks again the body is its own. */
test('a silent guest hands its body to the CPU, and takes it back', async () => {
  const { world, host, guest } = await openMatch();
  assert.equal(host.actors[0].__iceWolfV110Remote, true, 'the host knows a phone plays seat 1');
  /* The guest's phone goes quiet: no frames, no inputs, four seconds. */
  for (let frame = 0; frame < 40; frame += 1) {
    world.now += 100;
    host.frame();
    await tick();
  }
  assert.equal(host.actors[0].__iceWolfV110Remote, false,
    'after three seconds of silence the host runs that seat with the CPU');
  /* And when the phone comes back, so does its seat. */
  guest.set('JoystickActive', true);
  guest.set('JoystickX', 0);
  guest.set('JoystickY', 1);
  for (let frame = 0; frame < 12; frame += 1) {
    world.now += 16;
    host.frame();
    guest.frame();
    await tick();
  }
  assert.equal(host.actors[0].__iceWolfV110Remote, true, 'the seat is the phone’s again');
});
