// The v1.1.0 Phase 2b work (3D remote sync), checked against the shipping block.
//
// Phase 2a made the room, the wire and the host's snapshot; Phase 2b is what
// happens when the snapshot meets the arena. The test takes the
// `v1.1.0 オンライン対戦同期` block out of game.json, runs its arithmetic in a
// bare context, then runs whole frames against a fake scene:
//
//   * the seat table: ten seats, ten characters, on a host's phone and on every
//     guest's phone (the guest's own seat is the Player, seat 0 borrows the
//     actor the guest would have been);
//   * the blend: 5Hz snapshots read as walking, a stair ride is placed not slid,
//     NaN and a stalled phone never throw and never leave the arena;
//   * the guest's own seat: moved by its input, nudged 32% towards the host per
//     snapshot, snapped only when the two disagree by more than a stride;
//   * the input: the pose rides with it, a jump of kilometres is refused and a
//     reconnect after 1.5s is forgiven;
//   * the host's hold timers for a remote switch (1.6s) and rescue (1.2s), and
//     the guest's action word (wolf / switch / rescue / none);
//   * the switch and gate layout adopted from the host, the on/spent bits, the
//     timer, the alive/frozen counts and the ending;
//   * the CPU stand-down: a guest runs no AI, the host only skips the seats a
//     phone is playing;
//   * offline: the block leaves the arena exactly as 1.0.0 left it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import { groupCode, readGame, sceneOf } from './helpers.mjs';

const allCode = (name) => {
  const group = sceneOf(readGame()).events.find((event) => event.name === name);
  const blocks = [];
  const walk = (event) => {
    const block = event.inlineCode;
    if (typeof block === 'string') blocks.push(block);
    else if (Array.isArray(block)) blocks.push(block.join('\n'));
    for (const child of event.events || []) walk(child);
  };
  walk(group);
  return blocks.join('\n');
};

const SYNC_GROUP = 'v1.1.0 オンライン対戦同期';
const ONLINE_GROUP = 'v1.1.0 オンライン中核';
const AI_GROUP = 'v0.6.1 Human CPU Navigation Recovery + CPU Wolf Cycle';
const FLOW_GROUP = 'Wolf match flow';
const SWITCH_GROUP = 'v0.7.0 2階・階段・5スイッチ・3ゲート';
const ACTION_GROUP = 'Wolf actions';
const BODY_GROUP = 'v0.7.3 ブロックトイ3Dキャラ';
const LABEL_GROUP = 'v0.6.2 Color-independent Actor ID Labels';
const SURVIVOR_GROUP = 'v0.6.5 Survivor/Frozen counter + Wolf role pick';

const plain = (value) => JSON.parse(JSON.stringify(value));

const between = (code, start, end) => {
  const from = code.indexOf(start);
  const to = code.indexOf(end);
  if (from < 0 || to < 0) throw new Error(`markers missing: ${start}`);
  return code.slice(from, to);
};

const loadSync = () => {
  const source = between(groupCode(SYNC_GROUP), '/* ==== v1.1.0 online sync', '/* ==== end v1.1.0 online sync ==== */');
  const names = [
    'ICE_WOLF_SYNC_SEAT_LETTERS', 'ICE_WOLF_SYNC_STATES', 'ICE_WOLF_SYNC_ACTIONS',
    'ICE_WOLF_SYNC_SNAP_DISTANCE', 'ICE_WOLF_SYNC_BLEND_MS', 'ICE_WOLF_SYNC_LOCAL_BLEND',
    'ICE_WOLF_SYNC_LOCAL_SNAP_DISTANCE', 'ICE_WOLF_SYNC_MAX_STEP', 'ICE_WOLF_SYNC_INPUT_KEEP_MS',
    'ICE_WOLF_SYNC_INPUT_RESYNC_MS', 'ICE_WOLF_SYNC_SWITCH_HOLD', 'ICE_WOLF_SYNC_RESCUE_HOLD',
    'ICE_WOLF_SYNC_FREEZE_DISTANCE', 'ICE_WOLF_SYNC_SWITCH_RANGE', 'ICE_WOLF_SYNC_RESCUE_RANGE',
    'ICE_WOLF_SYNC_BOUNDS', 'ICE_WOLF_SYNC_DEFAULT_SPAWNS',
    'iceWolfSyncSeatId', 'iceWolfSyncSeatOfId', 'iceWolfSyncSeatOwners', 'iceWolfSyncState',
    'iceWolfSyncRole', 'iceWolfSyncAction', 'iceWolfSyncClamp', 'iceWolfSyncFloorOf',
    'iceWolfSyncTarget', 'iceWolfSyncBlend', 'iceWolfSyncLocal', 'iceWolfSyncInput',
    'iceWolfSyncAcceptPose', 'iceWolfSyncActionOf', 'iceWolfSyncHold', 'iceWolfSyncSwitchList',
    'iceWolfSyncGateList', 'iceWolfSyncLayoutSignature', 'iceWolfSyncCounts', 'iceWolfSyncWinId',
    'iceWolfSyncWinText', 'iceWolfSyncHud', 'iceWolfSyncNearest', 'iceWolfSyncCpuSuppressed',
    'iceWolfSyncRoles', 'iceWolfSyncSpawn'
  ];
  const context = vm.createContext({ console });
  vm.runInContext(`${source}\n;globalThis.__sync = { ${names.join(', ')} };`, context, { filename: 'game.json#v1.1.0 online sync' });
  return context.__sync;
};

const sync = loadSync();

