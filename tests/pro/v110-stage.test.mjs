// The v1.1.0 Phase 1 stages: six floor plans that are provably playable.
//
// The test reads game.json, takes the stage table and the plans out of the
// shipping block, and proves for every stage, on both floors:
//
//   * the plan uses only wall sizes the scene owns, and never more of a size
//     than it has instances of;
//   * every wall sits inside its floor's band and clears every pad, switch spot
//     and gate spot by 6px;
//   * one connected walkable component (16px grid, body inflated) reaches the
//     player spawn, all nine CPU spawns, the four stair pads, both warps, both
//     speed floors, all ten switch spots and all ten gate spots;
//   * both floors stay open (no cut-off pockets, at least 2600 walkable cells).
//
// It also checks the twelve-language lines for the stage screens and that the
// block only ever moves a wall (never resizes one).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import { groupCode, readGame, sceneOf, createI18n, LANGS, KANA } from './helpers.mjs';

const STAGE_GROUP = 'v1.1.0 ステージ・衣装';
const CELL = 16;
const BODY = 9;
const FLOOR_1F = { x0: -704, y0: -704, x1: 704, y1: 704, minX: -700, maxX: 700 };
const FLOOR_2F = { x0: 848, y0: -704, x1: 2304, y1: 704, minX: 900, maxX: 2300 };
const WARP = [[120, -500, 84, 84], [-180, 440, 84, 84]];
const SPEED = [[-205, -535, 84, 84], [205, 415, 84, 84]];
const STAIR = [[-560, 560, 84, 84], [560, -560, 84, 84], [1040, 560, 84, 84], [2160, -560, 84, 84]];
const SWITCH_SPOTS = [[-660, 480], [0, 600], [600, 300], [-620, 0], [-40, -600], [520, -60],
  [920, 600], [1560, 400], [1560, -400], [2180, 40]];
const GATE_SPOTS = [[-650, -650], [590, 590], [-48, -48], [300, -600], [580, -300],
  [930, -300], [2180, 300], [1558, 580], [980, -620], [2150, -60]];
const SWITCH_SIZE = 64;
const GATE_SIZE = 72;
const SPAWNS = [[-488.5, -8.5], [1050, -350], [471.5, -8.5], [2100, -350], [-8.5, -458.5],
  [1050, 350], [-488.5, -458.5], [2100, 350], [471.5, 441.5]];
const PLAYER_SPAWN = [0, 350];

const stageCode = () => {
  const code = groupCode(STAGE_GROUP);
  const start = code.indexOf('/* ==== v1.1.0 stage data');
  const end = code.indexOf('/* ==== end v1.1.0 stage data ==== */');
  if (start < 0 || end < 0) throw new Error('the stage data markers are missing');
  const source = `${code.slice(start, end)}
  ;globalThis.__stage = { ICE_WOLF_STAGES, ICE_WOLF_STAGE_WALLS, ICE_WOLF_STAGE_ORDER,
    ICE_WOLF_WALL_CAPACITY, iceWolfStageById, iceWolfStagePlayable, iceWolfStageView,
    iceWolfStageIndex, iceWolfStageLocked, iceWolfStageFreeCount, iceWolfStageStep };`;
  const context = vm.createContext({});
  vm.runInContext(source, context, { filename: 'game.json#v1.1.0 stage data' });
  return context.__stage;
};

const stage = stageCode();

const rects = (plan) => Object.entries(plan).flatMap(([size, positions]) => {
  const [w, h] = size.split('x').map(Number);
  return positions.map(([x, y]) => ({ x, y, w, h }));
});

const overlaps = (a, b, margin = 0) => a.x - margin < b.x + b.w && a.x + a.w + margin > b.x
  && a.y - margin < b.y + b.h && a.y + a.h + margin > b.y;

const gridFor = (box, walls) => {
  const w = Math.round((box.x1 - box.x0) / CELL);
  const h = Math.round((box.y1 - box.y0) / CELL);
  const walk = new Uint8Array(w * h).fill(1);
  for (let j = 0; j < h; j += 1) {
    const cy = box.y0 + (j + 0.5) * CELL;
    for (let i = 0; i < w; i += 1) {
      const cx = box.x0 + (i + 0.5) * CELL;
      if (cx < box.minX || cx > box.maxX || cy < -699 || cy > 700) walk[j * w + i] = 0;
    }
  }
  for (const wall of walls) {
    const left = wall.x - BODY;
    const top = wall.y - BODY;
    const right = wall.x + wall.w + BODY;
    const bottom = wall.y + wall.h + BODY;
    const i0 = Math.max(0, Math.floor((left - box.x0) / CELL));
    const i1 = Math.min(w - 1, Math.ceil((right - box.x0) / CELL) - 1);
    const j0 = Math.max(0, Math.floor((top - box.y0) / CELL));
    const j1 = Math.min(h - 1, Math.ceil((bottom - box.y0) / CELL) - 1);
    for (let j = j0; j <= j1; j += 1) for (let i = i0; i <= i1; i += 1) walk[j * w + i] = 0;
  }
  return { w, h, walk, box };
};

