/**
 * The six stages.
 *
 * Build 38: the floors are separate halls. Each stage declares two halls of its
 * own (48 x 40 m each, west = 1F, east = 2F) with a void between them, and
 * every objective is placed in one of them:
 *
 *   classic   an open rink on both floors, a few pillars and a centre block
 *   aquarium  a flooded ring around a central tank island
 *   park      a fairground of booths and the ferris wheel's long shadow
 *   lodge     a hearth hall with back rooms and a blizzard corridor
 *   school    two classroom bands per floor with a corridor between
 *   space     reactor and hull blocks around an open court
 *
 * A stair zone (階段) switches floors; a warp zone (ワープ) crosses its own floor.
 * The two are kept far apart on purpose (audit-stages.mjs enforces 12 m), and
 * their signs say which is which.
 *
 * All coordinates are metres, x east, z south.
 */
import { GIMMICK } from '../config.js';
import { rectOf, snapFloor, openSpotFor, floorCenter } from '../core/geometry.js';

const W = (x, z, w, d, kind = 'wall') => rectOf(x, z, w, d, { kind });
const D = (x, z, w, d) => rectOf(x, z, w, d);

/** The two halls are 48 x 40, centred on x = -28 (1F) and x = 28 (2F). */
export const HALL_CENTRE = { 1: -28, 2: 28 };
const hx = (floor, u) => HALL_CENTRE[floor] + u;

/** An inner wall authored in hall-local u (-24..24) and world z (-20..20). */
const HW = (floor, u, z, w, d) => W(hx(floor, u), z, w, d);

/** A point authored in hall-local u. */
const HP = (floor, u, z) => ({ x: hx(floor, u), z });

/** The hall footprint: one wide 48 x 40 rectangle per floor. */
const HALL_RECT = (floor) => [{ x: HALL_CENTRE[floor], z: 0, w: 48, d: 40 }];

/**
 * A stair pair: one mouth per floor. Stepping on a mouth carries the player to
 * a landing 2.6 m inside the other hall, so the mouth is never re-entered on
 * arrival. Two pairs per stage gives every stage two ways across.
 */
function stairLinks(pairs) {
  const out = [];
  let index = 0;
  for (const [a, b] of pairs) {
    const ax = hx(a.floor, a.u);
    const bx = hx(b.floor, b.u);
    const ca = floorCenter({ floors: HALLS_FOR_CENTRE }, a.floor);
    const cb = floorCenter({ floors: HALLS_FOR_CENTRE }, b.floor);
    const landingInto = (floor, x, z) => {
      const c = floor === a.floor ? ca : cb;
      const dx = c.x - x;
      const dz = c.z - z;
      const len = Math.hypot(dx, dz) || 1;
      return { x: x + (dx / len) * 2.6, z: z + (dz / len) * 2.6 };
    };
    const la = landingInto(a.floor, ax, a.z);
    const lb = landingInto(b.floor, bx, b.z);
    out.push(
      { id: `stair-${index}-down`, pair: index, floor: a.floor, x: ax, z: a.z, toFloor: b.floor, exitX: lb.x, exitZ: lb.z },
      { id: `stair-${index}-up`, pair: index, floor: b.floor, x: bx, z: b.z, toFloor: a.floor, exitX: la.x, exitZ: la.z },
    );
    index += 1;
  }
  return out;
}

/** Only used so floorCenter can run before a stage object exists. */
const HALLS_FOR_CENTRE = { 1: HALL_RECT(1), 2: HALL_RECT(2) };

/** A warp pair inside one floor: two mouths, one link, no floor change. */
function warpPair(floor, a, b) {
  const pa = HP(floor, a.u, a.z);
  const pb = HP(floor, b.u, b.z);
  const pair = floor;
  return [
    { id: `warp-${floor}-a`, pair, floor, x: pa.x, z: pa.z, toX: pb.x, toZ: pb.z },
    { id: `warp-${floor}-b`, pair, floor, x: pb.x, z: pb.z, toX: pa.x, toZ: pa.z },
  ];
}

/**
 * Spawn pool: open metres spread over both halls. The player's own spawn is
 * authored per stage; the CPUs take these in order.
 */
