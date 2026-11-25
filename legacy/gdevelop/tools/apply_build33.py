#!/usr/bin/env python3
"""Apply the ICE WOLF v1.2.0 Build 33 changes to game.json.

Build 33 is "step 2" of the device play-test. It touches four things and adds a
fifth, all of them inside the GDevelop project (the shipping artifact):

  1. THE MENU (block "v0.6.5 Production Round Start + Main Menu") — after a
     match the sheet could be left scrolled, and a tap the browser resolved as
     the start of a pan never reached the button's own pointerdown listener: the
     button lit up (:hover) and nothing opened, while the card slid up and down.
     The sheet now answers a tap once, at its root, in the capture phase, for
     pointerdown / touchstart / click; the menu card is scaled to fit the phone
     so it can never scroll; and the sheet re-applies the screen the player
     asked for on every frame.
  2. THE RUNNING BODIES (block "v0.7.3 ブロックトイ3Dキャラ") — a body is 60%
     taller, the four-frame cycle turns faster, each stride lifts the body, the
     figure leans into its run, and the feet throw snow. The body is drawn over
     the walls (depthTest off) so a body against a wall is never lost.
  3. THE CAMERA (group "v0.6.4 Normal + Overview camera") — a little closer and
     a little steeper, so the toys read bigger and a wall hides less of them.
  4. THE HUD (block "v0.7.0 …" pills and block "v0.6.4 … Virtual Joystick UI")
     — every world pill is clamped inside the canvas (no more "1F→2F" cut at
     the right edge) and the stick sits in the safe-area corner.
  5. THE ACTION (new group "v1.3.0 アクション演出", tools/b33/fx.js) — the light
     column of a switch, the rings of a pad, the ice of a freeze, the rescue
     flash, the gate pillars and the wolf's red aura.

It writes game.json in place, formatted like the GDevelop editor writes it.
Run it once from the repository root:

  python3 tools/apply_build33.py
"""
from __future__ import annotations

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "tools", "b33")
GAME = os.path.join(ROOT, "game.json")

MENU_GROUP = "v0.6.5 Production Round Start + Main Menu"
CHARACTER_GROUP = "v0.7.3 ブロックトイ3Dキャラ"
CAMERA_GROUP = "v0.6.4 Normal + Overview camera"
PILL_GROUP = "v0.7.0 2階・階段・5スイッチ・3ゲート"
JOYSTICK_GROUP = "v0.6.4 Device-Tuned Mobile Virtual Joystick UI"
STAGE_GROUP = "v1.1.0 ステージ・衣装"
LABEL_GROUP = "v0.6.2 Color-independent Actor ID Labels"
FX_GROUP = "v1.3.0 アクション演出"


def read(name: str) -> str:
    with open(os.path.join(SRC, name), encoding="utf-8") as handle:
        return handle.read()


def scene_of(game: dict) -> dict:
    for layout in game["layouts"]:
        if layout["name"] == "FROST LAB":
            return layout
    raise SystemExit("FROST LAB is missing from game.json")


def find_group(scene: dict, name: str) -> dict | None:
    for group in scene["events"]:
        if group.get("name") == name:
            return group
    return None


def code_of(group: dict) -> str:
    block = group["events"][0].get("inlineCode")
    return "\n".join(block) if isinstance(block, list) else str(block or "")


def set_code(group: dict, code: str) -> None:
    group["events"] = [{"type": "BuiltinCommonInstructions::JsCode", "inlineCode": code}]


def swap(code: str, old: str, new: str, label: str) -> str:
    if old not in code:
        raise SystemExit(f"{label}: the text this patch replaces has moved")
    return code.replace(old, new, 1)


def new_group(name: str, code: str, colour: tuple[int, int, int]) -> dict:
    return {
        "colorB": colour[2], "colorG": colour[1], "colorR": colour[0],
        "creationTime": 0, "name": name, "source": "",
        "type": "BuiltinCommonInstructions::Group",
        "events": [{"type": "BuiltinCommonInstructions::JsCode", "inlineCode": code}],
    }