// ------------------------------------------------------------------ the seats
test('ten seats are ten characters on every phone, and never eleven', () => {
  const ids = ['YOU', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
  ids.forEach((id, seat) => {
    assert.equal(sync.iceWolfSyncSeatId(seat), id, `seat ${seat} is ${id}`);
    assert.equal(sync.iceWolfSyncSeatOfId(id), seat, `${id} is seat ${seat}`);
  });
  assert.equal(sync.iceWolfSyncSeatOfId('b'), 2, 'a lower case letter is the same seat');
  assert.equal(sync.iceWolfSyncSeatOfId('YOU'), 0);
  assert.equal(sync.iceWolfSyncSeatOfId(''), -1, 'no id is no seat');
  assert.equal(sync.iceWolfSyncSeatOfId('Z'), -1);
  assert.equal(sync.iceWolfSyncSeatId(10), '');
  assert.equal(sync.iceWolfSyncSeatId(-1), '');

  /* The host: its Player is seat 0, Actor n-1 is seat n. */
  const host = sync.iceWolfSyncSeatOwners(0, 10);
  assert.equal(host.length, 10);
  assert.deepEqual(plain(host[0]), { seat: 0, kind: 'player', index: -1 });
  assert.deepEqual(plain(host[1]), { seat: 1, kind: 'actor', index: 0 });
  assert.deepEqual(plain(host[9]), { seat: 9, kind: 'actor', index: 8 });

  /* A guest: its own seat is its Player; seat 0 borrows the actor that would
   * have been the guest's own body; every other seat keeps its actor. */
  for (let seats = 2; seats <= 10; seats += 1) {
    for (let own = 1; own < seats; own += 1) {
      const owners = sync.iceWolfSyncSeatOwners(own, seats);
      const players = owners.filter((owner) => owner.kind === 'player');
      assert.equal(players.length, 1, `${seats} seats, own ${own}: one Player`);
      assert.equal(players[0].seat, own, `${seats} seats, own ${own}: the Player is the own seat`);
      const actorIndexes = owners.filter((owner) => owner.kind === 'actor').map((owner) => owner.index);
      assert.equal(actorIndexes.length, seats - 1, `${seats} seats, own ${own}: every other seat has a body`);
      assert.equal(new Set(actorIndexes).size, actorIndexes.length, `${seats} seats, own ${own}: no actor is worn twice`);
      assert.deepEqual(plain(actorIndexes.slice().sort((a, b) => a - b)),
        Array.from({ length: seats - 1 }, (_value, index) => index), `${seats} seats, own ${own}: actors 0..${seats - 2}`);
    }
  }
  /* A guest whose seat never made it into the roster has no extra body. */
  const unknown = sync.iceWolfSyncSeatOwners(-1, 5);
  assert.equal(unknown.filter((owner) => owner.kind === 'player').length, 1, 'the Player is still seat 0');
});

// --------------------------------------------------------------- the values
test('a snapshot entry is cleaned, and a wild one is pinned into the arena', () => {
  const good = sync.iceWolfSyncTarget({ id: 'B', x: 100.126, y: -20.004, z: 5, yaw: -90, role: 'Wolf', state: 'Frozen', mode: true });
  assert.equal(good.seat, 2);
  assert.equal(good.x, 100.13);
  assert.equal(good.y, -20);
  assert.equal(good.z, 5);
  assert.equal(good.floor, '1F');
  assert.equal(good.yaw, 270, 'a negative yaw is the same facing');
  assert.equal(good.role, 'Wolf');
  assert.equal(good.state, 'Frozen');
  assert.equal(good.mode, 1);

  const wild = sync.iceWolfSyncTarget({ id: 'C', x: 999999, y: -999999, z: 9999, yaw: 725, role: 'dragon', state: 'Sleeping' });
  assert.equal(wild.x, sync.ICE_WOLF_SYNC_BOUNDS.maxX);
  assert.equal(wild.y, sync.ICE_WOLF_SYNC_BOUNDS.minY);
  assert.equal(wild.z, sync.ICE_WOLF_SYNC_BOUNDS.zMax);
  assert.equal(wild.yaw, 5, '725 degrees is 5 degrees');
  assert.equal(wild.role, 'Human', 'an unknown role is a Human');
  assert.equal(wild.state, 'Active', 'an unknown state is Active');

  const nan = sync.iceWolfSyncTarget({ id: 'D', x: Number.NaN, y: Number.NaN });
  assert.equal(nan.x, 0);
  assert.equal(nan.y, 0);
  assert.equal(nan.yawRad, 0, 'no yaw is 0 radians, never NaN');

  assert.equal(sync.iceWolfSyncState('FrozenWolfCandidate'), 'FrozenWolfCandidate');
  assert.equal(sync.iceWolfSyncState('Escaped'), 'Escaped');
  assert.equal(sync.iceWolfSyncState('Out'), 'Out');
  assert.equal(sync.iceWolfSyncState(''), 'Active');
  assert.equal(sync.iceWolfSyncRole('Wolf'), 'Wolf');
  assert.equal(sync.iceWolfSyncRole('Human'), 'Human');
  assert.equal(sync.iceWolfSyncRole(undefined), 'Human');
  assert.equal(sync.iceWolfSyncFloorOf(1600), '2F');
  assert.equal(sync.iceWolfSyncFloorOf(700), '1F');
  assert.equal(sync.iceWolfSyncSpawn(1).x, -488.5, 'seat 1 starts where actor A starts');
  assert.equal(sync.iceWolfSyncSpawn(9).y, 441.5);
  assert.equal(sync.iceWolfSyncSpawn(0), null, 'the host keeps the Player spawn');
  assert.equal(sync.iceWolfSyncSpawn(99), null);
});

// ---------------------------------------------------------------- the blend
test('a 5Hz step reads as walking, and a stair ride is placed not slid', () => {
  /* 260px/s for 200ms is a 52px step. Ten 16ms frames must cover it smoothly. */
  let x = 0;
  const target = 52;
  let biggest = 0;
  for (let frame = 0; frame < 10; frame += 1) {
    const next = sync.iceWolfSyncBlend(x, 0, target, 0, 16, {});
    biggest = Math.max(biggest, next.x - x);
    x = next.x;
  }
  assert.ok(x > target * 0.75, `the first 160ms covers most of the step: ${x}`);
  assert.ok(x <= target + 0.01, 'and never overshoots');
  assert.ok(biggest < target, `no single frame jumps the whole step: ${biggest}`);

  const snap = sync.iceWolfSyncBlend(0, 0, 1600, 0, 16, {});
  assert.equal(snap.mode, 'snap', 'a stair ride is a jump by design');
  assert.equal(snap.x, 1600);
  assert.equal(snap.distance, 1600);

  /* A long stall must not teleport either: the alpha is capped by the clamp. */
  const stall = sync.iceWolfSyncBlend(0, 0, 200, 0, 5000, {});
  assert.equal(stall.mode, 'blend', 'a stalled phone still blends, it does not skip ahead');
  assert.ok(stall.x < 200 && stall.x > 100, `and covers the step in one frame, not past it: ${stall.x}`);
  const small = sync.iceWolfSyncBlend(0, 0, 60, 0, 5000, {});
  assert.equal(small.mode, 'blend');
  assert.ok(small.alpha <= 1, 'the alpha is a fraction');

  /* Broken values never throw and never leave the arena. */
  assert.equal(sync.iceWolfSyncBlend(Number.NaN, 0, 10, 10, 16, {}).mode, 'place');
  assert.equal(sync.iceWolfSyncBlend(0, 0, Number.NaN, Number.NaN, 16, {}).mode, 'hold');
  assert.equal(sync.iceWolfSyncBlend(0, 0, 10, 0, Number.NaN, {}).mode, 'hold', 'no frame time, no movement');
  const held = sync.iceWolfSyncBlend(30, -30, Number.NaN, Number.NaN, 16, {});
  assert.equal(held.x, 30);
  assert.equal(held.y, -30);
});

test('the guest’s own seat is corrected, not leashed', () => {
  const hold = sync.iceWolfSyncLocal(0, 0, 0.2, 0.1, {});
  assert.equal(hold.mode, 'hold', 'a hair of drift is left to the player');

  const blend = sync.iceWolfSyncLocal(0, 0, 100, 0, {});
  assert.equal(blend.mode, 'blend');
  assert.equal(blend.x, 32, '32% of the way per snapshot');
  const second = sync.iceWolfSyncLocal(blend.x, 0, 100, 0, {});
  assert.ok(second.x > blend.x && second.x < 100, 'and again on the next snapshot');

  const snap = sync.iceWolfSyncLocal(0, 0, 400, 0, {});
  assert.equal(snap.mode, 'snap', 'a real disagreement is the host’s call');
  assert.equal(snap.x, 400);

  assert.equal(sync.iceWolfSyncLocal(Number.NaN, 0, 5, 5, {}).mode, 'snap');
  assert.equal(sync.iceWolfSyncLocal(0, 0, Number.NaN, 5, {}).mode, 'hold');
});

// ---------------------------------------------------------------- the input
test('an input carries the pose, and a phone that claims a jump is refused', () => {
  const input = sync.iceWolfSyncInput(4, 2, -3, 'wolf', { x: -400, y: 120, yaw: -45 });
  assert.equal(input.kind, 'input');
  assert.equal(input.seq, 4);
  assert.equal(input.moveX, 1);
  assert.equal(input.moveY, -1);
  assert.equal(input.action, 'wolf');
  assert.equal(input.x, -400);
  assert.equal(input.y, 120);
  assert.equal(input.yaw, 315, 'the facing goes out as 0..360');

  const bare = sync.iceWolfSyncInput(1, 0, 0, 'dance');
  assert.equal(bare.action, 'none', 'an unknown action is none');
  assert.equal('x' in bare, false, 'no pose, no x');

  const wild = sync.iceWolfSyncInput(2, 0, 0, 'none', { x: 99999, y: -99999 });
  assert.equal(wild.x, sync.ICE_WOLF_SYNC_BOUNDS.maxX, 'the pose is clamped on the way out');

  const first = sync.iceWolfSyncAcceptPose(null, input, 1000);
  assert.equal(first.ok, true);
  assert.equal(first.reason, 'first');

  const after = { x: -400, y: 120, at: 1000 };
  const near = sync.iceWolfSyncAcceptPose(after, { x: -350, y: 130 }, 1100);
  assert.equal(near.ok, true, 'a step is a step');
  const far = sync.iceWolfSyncAcceptPose(after, { x: 1800, y: 600 }, 1100);
  assert.equal(far.ok, false, 'a jump of kilometres is not accepted');
  assert.equal(far.reason, 'far');
  assert.equal(far.x, -400, 'the host keeps the last real position');

  /* A reconnect (or a phone back from the menu) may arrive anywhere. */
  const back = sync.iceWolfSyncAcceptPose(after, { x: 1800, y: 600 }, 3000);
  assert.equal(back.ok, true);
  assert.equal(back.reason, 'resync');
  assert.equal(back.x, 1800);
  /* No pose at all is fine: the host falls back to the stick. */
  assert.equal(sync.iceWolfSyncAcceptPose(after, { moveX: 1 }, 1100).reason, 'no-pose');
});

test('the action word is one of four, and a hold fires once', () => {
  assert.equal(sync.iceWolfSyncActionOf({ role: 'Wolf', wolfMode: 3, switchPressed: true }), 'wolf', 'the wolf button is a mode');
  assert.equal(sync.iceWolfSyncActionOf({ role: 'Human', switchPressed: true, rescueHeld: true }), 'switch');
  assert.equal(sync.iceWolfSyncActionOf({ role: 'Human', rescueHeld: true }), 'rescue');
  assert.equal(sync.iceWolfSyncActionOf({ role: 'Human' }), 'none');

  let seconds = 0;
  let fired = 0;
  for (let frame = 0; frame < 100; frame += 1) {
    const hold = sync.iceWolfSyncHold(seconds, true, 16, sync.ICE_WOLF_SYNC_SWITCH_HOLD);
    seconds = hold.seconds;
    if (hold.fired) fired += 1;
  }
  assert.equal(fired, 1, `1.6s of 16ms frames is one activation: ${fired}`);
  let longer = 0;
  seconds = 0;
  for (let frame = 0; frame < 1000; frame += 1) {
    const hold = sync.iceWolfSyncHold(seconds, true, 16, sync.ICE_WOLF_SYNC_SWITCH_HOLD);
    seconds = hold.seconds;
    if (hold.fired) longer += 1;
  }
  assert.equal(longer, 10, `holding for sixteen seconds keeps asking: ${longer}`);
  const one = sync.iceWolfSyncHold(1.59, true, 16, 1.6);
  assert.equal(one.fired, true);
  assert.equal(sync.iceWolfSyncHold(1.55, false, 16, 1.6).seconds, 0, 'a lifted finger resets the hold');
  assert.equal(sync.iceWolfSyncHold(0, true, 16, 1.2).seconds, 0.016, 'the rescue is a 1.2s hold');
});

// ---------------------------------------------------------------- the world
test('the switch layout is the host’s, and only the pads move the pads', () => {
  const host = {
    layout: [
      { x: -660, y: 480, kind: 'correct', floor: '1F' },
      { x: 1560, y: 400, kind: 'dummy', floor: '2F' },
      { x: 600, y: 300, kind: 'trap', floor: '1F' }
    ],
    on: [1, 0, 0],
    spent: [0, 1, 0],
    active: 1,
    triggered: 2
  };
  const list = sync.iceWolfSyncSwitchList(null, host);
  assert.equal(list.length, 3);
  assert.deepEqual(plain(list[0]), { x: -660, y: 480, floor: '1F', kind: 'correct', on: true, spent: false });
  assert.equal(list[1].kind, 'dummy');
  assert.equal(list[1].spent, true);
  assert.equal(list[2].kind, 'trap');

  /* A following snapshot without a layout keeps the list and takes the bits. */
  const again = sync.iceWolfSyncSwitchList(list, { on: [1, 1, 0], spent: [0, 0, 0], active: 2 });
  assert.equal(again.length, 3, 'the layout is not lost when only the bits travel');
  assert.equal(again[1].on, true);
  assert.equal(again[1].spent, false);

  /* An empty layout is "unchanged", not "no switches at all". */
  const unchanged = sync.iceWolfSyncSwitchList(list, { layout: [], on: [1, 0, 0] });
  assert.equal(unchanged.length, 3, 'an empty layout keeps the pads');
  assert.equal(unchanged[1].spent, false, 'and still takes the bits');

  /* A layout that moved is adopted whole. */
  const moved = sync.iceWolfSyncSwitchList(list, { layout: [{ x: 0, y: 600, kind: 'correct' }], on: [0] });
  assert.equal(moved.length, 1);
  assert.equal(moved[0].x, 0);

  const sigOne = sync.iceWolfSyncLayoutSignature(list, null);
  const flip = list.map((spot, index) => Object.assign({}, spot, { on: index === 0 }));
  assert.equal(sync.iceWolfSyncLayoutSignature(flip, null), sigOne, 'an on bit is not a layout move');
  const shift = list.map((spot, index) => Object.assign({}, spot, { x: index === 0 ? spot.x + 16 : spot.x }));
  assert.notEqual(sync.iceWolfSyncLayoutSignature(shift, null), sigOne, 'a pad that moved is a layout move');

  const gates = sync.iceWolfSyncGateList(null, {
    openIndex: 1,
    layout: [{ x: -650, y: -650 }, { x: 2180, y: 300 }, { x: 980, y: -620 }]
  });
  assert.equal(gates.length, 3);
  assert.equal(gates[1].open, true);
  assert.equal(gates[0].open, false);
  assert.equal(gates[1].floor, '2F');
  const closed = sync.iceWolfSyncGateList(gates, { openIndex: -1 });
  assert.equal(closed.length, 3, 'closing a gate keeps the gates');
  assert.equal(closed.filter((gate) => gate.open).length, 0);
});

test('the counts and the ending are read from the states, not from a number', () => {
  const players = [
    { id: 'YOU', x: 0, y: 0, role: 'Human', state: 'Active' },
    { id: 'A', x: 0, y: 0, role: 'Human', state: 'Frozen' },
    { id: 'B', x: 0, y: 0, role: 'Wolf', state: 'Active', mode: 1 },
    { id: 'C', x: 0, y: 0, role: 'Human', state: 'Escaped' },
    { id: 'D', x: 0, y: 0, role: 'Human', state: 'Out' },
    { id: 'E', x: 0, y: 0, role: 'Human', state: 'FrozenWolfCandidate' },
    { id: 'F', x: 0, y: 0, role: 'Human', state: 'Active' }
  ];
  const counts = sync.iceWolfSyncCounts(players);
  assert.equal(counts.alive, 2, 'YOU and F are the ones still on their feet');
  assert.equal(counts.frozen, 2, 'a frozen candidate counts as frozen');
  assert.equal(counts.escaped, 1);
  assert.equal(counts.out, 1);
  assert.equal(counts.wolves, 1);

  const hud = sync.iceWolfSyncHud({
    t: 1000, timer: 142.4, players,
    switches: { active: 2, triggered: 3 },
    gates: { openIndex: 1, openFloor: '2F', unlocked: true },
    win: '人狼の勝利'
  });
  assert.equal(hud.timer, 142.4);
  assert.equal(hud.timerText, '2:22');
  assert.equal(hud.alive, 2);
  assert.equal(hud.gateOpen, true);
  assert.equal(hud.gateFloor, '2F');
  assert.equal(hud.switchActive, 2);
  assert.equal(hud.winId, 'wolf');

  assert.equal(sync.iceWolfSyncWinId('人間の勝利'), 'human');
  assert.equal(sync.iceWolfSyncWinId('wolf'), 'wolf');
  assert.equal(sync.iceWolfSyncWinId('human'), 'human');
  assert.equal(sync.iceWolfSyncWinId(''), '');
  assert.equal(sync.iceWolfSyncWinText('wolf'), '人狼の勝利');
  assert.equal(sync.iceWolfSyncWinText(''), '');
});

test('the nearest helper stays inside its radius', () => {
  const list = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 300, y: 0 }];
  assert.equal(sync.iceWolfSyncNearest(list, 10, 0, 100), 0);
  assert.equal(sync.iceWolfSyncNearest(list, 45, 0, 100), 1);
  assert.equal(sync.iceWolfSyncNearest(list, 70, 0, 20), -1, 'nothing in reach');
  assert.equal(sync.iceWolfSyncNearest(list, 299, 0, 10), 2);
  assert.equal(sync.iceWolfSyncNearest([], 0, 0, 100), -1);
});

