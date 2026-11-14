#!/usr/bin/env python3
"""Semantic guard for the ICE WOLF v0.6.9 feel / readability / sound round.

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

solid = next(e for e in events if e.get('name') == 'v0.3.4 guaranteed solid-state visuals')
solid_code = '\n'.join(solid['events'][0]['inlineCode'])
check('0x5ee7ff' in solid_code, 'frozen actors are not using the ice cyan')
check('ice_freeze.png' in solid_code, 'ice texture is not applied to frozen actors')
check('"255;0;0"' not in raw, 'a red freeze tint remains somewhere in the project')

# --- v0.6.7 production menu -------------------------------------------------
production = next(e for e in events if e.get('name') == 'v0.6.5 Production Round Start + Main Menu')
prod_code = '\n'.join(production['events'][0]['inlineCode'])
for needle in ('data-screen="menu"', 'data-screen="reveal"', 'data-screen="countdown"',
               'data-screen="result"', "currentPhase === 'Countdown'",
               "left > 2.1 ? '3'", '5秒間の人狼モード中は', '人狼役', '全員凍結で決着',
               '❄ Prototype v0.6.9', '開発版 v0.6.9'):
    check(needle in prod_code, f'production UI marker missing: {needle}')
for stale in ('Prototype v0.6.6', 'Prototype v0.6.7', 'Prototype v0.6.8',
              '開発版 v0.6.7', '開発版 v0.6.8', 'v0.6.5-DIAG'):
    check(stale not in raw, f'an old version marker remains: {stale}')

for needle in ('data-action="roleRandom"', 'data-action="roleWolf"', 'data-action="roleHuman"',
               'おまかせ', '人狼で遊ぶ', '人間で逃げる',
               'data-action="time120"', 'data-action="time180"', 'data-action="time300"',
               '>2分<', '>3分<', '>5分<'):
    check(needle in prod_code, f'menu marker missing: {needle}')
check("vars.get('RolePreference').setString('Wolf')" in prod_code, '人狼 chip does not set RolePreference')
check("vars.get('RolePreference').setString('Human')" in prod_code, '人間 chip does not set RolePreference')
check("rolePreference === 'Wolf' ? 'Wolf'" in prod_code, 'the round roll ignores the role choice')
check("rolePreference === 'Human' ? 'Human'" in prod_code, 'the round roll ignores the human choice')
check('iceWolfRolePreference' in prod_code, 'role choice is not remembered')
check('iceWolfMatchDuration' in prod_code, 'match length is not remembered')
check("command === 'Restart'" in prod_code, 'Restart command missing from the round handler')
check("command === 'TestStartPreference'" in prod_code, 'test-mode preference start missing')

# --- v0.6.8 hold-to-thaw wiring (now feeding the ring) ----------------------
hold = next((e for e in events if e.get('name') == 'v0.6.9 円形解凍リング'), None)
check(hold is not None, 'v0.6.9 ring group missing')
if hold:
    subs = hold['events']
    check(len(subs) == 4, f'ring group must keep press/else/complete/ring events, got {len(subs)}')
    check(subs[0]['type'] == 'BuiltinCommonInstructions::Standard', 'ring press event is not Standard')
    check(subs[1]['type'] == 'BuiltinCommonInstructions::Else', 'ring reset event is not an Else')
    check(subs[2]['type'] == 'BuiltinCommonInstructions::Standard', 'ring completion event is not Standard')
    check(subs[3]['type'] == 'BuiltinCommonInstructions::JsCode', 'ring gauge is not a JS event')
    press_conditions = subs[0]['conditions']
    check(any(c['type']['value'] == 'ButtonStates::ButtonFSM::IsPressed'
              and c.get('parameters', [''])[0] == 'RescueButton' for c in press_conditions),
          'the gauge does not charge from a held rescue button')
    check(not any(c['type']['value'] == 'ButtonStates::ButtonFSM::IsClicked'
                  for c in press_conditions), 'the gauge still starts from a single tap')
    press_actions = [a['type']['value'] + ':' + ';'.join(a.get('parameters') or []) for a in subs[0]['actions']]
    check(any(item.startswith('SetNumberVariable:RescueHoldTime;+;TimeDelta()') for item in press_actions),
          'the gauge does not accumulate TimeDelta')
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

wolf_group = next(e for e in events if e.get('name') == 'Wolf actions')
check(not any(c['type']['value'] == 'ButtonStates::ButtonFSM::IsClicked'
              and c.get('parameters', [''])[0] == 'RescueButton'
              for sub in wolf_group['events'] for c in sub.get('conditions', []) or []),
      'a tap on the rescue button still thaws directly')
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
check('v0.6.9 円形解凍リング' in order and 'Wolf actions' in order
      and order['v0.6.9 円形解凍リング'] < order['Wolf actions'],
      'the ring must run before the Wolf actions that thaw')

# --- v0.6.9 (1) circular thaw ring -----------------------------------------
ring_code = '\n'.join(subs[3]['inlineCode']) if hold else ''
for needle in ('data-ice-wolf-v069-ring', 'createElementNS', 'http://www.w3.org/2000/svg',
               "'circle'", 'stroke-dasharray', 'stroke-dashoffset', '2 * Math.PI',
               'RING_DIAMETER = 68', 'RING_STROKE = 7', 'stroke-linecap', "'#5fe9ff'",
               "'#9dffe9'", "'解凍！'", "rotate(-90deg)", 'RescueHoldMeterPercent',
               'RescueHoldMeterDash', 'RescueHoldMeterMode', 'RescueHoldMeterVisible',
               'RescueHoldMeterCircumference', "'ring'", 'aria-valuenow'):
    check(needle in ring_code, f'ring marker missing: {needle}')
check('wrap.style.display = visible' in ring_code, 'the ring does not hide itself when idle')
check("wrap.style.width = RING_DIAMETER + 'px'" in ring_code, 'the ring size is not bound to its diameter')
check("wrap.style.height = RING_DIAMETER + 'px'" in ring_code, 'the ring height is not bound to its diameter')
check('document.querySelectorAll' in ring_code, 'stale rings are never removed')
for banned in ('data-ice-wolf-v068-holdbar', 'fill.style.width', 'linear-gradient(90deg'):
    check(banned not in ring_code, f'the horizontal bar survived in the ring code: {banned}')
check('typeof document === \'undefined\'' in ring_code, 'the ring is not guarded against a missing DOM')

# --- v0.6.9 (2) smaller head labels ----------------------------------------
labels = next(e for e in events if e.get('name') == 'v0.6.2 Color-independent Actor ID Labels')
label_code = '\n'.join(labels['events'][0]['inlineCode'])
check('const LABEL_FONT_SIZE = 14;' in label_code, 'label font size is not pinned to 14px')
check("vars.get('ActorIdLabelFontSize').setNumber(LABEL_FONT_SIZE);" in label_code,
      'the label size is not exposed as a scene variable')
check("el.style.fontSize = LABEL_FONT_SIZE + 'px';" in label_code, 'the label element does not use the pinned size')
check("el.style.fontSize = '18px';" not in label_code, 'the old 18px label size is still in place')
check("el.style.lineHeight = '17px';" in label_code, 'the label line height was not tightened')
check("id === 'YOU' ? '30px' : '19px'" in label_code, 'the label plates were not tightened')
check("el.style.pointerEvents = 'none';" in label_code, 'labels must never eat touches')
check('expectedIds' in label_code and 'DisplayId' in label_code, 'fixed YOU / A-F labelling lost')
check(defaults.get('ActorIdLabelFontSize') == 14, 'ActorIdLabelFontSize default drifted')

# --- v0.6.9 (3) chase camera -----------------------------------------------
camera = next(e for e in events if e.get('name') == 'v0.6.4 Normal + Overview camera')
camera_actions = {a['type']['value']: a for a in camera['events'][0]['actions']}
camera_actions.update({a['type']['value']: a for a in camera['events'][1]['actions']})
chase = next(a for sub in camera['events'] for a in sub['actions']
             if a['type']['value'] == 'ThirdPersonCamera::LookFromDistanceAtObject3D'
             and sub['conditions'][0]['parameters'][1] == 'False')
overview = next(a for sub in camera['events'] for a in sub['actions']
                if a['type']['value'] == 'ThirdPersonCamera::LookFromDistanceAtObject3D'
                and sub['conditions'][0]['parameters'][1] == 'True')
check(chase['parameters'][3] == '600', f'chase distance is not 600: {chase["parameters"][3]}')
check(chase['parameters'][5] == '53', f'chase angle is not 53: {chase["parameters"][5]}')
check(overview['parameters'][3] == '1050', f'overview distance drifted: {overview["parameters"][3]}')
check(overview['parameters'][5] == '78', f'overview angle drifted: {overview["parameters"][5]}')

# --- v0.6.9 (4) two speed pads in the wide lanes ----------------------------
speed_instances = [i for i in scene['instances'] if i['name'] == 'SpeedPad']
warp_instances = [i for i in scene['instances'] if i['name'] == 'WarpPad']
check(len(speed_instances) == 2, f'expected 2 speed pads, got {len(speed_instances)}')
check(len(warp_instances) == 2, f'expected one warp pair (2 pads), got {len(warp_instances)}')
wall_boxes = [(i['x'], i['y'], i['width'], i['height']) for i in scene['instances'] if i['name'] == 'Wall']
side_rooms = [(-640, -160, 320, 320), (320, -160, 320, 320)]


def overlaps(first, second):
    return (first[0] < second[0] + second[2] and first[0] + first[2] > second[0]
            and first[1] < second[1] + second[3] and first[1] + first[3] > second[1])


for index, pad in enumerate(speed_instances + warp_instances):
    label = f"{pad['name']}#{index}"
    check(pad['width'] == 110 and pad['height'] == 110, f'{label} must be a 110x110 tile')
    check(pad['depth'] <= 6, f'{label} is too tall for a floor pad')
    check(pad.get('z', 0) == 0, f'{label} is not resting on the floor')
    box = (pad['x'], pad['y'], pad['width'], pad['height'])
    check(box[0] > -708 and box[0] + box[2] < 708 and box[1] > -708 and box[1] + box[3] < 708,
          f'{label} escapes the playable bounds')
    for wall in wall_boxes:
        if overlaps(box, wall):
            problems.append(f'{label} overlaps a wall at {wall[0]},{wall[1]}')
            break
    if pad['name'] == 'SpeedPad':
        for room in side_rooms:
            if overlaps(box, room):
                problems.append(f'{label} sits inside a side room at {room[0]},{room[1]}')

pad_boxes = [(p['x'], p['y'], p['width'], p['height']) for p in speed_instances + warp_instances]
for first in range(len(pad_boxes)):
    for second in range(first + 1, len(pad_boxes)):
        check(not overlaps(pad_boxes[first], pad_boxes[second]),
              f'pads {first} and {second} overlap each other')

lanes = [(-205, -535), (205, 415)]
actual = sorted((p['x'], p['y']) for p in speed_instances)
check(actual == sorted(lanes), f'speed pads are not in the two wide straight lanes: {actual}')

for pad_name, texture in (('SpeedPad', 'pad_speed.png'), ('WarpPad', 'pad_warp.png')):
    pad_object = objects.get(pad_name)
    check(pad_object is not None, f'{pad_name} object missing')
    if pad_object is None:
        continue
    check(pad_object['type'] == 'Scene3D::Cube3DObject', f'{pad_name} is not a 3D cube')
    check(pad_object.get('behaviors') == [], f'{pad_name} must stay a pure decoration (no physics)')
    faces = {pad_object['content'][key] for key in pad_object['content'] if key.endswith('FaceResourceName')}
    check(faces == {texture}, f'{pad_name} faces drifted: {sorted(faces)}')

pad_group = next(e for e in events if e.get('name') == 'v0.6.8 スピード床＆ワープ')
pad_code = '\n'.join(pad_group['events'][0]['inlineCode'])
for needle in ("getObjects('SpeedPad')", 'SpeedBoostDuration', 'SpeedBoostFactor', 'SpeedFactor',
               '⚡ スピードアップ！', 'insidePad'):
    check(needle in pad_code, f'speed pad runtime marker missing: {needle}')
check(order.get('v0.6.8 スピード床＆ワープ', 99) < order.get('v0.6.3 Virtual joystick + keyboard movement (fixed camera)', 0),
      'the speed factor must be updated before the movement step reads it')

# --- v0.6.9 (5) Web Audio sound engine -------------------------------------
sound = next((e for e in events if e.get('name') == 'v0.6.9 サウンドエンジン + サウンド設定'), None)
check(sound is not None, 'v0.6.9 sound group missing')
check(names[-1] == 'v0.6.9 サウンドエンジン + サウンド設定', 'the sound observer must run last in the frame')
sound_code = ''
if sound:
    check(len(sound['events']) == 1 and sound['events'][0]['type'] == 'BuiltinCommonInstructions::JsCode',
          'the sound engine must be a single JS event')
    sound_code = '\n'.join(sound['events'][0]['inlineCode'])
for needle in ('iceWolfSoundEnabled', 'AudioContext', 'webkitAudioContext', 'createOscillator',
               'createGain', 'exponentialRampToValueAtTime', 'master.gain.value',
               "for (const type of ['pointerdown', 'touchstart', 'keydown'])",
               "'freeze'", "'thaw'", "'warp'", "'speed'", "'count'", "'start'", "'win'", "'lose'",
               'SoundEnabled', 'SoundPlayCount', 'SoundLast', 'SoundToggleRequest',
               'SoundToggleCount', 'SoundSupported', 'SoundMode', 'SoundEngineReady',
               'FrozenWolfCandidate', 'WarpCount', 'SpeedPadTriggers', 'RoundPhaseLeft',
               '人狼', '人間'):
    check(needle in sound_code, f'sound engine marker missing: {needle}')
check('readPref() !== false' in sound_code, 'sound must default to ON when nothing is stored')
check('localStorage.setItem(STORAGE_KEY' in sound_code, 'the sound preference is not persisted')
check('typeof AudioContext' in sound_code, 'AudioContext is not feature-detected')
check("typeof document !== 'undefined'" in sound_code, 'the sound event is not guarded against a missing DOM')
check('return false;' in sound_code and 'catch (error)' in sound_code, 'the sound engine is not failure tolerant')
for banned in ('.mp3', '.wav', '.ogg', '.m4a', 'new Audio('):
    check(banned not in sound_code, f'the synth engine must not load external audio: {banned}')
check("try { ctx.resume(); } catch (error) {}" in sound_code or 'ctx.resume()' in sound_code,
      'the iOS audio context is never resumed')
check(sound_code.count('play(') >= 8, 'not every cue is wired to play()')

check('data-action="soundToggle"' in prod_code, 'the SETTINGS sound toggle button is missing')
check('data-ice-wolf-v069-sound="1"' in prod_code, 'the SETTINGS sound toggle is not addressable')
check('<span>サウンド</span>' in prod_code, 'the SETTINGS sound row label is missing')
check("'サウンド ' + (on ? 'ON' : 'OFF')" in prod_code, 'the SETTINGS sound button has no accessible label')
check("vars.get('SoundToggleRequest').setBoolean(true)" in prod_code, 'the SETTINGS button does not request a toggle')
check('const updateSoundUi = () =>' in prod_code, 'the SETTINGS sound label is never refreshed')
check('updateSoundUi();' in prod_code, 'the SETTINGS screen does not refresh the sound label on open')
check('サウンドは効果音のみ' in prod_code, 'the SETTINGS screen still promises future sound work')

sound_defaults = {
    'SoundEnabled': True,
    'SoundSupported': False,
    'SoundUnlocked': False,
    'SoundPlayCount': 0,
    'SoundToggleCount': 0,
    'SoundLast': '',
    'SoundToggleRequest': False,
    'SoundEngineReady': False,
    'SoundMode': '',
}
for name, value in sound_defaults.items():
    entry = scene_vars.get(name)
    check(entry is not None, f'scene variable {name} missing')
    if entry is not None:
        check(entry['value'] == value, f'{name} default drifted: {entry["value"]}')

meter_defaults = {
    'RescueHoldMeterDiameter': 0,
    'RescueHoldMeterCircumference': 0,
    'RescueHoldMeterDash': 0,
    'RescueHoldMeterPercent': 0,
}
for name, value in meter_defaults.items():
    entry = scene_vars.get(name)
    check(entry is not None, f'scene variable {name} missing')
    if entry is not None:
        check(entry['value'] == value, f'{name} default drifted: {entry["value"]}')
for name in ('RescueHoldMeterReady', 'RescueHoldMeterVisible'):
    entry = scene_vars.get(name)
    check(entry is not None, f'scene variable {name} missing')
    if entry is not None:
        check(entry['value'] is False, f'{name} must start false')

# --- character rigs and hitboxes stay untouched -----------------------------
rig = next((e for e in events if e.get('name') == 'v0.6.8 キャラ3D見た目進化'), None)
check(rig is not None, 'character rig group missing')
if rig:
    rig_code = '\n'.join(rig['events'][0]['inlineCode'])
    for needle in ('get3DRendererObject()', "'iceWolfHead'", "'iceWolfVisor'", "'iceWolfCap'",
                   "'iceWolfEarL'", "'iceWolfEarR'", "'iceWolfIce'", 'CharacterRigCount', 'CharacterRigMeshes'):
        check(needle in rig_code, f'character rig marker missing: {needle}')
    for banned in ('setWidth(', 'setHeight(', 'setDepth(', 'setSize('):
        check(banned not in rig_code, f'the rig must never resize the hitbox ({banned})')
for name in ('Player', 'Actor'):
    for instance in [i for i in scene['instances'] if i['name'] == name]:
        check(instance['width'] == 17 and instance['height'] == 17 and instance.get('depth') == 32,
              f'{name} hitbox drifted to {instance["width"]}x{instance["height"]}x{instance.get("depth")}')

# --- the new tests really assert the new behaviour --------------------------
sources = {t['name']: t['source'] for t in data['tests']}


def source_of(name):
    value = sources.get(name, '')
    return value if isinstance(value, str) else '\n'.join(value)


ring_test = source_of('v0.6.9 Circular Rescue Meter test')
for needle in ('RescueHoldMeterDiameter', 'RescueHoldMeterCircumference', 'RescueHoldMeterDash',
               'RescueHoldMeterPercent', "'ring'", 'the arc is drawn half way', 'a full ring is ready'):
    check(needle in ring_test, f'ring test marker missing: {needle}')

sound_test = source_of('v0.6.9 Sound FX test')
for needle in ('SoundEngineReady', 'SoundLast', 'freeze', 'thaw', 'warp', 'speed', 'count',
               'start', 'win', 'lose', 'SoundToggleRequest', 'SoundPlayCount'):
    check(needle in sound_test, f'sound test marker missing: {needle}')

visual_test = source_of('v0.6.9 Label Size + Chase Camera test')
for needle in ('ActorIdLabelFontSize', 'ActorIdLabelsReady', 'getCameraState', 'offsetY',
               '開発版 v0.6.9', 'OverviewCameraEnabled'):
    check(needle in visual_test, f'label/camera test marker missing: {needle}')

pad_test = source_of('v0.6.8 Speed Pad + Warp test')
check('speedPads.length === 2' in pad_test, 'the speed pad test still expects three pads')
check('inSideRoom' in pad_test, 'the speed pad test does not check the side rooms')
for name in ('v0.6.4 Compact Joystick + Overview Camera test', 'v0.6.5 Production Round Start test'):
    check('開発版 v0.6.9' in source_of(name), f'{name} was not moved to the v0.6.9 build marker')

if problems:
    for problem in problems:
        print('GUARD FAIL:', problem)
    sys.exit(1)
print('ICE WOLF v0.6.9 semantic guard PASS')