# --------------------------------------------------------------------------- 1
MENU_OLD_TAP = """  for (const button of root.querySelectorAll('[data-action]')) {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault(); event.stopPropagation();
      const action = button.dataset.action;
      if (action === 'start') vars.get('RoundCommand').setString('Start');
      else if (action === 'newRound') vars.get('RoundCommand').setString('Start');
      else if (action === 'mainMenu') vars.get('RoundCommand').setString('Menu');
      else if (action === 'stage') { vars.get('StageCommand').setString('open'); }
      else if (action === 'online') { vars.get('OnlineUiCommand').setString('open'); }
      else if (action === 'how') showOnly('how');
      else if (action === 'record') { updateRecordUi(); showOnly('record'); }
      else if (action === 'settings') { updateCameraPrefUi(); updateSoundUi(); updateSettingsUi(); showOnly('settings'); }
      else if (action === 'pro') { if (runtimeScene.__iceWolfV110Pro && typeof runtimeScene.__iceWolfV110Pro.open === 'function') runtimeScene.__iceWolfV110Pro.open(); }
      else if (action === 'language') { if (typeof runtimeScene.__iceWolfOpenLanguagePicker === 'function') runtimeScene.__iceWolfOpenLanguagePicker(); }
      else if (action === 'back') showOnly('menu');
      else if (action === 'soundToggle') { vars.get('SoundToggleRequest').setBoolean(true); }
      else if (action === 'cameraPref') { safeStorageSet('iceWolfDefaultOverview', preferredOverview()?'0':'1'); updateCameraPrefUi(); }
      else if (action === 'roleRandom') { vars.get('RolePreference').setString('Random'); safeStorageSet('iceWolfRolePreference', 'random'); updateSettingsUi(); }
      else if (action === 'roleWolf') { vars.get('RolePreference').setString('Wolf'); safeStorageSet('iceWolfRolePreference', 'wolf'); updateSettingsUi(); }
      else if (action === 'roleHuman') { vars.get('RolePreference').setString('Human'); safeStorageSet('iceWolfRolePreference', 'human'); updateSettingsUi(); }
      else if (action === 'time120') { vars.get('DurationPreference').setNumber(120); vars.get('MatchDuration').setNumber(120); safeStorageSet('iceWolfMatchDuration', '120'); updateSettingsUi(); }
      else if (action === 'time180') { vars.get('DurationPreference').setNumber(180); vars.get('MatchDuration').setNumber(180); safeStorageSet('iceWolfMatchDuration', '180'); updateSettingsUi(); }
      else if (action === 'time300') { vars.get('DurationPreference').setNumber(300); vars.get('MatchDuration').setNumber(300); safeStorageSet('iceWolfMatchDuration', '300'); updateSettingsUi(); }
      else if (action === 'switchEscape') { const next = !vars.get('SwitchEscapeEnabled').getAsBoolean(); vars.get('SwitchEscapeEnabled').setBoolean(next); safeStorageSet('iceWolfSwitchEscape', next ? '1' : '0'); updateSettingsUi(); }
      else if (action === 'trapAuto') { vars.get('TrapSwitchMode').setString('Auto'); safeStorageSet('iceWolfTrapSwitchMode', 'auto'); updateSettingsUi(); }
      else if (action === 'trapAlways') { vars.get('TrapSwitchMode').setString('AlwaysOn'); safeStorageSet('iceWolfTrapSwitchMode', 'always'); updateSettingsUi(); }
      else if (action === 'trapOff') { vars.get('TrapSwitchMode').setString('Off'); safeStorageSet('iceWolfTrapSwitchMode', 'off'); updateSettingsUi(); }
    }, {passive:false});
  }
"""

MENU_OLD_SHOW = """  const showOnly = (name) => {
    for (const el of root.querySelectorAll('.iw-screen')) {
      const visible = el.dataset.screen === name;
      el.classList.toggle('iw-show', visible);
      // v0.7.1: a tall panel always opens at its top, never half-scrolled.
      if (visible) { try { el.scrollTop = 0; } catch (_) {} }
    }
  };
"""