test('a guest stands its CPU blocks down, a host only its remote seats', () => {
  assert.equal(sync.iceWolfSyncCpuSuppressed({ roomActive: false, isHost: false }), false, 'offline: the AI runs');
  assert.equal(sync.iceWolfSyncCpuSuppressed({ roomActive: true, isHost: false }), true, 'a guest runs no AI');
  assert.equal(sync.iceWolfSyncCpuSuppressed({ roomActive: true, isHost: true, remoteSeat: false }), false, 'a host keeps its CPUs');
  assert.equal(sync.iceWolfSyncCpuSuppressed({ roomActive: true, isHost: true, remoteSeat: true }), true, 'and skips the played seats');

  const roles = sync.iceWolfSyncRoles([
    { seat: 0, role: 'Wolf' }, { seat: 1, role: 'Human' }, { seat: 2, role: 'Wolf' }
  ]);
  assert.equal(roles[0], 'Wolf');
  assert.equal(roles[1], 'Human');
  assert.equal(roles[2], 'Wolf');
});

// ------------------------------------------------------------ one real frame
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
  const arena = {
    switches: [
      { x: -660, y: 480, kind: 'correct', on: false, spent: false },
      { x: 0, y: 600, kind: 'dummy', on: false, spent: false },
      { x: 920, y: 600, kind: 'correct', on: false, spent: false }
    ],
    gates: [{ x: -650, y: -650, open: false }, { x: 590, y: 590, open: false }, { x: -48, y: -48, open: false }],
    gateOpenIndex: -1,
    layoutReady: true
  };
  const winTexts = [makeObject(0, 0, {})];
  winTexts[0].setString = (value) => { winTexts[0].values.set('text', String(value)); };
  winTexts[0].hide = () => {};
  const scene = {
    values,
    player,
    actors,
    arena,
    getVariables: () => ({ get: (name) => { if (!values.has(name)) values.set(name, 0); return bag(name); } }),
    getObjects: (name) => {
      if (name === 'Player') return [player];
      if (name === 'Actor') return actors;
      if (name === 'WinText') return winTexts;
      if (name === 'SwitchPad') return arena.switches.map(() => makeObject(0, 0, {}));
      if (name === 'GatePad') return arena.gates.map(() => makeObject(0, 0, {}));
      if (name === 'ActionFeedbackText') return [];
      return [];
    },
    getGame: () => ({ getAssetPath: () => '' }),
    __iceWolfV070: arena,
    __iceWolfV110Online: options.online || null,
    __iceWolfI18n: { t: (key) => key }
  };
  return scene;
};

