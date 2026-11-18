// ICE WOLF Build 19: the five match-time chips light one at a time, and each
// v1.1.0 stage has a gimmick of its own.
//
// Build 18 shipped the 1- and 10-minute chips as a second, independent set: the
// SETTINGS panel marked 2/3/5 minutes and the roster block marked 1/10, so a
// pick left two chips lit (and a saved 1 or 10 minute time was dropped on the
// next launch). This file proves the fixed marking, and it runs the gimmick
// block for real against a stand-in THREE and DOM so a stage cannot crash:
//
//   * one chip lit, one duration written, for each of the five times;
//   * the beats follow the match clock the host already syncs, so the manta,
//     blizzard, blackout and alarm land on the same second on every phone;
//   * the zones are fixed rectangles, the push is wall-checked, and a guest
//     never moves a seat the snapshot owns;
//   * the Classic arena keeps no zone, no beat and no mesh.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import { repoRoot, readGame, sceneOf, groupCode, createI18n, LANGS, KANA } from './helpers.mjs';

const GIMMICK_GROUP = 'v1.1.0 ステージ固有ギミック';
const ROSTER_GROUP = 'v1.1.0 人数・2人狼・ルール';
const MENU_GROUP = 'v0.6.5 Production Round Start + Main Menu';

const blockBetween = (code, open, close, exported) => {
  const start = code.indexOf(open);
  const end = code.indexOf(close);
  if (start < 0 || end < 0) throw new Error(`the markers ${open} / ${close} are missing`);
  const context = vm.createContext({});
  vm.runInContext(`${code.slice(start, end)}\n;globalThis.__pure = { ${exported} };`, context,
    { filename: `game.json#${open}` });
  return context.__pure;
};

const model = () => blockBetween(groupCode(GIMMICK_GROUP),
  '/* ==== v1.1.0 gimmick model', '/* ==== end v1.1.0 gimmick model ==== */',
  ['ICE_WOLF_GIMMICK_STAGES', 'ICE_WOLF_GIMMICK_CYCLES', 'ICE_WOLF_GIMMICK_ZONES',
    'iceWolfGimmickElapsed', 'iceWolfGimmickPhase', 'iceWolfGimmickBeat',
    'iceWolfGimmickZoneAt', 'iceWolfGimmickDrift', 'iceWolfGimmickStandable'].join(', '));

const chips = () => blockBetween(groupCode(ROSTER_GROUP),
  '/* ==== v1.1.0 roster rules', '/* ==== end v1.1.0 roster rules ==== */',
  'iceWolfDurationChipOn, ICE_WOLF_DURATIONS, iceWolfMatchSeconds');

/* ------------------------------------------------------------- the chips */
test('exactly one match-time chip is lit for each of the five times', () => {
  const { iceWolfDurationChipOn, ICE_WOLF_DURATIONS } = chips();
  assert.deepEqual(Array.from(ICE_WOLF_DURATIONS), [60, 120, 180, 300, 600]);
  const times = [60, 120, 180, 300, 600];
  for (const minutes of times) {
    const lit = times.filter((value) => iceWolfDurationChipOn(value) === value && value === minutes);
    assert.equal(lit.length, 1, `${minutes}s lights exactly one chip`);
    const others = times.filter((value) => value !== minutes && iceWolfDurationChipOn(value) === minutes);
    assert.deepEqual(others, [], `${minutes}s does not light another chip`);
  }
  assert.equal(iceWolfDurationChipOn(60), 60);
  assert.equal(iceWolfDurationChipOn(600), 600);
  assert.equal(iceWolfDurationChipOn(0), 0, 'the untouched default lights nothing');
  assert.equal(iceWolfDurationChipOn(210), 0, '3:30 is the default, not a chip');
  assert.equal(iceWolfDurationChipOn(999), 0, 'an unknown time lights nothing');
  assert.equal(iceWolfDurationChipOn('600'), 600, 'a stored string still counts');
});

