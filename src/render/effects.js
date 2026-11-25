/**
 * Small particle system: snow puffs at the feet, ice shards on a freeze, a
 * green sparkle when a gate opens. One Points mesh for the whole round.
 */
import * as THREE from '../../vendor/three.module.js';

const MAX = 500;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    const geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(MAX * 3);
    this.colors = new Float32Array(MAX * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.vel = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);
    this.size = new Float32Array(MAX);
    const mat = new THREE.PointsMaterial({
      size: 0.19,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.cursor = 0;
  }

  spawn(x, y, z, color, count = 6, spread = 1.2, up = 1.6, life = 0.7) {
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i += 1) {
      const idx = this.cursor++ % MAX;
      this.positions[idx * 3] = x + (Math.random() - 0.5) * 0.3;
      this.positions[idx * 3 + 1] = y + Math.random() * 0.2;
      this.positions[idx * 3 + 2] = z + (Math.random() - 0.5) * 0.3;
      this.vel[idx * 3] = (Math.random() - 0.5) * spread;
      this.vel[idx * 3 + 1] = Math.random() * up;
      this.vel[idx * 3 + 2] = (Math.random() - 0.5) * spread;
      this.colors[idx * 3] = c.r;
      this.colors[idx * 3 + 1] = c.g;
      this.colors[idx * 3 + 2] = c.b;
      this.life[idx] = life * (0.7 + Math.random() * 0.6);
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  puff(pos) {
    this.spawn(pos.x, pos.y + 0.1, pos.z, '#ffffff', 4, 0.9, 0.9, 0.45);
  }

  freeze(pos) {
    this.spawn(pos.x, pos.y + 0.9, pos.z, '#bfefff', 22, 3.2, 2.4, 0.9);
  }

  rescue(pos) {
    this.spawn(pos.x, pos.y + 0.9, pos.z, '#ffe38a', 14, 2.2, 2.0, 0.7);
  }

  gate(pos) {
    this.spawn(pos.x, pos.y + 1.5, pos.z, '#7dffa0', 30, 4.0, 2.6, 1.1);
  }

  update(dt) {
    let any = false;
    for (let i = 0; i < MAX; i += 1) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= dt * 3.2;
      this.positions[i * 3] += this.vel[i * 3] * dt;
      this.positions[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.life[i] <= 0) this.positions[i * 3 + 1] = -50;
    }
    if (any) this.points.geometry.attributes.position.needsUpdate = true;
  }

  clear() {
    this.life.fill(0);
    for (let i = 0; i < MAX; i += 1) this.positions[i * 3 + 1] = -50;
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}