def patch_menu(scene: dict) -> None:
    group = find_group(scene, MENU_GROUP)
    if group is None:
        raise SystemExit(f"missing group: {MENU_GROUP}")
    code = code_of(group)
    if 'iceWolfV130Sheet' in code:
        return
    code = swap(code, MENU_OLD_SHOW, read("menu_show.js").rstrip("\n"), "menu: showOnly")
    code = swap(code, MENU_OLD_TAP, read("menu_tap.js").rstrip("\n"), "menu: tap")
    # the sheet keeps the screen the player asked for, every frame
    anchor = """if (ui && currentPhase === 'Countdown') {"""
    heal = """/* v1.3.0 (Build 33): the sheet's own screen wins. A frame that used to paint
 * the wrong screen (or a tap that only lit a button) can no longer leave the
 * player pressing a menu that is not listening: while the round is on the menu,
 * the screen the tap asked for is the screen that is shown. */
if (ui && currentPhase === 'Menu' && ui.sheet) {
  const wanted = ui.sheet.screen || 'menu';
  let shown = '';
  for (const el of ui.root.querySelectorAll('.iw-screen')) {
    if (el.classList.contains('iw-show')) { shown = el.dataset.screen; break; }
  }
  if (shown !== wanted) ui.showOnly(wanted);
}
"""
    code = swap(code, anchor, heal + anchor, "menu: self-heal")
    code = swap(code,
                "runtimeScene.__iceWolfV065ProductionUi = { root, screen, showOnly, updateRecordUi,",
                "runtimeScene.__iceWolfV065ProductionUi = { root, screen, showOnly, sheet, screenName: 'menu', updateRecordUi,",
                "menu: state")
    set_code(group, code)


# --------------------------------------------------------------------------- 2
CHAR_OLD_PLACE = """    /* Placed in the holder's pixel space: the cube's centre is half its depth
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
"""


def patch_characters(scene: dict) -> None:
    group = find_group(scene, CHARACTER_GROUP)
    if group is None:
        raise SystemExit(f"missing group: {CHARACTER_GROUP}")
    code = code_of(group)
    if 'iceWolfV130Run' in code:
        return
    for old, new, label in [
        ("const BODY_HEIGHT = 70;",
         "const BODY_HEIGHT = 112;", "characters: height"),
        ("const STEPS_PER_FRAME = 15;",
         "const STEPS_PER_FRAME = 9;", "characters: cycle"),
        ("""/* World pixels: a toy was 48px tall in the 1.0.0 block model and a wall is 160,
 * so this keeps the same feet-to-head scale against the arena. */""",
         """/* World pixels: a toy was 48px tall in the 1.0.0 block model and a wall is
 * 160. Build 33: a body stands 112 against that wall - the play-test could not
 * tell a runner from the floor at 70, and a figure you can see is the whole
 * point of the run cycle underneath it. */""", "characters: note"),
        ("""  const material = new Three.SpriteMaterial({
    map: sheetMap(texture, false), transparent: true, depthWrite: false, alphaTest: 0.06, fog: false,
  });""",
         """  const material = new Three.SpriteMaterial({
    map: sheetMap(texture, false), transparent: true, depthWrite: false, alphaTest: 0.06, fog: false,
    /* Build 33: a body is drawn over the walls. A 160px wall between the camera
     * and a 112px runner used to hide it completely - the play-test found the
     * 'YOU' bubble with nothing under it. Nothing else about the body changes. */
    depthTest: false,
  });""", "characters: material"),
        ("  sprite.renderOrder = 4;", "  sprite.renderOrder = 12;", "characters: order"),
        (CHAR_OLD_PLACE, read("character_run.js").rstrip("\n"), "characters: run"),
    ]:
        code = swap(code, old, new, label)
    # the snow the feet throw, shared by the whole crowd
    anchor = "const characters = [];"
    code = swap(code, anchor, read("character_snow.js").rstrip("\n") + "\n\n" + anchor, "characters: snow")
    # the snow is aged once per frame, after every body has thrown its own
    code = swap(code, "vars.get('PlayerSpriteCount').setNumber(built);",
                """if (snowSpray) {
  vars.get('PlayerRunSnow').setNumber(snowSpray.update());
  vars.get('PlayerRunSnowTotal').setNumber(snowSpray.state.emitted);
}
vars.get('PlayerSpriteCount').setNumber(built);""",
                "characters: snow frame")
    # the rig remembers its stride and lean
    code = swap(code,
                "    key: '', frame: -1, mirror: false, walk: 0, lastX: null, lastY: null,",
                "    key: '', frame: -1, mirror: false, walk: 0, lastX: null, lastY: null,\n"
                "    lean: 0, leanGoal: 0, bob: 0, stepAt: 0, sprayAt: 0, runSpeed: 0,",
                "characters: rig fields")
    set_code(group, code)


