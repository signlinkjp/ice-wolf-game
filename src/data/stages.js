/**
 * The six stages.
 *
 * Build 37: the raised deck is per stage. Each stage declares its own deck
 * rectangles, and geometry.js derives the cliff, railings, upper outer walls
 * and stairwells from them. That is what makes the six arenas play differently:
 *
 *   classic   east half       — the original wide rink with a two-end corridor
 *   aquarium  central island  — climb up from either side of a moat
 *   park      north balcony   — one long parade deck along the north wall
 *   lodge     L shape         — a big room and an annex down the east side
 *   school    two bands       — decks north and south of a central corridor
 *   space     ring            — north band, south band and an east spine
 *
 * Only the inner walls, the palette, the props and the gimmick change on top of
 * that. All coordinates are metres, x east, z south, floors 1 (ice) and 2 (deck).
 */
import { ARENA, GIMMICK } from '../config.js';
import { rectOf, snapFloor, openSpotFor } from '../core/geometry.js';

const W = (x, z, w, d, kind = 'wall') => rectOf(x, z, w, d, { kind });
const D = (x, z, w, d) => rectOf(x, z, w, d);

/**
 * One staircase, declared by the point where it meets the deck edge and the
 * direction it climbs. Everything else (foot trigger, landing trigger, the
 * flight the renderer draws, the gap it cuts in the railing) is derived.
 */
function stairLinks(dir, edgeX, edgeZ, w = 4.0) {
  const sign = dir === 'E' ? [1, 0] : dir === 'W' ? [-1, 0] : dir === 'N' ? [0, -1] : [0, 1];
  const footX = edgeX - sign[0] * 1.2;
  const footZ = edgeZ - sign[1] * 1.2;
  const toX = edgeX + sign[0] * 1.6;
  const toZ = edgeZ + sign[1] * 1.6;
  const exitX = footX - sign[0] * 1.8;
  const exitZ = footZ - sign[1] * 1.8;
  const shared = { dir, w, edgeX, edgeZ, footX, footZ, toX, toZ, downX: exitX, downZ: exitZ };
  return [
    { id: `up-${edgeX}-${edgeZ}`, floor: 1, x: footX, z: footZ, r: 1.5, toFloor: 2, exitX: toX, exitZ: toZ, ...shared },
    { id: `dn-${edgeX}-${edgeZ}`, floor: 2, x: toX, z: toZ, r: 1.5, toFloor: 1, exitX, exitZ: exitZ, ...shared },
  ];
}

/** Warp pair: two mouths on opposite floors, one link between them. */
function warps(a, b) {
  return [
    { id: 'warp-a', pair: 0, floor: 1, x: a.x, z: a.z, toX: b.x, toZ: b.z, toFloor: 2 },
    { id: 'warp-b', pair: 0, floor: 2, x: b.x, z: b.z, toX: a.x, toZ: a.z, toFloor: 1 },
  ];
}

/**
 * Spawn pool, shared: the stage's deck decides which floor each point ends up
 * on, and openSpotFor pushes one that lands in a wall to the nearest ice.
 */
const SPAWN_POOL = [
  { x: -20, z: -12 },
  { x: -20, z: 11 },
  { x: -14, z: 6 },
  { x: -14, z: -8 },
  { x: -7.5, z: 10.5 },
  { x: -8, z: -11 },
  { x: -2, z: 6 },
  { x: -3, z: -4 },
  { x: 11, z: 10 },
  { x: 11, z: -10 },
  { x: 16, z: 4 },
  { x: 16, z: -4 },
  { x: 20, z: 12 },
  { x: 20, z: -12 },
];

