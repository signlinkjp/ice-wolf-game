// ICE WOLF Build 25 — the fifteen changes the player asked for after an hour and
// a half on the ice, checked where they live:
//
//   * the CPU's hands (the rescue gauge, the recruitment, the gate) run for real
//     against a stand-in scene, so a CPU cannot go back to the one-frame thaw;
//   * a wolf always comes back: the mode deadline is a pure function, and the
//     block that holds it is on the sheet and runs last;
//   * the wolf's own board is drawn for the wolf and never for a human;
//   * the frozen player gets the overhead camera and the badge, and the cameras
//     that follow a body stand down;
//   * the two buttons that moved to the corner, the bigger clock and the
//     explanation under SWITCH ESCAPE are where the brief asked for them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import { repoRoot, readGame, sceneOf, groupCode, createI18n, LANGS, KANA } from './helpers.mjs';

const AI_GROUP = 'v0.6.1 Human CPU Navigation Recovery + CPU Wolf Cycle';
const ARENA_GROUP = 'v0.7.0 2階・階段・5スイッチ・3ゲート';
const MENU_GROUP = 'v0.6.5 Production Round Start + Main Menu';
const RESTART_GROUP = 'v0.6.7 役割・時間の設定 + プレイ中のやり直し';
const CAMERA_GROUP = 'v0.6.4 Overview Camera Toggle UI';
const SPECTATOR_GROUP = 'v1.1.0 観戦カメラ';
const ALLY_GROUP = 'v1.1.0 鬼の仲間HUD';
const RESET_GROUP = 'v1.1.0 鬼の状態リセット';
const ACTION_GROUP = 'Wolf actions';

const blockOf = (controller, open, close, names) => {
  const list = Array.isArray(names) ? names : String(names).split(',').map((name) => name.trim());
  const code = groupCode(controller);
  const from = code.indexOf(open);
  const to = code.indexOf(close);
  if (from < 0 || to < 0) throw new Error(`markers missing in ${controller}: ${open}`);
  const context = vm.createContext({ Math, Number, String, Array, Object, console });
  /* The gate intent reads the shipped gate size, which the arena block defines
   * above it; the test declares the same number. */
  vm.runInContext(`const GATE_SIZE = 72;\n${code.slice(from, to)}\n;globalThis.__block = { ${list.join(', ')} };`, context,
    { filename: `game.json#${open}` });
  return context.__block;
};

/* ------------------------------------------------------------ the CPU's hands */
const hands = blockOf(AI_GROUP, '/* ==== v1.1.0 cpu hands', '/* ==== end v1.1.0 cpu hands ==== */',
  'ICE_WOLF_CPU_RESCUE, iceWolfRescueHoldStep, ICE_WOLF_CPU_INFECT, iceWolfCpuInfectAllowed');

test('a CPU rescue is a 1.5 second hold, not a touch', () => {
  assert.equal(hands.ICE_WOLF_CPU_RESCUE.hold, 1.5, 'the same kind of wait a person makes');
  assert.ok(hands.ICE_WOLF_CPU_RESCUE.reach >= 6, 'it may stand a step off the ice');
  let held = 0;
  let fired = 0;
  for (let frame = 0; frame < 120; frame += 1) {
    const step = hands.iceWolfRescueHoldStep(held, true, 1 / 60, 1.5, 2.2);
    held = step.seconds;
    if (step.fired) { fired += 1; break; }
  }
  assert.equal(fired, 1, 'one rescue, one frame of completion');
  assert.ok(Math.abs(held) < 1e-9, 'and the gauge is spent');
  /* Ninety frames is 1.5 seconds at 60fps: the ring is not full before that. */
  let early = 0;
  for (let frame = 0; frame < 89; frame += 1) {
    const step = hands.iceWolfRescueHoldStep(early, true, 1 / 60, 1.5, 2.2);
    early = step.seconds;
    assert.equal(step.fired, false, `frame ${frame} cannot finish the rescue`);
  }
  assert.ok(early > 1.4, 'but it is nearly there');
});

