// Build 29 — the rescue that comes for the phone, and the frozen camera the stick
// walks.
//
// Two things the player asked for beside the 01:45 recording:
//
//   * "🆘 came up, but a minute went by and nobody came for me" — so the plan the
//     frozen phone is answered by is checked here, as plain data and then live
//     against a stand-in scene (a CPU has to actually walk to the ice and hold it);
//   * "while I'm frozen, let the stick move the overhead camera" — so the pan step
//     is checked for speed, clamp and easing, the block that publishes it is run
//     for real, and the shipped camera event is checked to read it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import { repoRoot, readGame, sceneOf, groupCode, createI18n, LANGS, KANA } from './helpers.mjs';

const AI_GROUP = 'v0.6.1 Human CPU Navigation Recovery + CPU Wolf Cycle';
const SPECTATOR_GROUP = 'v1.1.0 観戦カメラ';
const FOLLOW_GROUP = 'v1.1.0 観戦カメラ（追従）';

const blockOf = (controller, open, close, names) => {
  const list = Array.isArray(names) ? names : String(names).split(',').map((name) => name.trim());
  const code = groupCode(controller);
  const from = code.indexOf(open);
  const to = code.indexOf(close);
  if (from < 0 || to < 0) throw new Error(`markers missing in ${controller}: ${open}`);
  const context = vm.createContext({ Math, Number, String, Array, Object, Map, Set, Infinity, console });
  vm.runInContext(`${code.slice(from, to)}\n;globalThis.__block = { ${list.join(', ')} };`, context,
    { filename: `game.json#${open}` });
  return context.__block;
};

/* --------------------------------------------------------------- the plan */
const plan = blockOf(AI_GROUP, '/* ==== v1.1.0 build 29 rescue plan',
  '/* ==== end v1.1.0 build 29 rescue plan ==== */',
  'ICE_WOLF_CPU_RESCUE_PLAN, iceWolfRescuePlan, iceWolfRescuePlanFor, ICE_WOLF_RESCUE_PLAYER_KEY');

const rescuer = (key, x, y, extra = {}) => Object.assign({ key, x, y, floor: x > 792 ? '2F' : '1F' }, extra);
const ice = (key, x, y, extra = {}) => Object.assign({ key, x, y, floor: x > 792 ? '2F' : '1F', player: false, rank: 0 }, extra);
const playerIce = (x, y) => ice(plan.ICE_WOLF_RESCUE_PLAYER_KEY, x, y, { player: true });
/* The plan comes back from the block's own realm, so it is copied into a plain
 * array before anything is compared with a literal. */
const claimsOn = (entries, key) => Array.from(entries).filter((entry) => entry.target === key).map((entry) => entry.rescuer);

test('the frozen phone is answered first, even from the far end of the floor', () => {
  /* The video: the player froze at the far end and nobody came. The nearest ice
   * was elsewhere, so Build 25's "nearest wins" never looked at the phone. */
  const entries = plan.iceWolfRescuePlan(
    [rescuer('A', 200, 200), rescuer('B', 240, 200)],
    [playerIce(-600, -600), ice('ALLY', 150, 150, { rank: 60 })]
  );
  assert.equal(claimsOn(entries, plan.ICE_WOLF_RESCUE_PLAYER_KEY).length, 1,
    'one CPU always walks for the phone');
  assert.equal(claimsOn(entries, 'ALLY').length, 1, 'and the ally is still worked');
  assert.deepEqual(claimsOn(entries, plan.ICE_WOLF_RESCUE_PLAYER_KEY), ['A'],
    'the phone takes the nearest free CPU, however far it is');
});

