/**
 * Pure geometry for the two-storey ice arena.
 *
 * Build 37: the raised deck (2F) is no longer "everything east of x = 6". Every
 * stage owns a list of deck rectangles (`stage.deck`), so the 2F can be the east
 * half, a central island, a north balcony, an L, two bands or a ring. A point is
 * on floor 2 when it stands inside one of those rectangles.
 *
 * From that one piece of data this module derives the frame every stage shares:
 *   * the four outer walls on the ground floor,
 *   * the upper-floor outer walls, but only where a deck actually reaches the
 *     arena wall (so no wall floats over open ice),
 *   * the deck face — a tall cliff seen from 1F, a railing seen from 2F — along
 *     every deck edge that faces open air, cut at each stairwell,
 *   * the two-floor navigation grid the AI walks.
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
/* The deck (2F footprint)                                             */
/* ------------------------------------------------------------------ */

/** The deck rectangles a stage raises to 2F. */
export function deckRects(stage) {
  return stage.deck;
}

/** Is (x,z) inside the raised deck footprint? */
export function insideDeck(stage, x, z) {
  for (const r of stage.deck) {
    const b = rectBounds(r);
    if (x > b.x0 + EPS && x < b.x1 - EPS && z > b.z0 + EPS && z < b.z1 - EPS) return true;
  }
  return false;
}

/** Which floor a position stands on: 2F inside a deck, 1F everywhere else. */
export function floorAt(stage, x, z) {
  return insideDeck(stage, x, z) ? 2 : 1;
}

/** Which floor a SPOT claims, with its claim corrected by the deck. */
export function snapFloor(stage, spot) {
  return { ...spot, floor: floorAt(stage, spot.x, spot.z) };
}

export function deckFloorY(floor) {
  return floor === 2 ? ARENA.deckY : 0;
}

/** The bounding box of a stage's deck, and the middle of each floor. */
export function deckBounds(stage) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const r of stage.deck) {
    const b = rectBounds(r);
    x0 = Math.min(x0, b.x0);
    x1 = Math.max(x1, b.x1);
    z0 = Math.min(z0, b.z0);
    z1 = Math.max(z1, b.z1);
  }
  return { x0, x1, z0, z1 };
}

/** A readable middle point for a floor (the camera uses these). */
export function floorCenter(stage, floor) {
  if (floor === 2) {
    const b = deckBounds(stage);
    return { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2, y: ARENA.deckY };
  }
  // The ground floor is the arena minus the deck: use the open western part.
  const b = deckBounds(stage);
  const west = b.x0 - ARENA.minX;
  const x = west > 8 ? (ARENA.minX + b.x0) / 2 : (ARENA.minX + ARENA.maxX) / 2;
  return { x, z: 0, y: 0 };
}

/* ------------------------------------------------------------------ */
/* The shared frame                                                    */
/* ------------------------------------------------------------------ */

