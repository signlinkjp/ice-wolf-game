#!/usr/bin/env python3
"""Semantic guard for the v0.6.5 improvement round (run by GitHub Actions)."""
import json
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
check(objects.get('InfectButton', {}).get('string') == '[ 人狼役 ]', 'wolf role button label not applied')
check(any(i['name'] == 'CountText' and i['layer'] == 'UI' for i in scene['instances']), 'CountText instance missing')

scene_vars = {v['name'] for v in scene['variables']}
for name in ('AliveHumans', 'FrozenHumans', 'NearbyFrozenCount',
             'WolfRolePickOpen', 'WolfRolePickTarget', 'WolfRolePickCount'):
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
print('v0.6.5 improvement semantic guard PASS')
