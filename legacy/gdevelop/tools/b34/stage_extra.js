/* ICE WOLF v1.2.0 Build 34 — the air, the light and the snow on the walls.
 *
 * Build 33 gave every stage a light rig and a backdrop, but the first device
 * recording of it still read as a flat, pale room: the camera looks down at the
 * arena, so most of what a player sees of a wall is its top face, and a top face
 * lit at 1.7x is a white slab. Build 34 answers that in three ways.
 *
 *   1. THE LIGHT IS TUNED DOWN. The rig used to add nearly two whole lights on
 *      top of the two the scene already had (about 2.8 in total), which pushed
 *      every texture to white. It now adds a colour bounce and a shape light
 *      that together leave the room bright but not blown out
 *      (about 1.6-2.0 depending on the stage), so the bricks, the snow and the
 *      floor all keep their own colour.
 *
 *   2. EVERY WALL WEARS A SNOW CAP. A thin, slightly overhanging slab of snow
 *      sits on top of each wall, with the wall's own footprint. It gives a wall
 *      a real silhouette from above (an edge, an overhang and a shadow under
 *      it) instead of a printed top face - the single biggest change to how the
 *      stage reads, and it is one merged mesh for the whole stage.
 *
 *   3. THE ROOM HAS WEATHER. One Points mesh per stage carries the air: snow
 *      over the ice arena, bubbles in the tank, petals at the fair, embers in
 *      the lodge, dust in the school and stars on the ship. A grain is written
 *      only while it is alive, so the whole weather is one draw call.
 *
 * Everything here is decoration. It never moves, resizes, hides or re-colours a
 * collision object, never adds a collider, and never reads or writes a rule.
 */
const ICE_WOLF_STAGE_LIGHT = {
  classic: { sky: 0xd8f4ff, ground: 0x2a5f88, hemi: 0.18, key: 0xfff2dc, keyIntensity: 0.28, dir: [0.3, -0.45, 0.9], rim: 0x8fe0ff, rimIntensity: 0.15 },
  aquarium: { sky: 0xa8f0ff, ground: 0x0d3b52, hemi: 0.16, key: 0xc8f6ff, keyIntensity: 0.24, dir: [0.2, -0.35, 0.95], rim: 0x6fe8ff, rimIntensity: 0.14 },
  park: { sky: 0xffd8f0, ground: 0x3a2a52, hemi: 0.18, key: 0xffe0b0, keyIntensity: 0.26, dir: [0.35, -0.4, 0.85], rim: 0xffa8d8, rimIntensity: 0.15 },
  lodge: { sky: 0xffd9a8, ground: 0x33200f, hemi: 0.16, key: 0xffc987, keyIntensity: 0.30, dir: [0.3, -0.5, 0.8], rim: 0xffa04a, rimIntensity: 0.17 },
  school: { sky: 0xdff6ff, ground: 0x24382a, hemi: 0.18, key: 0xf2fff4, keyIntensity: 0.24, dir: [0.25, -0.4, 0.9], rim: 0xb8f0d0, rimIntensity: 0.12 },
  space: { sky: 0x9fdcff, ground: 0x0a1524, hemi: 0.14, key: 0xa8ecff, keyIntensity: 0.22, dir: [0.2, -0.3, 0.95], rim: 0x6fe0ff, rimIntensity: 0.18 }
};

/* The snow that sits on top of a wall, per stage: colour of the slab and the
 * colour of its shaded edge. */
