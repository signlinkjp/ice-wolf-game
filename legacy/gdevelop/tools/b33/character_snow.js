/* v1.3.0 (Build 33) — the snow the feet throw.
 *
 * One Points mesh for the whole crowd: at most 160 grains, one draw call, and a
 * grain is only written while it is alive. Additive blending over a soft round
 * sprite (drawn once on a canvas) lets a grain fade by going black, so no shader
 * and no per-grain material is needed. A grain is world-space (x, y on the ice,
 * z up), thrown up and back from the feet, pulled down by its own weight and
 * stopped by the floor. Nothing here touches a game object.
 */
const snowSpray = (() => {
  if (!Three || typeof Three.Points !== 'function' || typeof document === 'undefined') return null;
  const MAX = 160;
  const positions = new Float32Array(MAX * 3);
  const colors = new Float32Array(MAX * 3);
  const grains = [];
  for (let i = 0; i < MAX; i += 1) {
    grains.push({ live: false, x: 0, y: 0, z: -9999, vx: 0, vy: 0, vz: 0, life: 0, max: 1 });
    positions[i * 3 + 2] = -9999;
  }
  let texture = null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext ? canvas.getContext('2d') : null;
    if (context) {
      const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, 'rgba(255,255,255,0.98)');
      gradient.addColorStop(0.4, 'rgba(232,248,255,0.62)');
      gradient.addColorStop(1, 'rgba(186,226,255,0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 32, 32);
      texture = new Three.Texture(canvas);
      texture.needsUpdate = true;
    }
  } catch (error) { texture = null; }
  const geometry = new Three.BufferGeometry();
  geometry.setAttribute('position', new Three.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Three.BufferAttribute(colors, 3));
  const material = new Three.PointsMaterial({
    size: 15, map: texture, vertexColors: true, transparent: true, opacity: 1,
    depthWrite: false, depthTest: true, sizeAttenuation: true, fog: false,
    blending: Three.AdditiveBlending
  });
  const points = new Three.Points(geometry, material);
  points.name = 'iceWolfV130Snow';
  points.frustumCulled = false;
  points.renderOrder = 7;
  const state = { mounted: false, cursor: 0, live: 0, clock: 0, emitted: 0 };
  const mount = () => {
    if (state.mounted) return true;
    try {
      const layer = runtimeScene.getLayer('');
      const renderer = layer && layer.getRenderer ? layer.getRenderer() : null;
      const scene = renderer && renderer.getThreeScene ? renderer.getThreeScene() : null;
      if (!scene) return false;
      scene.add(points);
      state.mounted = true;
      return true;
    } catch (error) { return false; }
  };
  const emit = (x, y, speed, frozen) => {
    if (!mount()) return 0;
    const count = frozen ? 5 : (speed > 250 ? 2 : 1);
    for (let n = 0; n < count; n += 1) {
      const grain = grains[state.cursor];
      state.cursor = (state.cursor + 1) % MAX;
      grain.live = true;
      grain.x = x + (Math.random() - 0.5) * 22;
      grain.y = y + (Math.random() - 0.5) * 18;
      grain.z = 3 + Math.random() * 6;
      grain.vx = (Math.random() - 0.5) * 46;
      grain.vy = (Math.random() - 0.5) * 46;
      grain.vz = frozen ? 40 + Math.random() * 40 : 24 + Math.random() * 30;
      grain.max = 0.32 + Math.random() * 0.24;
      grain.life = grain.max;
      state.emitted += 1;
    }
    return count;
  };
  const update = () => {
    if (!state.mounted) return 0;
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const last = state.clock || now;
    state.clock = now;
    const step = Math.max(0.006, Math.min(0.05, (now - last) / 1000));
    let live = 0;
    for (let i = 0; i < MAX; i += 1) {
      const grain = grains[i];
      const i3 = i * 3;
      if (!grain.live) {
        if (colors[i3] !== 0) { colors[i3] = 0; colors[i3 + 1] = 0; colors[i3 + 2] = 0; positions[i3 + 2] = -9999; }
        continue;
      }
      grain.life -= step;
      if (grain.life <= 0) {
        grain.live = false;
        colors[i3] = 0; colors[i3 + 1] = 0; colors[i3 + 2] = 0;
        positions[i3 + 2] = -9999;
        continue;
      }
      grain.vz -= 150 * step;
      grain.x += grain.vx * step;
      grain.y += grain.vy * step;
      grain.z += grain.vz * step;
      if (grain.z < 1.5) { grain.z = 1.5; grain.vz = 0; grain.vx *= 0.62; grain.vy *= 0.62; }
      const k = Math.max(0, grain.life / grain.max);
      positions[i3] = grain.x;
      positions[i3 + 1] = grain.y;
      positions[i3 + 2] = grain.z;
      colors[i3] = 0.60 * k;
      colors[i3 + 1] = 0.80 * k;
      colors[i3 + 2] = 1.00 * k;
      live += 1;
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    state.live = live;
    return live;
  };
  return { points: points, emit: emit, update: update, state: state };
})();
