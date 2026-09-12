import copy
import json
import math
import random
import struct
import uuid
import wave
from pathlib import Path

GAME = Path('game.json')
ASSET = Path('assets/freeze_crack.wav')
ICE = '0;255;255'
WHITE = '255;255;255'
BUILD = 'DEV v0.3.1'
SOUND_NAME = 'freeze_crack.wav'
SOUND_URL = 'https://raw.githubusercontent.com/signlinkjp/ice-wolf-game/feature/v0.3-action-clarity/assets/freeze_crack.wav'


def uid():
    return str(uuid.uuid4())


def tval(node):
    t = node.get('type')
    return t.get('value') if isinstance(t, dict) else t


def walk(events):
    for event in events:
        yield event
        yield from walk(event.get('events', []))


def set_scale_action(obj, scale):
    return {
        'type': {'value': 'ScalableCapability::ScalableBehavior::SetValue'},
        'parameters': [obj, 'Scale', '=', str(scale)],
    }


def change_color_action(obj, color):
    return {'type': {'value': 'ChangeColor'}, 'parameters': [obj, json.dumps(color)]}


def play_sound_action():
    return {
        'type': {'value': 'PlaySound'},
        'parameters': ['', SOUND_NAME, 'no', '90', '1'],
    }


def has_action(actions, value, params_prefix=None):
    for a in actions:
        if tval(a) != value:
            continue
        if params_prefix is None:
            return True
        p = a.get('parameters', [])
        if p[:len(params_prefix)] == params_prefix:
            return True
    return False


def is_click(event, name):
    return any(
        tval(c) == 'ButtonStates::ButtonFSM::IsClicked'
        and c.get('parameters', [None])[0] == name
        for c in event.get('conditions', [])
    )


