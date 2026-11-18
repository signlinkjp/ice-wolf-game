// The v1.1.0 stage art: five stages that look like five different places.
//
// Build 16 shipped the Deep-Sea Aquarium as the frost lab in a blue tint, so a
// PRO stage did not look like another place. From here on every v1.1.0 stage
// owns three textures of its own (wall / cap / floor), a ring of 3D props stood
// on the tops of its own walls, and its own fog and sky - and the Classic arena
// keeps the 1.0.0 frost-lab textures.
//
// This test proves four things without a browser:
//   * the fifteen textures are declared in game.json, exist on disk, are real
//     512x512 images, and every stage's colour is measurably its own;
//   * the art block runs for all six stages against a stand-in THREE, swaps the
//     six faces of every wall and floor, sets the air, and restores the frost
//     lab when the player goes back to Classic;
//   * no prop is ever stood on the floor (every one sits on a wall top), so no
//     prop can stand in a player's way;
//   * the SETTINGS screen's camera row is really in Japanese now, and the line
//     is present in all twelve languages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';

import { repoRoot, readGame, sceneOf, groupCode, createI18n, LANGS, KANA } from './helpers.mjs';

const STAGE_GROUP = 'v1.1.0 ステージ・衣装';
const STAGES = ['aquarium', 'park', 'lodge', 'school', 'space'];
const CLASSIC = 'classic';
/* Hiragana, katakana or kanji - the labels here are short Japanese words such as
 * 移動, which carry no kana at all. */
const JAPANESE = /[\u3040-\u30ff\u4e00-\u9fff\u3005]/;

/* ------------------------------------------------------------------ the PNGs */
const decodePng = (file) => {
  const buffer = fs.readFileSync(file);
  assert.equal(buffer.toString('latin1', 1, 4), 'PNG', `${path.basename(file)} is a PNG`);
  let offset = 8;
  let width = 0;
  let height = 0;
  let depth = 8;
  let colour = 2;
  let palette = null;
  const chunks = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      colour = data[9];
    } else if (type === 'PLTE') {
      palette = data;
    } else if (type === 'IDAT') {
      chunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  assert.equal(depth, 8, `${path.basename(file)} is an 8-bit PNG`);
  const channels = colour === 6 ? 4 : colour === 2 ? 3 : 1;
  const raw = zlib.inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  let previous = Buffer.alloc(stride);
  let cursor = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[cursor];
    cursor += 1;
    const line = Buffer.from(raw.subarray(cursor, cursor + stride));
    cursor += stride;
    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? line[x - channels] : 0;
      const up = previous[x];
      const upLeft = x >= channels ? previous[x - channels] : 0;
      if (filter === 1) line[x] = (line[x] + left) & 255;
      else if (filter === 2) line[x] = (line[x] + up) & 255;
      else if (filter === 3) line[x] = (line[x] + ((left + up) >> 1)) & 255;
      else if (filter === 4) {
        const estimate = left + up - upLeft;
        const pa = Math.abs(estimate - left);
        const pb = Math.abs(estimate - up);
        const pc = Math.abs(estimate - upLeft);
        line[x] = (line[x] + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft)) & 255;
      }
    }
    line.copy(pixels, y * stride);
    previous = line;
  }
  return { width, height, colour, channels, palette, pixels, stride };
};

const meanColour = (file) => {
  const png = decodePng(file);
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let y = 0; y < png.height; y += 4) {
    for (let x = 0; x < png.width; x += 4) {
      const i = y * png.stride + x * png.channels;
      if (png.colour === 3) {
        const index = png.pixels[i] * 3;
        r += png.palette[index];
        g += png.palette[index + 1];
        b += png.palette[index + 2];
      } else {
        r += png.pixels[i];
        g += png.pixels[i + 1];
        b += png.pixels[i + 2];
      }
      count += 1;
    }
  }
  return [r / count, g / count, b / count];
};

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const asset = (name) => path.join(repoRoot, 'assets', name);

