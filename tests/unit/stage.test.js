/**
 * Stage geometry: every stage must be playable, not just pretty.
 * These checks mirror the GDevelop build's layout script (one connected area per
 * floor, switches and gates clear of walls, both floors reachable).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES } from '../helpers.mjs';
import { isWalkable, buildNav, findPath, openSpotFor } from '../../src/core/geometry.js';
import { ARENA } from '../../src/config.js';

for (const stage of STAGES) {
  test(`${stage.nameKey}: player spawn is open`, () => {
    const p = stage.playerSpawn;
    assert.equal(isWalkable(stage, p.floor, p.x, p.z, ARENA ? 0.55 : 0.55), true);
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
    }
  });

  test(`${stage.nameKey}: gates, stairs and warps are open`, () => {
    for (const g of stage.gates) {
      assert.equal(isWalkable(stage, g.floor, g.x, g.z, 0.7), true, `gate ${g.id}`);
    }
    for (const s of stage.stairs) {
      assert.equal(isWalkable(stage, s.floor, s.exitX, s.exitZ, 0.55), true, `stair exit ${s.id}`);
    }
    for (const w of stage.warps) {
      assert.equal(isWalkable(stage, w.floor, w.x, w.z, 0.9), true, `warp ${w.id}`);
    }
  });

  test(`${stage.nameKey}: every objective is reachable on foot from the spawn`, () => {
    const nav = buildNav(stage);
    const from = stage.playerSpawn;
    const targets = [
      ...stage.switchSpots.map((s) => ({ ...s, name: 'switch' })),
      ...stage.gates.map((g) => ({ ...g, name: `gate${g.id}` })),
      ...stage.warps.map((w) => ({ x: w.x, z: w.z, floor: w.floor, name: 'warp' })),
    ];
    for (const t of targets) {
      const path = findPath(nav, from, t);
      assert.ok(path && path.length > 0, `${t.name} ${t.x},${t.z} on floor ${t.floor} unreachable`);
    }
  });

  test(`${stage.nameKey}: the deck is reachable from the ground floor`, () => {
    const nav = buildNav(stage);
    const path = findPath(nav, stage.playerSpawn, { floor: 2, x: 14, z: 0 });
    assert.ok(path && path.some((n) => n.floor === 2), 'no path to floor 2');
  });

  test(`${stage.nameKey}: the ground floor is reachable from the deck`, () => {
    const nav = buildNav(stage);
    const path = findPath(nav, { floor: 2, x: 20, z: 10 }, { floor: 1, x: -20, z: 10 });
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
  });
}
