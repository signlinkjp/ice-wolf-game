/* ICE WOLF v1.2.0 Build 33 — the action layer: what a gimmick looks like when
 * it fires.
 *
 * The play-test asked for the switch, the pads, the ice, the rescue, the gate
 * and the wolf mode to *feel* like something, the way they do in DOROKEI and
 * KACHI-KACHI CATCH. Nothing in this block rules anything: it reads the state
 * the game already keeps (the switch count, the gate flag, the wolf timer, the
 * speed timer, a body's State) and draws a short effect for the frame the state
 * changes, plus a DOM flash round the edge of the screen for the same beat.
 *
 *   switch fires   a column of light over the pad, an energy ripple along the
 *                  ice, and one golden flash round the screen
 *   pad entered    a rotating ring standing over every speed and warp pad, and
 *                  a dashed trail behind a body while the speed floor carries it
 *   body freezes   a burst of ice crystals
 *   body rescued   a rescue ring that flashes out and fades
 *   gate opens     two light columns at the gate, alarm lights circling them
 *   wolf mode      a red aura ring under the wolf and one shockwave out of it
 *
 * Everything is additive, unlit, depth-write-free geometry (or a pointer-none
 * div) built once, pooled, and hidden again; the whole layer is a handful of
 * draw calls while a beat is running and nothing while it is not. It never
 * creates, moves, hides or collides a game object, and it never writes a rule,
 * a timer or a role.
 */
const vars = runtimeScene.getVariables();
const Three = (typeof THREE !== 'undefined' && THREE) ? THREE : null;
const phaseNow = vars.get('RoundPhase').getAsString();
const testMode = runtimeScene.__iceWolfV065TestMode === true;
const playing = (phaseNow === 'Active' || testMode) && vars.get('GameOver').getAsBoolean() !== true;
const stageNow = vars.get('StageApplied').getAsString() || vars.get('StageId').getAsString() || 'classic';

/* The accent of each stage, so a switch in the lodge does not glow aquarium
 * blue. `classic` is the ice itself. */
const ICE_WOLF_FX_ACCENTS = {
  classic: 0x8fe9ff, aquarium: 0x5fe8ff, park: 0xffc46a,
  lodge: 0xffb066, school: 0x9cf0b8, space: 0x8fdcff
};
const accentNow = () => ICE_WOLF_FX_ACCENTS[stageNow] || ICE_WOLF_FX_ACCENTS.classic;

const fx = runtimeScene.__iceWolfV130Fx || (runtimeScene.__iceWolfV130Fx = {
  scene: null, tried: 0, pillars: [], rings: [], shards: [], padRings: [], trails: [], aura: null,
  seen: { switches: null, gate: null, wolf: null, speed: null, warp: null, rescue: null, frozen: null },
  counts: { pillars: 0, rings: 0, shards: 0, flashes: 0 }, flashes: 0, glow: ''
});

const fxClock = (() => {
  try { return gdjs.evtTools.runtimeScene.getElapsedTimeInSeconds(runtimeScene); } catch (error) { return 0; }
})();

/* ------------------------------------------------------------------ the scene */
const fxScene = () => {
  if (fx.scene) return fx.scene;
  if (fx.tried > 0 && fx.tried % 30 !== 0) { fx.tried += 1; return null; }
  fx.tried += 1;
  try {
    const layer = runtimeScene.getLayer('');
    const renderer = layer && typeof layer.getRenderer === 'function' ? layer.getRenderer() : null;
    const scene = renderer && typeof renderer.getThreeScene === 'function' ? renderer.getThreeScene() : null;
    if (scene) fx.scene = scene;
    return scene || null;
  } catch (error) { return null; }
};

const pillarGeometry = (() => {
  if (!Three || typeof Three.CylinderGeometry !== 'function') return null;
  const geometry = new Three.CylinderGeometry(1, 1, 1, 16, 1, true);
  geometry.translate(0, 0, 0.5);
  return geometry;
})();
const ringGeometry = (() => {
  if (!Three || typeof Three.TorusGeometry !== 'function') return null;
  return new Three.TorusGeometry(1, 0.045, 6, 40);
})();
const shardGeometry = (() => {
  if (!Three || typeof Three.BoxGeometry !== 'function') return null;
  return new Three.BoxGeometry(1, 1, 1);
})();

