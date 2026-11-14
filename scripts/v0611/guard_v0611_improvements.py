#!/usr/bin/env python3
"""Semantic guard for the ICE WOLF v0.6.11 wall-through-thaw-prevention round.

Run by GitHub Actions from the repository root (it reads the relative game.json).
"""
import json
import os
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
actor_vars = {v['name']: v for v in objects['Actor']['variables']}
res_list = data['resources']['resources']
raw = json.dumps(data, ensure_ascii=False)
sources = {t['name']: (t['source'] if isinstance(t['source'], str) else '\n'.join(t['source']))
           for t in data['tests']}
test_names = [t['name'] for t in data['tests']]

WALL_GROUP = 'v0.6.11 壁越し解凍防止'
NEW_TEST = 'v0.6.11 No Wall Rescue test'
RESCUE_RANGE = '105'

# --- 1. the new group sits between the counter and the ring ----------------
check(names.count(WALL_GROUP) == 1, f'{WALL_GROUP} must exist exactly once')
if WALL_GROUP in order and 'v0.6.9 円形解凍リング' in order:
    check(order[WALL_GROUP] == order['v0.6.9 円形解凍リング'] - 1,
          'the wall check must run immediately before the thaw ring')
    check(order[WALL_GROUP] > order['v0.6.5 Survivor/Frozen counter + Wolf role pick'],
          'the wall check must run after the survivor counter')
    check(order[WALL_GROUP] < order['Wolf actions'], 'the wall check must run before Wolf actions')

wall_group = next((e for e in events if e.get('name') == WALL_GROUP), None)
check(wall_group is not None, 'the wall-check group is missing')
wall_code = ''
if wall_group is not None:
    check(len(wall_group['events']) == 1, 'the wall-check group must hold one JS event')
    check(wall_group['events'][0]['type'] == 'BuiltinCommonInstructions::JsCode',
          'the wall-check event must be inline JS')
    wall_code = '\n'.join(wall_group['events'][0]['inlineCode'])

for needle in ("runtimeScene.getObjects('Wall')",
               "runtimeScene.getObjects('Actor')",
               "runtimeScene.getObjects('Player')",
               'wall.getX()', 'wall.getY()', 'wall.getWidth()', 'wall.getHeight()',
               'const segmentHitsRect = (x1, y1, x2, y2, rect) => {',
               'const insideRect = (x, y, rect) =>',
               'if (insideRect(px, py, rect) || insideRect(ax, ay, rect)) continue;',
               "blockedVar.setString(blocked ? '1' : '0');",
               "const blockedVar = actorVars.get('WallBlocked');",
               "actorVars.get('RescueDistance')",
               "vars.get('WallBlockedCount').setNumber(blockedCount);",
               "vars.get('RescueTargetCount').setNumber(reachableTargets);",
               "vars.get('WallCheckReady').setBoolean(player !== null && wallRects.length > 0);",
               'const rescueRange = rangeVar ? rangeVar.getAsNumber() : 105;',
               'player.getCenterXInScene()', 'player.getCenterYInScene()',
               'actor.getCenterXInScene()', 'actor.getCenterYInScene()'):
    check(needle in wall_code, f'wall-check marker missing: {needle}')
check('Math.hypot' not in wall_code, 'the wall check must use its own distance math')
check('<= rescueRange' in wall_code, 'the reachable-target count ignores the range')