test('a rescuer that walks away loses the work, and a stall cannot cheat the gauge', () => {
  let held = 1.0;
  const away = hands.iceWolfRescueHoldStep(held, false, 1 / 60, 1.5, 2.2);
  assert.ok(away.seconds < held, 'stepping away drains it');
  assert.equal(away.fired, false);
  /* A frame is clamped to a tenth of a second (a phone that stalls must not drain
   * a gauge the way it must not age a wolf mode), so a whole second away is ten
   * clamped frames: 1.0 - 2.2 x 0.1 = 0.78. */
  const gone = hands.iceWolfRescueHoldStep(held, false, 1.0, 1.5, 2.2);
  assert.ok(Math.abs(gone.seconds - 0.78) < 1e-9, `one long frame drains a tenth of a second (${gone.seconds})`);
  let drained = held;
  for (let frame = 0; frame < 60; frame += 1) drained = hands.iceWolfRescueHoldStep(drained, false, 1 / 60, 1.5, 2.2).seconds;
  assert.equal(drained, 0, 'and a second off the ice loses all of it');
  const stall = hands.iceWolfRescueHoldStep(0, true, 5, 1.5, 2.2);
  assert.equal(stall.fired, false, 'a five-second stall cannot finish a rescue in one frame');
  assert.ok(Math.abs(stall.seconds - 0.1) < 1e-9, `the frame is capped at a tenth of a second (${stall.seconds})`);
  assert.equal(hands.iceWolfRescueHoldStep(NaN, true, 1 / 60, 1.5, 2.2).fired, false, 'a broken gauge starts from zero');
});

test('a CPU wolf recruits only with a floor of three people and three wolves at most', () => {
  assert.equal(hands.ICE_WOLF_CPU_INFECT.humansNeeded, 3, 'three living humans are still a round');
  /* Build 26: the pack's ceiling came down from four to three, so a round that
   * opens with two wolves has room for exactly one recruit. */
  assert.equal(hands.ICE_WOLF_CPU_INFECT.wolvesMax, 3, 'the pack has a ceiling');
  assert.equal(hands.iceWolfCpuInfectAllowed(3, 1, false), true, 'three people and one wolf: yes');
  assert.equal(hands.iceWolfCpuInfectAllowed(2, 1, false), false, 'two people: no, the round would end');
  assert.equal(hands.iceWolfCpuInfectAllowed(6, 3, false), false, 'a full pack: no');
  assert.equal(hands.iceWolfCpuInfectAllowed(6, 2, false), true, 'two wolves and a captive: the last seat');
  assert.equal(hands.iceWolfCpuInfectAllowed(6, 1, true), false, 'once per match');
});

/* The gate: the pure half, and the wiring that reads it. */
const gate = blockOf(ARENA_GROUP, '/* ==== v1.1.0 gate intent', '/* ==== end v1.1.0 gate intent ==== */',
  'ICE_WOLF_GATE_INTENT, iceWolfGateOpenSpot, iceWolfGateWorthIt');

test('an open gate is a spot, a shut one is not', () => {
  const gates = [{ x: 930, y: -300, open: false }, { x: 2180, y: 300, open: true }, { x: -48, y: -48, open: false }];
  assert.equal(gate.iceWolfGateOpenSpot(gates, 0), null, 'a closed gate is no goal');
  assert.deepEqual(JSON.parse(JSON.stringify(gate.iceWolfGateOpenSpot(gates, 1))), { x: 2180 + 36, y: 300 + 36 },
    'the open one is its centre');
  assert.equal(gate.iceWolfGateOpenSpot(gates, -1), null, 'no gate open: nothing to walk to');
  assert.equal(gate.iceWolfGateOpenSpot(gates, 9), null);
});

