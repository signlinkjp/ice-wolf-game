/**
 * Stage geometry: every stage must be playable, not just pretty.
 * These checks mirror the GDevelop build's layout script (one connected area per
 * floor, switches and gates clear of walls, both floors reachable), with Build
 * 37's per-stage deck added: the 2F footprint differs on all six stages, and the
 * stairs, warps, pads and objectives all have to sit on the right surface.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES } from '../helpers.mjs';
import {
  isWalkable,
  buildNav,
  findPath,
  openSpotFor,
  insideDeck,
  deckBounds,
} from '../../src/core/geometry.js';
import { ARENA } from '../../src/config.js';

/** A point that is definitely on the stage's own deck. */
function deckProbe(stage) {
  const r = stage.deck[0];
  return { x: r.x, z: r.z, floor: 2 };
}

for (const stage of STAGES) {
  test(`${stage.nameKey}: player spawn is open`, () => {
    const p = stage.playerSpawn;
    assert.equal(isWalkable(stage, p.floor, p.x, p.z, 0.55), true);
    assert.equal(insideDeck(stage, p.x, p.z), p.floor === 2);
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
      assert.equal(insideDeck(stage, s.x, s.z), s.floor === 2, `switch ${s.x},${s.z} is on the wrong floor`);
    }
  });

  test(`${stage.nameKey}: switches exist on both floors`, () => {
    const f1 = stage.switchSpots.filter((s) => s.floor === 1).length;
    const f2 = stage.switchSpots.filter((s) => s.floor === 2).length;
    assert.ok(f1 >= 4, `only ${f1} switches on the ice`);
    assert.ok(f2 >= 4, `only ${f2} switches on the deck`);
  });

  test(`${stage.nameKey}: gates, stairs and warps are open`, () => {
    for (const g of stage.gates) {
      assert.equal(isWalkable(stage, g.floor, g.x, g.z, 0.7), true, `gate ${g.id}`);
    }
    for (const s of stage.stairs) {
      const other = s.floor === 1 ? 2 : 1;
      assert.equal(isWalkable(stage, s.floor, s.x, s.z, 0.55), true, `stair trigger ${s.id}`);
      assert.equal(isWalkable(stage, other, s.exitX, s.exitZ, 0.55), true, `stair exit ${s.id}`);
    }
    for (const w of stage.warps) {
      assert.equal(isWalkable(stage, w.floor, w.x, w.z, 0.9), true, `warp ${w.id}`);
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
    ];
    for (const t of targets) {
      const path = findPath(nav, from, t);
      assert.ok(path && path.length > 0, `${t.name} ${t.x},${t.z} on floor ${t.floor} unreachable`);
    }
  });

  test(`${stage.nameKey}: the deck is reachable from the ground floor`, () => {
    const nav = buildNav(stage);
    const path = findPath(nav, stage.playerSpawn, deckProbe(stage));
    assert.ok(path && path.some((n) => n.floor === 2), 'no path to floor 2');
  });

  test(`${stage.nameKey}: the ground floor is reachable from the deck`, () => {
    const nav = buildNav(stage);
    const path = findPath(nav, deckProbe(stage), { floor: 1, x: -20, z: 10 });
    assert.ok(path && path.some((n) => n.floor === 1), 'no path back to floor 1');
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

  test(`${stage.nameKey}: stairs exist on both floors and pair up`, () => {
    const up = stage.stairs.filter((s) => s.floor === 1);
    const down = stage.stairs.filter((s) => s.floor === 2);
    assert.equal(up.length, 2);
    assert.equal(down.length, 2);
    for (const s of up) assert.equal(s.toFloor, 2);
    for (const s of down) assert.equal(s.toFloor, 1);
    // Each up stair has a down stair at the same edge, so a player can come back.
    for (const s of up) {
      const back = down.find((d) => d.edgeX === s.edgeX && d.edgeZ === s.edgeZ);
      assert.ok(back, `no way down at ${s.edgeX},${s.edgeZ}`);
      assert.ok(Math.hypot(back.x - s.exitX, back.z - s.exitZ) < 0.01, 'stair up/down landings disagree');
    }
  });

  test(`${stage.nameKey}: the deck keeps real floor space`, () => {
    const b = deckBounds(stage);
    const area = (b.x1 - b.x0) * (b.z1 - b.z0);
    assert.ok(area > 120, `deck footprint is only ${area} m2`);
    let cells = 0;
    for (let x = -23; x < 23; x += 1) {
      for (let z = -17; z < 17; z += 1) {
        if (isWalkable(stage, 2, x + 0.5, z + 0.5, 0.55)) cells += 1;
      }
    }
    assert.ok(cells > 120, `only ${cells} walkable square metres on the deck`);
  });

  test(`${stage.nameKey}: nothing floats off the deck edge`, () => {
    // Every 2F fixture must stand on the deck; every 1F fixture off it.
    for (const list of [stage.gates, stage.pads, stage.props]) {
      for (const item of list) {
        assert.equal(
          insideDeck(stage, item.x, item.z),
          item.floor === 2,
          `${item.type || item.id} ${item.x},${item.z} f${item.floor}`,
        );
      }
    }
    for (const w of stage.warps) {
      assert.equal(insideDeck(stage, w.x, w.z), w.floor === 2, `warp ${w.id}`);
    }
  });

  test(`${stage.nameKey}: the frame follows the deck, not a fixed x`, () => {
    void ARENA;
    const probe = deckProbe(stage);
    assert.equal(isWalkable(stage, 2, probe.x, probe.z, 0.55), true);
    // The deck edge is a wall on the ice: one metre outside it is not walkable
    // as floor 2, and the ice there is floor 1.
    const b = deckBounds(stage);
    const outsideX = b.x1 + 1.2;
    if (outsideX < ARENA.maxX) {
      assert.equal(insideDeck(stage, outsideX, 0), false);
    }
  });
}

test('the six decks are genuinely different shapes', () => {
  const signatures = new Set(
    STAGES.map((s) => s.deck.map((r) => `${r.x},${r.z},${r.w},${r.d}`).sort().join('|')),
  );
  assert.equal(signatures.size, 6, 'two stages share the same deck footprint');
  // Stairwells differ too: no two stages put their stairs in the same places.
  const stairs = new Set(
    STAGES.map((s) => s.stairs.filter((x) => x.floor === 1).map((x) => `${x.edgeX},${x.edgeZ},${x.dir}`).sort().join('|')),
  );
  assert.ok(stairs.size >= 5, 'stairwells repeat across stages');
});

/* ------------------------------------------------------------------ */
/* Walking up every staircase                                          */
/* ------------------------------------------------------------------ */

const DIRS = { E: [1, 0], W: [-1, 0], N: [0, -1], S: [0, 1] };

for (const stage of STAGES) {
  test(`${stage.nameKey}: every stairwell can actually be walked up`, () => {
    for (const stair of stage.stairs.filter((s) => s.floor === 1)) {
      const [dx, dz] = DIRS[stair.dir];
      const match = createMatch(
        stage,
        { players: 4, wolves: 1, switches: 3, correct: 1, duration: 180, trap: 'off' },
        { seed: 21 },
      );
      for (const a of match.actors) {
        a.isCPU = false;
        a.role = 'human';
        a.state = 'active';
        a.x = -21;
        a.z = 14;
        a.floor = 1;
      }
      const walker = match.actors[0];
      walker.x = stair.x - dx * 1.6;
      walker.z = stair.z - dz * 1.6;
      walker.floor = 1;
      assert.equal(isWalkable(stage, 1, walker.x, walker.z, 0.55), true, `${stair.id} approach is blocked`);
      for (let i = 0; i < 180 && walker.floor === 1; i += 1) {
        stepMatch(match, 1 / 60, { [walker.seat]: { mx: dx, mz: dz } });
      }
      assert.equal(walker.floor, 2, `${stair.id}: walking into the stairwell did not climb it`);
    }
  });
}

/* ------------------------------------------------------------------ */
/* A whole CPU match on the new decks                                  */
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
      // People actually went somewhere (pathing across the new decks works).
      const moved = match.actors.filter((a, i) => Math.hypot(a.x - start[i].x, a.z - start[i].z) > 2.5).length;
      assert.ok(moved >= 3, `seed ${seed}: only ${moved} actors moved more than 2.5 m`);
    }
  });
}

for (const stage of STAGES) {
  test(`${stage.nameKey}: CPUs take the stairs when the work is on the deck`, () => {
    const match = createMatch(
      stage,
      { players: 8, wolves: 1, switches: 5, correct: 5, duration: 300, trap: 'off', role: 'random' },
      { seed: 8 },
    );
    // Leave only the deck switches: every CPU that wants a job must climb.
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
    assert.ok(climbs >= 1, 'no CPU used a staircase in a minute');
    assert.ok(match.switches.some((s) => s.floor === 2 && s.active), 'no deck switch was ever worked');
  });
}