const cellOf = (grid, x, y) => [Math.floor((x - grid.box.x0) / CELL), Math.floor((y - grid.box.y0) / CELL)];

const nearest = (grid, i, j, ring = 3) => {
  if (i >= 0 && j >= 0 && i < grid.w && j < grid.h && grid.walk[j * grid.w + i]) return j * grid.w + i;
  let best = -1;
  for (let r = 1; r <= ring && best < 0; r += 1) {
    for (let dj = -r; dj <= r; dj += 1) {
      for (let di = -r; di <= r; di += 1) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= grid.w || nj >= grid.h) continue;
        if (grid.walk[nj * grid.w + ni] && best < 0) best = nj * grid.w + ni;
      }
    }
  }
  return best;
};

const flood = (grid, start) => {
  const seen = new Uint8Array(grid.w * grid.h);
  const queue = [start];
  seen[start] = 1;
  while (queue.length) {
    const cell = queue.pop();
    const ci = cell % grid.w;
    const cj = Math.floor(cell / grid.w);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = ci + di;
      const nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= grid.w || nj >= grid.h) continue;
      const next = nj * grid.w + ni;
      if (grid.walk[next] && !seen[next]) { seen[next] = 1; queue.push(next); }
    }
  }
  return seen;
};

test('the stage table is the six stages the brief asks for', () => {
  assert.deepEqual(Array.from(stage.ICE_WOLF_STAGE_ORDER), ['classic', 'aquarium', 'park', 'lodge', 'school', 'space']);
  assert.equal(stage.ICE_WOLF_STAGES.length, 6);
  const free = stage.ICE_WOLF_STAGES.filter((entry) => entry.pro !== true).map((entry) => entry.id);
  assert.deepEqual(Array.from(free), ['classic', 'aquarium'], 'the classic arena and the aquarium are free');
  assert.equal(stage.iceWolfStageFreeCount(), 2);
  assert.equal(stage.iceWolfStageLocked(false), 4, 'four stages are Pro-locked without Pro');
  assert.equal(stage.iceWolfStageLocked(true), 0, 'Pro unlocks them all');
  for (const entry of stage.ICE_WOLF_STAGES) {
    for (const field of ['nameKey', 'tagKey', 'gimmickKey', 'outfit', 'atmosphere', 'glyph']) {
      assert.ok(entry[field], `${entry.id} has a ${field}`);
    }
  }
  const outfits = new Set(stage.ICE_WOLF_STAGES.map((entry) => entry.outfit));
  assert.equal(outfits.size, 6, 'every stage has its own outfit');
  assert.equal(stage.iceWolfStageStep('classic', 1), 'aquarium', 'next steps forward');
  assert.equal(stage.iceWolfStageStep('classic', -1), 'space', 'prev wraps');
  assert.equal(stage.iceWolfStageById('nope').id, 'classic', 'an unknown id falls back to the classic arena');
  assert.equal(stage.iceWolfStagePlayable({ pro: true }, false), false);
  assert.equal(stage.iceWolfStagePlayable({ pro: false }, false), true);
});

test('every stage uses only the wall sizes the scene owns, and never more than it has', () => {
  const scene = sceneOf(readGame());
  const owned = {};
  for (const instance of scene.instances.filter((entry) => entry.name === 'Wall')) {
    if (instance.width >= 1400 || instance.height >= 1400) continue;
    const key = `${Math.round(instance.width)}x${Math.round(instance.height)}`;
    owned[key] = (owned[key] || 0) + 1;
  }
  const borderCount = scene.instances.filter((entry) => entry.name === 'Wall'
    && (entry.width >= 1400 || entry.height >= 1400)).length;
  assert.equal(borderCount, 8, 'the eight border walls stay where they are');
  const interior = Object.values(owned).reduce((sum, count) => sum + count, 0);
  assert.equal(interior, 52, `the scene owns 52 interior walls: ${interior}`);
  for (const [size, count] of Object.entries(stage.ICE_WOLF_WALL_CAPACITY)) {
    assert.ok(owned[size] >= count, `the scene owns ${owned[size]} walls of ${size}, the plans need ${count}`);
  }
  for (const [id, plan] of Object.entries(stage.ICE_WOLF_STAGE_WALLS)) {
    for (const [size, positions] of Object.entries(plan)) {
      assert.ok(owned[size], `${id} uses ${size}, which the scene does not own`);
      assert.ok(positions.length <= owned[size], `${id} uses ${positions.length} walls of ${size}, the scene has ${owned[size]}`);
    }
  }
});

