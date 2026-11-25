/* ICE WOLF v1.2.0 Build 33 — the air above the arena, and the light on it.
 *
 * The play-test's fourth point: "the stage, the whole look, the gimmicks and the
 * action should all beat DOROKEI and KACHI-KACHI CATCH". The walls and floors
 * were already per-stage; what was still missing was above and around them -
 * the room's own air. This block gives each stage
 *
 *   1. a light rig of its own (one hemisphere light for the colour of the room
 *      and one key light for the shape of the bricks and the props), so a wall
 *      is not a black slab any more but ice, water, wood, plaster or steel;
 *   2. a backdrop of its own: the aurora and the icicle fringe of the ice
 *      arena, the shimmer and the rising bubbles of the tank, the festoon and
 *      the star of the fair, the beams and the hanging lanterns of the lodge,
 *      the strip lights and the clock of the school, the conduits and the star
 *      field of the ship. It stands above the border walls, outside the play
 *      floor, so it never hides a toy and never stands in a lane.
 *
 * Everything here is two merged, vertex-coloured meshes (one lit, one glowing)
 * plus two lights: about four draw calls for the whole dressing of a stage. It
 * is built when the stage is painted, rebuilt when the stage changes, and never
 * touches a game object, a collider or a rule.
 */
const ICE_WOLF_STAGE_LIGHT = {
  classic: { sky: 0xd8f4ff, ground: 0x2f6f9e, hemi: 0.95, key: 0xfff6e2, keyIntensity: 0.75, dir: [0.3, -0.45, 0.9] },
  aquarium: { sky: 0xa8f0ff, ground: 0x0d3b52, hemi: 0.85, key: 0xc8f6ff, keyIntensity: 0.55, dir: [0.2, -0.35, 0.95] },
  park: { sky: 0xffd8f0, ground: 0x3a2a52, hemi: 0.8, key: 0xffe0b0, keyIntensity: 0.6, dir: [0.35, -0.4, 0.85] },
  lodge: { sky: 0xffd9a8, ground: 0x33200f, hemi: 0.75, key: 0xffc987, keyIntensity: 0.65, dir: [0.3, -0.5, 0.8] },
  school: { sky: 0xdff6ff, ground: 0x24382a, hemi: 0.9, key: 0xf2fff4, keyIntensity: 0.6, dir: [0.25, -0.4, 0.9] },
  space: { sky: 0x9fdcff, ground: 0x0a1524, hemi: 0.7, key: 0xa8ecff, keyIntensity: 0.5, dir: [0.2, -0.3, 0.95] }
};

/* One backdrop per stage. `cx, cy` is the centre of the floor being dressed, so
 * the same recipe dresses 1F and 2F. A part is [shape, size, at, colour, glow]
 * with `at` absolute in world pixels and z measured from the ice. */
