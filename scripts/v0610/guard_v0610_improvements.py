#!/usr/bin/env python3
"""Semantic guard for the ICE WOLF v0.6.10 minimal-label / concealed-identity round.

Run by GitHub Actions from the repository root (it reads the relative game.json).
"""
import json
import os
import struct
import sys

data = json.load(open('game.json', encoding='utf-8'))
problems = []


def check(condition, message):
    if not condition:
        problems.append(message)


check(data.get('firstLayout') == 'FROST LAB', 'firstLayout is not FROST LAB')
scene = next(l for l in data['layouts'] if l['name'] == 'FROST LAB')
events = scene['events']
names = [e.get('name') for e in events]
order = {name: index for index, name in enumerate(names) if name}
objects = {o['name']: o for o in scene['objects']}
scene_vars = {v['name']: v for v in scene['variables']}
res_list = data['resources']['resources']
raw = json.dumps(data, ensure_ascii=False)

# --- unchanged core: counter, wolf role pick, resources, colours -------------
group = next((e for e in events if e.get('name') == 'v0.6.5 Survivor/Frozen counter + Wolf role pick'), None)
check(group is not None, 'counter/pick group missing')
if group:
    check(len(group['events']) == 4, 'counter/pick group must hold 4 JS events')
    blocks = ['\n'.join(ev['inlineCode']) for ev in group['events']]
    check('生存: ' in blocks[0] and '凍結: ' in blocks[0], 'counter text missing')
    check('AliveHumans' in blocks[0], 'alive count missing')
    check('人狼の勝利' in blocks[1] and 'GameOver' in blocks[1], 'instant win block missing')
    check('FrozenWolfCandidate' in blocks[2], 'wolf role designation missing')
    check('WolfRolePickTarget' in blocks[3] and 'WolfRolePickOpen' in blocks[3], 'picker DOM missing')

check('CountText' in objects and objects['CountText']['type'] == 'TextObject::Text', 'CountText object missing')
check(objects.get('InfectButton', {}).get('string') == '[ 人狼役にする ]', 'wolf role button label not applied')
check(any(i['name'] == 'CountText' and i['layer'] == 'UI' for i in scene['instances']), 'CountText instance missing')

for name in ('AliveHumans', 'FrozenHumans', 'NearbyFrozenCount',
             'WolfRolePickOpen', 'WolfRolePickTarget', 'WolfRolePickCount',
             'WolfBirthPlayerTrap', 'RolePreference', 'DurationPreference',
             'RestartConfirmOpen', 'RestartUiReady', 'RestartUiVisible', 'RestartConfirmVisible'):
    check(name in scene_vars, f'scene variable {name} missing')

defaults = {v['name']: v['value'] for v in scene['variables']}
check(defaults.get('MatchDuration') == 210, 'MatchDuration drifted')
check(defaults.get('MatchTimeLeft') == 210, 'MatchTimeLeft default drifted')
check(defaults.get('WolfModeDuration') == 5, 'WolfModeDuration drifted')
check(defaults.get('WolfCooldown') == 5, 'WolfCooldown drifted')
check(defaults.get('RolePreference') == 'Random', 'RolePreference default is not Random')
check(defaults.get('DurationPreference') == 0, 'DurationPreference must start unset (0)')

check(sum(1 for i in scene['instances'] if i['name'] == 'Actor') == 6, 'Actor count drifted')
check(sum(1 for i in scene['instances'] if i['name'] == 'Player') == 1, 'Player count drifted')