test('a human gives up the gate when a wolf is breathing on it', () => {
  assert.equal(gate.iceWolfGateWorthIt([900, 700], 400), true, 'a clear run is worth it');
  assert.equal(gate.iceWolfGateWorthIt([gate.ICE_WOLF_GATE_INTENT.dangerRadius - 10], 400), false,
    'a wolf inside the ring is not');
  assert.equal(gate.iceWolfGateWorthIt([], 400), true, 'no wolf on the floor: go');
  assert.equal(gate.ICE_WOLF_GATE_INTENT.speed > 95, true, 'the exit is walked with purpose');
});

test('the AI asks for the gate before it asks for a switch, and only after it opens', () => {
  const code = groupCode(AI_GROUP);
  const gateCall = code.indexOf('__iceWolfV070GateIntent');
  const switchCall = code.indexOf('__iceWolfV070SwitchIntent');
  assert.ok(gateCall > 0, 'the AI reads the gate intent');
  assert.ok(switchCall > gateCall, 'before the switch intent, because the open gate is the win');
  assert.ok(code.includes("if (!hasIntent && typeof runtimeScene.__iceWolfV070GateIntent === 'function')"),
    'and only when nothing else has claimed the frame');
  const arena = groupCode(ARENA_GROUP);
  assert.ok(arena.includes("vars.get('GateUnlocked').getAsBoolean()"), 'the intent needs an open gate');
  assert.ok(arena.includes('runtimeScene.__iceWolfV070StairToward(actor, spot.x)'), 'and rides the stairs to it');
});

/* ------------------------------------------------------- the CPU's hands, live */
/* A small stand-in scene: one Player, the Actors, and the scene variables the AI
 * block reads. The block is wrapped in a function, so a test can run one frame at
 * a time exactly as the game does. */
const makeScene = ({ actors = [], playerVars = {}, vars = {} } = {}) => {
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
  const body = (spec, isPlayer = false) => {
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
    if (isPlayer) bag.set('Role', playerVars.Role || 'Human');
    return obj;
  };
  const playerObj = body({ id: 'YOU', x: 0, y: 350 }, true);
  const actorObjs = actors.map((spec) => body(spec));
  const feedback = { text: '', setString(value) { this.text = value; }, hide() {} };
  const runtimeScene = {
    getVariables: () => sceneVars,
    getObjects: (name) => (name === 'Player' ? [playerObj] : name === 'Actor' ? actorObjs : name === 'ActionFeedbackText' ? [feedback] : []),
    __iceWolfV070SwitchIntent: () => null,
    __iceWolfV070StairToward: () => null,
    __iceWolfV072CanCross: () => false,
    __iceWolfV074Steer: (mover, vx, vy) => ({ x: vx, y: vy })
  };
  const context = vm.createContext({
    runtimeScene,
    gdjs: { evtTools: { runtimeScene: { getElapsedTimeInSeconds: () => 1 / 60 } } },
    Math, Number, String, Array, Object, console
  });
  vm.runInContext(`globalThis.__frame = function () {\n${groupCode(AI_GROUP)}\n};`, context,
    { filename: 'game.json#v0.6.1 AI' });
  const frame = () => vm.runInContext('__frame()', context);
  return { runtimeScene, player: playerObj, actors: actorObjs, feedback, values, frame, context };
};

const stateOf = (obj) => obj.bag.get('State');
const roleOf = (obj) => obj.bag.get('Role');

test('a CPU beside a frozen ally stays and fills the gauge before the thaw', () => {
  const scene = makeScene({
    actors: [
      { id: 'A', x: 100, y: 100, vars: { State: 'Frozen' } },
      { id: 'B', x: 140, y: 100 }
    ]
  });
  const rescuer = scene.actors[1];
  const victim = scene.actors[0];
  let frames = 0;
  while (stateOf(victim) === 'Frozen' && frames < 300) {
    scene.frame();
    frames += 1;
    assert.ok(Math.abs(rescuer.x - 140) < 0.001, `frame ${frames}: the rescuer holds its ground`);
  }
  assert.equal(stateOf(victim), 'Active', 'the ally is thawed');
  assert.ok(frames >= 85 && frames <= 95, `after about 1.5s of holding (${frames} frames), not one frame`);
});

