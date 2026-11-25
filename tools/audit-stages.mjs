/**
 * Geometry audit for all six stages (development aid; also run by npm test's
 * stage suite). Prints every rule violation in one pass so a layout can be
 * fixed in one go.
 *
 *   node tools/audit-stages.mjs
 */
import { STAGES } from '../src/data/stages.js';
import {
  buildNav,
  findPath,
  isWalkable,
  insideDeck,
  deckBounds,
  frameWalls,
  wallsForFloor,
  randomPointOn,
  mulberry32,
} from './audit-imports.mjs';

function deckProbe(stage) {
  const r = stage.deck[0];
  return { floor: 2, x: r.x, z: r.z };
}

let bad = 0;
const fail = (msg) => {
  bad += 1;
  console.log(`  FAIL ${msg}`);
};

for (const stage of STAGES) {
  console.log(`\n== ${stage.id}  deck=${JSON.stringify(stage.deck)}`);
  const b = deckBounds(stage);
  console.log(`  deck bbox x ${b.x0}..${b.x1}  z ${b.z0}..${b.z1}`);
  const fw = frameWalls(stage);
  console.log(`  frame walls f1=${fw.f1.length} f2=${fw.f2.length}`);

  // Spawns / player spawn on their own floor.
  const ps = stage.playerSpawn;
  if (!isWalkable(stage, ps.floor, ps.x, ps.z, 0.55)) fail(`player spawn ${ps.x},${ps.z} f${ps.floor} blocked`);
  if (insideDeck(stage, ps.x, ps.z) !== (ps.floor === 2)) fail(`player spawn floor ${ps.floor} disagrees with deck`);
  for (const s of stage.spawns) {
    if (!isWalkable(stage, s.floor, s.x, s.z, 0.55)) fail(`spawn ${s.x},${s.z} f${s.floor} blocked`);
  }

  // Switch candidates: 1.2 m clearance, right floor, clear of gates.
  for (const s of stage.switchSpots) {
    if (!isWalkable(stage, s.floor, s.x, s.z, 1.2)) fail(`switch ${s.x},${s.z} f${s.floor} lacks clearance`);
    if (insideDeck(stage, s.x, s.z) !== (s.floor === 2)) fail(`switch ${s.x},${s.z} f${s.floor} wrong floor`);
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
    if (insideDeck(stage, g.x, g.z) !== (g.floor === 2)) fail(`gate ${g.id} wrong floor`);
  }
  for (const p of stage.pads) {
    if (!isWalkable(stage, p.floor, p.x, p.z, 0.55)) fail(`pad ${p.id} ${p.x},${p.z} f${p.floor} blocked`);
    if (insideDeck(stage, p.x, p.z) !== (p.floor === 2)) fail(`pad ${p.id} wrong floor`);
  }
  for (const w of stage.warps) {
    if (!isWalkable(stage, w.floor, w.x, w.z, 0.9)) fail(`warp ${w.id} ${w.x},${w.z} f${w.floor} blocked`);
    if (insideDeck(stage, w.x, w.z) !== (w.floor === 2)) fail(`warp ${w.id} wrong floor`);
  }
  for (const s of stage.stairs) {
    if (!isWalkable(stage, s.floor, s.x, s.z, 0.55)) fail(`stair ${s.id} trigger f${s.floor} blocked`);
    if (!isWalkable(stage, s.floor === 1 ? 2 : 1, s.exitX, s.exitZ, 0.55)) fail(`stair ${s.id} exit ${s.exitX},${s.exitZ} blocked`);
  }

  // Reachability from the player spawn to every objective, and back down.
  const nav = buildNav(stage);
  const targets = [
    ...stage.switchSpots.map((s) => ({ ...s, name: `switch ${s.x},${s.z}` })),
    ...stage.gates.map((g) => ({ ...g, name: `gate ${g.id}` })),
    ...stage.warps.map((w) => ({ ...w, name: `warp ${w.id}` })),
    ...stage.pads.map((p) => ({ ...p, name: `pad ${p.id}` })),
    { ...deckProbe(stage), name: 'deck probe' },
  ];
  for (const t of targets) {
    if (!findPath(nav, ps, t)) fail(`${t.name} unreachable from spawn`);
  }
  const dp = deckProbe(stage);
  if (!findPath(nav, dp, { floor: 1, x: -20, z: 10 })) fail('deck -> 1F unreachable');

  // Random points: the AI and the gravity gimmick rely on this never failing.
  const rng = mulberry32(7);
  let nulls = 0;
  for (let i = 0; i < 60; i += 1) {
    if (!randomPointOn(stage, 1 + (i % 2), rng, 1.6)) nulls += 1;
  }
  if (nulls) fail(`randomPointOn returned null ${nulls}/60`);

  // Props sit on the floor they claim.
  for (const p of stage.props) {
    if (insideDeck(stage, p.x, p.z) !== (p.floor === 2)) fail(`prop ${p.type} ${p.x},${p.z} f${p.floor} wrong floor`);
  }
  // Gimmick zones: clipped roughly to their floor.
  const g = stage.gimmick;
  if (g) {
    const zones = [...(g.current || []), ...(g.slideZones || []), ...(g.lowGravity || []), ...(g.spots || [])];
    for (const z of zones) {
      const b2 = {
        x0: z.x - z.w / 2,
        x1: z.x + z.w / 2,
        z0: z.z - z.d / 2,
        z1: z.z + z.d / 2,
      };
      const probe = (x, zz) => insideDeck(stage, x, zz) === (z.floor === 2);
      if (!probe(z.x, z.z)) fail(`gimmick zone ${z.x},${z.z} f${z.floor} centre on the wrong floor`);
      if (!z.w && !z.d) continue;
      // A handle point at a quarter way in, on both axes, keeps it readable.
      if (b2) void b2;
    }
    for (const door of g.doors || []) {
      if (insideDeck(stage, door.x, door.z) !== (door.floor === 2)) fail(`door ${door.x},${door.z} f${door.floor} wrong floor`);
    }
  }

  // Both floors usable: a few free square metres each.
  let free1 = 0;
  let free2 = 0;
  for (let x = -23; x < 23; x += 1) {
    for (let z = -17; z < 17; z += 1) {
      if (isWalkable(stage, 1, x + 0.5, z + 0.5, 0.55)) free1 += 1;
      if (isWalkable(stage, 2, x + 0.5, z + 0.5, 0.55)) free2 += 1;
    }
  }
  console.log(`  free cells: 1F ${free1}, 2F ${free2}`);
  if (free1 < 80) fail(`floor 1 is cramped (${free1} cells)`);
  if (free2 < 60) fail(`floor 2 is cramped (${free2} cells)`);
  void wallsForFloor;
}

console.log(bad ? `\n${bad} problem(s)` : '\nall stages OK');
process.exit(bad ? 1 : 0);