def synth_freeze_wav(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    sr = 44100
    duration = 0.48
    n = int(sr * duration)
    rng = random.Random(1309)
    samples = []
    prev_noise = 0.0
    for i in range(n):
        t = i / sr
        env = math.exp(-11.0 * t)
        noise = rng.uniform(-1.0, 1.0)
        hp = noise - prev_noise
        prev_noise = noise
        phase1 = 2.0 * math.pi * (1700.0 * t - 900.0 * t * t)
        phase2 = 2.0 * math.pi * (2800.0 * t - 1300.0 * t * t)
        tone = math.sin(phase1) + 0.55 * math.sin(phase2)
        click = 0.0
        for ct, amp in ((0.015, 1.0), (0.085, 0.65), (0.160, 0.4)):
            dt = t - ct
            if 0 <= dt <= 0.018:
                click += amp * rng.uniform(-1.0, 1.0) * math.exp(-dt / 0.004)
        x = 0.26 * hp * env + 0.28 * tone * env + 0.48 * click
        x = math.tanh(x * 1.5) * 0.82
        x = max(-1.0, min(1.0, x))
        samples.append(int(x * 32767))
    with wave.open(str(path), 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(b''.join(struct.pack('<h', s) for s in samples))


def make_text_from(base, name, text, size, color, bold=True, outline=3):
    obj = copy.deepcopy(base)
    obj['name'] = name
    obj['persistentUuid'] = uid()
    obj['string'] = text
    obj['characterSize'] = size
    obj['bold'] = bold
    r, g, b = [int(v) for v in color.split(';')]
    obj['color'] = {'r': r, 'g': g, 'b': b}
    obj['behaviors'] = []
    c = obj['content']
    c['text'] = text
    c['characterSize'] = size
    c['bold'] = bold
    c['color'] = color
    c['isOutlineEnabled'] = True
    c['outlineColor'] = '0;0;0'
    c['outlineThickness'] = outline
    return obj


def instance_from(base, name, x, y, width, height):
    inst = copy.deepcopy(base)
    inst['name'] = name
    inst['persistentUuid'] = uid()
    inst['layer'] = 'UI'
    inst['x'] = x
    inst['y'] = y
    inst['width'] = width
    inst['height'] = height
    inst['customSize'] = True
    inst.pop('hidden', None)
    return inst


data = json.loads(GAME.read_text(encoding='utf-8'))
layout = next(x for x in data['layouts'] if x['name'] == 'FROST LAB')
objects = {o['name']: o for o in layout['objects']}
instances = {i['name']: i for i in layout['instances']}

# 1) Create a deterministic, original ice-crack sound asset.
synth_freeze_wav(ASSET)
resources = data['resources']['resources']
if not any(r.get('name') == SOUND_NAME for r in resources):
    resources.append({
        'file': SOUND_URL,
        'kind': 'audio',
        'metadata': '{"extension":".wav","localFilePath":"assets/freeze_crack.wav"}',
        'name': SOUND_NAME,
        'preloadAsMusic': False,
        'preloadAsSound': True,
        'preloadInCache': True,
        'userAdded': True,
    })

# 2) Add a visible build label so the tested source is unambiguous.
if 'BuildText' not in objects:
    base = objects['RoleText']
    build = make_text_from(base, 'BuildText', BUILD, 20, '170;220;255', True, 2)
    layout['objects'].append(build)
    layout['objectsFolderStructure']['children'].append({'objectName': 'BuildText'})
    layout['instances'].append(instance_from(instances['RoleText'], 'BuildText', 1090, 64, 165, 34))

# 3) Play the crack exactly at state transitions into Frozen.
actor_freeze_hits = 0
player_freeze_hits = 0
for event in walk(layout['events']):
    actions = event.get('actions', [])
    actor_freeze = any(
        tval(a) == 'SetStringObjectVariable'
        and a.get('parameters', [])[:2] == ['Actor', 'State']
        and len(a.get('parameters', [])) >= 4
        and a['parameters'][3] == '"Frozen"'
        for a in actions
    )
    player_freeze = any(
        tval(a) == 'SetStringObjectVariable'
        and a.get('parameters', [])[:2] == ['Player', 'State']
        and len(a.get('parameters', [])) >= 4
        and a['parameters'][3] == '"Frozen"'
        for a in actions
    )
    if actor_freeze and not has_action(actions, 'PlaySound', ['', SOUND_NAME]):
        actions.append(play_sound_action())
        actor_freeze_hits += 1
    if player_freeze and not has_action(actions, 'PlaySound', ['', SOUND_NAME]):
        actions.append(play_sound_action())
        player_freeze_hits += 1

# 4) Persistent frozen-state visual enforcement.
# ChangeColor was too subtle on the iPhone 3D preview, so scale is the fallback signal.
# FrozenHuman and FrozenWolfCandidate intentionally remain identical.
if not any(e.get('name') == 'v0.3.1 Frozen visibility enforcement' for e in layout['events']):
    group = {
        'colorB': 228, 'colorG': 176, 'colorR': 74, 'creationTime': 0,
        'name': 'v0.3.1 Frozen visibility enforcement',
        'source': '',
        'type': 'BuiltinCommonInstructions::Group',
        'events': [
            {
                'type': 'BuiltinCommonInstructions::Standard',
                'conditions': [
                    {'type': {'value': 'StringObjectVariable'}, 'parameters': ['Actor', 'State', '=', '"Frozen"']}
                ],
                'actions': [
                    change_color_action('Actor', ICE),
                    set_scale_action('Actor', 1.75),
                ],
            },
            {
                'type': 'BuiltinCommonInstructions::Standard',
                'conditions': [
                    {'type': {'value': 'StringObjectVariable'}, 'parameters': ['Actor', 'State', '=', '"FrozenWolfCandidate"']}
                ],
                'actions': [
                    change_color_action('Actor', ICE),
                    set_scale_action('Actor', 1.75),
                ],
            },
            {
                'type': 'BuiltinCommonInstructions::Standard',
                'conditions': [
                    {'type': {'value': 'StringObjectVariable'}, 'parameters': ['Actor', 'State', '=', '"Active"']}
                ],
                'actions': [
                    change_color_action('Actor', WHITE),
                    set_scale_action('Actor', 1.0),
                ],
            },
        ],
        'parameters': [],
    }
    layout['events'].append(group)

# 5) Reset safety: ensure TEST RESET restores normal actor scale/color.
for event in walk(layout['events']):
    if is_click(event, 'TestResetButton'):
        actions = event.get('actions', [])
        if not has_action(actions, 'ScalableCapability::ScalableBehavior::SetValue', ['Actor', 'Scale']):
            actions.append(set_scale_action('Actor', 1.0))
        if not has_action(actions, 'ChangeColor', ['Actor']):
            actions.append(change_color_action('Actor', WHITE))

# Static validation.
assert actor_freeze_hits >= 1, 'Actor freeze transition not found'
assert any(r.get('name') == SOUND_NAME for r in resources)
assert any(o.get('name') == 'BuildText' for o in layout['objects'])
assert any(e.get('name') == 'v0.3.1 Frozen visibility enforcement' for e in layout['events'])
assert ASSET.exists() and ASSET.stat().st_size > 10000

GAME.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print('v0.3.1 migration PASS')
print('actor_freeze_sound_events=', actor_freeze_hits)
print('player_freeze_sound_events=', player_freeze_hits)
print('freeze_asset_bytes=', ASSET.stat().st_size)