const SPAWN_POOL = [
  HP(1, -16, -14),
  HP(1, -16, 14),
  HP(1, -7, 6),
  HP(1, -7, -8),
  HP(1, 5, 10),
  HP(1, 6, -4),
  HP(1, 16, -16),
  HP(1, 17, 12),
  HP(2, -8, -6),
  HP(2, -7, 8),
  HP(2, -8, 2),
  HP(2, -6, -14),
  HP(2, 6, 12),
  HP(2, 15, -6),
];

const PALETTES = {
  classic: {
    sky: '#bfe6ff',
    fog: '#e6f6ff',
    fogNear: 34,
    fogFar: 120,
    floor: '#e9f7ff',
    deck: '#e4f5ff',
    wall: '#dff2ff',
    wallSide: '#b8dff5',
    cap: '#ffffff',
    accent: '#38c6f4',
    accent2: '#ffd166',
    sun: '#ffffff',
    hemiSky: '#eafaff',
    hemiGround: '#9cc2d8',
    exposure: 1.0,
    lift: 0.9,
  },
  aquarium: {
    sky: '#0d6f96',
    fog: '#1786ab',
    fogNear: 34,
    fogFar: 115,
    floor: '#6fd8e6',
    deck: '#63cbd9',
    wall: '#3aa8c4',
    wallSide: '#2b8ba8',
    cap: '#c6f7ff',
    accent: '#22e0d0',
    accent2: '#ffd166',
    sun: '#d9fbff',
    hemiSky: '#7fe6f2',
    hemiGround: '#0c4b66',
    exposure: 1.05,
    lift: 0.5,
  },
  park: {
    sky: '#5a3a8e',
    fog: '#7a55b4',
    fogNear: 34,
    fogFar: 118,
    floor: '#b98cf0',
    deck: '#ae80e8',
    wall: '#9a6ee0',
    wallSide: '#7d52c4',
    cap: '#ffd9f4',
    accent: '#ff5fa2',
    accent2: '#ffe066',
    sun: '#ffe3f6',
    hemiSky: '#d9b8ff',
    hemiGround: '#3a2160',
    exposure: 1.05,
    lift: 0.3,
  },
  lodge: {
    sky: '#7d9ab5',
    fog: '#dbe9f5',
    fogNear: 34,
    fogFar: 120,
    floor: '#f6e7cd',
    deck: '#efdfc2',
    wall: '#c98a5c',
    wallSide: '#a5683f',
    cap: '#ffffff',
    accent: '#ff9f43',
    accent2: '#ffe0a3',
    sun: '#fff1d8',
    hemiSky: '#ffeed6',
    hemiGround: '#8a6a4c',
    exposure: 1.02,
    lift: 0.26,
  },
  school: {
    sky: '#a8bfa0',
    fog: '#d7e4cf',
    fogNear: 34,
    fogFar: 118,
    floor: '#e9ddc2',
    deck: '#e2d5b8',
    wall: '#b9c79c',
    wallSide: '#93a477',
    cap: '#f4ffe4',
    accent: '#f5b93c',
    accent2: '#9be86b',
    sun: '#f8ffe9',
    hemiSky: '#eefadf',
    hemiGround: '#6b7a55',
    exposure: 1.02,
    lift: 0.32,
  },
  space: {
    sky: '#060b1c',
    fog: '#0d1636',
    fogNear: 38,
    fogFar: 130,
    floor: '#93a8d8',
    deck: '#8ba0d0',
    wall: '#5f74ab',
    wallSide: '#455581',
    cap: '#b9c9f2',
    accent: '#59e1ff',
    accent2: '#ffb347',
    sun: '#e6f1ff',
    hemiSky: '#8ea6e0',
    hemiGround: '#0a1024',
    exposure: 1.1,
    lift: 0.42,
  },
};

