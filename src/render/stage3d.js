/**
 * The six arenas in 3D.
 *
 * Build 38: two separate halls, side by side (west = 1F, east = 2F), each one a
 * 48 x 40 m ice floor walled off from the other. The void between them holds a
 * tall ice ridge, so the hall you are not in is never laid over the one you are
 * playing, and the camera never has to look through a floor.
 *
 * Per stage: inner walls with snow caps, a palette, wall/floor pictures from the
 * existing asset folder, set dressing, weather and the gimmick show.
 *
 * Every interactive thing carries a sign written in the player's language:
 * スイッチ on each switch, 階段 with the floor it leads to on each stair gate,
 * ワープ on each warp mouth, and 1F / 2F on each hall. The signs are rebuilt when
 * the language changes (refreshLabels).
 */
import * as THREE from '../../vendor/three.module.js';
import { ARENA } from '../config.js';
import { wallsForFloor, floorRects } from '../core/geometry.js';
import { t } from '../i18n.js';
import { standard, surface, glow, labelTexture } from './materials.js';

const WALL_H = ARENA.wallH;

/**
 * Colours the player has to be able to name from across the hall, whatever
 * stage is behind them. The ice is white-blue everywhere, so the interactive
 * furniture gets its own warm / magenta / green language instead of borrowing
 * the stage accent.
 */
const MARK = {
  gold: '#ffb020',
  goldBright: '#ffd15a',
  amberSoft: '#ffc247',
  bronze: '#3b2a14',
  bronzeDark: '#2b2115',
  wood: '#bd7d42',
  woodDark: '#5b3418',
  emerald: '#2effa0',
  emeraldDark: '#0a7a52',
  red: '#ff5a3c',
  redDeep: '#c02a12',
  magenta: '#ff3fd0',
  violet: '#b45cff',
  ink: '#1d2733',
  ice: '#dff4ff',
};

/** Lift a palette colour past 1 so a dark texture still reads bright. */
function brighten(hex, k) {
  const c = new THREE.Color(hex);
  return new THREE.Color(c.r * k, c.g * k, c.b * k);
}

function box(w, h, d, material, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

/* ------------------------------------------------------------------ */
/* Signs                                                               */
/* ------------------------------------------------------------------ */

function signSprite(text, { color = '#ffffff', background = 'rgba(12,28,52,0.84)', w = 2.7, h = 1.0 } = {}) {
  const mat = new THREE.SpriteMaterial({
    map: labelTexture(text, color, background),
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(w, h, 1);
  return sprite;
}

/** A sign that knows how to rewrite itself when the language changes. */
function makeSign(parent, key, params, y, opts = {}) {
  const sprite = signSprite(t(key, params), opts);
  sprite.position.set(opts.x || 0, y, opts.z || 0);
  parent.add(sprite);
  return { sprite, key, params, opts };
}

/* ------------------------------------------------------------------ */
/* Floors                                                              */
/* ------------------------------------------------------------------ */

function makeFloors(stage) {
  const group = new THREE.Group();
  const floorTex = surface(stage.tex.floor, stage.palette.floor, 0.22, 12, 9);
  // The 2F hall gets a tint of the stage accent so the two halls never look
  // like one room: the shape is each stage's signature.
  const upperTint = new THREE.Color(stage.palette.deck)
    .lerp(new THREE.Color(stage.palette.accent), 0.34)
    .getStyle();
  const upperTex = surface(stage.tex.floor, upperTint, 0.2, 12, 9);
  const ice = standard({ map: floorTex, color: '#ffffff', roughness: 0.38, metalness: 0.04 });
  const upper = standard({ map: upperTex, color: '#ffffff', roughness: 0.42 });
  const rimMat = standard({ color: stage.palette.cap, roughness: 0.9 });

  for (const floor of [1, 2]) {
    for (const r of floorRects(stage, floor)) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(r.w, 0.6, r.d), floor === 2 ? upper : ice);
      slab.position.set(r.x, -0.3, r.z);
      slab.receiveShadow = true;
      slab.castShadow = false;
      group.add(slab);

      // A pale rim around each hall so it reads as a rink, not a void.
      const rimN = box(r.w + 1.2, 0.35, 0.6, rimMat);
      rimN.position.set(r.x, 0.05, r.z - r.d / 2 - 0.3);
      const rimS = rimN.clone();
      rimS.position.z = r.z + r.d / 2 + 0.3;
      const rimW = box(0.6, 0.35, r.d + 1.2, rimMat);
      rimW.position.set(r.x - r.w / 2 - 0.3, 0.05, r.z);
      const rimE = rimW.clone();
      rimE.position.x = r.x + r.w / 2 + 0.3;
      group.add(rimN, rimS, rimW, rimE);
    }
  }

  // Rink markings: a centre circle and two lines per hall, plus the floor
  // number painted into the ice at the entrance of each hall.
  const markMat = new THREE.MeshBasicMaterial({
    color: stage.palette.accent,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  });
  for (const floor of [1, 2]) {
    for (const r of floorRects(stage, floor)) {
      const size = Math.min(r.w, r.d) * 0.2;
      if (size < 1.4) continue;
      const circle = new THREE.Mesh(new THREE.RingGeometry(size * 0.92, size, 48), markMat);
      circle.rotation.x = -Math.PI / 2;
      circle.position.set(r.x, 0.015, r.z);
      group.add(circle);
      for (const dir of [-1, 1]) {
        const band = new THREE.Mesh(new THREE.PlaneGeometry(1.1, r.d * 0.78), markMat);
        band.rotation.x = -Math.PI / 2;
        band.position.set(r.x + dir * r.w * 0.22, 0.015, r.z);
        group.add(band);
      }
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(6.4, 3.2),
        new THREE.MeshBasicMaterial({
          map: labelTexture(`${floor}F`, 'rgba(255,255,255,0.92)', 'rgba(8,26,46,0.22)'),
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
        }),
      );
      label.rotation.x = -Math.PI / 2;
      label.position.set(r.x, 0.02, r.z + r.d * 0.34);
      group.add(label);
    }
  }
  return group;
}

/* ------------------------------------------------------------------ */
/* Walls                                                               */
/* ------------------------------------------------------------------ */

function makeWalls(stage) {
  const group = new THREE.Group();
  const occluders = [];
  const wallTex = surface(stage.tex.wall, stage.palette.wall, 0.34, 2, 1);
  const sideTex = surface(stage.tex.wall, stage.palette.wallSide, 0.3, 2, 1);
  const capTex = surface(stage.tex.cap, stage.palette.cap, 0.25, 1, 1);
  const innerMat = standard({ map: wallTex, color: '#ffffff', roughness: 0.8 });
  const sideMat = standard({ map: sideTex, color: '#ffffff', roughness: 0.85 });
  const pillarMats = [];

  for (const floor of [1, 2]) {
    for (const w of wallsForFloor(stage, floor)) {
      const outer = w.kind === 'outer';
      const h = outer ? ARENA.outerH : ARENA.wallH;
      // Outer walls get their own materials so the camera can fade exactly the
      // one standing between it and the player. Inner walls are low enough to
      // never need it and share one material.
      const wallMat = outer ? standard({ map: wallTex, color: '#ffffff', roughness: 0.8 }) : innerMat;
      const capMat = standard({ map: capTex, color: '#ffffff', roughness: 0.95 });
      const mesh = box(w.w, h, w.d, wallMat);
      mesh.position.set(w.x, h / 2, w.z);
      group.add(mesh);

      // Snow on top of every wall (the Build 34 look, now real geometry).
      const cap = box(w.w + 0.16, 0.22, w.d + 0.16, capMat);
      cap.position.set(w.x, h + 0.09, w.z);
      group.add(cap);

      if (Math.max(w.w, w.d) > 4) {
        // Pilasters give long walls a rhythm instead of one flat slab.
        const along = Math.max(w.w, w.d);
        const count = Math.max(2, Math.floor(along / 4));
        const pillarMat = new THREE.MeshStandardMaterial({ color: stage.palette.accent, roughness: 0.6 });
        pillarMats.push(pillarMat);
        for (let i = 1; i < count; i += 1) {
          const k = i / count;
          const pillar = box(w.w > w.d ? 0.34 : w.w + 0.2, h * 0.82, w.w > w.d ? w.d + 0.2 : 0.34, pillarMat, { cast: false });
          pillar.position.set(
            w.w > w.d ? w.x - w.w / 2 + w.w * k : w.x,
            h * 0.41,
            w.w > w.d ? w.z : w.z - w.d / 2 + w.d * k,
          );
          group.add(pillar);
        }
      }
      if (w.w > 2) {
        // A darker plinth keeps big walls from looking like floating slabs.
        const plinth = box(w.w + 0.08, 0.3, w.d + 0.08, sideMat);
        plinth.position.set(w.x, 0.15, w.z);
        group.add(plinth);
        const stripe = box(w.w + 0.1, 0.12, w.d + 0.1, new THREE.MeshBasicMaterial({ color: stage.palette.accent }));
        stripe.position.set(w.x, h - 0.35, w.z);
        group.add(stripe);
      }
      if (outer) {
        occluders.push({
          solid: {
            x: w.x,
            z: w.z,
            hw: w.w / 2,
            hd: w.d / 2,
            h,
            mats: [wallMat, capMat],
            fade: 1,
          },
        });
      }
    }
  }
  return { group, occluders };
}