test('the phone keeps its second CPU only when nobody else needs one', () => {
  const two = plan.iceWolfRescuePlan([rescuer('A', 100, 0), rescuer('B', 200, 0)], [playerIce(-600, 0)]);
  assert.equal(claimsOn(two, plan.ICE_WOLF_RESCUE_PLAYER_KEY).length, 2, 'two CPUs answer one frozen phone');
  const crowded = plan.iceWolfRescuePlan(
    [rescuer('A', 100, 0), rescuer('B', 200, 0)],
    [playerIce(-600, 0), ice('ALLY', 90, 0)]
  );
  assert.equal(claimsOn(crowded, 'ALLY').length, 1, 'the ally is not stripped of its rescuer');
  assert.equal(claimsOn(crowded, plan.ICE_WOLF_RESCUE_PLAYER_KEY).length, 1,
    'and the phone still has somebody coming');
  const many = plan.iceWolfRescuePlan(
    [rescuer('A', 1, 0), rescuer('B', 2, 0), rescuer('C', 3, 0), rescuer('D', 4, 0)],
    [playerIce(-600, 0)]
  );
  assert.equal(claimsOn(many, plan.ICE_WOLF_RESCUE_PLAYER_KEY).length, 2,
    'never the whole floor on one block of ice');
});

test('a teammate is worth a walk across the floor, and no further', () => {
  const near = plan.iceWolfRescuePlan([rescuer('A', 0, 0)], [ice('ALLY', 1100, 0)]);
  assert.equal(claimsOn(near, 'ALLY').length, 1, 'one floor across is still a rescue');
  const far = plan.iceWolfRescuePlan([rescuer('A', 0, 0)], [ice('ALLY', 1200, 0)]);
  assert.equal(claimsOn(far, 'ALLY').length, 0, 'beyond that the switches keep the CPU');
  const otherFloor = plan.iceWolfRescuePlan([rescuer('A', 0, 0)], [ice('ALLY', 1500, 0)]);
  assert.equal(claimsOn(otherFloor, 'ALLY').length, 0, 'and a stair ride does not change the walk');
});

test('four frozen allies and eight CPUs: two each, never more', () => {
  const rescuers = Array.from({ length: 8 }, (_, index) => rescuer(`R${index}`, index * 10, 0));
  const ices = Array.from({ length: 4 }, (_, index) => ice(`I${index}`, index * 20, 100, { rank: index * 20 }));
  const entries = plan.iceWolfRescuePlan(rescuers, ices);
  assert.equal(entries.length, 8, 'every CPU has a claim');
  for (let index = 0; index < 4; index += 1) {
    assert.equal(claimsOn(entries, `I${index}`).length, 2, `I${index} has exactly two rescuers`);
  }
  const perRescuer = new Set(entries.map((entry) => entry.rescuer));
  assert.equal(perRescuer.size, entries.length, 'no CPU is claimed twice');
});

test('a CPU riding the stairs, a CPU a wolf is chasing and a CPU cooling down', () => {
  const busy = plan.iceWolfRescuePlan(
    [rescuer('BUSY', 10, 0, { busy: true }), rescuer('FREE', 300, 0)],
    [ice('ALLY', 0, 0)]
  );
  assert.equal(claimsOn(busy, 'ALLY')[0], 'FREE', 'the free CPU is picked first');
  const chased = plan.iceWolfRescuePlan(
    [rescuer('CHASED', 10, 0, { chased: true }), rescuer('CALM', 300, 0)],
    [ice('ALLY', 0, 0)]
  );
  assert.equal(claimsOn(chased, 'ALLY')[0], 'CALM', 'and so is the one no wolf is on');
  const cool = plan.iceWolfRescuePlan(
    [rescuer('COOL', 10, 0, { cool: true }), rescuer('FREE', 600, 0)],
    [playerIce(-400, 0)]
  );
  assert.deepEqual(claimsOn(cool, plan.ICE_WOLF_RESCUE_PLAYER_KEY), ['FREE'],
    'a CPU that has just finished a rescue is not sent straight back');
});