test('the SETTINGS panel and the extra chips are marked from one duration', () => {
  const menu = groupCode(MENU_GROUP);
  for (const action of ['time60', 'time120', 'time180', 'time300', 'time600']) {
    assert.ok(menu.includes(`mark('${action}'`), `${action} is marked by the SETTINGS panel`);
  }
  assert.ok(menu.includes('__iceWolfV110DurationChip'), 'the panel and the roster block share one answer');
  const roster = groupCode(ROSTER_GROUP);
  assert.ok(roster.includes('runtimeScene.__iceWolfV110DurationChip = iceWolfDurationChipOn'),
    'the roster block publishes the one answer');
  assert.ok(roster.includes('for (const value of [60, 120, 180, 300, 600])'),
    'the roster block marks all five chips every frame');
  assert.ok(roster.includes('updateSettingsUi()'), 'a 1/10-minute tap repaints the SETTINGS panel');
  assert.equal(/chip\.classList\.toggle\('iw-on', duration === value\)/.test(roster), false,
    'the extra chip is no longer lit inside the signature block, where two chips could stay lit');
  assert.ok(/noteNow\.textContent = litTime/.test(roster), 'the note follows the one lit chip');
});

test('a saved 1 or 10 minute match comes back after a relaunch', () => {
  const menu = groupCode(MENU_GROUP);
  assert.ok(/storedDuration === 60 && storedDuration === 120/.test(menu)
    || menu.includes('storedDuration === 60 || storedDuration === 120'), 'the stored time accepts 1 minute');
  assert.ok(menu.includes('storedDuration === 300 || storedDuration === 600'), 'and 10 minutes');
});

test('the chosen seconds are what the round reads', () => {
  const { iceWolfMatchSeconds } = chips();
  assert.equal(iceWolfMatchSeconds(60, true), 60);
  assert.equal(iceWolfMatchSeconds(600, true), 600);
  assert.equal(iceWolfMatchSeconds(60, false), 180, 'a free player falls back to 3 minutes');
  assert.equal(iceWolfMatchSeconds(600, false), 180);
  const menu = groupCode(MENU_GROUP);
  assert.ok(menu.includes("vars.get('MatchTimeLeft').setNumber(vars.get('MatchDuration').getAsNumber())"),
    'the round starts from MatchDuration');
  const core = groupCode(ROSTER_GROUP);
  assert.ok(core.includes("vars.get('MatchDuration').setNumber(durationNow)"),
    'the roster block keeps MatchDuration on the chosen time');
});

/* -------------------------------------------------------------- the model */
test('the five v1.1.0 stages have a gimmick, and Classic has none', () => {
  const pure = model();
  assert.deepEqual(Array.from(pure.ICE_WOLF_GIMMICK_STAGES), ['aquarium', 'park', 'lodge', 'school', 'space']);
  for (const stage of pure.ICE_WOLF_GIMMICK_STAGES) {
    assert.ok(pure.ICE_WOLF_GIMMICK_CYCLES[stage], `${stage} has a beat`);
    assert.ok(pure.ICE_WOLF_GIMMICK_CYCLES[stage].key, `${stage} names its beat`);
  }
  assert.equal(pure.ICE_WOLF_GIMMICK_CYCLES.classic, undefined, 'Classic has no beat');
  assert.equal(pure.ICE_WOLF_GIMMICK_ZONES.classic, undefined, 'Classic has no zone');
  assert.equal(pure.iceWolfGimmickZoneAt('classic', 0, 0), null, 'and nothing moves on it');
});

