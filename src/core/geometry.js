/**
 * Pure geometry for the two-storey ice arena.
 *
 * The arena is one footprint with a raised deck on its east half (2F). A player
 * belongs to floor 1 while west of the deck edge and floor 2 on the deck; the
 * two stairwells are the only way to cross (plus the warp pads).
 *
 * Everything here is DOM-free and Three.js-free so the unit tests can flood-fill
 * all six stages in Node.
 */
import { ARENA, ACTOR } from '../config.js';

const EPS = 1e-6;

export function rectOf(x, z, w, d, extra = {}) {
  return { x, z, w, d, ...extra };
}

export function rectBounds(r) {
  return { x0: r.x - r.w / 2, x1: r.x + r.w / 2, z0: r.z - r.d / 2, z1: r.z + r.d / 2 };
}

export function inflate(r, pad) {
  return { x: r.x, z: r.z, w: r.w + pad * 2, d: r.d + pad * 2, kind: r.kind, floor: r.floor };
}

export function pointInRect(x, z, r) {
  const b = rectBounds(r);
  return x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;
}

export function pointInRectPad(x, z, r, pad = 0) {
  return pointInRect(x, z, inflate(r, pad));
}

export function circleHitsRect(x, z, radius, r) {
  const b = rectBounds(r);
  const cx = Math.min(Math.max(x, b.x0), b.x1);
  const cz = Math.min(Math.max(z, b.z0), b.z1);
  const dx = x - cx;
  const dz = z - cz;
  return dx * dx + dz * dz < radius * radius - EPS;
}

export function rectsOverlap(a, b, pad = 0) {
  const A = inflate(a, pad);
  const B = rectBounds(b);
  const ab = rectBounds(A);
  return ab.x0 < B.x1 && ab.x1 > B.x0 && ab.z0 < B.z1 && ab.z1 > B.z0;
}

/** Which floor a position is on, by the deck edge. */
export function floorOf(x) {
  return x >= ARENA.deckX ? 2 : 1;
}

export function deckFloorY(floor) {
  return floor === 2 ? ARENA.deckY : 0;
}

/**
 * The fixed frame: outer walls per floor, the deck cliff (1F) and its railing
 * (2F), with the two stairwells cut out.
 */
export function frameWalls() {
  const f1 = [];
  const f2 = [];
  const t = ARENA.wallT;
  const { minX, maxX, minZ, maxZ, deckX } = ARENA;
  const midX = (minX + maxX) / 2;
  const midZ = (minZ + maxZ) / 2;
  const width = maxX - minX + t * 2;
  const depth = maxZ - minZ + t * 2;

  for (const floor of [1, 2]) {
    const list = floor === 1 ? f1 : f2;
    list.push(rectOf(midX, minZ - t / 2, width, t, { kind: 'wall', floor }));
    list.push(rectOf(midX, maxZ + t / 2, width, t, { kind: 'wall', floor }));
  }
  f1.push(rectOf(minX - t / 2, midZ, t, depth, { kind: 'wall', floor: 1 }));
  f2.push(rectOf(maxX + t / 2, midZ, t, depth, { kind: 'wall', floor: 2 }));

  // The deck face: a tall cliff for 1F, a railing for 2F, cut at the stairs.
  const gaps = ARENA.stairs
    .map((s) => [s.z - s.w / 2, s.z + s.w / 2])
    .sort((a, b) => a[0] - b[0]);
  const segments = [];
  let cursor = minZ - t / 2;
  for (const [g0, g1] of gaps) {
    if (g0 > cursor) segments.push([cursor, g0]);
    cursor = g1;
  }
  if (cursor < maxZ + t / 2) segments.push([cursor, maxZ + t / 2]);
  for (const [z0, z1] of segments) {
    f1.push(rectOf(deckX + t / 2, (z0 + z1) / 2, t, z1 - z0, { kind: 'cliff', floor: 1 }));
    f2.push(rectOf(deckX + t / 2, (z0 + z1) / 2, t, z1 - z0, { kind: 'rail', floor: 2 }));
  }
  return { f1, f2 };
}

const FRAME = frameWalls();

export function wallsForFloor(stage, floor) {
  const inner = floor === 1 ? stage.walls.f1 : stage.walls.f2;
  const frame = floor === 1 ? FRAME.f1 : FRAME.f2;
  return frame.concat(inner);
}

export function stairsForFloor(stage, floor) {
  return stage.stairs.filter((s) => s.floor === floor);
}

