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

import { repoRoot, readGame, sceneOf, groupCode, createI18n, LANGS, KANA, decodePng, assetPath } from './helpers.mjs';

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
    'iceWolfGimmickFloorOf', 'iceWolfGimmickZoneAt', 'iceWolfGimmickDrift', 'iceWolfGimmickStandable',
    'iceWolfGimmickBeatKey', 'ICE_WOLF_SCHOOL_ROOMS', 'ICE_WOLF_SCHOOL_DOORS',
    'ICE_WOLF_SCHOOL_DOORS_BY_FLOOR', 'iceWolfSchoolRoomIndex', 'iceWolfSchoolRoomTouch',
    'iceWolfSchoolDoor', 'iceWolfSchoolDoorStep', 'iceWolfSchoolDoorSide',
    'iceWolfSchoolDoorSweep', 'iceWolfSchoolDoorHold', 'ICE_WOLF_GRAVITY',
    'iceWolfGravityRandom', 'iceWolfGravityCells', 'iceWolfGravityCellAt',
    'ICE_WOLF_PARK', 'iceWolfParkStep'].join(', '));

/* The school's wall plan, read out of the stage block so the doors are checked
 * against the walls that actually ship. */
const schoolWalls = () => {
  const code = groupCode('v1.1.0 ステージ・衣装');
  const from = code.indexOf('  school: {');
  const to = code.indexOf('  space: {');
  if (from < 0 || to < 0) throw new Error('the school plan is missing');
  const plan = code.slice(from, to);
  const rects = [];
  for (const line of plan.split('\n')) {
    const match = /'(\d+)x(\d+)': \[(.*)\]/.exec(line);
    if (!match) continue;
    const width = Number(match[1]);
    const height = Number(match[2]);
    for (const pair of match[3].matchAll(/\[(-?\d+), (-?\d+)\]/g)) {
      rects.push({ x: Number(pair[1]), y: Number(pair[2]), w: width, h: height });
    }
  }
  return rects;
};
const overlaps = (a, b, pad = 0) => a.x < b.x + b.w - pad && a.x + a.w > b.x + pad
  && a.y < b.y + b.h - pad && a.y + a.h > b.y + pad;

const chips = () => blockBetween(groupCode(ROSTER_GROUP),
  '/* ==== v1.1.0 roster rules', '/* ==== end v1.1.0 roster rules ==== */',
  'iceWolfDurationChipOn, ICE_WOLF_DURATIONS, iceWolfMatchSeconds');

/* ------------------------------------------------------------- the chips */
test('exactly one match-time chip is lit for each of the four times', () => {
  const { iceWolfDurationChipOn, ICE_WOLF_DURATIONS } = chips();
  assert.deepEqual(Array.from(ICE_WOLF_DURATIONS), [60, 120, 180, 300]);
  const times = [60, 120, 180, 300];
  for (const minutes of times) {
    const lit = times.filter((value) => iceWolfDurationChipOn(value) === value && value === minutes);
    assert.equal(lit.length, 1, `${minutes}s lights exactly one chip`);
    const others = times.filter((value) => value !== minutes && iceWolfDurationChipOn(value) === minutes);
    assert.deepEqual(others, [], `${minutes}s does not light another chip`);
  }
  assert.equal(iceWolfDurationChipOn(60), 60);
  assert.equal(iceWolfDurationChipOn(300), 300);
  assert.equal(iceWolfDurationChipOn(600), 0, 'a stored ten-minute match lights nothing');
  assert.equal(iceWolfDurationChipOn(0), 0, 'the untouched default lights nothing');
  assert.equal(iceWolfDurationChipOn(210), 0, '3:30 is the default, not a chip');
  assert.equal(iceWolfDurationChipOn(999), 0, 'an unknown time lights nothing');
  assert.equal(iceWolfDurationChipOn('300'), 300, 'a stored string still counts');
});

test('the SETTINGS panel and the extra chips are marked from one duration', () => {
  const menu = groupCode(MENU_GROUP);
  for (const action of ['time60', 'time120', 'time180', 'time300']) {
    assert.ok(menu.includes(`mark('${action}'`), `${action} is marked by the SETTINGS panel`);
  }
  assert.ok(!menu.includes("mark('time600'"), 'the ten-minute chip is gone');
  assert.ok(menu.includes('__iceWolfV110DurationChip'), 'the panel and the roster block share one answer');
  const roster = groupCode(ROSTER_GROUP);
  assert.ok(roster.includes('runtimeScene.__iceWolfV110DurationChip = iceWolfDurationChipOn'),
    'the roster block publishes the one answer');
  assert.ok(roster.includes('for (const value of [60, 120, 180, 300])'),
    'the roster block marks all four chips every frame');
  assert.ok(roster.includes('updateSettingsUi()'), 'a 1/10-minute tap repaints the SETTINGS panel');
  assert.equal(/chip\.classList\.toggle\('iw-on', duration === value\)/.test(roster), false,
    'the extra chip is no longer lit inside the signature block, where two chips could stay lit');
  assert.ok(/noteNow\.textContent = litTime/.test(roster), 'the note follows the one lit chip');
});

test('a saved 1 minute comes back, and a saved 10 minutes comes back as 5', () => {
  const menu = groupCode(MENU_GROUP);
  assert.ok(menu.includes('storedDuration === 60 || storedDuration === 120'), 'the stored time accepts 1 minute');
  assert.ok(menu.includes('storedDuration === 300'), 'and 5 minutes');
  assert.ok(menu.includes('storedDuration === 600'), 'a legacy ten is recognised');
  assert.ok(menu.includes("vars.get('DurationPreference').setNumber(300)"), 'and comes back as five minutes');
  assert.ok(menu.includes("safeStorageSet('iceWolfMatchDuration', '300')"), 'and is rewritten, so it cannot come back');
});