test_names = [t['name'] for t in data['tests']]
protected_tests = (
    'Stability self-test',
    'Wall block check',
    'STEP1 bounds test',
    'STEP2 core test',
    'v0.3 action clarity test',
    'v0.6.0 human-side CPU Wolf test',
    'v0.6.0 CPU Wolf device diagnostic test',
    'v0.6.1 Human CPU navigation recovery test',
    'v0.6.2 Color-independent Actor ID Labels test',
    'v0.6.3 Mobile Virtual Joystick test',
    'v0.6.4 Compact Joystick + Overview Camera test',
    'v0.6.4 Device Tuning liveness test',
    'v0.6.5 Production Round Start test',
    'v0.6.5 Wolf Mode Multi-Freeze test',
    'v0.6.5 Human Timeout Win Fast test',
    'v0.6.5 All Frozen Instant Wolf Win test',
    'v0.6.5 Survivor Frozen Counter test',
    'v0.6.5 Wolf Role Pick test',
    'v0.6.7 Role Choice test',
    'v0.6.7 Match Duration test',
    'v0.6.7 Restart Menu test',
    'v0.6.8 Hold Rescue test',
    'v0.6.8 Speed Pad + Warp test',
    'v0.6.8 Character 3D Rig test',
    'v0.6.9 Circular Rescue Meter test',
    'v0.6.9 Sound FX test',
    'v0.6.9 Label Size + Chase Camera test',
    'v0.6.10 Concealed Identity test',
    'v0.6.10 Menu Hero test',
)
for name in protected_tests:
    check(name in test_names, f'test {name} missing')

protected_groups = (
    'v0.6.4 Device-Tuned Mobile Virtual Joystick UI',
    'v0.6.8 スピード床＆ワープ',
    'v0.6.3 Virtual joystick + keyboard movement (fixed camera)',
    'Wall separation (fail-safe)',
    'v0.6.4 Overview Camera Toggle UI',
    'v0.6.4 Normal + Overview camera',
    'Playable bounds + failsafe',
    'Wolf match flow',
    'v0.6.5 Survivor/Frozen counter + Wolf role pick',
    'v0.6.9 円形解凍リング',
    'Wolf actions',
    'v0.3 Action clarity feedback',
    'v0.3.5 actor size parity + frozen color enforcement',
    'v0.3.4 guaranteed solid-state visuals',
    'v0.6.1 Human CPU Navigation Recovery + CPU Wolf Cycle',
    'v0.6.0 CPU Wolf device diagnostic status',
    'v0.6.2 Color-independent Actor ID Labels',
    'v0.6.5 Production Round Start + Main Menu',
    'v0.6.6 第二の人狼 秘匿通知',
    'v0.6.7 役割・時間の設定 + プレイ中のやり直し',
    'v0.6.8 キャラ3D見た目進化',
    'v0.6.9 サウンドエンジン + サウンド設定',
)
for name in protected_groups:
    check(name in names, f'protected group {name} missing')

# --- v0.6.6 visuals ---------------------------------------------------------
for texture in ('floor_frostlab.png', 'wall_frostlab.png', 'ice_freeze.png'):
    entry = next((r for r in res_list if r['name'] == texture), None)
    check(entry is not None, f'resource {texture} missing')
    if entry is None:
        continue
    check(entry.get('file') == 'assets/' + texture, f'{texture} is not registered as a repo-relative asset')
    check(entry.get('kind') == 'image', f'{texture} kind is not image')

# --- v0.6.10 (1) minimal head labels ---------------------------------------
labels = next(e for e in events if e.get('name') == 'v0.6.2 Color-independent Actor ID Labels')
label_code = '\n'.join(labels['events'][0]['inlineCode'])
for needle in ('const LABEL_FONT_SIZE = 11;',
               'const LABEL_LINE_HEIGHT = 13;',
               'const LABEL_MIN_WIDTH = 16;',
               'const LABEL_MIN_WIDTH_YOU = 24;',
               'const LABEL_PADDING_X = 4;',
               'const LABEL_PADDING_Y = 1;',
               'const LABEL_RADIUS = 5;',
               'const LABEL_BORDER_WIDTH = 1;',
               'const LABEL_OFFSET_Y = 13;',
               "vars.get('ActorIdLabelFontSize').setNumber(LABEL_FONT_SIZE);",
               "vars.get('ActorIdLabelLineHeight').setNumber(LABEL_LINE_HEIGHT);",
               "vars.get('ActorIdLabelMinWidth').setNumber(LABEL_MIN_WIDTH);",
               "vars.get('ActorIdLabelMinWidthYou').setNumber(LABEL_MIN_WIDTH_YOU);",
               "vars.get('ActorIdLabelPaddingX').setNumber(LABEL_PADDING_X);",
               "vars.get('ActorIdLabelRadius').setNumber(LABEL_RADIUS);",
               "vars.get('ActorIdLabelBorderWidth').setNumber(LABEL_BORDER_WIDTH);",
               "vars.get('ActorIdLabelOffsetY').setNumber(LABEL_OFFSET_Y);",
               "el.style.fontSize = LABEL_FONT_SIZE + 'px';",
               "el.style.lineHeight = LABEL_LINE_HEIGHT + 'px';",
               "el.style.minWidth = (id === 'YOU' ? LABEL_MIN_WIDTH_YOU : LABEL_MIN_WIDTH) + 'px';",
               "el.style.padding = LABEL_PADDING_Y + 'px ' + LABEL_PADDING_X + 'px';",
               "el.style.borderRadius = LABEL_RADIUS + 'px';",
               "el.style.border = LABEL_BORDER_WIDTH + 'px solid rgba(255,255,255,0.88)';",
               'rect.height - LABEL_OFFSET_Y;',
               "el.style.pointerEvents = 'none';",
               'expectedIds',
               'DisplayId'):
    check(needle in label_code, f'label marker missing: {needle}')