const ICE_WOLF_STAGE_CAP = {
  classic: { top: 0xffffff, side: 0x9fc4dc, lip: 0xd6ecfa, edge: 0x8fb2cc },
  aquarium: { top: 0xffffff, side: 0xa8dcea, lip: 0xdaf6ff, edge: 0x8fc8dc },
  park: { top: 0xffffff, side: 0xdcc0a0, lip: 0xfff0d8, edge: 0xe8c49a },
  lodge: { top: 0xffffff, side: 0xd0aa80, lip: 0xfff4e2, edge: 0xd8b48c },
  school: { top: 0xffffff, side: 0xbcd8c4, lip: 0xeafaf0, edge: 0xc4e0cc },
  space: { top: 0xe8f8ff, edge: 0xa8c8dc }
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
    /* Build 34: the goal end - a lit arch over the far side of the rink */
    for (const side of [-1, 1]) {
      const y = cy + side * 690;
      for (const sx of [-1, 1]) {
        parts.push(['cyl', [10, 13, 210, 8], [cx + sx * 190, y, 105], 0x7fd8ff, 0]);
      }
      parts.push(['box', [400, 14, 16], [cx, y, 214], 0x9fe8ff, 1]);
      parts.push(['box', [330, 6, 8], [cx, y, 224], 0xeaffff, 1]);
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
    geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(bucket.normal), 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(bucket.color, 3));
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

/* ------------------------------------------------------------- Build 34: caps
 * The snow that sits on a wall. One merged mesh for the whole stage: a slab the
 * wall's own footprint plus a small overhang, 12px thick, with a shaded skirt
 * hanging 5px down the outside. Seen from above (how this game is played) that
 * edge is what turns a printed top face into a block of ice.
 */
const capRig = () => (artState.caps || (artState.caps = { stage: '', mesh: null, count: 0 }));

const clearCaps = () => {
  const rig = capRig();
  if (rig.mesh) {
    try { if (rig.mesh.parent) rig.mesh.parent.remove(rig.mesh); } catch (error) { /* already gone */ }
    try { if (rig.mesh.geometry) rig.mesh.geometry.dispose(); } catch (error) { /* shared */ }
  }
  rig.mesh = null;
  rig.stage = '';
  rig.count = 0;
};

const buildCaps = (stageId) => {
  const renderer = layerRenderer();
  const scene = renderer && typeof renderer.getThreeScene === 'function' ? renderer.getThreeScene() : null;
  if (!scene || !Three || typeof Three.Mesh !== 'function') return 0;
  const palette = ICE_WOLF_STAGE_CAP[stageId] || ICE_WOLF_STAGE_CAP.classic;
  const top = new Three.Color(palette.top);
  const edge = new Three.Color(palette.edge);
  const side = new Three.Color(palette.side || palette.edge);
  const positions = [];
  const normals = [];
  const colors = [];
  const addBox = (w, h, d, x, y, z, topColour, sideColour) => {
    let geometry = null;
    try {
      geometry = new Three.BoxGeometry(w, h, d);
      geometry.translate(x, y, z);
      const flat = geometry.toNonIndexed();
      const position = flat.attributes.position.array;
      const normal = flat.attributes.normal.array;
      for (let i = 0; i < position.length; i += 1) { positions.push(position[i]); normals.push(normal[i]); }
      for (let i = 0; i < position.length; i += 3) {
        /* the faces are shaded into the vertex colours: the top of the slab is
         * snow, its sides are older snow in the block's shadow. Baking it keeps
         * the caps the same on every phone, whatever the room's lights do. */
        const colour = normal[i + 2] > 0.5 ? topColour : sideColour;
        colors.push(colour.r, colour.g, colour.b);
      }
      if (flat !== geometry) flat.dispose();
    } catch (error) {
      /* one wall without a cap must not lose the stage */
    } finally {
      if (geometry && geometry.dispose) geometry.dispose();
    }
  };
  let count = 0;
  for (const wall of objects('Wall')) {
    let x, y, z, w, h, d;
    try {
      if (wall.getY() > 10000) continue;
      w = wall.getWidth(); h = wall.getHeight(); d = wall.getDepth();
      if (!(w > 0) || !(h > 0) || !(d > 0)) continue;
      /* A 3D object's X and Y are its corner and its Z is its base (the prop
       * placements above read them the same way), so the top of a wall is
       * z + depth and its centre is x + w/2, y + h/2. */
      x = wall.getX() + w / 2;
      y = wall.getY() + h / 2;
      z = typeof wall.getZ === 'function' ? wall.getZ() : 0;
    } catch (error) { continue; }
    const topZ = z + d;
    /* the snow lies over the wall's own footprint: one slab, its top a snow
     * surface and its 14px sides the older, greyer snow underneath. Nothing
     * overhangs, so a wall never grows a flap - the slab's own sides are the
     * edge that reads as thickness from above. */
    addBox(w, h, 14, x, y, topZ + 6, top, side);
    count += 1;
  }
  if (!positions.length) return 0;
  const rig = capRig();
  clearCaps();
  try {
    const geometry = new Three.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();
    /* The snow on a cap is the stage's own cap picture, so the slab carries the
     * drifts and sparkle of the wall top it covers instead of one flat colour.
     * The picture is already in the browser's cache (the wall's top face uses
     * it); a phone that cannot load it keeps the flat vertex colours. */
    const material = new Three.MeshBasicMaterial({ vertexColors: true, fog: false });
    try {
      const art = ICE_WOLF_STAGE_ART[stageId];
      const file = art && art.cap;
      const game = runtimeScene.getGame();
      const base = game && typeof game.getAssetPath === 'function' ? (game.getAssetPath() || '') : '';
      if (file && Three.TextureLoader) {
        const loader = new Three.TextureLoader();
        const accept = (texture) => {
          if (!texture) return;
          if (Three.SRGBColorSpace !== undefined) texture.colorSpace = Three.SRGBColorSpace;
          texture.wrapS = Three.ClampToEdgeWrapping;
          texture.wrapT = Three.ClampToEdgeWrapping;
          material.map = texture;
          material.needsUpdate = true;
        };
        loader.load(base + file, accept, undefined, () => {});
      }
    } catch (error) { /* the flat colours are the fallback */ }
    const mesh = new Three.Mesh(geometry, material);
    mesh.name = 'iceWolfV120WallCaps';
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    scene.add(mesh);
    rig.mesh = mesh;
    rig.stage = stageId;
    rig.count = count;
  } catch (error) {
    return 0;
  }
  return count;
};

/* The light rig: a colour bounce, the shape light, and a cool rim from behind.
 * Build 34 lowers the first two: Build 33 added almost two whole lights on top
 * of the two the scene already carries and every surface went white. */
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
      const rim = new THREE.DirectionalLight(config.rim, config.rimIntensity);
      rim.name = 'iceWolfV130Rim';
      rim.position.set(-config.dir[0] * 1200, -config.dir[1] * 1200, 900);
      scene.add(hemi);
      scene.add(key);
      scene.add(rim);
      artState.lights = rig = { hemi: hemi, key: key, rim: rim, stage: '' };
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
      if (rig.rim) {
        rig.rim.color.setHex(config.rim);
        rig.rim.intensity = config.rimIntensity;
        rig.rim.position.set(-config.dir[0] * 1200, -config.dir[1] * 1200, 900);
      }
    } catch (error) { /* the lights keep their last colour */ }
  }
  return rig.rim ? 3 : 2;
};