/**
 * The ice ridge that fills the gap between the two halls. Tall enough that the
 * far hall is hidden behind it from any chase camera, and it fades out if the
 * player ever stands between it and the camera looking back.
 */
function makeRidge(stage) {
  const group = new THREE.Group();
  const height = ARENA.ridgeH;
  const width = ARENA.ridgeW;
  const mat = standard({ color: stage.palette.wallSide, roughness: 0.55, metalness: 0.08 });
  const snow = standard({ color: stage.palette.cap, roughness: 0.9 });
  const mats = [mat, snow];
  const length = ARENA.maxZ - ARENA.minZ;
  const body = box(width, height, length, mat, { cast: true });
  body.position.set(0, height / 2 - 0.2, 0);
  group.add(body);
  // Jagged crest.
  for (let i = 0; i < 12; i += 1) {
    const z = ARENA.minZ + ((i + 0.5) / 12) * length;
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(1.0 + (i % 3) * 0.24, 2.4 + (i % 4) * 0.8, 5),
      i % 2 ? snow : mat,
    );
    cone.position.set((i % 2 ? 0.5 : -0.6), height - 0.3, z);
    cone.rotation.y = i;
    group.add(cone);
  }
  return { group, solid: { x: 0, z: 0, hw: width / 2 + 0.4, hd: length / 2, h: height, mats, fade: 1 } };
}

/* ------------------------------------------------------------------ */
/* Stair gates, warps, pads                                            */
/* ------------------------------------------------------------------ */

/**
 * A stair zone is a marked gate, not a slope (Build 38): a wooden arch with
 * three steps and a sign that names the floor it leads to. Standing in the ring
 * carries you across.
 */
function makeStairs(stage) {
  const group = new THREE.Group();
  const labels = [];
  const tread = standard({ color: MARK.wood, roughness: 0.72 });
  const edge = new THREE.MeshBasicMaterial({ color: MARK.goldBright });
  const railMat = standard({ color: '#eda94f', roughness: 0.45, metalness: 0.3 });
  const marker = glow(MARK.amberSoft, 0.5);
  const arrow = glow(MARK.amberSoft, 0.95);

  for (const stair of stage.stairs) {
    const g = new THREE.Group();
    // The three steps that make it read as a staircase.
    for (let i = 0; i < 3; i += 1) {
      const step = box(1.5 - i * 0.18, 0.22 + i * 0.22, 2.2 - i * 0.2, tread);
      step.position.set(0, 0.11 + i * 0.11, 0);
      g.add(step);
      const lip = box(1.5 - i * 0.18, 0.05, 0.12, edge);
      lip.position.set(0, 0.24 + i * 0.22, 0.95);
      g.add(lip);
    }
    // The arch: two posts and a lintel, so it reads from across the hall.
    for (const sx of [-1, 1]) {
      const post = box(0.2, 3.0, 0.2, railMat);
      post.position.set(sx * 1.35, 1.5, 0);
      g.add(post);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), glow(MARK.amberSoft, 0.95));
      cap.position.set(sx * 1.35, 3.1, 0);
      g.add(cap);
    }
    const lintel = box(3.0, 0.24, 0.3, railMat);
    lintel.position.set(0, 3.05, 0);
    g.add(lintel);
    // A warm ring on the ice: this is the zone that carries you.
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.8, 34), marker);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.03, 0);
    g.add(ring);
    for (const [ax, size] of [[-1.9, 0.3], [-1.25, 0.38]]) {
      const chevron = new THREE.Mesh(new THREE.ConeGeometry(size, size * 1.7, 3), arrow);
      chevron.rotation.x = Math.PI / 2;
      chevron.position.set(ax, 0.16, 0);
      g.add(chevron);
    }
    g.position.set(stair.x, 0, stair.z);
    group.add(g);
    const sign = makeSign(g, 'sign.stairs', { f: stair.toFloor }, 3.9, {
      background: 'rgba(120,72,12,0.9)',
      color: '#fff3cf',
      w: 3.0,
      h: 1.05,
    });
    labels.push(sign);
  }
  return { group, labels };
}

function makePads(stage) {
  const group = new THREE.Group();
  const discs = [];
  const spin = [];

  const ringFor = (color, radius = 1.25) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.74, radius, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    return ring;
  };

  for (const pad of stage.pads) {
    const g = new THREE.Group();
    const ring = ringFor(stage.palette.accent2);
    const inner = new THREE.Mesh(
      new THREE.CircleGeometry(0.85, 24),
      new THREE.MeshBasicMaterial({ color: stage.palette.accent2, transparent: true, opacity: 0.16, depthWrite: false }),
    );
    inner.rotation.x = -Math.PI / 2;
    for (const dx of [-0.28, 0.28]) {
      const chev = new THREE.Mesh(
        new THREE.ConeGeometry(0.26, 0.5, 3),
        new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false }),
      );
      chev.rotation.x = -Math.PI / 2;
      chev.rotation.z = Math.PI / 2;
      chev.position.set(dx, 0.02, 0);
      g.add(chev);
      spin.push({ mesh: chev, speed: 1.5 });
    }
    g.add(ring, inner);
    g.position.set(pad.x, 0.03, pad.z);
    group.add(g);
    discs.push(g);
  }

  const update = (dt) => {
    for (const s of spin) s.mesh.rotation.z += dt * s.speed;
  };
  return { group, update };
}