test('every stage keeps its walls inside the floor and clear of every pad and spot', () => {
  for (const [id, plan] of Object.entries(stage.ICE_WOLF_STAGE_WALLS)) {
    const walls = rects(plan);
    for (const wall of walls) {
      const second = wall.x >= 792;
      const box = second ? FLOOR_2F : FLOOR_1F;
      assert.ok(wall.x >= box.x0 && wall.y >= box.y0 && wall.x + wall.w <= box.x1 && wall.y + wall.h <= box.y1,
        `${id}: wall ${JSON.stringify(wall)} leaves the ${second ? '2F' : '1F'} floor`);
    }
    const fixed = [
      ...WARP, ...SPEED, ...STAIR,
      ...SWITCH_SPOTS.map(([x, y]) => ({ x, y, w: SWITCH_SIZE, h: SWITCH_SIZE })),
      ...GATE_SPOTS.map(([x, y]) => ({ x, y, w: GATE_SIZE, h: GATE_SIZE }))
    ].map((entry) => (Array.isArray(entry) ? { x: entry[0], y: entry[1], w: entry[2], h: entry[3] } : entry));
    for (const wall of walls) {
      for (const spot of fixed) {
        assert.equal(overlaps(wall, spot, 6), false, `${id}: wall ${JSON.stringify(wall)} covers ${JSON.stringify(spot)}`);
      }
    }
  }
});

test('one walkable component per floor reaches every spawn, pad, switch and gate', () => {
  for (const [id, plan] of Object.entries(stage.ICE_WOLF_STAGE_WALLS)) {
    const walls = rects(plan);
    for (const [label, box] of [['1F', FLOOR_1F], ['2F', FLOOR_2F]]) {
      const floorWalls = walls.filter((wall) => (wall.x >= 792) === (label === '2F'));
      const grid = gridFor(box, floorWalls);
      const startCell = label === '1F'
        ? nearest(grid, ...cellOf(grid, PLAYER_SPAWN[0], PLAYER_SPAWN[1]))
        : nearest(grid, ...cellOf(grid, 1600, 0));
      assert.ok(startCell >= 0, `${id} ${label}: no start cell`);
      const seen = flood(grid, startCell);
      const open = grid.walk.reduce((sum, value) => sum + (value ? 1 : 0), 0);
      const reachable = seen.reduce((sum, value, index) => sum + (value && grid.walk[index] ? 1 : 0), 0);
      assert.ok(open >= 2600, `${id} ${label}: only ${open} walkable cells`);
      assert.ok(reachable >= open * 0.995, `${id} ${label}: ${reachable} of ${open} cells reachable (a pocket)`);

      const targets = [];
      for (const pad of (label === '1F' ? [...WARP, ...SPEED, STAIR[0], STAIR[1]] : [STAIR[2], STAIR[3]])) {
        targets.push([`pad ${JSON.stringify(pad)}`, pad[0] + pad[2] / 2, pad[1] + pad[3] / 2]);
      }
      for (const [x, y] of SWITCH_SPOTS) {
        if ((x >= 792) === (label === '2F')) targets.push([`switch ${x},${y}`, x + SWITCH_SIZE / 2, y + SWITCH_SIZE / 2]);
      }
      for (const [x, y] of GATE_SPOTS) {
        if ((x >= 792) === (label === '2F')) targets.push([`gate ${x},${y}`, x + GATE_SIZE / 2, y + GATE_SIZE / 2]);
      }
      for (const [x, y] of SPAWNS) {
        if ((x >= 792) === (label === '2F')) targets.push([`spawn ${x},${y}`, x, y]);
      }
      if (label === '1F') targets.push(['player spawn', PLAYER_SPAWN[0], PLAYER_SPAWN[1]]);
      for (const [name, x, y] of targets) {
        const cell = nearest(grid, ...cellOf(grid, x, y));
        assert.ok(cell >= 0, `${id} ${label}: ${name} has no walkable cell`);
        assert.equal(seen[cell], 1, `${id} ${label}: ${name} is cut off`);
      }
    }
  }
});

