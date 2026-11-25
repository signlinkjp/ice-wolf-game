/**
 * The cast: articulated toy characters that actually run.
 *
 * Two rules, both from Build 37:
 *
 *   1. Every un-transformed body looks the same. Human, werewolf in human form
 *      and the trap-born third wolf wear one and the same costume, so nobody can
 *      read a role off a silhouette. Roles live in the HUD, not in the model.
 *      The local player is told apart by a gold ring on the ice and a gold name
 *      plate — nothing else.
 *   2. The wolf (the master wolf's Wolf Mode, and a werewolf's transform) is the
 *      one body that changes: red horns, a red mantle that flaps, glowing eyes
 *      and a red ring at the feet.
 *
 * The model itself is a rounded head, dark eyes with a highlight, a hood collar
 * and a backpack for silhouette, and real pivots on the shoulders and hips so
 * the stride is a stride. Running adds lean, bounce, arm swing and snow spray.
 */
import * as THREE from '../../vendor/three.module.js';
import { blobShadowTexture, labelTexture, standard, glow, texture } from './materials.js';

const COSTUMES = {
  classic: { human: '#d6f0ff', human2: '#2aa7d8', human3: '#173a52', skin: '#f6d4b6', wolf: '#3b404d', wolf2: '#ff5a5a' },
  aquarium: { human: '#ffe9a8', human2: '#e2a029', human3: '#0c3b4a', skin: '#f2c9a0', wolf: '#3f5d7a', wolf2: '#39d6c8' },
  park: { human: '#e3ccff', human2: '#8a5cf6', human3: '#2b1b45', skin: '#f6d4b6', wolf: '#4b3a6b', wolf2: '#ff5fa2' },
  lodge: { human: '#ffd9c4', human2: '#c0392b', human3: '#4a2c1c', skin: '#f6d4b6', wolf: '#6b4a32', wolf2: '#f7e7c6' },
  school: { human: '#cfe0ff', human2: '#2b3a67', human3: '#141d33', skin: '#f2c9a0', wolf: '#4a4a52', wolf2: '#f0efe6' },
  space: { human: '#d8ecff', human2: '#29b8e0', human3: '#1d2743', skin: '#f2c9a0', wolf: '#5a6a92', wolf2: '#59e1ff' },
};

const labelCache = new Map();

function labelSprite(text, color = '#ffffff', bg = 'rgba(10,24,44,0.78)') {
  const key = `${text}|${color}|${bg}`;
  if (labelCache.has(key)) return labelCache.get(key).clone();
  const tex = labelTexture(text, color, bg);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.1, 0.78, 1);
  sprite.renderOrder = 10;
  labelCache.set(key, sprite);
  return sprite.clone();
}

/** A rounded body panel: a box whose corners are pulled in. */
function roundedBox(w, h, d, radius, material) {
  const geo = new THREE.BoxGeometry(w, h, d, 3, 3, 3);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const k = Math.max(0.4, Math.min(0.92, 1 - radius / Math.max(w, h, d)));
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i);
    // Pull the corners in along the diagonal, so the toy reads soft, not boxy.
    if (Math.abs(v.x) > (w / 2) * 0.99 && Math.abs(v.y) > (h / 2) * 0.99 && Math.abs(v.z) > (d / 2) * 0.99) {
      v.multiplyScalar(k);
    }
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