const runFrame = (scene) => {
  const code = groupCode(SYNC_GROUP);
  const context = vm.createContext({ runtimeScene: scene, console, Date, Math, JSON, Number, String, Array, Object, Map, Set, isFinite });
  vm.runInContext(code, context, { filename: `game.json#${SYNC_GROUP}` });
};

test('offline the sync block touches nothing at all', () => {
  const scene = makeScene({ variables: { OnlineRoomActive: false, OnlineIsHost: false } });
  const playerX = scene.player.x;
  runFrame(scene);
  assert.equal(scene.values.get('OnlineGuestMode'), false);
  assert.equal(scene.player.x, playerX, 'the Player stayed where the game put it');
  assert.equal(scene.actors[0].x, -488.5, 'and so did the Actors');
  assert.equal(scene.actors[0].values.get('Role'), 'Human', 'no role was written');
  assert.equal(scene.values.get('OnlineSyncRemoteSeats'), 0);
});

test('a host frame drives the remote seats and leaves the CPUs to the AI', () => {
  const roster = [{ seat: 0, id: 'YOU', clientId: 'h1', cpu: false, role: 'Human', name: 'Hana' }];
  for (let seat = 1; seat < 7; seat += 1) {
    roster.push({
      seat, id: 'ABCDEFGHI'[seat - 1],
      clientId: seat === 1 ? 'c1' : '', cpu: seat !== 1,
      role: 'Human', name: seat === 1 ? 'Ken' : ''
    });
  }
  const online = {
    payload: { kind: 'start', roster },
    seat: 0,
    inputs: { c1: { kind: 'input', seq: 7, moveX: 1, moveY: 0, action: 'none', x: 120, y: 100, at: Date.now() } },
    remotePoses: {},
    snapshot: null
  };
  const scene = makeScene({
    variables: { OnlineRoomActive: true, OnlineIsHost: true, RoundPhase: 'Active', RosterDealt: true },
    online
  });
  scene.actors[0].x = -488.5;
  scene.actors[0].y = -8.5;
  runFrame(scene);

  assert.equal(scene.values.get('OnlineGuestMode'), false, 'the host is not a guest');
  assert.equal(scene.actors[0].__iceWolfV110Remote, true, 'seat 1 is played by a phone');
  assert.equal(scene.actors[1].__iceWolfV110Remote, false, 'seat 2 is a CPU');
  assert.equal(scene.values.get('OnlineSyncRemoteSeats'), 1);
  assert.ok(scene.actors[0].x > -488.5 && scene.actors[0].x < 120, `the remote toy walked towards the phone: ${scene.actors[0].x}`);
  assert.ok(Math.abs(scene.actors[0].y - -8.5) < 20, 'and sideways towards it');
  assert.equal(scene.actors[0].values.get('LabelText'), 'Ken', 'the phone player’s name is over its head');
  assert.equal(scene.actors[1].values.get('LabelText'), 'B', 'a CPU keeps its letter');

  /* A second frame keeps closing the gap; it never teleports. */
  const before = scene.actors[0].x;
  runFrame(scene);
  assert.ok(scene.actors[0].x > before, 'the blend continues');
  assert.ok(scene.actors[0].x <= 120, 'without overshooting the pose');

  /* A remote switch button: the host owns the 1.6s hold and the activation. */
  online.inputs.c1 = { kind: 'input', seq: 8, moveX: 0, moveY: 0, action: 'switch', x: -660, y: 480, at: Date.now() };
  scene.actors[0].x = -660;
  scene.actors[0].y = 480;
  let fired = 0;
  const originalActivate = scene.__iceWolfV070Activate;
  scene.__iceWolfV070Activate = () => { fired += 1; return true; };
  const start = Date.now();
  for (let frame = 0; frame < 130; frame += 1) {
    const tick = start + frame * 16;
    scene.__iceWolfV110SyncAt = tick;
    scene.__iceWolfV110SyncNow = tick + 16;
    online.inputs.c1.at = tick;
    runFrame(scene);
  }
  assert.equal(fired, 1, `1.6s of holding is one activation, got ${fired}`);
  scene.__iceWolfV070Activate = originalActivate;
});