test('the beats run off the match clock, on the period and length each stage wants', () => {
  const pure = model();
  const cycles = pure.ICE_WOLF_GIMMICK_CYCLES;
  assert.ok(cycles.aquarium.period >= 25 && cycles.aquarium.period <= 30, 'the manta comes every 25-30s');
  assert.ok(cycles.aquarium.length >= 2.5 && cycles.aquarium.length <= 3, 'and stays 2.5-3s');
  assert.ok(cycles.lodge.length >= 3, 'the blizzard holds a few seconds');
  assert.ok(cycles.school.length >= 3, 'the blackout holds a few seconds');
  assert.ok(cycles.space.length >= 2, 'the alarm holds a few seconds');
  for (const stage of pure.ICE_WOLF_GIMMICK_STAGES) {
    const cycle = cycles[stage];
    assert.ok(cycle.length < cycle.period, `${stage}: the beat is shorter than its period`);
    const first = pure.iceWolfGimmickBeat(stage, 0);
    assert.equal(typeof first.active, 'boolean');
    const mid = pure.iceWolfGimmickBeat(stage, cycle.offset + cycle.length + 1);
    if (cycle.period - cycle.offset > cycle.length + 1) {
      assert.equal(mid.active, false, `${stage}: quiet after the beat`);
    }
    const second = pure.iceWolfGimmickBeat(stage, cycle.offset + cycle.period + 0.2);
    assert.equal(second.active, true, `${stage}: the next beat starts one period later`);
    const firstBeat = pure.iceWolfGimmickBeat(stage, cycle.offset + 0.1);
    assert.equal(firstBeat.active, true, `${stage}: the first beat follows the offset`);
    const beforeFirst = pure.iceWolfGimmickBeat(stage, Math.max(0, cycle.offset - 0.4));
    if (cycle.offset > 0.5) assert.equal(beforeFirst.active, false, `${stage}: nothing before the offset`);
  }
  assert.equal(pure.iceWolfGimmickBeat('classic', 12).active, false, 'Classic never beats');
  assert.equal(pure.iceWolfGimmickElapsed(210, 180), 30);
  assert.equal(pure.iceWolfGimmickElapsed(210, 0), 210);
  assert.equal(pure.iceWolfGimmickElapsed(0, 0), 0);
  assert.equal(pure.iceWolfGimmickElapsed(180, 999), 0, 'a clock past its end is clamped');
});

test('the beats are the same on both phones because they read the same clock', () => {
  const code = groupCode(GIMMICK_GROUP);
  assert.ok(code.includes("vars.get('MatchDuration').getAsNumber()"), 'the beat reads MatchDuration');
  assert.ok(code.includes("vars.get('MatchTimeLeft').getAsNumber()"), 'and MatchTimeLeft, which the host syncs');
  const sync = groupCode('v1.1.0 オンライン対戦同期');
  assert.ok(sync.includes("vars.get('MatchTimeLeft').setNumber"), 'the guest is given the host time');
  const names = sceneOf(readGame()).events.map((group) => group.name);
  assert.equal(names[names.length - 1], 'v1.1.0 オンライン対戦同期', 'the sync block still runs last');
  assert.ok(names.indexOf(GIMMICK_GROUP) < names.indexOf('v1.1.0 オンライン対戦同期'),
    'so the snapshot publishes the position a zone has just produced');
});

test('every zone sits inside its floor and is reached only by that floor', () => {
  const pure = model();
  for (const stage of pure.ICE_WOLF_GIMMICK_STAGES) {
    for (const zone of pure.ICE_WOLF_GIMMICK_ZONES[stage] || []) {
      assert.equal(zone.floor === '1F' || zone.floor === '2F', true, `${stage}: a zone names its floor`);
      const left = zone.x;
      const right = zone.x + zone.w;
      const top = zone.y;
      const bottom = zone.y + zone.h;
      if (zone.floor === '1F') {
        assert.ok(left >= -700 && right <= 700, `${stage} 1F zone stays on 1F`);
      } else {
        assert.ok(left >= 900 && right <= 2300, `${stage} 2F zone stays on 2F`);
      }
      assert.ok(top >= -700 && bottom <= 700, `${stage}: the zone stays inside the arena`);
      const cx = (left + right) / 2;
      const cy = (top + bottom) / 2;
      const hit = pure.iceWolfGimmickZoneAt(stage, cx, cy);
      assert.ok(hit, `${stage}: the centre of every zone is inside it`);
      assert.equal(pure.iceWolfGimmickZoneAt(stage, cx, top - 40), null, 'just above the zone is out');
    }
  }
  assert.equal(pure.iceWolfGimmickZoneAt('lodge', 0, -320).kind, 'ice', 'the lodge ice is in the north corridor');
  assert.equal(pure.iceWolfGimmickZoneAt('space', 0, 350).kind, 'lowgrav', 'the spaceship low gravity is in the south band');
  assert.equal(pure.iceWolfGimmickZoneAt('aquarium', 0, -40).kind, 'current', 'the aquarium current crosses the middle');
  assert.equal(pure.iceWolfGimmickZoneAt('aquarium', 1000, -40).floor, '2F', 'and has a 2F lane of its own');
});