test('a rescuer that has to walk to the ice still spends the gauge there', () => {
  const scene = makeScene({
    actors: [
      { id: 'A', x: 300, y: 300, vars: { State: 'Frozen' } },
      { id: 'B', x: 600, y: 300 }
    ]
  });
  const rescuer = scene.actors[1];
  const victim = scene.actors[0];
  let frames = 0;
  let found = false;
  while (stateOf(victim) === 'Frozen' && frames < 400) {
    scene.frame();
    frames += 1;
    if (!found && Math.hypot(rescuer.getCenterXInScene() - victim.getCenterXInScene(),
      rescuer.getCenterYInScene() - victim.getCenterYInScene()) <= 42) found = true;
  }
  assert.equal(stateOf(victim), 'Active', 'the far ally is thawed too');
  assert.ok(frames > 60, `after walking there and holding (${frames} frames)`);
});

test('a CPU wolf turns a frozen CPU into a wolf, once', () => {
  const scene = makeScene({
    actors: [
      { id: 'A', x: 300, y: 300 },
      { id: 'B', x: 600, y: 600 },
      { id: 'C', x: 900, y: 600 },
      { id: 'D', x: 900, y: -600, vars: { Role: 'Wolf' } }
    ]
  });
  const wolf = scene.actors[3];
  const prey = scene.actors[0];
  wolf.x = prey.x + 10;
  wolf.y = prey.y;
  for (let frame = 0; frame < 120 && stateOf(prey) === 'Active'; frame += 1) scene.frame();
  assert.equal(roleOf(prey), 'Wolf', 'the captive is recruited, not left on the ice');
  assert.equal(stateOf(prey), 'Active', 'and it stands up as a wolf');
  assert.equal(prey.bag.get('WolfOrigin'), 'cpu', 'the board says how it was made');
  assert.equal(scene.values.get('WolfCpuInfectUsed'), true, 'the match has spent its recruitment');
  assert.equal(scene.values.get('WolfCpuInfectCount'), 1);
  /* The second catch cannot recruit again. */
  const other = scene.actors[1];
  other.x = wolf.x + 10;
  other.y = wolf.y;
  for (let frame = 0; frame < 600 && stateOf(other) === 'Active'; frame += 1) scene.frame();
  assert.equal(stateOf(other), 'Frozen', 'the second one is only frozen');
  assert.equal(roleOf(other), 'Human');
});

test('a CPU human walks for the open gate when the arena offers it', () => {
  const scene = makeScene({ actors: [{ id: 'A', x: 1000, y: 0 }] });
  scene.runtimeScene.__iceWolfV070GateIntent = () => ({ vx: 1, vy: 0, speed: 100, tx: 2000, ty: 0, crossing: false });
  const walker = scene.actors[0];
  const start = walker.x;
  for (let frame = 0; frame < 30; frame += 1) scene.frame();
  assert.ok(walker.x > start + 20, `the human heads for the gate (${(walker.x - start).toFixed(1)}px in half a second)`);
});

/* --------------------------------------------------- a wolf always comes back */
const reset = blockOf(RESET_GROUP, '/* ==== v1.1.0 wolf reset', '/* ==== end v1.1.0 wolf reset ==== */',
  'ICE_WOLF_MODE_GRACE, iceWolfModeDeadline, iceWolfModeNext');