# --------------------------------------------------------------------------- 3
def patch_camera(scene: dict) -> None:
    group = find_group(scene, CAMERA_GROUP)
    if group is None:
        raise SystemExit(f"missing group: {CAMERA_GROUP}")
    wanted = [
        ("600", "500"), ("0", "0"), ("53", "58"),
    ]
    changed = 0
    for event in group.get("events", []):
        for action in event.get("actions", []):
            params = action.get("parameters", [])
            if len(params) >= 8 and params[1] == "Player" and params[3] == "600":
                params[3] = "500"
                params[6] = "58"
                changed += 1
            elif len(params) >= 8 and params[1] == "Player" and params[3] == "1050":
                params[3] = "980"
                params[6] = "80"
                changed += 1
    if changed != 2:
        raise SystemExit(f"camera: expected the two look-from actions, found {changed}")


# --------------------------------------------------------------------------- 4
PILL_OLD = """    el.style.left = (rect.left + spot.x * rect.width) + 'px';
    el.style.top = (rect.top + spot.y * rect.height) + 'px';
"""
PILL_NEW = """    /* Build 33: a pill is kept whole inside the canvas. A pad that projected
     * near the right edge used to take its pill half off the screen (the play-
     * test's "1F→2F" was cut in two), so the box is clamped before it is put
     * down, in the safe area's own terms. */
    const halfW = labelSize.width / 2;
    const pillPad = 6;
    const wantLeft = rect.left + spot.x * rect.width;
    const wantTop = rect.top + spot.y * rect.height;
    const minLeft = rect.left + pillPad + halfW;
    const maxLeft = rect.right - pillPad - halfW;
    const leftClamped = maxLeft >= minLeft ? Math.min(Math.max(wantLeft, minLeft), maxLeft) : rect.left + rect.width / 2;
    const topFloor = rect.top + pillPad + labelSize.height;
    const topClamped = Math.min(Math.max(wantTop, topFloor), rect.bottom - pillPad);
    el.style.left = leftClamped + 'px';
    el.style.top = topClamped + 'px';
"""

JOY_OLD = """    root.style.left = '28px';
    root.style.bottom = '28px';
    root.style.width = '174px';
    root.style.height = '174px';
"""
JOY_NEW = """    /* Build 33: in the phone's own corner. The play-test found the stick reading
     * as "a bit toward the middle"; it now sits inside the safe area, 8px from
     * the corner the left thumb actually reaches. */
    root.style.left = 'calc(env(safe-area-inset-left, 0px) + 8px)';
    root.style.bottom = 'calc(env(safe-area-inset-bottom, 0px) + 8px)';
    root.style.width = '174px';
    root.style.height = '174px';
"""


def patch_pills(scene: dict) -> None:
    group = find_group(scene, PILL_GROUP)
    if group is None:
        raise SystemExit(f"missing group: {PILL_GROUP}")
    code = code_of(group)
    if 'leftClamped' in code:
        return
    set_code(group, swap(code, PILL_OLD, PILL_NEW, "pills: clamp"))