/* -------------------------------------------------------------- the art block */
const artBlock = () => {
  const group = sceneOf(readGame()).events.find((event) => event.name === STAGE_GROUP);
  assert.ok(group, 'the stage group is on the sheet');
  assert.ok(group.events.length >= 2, 'the stage art is its own event in the stage group');
  const code = group.events[group.events.length - 1].inlineCode;
  return Array.isArray(code) ? code.join('\n') : code;
};

/* A stand-in THREE and FROST LAB, enough for the block to run for real. */
const makeHarness = () => {
  class Vector3 { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } }
  const placements = [];
  class Color {
    constructor() { this.r = 1; this.g = 1; this.b = 1; this.hex = 0xffffff; }
    setHex(hex) { this.hex = hex; return this; }
    setRGB(r, g, b) { this.r = r; this.g = g; this.b = b; return this; }
  }
  class Matrix4 {
    constructor() { this.placedAt = null; }
    makeRotationZ(angle) { this.angle = angle; return this; }
    setPosition(x, y, z) { this.placedAt = [x, y, z]; placements.push([x, y, z]); return this; }
    determinant() { return 1; }
  }
  class BufferAttribute {
    constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; this.count = array.length / itemSize; }
  }
  class BufferGeometry {
    constructor() { this.attributes = {}; }
    setAttribute(name, attribute) { this.attributes[name] = attribute; return this; }
    computeBoundingSphere() { return this; }
    translate() { return this; }
    applyMatrix4() { return this; }
    rotateX() { return this; }
    toNonIndexed() { return this; }
    dispose() { this.disposed = true; }
  }
  const shape = (tag) => class extends BufferGeometry {
    constructor() {
      super();
      const position = new Float32Array(36 * 3);
      const normal = new Float32Array(36 * 3).fill(1);
      this.setAttribute('position', new BufferAttribute(position, 3));
      this.setAttribute('normal', new BufferAttribute(normal, 3));
      this.tag = tag;
    }
  };
  const vector = (x = 0, y = 0, z = 0) => ({
    x, y, z,
    set(a, b, c) { this.x = a; this.y = b; this.z = c; return this; }
  });
  class Mesh {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
      this.children = [];
      this.position = vector();
      this.rotation = vector();
      this.scale = vector(1, 1, 1);
      this.name = '';
    }
  }
  const THREE = {
    Vector3, Color, Matrix4, BufferAttribute, BufferGeometry, Mesh,
    Fog: class { constructor(color, near, far) { this.color = color; this.near = near; this.far = far; } },
    BoxGeometry: shape('box'),
    CylinderGeometry: shape('cyl'),
    TorusGeometry: shape('torus'),
    MeshStandardMaterial: class { constructor(params) { this.params = params; this.color = new Color(); } dispose() {} },
    MeshBasicMaterial: class { constructor(params) { this.params = params; this.color = new Color(); } dispose() {} }
  };

  const cube = (name, x, y, width, height, depth) => {
    const faces = {};
    const object = {
      name,
      __faces: faces,
      __tileScale: 0.2,
      getX: () => x,
      getY: () => y,
      getZ: () => 0,
      getDepth: () => depth,
      getWidth: () => width,
      getHeight: () => height,
      setFaceResourceName(face, resource) { faces[face] = resource; return true; },
      setTileScale(value) { object.__tileScale = value; },
      get3DRendererObject: () => ({ material: {}, add() {} })
    };
    return object;
  };

  /* The scene as game.json draws it: eight border walls, four of each interior
   * size the stages use, two floors, and the twelve parked walls. */
  const walls = [];
  for (const [x, y, w, h] of [
    [-720, -760, 1520, 40], [-720, 720, 1520, 40], [-760, -720, 40, 1440], [720, -720, 40, 1440],
    [880, -760, 1520, 40], [880, 720, 1520, 40], [840, -720, 40, 1440], [2320, -720, 40, 1440]
  ]) walls.push(cube('Wall', x, y, w, h, 160));
  for (const [w, h] of [[160, 32], [32, 160], [320, 32], [130, 32], [90, 90], [200, 32], [64, 64]]) {
    for (let i = 0; i < 4; i += 1) walls.push(cube('Wall', -300 + i * 90, 100 + i * 40, w, h, 160));
  }
  for (let i = 0; i < 12; i += 1) walls.push(cube('Wall', -2600, 40000, 160, 32, 160));
  const floors = [cube('Floor', -694, -709, 1440, 1440, 30), cube('Floor', 906, -709, 1440, 1440, 30)];

  const scene = {
    fog: null,
    children: [],
    add(child) { this.children.push(child); },
    remove(child) { const at = this.children.indexOf(child); if (at >= 0) this.children.splice(at, 1); }
  };
  const renderer = { getThreeScene: () => scene, getThreeGroup: () => ({ add() {} }), getThreeCamera: () => null };

  const values = new Map();
  const state = { background: null, seconds: 1.25 };
  const vars = (name) => ({
    getAsString: () => String(values.get(name) ?? ''),
    setString: (value) => { values.set(name, String(value)); },
    getAsNumber: () => Number(values.get(name) ?? 0),
    setNumber: (value) => { values.set(name, Number(value)); },
    getAsBoolean: () => values.get(name) === true,
    setBoolean: (value) => { values.set(name, value === true); }
  });
  const runtimeScene = {
    getVariables: () => ({ get: vars }),
    getGame: () => (state.image ? { getImageManager: () => state.image } : undefined),
    getObjects: (name) => (name === 'Wall' ? walls : name === 'Floor' ? floors : []),
    getLayer: () => ({ getRenderer: () => renderer }),
    setBackgroundColor: (r, g, b) => { state.background = [r, g, b]; }
  };
  const context = vm.createContext({
    THREE, runtimeScene,
    gdjs: { evtTools: { runtimeScene: { getElapsedTimeInSeconds: () => state.seconds } } },
    Math, String, Number, Array, Object, Float32Array, Promise, console
  });
  const source = artBlock();
  const run = (label) => vm.runInContext(`(function(){\n${source}\n})()`, context, { filename: `game.json#stage art ${label}` });
  return { run, scene, values, state, walls, floors, placements };
};