test('a wolf mode cannot outlive its own timer', () => {
  assert.equal(reset.iceWolfModeDeadline(5), 5 + reset.ICE_WOLF_MODE_GRACE, 'five seconds plus a frame of grace');
  const fresh = reset.iceWolfModeNext({ role: 'Wolf', state: 'Active', timer: 5, duration: 5, now: 100, armedAt: 0 });
  assert.equal(fresh.armed, true, 'a mode that has just started is armed');
  assert.equal(fresh.armedAt, 100, 'and the block remembers when');
  assert.equal(fresh.timer, 5);
  const running = reset.iceWolfModeNext({ role: 'Wolf', state: 'Active', timer: 2, duration: 5, now: 103, armedAt: 100 });
  assert.equal(running.reset, false, 'three seconds in, still armed');
  assert.equal(running.timer, 2);
  const stuck = reset.iceWolfModeNext({ role: 'Wolf', state: 'Active', timer: 5, duration: 5, now: 106, armedAt: 100 });
  assert.equal(stuck.reset, true, 'six seconds of a five-second mode is closed');
  assert.equal(stuck.timer, 0);
  assert.equal(stuck.reason, 'outlived its timer');
  /* The holes the restore has to cover: a frozen wolf, a seat that left, a body
   * that is no longer a wolf at all. */
  const frozen = reset.iceWolfModeNext({ role: 'Wolf', state: 'Frozen', timer: 4, duration: 5, now: 101, armedAt: 100 });
  assert.equal(frozen.reset, false, 'a frozen wolf keeps its mode');
  assert.equal(frozen.armed, true, 'and its clock');
  const left = reset.iceWolfModeNext({ role: 'Wolf', state: 'Out', timer: 4, duration: 5, now: 101, armedAt: 100 });
  assert.equal(left.timer, 0, 'a seat that left the round carries no mode');
  assert.equal(left.reset, true);
  const human = reset.iceWolfModeNext({ role: 'Human', state: 'Active', timer: 3, duration: 5, now: 101, armedAt: 100 });
  assert.equal(human.timer, 0, 'and neither does a human');
  assert.equal(reset.iceWolfModeNext({ role: 'Wolf', state: 'Active', timer: 0, duration: 5, now: 101, armedAt: 0 }).reset, false,
    'a disguised wolf is left alone');
});

test('the block that holds the timer runs last and publishes what it closed', () => {
  const scene = sceneOf(readGame());
  const groups = scene.events.map((group) => group.name);
  assert.equal(groups[groups.indexOf(RESET_GROUP) + 1], 'v1.2.0 オープニング',
    'only the v1.2.0 opening and settings follow the restorer');
  assert.equal(groups[groups.length - 1], 'v1.3.0 アクション演出',
    'and Build 33\'s action layer is the very last block');
  const variables = new Map(scene.variables.map((variable) => [variable.name, variable.value]));
  for (const name of ['WolfResetWatched', 'WolfResetCount', 'WolfResetClosed', 'WolfResetArmed', 'WolfResetReason']) {
    assert.ok(variables.has(name), `${name} is a scene variable`);
  }
  const code = groupCode(RESET_GROUP);
  assert.ok(code.includes("vars.get('WolfModeLeft')"), 'it reads the player\'s mode timer');
  assert.ok(code.includes("bodyVars.get('AIWolfModeLeft')"), 'and every CPU\'s');
  assert.ok(code.includes('performance.now()'), 'against a clock of its own, not the match clock');
});

/* ------------------------------------------------------------- the wolf board */
const board = blockOf(ALLY_GROUP, '/* ==== v1.1.0 wolf board', '/* ==== end v1.1.0 wolf board ==== */',
  'ICE_WOLF_ALLY_KINDS, iceWolfAllyKind, iceWolfAllyBoard, iceWolfAllyLabel');

test('the board lists the player first, then the pack by id, with where each came from', () => {
  const rows = board.iceWolfAllyBoard([
    { id: 'C', origin: 'cpu' },
    { id: 'A', origin: 'initial' },
    { id: 'YOU', you: true, origin: 'initial' },
    { id: 'B', origin: 'trap' }
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(rows.map((row) => row.id))), ['YOU', 'A', 'B', 'C']);
  assert.deepEqual(JSON.parse(JSON.stringify(rows.map((row) => row.kind))), ['initial', 'initial', 'trap', 'cpu']);
  assert.equal(board.iceWolfAllyKind(''), 'initial', 'a wolf with no origin was the round\'s wolf');
  assert.equal(board.iceWolfAllyKind('nonsense'), 'initial');
  const tr = (key) => key;
  assert.equal(board.iceWolfAllyLabel({ id: 'C', kind: 'infect' }, tr), 'wolves.infect C');
  assert.equal(board.iceWolfAllyLabel({ id: 'YOU', you: true, kind: 'initial' }, tr), 'wolves.initial wolves.you');
});

