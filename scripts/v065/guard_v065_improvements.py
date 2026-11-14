#!/usr/bin/env python3
"""Semantic guard for the ICE WOLF visual/presentation round (run by GitHub Actions)."""
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
             'WolfBirthPlayerTrap'):
    check(name in scene_vars, f'scene variable {name} missing')

timings = {v['name']: v['value'] for v in scene['variables']}
check(timings.get('MatchDuration') == 210, 'MatchDuration drifted')
check(timings.get('WolfModeDuration') == 5, 'WolfModeDuration drifted')
check(timings.get('WolfCooldown') == 5, 'WolfCooldown drifted')

check(sum(1 for i in scene['instances'] if i['name'] == 'Actor') == 6, 'Actor count drifted')

test_names = [t['name'] for t in data['tests']]
for name in ('v0.6.5 All Frozen Instant Wolf Win test',
             'v0.6.5 Survivor Frozen Counter test',
             'v0.6.5 Wolf Role Pick test',
             'STEP2 core test',
             'v0.6.5 Production Round Start test'):
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
]
for name in protected:
    check(name in names, f'protected group {name} missing')

# --- v0.6.6 visual & presentation update ------------------------------------
res_list = data['resources']['resources']
resource_names = {r['name'] for r in res_list}
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

# The unchanged behaviour groups must keep their exact event content.
production = next(e for e in events if e.get('name') == 'v0.6.5 Production Round Start + Main Menu')
code = '\n'.join(production['events'][0]['inlineCode'])
for needle in ('data-screen="menu"', 'data-screen="reveal"', 'data-screen="countdown"',
               'data-screen="result"', "currentPhase === 'Countdown'",
               "left > 2.1 ? '3'", '5秒間の人狼モード中は', '人狼役', '全員凍結で決着'):
    check(needle in code, f'production UI marker missing: {needle}')

if problems:
    for problem in problems:
        print('GUARD FAIL:', problem)
    sys.exit(1)
print('ICE WOLF visual round semantic guard PASS')
