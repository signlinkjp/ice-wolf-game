/**
 * Stage geometry: every stage must be playable, not just pretty.
 *
 * Build 38 checks the two-hall world rather than the old stacked deck: 1F and
 * 2F are separate 48 x 40 m halls side by side, every objective stands in its
 * own hall, the stair zones cross between them, the warp stays inside one
 * floor, and the two kinds of zone never sit close enough to be confused.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES } from '../helpers.mjs';
import {
  isWalkable,
  buildNav,
  findPath,
  openSpotFor,
  insideFloor,
  floorBounds,
  floorAt,
} from '../../src/core/geometry.js';
import { PAD } from '../../src/config.js';

/** A point in the middle of a stage's hall. */
function hallProbe(stage, floor) {
  const b = floorBounds(stage, floor);
  return { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2, floor };
}

for (const stage of STAGES) {
  test(`${stage.nameKey}: player spawn is open`, () => {
    const p = stage.playerSpawn;
    assert.equal(isWalkable(stage, p.floor, p.x, p.z, 0.55), true);
    assert.equal(floorAt(stage, p.x, p.z), p.floor);
  });

  test(`${stage.nameKey}: every CPU spawn resolves to open ice`, () => {
    for (const s of stage.spawns) {
      const o = openSpotFor(stage, s, 0.55);
      assert.equal(isWalkable(stage, o.floor, o.x, o.z, 0.55), true, `spawn ${s.x},${s.z} f${s.floor}`);
      assert.ok(Math.hypot(o.x - s.x, o.z - s.z) < 3, `spawn ${s.x},${s.z} moved too far`);
    }
  });

  test(`${stage.nameKey}: every switch candidate has 1.2 m of clearance`, () => {
    for (const s of stage.switchSpots) {
      assert.equal(
        isWalkable(stage, s.floor, s.x, s.z, 1.2),
        true,
        `switch spot ${s.x},${s.z} f${s.floor}`,
      );
      assert.equal(floorAt(stage, s.x, s.z), s.floor, `switch ${s.x},${s.z} is in the wrong hall`);
    }
  });

  test(`${stage.nameKey}: switches exist on both floors`, () => {
    const f1 = stage.switchSpots.filter((s) => s.floor === 1).length;
    const f2 = stage.switchSpots.filter((s) => s.floor === 2).length;
    assert.ok(f1 >= 4, `only ${f1} switches on 1F`);
    assert.ok(f2 >= 4, `only ${f2} switches on 2F`);
  });

  test(`${stage.nameKey}: gates, stairs and warps are open`, () => {
    for (const g of stage.gates) {
      assert.equal(isWalkable(stage, g.floor, g.x, g.z, 0.7), true, `gate ${g.id}`);
    }
    for (const s of stage.stairs) {
      assert.equal(isWalkable(stage, s.floor, s.x, s.z, 0.55), true, `stair trigger ${s.id}`);
      assert.equal(isWalkable(stage, s.toFloor, s.exitX, s.exitZ, 0.55), true, `stair exit ${s.id}`);
      assert.equal(floorAt(stage, s.exitX, s.exitZ), s.toFloor, `stair ${s.id} lands outside its hall`);
    }
    for (const w of stage.warps) {
      assert.equal(isWalkable(stage, w.floor, w.x, w.z, 0.9), true, `warp ${w.id}`);
      assert.equal(floorAt(stage, w.toX, w.toZ), w.floor, `warp ${w.id} leaves its floor`);
    }
    for (const p of stage.pads) {
      assert.equal(isWalkable(stage, p.floor, p.x, p.z, 0.55), true, `pad ${p.id}`);
    }
  });

  test(`${stage.nameKey}: every objective is reachable on foot from the spawn`, () => {
    const nav = buildNav(stage);
    const from = stage.playerSpawn;
    const targets = [
      ...stage.switchSpots.map((s) => ({ ...s, name: 'switch' })),
      ...stage.gates.map((g) => ({ ...g, name: `gate${g.id}` })),
      ...stage.warps.map((w) => ({ x: w.x, z: w.z, floor: w.floor, name: 'warp' })),
      ...stage.pads.map((p) => ({ x: p.x, z: p.z, floor: p.floor, name: `pad${p.id}` })),
      ...stage.stairs.map((s) => ({ x: s.x, z: s.z, floor: s.floor, name: `stair${s.id}` })),
    ];
    for (const t of targets) {
      const path = findPath(nav, from, t);
      assert.ok(path && path.length > 0, `${t.name} ${t.x},${t.z} on floor ${t.floor} unreachable`);
    }
  });

  test(`${stage.nameKey}: 2F is reachable from 1F and back`, () => {
    const nav = buildNav(stage);
    const up = findPath(nav, stage.playerSpawn, hallProbe(stage, 2));
    assert.ok(up && up.some((n) => n.floor === 2), 'no path to 2F');
    const back = findPath(nav, hallProbe(stage, 2), hallProbe(stage, 1));
    assert.ok(back && back.some((n) => n.floor === 1), 'no path back to 1F');
  });

  test(`${stage.nameKey}: no switch sits inside a gate mouth`, () => {
    for (const s of stage.switchSpots) {
      for (const g of stage.gates) {
        if (s.floor !== g.floor) continue;
        const d = Math.hypot(s.x - g.x, s.z - g.z);
        assert.ok(d > 2.5, `switch ${s.x},${s.z} is ${d.toFixed(2)} from gate ${g.id}`);
      }
    }
  });

  test(`${stage.nameKey}: stair zones pair up, one mouth per floor`, () => {
    const up = stage.stairs.filter((s) => s.floor === 1);
    const down = stage.stairs.filter((s) => s.floor === 2);
    assert.equal(up.length, 2);
    assert.equal(down.length, 2);
    for (const s of up) assert.equal(s.toFloor, 2);
    for (const s of down) assert.equal(s.toFloor, 1);
    for (const s of up) {
      const back = down.find((d) => d.pair === s.pair);
      assert.ok(back, `no way down for pair ${s.pair}`);
      // The way up lands 2.6 m inside 2F, beside the mouth that leads back.
      const d = Math.hypot(back.x - s.exitX, back.z - s.exitZ);
      assert.ok(d > 1.6 && d < 4, `stair pair ${s.pair} landing is ${d.toFixed(2)} m from the way back`);
      // And the way back lands beside the mouth it came from.
      const backD = Math.hypot(s.x - back.exitX, s.z - back.exitZ);
      assert.ok(backD > 1.6 && backD < 4, `stair pair ${s.pair} return landing is ${backD.toFixed(2)} m away`);
    }
  });

  test(`${stage.nameKey}: stairs and warps are never near each other`, () => {
    for (const s of stage.stairs) {
      for (const w of stage.warps) {
        if (w.floor !== s.floor) continue;
        const d = Math.hypot(s.x - w.x, s.z - w.z);
        assert.ok(d >= PAD.stairWarpDistance, `stair ${s.id} is ${d.toFixed(1)} m from warp ${w.id}`);
      }
    }
  });

  test(`${stage.nameKey}: the two halls are wide and side by side`, () => {
    const b1 = floorBounds(stage, 1);
    const b2 = floorBounds(stage, 2);
    assert.ok(b1.x1 <= b2.x0, 'the halls must not overlap: 2F is not stacked on 1F');
    for (const b of [b1, b2]) {
      assert.ok(b.x1 - b.x0 >= 44, `hall is only ${b.x1 - b.x0} m wide`);
      assert.ok(b.z1 - b.z0 >= 36, `hall is only ${b.z1 - b.z0} m deep`);
    }
    let cells = 0;
    for (let x = -55; x < 55; x += 1) {
      for (let z = -21; z < 21; z += 1) {
        if (isWalkable(stage, 2, x + 0.5, z + 0.5, 0.55)) cells += 1;
      }
    }
    assert.ok(cells > 900, `only ${cells} walkable square metres on 2F`);
  });

  test(`${stage.nameKey}: nothing stands in the other hall`, () => {
    for (const list of [stage.gates, stage.pads, stage.props, stage.stairs, stage.warps]) {
      for (const item of list) {
        assert.equal(
          insideFloor(stage, item.floor, item.x, item.z),
          true,
          `${item.type || item.id} ${item.x},${item.z} f${item.floor} is in the wrong hall`,
        );
      }
    }
  });
}