for banned in ('const LABEL_FONT_SIZE = 14;', "el.style.lineHeight = '17px';",
               "id === 'YOU' ? '30px' : '19px'", "el.style.borderRadius = '7px';",
               "el.style.border = '1.5px solid", "el.style.padding = '1px 5px';",
               'rect.height - 16;'):
    check(banned not in label_code, f'the old label geometry survived: {banned}')

label_defaults = {
    'ActorIdLabelFontSize': 11,
    'ActorIdLabelLineHeight': 13,
    'ActorIdLabelMinWidth': 16,
    'ActorIdLabelMinWidthYou': 24,
    'ActorIdLabelPaddingX': 4,
    'ActorIdLabelRadius': 5,
    'ActorIdLabelBorderWidth': 1,
    'ActorIdLabelOffsetY': 13,
}
for name, value in label_defaults.items():
    entry = scene_vars.get(name)
    check(entry is not None, f'scene variable {name} missing (the label code reads it without a guard)')
    if entry is not None:
        check(entry['value'] == value, f'{name} default drifted: {entry["value"]}')
        check(entry['type'] == 'number', f'{name} must be a number variable')

# --- v0.6.10 (2) concealed identity ---------------------------------------
rig = next(e for e in events if e.get('name') == 'v0.6.8 キャラ3D見た目進化')
rig_code = '\n'.join(rig['events'][0]['inlineCode'])
for needle in ("const playerObject = players.length ? players[0] : null;",
               "const playerWolfModeLeft = wolfModeLeftVar ? wolfModeLeftVar.getAsNumber() : 0;",
               'const applyRigState = (obj, rig, isPlayer) => {',
               "const aiWolfVar = isPlayer ? null : objectVars.get('AIWolfModeLeft');",
               'const modeLeft = isPlayer ? playerWolfModeLeft : aiWolfVar ? aiWolfVar.getAsNumber() : 0;',
               'const isWolf = role === \'Wolf\';',
               'const transformed = isWolf && !frozen && modeLeft > 0;',
               'const lurking = isWolf && !transformed && !frozen;',
               'rig.headMat.color.setHex(COLOR.humanHead);',
               'rig.visorMat.color.setHex(transformed ? COLOR.visorWolf : COLOR.visorHuman);',
               'rig.cap.visible = !transformed;',
               'rig.earL.visible = transformed;',
               'rig.earR.visible = transformed;',
               'rig.ice.visible = frozen;',
               'const view = applyRigState(obj, rig, obj === playerObject);',
               "vars.get('CharacterRigTransformed').setNumber(transformedTotal);",
               "vars.get('CharacterRigLurking').setNumber(lurkingTotal);",
               "'iceWolfHead'", "'iceWolfVisor'", "'iceWolfCap'", "'iceWolfEarL'", "'iceWolfEarR'", "'iceWolfIce'",
               'CharacterRigCount', 'CharacterRigMeshes', 'CharacterRigFrozen', 'CharacterRigMode'):
    check(needle in rig_code, f'rig marker missing: {needle}')