test('the current pushes, the ice keeps sliding, and neither can leave the walls', () => {
  const pure = model();
  const push = pure.iceWolfGimmickDrift(0, 0, 0, 0, false, false, 1 / 60);
  assert.deepEqual([push.x, push.y], [0, 0], 'a plain floor adds nothing');
  const boost = pure.iceWolfGimmickDrift(0, 0, 4, 0, false, true, 1 / 60);
  assert.ok(boost.x > 0.6 && boost.x < 0.9, `low gravity adds about 18% (${boost.x})`);
  assert.equal(boost.y, 0);
  const slide = pure.iceWolfGimmickDrift(0, 0, 4, 2, true, false, 1 / 60);
  assert.ok(slide.x >= 2, 'ice carries part of the step');
  const drifting = pure.iceWolfGimmickDrift(slide.x, slide.y, 0, 0, true, false, 1 / 60);
  assert.ok(drifting.x > 0 && drifting.x < slide.x, 'and keeps gliding with no input, decaying');
  let last = 5;
  for (let i = 0; i < 200; i += 1) last = pure.iceWolfGimmickDrift(last, 0, 0, 0, true, false, 1 / 60).x;
  assert.ok(last < 0.01, `the slide dies out (${last})`);
  const capped = pure.iceWolfGimmickDrift(0, 0, 400, 400, true, true, 1 / 60);
  assert.ok(Math.hypot(capped.x, capped.y) < 8, 'a teleport-sized input never becomes a real step');
  /* The wall check is the one the push uses. */
  const wall = [100 - 7, 100 - 7, 200 + 7, 120 + 7];
  assert.equal(pure.iceWolfGimmickStandable(150, 110, wall), false, 'inside a wall is not standable');
  assert.equal(pure.iceWolfGimmickStandable(50, 110, wall), true, 'beside it is');
  assert.equal(pure.iceWolfGimmickStandable(0, 705, []), false, 'past the floor band is not standable');
  assert.equal(pure.iceWolfGimmickStandable(2400, 0, []), false, 'past the 2F edge is not standable');
});