# --- 2. the rescue chain is wall-aware and 105px --------------------------
ring = next(e for e in events if e.get('name') == 'v0.6.9 円形解凍リング')
check(len(ring['events']) == 4, 'the ring group must keep its 4 sub-events')
wolf = next(e for e in events if e.get('name') == 'Wolf actions')
targets = [(ring['events'][0], 'ring hold'), (wolf['events'][4], 'rescue button'), (wolf['events'][6], 'thaw')]
for event, label in targets:
    conds = [(c['type']['value'], c['parameters']) for c in event['conditions']]
    distances = [p for kind, p in conds if kind == 'Distance' and p[0] == 'Player' and p[1] == 'Actor']
    check(len(distances) == 1, f'{label}: expected one Player/Actor distance, got {len(distances)}')
    if distances:
        check(distances[0][2] == RESCUE_RANGE,
              f'{label}: the rescue reach is {distances[0][2]}, expected {RESCUE_RANGE}')
    wall_filters = [p for kind, p in conds
                    if kind == 'StringObjectVariable' and p[0] == 'Actor' and p[1] == 'WallBlocked']
    check(len(wall_filters) == 1, f'{label}: missing the Actor.WallBlocked filter')
    if wall_filters:
        check(wall_filters[0][2] == '=' and wall_filters[0][3] == '"0"',
              f'{label}: the wall filter must keep the clear actors only')
    kinds = [kind for kind, _ in conds]
    if 'Distance' in kinds:
        index = next(i for i, c in enumerate(event['conditions'])
                     if c['type']['value'] == 'Distance' and c['parameters'][0] == 'Player')
        neighbour = event['conditions'][index + 1]['type']['value'] if index + 1 < len(event['conditions']) else ''
        check(neighbour == 'StringObjectVariable', f'{label}: the wall filter must follow the distance')

# the infect action stays a 140px contact action (only the thaw is wall-gated)
infect_events = [sub for sub in wolf['events'] for c in (sub.get('conditions') or [])
                 if c['type']['value'] == 'Distance' and c['parameters'][:3] == ['Player', 'Actor', '140']]
check(len(infect_events) == 3, f'the infect reach drifted: {len(infect_events)} x 140 expected')
for sub in infect_events:
    conds = [(c['type']['value'], c['parameters']) for c in sub['conditions']]
    check(not any(kind == 'StringObjectVariable' and p[0] == 'Actor' and p[1] == 'WallBlocked'
                  for kind, p in conds),
          'the infect action must not carry a stray wall filter')

# --- 3. the declarations the JS relies on ---------------------------------
rescue_defaults = {'RescueRange': (105, 'number'),
                   'WallBlockedCount': (0, 'number'),
                   'RescueTargetCount': (0, 'number'),
                   'WallCheckReady': (False, 'boolean')}
for name, (value, kind) in rescue_defaults.items():
    entry = scene_vars.get(name)
    check(entry is not None, f'scene variable {name} missing (the wall code writes it)')
    if entry is None:
        continue
    check(entry['type'] == kind, f'{name} must be {kind}')
    check(entry['value'] == value, f'{name} default drifted: {entry["value"]}')
actor_defaults = {'WallBlocked': ('0', 'string'), 'RescueDistance': (0, 'number')}
for name, (value, kind) in actor_defaults.items():
    entry = actor_vars.get(name)
    check(entry is not None, f'Actor object variable {name} missing')
    if entry is None:
        continue
    check(entry['type'] == kind, f'Actor.{name} must be {kind}')
    check(entry['value'] == value, f'Actor.{name} default drifted: {entry["value"]}')

# --- 4. version markers ---------------------------------------------------
check('❄ Prototype v0.6.11' in raw, 'the start screen still shows an older prototype version')
check(objects.get('BuildText', {}).get('string') == '開発版 v0.6.11',
      f'BuildText default is stale: {objects.get("BuildText", {}).get("string")}')
check("setString('開発版 v0.6.11')" in raw, 'the runtime build marker is stale')
for stale in ('開発版 v0.6.10', 'Prototype v0.6.10', 'v0.6.10 壁越し'):
    check(stale not in raw, f'a stale version marker survived inside game.json: {stale}')
build_marker_tests = [name for name, source in sources.items() if '開発版 v0.6.' in source]
check(len(build_marker_tests) == 8, f'build-marker assertions: {len(build_marker_tests)}')
for name in build_marker_tests:
    check('開発版 v0.6.11' in sources[name], f'{name} was not moved to the v0.6.11 build marker')