for banned in ('COLOR.wolfHead', 'wolfHead:', 'setHex(isWolf ?', 'rig.cap.visible = !isWolf;',
               'rig.earL.visible = isWolf;', 'rig.earR.visible = isWolf;',
               'setWidth(', 'setHeight(', 'setDepth(', 'setSize('):
    check(banned not in rig_code, f'the old role-revealing or resizing code survived: {banned}')
check("const key = role + '|' + frozen + '|' + (transformed ? 'wolf' : 'human');" in rig_code,
      'the rig cache key ignores the transform state')
check(rig_code.count('rig.key !== key') == 1, 'the rig state is not applied through its cache key')

for name in ('CharacterRigTransformed', 'CharacterRigLurking'):
    entry = scene_vars.get(name)
    check(entry is not None, f'scene variable {name} missing (the rig code writes it)')
    if entry is not None:
        check(entry['value'] == 0, f'{name} must start at 0')
        check(entry['type'] == 'number', f'{name} must be a number variable')

# --- v0.6.10 (3) the body colour follows the same rule ----------------------
solid = next(e for e in events if e.get('name') == 'v0.3.4 guaranteed solid-state visuals')
solid_code = '\n'.join(solid['events'][0]['inlineCode'])
for needle in ('const ICE_TINT = 0x5ee7ff;',
               'const WOLF_BODY = 0x8b0000;',
               "else if (role === 'Wolf' && aiWolfModeLeft > 0) setSolidColor(actor, WOLF_BODY, false);",
               "else if (role === 'Wolf' && wolfModeLeft > 0) setSolidColor(player, WOLF_BODY, false);",
               'else setSolidColor(actor, 0xffffff, false);',
               'else setSolidColor(player, 0xffffff, false);',
               'FrozenWolfCandidate', 'ice_freeze.png'):
    check(needle in solid_code, f'solid-state marker missing: {needle}')
check('0x0077ff' not in solid_code, 'the old blue wolf-mode body is still in the solid-state layer')
check('setSolidColor(player, 0x8b0000' not in solid_code, 'the player body colour is not shared with the actors')
check("if (state === 'Frozen') setSolidColor(player, ICE_TINT, true);" in solid_code,
      'the frozen player lost the ice tint')
check('"255;0;0"' not in raw, 'a red freeze tint remains somewhere in the project')

# --- v0.6.7 production menu -------------------------------------------------
production = next(e for e in events if e.get('name') == 'v0.6.5 Production Round Start + Main Menu')
prod_code = '\n'.join(production['events'][0]['inlineCode'])
for needle in ('data-screen="menu"', 'data-screen="reveal"', 'data-screen="countdown"',
               'data-screen="result"', "currentPhase === 'Countdown'",
               "left > 2.1 ? '3'", '5秒間の人狼モード中は', '人狼役', '全員凍結で決着',
               '❄ Prototype v0.6.10', '開発版 v0.6.10',
               '見た目は全員同じ', '人狼モード中だけ赤い耳と赤い姿になる'):
    check(needle in prod_code, f'production UI marker missing: {needle}')
for stale in ('Prototype v0.6.6', 'Prototype v0.6.7', 'Prototype v0.6.8', 'Prototype v0.6.9',
              '開発版 v0.6.7', '開発版 v0.6.8', '開発版 v0.6.9', '開発版 v0.6.6', 'v0.6.5-DIAG'):
    check(stale not in raw, f'an old version marker remains: {stale}')
for needle in ('data-action="roleRandom"', 'data-action="roleWolf"', 'data-action="roleHuman"',
               'おまかせ', '人狼で遊ぶ', '人間で逃げる',
               'data-action="time120"', 'data-action="time180"', 'data-action="time300"',
               '>2分<', '>3分<', '>5分<', 'data-action="soundToggle"'):
    check(needle in prod_code, f'menu marker missing: {needle}')