/* --------------------------------------------------------- Build 34: weather
 * The air of each stage, as one Points mesh: snow over the rink, bubbles in the
 * tank, petals at the fair, embers in the lodge, dust in the school corridors
 * and stars around the ship. A grain is alive only while its life is running,
 * and a dead grain is parked far below the ice, so the cost is one draw call
 * and a few hundred float writes per frame.
 */
const ICE_WOLF_STAGE_WEATHER = {
  classic: { count: 300, colour: [0.92, 0.98, 1.0], size: 9, rise: -34, drift: 26, life: [3.0, 6.0], fall: true },
  aquarium: { count: 180, colour: [0.72, 0.94, 1.0], size: 11, rise: 46, drift: 16, life: [2.4, 4.6], fall: false },
  park: { count: 160, colour: [1.0, 0.86, 0.72], size: 10, rise: -22, drift: 34, life: [3.4, 6.4], fall: true },
  lodge: { count: 150, colour: [1.0, 0.74, 0.38], size: 8, rise: 30, drift: 18, life: [2.0, 4.0], fall: false },
  school: { count: 140, colour: [0.94, 0.98, 1.0], size: 7, rise: -8, drift: 20, life: [3.0, 5.0], fall: true },
  space: { count: 220, colour: [0.82, 0.94, 1.0], size: 7, rise: 0, drift: 26, life: [2.6, 5.6], fall: false }
};

const weatherRig = () => (artState.weather || (artState.weather = {
  stage: '', points: null, grains: [], position: null, colour: null, clock: 0, mounted: false
}));

const clearWeather = () => {
  const rig = weatherRig();
  if (rig.points) {
    try { if (rig.points.parent) rig.points.parent.remove(rig.points); } catch (error) { /* already gone */ }
    try { if (rig.points.geometry) rig.points.geometry.dispose(); } catch (error) { /* shared */ }
  }
  rig.points = null;
  rig.stage = '';
  rig.grains = [];
  rig.mounted = false;
};

