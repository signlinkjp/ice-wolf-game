/**
 * The six arenas in 3D.
 *
 * Shared frame: a 48 x 36 m ice floor, a 5.5 m deck over its east half, and two
 * stairwells cut through the deck edge. Per stage: inner walls with snow caps,
 * a palette, wall/floor pictures from the existing asset folder, set dressing
 * and weather.
 */
import * as THREE from '../../vendor/three.module.js';
import { ARENA } from '../config.js';
import { wallsForFloor } from '../core/geometry.js';
import { standard, texture, surface, glow } from './materials.js';

const WALL_H = ARENA.wallH;
const RAIL_H = ARENA.railH;

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

function makeFloor(stage) {
  const group = new THREE.Group();
  const floorTex = surface(stage.tex.floor, stage.palette.floor, 0.22, 12, 9);
  const deckTex = surface(stage.tex.floor, stage.palette.deck, 0.2, 5, 9);
  const ice = standard({
    map: floorTex,
    color: '#ffffff',
    roughness: 0.38,
    metalness: 0.04,
  });
  const base = new THREE.Mesh(new THREE.BoxGeometry(48, 0.6, 36), ice);
  base.position.set(0, -0.3, 0);
  base.receiveShadow = true;
  base.castShadow = false;
  group.add(base);

  // The deck (2F) is a solid block, so its cliff reads as a wall from below.
  const deck = new THREE.Mesh(new THREE.BoxGeometry(18, 5.2, 36), standard({
    map: surface(stage.tex.wall, stage.palette.wallSide, 0.3, 5, 2),
    color: '#ffffff',
    roughness: 0.75,
  }));
  deck.position.set(15, 2.7, 0);
  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);
  const deckTop = new THREE.Mesh(new THREE.BoxGeometry(18, 0.3, 36), standard({
    map: deckTex,
    color: '#ffffff',
    roughness: 0.38,
  }));
  deckTop.position.set(15, 5.35, 0);
  deckTop.receiveShadow = true;
  deckTop.castShadow = false;
  group.add(deckTop);

  // A pale rim around the ice so the arena reads as a rink, not a void.
  const rimMat = standard({ color: stage.palette.cap, roughness: 0.9 });
  const rimN = box(49.6, 0.35, 0.6, rimMat);
  rimN.position.set(0, 0.05, -18.3);
  const rimS = rimN.clone();
  rimS.position.z = 18.3;
  const rimW = box(0.6, 0.35, 36.6, rimMat);
  rimW.position.set(-24.3, 0.05, 0);
  const rimE = box(0.6, 0.35, 36.6, rimMat);
  rimE.position.set(25 - 1, 0.05, 0);
  group.add(rimN, rimS, rimW, rimE);

  // Rink markings: a centre circle and two blue lines per floor. They break up
  // the big white sheet and give the eye a sense of speed.
  const markMat = new THREE.MeshBasicMaterial({ color: stage.palette.accent, transparent: true, opacity: 0.35, depthWrite: false });
  const marks = new THREE.Group();
  for (const floor of [1, 2]) {
    const y = (floor === 2 ? ARENA.deckY : 0) + 0.015;
    const cx = floor === 2 ? 15 : -9;
    const circle = new THREE.Mesh(new THREE.RingGeometry(3.2, 3.5, 40), markMat);
    circle.rotation.x = -Math.PI / 2;
    circle.position.set(cx, y, 0);
    marks.add(circle);
    for (const z of [-9, 9]) {
      const band = new THREE.Mesh(new THREE.PlaneGeometry(floor === 2 ? 17 : 29, 0.22), markMat);
      band.rotation.x = -Math.PI / 2;
      band.position.set(cx, y, z);
      marks.add(band);
    }
  }
  group.add(marks);
  return group;
}

