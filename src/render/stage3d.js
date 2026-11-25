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
import { standard, texture, surface, glow, labelTexture } from './materials.js';

const WALL_H = ARENA.wallH;
const RAIL_H = ARENA.railH;

/**
 * Colours the player has to be able to name from across the rink, whatever
 * stage is behind them (Build 36). The ice is white-blue everywhere, so the
 * interactive furniture gets its own warm / magenta / green language instead of
 * borrowing the stage accent.
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

function makeFloor(stage) {
  const group = new THREE.Group();
  const floorTex = surface(stage.tex.floor, stage.palette.floor, 0.22, 12, 9);
  // The deck gets a tint of the stage accent, so the 2F footprint reads as a
  // different surface from any angle — the shape is the stage's signature now.
  const deckTint = new THREE.Color(stage.palette.deck)
    .lerp(new THREE.Color(stage.palette.accent), 0.34)
    .getStyle();
  const deckTex = surface(stage.tex.floor, deckTint, 0.2, 5, 9);
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

  // The deck (2F): one block per rectangle the stage declares, so the cliff
  // face follows the island / balcony / L / band / ring outline exactly.
  const deckSideMat = standard({
    map: surface(stage.tex.wall, stage.palette.wallSide, 0.3, 5, 2),
    color: '#ffffff',
    roughness: 0.75,
  });
  const deckTopMat = standard({ map: deckTex, color: '#ffffff', roughness: 0.42 });
  for (const r of stage.deck) {
    const block = new THREE.Mesh(new THREE.BoxGeometry(r.w, 5.2, r.d), deckSideMat);
    block.position.set(r.x, 2.7, r.z);
    block.castShadow = true;
    block.receiveShadow = true;
    group.add(block);
    const top = new THREE.Mesh(new THREE.BoxGeometry(r.w, 0.3, r.d), deckTopMat);
    top.position.set(r.x, 5.35, r.z);
    top.receiveShadow = true;
    top.castShadow = false;
    group.add(top);
  }

  // A pale rim around the ice so the arena reads as a rink, not a void.
  const rimMat = standard({ color: stage.palette.cap, roughness: 0.9 });
  const rimN = box(49.6, 0.35, 0.6, rimMat);
  rimN.position.set(0, 0.05, -18.3);
  const rimS = rimN.clone();
  rimS.position.z = 18.3;
  const rimW = box(0.6, 0.35, 36.6, rimMat);
  rimW.position.set(-24.3, 0.05, 0);
  const rimE = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 36.6), rimMat);
  rimE.position.set(23.9, 0.05, 0);
  group.add(rimN, rimS, rimW, rimE);

  // Rink markings: a centre circle and two lines per floor. They break up the
  // big white sheet and give the eye a sense of speed. Each deck rectangle gets
  // its own ring, so the 2F reads as the shape it is even from the ice.
  const markMat = new THREE.MeshBasicMaterial({ color: stage.palette.accent, transparent: true, opacity: 0.35, depthWrite: false });
  const marks = new THREE.Group();
  const groundFloorCentre = stage.playerSpawn;
  for (const floor of [1, 2]) {
    const y = (floor === 2 ? ARENA.deckY : 0) + 0.015;
    const spots = floor === 2 ? stage.deck : [null];
    for (const r of spots) {
      const cx = floor === 2 ? r.x : groundFloorCentre.x;
      const cz = floor === 2 ? r.z : 0;
      const size = floor === 2 ? Math.min(r.w, r.d) * 0.28 : 3.2;
      if (size < 1.4) continue;
      const circle = new THREE.Mesh(new THREE.RingGeometry(size * 0.92, size, 40), markMat);
      circle.rotation.x = -Math.PI / 2;
      circle.position.set(cx, y, cz);
      marks.add(circle);
      const bandLen = floor === 2 ? Math.min(r.w, r.d) * 0.9 : 20;
      for (const dir of [-1, 1]) {
        const band = new THREE.Mesh(new THREE.PlaneGeometry(bandLen, 0.22), markMat);
        band.rotation.x = -Math.PI / 2;
        if (floor === 2) band.position.set(cx, y, cz + dir * Math.min(r.d / 2 - 0.8, 7));
        else band.position.set(cx, y, cz + dir * 9);
        marks.add(band);
      }
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
  // Warm wood against blue ice: the flight reads as a way up, not a wall.
  const tread = standard({ color: MARK.wood, roughness: 0.72 });
  const edge = new THREE.MeshBasicMaterial({ color: MARK.goldBright });
  const railMat = standard({ color: '#eda94f', roughness: 0.45, metalness: 0.3 });
  const marker = glow(MARK.amberSoft, 0.45);
  const arrow = glow(MARK.amberSoft, 0.92);

  // One flight per stage-declared stairwell: built along local +x and turned so
  // it climbs east, west, north or south out of the deck face.
  for (const stair of stage.stairs.filter((s) => s.floor === 1)) {
    const flight = new THREE.Group();
    const steps = 12;
    const run = Math.max(1.8, ARENA.stairRun);
    const y0 = 0.15;
    const rise = ARENA.deckY - y0 - 0.15;
    for (let i = 0; i < steps; i += 1) {
      const t = i / (steps - 1);
      const x = -run + t * run;
      const y = y0 + t * rise;
      const step = box(0.34, 0.26, stair.w - 0.5, tread);
      step.position.set(x, y, 0);
      flight.add(step);
      const lip = box(0.09, 0.1, stair.w - 0.45, edge);
      lip.position.set(x - 0.16, y + 0.09, 0);
      flight.add(lip);
    }
    const angle = Math.atan2(rise, run);
    const diag = Math.hypot(run, rise);
    const midY = y0 + rise / 2;
    for (const side of [-1, 1]) {
      const zPost = side * (stair.w / 2 - 0.1);
      const pole = box(0.12, 1.05, 0.12, railMat);
      pole.position.set(-1.15, 0.62, zPost);
      flight.add(pole);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), glow(MARK.amberSoft, 0.95));
      cap.position.set(-1.15, 1.22, zPost);
      flight.add(cap);
      const board = box(diag, 0.14, 0.1, railMat);
      board.position.set(-run / 2, midY - 0.12, side * (stair.w / 2 - 0.06));
      board.rotation.z = -angle;
      flight.add(board);
    }
    // The foot: a warm ring and two chevrons on the ice, pointing up.
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.35, 26), marker);
    ring.rotation.x = -Math.PI / 2;
    ring.rotation.z = -Math.PI / 2;
    ring.position.set(-2.5, 0.03, 0);
    flight.add(ring);
    for (const [ax, size] of [[-3.8, 0.34], [-3.1, 0.42]]) {
      const chevron = new THREE.Mesh(new THREE.ConeGeometry(size, size * 1.7, 3), arrow);
      chevron.rotation.z = -Math.PI / 2;
      chevron.position.set(ax, 0.16, 0);
      flight.add(chevron);
    }
    // And the landing on the deck where a 2F player walks down.
    const landing = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.22, 26), marker);
    landing.rotation.x = -Math.PI / 2;
    landing.position.set(1.6, ARENA.deckY + 0.03, 0);
    flight.add(landing);

    flight.position.set(stair.edgeX, 0, stair.edgeZ);
    flight.rotation.y = stair.dir === 'E' ? 0 : stair.dir === 'W' ? Math.PI : stair.dir === 'N' ? Math.PI / 2 : -Math.PI / 2;
    group.add(flight);
  }
  return group;
}

function makePads(stage) {
  const group = new THREE.Group();
  const discs = [];
  const spin = [];
  const warpRings = [];

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
    const y = (warp.floor === 2 ? ARENA.deckY : 0) + 0.04;
    const g = new THREE.Group();
    // Magenta and violet only: nothing else on any stage uses them, so a warp
    // can never be mistaken for ice or for a speed pad.
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
    g.position.set(warp.x, y, warp.z);
    group.add(g);
    discs.push(g);
    spin.push({ mesh: outer, speed: 0.9 });
    spin.push({ mesh: inner, speed: -1.5 });
    warpRings.push({ group: g, outer, inner, column, sparks });
  }

  const update = (dt) => {
    for (const s of spin) s.mesh.rotation.z += dt * s.speed;
    for (const d of discs) d.position.y += 0;
    const now = performance.now() / 1000;
    for (const w of warpRings) {
      // Rings breathe, and sparks climb the column so a warp reads as active.
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
  return { group, update };
}

function makeSwitch(stage, spot) {
  const group = new THREE.Group();
  const baseY = spot.floor === 2 ? ARENA.deckY : 0;
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
  // The big amber lamp and its halo: findable across the rink.
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
  group.position.set(spot.x, baseY, spot.z);
  return { group, core, halo, beam, gem, floorRing, goldRing, spot };
}

function makeGate(stage, gate) {
  const group = new THREE.Group();
  const y = gate.floor === 2 ? ARENA.deckY : 0;
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
  group.position.set(gate.x, y, gate.z);
  group.rotation.y = gate.facing === 'west' ? Math.PI / 2 : gate.facing === 'north' ? 0 : -Math.PI / 2;
  return { group, door, light: lamps[0], lamps, sign, signBack, floorRing, lintel, doorMat, doorBaseY: 1.55, exitClosed, exitOpen };
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
/* Stage shows: the gimmick made visible                                */
/* ------------------------------------------------------------------ */