test('a human phone carries no board at all', () => {
  const code = groupCode(ALLY_GROUP);
  assert.ok(code.includes("const show = playing && isWolf;"), 'only a wolf in a running round');
  assert.ok(code.includes("ui.root.style.display = show ? 'block' : 'none'"), 'the panel hides for a human');
  assert.ok(code.includes('A human\'s phone keeps nothing: the rows are emptied, not hidden.'),
    'and the rows are removed');
  assert.ok(code.includes("vars.get('WolfAllyCount')"), 'the state is published for the HUD tests');
  const text = new Set();
  const { i18n } = createI18n();
  for (const key of ['wolves.title', 'wolves.initial', 'wolves.trap', 'wolves.infect', 'wolves.you']) {
    for (const lang of LANGS) {
      i18n.setLang(lang);
      const line = i18n.t(key);
      assert.ok(line.length > 0, `${key} [${lang}] is empty`);
      if (lang !== 'ja' && lang !== 'zh-Hans' && lang !== 'zh-Hant') {
        assert.equal(KANA.test(line), false, `${key} [${lang}] carries Japanese kana: ${line}`);
      }
    }
    i18n.setLang('ja');
    text.add(i18n.t(key));
  }
  assert.equal(text.size, 5, 'every line is its own');
});

test('the wolf board draws nothing for a human and two rows for a wolf', () => {
  const makeElement = (tag) => {
    const element = {
      tagName: tag || 'div', style: {}, attributes: {}, children: [], textContent: '', dataset: {},
      className: '', parentNode: null,
      setAttribute(name, value) { this.attributes[name] = String(value); },
      getAttribute(name) { return this.attributes[name]; },
      appendChild(child) { this.children.push(child); child.parentNode = this; return child; },
      removeChild(child) {
        const at = this.children.indexOf(child);
        if (at >= 0) this.children.splice(at, 1);
        return child;
      },
      addEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; }
    };
    return element;
  };
  const document = {
    body: makeElement('body'),
    createElement: (tag) => makeElement(tag),
    querySelector: () => null,
    querySelectorAll: () => [],
    documentElement: { lang: '' }
  };
  const build = (playerRole, actors) => {
    const values = new Map([['RoundPhase', 'Active'], ['GameOver', false]]);
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
    const body = (role, origin, id) => {
      const bag = new Map([['Role', role], ['State', 'Active'], ['WolfOrigin', origin], ['DisplayId', id]]);
      return {
        getVariables: () => ({ get: (name) => ({
          getAsString: () => String(bag.get(name) ?? ''),
          setString: (value) => { bag.set(name, value); },
          getAsNumber: () => Number(bag.get(name) ?? 0),
          setNumber: (value) => { bag.set(name, value); },
          getAsBoolean: () => bag.get(name) === true,
          setBoolean: (value) => { bag.set(name, value === true); }
        }) })
      };
    };
    const runtimeScene = {
      getVariables: () => sceneVars,
      getObjects: (name) => (name === 'Player' ? [body(playerRole, playerRole === 'Wolf' ? 'initial' : '', 'YOU')]
        : name === 'Actor' ? actors.map((actor) => body(actor.role, actor.origin, actor.id)) : [])
    };
    const context = vm.createContext({ runtimeScene, document, window: { innerWidth: 844 }, performance: { now: () => 0 }, Math, Number, String, Array, Object, console });
    runtimeScene.__iceWolfI18n = createI18n().i18n;
    vm.runInContext(groupCode(ALLY_GROUP), context, { filename: 'game.json#v1.1.0 wolf board' });
    return { values, document };
  };
  const human = build('Human', [{ role: 'Wolf', origin: 'initial', id: 'A' }]);
  assert.equal(human.values.get('WolfAllyCount'), 0, 'a human counts no allies');
  assert.equal(human.values.get('WolfAllyList'), '', 'and is told no names');
  const panel = human.document.body.children.find((child) => child.attributes['data-ice-wolf-v111-allies'] === '1');
  assert.equal(panel, undefined, 'no panel is even built for a human');

  const wolf = build('Wolf', [
    { role: 'Wolf', origin: 'trap', id: 'A' },
    { role: 'Wolf', origin: 'cpu', id: 'B' },
    { role: 'Human', origin: '', id: 'C' }
  ]);
  assert.equal(wolf.values.get('WolfAllyCount'), 3, 'the wolf plus two');
  assert.equal(wolf.values.get('WolfAllyList'), 'YOU:initial,A:trap,B:cpu');
  const wolfPanel = wolf.document.body.children.find((child) => child.attributes['data-ice-wolf-v111-allies'] === '1');
  assert.ok(wolfPanel, 'the wolf gets the panel');
  assert.equal(wolfPanel.style.display, 'block');
  const list = wolfPanel.children.find((child) => child.attributes['data-ice-wolf-v111-ally-list'] === '1');
  assert.deepEqual(list.children.map((row) => row.textContent),
    ['🐺 人狼 あなた', '⚡ 罠の鬼 A', '⚡ 感染鬼 B']);
});