def patch_joystick(scene: dict) -> None:
    group = find_group(scene, JOYSTICK_GROUP)
    if group is None:
        raise SystemExit(f"missing group: {JOYSTICK_GROUP}")
    code = code_of(group)
    if 'safe-area-inset-left' in code:
        return
    set_code(group, swap(code, JOY_OLD, JOY_NEW, "joystick: corner"))


# --------------------------------------------------------------------------- 5
def patch_fx(scene: dict) -> None:
    source = read("fx.js")
    existing = find_group(scene, FX_GROUP)
    if existing is not None:
        scene["events"].remove(existing)
    scene["events"].append(new_group(FX_GROUP, source, (255, 150, 60)))


# --------------------------------------------------------------------------- 6
STAGE_ART_OLD_CLASSIC = "  classic: null,\n"
STAGE_ART_CLASSIC = """  /* Build 33: the Classic Ice Arena is a place of its own now. It was the frost
   * lab - a near-black navy brick and a grey-blue floor - and the play-test could
   * not tell a runner from that floor. It keeps the same floor plan and the same
   * walls; what changes is the set: bright ice, a skate-marked rink, snow-capped
   * bricks, and its own air. wall_frostlab / floor_frostlab stay as the fallback
   * for a stage whose own PNGs are still arriving. */
  classic: {
    wall: 'wall_classic.png',
    cap: 'cap_classic.png',
    floor: 'floor_classic.png',
    wallTile: 0.3125,
    floorTile: 0.5,
    fog: 0x2a6086,
    fogNear: 1220,
    fogFar: 4200,
    sky: [18, 46, 70],
    glow: 0xccf6ff,
    pillar: 'pylon',
    long: 'rink',
    border: 'drift'
  },
"""

STAGE_KITS_ANCHOR = "/* Which walls of a stage carry which kit"