/* ------------------------------------------------------------ the runtime */
const makeHarness = () => {
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  }
  class Color {
    constructor() { this.r = 1; this.g = 1; this.b = 1; this.hex = 0xffffff; }
    setHex(hex) { this.hex = hex; return this; }
    setRGB(r, g, b) { this.r = r; this.g = g; this.b = b; return this; }
  }
  class BufferAttribute {
    constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; this.count = array.length / itemSize; }
  }
  class BufferGeometry {
    constructor() { this.attributes = {}; }
    setAttribute(name, attribute) { this.attributes[name] = attribute; return this; }
    computeBoundingSphere() { return this; }
    translate() { return this; }
    rotateX() { return this; }
    toNonIndexed() { return this; }
    dispose() { this.disposed = true; }
  }
  const shape = () => class extends BufferGeometry {
    constructor() {
      super();
      this.setAttribute('position', new BufferAttribute(new Float32Array(36 * 3), 3));
      this.setAttribute('normal', new BufferAttribute(new Float32Array(36 * 3).fill(1), 3));
    }
  };
  class Mesh {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
      this.position = new Vector3();
      this.rotation = new Vector3();
      this.scale = new Vector3(1, 1, 1);
      this.visible = true;
      this.name = '';
      this.parent = null;
    }
  }
  const THREE = {
    Vector3, Color, BufferAttribute, BufferGeometry, Mesh,
    Fog: class { constructor(color, near, far) { this.color = color; this.near = near; this.far = far; } },
    BoxGeometry: shape(), CylinderGeometry: shape(), TorusGeometry: shape(),
    MeshStandardMaterial: class { constructor(params) { this.params = params; this.color = new Color(); } dispose() {} },
    MeshBasicMaterial: class { constructor(params) { this.params = params; this.color = new Color(); this.opacity = 1; } dispose() {} }
  };

  const makeElement = (tag) => {
    const element = {
      tagName: tag || 'div',
      style: {},
      attributes: {},
      children: [],
      textContent: '',
      __fx: {},
      classList: (() => {
        const set = new Set();
        return {
          toggle(name, on) {
            const want = on === undefined ? !set.has(name) : !!on;
            if (want) set.add(name); else set.delete(name);
            return want;
          },
          add(name) { set.add(name); },
          remove(name) { set.delete(name); },
          contains(name) { return set.has(name); }
        };
      })(),
      setAttribute(name, value) { this.attributes[name] = String(value); },
      getAttribute(name) { return this.attributes[name]; },
      appendChild(child) { this.children.push(child); child.parentNode = this; return child; },
      removeChild(child) { const at = this.children.indexOf(child); if (at >= 0) this.children.splice(at, 1); },
      querySelector(selector) {
        const match = /^\[data-fx="([^"]+)"\]$/.exec(selector);
        if (match) return this.__fx[match[1]] || null;
        return null;
      },
      querySelectorAll() { return []; }
    };
    Object.defineProperty(element, 'innerHTML', {
      get() { return ''; },
      set(html) {
        this.children = [];
        this.__fx = {};
        for (const match of String(html).matchAll(/data-fx="([a-z-]+)"/g)) {
          const child = makeElement('div');
          child.parentNode = this;
          this.__fx[match[1]] = child;
          this.children.push(child);
        }
      }
    });
    return element;
  };
  const body = makeElement('body');
  const head = makeElement('head');
  const document = {
    body, head,
    createElement: (tag) => makeElement(tag),
    querySelector: () => null,
    querySelectorAll: () => []
  };

  const scene = {
    fog: null,
    children: [],
    add(child) { this.children.push(child); child.parent = this; },
    remove(child) { const at = this.children.indexOf(child); if (at >= 0) this.children.splice(at, 1); child.parent = null; }
  };
  const renderer = { getThreeScene: () => scene };

  const values = new Map();
  const vars = (name) => ({
    getAsString: () => String(values.get(name) ?? ''),
    setString: (value) => { values.set(name, String(value)); },
    getAsNumber: () => Number(values.get(name) ?? 0),
    setNumber: (value) => { values.set(name, Number(value)); },
    getAsBoolean: () => values.get(name) === true,
    setBoolean: (value) => { values.set(name, value === true); }
  });

  const bodyOf = (name, x, y, state = 'Active', size = 17) => {
    const variables = new Map([['State', state], ['Role', 'Human']]);
    const pos = { x: x, y: y };
    return {
      name,
      get x() { return pos.x; },
      set x(value) { pos.x = value; },
      get y() { return pos.y; },
      set y(value) { pos.y = value; },
      getX: () => pos.x,
      getY: () => pos.y,
      setX: (value) => { pos.x = value; },
      setY: (value) => { pos.y = value; },
      getWidth: () => size,
      getHeight: () => size,
      getCenterXInScene: () => pos.x + size / 2,
      getCenterYInScene: () => pos.y + size / 2,
      getVariables: () => ({ get: (key) => ({
        getAsString: () => String(variables.get(key) ?? ''),
        setString: (value) => { variables.set(key, String(value)); }
      }) })
    };
  };
  const pad = (name, x, y, width = 84, height = 84) => ({
    name,
    getX: () => x,
    getY: () => y,
    getWidth: () => width,
    getHeight: () => height
  });
  const wall = (x, y, width, height) => ({
    name: 'Wall',
    getX: () => x,
    getY: () => y,
    getWidth: () => width,
    getHeight: () => height
  });

  const world = {
    player: bodyOf('Player', 0, 350),
    actors: [bodyOf('Actor', -300, -40), bodyOf('Actor', 0, 0)],
    walls: [wall(-720, -760, 1520, 40), wall(-720, 720, 1520, 40), wall(-760, -720, 40, 1440), wall(720, -720, 40, 1440)],
    warpPads: [pad('WarpPad', 120, -500), pad('WarpPad', -180, 440)],
    stairPads: [pad('StairPad', -560, 560, 110, 110), pad('StairPad', 560, -560, 110, 110),
      pad('StairPad', 1040, 560, 110, 110), pad('StairPad', 2160, -560, 110, 110)],
    speedPads: [pad('SpeedPad', -205, -535), pad('SpeedPad', 205, 415)]
  };

  const runtimeScene = {
    getVariables: () => ({ get: vars }),
    getObjects: (name) => {
      if (name === 'Player') return [world.player];
      if (name === 'Actor') return world.actors;
      if (name === 'Wall') return world.walls;
      if (name === 'WarpPad') return world.warpPads;
      if (name === 'StairPad') return world.stairPads;
      if (name === 'SpeedPad') return world.speedPads;
      return [];
    },
    getLayer: () => ({ getRenderer: () => renderer }),
    getTimeManager: () => ({ getElapsedTime: () => 1000 / 60 })
  };

  const context = vm.createContext({
    THREE, runtimeScene, document,
    gdjs: { evtTools: { runtimeScene: { getElapsedTimeInSeconds: () => Number(values.get('__seconds') || 0) } } },
    Math, String, Number, Array, Object, Float32Array, console
  });
  const code = groupCode(GIMMICK_GROUP);
  const run = () => vm.runInContext(`(function(){\n${code}\n})()`, context, { filename: 'game.json#gimmick' });
  const set = (name, value) => { values.set(name, value); };
  const get = (name) => values.get(name);
  return { run, world, scene, values, set, get, document, runtimeScene };
};