export function warpForFloor(stage, floor) {
  return stage.warps.filter((w) => w.floor === floor);
}

/** Every wall that matters for an actor on `floor`. */
export function blockedAt(stage, floor, x, z, radius = ACTOR.radius) {
  const walls = wallsForFloor(stage, floor);
  for (let i = 0; i < walls.length; i += 1) {
    if (circleHitsRect(x, z, radius, walls[i])) return walls[i];
  }
  return null;
}

export function isWalkable(stage, floor, x, z, radius = ACTOR.radius) {
  if (x < ARENA.minX || x > ARENA.maxX || z < ARENA.minZ || z > ARENA.maxZ) return false;
  return blockedAt(stage, floor, x, z, radius) === null;
}

/**
 * Move a circle from (x,z) to (nx,nz), sliding along walls. Returns the
 * resolved position — never inside a wall.
 */
export function resolveMove(stage, floor, x, z, nx, nz, radius = ACTOR.radius) {
  let rx = x;
  let rz = z;
  if (isWalkable(stage, floor, nx, rz, radius)) rx = nx;
  if (isWalkable(stage, floor, rx, nz, radius)) rz = nz;
  if (rx === x && rz === z) {
    // Cornered: try a half step so the actor never sticks hard.
    const hx = x + (nx - x) * 0.35;
    const hz = z + (nz - z) * 0.35;
    if (isWalkable(stage, floor, hx, hz, radius)) return { x: hx, z: hz };
  }
  return { x: rx, z: rz };
}

/** All switch candidate spots that this stage keeps clear. */
export function insideArena(x, z, pad = 0.6) {
  return (
    x > ARENA.minX + pad &&
    x < ARENA.maxX - pad &&
    z > ARENA.minZ + pad &&
    z < ARENA.maxZ - pad
  );
}

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

const CELL = 1;

/**
 * Build a two-floor navigation grid. A cell is walkable when a circle of the
 * actor radius fits at its centre. Stairs and warp pads become links, so one
 * BFS crosses floors exactly the way a player does.
 */
export function buildNav(stage, radius = ACTOR.radius) {
  const cols = Math.round((ARENA.maxX - ARENA.minX) / CELL);
  const rows = Math.round((ARENA.maxZ - ARENA.minZ) / CELL);
  const perFloor = cols * rows;
  const blocked = new Uint8Array(perFloor * 2);
  const cx = (ix) => ARENA.minX + (ix + 0.5) * CELL;
  const cz = (iz) => ARENA.minZ + (iz + 0.5) * CELL;
  for (let floor = 1; floor <= 2; floor += 1) {
    for (let iz = 0; iz < rows; iz += 1) {
      for (let ix = 0; ix < cols; ix += 1) {
        const x = cx(ix);
        const z = cz(iz);
        const onDeck = floor === 2 ? x >= ARENA.deckX : x < ARENA.deckX;
        const idx = (floor - 1) * perFloor + iz * cols + ix;
        if (!onDeck || !isWalkable(stage, floor, x, z, radius)) blocked[idx] = 1;
      }
    }
  }
  const links = new Map();
  const addLink = (a, b) => {
    if (!links.has(a)) links.set(a, []);
    if (!links.has(b)) links.set(b, []);
    links.get(a).push(b);
    links.get(b).push(a);
  };
  const cellOf = (floor, x, z) => {
    const ix = Math.floor((x - ARENA.minX) / CELL);
    const iz = Math.floor((z - ARENA.minZ) / CELL);
    if (ix < 0 || iz < 0 || ix >= cols || iz >= rows) return -1;
    return (floor - 1) * perFloor + iz * cols + ix;
  };
  for (const stair of stage.stairs) {
    const a = cellOf(stair.floor, stair.x, stair.z);
    const b = cellOf(stair.floor === 1 ? 2 : 1, stair.exitX, stair.exitZ);
    if (a >= 0 && b >= 0) addLink(a, b);
  }
  for (const warp of stage.warps) {
    const partner = stage.warps.find((w) => w.pair === warp.pair && w !== warp);
    if (!partner) continue;
    const a = cellOf(warp.floor, warp.x, warp.z);
    const b = cellOf(partner.floor, partner.x, partner.z);
    if (a >= 0 && b >= 0) addLink(a, b);
  }
  return { cols, rows, perFloor, cell: CELL, blocked, links, stage, cx, cz, cellOf, radius };
}

export function navCellAt(nav, floor, x, z) {
  return nav.cellOf(floor, x, z);
}