test('a rescuer already on its way keeps its block of ice', () => {
  const entries = plan.iceWolfRescuePlan(
    [rescuer('STICKY', 320, 0, { stickyTarget: 'ALLY' }), rescuer('FRESH', 300, 0)],
    [playerIce(-200, 0), ice('ALLY', 0, 0)]
  );
  assert.equal(claimsOn(entries, plan.ICE_WOLF_RESCUE_PLAYER_KEY)[0], 'FRESH',
    'the CPU that walked to the ally is not swapped for the phone');
  assert.equal(claimsOn(entries, 'ALLY')[0], 'STICKY', 'it finishes what it started');
});

test('the plan is deterministic and the counter is what the board reads', () => {
  const first = plan.iceWolfRescuePlan([rescuer('B', 100, 0), rescuer('A', 100, 0)], [ice('ALLY', 0, 0)]);
  const second = plan.iceWolfRescuePlan([rescuer('A', 100, 0), rescuer('B', 100, 0)], [ice('ALLY', 0, 0)]);
  assert.deepEqual(claimsOn(first, 'ALLY'), claimsOn(second, 'ALLY'), 'the same bodies give the same plan');
  assert.equal(plan.iceWolfRescuePlanFor(first, 'ALLY').count, 2);
  assert.equal(plan.iceWolfRescuePlanFor(first, 'NOBODY').count, 0);
  assert.equal(plan.iceWolfRescuePlanFor(null, 'ALLY').count, 0, 'no plan, nobody coming');
});

/* ---------------------------------------------------------- the plan, live */
const makeScene = ({ actors = [], playerState = 'Active', playerX = 0, playerY = 350, vars = {} } = {}) => {
  const values = new Map(Object.entries({ GameOver: false, RoundPhase: 'Active', WolfModeDuration: 5, WolfCooldown: 5, ...vars }));
  const sceneVars = {
    get: (name) => ({
      getAsString: () => String(values.get(name) ?? ''),
      setString: (value) => { values.set(name, String(value)); },
      getAsNumber: () => Number(values.get(name) ?? 0),
      setNumber: (value) => { values.set(name, Number(value)); },
      getAsBoolean: () => values.get(name) === true,
      setBoolean: (value) => { values.set(name, value === true); }
    })
  };
  const body = (spec) => {
    const bag = new Map(Object.entries({
      Role: 'Human', State: 'Active', AIWolfModeLeft: 0, AIWolfCooldownLeft: 0,
      DisplayId: spec.id || '', WallBlocked: '0', WolfOrigin: '', ...(spec.vars || {})
    }));
    const obj = {
      x: spec.x || 0,
      y: spec.y || 0,
      bag,
      getVariables: () => ({
        get: (name) => ({
          getAsString: () => String(bag.get(name) ?? ''),
          setString: (value) => { bag.set(name, String(value)); },
          getAsNumber: () => Number(bag.get(name) ?? 0),
          setNumber: (value) => { bag.set(name, Number(value)); },
          getAsBoolean: () => bag.get(name) === true,
          setBoolean: (value) => { bag.set(name, value === true); }
        })
      }),
      getX() { return this.x; },
      getY() { return this.y; },
      setX(value) { this.x = value; },
      setY(value) { this.y = value; },
      getWidth: () => 17,
      getHeight: () => 17,
      getCenterXInScene() { return this.x + 8.5; },
      getCenterYInScene() { return this.y + 8.5; }
    };
    return obj;
  };
  const playerObj = body({ id: 'YOU', x: playerX, y: playerY, vars: { State: playerState } });
  const actorObjs = actors.map((spec) => {
    const obj = body(spec);
    if (spec.remote === true) obj.__iceWolfV110Remote = true;
    return obj;
  });
  const feedback = { text: '', setString(value) { this.text = value; }, hide() {} };
  const runtimeScene = {
    getVariables: () => sceneVars,
    getObjects: (name) => (name === 'Player' ? [playerObj] : name === 'Actor' ? actorObjs
      : name === 'ActionFeedbackText' ? [feedback] : []),
    __iceWolfV070SwitchIntent: () => null,
    __iceWolfV070GateIntent: () => null,
    __iceWolfV070StairToward: () => null,
    __iceWolfV072CanCross: () => false,
    __iceWolfV074Steer: (mover, vx, vy) => ({ x: vx, y: vy })
  };
  const context = vm.createContext({
    runtimeScene,
    gdjs: { evtTools: { runtimeScene: { getElapsedTimeInSeconds: () => 1 / 60 } } },
    Math, Number, String, Array, Object, Map, Set, console
  });
  vm.runInContext(`globalThis.__frame = function () {\n${groupCode(AI_GROUP)}\n};`, context,
    { filename: 'game.json#v0.6.1 AI' });
  return { runtimeScene, player: playerObj, actors: actorObjs, feedback, values, context, frame: () => vm.runInContext('__frame()', context) };
};

