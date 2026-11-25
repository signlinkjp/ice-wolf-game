#!/usr/bin/env python3
"""Apply the ICE WOLF v1.2.0 Build 34 changes to game.json.

Build 34 answers the first device recording of Build 33. Five things change,
all of them inside the shipping GDevelop project:

  1. THE HUD BUTTONS WORK IN DIRECT-TOUCH MODE (block "v1.2.0 表示・操作設定").
     Build 33's direct-touch pad was a full-screen <div> over the canvas, so the
     [ 救助 ] button was drawn but never tapped. The pad is now decoration only:
     the gesture is read at the window, only on the canvas, and a touch that
     lands on a HUD control is handed to the game instead of becoming movement.
  2. THE RUN READS AS A RUN (block "v0.7.3 ブロックトイ3Dキャラ"). A taller body,
     a faster four-frame cycle, a deeper stride bounce with squash and stretch,
     a stronger lean and bigger snow at the feet.
  3. THE CAMERA COMES IN (the native camera actions). 500/58 -> 460/54 normal,
     980/80 -> 900/76 overview, and the spectator and frozen geometries follow,
     so a toy is bigger on the screen and a wall top hides less of the ice.
  4. THE STAGE KEEPS ITS COLOUR (the art block and tools/b34/stage_extra.js).
     The light rig is turned down from "two whole extra lights" to a bounce, a
     shape light and a cool rim; every wall wears a merged, overhanging snow cap
     so it reads as a block from above; and each stage has weather (snow, bubbles,
     petals, embers, dust, stars) in one Points mesh.
  5. THE PLAY SCREEN READS AS A PHONE GAME (new group "v1.2.0 ポップHUD"). The
     same translated lines the event sheet writes are drawn again as chips, a
     big timer, a hint bar, a toast and a winner banner, and the native text is
     faded behind them.

The three Classic textures are redrawn by tools/b34/make_classic_textures.py;
this script only touches game.json.

  python3 tools/apply_build34.py
"""
from __future__ import annotations

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "tools", "b34")
GAME = os.path.join(ROOT, "game.json")

SETTINGS_GROUP = "v1.2.0 表示・操作設定"
CHARACTER_GROUP = "v0.7.3 ブロックトイ3Dキャラ"
STAGE_GROUP = "v1.1.0 ステージ・衣装"
POP_HUD_GROUP = "v1.2.0 ポップHUD"

TOUCH_START = "/* ------------------------------------------------------ the direct-touch pad"
TOUCH_END = "/* --------------------------------------------------------------- the buzz */"
STAGE_START = "/* ICE WOLF v1.2.0 Build 33 — the air above the arena, and the light on it."


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


def code_of(group: dict, index: int = 0) -> str:
    block = group["events"][index].get("inlineCode")
    return "\n".join(block) if isinstance(block, list) else str(block or "")


def set_code(group: dict, code: str, index: int = 0) -> None:
    group["events"][index] = {"type": "BuiltinCommonInstructions::JsCode", "inlineCode": code}


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
def patch_touch_pad(scene: dict) -> None:
    group = find_group(scene, SETTINGS_GROUP)
    if group is None:
        raise SystemExit(f"missing group: {SETTINGS_GROUP}")
    code = code_of(group)
    if "HUD_TOUCH_OBJECTS" in code:
        return
    start = code.find(TOUCH_START)
    end = code.find(TOUCH_END)
    if start < 0 or end < 0 or end <= start:
        raise SystemExit("touch pad: the section markers have moved")
    replacement = read("touch_pad.js").rstrip("\n") + "\n\n"
    code = code[:start] + replacement + code[end:]
    set_code(group, code)


# --------------------------------------------------------------------------- 2
CHARACTER_SWAPS = [
    (
        """/* World pixels: a toy was 48px tall in the 1.0.0 block model and a wall is
 * 160. Build 33: a body stands 112 against that wall - the play-test could not
 * tell a runner from the floor at 70, and a figure you can see is the whole
 * point of the run cycle underneath it. */
const BODY_HEIGHT = 112;
const BODY_WIDTH = BODY_HEIGHT * 0.66;
const STEPS_PER_FRAME = 9;""",
        """/* World pixels: a toy was 48px tall in the 1.0.0 block model and a wall is
 * 160. Build 33: a body stands 112 against that wall - the play-test could not
 * tell a runner from the floor at 70, and a figure you can see is the whole
 * point of the run cycle underneath it. Build 34: 122, and a stride is eighteen
 * pixels of travel rather than nine. Nine made the four poses strobe (four
 * cycles a second at a jog), which the eye reads as a blur - the sliding picture
 * of the play-test. Eighteen is about one and a half strides a second: each pose
 * holds long enough to be seen, and the body's bounce and squash carry the beat
 * between them. */
const BODY_HEIGHT = 122;
const BODY_WIDTH = BODY_HEIGHT * 0.68;
const STEPS_PER_FRAME = 18;""",
        "characters: size and cadence",
    ),
    (
        "    size: 15, map: texture, vertexColors: true, transparent: true, opacity: 1,",
        "    size: 19, map: texture, vertexColors: true, transparent: true, opacity: 1,",
        "characters: bigger snow",
    ),
    (
        "            rig.leanGoal = rig.mirror ? 0.13 : -0.13;",
        "            rig.leanGoal = rig.mirror ? 0.17 : -0.17;",
        "characters: lean",
    ),
    (
        "    const bob = running ? Math.abs(Math.sin((rig.walk / (STEPS_PER_FRAME * FRAME_COUNT)) * Math.PI * 2)) * 6.5 : 0;",
        "    const bob = running ? Math.abs(Math.sin((rig.walk / (STEPS_PER_FRAME * FRAME_COUNT)) * Math.PI * 2)) * 10.5 : 0;",
        "characters: bounce",
    ),
    (
        """    const shrink = view.frozen ? 0.94 : 1;
    rig.sprite.scale.set(BODY_WIDTH * shrink, BODY_HEIGHT * shrink, 1);  } catch (error) {""",
        """    const shrink = view.frozen ? 0.94 : 1;
    /* Build 34: the stride squashes and stretches the body. Two footfalls per
     * four-frame cycle, so the body is at its tallest as a foot leaves the ice
     * and at its widest as it lands - the piece of a run that a still picture
     * cannot show and a sliding picture never had. */
    const stride = running ? Math.sin((rig.walk / (STEPS_PER_FRAME * FRAME_COUNT)) * Math.PI * 4) : 0;
    const stretch = 1 + stride * 0.07;
    const squash = 1 - stride * 0.055;
    rig.sprite.scale.set(BODY_WIDTH * shrink * squash, BODY_HEIGHT * shrink * stretch, 1);  } catch (error) {""",
        "characters: squash and stretch",
    ),
]