/** A warp pair: two mouths on the same floor, mag-minutes and violet, signed. */
function makeWarps(stage) {
  const group = new THREE.Group();
  const labels = [];
  const spin = [];
  const rings = [];
  for (const warp of stage.warps) {
    const g = new THREE.Group();
    const outer = new THREE.Mesh(
      new THREE.RingGeometry(1.05, 1.3, 40),
      new THREE.MeshBasicMaterial({ color: MARK.magenta, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
    );
    const inner = new THREE.Mesh(
      new THREE.RingGeometry(0.6, 0.8, 32),
      new THREE.MeshBasicMaterial({ color: MARK.violet, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }),
    );
    const core = new THREE.Mesh(
      new THREE.CircleGeometry(0.58, 28),
      new THREE.MeshBasicMaterial({ color: '#7b2bff', transparent: true, opacity: 0.5, depthWrite: false }),
    );
    outer.rotation.x = -Math.PI / 2;
    inner.rotation.x = -Math.PI / 2;
    core.rotation.x = -Math.PI / 2;
    outer.position.y = 0.01;
    inner.position.y = 0.03;
    core.position.y = 0.02;
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 1.2, 2.9, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: MARK.magenta, transparent: true, opacity: 0.26, depthWrite: false, side: THREE.DoubleSide }),
    );
    column.position.y = 1.45;
    const aura = new THREE.Mesh(
      new THREE.RingGeometry(1.5, 1.9, 36),
      new THREE.MeshBasicMaterial({ color: MARK.violet, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
    );
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = 0.005;
    const sparks = [];
    for (let i = 0; i < 8; i += 1) {
      const spark = new THREE.Mesh(
        new THREE.SphereGeometry(0.085, 6, 5),
        new THREE.MeshBasicMaterial({ color: '#ffb3f0', transparent: true, opacity: 0.9, depthWrite: false }),
      );
      const angle = (i / 8) * Math.PI * 2;
      spark.position.set(Math.cos(angle) * 0.8, 0.2, Math.sin(angle) * 0.8);
      g.add(spark);
      sparks.push({ mesh: spark, angle, phase: i / 8 });
    }
    g.add(outer, inner, core, column, aura);
    g.position.set(warp.x, 0.04, warp.z);
    group.add(g);
    labels.push(makeSign(g, 'sign.warp', {}, 3.6, {
      background: 'rgba(78,16,96,0.9)',
      color: '#ffe3ff',
      w: 2.6,
      h: 0.92,
    }));
    spin.push({ mesh: outer, speed: 0.9 });
    spin.push({ mesh: inner, speed: -1.5 });
    rings.push({ group: g, outer, inner, column, sparks });
  }
  const update = (dt) => {
    for (const s of spin) s.mesh.rotation.z += dt * s.speed;
    const now = performance.now() / 1000;
    for (const w of rings) {
      const pulse = 1 + Math.sin(now * 3 + w.group.position.x) * 0.07;
      w.outer.scale.setScalar(pulse);
      w.inner.scale.setScalar(1.14 - (pulse - 1));
      for (const s of w.sparks) {
        const p = (now * 0.55 + s.phase) % 1;
        const r = 0.8 - p * 0.28;
        s.mesh.position.set(Math.cos(s.angle + now * 0.8) * r, 0.15 + p * 2.5, Math.sin(s.angle + now * 0.8) * r);
        s.mesh.material.opacity = 0.95 * (1 - p);
      }
    }
  };
  return { group, update, labels };
}

/* ------------------------------------------------------------------ */
/* Switches                                                            */
/* ------------------------------------------------------------------ */

function makeSwitch(stage, spot, labels) {
  const group = new THREE.Group();
  // A dark bronze plinth and a gold ring lift the switch off the white ice.
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(1.02, 1.12, 0.18, 22),
    standard({ color: MARK.bronzeDark, roughness: 0.42, metalness: 0.55 }),
  );
  plinth.position.y = 0.09;
  const goldRing = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.08, 8, 32), glow(MARK.gold, 0.92));
  goldRing.rotation.x = -Math.PI / 2;
  goldRing.position.y = 0.2;
  const floorRing = new THREE.Mesh(new THREE.RingGeometry(1.18, 1.52, 34), glow(MARK.gold, 0.34));
  floorRing.rotation.x = -Math.PI / 2;
  floorRing.position.y = 0.02;
  // Thick pillar with a warm rim, not a thin cyan stick.
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.42, 1.05, 14),
    standard({ color: MARK.bronze, roughness: 0.4, metalness: 0.6 }),
  );
  pillar.position.y = 0.72;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.055, 8, 20), glow(MARK.goldBright, 0.85));
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.3;
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.46, 0.16, 16),
    standard({ color: '#8a5c12', metalness: 0.5, roughness: 0.4 }),
  );
  collar.position.y = 1.26;
  // The big amber lamp and its halo: findable across the hall.
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.42, 0.36, 16),
    standard({ color: MARK.goldBright, emissive: '#ff9500', emissiveIntensity: 1.5, roughness: 0.25 }),
  );
  core.position.y = 1.52;
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.08, 8, 28), glow(MARK.gold, 0.85));
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 1.76;
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.52, 2.7, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: MARK.gold, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }),
  );
  beam.position.y = 2.55;
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.24, 0),
    new THREE.MeshBasicMaterial({ color: '#fff2c8', transparent: true, opacity: 0.97 }),
  );
  gem.position.y = 2.12;
  group.add(plinth, goldRing, floorRing, pillar, rim, collar, core, halo, beam, gem);
  // Build 38: the word for it, floating over the lamp, readable from far off.
  labels.push(makeSign(group, 'sign.switch', {}, 3.45, {
    background: 'rgba(92,58,6,0.92)',
    color: '#fff1c2',
    w: 2.9,
    h: 1.0,
  }));
  group.position.set(spot.x, 0, spot.z);
  return { group, core, halo, beam, gem, floorRing, goldRing, spot };
}

/* ------------------------------------------------------------------ */
/* Gates                                                               */
/* ------------------------------------------------------------------ */

function makeGate(stage, gate) {
  const group = new THREE.Group();
  const exitClosed = labelTexture('EXIT', '#ffffff', 'rgba(206,44,22,0.96)');
  const exitOpen = labelTexture('EXIT', '#06301f', 'rgba(70,255,166,0.96)');
  const frameMat = standard({ color: MARK.ink, roughness: 0.35, metalness: 0.6 });
  const trimMat = new THREE.MeshBasicMaterial({ color: MARK.goldBright });
  const doorMat = new THREE.MeshStandardMaterial({
    color: MARK.red,
    emissive: '#ff2f10',
    emissiveIntensity: 0.85,
    roughness: 0.5,
    metalness: 0.2,
    transparent: true,
    opacity: 0.95,
  });
  const side = 2.4;
  const left = box(0.5, 3.4, 0.85, frameMat);
  left.position.set(-side / 2, 1.7, 0);
  const right = left.clone();
  right.position.x = side / 2;
  const top = box(side + 0.5, 0.55, 0.95, frameMat);
  top.position.y = 3.45;
  for (const sx of [-1, 1]) {
    const strip = box(0.12, 3.15, 0.9, trimMat);
    strip.position.set(sx * (side / 2 - 0.18), 1.75, 0.02);
    group.add(strip);
  }
  const door = box(side - 0.5, 3.0, 0.2, doorMat);
  door.position.y = 1.55;
  // The EXIT plate, on both faces, so the way out is named from either side.
  const signMat = new THREE.MeshBasicMaterial({ map: labelTexture('EXIT', '#ffffff', 'rgba(206,44,22,0.96)'), transparent: true });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 0.8), signMat);
  sign.position.set(0, 3.45, 0.52);
  const signBack = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 0.8), signMat.clone());
  signBack.position.set(0, 3.45, -0.52);
  signBack.rotation.y = Math.PI;
  // A light bar along the lintel: the state of the gate reads from any angle,
  // even when the EXIT plate itself is edge-on.
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(side + 0.4, 0.16, 1.0), glow(MARK.red, 1));
  lintel.position.set(0, 3.76, 0);
  const lamps = [];
  for (const sx of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), glow(MARK.red, 1));
    lamp.position.set(sx * (side / 2), 3.0, 0.5);
    lamps.push(lamp);
    group.add(lamp);
  }
  const floorRing = new THREE.Mesh(new THREE.RingGeometry(1.85, 2.3, 34), glow(MARK.red, 0.4));
  floorRing.rotation.x = -Math.PI / 2;
  floorRing.position.y = 0.03;
  group.add(left, right, top, door, sign, signBack, floorRing, lintel);
  group.position.set(gate.x, 0, gate.z);
  group.rotation.y = gate.facing === 'west' ? Math.PI / 2 : gate.facing === 'north' ? 0 : -Math.PI / 2;
  return { group, door, light: lamps[0], lamps, sign, signBack, floorRing, lintel, doorMat, doorBaseY: 1.55, exitClosed, exitOpen };
}

/* ------------------------------------------------------------------ */
/* Set dressing                                                        */
/* ------------------------------------------------------------------ */