test('the frozen phone at the far end of 1F is walked to and thawed', () => {
  const scene = makeScene({ playerState: 'Frozen', playerX: -600, playerY: 0, actors: [{ id: 'A', x: 600, y: 0 }] });
  const rescuer = scene.actors[0];
  let frames = 0;
  while (scene.player.bag.get('State') === 'Frozen' && frames < 1400) {
    scene.frame();
    frames += 1;
  }
  assert.equal(scene.player.bag.get('State'), 'Active', 'the player is thawed');
  assert.ok(rescuer.x < 600 - 900, `the CPU walked most of the floor to get there (${Math.round(rescuer.x)})`);
  assert.ok(frames > 700 && frames < 1300, `after walking and holding the gauge (${frames} frames)`);
  assert.equal(scene.values.get('ActorRescuePlayerCount'), 1, 'the board shows somebody coming');
});

test('one CPU, an ally on its doorstep and a frozen phone: the phone wins', () => {
  const scene = makeScene({
    playerState: 'Frozen', playerX: -600, playerY: 0,
    actors: [
      { id: 'ALLY', x: 100, y: 0, vars: { State: 'Frozen' } },
      { id: 'A', x: 140, y: 0 }
    ]
  });
  const ally = scene.actors[0];
  let frames = 0;
  while (scene.player.bag.get('State') === 'Frozen' && frames < 1400) {
    scene.frame();
    frames += 1;
  }
  assert.equal(scene.player.bag.get('State'), 'Active', 'the phone is answered');
  assert.equal(ally.bag.get('State'), 'Frozen', 'and the ally on the way is still on its ice');
});

test('two CPUs: the phone and the ally are both thawed, the ally first', () => {
  const scene = makeScene({
    playerState: 'Frozen', playerX: -600, playerY: 0,
    actors: [
      { id: 'ALLY', x: 400, y: 0, vars: { State: 'Frozen' } },
      { id: 'A', x: 440, y: 0 },
      { id: 'B', x: 480, y: 0 }
    ]
  });
  const ally = scene.actors[0];
  let frames = 0;
  let allyAt = 0;
  let allyGap = Infinity;
  while ((scene.player.bag.get('State') === 'Frozen' || ally.bag.get('State') === 'Frozen') && frames < 1400) {
    scene.frame();
    frames += 1;
    if (allyAt === 0 && ally.bag.get('State') === 'Active') {
      allyAt = frames;
      allyGap = Math.min(...scene.actors.slice(1).map((actor) => Math.hypot(actor.x - ally.x, actor.y - ally.y)));
    }
  }
  assert.equal(ally.bag.get('State'), 'Active', 'the ally is thawed');
  assert.equal(scene.player.bag.get('State'), 'Active', 'and so is the phone');
  assert.ok(allyAt > 0 && allyAt < frames, `the doorstep ally came first (${allyAt} then ${frames} frames)`);
  assert.ok(allyGap < 60, `and a CPU was standing on it, not passing by (${allyGap.toFixed(1)}px)`);
});