const ICE_WOLF_STAGE_BACKDROP = {
  classic: (cx, cy) => {
    const parts = [];
    const ribbons = [0x6ef6d8, 0x8fd0ff, 0xb59cff];
    for (let band = 0; band < 3; band += 1) {
      const colour = ribbons[band];
      for (const side of [-1, 1]) {
        const y = cy + side * 742;
        const z = 236 + band * 34;
        parts.push(['box', [1240, 10, 22], [cx + (band - 1) * 40, y, z], colour, 1]);
        for (let i = 0; i < 6; i += 1) {
          const x = cx - 520 + i * 208 + band * 30;
          parts.push(['box', [12, 8, 96 + band * 18], [x, y, z - 62], colour, 1]);
        }
      }
    }
    /* the icicle fringe hanging off the outer face of the border walls */
    for (let i = 0; i < 26; i += 1) {
      const x = cx - 660 + i * 53;
      for (const side of [-1, 1]) {
        const y = cy + side * 726;
        const drop = 18 + ((i * 37) % 46);
        parts.push(['cyl', [0.5, 7, drop, 6], [x, y, 150 - drop / 2], 0xd8f6ff, 0]);
      }
    }
    /* four corner towers of ice */
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        parts.push(['cyl', [2, 26, 150, 6], [cx + sx * 690, cy + sy * 690, 235], 0x9fe6ff, 1]);
        parts.push(['cyl', [1, 12, 90, 6], [cx + sx * 690, cy + sy * 690, 340], 0xd8f8ff, 1]);
      }
    }
    return parts;
  },
  aquarium: (cx, cy) => {
    const parts = [];
    for (const side of [-1, 1]) {
      const y = cy + side * 742;
      parts.push(['box', [1300, 8, 18], [cx, y, 262], 0x7fe8ff, 1]);
      parts.push(['box', [1300, 4, 10], [cx, y, 214], 0x3fa8d0, 0]);
      for (let i = 0; i < 12; i += 1) {
        const x = cx - 600 + i * 110;
        const lift = 226 + ((i * 53) % 90);
        parts.push(['box', [8, 8, 8], [x, y + side * 6, lift], 0xd8fcff, 1]);
        parts.push(['box', [5, 5, 5], [x + 18, y + side * 10, lift + 26], 0xa8f0ff, 1]);
      }
    }
    for (const sx of [-1, 1]) {
      parts.push(['box', [16, 700, 150], [cx + sx * 706, cy, 250], 0x2fb6e0, 1]);
    }
    return parts;
  },
  park: (cx, cy) => {
    const parts = [];
    const bulbs = [0xffd166, 0xff8fb1, 0x8fe3ff, 0xa8ffb0];
    for (const side of [-1, 1]) {
      const y = cy + side * 742;
      parts.push(['box', [1300, 6, 6], [cx, y, 246], 0x4a3a66, 0]);
      for (let i = 0; i < 16; i += 1) {
        const x = cx - 620 + i * 82;
        parts.push(['box', [12, 12, 12], [x, y, 244], bulbs[i % bulbs.length], 1]);
      }
    }
    parts.push(['torus', [64, 8, 18], [cx, cy - 742, 300], 0xffe08a, 1]);
    parts.push(['box', [18, 18, 18], [cx, cy - 742, 300], 0xfff3c8, 1]);
    return parts;
  },
  lodge: (cx, cy) => {
    const parts = [];
    for (let beam = 0; beam < 4; beam += 1) {
      const y = cy - 520 + beam * 340;
      parts.push(['box', [1300, 24, 26], [cx, y, 268], 0x4a2f1a, 0]);
      parts.push(['box', [1300, 8, 8], [cx, y, 252], 0x6b4528, 0]);
    }
    for (const side of [-1, 1]) {
      const y = cy + side * 742;
      for (let i = 0; i < 7; i += 1) {
        const x = cx - 560 + i * 190;
        parts.push(['box', [3, 3, 46], [x, y, 216], 0x2a1c10, 0]);
        parts.push(['box', [18, 18, 22], [x, y, 186], 0xffcf8a, 1]);
      }
    }
    return parts;
  },
  school: (cx, cy) => {
    const parts = [];
    for (const side of [-1, 1]) {
      const y = cy + side * 742;
      for (const offset of [-420, 0, 420]) {
        parts.push(['box', [300, 12, 8], [cx + offset, y, 258], 0xeafcff, 1]);
        parts.push(['box', [300, 6, 6], [cx + offset, y, 250], 0x8fb6c4, 0]);
      }
    }
    parts.push(['torus', [46, 7, 16], [cx, cy - 742, 286], 0xe8f6ff, 1]);
    parts.push(['box', [6, 4, 26], [cx, cy - 742, 278], 0x2b4a5c, 1]);
    parts.push(['box', [20, 4, 6], [cx, cy - 742, 292], 0x2b4a5c, 1]);
    return parts;
  },
  space: (cx, cy) => {
    const parts = [];
    for (const side of [-1, 1]) {
      const y = cy + side * 742;
      parts.push(['box', [1300, 16, 16], [cx, y, 232], 0x3a5470, 0]);
      parts.push(['box', [1240, 5, 5], [cx, y, 240], 0x8fdcff, 1]);
      for (let i = 0; i < 14; i += 1) {
        const x = cx - 620 + i * 96;
        parts.push(['box', [4, 4, 4], [x, y + side * 8, 262 + ((i * 41) % 70)], 0xf0fbff, 1]);
      }
    }
    for (let i = 0; i < 26; i += 1) {
      const x = cx - 640 + ((i * 137) % 1280);
      const y = cy - 600 + ((i * 211) % 1200);
      parts.push(['box', [3, 3, 3], [x, y, 280 + ((i * 61) % 90)], 0xd8f4ff, 1]);
    }
    parts.push(['torus', [120, 6, 22], [cx, cy, 300], 0x6fe0ff, 1]);
    parts.push(['torus', [86, 4, 22], [cx, cy, 300], 0x9ff0ff, 1]);
    return parts;
  }
};

const backdropRig = () => (artState.backdrop || (artState.backdrop = {
  stage: '', solid: null, glow: null, geometry: null, geometryGlow: null, parts: 0
}));

const clearBackdrop = () => {
  const rig = backdropRig();
  for (const mesh of [rig.solid, rig.glow]) {
    if (!mesh) continue;
    try { if (mesh.parent) mesh.parent.remove(mesh); } catch (error) { /* already gone */ }
    try { if (mesh.geometry) mesh.geometry.dispose(); } catch (error) { /* shared */ }
  }
  rig.solid = null;
  rig.glow = null;
  rig.stage = '';
  rig.parts = 0;
};

