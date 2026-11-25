#!/usr/bin/env python3
"""Apply the ICE WOLF v1.2.0 sources in tools/v120/ to game.json.

The GDevelop project is the shipping artifact; these files are the readable
sources of the blocks this release adds or replaces:

  characters.js  replaces the body of  "v0.7.3 ブロックトイ3Dキャラ"
  labels.js      replaces the body of  "v0.6.2 Color-independent Actor ID Labels"
  settings.js    becomes the block   "v1.2.0 表示・操作設定"   (new, at the end)
  opening.js     becomes the block   "v1.2.0 オープニング"      (new, at the end)

It also registers the sprite resources, adds the twelve-language lines the new
rows need, refreshes the menu markup and bumps the version. Run it once from the
repository root:

  python3 tools/apply_v120.py
"""
from __future__ import annotations

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "tools", "v120")
GAME = os.path.join(ROOT, "game.json")

VERSION = "1.2.0"

CHARACTER_GROUP = "v0.7.3 ブロックトイ3Dキャラ"
LABEL_GROUP = "v0.6.2 Color-independent Actor ID Labels"
MENU_GROUP = "v0.6.5 Production Round Start + Main Menu"
I18N_GROUP = "v1.0.0 12言語 i18n"
SETTINGS_GROUP = "v1.2.0 表示・操作設定"
OPENING_GROUP = "v1.2.0 オープニング"

SPRITES = [f"chr_{who}_{outfit}.png"
           for who in ("h1", "h2", "w1")
           for outfit in ("classic", "aquarium", "park", "lodge", "school", "space")]

# [ja, en, zh-Hans, zh-Hant, ko, es, fr, de, pt, it, hi, id]
NEW_TEXTS = {
    "settings.textSize": ["文字サイズ", "Text size", "文字大小", "文字大小", "글자 크기", "Tamaño de texto",
                          "Taille du texte", "Textgröße", "Tamanho do texto", "Dimensione testo",
                          "टेक्स्ट आकार", "Ukuran teks"],
    "settings.control": ["操作", "Controls", "操作", "操作", "조작", "Controles", "Commandes", "Steuerung",
                         "Controles", "Comandi", "नियंत्रण", "Kontrol"],
    "settings.vibration": ["バイブ", "Vibration", "震动", "震動", "진동", "Vibración", "Vibration", "Vibration",
                           "Vibração", "Vibrazione", "कंपन", "Getar"],
    "display.standard": ["標準", "Standard", "标准", "標準", "보통", "Normal", "Normal", "Standard", "Padrão",
                         "Normale", "सामान्य", "Normal"],
    "display.large": ["大", "Large", "大", "大", "크게", "Grande", "Grand", "Groß", "Grande", "Grande",
                      "बड़ा", "Besar"],
    "display.xlarge": ["特大", "XL", "特大", "特大", "아주 크게", "Muy grande", "Très grand", "Sehr groß",
                       "Muito grande", "Molto grande", "बहुत बड़ा", "Sangat besar"],
    "display.note": ["メニューとHUDの文字が大きくなります。", "Menu and HUD text grows; the game stays the same.",
                     "菜单与HUD文字变大，游戏本身不变。", "選單與HUD文字變大，遊戲本身不變。",
                     "메뉴와 HUD 글자가 커집니다. 게임은 그대로입니다.",
                     "Crece el texto del menú y del HUD; el juego no cambia.",
                     "Le texte des menus et du HUD grandit ; le jeu ne change pas.",
                     "Menü- und HUD-Text werden größer; das Spiel bleibt gleich.",
                     "O texto do menu e do HUD cresce; o jogo não muda.",
                     "Il testo di menu e HUD cresce; il gioco resta uguale.",
                     "मेन्यू और HUD का टेक्स्ट बड़ा होता है; खेल वही रहता है।",
                     "Teks menu dan HUD membesar; permainannya tetap sama."],
    "control.stick": ["スティック", "Stick", "摇杆", "搖桿", "스틱", "Palanca", "Joystick", "Stick",
                      "Analógico", "Leva", "स्टिक", "Stik"],
    "control.touch": ["直接タッチ", "Touch", "直接触摸", "直接觸控", "직접 터치", "Tacto", "Tactile",
                      "Berühren", "Toque", "Tocco", "स्पर्श", "Sentuh"],
    "vibration.on": ["オン", "ON", "开", "開", "켬", "SÍ", "OUI", "EIN", "SIM", "SÌ", "चालू", "AKTIF"],
    "vibration.off": ["オフ", "OFF", "关", "關", "끔", "NO", "NON", "AUS", "NÃO", "NO", "बंद", "MATI"],
}