/**
 * Build 37: each gimmick gets one unmistakable actor in the scene.
 *   aquarium — a manta glides over the rink while the current pushes
 *   park     — parade floats run the balcony while the boost is on
 *   lodge    — a blizzard wall of sleet blows across while the ice is slick
 *   school   — a chime beacon over each shutter, amber warning then red
 *   space    — gravity rings light up on the six high-gravity cells
 */
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
    manta.position.set(-20, 3.4, 0);
    group.add(manta);
    show.manta = manta;
    show.update = (dt, gim, now) => {
      const on = Boolean(gim && gim.manta);
      manta.visible = on || (gim && gim.kind === 'aquarium');
      const t = now / 1000;
      const phase = (t * 0.12) % 1;
      manta.position.set(-22 + phase * 44, 3.2 + Math.sin(t * 0.8) * 0.35, Math.sin(t * 0.5) * 6);
      manta.rotation.y = Math.PI / 2 + Math.sin(t * 0.4) * 0.25;
      manta.rotation.z = Math.sin(t * 1.4) * (on ? 0.22 : 0.08);
      for (const fin of manta.children) fin.rotation.z = (fin.userData.sign || 0);
      if (gim && gim.manta) {
        // Bubbles trailing the manta while it pushes the current.
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
      cart.position.set(spot.x, spot.floor === 2 ? ARENA.deckY : 0, spot.z);
      group.add(cart);
      show.floats.push({ cart, spot, phase: i * 1.7 });
    });
    show.update = (dt, gim, now) => {
      const on = Boolean(gim && gim.parade);
      const t = now / 1000;
      for (const f of show.floats) {
        f.cart.visible = true;
        const drift = on ? Math.sin(t * 0.9 + f.phase) * 2.4 : 0;
        f.cart.position.x = f.spot.x + drift;
        f.cart.position.y = (f.spot.floor === 2 ? ARENA.deckY : 0) + (on ? Math.abs(Math.sin(t * 5 + f.phase)) * 0.14 : 0);
        f.cart.rotation.y = on ? Math.cos(t * 0.9 + f.phase) * 0.2 : 0;
      }
    };
    return show;
  }

  if (g.kind === 'lodge') {
    const count = 260;
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
      // A slim lamp housing over the doorway: dim while the corridor is open,
      // amber while the chime warns, red while the shutter is down.
      const bar = new THREE.Mesh(new THREE.BoxGeometry(Math.min(door.w, 3.4), 0.14, 0.18), new THREE.MeshBasicMaterial({ color: '#7f8b7a' }));
      bar.position.y = 2.9;
      const lampMat = new THREE.MeshBasicMaterial({ color: '#9ba894' });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), lampMat);
      lamp.position.y = 2.9;
      beacon.add(bar, lamp);
      beacon.position.set(door.x, door.floor === 2 ? ARENA.deckY : 0, door.z);
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
    show.update = (dt, gim, now, match) => {
      const cells = (gim && gim.cells) || [];
      // Rebuild when the set of cells changes (one seeded set per match).
      const key = cells.map((c) => `${c.x.toFixed(1)},${c.z.toFixed(1)}`).join('|');
      if (show.ringKey !== key) {
        for (const r of show.rings) group.remove(r.mesh);
        show.rings = cells.map((c) => {
          const mesh = new THREE.Mesh(
            new THREE.RingGeometry(c.r * 0.55, c.r, 28),
            new THREE.MeshBasicMaterial({ color: '#8f7bff', transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
          );
          mesh.rotation.x = -Math.PI / 2;
          mesh.position.set(c.x, (c.floor === 2 ? ARENA.deckY : 0) + 0.03, c.z);
          group.add(mesh);
          return { mesh, cell: c };
        });
        show.ringKey = key;
      }
      const warn = Boolean(gim && gim.warn);
      const active = Boolean(gim && gim.gravity);
      const t = now / 1000;
      for (const r of show.rings) {
        r.mesh.visible = warn || active;
        const mat = r.mesh.material;
        mat.color.set(active ? '#ff4d6d' : '#8f7bff');
        mat.opacity = active ? 0.55 + Math.sin(t * 8 + r.cell.x) * 0.2 : 0.25 + Math.sin(t * 6 + r.cell.z) * 0.15;
        r.mesh.scale.setScalar(active ? 1 + Math.sin(t * 6) * 0.05 : 1);
      }
    };
    return show;
  }

  return show;
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
  const show = makeShow(stage);
  group.add(show.group);

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
    show.update(dt, gim, performance.now(), match);
    for (const p of props) {
      if (p.userData.spin) p.userData.spin.rotation.z += dt * 0.6;
      if (p.userData.float) p.userData.float.position.y = 3.4 + Math.sin(performance.now() / 900) * 0.25;
      if (p.userData.fire) p.userData.fire.scale.y = 0.9 + Math.sin(performance.now() / 120) * 0.12;
    }
    if (match) {
      // Only the switches this match actually placed are drawn: the other
      // candidate spots stay empty, so nobody walks to a switch that is not in
      // play (Build 35 showed all thirteen, which hid the real ones).
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
        m.sign.material.color.set('#ffffff');
        m.signBack.material.color.set('#ffffff');
        const map = open ? m.exitOpen : m.exitClosed;
        if (m.sign.material.map !== map) {
          m.sign.material.map = map;
          m.sign.material.needsUpdate = true;
          m.signBack.material.map = map;
          m.signBack.material.needsUpdate = true;
        }
        m.lintel.material.color.set(open ? MARK.emerald : MARK.red);
        m.lintel.material.opacity = open ? 0.95 : 0.75 + Math.sin(now / 280) * 0.2;
        // The barrier sinks into the sill when the gate opens.
        const target = open ? 0 : m.doorBaseY;
        m.door.position.y += (target - m.door.position.y) * Math.min(1, dt * 4);
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
    show,
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