export class ActorView {
  constructor(actor, stage) {
    this.actor = actor;
    this.stageId = stage.id;
    const costume = COSTUMES[stage.id] || COSTUMES.classic;
    this.costume = costume;
    this.group = new THREE.Group();
    this.group.scale.setScalar(1.08);
    this.body = new THREE.Group();
    this.group.add(this.body);

    const isPlayer = actor.seat === 0;
    // One costume for every body. The stage only tints the jacket, exactly the
    // same for player and CPU, human and wolf alike.
    const shirt = standard({ color: costume.human2, roughness: 0.72 });
    const pants = standard({ color: costume.human3, roughness: 0.8 });
    const skin = standard({ color: costume.skin, roughness: 0.75 });
    const accent = standard({ color: costume.human, roughness: 0.5 });
    const shoeMat = standard({ color: '#1b2433', roughness: 0.85 });
    const packMat = standard({ color: costume.human3, roughness: 0.7 });

    // Torso: a soft barrel with a jacket zip and a hood collar.
    this.torso = roundedBox(0.64, 0.74, 0.42, 0.24, shirt);
    this.torso.position.y = 1.12;
    this.torso.castShadow = true;
    this.body.add(this.torso);
    const zip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.03), accent);
    zip.position.set(0, 1.14, 0.22);
    this.body.add(zip);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.09, 6, 14), accent);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 1.48;
    this.body.add(collar);
    // Backpack: the silhouette that reads at a distance, the same on everybody.
    const pack = roundedBox(0.42, 0.46, 0.24, 0.12, packMat);
    pack.position.set(0, 1.18, -0.3);
    pack.castShadow = true;
    this.body.add(pack);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.04), accent);
    strap.position.set(0, 1.34, -0.4);
    this.body.add(strap);

    // Head: a rounded skull with a jaw, eyes with a highlight and a mouth.
    this.head = new THREE.Group();
    this.head.position.y = 1.72;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), skin);
    skull.scale.set(1.06, 1.0, 0.98);
    skull.castShadow = true;
    this.head.add(skull);
    const jaw = roundedBox(0.3, 0.16, 0.2, 0.08, skin);
    jaw.position.set(0, -0.24, 0.12);
    this.head.add(jaw);
    const eyeWhiteMat = standard({ color: '#ffffff', roughness: 0.35 });
    this.eyeMat = new THREE.MeshStandardMaterial({
      color: '#151b26',
      emissive: '#000000',
      emissiveIntensity: 0,
      roughness: 0.3,
    });
    this.eyes = [];
    for (const sx of [-0.13, 0.13]) {
      const white = new THREE.Mesh(new THREE.SphereGeometry(0.088, 10, 8), eyeWhiteMat);
      white.position.set(sx, 0.03, 0.28);
      white.scale.set(1, 1.15, 0.6);
      this.head.add(white);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), this.eyeMat);
      pupil.position.set(sx + Math.sign(sx) * 0.012, 0.03, 0.33);
      this.head.add(pupil);
      this.eyes.push(pupil);
      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.019, 6, 5), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      spark.position.set(sx - 0.02, 0.06, 0.37);
      this.head.add(spark);
    }
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.035, 0.04), standard({ color: '#2a1e18', roughness: 0.6 }));
    brow.position.set(0, 0.16, 0.3);
    this.head.add(brow);
    this.mouth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.035, 0.03), standard({ color: '#7d3b3b', roughness: 0.6 }));
    this.mouth.position.set(0, -0.14, 0.31);
    this.head.add(this.mouth);
    // A knit beanie, the same on every body: it gives the silhouette a top and
    // stops the head reading as a bare egg from behind.
    const knit = standard({ color: costume.human2, roughness: 0.85 });
    const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.44), knit);
    beanie.position.y = 0.1;
    beanie.castShadow = true;
    this.head.add(beanie);
    const brim = new THREE.Mesh(new THREE.TorusGeometry(0.325, 0.05, 6, 20), knit);
    brim.rotation.x = Math.PI / 2;
    brim.position.y = 0.14;
    this.head.add(brim);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 7), standard({ color: '#ffffff', roughness: 0.6 }));
    pom.position.set(0, 0.4, 0);
    this.head.add(pom);
    this.body.add(this.head);

    // Limbs with real pivots.
    const armGeo = new THREE.BoxGeometry(0.16, 0.46, 0.17);
    this.armL = new THREE.Group();
    this.armL.position.set(-0.38, 1.4, 0);
    const armLMesh = new THREE.Mesh(armGeo, shirt);
    armLMesh.castShadow = true;
    armLMesh.position.y = -0.22;
    this.armL.add(armLMesh);
    const handL = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 7), skin);
    handL.position.y = -0.46;
    this.armL.add(handL);
    this.armR = new THREE.Group();
    this.armR.position.set(0.38, 1.4, 0);
    const armRMesh = new THREE.Mesh(armGeo, shirt);
    armRMesh.castShadow = true;
    armRMesh.position.y = -0.22;
    this.armR.add(armRMesh);
    const handR = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 7), skin);
    handR.position.y = -0.46;
    this.armR.add(handR);
    const legGeo = new THREE.BoxGeometry(0.22, 0.6, 0.24);
    this.legL = new THREE.Group();
    this.legL.position.set(-0.17, 0.72, 0);
    const legLMesh = new THREE.Mesh(legGeo, pants);
    legLMesh.castShadow = true;
    legLMesh.position.y = -0.3;
    this.legL.add(legLMesh);
    this.legR = new THREE.Group();
    this.legR.position.set(0.17, 0.72, 0);
    const legRMesh = new THREE.Mesh(legGeo, pants);
    legRMesh.castShadow = true;
    legRMesh.position.y = -0.3;
    this.legR.add(legRMesh);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.1, 0.44), shoeMat);
    belt.position.y = 0.78;
    this.body.add(belt);
    for (const leg of [this.legL, this.legR]) {
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.15, 0.38), shoeMat);
      shoe.position.set(0, -0.61, 0.06);
      leg.add(shoe);
    }
    this.body.add(this.armL, this.armR, this.legL, this.legR);

    // ---- the wolf form: horns, mantle, claws, glowing eyes ----
    this.wolf = new THREE.Group();
    this.wolf.visible = false;
    const hornMat = standard({ color: '#ffd9d0', emissive: '#ff3b3b', emissiveIntensity: 0.55, roughness: 0.35 });
    for (const sx of [-1, 1]) {
      // The wolf group lives in body space, so the horns belong at head height.
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 8), hornMat);
      horn.position.set(sx * 0.2, 2.12, 0.04);
      horn.rotation.z = -sx * 0.32;
      horn.rotation.x = -0.12;
      this.wolf.add(horn);
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.34, 5), hornMat);
      ear.position.set(sx * 0.3, 1.86, -0.12);
      ear.rotation.z = -sx * 0.55;
      this.wolf.add(ear);
    }
    // Eyes burn red while the wolf is out.
    this.wolfEyeMat = new THREE.MeshBasicMaterial({ color: '#ff2f2f' });
    for (const sx of [-0.13, 0.13]) {
      const glowEye = new THREE.Mesh(new THREE.SphereGeometry(0.062, 8, 6), this.wolfEyeMat);
      glowEye.position.set(sx, 1.75, 0.31);
      this.wolf.add(glowEye);
    }
    // The mantle: a mesh grid so it can actually flap.
    this.capeGeo = new THREE.PlaneGeometry(0.9, 1.0, 3, 4);
    this.capeBase = this.capeGeo.attributes.position.array.slice();
    const capeMat = new THREE.MeshStandardMaterial({
      color: '#c9304a',
      roughness: 0.7,
      side: THREE.DoubleSide,
      emissive: '#7d1024',
      emissiveIntensity: 0.3,
    });
    this.cape = new THREE.Mesh(this.capeGeo, capeMat);
    this.cape.position.set(0, 1.05, -0.3);
    this.cape.rotation.x = 0.12;
    this.wolf.add(this.cape);
    const collarRing = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 6, 14), glow('#ff5a5a', 0.85));
    collarRing.rotation.x = Math.PI / 2;
    collarRing.position.set(0, 1.5, -0.16);
    this.wolf.add(collarRing);
    this.body.add(this.wolf);

    // The wolf's own ground ring (red), and the player's gold one.
    if (isPlayer) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 8, 24), glow('#ffd166', 0.85));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      this.group.add(ring);
      this.ring = ring;
    }
    const wolfRing = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.06, 8, 26), glow('#ff3b3b', 0.9));
    wolfRing.rotation.x = -Math.PI / 2;
    wolfRing.position.y = 0.04;
    wolfRing.visible = false;
    this.group.add(wolfRing);
    this.wolfRing = wolfRing;

    // Shadow.
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15, 1.15),
      new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    this.group.add(shadow);

    // Ice block, shown instead of the body while frozen.
    const iceMat = new THREE.MeshStandardMaterial({
      map: texture('assets/ice_freeze.png', 1, 1),
      color: '#bfefff',
      transparent: true,
      opacity: 0.92,
      roughness: 0.1,
      metalness: 0.1,
      emissive: '#6fd6ff',
      emissiveIntensity: 0.18,
    });
    this.ice = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.75, 1.15), iceMat);
    this.ice.position.y = 0.9;
    this.ice.visible = false;
    this.group.add(this.ice);

    // Name tag.
    this.label = labelSprite(
      actor.displayName || actor.name,
      isPlayer ? '#ffe38a' : '#ffffff',
      isPlayer ? 'rgba(48,34,8,0.8)' : 'rgba(10,24,44,0.78)',
    );
    this.label.position.y = 2.5;
    this.group.add(this.label);

    this.phase = Math.random() * Math.PI * 2;
    this.puffAt = 0;
    this.position = new THREE.Vector3(actor.x, 0, actor.z);
    this.group.position.copy(this.position);
    this.onPuff = null;
  }

  setLabel(text) {
    if (this.labelText === text) return;
    this.labelText = text;
    const isPlayer = this.actor.seat === 0;
    const sprite = labelSprite(text, isPlayer ? '#ffe38a' : '#ffffff', isPlayer ? 'rgba(48,34,8,0.8)' : 'rgba(10,24,44,0.78)');
    this.label.material.map = sprite.material.map;
    this.label.material.needsUpdate = true;
  }

  update(dt, actor, opts = {}) {
    const frozen = actor.state === 'frozen' || actor.state === 'out';
    const baseY = 0;
    const x = actor.state === 'frozen' ? actor.frozenX ?? actor.x : actor.x;
    const z = actor.state === 'frozen' ? actor.frozenZ ?? actor.z : actor.z;
    const y = actor.state === 'frozen' ? baseY : actor.y ?? baseY;
    this.group.position.x += (x - this.group.position.x) * Math.min(1, dt * 18);
    this.group.position.z += (z - this.group.position.z) * Math.min(1, dt * 18);
    this.group.position.y += (y - this.group.position.y) * Math.min(1, dt * 14);
    this.group.visible = !actor.out;

    // Build 38: the master wolf wears the wolf body all match; a werewolf only
    // while transformed. `form` is the one truth both the rules and the model use.
    const wolfOn = actor.role !== 'human' && actor.form === 'wolf';
    this.wolf.visible = wolfOn;
    if (this.wolfRing) this.wolfRing.visible = wolfOn && !frozen && actor.state === 'active';
    this.body.visible = !frozen;
    this.ice.visible = frozen && actor.state === 'frozen';
    this.eyeMat.emissive.set(wolfOn ? '#ff2f2f' : '#000000');
    this.eyeMat.emissiveIntensity = wolfOn ? 0.9 : 0;

    if (this.label) {
      this.label.position.y = 2.5;
      this.label.material.opacity = actor.out ? 0.3 : 1;
    }

    if (frozen) {
      if (this.ice.visible) {
        this.ice.rotation.y += dt * 0.2;
        this.ice.material.emissiveIntensity = 0.15 + Math.sin(performance.now() / 600) * 0.06;
      }
      if (this.ring) this.ring.visible = false;
      return;
    }

    // Face the way we are going.
    const targetYaw = actor.yaw || 0;
    let delta = targetYaw - this.group.rotation.y;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    this.group.rotation.y += delta * Math.min(1, dt * 14);

    const running = actor.moving ? 1 : 0;
    const wolf = wolfOn ? 1 : 0;
    this.phase += dt * (running ? (wolf ? 12.5 : 10.2) : 2.2);
    const swing = running ? Math.sin(this.phase) * (wolf ? 1.15 : 1.0) : Math.sin(this.phase) * 0.05;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.95;
    this.armR.rotation.x = swing * 0.95;
    this.armL.rotation.z = running ? 0.12 : 0.03 + Math.sin(this.phase * 0.5) * 0.02;
    this.armR.rotation.z = -this.armL.rotation.z;
    const bob = running ? Math.abs(Math.sin(this.phase)) * (wolf ? 0.1 : 0.12) : Math.sin(this.phase) * 0.012;
    this.body.position.y = bob;
    // A wolf leans into the chase; a runner leans into the stride.
    this.body.rotation.x = running ? (wolf ? 0.3 : 0.18) : 0.02;
    this.body.rotation.z = running ? Math.sin(this.phase) * 0.05 : Math.sin(this.phase * 0.7) * 0.01;
    // Squash on the landing frame.
    const squash = running ? 1 + Math.cos(this.phase * 2) * 0.04 : 1;
    this.body.scale.set(2 - squash, squash, 1);
    // The head leads the run, and tips back into the wolf's glare.
    this.head.rotation.x = running ? -0.12 : Math.sin(this.phase * 0.4) * 0.04;
    this.head.rotation.y = running ? 0 : Math.sin(this.phase * 0.3) * 0.12;
    this.mouth.scale.y = running ? 1.6 : 1;

    // The mantle flaps: vertex wave, cheap but alive.
    if (wolfOn) {
      const pos = this.capeGeo.attributes.position;
      const t = performance.now() / 260;
      for (let i = 0; i < pos.count; i += 1) {
        const bx = this.capeBase[i * 3];
        const by = this.capeBase[i * 3 + 1];
        const k = (0.5 - by) * 0.5 + 0.1;
        pos.setZ(i, Math.sin(t + by * 4 + bx * 3) * 0.16 * k);
        pos.setX(i, bx * (1 + k * 0.5));
      }
      pos.needsUpdate = true;
    }

    if (this.ring) {
      this.ring.rotation.z += dt * 1.2;
      this.ring.visible = actor.state === 'active';
    }

    // Snow / dust at the feet while running.
    if (running && this.onPuff) {
      this.puffAt -= dt;
      if (this.puffAt <= 0) {
        this.puffAt = opts.cadence || 0.13;
        this.onPuff(this.group.position);
      }
    }
  }
}

export function costumeOf(stageId) {
  return COSTUMES[stageId] || COSTUMES.classic;
}