function prop(stage, p) {
  const g = new THREE.Group();
  const accent = stage.palette.accent;
  const accent2 = stage.palette.accent2;
  switch (p.type) {
    case 'icicle': {
      for (let i = 0; i < (p.n || 4); i += 1) {
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(0.22 + (i % 3) * 0.06, 1.1 + (i % 2) * 0.6, 6),
          standard({ color: '#dff4ff', roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.85 }),
        );
        cone.position.set((i % 3) * 0.5 - 0.5, 2.6 - i * 0.1, Math.floor(i / 3) * 0.5);
        cone.rotation.x = Math.PI;
        g.add(cone);
      }
      break;
    }
    case 'flag': {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 8), standard({ color: '#8899aa' }));
      pole.position.y = 1.6;
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.6), new THREE.MeshBasicMaterial({ color: accent2, side: THREE.DoubleSide }));
      flag.position.set(0.58, 2.8, 0);
      g.add(pole, flag);
      break;
    }
    case 'crystal': {
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), standard({ color: accent, emissive: accent, emissiveIntensity: 0.3, roughness: 0.1, transparent: true, opacity: 0.85 }));
      c.position.y = 1.1;
      c.scale.y = 1.6;
      g.add(c);
      g.userData.spin = c;
      break;
    }
    case 'tank': {
      const glass = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.2, 3.0), new THREE.MeshStandardMaterial({ color: '#1fd0e0', transparent: true, opacity: 0.3, roughness: 0.1 }));
      glass.position.y = 1.9;
      for (let i = 0; i < 5; i += 1) {
        const fish = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.4, 5), new THREE.MeshBasicMaterial({ color: accent2 }));
        fish.rotation.z = Math.PI / 2;
        fish.position.set(0, 0.9 + i * 0.5, -1 + (i % 3));
        g.add(fish);
      }
      g.add(glass);
      break;
    }
    case 'coral': {
      for (let i = 0; i < 5; i += 1) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.7 + i * 0.12, 6), standard({ color: i % 2 ? accent : accent2, roughness: 0.7 }));
        c.position.set(Math.cos(i * 1.7) * 0.4, 0.35 + i * 0.05, Math.sin(i * 1.7) * 0.4);
        g.add(c);
      }
      break;
    }
    case 'fish': {
      const fish = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 6), new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.25 }));
      fish.rotation.z = Math.PI / 2;
      fish.position.y = 3.4;
      g.add(fish);
      g.userData.float = fish;
      break;
    }
    case 'ferris': {
      const wheel = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.0, 0.12, 8, 32), standard({ color: accent2 }));
      wheel.add(ring);
      for (let i = 0; i < 12; i += 1) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.08, 6, 0.08), standard({ color: '#e0e6f0' }));
        spoke.rotation.z = (i / 12) * Math.PI;
        wheel.add(spoke);
        const pod = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.5), standard({ color: i % 2 ? accent : '#ffd166' }));
        pod.position.set(Math.cos((i / 12) * Math.PI * 2) * 3, Math.sin((i / 12) * Math.PI * 2) * 3, 0);
        wheel.add(pod);
      }
      wheel.position.y = 5.0;
      const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 5, 8), standard({ color: '#8899aa' }));
      legs.position.y = 2.5;
      g.add(wheel, legs);
      g.userData.spin = wheel;
      break;
    }
    case 'tent': {
      const tent = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.2, 8), standard({ color: accent, roughness: 0.7 }));
      tent.position.y = 1.1;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), standard({ color: '#fff5cc' }));
      pole.position.y = 2.2;
      g.add(tent, pole);
      break;
    }
    case 'balloon': {
      for (let i = 0; i < 5; i += 1) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), standard({ color: [accent, accent2, '#ffffff'][i % 3], roughness: 0.4 }));
        b.position.set(Math.cos(i * 1.3) * 0.8, 3.4 + (i % 3) * 0.5, Math.sin(i * 1.3) * 0.8);
        g.add(b);
      }
      break;
    }
    case 'lights': {
      for (let i = 0; i < 9; i += 1) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), glow(i % 2 ? accent : accent2, 0.95));
        b.position.set(-2 + i * 0.5, 2.4 + Math.sin(i) * 0.15, 0);
        g.add(b);
      }
      break;
    }
    case 'hearth': {
      const stone = box(2.6, 1.2, 1.2, standard({ color: '#8d8d8d', roughness: 0.9 }));
      stone.position.y = 0.6;
      const fire = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.0, 7), glow('#ff9f43', 0.95));
      fire.position.y = 1.1;
      const light = new THREE.PointLight('#ff9f43', 12, 9, 2);
      light.position.y = 1.5;
      g.add(stone, fire, light);
      g.userData.fire = fire;
      break;
    }
    case 'pine': {
      for (let i = 0; i < 3; i += 1) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(1.1 - i * 0.25, 1.2, 7), standard({ color: '#2f6b4f', roughness: 0.8 }));
        c.position.y = 0.8 + i * 0.7;
        g.add(c);
      }
      break;
    }
    case 'beam': {
      const b = box(0.4, 0.4, 6, standard({ color: '#7a5236', roughness: 0.8 }));
      b.position.y = 3.4;
      g.add(b);
      break;
    }
    case 'desk': {
      const top = box(1.4, 0.12, 0.8, standard({ color: '#b98a5a', roughness: 0.8 }));
      top.position.y = 0.75;
      const leg = box(0.1, 0.75, 0.1, standard({ color: '#6d7683' }));
      leg.position.set(-0.55, 0.37, -0.3);
      const leg2 = leg.clone();
      leg2.position.set(0.55, 0.37, 0.3);
      g.add(top, leg, leg2);
      break;
    }
    case 'board': {
      const b = box(3.0, 1.6, 0.12, standard({ color: '#264d3a', roughness: 0.9 }));
      b.position.y = 1.9;
      g.add(b);
      break;
    }
    case 'clock': {
      const face = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.12, 20), standard({ color: '#f5f2e8', roughness: 0.6 }));
      face.rotation.x = Math.PI / 2;
      face.position.y = 3.1;
      const hand = box(0.06, 0.5, 0.06, standard({ color: '#333333' }));
      hand.position.set(0, 3.3, 0.1);
      g.add(face, hand);
      break;
    }
    case 'reactor': {
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 2.4, 12), standard({ color: '#44557a', metalness: 0.5, roughness: 0.35 }));
      core.position.y = 1.2;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.08, 8, 24), glow(accent, 0.85));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 1.6;
      g.add(core, ring);
      g.userData.spin = ring;
      break;
    }
    case 'holo': {
      const h = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 0), new THREE.MeshBasicMaterial({ color: accent, wireframe: true, transparent: true, opacity: 0.75 }));
      h.position.y = 2.0;
      g.add(h);
      g.userData.spin = h;
      break;
    }
    case 'hull': {
      const p1 = box(2.0, 2.4, 0.2, standard({ color: '#3a4766', metalness: 0.6, roughness: 0.4 }));
      p1.position.y = 1.4;
      const bar = box(2.2, 0.1, 0.26, glow(accent, 0.7));
      bar.position.y = 2.2;
      g.add(p1, bar);
      break;
    }
    default:
      break;
  }
  g.position.set(p.x, 0, p.z);
  return g;
}

/* ------------------------------------------------------------------ */
/* Weather                                                             */
/* ------------------------------------------------------------------ */

