/**
 * CPU brains.
 *
 * A brain returns the same input object a finger produces, so online play and
 * offline play run through one movement path. Humans rescue, work the switches
 * and run for an opened gate; the first wolf hunts openly during Wolf Mode and
 * loiters the rest of the time; a werewolf hides as a human and transforms when
 * nobody is watching (or when it can reach a lone human).
 */
import { ACTOR, WOLF } from '../config.js';
import { buildNav, findPath, isWalkable } from './geometry.js';
import {
  gimmickPhase,
  isWolfRole,
  livingHumans,
  targetableFrozen,
  wolvesAlive,
} from './rules.js';

function navOf(match) {
  if (!match.nav) match.nav = buildNav(match.stage);
  return match.nav;
}

function aiOf(actor) {
  if (!actor.ai) {
    actor.ai = { goal: null, goalKey: '', path: null, pathAt: 0, wp: 0, wander: null, stuckAt: 0, lastX: actor.x, lastZ: actor.z };
  }
  return actor.ai;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function setGoal(match, actor, goal, key, force = false) {
  const ai = aiOf(actor);
  if (!force && ai.goalKey === key && ai.path) return;
  ai.goal = goal;
  ai.goalKey = key;
  ai.path = findPath(navOf(match), actor, goal);
  ai.pathAt = match.elapsed;
  ai.wp = 0;
}

function steer(match, actor) {
  const ai = aiOf(actor);
  if (!ai.path || !ai.path.length) return { mx: 0, mz: 0 };
  while (ai.wp < ai.path.length - 1) {
    const node = ai.path[ai.wp];
    if (Math.hypot(node.x - actor.x, node.z - actor.z) < 1.1) ai.wp += 1;
    else break;
  }
  const node = ai.path[Math.min(ai.wp, ai.path.length - 1)];
  const dx = node.x - actor.x;
  const dz = node.z - actor.z;
  const len = Math.hypot(dx, dz);
  if (len < 0.2) return { mx: 0, mz: 0 };
  return { mx: dx / len, mz: dz / len };
}

function wanderPoint(match, actor) {
  const ai = aiOf(actor);
  if (ai.wander && Math.hypot(ai.wander.x - actor.x, ai.wander.z - actor.z) > 2) {
    return steer(match, actor);
  }
  const rng = match.rng;
  for (let i = 0; i < 24; i += 1) {
    const floor = rng() < 0.5 ? 1 : 2;
    const x = floor === 1 ? -21 + rng() * 24 : 8 + rng() * 14;
    const z = -15 + rng() * 30;
    if (!isWalkable(match.stage, floor, x, z, ACTOR.radius * 1.6)) continue;
    if (floor !== actor.floor) {
      // Pick the nearest stair landing on the other floor instead of a random
      // point so the walk is plausible.
      const stair = match.stage.stairs.find((s) => s.floor === actor.floor);
      if (!stair) continue;
      setGoal(match, actor, { x: stair.x, z: stair.z, floor: actor.floor }, `wander-${Math.round(x)}-${Math.round(z)}`);
    } else {
      setGoal(match, actor, { x, z, floor }, `wander-${Math.round(x)}-${Math.round(z)}`);
    }
    ai.wander = { x, z, floor };
    return steer(match, actor);
  }
  return { mx: 0, mz: 0 };
}

function rescueInput(match, actor, target) {
  return { mx: 0, mz: 0, rescue: true };
}

function nearestBy(actor, list, max = Infinity) {
  let best = null;
  let bestD = max;
  for (const item of list) {
    const d = distance(actor, item);
    if (item.floor === actor.floor && d < bestD) {
      best = item;
      bestD = d;
    }
  }
  return best;
}

export function brain(match, actor, dt, gim = null) {
  if (match.phase !== 'play') return { mx: 0, mz: 0 };
  if (!actor.ai) aiOf(actor);
  const ai = actor.ai;
  // Re-path now and then; the world is small and the paths are cheap.
  if (ai.path && match.elapsed - ai.pathAt > 0.9) {
    ai.path = findPath(navOf(match), actor, ai.goal);
    ai.pathAt = match.elapsed;
  }
  // Unstick: if the actor barely moved for a second, drop the goal.
  if (match.elapsed - ai.stuckAt > 1) {
    const moved = Math.hypot(actor.x - ai.lastX, actor.z - ai.lastZ);
    if (moved < 0.25 && actor.moving) ai.path = null;
    ai.lastX = actor.x;
    ai.lastZ = actor.z;
    ai.stuckAt = match.elapsed;
  }

  const enemies = wolvesAlive(match);
  const nearestWolf = nearestBy(actor, enemies);
  const wolfNear = nearestWolf ? distance(actor, nearestWolf) : Infinity;
  const inWolfMode = nearestWolf ? nearestWolf.wolfTimer > 0 : false;

  if (actor.role === 'human') {
    // 1. A frozen teammate right here: keep holding the rescue.
    if (actor.rescueHold) {
      const target = match.actors.find((a) => a.seat === actor.rescueHold.seat);
      if (target && target.state === 'frozen') return rescueInput(match, actor, target);
    }
    const thaw = nearestBy(actor, targetableFrozen(match), 16);
    if (thaw) {
      if (distance(actor, thaw) <= 1.9) return rescueInput(match, actor, thaw);
      if (!inWolfMode || wolfNear > 4) {
        setGoal(match, actor, thaw, `thaw-${thaw.seat}`);
        return steer(match, actor);
      }
    }
    // 2. Run from a wolf that is hunting right now.
    if (inWolfMode && wolfNear < 6.5) {
      const dx = actor.x - nearestWolf.x;
      const dz = actor.z - nearestWolf.z;
      const len = Math.hypot(dx, dz) || 1;
      const fleeX = actor.x + (dx / len) * 6;
      const fleeZ = actor.z + (dz / len) * 6;
      if (isWalkable(match.stage, actor.floor, fleeX, fleeZ, ACTOR.radius)) {
        setGoal(match, actor, { x: fleeX, z: fleeZ, floor: actor.floor }, `flee-${Math.round(fleeX)}-${Math.round(fleeZ)}`);
        return steer(match, actor);
      }
    }
    // 3. An opened gate is the win: run for it.
    if (match.gateOpened !== null) {
      const gate = match.gates.find((g) => g.open);
      if (gate) {
        setGoal(match, actor, gate, `gate-${gate.id}`);
        return steer(match, actor);
      }
    }
    // 4. Otherwise work the switches.
    const sw = nearestBy(actor, match.switches.filter((s) => !s.active && !s.triggered));
    if (sw) {
      if (distance(actor, sw) <= 1.4) return { mx: 0, mz: 0, useSwitch: true };
      setGoal(match, actor, sw, `switch-${sw.id}`);
      return steer(match, actor);
    }
    return wanderPoint(match, actor);
  }

  // ---- wolves ----
  const humans = livingHumans(match);
  const frozen = match.actors.filter((a) => a.state === 'frozen' && a.role === 'human');
  // Only the master wolf (firstWolf) may name the bait ice; the second wolf
  // and the trap-born third wolf keep hunting.
  if (actor.role === 'firstWolf' && !match.infectionUsed && frozen.length) {
    const near = nearestBy(actor, frozen, WOLF.infectRange);
    if (near && actor.wolfTimer > 0) return { mx: 0, mz: 0, infect: near.seat };
  }
  const prey = nearestBy(actor, humans);
  if (!prey) return wanderPoint(match, actor);

  if (actor.role === 'werewolf') {
    // A werewolf can only hunt while transformed.
    if (actor.wolfTimer > 0) {
      setGoal(match, actor, prey, `hunt-${prey.seat}`);
      return steer(match, actor);
    }
    const d = distance(actor, prey);
    const ready = actor.wolfCooldown <= 0.2;
    const unwatched = humans.filter((h) => distance(h, actor) < 7).length <= 1;
    if (ready && d < 4.2 && unwatched) return { mx: 0, mz: 0, wolf: true };
    // Blend in: walk the switches like everyone else.
    const sw = nearestBy(actor, match.switches.filter((s) => !s.active && !s.triggered));
    if (sw && d > 5) {
      if (distance(actor, sw) <= 1.4) return { mx: 0, mz: 0, useSwitch: true };
      setGoal(match, actor, sw, `switch-${sw.id}`);
      return steer(match, actor);
    }
    if (d > 5) {
      setGoal(match, actor, prey, `stalk-${prey.seat}`);
      return steer(match, actor);
    }
    return wanderPoint(match, actor);
  }

  // First wolf: wolf for the whole match, but it only shows red in Wolf Mode.
  const d = distance(actor, prey);
  if (actor.wolfCooldown <= 0.2 && d < 5.0 && prey.floor === actor.floor) {
    return { mx: 0, mz: 0, wolf: true };
  }
  if (actor.wolfTimer > 0) {
    setGoal(match, actor, prey, `hunt-${prey.seat}`);
    return steer(match, actor);
  }
  // Off the clock, drift towards the nearest prey but keep a polite distance so
  // it does not look like a straight-line chase.
  if (d > 7) {
    setGoal(match, actor, prey, `stalk-${prey.seat}`);
    return steer(match, actor);
  }
  return wanderPoint(match, actor);
}

export function makeBrain() {
  return brain;
}