pbx = open('ios/App/App.xcodeproj/project.pbxproj', encoding='utf-8').read()
check(pbx.count('MARKETING_VERSION = 0.6.11;') == 2, 'the iOS marketing version is not 0.6.11 in both configs')
check('MARKETING_VERSION = 0.6.10;' not in pbx, 'the iOS marketing version still says 0.6.10')
doc = open('docs/ios-testflight-setup.md', encoding='utf-8').read()
check('Marketing Version（表示バージョン）: **0.6.11**' in doc, 'the iOS setup doc still shows 0.6.10')
verifier = open('scripts/ios/verify-ios-project.py', encoding='utf-8').read()
check('DEFAULT_MARKETING_VERSION = "0.6.11"' in verifier,
      'the iOS verifier still defaults to 0.6.10 and would reject the raised project')
ios_workflow = open('docs/ios-testflight-workflow.yml', encoding='utf-8').read()
check('default: "0.6.11"' in ios_workflow, 'the iOS workflow copy still defaults to 0.6.10')

# --- 5. the protected suite and its geometry ------------------------------
protected_tests = (
    'Stability self-test', 'Wall block check', 'STEP1 bounds test', 'STEP2 core test',
    'v0.3 action clarity test', 'v0.6.0 human-side CPU Wolf test',
    'v0.6.0 CPU Wolf device diagnostic test', 'v0.6.1 Human CPU navigation recovery test',
    'v0.6.2 Color-independent Actor ID Labels test', 'v0.6.3 Mobile Virtual Joystick test',
    'v0.6.4 Compact Joystick + Overview Camera test', 'v0.6.4 Device Tuning liveness test',
    'v0.6.5 Production Round Start test', 'v0.6.5 Wolf Mode Multi-Freeze test',
    'v0.6.5 Human Timeout Win Fast test', 'v0.6.5 All Frozen Instant Wolf Win test',
    'v0.6.5 Survivor Frozen Counter test', 'v0.6.5 Wolf Role Pick test',
    'v0.6.7 Role Choice test', 'v0.6.7 Match Duration test', 'v0.6.7 Restart Menu test',
    'v0.6.8 Hold Rescue test', 'v0.6.8 Speed Pad + Warp test', 'v0.6.8 Character 3D Rig test',
    'v0.6.9 Circular Rescue Meter test', 'v0.6.9 Sound FX test',
    'v0.6.9 Label Size + Chase Camera test', 'v0.6.10 Concealed Identity test',
    'v0.6.10 Menu Hero test', NEW_TEST,
)
for name in protected_tests:
    check(name in test_names, f'test {name} missing')

protected_groups = (
    'v0.6.4 Device-Tuned Mobile Virtual Joystick UI', 'v0.6.8 スピード床＆ワープ',
    'v0.6.3 Virtual joystick + keyboard movement (fixed camera)', 'Wall separation (fail-safe)',
    'v0.6.4 Overview Camera Toggle UI', 'v0.6.4 Normal + Overview camera',
    'Playable bounds + failsafe', 'Wolf match flow',
    'v0.6.5 Survivor/Frozen counter + Wolf role pick', WALL_GROUP, 'v0.6.9 円形解凍リング',
    'Wolf actions', 'v0.3 Action clarity feedback',
    'v0.3.5 actor size parity + frozen color enforcement', 'v0.3.4 guaranteed solid-state visuals',
    'v0.6.1 Human CPU Navigation Recovery + CPU Wolf Cycle', 'v0.6.0 CPU Wolf device diagnostic status',
    'v0.6.2 Color-independent Actor ID Labels', 'v0.6.5 Production Round Start + Main Menu',
    'v0.6.6 第二の人狼 秘匿通知', 'v0.6.7 役割・時間の設定 + プレイ中のやり直し',
    'v0.6.8 キャラ3D見た目進化', 'v0.6.9 サウンドエンジン + サウンド設定',
)
for name in protected_groups:
    check(name in names, f'protected group {name} missing')
