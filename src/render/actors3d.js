/**
 * The cast: articulated block-toy characters that actually run.
 *
 * Legs and arms are pivot groups, so the walk is a real stride (not a sliding
 * picture): 4-frame stride, vertical bob, forward lean, a squash on the landing
 * and a puff of snow at the feet. The wolf form adds red horns, red ears and a
 * red mantle — only while Wolf Mode is on, which is the only time a wolf can be
 * recognised.
 */
import * as THREE from '../../vendor/three.module.js';
import { ARENA } from '../config.js';
import { blobShadowTexture, labelTexture, standard, glow, texture } from './materials.js';

const COSTUMES = {
  classic: { human: '#d6f0ff', human2: '#159fd4', human3: '#173a52', skin: '#f6d4b6', wolf: '#3b404d', wolf2: '#ff5a5a' },
  aquarium: { human: '#ffe9a8', human2: '#f2a51f', human3: '#0c3b4a', skin: '#f2c9a0', wolf: '#3f5d7a', wolf2: '#39d6c8' },
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
    // Everyone wears the stage colour; the player wears gold so "YOU" reads at a
    // glance even on a crowded rink. Wolves hide in exactly the same clothes.
    const shirt = standard({ color: isPlayer ? '#ffc93c' : costume.human2, roughness: 0.72 });
    const pants = standard({ color: costume.human3, roughness: 0.8 });
    const skin = standard({ color: costume.skin, roughness: 0.75 });
    const accent = standard({ color: isPlayer ? '#fff3c4' : costume.human, roughness: 0.5 });
    const shoeMat = standard({ color: '#1b2433', roughness: 0.85 });

    // Torso
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.72, 0.44), shirt);
    this.torso.castShadow = true;
    this.torso.position.y = 1.12;
    this.body.add(this.torso);
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.48), accent);
    collar.position.y = 1.46;
    this.body.add(collar);

    // Head + face
    this.head = new THREE.Group();
    this.head.position.y = 1.7;
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.6, 0.58), skin);
    skull.castShadow = true;
    this.head.add(skull);
    const eyeMat = standard({ color: '#1b2433', roughness: 0.4 });
    for (const sx of [-0.13, 0.13]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.11, 0.03), eyeMat);
      eye.position.set(sx, 0.04, 0.3);
      this.head.add(eye);
    }
    const beanie = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.2, 0.62), accent);
    beanie.position.y = 0.33;
    this.head.add(beanie);
    this.body.add(this.head);

    // Limbs with pivots
    const armGeo = new THREE.BoxGeometry(0.17, 0.5, 0.18);
    this.armL = new THREE.Group();
    this.armL.position.set(-0.37, 1.38, 0);
    const armLMesh = new THREE.Mesh(armGeo, shirt);
    armLMesh.castShadow = true;
    armLMesh.position.y = -0.24;
    this.armL.add(armLMesh);
    this.armR = new THREE.Group();
    this.armR.position.set(0.37, 1.38, 0);
    const armRMesh = new THREE.Mesh(armGeo, shirt);
    armRMesh.castShadow = true;
    armRMesh.position.y = -0.24;
    this.armR.add(armRMesh);
    const legGeo = new THREE.BoxGeometry(0.22, 0.62, 0.24);
    this.legL = new THREE.Group();
    this.legL.position.set(-0.17, 0.7, 0);
    const legLMesh = new THREE.Mesh(legGeo, pants);
    legLMesh.castShadow = true;
    legLMesh.position.y = -0.31;
    this.legL.add(legLMesh);
    this.legR = new THREE.Group();
    this.legR.position.set(0.17, 0.7, 0);
    const legRMesh = new THREE.Mesh(legGeo, pants);
    legRMesh.castShadow = true;
    legRMesh.position.y = -0.31;
    this.legR.add(legRMesh);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.46), shoeMat);
    belt.position.y = 0.76;
    this.body.add(belt);
    for (const leg of [this.legL, this.legR]) {
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.36), shoeMat);
      shoe.position.set(0, -0.6, 0.05);
      leg.add(shoe);
    }
    this.body.add(this.armL, this.armR, this.legL, this.legR);

    // Wolf form extras (hidden until Wolf Mode).
    this.wolf = new THREE.Group();
    this.wolf.visible = false;
    const hornMat = standard({ color: costume.wolf2, emissive: costume.wolf2, emissiveIntensity: 0.45, roughness: 0.4 });
    for (const sx of [-0.2, 0.2]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.36, 6), hornMat);
      horn.position.set(sx, 0.42, 0.02);
      horn.rotation.z = sx > 0 ? -0.28 : 0.28;
      this.wolf.add(horn);
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.26, 4), hornMat);
      ear.position.set(sx * 1.4, 0.3, -0.14);
      this.wolf.add(ear);
    }
    const capeMat = new THREE.MeshStandardMaterial({
      color: '#c9304a',
      roughness: 0.72,
      side: THREE.DoubleSide,
      emissive: '#7d1024',
      emissiveIntensity: 0.25,
    });
    // A tapered mantle, not a billboard: wide at the hem, narrow at the collar.
    const capeGeo = new THREE.BufferGeometry();
    capeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      -0.24, 1.46, -0.24,
      0.24, 1.46, -0.24,
      0.44, 0.62, -0.4,
      -0.44, 0.62, -0.4,
    ]), 3));
    capeGeo.setIndex([0, 1, 2, 0, 2, 3]);
    capeGeo.computeVertexNormals();
    this.cape = new THREE.Mesh(capeGeo, capeMat);
    this.cape.position.set(0, 0, 0);
    this.wolf.add(this.cape);
    this.head.add(this.wolf);

    // Player ring.
    if (isPlayer) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 8, 24), glow('#ffd166', 0.85));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      this.group.add(ring);
      this.ring = ring;
    }

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
    this.position = new THREE.Vector3(actor.x, actor.floor === 2 ? ARENA.deckY : 0, actor.z);
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
    const baseY = actor.frozenFloor ? (actor.frozenFloor === 2 ? ARENA.deckY : 0) : actor.floor === 2 ? ARENA.deckY : 0;
    const x = actor.state === 'frozen' ? actor.frozenX ?? actor.x : actor.x;
    const z = actor.state === 'frozen' ? actor.frozenZ ?? actor.z : actor.z;
    const y = actor.state === 'frozen' ? baseY : actor.y ?? baseY;
    this.group.position.x += (x - this.group.position.x) * Math.min(1, dt * 18);
    this.group.position.z += (z - this.group.position.z) * Math.min(1, dt * 18);
    this.group.position.y += (y - this.group.position.y) * Math.min(1, dt * 14);
    this.group.visible = !actor.out;

    const wolfOn = actor.wolfTimer > 0;
    this.wolf.visible = wolfOn;
    this.body.visible = !frozen;
    this.ice.visible = frozen && actor.state === 'frozen';

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
    this.group.rotation.y += delta * Math.min(1, dt * 12);

    const speed = actor.moving ? 1 : 0;
    this.phase += dt * (speed ? 9.2 : 2.2);
    const swing = speed ? Math.sin(this.phase) * 0.9 : Math.sin(this.phase) * 0.06;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.8;
    this.armR.rotation.x = swing * 0.8;
    const bob = speed ? Math.abs(Math.sin(this.phase)) * 0.09 : Math.sin(this.phase) * 0.012;
    this.body.position.y = bob;
    this.body.rotation.x = speed ? 0.14 : 0;
    this.body.rotation.z = speed ? Math.sin(this.phase) * 0.035 : 0;
    // Squash on the landing frame.
    const squash = speed ? 1 + Math.cos(this.phase * 2) * 0.035 : 1;
    this.body.scale.set(2 - squash, squash, 1);

    if (this.ring) {
      this.ring.rotation.z += dt * 1.2;
      this.ring.visible = actor.state === 'active';
    }

    // Snow / dust at the feet while running.
    if (speed && this.onPuff) {
      this.puffAt -= dt;
      if (this.puffAt <= 0) {
        this.puffAt = opts.cadence || 0.14;
        this.onPuff(this.group.position);
      }
    }
  }
}

export function costumeOf(stageId) {
  return COSTUMES[stageId] || COSTUMES.classic;
}