function makeWeather(stage) {
  const count = stage.weather === 'stars' ? 300 : 520;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const spanX = ARENA.maxX - ARENA.minX;
  const spanZ = ARENA.maxZ - ARENA.minZ;
  for (let i = 0; i < count; i += 1) {
    pos[i * 3] = (Math.random() - 0.5) * spanX;
    pos[i * 3 + 1] = Math.random() * 16;
    pos[i * 3 + 2] = (Math.random() - 0.5) * spanZ;
    seed[i] = Math.random();
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const colors = {
    snow: '#ffffff',
    bubble: '#a9f2ff',
    petal: '#ffd1e8',
    ember: '#ffb26b',
    dust: '#e8e2c8',
    stars: '#dce8ff',
  };
  const mat = new THREE.PointsMaterial({
    color: colors[stage.weather] || '#ffffff',
    size: stage.weather === 'stars' ? 0.22 : 0.16,
    transparent: true,
    opacity: stage.weather === 'dust' ? 0.5 : 0.85,
    depthWrite: false,
    blending: stage.weather === 'ember' ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  const update = (dt) => {
    const arr = geo.attributes.position.array;
    for (let i = 0; i < count; i += 1) {
      const k = i * 3;
      const s = seed[i];
      if (stage.weather === 'bubble' || stage.weather === 'ember' || stage.weather === 'stars') {
        arr[k + 1] += dt * (0.6 + s * 1.2);
        if (arr[k + 1] > 16) arr[k + 1] = 0;
      } else {
        arr[k + 1] -= dt * (1.4 + s * 2.2);
        arr[k] += dt * (0.4 + s);
        if (arr[k + 1] < 0) {
          arr[k + 1] = 14 + s * 3;
          arr[k] = (Math.random() - 0.5) * spanX;
          arr[k + 2] = (Math.random() - 0.5) * spanZ;
        }
      }
      if (arr[k] > spanX / 2) arr[k] = -spanX / 2;
    }
    geo.attributes.position.needsUpdate = true;
  };
  return { points, update };
}

/* ------------------------------------------------------------------ */
/* Stage shows: the gimmick made visible                                */
/* ------------------------------------------------------------------ */

function makeShow(stage) {
  const group = new THREE.Group();
  const accent = stage.palette.accent;
  const accent2 = stage.palette.accent2;
  const g = stage.gimmick;
  const show = { group, update: () => {}, manta: null, floats: [], beacon: [], rings: [] };
  if (!g) return show;

  if (g.kind === 'aquarium') {
    const manta = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({
      color: '#123449',
      emissive: '#1e6f8c',
      emissiveIntensity: 0.35,
      roughness: 0.55,
      side: THREE.DoubleSide,
    });
    const body = new THREE.Mesh(new THREE.CircleGeometry(2.6, 4), skin);
    body.rotation.x = -Math.PI / 2;
    body.scale.set(1, 1.5, 1);
    const finMat = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
    for (const side of [-1, 1]) {
      const fin = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.0), finMat);
      fin.rotation.x = -Math.PI / 2;
      fin.position.set(side * 2.6, 0, 0.4);
      fin.rotation.z = side * 0.18;
      manta.add(fin);
    }
    const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 3.2), finMat);
    tail.rotation.x = -Math.PI / 2;
    tail.position.set(0, 0, -3.0);
    manta.add(body, tail);
    manta.position.set(HALL_CENTRE_LOCAL(1) - 20, 3.4, 0);
    group.add(manta);
    show.manta = manta;
    show.update = (dt, gim, now) => {
      const on = Boolean(gim && gim.manta);
      manta.visible = on || (gim && gim.kind === 'aquarium');
      const time = now / 1000;
      const phase = (time * 0.12) % 1;
      manta.position.set(-54 + phase * 64, 3.2 + Math.sin(time * 0.8) * 0.35, Math.sin(time * 0.5) * 6);
      manta.rotation.y = Math.PI / 2 + Math.sin(time * 0.4) * 0.25;
      manta.rotation.z = Math.sin(time * 1.4) * (on ? 0.22 : 0.08);
      if (on) {
        if (Math.random() < dt * 12) {
          const b = new THREE.Mesh(
            new THREE.SphereGeometry(0.09 + Math.random() * 0.06, 6, 5),
            new THREE.MeshBasicMaterial({ color: '#c8f6ff', transparent: true, opacity: 0.7 }),
          );
          b.position.set(manta.position.x + (Math.random() - 0.5) * 3, 2.6, manta.position.z + (Math.random() - 0.5) * 3);
          group.add(b);
          setTimeout(() => group.remove(b), 1600);
        }
      }
    };
    return show;
  }

  if (g.kind === 'park') {
    const cartColours = [accent, accent2, '#7b5cff'];
    g.spots.forEach((spot, i) => {
      const cart = new THREE.Group();
      const body = box(2.0, 1.1, 1.4, standard({ color: cartColours[i % cartColours.length], roughness: 0.6 }));
      body.position.y = 0.95;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.8, 4), standard({ color: '#fff2c8' }));
      roof.position.y = 1.95;
      roof.rotation.y = Math.PI / 4;
      const pole = box(0.12, 1.0, 0.12, standard({ color: '#ffd166' }));
      pole.position.y = 1.6;
      cart.add(body, roof, pole);
      for (const side of [-1, 1]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.16, 12), standard({ color: '#2b1b45' }));
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(side * 0.8, 0.34, 0.72);
        cart.add(wheel);
      }
      const lights = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.06, 6, 18), glow(accent2, 0.9));
      lights.rotation.x = -Math.PI / 2;
      lights.position.y = 0.12;
      cart.add(lights);
      cart.position.set(spot.x, 0, spot.z);
      group.add(cart);
      show.floats.push({ cart, spot, phase: i * 1.7 });
    });
    show.update = (dt, gim, now) => {
      const on = Boolean(gim && gim.parade);
      const time = now / 1000;
      for (const f of show.floats) {
        f.cart.visible = true;
        const drift = on ? Math.sin(time * 0.9 + f.phase) * 2.4 : 0;
        f.cart.position.x = f.spot.x + drift;
        f.cart.position.y = on ? Math.abs(Math.sin(time * 5 + f.phase)) * 0.14 : 0;
        f.cart.rotation.y = on ? Math.cos(time * 0.9 + f.phase) * 0.2 : 0;
      }
    };
    return show;
  }

  if (g.kind === 'lodge') {
    const count = 280;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const speed = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      pos[i * 3] = -30 + Math.random() * 60;
      pos[i * 3 + 1] = Math.random() * 9;
      pos[i * 3 + 2] = -20 + Math.random() * 40;
      speed[i] = 8 + Math.random() * 14;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const sleet = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#ffffff', size: 0.16, transparent: true, opacity: 0.8, depthWrite: false }));
    sleet.visible = false;
    group.add(sleet);
    show.update = (dt, gim) => {
      const on = Boolean(gim && gim.blizzard);
      sleet.visible = on;
      if (!on) return;
      const arr = geo.attributes.position.array;
      for (let i = 0; i < count; i += 1) {
        const k = i * 3;
        arr[k] += dt * speed[i] * 0.6;
        arr[k + 1] -= dt * speed[i] * 0.25;
        if (arr[k] > 30) arr[k] = -30;
        if (arr[k + 1] < 0.2) arr[k + 1] = 9;
      }
      geo.attributes.position.needsUpdate = true;
    };
    return show;
  }

  if (g.kind === 'school') {
    for (const door of g.doors) {
      const beacon = new THREE.Group();
      const bar = new THREE.Mesh(new THREE.BoxGeometry(Math.min(door.w, 3.4), 0.14, 0.18), new THREE.MeshBasicMaterial({ color: '#7f8b7a' }));
      bar.position.y = 2.9;
      const lampMat = new THREE.MeshBasicMaterial({ color: '#9ba894' });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), lampMat);
      lamp.position.y = 2.9;
      beacon.add(bar, lamp);
      beacon.position.set(door.x, 0, door.z);
      group.add(beacon);
      show.beacon.push({ beacon, bar, lamp, lampMat });
    }
    show.update = (dt, gim) => {
      const chime = Boolean(gim && gim.chime);
      const shut = Boolean(gim && gim.shut);
      for (const b of show.beacon) {
        b.bar.material.color.set(shut ? '#ff4030' : chime ? '#ffd166' : '#7f8b7a');
        b.lampMat.color.set(shut ? '#ff2f10' : chime ? '#ffe066' : '#9ba894');
        b.lamp.scale.setScalar(shut ? 1.6 : chime ? 1.1 + Math.sin(performance.now() / 120) * 0.2 : 0.7);
        b.lamp.position.y = 2.9 + (shut ? Math.sin(performance.now() / 200) * 0.02 : 0);
      }
    };
    return show;
  }

  if (g.kind === 'space') {
    show.update = (dt, gim, now) => {
      const cells = (gim && gim.cells) || [];
      const key = cells.map((c) => `${c.x.toFixed(1)},${c.z.toFixed(1)}`).join('|');
      if (show.ringKey !== key) {
        for (const r of show.rings) group.remove(r.mesh);
        show.rings = cells.map((c) => {
          const mesh = new THREE.Mesh(
            new THREE.RingGeometry(c.r * 0.55, c.r, 28),
            new THREE.MeshBasicMaterial({ color: '#8f7bff', transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
          );
          mesh.rotation.x = -Math.PI / 2;
          mesh.position.set(c.x, 0.03, c.z);
          group.add(mesh);
          return { mesh, cell: c };
        });
        show.ringKey = key;
      }
      const warn = Boolean(gim && gim.warn);
      const active = Boolean(gim && gim.gravity);
      const time = now / 1000;
      for (const r of show.rings) {
        r.mesh.visible = warn || active;
        const mat = r.mesh.material;
        mat.color.set(active ? '#ff4d6d' : '#8f7bff');
        mat.opacity = active ? 0.55 + Math.sin(time * 8 + r.cell.x) * 0.2 : 0.25 + Math.sin(time * 6 + r.cell.z) * 0.15;
        r.mesh.scale.setScalar(active ? 1 + Math.sin(time * 6) * 0.05 : 1);
      }
    };
    return show;
  }

  return show;
}

function HALL_CENTRE_LOCAL(floor) {
  return floor === 2 ? 28 : -28;
}

/* ------------------------------------------------------------------ */

/** Tall things that can sit between the camera and the player. */
/* ------------------------------------------------------------------ */
/* Ambience: what makes each stage feel like itself                     */
/* ------------------------------------------------------------------ */

/**
 * Build 38: every stage has a set that actually moves. These are pure show —
 * nothing here changes the rules; it is what the player sees while running.
 *   classic  aurora curtains, ice pillars, drifting ground mist
 *   aquarium a fish school, light shafts, slow drifting bubbles
 *   park     a turning merry-go-round and parade confetti
 *   lodge    warm lanterns and window glow under the blizzard
 *   space    an SF gate, floating asteroids, star streaks
 */
function makeAmbience(stage) {
  const group = new THREE.Group();
  const id = stage.id;
  let update = () => {};
  const hall1 = floorRects(stage, 1)[0];
  const hall2 = floorRects(stage, 2)[0];
  const centre1 = hall1 ? { x: hall1.x, z: hall1.z } : { x: -28, z: 0 };
  const centre2 = hall2 ? { x: hall2.x, z: hall2.z } : { x: 28, z: 0 };

  if (id === 'classic') {
    const curtains = [];
    const colours = ['#7dffd0', '#9ad4ff', '#c58bff'];
    for (let i = 0; i < 3; i += 1) {
      const mat = new THREE.MeshBasicMaterial({
        color: colours[i],
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const curtain = new THREE.Mesh(new THREE.PlaneGeometry(62, 16, 1, 1), mat);
      curtain.position.set(i % 2 ? centre2.x : centre1.x, 12.5 + i * 0.8, -10 + i * 9);
      curtain.rotation.x = -0.22;
      curtain.rotation.z = -0.12 + i * 0.1;
      group.add(curtain);
      curtains.push({ mesh: curtain, mat, phase: i * 2.1 });
    }
    // Ice pillars: tall, clear, half sunk into the rink at both ends.
    const iceMat = new THREE.MeshStandardMaterial({
      color: '#cdefff',
      transparent: true,
      opacity: 0.55,
      roughness: 0.08,
      metalness: 0.1,
      emissive: '#5ec8ff',
      emissiveIntensity: 0.15,
    });
    const pillars = [];
    for (const [cx, u, z, hh] of [[centre1.x, -20, -16, 4.2], [centre1.x, 20, -16, 3.4], [centre1.x, -20, 16, 3.6], [centre1.x, 20, 16, 4.6], [centre2.x, -20, 16, 4.0], [centre2.x, 20, -16, 3.8]]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.62, hh, 6), iceMat);
      p.position.set(cx + u, hh / 2 - 0.2, z);
      p.rotation.y = u * 0.1;
      group.add(p);
      pillars.push(p);
    }
    const mistMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.05, depthWrite: false });
    const mist = new THREE.Mesh(new THREE.PlaneGeometry(90, 40), mistMat);
    mist.rotation.x = -Math.PI / 2;
    mist.position.set(0, 0.4, 0);
    group.add(mist);
    update = (dt, gim, now) => {
      const gust = Boolean(gim && gim.gust);
      const time = now / 1000;
      for (const c of curtains) {
        c.mat.opacity = (gust ? 0.2 : 0.08) + Math.sin(time * 0.9 + c.phase) * 0.04;
        c.mesh.position.x += Math.sin(time * 0.3 + c.phase) * dt * 1.6;
        c.mesh.rotation.z = -0.12 + c.phase * 0.05 + Math.sin(time * 0.4 + c.phase) * 0.05;
      }
      for (let i = 0; i < pillars.length; i += 1) {
        pillars[i].material.emissiveIntensity = 0.12 + Math.sin(time * 1.4 + i) * (gust ? 0.16 : 0.05);
      }
      mistMat.opacity = gust ? 0.12 + Math.sin(time * 6) * 0.03 : 0.04;
    };
    return { group, update };
  }

  if (id === 'aquarium') {
    // A school of fish circling each hall, plus light falling through water.
    const schools = [];
    for (const [centre, n] of [[centre1, 16], [centre2, 14]]) {
      const school = new THREE.Group();
      const fishMat = new THREE.MeshBasicMaterial({ color: '#c9f7ff' });
      const fishMat2 = new THREE.MeshBasicMaterial({ color: '#ffd166' });
      for (let i = 0; i < n; i += 1) {
        const fish = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 5), i % 4 === 0 ? fishMat2 : fishMat);
        fish.rotation.z = -Math.PI / 2;
        fish.userData.angle = (i / n) * Math.PI * 2;
        fish.userData.rad = 5 + (i % 4) * 1.6;
        fish.userData.h = 2.6 + (i % 5) * 0.55;
        fish.userData.phase = i * 0.7;
        school.add(fish);
      }
      school.position.set(centre.x, 0, centre.z);
      group.add(school);
      schools.push(school);
    }
    const shafts = [];
    for (const [x, z] of [[centre1.x - 12, -8], [centre1.x + 8, 10], [centre2.x - 10, 8], [centre2.x + 12, -10]]) {
      const mat = new THREE.MeshBasicMaterial({
        color: '#bff4ff',
        transparent: true,
        opacity: 0.07,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const shaft = new THREE.Mesh(new THREE.ConeGeometry(3.4, 14, 12, 1, true), mat);
      shaft.position.set(x, 7, z);
      group.add(shaft);
      shafts.push({ mesh: shaft, mat, phase: x * 0.1 });
    }
    update = (dt, gim, now) => {
      const time = now / 1000;
      for (let s = 0; s < schools.length; s += 1) {
        const school = schools[s];
        for (const fish of school.children) {
          const a = fish.userData.angle + time * (0.42 + s * 0.05);
          fish.position.set(Math.cos(a) * fish.userData.rad, fish.userData.h + Math.sin(time * 1.6 + fish.userData.phase) * 0.4, Math.sin(a) * fish.userData.rad * 0.7);
          fish.rotation.y = -a + Math.PI / 2;
        }
      }
      for (const sh of shafts) {
        sh.mat.opacity = 0.055 + Math.sin(time * 0.7 + sh.phase) * 0.025;
      }
    };
    return { group, update };
  }

  if (id === 'park') {
    const rides = [];
    for (const centre of [centre1, centre2]) {
      const ride = new THREE.Group();
      const deck = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.8, 0.4, 24), standard({ color: '#ffe9a8', roughness: 0.6 }));
      deck.position.y = 0.2;
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(4.0, 1.8, 12), standard({ color: stage.palette.accent, roughness: 0.5 }));
      canopy.position.y = 3.6;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 3.0, 8), standard({ color: '#fff2c8' }));
      pole.position.y = 1.9;
      ride.add(deck, canopy, pole);
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        const horse = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.3), standard({ color: i % 2 ? stage.palette.accent2 : '#ffffff', roughness: 0.5 }));
        horse.position.set(Math.cos(a) * 2.6, 1.1, Math.sin(a) * 2.6);
        ride.add(horse);
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), standard({ color: '#ffd166' }));
        rod.position.set(Math.cos(a) * 2.6, 2.1, Math.sin(a) * 2.6);
        ride.add(rod);
      }
      ride.position.set(centre.x, 0, centre.z - 6);
      group.add(ride);
      rides.push(ride);
    }
    // Confetti: a fixed cloud of points that only falls during the parade.
    const count = 160;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const colours = new Float32Array(count * 3);
    const palette = ['#ff5fa2', '#ffe066', '#7b5cff', '#5be7ff'];
    for (let i = 0; i < count; i += 1) {
      pos[i * 3] = (Math.random() - 0.5) * 90;
      pos[i * 3 + 1] = Math.random() * 12;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 36;
      const c = new THREE.Color(palette[i % palette.length]);
      colours[i * 3] = c.r;
      colours[i * 3 + 1] = c.g;
      colours[i * 3 + 2] = c.b;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    const confetti = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.24, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }));
    confetti.visible = false;
    group.add(confetti);
    update = (dt, gim, now) => {
      const on = Boolean(gim && gim.parade);
      const time = now / 1000;
      for (let i = 0; i < rides.length; i += 1) {
        rides[i].rotation.y += dt * (on ? 1.1 : 0.45) * (i ? -1 : 1);
        rides[i].position.y = on ? Math.abs(Math.sin(time * 2 + i)) * 0.1 : 0;
      }
      confetti.visible = on;
      if (on) {
        const arr = geo.attributes.position.array;
        for (let i = 0; i < count; i += 1) {
          arr[i * 3 + 1] -= dt * (1.4 + (i % 5) * 0.3);
          arr[i * 3] += dt * 0.5;
          if (arr[i * 3 + 1] < 0) {
            arr[i * 3 + 1] = 12;
            arr[i * 3] = (Math.random() - 0.5) * 90;
          }
        }
        geo.attributes.position.needsUpdate = true;
      }
    };
    return { group, update };
  }

  if (id === 'lodge') {
    const lanterns = [];
    const lampMat = new THREE.MeshBasicMaterial({ color: '#ffcf7a' });
    for (const [centre, u, z] of [[centre1, -20, -14], [centre1, 20, 14], [centre1, -20, 14], [centre1, 20, -14], [centre2, -20, -14], [centre2, 20, 14], [centre2, -20, 14], [centre2, 20, -14]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.4, 6), standard({ color: '#5b3418' }));
      post.position.set(centre.x + u, 1.2, z);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), lampMat);
      lamp.position.set(centre.x + u, 2.6, z);
      group.add(post, lamp);
      lanterns.push(lamp);
    }
    // Two warm lights make the hearth glow reach the ice.
    const lightA = new THREE.PointLight('#ffb066', 18, 26, 2);
    lightA.position.set(centre1.x - 16, 2.2, 0);
    const lightB = new THREE.PointLight('#ffb066', 14, 24, 2);
    lightB.position.set(centre2.x + 10, 2.2, -6);
    group.add(lightA, lightB);
    update = (dt, gim, now) => {
      const time = now / 1000;
      lanterns.forEach((l, i) => {
        l.material.color.set(gim && gim.blizzard ? '#ffb347' : '#ffcf7a');
        l.scale.setScalar(0.92 + Math.sin(time * 2.4 + i) * 0.08);
      });
      lightA.intensity = 16 + Math.sin(time * 3) * 3;
    };
    return { group, update };
  }

  if (id === 'school') {
    // A brass chime bell per hall, and the classroom lamps that turn red when
    // the shutters come down. The bell swings while the chime sounds.
    const bells = [];
    const lamps = [];
    for (const centre of [centre1, centre2]) {
      const tower = new THREE.Group();
      const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 4.4, 8), standard({ color: '#6d7683' }));
      postL.position.set(-0.6, 2.2, 0);
      const postR = postL.clone();
      postR.position.x = 0.6;
      const beam = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.16, 0.2), standard({ color: '#6d7683' }));
      beam.position.y = 4.4;
      const bell = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 12), standard({ color: '#d8a83c', metalness: 0.6, roughness: 0.35 }));
      bell.position.y = 3.9;
      bell.rotation.x = Math.PI;
      const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), standard({ color: '#4a4f58' }));
      clapper.position.y = 3.4;
      tower.add(postL, postR, beam, bell, clapper);
      tower.position.set(centre.x, 0, centre.z - 12);
      group.add(tower);
      bells.push(bell);
      for (let i = 0; i < 4; i += 1) {
        const lampMat = new THREE.MeshBasicMaterial({ color: '#fff1c2' });
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), lampMat);
        lamp.position.set(centre.x - 12 + i * 8, 3.2, centre.z + (i % 2 ? 6 : -6));
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 4), standard({ color: '#4a4f58' }));
        cord.position.set(lamp.position.x, 4.4, lamp.position.z);
        group.add(lamp, cord);
        lamps.push(lampMat);
      }
    }
    update = (dt, gim, now) => {
      const time = now / 1000;
      const chime = Boolean(gim && gim.chime);
      const shut = Boolean(gim && gim.shut);
      for (let i = 0; i < bells.length; i += 1) {
        bells[i].rotation.z = chime ? Math.sin(time * 14 + i) * 0.35 : Math.sin(time * 2 + i) * 0.05;
      }
      for (const mat of lamps) {
        mat.color.set(shut ? '#ff3b30' : chime ? '#ffd166' : '#fff1c2');
      }
    };
    return { group, update };
  }

  if (id === 'space') {
    const gates = [];
    for (const centre of [centre1, centre2]) {
      const gate = new THREE.Group();
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(4.2, 0.22, 10, 40),
        new THREE.MeshBasicMaterial({ color: stage.palette.accent, transparent: true, opacity: 0.7 }),
      );
      ring.position.y = 4.4;
      const inner = new THREE.Mesh(
        new THREE.TorusGeometry(3.4, 0.1, 8, 36),
        new THREE.MeshBasicMaterial({ color: '#b9c9f2', transparent: true, opacity: 0.45 }),
      );
      inner.position.y = 4.4;
      const glowDisc = new THREE.Mesh(
        new THREE.CircleGeometry(3.3, 36),
        new THREE.MeshBasicMaterial({ color: stage.palette.accent, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }),
      );
      glowDisc.position.y = 4.4;
      gate.add(ring, inner, glowDisc);
      gate.position.set(centre.x, 0, centre.z - 4);
      group.add(gate);
      gates.push({ ring, inner, glowDisc });
    }
    // Asteroids drifting behind the play area.
    const rocks = [];
    const rockMat = standard({ color: '#6b7590', roughness: 0.9 });
    for (let i = 0; i < 10; i += 1) {
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7 + (i % 3) * 0.35, 0), rockMat);
      rock.position.set((i % 2 ? 1 : -1) * (22 + (i % 4) * 3), 6 + (i % 5) * 1.4, -26 + (i % 7) * 8);
      group.add(rock);
      rocks.push({ mesh: rock, phase: i * 1.1, baseY: rock.position.y });
    }
    update = (dt, gim, now) => {
      const time = now / 1000;
      const gravity = Boolean(gim && (gim.gravity || gim.warn));
      for (const g of gates) {
        g.ring.rotation.z += dt * 0.5;
        g.inner.rotation.z -= dt * 0.9;
        g.glowDisc.material.color.set(gravity ? '#ff4d6d' : stage.palette.accent);
        g.glowDisc.material.opacity = gravity ? 0.2 + Math.sin(time * 6) * 0.08 : 0.1;
      }
      for (const r of rocks) {
        r.mesh.rotation.y += dt * 0.3;
        r.mesh.position.y = r.baseY + Math.sin(time * 0.6 + r.phase) * 0.4;
      }
    };
    return { group, update };
  }

  return { group, update };
}