# --- v0.6.10 (4) start-screen hero visual + HUD masking ---------------------
for needle in ('data-menu-hero="1"',
               'MENU_HERO_FILE',
               "const MENU_HERO_FILE = 'assets/menu_hero.png';",
               '${assetBase}${MENU_HERO_FILE}',
               '.iw-hero{position:relative',
               '.iw-hero-img{display:block',
               'linear-gradient(140deg,rgba(95,233,255,.96),rgba(255,79,96,.94))',
               'backdrop-filter:blur(4px)',
               'linear-gradient(rgba(1,9,17,.975),rgba(0,6,14,.99))',
               '.iw-rule{width:min(190px,54%)',
               '<div class="iw-title">ICE WOLF</div><div class="iw-rule"></div>',
               'Find the wolf. Freeze or survive.',
               "vars.get('MenuHeroReady').setBoolean(!!heroImage);",
               "vars.get('MenuHeroSource').setString(heroSource);",
               "vars.get('MenuHudMasked').setBoolean(!activeForUi);",
               "for (const hudName of ['RoleText', 'StatusText', 'BuildText', 'ActionFeedbackText', 'WinText']) setObjVisible(hudName, activeForUi);"):
    check(needle in prod_code, f'start-screen marker missing: {needle}')
for banned in ('<svg class="iw-wolf"', '.iw-wolf{', 'aria-label="ICE WOLF emblem"'):
    check(banned not in prod_code, f'the old wolf emblem is still in the start screen: {banned}')
check("getAssetPath" in prod_code and "const assetBase" in prod_code,
      'the hero image does not resolve through the game asset path')

hero = next((r for r in res_list if r['name'] == 'menu_hero.png'), None)
check(hero is not None, 'resource menu_hero.png is not registered (the HTML5 export would miss it)')
if hero is not None:
    check(hero.get('file') == 'assets/menu_hero.png', f'menu_hero.png file drifted: {hero.get("file")}')
    check(hero.get('kind') == 'image', 'menu_hero.png kind is not image')
    path = hero.get('file', '')
    if not os.path.isfile(path):
        problems.append(f'menu_hero.png missing on disk at {path}')
    else:
        with open(path, 'rb') as handle:
            header = handle.read(24)
        check(header[:8] == b'\x89PNG\r\n\x1a\n', 'menu_hero.png is not a PNG')
        width, height = struct.unpack('>II', header[16:24])
        check(width == 320 and height == 320, f'menu_hero.png is {width}x{height}')
        size = os.path.getsize(path)
        check(size < 90 * 1024, f'menu_hero.png is too heavy for the HTML5 build: {size} bytes')
        check(size > 20 * 1024, f'menu_hero.png looks truncated: {size} bytes')

hero_defaults = {'MenuHeroReady': False, 'MenuHeroLoaded': False, 'MenuHudMasked': False}
for name, value in hero_defaults.items():
    entry = scene_vars.get(name)
    check(entry is not None, f'scene variable {name} missing')
    if entry is not None:
        check(entry['value'] is value, f'{name} must start {value}')
        check(entry['type'] == 'boolean', f'{name} must be a boolean variable')
entry = scene_vars.get('MenuHeroSource')
check(entry is not None, 'scene variable MenuHeroSource missing')
if entry is not None:
    check(entry['value'] == '', 'MenuHeroSource must start empty')
    check(entry['type'] == 'string', 'MenuHeroSource must be a string variable')

build_text = objects.get('BuildText', {}).get('string')
check(build_text == '開発版 v0.6.10', f'BuildText default is stale: {build_text}')

# --- v0.6.9 features stay in place -----------------------------------------
hold = next((e for e in events if e.get('name') == 'v0.6.9 円形解凍リング'), None)
check(hold is not None, 'v0.6.9 ring group missing')
ring_code = '\n'.join(hold['events'][3]['inlineCode']) if hold else ''
for needle in ('RING_DIAMETER = 68', 'stroke-dashoffset', 'RescueHoldMeterPercent',
               'RescueHoldMeterMode', 'RescueHoldMeterVisible', "解凍！"):
    check(needle in ring_code, f'ring marker missing: {needle}')