const fxMaterial = (colour, opacity) => {
  if (!Three || typeof Three.MeshBasicMaterial !== 'function') return null;
  return new Three.MeshBasicMaterial({
    color: colour, transparent: true, opacity: opacity,
    depthWrite: false, blending: Three.AdditiveBlending,
    side: Three.DoubleSide, fog: false, toneMapped: false
  });
};

const takePillar = () => {
  for (const item of fx.pillars) if (!item.live) return item;
  const scene = fxScene();
  if (!scene || !pillarGeometry) return null;
  try {
    const material = fxMaterial(accentNow(), 0.7);
    if (!material) return null;
    const mesh = new Three.Mesh(pillarGeometry, material);
    mesh.name = 'iceWolfV130Pillar';
    mesh.renderOrder = 9;
    mesh.visible = false;
    scene.add(mesh);
    const item = { mesh: mesh, material: material, live: false, life: 0, max: 1, height: 240, radius: 46, spin: 0 };
    fx.pillars.push(item);
    return item;
  } catch (error) { return null; }
};

const takeRing = () => {
  for (const item of fx.rings) if (!item.live) return item;
  const scene = fxScene();
  if (!scene || !ringGeometry) return null;
  try {
    const material = fxMaterial(accentNow(), 0.8);
    if (!material) return null;
    const mesh = new Three.Mesh(ringGeometry, material);
    mesh.name = 'iceWolfV130Ring';
    mesh.rotation.x = Math.PI / 2;
    mesh.renderOrder = 8;
    mesh.visible = false;
    scene.add(mesh);
    const item = { mesh: mesh, material: material, live: false, life: 0, max: 1, from: 20, to: 150, z: 8 };
    fx.rings.push(item);
    return item;
  } catch (error) { return null; }
};

const takeShard = () => {
  for (const item of fx.shards) if (!item.live) return item;
  const scene = fxScene();
  if (!scene || !shardGeometry) return null;
  try {
    const material = fxMaterial(0xbdf0ff, 0.9);
    if (!material) return null;
    const mesh = new Three.Mesh(shardGeometry, material);
    mesh.name = 'iceWolfV130Shard';
    mesh.renderOrder = 9;
    mesh.visible = false;
    scene.add(mesh);
    const item = { mesh: mesh, material: material, live: false, life: 0, max: 1, vx: 0, vy: 0, vz: 0, spin: 0, size: 5 };
    fx.shards.push(item);
    return item;
  } catch (error) { return null; }
};

const firePillar = (x, y, colour, height, radius, life) => {
  const item = takePillar();
  if (!item) return false;
  item.live = true;
  item.life = life || 0.7;
  item.max = item.life;
  item.height = height || 260;
  item.radius = radius || 46;
  item.spin = Math.random() * Math.PI;
  item.material.color.setHex(typeof colour === 'number' ? colour : accentNow());
  item.mesh.position.set(x, y, 4);
  item.mesh.visible = true;
  fx.counts.pillars += 1;
  return true;
};

const fireRing = (x, y, colour, from, to, life, z) => {
  const item = takeRing();
  if (!item) return false;
  item.live = true;
  item.life = life || 0.55;
  item.max = item.life;
  item.from = from || 18;
  item.to = to || 130;
  item.z = typeof z === 'number' ? z : 9;
  item.material.color.setHex(typeof colour === 'number' ? colour : accentNow());
  item.mesh.position.set(x, y, item.z);
  item.mesh.visible = true;
  fx.counts.rings += 1;
  return true;
};

const fireShards = (x, y, count, colour) => {
  let made = 0;
  const total = count || 10;
  for (let i = 0; i < total; i += 1) {
    const item = takeShard();
    if (!item) break;
    item.live = true;
    item.life = 0.5 + Math.random() * 0.35;
    item.max = item.life;
    item.size = 4 + Math.random() * 7;
    item.spin = Math.random() * Math.PI;
    item.vx = (Math.random() - 0.5) * 190;
    item.vy = (Math.random() - 0.5) * 190;
    item.vz = 120 + Math.random() * 170;
    item.material.color.setHex(typeof colour === 'number' ? colour : 0xc6f3ff);
    item.mesh.position.set(x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 20, 26 + Math.random() * 40);
    item.mesh.scale.set(item.size, item.size, item.size);
    item.mesh.visible = true;
    made += 1;
    fx.counts.shards += 1;
  }
  return made;
};

