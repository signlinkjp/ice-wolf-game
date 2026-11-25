/* ICE WOLF v1.2.0 — the running characters (the sprite outfit).
 *
 * What the player sees on the ice is the generated artwork: the boy in his
 * winter gear and the girl in her hoodie, each dressed for the stage, and the
 * red-horned wolf ahead of them. Every body is ONE textured sprite: four cells
 * of a 200px run cycle in a single PNG, drawn as a camera-facing billboard, so
 * a whole crowd is at most twenty draw calls and the animation is a change of
 * `map.offset` — no per-frame geometry, no per-frame texture, no DOM.
 *
 * What did not change: the 17x17x32 hitbox, the physics body, the ice shell and
 * the object's own angle. The cube's faces are hidden only after the sprite is
 * standing, and put back if anything goes wrong, so a device without a 3D
 * renderer keeps the old solid cube instead of an empty room.
 *
 * THE RULE (the v1.2.0 brief): the wolf the round opens with stays a wolf for
 * the whole match — `WolfOrigin` is empty (or "initial") for that body, and it
 * wears the wolf sprite whether its wolf mode is running or not. Only a wolf
 * made during the round — the trap switch ("trap"), an infection ("infect",
 * "cpu") — walks as a human and turns into the wolf for its five seconds. A
 * human never shows the wolf, and a wolf-role human (a disguise) still cannot
 * rescue: the role is what the rescue button reads, not the picture.
 *
 * The billboard is mirrored when the body walks the other way, so the figure
 * always runs the way it moves.
 */
const vars = runtimeScene.getVariables();
const Three = (typeof THREE !== 'undefined' && THREE) ? THREE : null;
const players = runtimeScene.getObjects('Player');
const playerObject = players.length ? players[0] : null;
const wolfModeLeftVar = vars.get('WolfModeLeft');
const playerWolfModeLeft = wolfModeLeftVar ? wolfModeLeftVar.getAsNumber() : 0;

const OUTFIT_IDS = ['classic', 'aquarium', 'park', 'lodge', 'school', 'space'];
const FRAME_COUNT = 4;
const CELL_U = 1 / FRAME_COUNT;
/* World pixels: a toy was 48px tall in the 1.0.0 block model and a wall is 160,
 * so this keeps the same feet-to-head scale against the arena. */
const BODY_HEIGHT = 70;
const BODY_WIDTH = BODY_HEIGHT * 0.66;
const STEPS_PER_FRAME = 15;

const outfitId = () => {
  const raw = vars.get('StageOutfit').getAsString();
  return OUTFIT_IDS.indexOf(raw) >= 0 ? raw : 'classic';
};
const spriteFile = (who, outfit) => 'chr_' + who + '_' + outfit + '.png';

const store = runtimeScene.__iceWolfV120 || (runtimeScene.__iceWolfV120 = {
  textures: {}, loading: {}, failed: {}, misc: {}, spriteCount: 0
});

/* The sheet itself, loaded straight from the export's asset folder: the same
 * path the menu hero uses (`getAssetPath()` + the file name, with the plain
 * name as a second try), so a build that keeps its pictures under assets/ also
 * finds them. One request per picture, cached for the session; the loader is
 * THREE's own, so the texture reaches the sprite untouched. */
const assetBase = (() => {
  try {
    const game = runtimeScene.getGame();
    return game && typeof game.getAssetPath === 'function' ? (game.getAssetPath() || '') : '';
  } catch (error) { return ''; }
})();
const textureFor = (name) => {
  if (store.textures[name]) return store.textures[name];
  if (store.failed[name]) return null;
  if (!store.loading[name]) {
    if (!store.loader && typeof Three.TextureLoader === 'function') store.loader = new Three.TextureLoader();
    const loader = store.loader;
    if (!loader) return null;
    store.loading[name] = true;
    const accept = (texture) => {
      store.loading[name] = false;
      if (!texture) { store.failed[name] = true; return; }
      if (Three.SRGBColorSpace !== undefined) texture.colorSpace = Three.SRGBColorSpace;
      texture.magFilter = Three.LinearFilter;
      texture.minFilter = Three.LinearFilter;
      texture.wrapS = Three.RepeatWrapping;
      texture.wrapT = Three.RepeatWrapping;
      texture.generateMipmaps = false;
      texture.needsUpdate = true;
      store.textures[name] = texture;
    };
    const retry = () => {
      const fallback = assetBase ? name : '';
      if (!fallback) { accept(null); return; }
      loader.load(fallback, accept, undefined, () => accept(null));
    };
    try {
      loader.load(assetBase + name, accept, undefined, retry);
    } catch (error) {
      store.loading[name] = false;
      store.failed[name] = true;
    }
  }
  return null;
};