function stageDef(def) {
  const palette = PALETTES[def.id];
  const gimmick = def.gimmick ? def.gimmick() : null;
  const pending = {
    id: def.id,
    pro: def.pro,
    nameKey: `stage.${def.id}`,
    descKey: `stage.${def.id}.desc`,
    gimmickKey: def.gimmickKey || null,
    weather: def.weather,
    palette,
    floors: { 1: def.floors[1].map((r) => ({ ...r })), 2: def.floors[2].map((r) => ({ ...r })) },
    stairs: stairLinks(def.stairs),
    walls: { f1: def.f1, f2: def.f2 },
    props: def.props || [],
    warps: def.warps.flatMap(([floor, a, b]) => warpPair(floor, a, b)),
    switchSpots: [],
    gates: [],
    pads: [],
    spawns: [],
    playerSpawn: null,
    gimmick,
    shadows: def.shadows !== false,
    tex: {
      floor: `assets/floor_${def.tex || def.id}.png`,
      wall: `assets/wall_${def.tex || def.id}.png`,
      cap: `assets/cap_${def.tex || def.id}.png`,
    },
    ...def.extra,
  };
  // The floor of every authored point comes from the halls it stands in.
  pending.switchSpots = def.switchSpots.map((s) => openSpotFor(pending, snapFloor(pending, s), 1.2, 3));
  pending.spawns = SPAWN_POOL.map((s) => openSpotFor(pending, snapFloor(pending, s), 0.55, 4));
  pending.playerSpawn = openSpotFor(pending, snapFloor(pending, def.playerSpawn), 0.55, 4);
  pending.gates = def.gates.map((g, i) => ({ ...snapFloor(pending, g), id: i }));
  pending.pads = def.pads.map((p, i) => ({ ...snapFloor(pending, p), id: `pad-${i + 1}` }));
  pending.props = (def.props || []).map((p) => snapFloor(pending, p));
  return pending;
}

export const STAGE_IDS = ['classic', 'aquarium', 'park', 'lodge', 'school', 'space'];