STAGE_KITS_NEW = """/* ---- Build 33: one more kit for every stage, and a set for the Classic rink.
 * A stage used to dress only the wall sizes its own floor plan used; these are
 * the same sizes with something on them, so every stage gains depth without a
 * single extra collider or a step into a lane. */
Object.assign(ICE_WOLF_PROP_KITS, {
  /* ---- classic ice arena ---- */
  pylon: [
    ['box', [64, 64, 10], [0, 0, 5], 0xbde8f8, 0],
    ['cyl', [10, 32, 74, 6], [0, 0, 47], 0x9fdcf6, 0],
    ['cyl', [6, 20, 40, 6], [0, 0, 100], 0xd6f2ff, 0],
    ['box', [12, 12, 24], [0, 0, 128], 0xffffff, 1],
    ['box', [26, 26, 6], [0, 0, 136], 0x9fe8ff, 1]
  ],
  rink: [
    ['box', [120, 26, 16], [0, 0, 8], 0xd8f0fb, 0],
    ['box', [120, 8, 10], [0, 0, 20], 0x8fd0ea, 0],
    ['cyl', [5, 5, 58, 6], [-52, 0, 21], 0x5f8fae, 0],
    ['cyl', [5, 5, 58, 6], [52, 0, 21], 0x5f8fae, 0],
    ['box', [124, 8, 8], [0, 0, 54], 0x7fc8e8, 0],
    ['box', [96, 10, 5], [0, 0, 46], 0xeafcff, 1]
  ],
  drift: [
    ['cyl', [46, 60, 26, 8], [0, 0, 13], 0xe8f6ff, 0],
    ['cyl', [4, 5, 66, 6], [0, 0, 39], 0x8fb6c4, 0],
    ['box', [30, 4, 20], [14, 0, 66], 0x62d8ff, 1],
    ['box', [6, 6, 6], [0, 0, 74], 0xffffff, 1]
  ],
  /* ---- aquarium ---- */
  urchin: [
    ['cyl', [16, 24, 12, 8], [0, 0, 6], 0x1c4a62, 0],
    ['box', [22, 22, 22], [0, 0, 21], 0x5b3fa0, 0],
    ['box', [5, 5, 24], [0, 0, 34], 0xffb3e6, 1],
    ['box', [5, 5, 18], [14, 0, 26], 0xffd0f2, 1],
    ['box', [5, 5, 16], [0, 14, 25], 0xc8a0ff, 1]
  ],
  /* ---- park ---- */
  flag: [
    ['cyl', [4, 6, 78, 6], [0, 0, 39], 0xefe2c6, 0],
    ['box', [40, 3, 24], [22, 0, 70], 0xff8fb0, 1],
    ['box', [5, 5, 6], [0, 0, 80], 0xffd34d, 1]
  ],
  /* ---- lodge ---- */
  sled: [
    ['box', [76, 28, 8], [0, 0, 30], 0xb8562e, 0],
    ['box', [66, 20, 10], [0, 0, 38], 0x8b3f22, 0],
    ['box', [76, 5, 5], [0, -12, 22], 0x5a2414, 0],
    ['box', [76, 5, 5], [0, 12, 22], 0x5a2414, 0],
    ['cyl', [4, 4, 20, 6], [-24, 0, 46], 0x3c2a18, 0],
    ['cyl', [4, 4, 20, 6], [24, 0, 46], 0x3c2a18, 0]
  ],
  /* ---- school ---- */
  clock: [
    ['cyl', [5, 5, 40, 6], [0, 0, 20], 0x8a8a86, 0],
    ['cyl', [26, 26, 6, 14], [0, 0, 48], 0xf2efe4, 1],
    ['box', [3, 16, 3], [0, 6, 52], 0x2a2a2a, 0],
    ['box', [11, 3, 3], [5, 0, 52], 0x2a2a2a, 0]
  ],
  /* ---- space ---- */
  satellite: [
    ['cyl', [6, 8, 34, 6], [0, 0, 17], 0x3a4855, 0],
    ['box', [18, 18, 24], [0, 0, 42], 0x8fa6bd, 0],
    ['box', [44, 4, 16], [-32, 0, 44], 0x5ef0ff, 1],
    ['box', [44, 4, 16], [32, 0, 44], 0x5ef0ff, 1],
    ['box', [6, 6, 6], [0, 0, 60], 0xff9434, 1]
  ]
});

"""

STAGE_SLOTS_OLD = """const ICE_WOLF_PROP_SLOTS = {
  aquarium: { '90x90': ['pillar', 1], '320x32': ['long', 1], '200x32': ['long', 1] },
  park: { '90x90': ['pillar', 1], '130x32': ['long', 1], '320x32': ['long', 1], '64x64': ['pillar', 1] },
  lodge: { '64x64': ['pillar', 1], '320x32': ['long', 1], '200x32': ['long', 1] },
  school: { '160x32': ['long', 2], '320x32': ['long', 1] },
  space: { '90x90': ['pillar', 1], '200x32': ['long', 1], '130x32': ['long', 1] }
};"""

STAGE_SLOTS_NEW = """const ICE_WOLF_PROP_SLOTS = {
  /* Build 33: the Classic rink is dressed like the five stages after it, and
   * every stage also dresses the wall sizes it used to leave bare (160x32,
   * 32x160, 130x32 and the 90x90 / 64x64 posts), so no part of a stage reads as
   * an empty brick strip. */
  classic: {
    '160x32': ['rink', 2], '32x160': ['rink', 2], '130x32': ['pylon', 1], '90x90': ['pylon', 1],
    '320x32': ['rink', 1], '200x32': ['rink', 1], '64x64': ['pylon', 1]
  },
  aquarium: {
    '90x90': ['urchin', 1], '320x32': ['long', 1], '200x32': ['long', 1],
    '160x32': ['long', 1], '32x160': ['long', 1], '64x64': ['pillar', 1]
  },
  park: {
    '90x90': ['pillar', 1], '130x32': ['long', 1], '320x32': ['long', 1], '64x64': ['pillar', 1],
    '160x32': ['flag', 1], '32x160': ['flag', 1], '200x32': ['long', 2]
  },
  lodge: {
    '64x64': ['pillar', 1], '320x32': ['long', 1], '200x32': ['long', 1],
    '160x32': ['sled', 1], '32x160': ['long', 1], '90x90': ['pillar', 1]
  },
  school: {
    '160x32': ['long', 2], '320x32': ['long', 1], '32x160': ['long', 1],
    '90x90': ['clock', 1], '64x64': ['pillar', 1], '200x32': ['long', 2]
  },
  space: {
    '90x90': ['pillar', 1], '200x32': ['long', 1], '130x32': ['long', 1],
    '160x32': ['long', 2], '32x160': ['satellite', 1], '320x32': ['long', 1]
  }
};"""

