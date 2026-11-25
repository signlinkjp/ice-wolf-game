/**
 * The six stages.
 *
 * The arena frame (outer walls, the raised deck, the two stairwells) is shared;
 * only the inner walls, the palette, the props and the gimmick change. That is
 * the same deal the GDevelop build had ("同じアリーナ、同じ境界、動くのは内側の壁
 * 52枚だけ"), now expressed as data.
 *
 * All coordinates are metres, x east, z south. Floor 1 is west of x = 6,
 * floor 2 is the deck at y = 5.5 east of it.
 */
import { ARENA, GIMMICK } from '../config.js';
import { rectOf } from '../core/geometry.js';

const W = (x, z, w, d, kind = 'wall') => rectOf(x, z, w, d, { kind });

const STAIR_Z = ARENA.stairs.map((s) => s.z);

/** Stairwell triggers, identical on every stage. */
function stairLinks() {
  const out = [];
  for (const z of STAIR_Z) {
    out.push({ id: `up-${z}`, floor: 1, x: 5.0, z, r: 1.5, toFloor: 2, exitX: 9.3, exitZ: z });
    out.push({ id: `dn-${z}`, floor: 2, x: 7.6, z, r: 1.5, toFloor: 1, exitX: 3.2, exitZ: z });
  }
  return out;
}

const STAIRS = stairLinks();

/** Every stage shares the same 13 switch candidates and 3 gate mouths. */
const SWITCH_SPOTS = [
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
];

const GATES = [
  { id: 0, floor: 1, x: -22.9, z: 0, facing: 'west' },
  { id: 1, floor: 1, x: 0, z: -16.6, facing: 'north' },
  { id: 2, floor: 2, x: 22.2, z: 0, facing: 'east' },
];

const SPAWNS = [
  { x: -20, z: -12, floor: 1 },
  { x: -20, z: 11, floor: 1 },
  { x: -14, z: 6, floor: 1 },
  { x: -14, z: -8, floor: 1 },
  { x: -7.5, z: 10.5, floor: 1 },
  { x: -8, z: -11, floor: 1 },
  { x: -2, z: 6, floor: 1 },
  { x: -3, z: -4, floor: 1 },
  { x: 11, z: 10, floor: 2 },
  { x: 11, z: -10, floor: 2 },
  { x: 16, z: 4, floor: 2 },
  { x: 16, z: -4, floor: 2 },
  { x: 20, z: 12, floor: 2 },
  { x: 20, z: -12, floor: 2 },
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
  return {
    id: def.id,
    pro: def.pro,
    nameKey: `stage.${def.id}`,
    descKey: `stage.${def.id}.desc`,
    gimmickKey: def.gimmickKey || null,
    weather: def.weather,
    palette,
    walls: { f1: def.f1, f2: def.f2 },
    props: def.props || [],
    stairs: STAIRS,
    warps: [
      { id: 'warp-a', pair: 0, floor: 1, x: 3.5, z: 12, toX: 21, toZ: 14, toFloor: 2 },
      { id: 'warp-b', pair: 0, floor: 2, x: 21, z: 14, toX: 3.5, toZ: 12, toFloor: 1 },
    ],
    switchSpots: SWITCH_SPOTS,
    gates: GATES,
    pads: [
      { id: 'pad-1', floor: 1, x: -14, z: -2 },
      { id: 'pad-2', floor: 1, x: -5, z: 8 },
      { id: 'pad-3', floor: 2, x: 11, z: 3 },
      { id: 'pad-4', floor: 2, x: 22, z: -4 },
    ],
    spawns: SPAWNS,
    playerSpawn: { x: -20, z: -12, floor: 1 },
    gimmick,
    // Textures the GDevelop build drew by hand, reused as the Three.js surfaces.
    tex: {
      floor: `assets/floor_${def.tex || def.id}.png`,
      wall: `assets/wall_${def.tex || def.id}.png`,
      cap: `assets/cap_${def.cap || def.id}.png`,
    },
    ...def.extra,
  };
}