export const STAGES = [
  /* ------------------------------------------------------------------ */
  stageDef({
    id: 'classic',
    pro: false,
    tex: 'classic',
    cap: 'classic',
    weather: 'snow',
    floors: { 1: HALL_RECT(1), 2: HALL_RECT(2) },
    stairs: [
      [{ floor: 1, u: 19, z: -15 }, { floor: 2, u: -19, z: -15 }],
      [{ floor: 1, u: 19, z: 15 }, { floor: 2, u: -19, z: 15 }],
    ],
    warps: [
      [1, { u: -13, z: -16 }, { u: 4, z: 10 }],
      [2, { u: -14, z: 4 }, { u: 16, z: -15 }],
    ],
    pads: [
      HP(1, -12, -12),
      HP(1, 12, 12),
      HP(2, -12, -12),
      HP(2, 12, 12),
    ],
    gates: [
      { ...HP(1, -23.2, 4), facing: 'west' },
      { ...HP(1, 6, 19.2), facing: 'south' },
      { ...HP(2, 23.2, -4), facing: 'east' },
    ],
    switchSpots: [
      HP(1, -22, -8), HP(1, -22, 12), HP(1, -15, 16), HP(1, -8, -2),
      HP(1, 0, 10), HP(1, 8, -8), HP(1, 14, 4),
      HP(2, -16, 10), HP(2, -12, -6), HP(2, -6, 12), HP(2, 2, -2),
      HP(2, 10, 8), HP(2, 17, -12),
    ],
    playerSpawn: HP(1, -18, -14),
    f1: [
      HW(1, -14, -9, 2, 2),
      HW(1, -14, 9, 2, 2),
      HW(1, 14, -9, 2, 2),
      HW(1, 14, 9, 2, 2),
      HW(1, 0, 0, 8, 3),
      HW(1, -19, -10, 1.2, 8),
      HW(1, -19, 10, 1.2, 8),
    ],
    f2: [
      HW(2, 14, -9, 2, 2),
      HW(2, 14, 9, 2, 2),
      HW(2, -14, -9, 2, 2),
      HW(2, -14, 9, 2, 2),
      HW(2, 0, 0, 8, 3),
      HW(2, 19, -10, 1.2, 8),
      HW(2, 19, 10, 1.2, 8),
    ],
    props: [
      { type: 'icicle', floor: 1, ...HP(1, -23, -19), n: 5 },
      { type: 'icicle', floor: 2, ...HP(2, 23, 19), n: 5 },
      { type: 'flag', floor: 1, ...HP(1, -23, 6) },
      { type: 'flag', floor: 2, ...HP(2, 23, -8) },
      { type: 'crystal', floor: 1, ...HP(1, -12, 0) },
      { type: 'crystal', floor: 2, ...HP(2, 12, 0) },
    ],
    gimmickKey: 'fx.gust',
    // Build 38: the classic rink is never quiet. Every 18 s a blizzard gust
    // sweeps the halls for four seconds: the ice drifts underfoot, the aurora
    // brightens, and the snow comes in sideways.
    gimmick: () => ({
      kind: 'classic',
      gusts: [
        { floor: 1, ...HP(1, -16, 0), w: 30, d: 38, dx: 0, dz: 1, power: 1.0 },
        { floor: 2, ...HP(2, 8, 0), w: 30, d: 38, dx: 0, dz: -1, power: 1.0 },
      ],
      cycle: { period: 18, length: 4.5, kind: 'gust' },
    }),
  }),

  /* ------------------------------------------------------------------ */
  stageDef({
    id: 'aquarium',
    pro: false,
    weather: 'bubble',
    floors: { 1: HALL_RECT(1), 2: HALL_RECT(2) },
    stairs: [
      [{ floor: 1, u: 18, z: -12 }, { floor: 2, u: -18, z: 12 }],
      [{ floor: 1, u: 18, z: 12 }, { floor: 2, u: -18, z: -12 }],
    ],
    warps: [
      [1, { u: -18, z: 10 }, { u: -2, z: -14 }],
      [2, { u: 12, z: -14 }, { u: 18, z: 6 }],
    ],
    pads: [
      HP(1, -12, -2),
      HP(1, 8, 0),
      HP(2, -14, 0),
      HP(2, 10, 8),
    ],
    gates: [
      { ...HP(1, -23.2, -2), facing: 'west' },
      { ...HP(1, -2, -19.2), facing: 'north' },
      { ...HP(2, 23.2, 4), facing: 'east' },
    ],
    switchSpots: [
      HP(1, -22, -14), HP(1, -22, -6), HP(1, -22, 8), HP(1, -15, -12),
      HP(1, -14, 12), HP(1, -6, -6), HP(1, 6, 14),
      HP(2, -18, 2), HP(2, -12, -10), HP(2, -8, 8), HP(2, 2, -4),
      HP(2, 10, 12), HP(2, 18, -6),
    ],
    playerSpawn: HP(1, -20, -14),
    f1: [
      // A tank island in the middle of a flooded ring.
      HW(1, 0, -6, 10, 1.2),
      HW(1, 0, 6, 10, 1.2),
      HW(1, -5, 0, 1.2, 6),
      HW(1, 5, 0, 1.2, 6),
      HW(1, -16, -8, 1.2, 7),
      HW(1, -16, 8, 1.2, 7),
      HW(1, -9, -14, 6, 1.2),
      HW(1, -9, 14, 6, 1.2),
      HW(1, 14, -16, 1.4, 1.4),
      HW(1, 14, 16, 1.4, 1.4),
    ],
    f2: [
      HW(2, 0, -6, 12, 1.2),
      HW(2, 0, 6, 12, 1.2),
      HW(2, -7, 0, 2, 6),
      HW(2, 7, 0, 2, 6),
      HW(2, 16, -10, 1.4, 1.4),
      HW(2, 16, 10, 1.4, 1.4),
      HW(2, -14, -16, 5, 1.2),
      HW(2, -14, 16, 5, 1.2),
    ],
    props: [
      { type: 'tank', floor: 1, ...HP(1, -23, -6) },
      { type: 'tank', floor: 1, ...HP(1, -23, 8) },
      { type: 'coral', floor: 2, ...HP(2, 16, -8) },
      { type: 'coral', floor: 1, ...HP(1, -6, -16) },
      { type: 'fish', floor: 2, ...HP(2, 8, 8) },
      { type: 'coral', floor: 2, ...HP(2, 16, 8) },
    ],
    gimmick: () => ({
      kind: 'aquarium',
      current: [
        { floor: 1, ...HP(1, -12, 0), w: 22, d: 5.5, dx: 1, dz: 0, power: GIMMICK.aquarium.currentPower },
        { floor: 2, ...HP(2, 12, 0), w: 22, d: 5.5, dx: -1, dz: 0, power: GIMMICK.aquarium.currentPower },
      ],
      cycle: { ...GIMMICK.aquarium, kind: 'manta' },
    }),
  }),

  /* ------------------------------------------------------------------ */
  stageDef({
    id: 'park',
    pro: true,
    weather: 'petal',
    floors: { 1: HALL_RECT(1), 2: HALL_RECT(2) },
    shadows: false,
    stairs: [
      [{ floor: 1, u: 19, z: -14 }, { floor: 2, u: -19, z: -14 }],
      [{ floor: 1, u: 19, z: 14 }, { floor: 2, u: -19, z: 14 }],
    ],
    warps: [
      [1, { u: -16, z: -10 }, { u: 6, z: 8 }],
      [2, { u: -10, z: 4 }, { u: 17, z: -10 }],
    ],
    pads: [
      HP(1, -14, 0),
      HP(1, 10, 14),
      HP(2, -16, -4),
      HP(2, 12, 14),
    ],
    gates: [
      { ...HP(1, -23.2, 10), facing: 'west' },
      { ...HP(1, 12, 19.2), facing: 'south' },
      { ...HP(2, 4, -19.2), facing: 'north' },
    ],
    switchSpots: [
      HP(1, -22, -4), HP(1, -22, 14), HP(1, -14, -14), HP(1, -8, 6),
      HP(1, -2, -2), HP(1, 8, -16), HP(1, 14, 0),
      HP(2, -20, 2), HP(2, -14, -8), HP(2, -4, 10), HP(2, 4, -8),
      HP(2, 12, 4), HP(2, 18, 16),
    ],
    playerSpawn: HP(1, -18, 12),
    f1: [
      HW(1, -16, -2, 6, 1.2),
      HW(1, -20, 4, 1.2, 6),
      HW(1, -4, 4, 1.2, 7),
      HW(1, 4, 12, 1.2, 5),
      HW(1, 11, -1, 1.2, 2),
      HW(1, 17, 8, 1.4, 1.4),
      HW(1, -10, -14, 6, 1.2),
    ],
    f2: [
      HW(2, -18, -10, 6, 1.2),
      HW(2, -6, -14, 1.2, 5),
      HW(2, 1, -9, 1.2, 4),
      HW(2, 8, -17, 4, 1.2),
      HW(2, 14, 8, 1.2, 6),
      HW(2, -21, 18, 4, 1.2),
    ],
    props: [
      { type: 'ferris', floor: 2, ...HP(2, -14, -15) },
      { type: 'tent', floor: 1, ...HP(1, -22, 2) },
      { type: 'tent', floor: 1, ...HP(1, -22, 12) },
      { type: 'balloon', floor: 2, ...HP(2, 6, -16) },
      { type: 'lights', floor: 1, ...HP(1, -8, 16) },
      { type: 'lights', floor: 2, ...HP(2, 14, -16) },
      { type: 'ferris', floor: 1, ...HP(1, -16, 16) },
    ],
    gimmick: () => ({
      kind: 'park',
      cycle: { ...GIMMICK.park, kind: 'parade' },
      spots: [
        { floor: 1, ...HP(1, -12, -2) },
        { floor: 1, ...HP(1, 2, 8) },
        { floor: 2, ...HP(2, -8, -12) },
        { floor: 2, ...HP(2, 10, -6) },
      ],
    }),
  }),

  /* ------------------------------------------------------------------ */
  stageDef({
    id: 'lodge',
    pro: true,
    weather: 'ember',
    floors: { 1: HALL_RECT(1), 2: HALL_RECT(2) },
    stairs: [
      [{ floor: 1, u: 19, z: -12 }, { floor: 2, u: -19, z: 12 }],
      [{ floor: 1, u: 19, z: 12 }, { floor: 2, u: -19, z: -12 }],
    ],
    warps: [
      [1, { u: -18, z: 12 }, { u: 2, z: -10 }],
      [2, { u: -8, z: 0 }, { u: 18, z: 10 }],
    ],
    pads: [
      HP(1, -14, 0),
      HP(1, 8, 10),
      HP(2, -12, -6),
      HP(2, 10, 6),
    ],
    gates: [
      { ...HP(1, -23.2, -8), facing: 'west' },
      { ...HP(1, 6, 19.2), facing: 'south' },
      { ...HP(2, 23.2, 8), facing: 'east' },
    ],
    switchSpots: [
      HP(1, -22, -16), HP(1, -22, 2), HP(1, -22, 14), HP(1, -14, -6),
      HP(1, -12, 8), HP(1, -2, -14), HP(1, 10, 16),
      HP(2, -20, 0), HP(2, -14, 8), HP(2, -8, -10), HP(2, 0, 4),
      HP(2, 8, -4), HP(2, 16, 12),
    ],
    playerSpawn: HP(1, -18, -14),
    f1: [
      HW(1, -19, 0, 4, 4),
      HW(1, -12, -9, 1.2, 9),
      HW(1, -12, 9, 1.2, 9),
      HW(1, -6, -15, 8, 1.2),
      HW(1, -6, 15, 8, 1.2),
      HW(1, 9, 6, 2, 2),
      HW(1, 14, 12, 2, 2),
      HW(1, 16, 3, 1.2, 2),
    ],
    f2: [
      HW(2, -12, -12, 1.2, 5),
      HW(2, -4, -4, 6, 1.2),
      HW(2, 4, -14, 1.2, 4),
      HW(2, 2, 4, 4, 1.2),
      HW(2, 12, 12, 1.2, 5),
      HW(2, -18, 16, 6, 1.2),
    ],
    props: [
      { type: 'hearth', floor: 1, ...HP(1, -22, 0) },
      { type: 'pine', floor: 1, ...HP(1, -16, 13) },
      { type: 'pine', floor: 1, ...HP(1, -6, -13) },
      { type: 'pine', floor: 1, ...HP(1, 16, 16) },
      { type: 'beam', floor: 2, ...HP(2, 6, -12) },
      { type: 'pine', floor: 2, ...HP(2, 18, -8) },
    ],
    gimmick: () => ({
      kind: 'lodge',
      slideZones: [
        { floor: 1, ...HP(1, -14, 10), w: 20, d: 5.0 },
        { floor: 2, ...HP(2, 8, 16), w: 14, d: 3.0 },
      ],
      cycle: { ...GIMMICK.lodge, kind: 'blizzard' },
    }),
  }),

  /* ------------------------------------------------------------------ */
  stageDef({
    id: 'school',
    pro: true,
    weather: 'dust',
    floors: { 1: HALL_RECT(1), 2: HALL_RECT(2) },
    stairs: [
      [{ floor: 1, u: 19, z: 0 }, { floor: 2, u: -19, z: 0 }],
      [{ floor: 1, u: 19, z: 14 }, { floor: 2, u: -19, z: -14 }],
    ],
    warps: [
      [1, { u: -20, z: -14 }, { u: 2, z: 12 }],
      [2, { u: -8, z: 10 }, { u: 18, z: -12 }],
    ],
    pads: [
      HP(1, -14, 0),
      HP(1, 10, 0),
      HP(2, -14, 0),
      HP(2, 10, 0),
    ],
    gates: [
      { ...HP(1, -23.2, 0), facing: 'west' },
      { ...HP(1, -10, 19.2), facing: 'south' },
      { ...HP(2, 4, -19.2), facing: 'north' },
    ],
    switchSpots: [
      HP(1, -22, -8), HP(1, -22, -16), HP(1, -22, 8), HP(1, -14, -8),
      HP(1, -6, -6), HP(1, -6, 10), HP(1, 6, 12),
      HP(2, -20, -6), HP(2, -16, 12), HP(2, -8, 4), HP(2, 0, -10),
      HP(2, 8, 8), HP(2, 18, 0),
    ],
    playerSpawn: HP(1, -20, -14),
    f1: [
      HW(1, -17, -9, 1, 7),
      HW(1, -17, 9, 1, 7),
      HW(1, -10, -13, 7, 1),
      HW(1, -10, 13, 7, 1),
      HW(1, -13, -5.5, 4, 1),
      HW(1, -13, 5.5, 4, 1),
      HW(1, -3, -9, 1, 8),
      HW(1, -3, 9, 1, 8),
      HW(1, 0, -16, 1.2, 4),
      HW(1, 0, 16, 1.2, 4),
      HW(1, 6, 5, 1.2, 3),
      HW(1, 6, -5, 1.2, 3),
    ],
    f2: [
      HW(2, -12, -13, 1.2, 6),
      HW(2, -5, -6, 4, 1.2),
      HW(2, -15, -6, 3, 1.2),
      HW(2, -12, 13, 1.2, 6),
      HW(2, -5, 6, 4, 1.2),
      HW(2, -15, 6, 3, 1.2),
      HW(2, -4.5, 0, 3, 1.2),
      HW(2, 8, -10, 6, 1.2),
      HW(2, 14, 10, 6, 1.2),
    ],
    props: [
      { type: 'desk', floor: 1, ...HP(1, -16, -8) },
      { type: 'desk', floor: 1, ...HP(1, -11, -8) },
      { type: 'board', floor: 1, ...HP(1, -13, -10) },
      { type: 'clock', floor: 2, ...HP(2, 22, -8) },
      { type: 'desk', floor: 2, ...HP(2, -10, -6) },
      { type: 'board', floor: 2, ...HP(2, -10, 6) },
      { type: 'desk', floor: 2, ...HP(2, 9, 12) },
    ],
    gimmick: () => ({
      kind: 'school',
      doors: [
        { floor: 1, ...HP(1, 2, 0), w: 10.0, d: 1.0 },
        { floor: 2, ...HP(2, 18, -9.5), w: 7.0, d: 1.0 },
      ],
      cycle: { ...GIMMICK.school, kind: 'school' },
    }),
  }),

  /* ------------------------------------------------------------------ */
  stageDef({
    id: 'space',
    pro: true,
    weather: 'stars',
    floors: { 1: HALL_RECT(1), 2: HALL_RECT(2) },
    stairs: [
      [{ floor: 1, u: 19, z: -14 }, { floor: 2, u: -14, z: -14 }],
      [{ floor: 1, u: 19, z: 12 }, { floor: 2, u: -14, z: 12 }],
    ],
    warps: [
      [1, { u: -16, z: 8 }, { u: 4, z: -10 }],
      [2, { u: -10, z: -2 }, { u: 16, z: -6 }],
    ],
    pads: [
      HP(1, -14, 0),
      HP(1, 8, 4),
      HP(2, -14, 4),
      HP(2, 14, 10),
    ],
    gates: [
      { ...HP(1, -23.2, -4), facing: 'west' },
      { ...HP(1, -6, -19.2), facing: 'north' },
      { ...HP(2, 23.2, 4), facing: 'east' },
    ],
    switchSpots: [
      HP(1, -22, -14), HP(1, -22, 4), HP(1, -22, 14), HP(1, -14, -10),
      HP(1, -12, 12), HP(1, -4, 6), HP(1, 8, 12),
      HP(2, -20, 0), HP(2, -12, -12), HP(2, -6, 8), HP(2, 2, 2),
      HP(2, 10, -12), HP(2, 18, 14),
    ],
    playerSpawn: HP(1, -20, -12),
    f1: [
      HW(1, -19, -6, 6, 1.2),
      HW(1, -19, 6, 6, 1.2),
      HW(1, -12, -8, 1.2, 5),
      HW(1, -11, 12, 1.2, 4),
      HW(1, -6, 0, 4, 4),
      HW(1, 0, -10, 1.2, 5),
      HW(1, 0, 10, 1.2, 5),
      HW(1, 8, 8, 3, 1.2),
      HW(1, 8, -8, 3, 1.2),
    ],
    f2: [
      HW(2, -18, -14, 1.2, 6),
      HW(2, -18, 14, 1.2, 6),
      HW(2, -7, 9, 4, 1.2),
      HW(2, -7, -9, 4, 1.2),
      HW(2, 10, 0, 4, 4),
      HW(2, 2, 14, 6, 1.2),
    ],
    props: [
      { type: 'reactor', floor: 1, ...HP(1, -22, 0) },
      { type: 'holo', floor: 2, ...HP(2, 18, 12) },
      { type: 'hull', floor: 1, ...HP(1, -2, -17) },
      { type: 'hull', floor: 2, ...HP(2, 14, -18) },
      { type: 'reactor', floor: 2, ...HP(2, 20, -6) },
      { type: 'holo', floor: 1, ...HP(1, -9, 16) },
    ],
    gimmick: () => ({
      kind: 'space',
      lowGravity: [
        { floor: 1, ...HP(1, -12, 16), w: 20, d: 4.0 },
        { floor: 2, ...HP(2, 10, -16), w: 24, d: 4.0 },
      ],
      cycle: { ...GIMMICK.space, kind: 'gravity' },
    }),
  }),
];

export const STAGE_BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s]));

export function stageById(id) {
  return STAGE_BY_ID[id] || STAGES[0];
}

export function isProStage(id) {
  return Boolean(stageById(id).pro);
}

/**
 * Which switch candidates this stage keeps clear. The stage author keeps every
 * candidate at least 1.2 m off a wall; the test enforces it for all six stages
 * so a switch can never be inside geometry.
 */
export function switchSpotsFor(stage) {
  return stage.switchSpots;
}

/** The two hall rectangles of a stage (used by render and by the audit). */
export function hallsOf(stage) {
  return stage.floors;
}

export { D, W };