/* ------------------------------------------------------------------ the flash */
const flashStyle = () => {
  if (typeof document === 'undefined' || !document.head) return null;
  if (runtimeScene.__iceWolfV130FlashStyle) return runtimeScene.__iceWolfV130FlashStyle;
  const style = document.createElement('style');
  style.setAttribute('data-ice-wolf-v130-flash', '1');
  style.textContent = '[data-ice-wolf-v130-glow]{position:fixed;inset:0;pointer-events:none;z-index:2147482410;'
    + 'opacity:0;transition:opacity .42s ease-out;box-shadow:inset 0 0 0 3px var(--iw-fx-colour,rgba(143,233,255,.85)),'
    + 'inset 0 0 60px 8px var(--iw-fx-glow,rgba(143,233,255,.22))}'
    + '[data-ice-wolf-v130-glow].iw-on{opacity:1;transition:opacity .05s linear}';
  document.head.appendChild(style);
  runtimeScene.__iceWolfV130FlashStyle = style;
  return style;
};
const flashScreen = (colour, glow) => {
  if (typeof document === 'undefined' || !document.body) return false;
  try {
    flashStyle();
    let node = runtimeScene.__iceWolfV130Glow;
    if (!node || !node.parentNode) {
      node = document.createElement('div');
      node.setAttribute('data-ice-wolf-v130-glow', '1');
      document.body.appendChild(node);
      runtimeScene.__iceWolfV130Glow = node;
      fx.glow = '';
    }
    const stamp = String(colour);
    if (fx.glow !== stamp) {
      fx.glow = stamp;
      node.style.setProperty('--iw-fx-colour', colour);
      node.style.setProperty('--iw-fx-glow', glow || 'rgba(143,233,255,.20)');
    }
    node.classList.add('iw-on');
    if (runtimeScene.__iceWolfV130GlowTimer) clearTimeout(runtimeScene.__iceWolfV130GlowTimer);
    runtimeScene.__iceWolfV130GlowTimer = setTimeout(() => {
      try { node.classList.remove('iw-on'); } catch (error) { /* gone with the frame */ }
    }, 90);
    fx.counts.flashes += 1;
    return true;
  } catch (error) { return false; }
};

/* ------------------------------------------------------------------- the pads
 * Every speed and warp pad carries one ring, built the first time the pad is
 * seen and turned a little each frame. The rings stand over the pad's own
 * instance, so a stage that moves its pads takes its rings along. */
const padRings = () => {
  const scene = fxScene();
  if (!scene || !ringGeometry) return;
  const kinds = [['SpeedPad', 0x7ce8ff, 62, 14], ['WarpPad', 0xc08bff, 70, 18]];
  for (const [name, colour, radius, z] of kinds) {
    const pads = runtimeScene.getObjects(name);
    for (let i = 0; i < pads.length; i += 1) {
      const pad = pads[i];
      if (!pad || pad.__iceWolfV130Ring) continue;
      try {
        const material = fxMaterial(colour, 0.75);
        if (!material) continue;
        const mesh = new THREE.Mesh(ringGeometry, material);
        mesh.name = 'iceWolfV130PadRing';
        mesh.rotation.x = Math.PI / 2;
        mesh.renderOrder = 8;
        scene.add(mesh);
        pad.__iceWolfV130Ring = { mesh: mesh, material: material, radius: radius, z: z, spin: Math.random() * 6.28, kind: name };
        fx.padRings.push(pad.__iceWolfV130Ring);
      } catch (error) { /* one pad without a ring is still a pad */ }
    }
  }
};
padRings();

