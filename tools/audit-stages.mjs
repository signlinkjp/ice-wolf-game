/**
 * Geometry audit for all six stages (development aid; also run by npm test's
 * stage suite). Prints every rule violation in one pass so a layout can be
 * fixed in one go.
 *
 * Build 38 checks the two-hall world:
 *   * every objective stands in its own hall, with clearance,
 *   * each hall is reachable from the player spawn, and back,
 *   * the stair zones pair up and their landings are open,
 *   * a warp stays inside its own floor,
 *   * a stair zone is at least PAD.stairWarpDistance from every warp mouth,
 *   * both halls keep real floor space.
 *
 *   node tools/audit-stages.mjs
 */
import { STAGES } from '../src/data/stages.js';
import { PAD } from '../src/config.js';
import {
  buildNav,
  findPath,
  isWalkable,
  insideFloor,
  floorBounds,
  floorArea,
  frameWalls,
  randomPointOn,
  floorAt,
  mulberry32,
} from './audit-imports.mjs';

let bad = 0;
const fail = (msg) => {
  bad += 1;
  console.log(`  FAIL ${msg}`);
};

const roomCentre = (stage, floor) => {
  const b = floorBounds(stage, floor);
  return { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2, floor };
};

for (const stage of STAGES) {
  console.log(`\n== ${stage.id}`);
  const b1 = floorBounds(stage, 1);
  const b2 = floorBounds(stage, 2);
  console.log(`  1F x ${b1.x0}..${b1.x1} z ${b1.z0}..${b1.z1}  area ${floorArea(stage, 1)} m2`);
  console.log(`  2F x ${b2.x0}..${b2.x1} z ${b2.z0}..${b2.z1}  area ${floorArea(stage, 2)} m2`);
  const fw = frameWalls(stage);
  console.log(`  frame walls 1F=${fw[1].length} 2F=${fw[2].length}`);

  // The halls must not overlap: that is the whole point of Build 38.
  if (b1.x1 > b2.x0) fail(`halls overlap on x (${b1.x1} > ${b2.x0})`);

  const ps = stage.playerSpawn;
  if (!isWalkable(stage, ps.floor, ps.x, ps.z, 0.55)) fail(`player spawn ${ps.x},${ps.z} f${ps.floor} blocked`);
  if (floorAt(stage, ps.x, ps.z) !== ps.floor) fail(`player spawn floor ${ps.floor} disagrees with the hall`);
  for (const s of stage.spawns) {
    if (!isWalkable(stage, s.floor, s.x, s.z, 0.55)) fail(`spawn ${s.x},${s.z} f${s.floor} blocked`);
  }

  // Switch candidates: 1.2 m clearance, right hall, clear of gates.
  for (const s of stage.switchSpots) {
    if (!isWalkable(stage, s.floor, s.x, s.z, 1.2)) fail(`switch ${s.x},${s.z} f${s.floor} lacks clearance`);
    if (floorAt(stage, s.x, s.z) !== s.floor) fail(`switch ${s.x},${s.z} f${s.floor} is in the wrong hall`);
    for (const g of stage.gates) {
      if (g.floor !== s.floor) continue;
      const d = Math.hypot(s.x - g.x, s.z - g.z);
      if (d <= 2.5) fail(`switch ${s.x},${s.z} is ${d.toFixed(2)} m from gate ${g.id}`);
    }
  }
  const f1s = stage.switchSpots.filter((s) => s.floor === 1).length;
  const f2s = stage.switchSpots.filter((s) => s.floor === 2).length;
  console.log(`  switch spots: ${f1s} on 1F, ${f2s} on 2F`);
  if (!f1s || !f2s) fail('switch spots need both floors');

  // Gates / warps / pads / stairs.
  for (const g of stage.gates) {
    if (!isWalkable(stage, g.floor, g.x, g.z, 0.7)) fail(`gate ${g.id} ${g.x},${g.z} f${g.floor} blocked`);
    if (floorAt(stage, g.x, g.z) !== g.floor) fail(`gate ${g.id} wrong hall`);
  }
  for (const p of stage.pads) {
    if (!isWalkable(stage, p.floor, p.x, p.z, 0.55)) fail(`pad ${p.id} ${p.x},${p.z} f${p.floor} blocked`);
    if (floorAt(stage, p.x, p.z) !== p.floor) fail(`pad ${p.id} wrong hall`);
  }
  for (const w of stage.warps) {
    if (!isWalkable(stage, w.floor, w.x, w.z, 0.9)) fail(`warp ${w.id} ${w.x},${w.z} f${w.floor} blocked`);
    if (!isWalkable(stage, w.floor, w.toX, w.toZ, 0.9)) fail(`warp ${w.id} exit ${w.toX},${w.toZ} blocked`);
    if (floorAt(stage, w.x, w.z) !== w.floor) fail(`warp ${w.id} wrong hall`);
    if (floorAt(stage, w.toX, w.toZ) !== w.floor) fail(`warp ${w.id} leaves its own floor`);
  }
  for (const s of stage.stairs) {
    if (!isWalkable(stage, s.floor, s.x, s.z, 0.55)) fail(`stair ${s.id} trigger f${s.floor} blocked`);
    if (!isWalkable(stage, s.toFloor, s.exitX, s.exitZ, 0.55)) fail(`stair ${s.id} exit ${s.exitX},${s.exitZ} blocked`);
    if (floorAt(stage, s.x, s.z) !== s.floor) fail(`stair ${s.id} trigger in the wrong hall`);
    if (floorAt(stage, s.exitX, s.exitZ) !== s.toFloor) fail(`stair ${s.id} lands in the wrong hall`);
    // The stair must land away from its own mouth, or you bounce back.
    const back = Math.hypot(s.x - s.exitX, s.z - s.exitZ);
    if (back < 1.8) fail(`stair ${s.id} exit only ${back.toFixed(2)} m from the mouth`);
    // And far from every warp mouth on its own floor.
    for (const w of stage.warps) {
      if (w.floor !== s.floor) continue;
      const d = Math.hypot(s.x - w.x, s.z - w.z);
      if (d < PAD.stairWarpDistance) fail(`stair ${s.id} is ${d.toFixed(1)} m from warp ${w.id} (< ${PAD.stairWarpDistance})`);
      const de = Math.hypot(s.exitX - w.x, s.exitZ - w.z);
      if (de < PAD.stairWarpDistance - 2) fail(`stair ${s.id} lands ${de.toFixed(1)} m from warp ${w.id}`);
    }
  }

  // Reachability from the player spawn to every objective, and back down.
  const nav = buildNav(stage);
  const targets = [
    ...stage.switchSpots.map((s) => ({ ...s, name: `switch ${s.x},${s.z}` })),
    ...stage.gates.map((g) => ({ ...g, name: `gate ${g.id}` })),
    ...stage.warps.map((w) => ({ x: w.x, z: w.z, floor: w.floor, name: `warp ${w.id}` })),
    ...stage.pads.map((p) => ({ ...p, name: `pad ${p.id}` })),
    ...stage.stairs.map((s) => ({ x: s.x, z: s.z, floor: s.floor, name: `stair ${s.id}` })),
    { ...roomCentre(stage, 2), name: '2F centre' },
  ];
  for (const t of targets) {
    if (!findPath(nav, ps, t)) fail(`${t.name} unreachable from spawn`);
  }
  if (!findPath(nav, roomCentre(stage, 2), roomCentre(stage, 1))) fail('2F -> 1F unreachable');

  // Random points: the AI and the gravity gimmick rely on this never failing.
  const rng = mulberry32(7);
  let nulls = 0;
  for (let i = 0; i < 60; i += 1) {
    if (!randomPointOn(stage, 1 + (i % 2), rng, 1.6)) nulls += 1;
  }
  if (nulls) fail(`randomPointOn returned null ${nulls}/60`);

  // Props sit in the hall they claim.
  for (const p of stage.props) {
    if (!insideFloor(stage, p.floor, p.x, p.z)) fail(`prop ${p.type} ${p.x},${p.z} f${p.floor} is in the wrong hall`);
  }
  // Gimmick zones: clipped roughly to their floor.
  const g = stage.gimmick;
  if (g) {
    const zones = [...(g.current || []), ...(g.gusts || []), ...(g.slideZones || []), ...(g.lowGravity || []), ...(g.spots || [])];
    for (const z of zones) {
      if (z.floor && !insideFloor(stage, z.floor, z.x, z.z)) fail(`gimmick zone ${z.x},${z.z} f${z.floor} in the wrong hall`);
    }
    for (const door of g.doors || []) {
      if (!insideFloor(stage, door.floor, door.x, door.z)) fail(`door ${door.x},${door.z} f${door.floor} wrong hall`);
    }
  }

  // Both halls usable: plenty of free square metres each.
  let free1 = 0;
  let free2 = 0;
  for (let x = -55; x < 55; x += 1) {
    for (let z = -21; z < 21; z += 1) {
      if (isWalkable(stage, 1, x + 0.5, z + 0.5, 0.55)) free1 += 1;
      if (isWalkable(stage, 2, x + 0.5, z + 0.5, 0.55)) free2 += 1;
    }
  }
  console.log(`  free cells: 1F ${free1}, 2F ${free2}`);
  if (free1 < 900) fail(`1F hall is cramped (${free1} cells)`);
  if (free2 < 900) fail(`2F hall is cramped (${free2} cells)`);
}

console.log(bad ? `\n${bad} problem(s)` : '\nall stages OK');
process.exit(bad ? 1 : 0);
