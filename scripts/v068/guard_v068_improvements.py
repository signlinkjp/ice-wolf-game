#!/usr/bin/env python3
"""Semantic guard for the ICE WOLF v0.6.8 hold-thaw / gimmick / rig round.

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

objects = {o['name']: o for o in scene['objects']}
check('CountText' in objects and objects['CountText']['type'] == 'TextObject::Text', 'CountText object missing')
check(objects.get('InfectButton', {}).get('string') == '[ 人狼役にする ]', 'wolf role button label not applied')
check(any(i['name'] == 'CountText' and i['layer'] == 'UI' for i in scene['instances']), 'CountText instance missing')

scene_vars = {v['name'] for v in scene['variables']}
for name in ('AliveHumans', 'FrozenHumans', 'NearbyFrozenCount',
             'WolfRolePickOpen', 'WolfRolePickTarget', 'WolfRolePickCount',
             'WolfBirthPlayerTrap', 'RolePreference', 'DurationPreference',
             'RestartConfirmOpen', 'RestartUiReady', 'RestartUiVisible', 'RestartConfirmVisible'):
    check(name in scene_vars, f'scene variable {name} missing')

timings = {v['name']: v['value'] for v in scene['variables']}
check(timings.get('MatchDuration') == 210, 'MatchDuration drifted')
check(timings.get('MatchTimeLeft') == 210, 'MatchTimeLeft default drifted')
check(timings.get('WolfModeDuration') == 5, 'WolfModeDuration drifted')
check(timings.get('WolfCooldown') == 5, 'WolfCooldown drifted')
check(timings.get('RolePreference') == 'Random', 'RolePreference default is not Random')
check(timings.get('DurationPreference') == 0, 'DurationPreference must start unset (0)')

check(sum(1 for i in scene['instances'] if i['name'] == 'Actor') == 6, 'Actor count drifted')

test_names = [t['name'] for t in data['tests']]
for name in ('v0.6.5 All Frozen Instant Wolf Win test',
             'v0.6.5 Survivor Frozen Counter test',
             'v0.6.5 Wolf Role Pick test',
             'STEP2 core test',
             'v0.6.5 Production Round Start test',
             'v0.6.7 Role Choice test',
             'v0.6.7 Match Duration test',
             'v0.6.7 Restart Menu test'):
    check(name in test_names, f'test {name} missing')

protected = [
    'v0.6.4 Device-Tuned Mobile Virtual Joystick UI',
    'v0.6.3 Virtual joystick + keyboard movement (fixed camera)',
    'Wall separation (fail-safe)',
    'v0.6.4 Overview Camera Toggle UI',
    'v0.6.4 Normal + Overview camera',
    'Playable bounds + failsafe',
    'Wolf match flow',
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
]
for name in protected:
    check(name in names, f'protected group {name} missing')

# --- v0.6.6 visual & presentation update ------------------------------------
res_list = data['resources']['resources']
for texture in ('floor_frostlab.png', 'wall_frostlab.png', 'ice_freeze.png'):
    entry = next((r for r in res_list if r['name'] == texture), None)
    check(entry is not None, f'resource {texture} missing')
    if entry is None:
        continue
    check(entry.get('file') == 'assets/' + texture, f'{texture} is not registered as a repo-relative asset')
    check(entry.get('kind') == 'image', f'{texture} kind is not image')
    path = entry.get('file', '')
    if not os.path.isfile(path):
        problems.append(f'{texture} missing on disk at {path}')
        continue
    with open(path, 'rb') as handle:
        header = handle.read(24)
    check(header[:8] == b'\x89PNG\r\n\x1a\n', f'{texture} is not a PNG')
    width, height = struct.unpack('>II', header[16:24])
    check(width == 256 and height == 256, f'{texture} is {width}x{height}')
    check(os.path.getsize(path) < 120 * 1024, f'{texture} is too heavy for the HTML5 build')

floor_faces = {objects['Floor']['content'][k] for k in objects['Floor']['content'] if k.endswith('FaceResourceName')}
wall_faces = {objects['Wall']['content'][k] for k in objects['Wall']['content'] if k.endswith('FaceResourceName')}
check(floor_faces == {'floor_frostlab.png'}, f'floor faces drifted: {sorted(floor_faces)}')
check(wall_faces == {'wall_frostlab.png'}, f'wall faces drifted: {sorted(wall_faces)}')

notice = next((e for e in events if e.get('name') == 'v0.6.6 第二の人狼 秘匿通知'), None)
check(notice is not None, 'second-wolf secret notification group missing')
if notice:
    check(len(notice['events']) == 1, 'second-wolf notification must be a single JS event')
    notice_code = '\n'.join(notice['events'][0]['inlineCode'])
    check('誰かが人狼に染まった' in notice_code, 'secret notification message missing')
    check('FeedbackLeft' in notice_code and '2.0' in notice_code, 'notification duration missing')
    check('FrozenWolfCandidate' in notice_code, 'notification does not watch the candidate state')
    check('DisplayId' not in notice_code, 'notification must not name the new wolf')
    check('WolfBirthPlayerTrap' in notice_code, 'player-sprung trap is not excluded')

solid = next(e for e in events if e.get('name') == 'v0.3.4 guaranteed solid-state visuals')
solid_code = '\n'.join(solid['events'][0]['inlineCode'])
check('0x5ee7ff' in solid_code, 'frozen actors are not using the ice cyan')
check('0xff0000' not in solid_code, 'frozen actors still use the old red')
check('ice_freeze.png' in solid_code, 'ice texture is not applied to frozen actors')

frozen_group = next(e for e in events if e.get('name') == 'v0.3.5 actor size parity + frozen color enforcement')
frozen_colors = [a['parameters'][1] for sub in frozen_group['events'] for a in sub.get('actions', [])
                 if a['type']['value'] == 'ChangeColor']
check('"255;0;0"' not in frozen_colors, 'frozen color enforcement still sets red')
check('"94;231;255"' in frozen_colors, 'frozen color enforcement does not set the ice cyan')

raw = json.dumps(data, ensure_ascii=False)
check('"255;0;0"' not in raw, 'a red freeze tint remains somewhere in the project')

# --- v0.6.7 role / match length / restart ----------------------------------
production = next(e for e in events if e.get('name') == 'v0.6.5 Production Round Start + Main Menu')
code = '\n'.join(production['events'][0]['inlineCode'])
for needle in ('data-screen="menu"', 'data-screen="reveal"', 'data-screen="countdown"',
               'data-screen="result"', "currentPhase === 'Countdown'",
               "left > 2.1 ? '3'", '5秒間の人狼モード中は', '人狼役', '全員凍結で決着',
               '❄ Prototype v0.6.8', '開発版 v0.6.8'):
    check(needle in code, f'production UI marker missing: {needle}')
check('Prototype v0.6.6' not in raw and 'Prototype v0.6.7' not in raw and 'v0.6.5-DIAG' not in raw,
      'an old version marker remains')
check('開発版 v0.6.7' not in raw, 'the build text still says v0.6.7')

# role choice: three labelled chips drive one preference variable
for needle in ('data-action="roleRandom"', 'data-action="roleWolf"', 'data-action="roleHuman"',
               'おまかせ', '人狼で遊ぶ', '人間で逃げる'):
    check(needle in code, f'role choice marker missing: {needle}')
check("vars.get('RolePreference').setString('Wolf')" in code, '人狼 chip does not set RolePreference')
check("vars.get('RolePreference').setString('Human')" in code, '人間 chip does not set RolePreference')
check("vars.get('RolePreference').setString('Random')" in code, 'おまかせ chip does not set RolePreference')
check("rolePreference === 'Wolf' ? 'Wolf'" in code, 'the round roll ignores the role choice')
check("rolePreference === 'Human' ? 'Human'" in code, 'the round roll ignores the human choice')
check('Math.random() < 0.5' in code, 'おまかせ no longer falls back to a random roll')
check('iceWolfRolePreference' in code, 'role choice is not remembered')

# match length: three labelled chips drive one preference variable
for needle in ('data-action="time120"', 'data-action="time180"', 'data-action="time300"',
               '>2分<', '>3分<', '>5分<'):
    check(needle in code, f'match length marker missing: {needle}')
check("vars.get('DurationPreference').setNumber(120)" in code, '2分 chip does not set 120')
check("vars.get('DurationPreference').setNumber(180)" in code, '3分 chip does not set 180')
check("vars.get('DurationPreference').setNumber(300)" in code, '5分 chip does not set 300')
check('iceWolfMatchDuration' in code, 'match length is not remembered')
check('MatchTimeLeft' in code and "vars.get('MatchDuration').getAsNumber()" in code,
      'the round no longer starts from MatchDuration')

# restart: the command handler rebuilds the round without touching the defaults
check("command === 'Restart'" in code, 'Restart command missing from the round handler')
restart_block = code.split("command === 'Restart'", 1)[-1].split('else if', 1)[0]
check("resetRound('')" in restart_block, 'Restart does not rebuild the round')
check("setString('Active')" in restart_block, 'test-mode restart does not resume play')
check("setString('RoleReveal')" in restart_block, 'normal restart does not return to the role reveal')
check("command === 'TestStartPreference'" in code, 'test-mode preference start missing')

# in-play MENU button + confirm
restart_group = next((e for e in events if e.get('name') == 'v0.6.7 役割・時間の設定 + プレイ中のやり直し'), None)
check(restart_group is not None, 'v0.6.7 group missing')
if restart_group:
    check(len(restart_group['events']) == 1, 'v0.6.7 group must be a single JS event')
    menu_code = '\n'.join(restart_group['events'][0]['inlineCode'])
    check('data-ice-wolf-v067-restart' in menu_code, 'MENU button element missing')
    check("button.textContent = 'MENU'" in menu_code, 'MENU button label missing')
    check('rect.right - 136' in menu_code, 'MENU button is not placed left of CAM (rect.right - 72)')
    check('rect.top + 108' in menu_code, 'MENU button is not on the CAM row')
    check("phase === 'Active'" in menu_code, 'MENU button is not tied to the Active phase')
    check('2147482820' in menu_code, 'MENU button z-index drifted')
    check('2147482960' in menu_code, 'confirm modal must sit above the CAM/joystick DOM')
    for needle in ('最初からやり直す', 'メインメニューへ', 'つづける'):
        check(needle in menu_code, f'confirm choice missing: {needle}')
    check("vars.get('RoundCommand').setString('Restart')" in menu_code, 'restart choice does not ask for a restart')
    check("vars.get('RoundCommand').setString('Menu')" in menu_code, 'menu choice does not return to the menu')
    check('RestartConfirmOpen' in menu_code and 'RestartConfirmVisible' in menu_code,
          'confirm panel state is not exposed')
    check('RestartUiVisible' in menu_code, 'MENU button visibility is not exposed')
    check('wantedDuration' in menu_code and 'MatchDuration' in menu_code,
          'match length preference is never applied to MatchDuration')
    check("vars.get('JoystickActive').setBoolean(false)" in menu_code, 'confirm does not stop movement')

if problems:
    for problem in problems:
        print('GUARD FAIL:', problem)
    sys.exit(1)

# --- v0.6.8 hold-to-thaw / speed pads / warp / character rigs ----------------
import re

names = [e.get('name') for e in events]
order = {name: index for index, name in enumerate(names) if name}
objects = {o['name']: o for o in scene['objects']}
scene_vars = {v['name']: v for v in scene['variables']}

# 1. hold-to-thaw image
hold_group = next((e for e in events if e.get('name') == 'v0.6.8 長押し解凍ゲージ'), None)
check(hold_group is not None, 'v0.6.8 hold group missing')
if hold_group:
    subs = hold_group['events']
    check(len(subs) == 4, f'hold group must hold press/else/complete/bar events, got {len(subs)}')
    check(subs[0]['type'] == 'BuiltinCommonInstructions::Standard', 'hold press event is not Standard')
    check(subs[1]['type'] == 'BuiltinCommonInstructions::Else', 'hold reset event is not an Else')
    check(subs[2]['type'] == 'BuiltinCommonInstructions::Standard', 'hold completion event is not Standard')
    check(subs[3]['type'] == 'BuiltinCommonInstructions::JsCode', 'hold progress bar is not a JS event')
    press_conditions = subs[0]['conditions']
    check(any(c['type']['value'] == 'ButtonStates::ButtonFSM::IsPressed'
              and c.get('parameters', [''])[0] == 'RescueButton' for c in press_conditions),
          'the gauge does not charge from a held rescue button')
    check(not any(c['type']['value'] == 'ButtonStates::ButtonFSM::IsClicked'
                  for c in press_conditions),
          'the gauge still starts from a single tap')
    press_actions = [a['type']['value'] + ':' + ';'.join(a.get('parameters') or []) for a in subs[0]['actions']]
    check(any(item.startswith('SetNumberVariable:RescueHoldTime;+;TimeDelta()') for item in press_actions),
          'the gauge does not accumulate TimeDelta')
    check(any('RescueHoldSpent' in item for item in press_actions) is False,
          'the press event must not consume the hold')
    check(any(c['type']['value'] == 'BooleanVariable' and c.get('parameters', [''])[0] == 'RescueHoldSpent'
              and c.get('parameters', [''])[1] == 'False' for c in press_conditions),
          'the hold is not one-per-press')
    reset_actions = [a['type']['value'] + ':' + ';'.join(a.get('parameters') or []) for a in subs[1]['actions']]
    for needle in ('SetNumberVariable:RescueHoldTime;=;0',
                   'SetBooleanVariable:RescueHoldActive;False;',
                   'SetBooleanVariable:RescueHoldReady;False;',
                   'SetBooleanVariable:RescueHoldSpent;False;'):
        check(needle in reset_actions, f'release does not reset {needle}')
    complete_conditions = [c['type']['value'] + ':' + ';'.join(c.get('parameters') or []) for c in subs[2]['conditions']]
    check('BuiltinCommonInstructions::CompareNumbers:RescueHoldTime;>=;RescueHoldDuration' in complete_conditions,
          'the gauge never completes at RescueHoldDuration')
    complete_actions = [a['type']['value'] + ':' + ';'.join(a.get('parameters') or []) for a in subs[2]['actions']]
    for needle in ('SetBooleanVariable:RescueHoldReady;True;',
                   'SetBooleanVariable:RescueHoldSpent;True;',
                   'SetNumberVariable:RescueHoldCount;+;1'):
        check(needle in complete_actions, f'hold completion is missing {needle}')
    bar_code = '\n'.join(subs[3]['inlineCode'])
    for needle in ('data-ice-wolf-v068-holdbar', '解凍中... ', '解凍！', 'RescueHoldProgress',
                   'RescueHoldBarVisible', 'translateX(-50%)'):
        check(needle in bar_code, f'hold bar marker missing: {needle}')

check('v0.6.8 長押し解凍ゲージ' in order and 'Wolf actions' in order
      and order['v0.6.8 長押し解凍ゲージ'] < order['Wolf actions'],
      'the hold gauge must run before the Wolf actions that thaw')

# the rescue action itself now waits for the finished gauge
wolf_group = next(e for e in events if e.get('name') == 'Wolf actions')
rescue_sub = None
for sub in wolf_group['events']:
    for condition in sub.get('conditions', []) or []:
        if condition['type']['value'] == 'ButtonStates::ButtonFSM::IsClicked' \
                and condition.get('parameters', [''])[0] == 'RescueButton':
            rescue_sub = sub
check(rescue_sub is None, 'a tap on the rescue button still thaws directly')
hold_trigger = [sub for sub in wolf_group['events']
                if any(c['type']['value'] == 'BooleanVariable'
                       and c.get('parameters', [''])[0] == 'RescueHoldReady'
                       for c in sub.get('conditions', []) or [])]
check(len(hold_trigger) == 1, f'the thaw action must wait for RescueHoldReady exactly once, got {len(hold_trigger)}')
if hold_trigger:
    check(any(c['type']['value'] == 'Distance' for c in hold_trigger[0]['conditions']),
          'the thaw action no longer checks the rescue reach')
    check(any(a['type']['value'] == 'PickNearest' for a in hold_trigger[0]['actions']),
          'the thaw action no longer picks the nearest neighbour')

# 2. speed pads + warp
pad_group = next((e for e in events if e.get('name') == 'v0.6.8 スピード床＆ワープ'), None)
check(pad_group is not None, 'v0.6.8 speed/warp group missing')
if pad_group:
    check(len(pad_group['events']) == 1 and pad_group['events'][0]['type'] == 'BuiltinCommonInstructions::JsCode',
          'speed/warp group must be a single JS event')
    pad_code = '\n'.join(pad_group['events'][0]['inlineCode'])
    for needle in ("getObjects('SpeedPad')", "getObjects('WarpPad')", 'SpeedBoostDuration',
                   'SpeedBoostFactor', 'WarpCooldownDuration', 'SpeedPadTriggers', 'WarpCount',
                   '⚡ スピードアップ！', '🌀 ワープ！', 'SpeedFactor'):
        check(needle in pad_code, f'speed/warp marker missing: {needle}')
    check('insidePad' in pad_code, 'pads are not sampled by their real bounds')

check('v0.6.8 スピード床＆ワープ' in order and 'v0.6.3 Virtual joystick + keyboard movement (fixed camera)' in order
      and order['v0.6.8 スピード床＆ワープ'] < order['v0.6.3 Virtual joystick + keyboard movement (fixed camera)'],
      'the speed factor must be updated before the movement step reads it')

movement_group = next(e for e in events if e.get('name') == 'v0.6.3 Virtual joystick + keyboard movement (fixed camera)')


def collect_expressions(node):
    found = []
    for action in node.get('actions', []) or []:
        for param in action.get('parameters') or []:
            if isinstance(param, str):
                found.append(param)
    for child in node.get('events', []) or []:
        found.extend(collect_expressions(child))
    return found


movement_expressions = collect_expressions(movement_group)
check(sum(1 for item in movement_expressions if '* 260 * SpeedFactor * TimeDelta()' in item) == 2,
      'both movement axes must use SpeedFactor')

for pad_name, texture in (('SpeedPad', 'pad_speed.png'), ('WarpPad', 'pad_warp.png')):
    pad_object = objects.get(pad_name)
    check(pad_object is not None, f'{pad_name} object missing')
    if pad_object is None:
        continue
    check(pad_object['type'] == 'Scene3D::Cube3DObject', f'{pad_name} is not a 3D cube')
    check(pad_object.get('behaviors') == [], f'{pad_name} must stay a pure decoration (no physics)')
    faces = {pad_object['content'][key] for key in pad_object['content'] if key.endswith('FaceResourceName')}
    check(faces == {texture}, f'{pad_name} faces drifted: {sorted(faces)}')
    check(pad_object['content'].get('materialType') == 'Basic', f'{pad_name} should glow (Basic material)')
    check(pad_object['content'].get('tint') == '255;255;255', f'{pad_name} tint should stay neutral')

speed_instances = [i for i in scene['instances'] if i['name'] == 'SpeedPad']
warp_instances = [i for i in scene['instances'] if i['name'] == 'WarpPad']
check(len(speed_instances) == 3, f'expected 3 speed pads, got {len(speed_instances)}')
check(len(warp_instances) == 2, f'expected one warp pair (2 pads), got {len(warp_instances)}')

wall_boxes = [(i['x'], i['y'], i['width'], i['height']) for i in scene['instances'] if i['name'] == 'Wall']
for index, pad in enumerate(speed_instances + warp_instances):
    label = f"{pad['name']}#{index}"
    check(pad['width'] == 110 and pad['height'] == 110, f'{label} must be a 110x110 tile')
    check(pad['depth'] <= 6, f'{label} is too tall for a floor pad')
    check(pad.get('z', 0) == 0, f'{label} is not resting on the floor')
    left, top = pad['x'], pad['y']
    right, bottom = left + pad['width'], top + pad['height']
    check(left > -708 and right < 708 and top > -708 and bottom < 708,
          f'{label} escapes the playable bounds')
    for wall in wall_boxes:
        wx, wy, ww, wh = wall
        if left < wx + ww and right > wx and top < wy + wh and bottom > wy:
            problems.append(f'{label} overlaps a wall at {wx},{wy}')
            break

for texture, size in (('pad_speed.png', 128), ('pad_warp.png', 128)):
    entry = next((r for r in res_list if r['name'] == texture), None)
    check(entry is not None, f'resource {texture} missing')
    if entry is None:
        continue
    check(entry.get('file') == 'assets/' + texture, f'{texture} is not registered under assets/')
    check(entry.get('kind') == 'image', f'{texture} kind is not image')
    path = entry.get('file', '')
    if not os.path.isfile(path):
        problems.append(f'{texture} missing on disk at {path}')
        continue
    with open(path, 'rb') as handle:
        header = handle.read(24)
    check(header[:8] == b'\x89PNG\r\n\x1a\n', f'{texture} is not a PNG')
    width, height = struct.unpack('>II', header[16:24])
    check(width == size and height == size, f'{texture} is {width}x{height}')
    check(os.path.getsize(path) < 120 * 1024, f'{texture} is too heavy for the HTML5 build')

# 3. character rigs
rig_group = next((e for e in events if e.get('name') == 'v0.6.8 キャラ3D見た目進化'), None)
check(rig_group is not None, 'v0.6.8 character rig group missing')
if rig_group:
    check(len(rig_group['events']) == 1 and rig_group['events'][0]['type'] == 'BuiltinCommonInstructions::JsCode',
          'character rig group must be a single JS event')
    rig_code = '\n'.join(rig_group['events'][0]['inlineCode'])
    for needle in ('get3DRendererObject()', 'new Three.BoxGeometry(', "'iceWolfHead'", "'iceWolfVisor'",
                   "'iceWolfCap'", "'iceWolfEarL'", "'iceWolfEarR'", "'iceWolfIce'",
                   'transparent: true', 'depthWrite: false', 'CharacterRigCount', 'CharacterRigMeshes',
                   'CharacterRigFrozen', 'CharacterRigMode'):
        check(needle in rig_code, f'character rig marker missing: {needle}')
    for banned in ('setWidth(', 'setHeight(', 'setDepth(', 'setSize('):
        check(banned not in rig_code, f'the rig must never resize the hitbox ({banned})')
    check('__iceWolfV068Rig' in rig_code, 'the rig is not cached on the object (per-frame rebuild risk)')
    check(rig_code.count('new Three.Mesh(') == 1, 'each rig must build its meshes exactly once')

for name in ('Player', 'Actor'):
    for instance in [i for i in scene['instances'] if i['name'] == name]:
        check(instance['width'] == 17 and instance['height'] == 17 and instance.get('depth') == 32,
              f'{name} hitbox drifted to {instance["width"]}x{instance["height"]}x{instance.get("depth")}')

# 4. defaults that gameplay depends on
defaults = {
    'RescueHoldDuration': 1.2,
    'RescueHoldTime': 0,
    'RescueHoldProgress': 0,
    'RescueHoldCount': 0,
    'SpeedBoostDuration': 2.5,
    'SpeedBoostFactor': 1.45,
    'SpeedBoostLeft': 0,
    'SpeedFactor': 1,
    'SpeedPadTriggers': 0,
    'WarpCooldownDuration': 5,
    'WarpCooldownLeft': 0,
    'WarpCount': 0,
    'CharacterRigCount': 0,
    'CharacterRigMeshes': 0,
}
for name, value in defaults.items():
    entry = scene_vars.get(name)
    check(entry is not None, f'scene variable {name} missing')
    if entry is not None:
        check(entry['value'] == value, f'{name} default drifted: {entry["value"]}')
for name in ('RescueHoldReady', 'RescueHoldActive', 'RescueHoldSpent', 'RescueHoldBarReady',
             'RescueHoldBarVisible', 'OnSpeedPad'):
    entry = scene_vars.get(name)
    check(entry is not None, f'scene variable {name} missing')
    if entry is not None:
        check(entry['value'] is False, f'{name} must start false')
check(scene_vars.get('CharacterRigMode', {}).get('value') == '', 'CharacterRigMode must start empty')

# 5. the bump can never leave v0.6.7 hand-written pads around
pad_section = rig_group['events'][0]['inlineCode'] if rig_group else []
check(not any('v0.6.7' in line for line in pad_section), 'the rig code still mentions v0.6.7')

test_names = [t['name'] for t in data['tests']]
for name in ('v0.6.8 Hold Rescue test', 'v0.6.8 Speed Pad + Warp test', 'v0.6.8 Character 3D Rig test'):
    check(name in test_names, f'test {name} missing')

hold_source = next((t['source'] for t in data['tests'] if t['name'] == 'v0.6.8 Hold Rescue test'), '')
hold_source = hold_source if isinstance(hold_source, str) else '\n'.join(hold_source)
for needle in ('setMouseButtonPressed(true)', 'RescueHoldDuration', 'RescueHoldProgress',
               'RescueHoldCount', 'a short tap never thaws'):
    check(needle in hold_source, f'hold test marker missing: {needle}')

step2_source = next((t['source'] for t in data['tests'] if t['name'] == 'STEP2 core test'), '')
step2_source = step2_source if isinstance(step2_source, str) else '\n'.join(step2_source)
check('holdRescue' in step2_source, 'STEP2 still assumes a single tap thaws')

if problems:
    for problem in problems:
        print('GUARD FAIL:', problem)
    sys.exit(1)
print('ICE WOLF v0.6.8 semantic guard PASS')