/* The soft shadow under a toy: one 64px radial gradient, drawn once. */
const shadowTexture = () => {
  if (store.misc.shadow) return store.misc.shadow;
  if (typeof document === 'undefined' || !document.createElement) return null;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext ? canvas.getContext('2d') : null;
  if (!context) return null;
  const gradient = context.createRadialGradient(32, 32, 2, 32, 32, 30);
  gradient.addColorStop(0, 'rgba(2,10,20,0.55)');
  gradient.addColorStop(0.55, 'rgba(2,10,20,0.28)');
  gradient.addColorStop(1, 'rgba(2,10,20,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new Three.Texture(canvas);
  texture.needsUpdate = true;
  store.misc.shadow = texture;
  return texture;
};

const iceMaterial = () => {
  if (!store.misc.iceMaterial) {
    store.misc.iceMaterial = new Three.MeshStandardMaterial({
      color: 0x63d6f2, transparent: true, opacity: 0.48,
      depthWrite: false, roughness: 0.32, metalness: 0.0,
    });
  }
  return store.misc.iceMaterial;
};
const iceGeometry = () => {
  if (!store.misc.iceGeometry) {
    const box = new Three.BoxGeometry(23, 23, 50);
    box.translate(0, 0, 25);
    store.misc.iceGeometry = box;
  }
  return store.misc.iceGeometry;
};
const shadowMaterial = () => {
  if (!store.misc.shadowMaterial) {
    const map = shadowTexture();
    if (!map) return null;
    store.misc.shadowMaterial = new Three.MeshBasicMaterial({
      map: map, transparent: true, depthWrite: false, opacity: 0.9
    });
  }
  return store.misc.shadowMaterial;
};
const shadowGeometry = () => {
  if (!store.misc.shadowGeometry) store.misc.shadowGeometry = new Three.PlaneGeometry(40, 40);
  return store.misc.shadowGeometry;
};
const hiddenMaterial = () => {
  if (!store.misc.hiddenMaterial) {
    store.misc.hiddenMaterial = new Three.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    store.misc.hiddenMaterial.visible = false;
  }
  return store.misc.hiddenMaterial;
};

const sheetMap = (texture, mirror) => {
  const map = texture.clone();
  map.needsUpdate = true;
  map.wrapS = Three.RepeatWrapping;
  map.wrapT = Three.RepeatWrapping;
  map.repeat.set(mirror ? -CELL_U : CELL_U, 1);
  map.offset.set(0, 0);
  return map;
};

const buildRig = (obj) => {
  let root = null;
  try {
    root = typeof obj.get3DRendererObject === 'function' ? obj.get3DRendererObject() : null;
  } catch (error) { root = null; }
  if (!root || typeof root.add !== 'function' || !root.parent) return null;
  const texture = textureFor(spriteFile('h1', outfitId()));
  /* Nothing is attached until the first picture is in memory: a body with no
   * texture is worse than the cube it replaces. */
  if (!texture) return null;
  const material = new Three.SpriteMaterial({
    map: sheetMap(texture, false), transparent: true, depthWrite: false, alphaTest: 0.06, fog: false,
  });
  /* The picture hangs inside the body's own cube through a holder that undoes
   * the cube's non-uniform scale: one holder unit is one world pixel, exactly
   * like the ice shell, and the cube itself is the one thing we know GDevelop
   * renders. */
  const holder = new Three.Group();
  holder.name = 'iceWolfV120Holder';
  holder.scale.set(1 / (obj.getWidth() || 17), 1 / (obj.getHeight() || 17), 1 / (obj.getDepth() || 32));
  root.add(holder);
  const sceneRoot = holder;
  const sprite = new Three.Sprite(material);
  sprite.name = 'iceWolfV120Body';
  sprite.center.set(0.5, 0);
  sprite.scale.set(BODY_WIDTH, BODY_HEIGHT, 1);
  sprite.renderOrder = 4;
  sceneRoot.add(sprite);
  const shadow = new Three.Mesh(shadowGeometry(), shadowMaterial());
  shadow.name = 'iceWolfV120Shadow';
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(BODY_WIDTH / 40, BODY_WIDTH / 40, 1);
  shadow.renderOrder = 1;
  sceneRoot.add(shadow);
  const ice = new Three.Mesh(iceGeometry(), iceMaterial());
  ice.name = 'iceWolfV120Ice';
  ice.scale.set(1 / (obj.getWidth() || 17), 1 / (obj.getHeight() || 17), 1 / (obj.getDepth() || 32));
  ice.position.set(0, 0, -0.5);
  ice.visible = false;
  root.add(ice);
  const rig = {
    root: root, scene: sceneRoot, sprite: sprite, shadow: shadow, ice: ice, map: material.map,
    key: '', frame: -1, mirror: false, walk: 0, lastX: null, lastY: null,
    baseMaterials: null, baseHidden: false, hidden: false
  };
  try {
    rig.baseMaterials = root.material;
    root.material = hiddenMaterial();
    root.castShadow = false;
    rig.baseHidden = true;
  } catch (error) {
    rig.baseHidden = false;
  }
  store.spriteCount += 1;
  return rig;
};

const cameraRight = (obj, into) => {
  try {
    const layer = typeof obj.getInstanceContainer === 'function'
      ? obj.getInstanceContainer().getLayer(obj.getLayer()) : null;
    const renderer = layer && typeof layer.getRenderer === 'function' ? layer.getRenderer() : null;
    const camera = renderer && typeof renderer.getThreeCamera === 'function' ? renderer.getThreeCamera() : null;
    if (!camera) return null;
    camera.updateMatrixWorld(true);
    into.setFromMatrixColumn(camera.matrixWorld, 0);
    return into;
  } catch (error) { return null; }
};

const whoFor = (obj, isPlayer) => {
  if (isPlayer) return 'h1';
  const idVar = obj.getVariables().get('DisplayId');
  const id = idVar ? idVar.getAsString() : '';
  const index = id ? id.charCodeAt(0) - 65 : 0;
  return index % 2 === 1 ? 'h2' : 'h1';
};

/* ==== v1.2.0 wolf look — testable block (tests/pro/v120-build32.test.mjs) ==== */
/* The rule the round obeys: the wolf it opened with keeps the wolf's body for
 * the whole match. `WolfOrigin` is empty for a wolf the deal made (and "initial"
 * once written); a wolf made later carries "trap", "infect" or "cpu" and only
 * turns for the length of its wolf mode. */
const ICE_WOLF_INITIAL_ORIGINS = ['', 'initial'];
const iceWolfLooksLikeWolf = (role, origin, modeLeft) => {
  if (String(role) !== 'Wolf') return false;
  if (ICE_WOLF_INITIAL_ORIGINS.indexOf(String(origin === undefined || origin === null ? '' : origin)) >= 0) return true;
  return Number(modeLeft) > 0;
};
const iceWolfIsOpeningWolf = (role, origin) => String(role) === 'Wolf'
  && ICE_WOLF_INITIAL_ORIGINS.indexOf(String(origin === undefined || origin === null ? '' : origin)) >= 0;
/* On a guest phone the host sends the role and the mode, but not where a wolf
 * came from: an empty origin there means "not known", not "the opening wolf".
 * The guest therefore keeps the pre-1.2.0 look (a person until its mode), so a
 * recruited wolf is never painted as a permanent wolf on somebody else's phone. */
const iceWolfLooksLikeWolfFor = (role, origin, modeLeft, guest) => (guest === true
  ? String(role) === 'Wolf' && Number(modeLeft) > 0
  : iceWolfLooksLikeWolf(role, origin, modeLeft));
/* ==== end v1.2.0 wolf look ==== */

const applyLook = (obj, rig, isPlayer) => {
  const objectVars = obj.getVariables();
  const roleVar = objectVars.get('Role');
  const stateVar = objectVars.get('State');
  const role = roleVar ? roleVar.getAsString() : 'Human';
  const state = stateVar ? stateVar.getAsString() : 'Active';
  if (!isPlayer && (state === 'Out' || state === 'Escaped')) {
    rig.sprite.visible = false;
    rig.shadow.visible = false;
    rig.ice.visible = false;
    try { rig.root.visible = false; } catch (error) { /* keep the frame */ }
    rig.hidden = true;
    return { frozen: false, transformed: false, lurking: false, look: 'out', out: true, always: false };
  }
  if (rig.hidden) {
    rig.hidden = false;
    try { rig.root.visible = true; } catch (error) { /* keep the frame */ }
    rig.sprite.visible = true;
    rig.shadow.visible = true;
  }
  const frozen = state === 'Frozen' || state === 'FrozenWolfCandidate';
  const aiWolfVar = isPlayer ? null : objectVars.get('AIWolfModeLeft');
  const modeLeft = isPlayer ? playerWolfModeLeft : aiWolfVar ? aiWolfVar.getAsNumber() : 0;
  const originVar = objectVars.get('WolfOrigin');
  const origin = originVar ? originVar.getAsString() : '';
  const isWolf = role === 'Wolf';
  /* v1.2.0: an opening wolf never disguises itself; a wolf made during the
   * round is a person until its mode takes it. */
  const guest = vars.get('OnlineGuestMode').getAsBoolean() === true;
  const alwaysWolf = !guest && iceWolfIsOpeningWolf(role, origin);
  const transformed = iceWolfLooksLikeWolfFor(role, origin, modeLeft, guest);
  const lurking = isWolf && !transformed && !frozen;
  const kind = transformed ? 'w1' : whoFor(obj, isPlayer);
  const outfit = outfitId();
  const key = kind + '@' + outfit;
  if (rig.key !== key) {
    const texture = textureFor(spriteFile(kind, outfit));
    if (texture) {
      rig.map = sheetMap(texture, rig.mirror);
      rig.sprite.material.map = rig.map;
      rig.sprite.material.needsUpdate = true;
      rig.key = key;
      rig.frame = -1;
    }
  }
  rig.ice.visible = frozen;
  return {
    frozen: frozen, transformed: transformed, lurking: lurking,
    look: kind === 'w1' ? 'wolf' : 'human', out: false, always: alwaysWolf
  };
};

const characters = [];
if (playerObject) characters.push(playerObject);
for (const actor of runtimeScene.getObjects('Actor')) characters.push(actor);

const frameIndex = (runtimeScene.__iceWolfV120Frame || 0) + 1;
runtimeScene.__iceWolfV120Frame = frameIndex;
const attemptsAllowed = frameIndex <= 90 || frameIndex % 20 === 0;
const right = Three ? new Three.Vector3() : null;
const world = Three ? new Three.Vector3() : null;

let built = 0;
let frozenTotal = 0;
let transformedTotal = 0;
let lurkingTotal = 0;
let humanLookTotal = 0;
let wolfLookTotal = 0;
let hiddenTotal = 0;
let alwaysTotal = 0;
let lastLook = '';

for (const obj of characters) {
  let rig = obj.__iceWolfV120Rig || null;
  if (!rig) {
    if (!Three || typeof Three.Sprite !== 'function' || typeof Three.SpriteMaterial !== 'function') continue;
    if (!attemptsAllowed) continue;
    try { rig = buildRig(obj); } catch (error) { rig = null; }
    if (!rig) continue;
    obj.__iceWolfV120Rig = rig;
  }
  built += 1;
  try {
    const view = applyLook(obj, rig, obj === playerObject);
    if (view.out) { hiddenTotal += 1; continue; }
    if (view.frozen) frozenTotal += 1;
    if (view.transformed) transformedTotal += 1;
    if (view.lurking) lurkingTotal += 1;
    if (view.always) alwaysTotal += 1;
    if (view.look === 'wolf') wolfLookTotal += 1;
    else if (view.look === 'human') humanLookTotal += 1;
    lastLook = view.look;
    /* Placed in the holder's pixel space: the cube's centre is half its depth
     * above the feet, and the sprite's anchor is its own feet. */
    const depth = obj.getDepth() || 32;
    rig.sprite.position.set(0, 0, -depth / 2 + 0.7);
    rig.shadow.position.set(0, 0, -depth / 2 + 0.35);
    rig.root.updateMatrixWorld(true);
    rig.root.getWorldPosition(world);
    let moved = 0;
    if (rig.lastX !== null && rig.lastY !== null) {
      const stepX = world.x - rig.lastX;
      const stepY = world.y - rig.lastY;
      moved = Math.sqrt(stepX * stepX + stepY * stepY);
      if (moved > 0.05 && moved < 400 && right) {
        const camera = cameraRight(obj, right);
        if (camera) {
          const side = stepX * camera.x + stepY * camera.y;
          if (Math.abs(side) > 0.5) rig.mirror = side < 0;
        }
      }
    }
    rig.lastX = world.x;
    rig.lastY = world.y;
    /* The run cycle advances with the distance walked, so the feet keep up with
     * the floor instead of paddling on the spot. */
    if (moved > 0.05 && moved < 400) rig.walk += moved;
    const frame = moved > 0.05 ? Math.floor(rig.walk / STEPS_PER_FRAME) % FRAME_COUNT : 0;
    if (frame !== rig.frame || !rig.map) {
      rig.frame = frame;
      rig.map.repeat.set(rig.mirror ? -CELL_U : CELL_U, 1);
      rig.map.offset.set(rig.mirror ? (frame + 1) * CELL_U : frame * CELL_U, 0);
    } else if (rig.map.repeat.x < 0 !== rig.mirror) {
      rig.map.repeat.set(rig.mirror ? -CELL_U : CELL_U, 1);
      rig.map.offset.set(rig.mirror ? (frame + 1) * CELL_U : frame * CELL_U, 0);
    }
    const tint = view.frozen ? 0.66 : 1;
    rig.sprite.material.color.setRGB(tint * 0.94, tint, 1);
    rig.shadow.visible = true;
    const shrink = view.frozen ? 0.94 : 1;
    rig.sprite.scale.set(BODY_WIDTH * shrink, BODY_HEIGHT * shrink, 1);
  } catch (error) {
    store.lastError = String(error && error.stack ? error.stack : error);
    store.errorCount = (store.errorCount || 0) + 1;
  }
}

vars.get('PlayerSpriteCount').setNumber(built);
vars.get('PlayerSpriteMode').setString(
  characters.length === 0 ? '' : built === characters.length ? 'sprite' : built > 0 ? 'partial' : 'fallback');
vars.get('PlayerSpriteFrames').setNumber(FRAME_COUNT);
vars.get('PlayerSpriteFrozen').setNumber(frozenTotal);
vars.get('PlayerSpriteTransformed').setNumber(transformedTotal);
vars.get('PlayerSpriteLurking').setNumber(lurkingTotal);
vars.get('PlayerSpriteHidden').setNumber(hiddenTotal);
vars.get('WolfAlwaysCount').setNumber(alwaysTotal);
vars.get('BlockToyVersion').setString('1.2.0');
vars.get('BlockToyGeometryBuilds').setNumber(store.spriteCount);
vars.get('BlockToyHumanLooks').setNumber(humanLookTotal);
vars.get('BlockToyWolfLooks').setNumber(wolfLookTotal);
vars.get('BlockToyLook').setString(built === 0 ? '' : lastLook);
const currentOutfit = outfitId();
vars.get('BlockToyOutfit').setString(currentOutfit);
vars.get('BlockToyOutfitLooks').setNumber(OUTFIT_IDS.length);
vars.get('BlockToyOutfitParts').setNumber(FRAME_COUNT);