test('a wolf in WOLF MODE over the ice: the rescuer waits at the ring and goes in after', () => {
  const scene = makeScene({
    playerState: 'Frozen', playerX: 0, playerY: 0,
    actors: [
      { id: 'A', x: -380, y: 0 },
      /* A wolf in WOLF MODE standing on the ice. Held remote so this test watches
       * the rescuer, not the wolf: it neither moves nor freezes anybody. */
      { id: 'W', x: 150, y: 0, remote: true, vars: { Role: 'Wolf', AIWolfModeLeft: 5 } }
    ]
  });
  const rescuer = scene.actors[0];
  for (let frame = 0; frame < 240; frame += 1) scene.frame();
  const ring = Math.hypot(rescuer.x + 8.5 - 158.5, 0);
  assert.equal(scene.player.bag.get('State'), 'Frozen', 'nobody walks into a wolf in mode');
  assert.ok(ring >= 380 && ring <= 400, `the rescuer holds at the ring (${ring.toFixed(1)}px from the wolf)`);
  assert.ok(rescuer.x < -100, `but it did come toward the ice (${Math.round(rescuer.x)})`);
  /* The five-second mode ends: now the ice is worth walking to. */
  scene.actors[1].bag.set('AIWolfModeLeft', 0);
  let frames = 0;
  while (scene.player.bag.get('State') === 'Frozen' && frames < 600) {
    scene.frame();
    frames += 1;
  }
  assert.equal(scene.player.bag.get('State'), 'Active', 'and the waiting rescuer finishes the rescue');
});

test('with nothing on the ice, the whole floor is free for the switches', () => {
  const scene = makeScene({ actors: [{ id: 'A', x: 100, y: 0 }, { id: 'B', x: 200, y: 0 }] });
  for (let frame = 0; frame < 10; frame += 1) scene.frame();
  assert.equal(scene.values.get('ActorRescuePlanCount'), 0, 'no plan without ice');
  assert.equal(scene.values.get('ActorRescuePlayerCount'), 0);
});

/* ---------------------------------------------------------------- the pan */
const pan = blockOf(SPECTATOR_GROUP, '/* ==== v1.1.0 build 29 frozen pan',
  '/* ==== end v1.1.0 build 29 frozen pan ==== */',
  'ICE_WOLF_FROZEN_PAN, iceWolfFrozenPanStep, iceWolfFrozenPanStart, iceWolfFrozenPanClamp');

test('the stick walks the look point at a walking pace and stops at the wall', () => {
  let state = pan.iceWolfFrozenPanStart(0, 0, 0);
  for (let frame = 0; frame < 60; frame += 1) state = pan.iceWolfFrozenPanStep(state, { x: 1, y: 0 }, 1 / 60);
  assert.ok(Math.abs(state.x - pan.ICE_WOLF_FROZEN_PAN.speed) < 2, `one second of stick is ${Math.round(state.x)}px`);
  for (let frame = 0; frame < 600; frame += 1) state = pan.iceWolfFrozenPanStep(state, { x: 1, y: 0 }, 1 / 60);
  assert.equal(state.x, pan.ICE_WOLF_FROZEN_PAN.maxX, 'pushed into the wall, the look point stays in the arena');
  for (let frame = 0; frame < 900; frame += 1) state = pan.iceWolfFrozenPanStep(state, { x: 0, y: -1 }, 1 / 60);
  assert.equal(state.y, pan.ICE_WOLF_FROZEN_PAN.minY, 'and on the other axis too');
  assert.ok(pan.ICE_WOLF_FROZEN_PAN.minX < -708 + 100, 'the whole 1F floor is reachable');
  assert.ok(pan.ICE_WOLF_FROZEN_PAN.maxX > 2292 - 100, 'and the whole 2F floor');
});