MENU_OLD = ('<div class="iw-menu"><button class="iw-btn iw-primary" data-action="start" data-i18n="menu.start"></button>'
            '<button class="iw-btn" data-action="stage"><span data-i18n="stage.menu"></span>'
            '<span class="iw-stage-now" data-stage-now style="display:block;font-size:.46em;font-weight:700;'
            'letter-spacing:.2px;opacity:.82;margin-top:2px"></span></button>'
            '<button class="iw-btn" data-action="online" data-i18n="online.menu"></button>'
            '<button class="iw-btn" data-action="how" data-i18n="menu.how"></button>'
            '<button class="iw-btn" data-action="record" data-i18n="menu.record"></button>'
            '<button class="iw-btn" data-action="settings" data-i18n="menu.settings"></button>'
            '<button class="iw-btn" data-action="pro" data-i18n="pro.menu"></button>'
            '<div class="iw-version">ICE WOLF v1.1.0</div></div>')

MENU_NEW = ('<div class="iw-menu">'
            '<button class="iw-btn iw-primary" data-action="start"><span class="iw-ico">▶</span>'
            '<span data-i18n="menu.start"></span></button>'
            '<button class="iw-btn" data-action="stage"><span class="iw-ico">🗺️</span><span class="iw-lbl">'
            '<span data-i18n="stage.menu"></span><span class="iw-stage-now" data-stage-now></span></span></button>'
            '<button class="iw-btn" data-action="online"><span class="iw-ico">📡</span>'
            '<span data-i18n="online.menu"></span></button>'
            '<div class="iw-row">'
            '<button class="iw-btn" data-action="how"><span class="iw-ico">📖</span>'
            '<span data-i18n="menu.how"></span></button>'
            '<button class="iw-btn" data-action="record"><span class="iw-ico">📊</span>'
            '<span data-i18n="menu.record"></span></button></div>'
            '<button class="iw-btn" data-action="settings"><span class="iw-ico">⚙️</span>'
            '<span data-i18n="menu.settings"></span></button>'
            '<button class="iw-btn" data-action="pro"><span class="iw-ico">💎</span>'
            '<span data-i18n="pro.menu"></span></button>'
            '<div class="iw-version">ICE WOLF v1.2.0</div></div>')

MENU_CSS = [
    # a phone that renders the sheet every frame cannot afford a backdrop blur
    ("backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}", "}"),
    (".iw-menu{display:flex;flex-direction:column;gap:13px;position:relative;z-index:1}",
     ".iw-menu{display:flex;flex-direction:column;gap:8px;position:relative;z-index:1}"
     ".iw-menu .iw-btn{display:flex;align-items:center;justify-content:center;gap:9px}"
     ".iw-ico{font-size:.82em;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45))}"
     ".iw-lbl{display:flex;flex-direction:column;line-height:1.05}"
     ".iw-stage-now{display:block;font-size:.46em;font-weight:700;letter-spacing:.2px;opacity:.82;margin-top:2px}"
     ".iw-menu .iw-row{gap:8px}.iw-menu .iw-row .iw-btn{min-height:52px}"),
    (".iw-btn{width:100%;min-height:64px;", ".iw-btn{width:100%;min-height:56px;"),
    ("@media (max-height:520px) and (orientation:landscape){.iw-card{min-height:auto;padding:16px 22px;gap:20px}",
     "@media (max-height:520px) and (orientation:landscape){.iw-card{min-height:auto;padding:12px 20px;gap:18px}"),
    (".iw-menu{gap:8px}.iw-btn{min-height:46px;font-size:clamp(15px,2.1vw,22px);border-radius:16px}",
     ".iw-menu{gap:6px}.iw-btn{min-height:42px;font-size:clamp(15px,2.1vw,22px);border-radius:15px}"
     ".iw-menu .iw-row .iw-btn{min-height:42px}"),
]


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