const PALETTES = {
  classic: {
    sky: '#bfe6ff',
    fog: '#e6f6ff',
    fogNear: 30,
    fogFar: 95,
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
    fogNear: 30,
    fogFar: 90,
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
    fogNear: 30,
    fogFar: 92,
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
    fogNear: 30,
    fogFar: 95,
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
    fogNear: 30,
    fogFar: 92,
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
    fogNear: 34,
    fogFar: 100,
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
  const deck = def.deck.map((r) => ({ ...r }));
  const stairs = def.stairs.flatMap(([dir, x, z, w]) => stairLinks(dir, x, z, w));
  const pending = {
    id: def.id,
    pro: def.pro,
    nameKey: `stage.${def.id}`,
    descKey: `stage.${def.id}.desc`,
    gimmickKey: def.gimmickKey || null,
    weather: def.weather,
    palette,
    deck,
    stairs,
    walls: { f1: def.f1, f2: def.f2 },
    props: def.props || [],
    warps: warps(def.warp[0], def.warp[1]),
    switchSpots: [],
    gates: def.gates.map((g, i) => ({ id: i, ...g })),
    pads: def.pads.map((p, i) => ({ id: `pad-${i + 1}`, ...p })),
    spawns: [],
    playerSpawn: snapFloor({ deck }, { ...def.playerSpawn }),
    gimmick,
    // Build 37: the amusement park turns the sun's cast shadows off. Its ice is
    // lit by the strings of lights, and a long black-purple shadow across the
    // purple rink read as a bug rather than as night.
    shadows: def.shadows !== false,
    // Textures the GDevelop build drew by hand, reused as the Three.js surfaces.
    tex: {
      floor: `assets/floor_${def.tex || def.id}.png`,
      wall: `assets/wall_${def.tex || def.id}.png`,
      cap: `assets/cap_${def.cap || def.id}.png`,
    },
    ...def.extra,
  };

  // Floors come from the deck, not from a label: a spawn or switch written for
  // the old "east half" layout still lands on the surface it actually stands on.
  pending.switchSpots = def.switchSpots.map((s) => openSpotFor(pending, snapFloor(pending, s), 1.2, 3));
  pending.spawns = SPAWN_POOL.map((s) => openSpotFor(pending, snapFloor(pending, s), 0.55, 4));
  pending.playerSpawn = openSpotFor(pending, pending.playerSpawn, 0.55, 4);
  return pending;
}

export const STAGE_IDS = ['classic', 'aquarium', 'park', 'lodge', 'school', 'space'];

export const STAGES = [
  stageDef({
    id: 'classic',
    pro: false,
    tex: 'classic',
    cap: 'classic',
    weather: 'snow',
    // The 1.0.0 arena, whole: the east half raised as a corridor, two
    // stairwells at its ends, and the warp from the south ice to the north deck.
    deck: [D(15, 0, 18, 36)],
    stairs: [
      ['E', 6, -11.5, 4.2],
      ['E', 6, 10, 4.2],
    ],
    warp: [
      { x: 3.5, z: 12 },
      { x: 21, z: 14 },
    ],
    pads: [
      { floor: 1, x: -14, z: -2 },
      { floor: 1, x: -5, z: 8 },
      { floor: 2, x: 11, z: 3 },
      { floor: 2, x: 22, z: -4 },
    ],
    gates: [
      { floor: 1, x: -22.9, z: 0, facing: 'west' },
      { floor: 1, x: 0, z: -16.6, facing: 'north' },
      { floor: 2, x: 22.2, z: 0, facing: 'east' },
    ],
    switchSpots: [
      { x: -22.5, z: -16, floor: 1 },
      { x: -22.5, z: -4, floor: 1 },
      { x: -22.5, z: 8, floor: 1 },
      { x: -15, z: 2, floor: 1 },
      { x: -9, z: 8, floor: 1 },
      { x: -6, z: -11.5, floor: 1 },
      { x: 3, z: -14.5, floor: 1 },
      { x: 3, z: 9.5, floor: 1 },
      { x: 9, z: -16, floor: 2 },
      { x: 10.5, z: -4, floor: 2 },
      { x: 12, z: 12.5, floor: 2 },
      { x: 18, z: 6.5, floor: 2 },
      { x: 19.5, z: -7, floor: 2 },
    ],
    playerSpawn: { x: -20, z: -12 },
    f1: [
      W(-16, -6, 1.4, 1.4),
      W(-16, 6, 1.4, 1.4),
      W(-9, -12, 1.4, 1.4),
      W(-9, 12, 1.4, 1.4),
      W(-4, 0, 5.0, 2.4),
      W(-17, 0, 1.2, 5.0),
    ],
    f2: [
      W(12, -6, 1.4, 1.4),
      W(12, 6, 1.4, 1.4),
      W(17.5, 0, 2.2, 7.0),
      W(20, -12, 1.4, 1.4),
    ],
    props: [
      { type: 'icicle', floor: 1, x: -23, z: -17, n: 5 },
      { type: 'icicle', floor: 2, x: 23, z: 17, n: 5 },
      { type: 'flag', floor: 1, x: -23, z: 6 },
      { type: 'flag', floor: 2, x: 23, z: -8 },
      { type: 'crystal', floor: 1, x: -12, z: 0 },
    ],
    gimmickKey: null,
    gimmick: null,
  }),

  stageDef({
    id: 'aquarium',
    pro: false,
    weather: 'bubble',
    // A central island: a moat of ice runs all the way round it, and the two
    // stairwells climb onto opposite sides, so you circle the tank to regroup.
    deck: [D(10, 0, 16, 20)],
    stairs: [
      ['E', 2, -5, 4.0],
      ['W', 18, 5, 4.0],
    ],
    warp: [
      { x: -12, z: 16.5 },
      { x: 8, z: -3 },
    ],
    pads: [
      { floor: 1, x: -14, z: -2 },
      { floor: 1, x: 21, z: 0 },
      { floor: 2, x: 6, z: -3 },
      { floor: 2, x: 15, z: 8 },
    ],
    gates: [
      { floor: 1, x: -22.9, z: -2, facing: 'west' },
      { floor: 1, x: 0, z: -16.6, facing: 'north' },
      { floor: 2, x: 16.6, z: 0, facing: 'east' },
    ],
    switchSpots: [
      { x: -22.5, z: -14, floor: 1 },
      { x: -22.5, z: -8, floor: 1 },
      { x: -22.5, z: 6, floor: 1 },
      { x: -14, z: 4, floor: 1 },
      { x: -6, z: -6, floor: 1 },
      { x: -6, z: 10, floor: 1 },
      { x: 0, z: -14, floor: 1 },
      { x: 21, z: -4, floor: 1 },
      { x: 21, z: 7, floor: 1 },
      { x: 5, z: -8, floor: 2 },
      { x: 5, z: 8, floor: 2 },
      { x: 10, z: 0, floor: 2 },
      { x: 16, z: -8, floor: 2 },
      { x: 16, z: 8, floor: 2 },
    ],
    playerSpawn: { x: -20, z: -12 },
    f1: [
      W(-18, -8, 1.2, 7.0),
      W(-18, 8, 1.2, 7.0),
      W(-11, -13, 6.0, 1.2),
      W(-11, 13, 6.0, 1.2),
      W(-7, 0, 3.0, 1.2),
      W(-1, -8, 1.2, 4.0),
      W(21, -9, 1.4, 1.4),
      W(21, 9, 1.4, 1.4),
    ],
    f2: [
      W(9, -6, 6.0, 1.2),
      W(9, 6, 6.0, 1.2),
      W(13, 0, 2.0, 5.0),
      W(5, 0, 1.2, 4.0),
    ],
    props: [
      { type: 'tank', floor: 1, x: -23.6, z: -6 },
      { type: 'tank', floor: 1, x: -23.6, z: 8 },
      { type: 'coral', floor: 2, x: 16, z: -8 },
      { type: 'coral', floor: 1, x: -6, z: -16 },
      { type: 'fish', floor: 2, x: 8, z: 8 },
      { type: 'coral', floor: 2, x: 16, z: 8 },
    ],
    gimmick: () => ({
      kind: 'aquarium',
      current: [
        { floor: 1, x: -12, z: 0, w: 22, d: 5.5, dx: 1, dz: 0, power: GIMMICK.aquarium.currentPower },
        { floor: 2, x: 10, z: 0, w: 14, d: 5.5, dx: -1, dz: 0, power: GIMMICK.aquarium.currentPower },
      ],
      cycle: { ...GIMMICK.aquarium, kind: 'manta' },
    }),
  }),

  stageDef({
    id: 'park',
    pro: true,
    weather: 'petal',
    // A parade balcony over the north wall: the whole upper floor is one long
    // deck you can see the fairground from, and two stairwells open onto it.
    deck: [D(4, -12, 40, 12)],
    shadows: false,
    stairs: [
      ['N', -6, -6, 4.2],
      ['N', 13, -6, 4.2],
    ],
    warp: [
      { x: 16, z: 14 },
      { x: 20, z: -14 },
    ],
    pads: [
      { floor: 1, x: -14, z: 6 },
      { floor: 1, x: 8, z: 10 },
      { floor: 2, x: -8, z: -14 },
      { floor: 2, x: 17, z: -15 },
    ],
    gates: [
      { floor: 1, x: -22.9, z: 4, facing: 'west' },
      { floor: 1, x: 0, z: 16.6, facing: 'south' },
      { floor: 2, x: 22.2, z: -12, facing: 'east' },
    ],
    switchSpots: [
      { x: -22.5, z: -4, floor: 1 },
      { x: -22.5, z: 8, floor: 1 },
      { x: -22.5, z: 15, floor: 1 },
      { x: -18, z: 2, floor: 1 },
      { x: -9, z: 4, floor: 1 },
      { x: -2, z: 12, floor: 1 },
      { x: 6, z: 2, floor: 1 },
      { x: 14, z: 9, floor: 1 },
      { x: 21, z: 12, floor: 1 },
      { x: -12, z: -12, floor: 2 },
      { x: -4, z: -9, floor: 2 },
      { x: 5, z: -14, floor: 2 },
      { x: 11, z: -12, floor: 2 },
      { x: 19, z: -8, floor: 2 },
      { x: 22, z: -15, floor: 2 },
    ],
    playerSpawn: { x: -20, z: 12 },
    f1: [
      W(-20, 2, 1.2, 6.0),
      W(-13, -2, 6.0, 1.2),
      W(-2, 4, 1.2, 7.0),
      W(6, 12, 1.2, 5.0),
      W(13, -1, 1.2, 2.0),
      W(19, 8, 1.4, 1.4),
    ],
    f2: [
      W(-10, -10, 6.0, 1.2),
      W(2, -14, 1.2, 5.0),
      W(9, -9, 1.2, 4.0),
      W(18, -11, 4.0, 1.2),
    ],
    props: [
      { type: 'ferris', floor: 2, x: -12, z: -14 },
      { type: 'tent', floor: 1, x: -22, z: 2 },
      { type: 'tent', floor: 1, x: -22, z: 11 },
      { type: 'balloon', floor: 2, x: 6, z: -16 },
      { type: 'lights', floor: 1, x: -8, z: 16 },
      { type: 'lights', floor: 2, x: 14, z: -16 },
    ],
    gimmick: () => ({
      kind: 'park',
      cycle: { ...GIMMICK.park, kind: 'parade' },
      spots: [
        { floor: 1, x: -12, z: -2 },
        { floor: 1, x: -4, z: 10 },
        { floor: 2, x: 10, z: -12 },
        { floor: 2, x: 18, z: -10 },
      ],
    }),
  }),

  stageDef({
    id: 'lodge',
    pro: true,
    weather: 'ember',
    // An L: the big room over the north-east, and an annex down the east side.
    // The annex stair is far from the main stair, so the two floors cross twice.
    deck: [D(12, -8, 24, 20), D(18, 8, 12, 12)],
    stairs: [
      ['E', 0, -12, 4.0],
      ['E', 12, 8, 4.0],
    ],
    warp: [
      { x: -18, z: 16 },
      { x: 15, z: -14 },
    ],
    pads: [
      { floor: 1, x: -14, z: 0 },
      { floor: 1, x: 6, z: 10 },
      { floor: 2, x: 6, z: -6 },
      { floor: 2, x: 20, z: 9 },
    ],
    gates: [
      { floor: 1, x: -22.9, z: -6, facing: 'west' },
      { floor: 1, x: 6, z: 16.6, facing: 'south' },
      { floor: 2, x: 22.2, z: -6, facing: 'east' },
    ],
    switchSpots: [
      { x: -22.5, z: -14, floor: 1 },
      { x: -22.5, z: 0, floor: 1 },
      { x: -22.5, z: 12, floor: 1 },
      { x: -16, z: 8, floor: 1 },
      { x: -8, z: -6, floor: 1 },
      { x: -8, z: 12, floor: 1 },
      { x: 2, z: 12, floor: 1 },
      { x: 10, z: 16, floor: 1 },
      { x: 21, z: 16, floor: 1 },
      { x: 3, z: -6, floor: 2 },
      { x: 8, z: -14, floor: 2 },
      { x: 15, z: -8, floor: 2 },
      { x: 21, z: -10, floor: 2 },
      { x: 16, z: 6, floor: 2 },
      { x: 22, z: 11, floor: 2 },
    ],
    playerSpawn: { x: -18, z: -14 },
    f1: [
      W(-19, 0, 4.0, 4.0),
      W(-12, -9, 1.2, 9.0),
      W(-12, 9, 1.2, 9.0),
      W(-6, -15, 8.0, 1.2),
      W(-6, 15, 8.0, 1.2),
      W(3, 6, 2.0, 2.0),
      W(8, 12, 2.0, 2.0),
      W(20, 3, 1.2, 2.0),
    ],
    f2: [
      W(4, -12, 1.2, 5.0),
      W(12, -4, 6.0, 1.2),
      W(20, -14, 1.2, 4.0),
      W(19, 4, 4.0, 1.2),
    ],
    props: [
      { type: 'hearth', floor: 1, x: -21, z: 0 },
      { type: 'pine', floor: 1, x: -16, z: 13 },
      { type: 'pine', floor: 1, x: -6, z: -13 },
      { type: 'pine', floor: 1, x: 20, z: 16 },
      { type: 'beam', floor: 2, x: 6, z: -12 },
      { type: 'pine', floor: 2, x: 22, z: -8 },
    ],
    gimmick: () => ({
      kind: 'lodge',
      slideZones: [
        { floor: 1, x: -13, z: 10, w: 20, d: 5.0 },
        { floor: 1, x: 6, z: 16.5, w: 10, d: 2.6 },
      ],
      cycle: { ...GIMMICK.lodge, kind: 'blizzard' },
    }),
  }),

  stageDef({
    id: 'school',
    pro: true,
    weather: 'dust',
    // Two bands of classrooms with a central corridor between them: the corridor
    // is the only way east on the ground floor, and both stairwells rise from it.
    deck: [D(15, -9.5, 18, 15), D(15, 9.5, 18, 15)],
    stairs: [
      ['N', 10, -2, 3.6],
      ['S', 16, 2, 3.6],
    ],
    warp: [
      { x: -16, z: 0 },
      { x: 21, z: 13 },
    ],
    pads: [
      { floor: 1, x: -14, z: 0 },
      { floor: 1, x: 22, z: 0 },
      { floor: 2, x: 10, z: -12 },
      { floor: 2, x: 10, z: 12 },
    ],
    gates: [
      { floor: 1, x: -22.9, z: 0, facing: 'west' },
      { floor: 1, x: -10, z: 16.6, facing: 'south' },
      { floor: 2, x: 22.2, z: -14, facing: 'east' },
    ],
    switchSpots: [
      { x: -22.5, z: -6, floor: 1 },
      { x: -22.5, z: -14, floor: 1 },
      { x: -22.5, z: 8, floor: 1 },
      { x: -14, z: -8, floor: 1 },
      { x: -8, z: -6, floor: 1 },
      { x: -14, z: 10, floor: 1 },
      { x: -6, z: 0, floor: 1 },
      { x: 12, z: 0, floor: 1 },
      { x: 21, z: 0, floor: 1 },
      { x: 9, z: -14, floor: 2 },
      { x: 14, z: -14, floor: 2 },
      { x: 20, z: -8, floor: 2 },
      { x: 9, z: 14, floor: 2 },
      { x: 15, z: 9, floor: 2 },
      { x: 20, z: 12, floor: 2 },
    ],
    playerSpawn: { x: -20, z: -14 },
    f1: [
      // Classrooms north and south of the corridor, each with a way through.
      W(-17, -9, 1.0, 7.0),
      W(-17, 9, 1.0, 7.0),
      W(-10, -13, 7.0, 1.0),
      W(-10, 13, 7.0, 1.0),
      W(-13, -5.5, 4.0, 1.0),
      W(-13, 5.5, 4.0, 1.0),
      W(-3, -9, 1.0, 8.0),
      W(-3, 9, 1.0, 8.0),
      W(0, -16, 1.2, 4.0),
      W(0, 16, 1.2, 4.0),
      W(6, 5, 1.2, 3.0),
      W(6, -5, 1.2, 3.0),
    ],
    f2: [
      W(12, -13, 1.2, 6.0),
      W(19, -6, 4.0, 1.2),
      W(9, -6, 3.0, 1.2),
      W(12, 13, 1.2, 6.0),
      W(19, 6, 4.0, 1.2),
      W(9, 6, 3.0, 1.2),
      W(19.5, 0, 3.0, 1.2),
    ],
    props: [
      { type: 'desk', floor: 1, x: -16, z: -8 },
      { type: 'desk', floor: 1, x: -11, z: -8 },
      { type: 'board', floor: 1, x: -13, z: -10 },
      { type: 'clock', floor: 2, x: 22.5, z: -8 },
      { type: 'desk', floor: 2, x: 10, z: -6 },
      { type: 'board', floor: 2, x: 10, z: 6 },
    ],
    gimmick: () => ({
      kind: 'school',
      doors: [
        { floor: 1, x: 2, z: 0, w: 10.0, d: 1.0 },
        { floor: 2, x: 20, z: -9.5, w: 7.0, d: 1.0 },
      ],
      cycle: { ...GIMMICK.school, kind: 'school' },
    }),
  }),

  stageDef({
    id: 'space',
    pro: true,
    weather: 'stars',
    // A ring: a north band, a south band and an east spine joining them. Two
    // ramps climb outward from the central court, and the warp crosses the ring.
    deck: [D(15, -14, 18, 8), D(15, 14, 18, 8), D(21, 0, 6, 28)],
    stairs: [
      ['N', 12, -10, 3.6],
      ['S', 12, 10, 3.6],
    ],
    warp: [
      { x: -10, z: 0 },
      { x: 21, z: 0 },
    ],
    pads: [
      { floor: 1, x: -14, z: 0 },
      { floor: 1, x: 10, z: 4 },
      { floor: 2, x: 21, z: 6 },
      { floor: 2, x: 16, z: -16 },
    ],
    gates: [
      { floor: 1, x: -22.9, z: -2, facing: 'west' },
      { floor: 1, x: -6, z: -16.6, facing: 'north' },
      { floor: 2, x: 22.2, z: 0, facing: 'east' },
    ],
    switchSpots: [
      { x: -22.5, z: -14, floor: 1 },
      { x: -22.5, z: 4, floor: 1 },
      { x: -22.5, z: 14, floor: 1 },
      { x: -14, z: 4, floor: 1 },
      { x: -8, z: -4, floor: 1 },
      { x: -6, z: 12, floor: 1 },
      { x: 4, z: -4, floor: 1 },
      { x: 12, z: 4, floor: 1 },
      { x: 4, z: 12, floor: 1 },
      { x: 10, z: -12, floor: 2 },
      { x: 15, z: -12, floor: 2 },
      { x: 21, z: 4, floor: 2 },
      { x: 21, z: -4, floor: 2 },
      { x: 15, z: 12, floor: 2 },
      { x: 10, z: 16, floor: 2 },
    ],
    playerSpawn: { x: -20, z: -12 },
    f1: [
      W(-19, -6, 6.0, 1.2),
      W(-19, 6, 6.0, 1.2),
      W(-12, -8, 1.2, 5.0),
      W(-11, 12, 1.2, 4.0),
      W(-6, 0, 4.0, 4.0),
      W(0, -10, 1.2, 5.0),
      W(0, 10, 1.2, 5.0),
      W(8, 8, 3.0, 1.2),
      W(8, -8, 3.0, 1.2),
    ],
    f2: [
      W(10, -14, 1.2, 6.0),
      W(10, 14, 1.2, 6.0),
      W(21, 9, 4.0, 1.2),
      W(21, -9, 4.0, 1.2),
    ],
    props: [
      { type: 'reactor', floor: 1, x: -21, z: 0 },
      { type: 'holo', floor: 2, x: 21, z: 12 },
      { type: 'hull', floor: 1, x: -2, z: -16 },
      { type: 'hull', floor: 2, x: 16.5, z: -17 },
      { type: 'reactor', floor: 2, x: 21, z: -6 },
      { type: 'holo', floor: 1, x: -9, z: 15 },
    ],
    gimmick: () => ({
      kind: 'space',
      lowGravity: [{ floor: 1, x: -12, z: 14, w: 20, d: 4.0 }],
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
 * Which switch candidates and gate mouths this stage keeps clear. The stage
 * author keeps every candidate at least 1.2 m off a wall; the test enforces it
 * for all six stages so a switch can never be inside geometry.
 */
export function switchSpotsFor(stage) {
  return stage.switchSpots;
}