test('the chosen seconds are what the round reads', () => {
  const { iceWolfMatchSeconds } = chips();
  assert.equal(iceWolfMatchSeconds(60, true), 60);
  assert.equal(iceWolfMatchSeconds(300, true), 300);
  assert.equal(iceWolfMatchSeconds(600, true), 300, 'a stored ten runs as five');
  assert.equal(iceWolfMatchSeconds(60, false), 180, 'a free player falls back to 3 minutes');
  assert.equal(iceWolfMatchSeconds(600, false), 300);
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
  assert.ok(cycles.school.warn >= 2 && cycles.school.warn <= 3, 'the chime rings 2-3 s before the doors');
  assert.equal(cycles.school.shut, 5, 'the classroom doors shut for five seconds');
  assert.equal(cycles.school.length, cycles.school.warn + cycles.school.shut, 'the beat is chime + shut');
  assert.ok(cycles.space.warn >= 2, 'the gravity warning comes before the cells');
  assert.ok(cycles.space.heavy >= 8, 'the cells stay up around ten seconds');
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
  assert.ok(code.includes("vars.get('OnlineStartSeconds')"), 'in a room the length is the host start payload');
  const sync = groupCode('v1.1.0 オンライン対戦同期');
  assert.ok(sync.includes("vars.get('MatchTimeLeft').setNumber"), 'the guest is given the host time');
  const names = sceneOf(readGame()).events.map((group) => group.name);
  assert.equal(names[names.length - 1], 'v1.1.0 オンライン対戦同期', 'the sync block still runs last');
  assert.ok(names.indexOf(GIMMICK_GROUP) < names.indexOf('v1.1.0 オンライン対戦同期'),
    'so the snapshot publishes the position a zone has just produced');
});

test('a guest times its beats against the host length, not its own default', () => {
  const harness = makeHarness();
  harness.set('StageApplied', 'aquarium');
  harness.set('RoundPhase', 'Active');
  harness.set('GameOver', false);
  harness.set('OnlineRoomActive', true);
  harness.set('OnlineIsHost', false);
  harness.set('OnlineStartSeconds', 180);
  harness.set('MatchDuration', 210); /* the guest never picked a time */
  harness.set('MatchTimeLeft', 180 - 10);
  harness.run();
  assert.equal(harness.get('StageGimmickElapsed'), 10, 'the elapsed time follows the host length');
  assert.equal(harness.get('StageGimmickActive'), true, 'so the manta lands on the host beat');
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
      /* Build 21: the classroom doors and the line around the classroom are
       * meshes, so a player sees which room is about to lock. */
      assert.equal(counts[stage], 2, 'the school builds its doors and its seal');
      const names = harness.scene.children.map((mesh) => mesh.name);
      assert.ok(names.includes('iceWolfV111Door'), 'the doors are meshes');
      assert.ok(names.includes('iceWolfV111Seal'), 'and so is the sealed boundary');
      assert.ok(harness.document.body.children[0].__fx.school, 'the school owns the lock layer');
      assert.equal(harness.document.body.children[0].__fx.blackout, undefined, 'the blackout is gone');
      continue;
    }
    assert.ok(counts[stage] > 0, `${stage}: there is something to see (${counts[stage]})`);
    assert.ok(harness.scene.children.length > 0, `${stage}: meshes are in the 3D scene`);
  }
  assert.ok(counts.aquarium >= counts.school, 'the aquarium carries the most: manta, current, whirlpools, lifts');
  for (const mesh of harness.scene.children) {
    assert.ok(mesh.name.startsWith('iceWolfV111'), `every mesh is this block's: ${mesh.name}`);
  }

  /* The aquarium in full: the manta, the current (arrows and bubbles), a
   * whirlpool on each warp and a bubble lift on each stair, beside the two zone
   * decals. */
  harness.set('StageApplied', 'aquarium');
  harness.run();
  const names = harness.scene.children.map((mesh) => mesh.name);
  const count = (kind) => names.filter((name) => name === kind).length;
  assert.equal(count('iceWolfV111Manta'), 2, 'a manta for each floor');
  assert.equal(count('iceWolfV111Zone'), 2, 'a current lane on each floor');
  assert.ok(count('iceWolfV111Arrow') >= 10, 'the lane is drawn with arrows');
  assert.ok(count('iceWolfV111Bubble') >= 6, 'and with bubbles');
  assert.equal(count('iceWolfV111Whirl'), 2, 'both warps wear a whirlpool');
  assert.equal(count('iceWolfV111Lift'), 4, 'all four stairs wear a bubble lift');

  /* The park hangs a bulb string, the spaceship a row of alarm lamps.
   * Build 20: the park also lays a light pool on each floor's floor, and puts
   * two ferris wheels and the balloon bunches on its border (the art block). */
  harness.set('StageApplied', 'park');
  harness.run();
  assert.equal(harness.scene.children.filter((mesh) => mesh.name === 'iceWolfV111Bulbs').length, 1,
    'the park has its string of bulbs');
  const pools = harness.scene.children.filter((mesh) => mesh.name === 'iceWolfV111Pool');
  assert.equal(pools.length, 4, 'two pools on each floor');
  for (const pool of pools) {
    assert.ok(pool.position.z > 0 && pool.position.z < 8, 'a pool lies flat on the boards');
    assert.equal(pool.material.params.transparent, true, 'a pool never hides the floor');
    assert.equal(pool.frustumCulled, false, 'a pool is drawn from every camera');
  }
  harness.set('StageApplied', 'space');
  harness.run();
  assert.equal(harness.scene.children.filter((mesh) => mesh.name === 'iceWolfV111Lamps').length, 1,
    'the spaceship has its alarm lamps');
});