check(names[-1] == 'v0.6.9 サウンドエンジン + サウンド設定', 'the sound observer must run last in the frame')

# the protected tests that rescue at 62px / 51.5px must keep those coordinates
hold_test = sources.get('v0.6.8 Hold Rescue test', '')
check("harness.setObjectPosition(player.id, 0, 350);" in hold_test, 'the hold-rescue geometry drifted')
check("harness.setObjectPosition(target.id, 62, 350);" in hold_test, 'the 62px hold-rescue gap drifted')
meter_test = sources.get('v0.6.9 Circular Rescue Meter test', '')
check("harness.setObjectPosition(target.id, 62, 350);" in meter_test, 'the 62px ring gap drifted')
step2 = sources.get('STEP2 core test', '')
check('tpPlayer(t0.centerX - 60, t0.centerY)' in step2, 'the STEP2 rescue gap drifted')

# --- 6. the ring and the other rounds stay intact -------------------------
ring_code = '\n'.join(ring['events'][3]['inlineCode'])
for needle in ('RING_DIAMETER = 68', 'stroke-dashoffset', 'RescueHoldMeterPercent',
               'RescueHoldMeterMode', 'RescueHoldMeterVisible', '解凍！'):
    check(needle in ring_code, f'ring marker missing: {needle}')
for texture in ('floor_frostlab.png', 'wall_frostlab.png', 'ice_freeze.png', 'menu_hero.png'):
    entry = next((r for r in res_list if r['name'] == texture), None)
    check(entry is not None and entry.get('file') == 'assets/' + texture,
          f'resource {texture} is not registered as assets/{texture}')
    check(os.path.isfile('assets/' + texture), f'assets/{texture} is missing on disk')
for name in ('Player', 'Actor'):
    for instance in [i for i in scene['instances'] if i['name'] == name]:
        check(instance['width'] == 17 and instance['height'] == 17 and instance.get('depth') == 32,
              f'{name} hitbox drifted to {instance["width"]}x{instance["height"]}x{instance.get("depth")}')
check(sum(1 for i in scene['instances'] if i['name'] == 'Wall') == 30, 'the wall layout drifted')
check(sum(1 for i in scene['instances'] if i['name'] == 'Actor') == 6, 'Actor count drifted')
check(sum(1 for i in scene['instances'] if i['name'] == 'Player') == 1, 'Player count drifted')
check(scene_vars.get('RescueHoldDuration', {}).get('value') == 1.2, 'the hold duration drifted')
check(scene_vars.get('MatchDuration', {}).get('value') == 210, 'MatchDuration drifted')

# --- 7. the new test really asserts the new behaviour --------------------
new_test = sources.get(NEW_TEST, '')
for needle in ('RescueRange', 'WallCheckReady', 'WallBlockedCount', 'RescueTargetCount',
               "wallFlagOf", "'WallBlocked'", "'RescueDistance'",
               'harness.setObjectPosition(player.id, -282.5, -168.5)',
               'harness.setObjectPosition(target.id, -220.5, -168.5)',
               'harness.setObjectPosition(player.id, -8.5, 341.5)',
               'harness.setObjectPosition(target.id, 53.5, 341.5)',
               'the rescue button is hidden across a wall',
               'the gauge never fills across a wall',
               'a wall never lets the neighbour thaw',
               'a full hold still thaws the same-side neighbour',
               'walking behind the wall resets the gauge',
               'the button stays hidden behind the wall',
               '開発版 v0.6.11'):
    check(needle in new_test, f'v0.6.11 test marker missing: {needle}')
check('RescueHoldTime' in new_test and 'RescueHoldSpent' in new_test,
      'the new test must pin the gauge reset')

if problems:
    for problem in problems:
        print('GUARD FAIL:', problem)
    sys.exit(1)
print('ICE WOLF v0.6.11 semantic guard PASS')
