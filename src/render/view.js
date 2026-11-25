/**
 * The renderer, camera and the three scenes the app moves between:
 *   menu backdrop (slow orbit over the chosen stage's 1F hall),
 *   opening (a wolf chases humans across fresh ice, ~3 s, tap to skip),
 *   match (chase follow with DOROKEI-style occlusion handling, or overhead
 *   while frozen).
 */
import * as THREE from '../../vendor/three.module.js';
import { ARENA, CAMERA, FROZEN_CAM } from '../config.js';
import { floorCenter, floorBounds, isWalkable, segmentRectRange } from '../core/geometry.js';
import { buildStage, decorateZones } from './stage3d.js';
import { ActorView } from './actors3d.js';
import { Effects } from './effects.js';
import { audio } from '../audio.js';

/** A soft vertical sky gradient so the backdrop is not one flat colour. */
const skyCache = new Map();
function skyTexture(top, bottom) {
  const key = `${top}|${bottom}`;
  if (skyCache.has(key)) return skyCache.get(key);
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top);
  g.addColorStop(0.62, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  skyCache.set(key, tex);
  return tex;
}

function disposeGeometries(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
  });
}

/** The longest straight, wall-free lanes along a stage's 1F hall. */
function pickChaseLanes(stage) {
  const b = floorBounds(stage, 1);
  const lanes = [];
  for (let z = b.z0 + 3; z <= b.z1 - 3; z += 2) {
    let start = null;
    let best = null;
    for (let x = b.x0 + 2; x <= b.x1 - 2; x += 1) {
      const ok = isWalkable(stage, 1, x, z, 0.8);
      if (ok && start === null) start = x;
      if ((!ok || x >= b.x1 - 2) && start !== null) {
        const end = ok ? x : x - 1;
        if (!best || end - start > best[1] - best[0]) best = [start, end];
        start = null;
      }
    }
    if (best && best[1] - best[0] >= 10) lanes.push({ z, xa: best[0], xb: best[1] });
  }
  lanes.sort((a, c) => c.xb - c.xa - (a.xb - a.xa));
  return lanes;
}

/** A two-point run along a lane, with the wolf starting behind the runner. */
function laneToPath(lane) {
  const V = (x, z) => new THREE.Vector3(x, 0, z);
  return [V(lane.xa + 0.5, lane.z), V(lane.xa + 1.6, lane.z), V(lane.xb - 0.5, lane.z)];
}

