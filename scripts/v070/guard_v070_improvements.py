#!/usr/bin/env python3
"""Guard for the ICE WOLF v0.7.0 round (2F, stairs, 5 switches, 3 gates).

Runs inside the one-time CI helper before any gameplay test, so a broken project
file stops the run instead of burning the whole test budget. It checks the parts
that can be checked without launching GDevelop:

  * game.json parses and the v0.7.0 group is the last block of FROST LAB,
  * the 2F slab and its fourteen walls never overlap the 1F play area,
  * every switch and gate spot clears every wall and stays inside its own floor,
  * the switch composition rules (3 correct + 2 dummies at 7 characters, the trap
    only from 8 characters or with 常にON) are the ones the settings promise,
  * the v0.7.0 tests exist and the five known timeout tests are not in the list,
  * the version markers are v0.7.0 everywhere.

Usage: python3 scripts/v070/guard_v070_improvements.py
"""
import json
import sys

GAME = 'game.json'
GROUP_NAME = 'v0.7.0 2階・階段・5スイッチ・3ゲート'
TIMEOUT_TESTS = [
    'Wall block check',
    'STEP1 bounds test',
    'STEP2 core test',
    'v0.3 action clarity test',
    'v0.6.4 Device Tuning liveness test',
]
REQUIRED_TESTS = [
    'v0.7.0 Infect button one line test',
    'v0.7.0 Two floors and stairs test',
    'v0.7.0 Five switches layout test',
    'v0.7.0 Switch hold and gates open test',
    'v0.7.0 Trap switch third wolf test',
    'v0.7.0 Gate escape wins test',
    'v0.7.0 Settings toggles test',
]
problems = []


def fail(message):
    problems.append(message)


with open(GAME, encoding='utf-8') as handle:
    data = json.load(handle)

scene = next((l for l in data['layouts'] if l['name'] == 'FROST LAB'), None)
if scene is None:
    sys.exit('GUARD FAIL: FROST LAB is missing')

names = [e.get('name') for e in scene['events']]
if GROUP_NAME not in names:
    fail('the %s group is missing' % GROUP_NAME)
elif names[-1] != GROUP_NAME:
    fail('the v0.7.0 group must be the last block so the sound engine exists first')

instances = scene['instances']
floors = [i for i in instances if i['name'] == 'Floor']
walls = [i for i in instances if i['name'] == 'Wall']
switches = [i for i in instances if i['name'] == 'SwitchPad']
gates = [i for i in instances if i['name'] == 'GatePad']
stairs = [i for i in instances if i['name'] == 'StairPad']

if len(floors) != 2:
    fail('expected two floor slabs, found %d' % len(floors))
if len(walls) != 44:
    fail('expected 44 wall blocks (30 + 14), found %d' % len(walls))
if len(switches) != 5:
    fail('expected five switch pads, found %d' % len(switches))
if len(gates) != 3:
    fail('expected three gate pads, found %d' % len(gates))
if len(stairs) != 4:
    fail('expected two stair pairs (4 pads), found %d' % len(stairs))

if len(floors) == 2:
    one = [f for f in floors if f['x'] < 800]
    two = [f for f in floors if f['x'] >= 800]
    if len(one) != 1 or len(two) != 1:
        fail('one floor slab must sit on each side of the gap')
    elif one[0]['x'] + one[0]['width'] > two[0]['x']:
        fail('the two floor slabs overlap')

floor_gap = [w for w in walls if 770 < (w['x'] + w['width'] / 2) < 830]
if floor_gap:
    fail('a wall stands in the gap between the floors: %s' % floor_gap[0])
second_floor_walls = [w for w in walls if w['x'] > 800]
if len(second_floor_walls) != 14:
    fail('expected fourteen 2F wall blocks, found %d' % len(second_floor_walls))


def overlaps(a, b, margin=0.0):
    return (a['x'] - margin < b['x'] + b['width'] and a['x'] + a['width'] + margin > b['x']
            and a['y'] - margin < b['y'] + b['height'] and a['y'] + a['height'] + margin > b['y'])