function makeWalls(stage) {
  const group = new THREE.Group();
  const wallTex = surface(stage.tex.wall, stage.palette.wall, 0.34, 2, 1);
  const sideTex = surface(stage.tex.wall, stage.palette.wallSide, 0.3, 2, 1);
  const capTex = surface(stage.tex.cap, stage.palette.cap, 0.25, 1, 1);
  const wallMat = standard({ map: wallTex, color: '#ffffff', roughness: 0.8 });
  const sideMat = standard({ map: sideTex, color: '#ffffff', roughness: 0.85 });
  const capMat = standard({ map: capTex, color: '#ffffff', roughness: 0.95 });
  const cliffMat = standard({ map: sideTex, color: '#ffffff', roughness: 0.8 });
  const railMat = standard({ color: stage.palette.accent, roughness: 0.5, metalness: 0.2 });

  for (const floor of [1, 2]) {
    for (const w of wallsForFloor(stage, floor)) {
      const h = w.kind === 'cliff' ? ARENA.deckY : w.kind === 'rail' ? RAIL_H : WALL_H;
      const yBase = floor === 2 ? ARENA.deckY : 0;
      const mat = w.kind === 'cliff' ? cliffMat : w.kind === 'rail' ? railMat : wallMat;
      const mesh = box(w.w, h, w.d, mat);
      mesh.position.set(w.x, yBase + h / 2, w.z);
      group.add(mesh);

      // Snow on top of every wall (the Build 34 look, now real geometry).
      if (w.kind !== 'rail') {
        const cap = box(w.w + 0.16, 0.22, w.d + 0.16, capMat);
        cap.position.set(w.x, yBase + h + 0.09, w.z);
        group.add(cap);
      }
      if (w.kind === 'wall' && Math.max(w.w, w.d) > 4) {
        // Pilasters give long walls a rhythm instead of one flat slab.
        const along = Math.max(w.w, w.d);
        const count = Math.max(2, Math.floor(along / 4));
        const pillarMat = new THREE.MeshStandardMaterial({ color: stage.palette.accent, roughness: 0.6 });
        for (let i = 1; i < count; i += 1) {
          const t = i / count;
          const pillar = box(w.w > w.d ? 0.34 : w.w + 0.2, WALL_H * 0.82, w.w > w.d ? w.d + 0.2 : 0.34, pillarMat, { cast: false });
          pillar.position.set(
            w.w > w.d ? w.x - w.w / 2 + w.w * t : w.x,
            yBase + WALL_H * 0.41,
            w.w > w.d ? w.z : w.z - w.d / 2 + w.d * t,
          );
          group.add(pillar);
        }
      }
      if (w.kind === 'wall' && w.w > 2) {
        // A darker plinth keeps big walls from looking like floating slabs.
        const plinth = box(w.w + 0.08, 0.3, w.d + 0.08, sideMat);
        plinth.position.set(w.x, yBase + 0.15, w.z);
        group.add(plinth);
        const stripe = box(w.w + 0.1, 0.12, w.d + 0.1, new THREE.MeshBasicMaterial({ color: stage.palette.accent }));
        stripe.position.set(w.x, yBase + h - 0.35, w.z);
        group.add(stripe);
      }
    }
  }
  return group;
}

function makeStairs(stage) {
  const group = new THREE.Group();
  const stepMat = standard({ color: stage.palette.accent, roughness: 0.55 });
  const dark = standard({ color: stage.palette.accent2, roughness: 0.6 });
  for (const stair of ARENA.stairs) {
    const steps = 11;
    for (let i = 0; i < steps; i += 1) {
      const t = i / (steps - 1);
      const step = box(0.55, 0.24, stair.w - 0.6, i % 2 ? stepMat : dark);
      step.position.set(6.3 - 2.0 + t * 3.6, 0.15 + t * (ARENA.deckY - 0.4), stair.z);
      group.add(step);
    }
    // Railings either side.
    for (const side of [-1, 1]) {
      const rail = box(4.0, 0.16, 0.16, stepMat);
      rail.position.set(7.0, 2.95, stair.z + side * (stair.w / 2 - 0.35));
      rail.rotation.z = -0.98;
      group.add(rail);
    }
  }
  return group;
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
    const y = (pad.floor === 2 ? ARENA.deckY : 0) + 0.03;
    const g = new THREE.Group();
    const ring = ringFor(stage.palette.accent2);
    const inner = new THREE.Mesh(
      new THREE.CircleGeometry(0.85, 24),
      new THREE.MeshBasicMaterial({ color: stage.palette.accent2, transparent: true, opacity: 0.16, depthWrite: false }),
    );
    inner.rotation.x = -Math.PI / 2;
    // Two chevrons pointing the way the booster sends you.
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
    g.position.set(pad.x, y, pad.z);
    group.add(g);
    discs.push(g);
  }

  for (const warp of stage.warps) {
    const y = (warp.floor === 2 ? ARENA.deckY : 0) + 0.035;
    const g = new THREE.Group();
    const ring = ringFor('#b78bff');
    const ring2 = ringFor('#6f4bd8', 0.92);
    const core = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 20),
      new THREE.MeshBasicMaterial({ color: '#b78bff', transparent: true, opacity: 0.28, depthWrite: false }),
    );
    core.rotation.x = -Math.PI / 2;
    g.add(ring, ring2, core);
    g.position.set(warp.x, y, warp.z);
    group.add(g);
    discs.push(g);
    spin.push({ mesh: ring, speed: 0.6 });
    spin.push({ mesh: ring2, speed: -0.9 });
  }

  const update = (dt) => {
    for (const s of spin) s.mesh.rotation.z += dt * s.speed;
    for (const d of discs) d.position.y += 0;
  };
  return { group, update };
}