/* ------------------------------------------------------------- the screen */
test('MENU and CAM share the free top-right corner, and the clock is bigger', () => {
  const restart = groupCode(RESTART_GROUP);
  assert.ok(restart.includes('ui.button.style.top = `${rect.top + 8}px`'), 'MENU sits at the top');
  assert.ok(restart.includes('rect.right - 136'), 'and one button to the left of the camera');
  const camera = groupCode(CAMERA_GROUP);
  assert.ok(camera.includes('ui.button.style.top = `${rect.top + 8}px`'), 'CAM sits at the top too');
  assert.ok(camera.includes('rect.right - 72'), 'in the corner');
  const scene = sceneOf(readGame());
  const timer = scene.objects.find((object) => object.name === 'TimerText');
  assert.ok(timer.content.characterSize >= 56, `the clock reads bigger (${timer.content.characterSize})`);
  assert.equal(timer.content.bold, true, 'and bolder');
  assert.ok(timer.content.outlineThickness >= 2, 'with its outline');
  const instance = scene.instances.find((entry) => entry.name === 'TimerText');
  assert.ok(instance.width >= 200, 'the box grew with the type');
  const status = scene.instances.find((entry) => entry.name === 'StatusText');
  assert.ok(status.y >= 44, 'the STATUS line moved under the two buttons');
});

test('SWITCH ESCAPE explains itself under its row', () => {
  const menu = groupCode(MENU_GROUP);
  assert.ok(menu.includes('data-i18n="settings.escapeNote"'), 'the explanation is a line of the sheet');
  const escapeRow = menu.indexOf('data-action="switchEscape"');
  const note = menu.indexOf('data-i18n="settings.escapeNote"');
  assert.ok(escapeRow > 0 && note > escapeRow, 'and it sits under the ON/OFF row');
  const { i18n } = createI18n();
  for (const lang of LANGS) {
    i18n.setLang(lang);
    const line = i18n.t('settings.escapeNote');
    assert.ok(line.length > 0, `settings.escapeNote [${lang}] is empty`);
    assert.match(line, /ON/, `settings.escapeNote [${lang}] names ON`);
    assert.match(line, /OFF/, `settings.escapeNote [${lang}] names OFF`);
  }
  i18n.setLang('ja');
  assert.match(i18n.t('settings.escapeNote'), /ゲート/);
});