function sampleRuns(from, to, step, test) {
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

/** A stairwell cuts the deck face: is this edge point inside one? */
function inStairGap(stage, along, point, fixed) {
  for (const s of stage.stairs) {
    if (s.floor !== 1) continue;
    const horizontal = Math.abs(s.edgeX - s.footX) > Math.abs(s.edgeZ - s.footZ);
    if (horizontal && along === 'z') {
      if (Math.abs(point - s.edgeZ) <= s.w / 2 && Math.abs(fixed - s.edgeX) < 1.4) return true;
    }
    if (!horizontal && along === 'x') {
      if (Math.abs(point - s.edgeX) <= s.w / 2 && Math.abs(fixed - s.edgeZ) < 1.4) return true;
    }
  }
  return false;
}

/**
 * Every deck edge that faces open air, as runs. A run is where the deck ends and
 * the ice continues on the same floor edge, which is what gets a railing (2F)
 * and a cliff face (1F).
 */
function deckEdgeRuns(stage) {
  const runs = [];
  for (const r of stage.deck) {
    const b = rectBounds(r);
    const sides = [
      { along: 'x', fixed: b.z0, nx: 0, nz: -1, min: b.x0, max: b.x1 },
      { along: 'x', fixed: b.z1, nx: 0, nz: 1, min: b.x0, max: b.x1 },
      { along: 'z', fixed: b.x0, nx: -1, nz: 0, min: b.z0, max: b.z1 },
      { along: 'z', fixed: b.x1, nx: 1, nz: 0, min: b.z0, max: b.z1 },
    ];
    for (const side of sides) {
      const exposed = (u) => {
        if (inStairGap(stage, side.along, u, side.fixed)) return false;
        const px = side.along === 'x' ? u : side.fixed;
        const pz = side.along === 'x' ? side.fixed : u;
        const ox = px + side.nx * 0.4;
        const oz = pz + side.nz * 0.4;
        // On the arena boundary the outer wall takes over from the railing.
        if (ox <= ARENA.minX + 0.01 || ox >= ARENA.maxX - 0.01) return false;
        if (oz <= ARENA.minZ + 0.01 || oz >= ARENA.maxZ - 0.01) return false;
        return !insideDeck(stage, ox, oz);
      };
      for (const [from, to] of sampleRuns(side.min, side.max, 0.5, exposed)) {
        runs.push({ ...side, from, to });
      }
    }
  }
  return runs;
}

/** Lengths of arena wall that a deck actually reaches, per side. */
function outerTouches(stage) {
  const sides = [
    { id: 'north', along: 'x', fixed: ARENA.minZ, min: ARENA.minX, max: ARENA.maxX, test: (u) => insideDeck(stage, u, ARENA.minZ + 0.2) },
    { id: 'south', along: 'x', fixed: ARENA.maxZ, min: ARENA.minX, max: ARENA.maxX, test: (u) => insideDeck(stage, u, ARENA.maxZ - 0.2) },
    { id: 'west', along: 'z', fixed: ARENA.minX, min: ARENA.minZ, max: ARENA.maxZ, test: (u) => insideDeck(stage, ARENA.minX + 0.2, u) },
    { id: 'east', along: 'z', fixed: ARENA.maxX, min: ARENA.minZ, max: ARENA.maxZ, test: (u) => insideDeck(stage, ARENA.maxX - 0.2, u) },
  ];
  const out = [];
  for (const side of sides) {
    for (const [from, to] of sampleRuns(side.min, side.max, 0.5, side.test)) {
      out.push({ ...side, from, to });
    }
  }
  return out;
}

const frameCache = new Map();

export function frameWalls(stage) {
  const key = stage.id || 'custom';
  if (frameCache.has(key)) return frameCache.get(key);
  const t = ARENA.wallT;
  const { minX, maxX, minZ, maxZ } = ARENA;
  const midX = (minX + maxX) / 2;
  const midZ = (minZ + maxZ) / 2;
  const width = maxX - minX + t * 2;
  const depth = maxZ - minZ + t * 2;

  const f1 = [];
  const f2 = [];
  f1.push(rectOf(midX, minZ - t / 2, width, t, { kind: 'wall', floor: 1 }));
  f1.push(rectOf(midX, maxZ + t / 2, width, t, { kind: 'wall', floor: 1 }));
  f1.push(rectOf(minX - t / 2, midZ, t, depth, { kind: 'wall', floor: 1 }));
  f1.push(rectOf(maxX + t / 2, midZ, t, depth, { kind: 'wall', floor: 1 }));

  // 2F outer walls: only along wall the deck reaches, so nothing floats.
  for (const touch of outerTouches(stage)) {
    if (touch.along === 'x') {
      const z = touch.fixed === minZ ? minZ - t / 2 : maxZ + t / 2;
      f2.push(rectOf((touch.from + touch.to) / 2, z, touch.to - touch.from + t, t, { kind: 'wall', floor: 2 }));
    } else {
      const x = touch.fixed === minX ? minX - t / 2 : maxX + t / 2;
      f2.push(rectOf(x, (touch.from + touch.to) / 2, t, touch.to - touch.from + t, { kind: 'wall', floor: 2 }));
    }
  }

  // The deck face: cliff below, railing on top.
  for (const run of deckEdgeRuns(stage)) {
    const len = run.to - run.from;
    const mid = (run.from + run.to) / 2;
    // Both the cliff and the railing straddle the deck edge, so a body on
    // either floor keeps the same half-wall of clearance.
    if (run.along === 'x') {
      f1.push(rectOf(mid, run.fixed, len, t, { kind: 'cliff', floor: 1 }));
      f2.push(rectOf(mid, run.fixed, len, t, { kind: 'rail', floor: 2 }));
    } else {
      f1.push(rectOf(run.fixed, mid, t, len, { kind: 'cliff', floor: 1 }));
      f2.push(rectOf(run.fixed, mid, t, len, { kind: 'rail', floor: 2 }));
    }
  }

  const made = { f1, f2 };
  frameCache.set(key, made);
  return made;
}

export function wallsForFloor(stage, floor) {
  const inner = floor === 1 ? stage.walls.f1 : stage.walls.f2;
  const frame = floor === 1 ? frameWalls(stage).f1 : frameWalls(stage).f2;
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
  // A body belongs to the surface it stands on.
  if (floor === 2 && !insideDeck(stage, x, z)) return false;
  if (floor === 1 && insideDeck(stage, x, z)) return false;
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
        const idx = (floor - 1) * perFloor + iz * cols + ix;
        if (!isWalkable(stage, floor, x, z, radius)) blocked[idx] = 1;
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
 * A random open metre on a floor. Floor 2 draws from the deck rectangles, floor
 * 1 from the ice around them, so a wandering CPU never picks a deck square it
 * cannot stand on. Returns null when the floor has no room for the radius.
 */
export function randomPointOn(stage, floor, rng, radius = ACTOR.radius) {
  for (let i = 0; i < 80; i += 1) {
    let x;
    let z;
    if (floor === 2) {
      const r = stage.deck[Math.floor(rng() * stage.deck.length)];
      const b = rectBounds(r);
      const inset = Math.max(1.2, radius + 0.6);
      const w = Math.max(0.2, b.x1 - b.x0 - inset * 2);
      const d = Math.max(0.2, b.z1 - b.z0 - inset * 2);
      x = b.x0 + inset + rng() * w;
      z = b.z0 + inset + rng() * d;
    } else {
      x = ARENA.minX + 2.4 + rng() * (ARENA.maxX - ARENA.minX - 4.8);
      z = ARENA.minZ + 2.4 + rng() * (ARENA.maxZ - ARENA.minZ - 4.8);
    }
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
