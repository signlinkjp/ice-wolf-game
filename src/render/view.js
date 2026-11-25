/**
 * The renderer, camera and the three scenes the app moves between:
 *   menu backdrop (slow orbit over the chosen arena),
 *   opening (a wolf chases a human across fresh ice, 3 s, tap to skip),
 *   match (third-person follow, or overhead while frozen).
 */
import * as THREE from '../../vendor/three.module.js';
import { ARENA } from '../config.js';
import { buildStage, decorateZones } from './stage3d.js';
import { ActorView } from './actors3d.js';
import { Effects } from './effects.js';
import { standard } from './materials.js';

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
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 260);
    this.camera.position.set(0, 18, 34);
    this.camera.lookAt(0, 0, 0);

    this.hemi = new THREE.HemisphereLight('#eaf6ff', '#8fb0c6', 1.8);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#ffffff', 2.2);
    this.sun.position.set(26, 21, 12);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -30;
    this.sun.shadow.camera.right = 30;
    this.sun.shadow.camera.top = 30;
    this.sun.shadow.camera.bottom = -30;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 90;
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
    this.cameraPos = new THREE.Vector3(0, 18, 34);
    this.cameraLook = new THREE.Vector3(0, 0, 0);
    this.orbit = 0;
    this.opening = null;
    this.shake = 0;
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
    if (previousActors) {
      this.actors = previousActors;
      for (const [, v] of this.actors) this.scene.add(v.group);
    }
    return view;
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

  startOpening(stage) {
    this.setStage(stage);
    this.mode = 'opening';
    const wolf = new ActorView(
      { seat: 1, name: 'W', displayName: '', role: 'firstWolf', state: 'active', x: 0, z: 0, floor: 1, wolfTimer: 1, y: 0 },
      stage,
    );
    const human = new ActorView(
      { seat: 2, name: 'H', displayName: '', role: 'human', state: 'active', x: 0, z: 0, floor: 1, wolfTimer: 0, y: 0 },
      stage,
    );
    wolf.label.visible = false;
    human.label.visible = false;
    this.scene.add(wolf.group, human.group);
    this.opening = {
      t: 0,
      wolf,
      human,
      path: [
        new THREE.Vector3(-22, 0, 8),
        new THREE.Vector3(-6, 0, 2),
        new THREE.Vector3(10, 0, -6),
        new THREE.Vector3(20, 0, 4),
      ],
    };
    this.effects.clear();
  }

  /** Returns true when the opening has finished. */
  updateOpening(dt) {
    const o = this.opening;
    if (!o) return true;
    o.t += dt;
    const t = o.t / 3.1;
    const lerpPath = (p, u, out) => {
      const seg = Math.max(0, Math.min(1, u)) * (p.length - 1);
      const i = Math.min(p.length - 2, Math.floor(seg));
      const f = seg - i;
      out.copy(p[i]).lerp(p[i + 1], f);
      return out;
    };
    const hp = new THREE.Vector3();
    lerpPath(o.path, Math.min(1, t * 1.05), hp);
    const wp = new THREE.Vector3();
    lerpPath(o.path, Math.min(1, t * 1.05 - 0.09), wp);
    o.human.group.position.copy(hp);
    o.wolf.group.position.copy(wp);
    o.human.group.position.y = Math.abs(Math.sin(o.t * 9)) * 0.12;
    o.wolf.group.position.y = Math.abs(Math.sin(o.t * 9 + 1)) * 0.14;
    o.human.group.rotation.y = Math.atan2(hp.x - wp.x, hp.z - wp.z) + Math.PI;
    o.wolf.group.rotation.y = Math.atan2(hp.x - wp.x, hp.z - wp.z);
    o.human.body.rotation.x = 0.18;
    o.wolf.body.rotation.x = 0.2;
    o.human.legL.rotation.x = Math.sin(o.t * 12) * 0.9;
    o.human.legR.rotation.x = -Math.sin(o.t * 12) * 0.9;
    o.human.armL.rotation.x = -Math.sin(o.t * 12) * 0.7;
    o.human.armR.rotation.x = Math.sin(o.t * 12) * 0.7;
    o.wolf.legL.rotation.x = Math.sin(o.t * 12 + 1) * 0.9;
    o.wolf.legR.rotation.x = -Math.sin(o.t * 12 + 1) * 0.9;
    if (Math.random() < dt * 18) this.effects.puff(o.human.group.position);
    if (Math.random() < dt * 14) this.effects.spawn(o.wolf.group.position.x, 0.2, o.wolf.group.position.z, '#ffd6d6', 1, 0.8, 0.6, 0.4);
    if (o.t > 1.2 && !o.burst) {
      o.burst = true;
      this.effects.freeze(new THREE.Vector3(0, 0, 0));
    }
    // Camera: low wide tracking shot, then pull up under the logo.
    const focus = hp.clone().lerp(wp, 0.4);
    const camX = focus.x - 4;
    const camZ = focus.z + 13;
    this.camera.position.set(camX, 5.2 + Math.sin(t * 2) * 0.4, camZ);
    this.camera.lookAt(focus.x + 2, 1.6, focus.z - 2);
    return o.t > 3.1;
  }

  endOpening() {
    if (this.opening) {
      this.scene.remove(this.opening.wolf.group, this.opening.human.group);
      disposeGeometries(this.opening.wolf.group);
      disposeGeometries(this.opening.human.group);
    }
    this.opening = null;
    this.mode = 'menu';
  }

  updateMenu(dt) {
    this.orbit += dt * 0.09;
    const r = 33;
    this.camera.position.set(Math.cos(this.orbit) * r, 17 + Math.sin(this.orbit * 0.7) * 2.2, Math.sin(this.orbit) * r * 0.8);
    this.camera.lookAt(0, 2, 0);
  }

  /* ---------------- match camera ---------------- */

  focusPoint(match) {
    if (this.lookAtOther && performance.now() < this.lookAtOther.until) {
      const f = this.lookAtOther.floor;
      return { x: f === 2 ? 15 : -9, y: f === 2 ? ARENA.deckY : 0, z: 0, frozen: false };
    }
    const player = match.actors[0];
    if (player.state === 'frozen' && match.spectateSeat !== undefined && match.spectateSeat !== null) {
      const other = match.actors.find((a) => a.seat === match.spectateSeat);
      if (other) return { x: other.x, y: (other.floor === 2 ? ARENA.deckY : 0), z: other.z, frozen: true };
    }
    if (player.state === 'frozen') {
      return { x: player.frozenX ?? player.x, y: player.frozenFloor === 2 ? ARENA.deckY : 0, z: player.frozenZ ?? player.z, frozen: true };
    }
    return { x: player.x, y: player.y ?? (player.floor === 2 ? ARENA.deckY : 0), z: player.z, frozen: false };
  }

  updateCamera(match, dt, cameraMode = 'normal') {
    const f = this.focusPoint(match);
    const overhead = cameraMode === 'top' || f.frozen;
    const dist = overhead ? 19 : 11;
    const height = overhead ? 21 : 10.4;
    const wanted = new THREE.Vector3(f.x, f.y + height, f.z + dist * (overhead ? 0.45 : 1));
    this.cameraPos.lerp(wanted, Math.min(1, dt * (f.frozen ? 2.2 : 5.5)));
    this.camera.position.copy(this.cameraPos);
    if (this.shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 3);
    }
    this.cameraLook.lerp(new THREE.Vector3(f.x, f.y + 1.2, f.z), Math.min(1, dt * 6));
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