pads = []
for label, items in (('switch', switches), ('gate', gates), ('stair', stairs)):
    for index, pad in enumerate(items):
        for wall in walls:
            if overlaps(pad, wall, 6):
                fail('%s %d overlaps a wall at %s,%s' % (label, index, pad['x'], pad['y']))
        for other_label, other in pads:
            if overlaps(pad, other, 4):
                fail('%s %d overlaps %s' % (label, index, other_label))
        pads.append(('%s%d' % (label, index), pad))
        on_second = (pad['x'] + pad['width'] / 2) > 792
        if on_second:
            if pad['x'] < 886 or pad['x'] + pad['width'] > 2298:
                fail('%s %d leaves the 2F rectangle' % (label, index))
        else:
            if pad['x'] < -714 or pad['x'] + pad['width'] > 698:
                fail('%s %d leaves the 1F rectangle' % (label, index))
        if pad['y'] < -714 or pad['y'] + pad['height'] > 698:
            fail('%s %d leaves the row' % (label, index))

# stair pairs mirror the +1600 shift
if len(stairs) == 4:
    for a, b in ((0, 2), (1, 3)):
        if abs((stairs[b]['x'] - stairs[a]['x']) - 1600) > 0.01 or stairs[b]['y'] != stairs[a]['y']:
            fail('stair pair %d/%d is not a +1600 shift' % (a, b))

code = json.dumps(data, ensure_ascii=False)
for needle, label in (
    ("raw === 'AlwaysOn' || raw === 'Off' ? raw : 'Auto'", 'the three-way trap mode'),
    ('totalPlayersNow() >= 8', 'the eight-character trap threshold'),
    ("kinds.push('trap')", 'the trap switch being dealt'),
    ('becomeThirdWolf', 'the third-wolf transformation'),
    ('SwitchHoldPressed', 'the hold input'),
    ('SWITCH_HOLD = 1.6', 'the 1.6s switch hold'),
    ("'スイッチ: ' + activeCount + '/3'", 'the switch HUD'),
    ('openGate()', 'the gate opening'),
    ('EscapeWonByGate', 'the gate escape flag'),
    ('i < 2 ? i + 2 : i - 2', 'the stair pairing'),
):
    if needle not in code:
        fail('missing implementation marker: %s (%s)' % (needle, label))

test_names = [t['name'] for t in data['tests']]
for name in REQUIRED_TESTS:
    if name not in test_names:
        fail('missing test: %s' % name)
for name in TIMEOUT_TESTS:
    if name in REQUIRED_TESTS:
        fail('a known timeout test is in the required list: %s' % name)

if '開発版 v0.7.0' not in code:
    fail('the in-game build marker is not v0.7.0')
if '❄ Prototype v0.7.0' not in code:
    fail('the menu version is not v0.7.0')
if '開発版 v0.6.11' in code:
    fail('a v0.6.11 build marker is still in the project')

# the one-line infect button
infect = next((o for o in scene['objects'] if o['name'] == 'InfectButton'), None)
if infect is None:
    fail('InfectButton is missing')
else:
    if infect.get('characterSize') != 30:
        fail('InfectButton characterSize is %s, expected 30' % infect.get('characterSize'))
    button_instance = next((i for i in instances if i['name'] == 'InfectButton'), None)
    if button_instance is None:
        fail('InfectButton has no instance')
    else:
        if button_instance['width'] != 300:
            fail('InfectButton width is %s, expected 300' % button_instance['width'])
        if button_instance['x'] + button_instance['width'] > 1280:
            fail('InfectButton leaves the 1280px screen')

if problems:
    print('GUARD FAIL (%d):' % len(problems))
    for line in problems:
        print(' -', line)
    sys.exit(1)
print('GUARD PASS: 2F slab + %d walls, %d switches, %d gates, %d stairs, %d tests'
      % (len(walls), len(switches), len(gates), len(stairs), len(test_names)))