test('the six stages are genuinely different', () => {
  const walls = new Set(
    STAGES.map((s) => s.walls.f1.map((r) => `${r.x},${r.z},${r.w},${r.d}`).sort().join('|')),
  );
  assert.equal(walls.size, 6, 'two stages share the same 1F layout');
  const stairs = new Set(
    STAGES.map((s) => s.stairs.filter((x) => x.floor === 1).map((x) => `${Math.round(x.x)},${x.z}`).sort().join('|')),
  );
  assert.ok(stairs.size >= 5, 'stair zones repeat across stages');
  // Each stage's switches and warps are laid out differently too.
  const objectives = new Set(
    STAGES.map((s) => `${s.switchSpots.map((x) => `${Math.round(x.x)},${x.z}`).join(';')}|${s.warps.map((w) => `${Math.round(w.x)},${w.z}`).join(';')}`),
  );
  assert.equal(objectives.size, 6);
});

/* ------------------------------------------------------------------ */
/* A whole CPU match on the new halls                                  */
/* ------------------------------------------------------------------ */

import { createMatch, stepMatch } from '../../src/core/rules.js';
import { brain } from '../../src/core/ai.js';

for (const stage of STAGES) {
  test(`${stage.nameKey}: a 20 s CPU match keeps everyone on the ice`, () => {
    for (const seed of [77, 4242]) {
      const match = createMatch(
        stage,
        { players: 10, wolves: 2, switches: 5, correct: 3, duration: 180, trap: 'off', role: 'random' },
        { seed },
      );
      const start = match.actors.map((a) => ({ x: a.x, z: a.z, floor: a.floor }));
      for (let t = 0; t < 20; t += 0.1) {
        stepMatch(match, 0.1, {}, brain);
        for (const a of match.actors) {
          if (a.state !== 'active') continue;
          assert.equal(
            isWalkable(stage, a.floor, a.x, a.z, 0.4),
            true,
            `seed ${seed}: seat ${a.seat} left the ice at ${a.x.toFixed(1)},${a.z.toFixed(1)} f${a.floor}`,
          );
        }
      }
      const moved = match.actors.filter((a, i) => Math.hypot(a.x - start[i].x, a.z - start[i].z) > 2.5).length;
      assert.ok(moved >= 3, `seed ${seed}: only ${moved} actors moved more than 2.5 m`);
    }
  });
}

for (const stage of STAGES) {
  test(`${stage.nameKey}: CPUs take the stairs when the work is on 2F`, () => {
    const match = createMatch(
      stage,
      { players: 8, wolves: 1, switches: 5, correct: 5, duration: 300, trap: 'off', role: 'random' },
      { seed: 8 },
    );
    for (const sw of match.switches) if (sw.floor === 1) sw.triggered = true;
    for (const a of match.actors) {
      a.role = 'human';
      a.state = 'active';
      a.form = 'human';
      a.wolfTimer = 0;
    }
    let climbs = 0;
    for (let t = 0; t < 60; t += 1 / 30) {
      stepMatch(match, 1 / 30, {}, brain);
      for (const ev of match.events.splice(0)) if (ev.type === 'stairs') climbs += 1;
    }
    assert.ok(climbs >= 1, 'no CPU used a stair zone in a minute');
    assert.ok(match.switches.some((s) => s.floor === 2 && s.active), 'no 2F switch was ever worked');
  });
}