test('a round played across two phones, host frame to guest frame', () => {
  /* The whole point, driven end to end: the host walks seat 1 to a spot, the
   * snapshot is built and cleaned the way the wire does it, and the guest's
   * actor for seat 1 arrives at that spot. */
  const roster = [];
  for (let seat = 0; seat < 7; seat += 1) {
    roster.push({
      seat, id: seat === 0 ? 'YOU' : 'ABCDEFGHI'[seat - 1],
      clientId: seat === 0 ? 'h1' : (seat === 1 ? 'c1' : (seat === 2 ? 'c2' : '')),
      cpu: seat > 2, role: 'Human', name: ''
    });
  }
  const clock = { now: Date.now() };
  const hostOnline = {
    payload: { kind: 'start', roster },
    seat: 0,
    inputs: { c1: { kind: 'input', seq: 1, moveX: 1, moveY: 0, action: 'none', x: 120, y: 100, at: clock.now } },
    remotePoses: {},
    snapshot: null
  };
  const host = makeScene({
    variables: { OnlineRoomActive: true, OnlineIsHost: true, RoundPhase: 'Active', RosterDealt: true },
    online: hostOnline
  });
  for (let frame = 0; frame < 40; frame += 1) {
    clock.now += 16;
    host.__iceWolfV110SyncAt = clock.now - 16;
    host.__iceWolfV110SyncNow = clock.now;
    hostOnline.inputs.c1.at = clock.now;
    runFrame(host);
  }
  const hostSeatOne = host.actors[0];
  assert.ok(Math.abs(hostSeatOne.x - 120) < 2 && Math.abs(hostSeatOne.y - 100) < 2,
    `the host walked the remote seat to the phone’s pose: ${hostSeatOne.x},${hostSeatOne.y}`);

  /* The snapshot the host's wire builds, cleaned by the receiving side. */
  const snapshot = {
    kind: 'snapshot',
    t: clock.now,
    phase: 'Active',
    timer: 140,
    players: roster.map((row) => {
      const index = row.seat - 1;
      const object = row.seat === 0 ? host.player : host.actors[index];
      return {
        id: row.id,
        x: object.x,
        y: object.y,
        z: 0,
        yaw: 0,
        role: 'Human',
        state: object.values.get('State') || 'Active',
        mode: 0
      };
    }),
    switches: { active: 0, triggered: 0, enabled: true, serial: 1, on: [], spent: [], layout: [] },
    gates: { openIndex: -1, openFloor: '', unlocked: false, serial: 1, layout: [] },
    win: '', winId: ''
  };

  const guestOnline = { payload: { kind: 'start', roster }, seat: 2, inputs: {}, snapshot };
  const guest = makeScene({
    variables: { OnlineRoomActive: true, OnlineIsHost: false, RoundPhase: 'Active', RosterDealt: true, GameOver: false },
    online: guestOnline
  });
  for (let frame = 0; frame < 12; frame += 1) {
    clock.now += 16;
    guest.__iceWolfV110SyncAt = clock.now - 16;
    guest.__iceWolfV110SyncNow = clock.now;
    runFrame(guest);
  }
  const guestSeatOne = guest.actors[0];
  assert.equal(guestSeatOne.values.get('LabelText'), 'A', 'a nameless phone keeps the roster letter');
  assert.ok(Math.abs(guestSeatOne.x - hostSeatOne.x) < 6,
    `the guest’s seat 1 is where the host’s is: ${guestSeatOne.x} vs ${hostSeatOne.x}`);
  assert.ok(Math.abs(guestSeatOne.y - hostSeatOne.y) < 6);
  /* And the guest's own seat stayed its own. */
  assert.equal(guest.player.values.get('DisplayId'), 'YOU', 'the guest’s Player is still YOU');
  assert.equal(guest.values.get('OnlineGuestMode'), true);
});