function makeSwitch(stage, spot) {
  const group = new THREE.Group();
  const baseY = spot.floor === 2 ? ARENA.deckY : 0;
  const pillar = box(0.5, 0.9, 0.5, standard({ color: '#243447', roughness: 0.6 }));
  pillar.position.y = 0.45;
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.4, 0.42, 12),
    standard({ color: '#9fe8ff', emissive: '#1b6f8a', emissiveIntensity: 0.7, roughness: 0.3 }),
  );
  core.position.y = 1.06;
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.06, 8, 24), glow(stage.palette.accent, 0.55));
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 1.3;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.6, 10, 1, true), glow(stage.palette.accent, 0.16));
  beam.position.y = 2.2;
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.2, 0),
    new THREE.MeshBasicMaterial({ color: '#dff7ff', transparent: true, opacity: 0.95 }),
  );
  gem.position.y = 1.9;
  group.add(pillar, core, halo, beam, gem);
  group.position.set(spot.x, baseY, spot.z);
  return { group, core, halo, beam, gem };
}

function makeGate(stage, gate) {
  const group = new THREE.Group();
  const y = gate.floor === 2 ? ARENA.deckY : 0;
  const frameMat = standard({ color: stage.palette.accent2, roughness: 0.4, metalness: 0.35 });
  const doorMat = new THREE.MeshStandardMaterial({
    color: '#4b5b6e',
    roughness: 0.5,
    metalness: 0.4,
    transparent: true,
    opacity: 0.95,
  });
  const side = 2.2;
  const left = box(0.35, 3.0, 0.5, frameMat);
  left.position.set(-side / 2, 1.5, 0);
  const right = left.clone();
  right.position.x = side / 2;
  const top = box(side + 0.35, 0.42, 0.6, frameMat);
  top.position.y = 3.05;
  const door = box(side - 0.2, 2.6, 0.18, doorMat);
  door.position.y = 1.35;
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), glow('#ff5a5a', 0.9));
  light.position.y = 3.4;
  group.add(left, right, top, door, light);
  group.position.set(gate.x, y, gate.z);
  group.rotation.y = gate.facing === 'west' ? Math.PI / 2 : gate.facing === 'north' ? 0 : -Math.PI / 2;
  return { group, door, light };
}

/* ------------------------------------------------------------------ */
/* Set dressing                                                        */
/* ------------------------------------------------------------------ */

function prop(stage, p) {
  const g = new THREE.Group();
  const y = p.floor === 2 ? ARENA.deckY : 0;
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
  g.position.set(p.x, y, p.z);
  return g;
}

/* ------------------------------------------------------------------ */
/* Weather                                                             */
/* ------------------------------------------------------------------ */

function makeWeather(stage) {
  const count = stage.weather === 'stars' ? 260 : 420;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    pos[i * 3] = (Math.random() - 0.5) * 54;
    pos[i * 3 + 1] = Math.random() * 16;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 42;
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
          arr[k] = (Math.random() - 0.5) * 54;
          arr[k + 2] = (Math.random() - 0.5) * 42;
        }
      }
      if (arr[k] > 27) arr[k] = -27;
    }
    geo.attributes.position.needsUpdate = true;
  };
  return { points, update };
}

/* ------------------------------------------------------------------ */

