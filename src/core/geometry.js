/**
 * Pure geometry for the two-hall ice world.
 *
 * Build 38 separates the floors: 1F and 2F are no longer stacked, they are two
 * independent halls side by side (west and east), each a set of rectangles in
 * `stage.floors[floor]`. Nothing of the 2F is ever drawn over the 1F, so the
 * old "the deck hides the ice" problem cannot happen.
 *
 * From that one piece of data this module derives the frame every stage shares:
 *   * the outer walls of each hall, following the union of its rectangles (so
 *     an L-shaped hall has one continuous wall, not a wall through its middle),
 *   * which hall a position belongs to (`floorAt`: 1, 2, or 0 for the void),
 *   * the two-floor navigation grid the AI walks, with the stair and warp zones
 *     as links.
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

/* ------------------------------------------------------------------ */
/* The two halls                                                       */
/* ------------------------------------------------------------------ */

/** The rectangles that make up one floor's hall. */
export function floorRects(stage, floor) {
  return (stage.floors && stage.floors[floor]) || [];
}

/** Is (x,z) inside that floor's hall? */
export function insideFloor(stage, floor, x, z) {
  for (const r of floorRects(stage, floor)) {
    const b = rectBounds(r);
    if (x > b.x0 + EPS && x < b.x1 - EPS && z > b.z0 + EPS && z < b.z1 - EPS) return true;
  }
  return false;
}

/** Which hall a position stands in: 1, 2, or 0 for the void between them. */
export function floorAt(stage, x, z) {
  if (insideFloor(stage, 2, x, z)) return 2;
  if (insideFloor(stage, 1, x, z)) return 1;
  return 0;
}

/** Which floor a SPOT claims, corrected by the halls it actually stands in. */
export function snapFloor(stage, spot) {
  const floor = floorAt(stage, spot.x, spot.z);
  return { ...spot, floor: floor || spot.floor };
}

/** Both halls are flat; the helper stays so callers never hard-code a height. */
export function floorY() {
  return 0;
}

/** The bounding box of one floor's hall. */
export function floorBounds(stage, floor) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const r of floorRects(stage, floor)) {
    const b = rectBounds(r);
    x0 = Math.min(x0, b.x0);
    x1 = Math.max(x1, b.x1);
    z0 = Math.min(z0, b.z0);
    z1 = Math.max(z1, b.z1);
  }
  return { x0, x1, z0, z1 };
}

/** A readable middle point for a floor (the CAM / other-floor button). */
export function floorCenter(stage, floor) {
  const b = floorBounds(stage, floor);
  return { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2, y: 0, floor };
}

/** Area of a floor's hall, in square metres. */
export function floorArea(stage, floor) {
  let area = 0;
  for (const r of floorRects(stage, floor)) area += r.w * r.d;
  return area;
}

/* ------------------------------------------------------------------ */
/* The shared frame                                                    */
/* ------------------------------------------------------------------ */

export function sampleRuns(from, to, step, test) {
  const out = [];
  const n = Math.max(1, Math.ceil(Math.abs(to - from) / step));
  let start = null;
  for (let i = 0; i <= n; i += 1) {
    const u = from + ((to - from) * i) / n;
    if (test(u)) {
      if (start === null) start = u;
    } else if (start !== null) {
      out.push([start, u]);
      start = null;
    }
  }
  if (start !== null) out.push([start, to]);
  return out.filter(([a, b]) => b - a >= 0.9);
}

/**
 * Every edge of a hall that faces the void: that is where the outer wall goes.
 * An edge shared with another rectangle of the same floor is interior (an L's
 * inner seam) and gets nothing.
 */
function hallEdgeRuns(stage, floor) {
  const runs = [];
  for (const r of floorRects(stage, floor)) {
    const b = rectBounds(r);
    const sides = [
      { along: 'x', fixed: b.z0, nx: 0, nz: -1, min: b.x0, max: b.x1 },
      { along: 'x', fixed: b.z1, nx: 0, nz: 1, min: b.x0, max: b.x1 },
      { along: 'z', fixed: b.x0, nx: -1, nz: 0, min: b.z0, max: b.z1 },
      { along: 'z', fixed: b.x1, nx: 1, nz: 0, min: b.z0, max: b.z1 },
    ];
    for (const side of sides) {
      const exposed = (u) => {
        const px = side.along === 'x' ? u : side.fixed;
        const pz = side.along === 'x' ? side.fixed : u;
        return !insideFloor(stage, floor, px + side.nx * 0.5, pz + side.nz * 0.5);
      };
      for (const [from, to] of sampleRuns(side.min, side.max, 0.5, exposed)) {
        runs.push({ ...side, from, to });
      }
    }
  }
  return runs;
}