export function navNodeInfo(nav, idx) {
  const perFloor = nav.perFloor;
  const floor = idx >= perFloor ? 2 : 1;
  const local = idx - (floor - 1) * perFloor;
  const iz = Math.floor(local / nav.cols);
  const ix = local % nav.cols;
  return { floor, x: nav.cx(ix), z: nav.cz(iz), ix, iz };
}

function nearestFreeCell(nav, idx, maxRings = 6) {
  if (idx < 0) return -1;
  if (!nav.blocked[idx]) return idx;
  const perFloor = nav.perFloor;
  const floor = idx >= perFloor ? 2 : 1;
  const base = idx - (floor - 1) * perFloor;
  const bx = base % nav.cols;
  const bz = Math.floor(base / nav.cols);
  let best = -1;
  let bestD = Infinity;
  for (let r = 1; r <= maxRings; r += 1) {
    for (let dz = -r; dz <= r; dz += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const ix = bx + dx;
        const iz = bz + dz;
        if (ix < 0 || iz < 0 || ix >= nav.cols || iz >= nav.rows) continue;
        const cand = (floor - 1) * perFloor + iz * nav.cols + ix;
        if (nav.blocked[cand]) continue;
        const d = dx * dx + dz * dz;
        if (d < bestD) {
          bestD = d;
          best = cand;
        }
      }
    }
    if (best >= 0) return best;
  }
  return best;
}

/** Breadth-first path on the two-floor grid. Returns [{x,z,floor}] or null. */
export function findPath(nav, from, to, limit = 24000) {
  const start = nearestFreeCell(nav, nav.cellOf(from.floor, from.x, from.z));
  const goal = nearestFreeCell(nav, nav.cellOf(to.floor, to.x, to.z));
  if (start < 0 || goal < 0) return null;
  if (start === goal) return [navNodeInfo(nav, goal)];

  const total = nav.perFloor * 2;
  const prev = new Int32Array(total).fill(-1);
  const seen = new Uint8Array(total);
  const queue = new Int32Array(total);
  let qh = 0;
  let qt = 0;
  queue[qt++] = start;
  seen[start] = 1;
  const cols = nav.cols;
  while (qh < qt && qt < limit) {
    const cur = queue[qh++];
    if (cur === goal) break;
    const floor = cur >= nav.perFloor ? 2 : 1;
    const local = cur - (floor - 1) * nav.perFloor;
    const ix = local % cols;
    const iz = Math.floor(local / cols);
    const neighbours = [];
    if (ix > 0) neighbours.push(cur - 1);
    if (ix < cols - 1) neighbours.push(cur + 1);
    if (iz > 0) neighbours.push(cur - cols);
    if (iz < nav.rows - 1) neighbours.push(cur + cols);
    const links = nav.links.get(cur);
    if (links) neighbours.push(...links);
    for (const nb of neighbours) {
      if (nb < 0 || nb >= total || seen[nb] || nav.blocked[nb]) continue;
      seen[nb] = 1;
      prev[nb] = cur;
      queue[qt++] = nb;
    }
  }
  if (!seen[goal]) return null;
  const cells = [];
  let cur = goal;
  while (cur !== -1) {
    cells.push(navNodeInfo(nav, cur));
    if (cur === start) break;
    cur = prev[cur];
  }
  cells.reverse();
  return cells;
}

/** Straight line of sight on one floor (for the AI's simple fleet checks). */
export function lineClear(stage, floor, x0, z0, x1, z1, radius = ACTOR.radius) {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const dist = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(dist / 0.4));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (!isWalkable(stage, floor, x0 + dx * t, z0 + dz * t, radius)) return false;
  }
  return true;
}

export const NAV_CELL = CELL;

/**
 * Nudge a spawn / switch candidate to the nearest open metre. Stages author
 * their inner walls freely; a generic spawn point therefore asks the geometry
 * where it can actually stand instead of trusting the coordinate.
 */
export function openSpotFor(stage, spot, radius = ACTOR.radius, maxPush = 4) {
  if (isWalkable(stage, spot.floor, spot.x, spot.z, radius)) return { ...spot };
  for (let r = 0.5; r <= maxPush; r += 0.5) {
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * Math.PI * 2;
      const x = spot.x + Math.cos(a) * r;
      const z = spot.z + Math.sin(a) * r;
      if (isWalkable(stage, spot.floor, x, z, radius)) return { ...spot, x, z };
    }
  }
  return { ...spot };
}