test('a seat that goes quiet leaves the arena, and comes back when it returns', () => {
  const roster = [
    { seat: 0, id: 'YOU', clientId: 'h1', cpu: false, role: 'Human', name: '' },
    { seat: 1, id: 'A', clientId: 'c1', cpu: false, role: 'Human', name: 'Ken' },
    { seat: 2, id: 'B', clientId: '', cpu: true, role: 'Human', name: '' }
  ];
  const online = {
    payload: { kind: 'start', roster },
    seat: 0,
    room: { seats: [{ seat: 0, clientId: 'h1', out: false }, { seat: 1, clientId: 'c1', out: true }] },
    inputs: { c1: { kind: 'input', seq: 1, moveX: 1, moveY: 0, action: 'none', x: 40, y: 40, at: Date.now() } },
    remotePoses: {},
    snapshot: null
  };
  const scene = makeScene({
    variables: { OnlineRoomActive: true, OnlineIsHost: true, RoundPhase: 'Active', RosterDealt: true },
    online
  });
  runFrame(scene);
  assert.equal(scene.actors[0].values.get('State'), 'Out', 'a quiet seat is off the ice');
  assert.equal(scene.actors[0].y, 40000, 'and parked, like an unused CPU seat');

  online.room.seats[1].out = false;
  runFrame(scene);
  assert.equal(scene.actors[0].values.get('State'), 'Active', 'presence back brings the seat back');
});

test('a guest hides a seat the host reports as Out', () => {
  const roster = [
    { seat: 0, id: 'YOU', clientId: 'h1', cpu: false, role: 'Human', name: '' },
    { seat: 1, id: 'A', clientId: 'c1', cpu: false, role: 'Human', name: '' },
    { seat: 2, id: 'B', clientId: 'c2', cpu: false, role: 'Human', name: '' }
  ];
  const online = {
    payload: { kind: 'start', roster },
    seat: 2,
    inputs: {},
    snapshot: {
      kind: 'snapshot', t: 100, phase: 'Active', timer: 60,
      players: [
        { id: 'YOU', x: 0, y: 0, role: 'Human', state: 'Active', mode: 0 },
        { id: 'A', x: 0, y: 0, role: 'Human', state: 'Out', mode: 0 },
        { id: 'B', x: 0, y: 0, role: 'Human', state: 'Active', mode: 0 }
      ],
      switches: { active: 0, triggered: 0, on: [], spent: [], layout: [] },
      gates: { openIndex: -1, openFloor: '', unlocked: false, layout: [] }
    }
  };
  const scene = makeScene({
    variables: { OnlineRoomActive: true, OnlineIsHost: false, RoundPhase: 'Active', RosterDealt: true, GameOver: false },
    online
  });
  runFrame(scene);
  assert.equal(scene.actors[0].values.get('State'), 'Out', 'the guest hides the seat too');
});

test('a host that is not seat 0 still has ten bodies and a remote seat', () => {
  /* The seat-0 phone left the lobby; seat 3 took the room over. The host's own
   * character is seat 3, and seat 0 borrows the actor that would have been the
   * host's own body. */
  const roster = [];
  for (let seat = 0; seat < 7; seat += 1) {
    roster.push({
      seat, id: seat === 0 ? 'YOU' : 'ABCDEFGHI'[seat - 1],
      clientId: seat === 3 ? 'h1' : (seat === 1 ? 'c1' : ''),
      cpu: seat !== 3 && seat !== 1, role: 'Human', name: ''
    });
  }
  const online = {
    payload: { kind: 'start', roster },
    seat: 3,
    inputs: { c1: { kind: 'input', seq: 2, moveX: 1, moveY: 0, action: 'none', x: 40, y: 40, at: Date.now() } },
    remotePoses: {},
    snapshot: null
  };
  const scene = makeScene({
    variables: { OnlineRoomActive: true, OnlineIsHost: true, RoundPhase: 'Active', RosterDealt: true },
    online
  });
  runFrame(scene);
  assert.equal(scene.actors[2].__iceWolfV110Seat, 0, 'the borrowed body stands for seat 0');
  assert.equal(scene.actors[0].__iceWolfV110Seat, 1, 'actor A is seat 1');
  assert.equal(scene.actors[0].__iceWolfV110Remote, true, 'and seat 1 is the phone that is playing');
  assert.equal(scene.actors[2].__iceWolfV110Remote, false, 'seat 0 is a CPU or an empty seat');
  assert.equal(scene.values.get('OnlineSyncRemoteSeats'), 1);
  assert.equal(scene.player.x, 471.5, 'the host stands on its own seat’s spawn');
  assert.equal(scene.player.y, -8.5);
  assert.ok(scene.actors[0].x > -488.5, 'the remote seat still walks towards its phone');
});