function occluderOf(object3d, x, z, hw, hd, h) {
  const mats = [];
  object3d.traverse((o) => {
    if (!o.isMesh) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of list) if (m && m.color) mats.push(m);
  });
  return { solid: { x, z, hw, hd, h, mats, fade: 1 } };
}

export function buildStage(stage) {
  const group = new THREE.Group();
  group.add(makeFloors(stage));
  const walls = makeWalls(stage);
  group.add(walls.group);
  const ridge = makeRidge(stage);
  group.add(ridge.group);
  const ambience = makeAmbience(stage);
  group.add(ambience.group);
  const stairs = makeStairs(stage);
  group.add(stairs.group);
  const pads = makePads(stage);
  group.add(pads.group);
  const warps = makeWarps(stage);
  group.add(warps.group);

  const labels = [...stairs.labels, ...warps.labels];
  const switchMeshes = [];
  for (const spot of stage.switchSpots) {
    const s = makeSwitch(stage, spot, labels);
    group.add(s.group);
    switchMeshes.push(s);
  }
  const gateMeshes = [];
  for (const gate of stage.gates) {
    const g = makeGate(stage, gate);
    group.add(g.group);
    gateMeshes.push(g);
  }
  const props = [];
  const occluders = [ridge, ...walls.occluders];
  for (const p of stage.props) {
    const mesh = prop(stage, p);
    group.add(mesh);
    props.push(mesh);
    if (p.type === 'ferris') occluders.push(occluderOf(mesh, p.x, p.z, 3.2, 3.2, 9));
    if (p.type === 'tent') occluders.push(occluderOf(mesh, p.x, p.z, 1.8, 1.8, 2.6));
    if (p.type === 'hearth') occluders.push(occluderOf(mesh, p.x, p.z, 1.4, 0.8, 1.7));
    if (p.type === 'hull') occluders.push(occluderOf(mesh, p.x, p.z, 1.2, 0.3, 2.6));
  }
  const show = makeShow(stage);
  group.add(show.group);

  // School shutters: a real door that falls across the corridor. It sits high
  // in its frame while the corridor is open and slams down when the chime ends
  // (Build 38), with red warning rails while the chime counts down.
  const shutters = [];
  if (stage.gimmick && stage.gimmick.kind === 'school') {
    for (const door of stage.gimmick.doors) {
      const frame = new THREE.Group();
      const railMat = standard({ color: '#5b6b57', roughness: 0.6, metalness: 0.2 });
      for (const sx of [-1, 1]) {
        const rail = box(0.28, 3.2, door.d + 0.3, railMat);
        rail.position.set(sx * (door.w / 2 + 0.1), 1.6, 0);
        frame.add(rail);
      }
      const lintel = box(door.w + 0.9, 0.5, door.d + 0.3, railMat);
      lintel.position.y = 3.35;
      frame.add(lintel);
      const warningMat = new THREE.MeshBasicMaterial({ color: '#8d9a86', transparent: true, opacity: 0.9 });
      const warningBar = box(door.w + 0.6, 0.12, door.d + 0.36, warningMat);
      warningBar.position.y = 3.05;
      frame.add(warningBar);
      const mesh = box(door.w, 3.2, door.d, standard({ color: '#4c7a52', roughness: 0.55, transparent: true, opacity: 0.94 }));
      mesh.position.y = 4.6;
      mesh.visible = false;
      frame.add(mesh);
      const stripe = new THREE.Mesh(
        new THREE.PlaneGeometry(door.w, door.d + 0.6),
        new THREE.MeshBasicMaterial({ color: '#ff4030', transparent: true, opacity: 0, depthWrite: false }),
      );
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.y = 0.04;
      frame.add(stripe);
      frame.position.set(door.x, 0, door.z);
      group.add(frame);
      // The shutter is a wall while it is down, so the camera fades it when it
      // stands between the player and the camera (the player is often on the
      // far side of a closed classroom door).
      const solid = { x: door.x, z: door.z, hw: door.w / 2, hd: door.d / 2, h: 0, mats: [mesh.material], fade: 1 };
      shutters.push({ mesh, door, frame, warningMat, warningBar, stripe, progress: 0, solid });
    }
  }

  // Hall signs: 1F hangs in the west hall, 2F in the east one, near the north
  // wall so they never sit in the middle of a chase.
  for (const floor of [1, 2]) {
    const r = floorRects(stage, floor)[0];
    if (!r) continue;
    labels.push(makeSign(group, 'sign.hall', { f: floor }, 3.6, {
      x: r.x,
      z: r.z - r.d / 2 + 1.4,
      background: 'rgba(12,52,80,0.86)',
      color: '#f2fdff',
      w: 3.8,
      h: 1.45,
    }));
  }

  for (const s of shutters) occluders.push({ solid: s.solid });

  const decals = new THREE.Group();
  group.add(decals);
  const gravityRings = [];
  const weather = makeWeather(stage);

  const update = (dt, match, gim) => {
    pads.update(dt);
    warps.update(dt);
    weather.update(dt);
    show.update(dt, gim, performance.now(), match);
    for (const p of props) {
      if (p.userData.spin) p.userData.spin.rotation.z += dt * 0.6;
      if (p.userData.float) p.userData.float.position.y = 3.4 + Math.sin(performance.now() / 900) * 0.25;
      if (p.userData.fire) p.userData.fire.scale.y = 0.9 + Math.sin(performance.now() / 120) * 0.12;
    }
    if (match) {
      // Only the switches this match actually placed are drawn: the other
      // candidate spots stay empty, so nobody walks to a switch that is not in
      // play.
      const bySpot = new Map();
      for (const sw of match.switches) bySpot.set(`${sw.x.toFixed(2)}|${sw.z.toFixed(2)}`, sw);
      const now = performance.now();
      for (const m of switchMeshes) {
        const sw = bySpot.get(`${m.spot.x.toFixed(2)}|${m.spot.z.toFixed(2)}`);
        m.group.visible = Boolean(sw);
        if (!sw) continue;
        const on = sw.active;
        const dead = sw.triggered;
        m.core.material.color.set(on ? MARK.emerald : dead ? '#8a8f99' : MARK.goldBright);
        m.core.material.emissive.set(on ? '#00d47a' : dead ? '#4a4f58' : '#ff9500');
        m.core.material.emissiveIntensity = on ? 1.9 : dead ? 0.15 : 1.5;
        m.halo.material.color.set(on ? MARK.emerald : dead ? '#9aa0aa' : MARK.gold);
        m.halo.material.opacity = on ? 0.95 : dead ? 0.12 : 0.55 + Math.sin(now / 420 + m.spot.x) * 0.2;
        m.goldRing.material.color.set(on ? MARK.emerald : dead ? '#8a8f99' : MARK.gold);
        m.floorRing.material.color.set(on ? MARK.emerald : dead ? '#8a8f99' : MARK.gold);
        m.floorRing.material.opacity = on ? 0.6 : dead ? 0.08 : 0.26 + Math.sin(now / 500 + m.spot.z) * 0.1;
        m.beam.material.color.set(on ? MARK.emerald : dead ? '#8a8f99' : MARK.gold);
        m.beam.material.opacity = on ? 0.4 : dead ? 0.02 : 0.16;
        m.group.scale.y = 1 + (sw.glow || 0) * 0.06;
        if (m.gem) {
          m.gem.position.y = 2.12 + Math.sin(now / 600 + m.spot.z) * 0.08;
          m.gem.rotation.y += dt * 1.6;
          m.gem.material.color.set(on ? '#c6ffdd' : dead ? '#c2c6cc' : '#fff2c8');
        }
      }
      for (let i = 0; i < gateMeshes.length; i += 1) {
        const gate = match.gates[i];
        const m = gateMeshes[i];
        if (!gate) continue;
        const open = gate.open;
        for (const lamp of m.lamps) {
          lamp.material.color.set(open ? MARK.emerald : MARK.red);
          lamp.scale.setScalar(open ? 1.35 : 0.9 + Math.sin(now / 300 + i) * 0.12);
        }
        m.doorMat.color.set(open ? MARK.emeraldDark : MARK.red);
        m.doorMat.emissive.set(open ? '#12ff9a' : '#ff2f10');
        m.doorMat.emissiveIntensity = open ? 1.4 : 0.85;
        m.doorMat.opacity = open ? 0.22 : 0.95;
        m.floorRing.material.color.set(open ? MARK.emerald : MARK.red);
        m.floorRing.material.opacity = open ? 0.5 + Math.sin(now / 260) * 0.2 : 0.3;
        const map = open ? m.exitOpen : m.exitClosed;
        if (m.sign.material.map !== map) {
          m.sign.material.map = map;
          m.sign.material.needsUpdate = true;
          m.signBack.material.map = map;
          m.signBack.material.needsUpdate = true;
        }
        m.lintel.material.color.set(open ? MARK.emerald : MARK.red);
        m.lintel.material.opacity = open ? 0.95 : 0.75 + Math.sin(now / 280) * 0.2;
        const target = open ? 0 : m.doorBaseY;
        m.door.position.y += (target - m.door.position.y) * Math.min(1, dt * 4);
      }
    }
    if (gim) {
      const shut = gim.shut === true;
      const chime = gim.chime === true;
      for (const s of shutters) {
        // The shutter falls (and rises) over about a third of a second.
        const target = shut ? 1 : 0;
        s.progress += (target - s.progress) * Math.min(1, dt * 6);
        if (Math.abs(s.progress - target) < 0.01) s.progress = target;
        s.mesh.visible = s.progress > 0.02;
        s.mesh.position.y = 4.6 - s.progress * 3.0;
        s.mesh.material.opacity = 0.2 + s.progress * 0.74;
        const warn = chime ? 0.5 + Math.sin(performance.now() / 110) * 0.5 : 0;
        s.warningMat.color.set(shut ? '#ff2f10' : chime ? '#ffd166' : '#8d9a86');
        s.warningMat.opacity = shut ? 1 : chime ? 0.45 + warn * 0.55 : 0.75;
        s.solid.h = s.progress > 0.45 ? 3.2 : 0;
        s.stripe.material.opacity = shut ? 0.5 : chime ? 0.18 + warn * 0.2 : 0;
      }
      for (const r of gravityRings) r.visible = Boolean(gim.gravity);
      for (const d of decals.children) d.visible = d.userData.when ? d.userData.when(gim) : true;
    }
    ambience.update(dt, gim, performance.now());
  };

  const refreshLabels = () => {
    for (const label of labels) {
      const text = t(label.key, label.params);
      label.sprite.material.map?.dispose();
      label.sprite.material.map = labelTexture(text, label.opts.color || '#ffffff', label.opts.background || 'rgba(12,28,52,0.84)');
      label.sprite.material.needsUpdate = true;
    }
  };

  return {
    group,
    update,
    weather: weather.points,
    switchMeshes,
    gateMeshes,
    shutters,
    decals,
    gravityRings,
    show,
    ambience,
    occluders,
    labels,
    refreshLabels,
    ridge,
    stage,
  };
}