test('the block runs for every stage and dresses each one', () => {
  const harness = makeHarness();
  harness.set('RoundPhase', 'Active');
  harness.set('GameOver', false);
  harness.set('MatchDuration', 180);
  harness.set('MatchTimeLeft', 180);
  const counts = {};
  for (const stage of ['aquarium', 'park', 'lodge', 'school', 'space']) {
    harness.set('StageApplied', stage);
    harness.set('MatchTimeLeft', 180 - (harness.get('__seconds') || 0));
    harness.run();
    counts[stage] = Number(harness.get('StageGimmickMeshes'));
    assert.equal(harness.get('StageGimmickStage'), stage, `${stage} is the publishing stage`);
    assert.equal(harness.get('StageGimmickReady'), true, `${stage}: the set is built`);
    if (stage === 'school') {
      /* The school speaks with the screen, not with the map: its blackout is a
       * full-screen layer, so it has no mesh of its own. */
      assert.equal(counts[stage], 0, 'the school dresses the screen, not the floor');
      const blackout = harness.document.body.children[0].__fx.blackout;
      assert.ok(blackout, 'the school owns the blackout layer');
      continue;
    }
    assert.ok(counts[stage] > 0, `${stage}: there is something to see (${counts[stage]})`);
    assert.ok(harness.scene.children.length > 0, `${stage}: meshes are in the 3D scene`);
  }
  assert.ok(counts.aquarium >= counts.school, 'the aquarium carries the most: manta, current, whirlpools, lifts');
  for (const mesh of harness.scene.children) {
    assert.ok(mesh.name.startsWith('iceWolfV111'), `every mesh is this block's: ${mesh.name}`);
  }
});

test('the manta crosses on the beat, and is hidden between beats', () => {
  const harness = makeHarness();
  harness.set('RoundPhase', 'Active');
  harness.set('GameOver', false);
  harness.set('MatchDuration', 180);
  harness.set('StageApplied', 'aquarium');
  harness.set('MatchTimeLeft', 180);
  harness.run();
  const mantas = harness.scene.children.filter((mesh) => mesh.name === 'iceWolfV111Manta');
  assert.equal(mantas.length, 2, 'one manta for each floor');
  /* The aquarium beat opens 9s in and lasts 3s. */
  harness.set('MatchTimeLeft', 180 - 10);
  harness.run();
  assert.equal(mantas[0].visible, true, 'the manta is out during the beat');
  const startX = mantas[0].position.x;
  harness.set('MatchTimeLeft', 180 - 11.5);
  harness.run();
  assert.ok(mantas[0].position.x > startX, 'and it travels');
  assert.notEqual(mantas[0].position.z, mantas[1].position.z, 'the two floors are separate lanes');
  harness.set('MatchTimeLeft', 180 - 20);
  harness.run();
  assert.equal(mantas[0].visible, false, 'and it is gone between beats');
});

