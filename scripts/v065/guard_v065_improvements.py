#!/usr/bin/env python3
"""Semantic guard for the ICE WOLF v0.6.7 role / match-length / restart round.

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
               '❄ Prototype v0.6.7', '開発版 v0.6.7'):
    check(needle in code, f'production UI marker missing: {needle}')
check('Prototype v0.6.6' not in raw and 'v0.6.5-DIAG' not in raw, 'an old version marker remains')

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
print('ICE WOLF v0.6.7 semantic guard PASS')