/* A stand-in image manager, shaped like gdjs's own: it holds a texture per
 * resource name once the resource is loaded, answers with a placeholder before
 * that, and hands the block a promise from loadResource. */
const makeImageManager = () => {
  const placeholder = { name: 'placeholder' };
  const loaded = new Set();
  const requested = [];
  const waiting = [];
  return {
    placeholder,
    requested,
    loaded,
    getInvalidPIXITexture: () => placeholder,
    getPIXITexture: (name) => (loaded.has(name) ? { name } : placeholder),
    loadResource: (name) => {
      requested.push(name);
      return new Promise((resolve) => waiting.push(() => { loaded.add(name); resolve(); }));
    },
    finish: () => {
      const jobs = waiting.splice(0, waiting.length);
      for (const job of jobs) job();
      return jobs.length;
    }
  };
};

/* --------------------------------------------------------------------- tests */
test('every v1.1.0 stage declares its own wall, cap and floor texture', () => {
  const game = readGame();
  const names = new Set(game.resources.resources.map((entry) => entry.name));
  for (const stage of STAGES) {
    for (const kind of ['wall', 'cap', 'floor']) {
      const name = `${kind}_${stage}.png`;
      assert.ok(names.has(name), `${name} is declared in game.json`);
      const entry = game.resources.resources.find((resource) => resource.name === name);
      assert.equal(entry.kind, 'image', `${name} is an image resource`);
      assert.ok(entry.userAdded, `${name} is a v1.1.0 addition`);
      assert.ok(fs.existsSync(asset(name)), `${name} exists in assets/`);
    }
  }
  /* The 1.0.0 frost-lab set is untouched. */
  for (const name of ['floor_frostlab.png', 'wall_frostlab.png']) {
    const entry = game.resources.resources.find((resource) => resource.name === name);
    assert.equal(entry.file, `assets/${name}`, `${name} still points at the shipped file`);
    assert.ok(fs.existsSync(asset(name)), `${name} is still there`);
  }
});

