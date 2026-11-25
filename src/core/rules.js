/**
 * Match rules: roles, the wolf, rescue, switches, gates and the six stage
 * gimmicks. No DOM, no Three.js — the unit tests play whole matches with it.
 *
 * The v1.2.0 rule set, as agreed for Build 35, tightened in Build 36 and again
 * in Build 38:
 *   * the first wolf is the master wolf: a wolf for the whole match. It keeps
 *     the wolf body and the freezing touch from kickoff to the final whistle,
 *     needs no button and has no human form (Build 38),
 *   * a werewolf (the second wolf, or the third born from a trap) switches
 *     between human and wolf form; touching a human freezes them the moment the
 *     wolf form is out — no second tap, no cooldown to satisfy (Build 38),
 *   * only the master wolf may name a frozen human as trap ice, once per match,
 *   * so the third wolf is born from a trap only (trap ice rescue or the trap
 *     switch), never by naming,
 *   * a werewolf in human form is not a rescue target,
 *   * the trap ice looks exactly like normal ice; rescuing it turns the
 *     rescuer into a werewolf,
 *   * at most three wolves, and a match that opens with two has no trap.
 */
import {
  ACTOR,
  MATCH,
  PAD,
  RESCUE,
  SWITCH,
  WOLF,
  GIMMICK,
} from '../config.js';
import {
  floorY,
  isWalkable,
  openSpotFor,
  pointInRect,
  randomPointOn,
  resolveMove,
} from './geometry.js';

/* ------------------------------------------------------------------ */
/* Seeded randomness                                                   */
/* ------------------------------------------------------------------ */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeSeed() {
  return (Math.floor(Math.random() * 0xffffff) ^ Date.now()) >>> 0;
}