/* --------------------------------------------------------------- the trail */
const trailTexture = (() => {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 16;
    const context = canvas.getContext ? canvas.getContext('2d') : null;
    if (!context) return null;
    const gradient = context.createLinearGradient(0, 0, 64, 0);
    gradient.addColorStop(0, 'rgba(160,240,255,0)');
    gradient.addColorStop(0.55, 'rgba(190,248,255,0.55)');
    gradient.addColorStop(1, 'rgba(255,255,255,0.9)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 16);
    const map = new Three.Texture(canvas);
    map.needsUpdate = true;
    return map;
  } catch (error) { return null; }
})();
const takeTrail = () => {
  for (const item of fx.trails) if (!item.live) return item;
  const scene = fxScene();
  if (!scene || !Three || typeof Three.PlaneGeometry !== 'function') return null;
  try {
    const geometry = new Three.PlaneGeometry(64, 18);
    const material = new Three.MeshBasicMaterial({
      map: trailTexture, color: 0x9feaff, transparent: true, opacity: 0.5,
      depthWrite: false, blending: Three.AdditiveBlending, fog: false, toneMapped: false
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'iceWolfV130Trail';
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 7;
    mesh.visible = false;
    scene.add(mesh);
    const item = { mesh: mesh, material: material, live: false, life: 0, max: 1 };
    fx.trails.push(item);
    return item;
  } catch (error) { return null; }
};
const fireTrail = (x, y, angle) => {
  const item = takeTrail();
  if (!item) return false;
  item.live = true;
  item.life = 0.34;
  item.max = 0.34;
  item.mesh.position.set(x, y, 5);
  item.mesh.rotation.z = -angle;
  item.mesh.visible = true;
  return true;
};

/* ------------------------------------------------------------- who and where */
const bodyOf = (obj) => {
  try {
    return { x: obj.getX() + (obj.getWidth() || 0) / 2, y: obj.getY() + (obj.getHeight() || 0) / 2 };
  } catch (error) { return null; }
};
const playerObject = runtimeScene.getObjects('Player')[0] || null;
const playerPoint = playerObject ? bodyOf(playerObject) : null;
const playerFrozen = playerObject
  ? playerObject.getVariables().get('State').getAsString() === 'Frozen' : false;
const playerWolfMode = vars.get('WolfModeLeft').getAsNumber();

/* A pad's world point, from the instance the game has already placed. */
const padPoint = (name, index) => {
  const pads = runtimeScene.getObjects(name);
  const pad = pads[index] || pads[0];
  return pad ? bodyOf(pad) : null;
};

/* ------------------------------------------------------------------- the beats */
const switchesNow = vars.get('SwitchActiveCount').getAsNumber();
const gateNow = vars.get('GateUnlocked').getAsBoolean();
const rescuesNow = vars.get('RescueHoldCount').getAsNumber();
const speedNow = vars.get('SpeedBoostLeft').getAsNumber();
const warpNow = vars.get('WarpCooldownLeft').getAsNumber();
let fired = 0;

if (playing) {
  if (fx.seen.switches === null) fx.seen.switches = switchesNow;
  if (switchesNow > fx.seen.switches && playerPoint) {
    const holdIndex = Math.round(vars.get('SwitchHoldIndex').getAsNumber());
    const point = padPoint('SwitchPad', holdIndex >= 0 ? holdIndex : 0) || playerPoint;
    firePillar(point.x, point.y, 0xffe38a, 300, 54, 0.8);
    fireRing(point.x, point.y, 0xffe38a, 22, 170, 0.65);
    fireRing(point.x, point.y, 0xfff3c4, 14, 96, 0.45);
    flashScreen('rgba(255,213,120,.9)', 'rgba(255,210,110,.22)');
    fired += 1;
  }
  fx.seen.switches = switchesNow;

  if (fx.seen.gate === null) fx.seen.gate = gateNow;
  if (gateNow === true && fx.seen.gate !== true) {
    const index = Math.round(vars.get('GateOpenIndex').getAsNumber());
    const point = padPoint('GatePad', index >= 0 ? index : 0);
    if (point) {
      firePillar(point.x - 34, point.y, 0x9cffc4, 340, 36, 1.1);
      firePillar(point.x + 34, point.y, 0x9cffc4, 340, 36, 1.1);
      fireRing(point.x, point.y, 0x9cffc4, 26, 220, 0.9);
      fireRing(point.x, point.y, 0xffffff, 16, 130, 0.6);
    }
    flashScreen('rgba(150,255,190,.9)', 'rgba(140,255,190,.22)');
    fired += 1;
  }
  fx.seen.gate = gateNow;

  if (fx.seen.wolf === null) fx.seen.wolf = playerWolfMode;
  if (playerWolfMode > 0 && !(fx.seen.wolf > 0) && playerPoint) {
    fireRing(playerPoint.x, playerPoint.y, 0xff5a63, 24, 250, 0.7);
    fireRing(playerPoint.x, playerPoint.y, 0xff9aa2, 16, 150, 0.5);
    flashScreen('rgba(255,96,108,.92)', 'rgba(255,90,100,.24)');
    fired += 1;
  }
  fx.seen.wolf = playerWolfMode;

  if (fx.seen.rescue === null) fx.seen.rescue = rescuesNow;
  if (rescuesNow > fx.seen.rescue && playerPoint) {
    fireRing(playerPoint.x, playerPoint.y, 0xfff0a0, 20, 190, 0.55);
    fireRing(playerPoint.x, playerPoint.y, 0xffffff, 12, 110, 0.38);
    fired += 1;
  }
  fx.seen.rescue = rescuesNow;

  if (fx.seen.frozen === null) fx.seen.frozen = playerFrozen;
  if (playerFrozen && fx.seen.frozen !== true && playerPoint) {
    fireShards(playerPoint.x, playerPoint.y, 14, 0xcaf3ff);
    fireRing(playerPoint.x, playerPoint.y, 0xbdf0ff, 18, 130, 0.5);
    fired += 1;
  }
  fx.seen.frozen = playerFrozen;

  /* The speed floor: a dashed trail behind the player while it carries them. */
  if (speedNow > 0 && fx.seen.speed !== null && speedNow > fx.seen.speed && playerPoint) {
    fireRing(playerPoint.x, playerPoint.y, 0x9feaff, 20, 150, 0.45);
  }
  if (speedNow > 0 && playerPoint) {
    let heading = 0;
    try { heading = playerObject.getAngle() * Math.PI / 180; } catch (error) { heading = 0; }
    fireTrail(playerPoint.x - Math.cos(heading) * 22, playerPoint.y - Math.sin(heading) * 22, heading);
  }
  fx.seen.speed = speedNow;
  fx.seen.warp = warpNow;
} else {
  fx.seen.switches = switchesNow;
  fx.seen.gate = gateNow;
  fx.seen.wolf = playerWolfMode;
  fx.seen.rescue = rescuesNow;
  fx.seen.frozen = playerFrozen;
  fx.seen.speed = speedNow;
  fx.seen.warp = warpNow;
}

/* ------------------------------------------------------------------- the wolf
 * One red aura ring that lives under the player while a wolf mode is on. */
if (playing && playerWolfMode > 0 && playerPoint) {
  if (!fx.aura) {
    const scene = fxScene();
    if (scene && ringGeometry) {
      try {
        const material = fxMaterial(0xff4f5e, 0.8);
        if (material) {
          const mesh = new THREE.Mesh(ringGeometry, material);
          mesh.name = 'iceWolfV130Aura';
          mesh.rotation.x = Math.PI / 2;
          mesh.renderOrder = 8;
          scene.add(mesh);
          fx.aura = { mesh: mesh, material: material };
        }
      } catch (error) { fx.aura = null; }
    }
  }
  if (fx.aura) {
    const pulse = 1 + Math.sin(fxClock * 6) * 0.12;
    fx.aura.mesh.visible = true;
    fx.aura.mesh.position.set(playerPoint.x, playerPoint.y, 7);
    fx.aura.mesh.scale.set(34 * pulse, 34 * pulse, 34 * pulse);
    fx.aura.material.opacity = 0.5 + Math.sin(fxClock * 6) * 0.2;
  }
} else if (fx.aura) {
  fx.aura.mesh.visible = false;
}

/* ------------------------------------------------------------------ the frame
 * Age every live effect: a pillar rises and fades, a ripple widens and fades,
 * a shard flies and falls. */
const age = (dt) => {
  for (const item of fx.pillars) {
    if (!item.live) continue;
    item.life -= dt;
    if (item.life <= 0) { item.live = false; item.mesh.visible = false; continue; }
    const k = item.life / item.max;
    item.mesh.scale.set(item.radius * (0.6 + k * 0.4), item.radius * (0.6 + k * 0.4), item.height * (0.25 + (1 - k) * 0.75));
    item.material.opacity = 0.55 * k;
    item.mesh.rotation.z = item.spin + (1 - k) * 2.2;
  }
  for (const item of fx.rings) {
    if (!item.live) continue;
    item.life -= dt;
    if (item.life <= 0) { item.live = false; item.mesh.visible = false; continue; }
    const k = 1 - item.life / item.max;
    const radius = item.from + (item.to - item.from) * Math.sqrt(k);
    item.mesh.scale.set(radius, radius, 1);
    item.material.opacity = Math.max(0, 0.9 * (1 - k));
  }
  for (const item of fx.shards) {
    if (!item.live) continue;
    item.life -= dt;
    if (item.life <= 0) { item.live = false; item.mesh.visible = false; continue; }
    item.vz -= 320 * dt;
    item.mesh.position.x += item.vx * dt;
    item.mesh.position.y += item.vy * dt;
    item.mesh.position.z += item.vz * dt;
    if (item.mesh.position.z < 4) { item.mesh.position.z = 4; item.vz = 0; item.vx *= 0.7; item.vy *= 0.7; }
    item.spin += dt * 5;
    item.mesh.rotation.set(item.spin, item.spin * 0.7, item.spin * 0.4);
    item.material.opacity = Math.max(0, 0.9 * (item.life / item.max));
  }
  for (const item of fx.trails) {
    if (!item.live) continue;
    item.life -= dt;
    if (item.life <= 0) { item.live = false; item.mesh.visible = false; continue; }
    const k = item.life / item.max;
    item.material.opacity = 0.45 * k;
    item.mesh.scale.set(0.7 + (1 - k) * 0.6, 1, 1);
  }
};

const turnPads = () => {
  for (const ring of fx.padRings) {
    if (!ring || !ring.mesh) continue;
    ring.spin += 0.035;
    const pulse = 0.86 + Math.sin(fxClock * 3 + ring.spin) * 0.14;
    ring.mesh.visible = true;
    ring.mesh.scale.set(ring.radius * pulse, ring.radius * pulse, 1);
    ring.material.opacity = ring.kind === 'WarpPad' ? 0.55 : 0.5;
  }
};

/* The pad rings follow their pad every frame: a stage change or a stair ride
 * moves the instances, and the ring is only ever the pad's own position. */
const followPads = () => {
  for (const name of ['SpeedPad', 'WarpPad']) {
    const pads = runtimeScene.getObjects(name);
    for (let i = 0; i < pads.length; i += 1) {
      const pad = pads[i];
      const ring = pad && pad.__iceWolfV130Ring;
      if (!ring) continue;
      const point = bodyOf(pad);
      if (!point) continue;
      ring.mesh.position.set(point.x, point.y, ring.z);
    }
  }
};

/* The frame's dt, from the game's own clock, so a slow phone does not make a
 * flash last two seconds. */
const fxNow = fxClock;
const fxLast = typeof runtimeScene.__iceWolfV130Clock === 'number' ? runtimeScene.__iceWolfV130Clock : fxNow;
runtimeScene.__iceWolfV130Clock = fxNow;
const fxDt = Math.max(0.004, Math.min(0.06, fxNow - fxLast > 0 ? fxNow - fxLast : 1 / 60));

if (Three) {
  followPads();
  turnPads();
  age(fxDt);
}

vars.get('StageFxPillars').setNumber(fx.counts.pillars);
vars.get('StageFxRings').setNumber(fx.counts.rings);
vars.get('StageFxShards').setNumber(fx.counts.shards);
vars.get('StageFxFlashes').setNumber(fx.counts.flashes);
vars.get('StageFxPadRings').setNumber(fx.padRings.length);
vars.get('StageFxLive').setNumber(
  fx.pillars.filter((item) => item.live).length + fx.rings.filter((item) => item.live).length
  + fx.shards.filter((item) => item.live).length + fx.trails.filter((item) => item.live).length);
vars.get('StageFxStage').setString(stageNow);
vars.get('StageFxFired').setNumber(fired);