test('a guest frame puts the host’s snapshot on the ice, the HUD and the ending', () => {
  const roster = [];
  for (let seat = 0; seat < 7; seat += 1) {
    roster.push({
      seat, id: seat === 0 ? 'YOU' : 'ABCDEFGHI'[seat - 1],
      clientId: seat === 2 ? 'c2' : (seat === 1 ? 'c1' : ''),
      cpu: seat !== 2 && seat !== 1, role: seat === 3 ? 'Wolf' : 'Human',
      name: seat === 1 ? 'Mio' : ''
    });
  }
  const snapshot = {
    kind: 'snapshot', t: 5000, phase: 'Active', timer: 97.5,
    players: [
      { id: 'YOU', x: 900, y: 300, z: 0, yaw: 90, role: 'Human', state: 'Active', mode: 0 },
      { id: 'A', x: -20, y: 40, z: 0, yaw: 0, role: 'Human', state: 'Frozen', mode: 0 },
      { id: 'B', x: 1050, y: 350, z: 0, yaw: 180, role: 'Human', state: 'Active', mode: 0 },
      { id: 'C', x: 1560, y: 400, z: 0, yaw: 0, role: 'Wolf', state: 'Active', mode: 1 },
      { id: 'D', x: 600, y: -300, z: 0, yaw: 0, role: 'Human', state: 'Active', mode: 0 }
    ],
    switches: {
      active: 2, triggered: 3, enabled: true, serial: 4,
      on: [1, 0, 1], spent: [0, 1, 0],
      layout: [
        { x: -660, y: 480, kind: 'correct', floor: '1F' },
        { x: 0, y: 600, kind: 'dummy', floor: '1F' },
        { x: 1560, y: 400, kind: 'correct', floor: '2F' }
      ]
    },
    gates: {
      openIndex: 2, openFloor: '1F', unlocked: true, serial: 4,
      layout: [{ x: -650, y: -650 }, { x: 590, y: 590 }, { x: -48, y: -48 }]
    },
    win: '人間の勝利', winId: 'human', winBy: 'gate'
  };
  const online = { payload: { kind: 'start', roster }, seat: 2, inputs: {}, snapshot };
  const scene = makeScene({
    variables: {
      OnlineRoomActive: true, OnlineIsHost: false, RoundPhase: 'Active', RosterDealt: false,
      GameOver: false, EscapeWonByGate: false
    },
    online
  });
  scene.player.x = 1040;
  scene.player.y = 350;
  const start = Date.now();
  scene.__iceWolfV110SyncAt = start - 16;
  runFrame(scene);

  assert.equal(scene.values.get('OnlineGuestMode'), true, 'this phone is a guest');
  /* Own seat B is the Player, moved towards the host's B; seat 0 borrowed actor
   * index 1 (the actor that would have been the guest's own body). */
  assert.ok(scene.player.x > 1040, `the Player was nudged towards the host copy: ${scene.player.x}`);
  assert.ok(scene.player.x < 1050, 'and not put on top of it: the player still owns its seat');
  assert.equal(scene.actors[1].values.get('LabelText'), 'YOU', 'seat 0 is the host, labelled YOU on this phone');
  assert.equal(scene.values.get('OnlineSyncLocalMode'), 'blend');
  assert.ok(scene.actors[1].x > -488.5, 'the host’s toy is on the ice towards its snapshot');
  assert.equal(scene.actors[0].values.get('State'), 'Frozen', 'a frozen seat is ice on every phone');
  assert.equal(scene.actors[2].values.get('Role'), 'Wolf', 'the host’s wolf is the wolf here too');
  assert.equal(scene.actors[2].values.get('AIWolfModeLeft'), 1, 'and its mode shows the wolf, not the disguise');
  assert.equal(scene.actors[0].values.get('LabelText'), 'Mio', 'a friend’s name is over the friend');
  assert.equal(scene.actors[2].values.get('LabelText'), 'C', 'a CPU keeps its letter');

  assert.equal(scene.values.get('MatchTimeLeft'), 97.5, 'the timer is the host’s');
  assert.equal(scene.values.get('SwitchActiveCount'), 2);
  assert.equal(scene.values.get('SwitchTriggeredCount'), 3);
  assert.equal(scene.values.get('GateUnlocked'), true);
  assert.equal(scene.values.get('GateOpenIndex'), 2);
  assert.equal(scene.values.get('GateOpenFloor'), '1F');
  assert.equal(scene.values.get('OnlineSyncAlive'), 3, 'A is frozen, D is off the list, the rest alive');
  assert.equal(scene.values.get('OnlineSyncFrozen'), 1);
  assert.equal(scene.values.get('OnlineSyncWinId'), 'human');
  assert.equal(scene.values.get('GameOver'), true, 'the ending came from the host');
  assert.equal(scene.values.get('EscapeWonByGate'), true, 'a human win is an escape');
  assert.equal(scene.values.get('OnlineSyncWinCount'), 1);

  /* The pads are the host's pads: the guest adopted the layout, including a 2F
   * switch it had drawn on 1F. */
  assert.equal(scene.arena.switches.length, 3);
  assert.equal(scene.arena.switches[2].x, 1560);
  assert.equal(scene.arena.switches[2].on, true);
  assert.equal(scene.arena.switches[1].spent, true);
  assert.equal(scene.arena.switches[1].kind, 'dummy');
  assert.equal(scene.arena.gates[2].open, true);
  assert.equal(scene.arena.gateOpenIndex, 2);
  assert.ok(scene.values.get('SwitchLayout').indexOf('1560:400:2F') >= 0, 'the layout string is the host’s');

  /* A second frame does not fire the ending twice. */
  scene.__iceWolfV110SyncAt = Date.now();
  runFrame(scene);
  assert.equal(scene.values.get('OnlineSyncWinCount'), 1, 'one ending per round');
});

test('a guest learns the roster roles before the first snapshot arrives', () => {
  const roster = [];
  for (let seat = 0; seat < 7; seat += 1) {
    roster.push({
      seat, id: seat === 0 ? 'YOU' : 'ABCDEFGHI'[seat - 1],
      clientId: seat === 3 ? 'c3' : '', cpu: seat !== 3,
      role: seat === 4 ? 'Wolf' : 'Human', name: ''
    });
  }
  const online = { payload: { kind: 'start', roster }, seat: 3, inputs: {}, snapshot: null };
  const scene = makeScene({
    variables: { OnlineRoomActive: true, OnlineIsHost: false, RoundPhase: 'RoleReveal', RosterDealt: true },
    online
  });
  runFrame(scene);
  assert.equal(online.syncRolesApplied, true, 'the roster was applied once');
  assert.equal(scene.actors[3].values.get('Role'), 'Wolf', 'seat 4 is the wolf, as the host dealt it');
  assert.equal(scene.actors[0].values.get('Role'), 'Human');
  assert.equal(scene.player.x, 471.5, 'the guest stands on its own seat’s spawn');
  assert.equal(scene.player.y, -8.5);
  assert.equal(scene.values.get('OnlineSyncLocalMode'), 'waiting', 'no snapshot yet, nothing to follow');
});