export function buildStage(stage) {
  const group = new THREE.Group();
  group.add(makeFloor(stage));
  group.add(makeWalls(stage));
  group.add(makeStairs(stage));
  const pads = makePads(stage);
  group.add(pads.group);

  const switchMeshes = [];
  for (const spot of stage.switchSpots) {
    const s = makeSwitch(stage, spot);
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
  for (const p of stage.props) {
    const mesh = prop(stage, p);
    group.add(mesh);
    props.push(mesh);
  }

  // School shutters.
  const shutters = [];
  if (stage.gimmick && stage.gimmick.kind === 'school') {
    for (const door of stage.gimmick.doors) {
      const mesh = box(door.w, 2.6, door.d, standard({ color: '#4c7a52', roughness: 0.55, transparent: true, opacity: 0.92 }));
      mesh.position.set(door.x, (door.floor === 2 ? ARENA.deckY : 0) + 1.3, door.z);
      mesh.visible = false;
      group.add(mesh);
      shutters.push({ mesh, door });
    }
  }

  // Gravity cells + aquarium lanes + park spots, as faint floor decals.
  const decals = new THREE.Group();
  group.add(decals);
  const decalMats = {
    current: glow(stage.palette.accent, 0.16),
    gravity: glow('#8f7bff', 0.28),
    parade: glow(stage.palette.accent2, 0.18),
  };
  const gravityRings = [];
  const weather = makeWeather(stage);

  const update = (dt, match, gim) => {
    pads.update(dt);
    weather.update(dt);
    for (const p of props) {
      if (p.userData.spin) p.userData.spin.rotation.z += dt * 0.6;
      if (p.userData.float) p.userData.float.position.y = 3.4 + Math.sin(performance.now() / 900) * 0.25;
      if (p.userData.fire) p.userData.fire.scale.y = 0.9 + Math.sin(performance.now() / 120) * 0.12;
    }
    if (match) {
      for (let i = 0; i < switchMeshes.length; i += 1) {
        const sw = match.switches[i];
        const m = switchMeshes[i];
        if (!sw) continue;
        const on = sw.active;
        m.core.material.color.set(on ? '#8dff9e' : '#9fe8ff');
        m.core.material.emissiveIntensity = on ? 1.6 : 0.6;
        m.halo.material.color.set(sw.correct && on ? '#7dffa0' : stage.palette.accent);
        m.halo.material.opacity = on ? 0.95 : 0.4 + Math.sin(performance.now() / 500 + i) * 0.12;
        m.beam.material.opacity = on ? 0.34 : 0.1;
        m.group.scale.y = 1 + (sw.glow || 0) * 0.06;
        if (m.gem) {
          m.gem.position.y = 1.9 + Math.sin(performance.now() / 600 + i) * 0.08;
          m.gem.rotation.y += dt * 1.6;
          m.gem.material.color.set(on ? '#9dffb4' : sw.trap ? '#ffb3a0' : '#dff7ff');
        }
      }
      for (let i = 0; i < gateMeshes.length; i += 1) {
        const gate = match.gates[i];
        const m = gateMeshes[i];
        if (!gate) continue;
        m.light.material.color.set(gate.open ? '#7dffa0' : '#ff5a5a');
        m.light.scale.setScalar(gate.open ? 1.5 + Math.sin(performance.now() / 300) * 0.3 : 1);
        const target = gate.open ? -2.6 : 0;
        m.door.position.y += (1.35 + target - m.door.position.y) * Math.min(1, dt * 4);
        m.door.material.opacity = gate.open ? 0.35 : 0.95;
      }
    }
    if (gim) {
      const shut = gim.shut === true;
      for (const s of shutters) {
        s.mesh.visible = shut;
        s.mesh.material.opacity = shut ? 0.94 : 0;
      }
      // Gravity rings, drawn only while the cells are live.
      for (const r of gravityRings) {
        r.visible = Boolean(gim.gravity);
      }
      for (const d of decals.children) {
        d.visible = d.userData.when ? d.userData.when(gim) : true;
      }
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
    decalMats,
    gravityRings,
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
    m.position.set(zone.x, (zone.floor === 2 ? ARENA.deckY : 0) + 0.02, zone.z);
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
      m.position.set(spot.x, (spot.floor === 2 ? ARENA.deckY : 0) + 0.03, spot.z);
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
