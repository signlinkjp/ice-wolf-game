import copy
import json
import math
import uuid
from pathlib import Path

path = Path('game.json')
data = json.loads(path.read_text(encoding='utf-8'))
layout = next(x for x in data['layouts'] if x.get('name') == 'FROST LAB')

# v0.5.2 balance: 7 total participants (1 Player Wolf + 6 Human Actors)
# and a 3m30s match. This branch deliberately starts from the English v0.5.1
# AI branch so the Japanese UI-only PR remains completely separate.
actors = [i for i in layout['instances'] if i.get('name') == 'Actor']
players = [i for i in layout['instances'] if i.get('name') == 'Player']
if len(players) != 1:
    raise RuntimeError(f'expected 1 Player, got {len(players)}')
if len(actors) != 5:
    raise RuntimeError(f'expected v0.5.1 base with 5 Actors, got {len(actors)}')

# Pick an open spawn location programmatically so the 6th Human does not start
# inside an existing wall/barrier or on top of another participant.
def inside_expanded_rect(cx, cy, inst, margin=45):
    x = float(inst.get('x', 0))
    y = float(inst.get('y', 0))
    w = float(inst.get('width', 0))
    h = float(inst.get('height', 0))
    x1, x2 = sorted((x, x + w))
    y1, y2 = sorted((y, y + h))
    return (x1 - margin) <= cx <= (x2 + margin) and (y1 - margin) <= cy <= (y2 + margin)

obstacles = [i for i in layout['instances'] if i.get('name') in ('Wall', 'Barrier')]
occupied = players + actors
candidates = [
    (-560, -560), (-400, -560), (-240, -560), (-80, -560), (80, -560), (240, -560), (400, -560), (560, -560),
    (-560, 560), (-400, 560), (-240, 560), (-80, 560), (80, 560), (240, 560), (400, 560), (560, 560),
    (-560, -400), (560, -400), (-560, 400), (560, 400),
    (-400, 400), (400, 400), (-400, -400), (400, -400),
]
spawn = None
for cx, cy in candidates:
    if not (-650 <= cx <= 650 and -650 <= cy <= 650):
        continue
    if any(inside_expanded_rect(cx, cy, o) for o in obstacles):
        continue
    too_close = False
    for p in occupied:
        px = float(p.get('x', 0))
        py = float(p.get('y', 0))
        if math.hypot(cx - px, cy - py) < 130:
            too_close = True
            break
    if not too_close:
        spawn = (cx, cy)
        break
if spawn is None:
    raise RuntimeError('could not find a safe spawn for Actor #6')

new_actor = copy.deepcopy(actors[-1])
new_actor['persistentUuid'] = str(uuid.uuid4())
new_actor['x'], new_actor['y'] = spawn
new_actor['customSize'] = True
new_actor['width'] = 17
new_actor['height'] = 17
new_actor['depth'] = 32
layout['instances'].append(new_actor)

# 3m30s match. Change both scene defaults and any explicit reset action that
# still writes literal 300 to MatchTimeLeft/MatchDuration.
vars_by_name = {v.get('name'): v for v in layout.get('variables', [])}
for name in ('MatchTimeLeft', 'MatchDuration'):
    if name not in vars_by_name:
        raise RuntimeError(f'missing scene variable {name}')
    vars_by_name[name]['type'] = 'number'
    vars_by_name[name]['value'] = 210

def replace_timer_literals(node):
    if isinstance(node, dict):
        params = node.get('parameters')
        if isinstance(params, list) and any(p in ('MatchTimeLeft', 'MatchDuration') for p in params):
            for idx, p in enumerate(params):
                if p == '300':
                    params[idx] = '210'
        for value in node.values():
            replace_timer_literals(value)
    elif isinstance(node, list):
        for value in node:
            replace_timer_literals(value)

replace_timer_literals(layout.get('events', []))

# Version label only; gameplay remains English on this branch.
build = next(o for o in layout['objects'] if o.get('name') == 'BuildText')
if build.get('string') != 'DEV v0.5.1':
    raise RuntimeError(f'expected DEV v0.5.1 base, got {build.get("string")!r}')
build['string'] = 'DEV v0.5.2'
build.setdefault('content', {})['text'] = 'DEV v0.5.2'

OLD_GROUP = 'v0.5.1 CPU5 Rescue AI + Awakened Wolf Fix'
NEW_GROUP = 'v0.5.2 CPU5 Rescue AI + Repeat Wolf Cycle'
groups = [e for e in layout.get('events', []) if e.get('name') == OLD_GROUP]
if len(groups) != 1:
    raise RuntimeError(f'expected exactly one {OLD_GROUP!r}, got {len(groups)}')
group = groups[0]
group['name'] = NEW_GROUP
js = next(e for e in group['events'] if e.get('type') == 'BuiltinCommonInstructions::JsCode')
code = '\n'.join(js.get('inlineCode', []))