sound = next(e for e in events if e.get('name') == 'v0.6.9 サウンドエンジン + サウンド設定')
sound_code = '\n'.join(sound['events'][0]['inlineCode'])
for needle in ('iceWolfSoundEnabled', 'AudioContext', 'SoundEngineReady', 'SoundToggleRequest'):
    check(needle in sound_code, f'sound marker missing: {needle}')
check(names[-1] == 'v0.6.9 サウンドエンジン + サウンド設定', 'the sound observer must run last in the frame')

camera = next(e for e in events if e.get('name') == 'v0.6.4 Normal + Overview camera')
chase = next(a for sub in camera['events'] for a in sub['actions']
             if a['type']['value'] == 'ThirdPersonCamera::LookFromDistanceAtObject3D'
             and sub['conditions'][0]['parameters'][1] == 'False')
overview = next(a for sub in camera['events'] for a in sub['actions']
                if a['type']['value'] == 'ThirdPersonCamera::LookFromDistanceAtObject3D'
                and sub['conditions'][0]['parameters'][1] == 'True')
check(chase['parameters'][3] == '600' and chase['parameters'][5] == '53', 'the chase camera drifted')
check(overview['parameters'][3] == '1050' and overview['parameters'][5] == '78', 'the overview camera drifted')

# --- hitboxes stay 17x17x32 -------------------------------------------------
for name in ('Player', 'Actor'):
    for instance in [i for i in scene['instances'] if i['name'] == name]:
        check(instance['width'] == 17 and instance['height'] == 17 and instance.get('depth') == 32,
              f'{name} hitbox drifted to {instance["width"]}x{instance["height"]}x{instance.get("depth")}')

# --- the new test really asserts the new behaviour --------------------------
sources = {t['name']: (t['source'] if isinstance(t['source'], str) else '\n'.join(t['source']))
           for t in data['tests']}
identity_test = sources.get('v0.6.10 Concealed Identity test', '')
for needle in ('ActorIdLabelFontSize', 'ActorIdLabelLineHeight', 'ActorIdLabelMinWidth',
               'ActorIdLabelMinWidthYou', 'ActorIdLabelPaddingX', 'ActorIdLabelRadius',
               'ActorIdLabelBorderWidth', 'CharacterRigTransformed', 'CharacterRigLurking',
               'CharacterRigFrozen', "'AIWolfModeLeft'", "'WolfModeLeft'", "'Wolf'",
               'a hidden wolf looks human', 'wolf mode reveals the actor',
               'the wolf player turns red only during wolf mode',
               'a frozen wolf candidate never shows red ears'):
    check(needle in identity_test, f'identity test marker missing: {needle}')

menu_test = sources.get('v0.6.10 Menu Hero test', '')
for needle in ('MenuHeroReady', 'MenuHeroSource', 'assets/menu_hero.png', 'MenuHudMasked',
               'RoleText', 'StatusText', 'BuildText', 'CountText', 'the HUD returns for play',
               'the HUD is masked again on the menu'):
    check(needle in menu_test, f'menu test marker missing: {needle}')

label_test = sources.get('v0.6.9 Label Size + Chase Camera test', '')
for needle in ('ActorIdLabelFontSize', 'ActorIdLabelLineHeight', 'getCameraState',
               '開発版 v0.6.10', 'OverviewCameraEnabled'):
    check(needle in label_test, f'label/camera test marker missing: {needle}')
check("num('ActorIdLabelFontSize') === 11" in label_test, 'the label test still expects the 14px plate')
check("num('ActorIdLabelFontSize') === 14" not in label_test, 'the label test still pins the old 14px size')

for name in ('v0.6.2 Color-independent Actor ID Labels test', 'v0.6.3 Mobile Virtual Joystick test',
             'v0.6.4 Compact Joystick + Overview Camera test', 'v0.6.5 Production Round Start test'):
    check('開発版 v0.6.10' in sources.get(name, ''), f'{name} was not moved to the v0.6.10 build marker')

if problems:
    for problem in problems:
        print('GUARD FAIL:', problem)
    sys.exit(1)
print('ICE WOLF v0.6.10 semantic guard PASS')