def patch_characters(scene: dict) -> None:
    group = find_group(scene, CHARACTER_GROUP)
    if group is None:
        raise SystemExit(f"missing group: {CHARACTER_GROUP}")
    code = code_of(group)
    if "const BODY_HEIGHT = 122;" in code:
        return
    for old, new, label in CHARACTER_SWAPS:
        code = swap(code, old, new, label)
    set_code(group, code)


# --------------------------------------------------------------------------- 3
# [index, from, to] per native camera action. In "LookFromDistanceAtObject3D"
# the parameter list is [placeholder, object, 3D behaviour, Distance,
# RotationAngle, ElevationAngle, Layer, extra]: the distance is 3 and the
# elevation is 5. Build 33 left "58" in the Layer slot, which compiles to the
# default layer and changes nothing - Build 34 clears it.
CAMERA_STEPS = {
    "LookFromDistanceAtObject3D": [
        (3, "500", "470"), (5, "53", "50"), (6, "58", "\"\""),
        (3, "980", "900"), (5, "78", "73"),
        (3, "600", "540"), (5, "53", "50"),
        (3, "1050", "960"), (5, "78", "73"),
    ],
    "LookFromDistanceAtPosition3D": [
        (4, "1500", "1350"), (6, "86", "82"),
    ],
}


def patch_camera(game: dict) -> int:
    changed = 0

    def walk(events):
        nonlocal changed
        for event in events:
            for action in event.get("actions") or []:
                kind = action.get("type")
                kind = kind.get("value") if isinstance(kind, dict) else kind
                steps = CAMERA_STEPS.get(str(kind or "").split("::")[-1])
                if not steps:
                    continue
                params = action.get("parameters") or []
                for index, old, new in steps:
                    if index < len(params) and str(params[index]) == old:
                        params[index] = new
                        changed += 1
            for sub in event.get("events") or []:
                walk([sub])

    for layout in game["layouts"]:
        walk(layout.get("events") or [])
    return changed


# --------------------------------------------------------------------------- 4
def patch_stage_extra(scene: dict) -> None:
    group = find_group(scene, STAGE_GROUP)
    if group is None:
        raise SystemExit(f"missing group: {STAGE_GROUP}")
    if len(group["events"]) < 2:
        raise SystemExit("stage: the art block is missing from the stage group")
    code = code_of(group, 1)
    if "iceWolfV120WallCaps" in code:
        return
    start = code.find(STAGE_START)
    if start < 0:
        raise SystemExit("stage: the Build 33 tail has moved")
    code = code[:start].rstrip("\n") + "\n\n" + read("stage_extra.js").rstrip("\n") + "\n"
    set_code(group, code, 1)


# --------------------------------------------------------------------------- 5
def patch_pop_hud(scene: dict) -> None:
    source = read("pop_hud.js")
    existing = find_group(scene, POP_HUD_GROUP)
    if existing is not None:
        scene["events"].remove(existing)
    scene["events"].append(new_group(POP_HUD_GROUP, source, (90, 210, 255)))


# --------------------------------------------------------------------------- 6
NEW_VARIABLES = [
    ("StageWeather", 0),
    ("StageWallCaps", 0),
    ("PlayerHudPopReady", 0),
    ("PlayerHudPopChips", 0),
    ("PlayerHudTapGuard", 0),
    ("PlayerTouchPadReady", 0),
]


def add_variables(scene: dict) -> None:
    have = {variable["name"] for variable in scene["variables"]}
    for name, value in NEW_VARIABLES:
        if name in have:
            continue
        if isinstance(value, str):
            scene["variables"].append({"name": name, "value": value, "type": "string"})
        elif isinstance(value, bool):
            scene["variables"].append({"name": name, "value": value, "type": "boolean"})
        else:
            scene["variables"].append({"name": name, "value": value, "type": "number"})


def main() -> int:
    with open(GAME, encoding="utf-8") as handle:
        game = json.load(handle)
    scene = scene_of(game)
    add_variables(scene)

    patch_touch_pad(scene)
    patch_characters(scene)
    cameras = patch_camera(game)
    patch_stage_extra(scene)
    patch_pop_hud(scene)

    with open(GAME, "w", encoding="utf-8") as handle:
        json.dump(game, handle, ensure_ascii=False, indent=2)
    print(f"game.json updated for Build 34 (camera actions patched: {cameras})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