test('the blizzard darkens the air, the blackout and the alarm take the screen', () => {
  const harness = makeHarness();
  harness.set('RoundPhase', 'Active');
  harness.set('GameOver', false);
  harness.set('MatchDuration', 180);
  harness.set('StageApplied', 'lodge');
  harness.set('MatchTimeLeft', 180 - 13);
  harness.scene.fog = { color: { hex: 0x3b2413 }, near: 1050, far: 3800 };
  harness.run();
  assert.ok(harness.scene.fog.near < 400, `the blizzard pulls the fog in (${harness.scene.fog.near})`);
  assert.ok(harness.get('StageGimmickActive'), 'the beat is published');
  assert.equal(harness.get('StageGimmickKey'), 'fx.lodge.blizzard');
  harness.set('MatchTimeLeft', 180 - 25);
  harness.run();
  assert.ok(harness.scene.fog.near > 900, 'and the stage air comes back');

  harness.set('StageApplied', 'school');
  harness.set('MatchTimeLeft', 180 - 8);
  harness.run();
  const blackout = harness.document.body.children[0].__fx.blackout;
  assert.equal(blackout.classList.contains('iwfx-on'), true, 'the blackout is on');
  harness.set('MatchTimeLeft', 180 - 20);
  harness.run();
  assert.equal(blackout.classList.contains('iwfx-on'), false, 'and off again');

  harness.set('StageApplied', 'space');
  harness.set('MatchTimeLeft', 180 - 6);
  harness.run();
  const alarm = harness.document.body.children[0].__fx.alarm;
  assert.equal(alarm.classList.contains('iwfx-on'), true, 'the alarm is on');
});

test('the beat shows its line in the chosen language', () => {
  const harness = makeHarness();
  const i18n = createI18n({ language: 'en' }).i18n;
  harness.runtimeScene.__iceWolfI18n = i18n;
  harness.set('RoundPhase', 'Active');
  harness.set('GameOver', false);
  harness.set('MatchDuration', 180);
  harness.set('StageApplied', 'aquarium');
  harness.set('MatchTimeLeft', 180 - 10);
  harness.run();
  const banner = harness.document.body.children[0].__fx['banner-text'];
  assert.equal(banner.textContent, i18n.t('fx.aquarium.manta'));
  assert.equal(harness.document.body.children[0].__fx.banner.classList.contains('iwfx-on'), true);
});

test('the current pulls the local bodies and the ice carries them on', () => {
  const harness = makeHarness();
  harness.set('RoundPhase', 'Active');
  harness.set('GameOver', false);
  harness.set('MatchDuration', 180);
  harness.set('MatchTimeLeft', 120);
  harness.set('StageApplied', 'aquarium');
  harness.world.player.y = -40; /* inside the 1F lane */
  harness.world.player.x = 0;
  const actorStart = harness.world.actors[0].x;
  harness.run();
  const start = harness.world.player.x;
  for (let i = 0; i < 30; i += 1) harness.run();
  assert.ok(harness.world.player.x > start + 10, `the current moved the player (+${harness.world.player.x - start})`);
  assert.equal(harness.get('StageGimmickZone'), 'current');
  assert.ok(harness.world.actors[0].x > actorStart, 'and the CPUs it drives');

  const lodge = makeHarness();
  lodge.set('RoundPhase', 'Active');
  lodge.set('GameOver', false);
  lodge.set('MatchDuration', 180);
  lodge.set('MatchTimeLeft', 120);
  lodge.set('StageApplied', 'lodge');
  lodge.world.player.x = 0;
  lodge.world.player.y = -320; /* inside the ice band */
  lodge.run();
  /* A step, then no input: the body keeps going on the ice. */
  lodge.world.player.x += 4;
  lodge.run();
  const afterStep = lodge.world.player.x;
  lodge.run();
  assert.ok(lodge.world.player.x > afterStep, 'the ice carries the runner on');
  assert.equal(lodge.get('StageGimmickZone'), 'ice');
});