// ------------------------------------------------------- the sheet is wired
const conditionsOf = (event) => (event && event.conditions) || [];
const guardedEvents = (groupName) => {
  const group = sceneOf(readGame()).events.find((event) => event.name === groupName);
  const found = [];
  const walk = (event) => {
    if (event.type === 'BuiltinCommonInstructions::Standard') {
      const guarded = conditionsOf(event).some((condition) => (condition.parameters || [])[0] === 'OnlineGuestMode');
      if (guarded) found.push(event);
    }
    for (const child of event.events || []) walk(child);
  };
  walk(group);
  return found;
};

test('the AI blocks stand down for a guest and for a seat a phone is playing', () => {
  const code = groupCode(AI_GROUP);
  assert.ok(code.includes('const onlineGuestAi'), 'the AI block reads the room');
  assert.ok(code.includes("vars.get('OnlineRoomActive').getAsBoolean() === true"), 'it asks whether a round is online');
  assert.ok(code.includes("vars.get('OnlineIsHost').getAsBoolean() !== true"), 'and whether this phone is a guest');
  assert.ok(code.includes('if (!gameOver && !onlineGuestAi) {'), 'a guest runs no CPU AI at all');
  assert.ok(code.includes('if (wolf.__iceWolfV110Remote === true) continue;'), 'the host skips the played wolf seat');
  assert.ok(code.includes('if (actor.__iceWolfV110Remote === true) continue;'), 'and the played human seat');
});

test('the older rules that decide the round stay off a guest phone', () => {
  const flow = sceneOf(readGame()).events.find((event) => event.name === FLOW_GROUP);
  assert.ok(conditionsOf(flow.events[0]).some((condition) => (condition.parameters || [])[0] === 'OnlineGuestMode'),
    'the countdown, the wolf mode clock and the all-frozen win are the host’s');

  const survivors = allCode(SURVIVOR_GROUP);
  assert.ok(survivors.includes("!vars.get('OnlineGuestMode').getAsBoolean() && aliveHumans <= 0"),
    'the guest does not declare the wolf win itself');

  const switches = groupCode(SWITCH_GROUP);
  assert.ok(switches.includes('const onlineGuestNow'), 'the switch block knows a guest');
  assert.ok(switches.includes('if (onlineGuestNow) {') && switches.includes('holdTime = SWITCH_HOLD;'),
    'a guest’s switch ring is a picture: the host activates the switch');
  assert.ok(switches.includes("const done = activateSwitch(holdIndex, 'player');"),
    'the host still holds and activates its own switch');
  assert.ok(switches.includes("if (playing && !onlineGuestNow && vars.get('GateUnlocked')"),
    'and does not decide the escape itself');
  assert.ok(switches.includes('if (!onlineGuestNow) for (const actor of objects(\'Actor\'))'),
    'a guest’s actors do not ride the stairs on their own');

  assert.ok(guardedEvents(ACTION_GROUP).length >= 4, 'the guest’s freeze, rescue and infect buttons ask the host');
});

test('the toy block hides an escaped seat and the labels carry a name', () => {
  const bodies = groupCode(BODY_GROUP);
  assert.ok(bodies.includes("state === 'Out' || state === 'Escaped'"), 'an escaped seat leaves the arena');
  const labels = groupCode(LABEL_GROUP);
  assert.ok(labels.includes("obj.getVariables().get('LabelText')"), 'the head label reads the name');
  assert.ok(labels.includes("obj.getVariables().get('DisplayId').getAsString()"), 'and falls back to the letter');
});

test('the sync group is the last block, carries its markers, and its state has its own variables', () => {
  const game = readGame();
  const scene = sceneOf(game);
  assert.equal(scene.events[scene.events.length - 1].name, SYNC_GROUP, 'the sync block runs last');
  const code = groupCode(SYNC_GROUP);
  assert.ok(code.includes('/* ==== v1.1.0 online sync'), 'the testable block is marked');
  assert.ok(code.includes('/* ==== end v1.1.0 online sync ==== */'));
  assert.ok(code.includes('const roomActive = vars.get(\'OnlineRoomActive\').getAsBoolean() === true;'),
    'it leaves when there is no room');
  assert.ok(code.includes("vars.get('OnlineGuestMode').setBoolean(false);"), 'and says so');
  assert.ok(!/require\(|process\.|import\s/.test(code), 'no Node API runs on the phone');

  const variables = new Map(scene.variables.map((variable) => [variable.name, variable]));
  for (const name of ['OnlineGuestMode', 'OnlineSyncApplied', 'OnlineSyncRemoteSeats', 'OnlineSyncLocalMode',
    'OnlineSyncPadSignature', 'OnlineSyncWinId', 'OnlineSyncAlive', 'OnlineSyncFrozen', 'OnlineSyncHud',
    'OnlineRemoteMoves', 'OnlineRemoteSwitchCount', 'OnlineRemoteRescueCount', 'OnlineRemoteFreezeCount']) {
    assert.ok(variables.has(name), `${name} is a scene variable`);
    assert.match(name, /^Online/, `${name} belongs to the online state`);
  }
  assert.equal(variables.get('OnlineGuestMode').value, false, 'nobody is a guest at launch');
  assert.equal(variables.get('OnlineSyncWinId').value, '');

  for (const name of ['Player', 'Actor']) {
    const object = scene.objects.find((candidate) => candidate.name === name);
    assert.ok(object.variables.some((variable) => variable.name === 'LabelText'), `${name} can carry a label`);
  }
  /* The online group offers the room; the sync block is the only place the
   * snapshot becomes an arena. */
  const online = groupCode(ONLINE_GROUP);
  assert.ok(online.includes('iceWolfOnlineInput(online.sequence, moveX, moveY, action, pose, infectNow ? infectTarget : \'\')'),
    'the guest sends its pose and its infect target with its input');
  assert.ok(online.includes("winId: winIdNow"), 'the host sends the ending as a word');
  assert.ok(online.includes('layout: layoutDue ? switches.map'), 'and the switch layout, when it changes');
  assert.ok(online.includes("online.lastLayoutSerial !== layoutSerial"), 'the pads only travel on a new draw');
});
