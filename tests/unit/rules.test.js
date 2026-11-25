/**
 * The v1.2.0 rule set, one rule at a time.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGE_BY_ID } from '../../src/data/stages.js';
import { ARENA, RESCUE, SWITCH, WOLF } from '../../src/config.js';
import {
  assignRoles,
  beginRescue,
  createMatch,
  freezeHuman,
  gimmickPhase,
  gravityCells,
  infectFrozen,
  isWolfRole,
  mulberry32,
  openGate,
  speedFactorAt,
  stepMatch,
  trapEnabled,
} from '../../src/core/rules.js';
import { isWalkable } from '../../src/core/geometry.js';

const baseSettings = {
  players: 7,
  wolves: 1,
  switches: 5,
  correct: 3,
  escape: true,
  trap: 'auto',
  duration: 180,
  role: 'random',
};

function matchOf(overrides = {}, stageId = 'classic') {
  const stage = STAGE_BY_ID[stageId];
  return createMatch(stage, { ...baseSettings, ...overrides }, { seed: 4242 });
}

function seat(match, role) {
  return match.actors.find((a) => a.role === role);
}

test('role deal: exactly one first wolf, and a second one is a werewolf', () => {
  for (let i = 0; i < 30; i += 1) {
    const rng = mulberry32(100 + i);
    const roles = assignRoles({ players: 7 + (i % 4), wolves: i % 2 ? 1 : 2, preference: 'random', rng });
    assert.equal(roles.filter((r) => r.role === 'firstWolf').length, 1);
    assert.equal(roles.filter((r) => r.role === 'werewolf').length, roles.filter((r) => isWolfRole(r.role)).length - 1);
  }
});

test('role preference: "wolf" makes the player the first wolf, "human" keeps them human', () => {
  const wolf = assignRoles({ players: 8, wolves: 2, preference: 'wolf', rng: mulberry32(7) });
  assert.equal(wolf[0].role, 'firstWolf');
  const human = assignRoles({ players: 8, wolves: 2, preference: 'human', rng: mulberry32(7) });
  assert.equal(human[0].role, 'human');
});

test('two wolves deal no trap switch; eight players arm it', () => {
  assert.equal(trapEnabled({ players: 8, wolves: 2, trap: 'auto' }), false);
  assert.equal(trapEnabled({ players: 8, wolves: 1, trap: 'auto' }), true);
  assert.equal(trapEnabled({ players: 7, wolves: 1, trap: 'auto' }), false);
  assert.equal(trapEnabled({ players: 7, wolves: 1, trap: 'always' }), true);
  assert.equal(trapEnabled({ players: 10, wolves: 1, trap: 'off' }), false);
  assert.equal(matchOf({ players: 8, wolves: 2 }).switches.some((s) => s.trap), false);
  assert.equal(matchOf({ players: 8, wolves: 1 }).switches.filter((s) => s.trap).length, 1);
});

test('the deal places one first wolf and leaves every non-wolf a human', () => {
  const match = matchOf({ players: 10, wolves: 2 });
  assert.equal(match.actors.filter((a) => a.role === 'firstWolf').length, 1);
  assert.equal(match.actors.filter((a) => a.role === 'werewolf').length, 1);
  assert.equal(match.actors.filter((a) => a.role === 'human').length, 8);
  // A werewolf starts in human form; the first wolf is a wolf from the start.
  assert.equal(seat(match, 'werewolf').form, 'human');
  assert.equal(seat(match, 'firstWolf').form, 'wolf');
});

test('switches: 3/5/7/10 with 3 or 5 correct, on both floors', () => {
  for (const switches of [3, 5, 7, 10]) {
    for (const correct of [3, 5]) {
      if (correct > switches) continue;
      const match = matchOf({ switches, correct, players: 10 });
      assert.equal(match.switches.length, switches);
      assert.equal(match.switches.filter((s) => s.correct).length, correct);
      assert.ok(match.switches.some((s) => s.floor === 1));
      assert.ok(match.switches.some((s) => s.floor === 2));
      for (const s of match.switches) {
        assert.ok(isWalkable(match.stage, s.floor, s.x, s.z, 0.55), 'switch on ice');
      }
    }
  }
});

test('the master wolf freezes a human by touch alone, from the first frame', () => {
  const match = matchOf();
  const wolf = seat(match, 'firstWolf');
  const human = seat(match, 'human');
  assert.equal(wolf.form, 'wolf', 'the master wolf is always in wolf form');
  human.x = wolf.x + 0.6;
  human.z = wolf.z;
  human.floor = wolf.floor;
  // No button, no Wolf Mode, no cooldown: contact is enough (Build 38).
  stepMatch(match, 1 / 60, {});
  assert.equal(human.state, 'frozen');
  assert.equal(wolf.wolfTimer, 0, 'the master wolf needs no mode timer');
});

test('the master wolf is a wolf for the whole match', () => {
  const match = matchOf();
  const wolf = seat(match, 'firstWolf');
  for (let t = 0; t < 30; t += 0.5) stepMatch(match, 0.5, { [wolf.seat]: { wolf: true } });
  assert.equal(wolf.form, 'wolf');
  assert.equal(isWolfRole(wolf.role), true);
  assert.equal(wolf.wolfTimer, 0);
});

test('touching the master wolf does not freeze a werewolf', () => {
  const match = matchOf({ players: 8, wolves: 2 });
  const first = seat(match, 'firstWolf');
  const were = seat(match, 'werewolf');
  were.x = first.x + 0.4;
  were.z = first.z;
  were.floor = first.floor;
  stepMatch(match, 1 / 60, {});
  assert.notEqual(were.state, 'frozen');
});

test('a werewolf in human form cannot freeze, and a human cannot freeze a werewolf', () => {
  const match = matchOf({ players: 8, wolves: 2 }, 'classic');
  const were = seat(match, 'werewolf');
  const human = seat(match, 'human');
  human.x = were.x + 0.4;
  human.z = were.z;
  human.floor = were.floor;
  stepMatch(match, 1 / 60, { [were.seat]: {} });
  assert.equal(human.state, 'active', 'a human-form werewolf has no freezing touch');
  assert.equal(were.form, 'human');
  // Transforming is the same five-second window, and then the touch freezes.
  stepMatch(match, 1 / 60, { [were.seat]: { wolf: true } });
  assert.equal(were.form, 'wolf');
  stepMatch(match, 1 / 60, {});
  assert.equal(human.state, 'frozen');
  // The first wolf touching the werewolf does nothing: it is not human.
  const first = seat(match, 'firstWolf');
  were.x = first.x + 0.4;
  were.z = first.z;
  were.floor = first.floor;
  stepMatch(match, 1 / 60, { [first.seat]: { wolf: true } });
  assert.notEqual(were.state, 'frozen');
});

test('Wolf Mode ends after five seconds and a werewolf turns back', () => {
  const match = matchOf({ players: 8, wolves: 2 });
  const were = seat(match, 'werewolf');
  stepMatch(match, 0.05, { [were.seat]: { wolf: true } });
  assert.equal(were.form, 'wolf');
  stepMatch(match, WOLF.modeSeconds, {});
  assert.equal(were.form, 'human');
  assert.ok(were.wolfCooldown > 0);
});

test('rescue takes 1.2 seconds of holding and thaws the teammate', () => {
  const match = matchOf();
  const wolf = seat(match, 'firstWolf');
  const victim = seat(match, 'human');
  freezeHuman(match, wolf, victim);
  const rescuer = match.actors.find((a) => a.role === 'human' && a !== victim);
  rescuer.x = victim.x + 1.0;
  rescuer.z = victim.z;
  rescuer.floor = victim.floor;
  for (let t = 0; t < 1.1; t += 0.1) stepMatch(match, 0.1, { [rescuer.seat]: { rescue: true } });
  assert.equal(victim.state, 'frozen');
  stepMatch(match, 0.15, { [rescuer.seat]: { rescue: true } });
  assert.equal(victim.state, 'active');
  assert.ok(match.stats.rescued >= 1);
});

test('trap ice: rescuing it turns the rescuer into the third wolf', () => {
  const match = matchOf({ players: 8, wolves: 1 });
  const wolf = seat(match, 'firstWolf');
  const victim = match.actors.find((a) => a.role === 'human');
  freezeHuman(match, wolf, victim);
  wolf.x = victim.x + 1;
  wolf.z = victim.z;
  wolf.floor = victim.floor;
  assert.equal(infectFrozen(match, wolf, victim), true);
  assert.equal(victim.frozenType, 'wolfCandidate');
  const rescuer = match.actors.find((a) => a.role === 'human' && a !== victim);
  rescuer.x = victim.x - 1;
  rescuer.z = victim.z;
  rescuer.floor = victim.floor;
  beginRescue(match, rescuer, victim);
  for (let t = 0; t < 1.3; t += 0.1) stepMatch(match, 0.1, { [rescuer.seat]: { rescue: true } });
  assert.equal(rescuer.role, 'werewolf');
  assert.equal(victim.state, 'frozen', 'the bait ice stays');
  assert.equal(match.actors.filter((a) => isWolfRole(a.role)).length, 2);
});

test('only the first wolf can name the bait ice', () => {
  const match = matchOf({ players: 8, wolves: 2 });
  const first = seat(match, 'firstWolf');
  const were = seat(match, 'werewolf');
  const victim = match.actors.find((a) => a.role === 'human');
  freezeHuman(match, first, victim);
  for (const wolf of [first, were]) {
    wolf.x = victim.x + 1;
    wolf.z = victim.z;
    wolf.floor = victim.floor;
  }
  assert.equal(infectFrozen(match, were, victim), false, 'the second wolf cannot name');
  assert.equal(match.infectionUsed, false);
  assert.equal(victim.frozenType, 'human');
  assert.equal(infectFrozen(match, first, victim), true, 'the master wolf can');
  assert.equal(victim.frozenType, 'wolfCandidate');
  assert.equal(infectFrozen(match, first, victim), false, 'once per match');
});

test('the trap never makes a fourth wolf', () => {
  const match = matchOf({ players: 10, wolves: 2 });
  const victim = match.actors.find((a) => a.role === 'human');
  const wolf = seat(match, 'firstWolf');
  freezeHuman(match, wolf, victim);
  wolf.x = victim.x;
  wolf.z = victim.z;
  wolf.floor = victim.floor;
  infectFrozen(match, wolf, victim);
  // Step the master wolf away: it freezes by touch now, and a rescuer standing
  // on the ice it just left would be frozen before the rescue completes.
  wolf.x = victim.x + 6;
  wolf.z = victim.z;
  // Promote a third wolf through the trap switch path first.
  const third = match.actors.find((a) => a.role === 'human' && a !== victim);
  third.role = 'werewolf';
  const rescuer = match.actors.find((a) => a.role === 'human' && a !== victim && a !== third);
  rescuer.x = victim.x;
  rescuer.z = victim.z;
  rescuer.floor = victim.floor;
  beginRescue(match, rescuer, victim);
  for (let t = 0; t < 1.3; t += 0.1) stepMatch(match, 0.1, { [rescuer.seat]: { rescue: true } });
  assert.equal(rescuer.role, 'human', 'no fourth wolf');
  assert.equal(victim.state, 'active', 'with the wolf cap reached the ice simply thaws');
});

test('every correct switch opens exactly one of the three gates', () => {
  const match = matchOf();
  openGate(match);
  assert.equal(match.gates.filter((g) => g.open).length, 1);
  const first = match.gateOpened;
  openGate(match);
  assert.equal(match.gateOpened, first, 'a second call changes nothing');
});

test('a human at an opened gate wins for the humans', () => {
  const match = matchOf();
  openGate(match);
  const gate = match.gates.find((g) => g.open);
  const human = match.actors.find((a) => a.role === 'human');
  human.x = gate.x;
  human.z = gate.z;
  human.floor = gate.floor;
  stepMatch(match, 1 / 60, {});
  assert.equal(match.phase, 'result');
  assert.equal(match.win, 'human');
  assert.equal(match.winBy, 'gate');
});

test('all humans frozen is a wolf win; the clock is a human win', () => {
  const match = matchOf();
  const wolf = seat(match, 'firstWolf');
  for (const a of match.actors.filter((x) => x.role === 'human')) freezeHuman(match, wolf, a);
  stepMatch(match, 1 / 60, {});
  assert.equal(match.win, 'wolf');
  assert.equal(match.winBy, 'frozen');

  const timed = matchOf();
  timed.elapsed = timed.duration - 0.01;
  stepMatch(timed, 0.02, {});
  assert.equal(timed.win, 'human');
  assert.equal(timed.winBy, 'time');
});

test('gimmick beats run on the match clock', () => {
  const park = matchOf({}, 'park');
  park.elapsed = 0.1;
  assert.equal(gimmickPhase(park).parade, true);
  park.elapsed = 6;
  assert.equal(gimmickPhase(park).parade, false);
  park.elapsed = 16.5;
  assert.equal(gimmickPhase(park).parade, true);

  const school = matchOf({}, 'school');
  school.elapsed = 1;
  assert.equal(gimmickPhase(school).chime, true);
  school.elapsed = 4;
  assert.equal(gimmickPhase(school).shut, true);
  school.elapsed = 8;
  assert.equal(gimmickPhase(school).shut, false);

  const space = matchOf({}, 'space');
  space.elapsed = 1;
  assert.equal(gimmickPhase(space).warn, true);
  space.elapsed = 3;
  assert.equal(gimmickPhase(space).gravity, true);
  space.elapsed = 13;
  assert.equal(gimmickPhase(space).gravity, false);
  const cells = gravityCells(space);
  assert.equal(cells.length, 6);
  for (const c of cells) assert.ok(isWalkable(space.stage, c.floor, c.x, c.z, 1.0));
});

test('speed zones: parade 135%, gravity cell 55%, high-gravity cell applies', () => {
  const park = matchOf({}, 'park');
  const human = park.actors.find((a) => a.role === 'human');
  assert.ok(Math.abs(speedFactorAt(park, human, { parade: true }) - 1.35) < 1e-9);
  assert.equal(speedFactorAt(park, human, { parade: false }), 1);

  const space = matchOf({}, 'space');
  const cells = gravityCells(space);
  const cell = cells[0];
  human.x = cell.x;
  human.z = cell.z;
  human.floor = cell.floor;
  assert.ok(Math.abs(speedFactorAt(space, human, { gravity: true, cells }) - 0.55) < 1e-9);
});

test('the school shutter keeps players out of the classroom while it is shut', () => {
  const match = matchOf({}, 'school');
  const door = match.stage.gimmick.doors[0];
  const human = match.actors.find((a) => a.role === 'human');
  human.x = door.x;
  human.z = door.z - door.d / 2 - 0.2;
  human.floor = door.floor;
  match.elapsed = 4; // shutter shut (2.5 → 7.5)
  const before = human.z;
  stepMatch(match, 1 / 60, {});
  assert.ok(human.z <= before + 0.01, 'the player is pushed back out of the shutter');
  assert.ok(Math.abs(human.z - door.z) > door.d / 2);
});

test('the aquarium current pushes a standing player downstream', () => {
  const match = matchOf({}, 'aquarium');
  const human = match.actors.find((a) => a.role === 'human');
  const lane = match.stage.gimmick.current[0];
  // Stand on an open part of the lane (a lane may cross a wall footprint).
  let px = lane.x;
  for (let x = lane.x - lane.w / 2 + 1; x < lane.x + lane.w / 2; x += 0.5) {
    if (isWalkable(match.stage, lane.floor, x, lane.z, 0.55)) { px = x; break; }
  }
  human.x = px;
  human.z = lane.z;
  human.floor = lane.floor;
  const before = human.x;
  stepMatch(match, 0.2, {});
  assert.ok(human.x > before, 'pushed east on floor 1');
});

test('a stair zone carries a player into the other hall', () => {
  const match = matchOf();
  const stair = match.stage.stairs.find((s) => s.floor === 1);
  const human = match.actors.find((a) => a.role === 'human');
  human.x = stair.x;
  human.z = stair.z;
  human.floor = 1;
  stepMatch(match, 1 / 60, { [human.seat]: { mx: 0, mz: 0 } });
  assert.equal(human.floor, 2, 'stepping on the zone is the whole gesture');
  assert.ok(Math.hypot(human.x - stair.exitX, human.z - stair.exitZ) < 0.01);
  assert.ok(human.climb > 0, 'the climb animation plays');
  assert.ok(match.events.some((e) => e.type === 'stairs'));
  // The landing is off the zone, so nobody bounces back and forth.
  const landed = { x: human.x, z: human.z, floor: human.floor };
  for (let i = 0; i < 30; i += 1) stepMatch(match, 1 / 60, { [human.seat]: { mx: 0, mz: 0 } });
  assert.equal(human.floor, landed.floor);
  assert.ok(Math.hypot(human.x - landed.x, human.z - landed.z) < 0.6);
});

test('the stair back returns the player to the first hall', () => {
  const match = matchOf();
  const up = match.stage.stairs.find((s) => s.floor === 1);
  const human = match.actors.find((a) => a.role === 'human');
  human.x = up.exitX;
  human.z = up.exitZ;
  human.floor = 2;
  // Walk back onto the 2F mouth, which sits where the stair surfaces.
  const down = match.stage.stairs.find((s) => s.floor === 2 && s.pair === up.pair);
  human.x = down.x;
  human.z = down.z;
  stepMatch(match, 1 / 60, { [human.seat]: { mx: 0, mz: 0 } });
  assert.equal(human.floor, 1);
  assert.ok(Math.hypot(human.x - down.exitX, human.z - down.exitZ) < 0.01);
});

test('a warp moves the player inside their own floor', () => {
  const match = matchOf();
  const warp = match.stage.warps[0];
  const human = match.actors.find((a) => a.role === 'human');
  human.x = warp.x;
  human.z = warp.z;
  human.floor = warp.floor;
  stepMatch(match, 1 / 60, { [human.seat]: { mx: 0, mz: 0 } });
  assert.equal(human.floor, warp.floor, 'a warp never changes floor');
  assert.ok(Math.hypot(human.x - warp.toX, human.z - warp.toZ) < 0.01);
  assert.ok(human.warpCooldown > 0);
});

test('nobody leaves the arena over a busy minute (AI plays all six stages)', () => {
  for (const id of Object.keys(STAGE_BY_ID)) {
    const match = matchOf({ players: 8, wolves: 1, duration: 60 }, id);
    const dt = 1 / 30;
    let steps = 0;
    while (match.phase === 'play' && steps < 60 * 30 + 30) {
      stepMatch(match, dt, {});
      steps += 1;
      for (const a of match.actors) {
        assert.ok(Number.isFinite(a.x) && Number.isFinite(a.z), `${id}: NaN`);
        assert.ok(a.x >= ARENA.minX - 1 && a.x <= ARENA.maxX + 1, `${id}: x out`);
        assert.ok(a.z >= ARENA.minZ - 1 && a.z <= ARENA.maxZ + 1, `${id}: z out`);
      }
    }
    assert.equal(match.phase, 'result', `${id}: the match must end`);
  }
});

test('a frozen human is not a rescue target for a werewolf, and wolves cannot rescue', () => {
  const match = matchOf({ players: 8, wolves: 2 });
  const victim = match.actors.find((a) => a.role === 'human');
  const first = seat(match, 'firstWolf');
  freezeHuman(match, first, victim);
  const were = seat(match, 'werewolf');
  were.x = victim.x;
  were.z = victim.z;
  were.floor = victim.floor;
  assert.equal(beginRescue(match, were, victim), false);
});

test('the stage switch hold is 1.6 seconds and a dummy only reports a miss', () => {
  const match = matchOf({ switches: 5, correct: 3 });
  const human = match.actors.find((a) => a.role === 'human');
  const dummy = match.switches.find((s) => !s.correct && !s.trap);
  human.x = dummy.x;
  human.z = dummy.z;
  human.floor = dummy.floor;
  for (let t = 0; t < SWITCH.holdSeconds - 0.1; t += 0.1) stepMatch(match, 0.1, { [human.seat]: { useSwitch: true } });
  assert.equal(dummy.triggered, false);
  stepMatch(match, 0.25, { [human.seat]: { useSwitch: true } });
  assert.equal(dummy.triggered, true);
  assert.equal(dummy.active, false);
  assert.ok(match.events.some((e) => e.type === 'switchMiss'));
});

test('rescue range is 2.25 m', () => {
  assert.equal(RESCUE.range, 2.25);
  const match = matchOf();
  const wolf = seat(match, 'firstWolf');
  const victim = match.actors.find((a) => a.role === 'human');
  freezeHuman(match, wolf, victim);
  const far = match.actors.find((a) => a.role === 'human' && a !== victim);
  far.x = victim.x + RESCUE.range + 0.5;
  far.z = victim.z;
  far.floor = victim.floor;
  assert.equal(beginRescue(match, far, victim), false);
});

test('both halls are flat, and the world holds the two of them side by side', () => {
  assert.equal(ARENA.outerH > ARENA.wallH, true, 'outer walls are the tall ones');
  assert.ok(ARENA.maxX - ARENA.minX > 100, 'two 48 m halls and the gap between them');
});