export class View {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 320);
    this.camera.position.set(-28, 18, 34);
    this.camera.lookAt(-28, 0, 0);

    this.hemi = new THREE.HemisphereLight('#eaf6ff', '#8fb0c6', 1.8);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#ffffff', 2.2);
    this.sun.position.set(-14, 26, 14);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -46;
    this.sun.shadow.camera.right = 46;
    this.sun.shadow.camera.top = 46;
    this.sun.shadow.camera.bottom = -46;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 120;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.04;
    this.sun.shadow.camera.updateProjectionMatrix();
    this.scene.add(this.sun);
    this.rim = new THREE.DirectionalLight('#bfe8ff', 1.4);
    this.rim.position.set(20, 12, -22);
    this.scene.add(this.rim);

    this.effects = new Effects(this.scene);
    this.stageView = null;
    this.actors = new Map();
    this.mode = 'menu';
    this.cameraPos = new THREE.Vector3(-28, 18, 34);
    this.cameraLook = new THREE.Vector3(-28, 0, 0);
    this.orbit = 0;
    this.menuFocus = { x: -28, z: 0 };
    this.opening = null;
    this.shake = 0;
    // Build 37: the frozen player's camera focus offset, in metres.
    this.frozenPan = { x: 0, z: 0 };
    // Build 38: how far the camera rises when the player hugs a tall solid.
    this.camLift = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1 ? 58 : 52;
    this.camera.updateProjectionMatrix();
  }

  clearStage() {
    if (!this.stageView) return;
    this.scene.remove(this.stageView.group);
    disposeGeometries(this.stageView.group);
    this.stageView = null;
    for (const [, view] of this.actors) {
      this.scene.remove(view.group);
      disposeGeometries(view.group);
    }
    this.actors.clear();
    this.effects.clear();
  }

  setStage(stage, { keepActors = false } = {}) {
    if (this.stageView && this.stageView.stage.id === stage.id && keepActors) return this.stageView;
    const previousActors = keepActors ? this.actors : null;
    this.clearStage();
    const view = buildStage(stage);
    this.scene.add(view.group);
    decorateZones(view, stage);
    this.stageView = view;
    const p = stage.palette;
    // The amusement park turns cast shadows off: its ice is lit by strings of
    // lights, and one long black-purple shadow across the purple rink read as a
    // bug. Every other stage keeps the soft sun shadow.
    const shadows = stage.shadows !== false;
    this.sun.castShadow = shadows;
    this.renderer.shadowMap.enabled = shadows;
    this.scene.background = skyTexture(p.sky, p.cap);
    this.scene.fog = new THREE.Fog(p.fog, p.fogNear, p.fogFar);
    this.hemi.color.set(p.hemiSky);
    this.hemi.groundColor.set(p.hemiGround);
    this.hemi.intensity = 1.8;
    this.sun.color.set(p.sun);
    this.sun.intensity = 2.2;
    this.rim.color.set(p.accent);
    this.rim.intensity = 1.2;
    this.renderer.toneMappingExposure = p.exposure || 1.05;
    const c = floorCenter(stage, 1);
    this.menuFocus = { x: c.x, z: c.z };
    if (previousActors) {
      this.actors = previousActors;
      for (const [, v] of this.actors) this.scene.add(v.group);
    }
    return view;
  }

  /** Rebuild every in-world sign after a language change. */
  refreshLabels() {
    this.stageView?.refreshLabels?.();
  }

  buildActors(match) {
    for (const [, view] of this.actors) {
      this.scene.remove(view.group);
      disposeGeometries(view.group);
    }
    this.actors.clear();
    for (const actor of match.actors) {
      const view = new ActorView(actor, match.stage);
      view.onPuff = (pos) => this.effects.puff(pos);
      this.scene.add(view.group);
      this.actors.set(actor.seat, view);
    }
  }

  setActorName(match, seat, name) {
    const view = this.actors.get(seat);
    if (view) view.setLabel(name);
    const actor = match.actors.find((a) => a.seat === seat);
    if (actor) actor.displayName = name;
  }

  updateActors(match, dt) {
    for (const actor of match.actors) {
      const view = this.actors.get(actor.seat);
      if (!view) continue;
      view.update(dt, actor);
    }
  }

  /* ---------------- menu / opening ---------------- */

  showMenu(stageId) {
    this.mode = 'menu';
    this.opening = null;
    this.effects.clear();
  }

  /**
   * Build 38 opening: a 3.2 s title sequence in the world itself.
   *   0.0  a low, wide shot from the corner of the 1F hall; blizzard
   *   0.4  the master wolf bursts out and chases two humans across the ice
   *   1.7  it catches one: a freeze burst, the human becomes an ice block
   *   2.2  the camera rises and pulls back while the title slams in (DOM)
   *   3.2  the menu takes over. A tap anywhere skips at any point.
   */
  startOpening(stage) {
    this.setStage(stage);
    this.mode = 'opening';
    const make = (actor) => {
      const v = new ActorView(actor, stage);
      v.label.visible = false;
      return v;
    };
    const wolf = make({ seat: 1, name: 'W', displayName: '', role: 'firstWolf', form: 'wolf', state: 'active', x: 0, z: 0, floor: 1, wolfTimer: 0, y: 0 });
    const humanA = make({ seat: 2, name: 'H', displayName: '', role: 'human', form: 'human', state: 'active', x: 0, z: 0, floor: 1, wolfTimer: 0, y: 0 });
    const humanB = make({ seat: 3, name: 'H2', displayName: '', role: 'human', form: 'human', state: 'active', x: 0, z: 0, floor: 1, wolfTimer: 0, y: 0 });
    this.scene.add(wolf.group, humanA.group, humanB.group);
    const c = floorCenter(stage, 1);
    // The chase runs down the longest clear corridor of this stage's 1F hall,
    // so nobody ever runs through a wall in the title (every stage has one).
    const lanes = pickChaseLanes(stage);
    const laneA = lanes[0] || { z: c.z, xa: c.x - 16, xb: c.x + 16 };
    const laneB = lanes[1] || lanes[0] || { z: c.z + 4, xa: c.x - 14, xb: c.x + 14 };
    this.opening = {
      t: 0,
      t0: performance.now(),
      wolf,
      human: humanA,
      humanB,
      caught: false,
      centre: c,
      stage,
      dir: laneA.xb >= laneA.xa ? 1 : -1,
      paths: {
        a: laneToPath(laneA),
        b: laneToPath(laneB),
      },
    };
    this.effects.clear();
    audio.play('wolf');
  }

  /** Returns true when the opening has finished. */
  updateOpening(dt) {
    const o = this.opening;
    if (!o) return true;
    // Build 38: the title is driven by the wall clock, not by summed frames.
    // On a slow renderer the old sum only reached half a second in three
    // seconds of real time, which is why the opening "flashed past".
    o.t = (performance.now() - o.t0) / 1000;
    const t = o.t;
    const lerpPath = (p, u, out) => {
      const seg = Math.max(0, Math.min(1, u)) * (p.length - 1);
      const i = Math.min(p.length - 2, Math.floor(seg));
      const f = seg - i;
      out.copy(p[i]).lerp(p[i + 1], f);
      return out;
    };
    const u = Math.min(1, t / 2.6);
    const hp = new THREE.Vector3();
    const bp = new THREE.Vector3();
    const wp = new THREE.Vector3();
    lerpPath(o.paths.a, u * 1.02, hp);
    lerpPath(o.paths.b, u * 0.92, bp);
    lerpPath(o.paths.a, Math.max(0, u * 1.02 - 0.05), wp);
    o.human.group.position.copy(hp);
    o.humanB.group.position.copy(bp);
    o.wolf.group.position.copy(wp);
    const bob = (p, k) => {
      p.position.y = Math.abs(Math.sin(t * 10 + k)) * 0.13;
    };
    bob(o.human.group, 0);
    bob(o.humanB.group, 1.4);
    bob(o.wolf.group, 2.1);
    o.human.group.rotation.y = Math.atan2(hp.x - wp.x, hp.z - wp.z) + Math.PI;
    o.humanB.group.rotation.y = Math.atan2(bp.x - wp.x, bp.z - wp.z) + Math.PI;
    o.wolf.group.rotation.y = Math.atan2(hp.x - wp.x, hp.z - wp.z);
    o.human.body.rotation.x = 0.18;
    o.wolf.body.rotation.x = 0.2;
    o.human.legL.rotation.x = Math.sin(t * 12) * 0.9;
    o.human.legR.rotation.x = -Math.sin(t * 12) * 0.9;
    o.human.armL.rotation.x = -Math.sin(t * 12) * 0.7;
    o.human.armR.rotation.x = Math.sin(t * 12) * 0.7;
    o.humanB.legL.rotation.x = Math.sin(t * 12 + 1) * 0.9;
    o.humanB.legR.rotation.x = -Math.sin(t * 12 + 1) * 0.9;
    o.wolf.legL.rotation.x = Math.sin(t * 12 + 3) * 0.95;
    o.wolf.legR.rotation.x = -Math.sin(t * 12 + 3) * 0.95;
    if (Math.random() < dt * 20) this.effects.puff(o.human.group.position);
    if (Math.random() < dt * 16) this.effects.spawn(o.wolf.group.position.x, 0.2, o.wolf.group.position.z, '#ffd6d6', 1, 0.8, 0.6, 0.5);
    // The catch: the human freezes and the wolf halts over the ice block.
    if (!o.caught && t > 1.75) {
      o.caught = true;
      o.human.group.visible = false;
      this.effects.freeze(new THREE.Vector3(hp.x, 0, hp.z));
      audio.play('freeze');
      this.shakeCamera(0.35);
    }
    // Camera: a low chase cam behind the wolf, looking down the lane at the
    // runner, then a rise under the logo at the end (2.5 s).
    const focus = hp.clone().lerp(wp, 0.4);
    const rise = Math.max(0, Math.min(1, (t - 2.5) / 0.9));
    const hall = floorBounds(o.stage, 1);
    const dir = o.dir;
    const chaseX = wp.x - dir * 7.2;
    // Pick the side of the lane the camera can actually stand on, so the title
    // shot never opens behind a wall.
    const inHall = (x, z) => z > hall.z0 + 1.4 && z < hall.z1 - 1.4 && isWalkable(o.stage, 1, x, z, 0.3);
    let chaseZ = wp.z + 3.2;
    if (!inHall(chaseX, chaseZ)) chaseZ = wp.z - 3.2;
    if (!inHall(chaseX, chaseZ)) chaseZ = wp.z;
    chaseZ = Math.min(hall.z1 - 1.6, Math.max(hall.z0 + 1.6, chaseZ));
    const topX = focus.x - dir * 2.0;
    const topZ = Math.min(hall.z1 - 1.8, Math.max(hall.z0 + 1.8, focus.z + 8.5));
    const camX = chaseX + (topX - chaseX) * rise;
    const camZ = chaseZ + (topZ - chaseZ) * rise;
    const camY = 6.4 + Math.sin(t * 1.6) * 0.2 + (12.4 - 6.4) * rise * rise;
    this.camera.position.set(camX, camY, camZ);
    const lookX = hp.x + (focus.x - hp.x) * rise;
    const lookZ = hp.z + (focus.z - hp.z) * rise;
    this.camera.lookAt(lookX, 1.4 + rise * 0.2, lookZ);
    return o.t > 3.2;
  }

  endOpening() {
    if (this.opening) {
      this.scene.remove(this.opening.wolf.group, this.opening.human.group, this.opening.humanB.group);
      disposeGeometries(this.opening.wolf.group);
      disposeGeometries(this.opening.human.group);
      disposeGeometries(this.opening.humanB.group);
    }
    this.opening = null;
    this.mode = 'menu';
  }

  updateMenu(dt) {
    this.orbit += dt * 0.09;
    const r = 32;
    const cx = this.menuFocus?.x ?? -28;
    const cz = this.menuFocus?.z ?? 0;
    this.camera.position.set(cx + Math.cos(this.orbit) * r, 16 + Math.sin(this.orbit * 0.7) * 2.2, cz + Math.sin(this.orbit) * r * 0.8);
    this.camera.lookAt(cx, 1.5, cz);
  }

  /* ---------------- match camera ---------------- */

  focusPoint(match) {
    if (this.lookAtOther && performance.now() < this.lookAtOther.until) {
      const f = this.lookAtOther.floor;
      const c = floorCenter(match.stage, f);
      return { x: c.x, y: 0, z: c.z, frozen: false, otherFloor: true };
    }
    const player = match.actors[0];
    if (player.state === 'frozen') {
      // Build 37: stay with the frozen player; the stick pans the focus.
      const bx = (player.frozenX ?? player.x) + this.frozenPan.x;
      const bz = (player.frozenZ ?? player.z) + this.frozenPan.z;
      return { x: bx, y: 0, z: bz, frozen: true };
    }
    return { x: player.x, y: player.y ?? 0, z: player.z, frozen: false };
  }

  /** Move the frozen camera's focus (metres). Clamped to the arena. */
  panFrozen(dx, dz) {
    this.frozenPan.x = Math.max(-FROZEN_CAM.panX, Math.min(FROZEN_CAM.panX, this.frozenPan.x + dx));
    this.frozenPan.z = Math.max(-FROZEN_CAM.panZ, Math.min(FROZEN_CAM.panZ, this.frozenPan.z + dz));
  }

  /** Point the frozen camera at a world position (used by the ‹ › buttons). */
  setFrozenPan(x, z) {
    this.frozenPan.x = Math.max(-FROZEN_CAM.panX, Math.min(FROZEN_CAM.panX, x));
    this.frozenPan.z = Math.max(-FROZEN_CAM.panZ, Math.min(FROZEN_CAM.panZ, z));
  }

  /** CAM while frozen: glide back to the player. */
  recenterFrozen() {
    this.frozenPan.x = 0;
    this.frozenPan.z = 0;
  }

  /**
   * DOROKEI's camera lesson, applied here: anything tall between the camera and
   * the player turns semi-transparent, and the camera rises a little when the
   * player is hugging a tall solid. That is what keeps a body in an alley or
   * behind a tent visible instead of a wall filling the frame.
   */
  updateOcclusion(player) {
    const view = this.stageView;
    if (!view || !view.occluders || !player) return;
    const cam = this.camera.position;
    const px = player.x;
    const pz = player.z;
    const dx = px - cam.x;
    const dz = pz - cam.z;
    const segLen = Math.hypot(dx, dz) || 1;
    const pad = 0.2 / segLen;
    let near = 0;
    for (const occ of view.occluders) {
      const s = occ.solid;
      let block = false;
      const range = segmentRectRange(cam.x, cam.z, px, pz, s.x, s.z, s.hw, s.hd);
      if (range) {
        const t0 = Math.max(0, range[0] + pad);
        const t1 = Math.min(1, range[1] - pad);
        if (t1 > t0) {
          // Test the sight line to the player's feet-and-body, not the head:
          // a 2.8 m board can hide the legs of a body standing right behind it.
          const h = cam.y + (0.4 - cam.y) * t1;
          block = h < s.h;
        }
      }
      const want = block ? CAMERA.occludedOpacity : 1;
      s.fade += (want - s.fade) * 0.18;
      if (Math.abs(s.fade - want) < 0.004) s.fade = want;
      for (const m of s.mats) {
        const transparent = s.fade < 0.995;
        if (m.transparent !== transparent) {
          m.transparent = transparent;
          m.depthWrite = !transparent;
          m.needsUpdate = true;
        }
        m.opacity = s.fade;
      }
      const ddx = Math.max(Math.abs(px - s.x) - s.hw, 0);
      const ddz = Math.max(Math.abs(pz - s.z) - s.hd, 0);
      if (Math.hypot(ddx, ddz) < CAMERA.liftRange) near = Math.max(near, s.h);
    }
    const wantLift = near > 6 ? CAMERA.lift : 0;
    this.camLift += (wantLift - this.camLift) * 0.1;
    if (Math.abs(this.camLift - wantLift) < 0.02) this.camLift = wantLift;
  }

  updateCamera(match, dt, cameraMode = 'normal') {
    const f = this.focusPoint(match);
    // Unfreeze: the pan eases home so the next chase starts centred.
    if (!f.frozen) {
      this.frozenPan.x *= Math.max(0, 1 - dt * 3.2);
      this.frozenPan.z *= Math.max(0, 1 - dt * 3.2);
      if (Math.abs(this.frozenPan.x) < 0.05) this.frozenPan.x = 0;
      if (Math.abs(this.frozenPan.z) < 0.05) this.frozenPan.z = 0;
    }
    const player = match.actors[0];
    const overhead = cameraMode === 'top' || f.frozen;
    // Lead the chase a little in the direction of travel, so the space ahead is
    // on screen instead of the space already crossed.
    let leadX = 0;
    let leadZ = 0;
    if (!overhead && player && player.moving) {
      leadX = Math.sin(player.yaw || 0) * CAMERA.lead;
      leadZ = Math.cos(player.yaw || 0) * CAMERA.lead;
    }
    const dist = overhead ? CAMERA.topBehind : CAMERA.behind;
    const height = (overhead ? CAMERA.topHeight : CAMERA.height) + this.camLift;
    const wanted = new THREE.Vector3(f.x + leadX, f.y + height, f.z + dist);
    this.cameraPos.lerp(wanted, Math.min(1, dt * (f.frozen ? 3.4 : 5.5)));
    this.camera.position.copy(this.cameraPos);
    if (this.shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 3);
    }
    this.updateOcclusion(f.frozen ? null : player);
    this.cameraLook.lerp(new THREE.Vector3(f.x + leadX * 0.5, f.y + 1.2, f.z), Math.min(1, dt * (f.frozen ? 3.6 : 6)));
    this.camera.lookAt(this.cameraLook);
  }

  render(dt) {
    if (this.stageView) this.stageView.update(dt, this.lastMatch || null, this.lastGim || null);
    this.effects.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  shakeCamera(amount = 0.35) {
    this.shake = Math.max(this.shake, amount);
  }
}

export function createView(canvas) {
  return new View(canvas);
}