test('the textures are real 512x512 pictures, and no two stages look alike', () => {
  for (const stage of STAGES) {
    for (const kind of ['wall', 'cap', 'floor']) {
      const file = asset(`${kind}_${stage}.png`);
      const png = decodePng(file);
      assert.equal(png.width, 512, `${kind}_${stage}.png is 512 wide`);
      assert.equal(png.height, 512, `${kind}_${stage}.png is 512 tall`);
      assert.ok(fs.statSync(file).size > 4000, `${kind}_${stage}.png is not a blank canvas`);
    }
  }
  const signature = (stage) => {
    const mean = (name) => meanColour(asset(name));
    const wall = mean(`wall_${stage}.png`);
    const cap = mean(`cap_${stage}.png`);
    const floor = mean(`floor_${stage}.png`);
    return [(wall[0] + cap[0] + floor[0]) / 3, (wall[1] + cap[1] + floor[1]) / 3, (wall[2] + cap[2] + floor[2]) / 3];
  };
  const classic = (() => {
    const wall = meanColour(asset('wall_frostlab.png'));
    const floor = meanColour(asset('floor_frostlab.png'));
    return [(wall[0] + floor[0]) / 2, (wall[1] + floor[1]) / 2, (wall[2] + floor[2]) / 2];
  })();
  const signatures = Object.fromEntries(STAGES.map((stage) => [stage, signature(stage)]));
  for (const stage of STAGES) {
    assert.ok(distance(signatures[stage], classic) > 20,
      `${stage} does not read as the frost lab (${distance(signatures[stage], classic).toFixed(1)})`);
  }
  for (let i = 0; i < STAGES.length; i += 1) {
    for (let j = i + 1; j < STAGES.length; j += 1) {
      const gap = distance(signatures[STAGES[i]], signatures[STAGES[j]]);
      assert.ok(gap > 20, `${STAGES[i]} and ${STAGES[j]} are different places (${gap.toFixed(1)})`);
    }
  }
});