function shuffle(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick(list, n, rng) {
  return shuffle(list, rng).slice(0, n);
}

/* ------------------------------------------------------------------ */
/* Roles                                                               */
/* ------------------------------------------------------------------ */

export function wolfCountFor(settings) {
  const base = Math.max(1, Math.min(2, settings.wolves || 1));
  return settings.players >= 8 ? base : 1;
}

/**
 * Assign roles to seats. Seat 0 is the player.
 * Returns [{role:'firstWolf'|'werewolf'|'human'}] in seat order.
 */
export function assignRoles({ players, wolves, preference = 'random', rng }) {
  const n = Math.max(4, Math.min(MATCH.maxPlayers, players));
  const wolfSeats = [];
  const wanted = Math.max(1, Math.min(2, wolves));
  if (preference === 'wolf') {
    wolfSeats.push(0);
  }
  const others = shuffle(
    Array.from({ length: n }, (_, i) => i).filter((i) => !wolfSeats.includes(i)),
    rng,
  );
  while (wolfSeats.length < wanted) wolfSeats.push(others.shift());
  const first = wolfSeats[0];
  return Array.from({ length: n }, (_, seat) => {
    if (!wolfSeats.includes(seat)) return { role: 'human', seat };
    return { role: seat === first ? 'firstWolf' : 'werewolf', seat };
  });
}

export function isWolfRole(role) {
  return role === 'firstWolf' || role === 'werewolf';
}

/**
 * Is this wolf in its wolf body right now — and therefore freezing to the
 * touch? The master wolf always is; a werewolf only while transformed.
 */
export function isWolfForm(actor) {
  if (!actor || !isWolfRole(actor.role) || actor.state !== 'active') return false;
  if (actor.role === 'firstWolf') return true;
  return actor.form === 'wolf' && actor.wolfTimer > 0;
}

export function wolvesAlive(match) {
  return match.actors.filter((a) => a.role !== 'human' && a.state === 'active');
}

export function livingHumans(match) {
  return match.actors.filter((a) => a.role === 'human' && a.state === 'active');
}

export function frozenHumans(match) {
  return match.actors.filter((a) => a.role === 'human' && a.state === 'frozen');
}

export function targetableFrozen(match) {
  // A werewolf in human form is a wolf, so its ice (if any) is not a rescue
  // target. In practice only human ice is ever created.
  return match.actors.filter((a) => a.state === 'frozen' && a.role === 'human');
}

/* ------------------------------------------------------------------ */
/* Match construction                                                  */
/* ------------------------------------------------------------------ */

function actorName(i) {
  return i === 0 ? 'YOU' : String.fromCharCode(65 + i - 1);
}

export function createMatch(stage, settings, opts = {}) {
  const seed = opts.seed ?? makeSeed();
  const rng = mulberry32(seed);
  const players = Math.max(4, Math.min(MATCH.maxPlayers, settings.players || 7));
  const wolves = wolfCountFor(settings);
  const prefs = assignRoles({ players, wolves, preference: settings.role || 'random', rng });

  const spawns = [stage.playerSpawn, ...stage.spawns];
  const actors = [];
  for (let i = 0; i < players; i += 1) {
    const raw = openSpotFor(stage, spawns[i % spawns.length], ACTOR.radius);
    const role = prefs[i].role;
    actors.push({
      id: i,
      seat: i,
      name: actorName(i),
      displayName: i === 0 ? 'YOU' : actorName(i),
      isCPU: i !== 0,
      role,
      state: 'active',
      // The master wolf keeps the wolf body all match; a werewolf starts hidden.
      form: role === 'firstWolf' ? 'wolf' : 'human',
      x: raw.x,
      z: raw.z,
      floor: raw.floor,
      y: floorY(raw.floor),
      yaw: 0,
      moving: false,
      speedBoost: 0,
      warpCooldown: 0,
      wolfTimer: 0,
      wolfCooldown: 0,
      frozenType: null,
      switchHold: null,
      rescueHold: null,
      climb: 0,
      stairLock: 0,
      out: false,
      path: null,
      pathAt: 0,
      goal: null,
      scaredAt: -99,
      lastFreezeAt: -99,
    });
  }

  const switches = placeSwitches(stage, settings, rng, actors);
  const gates = stage.gates.map((g) => ({ ...g, open: false }));

  return {
    id: `m${seed.toString(36)}`,
    seed,
    rng,
    stage,
    settings: {
      players,
      wolves,
      switches: switches.length,
      correct: switches.filter((s) => s.correct).length,
      escape: settings.escape !== false,
      trap: settings.trap || 'auto',
      duration: clampDuration(settings.duration),
      camera: settings.camera || 'normal',
    },
    phase: 'play',
    elapsed: 0,
    timeLeft: clampDuration(settings.duration),
    duration: clampDuration(settings.duration),
    actors,
    switches,
    gates,
    gateOpened: null,
    infectionUsed: false,
    trapArmed: switches.some((s) => s.trap),
    events: [],
    win: null,
    winBy: null,
    resultAt: 0,
    stats: { frozen: 0, rescued: 0, switches: 0, infected: 0 },
    lastGimmick: null,
  };
}

export function clampDuration(seconds) {
  const v = Number(seconds) || MATCH.defaultSeconds;
  if (v <= 60) return 60;
  if (v <= 120) return 120;
  if (v <= 180) return 180;
  if (v <= 210) return 210; // the 3:30 opening default; not offered in settings
  return 300;
}

function placeSwitches(stage, settings, rng, actors) {
  const total = Math.max(3, Math.min(10, settings.switches || 5));
  const correctWanted = Math.max(1, Math.min(total, settings.correct || 3));
  const candidates = shuffle(stage.switchSpots, rng);
  const f1 = candidates.filter((c) => c.floor === 1);
  const f2 = candidates.filter((c) => c.floor === 2);
  // Keep both halls busy: at least one switch on each floor.
  const chosen = [];
  if (total >= 2) {
    chosen.push(f1.shift());
    chosen.push(f2.shift());
  }
  while (chosen.length < total) {
    const pool = chosen.filter((c) => c.floor === 1).length <= chosen.filter((c) => c.floor === 2).length ? f1 : f2;
    const next = (pool.length ? pool : f1.concat(f2)).shift();
    if (!next) break;
    chosen.push(next);
  }
  const ordered = shuffle(chosen, rng);
  const correctIndexes = pick(ordered.map((_, i) => i), correctWanted, rng);
  const trapOn = trapEnabled(settings);
  let trapIndex = -1;
  if (trapOn) {
    const decoys = ordered.map((_, i) => i).filter((i) => !correctIndexes.includes(i));
    if (decoys.length) trapIndex = decoys[Math.floor(rng() * decoys.length)];
  }
  return ordered.map((spot, i) => ({
    id: i,
    x: spot.x,
    z: spot.z,
    floor: spot.floor,
    correct: correctIndexes.includes(i),
    trap: i === trapIndex,
    active: false,
    triggered: false,
    glow: 0,
  }));
}

export function trapEnabled(settings) {
  if ((settings.wolves || 1) >= 2) return false;
  if (settings.trap === 'off') return false;
  if (settings.trap === 'always') return true;
  return (settings.players || 7) >= 8;
}

/* ------------------------------------------------------------------ */
/* Gimmicks                                                            */
/* ------------------------------------------------------------------ */

export function gimmickPhase(match) {
  const g = match.stage.gimmick;
  if (!g) return null;
  const t = match.elapsed;
  const state = { kind: g.kind, active: false, warn: false };
  if (g.kind === 'classic') {
    // A blizzard gust: the ice drifts underfoot and the aurora flares.
    state.active = t % g.cycle.period < g.cycle.length;
    state.gust = state.active;
    state.countdown = state.active ? Math.ceil(g.cycle.length - (t % g.cycle.period)) : 0;
    return state;
  }
  if (g.kind === 'aquarium') {
    const cycle = g.cycle;
    state.active = t % cycle.mantaPeriod < cycle.mantaLength;
    state.manta = state.active;
    return state;
  }
  if (g.kind === 'park') {
    state.active = t % g.cycle.period < g.cycle.length;
    state.parade = state.active;
    return state;
  }
  if (g.kind === 'lodge') {
    state.active = t % g.cycle.period < g.cycle.length;
    state.blizzard = state.active;
    return state;
  }
  if (g.kind === 'school') {
    const phase = t % g.cycle.period;
    state.chime = phase < g.cycle.chime;
    state.shut = phase >= g.cycle.chime && phase < g.cycle.chime + g.cycle.shut;
    state.active = state.chime || state.shut;
    state.countdown = state.chime
      ? Math.ceil(g.cycle.chime - phase)
      : state.shut
        ? Math.ceil(g.cycle.chime + g.cycle.shut - phase)
        : 0;
    return state;
  }
  if (g.kind === 'space') {
    const phase = t % g.cycle.period;
    state.warn = phase < g.cycle.warn;
    state.active = phase >= g.cycle.warn && phase < g.cycle.warn + g.cycle.length;
    state.gravity = state.active;
    state.cells = state.warn || state.active ? gravityCells(match) : [];
    state.countdown = state.warn ? Math.ceil(g.cycle.warn - phase) : 0;
    return state;
  }
  return state;
}

/** Six seeded high-gravity cells, the same on every phone in the room. */
export function gravityCells(match) {
  if (match.__gravity && match.__gravity.seed === match.seed) return match.__gravity.cells;
  const g = match.stage.gimmick;
  if (!g || g.kind !== 'space') return [];
  const rng = mulberry32((match.seed ^ 0x9e3779b9) >>> 0);
  const out = [];
  let guard = 0;
  while (out.length < g.cycle.cells && guard < 400) {
    guard += 1;
    // Ask the geometry where a cell fits: the two halls are separate rooms, so
    // never assume a rectangle that spans them.
    const floor = rng() < 0.5 ? 1 : 2;
    const spot = randomPointOn(match.stage, floor, rng, 2.4);
    if (!spot) continue;
    if (out.some((c) => c.floor === spot.floor && Math.hypot(c.x - spot.x, c.z - spot.z) < 4.4)) continue;
    out.push({ floor: spot.floor, x: spot.x, z: spot.z, r: g.cycle.cellRadius });
  }
  match.__gravity = { seed: match.seed, cells: out };
  return out;
}

export function inZone(zone, actor) {
  if (!zone) return false;
  if (zone.floor !== actor.floor) return false;
  return Math.abs(actor.x - zone.x) <= zone.w / 2 && Math.abs(actor.z - zone.z) <= zone.d / 2;
}

/** The speed multiplier from stage zones and the running gimmick beat. */
export function speedFactorAt(match, actor, gim) {
  const g = match.stage.gimmick;
  let factor = 1;
  if (!g) return factor;
  if (g.kind === 'park' && gim && gim.parade) factor *= g.cycle.speed;
  if (g.kind === 'space') {
    if ((g.lowGravity || []).some((z) => inZone(z, actor))) factor *= 1.18;
    if (gim && gim.gravity) {
      const cell = (gim.cells || []).find(
        (c) => c.floor === actor.floor && Math.hypot(c.x - actor.x, c.z - actor.z) <= c.r,
      );
      if (cell) factor *= g.cycle.slow;
    }
  }
  if (actor.speedBoost > 0) factor *= PAD.speedMultiplier;
  return factor;
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

export function emit(match, type, data = {}) {
  match.events.push({ type, ...data });
}

/**
 * The werewolf transform. The master wolf has no button: it is already a wolf.
 */
export function activateWolf(match, actor) {
  if (!isWolfRole(actor.role) || actor.state !== 'active') return false;
  if (actor.role === 'firstWolf') return false;
  if (actor.wolfCooldown > 0 || actor.wolfTimer > 0) return false;
  if (actor.form === 'wolf') return false;
  actor.wolfTimer = WOLF.modeSeconds;
  actor.wolfCooldown = WOLF.modeSeconds + WOLF.cooldownSeconds;
  actor.form = 'wolf';
  emit(match, 'wolf-on', { seat: actor.seat });
  return true;
}

export function freezeHuman(match, wolf, victim) {
  if (!victim || victim.state !== 'active' || victim.role !== 'human') return false;
  victim.state = 'frozen';
  victim.frozenType = 'human';
  victim.frozenAt = match.elapsed;
  victim.frozenX = victim.x;
  victim.frozenZ = victim.z;
  victim.frozenFloor = victim.floor;
  victim.wolfTimer = 0;
  victim.form = 'human';
  victim.path = null;
  match.stats.frozen += 1;
  emit(match, 'freeze', { seat: victim.seat, by: wolf ? wolf.seat : -1 });
  return true;
}

export function infectFrozen(match, wolf, actor) {
  if (match.infectionUsed) return false;
  // Only the first wolf — the master wolf, who never turns human — can name a
  // frozen human. The second wolf (and anyone the trap already turned) cannot:
  // the trap is the only way the third wolf ever appears.
  if (wolf.role !== 'firstWolf') return false;
  if (!isWolfRole(wolf.role)) return false;
  if (!actor || actor.state !== 'frozen' || actor.role !== 'human') return false;
  if (actor.frozenType === 'wolfCandidate') return false;
  if (Math.hypot(actor.x - wolf.x, actor.z - wolf.z) > WOLF.infectRange) return false;
  actor.frozenType = 'wolfCandidate';
  match.infectionUsed = true;
  match.stats.infected += 1;
  emit(match, 'infect', { seat: actor.seat, by: wolf.seat });
  return true;
}

export function beginRescue(match, rescuer, target) {
  if (rescuer.role !== 'human' || rescuer.state !== 'active') return false;
  if (!target || target.state !== 'frozen') return false;
  if (target.role !== 'human') return false;
  if (Math.hypot(target.x - rescuer.x, target.z - rescuer.z) > RESCUE.range) return false;
  rescuer.rescueHold = { seat: target.seat, t: 0 };
  return true;
}

export function cancelRescue(rescuer) {
  rescuer.rescueHold = null;
}

export function completeRescue(match, rescuer, target) {
  if (target.frozenType === 'wolfCandidate') {
    // The trap: the rescuer becomes the third wolf, the ice stays.
    if (match.actors.filter((a) => isWolfRole(a.role)).length < WOLF.maxWolves) {
      rescuer.role = 'werewolf';
      rescuer.form = 'human';
      rescuer.rescueHold = null;
      emit(match, 'trap', { seat: rescuer.seat, ice: target.seat });
    } else {
      target.state = 'active';
      target.frozenType = null;
      rescuer.rescueHold = null;
      match.stats.rescued += 1;
      emit(match, 'rescue', { seat: target.seat, by: rescuer.seat });
    }
    return;
  }
  target.state = 'active';
  target.frozenType = null;
  target.frozenAt = 0;
  rescuer.rescueHold = null;
  match.stats.rescued += 1;
  emit(match, 'rescue', { seat: target.seat, by: rescuer.seat });
}

export function beginSwitch(match, actor, sw) {
  if (actor.state !== 'active' || sw.active) return false;
  if (Math.hypot(sw.x - actor.x, sw.z - actor.z) > SWITCH.range) return false;
  if (sw.floor !== actor.floor) return false;
  actor.switchHold = { id: sw.id, t: 0 };
  return true;
}

export function completeSwitch(match, actor, sw) {
  actor.switchHold = null;
  if (sw.active) return;
  if (sw.trap && actor.role === 'human') {
    sw.triggered = true;
    if (match.actors.filter((a) => isWolfRole(a.role)).length < WOLF.maxWolves) {
      actor.role = 'werewolf';
      actor.form = 'human';
      emit(match, 'trapSwitch', { seat: actor.seat });
    } else {
      emit(match, 'switchMiss', { seat: actor.seat });
    }
    return;
  }
  if (!sw.correct) {
    sw.triggered = true;
    emit(match, 'switchMiss', { seat: actor.seat });
    return;
  }
  sw.active = true;
  match.stats.switches += 1;
  emit(match, 'switchOn', { seat: actor.seat, id: sw.id, on: match.switches.filter((s) => s.active).length, total: match.switches.filter((s) => s.correct).length });
  const correct = match.switches.filter((s) => s.correct);
  if (correct.every((s) => s.active)) openGate(match);
}

export function openGate(match) {
  if (match.gateOpened !== null) return;
  const closed = match.gates.filter((g) => !g.open);
  if (!closed.length) return;
  const gate = closed[Math.floor(match.rng() * closed.length)];
  gate.open = true;
  match.gateOpened = gate.id;
  emit(match, 'gateOpen', { gate: gate.id, floor: gate.floor });
}

export function tryEscape(match, actor) {
  if (match.gateOpened === null) return false;
  const gate = match.gates.find((g) => g.open);
  if (!gate) return false;
  if (actor.role !== 'human' || actor.state !== 'active') return false;
  if (actor.floor !== gate.floor) return false;
  if (Math.hypot(actor.x - gate.x, actor.z - gate.z) > 1.8) return false;
  actor.state = 'escaped';
  finish(match, 'human', 'gate');
  return true;
}

export function finish(match, win, by) {
  if (match.phase === 'result') return;
  match.phase = 'result';
  match.win = win;
  match.winBy = by;
  match.resultAt = match.elapsed;
  emit(match, 'result', { win, by });
}

export function checkEnd(match) {
  if (match.phase !== 'play') return;
  if (!livingHumans(match).length) {
    finish(match, 'wolf', 'frozen');
    return;
  }
  if (match.timeLeft <= 0) finish(match, 'human', 'time');
}

/* ------------------------------------------------------------------ */
/* Stepping                                                            */
/* ------------------------------------------------------------------ */

function normalize(mx, mz) {
  const len = Math.hypot(mx, mz);
  if (len < 0.08) return null;
  if (len > 1) return { x: mx / len, z: mz / len };
  return { x: mx, z: mz };
}

export function playerActor(match) {
  return match.actors[0];
}

export function actorById(match, seat) {
  return match.actors.find((a) => a.seat === seat);
}

/**
 * Step one frame. `inputs` maps seat -> {mx, mz, wolf, rescue, useSwitch, infect}.
 * CPU seats are steered by the supplied brain (ai.js) unless `input.remote`.
 */
export function stepMatch(match, dt, inputs = {}, brain = null) {
  if (match.phase === 'result') {
    match.elapsed += dt;
    return match;
  }
  match.elapsed += dt;
  match.timeLeft = Math.max(0, match.duration - match.elapsed);
  const gim = gimmickPhase(match);
  match.lastGimmick = gim;
  const g = match.stage.gimmick;

  for (const actor of match.actors) {
    if (actor.out || actor.state === 'escaped') continue;
    if (actor.state === 'frozen') {
      actor.moving = false;
      continue;
    }
    actor.wolfCooldown = Math.max(0, actor.wolfCooldown - dt);
    if (actor.wolfTimer > 0) {
      actor.wolfTimer = Math.max(0, actor.wolfTimer - dt);
      if (actor.wolfTimer === 0) {
        if (actor.role === 'werewolf') actor.form = 'human';
        emit(match, 'wolf-off', { seat: actor.seat });
      }
    }
    if (actor.speedBoost > 0) actor.speedBoost = Math.max(0, actor.speedBoost - dt);
    if (actor.warpCooldown > 0) actor.warpCooldown = Math.max(0, actor.warpCooldown - dt);
    if (actor.stairLock > 0) actor.stairLock = Math.max(0, actor.stairLock - dt);
    if (actor.climb > 0) actor.climb = Math.max(0, actor.climb - dt);

    let input = inputs[actor.seat];
    if (!input) {
      if (actor.isCPU && brain) input = brain(match, actor, dt, gim);
      else input = { mx: 0, mz: 0 };
    }
    if (input.remote) {
      // Online guest: the host owns this seat's position already.
      actor.moving = false;
      continue;
    }

    // Wolf button (werewolf transform only).
    if (input.wolf) activateWolf(match, actor);

    // Rescue hold.
    if (input.rescue) {
      if (actor.rescueHold) {
        const target = actorById(match, actor.rescueHold.seat);
        if (
          !target ||
          target.state !== 'frozen' ||
          Math.hypot(target.x - actor.x, target.z - actor.z) > RESCUE.range
        ) {
          actor.rescueHold = null;
        } else {
          actor.rescueHold.t += dt;
          if (actor.rescueHold.t >= RESCUE.seconds) completeRescue(match, actor, target);
        }
      } else if (actor.role === 'human') {
        const target = targetableFrozen(match)
          .filter((t) => t.floor === actor.floor)
          .filter((t) => Math.hypot(t.x - actor.x, t.z - actor.z) <= RESCUE.range)
          .sort((a, b) => Math.hypot(a.x - actor.x, a.z - actor.z) - Math.hypot(b.x - actor.x, b.z - actor.z))[0];
        if (target) actor.rescueHold = { seat: target.seat, t: 0 };
      }
    } else if (actor.rescueHold) {
      actor.rescueHold = null;
    }

    // Switch hold.
    if (input.useSwitch) {
      if (actor.switchHold) {
        const sw = match.switches[actor.switchHold.id];
        if (!sw || Math.hypot(sw.x - actor.x, sw.z - actor.z) > SWITCH.range) {
          actor.switchHold = null;
        } else {
          actor.switchHold.t += dt;
          if (actor.switchHold.t >= SWITCH.holdSeconds) completeSwitch(match, actor, sw);
        }
      } else {
        const sw = match.switches
          .filter((s) => !s.active && s.floor === actor.floor)
          .find((s) => Math.hypot(s.x - actor.x, s.z - actor.z) <= SWITCH.range);
        if (sw) actor.switchHold = { id: sw.id, t: 0 };
      }
    } else if (actor.switchHold) {
      actor.switchHold = null;
    }

    // Infect (once per match, from the master wolf).
    if (input.infect !== undefined && input.infect !== null && !match.infectionUsed) {
      const target = match.actors.find((a) => a.seat === Number(input.infect));
      infectFrozen(match, actor, target);
    }

    // Movement.
    const dir = normalize(input.mx || 0, input.mz || 0);
    const factor = speedFactorAt(match, actor, gim);
    let vx = 0;
    let vz = 0;
    if (dir) {
      const speed = ACTOR.speed * factor;
      vx = dir.x * speed;
      vz = dir.z * speed;
    }
    // The aquarium current pushes everyone standing in a lane.
    if (g && g.kind === 'aquarium') {
      for (const lane of g.current) {
        if (inZone(lane, actor)) {
          vx += lane.dx * lane.power;
          vz += lane.dz * lane.power;
        }
      }
    }
    // The classic blizzard gust drifts everyone in the hall it sweeps.
    if (g && g.kind === 'classic' && gim && gim.gust) {
      for (const gust of g.gusts) {
        if (inZone(gust, actor)) {
          vx += gust.dx * gust.power;
          vz += gust.dz * gust.power;
        }
      }
    }
    // The lodge ice keeps a little of last frame's motion.
    if (g && g.kind === 'lodge' && (g.slideZones || []).some((z) => inZone(z, actor))) {
      vx += (actor.vx || 0) * 0.32;
      vz += (actor.vz || 0) * 0.32;
    }
    if (vx || vz) {
      const next = resolveMove(match.stage, actor.floor, actor.x, actor.z, actor.x + vx * dt, actor.z + vz * dt);
      actor.moving = Math.hypot(next.x - actor.x, next.z - actor.z) > dt * 0.4;
      if (actor.moving) actor.yaw = Math.atan2(next.x - actor.x, next.z - actor.z);
      actor.x = next.x;
      actor.z = next.z;
    } else {
      actor.moving = false;
    }
    actor.vx = vx;
    actor.vz = vz;
    actor.y = floorY(actor.floor) + (actor.climb > 0 ? Math.sin((1 - actor.climb / 0.45) * Math.PI) * 1.1 : 0);

    stepStairs(match, actor);
    stepWarps(match, actor);
    stepPads(match, actor);
    stepDoors(match, actor, gim);

    if (tryEscape(match, actor)) return match;

    // Freezing touch: a wolf in its wolf body freezes every human it touches,
    // at once, with no button and no window to miss (Build 38).
    if (isWolfForm(actor)) {
      for (const other of match.actors) {
        if (other.role !== 'human' || other.state !== 'active') continue;
        if (other.floor !== actor.floor) continue;
        if (Math.hypot(other.x - actor.x, other.z - actor.z) <= WOLF.freezeRange) {
          freezeHuman(match, actor, other);
        }
      }
    }
  }

  checkEnd(match);
  return match;
}

/**
 * Stair zone: a marked staircase mouth on one floor carries the body to a
 * landing inside the other hall. Entering is enough — no slope, no push.
 */
function stepStairs(match, actor) {
  if (actor.stairLock > 0) return;
  for (const s of match.stage.stairs) {
    if (s.floor !== actor.floor) continue;
    if (Math.hypot(actor.x - s.x, actor.z - s.z) > 1.6) continue;
    actor.floor = s.toFloor;
    actor.x = s.exitX;
    actor.z = s.exitZ;
    actor.climb = 0.45;
    actor.stairLock = 0.9;
    actor.path = null;
    actor.y = floorY(actor.floor);
    emit(match, 'stairs', { seat: actor.seat, to: actor.floor });
    return;
  }
}

/** Warp zone: two mouths on the same floor, a link between them. */
function stepWarps(match, actor) {
  if (actor.warpCooldown > 0) return;
  const warp = match.stage.warps.find(
    (w) => w.floor === actor.floor && Math.hypot(actor.x - w.x, actor.z - w.z) <= PAD.radius * 0.7,
  );
  if (!warp) return;
  actor.floor = warp.floor;
  actor.x = warp.toX;
  actor.z = warp.toZ;
  actor.warpCooldown = PAD.warpCooldown;
  actor.climb = 0.3;
  actor.stairLock = 0.5;
  actor.path = null;
  emit(match, 'warp', { seat: actor.seat, floor: actor.floor });
}

function stepPads(match, actor) {
  for (const pad of match.stage.pads || []) {
    if (pad.floor !== actor.floor) continue;
    if (Math.hypot(actor.x - pad.x, actor.z - pad.z) <= PAD.radius) {
      if (actor.speedBoost <= 0) emit(match, 'speedPad', { seat: actor.seat });
      actor.speedBoost = PAD.speedSeconds;
    }
  }
}

function stepDoors(match, actor, gim) {
  const g = match.stage.gimmick;
  if (!g || g.kind !== 'school' || !gim || !gim.shut) return;
  for (const door of g.doors) {
    if (door.floor !== actor.floor) continue;
    if (!pointInRect(actor.x, actor.z, door)) continue;
    // Push the actor back the way it came (its own side of the shutter).
    const dz = actor.z - door.z;
    const push = Math.sign(dz || (actor.z > 0 ? 1 : -1));
    actor.z = door.z + push * (door.d / 2 + ACTOR.radius + 0.05);
    actor.path = null;
  }
}

/**
 * Build 37: a frozen player is not switched to another character any more. The
 * camera stays on them and the stick pans it (render/view.js), so there is no
 * spectator seat to choose. Kept as a trivially true helper for the HUD.
 */
export function spectatorTarget(match) {
  const player = match.actors[0];
  if (player.state !== 'frozen') return null;
  return player;
}