const buildBackdrop = (stageId) => {
  const renderer = layerRenderer();
  const scene = renderer && typeof renderer.getThreeScene === 'function' ? renderer.getThreeScene() : null;
  const recipe = ICE_WOLF_STAGE_BACKDROP[stageId];
  if (!scene || !Three || !recipe || typeof Three.Mesh !== 'function') return 0;
  const solid = { position: [], normal: [], color: [] };
  const glow = { position: [], normal: [], color: [] };
  const tint = new Three.Color(0xffffff);
  const centre = new THREE.Matrix4();
  let parts = 0;
  const push = (bucket, geometry, colour) => {
    const flat = typeof geometry.toNonIndexed === 'function' ? geometry.toNonIndexed() : geometry;
    try {
      const position = flat.attributes.position.array;
      const normal = flat.attributes.normal.array;
      tint.setHex(colour);
      for (let i = 0; i < position.length; i += 1) {
        bucket.position.push(position[i]);
        bucket.normal.push(normal[i]);
      }
      for (let i = 0; i < position.length; i += 3) bucket.color.push(tint.r, tint.g, tint.b);
      parts += 1;
    } finally {
      if (flat !== geometry && typeof flat.dispose === 'function') flat.dispose();
    }
  };
  for (const [cx, cy] of [[-8, -8], [1592, -8]]) {
    for (const part of recipe(cx, cy)) {
      let geometry = null;
      try {
        const shape = part[0];
        const size = part[1];
        if (shape === 'cyl') geometry = new Three.CylinderGeometry(size[0], size[1], size[2], size[3] || 8);
        else if (shape === 'torus') geometry = new Three.TorusGeometry(size[0], size[1], 6, size[2] || 14);
        else geometry = new Three.BoxGeometry(size[0], size[1], size[2]);
        if (shape === 'cyl') geometry.rotateX(Math.PI / 2);
        centre.identity();
        centre.setPosition(part[2][0], part[2][1], part[2][2]);
        geometry.applyMatrix4(centre);
        push(part[4] ? glow : solid, geometry, part[3]);
      } catch (error) {
        /* one bad part must not lose the room */
      } finally {
        if (geometry && typeof geometry.dispose === 'function') geometry.dispose();
      }
    }
  }
  const rig = backdropRig();
  const build = (bucket, material) => {
    if (!bucket.position.length) return null;
    const geometry = new Three.BufferGeometry();
    geometry.setAttribute('position', new Three.BufferAttribute(new Float32Array(bucket.position), 3));
    geometry.setAttribute('normal', new Three.BufferAttribute(new Float32Array(bucket.normal), 3));
    geometry.setAttribute('color', new Three.Float32BufferAttribute(bucket.color, 3));
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'iceWolfV130Backdrop';
    scene.add(mesh);
    return mesh;
  };
  try {
    rig.solid = build(solid, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.05 }));
    rig.glow = build(glow, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
    rig.stage = stageId;
    rig.parts = parts;
  } catch (error) {
    clearBackdrop();
    return 0;
  }
  return parts;
};

/* The light rig: one hemisphere for the colour of the room, one key for shape. */
const applyLights = (stageId) => {
  const renderer = layerRenderer();
  const scene = renderer && typeof renderer.getThreeScene === 'function' ? renderer.getThreeScene() : null;
  if (!scene || !Three) return 0;
  const config = ICE_WOLF_STAGE_LIGHT[stageId] || ICE_WOLF_STAGE_LIGHT.classic;
  let rig = artState.lights;
  if (!rig) {
    try {
      const hemi = new THREE.HemisphereLight(config.sky, config.ground, config.hemi);
      hemi.name = 'iceWolfV130Hemi';
      const key = new THREE.DirectionalLight(config.key, config.keyIntensity);
      key.name = 'iceWolfV130Key';
      scene.add(hemi);
      scene.add(key);
      artState.lights = rig = { hemi: hemi, key: key, stage: '' };
    } catch (error) { return 0; }
  }
  if (rig.stage !== stageId) {
    rig.stage = stageId;
    try {
      rig.hemi.color.setHex(config.sky);
      rig.hemi.groundColor.setHex(config.ground);
      rig.hemi.intensity = config.hemi;
      rig.key.color.setHex(config.key);
      rig.key.intensity = config.keyIntensity;
      rig.key.position.set(config.dir[0] * 1200, config.dir[1] * 1200, config.dir[2] * 1200);
    } catch (error) { /* the lights keep their last colour */ }
  }
  return 2;
};

const applyBackdrop = () => {
  const stageId = vars.get('StageApplied').getAsString() || 'classic';
  const rig = backdropRig();
  if (rig.stage !== stageId) {
    clearBackdrop();
    buildBackdrop(stageId);
  }
  const lights = applyLights(stageId);
  vars.get('StageCeiling').setString(rig.stage || '');
  vars.get('StageLights').setNumber(lights);
  vars.get('StageProps').setNumber(rig.parts);
};
applyBackdrop();