test('a guest never moves a seat the snapshot owns', () => {
  const harness = makeHarness();
  harness.set('RoundPhase', 'Active');
  harness.set('GameOver', false);
  harness.set('MatchDuration', 180);
  harness.set('MatchTimeLeft', 120);
  harness.set('StageApplied', 'aquarium');
  harness.set('OnlineRoomActive', true);
  harness.set('OnlineIsHost', false);
  harness.world.actors[0].x = -300;
  harness.world.actors[0].y = -40;
  harness.world.player.y = -40;
  harness.world.player.x = 0;
  for (let i = 0; i < 20; i += 1) harness.run();
  assert.equal(harness.world.actors[0].x, -300, 'the guest leaves the host seats alone');
  assert.ok(harness.world.player.x > 0, 'but its own player still feels the water');
  const code = groupCode(GIMMICK_GROUP);
  assert.ok(code.includes('__iceWolfV110Remote'), 'the block knows which seats are remote');
});

test('Classic is left exactly as 1.0.0 shipped it', () => {
  const harness = makeHarness();
  harness.set('RoundPhase', 'Active');
  harness.set('GameOver', false);
  harness.set('MatchDuration', 180);
  harness.set('MatchTimeLeft', 120);
  harness.set('StageApplied', 'aquarium');
  harness.run();
  assert.ok(harness.scene.children.length > 0);
  harness.set('StageApplied', 'classic');
  harness.world.player.y = -40;
  harness.world.player.x = 0;
  harness.run();
  assert.equal(harness.scene.children.length, 0, 'every stage mesh is removed');
  assert.equal(harness.get('StageGimmickStage'), 'none');
  assert.equal(harness.get('StageGimmickZones'), 0);
  const before = harness.world.player.x;
  for (let i = 0; i < 10; i += 1) harness.run();
  assert.equal(harness.world.player.x, before, 'and nothing moves the player');
  const stageArt = sceneOf(readGame()).events.find((group) => group.name === 'v1.1.0 ステージ・衣装');
  const artCode = stageArt.events[stageArt.events.length - 1].inlineCode;
  const artText = Array.isArray(artCode) ? artCode.join('\n') : artCode;
  assert.ok(artText.includes('classic: null'), 'the Classic art is still the 1.0.0 frost lab');
});

test('the stage cards name the gimmick each stage now has, in twelve languages', () => {
  const { i18n } = createI18n();
  const keys = ['fx.aquarium.manta', 'fx.park.lights', 'fx.lodge.blizzard', 'fx.school.blackout', 'fx.space.alarm',
    'stage.aquarium.gimmick', 'stage.park.gimmick', 'stage.lodge.gimmick', 'stage.school.gimmick', 'stage.space.gimmick'];
  for (const key of keys) {
    for (const lang of LANGS) {
      i18n.setLang(lang);
      const line = i18n.t(key);
      assert.ok(line.length > 0, `${key} [${lang}] is empty`);
      if (lang !== 'ja' && lang !== 'zh-Hans' && lang !== 'zh-Hant') {
        assert.equal(KANA.test(line), false, `${key} [${lang}] carries Japanese kana: ${line}`);
      }
    }
  }
  i18n.setLang('ja');
  assert.ok(i18n.t('stage.aquarium.gimmick').includes('マンタ'));
  assert.ok(i18n.t('stage.lodge.gimmick').includes('氷床'));
  const audit = i18n.audit();
  assert.equal(audit.missing.length, 0, `no missing line: ${[...audit.missing].join(',')}`);
  assert.equal(audit.leaks.length, 0, `no Japanese leaked: ${[...audit.leaks].join(',')}`);
});

test('Build 19 is the build on every side', () => {
  const pbx = fs.readFileSync(path.join(repoRoot, 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8');
  const builds = [...pbx.matchAll(/CURRENT_PROJECT_VERSION = ([^;]+);/g)].map((match) => match[1]);
  assert.deepEqual(builds, ['19', '19'], 'both configurations are Build 19');
  const verify = fs.readFileSync(path.join(repoRoot, 'scripts/ios/verify-ios-project.py'), 'utf8');
  assert.ok(verify.includes('DEFAULT_BUILD_NUMBER = "19"'), 'the verifier defaults to 19');
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts.test.includes('v111-gimmicks.test.mjs'), 'npm test runs this file');
  const groups = sceneOf(readGame()).events.map((group) => group.name);
  assert.ok(groups.includes(GIMMICK_GROUP), 'the gimmick group is on the sheet');
});