test('a still stick moves nothing, a diagonal is not faster, and the camera eases', () => {
  const start = pan.iceWolfFrozenPanStart(0, 0, 0);
  const still = pan.iceWolfFrozenPanStep(start, { x: 0, y: 0 }, 1 / 60);
  assert.equal(still.x, 0, 'no input, no movement');
  assert.equal(still.moved, false);
  let diagonal = pan.iceWolfFrozenPanStart(0, 0, 0);
  for (let frame = 0; frame < 60; frame += 1) diagonal = pan.iceWolfFrozenPanStep(diagonal, { x: 1, y: 1 }, 1 / 60);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - pan.ICE_WOLF_FROZEN_PAN.speed) < 3,
    'a diagonal walk is the same speed as a straight one');
  /* The look point chases the pan point: it is behind after one frame, caught up
   * a second later. */
  let eased = pan.iceWolfFrozenPanStart(0, 0, 0);
  const first = pan.iceWolfFrozenPanStep(eased, { x: 1, y: 0 }, 1 / 60);
  assert.ok(first.viewX > 0 && first.viewX < first.x, `the camera glides after the stick (${first.viewX} of ${first.x})`);
  for (let frame = 0; frame < 90; frame += 1) eased = pan.iceWolfFrozenPanStep(eased, { x: 0, y: 0 }, 1 / 60);
  assert.ok(Math.abs(eased.viewX - eased.x) < 0.5, 'and catches up when the stick is let go');
  const stalled = pan.iceWolfFrozenPanStep(start, { x: 1, y: 0 }, 5);
  assert.ok(stalled.x - start.x <= pan.ICE_WOLF_FROZEN_PAN.speed / 10 + 1e-9, 'a stalled phone cannot teleport it');
});

const makeElement = () => ({
  dataset: {}, style: {}, children: [], attributes: {}, textContent: '', className: '',
  appendChild(child) { this.children.push(child); return child; },
  setAttribute(name, value) { this.attributes[name] = String(value); },
  getAttribute(name) { return this.attributes[name]; },
  addEventListener() {},
  querySelector() { return null; },
  querySelectorAll() { return []; }
});

const variableBag = (entries) => {
  const bag = new Map(Object.entries(entries));
  return { get: (name) => ({
    getAsString: () => String(bag.get(name) ?? ''),
    setString: (value) => { bag.set(name, String(value)); },
    getAsNumber: () => Number(bag.get(name) ?? 0),
    setNumber: (value) => { bag.set(name, Number(value)); },
    getAsBoolean: () => bag.get(name) === true,
    setBoolean: (value) => { bag.set(name, value === true); }
  }) };
};

const makePanScene = ({ playerState = 'Frozen', playerX = 100, playerY = -50 } = {}) => {
  const values = new Map(Object.entries({
    GameOver: false, RoundPhase: 'Active', MoveX: 0, MoveY: 0, SpectatorCommand: ''
  }));
  const sceneVars = {
    get: (name) => ({
      getAsString: () => String(values.get(name) ?? ''),
      setString: (value) => { values.set(name, String(value)); },
      getAsNumber: () => Number(values.get(name) ?? 0),
      setNumber: (value) => { values.set(name, Number(value)); },
      getAsBoolean: () => values.get(name) === true,
      setBoolean: (value) => { values.set(name, value === true); }
    })
  };
  const bagOf = variableBag;
  const player = {
    x: playerX, y: playerY,
    getVariables: () => bagOf({ State: playerState, DisplayId: 'YOU', Role: 'Human' }),
    getCenterXInScene() { return this.x; },
    getCenterYInScene() { return this.y; },
    getZ: () => 0,
    getDepth: () => 26
  };
  const actor = {
    x: 500, y: 200,
    getVariables: () => bagOf({ State: 'Active', DisplayId: 'B', Role: 'Human' }),
    getCenterXInScene() { return this.x; },
    getCenterYInScene() { return this.y; }
  };
  const document = {
    body: makeElement(),
    createElement: () => makeElement(),
    querySelector: () => null,
    querySelectorAll: () => []
  };
  const runtimeScene = {
    getVariables: () => sceneVars,
    getObjects: (name) => (name === 'Player' ? [player] : name === 'Actor' ? [actor] : []),
    getGame: () => ({ getAssetPath: () => '' })
  };
  const context = vm.createContext({
    runtimeScene, document,
    gdjs: { evtTools: { runtimeScene: { getElapsedTimeInSeconds: () => 1 / 60 } } },
    Math, Number, String, Array, Object, Map, Set, console
  });
  vm.runInContext(`globalThis.__panFrame = function () {\n${groupCode(SPECTATOR_GROUP)}\n};`, context,
    { filename: 'game.json#v1.1.0 観戦カメラ' });
  return { runtimeScene, player, actor, values, context, frame: () => vm.runInContext('__panFrame()', context) };
};