test('the classic plan is exactly the floor plan 1.0.0 shipped', () => {
  const scene = sceneOf(readGame());
  const interior = scene.instances
    .filter((entry) => entry.name === 'Wall' && entry.width < 1400 && entry.height < 1400)
    .map((entry) => `${Math.round(entry.x)},${Math.round(entry.y)}:${Math.round(entry.width)}x${Math.round(entry.height)}`)
    .sort();
  // The scene holds 52 interior walls: the 40 of FROST LAB stand where 1.0.0 put
  // them, the 12 extra ones wait outside the arena until a stage needs them.
  const inPlace = interior.filter((entry) => {
    const [xy] = entry.split(':');
    const [, y] = xy.split(',').map(Number);
    return y < 10000;
  });
  const parked = interior.filter((entry) => {
    const [xy] = entry.split(':');
    const [, y] = xy.split(',').map(Number);
    return y >= 10000;
  });
  assert.equal(inPlace.length, 40, 'the 40 walls of FROST LAB are in place in the saved scene');
  assert.equal(parked.length, 12, 'the 12 extra walls wait outside the arena');
  for (const entry of parked) {
    assert.ok(entry.startsWith('-2600,40000:'), `the parked wall ${entry} sits outside the arena`);
  }
  const planned = rects(stage.ICE_WOLF_STAGE_WALLS.classic).map((wall) => `${wall.x},${wall.y}:${wall.w}x${wall.h}`).sort();
  assert.equal(planned.length, 40, 'the classic plan is the 40 interior walls of FROST LAB');
  assert.deepEqual(planned, inPlace, 'the classic plan is exactly where 1.0.0 drew the walls');
});

test('the block only moves walls, and never resizes one', () => {
  const code = groupCode(STAGE_GROUP);
  assert.ok(code.includes('wall.setX('), 'walls are moved');
  assert.ok(code.includes('wall.setY('), 'walls are moved');
  assert.equal(/wall\.setWidth\(/.test(code), false, 'a wall is never resized');
  assert.equal(/wall\.setHeight\(/.test(code), false, 'a wall is never resized');
  assert.ok(code.includes('runtimeScene.__iceWolfV074Grid = null'), 'the navigation grid is rebuilt after a move');
  assert.ok(code.includes("vars.get('V070ResetPending').setBoolean(true)"), 'the switches are re-dealt after a move');
  assert.ok(code.includes('data-ice-wolf-v110-atmo'), 'the stage atmosphere is a pointer-transparent overlay');
  assert.ok(code.includes('prefers-reduced-motion'), 'the atmosphere animation respects reduced motion');
});

test('the stage lines are complete in all twelve languages', () => {
  const { i18n } = createI18n();
  const keys = stage.ICE_WOLF_STAGES.flatMap((entry) => [entry.nameKey, entry.tagKey, entry.gimmickKey])
    .concat(['stage.menu', 'stage.title', 'stage.close', 'stage.note',
      'stage.badgeFree', 'stage.badgeLocked', 'stage.badgeProOwned']);
  for (const key of keys) {
    assert.ok(i18n.ja(key).length > 0, `${key} has a Japanese line`);
    for (const lang of LANGS) {
      i18n.setLang(lang);
      const line = i18n.t(key);
      assert.ok(line.length > 0, `${key} [${lang}] is empty`);
      if (lang !== 'ja' && lang !== 'zh-Hans' && lang !== 'zh-Hant') {
        assert.equal(KANA.test(line), false, `${key} [${lang}] carries Japanese kana: ${line}`);
      }
    }
  }
  const tr = (key, params) => i18n.t(key, params);
  i18n.setLang('en');
  const view = stage.iceWolfStageView(stage.iceWolfStageById('aquarium'), tr, false);
  assert.equal(view.name, 'Deep-Sea Aquarium');
  assert.equal(view.unlocked, true);
  assert.equal(view.badge, i18n.t('stage.badgeFree'));
  const locked = stage.iceWolfStageView(stage.iceWolfStageById('park'), tr, false);
  assert.equal(locked.unlocked, false);
  assert.equal(locked.badge, i18n.t('stage.badgeLocked'));
  assert.ok(locked.badge.includes('PRO'), 'the locked badge says PRO');
  i18n.setLang('ja');
  assert.equal(stage.iceWolfStageView(stage.iceWolfStageById('aquarium'), tr, false).name, '深海水族館');
});

test('the menu carries the STAGE button and the settings rows are in the sheet', () => {
  const menu = groupCode('v0.6.5 Production Round Start + Main Menu');
  assert.ok(menu.includes('data-action="stage"'), 'the menu has a STAGE button');
  assert.ok(menu.includes('data-stage-now'), 'the button shows the current stage');
  assert.ok(menu.includes("vars.get('StageCommand').setString('open')"), 'the button opens the stage selector');
  const roster = groupCode('v1.1.0 人数・2人狼・ルール');
  for (const marker of ['data-ice-wolf-v110-match', 'settings.players', 'settings.wolves', 'settings.switches']) {
    assert.ok(roster.includes(marker), `the roster block owns ${marker}`);
  }
  assert.ok(groupCode('v1.1.0 観戦カメラ').includes('data-ice-wolf-v110-spectator'), 'the spectator bar is its own block');
});