const frameCache = new Map();

/** The outer wall of each hall, derived from its footprint. */
export function frameWalls(stage) {
  const key = stage.id || 'custom';
  if (frameCache.has(key)) return frameCache.get(key);
  const t = ARENA.wallT;
  const made = { 1: [], 2: [] };
  for (const floor of [1, 2]) {
    for (const run of hallEdgeRuns(stage, floor)) {
      const len = run.to - run.from + t;
      const mid = (run.from + run.to) / 2;
      if (run.along === 'x') {
        made[floor].push(rectOf(mid, run.fixed + run.nz * t / 2, len, t, { kind: 'outer', floor }));
      } else {
        made[floor].push(rectOf(run.fixed + run.nx * t / 2, mid, t, len, { kind: 'outer', floor }));
      }
    }
  }
  frameCache.set(key, made);
  return made;
}

export function wallsForFloor(stage, floor) {
  const inner = floor === 1 ? stage.walls.f1 : stage.walls.f2;
  return frameWalls(stage)[floor].concat(inner);
}

export function stairsForFloor(stage, floor) {
  return stage.stairs.filter((s) => s.floor === floor);
}

export function warpsForFloor(stage, floor) {
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
  if (floor !== 1 && floor !== 2) return false;
  if (x < ARENA.minX || x > ARENA.maxX || z < ARENA.minZ || z > ARENA.maxZ) return false;
  // A body belongs to the hall it stands in, and only to that hall.
  if (!insideFloor(stage, floor, x, z)) return false;
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
 * actor radius fits at its centre. Stair zones and warp mouths become links, so
 * one BFS crosses floors exactly the way a player does.
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
        const idx = (floor - 1) * perFloor + iz * cols + ix;
        if (!isWalkable(stage, floor, x, z, radius)) blocked[idx] = 1;
      }
    }
  }
  const links = new Map();
  const addLink = (a, b) => {
    if (a < 0 || b < 0) return;
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
    addLink(cellOf(stair.floor, stair.x, stair.z), cellOf(stair.toFloor, stair.exitX, stair.exitZ));
  }
  for (const warp of stage.warps) {
    addLink(cellOf(warp.floor, warp.x, warp.z), cellOf(warp.floor, warp.toX, warp.toZ));
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
 * A random open metre on a floor. Each floor draws from its own hall rectangles,
 * so a wandering CPU never picks a square it cannot stand on. Returns null when
 * the floor has no room for the radius.
 */
export function randomPointOn(stage, floor, rng, radius = ACTOR.radius) {
  const rects = floorRects(stage, floor);
  if (!rects.length) return null;
  for (let i = 0; i < 80; i += 1) {
    const r = rects[Math.floor(rng() * rects.length)];
    const b = rectBounds(r);
    const inset = Math.max(1.2, radius + 0.6);
    const w = Math.max(0.2, b.x1 - b.x0 - inset * 2);
    const d = Math.max(0.2, b.z1 - b.z0 - inset * 2);
    const x = b.x0 + inset + rng() * w;
    const z = b.z0 + inset + rng() * d;
    if (isWalkable(stage, floor, x, z, radius)) return { x, z, floor };
  }
  return null;
}

/**
 * Nudge a spawn / switch candidate to the nearest open metre. Stages author
 * their inner walls freely; a generic spawn point therefore asks the geometry
 * where it can actually stand instead of trusting the coordinate.
 */
export function openSpotFor(stage, spot, radius = ACTOR.radius, maxPush = 4) {
  const floor = spot.floor;
  if (isWalkable(stage, floor, spot.x, spot.z, radius)) return { ...spot };
  for (let r = 0.5; r <= maxPush; r += 0.5) {
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * Math.PI * 2;
      const x = spot.x + Math.cos(a) * r;
      const z = spot.z + Math.sin(a) * r;
      if (isWalkable(stage, floor, x, z, radius)) return { ...spot, x, z };
    }
  }
  return { ...spot };
}

/** Nearest tall solid between two points, for the camera (render-side helper). */
export function segmentRectRange(ax, az, bx, bz, cx, cz, hw, hd) {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dz = bz - az;
  const p = [-dx, dx, -dz, dz];
  const q = [ax - (cx - hw), cx + hw - ax, az - (cz - hd), cz + hd - az];
  for (let i = 0; i < 4; i += 1) {
    if (Math.abs(p[i]) < 1e-9) {
      if (q[i] < 0) return null;
      continue;
    }
    const r = q[i] / p[i];
    if (p[i] < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }
  return t1 > t0 ? [t0, t1] : null;
}