test('a frozen player pans the camera and the body stays on the ice', () => {
  const scene = makePanScene({ playerState: 'Frozen', playerX: 100, playerY: -50 });
  const before = { x: scene.player.x, y: scene.player.y };
  scene.frame();
  assert.equal(scene.values.get('SpectatorPanActive'), true, 'the pan is on while the ice is');
  assert.equal(scene.values.get('SpectatorPanX'), before.x, 'and starts over the player');
  assert.equal(scene.values.get('SpectatorPanY'), before.y);
  assert.equal(scene.values.get('SpectatorPanZ'), 13, 'at the height the object look used (Z + half depth)');
  scene.values.set('MoveX', 1);
  for (let frame = 0; frame < 60; frame += 1) scene.frame();
  assert.ok(scene.values.get('SpectatorPanX') - before.x > 400, 'the stick moves the camera');
  assert.equal(scene.values.get('SpectatorPanY'), before.y, 'and only on the axis pushed');
  assert.equal(scene.values.get('SpectatorPanMoved'), true);
  assert.deepEqual({ x: scene.player.x, y: scene.player.y }, before, 'the frozen body never moved');
});

test('the thumb is let go, and a thaw hands the camera back', () => {
  const scene = makePanScene({ playerState: 'Frozen', playerX: 100, playerY: -50 });
  scene.values.set('MoveX', -1);
  for (let frame = 0; frame < 60; frame += 1) scene.frame();
  const panned = scene.values.get('SpectatorPanX');
  assert.ok(panned < 0, 'pushed left, the camera goes left');
  scene.values.set('MoveX', 0);
  scene.frame();
  assert.equal(scene.values.get('SpectatorPanMoved'), false, 'no stick, no walk');
  for (let frame = 0; frame < 120; frame += 1) scene.frame();
  const settled = scene.values.get('SpectatorPanX');
  scene.frame();
  assert.ok(Math.abs(scene.values.get('SpectatorPanX') - settled) < 1e-3,
    'letting go settles the view where the stick left it, and holds it there');
  /* The ice melts: the pan closes and the camera is the player's again. */
  scene.player.getVariables = () => variableBag({ State: 'Active', DisplayId: 'YOU', Role: 'Human' });
  scene.frame();
  assert.equal(scene.values.get('SpectatorPanActive'), false, 'thawed, the pan is off');
  assert.equal(scene.values.get('SpectatorPanX'), 0, 'and the camera event is not fed the frozen point');
});