export const STAGE_IDS = ['classic', 'aquarium', 'park', 'lodge', 'school', 'space'];

export const STAGES = [
  stageDef({
    id: 'classic',
    pro: false,
    tex: 'classic',
    cap: 'classic',
    weather: 'snow',
    // A wide, readable arena: four pillars, one central ice block, two long
    // benches. The 1.0.0 layout, reduced to its shapes.
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
    f1: [
      W(-18, -8, 1.2, 7.0),
      W(-18, 8, 1.2, 7.0),
      W(-11, -13, 6.0, 1.2),
      W(-11, 13, 6.0, 1.2),
      W(-7, 0, 3.0, 1.2),
      W(-1, -8, 1.2, 4.0),
    ],
    f2: [
      W(10, -7, 6.0, 1.2),
      W(10, 7, 6.0, 1.2),
      W(17, -1, 3.0, 5.0),
      W(21, 10, 1.2, 4.0),
    ],
    props: [
      { type: 'tank', floor: 1, x: -23.6, z: -6 },
      { type: 'tank', floor: 1, x: -23.6, z: 8 },
      { type: 'coral', floor: 2, x: 23, z: -12 },
      { type: 'coral', floor: 1, x: -6, z: -16 },
      { type: 'fish', floor: 2, x: 15, z: 12 },
      { type: 'coral', floor: 2, x: 13, z: -15 },
    ],
    gimmick: () => ({
      kind: 'aquarium',
      current: [
        { floor: 1, x: -9, z: 0, w: 26, d: 5.5, dx: 1, dz: 0, power: GIMMICK.aquarium.currentPower },
        { floor: 2, x: 15, z: -2, w: 15, d: 5.5, dx: -1, dz: 0, power: GIMMICK.aquarium.currentPower },
      ],
      cycle: { ...GIMMICK.aquarium, kind: 'manta' },
    }),
  }),
  stageDef({
    id: 'park',
    pro: true,
    weather: 'petal',
    f1: [
      W(-18, -10, 2.0, 2.0),
      W(-18, 10, 2.0, 2.0),
      W(-10, 0, 2.0, 8.0),
      W(-3, -14, 5.0, 1.2),
      W(-3, 14, 5.0, 1.2),
      W(2, 6, 2.0, 2.0),
    ],
    f2: [
      W(8.5, 0, 1.2, 8.0),
      W(16, -12, 4.0, 2.0),
      W(16, 12, 4.0, 2.0),
      W(21, 6, 1.2, 4.0),
    ],
    props: [
      { type: 'ferris', floor: 2, x: 20, z: -16 },
      { type: 'tent', floor: 1, x: -21, z: 6 },
      { type: 'tent', floor: 1, x: -21, z: -6 },
      { type: 'balloon', floor: 2, x: 12, z: -16 },
      { type: 'lights', floor: 1, x: -8, z: 16 },
      { type: 'lights', floor: 2, x: 14, z: -16 },
    ],
    gimmick: () => ({
      kind: 'park',
      cycle: { ...GIMMICK.park, kind: 'parade' },
      spots: [
        { floor: 1, x: -12, z: -2 },
        { floor: 1, x: -4, z: 10 },
        { floor: 2, x: 10, z: 8 },
        { floor: 2, x: 18, z: -4 },
      ],
    }),
  }),
  stageDef({
    id: 'lodge',
    pro: true,
    weather: 'ember',
    f1: [
      W(-19, 0, 4.0, 4.0),
      W(-12, -9, 1.2, 9.0),
      W(-12, 9, 1.2, 9.0),
      W(-6, -15, 8.0, 1.2),
      W(-6, 15, 8.0, 1.2),
      W(1, 0, 2.0, 2.0),
    ],
    f2: [
      W(12, -8, 2.0, 2.0),
      W(12, 8, 2.0, 2.0),
      W(18, 0, 4.0, 3.0),
      W(21, -12, 1.2, 5.0),
    ],
    props: [
      { type: 'hearth', floor: 1, x: -21, z: 0 },
      { type: 'pine', floor: 1, x: -16, z: 13 },
      { type: 'pine', floor: 1, x: -6, z: -13 },
      { type: 'pine', floor: 2, x: 22, z: 15 },
      { type: 'beam', floor: 2, x: 12, z: 0 },
      { type: 'pine', floor: 2, x: 22, z: -4 },
    ],
    gimmick: () => ({
      kind: 'lodge',
      slideZones: [{ floor: 1, x: -9, z: -15, w: 24, d: 4.0 }],
      cycle: { ...GIMMICK.lodge, kind: 'blizzard' },
    }),
  }),
  stageDef({
    id: 'school',
    pro: true,
    weather: 'dust',
    f1: [
      // A classroom whose doorway is the door the gimmick shuts.
      W(-18, -4, 2.0, 1.0),
      W(-8, -4, 2.0, 1.0),
      W(-13, -10.5, 11.0, 1.0),
      W(-18.5, 1, 1.0, 11.0),
      W(-8.5, 1, 1.0, 9.0),
      W(-13, 5.5, 11.0, 1.0),
      W(-3, 14, 4.0, 1.0),
      W(1, -12, 2.0, 2.0),
    ],
    f2: [
      W(16.5, -4, 1.0, 10.0),
      W(20.5, 3, 1.0, 7.0),
      W(17, -11, 8.0, 1.0),
      W(17, 9, 8.0, 1.0),
      W(9, 14, 3.0, 1.0),
    ],
    props: [
      { type: 'desk', floor: 1, x: -16, z: -8 },
      { type: 'desk', floor: 1, x: -11, z: -8 },
      { type: 'board', floor: 1, x: -13, z: -10 },
      { type: 'clock', floor: 2, x: 23, z: 0 },
      { type: 'desk', floor: 2, x: 17, z: -6 },
      { type: 'board', floor: 2, x: 17, z: 8 },
    ],
    gimmick: () => ({
      kind: 'school',
      doors: [
        { floor: 1, x: -13, z: -4, w: 8.0, d: 1.0 },
        { floor: 2, x: 17, z: 3, w: 6.0, d: 1.0 },
      ],
      cycle: { ...GIMMICK.school, kind: 'school' },
    }),
  }),
  stageDef({
    id: 'space',
    pro: true,
    weather: 'stars',
    f1: [
      W(-19, -6, 6.0, 1.2),
      W(-19, 6, 6.0, 1.2),
      W(-12, -8, 1.2, 5.0),
      W(-11, 12, 1.2, 4.0),
      W(-6, 0, 4.0, 4.0),
      W(0, -10, 1.2, 5.0),
      W(0, 10, 1.2, 5.0),
    ],
    f2: [
      W(9, 0, 7.0, 1.2),
      W(15, -8, 1.2, 6.0),
      W(15, 8, 1.2, 6.0),
      W(21.2, 4.5, 1.2, 4.0),
      W(18, 16, 6.0, 1.2),
    ],
    props: [
      { type: 'reactor', floor: 1, x: -21, z: 0 },
      { type: 'holo', floor: 2, x: 22, z: 12 },
      { type: 'hull', floor: 1, x: -2, z: -16 },
      { type: 'hull', floor: 2, x: 12, z: 16 },
      { type: 'reactor', floor: 2, x: 17, z: -14 },
      { type: 'holo', floor: 1, x: -9, z: 15 },
    ],
    gimmick: () => ({
      kind: 'space',
      lowGravity: [{ floor: 1, x: -9, z: 14, w: 22, d: 4.5 }],
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
 * author keeps every candidate at least 1.4 m off a wall; the test enforces it
 * for all six stages so a switch can never be inside geometry.
 */
export function switchSpotsFor(stage) {
  return stage.switchSpots;
}