const buildWeather = (stageId) => {
  const renderer = layerRenderer();
  const scene = renderer && typeof renderer.getThreeScene === 'function' ? renderer.getThreeScene() : null;
  const config = ICE_WOLF_STAGE_WEATHER[stageId];
  if (!scene || !Three || !config || typeof Three.Points !== 'function') return 0;
  clearWeather();
  const rig = weatherRig();
  const count = config.count;
  const positions = new Float32Array(count * 3);
  const colours = new Float32Array(count * 3);
  const grains = [];
  for (let i = 0; i < count; i += 1) {
    grains.push({ live: false, x: 0, y: 0, z: -9999, vz: 0, vx: 0, vy: 0, life: 0, max: 1 });
    positions[i * 3 + 2] = -9999;
  }
  let texture = null;
  try {
    if (typeof document !== 'undefined' && document.createElement) {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const context = canvas.getContext ? canvas.getContext('2d') : null;
      if (context) {
        const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
        gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
        gradient.addColorStop(0.45, 'rgba(236,250,255,0.45)');
        gradient.addColorStop(1, 'rgba(200,235,255,0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, 32, 32);
        texture = new Three.Texture(canvas);
        texture.needsUpdate = true;
      }
    }
  } catch (error) { texture = null; }
  try {
    const geometry = new Three.BufferGeometry();
    geometry.setAttribute('position', new Three.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new Three.BufferAttribute(colours, 3));
    const material = new Three.PointsMaterial({
      size: config.size, map: texture, vertexColors: true, transparent: true, opacity: 0.95,
      depthWrite: false, sizeAttenuation: true, fog: false, blending: Three.AdditiveBlending
    });
    const points = new Three.Points(geometry, material);
    points.name = 'iceWolfV120Weather';
    points.frustumCulled = false;
    points.renderOrder = 8;
    scene.add(points);
    rig.points = points;
    rig.stage = stageId;
    rig.grains = grains;
    rig.position = positions;
    rig.colour = colours;
    rig.config = config;
    rig.clock = 0;
    rig.mounted = true;
  } catch (error) {
    return 0;
  }
  return count;
};

const stepWeather = () => {
  const rig = weatherRig();
  if (!rig.mounted || !rig.points || !rig.position || !rig.config) return 0;
  const config = rig.config;
  const ring = arenaRing();
  if (!ring) return 0;
  const now = clockSeconds();
  const last = rig.clock || now;
  rig.clock = now;
  const step = Math.max(0.004, Math.min(0.05, now - last));
  const x0 = ring.left;
  const x1 = ring.right;
  const y0 = ring.top;
  const y1 = ring.bottom;
  let live = 0;
  for (let i = 0; i < rig.grains.length; i += 1) {
    const grain = rig.grains[i];
    const i3 = i * 3;
    if (!grain.live) {
      /* respawn a share of the dead grains each frame: a steady room, not a
       * burst on the first frame */
      if (Math.random() > 0.02) { rig.position[i3 + 2] = -9999; continue; }
      grain.live = true;
      grain.x = x0 + Math.random() * (x1 - x0);
      grain.y = y0 + Math.random() * (y1 - y0);
      grain.z = config.fall ? 300 + Math.random() * 220 : 10 + Math.random() * 60;
      grain.vz = config.rise * (0.7 + Math.random() * 0.6);
      grain.vx = (Math.random() - 0.5) * config.drift;
      grain.vy = (Math.random() - 0.5) * config.drift;
      grain.max = config.life[0] + Math.random() * (config.life[1] - config.life[0]);
      grain.life = grain.max;
    }
    grain.life -= step;
    if (grain.life <= 0) {
      grain.live = false;
      rig.position[i3 + 2] = -9999;
      continue;
    }
    grain.x += grain.vx * step;
    grain.y += grain.vy * step;
    grain.z += grain.vz * step;
    if (config.fall && grain.z < 2) { grain.live = false; rig.position[i3 + 2] = -9999; continue; }
    if (!config.fall && grain.z > 340) { grain.live = false; rig.position[i3 + 2] = -9999; continue; }
    rig.position[i3] = grain.x;
    rig.position[i3 + 1] = grain.y;
    rig.position[i3 + 2] = grain.z;
    const k = Math.max(0, Math.min(1, grain.life / grain.max));
    const fade = Math.min(1, k * 2.2) * 0.85;
    rig.colour[i3] = config.colour[0] * fade;
    rig.colour[i3 + 1] = config.colour[1] * fade;
    rig.colour[i3 + 2] = config.colour[2] * fade;
    live += 1;
  }
  rig.points.geometry.attributes.position.needsUpdate = true;
  rig.points.geometry.attributes.color.needsUpdate = true;
  vars.get('StageWeather').setNumber(live);
  return live;
};

const applyBackdrop = () => {
  const stageId = vars.get('StageApplied').getAsString() || 'classic';
  const rig = backdropRig();
  if (rig.stage !== stageId) {
    clearBackdrop();
    buildBackdrop(stageId);
    clearCaps();
    buildCaps(stageId);
    buildWeather(stageId);
  }
  const lights = applyLights(stageId);
  stepWeather();
  vars.get('StageCeiling').setString(rig.stage || '');
  vars.get('StageLights').setNumber(lights);
  vars.get('StageProps').setNumber(rig.parts);
  vars.get('StageWallCaps').setNumber(capRig().count);
};
applyBackdrop();