test('the art block names all five stages and keeps the classic textures', () => {
  const code = artBlock();
  for (const stage of STAGES) {
    for (const kind of ['wall', 'cap', 'floor']) {
      assert.ok(code.includes(`${kind}_${stage}.png`), `the block loads ${kind}_${stage}.png`);
    }
  }
  assert.ok(code.includes('floor_frostlab.png'), 'the block can put the 1.0.0 floor back');
  assert.ok(code.includes('wall_frostlab.png'), 'the block can put the 1.0.0 wall back');
  assert.ok(code.includes('setFaceResourceName'), 'textures are swapped on the cube faces');
  assert.ok(code.includes('Fog('), 'the stage brings its own air');
  assert.ok(code.includes('setBackgroundColor'), 'the stage brings its own sky');
  assert.ok(code.includes('TorusGeometry') && code.includes('CylinderGeometry'), 'the props are real 3D shapes');
  /* It is decoration only: it never moves, resizes or hides a collision object. */
  assert.equal(/\.setX\(/.test(code), false, 'the block never moves an object');
  assert.equal(/\.setY\(/.test(code), false, 'the block never moves an object');
  assert.equal(/\.setWidth\(/.test(code), false, 'the block never resizes an object');
  assert.equal(/\.setHeight\(/.test(code), false, 'the block never resizes an object');
  for (const constant of ['WolfModeDuration', 'RescueHoldDuration', 'SpeedBoostFactor', 'SwitchHoldDuration']) {
    assert.equal(code.includes(constant), false, `the block does not touch ${constant}`);
  }
});

test('all six stages paint for real, and Classic comes back exactly as it was', () => {
  const harness = makeHarness();
  harness.run('start');
  const wallFaces = () => harness.walls[0].__faces;
  for (const stage of STAGES) {
    harness.values.set('StageApplied', stage);
    harness.run(stage);
    assert.equal(harness.values.get('StageArtMode'), 'textured', `${stage} is textured`);
    assert.equal(harness.values.get('StageArtApplied'), stage, `${stage} is the applied art`);
    assert.equal(harness.values.get('StageArtFog'), true, `${stage} has its own air`);
    assert.ok(harness.values.get('StageArtWalls') >= 30, `${stage} paints every wall (${harness.values.get('StageArtWalls')})`);
    assert.ok(harness.values.get('StageArtProps') >= 1, `${stage} stands props on its walls`);
    assert.ok(harness.values.get('StageArtVertices') > 500, `${stage} merges real geometry`);
    assert.deepEqual(wallFaces(), {
      front: `wall_${stage}.png`, back: `wall_${stage}.png`, left: `wall_${stage}.png`,
      right: `wall_${stage}.png`, top: `cap_${stage}.png`, bottom: `cap_${stage}.png`
    }, `${stage} textures the four sides and the top separately`);
    assert.equal(harness.walls[0].__tileScale, 0.3125, `${stage} sets the wall tile scale`);
    assert.deepEqual(harness.floors[0].__faces.top, `floor_${stage}.png`, `${stage} textures the floor`);
    assert.equal(harness.floors[0].__tileScale, 0.5, `${stage} sets the floor tile scale`);
    assert.equal(harness.scene.children.length, 2 + harness.values.get('StageArtSwimmers'),
      `${stage} dresses the arena in two draw calls plus its swimmers`);
    assert.ok(harness.scene.fog, `${stage} sets the fog`);
    assert.notDeepEqual(harness.state.background, [11, 22, 38], `${stage} sets its own sky`);
  }
  /* The parked walls stay parked, and are not textured. */
  const parked = harness.walls.filter((wall) => wall.getY() > 10000);
  assert.equal(parked.length, 12, 'the twelve parked walls are still there');
  for (const wall of parked) assert.deepEqual(wall.__faces, {}, 'a parked wall is never touched');

  harness.values.set('StageApplied', CLASSIC);
  harness.run('classic');
  assert.equal(harness.values.get('StageArtMode'), 'classic', 'Classic is the 1.0.0 look');
  assert.equal(harness.values.get('StageArtProps'), 0, 'Classic has no props');
  assert.equal(harness.values.get('StageArtSwimmers'), 0, 'Classic has no population');
  assert.equal(harness.values.get('StageArtFog'), false, 'Classic has no fog');
  assert.deepEqual(wallFaces(), {
    front: 'wall_frostlab.png', back: 'wall_frostlab.png', left: 'wall_frostlab.png',
    right: 'wall_frostlab.png', top: 'wall_frostlab.png', bottom: 'wall_frostlab.png'
  }, 'Classic gets its frost wall back');
  assert.deepEqual(harness.floors[0].__faces.top, 'floor_frostlab.png', 'Classic gets its frost floor back');
  assert.equal(harness.walls[0].__tileScale, 0.2, 'Classic keeps the 1.0.0 tile scale');
  assert.equal(harness.scene.fog, null, 'Classic clears the air');
  assert.deepEqual(harness.state.background, [11, 22, 38], 'Classic keeps the 1.0.0 sky');
  assert.equal(harness.scene.children.length, 0, 'Classic drops the props');
});

test('no prop ever stands on the floor: every one sits on a wall top', () => {
  const harness = makeHarness();
  harness.run('start');
  for (const stage of STAGES) {
    harness.placements.length = 0;
    harness.values.set('StageApplied', stage);
    harness.run(stage);
    assert.ok(harness.placements.length >= 6, `${stage} places props (${harness.placements.length})`);
    for (const [x, y, z] of harness.placements) {
      assert.ok(z >= 150, `${stage}: the prop at ${x},${y} stands on a wall top (z=${z})`);
      assert.ok(Math.abs(x) < 2500 && Math.abs(y) < 1000, `${stage}: the prop at ${x},${y} is inside the arena`);
    }
  }
});

test('the block only runs again when the stage really changes', () => {
  const harness = makeHarness();
  harness.run('start');
  harness.values.set('StageApplied', 'space');
  harness.run('space');
  const first = harness.values.get('StageArtVertices');
  harness.placements.length = 0;
  harness.run('space again');
  assert.equal(harness.values.get('StageArtVertices'), first, 'the second frame reuses the built stage');
  assert.equal(harness.placements.length, 0, 'no geometry is rebuilt on an unchanged frame');
  assert.equal(harness.scene.children.length, 2 + harness.values.get('StageArtSwimmers'),
    'the two draw calls stay in place, with the population');
});

test('the SETTINGS camera row is in Japanese, in all twelve languages', () => {
  const { i18n } = createI18n();
  const keys = ['settings.camera', 'settings.movement', 'settings.movementValue', 'joystick.aria', 'camera.aria'];
  i18n.setLang('ja');
  assert.equal(i18n.t('settings.camera'), '既定カメラ', 'the camera row is Japanese');
  for (const key of keys) {
    const line = i18n.ja(key);
    assert.ok(line.length > 0, `${key} has a Japanese line`);
    assert.equal(JAPANESE.test(line), true, `${key} is written in Japanese: ${line}`);
    for (const lang of LANGS) {
      i18n.setLang(lang);
      assert.ok(i18n.t(key).length > 0, `${key} [${lang}] is present`);
    }
  }
  i18n.setLang('en');
  assert.equal(i18n.t('settings.camera'), 'Default camera', 'English is unchanged');
  i18n.setLang('ja');
  const menu = groupCode('v0.6.5 Production Round Start + Main Menu');
  assert.ok(menu.includes('data-i18n="settings.camera"'), 'the SETTINGS row reads settings.camera');
  assert.ok(menu.includes('data-i18n="settings.movementValue"'), 'the movement row reads settings.movementValue');
});

test('the aquarium has a population, and it swims from frame to frame', () => {
  const harness = makeHarness();
  harness.run('start');
  harness.values.set('StageApplied', 'aquarium');
  harness.state.seconds = 1;
  harness.run('aquarium');
  const swimmers = harness.scene.children.filter((child) => child.name === 'iceWolfV110Shoal'
    || child.name === 'iceWolfV110Jelly');
  assert.equal(swimmers.length, 5, 'two shoals and three jellyfish');
  assert.equal(harness.values.get('StageArtSwimmers'), 5, 'the block reports five swimmers');
  assert.equal(swimmers.filter((mesh) => mesh.name === 'iceWolfV110Shoal').length, 2, 'two shoals');
  assert.equal(swimmers.filter((mesh) => mesh.name === 'iceWolfV110Jelly').length, 3, 'three jellyfish');
  for (const mesh of swimmers) {
    assert.ok(mesh.frustumCulled === false, 'a swimmer is never culled by a stale bound');
    assert.ok(mesh.position.z > 160, `a swimmer floats above the wall tops (z=${mesh.position.z})`);
    assert.ok(mesh.position.x > -760 && mesh.position.x < 800, 'a swimmer stays over the 1F arena');
    assert.ok(mesh.position.y > -780 && mesh.position.y < 800, 'a swimmer stays over the 1F arena');
  }

  const before = swimmers.map((mesh) => [mesh.position.x, mesh.position.y]);
  harness.state.seconds = 4.5;
  harness.run('four seconds later');
  const after = swimmers.map((mesh) => [mesh.position.x, mesh.position.y]);
  for (let i = 0; i < swimmers.length; i += 1) {
    const moved = Math.hypot(after[i][0] - before[i][0], after[i][1] - before[i][1]);
    assert.ok(moved > 1, `swimmer ${i} moved (${moved.toFixed(2)}px)`);
  }
  /* The stalkers are decoration: the arena is still the same arena. */
  assert.equal(harness.walls.every((wall) => wall.getY() > 10000 || wall.__faces.front), true,
    'every wall is still textured');
  assert.equal(harness.scene.fog !== null, true, 'the air is still the aquarium air');
});

test('a stage is not painted until its three textures are in the image manager', async () => {
  /* Build 17's bug: setFaceResourceName was called on a PNG the image manager
   * had never loaded, so gdjs answered with its purple placeholder. The block
   * must ask the loader first, paint only when the PNGs are in memory, and fall
   * back to the 1.0.0 surfaces if they never arrive. */
  const harness = makeHarness();
  const manager = makeImageManager();
  harness.run('start');
  harness.values.set('StageApplied', 'aquarium');
  harness.state.image = manager;

  harness.state.seconds = 1;
  harness.run('waiting for the PNGs');
  assert.equal(harness.values.get('StageArtPending'), 'aquarium', 'the block reports the wait');
  assert.equal(harness.values.get('StageArtApplied'), 'classic',
    'the stage is not claimed as applied while its PNGs are missing');
  assert.equal(harness.walls[0].__faces.front, 'wall_frostlab.png',
    'the arena keeps the loaded frost lab while the PNGs arrive');
  assert.deepEqual([...manager.requested].sort(),
    ['cap_aquarium.png', 'floor_aquarium.png', 'wall_aquarium.png'],
    'the block asks the game loader for the three PNGs');
  assert.equal(harness.scene.children.filter((mesh) => mesh.name === 'iceWolfV110Shoal').length, 0,
    'no swimmer is built for a stage that is not painted yet');

  manager.finish();
  await new Promise((resolve) => setTimeout(resolve, 0));
  harness.state.seconds = 2;
  harness.run('PNGs in memory');
  assert.equal(harness.values.get('StageArtMode'), 'textured', 'the stage is painted once they are in memory');
  assert.equal(harness.values.get('StageArtApplied'), 'aquarium', 'the aquarium art is applied');
  assert.deepEqual(harness.walls[0].__faces, {
    front: 'wall_aquarium.png', back: 'wall_aquarium.png', left: 'wall_aquarium.png',
    right: 'wall_aquarium.png', top: 'cap_aquarium.png', bottom: 'cap_aquarium.png'
  }, 'and only now are the faces named');
  assert.equal(harness.values.get('StageArtSwimmers'), 5, 'and the population arrives with it');
});

test('a stage whose PNGs never arrive falls back to the frost lab, never to the placeholder', async () => {
  const harness = makeHarness();
  const manager = makeImageManager();
  harness.run('start');
  harness.values.set('StageApplied', 'space');
  harness.state.image = manager;

  harness.state.seconds = 1;
  harness.run('waiting');
  assert.equal(manager.requested.length, 3, 'the loader was asked once per PNG');

  harness.state.seconds = 12;
  harness.run('the wait is over');
  assert.equal(harness.values.get('StageArtMode'), 'fallback', 'the stage falls back');
  assert.equal(harness.values.get('StageArtDegraded'), true, 'and says so');
  assert.deepEqual(harness.walls[0].__faces, {
    front: 'wall_frostlab.png', back: 'wall_frostlab.png', left: 'wall_frostlab.png',
    right: 'wall_frostlab.png', top: 'wall_frostlab.png', bottom: 'wall_frostlab.png'
  }, 'the 1.0.0 surfaces, never the purple G');
  assert.equal(harness.floors[0].__faces.top, 'floor_frostlab.png', 'the floor too');
  assert.ok(harness.scene.fog, 'the stage still brings its air');
  assert.equal(manager.requested.length, 3, 'a failed PNG is not requested again every frame');

  /* A late arrival still upgrades the arena to the real textures. */
  manager.finish();
  await new Promise((resolve) => setTimeout(resolve, 0));
  harness.state.seconds = 13;
  harness.run('late PNGs');
  assert.equal(harness.values.get('StageArtMode'), 'textured', 'the real textures win in the end');
  assert.equal(harness.walls[0].__faces.front, 'wall_space.png', 'and are really used');
});