test('a frozen player watches the floor from above, with a badge that says so', () => {
  const spectator = groupCode(SPECTATOR_GROUP);
  assert.ok(spectator.includes("playerState === 'Frozen'"), 'the ordinary ice counts');
  assert.ok(spectator.includes("playerState === 'FrozenWolfCandidate'"), 'and the ice that hides a wolf');
  assert.ok(spectator.includes("vars.get('SpectatorFrozen').setBoolean(frozenNow === true)"), 'the flag is published');
  assert.ok(spectator.includes("tr('frozen.view')"), 'the badge is the table line');
  assert.ok(spectator.includes('const visible = active && !!targetNow && !frozenNow;'), 'the ‹ › bar stands down');
  const { i18n } = createI18n();
  for (const key of ['frozen.view', 'frozen.hint']) {
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
  assert.match(i18n.t('frozen.view'), /俯瞰/);
});

test('the frozen camera is the follow group\'s third event, and the other two stand down', () => {
  const scene = sceneOf(readGame());
  const follow = scene.events.find((group) => group.name === 'v1.1.0 観戦カメラ（追従）');
  assert.equal(follow.events.length, 3, 'chase, overview and the frozen view');
  for (const event of follow.events.slice(0, 2)) {
    const frozenCondition = event.conditions.find((condition) => condition.parameters?.[0] === 'SpectatorFrozen');
    assert.ok(frozenCondition, 'the follow events know about the frozen flag');
    assert.equal(frozenCondition.inverted, true, 'and skip themselves when it is on');
  }
  const overhead = follow.events[2];
  /* Build 29: the overhead view is the pan position the stick drives, at the same
   * 1500 / 86 geometry (tests/pro/v115-build29.test.mjs walks the pan itself). */
  assert.equal(overhead.actions[0].type.value, 'ThirdPersonCamera::LookFromDistanceAtPosition3D',
    'the frozen view looks at a position');
  assert.equal(overhead.actions[0].parameters[1], 'SpectatorPanX');
  assert.equal(overhead.actions[0].parameters[2], 'SpectatorPanY');
  assert.equal(overhead.actions[0].parameters[4], '1500');
  assert.equal(overhead.actions[0].parameters[6], '86');
});

/* ------------------------------------------------------------ the rescue, once */
test('the rescue thaws the nearest ally and spends the gauge, never two at once', () => {
  const scene = sceneOf(readGame());
  const group = scene.events.find((entry) => entry.name === ACTION_GROUP);
  const rescue = group.events.find((event) => (event.actions || []).some((action) => action.type.value === 'PickNearest')
    && (event.events || []).length === 2);
  assert.ok(rescue, 'the rescue event is the one with the nearest pick and two branches');
  const pick = rescue.actions.find((action) => action.type.value === 'PickNearest');
  assert.deepEqual(pick.parameters, ['Actor', 'Player.CenterX()', 'Player.CenterY()'], 'it picks one ally');
  for (const branch of rescue.events) {
    const names = branch.actions.map((action) => action.parameters[0]);
    assert.ok(names.includes('RescueHoldReady'), 'the branch clears the ready flag');
    assert.ok(names.includes('RescueHoldTime'), 'and empties the gauge');
    const ready = branch.actions.find((action) => action.parameters[0] === 'RescueHoldReady');
    assert.equal(ready.parameters[1], 'False', 'so the next frame cannot thaw the next body');
  }
});

/* -------------------------------------------------------------- the build */
test('Build 25 is the build on every side', () => {
  const pbx = fs.readFileSync(path.join(repoRoot, 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8');
  const builds = [...pbx.matchAll(/CURRENT_PROJECT_VERSION = ([^;]+);/g)].map((match) => match[1]);
  /* Build 26 moved the number on; the rule this file checks is that both
   * configurations and the verifier carry the one build the project is on. */
  assert.equal(new Set(builds).size, 1, `both configurations carry one build (${builds.join(', ')})`);
  assert.ok(Number(builds[0]) >= 25, `Build ${builds[0]} is past Build 24`);
  const verify = fs.readFileSync(path.join(repoRoot, 'scripts/ios/verify-ios-project.py'), 'utf8');
  assert.ok(verify.includes(`DEFAULT_BUILD_NUMBER = "${builds[0]}"`), 'the verifier defaults to 25');
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts.test.includes('v112-build25.test.mjs'), 'npm test runs this file');
});