def new_group(name: str, code: str, colour: tuple[int, int, int]) -> dict:
    return {
        "colorB": colour[2], "colorG": colour[1], "colorR": colour[0],
        "creationTime": 0, "name": name, "source": "",
        "type": "BuiltinCommonInstructions::Group",
        "events": [{"type": "BuiltinCommonInstructions::JsCode", "inlineCode": code}],
    }


def add_resource(game: dict, name: str) -> None:
    resources = game["resources"]["resources"]
    if any(entry.get("name") == name for entry in resources):
        return
    resources.append({
        "alwaysLoaded": False,
        "file": f"assets/{name}",
        "kind": "image",
        "name": name,
        "smoothed": True,
        "userAdded": True,
    })


def patch_i18n(scene: dict) -> None:
    group = find_group(scene, I18N_GROUP)
    if group is None:
        raise SystemExit(f"missing group: {I18N_GROUP}")
    code = code_of(group)
    lines = []
    for key, values in NEW_TEXTS.items():
        if f"'{key}'" in code:
            continue
        if len(values) != 12:
            raise SystemExit(f"{key} does not carry twelve languages")
        lines.append("  '%s': [%s]," % (key, ", ".join(json.dumps(value, ensure_ascii=False) for value in values)))
    if not lines:
        return
    anchor = "  'stamp.gg':"
    index = code.find(anchor)
    if index < 0:
        raise SystemExit("the i18n table has no stamp.gg row to insert after")
    end = code.find("\n", index)
    code = code[:end + 1] + "\n".join(lines) + "\n" + code[end + 1:]
    set_code(group, code)


def patch_menu(scene: dict) -> None:
    group = find_group(scene, MENU_GROUP)
    if group is None:
        raise SystemExit(f"missing group: {MENU_GROUP}")
    code = code_of(group)
    if MENU_OLD not in code:
        if 'iceWolfV120Menu' in code:
            return
        raise SystemExit("the menu markup has moved: update MENU_OLD in tools/apply_v120.py")
    code = code.replace(MENU_OLD, MENU_NEW)
    for old, new in MENU_CSS:
        if old not in code:
            raise SystemExit(f"the menu CSS has moved: {old[:60]}...")
        code = code.replace(old, new)
    code = code.replace("obj.setString('ICE WOLF v1.1.0')", "obj.setString('ICE WOLF v1.2.0')")
    if 'iceWolfV120Menu' not in code:
        # a marker the tests and this script can find without matching the markup
        code = code.replace("root.dataset.iceWolfV065Production = '1';",
                            "root.dataset.iceWolfV065Production = '1';\n  root.dataset.iceWolfV120Menu = '1';")
    set_code(group, code)


def main() -> int:
    with open(GAME, encoding="utf-8") as handle:
        game = json.load(handle)
    scene = scene_of(game)

    for group_name, source in ((CHARACTER_GROUP, "characters.js"), (LABEL_GROUP, "labels.js")):
        group = find_group(scene, group_name)
        if group is None:
            raise SystemExit(f"missing group: {group_name}")
        set_code(group, read(source))

    for name, source, colour in (
        (OPENING_GROUP, "opening.js", (255, 120, 90)),
        (SETTINGS_GROUP, "settings.js", (60, 210, 170)),
    ):
        existing = find_group(scene, name)
        if existing is not None:
            scene["events"].remove(existing)
        scene["events"].append(new_group(name, read(source), colour))

    patch_i18n(scene)
    patch_menu(scene)

    for sprite in SPRITES:
        add_resource(game, sprite)

    game["properties"]["version"] = VERSION
    with open(GAME, "w", encoding="utf-8") as handle:
        json.dump(game, handle, ensure_ascii=False, indent=2)
    print(f"game.json updated: {len(SPRITES)} sprites, {len(NEW_TEXTS)} new lines, {VERSION}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