test('the shipped frozen camera reads the pan, at the shipped 1350 / 82', () => {
  const scene = sceneOf(readGame());
  const follow = scene.events.find((group) => group.name === FOLLOW_GROUP);
  assert.equal(follow.events.length, 3, 'chase, overview and the frozen view');
  const frozen = follow.events[2].actions[0];
  assert.equal(frozen.type.value, 'ThirdPersonCamera::LookFromDistanceAtPosition3D',
    'a position, so the stick can move it');
  assert.deepEqual(frozen.parameters.slice(1, 4), ['SpectatorPanX', 'SpectatorPanY', 'SpectatorPanZ']);
  /* Bare scene-variable names, on purpose: the exporter compiles them to
   * `runtimeScene.getScene().getVariables().getFromIndex(n)` - the same container
   * the pan block writes. `GlobalVariable(x)` would compile to the GAME variables,
   * where these do not exist, and `getAsNumber()` of undefined throws every frame
   * (that is exactly the bug Build 29 shipped with, before Build 30 fixed it). */
  for (const parameter of frozen.parameters) {
    assert.equal(/GlobalVariable\(/.test(parameter), false, `a scene variable is not a game variable: ${parameter}`);
  }
  assert.equal(frozen.parameters[4], '1350', 'the same distance up (Build 34 came in)');
  assert.equal(frozen.parameters[6], '82', 'and the angle down');
  const frozenFlags = follow.events[2].conditions.map((condition) => condition.parameters?.[0]);
  assert.ok(frozenFlags.includes('SpectatorFrozen'), 'and only while the ice is on');
  const names = scene.variables.map((variable) => variable.name);
  for (const name of ['SpectatorPanActive', 'SpectatorPanMoved', 'SpectatorPanX', 'SpectatorPanY', 'SpectatorPanZ']) {
    assert.ok(names.includes(name), `${name} is a scene variable`);
  }
  for (const name of ['ActorRescuePlanCount', 'ActorRescuePlayerCount']) {
    assert.ok(names.includes(name), `${name} is a scene variable`);
  }
  const code = groupCode(SPECTATOR_GROUP);
  assert.ok(code.includes("vars.get('MoveX').getAsNumber()"), 'the pan reads the stick the body would have used');
  assert.ok(code.includes("tr('frozen.pan')"), 'and the badge says so');
});

test('the pan hint is in twelve languages, and Japanese is the only one with kana', () => {
  const { i18n } = createI18n();
  for (const lang of LANGS) {
    i18n.setLang(lang);
    const line = i18n.t('frozen.pan');
    assert.ok(line.length > 0, `frozen.pan [${lang}] is empty`);
    assert.match(line, /🕹️/, `frozen.pan [${lang}] keeps the stick`);
    if (lang !== 'ja') assert.equal(KANA.test(line), false, `frozen.pan [${lang}] carries Japanese kana: ${line}`);
  }
  i18n.setLang('ja');
  assert.match(i18n.t('frozen.pan'), /スティック/);
});

/* ------------------------------------------------------------------ the build */
test('the build is one version on every side, and npm test runs this file', () => {
  /* The two features of this build first shipped as 29; the camera read a game
   * variable instead of the scene variable, so 29 was superseded (30 was
   * cancelled mid-upload, 31 carries the fix and the share/rejoin work of
   * tests/pro/v116-build31.test.mjs) - Apple refuses a build number twice. */
  const pbx = fs.readFileSync(path.join(repoRoot, 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8');
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const builds = [...pbx.matchAll(/CURRENT_PROJECT_VERSION = ([^;]+);/g)].map((match) => match[1]);
  assert.equal(new Set(builds).size, 1, 'both configurations carry the same build');
  assert.ok(Number(builds[0]) >= 31, `the build never goes back past 31: ${builds[0]}`);
  const verify = fs.readFileSync(path.join(repoRoot, 'scripts/ios/verify-ios-project.py'), 'utf8');
  assert.ok(verify.includes(`DEFAULT_BUILD_NUMBER = "${builds[0]}"`), 'the verifier builds the same number');
  assert.ok(verify.includes(`DEFAULT_MARKETING_VERSION = "${pkg.version}"`), 'on the one version');
  const staging = readGame();
  assert.equal(staging.properties.version, pkg.version, 'the GDevelop project carries that version');
  assert.ok(pkg.scripts.test.includes('v115-build29.test.mjs'), 'npm test runs this file');
});