test('the manta crosses on the beat, and is hidden between beats', () => {  const harness = makeHarness();
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

test('the blizzard darkens the air; the school locks a room and the ship warns', () => {
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

  /* The school beat opens 6 s in: 2.5 s of chime, then five shut seconds. */
  harness.set('StageApplied', 'school');
  harness.set('MatchTimeLeft', 180 - 7);
  harness.run();
  const chime = harness.document.body.children[0].__fx.chime;
  const lock = harness.document.body.children[0].__fx.school;
  assert.equal(harness.get('StageGimmickDoor'), 'chime', 'the chime is the first half');
  assert.equal(chime.classList.contains('iwfx-on'), true, 'the chime shows');
  assert.equal(lock.classList.contains('iwfx-on'), false, 'the doors are still open');
  harness.set('MatchTimeLeft', 180 - 9);
  harness.run();
  assert.equal(harness.get('StageGimmickDoor'), 'shut', 'then the doors shut');
  assert.equal(lock.classList.contains('iwfx-on'), true, 'the lock shows');
  assert.equal(chime.classList.contains('iwfx-on'), false, 'and the chime stops');
  harness.set('MatchTimeLeft', 180 - 14);
  harness.run();
  assert.equal(harness.get('StageGimmickDoor'), 'open', 'five seconds later they open on their own');

  /* The ship warns, and then the screen is left alone while the cells are up. */
  harness.set('StageApplied', 'space');
  harness.set('MatchTimeLeft', 180 - 9);
  harness.run();
  const warn = harness.document.body.children[0].__fx.warn;
  assert.equal(warn.classList.contains('iwfx-on'), true, 'the gravity warning is a small one');
  assert.equal(harness.get('StageGimmickKey'), 'fx.space.alarm');
  harness.set('MatchTimeLeft', 180 - 12);
  harness.run();
  assert.equal(warn.classList.contains('iwfx-on'), false, 'and it clears when the cells come up');
  assert.equal(harness.get('StageGimmickKey'), 'fx.space.gravity');
  assert.equal(harness.get('StageGimmickGravity'), 6, 'six heavy cells are up');
  assert.equal(harness.document.body.children[0].__fx.alarm, undefined, 'the red screen flood is gone');
});

test('the classroom doors shut for five seconds and nobody crosses them', () => {
  const harness = makeHarness();
  harness.set('RoundPhase', 'Active');
  harness.set('GameOver', false);
  harness.set('MatchDuration', 300);
  harness.set('MatchTimeLeft', 300 - 9); /* 6s offset + 2.5s chime + 0.5s shut */
  harness.set('StageApplied', 'school');
  harness.world.player.x = 0;
  harness.world.player.y = 0; /* inside the 1F classroom band */
  harness.world.actors[0].x = 620;
  harness.world.actors[0].y = 0; /* outside, east of the east door */
  harness.run();
  assert.equal(harness.get('StageGimmickDoor'), 'shut');
  assert.ok(harness.get('StageGimmickSealed') >= 1, 'the body in the classroom is held');

  /* The player inside walks at the west door: the door face holds it. */
  for (let i = 0; i < 30; i += 1) {
    harness.world.player.x -= 12;
    harness.run();
  }
  assert.ok(harness.world.player.x >= -652, `the body stays in the classroom (${harness.world.player.x})`);
  assert.equal(harness.world.player.y, 0, 'and is not pushed along the room');

  /* The body outside walks at the east door: it never gets in. */
  for (let i = 0; i < 30; i += 1) {
    harness.world.actors[0].x -= 12;
    harness.run();
  }
  assert.ok(harness.world.actors[0].getCenterXInScene() > 555, 'the body outside stays outside');
  assert.equal(harness.world.actors[0].y, 0);

  /* Five seconds later the doors open by themselves. */
  harness.set('MatchTimeLeft', 300 - 14);
  harness.run();
  assert.equal(harness.get('StageGimmickDoor'), 'open');
  harness.world.player.x = 0;
  harness.run();
  harness.world.player.x -= 12;
  harness.run();
  assert.ok(harness.world.player.x < 0, 'and the classroom lets the runner out again');
});

test('the doors fill the doorways the classroom walls leave', () => {
  const pure = model();
  const walls = schoolWalls();
  assert.ok(walls.length >= 20, `the school plan is read (${walls.length} walls)`);
  const doors = pure.ICE_WOLF_SCHOOL_DOORS;
  assert.ok(doors.length >= 10, `${doors.length} doors`);

  /* No door stands in a wall, sits on another door, or wears a width of its own:
   * each is as deep as the wall it fills. */
  for (const door of doors) {
    for (const wall of walls) {
      assert.equal(overlaps(door, wall, 0.5), false,
        `the ${door.floor} door at ${door.x},${door.y} is not inside a wall`);
    }
    const depth = door.axis === 'y' ? door.h : door.w;
    assert.ok(depth >= 18 && depth <= 32, `a door is a wall leaf (${depth})`);
    assert.equal(pure.iceWolfGimmickFloorOf(door.x + door.w / 2), door.floor);
  }
  for (let i = 0; i < doors.length; i += 1) {
    for (let j = i + 1; j < doors.length; j += 1) {
      assert.equal(overlaps(doors[i], doors[j], 0.5), false, 'two doors never share a space');
    }
  }

  /* Every doorway is exactly spanned by one door: both ends of a bar's door touch
   * a wall of that same bar, so a panel can never sit beside the gap it belongs
   * to, and an end door is at least as tall as the band it closes. */
  for (const door of doors) {
    if (door.axis === 'y') {
      const left = walls.filter((wall) => Math.abs(wall.y - door.y) < 1
        && Math.abs(wall.x + wall.w - door.x) < 1);
      const right = walls.filter((wall) => Math.abs(wall.y - door.y) < 1
        && Math.abs(wall.x - (door.x + door.w)) < 1);
      assert.equal(left.length, 1, `the ${door.floor} door at x ${door.x} starts at a wall end`);
      assert.equal(right.length, 1, `and ends at a wall end (${door.x + door.w})`);
      continue;
    }
    const room = pure.ICE_WOLF_SCHOOL_ROOMS.find((entry) => entry.floor === door.floor);
    assert.ok(door.h >= room.h, 'an end door covers the whole end of the band');
    const edge = door.side > 0 ? room.x : room.x + room.w;
    assert.equal(Math.abs(door.x + (door.side > 0 ? door.w : 0) - edge) < 1, true,
      'and it is fitted to that end');
  }

  /* Nothing walks around a door either: every point of the room's boundary is a
   * wall or a shut door, so the room is sealed. */
  for (const room of pure.ICE_WOLF_SCHOOL_ROOMS) {
    const floorDoors = pure.ICE_WOLF_SCHOOL_DOORS_BY_FLOOR[room.floor];
    const covered = (x, y) => walls.concat(floorDoors).some((rect) => x >= rect.x - 1 && x <= rect.x + rect.w + 1
      && y >= rect.y - 1 && y <= rect.y + rect.h + 1);
    for (let x = room.x; x <= room.x + room.w; x += 2) {
      assert.equal(covered(x, room.y), true, `${room.floor} north edge is sealed at x ${x}`);
      assert.equal(covered(x, room.y + room.h), true, `${room.floor} south edge is sealed at x ${x}`);
    }
    for (let y = room.y; y <= room.y + room.h; y += 2) {
      assert.equal(covered(room.x, y), true, `${room.floor} west edge is sealed at y ${y}`);
      assert.equal(covered(room.x + room.w, y), true, `${room.floor} east edge is sealed at y ${y}`);
    }
  }
});

test('a shut door puts a body back on its own side, along the door alone', () => {
  const pure = model();
  const doors = pure.ICE_WOLF_SCHOOL_DOORS;
  const half = 8.5;
  for (const door of doors) {
    /* A body that was inside is put on the room side of the door; a body that
     * was out is put on the other side. Neither is ever left inside the door. */
    const cx = door.x + door.w / 2;
    const cy = door.y + door.h / 2;
    const inside = pure.iceWolfSchoolDoorStep(door, cx, cy, half, true);
    const outside = pure.iceWolfSchoolDoorStep(door, cx, cy, half, false);
    const onRoomSide = (step) => (door.axis === 'y'
      ? (door.side > 0 ? step.y >= door.y + door.h + half - 0.01 : step.y <= door.y - half + 0.01)
      : (door.side > 0 ? step.x >= door.x + door.w + half - 0.01 : step.x <= door.x - half + 0.01));
    assert.equal(inside.hit, true, `${door.floor} door ${door.x},${door.y} was hit`);
    assert.equal(onRoomSide(inside), true, 'the inside body lands on the room face');
    assert.equal(onRoomSide(outside), false, 'the outside body lands on the far face');
    if (door.axis === 'y') {
      assert.equal(inside.x, cx, 'a long door only moves the body across itself');
      assert.equal(outside.x, cx);
    } else {
      assert.equal(inside.y, cy, 'an end door only moves it along the hall');
      assert.equal(outside.y, cy);
    }
    /* Standing clear of the door is left exactly as it is. */
    const clear = pure.iceWolfSchoolDoorStep(door, cx + door.w * 3, cy + door.h * 3, half, true);
    assert.equal(clear.hit, false, 'a body outside the door is not moved');
  }
  /* The door is solid from the far side too: a body walking at the 1F west door
   * from the room stops at the room face, never inside the leaf. */
  const west = doors.find((door) => door.floor === '1F' && door.axis === 'x' && door.side > 0);
  const walked = pure.iceWolfSchoolDoorStep(west, -650, 0, half, true);
  assert.ok(walked.x >= -660 + half - 0.01, `held inside the room (${walked.x})`);
});

/* ------------------------------------ Build 22: a door that cannot be slipped
 * Build 21's seal moved a body to its own face — and, when that exact spot was
 * "taken", to the far face or to nowhere at all. The wall rectangles carry their
 * 7px margin, so the few pixels beside a doorway are always "taken": a player
 * brushing a doorway edge walked straight through the shut leaf, and the end
 * doors posted bodies into the classroom. These walk every door of both floors —
 * from the hall and from the classroom, at the doorway centre and at its edges —
 * at a walking step, at a lagged frame and in one 240px jump, for the player, a
 * CPU and the wolf, and no body ever ends on the other side. */
const schoolHarness = () => {
  const harness = makeHarness();
  harness.world.walls = schoolWalls().map((rect) => ({
    name: 'Wall',
    getX: () => rect.x,
    getY: () => rect.y,
    getWidth: () => rect.w,
    getHeight: () => rect.h
  }));
  harness.runtimeScene.__iceWolfV074Rects = null;
  harness.set('StageApplied', 'school');
  harness.set('RoundPhase', 'Active');
  harness.set('GameOver', false);
  harness.set('MatchDuration', 180);
  return harness;
};
const doorsAt = (harness, elapsed) => harness.set('MatchTimeLeft', 180 - elapsed);

/* The three bodies the game moves: the player (human or wolf, one object), and
 * the CPUs. The seal reads `State` and the guest flag only, so what it does for
 * one it does for all three. */
const wolfActor = (harness) => {
  const wolf = harness.world.actors[1];
  wolf.getVariables = () => ({ get: (key) => ({
    getAsString: () => (key === 'State' ? 'Active' : key === 'Role' ? 'Wolf' : ''),
    setString() {}
  }) });
  return wolf;
};

/* One walk at a shut door: the doors are open for one frame first, the way a
 * round always is, so the shut's first frame knows the spot the body held. */
const walkAtDoor = ({ harness, body, start, dx, dy, step, frames = 70, insideOf }) => {
  body.setX(start.x);
  body.setY(start.y);
  body.__iceWolfV111Seal = null;
  doorsAt(harness, 20);
  harness.run();
  doorsAt(harness, 9);
  const startedInside = insideOf(body.getCenterXInScene(), body.getCenterYInScene());
  for (let i = 0; i < frames; i += 1) {
    body.setX(body.getX() + dx * step);
    body.setY(body.getY() + dy * step);
    harness.run();
    const inside = insideOf(body.getCenterXInScene(), body.getCenterYInScene());
    if (inside !== startedInside) {
      return { frame: i + 1, x: Math.round(body.getCenterXInScene()), y: Math.round(body.getCenterYInScene()) };
    }
  }
  return null;
};

/* Where a body starts for one side of one door, and which way it walks. */
const doorApproach = (door, fromRoom, gap) => {
  const roomIsGreater = door.side > 0;
  if (door.axis === 'y') {
    const y = (fromRoom === roomIsGreater)
      ? (roomIsGreater ? door.y + door.h + gap : door.y - gap)
      : (roomIsGreater ? door.y - gap : door.y + door.h + gap);
    return { start: { y }, dx: 0, dy: y > door.y + door.h / 2 ? -1 : 1 };
  }
  const x = (fromRoom === roomIsGreater)
    ? (roomIsGreater ? door.x + door.w + gap : door.x - gap)
    : (roomIsGreater ? door.x - gap : door.x + door.w + gap);
  return { start: { x }, dx: x > door.x + door.w / 2 ? -1 : 1, dy: 0 };
};

test('a shut door holds the player, a CPU and the wolf — walked, lagged or jumped at', () => {
  const pure = model();
  const insideOf = (x, y) => pure.iceWolfSchoolRoomIndex(x, y) >= 0;
  const harness = schoolHarness();
  const kinds = [
    ['player', () => harness.world.player],
    ['cpu', () => harness.world.actors[0]],
    ['wolf', () => wolfActor(harness)]
  ];
  for (const [kind, pick] of kinds) {
    for (const door of pure.ICE_WOLF_SCHOOL_DOORS) {
      const gap = door.axis === 'y' ? 90 : 40;
      for (const fromRoom of [true, false]) {
        const approach = doorApproach(door, fromRoom, gap);
        const start = door.axis === 'y'
          ? { x: door.x + door.w / 2 - 8.5, y: approach.start.y - 8.5 }
          : { x: approach.start.x - 8.5, y: door.y + door.h / 2 - 8.5 };
        for (const step of [4.3, 8.7, 60, 240]) {
          const leak = walkAtDoor({ harness, body: pick(), start, dx: approach.dx, dy: approach.dy, step, insideOf });
          const doorName = `${door.floor} ${door.axis} door at ${door.x},${door.y}`;
          assert.equal(leak, null, `${kind} (${step}px a frame) from ${fromRoom ? 'the classroom' : 'the hall'} through the ${doorName}: ${JSON.stringify(leak)}`);
        }
      }
    }
  }
  /* The shut really was shut while all of that was walked. */
  assert.equal(harness.get('StageGimmickDoor'), 'shut');
});

test('a doorway edge is as solid as its middle', () => {
  const pure = model();
  const insideOf = (x, y) => pure.iceWolfSchoolRoomIndex(x, y) >= 0;
  const harness = schoolHarness();
  const body = harness.world.player;
  for (const door of pure.ICE_WOLF_SCHOOL_DOORS) {
    const edge = door.axis === 'y'
      ? [door.x + 2, door.x + 8, door.x + door.w - 8, door.x + door.w - 2]
      : [door.y + 2, door.y + 8, door.y + door.h - 8, door.y + door.h - 2];
    for (const spot of edge) {
      for (const fromRoom of [true, false]) {
        const approach = doorApproach(door, fromRoom, door.axis === 'y' ? 70 : 40);
        const start = door.axis === 'y'
          ? { x: spot - 8.5, y: approach.start.y - 8.5 }
          : { x: approach.start.x - 8.5, y: spot - 8.5 };
        for (const step of [4.3, 8.7, 60]) {
          const leak = walkAtDoor({ harness, body, start, dx: approach.dx, dy: approach.dy, step, insideOf });
          assert.equal(leak, null,
            `the ${door.floor} door at ${door.x},${door.y} leaks at its edge ${spot} (${step}px, from ${fromRoom ? 'the room' : 'the hall'}): ${JSON.stringify(leak)}`);
        }
      }
    }
  }
});

test('the end doors never post a body into the classroom', () => {
  const pure = model();
  const insideOf = (x, y) => pure.iceWolfSchoolRoomIndex(x, y) >= 0;
  const harness = schoolHarness();
  const body = harness.world.player;
  /* Build 21 shoved a body standing in the last few pixels of the hall — the own
   * face sat inside a wall's margin — onto the far face, i.e. into the room. */
  const cases = [
    { floor: '1F', x: -697, y: 0 },
    { floor: '1F', x: -690, y: 60 },
    { floor: '2F', x: 1100, y: -300 },
    { floor: '2F', x: 1120, y: 0 },
    { floor: '2F', x: 1990, y: 0 }
  ];
  for (const spot of cases) {
    for (const dx of [1, -1]) {
      for (const step of [4.3, 26, 120]) {
        const start = { x: spot.x - 8.5, y: spot.y - 8.5 };
        const leak = walkAtDoor({ harness, body, start, dx, dy: 0, step, insideOf });
        assert.equal(leak, null, `${spot.floor} hall spot ${spot.x},${spot.y} walking ${dx > 0 ? 'east' : 'west'} at ${step}px: ${JSON.stringify(leak)}`);
      }
    }
  }
});

test('a body the shut caught inside stays inside, even at a run', () => {
  const pure = model();
  const insideOf = (x, y) => pure.iceWolfSchoolRoomIndex(x, y) >= 0;
  const harness = schoolHarness();
  const body = harness.world.player;
  for (const door of pure.ICE_WOLF_SCHOOL_DOORS) {
    const gap = door.axis === 'y' ? 90 : 40;
    const approach = doorApproach(door, true, gap);
    const start = door.axis === 'y'
      ? { x: door.x + door.w / 2 - 8.5, y: approach.start.y - 8.5 }
      : { x: approach.start.x - 8.5, y: door.y + door.h / 2 - 8.5 };
    for (const step of [4.3, 26, 60, 240]) {
      const leak = walkAtDoor({ harness, body, start, dx: approach.dx, dy: approach.dy, step, insideOf });
      assert.equal(leak, null, `a body inside the ${door.floor} door at ${door.x},${door.y} got out at ${step}px: ${JSON.stringify(leak)}`);
    }
  }
});

test('the door model reads the side from the step, and the step cannot jump the leaf', () => {
  const pure = model();
  const door = pure.ICE_WOLF_SCHOOL_DOORS[0];
  const half = 8.5;
  assert.equal(pure.iceWolfSchoolDoorSide(door, -410, -300, false), -1, 'from the hall it stays on the hall side');
  assert.equal(pure.iceWolfSchoolDoorSide(door, -410, 0, true), 1, 'from the room it stays on the room side');
  assert.equal(pure.iceWolfSchoolDoorSide(door, -410, -300, true), -1, 'the step wins over the room it claims');
  const face = pure.iceWolfSchoolDoorHold(door, -410, -140, half, -1, () => true);
  assert.equal(face.x, -410, 'a body is only moved across its door');
  assert.equal(face.y, door.y - half, 'the free face is the face itself');
  const pushed = pure.iceWolfSchoolDoorHold(door, -410, -140, half, -1, (x, y) => y <= door.y - 20);
  assert.ok(pushed.y <= door.y - 20, `a taken face steps away from the door, never across it (${JSON.stringify(pushed)})`);
  assert.equal(pure.iceWolfSchoolDoorHold(door, -410, -140, half, -1, () => false), null, 'no free spot reports null');
  /* The sweep: a step that starts and ends clear of the leaf but crosses it. */
  assert.equal(pure.iceWolfSchoolDoorSweep(door, -410, -200, -410, 0, half), true, 'a 200px jump is caught');
  assert.equal(pure.iceWolfSchoolDoorSweep(door, -410, -200, -410, -160, half), false, 'a short step outside is not');
  assert.equal(pure.iceWolfSchoolDoorSweep(door, -410, -148.5, -300, -148.5, half), false, 'sliding along the face is not a crossing');
  assert.equal(pure.iceWolfSchoolDoorSweep(door, -700, -170, -410, -170, half), false, 'walking past it, clear of the wall, is not');
  /* The body's own box, not its centre, decides which classroom it belongs to. */
  assert.ok(pure.iceWolfSchoolRoomTouch(door.x + 40, door.y + door.h + 4, half) >= 0, 'half inside the inner face is inside');
  assert.equal(pure.iceWolfSchoolRoomTouch(door.x + 40, door.y - 40, half), -1, 'out in the hall is out');
});

/* ------------------------------------ Build 22: the doors count down, in words
 * チャイム中は「あと3秒で教室が閉まる」、ロック中は「あと5秒」…と1秒ずつ減る。 */
test('the school counts down to the shut and back to open', () => {
  const pure = model();
  const cycle = pure.ICE_WOLF_GIMMICK_CYCLES.school;
  const at = (offset) => pure.iceWolfSchoolDoor(cycle.offset + offset);
  assert.equal(at(0).chime, true);
  assert.equal(at(0).closingLeft, 3, 'the chime starts at three seconds');
  assert.equal(at(1).closingLeft, 2);
  assert.equal(at(2).closingLeft, 1);
  assert.equal(at(2.5).chime, false, 'the chime is over when the doors shut');
  assert.equal(at(2.5).shut, true);
  assert.equal(at(2.5).left, 5, 'the lock opens at five seconds');
  assert.equal(at(3.5).left, 4);
  assert.equal(at(4.5).left, 3);
  assert.equal(at(5.5).left, 2);
  assert.equal(at(6.5).left, 1);
  assert.equal(at(7.4).left, 1, 'the last second is still shown');
  assert.equal(at(7.5).shut, false, 'and then the doors are open');
  for (let t = 0; t < cycle.warn; t += 0.1) {
    assert.equal(at(t).closingLeft, Math.ceil(cycle.warn - t), `whole seconds before the shut at ${t}`);
  }
  for (let t = cycle.warn; t < cycle.length; t += 0.05) {
    const door = at(t);
    assert.equal(door.left, Math.ceil(cycle.length - t), `whole seconds of lock at ${t}`);
    assert.ok(door.left >= 1 && door.left <= cycle.shut, `the lock reads 1..5 (${door.left})`);
  }
});

test('the lock banner counts down in the chosen language and never blinks', () => {
  const harness = schoolHarness();
  const i18n = createI18n({ language: 'ja' }).i18n;
  harness.runtimeScene.__iceWolfI18n = i18n;
  const fx = () => harness.document.body.children[0].__fx;
  const pill = () => fx().banner;
  const text = () => fx()['banner-text'];
  /* The chime: あと3秒 → 2 → 1. */
  doorsAt(harness, 6.2);
  harness.run();
  assert.equal(harness.get('StageGimmickDoor'), 'chime');
  assert.equal(harness.get('StageGimmickCountdown'), 3);
  assert.equal(text().textContent, '🔔 あと3秒で教室が閉まる');
  doorsAt(harness, 7.2);
  harness.run();
  assert.equal(harness.get('StageGimmickCountdown'), 2);
  assert.equal(text().textContent, '🔔 あと2秒で教室が閉まる');
  /* The lock: あと5秒 → 4 → … → 1, and the pill stays up the whole time. */
  const seen = [];
  for (let tenths = 0; tenths < 50; tenths += 1) {
    doorsAt(harness, 8.5 + tenths * 0.1);
    harness.run();
    assert.equal(harness.get('StageGimmickDoor'), 'shut');
    assert.equal(pill().classList.contains('iwfx-on'), true, `the pill is up ${tenths / 10}s into the lock`);
    const left = harness.get('StageGimmickCountdown');
    assert.ok(left >= 1 && left <= 5, `the lock counts 1..5 (${left})`);
    assert.equal(text().textContent, `🔒 教室ロック中 あと${left}秒`);
    if (seen[seen.length - 1] !== left) seen.push(left);
  }
  assert.deepEqual(seen, [5, 4, 3, 2, 1], 'one step a second, in order, with no gaps');
  /* And every language names the number. */
  for (const lang of LANGS) {
    i18n.setLang(lang);
    for (const key of ['fx.school.chime', 'fx.school.doors']) {
      const line = i18n.t(key, { n: 3 });
      assert.ok(line.includes('3'), `${key} [${lang}] counts in the sentence: ${line}`);
      assert.equal(line.includes('{n}'), false, `${key} [${lang}] filled the number in`);
    }
  }
  i18n.setLang('ja');
});

test('the doors never take a switch away for good', () => {
  const pure = model();
  const cycle = pure.ICE_WOLF_GIMMICK_CYCLES.school;
  /* Walk a whole period: the shut is always followed by open time, whatever the
   * match clock is doing, so the room cannot stay locked. */
  let shutSeconds = 0;
  let openSeconds = 0;
  for (let t = cycle.offset; t < cycle.offset + cycle.period; t += 0.25) {
    const door = pure.iceWolfSchoolDoor(t);
    if (door.shut) shutSeconds += 0.25;
    else openSeconds += 0.25;
  }
  assert.ok(shutSeconds >= cycle.shut - 0.3 && shutSeconds <= cycle.shut + 0.3, `five shut seconds (${shutSeconds})`);
  assert.ok(openSeconds > cycle.shut * 2, 'and far more open time');
  for (const room of pure.ICE_WOLF_SCHOOL_ROOMS) {
    assert.equal(pure.iceWolfSchoolRoomIndex(room.x + room.w / 2, room.y + room.h / 2) >= 0, true, `${room.floor} room centre`);
    assert.equal(pure.iceWolfSchoolRoomIndex(room.x - 200, room.y + room.h / 2), -1, `${room.floor} outside the room`);
  }
});

test('the heavy cells are the same six on every phone', () => {
  const pure = model();
  const walls = [-720, -760, 800, -720, -720, 720, 800, 760];
  const first = pure.iceWolfGravityCells(4242, walls);
  const again = pure.iceWolfGravityCells(4242, walls);
  const other = pure.iceWolfGravityCells(4243, walls);
  assert.equal(first.length, 6, 'six cells');
  assert.deepEqual(first, again, 'the same seed draws the same six');
  assert.notDeepEqual(first, other, 'a new round draws new ones');
  assert.equal(first.filter((cell) => cell.floor === '1F').length, 3, 'three on each floor');
  assert.equal(first.filter((cell) => cell.floor === '2F').length, 3);
  for (let i = 0; i < first.length; i += 1) {
    const cell = first[i];
    assert.ok(cell.x >= -660 && cell.x <= 2260, 'the cell is on the map');
    assert.ok(cell.y >= -660 && cell.y <= 660, 'and inside the arena band');
    if (cell.floor === '1F') assert.ok(cell.x <= 660, 'a 1F cell is on 1F');
    else assert.ok(cell.x >= 940, 'a 2F cell is on 2F');
    for (let j = i + 1; j < first.length; j += 1) {
      const gap = Math.hypot(cell.x - first[j].x, cell.y - first[j].y);
      assert.ok(gap >= 140, `two cells never overlap (${gap})`);
    }
  }
  /* A wall keeps a cell off it. */
  const blocked = pure.iceWolfGravityCells(4242, [400, -60, 700, 60]);
  for (const cell of blocked) {
    const hit = cell.x + 70 > 400 && cell.x - 70 < 700 && cell.y + 70 > -60 && cell.y - 70 < 60;
    assert.equal(hit, false, 'no cell is drawn on a wall');
  }
  assert.ok(pure.iceWolfGravityCellAt(first, first[0].x, first[0].y, 8.5), 'the centre of a cell is on it');
  assert.equal(pure.iceWolfGravityCellAt(first, first[0].x + 200, first[0].y + 200, 8.5), null, 'and 200px away is not');
});

test('a body on a heavy cell moves at 55%, and at full speed once the cells go', () => {
  const harness = makeHarness();
  harness.set('RoundPhase', 'Active');
  harness.set('GameOver', false);
  harness.set('MatchDuration', 300);
  harness.set('MatchTimeLeft', 300 - 11); /* 8s offset + 2.5s warning + 0.5s of cells */
  harness.set('StageApplied', 'space');
  /* A fixed room seed: the cells are drawn once and the test always walks the
   * same one, instead of depending on the round's own draw. */
  harness.set('OnlineRoomActive', true);
  harness.set('OnlineIsHost', true);
  harness.set('OnlineStartSeed', 4242);
  harness.run();
  assert.equal(harness.get('StageGimmickSeed'), 4242);
  assert.equal(harness.get('StageGimmickGravity'), 6, 'the cells are up');
  const cells = harness.scene.children.filter((mesh) => mesh.name === 'iceWolfV111Heavy');
  assert.equal(cells.length, 6, 'one mesh per cell');
  assert.equal(cells[0].visible, true, 'and they are drawn');
  const onFirstFloor = cells.find((mesh) => mesh.position.x < 792);
  harness.world.player.x = onFirstFloor.position.x - 8.5;
  harness.world.player.y = onFirstFloor.position.y - 8.5;
  harness.run();
  harness.run();
  assert.equal(harness.get('StageGimmickSlow'), true, 'the player feels the gravity');
  const start = harness.world.player.x;
  for (let i = 0; i < 10; i += 1) {
    harness.world.player.x += 10;
    harness.run();
  }
  const moved = harness.world.player.x - start;
  assert.ok(moved > 45 && moved < 65, `about 55 of 100px (${moved.toFixed(1)})`);
  assert.equal(harness.get('StageGimmickZone'), 'heavy');

  /* The window closes ten seconds later: the cells go and the speed is back. */
  harness.set('MatchTimeLeft', 300 - 25);
  harness.run();
  assert.equal(harness.get('StageGimmickGravity'), 0, 'the cells are gone');
  assert.equal(cells[0].visible, false, 'and their meshes with them');
  harness.world.player.x = onFirstFloor.position.x - 8.5;
  harness.run();
  const freeStart = harness.world.player.x;
  for (let i = 0; i < 10; i += 1) {
    harness.world.player.x += 10;
    harness.run();
  }
  assert.equal(harness.world.player.x - freeStart, 100, 'a plain floor is full speed');
});

test('a guest draws its cells from the host seed, not its own round', () => {
  const harness = makeHarness();
  harness.set('RoundPhase', 'Active');
  harness.set('GameOver', false);
  harness.set('MatchDuration', 300);
  harness.set('MatchTimeLeft', 300 - 11);
  harness.set('StageApplied', 'space');
  harness.set('OnlineRoomActive', true);
  harness.set('OnlineIsHost', false);
  harness.set('OnlineStartSeed', 777);
  harness.run();
  assert.equal(harness.get('StageGimmickSeed'), 777, 'the host seed is the round seed');
  const cells = model().iceWolfGravityCells(777, []);
  assert.ok(cells.length === 6, 'and the host seed deals six cells of its own');
  const host = makeHarness();
  host.set('RoundPhase', 'Active');
  host.set('GameOver', false);
  host.set('MatchDuration', 300);
  host.set('MatchTimeLeft', 300 - 11);
  host.set('StageApplied', 'space');
  host.set('OnlineRoomActive', true);
  host.set('OnlineIsHost', true);
  host.set('OnlineStartSeed', 777);
  host.run();
  assert.equal(host.get('StageGimmickSeed'), 777, 'both phones read the same seed');
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
  const keys = ['fx.aquarium.manta', 'fx.park.lights', 'fx.lodge.blizzard', 'fx.school.chime', 'fx.school.doors',
    'fx.space.alarm', 'fx.space.gravity',
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
  /* Build 21: the park's card and banner say what the parade does, and for how
   * long, in every language. */
  assert.match(i18n.t('fx.park.lights'), /パレード/);
  assert.match(i18n.t('fx.park.lights'), /5秒/);
  assert.match(i18n.t('stage.park.gimmick'), /スピードUP（5秒）/);
  for (const lang of LANGS) {
    i18n.setLang(lang);
    assert.match(i18n.t('fx.park.lights'), /5/, `fx.park.lights [${lang}] names the five seconds`);
    assert.match(i18n.t('stage.park.gimmick'), /5/, `stage.park.gimmick [${lang}] names the five seconds`);
  }
  i18n.setLang('ja');
  const audit = i18n.audit();
  assert.equal(audit.missing.length, 0, `no missing line: ${[...audit.missing].join(',')}`);
  assert.equal(audit.leaks.length, 0, `no Japanese leaked: ${[...audit.leaks].join(',')}`);
});

test('Build 23 is the build on every side', () => {
  const pbx = fs.readFileSync(path.join(repoRoot, 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8');
  const builds = [...pbx.matchAll(/CURRENT_PROJECT_VERSION = ([^;]+);/g)].map((match) => match[1]);
  assert.deepEqual(builds, ['23', '23'], 'both configurations are Build 23');
  const verify = fs.readFileSync(path.join(repoRoot, 'scripts/ios/verify-ios-project.py'), 'utf8');
  assert.ok(verify.includes('DEFAULT_BUILD_NUMBER = "23"'), 'the verifier defaults to 23');
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts.test.includes('v111-gimmicks.test.mjs'), 'npm test runs this file');
  /* Build 23: the ONLINE button is pressed in a test of its own now, so the
   * file that catches a dead button runs with the rest. */
  assert.ok(pkg.scripts.test.includes('v110-online-open.test.mjs'), 'npm test presses the ONLINE button');
  const groups = sceneOf(readGame()).events.map((group) => group.name);
  assert.ok(groups.includes(GIMMICK_GROUP), 'the gimmick group is on the sheet');
});

/* ------------------------------------------------- Build 20: the park, rebuilt
 * Build 19's park laid a stripe curtain over the top and bottom 15% of the
 * screen - exactly where 生存 / スイッチ / ゲート and the clock are - and its wall
 * was four saturated stripes behind them. These keep the HUD band clear and the
 * new show in the arena. */
test('the park never draws over the HUD band', () => {
  const code = groupCode(GIMMICK_GROUP);
  assert.doesNotMatch(code, /repeating-linear-gradient\(90deg,rgba\(255,120,210/,
    'the stripe curtain is gone');
  assert.doesNotMatch(code, /iwfx-park:before\{top:0\}/, 'nothing sits on the top edge');
  assert.match(code, /\.iwfx-park\{overflow:hidden;-webkit-mask-image:linear-gradient\(to bottom,rgba\(0,0,0,0\) 0,rgba\(0,0,0,0\) 16%/,
    'the park layer fades out above the HUD');
  assert.match(code, /iw111sweep/, 'the spotlights sweep');
  assert.match(code, /iw111confetti/, 'the beat throws confetti');
});

test('the park parade speeds everyone up for five seconds', () => {
  const pure = model();
  const cycle = pure.ICE_WOLF_GIMMICK_CYCLES.park;
  assert.equal(cycle.length, 5, 'the parade lasts five seconds');
  assert.equal(cycle.key, 'fx.park.lights');
  assert.ok(cycle.period >= cycle.length * 2, 'and leaves more quiet time than parade time');
  assert.equal(pure.ICE_WOLF_PARK.speed, 1.35, 'everyone runs at 135%');
  const boost = pure.iceWolfParkStep(10, -4, true);
  assert.ok(Math.abs(boost.x - 3.5) < 1e-9, `a 10px step becomes 13.5px (${boost.x})`);
  assert.ok(Math.abs(boost.y + 1.4) < 1e-9, 'in the direction the body was already going');
  const still = pure.iceWolfParkStep(10, -4, false);
  assert.equal(still.x === 0 && still.y === 0, true, 'and nothing outside the parade');

  /* Two full periods: five of every sixteen seconds are parade time. */
  let parade = 0;
  for (let t = 0; t < cycle.period * 2; t += 0.25) {
    if (pure.iceWolfGimmickBeat('park', t).active) parade += 0.25;
  }
  assert.ok(Math.abs(parade - cycle.length * 2) < 0.3, `two parades in two periods (${parade})`);
});

test('every body on the park floor moves at 135% during the parade', () => {
  const harness = makeHarness();
  harness.set('RoundPhase', 'Active');
  harness.set('GameOver', false);
  harness.set('MatchDuration', 300);
  harness.set('MatchTimeLeft', 300 - 2); /* the park beat opens at 0s */
  harness.set('StageApplied', 'park');
  harness.world.player.x = 0;
  harness.world.player.y = 0;
  const actorStart = harness.world.actors[0].x;
  harness.run();
  assert.equal(harness.get('StageGimmickParade'), true, 'the parade is on');
  assert.equal(harness.get('StageGimmickSpeed'), 1.35);
  const start = harness.world.player.x;
  for (let i = 0; i < 10; i += 1) {
    harness.world.player.x += 10;
    harness.world.actors[0].x += 10;
    harness.run();
  }
  const moved = harness.world.player.x - start;
  assert.ok(moved > 130 && moved < 140, `100px of walking is about 135px (${moved.toFixed(1)})`);
  assert.ok(harness.world.actors[0].x - actorStart > 130, 'and the CPUs it drives get it too');
  assert.equal(harness.get('StageGimmickZone'), 'parade');

  /* The parade ends: the same walk is the plain 100px again. */
  harness.set('MatchTimeLeft', 300 - 8);
  harness.run();
  assert.equal(harness.get('StageGimmickParade'), false, 'the parade is over');
  assert.equal(harness.get('StageGimmickSpeed'), 1);
  const after = harness.world.player.x;
  for (let i = 0; i < 10; i += 1) {
    harness.world.player.x += 10;
    harness.run();
  }
  assert.equal(harness.world.player.x - after, 100, 'a plain floor is full speed');
});

test('the park\'s light pools turn all match and open up on the beat', () => {
  const harness = makeHarness();
  harness.set('RoundPhase', 'Active');
  harness.set('GameOver', false);
  harness.set('MatchDuration', 180);
  harness.set('MatchTimeLeft', 180);
  harness.set('StageApplied', 'park');
  harness.run();
  const pools = harness.scene.children.filter((mesh) => mesh.name === 'iceWolfV111Pool');
  assert.equal(pools.length, 4);
  const before = pools.map((pool) => pool.rotation.z);
  harness.set('__seconds', 1);
  harness.set('MatchTimeLeft', 179);
  harness.run();
  pools.forEach((pool, index) => assert.notEqual(pool.rotation.z, before[index], 'the pool turned'));

  /* The park beat runs 0-6s of every 16s: 8s in is quiet. */
  harness.set('MatchTimeLeft', 180 - 8);
  harness.run();
  const quiet = pools[0].material.opacity;
  harness.set('MatchTimeLeft', 180 - 1);
  harness.run();
  assert.ok(pools[0].material.opacity > quiet, 'the pool opens up on the beat');
});

test('the park hangs ferris wheels and balloons on its border, never in a lane', () => {
  const group = sceneOf(readGame()).events.find((event) => event.name === 'v1.1.0 ステージ・衣装');
  const code = group.events[group.events.length - 1].inlineCode;
  const text = Array.isArray(code) ? code.join('\n') : code;
  assert.ok(text.includes("balloon: ["), 'the balloons are a prop kit of their own');
  assert.match(text, /if \(stageId === 'park' && art && art\.extra === 'park'\)/, 'the park adds its own dressing');
  assert.match(text, /kit: 'wheel'/, 'the ferris wheel stands on a side wall');
  assert.match(text, /kit: 'balloon'/, 'the balloons stand on the south wall');
  assert.match(text, /if \(y > 10000\) continue;/, 'parked walls are still skipped');
});

test('the park\'s floor is quiet enough for the toys to read on', () => {
  /* The three v1.1.0 stage floors keep a local contrast of about 20 levels so
   * the toys, pads, gates and ice are the bright things in the frame. */
  const png = decodePng(assetPath('floor_park.png'));
  const at = (x, y) => {
    const i = y * png.stride + x * png.channels;
    if (png.colour === 3) {
      const index = png.pixels[i] * 3;
      return [png.palette[index], png.palette[index + 1], png.palette[index + 2]];
    }
    return [png.pixels[i], png.pixels[i + 1], png.pixels[i + 2]];
  };
  let low = 255;
  let high = 0;
  for (let y = 4; y < png.height; y += 8) {
    for (let x = 4; x < png.width; x += 8) {
      const [r, g, b] = at(x, y);
      const level = 0.299 * r + 0.587 * g + 0.114 * b;
      low = Math.min(low, level);
      high = Math.max(high, level);
    }
  }
  assert.ok(high - low < 46, `the park floor stays quiet (${(high - low).toFixed(1)})`);
  assert.ok(low > 120, `the park floor is warm and light, so the dark outfits read (${low.toFixed(1)})`);
});