CLASSIC_RESOURCES = ["wall_classic.png", "cap_classic.png", "floor_classic.png"]


def patch_stage_art(scene: dict) -> None:
    """Give the Classic arena its own set, and put the room's air above every
    stage (tools/b33/stage_extra.js)."""
    group = find_group(scene, STAGE_GROUP)
    if group is None:
        raise SystemExit(f"missing group: {STAGE_GROUP}")
    if len(group["events"]) < 2:
        raise SystemExit("stage: the art block is missing from the stage group")
    block = group["events"][1]
    raw = block.get("inlineCode")
    code = "\n".join(raw) if isinstance(raw, list) else str(raw or "")
    if "ICE_WOLF_STAGE_BACKDROP" in code:
        return
    code = swap(code, STAGE_ART_OLD_CLASSIC, STAGE_ART_CLASSIC, "stage: classic art")
    code = swap(code, STAGE_KITS_ANCHOR, STAGE_KITS_NEW + STAGE_KITS_ANCHOR, "stage: kits")
    code = swap(code, STAGE_SLOTS_OLD, STAGE_SLOTS_NEW, "stage: slots")
    code = code.rstrip("\n") + "\n\n" + read("stage_extra.js").rstrip("\n") + "\n"
    block["inlineCode"] = code


def add_resources(game: dict) -> None:
    have = {resource["name"] for resource in game["resources"]["resources"]}
    for name in CLASSIC_RESOURCES:
        if name in have:
            continue
        game["resources"]["resources"].append({
            "file": f"assets/{name}", "kind": "image", "metadata": "",
            "name": name, "smoothed": True, "userAdded": True,
        })


NEW_VARIABLES = [
    ("PlayerRunSnow", 0),
    ("PlayerRunSnowTotal", 0),
    ("StageFxPillars", 0),
    ("StageFxRings", 0),
    ("StageFxShards", 0),
    ("StageFxFlashes", 0),
    ("StageFxPadRings", 0),
    ("StageFxLive", 0),
    ("StageFxFired", 0),
    ("StageFxStage", ""),
    ("StageCeiling", ""),
    ("StageLights", 0),
    ("StageProps", 0),
]


def add_variables(scene: dict) -> None:
    have = {variable["name"] for variable in scene["variables"]}
    for name, value in NEW_VARIABLES:
        if name in have:
            continue
        if isinstance(value, str):
            scene["variables"].append({"name": name, "value": value, "type": "string"})
        else:
            scene["variables"].append({"name": name, "value": value, "type": "number"})


def main() -> int:
    with open(GAME, encoding="utf-8") as handle:
        game = json.load(handle)
    scene = scene_of(game)
    add_variables(scene)

    patch_menu(scene)
    patch_characters(scene)
    patch_camera(scene)
    patch_pills(scene)
    patch_joystick(scene)
    patch_stage_art(scene)
    patch_fx(scene)
    add_resources(game)

    with open(GAME, "w", encoding="utf-8") as handle:
        json.dump(game, handle, ensure_ascii=False, indent=2)
    print("game.json updated for Build 33")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