/** Lanes / cells / spot pools drawn once when a stage starts. */
export function decorateZones(view, stage) {
  const g = stage.gimmick;
  if (!g) return;
  const addRect = (zone, color, opacity) => {
    const geo = new THREE.PlaneGeometry(zone.w, zone.d);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(zone.x, 0.02, zone.z);
    view.group.add(m);
    return m;
  };
  if (g.kind === 'aquarium') {
    for (const lane of g.current) {
      const m = addRect(lane, '#7fe9ff', 0.14);
      m.userData.when = () => true;
    }
  }
  if (g.kind === 'park') {
    for (const spot of g.spots) {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(2.4, 2.6, 0.04, 24, 1, true),
        new THREE.MeshBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide }),
      );
      m.position.set(spot.x, 0.03, spot.z);
      view.group.add(m);
      m.userData.when = (gim) => Boolean(gim && gim.parade);
    }
  }
  if (g.kind === 'lodge') {
    for (const zone of g.slideZones) {
      const m = addRect(zone, '#dff6ff', 0.18);
      m.userData.when = () => true;
    }
  }
  if (g.kind === 'space') {
    for (const zone of g.lowGravity) {
      const m = addRect(zone, '#9b7bff', 0.12);
      m.userData.when = () => true;
    }
  }
}

export { MARK };