# Make the awakened Wolf a persistent repeating threat:
# white/hidden stalk -> WOLF MODE -> chase/freeze -> 5s cooldown -> repeat.
repls = [
    ('    const aiWolfChaseSpeed = 175;', '    const aiWolfChaseSpeed = 205;'),
    ('    const aiWolfWanderSpeed = 65;', '    const aiWolfStalkSpeed = 90;\n    const aiWolfWanderSpeed = 65;'),
]
for old, new in repls:
    if code.count(old) != 1:
        raise RuntimeError(f'expected one occurrence of {old!r}, got {code.count(old)}')
    code = code.replace(old, new)

old_block = '''      } else {
        if (!Number.isFinite(wolf.__iceWolfAIWolfTurnLeft) || wolf.__iceWolfAIWolfTurnLeft <= 0 || !Number.isFinite(wolf.__iceWolfAIWolfDirX) || !Number.isFinite(wolf.__iceWolfAIWolfDirY)) {
          const angle = Math.random() * Math.PI * 2;
          wolf.__iceWolfAIWolfDirX = Math.cos(angle);
          wolf.__iceWolfAIWolfDirY = Math.sin(angle);
          wolf.__iceWolfAIWolfTurnLeft = 0.65 + Math.random() * 0.9;
        }
        wolf.__iceWolfAIWolfTurnLeft -= dt;
        vx = wolf.__iceWolfAIWolfDirX;
        vy = wolf.__iceWolfAIWolfDirY;
      }
      wolf.setX(Math.max(-708, Math.min(692, wolf.getX() + vx * speed * dt)));'''
new_block = '''      } else if (target) {
        // Hidden stalking: the awakened Wolf remains visually white outside
        // WOLF MODE, but keeps closing the distance instead of wandering away.
        const sdx = target.getCenterXInScene() - wx;
        const sdy = target.getCenterYInScene() - wy;
        const sd = Math.max(Math.hypot(sdx, sdy), 1);
        vx = sdx / sd;
        vy = sdy / sd;
        speed = aiWolfStalkSpeed;
        wolf.__iceWolfAIWolfTurnLeft = 0;
      } else {
        if (!Number.isFinite(wolf.__iceWolfAIWolfTurnLeft) || wolf.__iceWolfAIWolfTurnLeft <= 0 || !Number.isFinite(wolf.__iceWolfAIWolfDirX) || !Number.isFinite(wolf.__iceWolfAIWolfDirY)) {
          const angle = Math.random() * Math.PI * 2;
          wolf.__iceWolfAIWolfDirX = Math.cos(angle);
          wolf.__iceWolfAIWolfDirY = Math.sin(angle);
          wolf.__iceWolfAIWolfTurnLeft = 0.65 + Math.random() * 0.9;
        }
        wolf.__iceWolfAIWolfTurnLeft -= dt;
        vx = wolf.__iceWolfAIWolfDirX;
        vy = wolf.__iceWolfAIWolfDirY;
      }
      wolf.setX(Math.max(-708, Math.min(692, wolf.getX() + vx * speed * dt)));'''
if code.count(old_block) != 1:
    raise RuntimeError(f'expected one awakened-Wolf wander block, got {code.count(old_block)}')
code = code.replace(old_block, new_block)

# Update only the explanatory comments so they describe the repeated cycle.
code = code.replace(
    '    // Pass 1: make every Active Actor Wolf truly active. Outside WOLF MODE it\n    // wanders disguised as a white Human; when a Human is close it enters its\n    // own WOLF MODE, chases, and can freeze exactly one Human. It can never INFECT.',
    '    // Pass 1: every Active Actor Wolf stays a Wolf for the rest of the match.\n    // Outside WOLF MODE it stalks while disguised as a white Human; after cooldown\n    // it re-enters WOLF MODE, chases, freezes one Human, cools down, and repeats.\n    // It can never INFECT.'
)
js['inlineCode'] = code.split('\n')

# Core invariants: original infection stays one-use; Actor Wolf gets no infection path.
# Existing rescue logic already makes Candidate -> Wolf/Active and rescuer -> Frozen.
raw = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
for token in [
    'FrozenWolfCandidate', 'InfectionUsed', 'AIWolfModeLeft', 'AIWolfCooldownLeft',
    "targetVars.get('Role').setString('Wolf')",
    "targetVars.get('State').setString('Active')",
    "actorVars.get('State').setString('Frozen')",
    'freeze_crack.wav', 'TRAP! YOU ARE FROZEN', '255;0;0',
]:
    if token not in raw:
        raise RuntimeError(f'protected token missing after edit: {token}')

path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(f'v0.5.2 applied: 7 players total, 210s match, Actor #6 spawn={spawn}, repeating awakened Wolf cycle')
